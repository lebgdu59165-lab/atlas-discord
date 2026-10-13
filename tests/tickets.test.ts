import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ChannelType} from 'discord.js';
const mocks=vi.hoisted(()=>({find:vi.fn(),update:vi.fn(),config:vi.fn(),metric:vi.fn(),audit:vi.fn(),publish:vi.fn(),authorize:vi.fn()}));
vi.mock('../src/lib/db',()=>({db:{ticket:{findFirst:mocks.find,update:mocks.update}}}));
vi.mock('../src/services/store',()=>({config:mocks.config,metric:mocks.metric,audit:mocks.audit,json:(v:unknown)=>v,getRecord:vi.fn()}));
vi.mock('../src/lib/redis',()=>({publish:mocks.publish,redis:vi.fn()}));
vi.mock('../src/lib/auth',()=>({authorize:mocks.authorize}));
import {ticketAction} from '../src/bot/actions';
const GUILD='1395698900215795732',USER='123456789012345678';
let ticket:any,remove:boolean,channel:any,guild:any;
beforeEach(()=>{
  vi.resetAllMocks();remove=true;
  ticket={id:'ticket-test',guildId:GUILD,userId:USER,channelId:'987654321098765432',status:'open',transcript:null};
  mocks.find.mockImplementation(async()=>({...ticket}));
  mocks.update.mockImplementation(async({data}:any)=>{Object.assign(ticket,data);return {...ticket};});
  mocks.config.mockImplementation(async(_:string,module:string)=>({value:module==='tickets'?{deleteOnClose:remove}:{storeMessageContent:true}}));
  const message={id:'1',createdTimestamp:0,author:{id:USER,username:'User'},content:'<script>unsafe</script>',attachments:new Map()};
  const batch:any=new Map([['1',message]]);batch.last=()=>message;
  channel={id:ticket.channelId,guildId:GUILD,name:'ticket-test',type:ChannelType.GuildText,messages:{fetch:vi.fn().mockResolvedValue(batch)},permissionOverwrites:{edit:vi.fn()},permissionsFor:()=>({has:()=>true}),delete:vi.fn(),isTextBased:()=>true,send:vi.fn()};
  guild={id:GUILD,members:{fetchMe:vi.fn().mockResolvedValue({id:'bot'})},channels:{fetch:vi.fn().mockResolvedValue(channel)}};
});
describe('Closing ticket channels',()=>{
  it('persists an escaped transcript and acknowledges the interaction before deleting only its channel',async()=>{
    const acknowledge=vi.fn(async()=>{expect(ticket.status).toBe('closed');expect(ticket.transcript).toContain('&lt;script&gt;');});
    channel.delete.mockImplementation(async()=>{expect(ticket.transcript).toContain('&lt;script&gt;');expect(acknowledge).toHaveBeenCalledOnce();});
    expect(await ticketAction(guild,USER,{id:ticket.id,action:'close'},true,acknowledge)).toEqual({ok:true,deleted:true});
    expect(guild.channels.fetch).toHaveBeenCalledWith('987654321098765432');expect(channel.delete).toHaveBeenCalledOnce();expect(ticket.channelId).toBeNull();expect(channel.send).not.toHaveBeenCalled();
    await expect(ticketAction(guild,USER,{id:ticket.id,action:'reopen'},true)).rejects.toMatchObject({status:409});
  });
  it('keeps the original close and reopen behavior when automatic deletion is disabled',async()=>{
    remove=false;expect(await ticketAction(guild,USER,{id:ticket.id,action:'close'},true)).toMatchObject({deleted:false});
    expect(channel.delete).not.toHaveBeenCalled();expect(ticket.channelId).toBe(channel.id);
    await ticketAction(guild,USER,{id:ticket.id,action:'reopen'},true);expect(ticket.status).toBe('open');
  });
  it('keeps the saved transcript after a Discord failure and permits a deletion retry without recounting the closure',async()=>{
    channel.delete.mockRejectedValueOnce(new Error('Discord refused'));
    await expect(ticketAction(guild,USER,{id:ticket.id,action:'close'},true)).rejects.toMatchObject({status:502});
    expect(ticket.status).toBe('closed');expect(ticket.transcript).toBeTruthy();expect(ticket.channelId).toBe(channel.id);
    await ticketAction(guild,USER,{id:ticket.id,action:'close'},true);expect(ticket.channelId).toBeNull();expect(mocks.metric).toHaveBeenCalledOnce();
  });
  it('does not delete the channel when saving the transcript fails',async()=>{
    mocks.update.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(ticketAction(guild,USER,{id:ticket.id,action:'close'},true)).rejects.toThrow('database unavailable');expect(channel.delete).not.toHaveBeenCalled();
  });
  it('refuses another guild channel and missing Manage Channels permission',async()=>{
    channel.guildId='another-guild';await expect(ticketAction(guild,USER,{id:ticket.id,action:'close'},true)).rejects.toMatchObject({status:404});
    channel.guildId=GUILD;channel.permissionsFor=()=>({has:()=>false});await expect(ticketAction(guild,USER,{id:ticket.id,action:'close'},true)).rejects.toMatchObject({status:403});
    expect(channel.delete).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();
  });
  it('checks staff authorization when someone other than the creator presses the button',async()=>{
    mocks.authorize.mockRejectedValueOnce(new Error('unauthorized'));
    await expect(ticketAction(guild,'outsider',{id:ticket.id,action:'close'},true)).rejects.toThrow('unauthorized');expect(channel.delete).not.toHaveBeenCalled();
  });
  it('serializes simultaneous button clicks to avoid duplicate deletion and closure counts',async()=>{
    const results=await Promise.allSettled([ticketAction(guild,USER,{id:ticket.id,action:'close'},true),ticketAction(guild,USER,{id:ticket.id,action:'close'},true)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(channel.delete).toHaveBeenCalledOnce();expect(mocks.metric).toHaveBeenCalledOnce();
  });
});
