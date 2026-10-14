import { Client, Guild, GuildMember, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { db } from '../lib/db';
import { AppError } from '../lib/errors';
import { authorize } from '../lib/auth';
import { config, json, audit, metric, getRecord } from '../services/store';
import { variables, permissionFor, type Permission } from '../shared/catalog';
import { publish } from '../lib/redis';
import { deliverTwitchLive } from './twitch';
import { commandsForSync } from '../shared/commands';
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
async function me(guild:Guild,permission:bigint) {
  const bot=await guild.members.fetchMe();if(!bot.permissions.has(permission)) throw new AppError(403,'Le bot ne dispose pas de la permission Discord requise.');return bot;
}
export async function guardTarget(guild:Guild,userId:string,actorId?:string,permission=PermissionFlagsBits.ModerateMembers) {
  const bot=await me(guild,permission),target=await guild.members.fetch(userId);
  if(target.id===guild.ownerId || target.id===bot.id || target.roles.highest.position>=bot.roles.highest.position)throw new AppError(403,'La hiérarchie Discord interdit cette action.');
  if(actorId && actorId!==guild.ownerId) {
    const actor=await guild.members.fetch(actorId);
    if(target.id===actor.id || target.roles.highest.position>=actor.roles.highest.position)throw new AppError(403,'Votre rôle doit être supérieur à celui du membre visé.');
  }
  return target;
}
export async function setRole(guild:Guild,userId:string,roleId:string,add:boolean,actorId?:string) {
  const bot=await me(guild,PermissionFlagsBits.ManageRoles),role=await guild.roles.fetch(roleId),target=await guild.members.fetch(userId);
  if(!role || role.managed || role.id===guild.id || role.position>=bot.roles.highest.position)throw new AppError(403,'Ce rôle ne peut pas être géré par le bot.');
  if(actorId && actorId!==guild.ownerId) {const actor=await guild.members.fetch(actorId);if(role.position>=actor.roles.highest.position || target.roles.highest.position>=actor.roles.highest.position || (role.permissions.bitfield & ~actor.permissions.bitfield)!==0n)throw new AppError(403,'Votre hiérarchie ou vos permissions interdisent ce rôle.');}
  if(add)await target.roles.add(role);else await target.roles.remove(role);
}
export async function sanction(guild:Guild,actorId:string,p:any,automatic=false) {
  const c=await config(guild.id,'moderation');
  if(!c.value.enabled && !automatic)throw new AppError(409,'Modération désactivée.');
  const reason=p.reason || 'Protection automatique';
  if(p.action==='unwarn') {
    const changed=await db.case.updateMany({where:{id:p.caseId,guildId:guild.id,userId:p.userId,kind:'warn',revokedAt:null},data:{revokedAt:new Date()}});
    if(!changed.count)throw new AppError(404,'Avertissement actif introuvable.');
    await audit(guild.id,actorId,'moderation.unwarn',{reason},p.userId);return;
  }
  if(p.action==='unban') {await me(guild,PermissionFlagsBits.BanMembers);await guild.members.unban(p.userId,reason);}
  else {
    const flag=['ban','tempban'].includes(p.action)?PermissionFlagsBits.BanMembers:p.action==='kick'?PermissionFlagsBits.KickMembers:PermissionFlagsBits.ModerateMembers;
    let member:GuildMember|undefined;
    try {member=await guardTarget(guild,p.userId,automatic?undefined:actorId,flag);}catch(e){
      // Bans can target a user who already left. Fetch to distinguish absence from forbidden hierarchy.
      const exists=await guild.members.fetch(p.userId).catch(()=>null);
      if(exists || !['ban','tempban'].includes(p.action))throw e;
      await me(guild,PermissionFlagsBits.BanMembers);
    }
    if(c.value.dm && member && !['untimeout','warn'].includes(p.action))await member.send(`Sanction sur ${guild.name} : ${p.action}. Motif : ${reason}`).catch(()=>{});
    if(['ban','tempban'].includes(p.action))await guild.members.ban(p.userId,{reason});
    if(p.action==='kick')await member!.kick(reason);
    if(p.action==='timeout')await member!.timeout(Number(p.seconds)*1000,reason);
    if(p.action==='untimeout')await member!.timeout(null,reason);
  }
  const entry=await db.case.create({data:{guildId:guild.id,userId:p.userId,actorId,kind:p.action,reason,expiresAt:['timeout','tempban'].includes(p.action)?new Date(Date.now()+Number(p.seconds)*1000):null}});
  await metric(guild.id,'sanctions');await audit(guild.id,actorId,`moderation.${p.action}`,{reason,caseId:entry.id},p.userId);
  if(c.value.logChannelId)await sendText(guild,String(c.value.logChannelId),`${p.action} · <@${p.userId}> · ${reason}`).catch(()=>{});
  await publish(guild.id,'moderation');
}
export async function sendText(guild:Guild,channelId:string,content:string) {
  const channel=await guild.channels.fetch(channelId);
  if(!channel?.isTextBased() || !('send' in channel))throw new AppError(400,'Salon textuel introuvable.');
  return channel.send({content:content.slice(0,2000),allowedMentions:{parse:[]}});
}
export async function publishRecord(guild:Guild,id:string) {
  const r=await getRecord(guild.id,id),d=r.data as any;
  const embed=new EmbedBuilder().setTitle(r.title.slice(0,256)).setDescription(variables(d.description||' ',{server:guild.name,memberCount:guild.memberCount}).slice(0,4096)).setColor(d.color||'#7c6aff');
  if(d.author)embed.setAuthor({name:d.author});if(d.footer)embed.setFooter({text:d.footer});
  if(d.image)embed.setImage(d.image);if(d.thumbnail)embed.setThumbnail(d.thumbnail);
  if(d.fields){const fields=String(d.fields).split('\n').filter(Boolean).slice(0,25).map(line=>{const [name,...value]=line.split('|');return {name:name.trim().slice(0,256)||'Champ',value:value.join('|').trim().slice(0,1024)||'—'};});embed.addFields(fields);}
  const channel=await guild.channels.fetch(d.channelId);if(!channel?.isTextBased()||!('send' in channel))throw new AppError(400,'Salon cible introuvable.');
  const components=r.module==='tickets'?[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`ticket:open:${id}`).setLabel(d.buttonLabel||'Ouvrir un ticket').setStyle(ButtonStyle.Primary))]:[];
  const message=await channel.send({embeds:[embed],components,allowedMentions:{parse:[]}});
  await db.entity.update({where:{id},data:{data:json({...d,messageId:message.id}),revision:{increment:1}}});
  return {messageId:message.id,url:message.url};
}
export async function openTicket(guild:Guild,userId:string,panelId:string) {
  const panel=await getRecord(guild.id,panelId,'tickets'),c=await config(guild.id,'tickets');
  if(!c.value.enabled || panel.status!=='active')throw new AppError(409,'Ce panneau est désactivé.');
  const ticket=await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guild.id+':ticket:'+userId},0))`;
    if(await tx.ticket.count({where:{guildId:guild.id,userId,status:{in:['opening','open']}}})>=Number(c.value.maxOpen))throw new AppError(409,'Limite de tickets simultanés atteinte.');
    return tx.ticket.create({data:{guildId:guild.id,userId,panelId}});
  });
  try {
    const bot=await me(guild,PermissionFlagsBits.ManageChannels);
    const channel=await guild.channels.create({name:`ticket-${ticket.id.slice(-8)}`,type:ChannelType.GuildText,parent:String(c.value.categoryId)||undefined,permissionOverwrites:[{id:guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:userId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:bot.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]},...(c.value.supportRoles as string[]).map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}))]});
    await db.ticket.update({where:{id:ticket.id},data:{channelId:channel.id,status:'open'}});
    await channel.send({content:`<@${userId}> Votre ticket est ouvert. La conservation du contenu dépend des paramètres de confidentialité du serveur.${c.value.deleteOnClose?' La fermeture supprimera ce salon après sauvegarde de la transcription.':''}`,components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel(c.value.deleteOnClose?'Fermer et supprimer':'Fermer le ticket').setStyle(ButtonStyle.Secondary))],allowedMentions:{users:[userId]}});
    await metric(guild.id,'ticketsOpened');await audit(guild.id,userId,'ticket.open',{},ticket.id);await publish(guild.id,'tickets');return channel.id;
  }catch(error){await db.ticket.update({where:{id:ticket.id},data:{status:'failed',reason:'Création du salon Discord échouée'}});throw error;}
}
async function transcript(channel:TextChannel,content:boolean) {
  const messages:any[]=[];let before:string|undefined,truncated=false;
  for(let page=0;page<50;page++){const batch=await channel.messages.fetch({limit:100,before});if(!batch.size)break;messages.push(...batch.values());before=batch.last()!.id;if(batch.size<100)break;if(page===49)truncated=true;}
  messages.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Transcription</title><style>body{font:15px system-ui;background:#11121a;color:#ddd;max-width:900px;margin:40px auto}article{padding:12px;border-bottom:1px solid #333}time{color:#999}p{white-space:pre-wrap}</style><h1>${escapeHtml(channel.name)}</h1>${truncated?'<p>Transcription limitée aux 5 000 derniers messages.</p>':''}${messages.map(m=>`<article><b>${escapeHtml(m.author.username)} (${escapeHtml(m.author.id)})</b> <time>${new Date(m.createdTimestamp).toISOString()}</time><p>${content?escapeHtml(m.content):'[Contenu non conservé selon la politique du serveur]'}</p>${content?Array.from(m.attachments.values()).map((a:any)=>`<p>Pièce jointe : ${escapeHtml(a.name??'fichier')}</p>`).join(''):''}</article>`).join('')}</html>`;
}
const ticketActions=new Map<string,Promise<void>>();
export async function ticketAction(guild:Guild,actorId:string,p:any,ownerAllowed=false,beforeDelete?:()=>Promise<unknown>) {
  const key=`${guild.id}:${p.id}`,previous=ticketActions.get(key);
  let release!:()=>void;const current=new Promise<void>(resolve=>{release=resolve;});ticketActions.set(key,current);
  await previous;
  try{return await performTicketAction(guild,actorId,p,ownerAllowed,beforeDelete);}
  finally{release();if(ticketActions.get(key)===current)ticketActions.delete(key);}
}
async function performTicketAction(guild:Guild,actorId:string,p:any,ownerAllowed:boolean,beforeDelete?:()=>Promise<unknown>) {
  const t=await db.ticket.findFirst({where:{id:p.id,guildId:guild.id}});if(!t)throw new AppError(404,'Ticket introuvable.');
  if(ownerAllowed && t.userId!==actorId)await authorize(guild.id,actorId,'tickets');
  if(!t.channelId)throw new AppError(409,'Le salon a été supprimé. La transcription reste disponible ; ouvrez un nouveau ticket si nécessaire.');
  const channel=await guild.channels.fetch(t.channelId);if(!channel || channel.type!==ChannelType.GuildText || channel.guildId!==guild.id)throw new AppError(404,'Le salon du ticket a disparu.');
  let deleted=false;
  if(p.action==='claim') {const changed=await db.ticket.updateMany({where:{id:t.id,guildId:guild.id,status:'open',assignedTo:null},data:{assignedTo:actorId}});if(!changed.count)throw new AppError(409,'Ce ticket est déjà attribué ou fermé.');}
  else if(p.action==='close') {
    const settings=await config(guild.id,'tickets'),remove=Boolean(settings.value.deleteOnClose);
    if(t.status!=='open' && !(t.status==='closed' && remove && t.transcript))throw new AppError(409,'Ticket déjà fermé.');
    if(remove){const bot=await guild.members.fetchMe();if(!channel.permissionsFor(bot)?.has(PermissionFlagsBits.ManageChannels))throw new AppError(403,'Le bot a besoin de la permission Gérer les salons pour supprimer ce ticket.');}
    if(t.status==='open'){
      const c=await config(guild.id,'logs'),html=await transcript(channel,Boolean(c.value.storeMessageContent));
      await channel.permissionOverwrites.edit(t.userId,{SendMessages:false});
      // Persist the transcript before any irreversible Discord deletion.
      await db.ticket.update({where:{id:t.id},data:{status:'closed',closedAt:new Date(),reason:p.reason||'Fermeture demandée',transcript:html}});
      await metric(guild.id,'ticketsClosed');
    }
    if(remove){
      await beforeDelete?.();
      try{await channel.delete(`Ticket fermé par ${actorId}`);}catch{throw new AppError(502,'Transcription sauvegardée, mais le salon n’a pas pu être supprimé. Réessayez la fermeture.');}
      await db.ticket.update({where:{id:t.id},data:{channelId:null}});deleted=true;
    }else await sendText(guild,channel.id,`Ticket fermé : ${p.reason||'Fermeture demandée'}`);
  }else if(p.action==='reopen'){if(t.status!=='closed')throw new AppError(409,'Le ticket n’est pas fermé.');await channel.permissionOverwrites.edit(t.userId,{SendMessages:true});await db.ticket.update({where:{id:t.id},data:{status:'open',closedAt:null}});}
  else if(['addParticipant','removeParticipant'].includes(p.action)) {
    if(!p.userId)throw new AppError(400,'Membre requis.');
    if(p.userId===t.userId)throw new AppError(400,'Le créateur ne peut pas être retiré.');
    await guild.members.fetch(p.userId);
    if(p.action==='addParticipant')await channel.permissionOverwrites.edit(p.userId,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});else await channel.permissionOverwrites.delete(p.userId);
    await db.ticket.update({where:{id:t.id},data:{participants:p.action==='addParticipant'?[...new Set([...t.participants,p.userId])]:t.participants.filter(x=>x!==p.userId)}});
  }else if(p.action==='priority'){if(!p.priority)throw new AppError(400,'Priorité requise.');await db.ticket.update({where:{id:t.id},data:{priority:p.priority}});}
  else throw new AppError(400,'Action de ticket inconnue.');
  await audit(guild.id,actorId,`ticket.${p.action}`,{...p,deleted},t.id);await publish(guild.id,'tickets');return {ok:true,deleted};
}
export async function automation(guild:Guild,trigger:string,userId:string,value=0,depth=0) {
  if(depth>=3)return;
  const rules=await db.entity.findMany({where:{guildId:guild.id,module:'automations',status:'active'}});
  for(const r of rules){const d=r.data as any;if(!d.enabled || d.trigger!==trigger || value<d.threshold)continue;
    try {
      if(d.action==='addRole')await setRole(guild,userId,d.roleId,true);
      if(d.action==='sendMessage')await sendText(guild,d.channelId,variables(d.message,{user:`<@${userId}>`,server:guild.name,level:value}));
      if(d.action==='timeout')await sanction(guild,guild.client.user!.id,{action:'timeout',userId,seconds:Math.min(2419200,Math.max(1,d.amount)),reason:`Automation ${r.title}`},true);
      if(d.action==='reward')await db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guild.id+':economy'},0))`;const a=await tx.account.upsert({where:{guildId_userId:{guildId:guild.id,userId}},create:{guildId:guild.id,userId},update:{}});if(a.wallet+d.amount>1000000000)throw new AppError(409,'Plafond de solde atteint.');await tx.account.update({where:{guildId_userId:{guildId:guild.id,userId}},data:{wallet:{increment:d.amount}}});await tx.transaction.create({data:{guildId:guild.id,userId,actorId:guild.client.user!.id,amount:d.amount,kind:'automation',reason:r.title}});});
      await audit(guild.id,guild.client.user!.id,'automation.success',{ruleId:r.id,trigger,userId});
    }catch(e){await audit(guild.id,guild.client.user!.id,'automation.failed',{ruleId:r.id,error:e instanceof AppError?e.message:'Action Discord échouée'});}
  }
}
export async function execute(client:Client,job:any) {
  if(job.kind==='twitchLive')return deliverTwitchLive(client,job);
  const guild=await client.guilds.fetch(job.guildId),p=job.payload;
  const perms:Record<string,Permission>={moderation:'moderation',roles:['addRole','removeRole'].includes(p.action)?'members':'roles',ticket:'tickets',publish:'content',syncCommands:'content',verifyPanel:'config',recruitmentAccept:'content'};
  if(job.kind!=='shopRole')await authorize(guild.id,job.actorId,perms[job.kind]??'content');
  if(job.kind==='moderation'){await sanction(guild,job.actorId,p);if(p.action==='warn'){const count=await db.case.count({where:{guildId:guild.id,userId:p.userId,kind:'warn',revokedAt:null}});await automation(guild,'warning',p.userId,count);}return {ok:true};}
  if(job.kind==='roles') {
    if(['addRole','removeRole'].includes(p.action))await setRole(guild,p.userId,p.roleId,p.action==='addRole',job.actorId);
    else {
      const bot=await me(guild,PermissionFlagsBits.ManageRoles),actor=await guild.members.fetch(job.actorId);
      if(p.action==='createRole')return {id:(await guild.roles.create({name:p.name,color:parseInt((p.color||'#7c6aff').slice(1),16),permissions:[]})).id};
      const role=await guild.roles.fetch(p.roleId);
      if(!role || role.managed || role.id===guild.id || role.position>=bot.roles.highest.position || (actor.id!==guild.ownerId && role.position>=actor.roles.highest.position))throw new AppError(403,'Hiérarchie du rôle incompatible.');
      if(p.action==='deleteRole')await role.delete();else await role.edit({name:p.name,color:p.color?parseInt(p.color.slice(1),16):undefined});
    }return {ok:true};
  }
  if(job.kind==='ticket'){const result=await ticketAction(guild,job.actorId,p);if(p.action==='close'){const t=await db.ticket.findUniqueOrThrow({where:{id:p.id}});await automation(guild,'ticketClosed',t.userId);}return result;}
  if(job.kind==='publish'){const r=await getRecord(guild.id,p.id);await authorize(guild.id,job.actorId,permissionFor(r.module));return publishRecord(guild,p.id);}
  if(job.kind==='syncCommands') {const records=await db.entity.findMany({where:{guildId:guild.id,module:'commands',status:'active'}});let commands;try{commands=commandsForSync(records);}catch(e){throw new AppError(409,(e as Error).message);}if(commands.length>100)throw new AppError(400,'Discord limite le serveur à 100 commandes slash.');await guild.commands.set(commands);return {count:commands.length};}
  if(job.kind==='verifyPanel') {const c=await config(guild.id,'autoroles');if(!c.value.verifiedRoleId)throw new AppError(400,'Configurez le rôle de vérification.');const channel=await guild.channels.fetch(String(c.value.channelId));if(!channel?.isTextBased()||!('send'in channel))throw new AppError(400,'Salon invalide.');const m=await channel.send({content:String(c.value.message),components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('verify').setLabel('J’accepte le règlement').setStyle(ButtonStyle.Success))],allowedMentions:{parse:[]}});return {messageId:m.id};}
  if(job.kind==='recruitmentAccept') {
    const r=await getRecord(guild.id,p.id,'applications');if(r.status!=='pending')throw new AppError(409,'Candidature déjà traitée.');
    const campaign=await getRecord(guild.id,(r.data as any).campaignId,'recruitment');
    for(const roleId of (campaign.data as any).acceptedRoles)await setRole(guild,r.ownerId,roleId,true,job.actorId);
    await db.entity.update({where:{id:r.id},data:{status:'accepted',data:json({...r.data as object,decision:{actorId:job.actorId,reason:p.reason,at:new Date()}})}});
    const c=await config(guild.id,'recruitment');if(c.value.notificationChannelId)await sendText(guild,String(c.value.notificationChannelId),`Candidature acceptée · <@${r.ownerId}> · ${campaign.title}`);
    await automation(guild,'recruitmentAccepted',r.ownerId);return {ok:true};
  }
  if(job.kind==='shopRole') {
    try{await setRole(guild,p.userId,p.roleId,true);return {ok:true};}
    catch(error){await db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guild.id+':economy'},0))`;const a=await tx.account.findUniqueOrThrow({where:{guildId_userId:{guildId:guild.id,userId:p.userId}}});const inv=[...(a.inventory as any[])],index=inv.findIndex(i=>i.itemId===p.itemId);if(index>=0)inv.splice(index,1);await tx.account.update({where:{guildId_userId:{guildId:guild.id,userId:p.userId}},data:{wallet:{increment:p.price},inventory:json(inv)}});await tx.transaction.create({data:{guildId:guild.id,userId:p.userId,actorId:job.actorId,amount:p.price,kind:'refund',reason:'Attribution du rôle échouée'}});});throw error;}
  }
  throw new AppError(400,'Type de tâche inconnu.');
}
