import 'dotenv/config';
import {youtube,findTrack} from './music';
import {db} from '../lib/db';
import {Readable} from 'node:stream';
import {spawn} from 'node:child_process';
import {json} from '../services/store';
import {access} from 'node:fs/promises';
import {youtubeAudioStream} from './youtube-stream';
let stage='dependencies';
let engineResult:any=null;
try{
 const [{default:ffmpeg},{default:Opus},voice]=await Promise.all([import('ffmpeg-static'),import('opusscript'),import('@discordjs/voice')]);const {generateDependencyReport}=voice;
 stage='ffmpeg';await access(ffmpeg!);
 // Decode a generated WAV so provider restrictions cannot hide an engine failure.
 const wav=Buffer.alloc(3884);wav.write('RIFF');wav.writeUInt32LE(3876,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(192000,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(3840,40);
 const test=spawn(ffmpeg!,['-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-i','pipe:0','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['pipe','pipe','ignore'],windowsHide:true});test.stdin.end(wav);test.stdin.on('error',()=>{});
 const frame=await new Promise<Buffer>((resolve,reject)=>{let data=Buffer.alloc(0);const timer=setTimeout(()=>reject(new Error('Engine timeout')),10000);test.stdout.on('data',b=>{data=Buffer.concat([data,b]);if(data.length>=3840){clearTimeout(timer);resolve(data.subarray(0,3840));}});test.on('error',e=>{clearTimeout(timer);reject(e);});test.on('exit',()=>{clearTimeout(timer);if(data.length<3840)reject(new Error('Engine decoding failed'));});}).finally(()=>test.kill());
 const engineEncoder=new Opus(48000,2,Opus.Application.AUDIO),engineEncoded=engineEncoder.encode(frame,960);engineEncoder.delete();
 engineResult={ok:engineEncoded.length>0,source:'generated-wav',decodedBytes:frame.length,opusBytes:engineEncoded.length,dave:/@snazzah\/davey:\s*(?!not found)\d/.test(generateDependencyReport()),youtube:false,platform:process.platform,runtime:process.version,checkedAt:new Date().toISOString()};
 await db.globalSetting.upsert({where:{key:'audioProbe'},create:{key:'audioProbe',value:json(engineResult)},update:{value:json(engineResult)}});
 stage='youtube';const track=await findTrack('https://www.youtube.com/watch?v=aqz-KE-bpKQ','audio-test');
 const web=await youtubeAudioStream(track.id),source=Readable.fromWeb(web as any);
 stage='decoding';const proc=spawn(ffmpeg!,['-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-i','pipe:0','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['pipe','pipe','ignore'],windowsHide:true});
 let inputBytes=0;source.on('data',b=>{inputBytes+=b.length;});source.pipe(proc.stdin);proc.stdin.on('error',()=>{});
 const player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Play}}),resource=voice.createAudioResource(proc.stdout,{inputType:voice.StreamType.Raw,inlineVolume:true});let streamError=false;source.on('error',()=>{streamError=true;player.stop(true);});player.on('error',()=>{streamError=true;});stage='playback';
 let playbackMs=0;try{player.play(resource);await voice.entersState(player,voice.AudioPlayerStatus.Playing,20000);await new Promise(r=>setTimeout(r,65000));playbackMs=resource.playbackDuration;if(streamError||playbackMs<61000||player.state.status!==voice.AudioPlayerStatus.Playing)throw new Error('Long playback failed');}finally{player.stop(true);source.destroy();proc.kill();}
 const report=generateDependencyReport(),result={ok:true,source:'yt-dlp',youtube:true,videoDurationSeconds:635,playbackMs,inputBytes,decodedBytes:engineResult.decodedBytes,opusBytes:engineResult.opusBytes,dave:/@snazzah\/davey:\s*(?!not found)\d/.test(report),platform:process.platform,runtime:process.version,checkedAt:new Date().toISOString()};
 await db.globalSetting.upsert({where:{key:'audioProbe'},create:{key:'audioProbe',value:json(result)},update:{value:json(result)}});
 console.log('Audio validation:',JSON.stringify(result));
}catch{
 process.exitCode=1;
 const result=engineResult?{...engineResult,youtube:false,checkedAt:new Date().toISOString(),error:'YouTube refuse cet hébergeur ou est indisponible. Les fichiers audio Discord restent utilisables.'}:{ok:false,stage,error:'Le moteur audio n’a pas passé la vérification.',platform:process.platform,checkedAt:new Date().toISOString()};
 await db.globalSetting.upsert({where:{key:'audioProbe'},create:{key:'audioProbe',value:json(result)},update:{value:json(result)}}).catch(()=>{});
 console.error(result.error);
}finally{await db.$disconnect();}
