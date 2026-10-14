import {describe,it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({authorize:vi.fn(),sanction:vi.fn(),setRole:vi.fn(),fetch:vi.fn(),audit:vi.fn(),config:vi.fn()}));
vi.mock('../src/lib/auth',()=>({authorize:m.authorize}));
vi.mock('../src/bot/actions',()=>({sanction:m.sanction,setRole:m.setRole,guardTarget:vi.fn(),automation:vi.fn()}));
vi.mock('../src/services/store',()=>({config:m.config,saveConfig:vi.fn(),audit:m.audit,json:(v:unknown)=>v,createRecord:vi.fn()}));
vi.mock('../src/lib/redis',()=>({publish:vi.fn(),redis:vi.fn()}));
import {actionHandlers} from '../src/bot/command-actions';
import {communityHandlers} from '../src/bot/command-community';
const USER='123456789012345678',GUILD='234567890123456789';let i:any;
beforeEach(()=>{vi.resetAllMocks();m.fetch.mockResolvedValue({id:USER,permissions:{has:()=>false}});m.authorize.mockRejectedValue(new Error('denied'));m.config.mockResolvedValue({value:{enabled:true,requireReason:true}});i={guildId:GUILD,guild:{id:GUILD,ownerId:'other',members:{fetch:m.fetch}},user:{id:USER},options:{getUser:()=>({id:'345678901234567890'}),getString:(n:string)=>n==='user_id'?'345678901234567890':'Motif explicite',getInteger:()=>10},editReply:vi.fn()};});
describe('Native command permission boundaries',()=>{
 it.each(['ban','unban','kick','mute','unmute','warn','warns','clearwarns','clear','slowmode','lock','unlock','nick','role','createrole','deleterole','prefix','setlog','setwelcome','autorole','setxp','config','givexp','resetxp','announce','embed','poll','giveaway'])('rejects unauthorized %s before applying a Discord or database action',async name=>{await expect((actionHandlers[name]??communityHandlers[name])(i)).rejects.toThrow('denied');expect(m.sanction).not.toHaveBeenCalled();expect(m.setRole).not.toHaveBeenCalled();expect(i.editReply).not.toHaveBeenCalled();});
 it('passes a validated exact ID and requested timeout to the moderation service',async()=>{m.authorize.mockResolvedValue({});await actionHandlers.mute(i);expect(m.sanction).toHaveBeenCalledWith(i.guild,USER,{action:'timeout',userId:'345678901234567890',reason:'Motif explicite',seconds:600});});
 it('rejects timeout values over Discord limits and missing mandatory reasons',async()=>{m.authorize.mockResolvedValue({});i.options.getInteger=()=>40321;await expect(actionHandlers.mute(i)).rejects.toMatchObject({status:400});i.options.getString=()=>'';await expect(actionHandlers.ban(i)).rejects.toMatchObject({status:400});expect(m.sanction).not.toHaveBeenCalled();});
 it('does not truncate long Base64 output',async()=>{i.options.getString=()=>'🎵'.repeat(500);await actionHandlers.encode(i);const data=i.editReply.mock.calls[0][0];expect(Buffer.from(data.files[0].attachment.toString(),'base64').toString()).toBe('🎵'.repeat(500));});
 it('produces a real PNG meme',async()=>{await actionHandlers.meme(i);expect(i.editReply.mock.calls[0][0].files[0].attachment.subarray(1,4).toString()).toBe('PNG');});
});
