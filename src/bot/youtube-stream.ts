import {Readable} from 'node:stream';
import {spawn} from 'node:child_process';
import {ensureMediaRuntime,mediaRuntimeArgs,mediaRuntimeEnv} from '../../scripts/media-runtime.mjs';
import {AppError} from '../lib/errors';
export async function youtubeAudioStream(videoId:string):Promise<ReadableStream<Uint8Array>>{
 let command:string;try{command=await ensureMediaRuntime();}catch{throw new AppError(503,'Le moteur de lecture YouTube n’est pas disponible. Réessayez dans quelques instants.');}
 const process=spawn(command,mediaRuntimeArgs(videoId),{env:mediaRuntimeEnv(),stdio:['ignore','pipe','pipe'],windowsHide:true});
 let errorText='';process.stderr.on('data',b=>{errorText=(errorText+b.toString()).slice(-3000);});
 const failure=()=>{console.error('YouTube source error:',errorText.replace(/https?:\/\/\S+/g,'[URL]').slice(-1200));return new AppError(502,/private|unavailable|login|age.restricted|members.only|not available/i.test(errorText)?'YouTube refuse l’accès à ce morceau : vidéo privée, supprimée ou restreinte.':'Le flux YouTube n’a pas pu être téléchargé. Réessayez avec un autre lien public.');};
 process.on('error',()=>process.stdout.destroy(failure()));process.on('exit',code=>{if(code!==0&&code!==null)process.stdout.destroy(failure());});process.stdout.on('close',()=>process.kill());
 const reader=(Readable.toWeb(process.stdout) as ReadableStream<Uint8Array>).getReader();let timer:ReturnType<typeof setTimeout>|undefined;
 let first:ReadableStreamReadResult<Uint8Array>;try{first=await Promise.race([reader.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{process.kill();reject(new AppError(504,'Le démarrage de ce morceau prend trop de temps. Réessayez.'));},45000);})]);if(first.done||!first.value?.length)throw failure();}
 catch(e){process.kill();await reader.cancel().catch(()=>{});throw e;}finally{if(timer)clearTimeout(timer);}
 return new ReadableStream<Uint8Array>({start(controller){controller.enqueue(first.value!);},async pull(controller){try{const part=await reader.read();if(part.done)controller.close();else controller.enqueue(part.value);}catch(e){controller.error(e);process.kill();}},async cancel(){process.kill();await reader.cancel().catch(()=>{});}});
}
