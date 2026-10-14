import {ChannelType,PermissionFlagsBits as P,type ChatInputCommandInteraction,type Guild} from 'discord.js';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {Readable} from 'node:stream';
import {randomInt} from 'node:crypto';
import {AppError} from '../lib/errors';
import {config,json} from '../services/store';
import {db} from '../lib/db';
import {publish} from '../lib/redis';
type Track={id:string;title:string;requestedBy:string;url?:string};
type Session={guild:Guild;channelId:string;player:any;connection:any;queue:Track[];current:Track|null;volume:number;loop:boolean;resource:any;source:Readable|null;process:ReturnType<typeof spawn>|null;timer:ReturnType<typeof setTimeout>|null;loading:boolean;generation:number;error:string|null};
const sessions=new Map<string,Session>();
export const musicNames=['join','play','pause','resume','skip','stop','queue','volume','loop','nowplaying','remove','shuffle'];
let youtubePromise:Promise<any>|undefined;
export async function youtube(){
 if(!youtubePromise)youtubePromise=(async()=>{
  const {Innertube,Platform}=await import('youtubei.js');
  Platform.shim.eval=async data=>{
   const {getQuickJS}=await import('quickjs-emscripten');const Q=await getQuickJS(),rt=Q.newRuntime();rt.setMemoryLimit(32*1024*1024);rt.setMaxStackSize(1024*1024);const end=Date.now()+2000;rt.setInterruptHandler(()=>Date.now()>end);const context=rt.newContext();
   try{const result=context.evalCode(`(()=>{${data.output}\n})()`);if(result.error){result.error.dispose();throw new Error('YouTube evaluator failed');}const value=context.dump(result.value);result.value.dispose();return value;}
   finally{context.dispose();rt.dispose();}
  };
  return Innertube.create({lang:'fr',location:'FR',fetch:async(input:any,init:any)=>{const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);try{return await fetch(input,{...init,signal:init?.signal?AbortSignal.any([timeout.signal,init.signal]):timeout.signal});}finally{clearTimeout(timer);}}});
 })().catch(e=>{youtubePromise=undefined;throw e;});
 return youtubePromise;
}
export function youtubeId(value:string){
 if(!/^https?:\/\//i.test(value))return null;const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw new AppError(400,'Utilisez un lien HTTPS YouTube.');
 const host=url.hostname.replace(/^www\./,'');let id:string|null=null;
 if(host==='youtu.be')id=url.pathname.slice(1);else if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com')id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(shorts|live|embed)\//.test(url.pathname)?url.pathname.split('/')[2]:null;
 if(!id||! /^[\w-]{11}$/.test(id))throw new AppError(400,'Lien YouTube invalide. Les autres sites ne sont pas acceptés.');return id;
}
export function discordAudioUrl(value:string){
 if(!/^https?:\/\//i.test(value))return null;
 const url=new URL(value);if(!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname))return null;
 if(url.protocol!=='https:'||url.username||url.password||url.port||!/^\/attachments\/\d{17,20}\/\d{17,20}\/[^/]+\.(mp3|wav|ogg|opus|m4a|aac|flac|webm)$/i.test(url.pathname)||value.length>2000)throw new AppError(400,'Utilisez le lien HTTPS d’un fichier audio envoyé sur Discord.');
 return url;
}
async function trackStream(track:Track){
 if(track.url){const url=discordAudioUrl(track.url);if(!url)throw new AppError(400,'Source audio invalide.');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let response:Response;try{response=await fetch(url,{redirect:'error',signal:controller.signal});}finally{clearTimeout(timer);}if(!response.ok||!response.body)throw new AppError(502,'Le fichier audio est inaccessible ou son lien a expiré. Copiez à nouveau son lien depuis Discord.');return response.body;}
 return (await youtube()).download(track.id,{type:'audio',quality:'best',format:'any',client:'ANDROID_VR'});
}
export async function findTrack(query:string,userId:string):Promise<Track>{
 try{const audio=discordAudioUrl(query);if(audio)return {id:audio.pathname.split('/').slice(-2).join('/'),title:decodeURIComponent(audio.pathname.split('/').at(-1)!).slice(0,200),requestedBy:userId,url:audio.href};const yt=await youtube();let id=youtubeId(query);
  if(!id){const results=await yt.search(query,{type:'video'});id=results.videos.find((v:any)=>v.id)?.id??null;}
  if(!id)throw new AppError(404,'Aucun morceau trouvé.');const info=await yt.getBasicInfo(id);if(info.playability_status?.status!=='OK')throw new AppError(502,'YouTube refuse la lecture de cette vidéo. Essayez un autre lien public.');
  return {id,title:String(info.basic_info.title??'Vidéo YouTube').slice(0,200),requestedBy:userId};
 }catch(e){if(e instanceof AppError)throw e;throw new AppError(502,'YouTube est temporairement indisponible ou refuse cet hébergeur. Aucun morceau n’a été annoncé comme joué.');}
}
async function persist(s:Session){await db.entity.upsert({where:{id:`music:${s.guild.id}`},create:{id:`music:${s.guild.id}`,guildId:s.guild.id,module:'music-state',title:'Lecteur audio',ownerId:s.guild.client.user!.id,status:'active',data:json(state(s))},update:{data:json(state(s)),status:'active'}});await publish(s.guild.id,'music');}
function state(s:Session){return {channelId:s.channelId,current:s.current,queue:s.queue,volume:s.volume,loop:s.loop,paused:s.player.state.status==='paused',connected:s.connection.state.status==='ready',error:s.error,checkedAt:new Date().toISOString()};}
function killAudio(s:Session){s.source?.destroy();s.process?.kill();s.source=null;s.process=null;s.resource=null;}
async function disconnect(s:Session){s.generation++;sessions.delete(s.guild.id);if(s.timer)clearTimeout(s.timer);s.queue=[];s.current=null;s.loop=false;killAudio(s);s.player.stop(true);if(s.connection.state.status!=='destroyed')s.connection.destroy();await persist(s);}
async function idle(s:Session){if(s.timer)clearTimeout(s.timer);const c=await config(s.guild.id,'music');s.timer=setTimeout(()=>{void disconnect(s).catch(()=>{});},Number(c.value.idleSeconds)*1000);s.timer.unref();}
async function playNext(s:Session){
 if(s.loading)return;s.loading=true;const generation=++s.generation;
 if(s.timer){clearTimeout(s.timer);s.timer=null;}killAudio(s);const next=s.loop&&s.current?s.current:s.queue.shift()??null;s.current=next;
 try{
  if(!next){await persist(s);await idle(s);return;}
  const web=await trackStream(next);if(generation!==s.generation){await web.cancel();return;}
  const [{default:ffmpeg},voice]=await Promise.all([import('ffmpeg-static'),import('@discordjs/voice')]);if(!ffmpeg)throw new Error('FFmpeg unavailable');
  const proc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-i','pipe:0','-analyzeduration','0','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['pipe','pipe','ignore'],windowsHide:true});
  proc.on('error',()=>{s.error='Le moteur audio n’a pas pu démarrer.';s.player.stop(true);});
  const source=Readable.fromWeb(web as any);source.on('error',()=>{s.error='Le flux YouTube a été interrompu.';s.player.stop(true);});proc.stdin.on('error',()=>{});source.pipe(proc.stdin);
  s.source=source;s.process=proc;s.resource=voice.createAudioResource(proc.stdout,{inputType:voice.StreamType.Raw,inlineVolume:true});s.resource.volume!.setVolume(s.volume/100);s.error=null;s.player.play(s.resource);await voice.entersState(s.player,voice.AudioPlayerStatus.Playing,15000);await persist(s);
 }catch(e){s.error=e instanceof AppError?e.message:'Lecture audio refusée par YouTube ou interrompue. Essayez un autre morceau.';s.loop=false;s.current=null;killAudio(s);await persist(s);throw new AppError(502,s.error);}
 finally{s.loading=false;}
}
async function requireUser(guild:Guild,userId:string,channelId?:string){const member=await guild.members.fetch(userId);if(!member.voice.channelId||channelId&&member.voice.channelId!==channelId)throw new AppError(403,'Rejoignez le même salon vocal que le bot pour utiliser le lecteur.');const channel=member.voice.channel;if(!channel||channel.type!==ChannelType.GuildVoice)throw new AppError(400,'Rejoignez un salon vocal standard.');return channel;}
async function join(guild:Guild,userId:string){
 const existing=sessions.get(guild.id);const channel=await requireUser(guild,userId,existing?.channelId);if(existing)return existing;
 const bot=await guild.members.fetchMe();if(!channel.permissionsFor(bot)?.has([P.Connect,P.Speak]))throw new AppError(403,'Le bot doit pouvoir se connecter et parler dans ce salon vocal.');
 const voice=await import('@discordjs/voice'),c=await config(guild.id,'music');const connection=voice.joinVoiceChannel({channelId:channel.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true});
 try{await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,20000);}catch{connection.destroy();throw new AppError(502,'La connexion vocale Discord n’a pas abouti.');}
 const player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Pause}});connection.subscribe(player);
 const s:Session={guild,channelId:channel.id,player,connection,queue:[],current:null,resource:null,source:null,process:null,timer:null,loading:false,generation:0,volume:Number(c.value.defaultVolume),loop:false,error:null};sessions.set(guild.id,s);
 player.on(voice.AudioPlayerStatus.Idle,()=>{if(sessions.get(guild.id)===s&&!s.loading)void playNext(s).catch(()=>{});});
 player.on('error',()=>{s.error='Lecture interrompue.';s.loop=false;s.current=null;killAudio(s);void persist(s).catch(()=>{});if(!s.loading)void playNext(s).catch(()=>{});});
 connection.on(voice.VoiceConnectionStatus.Disconnected,()=>{void (async()=>{try{await Promise.race([voice.entersState(connection,voice.VoiceConnectionStatus.Signalling,5000),voice.entersState(connection,voice.VoiceConnectionStatus.Connecting,5000)]);}catch{if(sessions.get(guild.id)===s)await disconnect(s);}})().catch(()=>{});});
 await persist(s);await idle(s);return s;
}
const operations=new Map<string,Promise<void>>();
export async function musicAction(guild:Guild,userId:string,action:string,value?:number,query?:string){const previous=operations.get(guild.id);let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});operations.set(guild.id,pending);await previous;try{return await performMusicAction(guild,userId,action,value,query);}finally{release();if(operations.get(guild.id)===pending)operations.delete(guild.id);}}
async function performMusicAction(guild:Guild,userId:string,action:string,value?:number,query?:string){
 const cfg=await config(guild.id,'music');if(!cfg.value.enabled)throw new AppError(409,'La musique est désactivée dans le tableau de bord.');
 if(action==='join'){await join(guild,userId);return 'Connecté au salon vocal.';}
 if(action==='play'){
  const existing=sessions.get(guild.id);await requireUser(guild,userId,existing?.channelId);if(!query?.trim())throw new AppError(400,'Indiquez un titre ou un lien YouTube.');if((existing?.queue.length??0)>=Number(cfg.value.maxQueue))throw new AppError(409,'La file musicale est pleine.');
  const track=await findTrack(query,userId),s=await join(guild,userId);s.queue.push(track);
  if(!s.current){await playNext(s);return `Lecture démarrée : ${track.title}`;}await persist(s);return `Ajouté à la file : ${track.title}`;
 }
 const s=sessions.get(guild.id);if(!s)throw new AppError(409,'Le bot n’est pas dans un salon vocal. Utilisez /join ou /play.');await requireUser(guild,userId,s.channelId);
 if(action==='queue')return s.queue.length?s.queue.map((t,n)=>`${n+1}. ${t.title}`).join('\n'):'La file d’attente est vide.';
 if(action==='nowplaying')return s.current?`${s.current.title}\nhttps://www.youtube.com/watch?v=${s.current.id}`:'Aucune musique en cours.';
 if(action==='stop'){await disconnect(s);return 'Lecture arrêtée, file vidée et salon vocal quitté.';}
 if(action==='pause'){if(!s.player.pause())throw new AppError(409,'Aucune lecture à mettre en pause.');}
 else if(action==='resume'){if(!s.player.unpause())throw new AppError(409,'Aucune lecture en pause.');}
 else if(action==='skip'){if(s.loading)throw new AppError(409,'Chargement en cours. Réessayez dans quelques secondes.');if(!s.current)throw new AppError(409,'Aucune musique à passer.');s.loop=false;s.current=null;s.player.stop(true);}
 else if(action==='volume'){if(!Number.isInteger(value)||value!<0||value!>100)throw new AppError(400,'Volume : 0 à 100.');s.volume=value!;s.resource?.volume?.setVolume(s.volume/100);}
 else if(action==='loop'){s.loop=!s.loop;}
 else if(action==='remove'){if(!Number.isInteger(value)||value!<1||value!>s.queue.length)throw new AppError(400,'Position inexistante dans la file.');s.queue.splice(value!-1,1);}
 else if(action==='shuffle'){for(let n=s.queue.length-1;n>0;n--){const r=randomInt(n+1);[s.queue[n],s.queue[r]]=[s.queue[r],s.queue[n]];}}
 else throw new AppError(400,'Action musicale inconnue.');await persist(s);return action==='loop'?`Répétition ${s.loop?'activée':'désactivée'}.`:action==='volume'?`Volume : ${s.volume} %.`:`Action ${action} effectuée.`;
}
export async function musicCommand(i:ChatInputCommandInteraction){const text=await musicAction(i.guild!,i.user.id,i.commandName,i.commandName==='volume'?i.options.getInteger('niveau',true):i.commandName==='remove'?i.options.getInteger('position',true):undefined,i.commandName==='play'?i.options.getString('recherche',true):undefined);await i.editReply(text.length>1800?{content:'File musicale complète :',files:[{attachment:Buffer.from(text),name:'file-musicale.txt'}],allowedMentions:{parse:[]}}:{content:text,allowedMentions:{parse:[]}});}
