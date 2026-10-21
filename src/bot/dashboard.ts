import {randomBytes} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelSelectMenuBuilder,ChannelType,EmbedBuilder,ModalBuilder,PermissionFlagsBits as P,RoleSelectMenuBuilder,StringSelectMenuBuilder,TextInputBuilder,TextInputStyle,UserSelectMenuBuilder,escapeMarkdown,type ChatInputCommandInteraction,type Guild,type Interaction,type MessageComponentInteraction,type ModalSubmitInteraction} from 'discord.js';
import {db} from '../lib/db';
import {redis,rateLimit} from '../lib/redis';
import {authorize} from '../lib/auth';
import {AppError} from '../lib/errors';
import {byId,modules,defaults,configSchema,type Field} from '../shared/catalog';
import {builtinCommands} from '../shared/commands';
import {config,saveConfig,updateRecord} from '../services/store';
import {economy} from '../services/community';
import {openTicket} from './actions';
import {musicAction,musicSnapshot} from './music';
import {dashboardButton,responseEmbed} from './presentation';

// Private sessions survive a bot restart. IDs contain only an opaque, expiring token.
const TTL=1800,PREFIX='atlas:panel:';
type Session={guildId:string;userId:string;page:string;offset:number;field?:string;revision?:number;command?:string;item?:string;price?:number;itemRevision?:number};
type PanelInteraction=MessageComponentInteraction|ModalSubmitInteraction;
const configurable=modules.filter(m=>m.fields.length&&m.id!=='commands');
const clean=(value:unknown,max=160)=>escapeMarkdown(String(value??'')).slice(0,max);
const row=(...buttons:ButtonBuilder[])=>new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
const button=(id:string,label:string,style=ButtonStyle.Secondary,emoji?:string)=>{const b=new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);if(emoji)b.setEmoji(emoji);return b;};
const sessionKey=(token:string)=>`atlas:dashboard:${token}`;
async function remember(s:Session){const token=randomBytes(12).toString('hex');await redis().set(sessionKey(token),JSON.stringify(s),'EX',TTL);return (action:string)=>`${PREFIX}${token}:${action}`;}
export async function dashboardSession(token:string,guildId:string,userId:string):Promise<Session>{
  if(!/^[a-f0-9]{24}$/.test(token))throw new AppError(400,'Panneau invalide. Relancez /dashboard.');
  const raw=await redis().get(sessionKey(token));if(!raw)throw new AppError(410,'Ce panneau a expiré. Relancez /dashboard pour en ouvrir un nouveau.');
  const s=JSON.parse(raw) as Session;
  if(s.guildId!==guildId||s.userId!==userId)throw new AppError(403,'Ce panneau est personnel. Ouvrez le vôtre avec /dashboard.');
  return s;
}
async function canConfigure(guild:Guild,userId:string){
  const member=await guild.members.fetch({user:userId,force:true});
  if(userId===guild.ownerId||member.permissions.has(P.Administrator)||member.permissions.has(P.ManageGuild))return true;
  try{await authorize(guild.id,userId,'config');return true;}catch(e){if(e instanceof AppError&&[403,404].includes(e.status))return false;throw e;}
}
async function requireConfiguration(guild:Guild,userId:string){if(!await canConfigure(guild,userId))throw new AppError(403,'La gestion du serveur ou une délégation Configuration est nécessaire pour modifier ces réglages.');}
function formatField(f:Field,value:unknown){
  if(f.type==='boolean')return value?'🟢 Activé':'⚪ Désactivé';
  if(f.type==='ids'){const ids=value as string[];return ids.length?ids.slice(0,6).map(id=>f.key==='excludedUsers'?`<@${id}>`:f.key==='excludedChannels'?`<#${id}>`:`<@&${id}>`).join(' · ')+(ids.length>6?` · +${ids.length-6}`:''):'Aucun';}
  if(!value&&value!==0)return 'À définir';
  if(/(?:channel|category)Id$/i.test(f.key))return `<#${value}>`;
  if(/roleId$/i.test(f.key))return `<@&${value}>`;
  return clean(value,180);
}
async function commandInventory(guildId:string){
  const [cfg,custom]=await Promise.all([config(guildId,'commands'),db.entity.findMany({where:{guildId,module:'commands',status:'active'},orderBy:{title:'asc'}})]);
  const disabled=new Set(String(cfg.value.disabledNative??'').split(/[\s,]+/).map(s=>s.replace(/^\//,'')));
  const all=new Map(builtinCommands.map(c=>[c.name,{...c,enabled:!disabled.has(c.name),record:undefined as typeof custom[number]|undefined}]));
  for(const r of custom){const d=r.data as any;all.set(d.name,{name:d.name,description:d.description||r.title,category:'Personnalisées',options:[],enabled:!!d.enabled,record:r});}
  return {cfg,all:[...all.values()]};
}
export async function dashboardView(guild:Guild,userId:string,page='overview',offset=0,detail:Partial<Session>={},notice?:string){
  const admin=await canConfigure(guild,userId);
  if(!['overview','commands','music','shop','tickets'].includes(page)&&!configurable.some(m=>m.id===page))throw new AppError(400,'Rubrique inconnue.');
  if(configurable.some(m=>m.id===page)&&!admin)throw new AppError(403,'Cette rubrique est réservée à la gestion du serveur.');
  const s:Session={...detail,guildId:guild.id,userId,page,offset:Math.max(0,offset)};
  const embed=new EmbedBuilder().setColor(0x9b82f5).setAuthor({name:`ATLAS  /  ${guild.name}`.slice(0,256),...(guild.iconURL()?{iconURL:guild.iconURL()!}:{})}).setFooter({text:'Votre espace personnel · boutons actifs pendant 30 min'}).setTimestamp();
  const components:any[]=[];
  // All settings fit in one native menu (25 options maximum).
  const entries=[{label:'Accueil',value:'overview',emoji:'🏠'},{label:'Commandes',value:'commands',emoji:'⌨️'},{label:'Lecteur musical',value:'music',emoji:'🎵'},{label:'Boutique',value:'shop',emoji:'🛍️'},{label:'Support et tickets',value:'tickets',emoji:'🎫'},...(admin?configurable.filter(m=>!['music','tickets'].includes(m.id)).map(m=>({label:m.label,value:m.id,emoji:m.id==='integrations'?'📺':'⚙️'})):[])];
  let actions:ButtonBuilder[]=[];
  if(page==='overview'){
    const [tickets,metrics]=await Promise.all([db.ticket.count({where:{guildId:guild.id,status:'open',...(admin?{}:{userId})}}),db.metric.aggregate({where:{guildId:guild.id,kind:'commands'},_sum:{count:true}})]);
    embed.setTitle('Bienvenue dans votre centre de contrôle').setDescription(`**${clean(guild.name,100)}**, directement dans Discord.\nChoisissez une rubrique dans le menu. Vos changements sont enregistrés et partagés avec le site.`).addFields(
      {name:'👥 Communauté',value:`${guild.memberCount.toLocaleString('fr-FR')} membres`,inline:true},{name:'⚡ Connexion',value:`${Math.max(0,guild.client.ws.ping)} ms`,inline:true},{name:'🎫 Tickets ouverts',value:String(tickets),inline:true},{name:'⌨️ Commandes utilisées',value:String(metrics._sum.count??0),inline:true},{name:'🧭 Votre accès',value:admin?'Gestion du serveur et espace membre':'Espace membre',inline:true},{name:'Prise en main',value:'**Commandes** : aide détaillée et activation\n**Musique** : recherche, lecture et file\n**Support** : ouvrir un ticket\n**Réglages** : sélectionnez un module pour le modifier'});
  }else if(page==='commands'){
    const {cfg,all}=await commandInventory(guild.id);s.revision=cfg.revision;
    if(s.command){
      const c=all.find(c=>c.name===s.command);if(!c)throw new AppError(404,'Commande introuvable.');
      s.itemRevision=c.record?.revision;
      embed.setTitle(`⌨️ /${c.name}`).setDescription(clean(c.description,1000)).addFields({name:'Disponibilité',value:c.enabled?'🟢 Activée':'⚪ Désactivée',inline:true},{name:'Catégorie',value:c.category,inline:true},{name:'Utilisation',value:`\`/${c.name}${c.options.map(o=>` ${o.required?'<':'['}${o.name}${o.required?'>':']'}`).join('')}\``.slice(0,1024)},{name:'Paramètres',value:c.options.length?c.options.map(o=>`**${clean(o.name)}** — ${clean(o.description)}`).join('\n').slice(0,1024):'Aucun paramètre requis.'});
      if(admin)actions.push(button('toggle-command',c.enabled?'Désactiver':'Activer',c.enabled?ButtonStyle.Secondary:ButtonStyle.Success));
      actions.push(button('list','Toutes les commandes'));
    }else{
      s.offset=Math.min(s.offset,Math.max(0,Math.floor((all.length-1)/10)*10));const slice=all.slice(s.offset,s.offset+10);
      embed.setTitle('⌨️ Vos commandes').setDescription(`${all.filter(c=>c.enabled).length} activées sur ${all.length} · page ${s.offset/10+1}/${Math.max(1,Math.ceil(all.length/10))}\nSélectionnez une commande pour consulter ses paramètres${admin?' ou changer son activation':''}.`).addFields(slice.map(c=>({name:`${c.enabled?'🟢':'⚪'} /${c.name}`,value:clean(c.description,180)})));
      const id=await remember(s);components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id('command')).setPlaceholder('Consulter une commande').addOptions(slice.map(c=>({label:`/${c.name}`.slice(0,100),value:c.name,description:c.description.slice(0,100)})))));
      if(s.offset>0)actions.push(button('prev','Précédent'));if(s.offset+10<all.length)actions.push(button('next','Suivant'));
    }
  }else if(page==='music'&&!s.field){
    const state=musicSnapshot(guild.id);embed.setTitle('🎵 Votre salon musical').setDescription(state?.current?`**${clean(state.current.title,230)}**\n${state.paused?'⏸ En pause':'▶️ Lecture en cours'}`:'Rejoignez un salon vocal, puis choisissez **Ajouter un son**.').addFields({name:'🔊 Volume',value:`${state?.volume??(await config(guild.id,'music')).value.defaultVolume} %`,inline:true},{name:'🔁 Répétition',value:state?.loop?'Activée':'Désactivée',inline:true},{name:'📋 À suivre',value:state?.queue.length?state.queue.slice(0,8).map((t,n)=>`${n+1}. ${clean(t.title,90)}`).join('\n'):'La file est vide.'});
    if(state?.error)embed.addFields({name:'Dernière information audio',value:clean(state.error,500)});
    actions=[button('play','Ajouter un son',ButtonStyle.Primary,'➕'),button(state?.paused?'resume':'pause',state?.paused?'Reprendre':'Pause',ButtonStyle.Secondary,state?.paused?'▶️':'⏸️').setDisabled(!state?.current),button('skip','Suivant',ButtonStyle.Secondary,'⏭️').setDisabled(!state?.current),button('volume','Volume',ButtonStyle.Secondary,'🔊'),button('stop','Arrêter',ButtonStyle.Danger,'⏹️').setDisabled(!state?.connected)];
    const id=await remember(s);components.push(row(...actions.map(b=>b.setCustomId(id((b.data as any).custom_id)))));actions=[button('loop','Répétition').setDisabled(!state?.connected)];
    if(admin)actions.push(button('settings','Réglages musique'));
  }else if(page==='shop'){
    const cfg=await config(guild.id,'economy');if(!cfg.value.enabled)throw new AppError(409,'L’économie est désactivée. Un gestionnaire peut l’activer dans /dashboard → Économie.');
    const account=await db.account.findUnique({where:{guildId_userId:{guildId:guild.id,userId}}});
    if(s.item){
      const item=await db.entity.findFirst({where:{id:s.item,guildId:guild.id,module:'shop',status:'active'}});if(!item)throw new AppError(404,'Cet article n’est plus disponible.');const data=item.data as any;s.price=data.price;s.itemRevision=item.revision;
      embed.setTitle(`🛍️ ${item.title.slice(0,200)}`).setDescription(clean(data.description||'Article de la boutique du serveur.',800)).addFields({name:'Prix',value:`${data.price} ${clean(cfg.value.currency)}`,inline:true},{name:'Votre portefeuille',value:`${account?.wallet??0} ${clean(cfg.value.currency)}`,inline:true});if(data.roleId)embed.addFields({name:'Rôle inclus',value:`<@&${data.roleId}> · attribution par le bot après paiement.`});actions=[button('buy','Confirmer l’achat',ButtonStyle.Success),button('list','Retour à la boutique')];
    }else{
      const items=await db.entity.findMany({where:{guildId:guild.id,module:'shop',status:'active'},orderBy:{id:'asc'},skip:s.offset,take:11});
      embed.setTitle('🛍️ Boutique du serveur').setDescription(`Portefeuille : **${account?.wallet??0} ${clean(cfg.value.currency)}**\n${items.length?'Choisissez un article pour consulter son prix et confirmer votre achat.':'Aucun article disponible. Les récompenses sont accessibles avec /daily et /work.'}`).addFields(items.slice(0,10).map(r=>({name:r.title.slice(0,256),value:`${(r.data as any).price} ${clean(cfg.value.currency)}`})));
      if(items.length){const id=await remember(s);components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id('item')).setPlaceholder('Choisir un article').addOptions(items.slice(0,10).map(r=>({label:r.title.slice(0,100),value:r.id})))));}
      if(s.offset>0)actions.push(button('prev','Précédent'));if(items.length>10)actions.push(button('next','Suivant'));
    }
  }else if(page==='tickets'&&!s.field){
    const [panels,tickets]=await Promise.all([db.entity.findMany({where:{guildId:guild.id,module:'tickets',status:'active'},orderBy:{id:'asc'},skip:s.offset,take:11}),db.ticket.findMany({where:{guildId:guild.id,userId,status:'open'},take:8})]);
    embed.setTitle('🎫 Votre espace support').setDescription('Retrouvez vos tickets et choisissez un panneau pour contacter l’équipe.').addFields({name:'Vos tickets ouverts',value:tickets.length?tickets.map(t=>`<#${t.channelId}>`).join('\n'):'Aucun ticket ouvert.'});
    if(panels.length){const id=await remember(s);components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id('ticket')).setPlaceholder('Ouvrir un ticket').addOptions(panels.slice(0,10).map(r=>({label:r.title.slice(0,100),value:r.id})))));}else embed.addFields({name:'Panneaux de support',value:'Aucun panneau disponible. Un gestionnaire peut en créer avec les outils de support.'});
    if(s.offset>0)actions.push(button('prev','Précédent'));if(panels.length>10)actions.push(button('next','Suivant'));if(admin)actions.push(button('settings','Réglages tickets'));
  }else{
    const m=byId(page)!;if(!admin||!m.fields.length)throw new AppError(403,'Réglage inaccessible.');
    const c=await config(guild.id,page);s.revision=c.revision;
    if(s.field&&s.field!=='settings'){
      const f=m.fields.find(f=>f.key===s.field);if(!f)throw new AppError(400,'Réglage inconnu.');
      embed.setTitle(`⚙️ ${m.label} · ${f.label}`.slice(0,256)).setDescription(`Valeur actuelle :\n**${formatField(f,c.value[f.key])}**${f.hint&&!f.hint.includes('Identifiant')?`\n\n${f.hint}`:''}`);
      if(f.type==='boolean')actions.push(button('toggle',c.value[f.key]?'Désactiver':'Activer',c.value[f.key]?ButtonStyle.Secondary:ButtonStyle.Success));
      else if(f.type==='select'){const id=await remember(s);components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id('value')).setPlaceholder('Choisir la valeur').addOptions(f.options!.map(value=>({label:value,value,default:value===c.value[f.key]})))));}
      else if(f.type==='ids'||/(?:channel|category|role)Id$/i.test(f.key)){
        const id=await remember(s),isChannel=/(?:channel|category)Id$/i.test(f.key)||f.key==='excludedChannels',isUser=f.key==='excludedUsers';
        const select=isChannel?new ChannelSelectMenuBuilder().addChannelTypes(f.key==='categoryId'?ChannelType.GuildCategory:ChannelType.GuildText,...(f.key==='categoryId'?[]:[ChannelType.GuildAnnouncement])):isUser?new UserSelectMenuBuilder():new RoleSelectMenuBuilder();
        select.setCustomId(id('value')).setPlaceholder('Choisir dans ce serveur').setMinValues(0).setMaxValues(f.type==='ids'?25:1);
        components.push(new ActionRowBuilder<any>().addComponents(select));
        embed.addFields({name:'Choix',value:'Sélectionnez les éléments à conserver. Une sélection vide efface ce réglage.'});
      }else actions.push(button('edit','Modifier',ButtonStyle.Primary,'✏️'));
      actions.push(button('settings','Retour aux réglages'));
    }else{
      embed.setTitle(`⚙️ ${m.label}`).setDescription(`${m.description}\nChoisissez un réglage pour le modifier ici.`).addFields(m.fields.map(f=>({name:f.label,value:formatField(f,c.value[f.key]),inline:!['textarea','ids'].includes(f.type)})));
      if(m.limitation)embed.addFields({name:'Fonctions disponibles',value:m.limitation});
      const id=await remember(s);components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id('field')).setPlaceholder('Modifier un réglage').addOptions(m.fields.map(f=>({label:f.label.slice(0,100),value:f.key})))));
    }
  }
  if(notice)embed.addFields({name:'✅ Dernière action',value:clean(notice,1000)});
  const id=await remember(s);
  components.unshift(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id('page')).setPlaceholder('Naviguer dans Atlas').addOptions(entries.map(e=>({...e,default:e.value===page})))));
  if(actions.length)components.push(row(...actions.map(b=>b.setCustomId(id((b.data as any).custom_id)))));
  components.push(row(button(id('home'),'Accueil',ButtonStyle.Secondary,'🏠'),button(id('refresh'),'Actualiser',ButtonStyle.Secondary,'🔄')));
  return {embeds:[embed],components,allowedMentions:{parse:[] as never[]}};
}
export async function openDashboard(i:ChatInputCommandInteraction,page='overview'){
  // Text prefix commands cannot send private responses; their button opens a private panel.
  if(typeof i.isChatInputCommand!=='function')return i.editReply({embeds:[responseEmbed('Votre centre de contrôle Discord','Cliquez ci-dessous pour ouvrir votre panneau personnel.')],components:[dashboardButton(i.guildId!,page)],allowedMentions:{parse:[]}});
  return i.editReply(await dashboardView(i.guild!,i.user.id,page));
}
export function isDashboardInteraction(i:Interaction){return (i.isMessageComponent()||i.isModalSubmit())&&(i.customId.startsWith(PREFIX)||i.customId.startsWith('atlas:open:'));}
async function claim(token:string){if(!await redis().set(`atlas:dashboard-used:${token}`,'1','EX',TTL,'NX'))throw new AppError(409,'Cette action a déjà été utilisée. Actualisez le panneau avant de recommencer.');}
async function saveField(i:PanelInteraction,s:Session,value:unknown){
  await requireConfiguration(i.guild!,i.user.id);const m=byId(s.page),f=m?.fields.find(f=>f.key===s.field);if(!f)throw new AppError(400,'Réglage inconnu.');
  const c=await config(i.guildId!,s.page);if(c.revision!==s.revision)throw new AppError(409,'Ces réglages ont changé. Actualisez le panneau avant de modifier une valeur.');
  if(['roleIds','verifiedRoleId'].includes(f.key)){
    const actor=await i.guild!.members.fetch(i.user.id),bot=await i.guild!.members.fetchMe();
    for(const id of (Array.isArray(value)?value:value?[value]:[]) as string[]){const role=await i.guild!.roles.fetch(id);if(!role||role.managed||role.id===i.guildId||role.position>=bot.roles.highest.position||(actor.id!==i.guild!.ownerId&&(role.position>=actor.roles.highest.position||(role.permissions.bitfield & ~actor.permissions.bitfield)!==0n)))throw new AppError(403,'Un rôle sélectionné dépasse les permissions du bot ou vos permissions.');}
  }
  const parsed=configSchema(s.page).safeParse({...c.value,[f.key]:value});
  if(!parsed.success)throw new AppError(400,`Réglage non enregistré : ${parsed.error.issues.map(issue=>issue.message).join(' · ').slice(0,700)}`);
  await saveConfig(i.guildId!,i.user.id,s.page,{revision:s.revision,value:parsed.data});
}
export async function handleDashboardInteraction(i:PanelInteraction){
  if(!i.guild)throw new AppError(400,'Ouvrez ce panneau sur votre serveur.');
  // A navigation opens privately even when its source is a public command response.
  if(i.customId.startsWith('atlas:open:')){await i.deferReply({flags:64});const [, ,guildId,page]=i.customId.split(':');if(guildId!==i.guildId)throw new AppError(403,'Ce bouton appartient à un autre serveur.');await rateLimit(`dashboard:${i.guildId}:${i.user.id}`,40);await i.editReply(await dashboardView(i.guild,i.user.id,page||'overview'));return;}
  const match=i.customId.match(/^atlas:panel:([a-f0-9]{24}):([\w-]+)$/);if(!match)throw new AppError(400,'Panneau invalide.');
  const [,token,action]=match;
  // Modal launch must be acknowledged with showModal, without deferring first.
  const showForm=i.isButton()&&['edit','play','volume'].includes(action);
  if(!showForm){if(i.isModalSubmit()&&!i.isFromMessage())await i.deferReply({flags:64});else await i.deferUpdate();}
  const s=await dashboardSession(token,i.guildId!,i.user.id);await rateLimit(`dashboard:${i.guildId}:${i.user.id}`,40);
  if(showForm){
    let label='Titre ou lien YouTube',value='',max=300,paragraph=false;
    if(action==='edit'){
      await requireConfiguration(i.guild,i.user.id);const f=byId(s.page)?.fields.find(f=>f.key===s.field);if(!f||['boolean','ids','select'].includes(f.type))throw new AppError(400,'Champ invalide.');
      const c=await config(i.guildId!,s.page);if(c.revision!==s.revision)throw new AppError(409,'Réglages modifiés. Actualisez ce panneau.');label=f.label;value=String(c.value[f.key]??'');max=f.type==='textarea'?4000:256;paragraph=f.type==='textarea';
    }else if(action==='volume'){label='Volume de 0 à 100';value=String(musicSnapshot(i.guildId!)?.volume??50);max=3;}
    if(action!=='edit'&&s.page!=='music')throw new AppError(400,'Action invalide.');
    const id=await remember(s);const field=new TextInputBuilder().setCustomId('value').setLabel(label.slice(0,45)).setStyle(paragraph?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(action!=='edit').setMaxLength(max);if(value)field.setValue(value.slice(0,max));
    await i.showModal(new ModalBuilder().setCustomId(id(`submit-${action}`)).setTitle((action==='edit'?'Modifier le réglage':action==='play'?'Ajouter un son':'Régler le volume').slice(0,45)).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(field)));return;
  }
  let page=s.page,offset=s.offset,detail:Partial<Session>={field:s.field,command:s.command,item:s.item},notice:string|undefined;
  if(action==='home'){page='overview';offset=0;detail={};}
  else if(action==='page'&&i.isStringSelectMenu()){page=i.values[0];offset=0;detail={};}
  else if(action==='field'&&i.isStringSelectMenu()){await requireConfiguration(i.guild,i.user.id);detail={field:i.values[0]};}
  else if(action==='settings'){await requireConfiguration(i.guild,i.user.id);detail={field:'settings'};}
  else if(action==='list')detail={};
  else if(action==='next'||action==='prev'){offset=Math.max(0,offset+(action==='next'?10:-10));detail={};}
  else if(action==='command'&&i.isStringSelectMenu()&&page==='commands')detail={command:i.values[0]};
  else if(action==='item'&&i.isStringSelectMenu()&&page==='shop')detail={item:i.values[0]};
  else if(action==='ticket'&&i.isStringSelectMenu()&&page==='tickets'){await claim(token);const channel=await openTicket(i.guild,i.user.id,i.values[0]);notice=`Ticket créé : <#${channel}>`;}
  else if(action==='toggle-command'&&page==='commands'&&s.command){
    await requireConfiguration(i.guild,i.user.id);const {cfg,all}=await commandInventory(i.guildId!),c=all.find(c=>c.name===s.command);if(!c)throw new AppError(404,'Commande introuvable.');await claim(token);
    if(c.record){if(c.record.revision!==s.itemRevision)throw new AppError(409,'Commande modifiée. Actualisez le panneau.');const fields=byId('commands')!.recordFields!;await updateRecord(i.guildId!,i.user.id,c.record.id,{title:c.record.title,revision:s.itemRevision,data:{...defaults(fields),...Object.fromEntries(Object.entries(c.record.data as object).filter(([key])=>fields.some(f=>f.key===key))),enabled:!c.enabled}});}
    else{if(cfg.revision!==s.revision)throw new AppError(409,'Commandes modifiées. Actualisez le panneau.');const disabled=new Set(String(cfg.value.disabledNative??'').split(/[\s,]+/).filter(Boolean));if(c.enabled)disabled.add(c.name);else disabled.delete(c.name);await saveConfig(i.guildId!,i.user.id,'commands',{revision:s.revision,value:{...cfg.value,disabledNative:[...disabled].join('\n')}});}
    notice=`/${c.name} ${c.enabled?'désactivée':'activée'}.`;
  }else if(action==='toggle'||action==='value'||action==='submit-edit'){
    await requireConfiguration(i.guild,i.user.id);const f=byId(s.page)?.fields.find(f=>f.key===s.field);if(!f)throw new AppError(400,'Champ inconnu.');let value:unknown;
    if(action==='toggle'&&f.type==='boolean')value=!(await config(i.guildId!,s.page)).value[f.key];
    else if(action==='value'&&i.isAnySelectMenu())value=f.type==='ids'?i.values:i.values[0]??'';
    else if(action==='submit-edit'&&i.isModalSubmit()){const raw=i.fields.getTextInputValue('value');if(f.type==='number'&&!/^-?\d+$/.test(raw.trim()))throw new AppError(400,'Saisissez un nombre entier.');value=f.type==='number'?Number(raw):raw;}
    else throw new AppError(400,'Action de réglage invalide.');await claim(token);await saveField(i,s,value);notice=`${f.label} : enregistré.`;
  }else if(page==='music'&&['pause','resume','skip','stop','loop','submit-play','submit-volume'].includes(action)){
    if(action.startsWith('submit-')&&!i.isModalSubmit())throw new AppError(400,'Formulaire invalide.');await claim(token);const raw=i.isModalSubmit()?i.fields.getTextInputValue('value'):undefined;if(action==='submit-volume'&&!/^\d{1,3}$/.test(raw!))throw new AppError(400,'Volume : entier de 0 à 100.');notice=await musicAction(i.guild,i.user.id,action.replace('submit-',''),action==='submit-volume'?Number(raw):undefined,action==='submit-play'?raw:undefined);detail={};
  }else if(action==='buy'&&page==='shop'&&s.item){
    const item=await db.entity.findFirst({where:{id:s.item,guildId:i.guildId!,module:'shop',status:'active'}});if(!item||item.revision!==s.itemRevision||(item.data as any).price!==s.price)throw new AppError(409,'Cet article a changé. Consultez-le à nouveau avant d’acheter.');await claim(token);const a=await economy(i.guildId!,i.user.id,{action:'buy',itemId:s.item,expectedRevision:s.itemRevision,expectedPrice:s.price});notice=`Achat enregistré : ${item.title}. Portefeuille : ${a.wallet}.`;detail={};
  }else if(action!=='refresh')throw new AppError(400,'Action inconnue. Relancez /dashboard.');
  await i.editReply(await dashboardView(i.guild,i.user.id,page,offset,detail,notice));
}
