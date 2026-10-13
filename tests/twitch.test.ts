import {describe,it,expect,vi} from 'vitest';
import {TwitchApi,twitchLogin,twitchMessage,TWITCH_MESSAGE,type TwitchStream} from '../src/lib/twitch';
import {configSchema,defaults,byId} from '../src/shared/catalog';

const stream:TwitchStream={id:'12345',user_id:'42',user_login:'raskuoff',user_name:'RaskuOff',type:'live',title:'Mon live',game_name:'Un jeu',started_at:'2026-10-13T00:00:00Z'};
const response=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
describe('Twitch live notifications',()=>{
  it('normalizes only Twitch channel names and rejects arbitrary addresses',()=>{
    expect(twitchLogin('https://www.twitch.tv/RaskuOff/')).toBe('raskuoff');
    for(const invalid of ['https://evil.example/raskuoff','http://localhost','https://twitch.tv.evil.example/raskuoff','../stream','raskuoff?token=secret'])expect(()=>twitchLogin(invalid)).toThrow();
  });
  it('requires a valid channel and Discord destination when enabled',()=>{
    const value=defaults(byId('integrations')!.fields);
    expect(configSchema('integrations').safeParse(value).success).toBe(true);
    expect(configSchema('integrations').safeParse({...value,enabled:true}).success).toBe(false);
    expect(configSchema('integrations').parse({...value,enabled:true,twitchLogin:'https://www.twitch.tv/RaskuOff',channelId:'1395698905378983939'}).twitchLogin).toBe('raskuoff');
  });
  it('keeps a stream link in announcements including long titles',()=>{
    expect(twitchMessage(TWITCH_MESSAGE,stream)).toContain('https://www.twitch.tv/raskuoff');
    const message=twitchMessage('{title}',{...stream,title:'x'.repeat(2500)});
    expect(message.length).toBeLessThanOrEqual(2000);expect(message.endsWith('https://www.twitch.tv/raskuoff')).toBe(true);
  });
  it('validates a token once and reuses it for subsequent stream checks',async()=>{
    const request=vi.fn().mockResolvedValueOnce(response({access_token:'test-token',expires_in:86400})).mockResolvedValueOnce(response({client_id:'app-id'})).mockResolvedValueOnce(response({data:[stream]})).mockResolvedValueOnce(response({data:[]}));
    const api=new TwitchApi('app-id','private-test-secret',request,()=>100000);
    expect(await api.streams(['raskuoff'])).toEqual([stream]);expect(await api.streams(['raskuoff'])).toEqual([]);
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls[2][0]).toContain('user_login=raskuoff');
    expect(request.mock.calls[2][1].headers['Client-Id']).toBe('app-id');
  });
  it('renews a revoked token and retries the stream read once',async()=>{
    const request=vi.fn().mockResolvedValueOnce(response({access_token:'old',expires_in:86400})).mockResolvedValueOnce(response({client_id:'app-id'})).mockResolvedValueOnce(response({},401)).mockResolvedValueOnce(response({access_token:'new',expires_in:86400})).mockResolvedValueOnce(response({client_id:'app-id'})).mockResolvedValueOnce(response({data:[stream]}));
    expect(await new TwitchApi('app-id','secret',request).streams(['raskuoff'])).toEqual([stream]);
    expect(request).toHaveBeenCalledTimes(6);
  });
  it('does not treat a failed API check as an offline stream or expose a secret',async()=>{
    const request=vi.fn().mockResolvedValue(response({message:'private-test-secret'},403));
    await expect(new TwitchApi('app-id','private-test-secret',request).streams(['raskuoff'])).rejects.toThrow('Twitch refuse');
    await expect(new TwitchApi('','',request).streams(['raskuoff'])).rejects.toThrow('pas encore configurés');
  });
  it('ignores unrelated streams returned by the provider',async()=>{
    const request=vi.fn().mockResolvedValueOnce(response({access_token:'test',expires_in:86400})).mockResolvedValueOnce(response({client_id:'app'})).mockResolvedValueOnce(response({data:[{...stream,user_login:'another_channel'}]}));
    expect(await new TwitchApi('app','secret',request).streams(['raskuoff'])).toEqual([]);
  });
});
