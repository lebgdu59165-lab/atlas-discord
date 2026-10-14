import {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';
import {AppError} from '../lib/errors';
export function responseEmbed(title:string,description:string,tone:'default'|'success'|'error'='default'){
 return new EmbedBuilder().setColor(tone==='error'?0xed7f99:tone==='success'?0x64d9b0:0x9b82f5).setTitle(title.slice(0,256)).setDescription(description.slice(0,4096)).setFooter({text:'Atlas · Votre communauté, sous contrôle'}).setTimestamp();
}
export function dashboardButton(guildId:string,module='overview'){
 const origin=process.env.APP_URL??'https://atlas-dashboard-vf3d.onrender.com';return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel('Ouvrir le tableau de bord').setStyle(ButtonStyle.Link).setURL(`${origin}/dashboard/${guildId}/${module}`));
}
export function interactionErrorMessage(error:unknown){
 if(error instanceof AppError)return error.message;
 const code=(error as any)?.code??(error as any)?.errorCode;
 if(/^P\d{4}$/.test(String(code)))return 'Le service de données est temporairement occupé. Vérifiez le résultat de l’action avant de la relancer.';
 if(Number(code)===50013)return 'Atlas n’a pas les permissions nécessaires. Vérifiez ses droits et la position de son rôle dans Discord.';
 if(Number(code)===50001)return 'Atlas n’a plus accès à cet élément. Vérifiez les permissions du salon ou du serveur.';
 if([10003,10008].includes(Number(code)))return 'Ce salon ou ce message n’est plus disponible. Actualisez puis réessayez.';
 if(Number(code)===10062)return 'Cette interaction a expiré. Lancez à nouveau la commande.';
 return 'Cette action n’a pas pu aboutir. Réessayez dans quelques instants ; si elle modifie le serveur, vérifiez d’abord son résultat.';
}
