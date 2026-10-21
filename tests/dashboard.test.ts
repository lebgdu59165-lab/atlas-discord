import {beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({cache:new Map<string,string>(),config:vi.fn(),save:vi.fn(),update:vi.fn(),authorize:vi.fn(),find:vi.fn(),findOne:vi.fn(),buy:vi.fn(),music:vi.fn(),open:vi.fn(),snapshot:vi.fn()}));
vi.mock('../src/lib/redis',()=>({rateLimit:vi.fn(),redis:()=>({get:async(k:string)=>m.cache.get(k)??null,set:async(k:string,v:string,...args:any[])=>{if(args.includes('NX')&&m.cache.has(k))return null;m.cache.set(k,v);return 'OK';}})}));
vi.mock('../src/lib/db',()=>({db:{entity:{findMany:m.find,findFirst:m.findOne},ticket:{count:async()=>2,findMany:async()=>[]},metric:{aggregate:async()=>({_sum:{count:52}})},account:{findUnique:async()=>({wallet:1000})}}}));
vi.mock('../src/lib/auth',()=>({authorize:m.authorize}));
vi.mock('../src/services/store',()=>({config:m.config,saveConfig:m.save,updateRecord:m.update}));
vi.mock('../src/services/community',()=>({economy:m.buy}));
vi.mock('../src/bot/actions',()=>({openTicket:m.open}));
vi.mock('../src/bot/music',()=>({musicAction:m.music,musicSnapshot:m.snapshot}));
import {dashboardView,dashboardSession,handleDashboardInteraction,openDashboard} from '../src/bot/dashboard';
import {modules,defaults} from '../src/shared/catalog';
import {AppError} from '../src/lib/errors';
const G='1395698900215795732',U='1496475906599030884';
let guild:any,configs:Map<string,any>;
const buttons=(view:any)=>view.components.flatMap((r:any)=>r.toJSON().components).filter((c:any)=>c.type===2);
const getButton=(view:any,label:string)=>buttons(view).find((b:any)=>b.label===label).custom_id;
function interaction(id:string,kind='button',extra:any={}){return {customId:id,guild,guildId:G,user:{id:U},deferReply:vi.fn(),deferUpdate:vi.fn(),editReply:vi.fn(),showModal:vi.fn(),isButton:()=>kind==='button',isStringSelectMenu:()=>kind==='select',isAnySelectMenu:()=>kind==='select',isModalSubmit:()=>kind==='modal',isFromMessage:()=>true,...extra} as any;}
beforeEach(()=>{
 vi.clearAllMocks();m.cache.clear();configs=new Map(modules.map(mod=>[mod.id,{value:defaults(mod.fields),revision:4}]));configs.get('economy').value.enabled=true;
 m.config.mockImplementation(async(_g,id)=>structuredClone(configs.get(id)));
 m.save.mockImplementation(async(_g,_u,id,input)=>{configs.set(id,{value:input.value,revision:input.revision+1});});
 m.find.mockResolvedValue([]);m.findOne.mockResolvedValue(null);m.buy.mockResolvedValue({wallet:900});m.snapshot.mockReturnValue(null);m.music.mockResolvedValue('Lecture mise en pause.');m.authorize.mockRejectedValue(new AppError(403,'Refusé.'));
 guild={id:G,ownerId:U,name:'The Rasku Family',iconURL:()=>null,memberCount:42,client:{ws:{ping:33}},members:{fetch:vi.fn().mockResolvedValue({id:U,permissions:{has:()=>false}})}};
});
describe('Native Discord dashboard',()=>{
 it('keeps every configurable module within Discord embed, row and menu limits',async()=>{
  for(const mod of ['overview','commands','music','shop','tickets',...modules.filter(m=>m.fields.length&&m.id!=='commands').map(m=>m.id)]){
   const view=await dashboardView(guild,U,mod,0,['music','tickets'].includes(mod)?{field:'settings'}:{});expect(view.components.length).toBeLessThanOrEqual(5);
   for(const row of view.components){const data=row.toJSON();expect(data.components.length).toBeLessThanOrEqual(5);for(const c of data.components as any[]){expect(c.custom_id.length).toBeLessThanOrEqual(100);if(c.options)expect(c.options.length).toBeLessThanOrEqual(25);}}
   const e=view.embeds[0].toJSON();expect(e.fields?.length??0).toBeLessThanOrEqual(25);expect(JSON.stringify(e).length).toBeLessThan(6000);expect(JSON.stringify(view)).not.toContain('onrender.com');
  }
 });
 it('rejects foreign users, foreign guilds and expired sessions',async()=>{
  const view=await dashboardView(guild,U),token=getButton(view,'Actualiser').split(':')[2];
  await expect(dashboardSession(token,G,'other-user')).rejects.toMatchObject({status:403});await expect(dashboardSession(token,'other-guild',U)).rejects.toMatchObject({status:403});m.cache.clear();await expect(dashboardSession(token,G,U)).rejects.toMatchObject({status:410});
 });
 it('opens public source buttons as a fresh private reply',async()=>{const i=interaction(`atlas:open:${G}:music`);await handleDashboardInteraction(i);expect(i.deferReply).toHaveBeenCalledWith({flags:64});expect(i.deferUpdate).not.toHaveBeenCalled();expect(i.editReply).toHaveBeenCalledOnce();});
 it('does not expose configuration to ordinary members',async()=>{guild.ownerId='someone-else';await expect(dashboardView(guild,U,'moderation')).rejects.toMatchObject({status:403});const view=await dashboardView(guild,U);expect(view.components[0].toJSON().components[0].options.map((o:any)=>o.value)).not.toContain('moderation');});
 it('rechecks revoked permissions before writing',async()=>{const view=await dashboardView(guild,U,'tickets',0,{field:'deleteOnClose'});guild.ownerId='someone-else';await expect(handleDashboardInteraction(interaction(getButton(view,'Activer')))).rejects.toMatchObject({status:403});expect(m.save).not.toHaveBeenCalled();});
 it('saves a real ticket setting and rejects replay of its old button',async()=>{const view=await dashboardView(guild,U,'tickets',0,{field:'deleteOnClose'}),id=getButton(view,'Activer');await handleDashboardInteraction(interaction(id));expect(m.save).toHaveBeenCalledWith(G,U,'tickets',expect.objectContaining({revision:4,value:expect.objectContaining({deleteOnClose:true})}));await expect(handleDashboardInteraction(interaction(id))).rejects.toMatchObject({status:409});expect(m.save).toHaveBeenCalledOnce();});
 it('refuses stale revisions without overwriting other settings',async()=>{const view=await dashboardView(guild,U,'tickets',0,{field:'deleteOnClose'});configs.get('tickets').revision++;await expect(handleDashboardInteraction(interaction(getButton(view,'Activer')))).rejects.toMatchObject({status:409});expect(m.save).not.toHaveBeenCalled();});
 it('launches a modal before deferring and validates numeric input',async()=>{const view=await dashboardView(guild,U,'music',0,{field:'maxQueue'}),i=interaction(getButton(view,'Modifier'));await handleDashboardInteraction(i);expect(i.showModal).toHaveBeenCalledOnce();expect(i.deferUpdate).not.toHaveBeenCalled();const modal=i.showModal.mock.calls[0][0].toJSON();const submit=interaction(modal.custom_id,'modal',{fields:{getTextInputValue:()=>'-3'}});await expect(handleDashboardInteraction(submit)).rejects.toMatchObject({status:400});expect(m.save).not.toHaveBeenCalled();});
 it('uses native role and channel pickers instead of requiring pasted IDs',async()=>{const roles=await dashboardView(guild,U,'tickets',0,{field:'supportRoles'}),channels=await dashboardView(guild,U,'welcome',0,{field:'channelId'});expect(roles.components[1].toJSON().components[0].type).toBe(6);expect(channels.components[1].toJSON().components[0].type).toBe(8);});
 it('preserves other disabled commands when enabling one command',async()=>{configs.get('commands').value.disabledNative='decode\nping';const view=await dashboardView(guild,U,'commands',0,{command:'ping'});await handleDashboardInteraction(interaction(getButton(view,'Activer')));expect(m.save).toHaveBeenCalledWith(G,U,'commands',{revision:4,value:{disabledNative:'decode'}});});
 it('paginates the command catalog without omitting the last command',async()=>{let view=await dashboardView(guild,U,'commands',70);expect(view.embeds[0].toJSON().fields?.length).toBe(1);expect(buttons(view).map((b:any)=>b.label)).toContain('Précédent');expect(buttons(view).map((b:any)=>b.label)).not.toContain('Suivant');});
 it('checks purchase revision and price and allows only one purchase per confirmation',async()=>{m.findOne.mockResolvedValue({id:'item',title:'VIP',revision:3,data:{price:100}});const view=await dashboardView(guild,U,'shop',0,{item:'item'}),id=getButton(view,'Confirmer l’achat');await handleDashboardInteraction(interaction(id));expect(m.buy).toHaveBeenCalledWith(G,U,{action:'buy',itemId:'item',expectedRevision:3,expectedPrice:100});await expect(handleDashboardInteraction(interaction(id))).rejects.toMatchObject({status:409});expect(m.buy).toHaveBeenCalledOnce();});
 it('refuses purchases if the article changes after confirmation is displayed',async()=>{m.findOne.mockResolvedValue({id:'item',title:'VIP',revision:3,data:{price:100}});const view=await dashboardView(guild,U,'shop',0,{item:'item'});m.findOne.mockResolvedValue({id:'item',title:'VIP',revision:4,data:{price:200}});await expect(handleDashboardInteraction(interaction(getButton(view,'Confirmer l’achat')))).rejects.toMatchObject({status:409});expect(m.buy).not.toHaveBeenCalled();});
 it('passes the actual interacting user to existing voice authorization',async()=>{m.snapshot.mockReturnValue({current:{title:'Son'},queue:[],volume:50,connected:true});const view=await dashboardView(guild,U,'music');await handleDashboardInteraction(interaction(getButton(view,'Pause')));expect(m.music).toHaveBeenCalledWith(guild,U,'pause',undefined,undefined);});
 it('keeps prefix command settings private behind an entry button',async()=>{const i={guildId:G,guild,user:{id:U},editReply:vi.fn()} as any;await openDashboard(i);expect(i.editReply.mock.calls[0][0].components[0].toJSON().components[0].custom_id).toBe(`atlas:open:${G}:overview`);expect(m.config).not.toHaveBeenCalled();});
});
