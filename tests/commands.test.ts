import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({find:vi.fn(),metric:vi.fn(),audit:vi.fn(),set:vi.fn()}));
vi.mock('../src/lib/db',()=>({db:{entity:{findMany:mocks.find}}}));
vi.mock('../src/services/store',()=>({metric:mocks.metric,audit:mocks.audit}));
vi.mock('../src/lib/redis',()=>({redis:()=>({set:mocks.set})}));
import {dispatchCommand} from '../src/bot/commands';
import {commandsForSync,builtinCommands} from '../src/shared/commands';
let interaction:any;
const record=(enabled=true)=>({id:'custom',guildId:'guild',status:'active',title:'Custom',data:{name:'hello',description:'Say hello',response:'Bonjour {user}',enabled,allowedRoles:[],cooldown:0}});
beforeEach(()=>{
  vi.resetAllMocks();mocks.find.mockResolvedValue([]);mocks.set.mockResolvedValue('OK');
  interaction={commandName:'ping',guild:{id:'guild',name:'Test',memberCount:42,channels:{cache:{size:3}},roles:{cache:{size:2}},createdTimestamp:0,members:{fetch:vi.fn().mockResolvedValue({roles:{cache:{some:()=>false}}})}},user:{id:'user'},client:{ws:{ping:37}},options:{getString:()=>null,getUser:()=>null},editReply:vi.fn()};
});
describe('Native and custom slash commands',()=>{
  it('runs ping even when no custom command has been configured',async()=>{await dispatchCommand(interaction);expect(interaction.editReply).toHaveBeenCalledWith({content:expect.stringContaining('37 ms'),allowedMentions:{parse:[]}});expect(mocks.audit).toHaveBeenCalledWith('guild','user','command.used',{name:'ping'});});
  it('lists available commands and the dashboard in help',async()=>{interaction.commandName='help';await dispatchCommand(interaction);expect(interaction.editReply.mock.calls[0][0].content).toContain('/ping');expect(interaction.editReply.mock.calls[0][0].content).toContain('/dashboard/guild');});
  it('does not falsely call an absent legacy command disabled',async()=>{interaction.commandName='play';await expect(dispatchCommand(interaction)).rejects.toMatchObject({status:404,message:expect.stringContaining('/play provient de l’ancienne version')});expect(interaction.editReply).not.toHaveBeenCalled();});
  it('preserves an explicit disabled custom command including a native-name override',async()=>{interaction.commandName='ping';const r=record(false);r.data.name='ping';mocks.find.mockResolvedValue([r]);await expect(dispatchCommand(interaction)).rejects.toMatchObject({status:409,message:expect.stringContaining('désactivée dans le tableau de bord')});expect(interaction.editReply).not.toHaveBeenCalled();});
  it('enforces custom role restrictions and cooldown before replying',async()=>{
    interaction.commandName='hello';const r=record();r.data.allowedRoles=['staff'] as any;mocks.find.mockResolvedValue([r]);await expect(dispatchCommand(interaction)).rejects.toMatchObject({status:403});expect(interaction.editReply).not.toHaveBeenCalled();
    r.data.allowedRoles=[];r.data.cooldown=10;mocks.set.mockResolvedValue(null);await expect(dispatchCommand(interaction)).rejects.toMatchObject({status:429});expect(interaction.editReply).not.toHaveBeenCalled();
  });
  it('keeps custom responses and suppresses unintended mentions',async()=>{interaction.commandName='hello';mocks.find.mockResolvedValue([record()]);await dispatchCommand(interaction);expect(interaction.editReply).toHaveBeenCalledWith({content:'Bonjour <@user>',allowedMentions:{parse:[]}});});
  it('preserves native commands when synchronizing custom commands',()=>{const result=commandsForSync([record(),record(false)]);expect(result).toHaveLength(builtinCommands.length+1);expect(result.map(c=>c.name)).toContain('help');expect(result.map(c=>c.name)).toContain('hello');});
  it('refuses ambiguous custom duplicates and avoids duplicate native overrides',()=>{expect(()=>commandsForSync([record(),record()])).toThrow('Deux commandes');const r=record();r.data.name='ping';expect(commandsForSync([r]).filter(c=>c.name==='ping')).toHaveLength(1);});
});
