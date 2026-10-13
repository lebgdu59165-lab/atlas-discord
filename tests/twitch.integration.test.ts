import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.mock('../src/lib/redis',()=>({publish:vi.fn(),redis:vi.fn()}));
import {db} from '../src/lib/db';
import {queueTwitchLive,deliverTwitchLive,type TwitchSettings} from '../src/bot/twitch';
import {TWITCH_MESSAGE,type TwitchStream} from '../src/lib/twitch';
const A='555555555555555555',B='666666666666666666',BOT='777777777777777777';
const settings:TwitchSettings={enabled:true,twitchLogin:'raskuoff',channelId:'1395698905378983939',liveMessage:TWITCH_MESSAGE};
const stream:TwitchStream={id:'12345',user_id:'42',user_login:'raskuoff',user_name:'RaskuOff',type:'live',title:'Live réel simulé en test isolé',game_name:'Un jeu',started_at:'2026-10-13T00:00:00Z'};
beforeAll(async()=>{
  if(!process.env.DATABASE_URL?.includes('atlas_test'))throw new Error('Use an isolated atlas_test database.');
  await db.guild.deleteMany({where:{id:{in:[A,B]}}});
  for(const id of [A,B])await db.guild.create({data:{id,name:'Twitch test',ownerId:BOT,configs:{create:{module:'integrations',value:settings}}}});
});
afterAll(async()=>{await db.guild.deleteMany({where:{id:{in:[A,B]}}});await db.$disconnect();});
describe('Persistent Twitch announcements',()=>{
  it('queues one announcement per stream and guild under concurrent polling',async()=>{
    const results=await Promise.all(Array.from({length:8},()=>queueTwitchLive(A,BOT,settings,stream)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await queueTwitchLive(B,BOT,settings,stream)).toBe(true);
    expect(await db.job.count({where:{guildId:{in:[A,B]},kind:'twitchLive'}})).toBe(2);
  });
  it('does not announce the same stream again after old jobs are cleaned up',async()=>{
    await db.job.deleteMany({where:{guildId:A,kind:'twitchLive'}});
    expect(await queueTwitchLive(A,BOT,settings,stream)).toBe(false);
    expect(await queueTwitchLive(A,BOT,settings,{...stream,id:'12346'})).toBe(true);
  });
  it('cancels a queued message when the integration is disabled',async()=>{
    const job=await db.job.findFirstOrThrow({where:{guildId:A,kind:'twitchLive'}});
    await db.config.update({where:{guildId_module:{guildId:A,module:'integrations'}},data:{value:{...settings,enabled:false}}});
    const fetchGuild=vi.fn();
    expect(await deliverTwitchLive({guilds:{fetch:fetchGuild}} as any,job)).toEqual({cancelled:true});expect(fetchGuild).not.toHaveBeenCalled();
    expect(await queueTwitchLive(A,BOT,settings,{...stream,id:'12347'})).toBe(false);
  });
  it('refuses a destination in another guild before sending anything',async()=>{
    const job=await db.job.findFirstOrThrow({where:{guildId:B,kind:'twitchLive'}}),send=vi.fn();
    const client={guilds:{fetch:async()=>({id:B,channels:{fetch:async()=>({guildId:A,isTextBased:()=>true,send})}})}};
    await expect(deliverTwitchLive(client as any,job)).rejects.toMatchObject({status:400});expect(send).not.toHaveBeenCalled();
  });
  it('records a successful announcement and refuses a second delivery',async()=>{
    const job=await db.job.findFirstOrThrow({where:{guildId:B,kind:'twitchLive'}});
    const send=vi.fn().mockResolvedValue({id:'888888888888888888',url:'https://discord.com/channels/test/announcement'});
    const channel={guildId:B,isTextBased:()=>true,permissionsFor:()=>({has:()=>true}),send};
    const client={guilds:{fetch:async()=>({id:B,channels:{fetch:async()=>channel},members:{fetchMe:async()=>({id:BOT})}})}};
    expect(await deliverTwitchLive(client as any,job)).toMatchObject({messageId:'888888888888888888'});
    expect(send.mock.calls[0][0]).toMatchObject({content:expect.stringContaining('https://www.twitch.tv/raskuoff'),allowedMentions:{parse:[]},enforceNonce:true});
    expect(send.mock.calls[0][0].nonce.length).toBeLessThanOrEqual(25);
    await expect(deliverTwitchLive(client as any,job)).rejects.toMatchObject({status:409});expect(send).toHaveBeenCalledOnce();
    expect((await db.entity.findUniqueOrThrow({where:{id:job.id}})).status).toBe('done');
  });
});
