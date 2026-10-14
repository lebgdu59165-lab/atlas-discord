import 'dotenv/config';
import {youtube,findTrack} from './music';
import {db} from '../lib/db';
import {Readable} from 'node:stream';
import {spawn} from 'node:child_process';
import {json} from '../services/store';
try{
 const [{default:ffmpeg},{default:Opus},{generateDependencyReport}]=await Promise.all([import('ffmpeg-static'),import('opusscript'),import('@discordjs/voice')]);
 const track=await findTrack('https://www.youtube.com/watch?v=jNQXAC9IVRw','audio-test');
 const yt=await youtube(),web=await yt.download(track.id,{type:'audio',quality:'best',format:'any',client:'ANDROID_VR'}),source=Readable.fromWeb(web as any);
 const proc=spawn(ffmpeg!,['-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-i','pipe:0','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['pipe','pipe','ignore'],windowsHide:true});
 let inputBytes=0;source.on('data',b=>{inputBytes+=b.length;});source.pipe(proc.stdin);proc.stdin.on('error',()=>{});
 const pcm=await new Promise<Buffer>((resolve,reject)=>{let data=Buffer.alloc(0);const timer=setTimeout(()=>reject(new Error('Audio timeout')),20000);proc.stdout.on('data',b=>{data=Buffer.concat([data,b]);if(data.length>=3840){clearTimeout(timer);resolve(data.subarray(0,3840));}});proc.on('error',e=>{clearTimeout(timer);reject(e);});source.on('error',e=>{clearTimeout(timer);reject(e);});proc.on('exit',()=>{clearTimeout(timer);if(data.length<3840)reject(new Error('FFmpeg decoding failed'));});}).finally(()=>{source.destroy();proc.kill();});
 const encoder=new Opus(48000,2,Opus.Application.AUDIO),encoded=encoder.encode(pcm,960);encoder.delete();
 const report=generateDependencyReport(),result={ok:inputBytes>0&&encoded.length>0,inputBytes,decodedBytes:pcm.length,opusBytes:encoded.length,dave:/@snazzah\/davey:\s*(?!not found)\d/.test(report),platform:process.platform,runtime:process.version,checkedAt:new Date().toISOString()};
 await db.globalSetting.upsert({where:{key:'audioProbe'},create:{key:'audioProbe',value:json(result)},update:{value:json(result)}});
 console.log('Audio validation:',JSON.stringify(result));
}catch{
 const result={ok:false,error:'Test audio externe indisponible. Consultez les permissions vocales et la disponibilité YouTube.',platform:process.platform,checkedAt:new Date().toISOString()};
 await db.globalSetting.upsert({where:{key:'audioProbe'},create:{key:'audioProbe',value:json(result)},update:{value:json(result)}}).catch(()=>{});
 console.error(result.error);
}finally{await db.$disconnect();}
