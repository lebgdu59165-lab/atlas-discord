import {ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,type ChatInputCommandInteraction as CI,type Client} from 'discord.js';
import {db} from '../lib/db';
import {AppError} from '../lib/errors';
import {staff} from './command-actions';
import {createRecord,json,audit} from '../services/store';
import {PermissionFlagsBits as P} from 'discord.js';
import {responseEmbed} from './presentation';
export const communityHandlers:Record<string,(i:CI)=>Promise<unknown>>={};
for(const name of ['poll','giveaway'])communityHandlers[name]=async i=>{
 await staff(i,'content',P.ManageMessages);if(!i.channel?.isTextBased()||!('send'in i.channel))throw new AppError(400,'Choisissez un salon textuel.');
 const giveaway=name==='giveaway',title=i.options.getString(giveaway?'prix':'question',true);const minutes=giveaway?i.options.getInteger('duree',true):1440,winners=giveaway?i.options.getInteger('gagnants',true):0;
 if(minutes<1||minutes>43200||giveaway&&(winners<1||winners>100))throw new AppError(400,'Durée : 1 minute à 30 jours ; gagnants : 1 à 100.');
 const endsAt=new Date(Date.now()+minutes*60000).toISOString();
 const record=await createRecord(i.guildId!,i.user.id,giveaway?'giveaways':'polls',{title:title.slice(0,256),data:giveaway?{description:title,endsAt,winners,channelId:i.channelId}:{options:'Oui\nNon',endsAt}});
 try{
  const buttons=giveaway?[new ButtonBuilder().setCustomId(`community:giveaway:${record.id}`).setLabel('Participer').setStyle(ButtonStyle.Primary)]:['Oui','Non'].map((label,n)=>new ButtonBuilder().setCustomId(`community:poll:${record.id}:${n}`).setLabel(label).setStyle(n===0?ButtonStyle.Success:ButtonStyle.Secondary));
  const message=await i.channel.send({embeds:[new EmbedBuilder().setTitle(title.slice(0,256)).setDescription(`${giveaway?`${winners} gagnant(s) · cliquez sur Participer`:'Cliquez sur Oui ou Non pour voter'}\nFin : <t:${Math.floor(new Date(endsAt).getTime()/1000)}:R>`).setColor('#7c6aff')],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],allowedMentions:{parse:[]}});
  await db.entity.update({where:{id:record.id},data:{data:json({...record.data as object,channelId:i.channelId,messageId:message.id})}});
  return i.editReply({embeds:[responseEmbed(giveaway?'Concours publié':'Sondage publié',`Votre communauté peut participer ici : ${message.url}`,'success')],allowedMentions:{parse:[]}});
 }catch(e){await db.entity.update({where:{id:record.id},data:{status:'failed'}});throw e;}
};
export async function deliverReminder(client:Client,job:any){
 const p=job.payload;if(p.userId!==job.actorId||typeof p.message!=='string'||p.message.length>1000)throw new AppError(400,'Rappel invalide.');
 const guild=await client.guilds.fetch(job.guildId);await guild.members.fetch(job.actorId);
 try{const user=await client.users.fetch(job.actorId);await user.send({content:`🔔 Votre rappel sur ${guild.name}\n${p.message}`,allowedMentions:{parse:[]},nonce:job.id.slice(-24),enforceNonce:true});}catch{throw new AppError(403,'Rappel non envoyé : messages privés fermés ou accès Discord refusé.');}
 await audit(job.guildId,job.actorId,'reminder.delivered',{jobId:job.id});return {ok:true};
}
