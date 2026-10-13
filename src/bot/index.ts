import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Message, Guild, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { db } from '../lib/db';
import { redis, publish } from '../lib/redis';
import { config, json, metric, audit, cleanup } from '../services/store';
import { AppError } from '../lib/errors';
import { variables, levelOf } from '../shared/catalog';
import { execute, openTicket, ticketAction, setRole, sanction, sendText, automation } from './actions';
import { pollTwitch } from './twitch';
const intents=[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildVoiceStates];
if(process.env.DISCORD_MEMBERS_INTENT==='true')intents.push(GatewayIntentBits.GuildMembers);
if(process.env.DISCORD_MESSAGE_CONTENT_INTENT==='true')intents.push(GatewayIntentBits.MessageContent);
if(process.env.DISCORD_PRESENCE_INTENT==='true')intents.push(GatewayIntentBits.GuildPresences);
const client=new Client({intents});
async function track(guild:Guild) {
  await db.guild.upsert({where:{id:guild.id},create:{id:guild.id,name:guild.name,ownerId:guild.ownerId,icon:guild.icon,memberCount:guild.memberCount,channels:guild.channels.cache.size,roles:guild.roles.cache.size},update:{name:guild.name,ownerId:guild.ownerId,icon:guild.icon,memberCount:guild.memberCount,channels:guild.channels.cache.size,roles:guild.roles.cache.size,installed:true,online:process.env.DISCORD_PRESENCE_INTENT==='true'?guild.presences.cache.filter(p=>p.status!=='offline').size:null}});
}
const safe=(fn:(...args:any[])=>Promise<any>)=>(...args:any[])=>void fn(...args).catch(e=>console.error('Bot event failed:',e instanceof AppError?e.message:e?.name ?? 'UnknownError',/^P\d{4}$/.test(e?.errorCode??e?.code??'')?(e.errorCode??e.code):''));
client.once(Events.ClientReady,safe(async()=>{
  for(const guild of client.guilds.cache.values())await track(guild);
  await db.job.updateMany({where:{status:'running',lockedAt:{lt:new Date(Date.now()-300000)}},data:{status:'failed',error:'Exécution interrompue : vérifier Discord avant de relancer manuellement.'}});
  setInterval(safe(heartbeat),15000).unref();setInterval(safe(work),1000).unref();setInterval(safe(expireBans),30000).unref();
  setInterval(safe(async()=>{for(const guild of client.guilds.cache.values())await track(guild);}),60000).unref();
  setInterval(safe(cleanup),3600000).unref();setInterval(safe(closeDue),60000).unref();
  setInterval(safe(()=>pollTwitch(client)),60000).unref();
  await heartbeat();console.log(`Atlas connected: ${client.guilds.cache.size} guilds`);
  safe(()=>pollTwitch(client))();
}));
async function heartbeat(){await db.globalSetting.upsert({where:{key:'botHeartbeat'},create:{key:'botHeartbeat',value:json({at:Date.now(),latency:client.ws.ping,intents:process.env.DISCORD_MESSAGE_CONTENT_INTENT==='true'})},update:{value:json({at:Date.now(),latency:client.ws.ping,intents:process.env.DISCORD_MESSAGE_CONTENT_INTENT==='true'})}});}
let busy=false;
async function work(){
  if(busy)return;busy=true;
  try {
    const maintenance=await db.globalSetting.findUnique({where:{key:'maintenance'}});if(maintenance?.value===true)return;
    const job=await db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('atlas:job-claim',0))`;
      const rows=await tx.$queryRaw<{id:string}[]>`SELECT j.id FROM "Job" j WHERE j.status = 'queued' AND j."runAt" <= NOW() AND NOT EXISTS (SELECT 1 FROM "Job" r WHERE r."guildId" = j."guildId" AND r.status = 'running') ORDER BY j."runAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1`;
      if(!rows.length)return null;
      return tx.job.update({where:{id:rows[0].id},data:{status:'running',lockedAt:new Date(),attempts:{increment:1}}});
    });
    if(!job)return;
    try {const result=await execute(client,job);await db.job.update({where:{id:job.id},data:{status:'done',result:json(result ?? {ok:true})}});await audit(job.guildId,job.actorId,`job.${job.kind}.done`,{jobId:job.id});}
    catch(error){
      const message=error instanceof AppError?error.message:'Échec Discord ou base de données. Vérifiez si l’action a été appliquée avant de la relancer.';
      const retry=job.kind==='twitchLive'&&!(error instanceof AppError)&&job.attempts<3&&Date.now()-job.createdAt.getTime()<120000;
      await db.job.update({where:{id:job.id},data:{status:retry?'queued':'failed',error:message,...(retry?{runAt:new Date(Date.now()+15000),lockedAt:null}:{})}});
      if(job.kind==='twitchLive'&&!retry)await db.entity.updateMany({where:{id:job.id,guildId:job.guildId,status:'queued'},data:{status:'failed'}});
      await audit(job.guildId,job.actorId,`job.${job.kind}.${retry?'retry':'failed'}`,{jobId:job.id,error:message});
    }
    await publish(job.guildId,'jobs');
  }finally{busy=false;}
}
async function expireBans(){
  const cases=await db.case.findMany({where:{kind:'tempban',revokedAt:null,expiresAt:{lte:new Date()}},take:100});
  for(const c of cases)try{const guild=await client.guilds.fetch(c.guildId);const ban=await guild.bans.fetch(c.userId).catch((error:any)=>{if(error.code===10026)return null;throw error;});if(ban)await guild.members.unban(c.userId,'Fin du bannissement temporaire');await db.case.update({where:{id:c.id},data:{revokedAt:new Date()}});await audit(c.guildId,client.user!.id,'moderation.tempban.expired',{caseId:c.id},c.userId);}catch{await audit(c.guildId,client.user!.id,'moderation.tempban.retry',{caseId:c.id});}
}
async function closeDue(){
  const records=await db.entity.findMany({where:{module:{in:['polls','giveaways','events']},status:'active'},take:1000});
  const {decision}=await import('../services/community');
  for(const r of records){const d=r.data as any;
    if(r.module==='events' && d.startsAt && !d.announcedAt && new Date(d.startsAt).getTime()<=Date.now() && d.channelId){const guild=await client.guilds.fetch(r.guildId);await sendText(guild,d.channelId,`Événement : ${r.title}\n${d.description}\n${(d.participants??[]).length} participant(s).`);await db.entity.update({where:{id:r.id},data:{data:json({...d,announcedAt:new Date().toISOString()}),revision:{increment:1}}});await audit(r.guildId,client.user!.id,'event.started',{id:r.id});}
    if(d.endsAt && new Date(d.endsAt).getTime()<=Date.now()){const result=await decision(r.guildId,client.user!.id,r.id,{status:'closed',reason:'Fin programmée'});if(r.module==='giveaways'&&d.channelId){const guild=await client.guilds.fetch(r.guildId),winners=(result as any).data?.winnerIds??[];await sendText(guild,d.channelId,`Tirage terminé : ${r.title}\nGagnants : ${winners.map((id:string)=>`<@${id}>`).join(', ')||'Aucun participant'}`);}}
  }
}
client.on(Events.GuildCreate,safe(track));
client.on(Events.GuildDelete,safe(async g=>{await db.guild.updateMany({where:{id:g.id},data:{installed:false}});}));
client.on(Events.GuildUpdate,safe(async(_old,g)=>track(g)));
client.on(Events.GuildMemberAdd,safe(async member=>{
  const guild=member.guild;await track(guild);await metric(guild.id,'joins');
  const raid=await config(guild.id,'antiraid');
  if(raid.value.enabled && !(raid.value.excludedUsers as string[]).includes(member.id) && !member.roles.cache.some((r:any)=>(raid.value.excludedRoles as string[]).includes(r.id))){
    const key=`joins:${guild.id}`,count=Number(await redis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],10) end; return n",1,key));
    if(Date.now()-member.user.createdTimestamp<Number(raid.value.minAccountHours)*3600000 || count>Number(raid.value.maxJoins)){
      if(['warn','timeout','kick','ban'].includes(String(raid.value.action)))await sanction(guild,client.user!.id,{action:raid.value.action,userId:member.id,reason:'Antiraid : compte récent ou arrivées massives',seconds:raid.value.timeoutSeconds},true);
      else if(raid.value.logChannelId)await sendText(guild,String(raid.value.logChannelId),`Antiraid : arrivée de <@${member.id}>`);
      if(['kick','ban'].includes(String(raid.value.action)))return;
    }
  }
  const welcome=await config(guild.id,'welcome');
  const content=variables(String(welcome.value.message),{user:`<@${member.id}>`,server:guild.name,memberCount:guild.memberCount});
  if(welcome.value.enabled && welcome.value.channelId){const channel=await guild.channels.fetch(String(welcome.value.channelId));if(channel?.isTextBased()&&'send'in channel)await channel.send({embeds:[new EmbedBuilder().setDescription(content).setColor(String(welcome.value.color) as any)],allowedMentions:{parse:[]}});}
  if(welcome.value.enabled && welcome.value.dm)await member.send(content).catch(()=>{});
  const roles=await config(guild.id,'autoroles');if(roles.value.enabled)for(const id of roles.value.roleIds as string[])await setRole(guild,member.id,id,true).catch(async()=>audit(guild.id,client.user!.id,'autoroles.failed',{roleId:id},member.id));
  await automation(guild,'join',member.id);await logEvent(guild,'member.join',{userId:member.id});
}));
client.on(Events.GuildMemberRemove,safe(async member=>{await metric(member.guild.id,'leaves');await track(member.guild);const c=await config(member.guild.id,'welcome');if(c.value.enabled && c.value.channelId && c.value.leaveMessage)await sendText(member.guild,String(c.value.channelId),variables(String(c.value.leaveMessage),{user:member.user.username,server:member.guild.name,memberCount:member.guild.memberCount}));await logEvent(member.guild,'member.leave',{userId:member.id});}));
export async function checkMessage(message:Message){
  if(!message.guild || message.author.bot || !message.member)return;
  const guild=message.guild;await metric(guild.id,'messages');
  const c=await config(guild.id,'automod'),d=c.value;
  if(d.enabled && !(d.excludedUsers as string[]).includes(message.author.id) && !(d.excludedChannels as string[]).includes(message.channelId) && !message.member.roles.cache.some(r=>(d.excludedRoles as string[]).includes(r.id))){
    const content=message.content,key=`spam:${guild.id}:${message.author.id}`,n=Number(await redis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],10) end; return n",1,key));
    const letters=content.match(/[a-zÀ-ÿ]/gi)??[],caps=content.match(/[A-ZÀ-Ý]/g)??[];
    const words=String(d.words).split('\n').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const reason=n>Number(d.maxMessages)?'Spam / flood':d.links&&/https?:\/\//i.test(content)?'Lien interdit':d.invites&&/(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(content)?'Invitation interdite':message.mentions.users.size+message.mentions.roles.size>Number(d.maxMentions)||message.mentions.everyone?'Mentions massives':d.caps&&letters.length>=10&&caps.length/letters.length*100>Number(d.capsPercent)?'Majuscules excessives':d.emoji&&(content.match(/\p{Extended_Pictographic}|<a?:\w+:\d+>/gu)??[]).length>Number(d.maxEmoji)?'Emojis excessifs':words.some(w=>content.toLowerCase().includes(w))?'Contenu du dictionnaire interdit':null;
    if(reason){if(d.action==='delete'){if(!message.member.permissions.has(PermissionFlagsBits.Administrator))await message.delete();}else if(['warn','timeout','kick','ban'].includes(String(d.action)))await sanction(guild,client.user!.id,{action:d.action,userId:message.author.id,reason,seconds:d.timeoutSeconds},true);if(d.logChannelId)await sendText(guild,String(d.logChannelId),`${reason} · <@${message.author.id}> · salon <#${message.channelId}>`);await logEvent(guild,'automod.trigger',{reason,userId:message.author.id});return;}
  }
  const levels=await config(guild.id,'levels');
  if(levels.value.enabled && !(levels.value.excludedChannels as string[]).includes(message.channelId) && !(levels.value.excludedUsers as string[]).includes(message.author.id) && !message.member.roles.cache.some(r=>(levels.value.excludedRoles as string[]).includes(r.id))){
    const result=await db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guild.id+':xp:'+message.author.id},0))`;
      const old=await tx.level.upsert({where:{guildId_userId:{guildId:guild.id,userId:message.author.id}},create:{guildId:guild.id,userId:message.author.id},update:{}});
      if(old.lastMessageAt && Date.now()-old.lastMessageAt.getTime()<Number(levels.value.cooldownSeconds)*1000)return null;
      const updated=await tx.level.update({where:{guildId_userId:{guildId:guild.id,userId:message.author.id}},data:{xp:{increment:Number(levels.value.xpPerMessage)},lastMessageAt:new Date()}});return {before:levelOf(old.xp),after:levelOf(updated.xp)};
    });
    if(result && result.after>result.before){if(levels.value.announcementChannelId)await sendText(guild,String(levels.value.announcementChannelId),variables(String(levels.value.announcement),{user:`<@${message.author.id}>`,level:result.after,server:guild.name}));const rewards=await db.entity.findMany({where:{guildId:guild.id,module:'levels',status:'active'}});for(const reward of rewards){const d=reward.data as any;if(d.level>result.before && d.level<=result.after)await setRole(guild,message.author.id,d.roleId,true);}await automation(guild,'level',message.author.id,result.after);}
  }
  const ticket=await db.ticket.findFirst({where:{guildId:guild.id,channelId:message.channelId,status:'open',firstResponseAt:null}});
  if(ticket && message.author.id!==ticket.userId){const c=await config(guild.id,'tickets');if(message.member.roles.cache.some(r=>(c.value.supportRoles as string[]).includes(r.id)))await db.ticket.updateMany({where:{id:ticket.id,firstResponseAt:null},data:{firstResponseAt:new Date()}});}
}
client.on(Events.MessageCreate,safe(checkMessage));
async function logEvent(guild:Guild,kind:string,detail:any){const c=await config(guild.id,'logs');if(c.value.enabled){await audit(guild.id,client.user!.id,kind,detail);if(c.value.channelId)await sendText(guild,String(c.value.channelId),`${kind} · ${String(detail.userId ?? detail.name ?? detail.id ?? '')}`).catch(()=>{});}}
client.on(Events.MessageDelete,safe(async m=>{if(!m.guild)return;const c=await config(m.guild.id,'logs');await logEvent(m.guild,'message.deleted',{channelId:m.channelId,userId:m.author?.id??null,...(c.value.storeMessageContent?{content:m.content??''}:{})});}));
client.on(Events.MessageUpdate,safe(async(old,m)=>{if(!m.guild)return;const c=await config(m.guild.id,'logs');await logEvent(m.guild,'message.updated',{channelId:m.channelId,userId:m.author?.id??null,...(c.value.storeMessageContent?{before:old.content??'',after:m.content??''}:{})});}));
for(const event of [Events.ChannelCreate,Events.ChannelDelete,Events.GuildRoleCreate,Events.GuildRoleDelete] as const)client.on(event as any,safe(async(item:any)=>{if(item.guild){await track(item.guild);await logEvent(item.guild,event,{id:item.id,name:item.name});}}));
client.on(Events.GuildMemberUpdate,safe(async(old,m)=>{if(old.roles.cache.map((r:any)=>r.id).sort().join()!==m.roles.cache.map((r:any)=>r.id).sort().join())await logEvent(m.guild,'member.roles',{userId:m.id,roles:m.roles.cache.map((r:any)=>r.id)});}));
client.on(Events.GuildBanAdd,safe(async b=>logEvent(b.guild,'member.banned',{userId:b.user.id})));
client.on(Events.GuildBanRemove,safe(async b=>logEvent(b.guild,'member.unbanned',{userId:b.user.id})));
client.on(Events.InteractionCreate,safe(async interaction=>{
  if(!interaction.guild)return;
  try {
    if(interaction.isButton()) {
      await interaction.deferReply({flags:64});
      if(interaction.customId==='verify'){const c=await config(interaction.guildId!,'autoroles');if(!c.value.enabled||!c.value.verifiedRoleId)throw new AppError(409,'Vérification désactivée.');await setRole(interaction.guild,interaction.user.id,String(c.value.verifiedRoleId),true);await interaction.editReply('Votre règlement a été accepté.');}
      else if(interaction.customId.startsWith('ticket:open:')){const id=interaction.customId.slice(12),channel=await openTicket(interaction.guild,interaction.user.id,id);await interaction.editReply(`Votre ticket : <#${channel}>`);}
      else if(interaction.customId.startsWith('ticket:close:')){await ticketAction(interaction.guild,interaction.user.id,{action:'close',id:interaction.customId.slice(13),reason:'Fermé depuis Discord'},true);await interaction.editReply('Ticket fermé.');}
      else await interaction.editReply('Bouton inconnu ou expiré.');
    }
    if(interaction.isChatInputCommand()) {
      await interaction.deferReply();
      const records=await db.entity.findMany({where:{guildId:interaction.guildId!,module:'commands',status:'active'}}),record=records.find(r=>(r.data as any).name===interaction.commandName);
      if(!record || !(record.data as any).enabled)throw new AppError(404,'Commande désactivée.');
      const d=record.data as any,member=await interaction.guild.members.fetch(interaction.user.id);
      if(d.allowedRoles.length && !member.roles.cache.some((r:any)=>d.allowedRoles.includes(r.id)))throw new AppError(403,'Rôle requis pour cette commande.');
      if(d.cooldown>0 && !await redis().set(`cmd:${interaction.guildId}:${record.id}:${interaction.user.id}`,'1','EX',d.cooldown,'NX'))throw new AppError(429,'Cette commande est en cooldown.');
      await interaction.editReply({content:variables(d.response,{user:`<@${interaction.user.id}>`,server:interaction.guild.name,memberCount:interaction.guild.memberCount}).slice(0,2000),allowedMentions:{parse:[]}});await metric(interaction.guildId!,'commands');await audit(interaction.guildId!,interaction.user.id,'command.used',{name:d.name});
    }
  }catch(error){const message=error instanceof AppError?error.message:'Discord a refusé l’action. Vérifiez les permissions du bot.';if(interaction.isRepliable()){if(interaction.deferred||interaction.replied)await interaction.editReply(message);else await interaction.reply({content:message,flags:64});}}
}));
if(!process.env.DISCORD_BOT_TOKEN)throw new Error('DISCORD_BOT_TOKEN missing. See installation guide.');
await client.login(process.env.DISCORD_BOT_TOKEN);
process.on('SIGTERM',async()=>{client.destroy();await db.$disconnect();process.exit(0);});
