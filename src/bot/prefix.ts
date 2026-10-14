import {type Message,type ChatInputCommandInteraction as CI} from 'discord.js';
import {builtinCommands} from '../shared/commands';
import {config} from '../services/store';
import {dispatchCommand} from './commands';
import {AppError} from '../lib/errors';
import {interactionErrorMessage,responseEmbed} from './presentation';
export function prefixArguments(body:string,definition:{options:any[]}){
 const tokens=(body.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/g)??[]).map(s=>s.startsWith('"')?JSON.parse(s):s.startsWith("'")?s.slice(1,-1):s);
 const values:Record<string,any>={};for(let n=0;n<definition.options.length;n++){
  const option=definition.options[n];let value=n===definition.options.length-1&&option.type===3?tokens.splice(0).join(' '):tokens.shift();
  if(!value){if(option.required)throw new AppError(400,`Paramètre manquant : ${option.name}. Consultez /help commande:nom.`);continue;}
  if(option.type===4){if(!/^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new AppError(400,`${option.name} doit être un entier.`);value=Number(value);if(option.min_value!==undefined&&value<option.min_value||option.max_value!==undefined&&value>option.max_value)throw new AppError(400,`${option.name} est hors limites.`);}
  if(option.type===5){if(!/^(true|false|oui|non|1|0)$/i.test(value))throw new AppError(400,`${option.name} : true/false ou oui/non.`);value=/^(true|oui|1)$/i.test(value);}
  if([6,7,8].includes(option.type)){value=String(value).replace(/^<[@#]&?!?(\d+)>$/,'$1');if(!/^\d{17,20}$/.test(value))throw new AppError(400,`Indiquez un identifiant ou une mention pour ${option.name}.`);}
  if(option.type===3&&option.max_length&&value.length>option.max_length)throw new AppError(400,`${option.name} est trop long.`);values[option.name]=value;
 }if(tokens.length)throw new AppError(400,'Trop de paramètres. Consultez /help.');return values;
}
export async function prefixCommand(message:Message){
 if(!message.guild||message.author.bot||!message.content)return false;const settings=await config(message.guild.id,'settings'),prefix=String(settings.value.prefix??'!');if(!message.content.startsWith(prefix))return false;
 const raw=message.content.slice(prefix.length).trim(),[name]=raw.split(/\s+/),definition=builtinCommands.find(c=>c.name===name.toLowerCase());if(!definition)return false;
 try{
  const values=prefixArguments(raw.slice(name.length).trim(),definition);
  const users=new Map(),roles=new Map(),channels=new Map();for(const option of definition.options){const value=values[option.name];if(!value)continue;
   if(option.type===6)users.set(option.name,await message.client.users.fetch(value));if(option.type===8)roles.set(option.name,await message.guild.roles.fetch(value));if(option.type===7)channels.set(option.name,await message.guild.channels.fetch(value));
  }
  const get=(name:string,required=false)=>{const value=values[name]??null;if(required&&value===null)throw new AppError(400,`Paramètre manquant : ${name}.`);return value;};
  const context={guild:message.guild,guildId:message.guild.id,channel:message.channel,channelId:message.channelId,user:message.author,client:message.client,commandName:definition.name,options:{getString:get,getInteger:get,getBoolean:get,getUser:(n:string,r=false)=>{get(n,r);return users.get(n)??null;},getRole:(n:string,r=false)=>{get(n,r);return roles.get(n)??null;},getChannel:(n:string,r=false)=>{get(n,r);return channels.get(n)??null;}},editReply:(data:any)=>{if(!message.channel.isSendable())throw new AppError(400,'Salon inaccessible.');return message.channel.send(data);}};
  await dispatchCommand(context as unknown as CI);
 }catch(e){if(message.channel.isSendable())await message.channel.send({embeds:[responseEmbed('Cette commande demande votre attention',interactionErrorMessage(e),'error')],allowedMentions:{parse:[]}});}
 return true;
}
