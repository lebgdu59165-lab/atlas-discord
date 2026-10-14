import {type ChatInputCommandInteraction,EmbedBuilder} from 'discord.js';
import {db} from '../lib/db';
import {redis} from '../lib/redis';
import {AppError} from '../lib/errors';
import {metric,audit} from '../services/store';
import {variables} from '../shared/catalog';
import {builtinCommands} from '../shared/commands';
const startedAt=Date.now();
export async function dispatchCommand(interaction:ChatInputCommandInteraction){
  const guild=interaction.guild;if(!guild)throw new AppError(400,'Utilisez cette commande dans un serveur Discord.');
  const records=await db.entity.findMany({where:{guildId:guild.id,module:'commands',status:'active'}});
  const matching=records.filter(r=>(r.data as any).name===interaction.commandName);
  if(matching.length>1)throw new AppError(409,'Plusieurs commandes portent ce nom. Corrigez les doublons dans le tableau de bord.');
  const record=matching[0];
  if(record){
    const d=record.data as any;
    if(!d.enabled)throw new AppError(409,`La commande /${interaction.commandName} est désactivée dans le tableau de bord.`);
    const member=await guild.members.fetch(interaction.user.id);
    if(d.allowedRoles?.length&&!member.roles.cache.some(r=>d.allowedRoles.includes(r.id)))throw new AppError(403,'Rôle requis pour cette commande.');
    if(d.cooldown>0&&!await redis().set(`cmd:${guild.id}:${record.id}:${interaction.user.id}`,'1','EX',d.cooldown,'NX'))throw new AppError(429,'Cette commande est en cooldown.');
    await interaction.editReply({content:variables(d.response,{user:`<@${interaction.user.id}>`,server:guild.name,memberCount:guild.memberCount}).slice(0,2000),allowedMentions:{parse:[]}});
  }else{
    const builtin=builtinCommands.find(c=>c.name===interaction.commandName);
    if(!builtin)throw new AppError(404,`La commande /${interaction.commandName} provient de l’ancienne version et n’est pas encore prise en charge. Utilisez /help pour voir les commandes disponibles.`);
    const reply=(content:string)=>interaction.editReply({content:content.slice(0,2000),allowedMentions:{parse:[]}});
    const dashboard=`${process.env.APP_URL??'https://atlas-dashboard-vf3d.onrender.com'}/dashboard/${guild.id}`;
    if(builtin.name==='help'){
      const selected=interaction.options.getString('commande')?.replace(/^\//,'');
      const available=[...builtinCommands.map(c=>({name:c.name,description:c.description})),...records.filter(r=>(r.data as any).enabled).map(r=>({name:(r.data as any).name,description:(r.data as any).description||r.title}))];
      const help=selected?available.filter(c=>c.name===selected):[...new Map(available.map(c=>[c.name,c])).values()];
      await reply(`${selected&&!help.length?`/${selected} n’est pas une commande disponible actuellement.`:help.slice(0,30).map(c=>`**/${c.name}** — ${c.description}`).join('\n')}\n\nRéglages du serveur : ${dashboard}\nCommandes personnalisées : ${dashboard}/commands`);
    }else if(builtin.name==='ping')await reply(`🏓 Latence Discord : ${Math.max(0,interaction.client.ws.ping)} ms.`);
    else if(builtin.name==='uptime'){
      const seconds=Math.floor((Date.now()-startedAt)/1000);await reply(`Bot actif depuis ${Math.floor(seconds/86400)} j ${Math.floor(seconds/3600)%24} h ${Math.floor(seconds/60)%60} min ${seconds%60} s.`);
    }else if(builtin.name==='serverinfo')await reply(`**${guild.name}**\nIdentifiant : ${guild.id}\nMembres : ${guild.memberCount}\nSalons : ${guild.channels.cache.size}\nRôles : ${guild.roles.cache.size}\nCréé le : <t:${Math.floor(guild.createdTimestamp/1000)}:F>`);
    else if(builtin.name==='userinfo'){
      const user=interaction.options.getUser('membre')??interaction.user;
      const member=await guild.members.fetch(user.id).catch(()=>null);
      await reply(`**${user.username}**\nIdentifiant : ${user.id}\nCompte créé : <t:${Math.floor(user.createdTimestamp/1000)}:F>${member?.joinedTimestamp?`\nArrivée sur le serveur : <t:${Math.floor(member.joinedTimestamp/1000)}:F>`:''}\nBot : ${user.bot?'oui':'non'}`);
    }else if(builtin.name==='avatar'){
      const user=interaction.options.getUser('membre')??interaction.user;
      await interaction.editReply({embeds:[new EmbedBuilder().setTitle(`Avatar de ${user.username}`).setImage(user.displayAvatarURL({size:1024}))],allowedMentions:{parse:[]}});
    }else if(builtin.name==='stats'){
      const [tickets,cases,metrics]=await Promise.all([db.ticket.count({where:{guildId:guild.id,status:'open'}}),db.case.count({where:{guildId:guild.id}}),db.metric.aggregate({where:{guildId:guild.id,kind:'commands'},_sum:{count:true}})]);
      await reply(`**${guild.name}**\nMembres : ${guild.memberCount}\nTickets ouverts : ${tickets}\nSanctions enregistrées : ${cases}\nCommandes utilisées : ${metrics._sum.count??0}\nTableau de bord : ${dashboard}`);
    }
  }
  await metric(guild.id,'commands');await audit(guild.id,interaction.user.id,'command.used',{name:interaction.commandName});
}
