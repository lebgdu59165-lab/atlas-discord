import {createHash} from 'node:crypto';
import {Client, PermissionFlagsBits} from 'discord.js';
import {db} from '../lib/db';
import {AppError} from '../lib/errors';
import {TwitchApi,twitchMessage,type TwitchStream} from '../lib/twitch';
import {config,json} from '../services/store';
import {configSchema} from '../shared/catalog';

export type TwitchSettings={enabled:boolean;twitchLogin:string;channelId:string;liveMessage:string};
const deliveryId=(guildId:string,streamId:string)=>`twitch:${guildId}:${streamId}`;
const api=new TwitchApi(process.env.TWITCH_CLIENT_ID??'',process.env.TWITCH_CLIENT_SECRET??'');
let polling=false;

export async function queueTwitchLive(guildId:string,botId:string,settings:TwitchSettings,stream:TwitchStream) {
  const id=deliveryId(guildId,stream.id);
  return db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guildId+':config:integrations'},0))`;
    const stored=await tx.config.findUnique({where:{guildId_module:{guildId,module:'integrations'}}});
    const parsed=configSchema('integrations').safeParse(stored?.value);
    if(!parsed.success||!parsed.data.enabled||parsed.data.twitchLogin!==settings.twitchLogin||parsed.data.channelId!==settings.channelId||stream.user_login.toLowerCase()!==settings.twitchLogin)return false;
    if(await tx.entity.findUnique({where:{id}}))return false;
    await tx.entity.create({data:{id,guildId,module:'twitch-delivery',ownerId:botId,title:stream.title.slice(0,256),status:'queued',data:json({streamId:stream.id,login:settings.twitchLogin,channelId:settings.channelId})}});
    await tx.job.create({data:{id,guildId,actorId:botId,kind:'twitchLive',payload:json({stream,channelId:settings.channelId,login:settings.twitchLogin})}});
    return true;
  });
}

async function status(guildId:string,botId:string,state:string,detail:object={}) {
  const id=`twitch-status:${guildId}`,data=json({state,checkedAt:new Date().toISOString(),configured:api.configured,...detail});
  await db.entity.upsert({where:{id},create:{id,guildId,module:'twitch-status',ownerId:botId,title:'État Twitch',status:state,data},update:{status:state,data}});
}
export async function pollTwitch(client:Client) {
  if(polling||!client.isReady())return;
  polling=true;
  try{
    const rows=await db.config.findMany({where:{module:'integrations',guild:{installed:true}},select:{guildId:true,value:true}});
    const configs=rows.flatMap(row=>{const parsed=configSchema('integrations').safeParse(row.value);return parsed.success&&parsed.data.enabled?[{guildId:row.guildId,settings:parsed.data as TwitchSettings}]:[];});
    if(!configs.length)return;
    let streams:TwitchStream[];
    try{streams=await api.streams(configs.map(c=>c.settings.twitchLogin));}
    catch(error){for(const row of configs)await status(row.guildId,client.user!.id,'error',{error:error instanceof AppError?error.message:'Réponse Twitch invalide ; nouvelle vérification dans une minute.'});return;}
    for(const row of configs){
      const stream=streams.find(s=>s.user_login.toLowerCase()===row.settings.twitchLogin);
      if(stream)await queueTwitchLive(row.guildId,client.user!.id,row.settings,stream);
      await status(row.guildId,client.user!.id,stream?'live':'offline',{login:row.settings.twitchLogin,streamId:stream?.id??null});
    }
  }finally{polling=false;}
}

export async function deliverTwitchLive(client:Client,job:any) {
  const delivery=await db.entity.findFirst({where:{id:job.id,guildId:job.guildId,module:'twitch-delivery',status:'queued'}});
  if(!delivery)throw new AppError(409,'Annonce Twitch déjà traitée ou introuvable.');
  const cfg=(await config(job.guildId,'integrations')).value as TwitchSettings;
  if(!cfg.enabled||cfg.twitchLogin!==job.payload.login||cfg.channelId!==job.payload.channelId){
    await db.entity.update({where:{id:job.id},data:{status:'cancelled'}});
    return {cancelled:true};
  }
  const guild=await client.guilds.fetch(job.guildId),channel=await guild.channels.fetch(cfg.channelId);
  if(!channel||channel.guildId!==guild.id||!channel.isTextBased()||!('send' in channel))throw new AppError(400,'Choisissez un salon textuel de ce serveur pour les lives Twitch.');
  const me=await guild.members.fetchMe(),permissions=channel.permissionsFor(me);
  if(!permissions?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]))throw new AppError(403,'Le bot doit pouvoir voir le salon Twitch et y envoyer des messages.');
  const message=await channel.send({content:twitchMessage(cfg.liveMessage,job.payload.stream),allowedMentions:{parse:[]},nonce:createHash('sha256').update(job.id).digest('hex').slice(0,24),enforceNonce:true});
  await db.entity.update({where:{id:job.id},data:{status:'done',data:json({...delivery.data as object,messageId:message.id,url:message.url,sentAt:new Date().toISOString()})}});
  return {messageId:message.id,url:message.url};
}
