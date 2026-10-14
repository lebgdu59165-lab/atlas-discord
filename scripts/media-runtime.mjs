import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
const version='2026.08.19';
const binaries={win32:{name:'yt-dlp.exe',hash:'66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a'},linux:{name:'yt-dlp_linux',hash:'58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a'}};
let installation;
/** @returns {NodeJS.ProcessEnv} */
export function mediaRuntimeEnv(){return {NODE_ENV:'production',...Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))};}
export function mediaRuntimeArgs(videoId){
 if(!/^[\w-]{11}$/.test(videoId))throw new Error('Invalid YouTube video id');
 return ['--ignore-config','--no-config-locations','--no-plugin-dirs','--no-remote-components','--no-playlist','--no-cache-dir','--no-js-runtimes','--js-runtimes',`node:${process.execPath}`,'--quiet','--no-progress','--no-warnings','--socket-timeout','15','--retries','1','--fragment-retries','1','-f','bestaudio[acodec=opus]/bestaudio','-o','-',`https://www.youtube.com/watch?v=${videoId}`];
}
export function ensureMediaRuntime(){
 if(!installation)installation=(async()=>{
  const binary=binaries[process.platform];if(!binary||process.arch!=='x64')throw new Error('Unsupported media platform');
  const directory=resolve('.cache','atlas-media',version),path=resolve(directory,binary.name),hash=b=>createHash('sha256').update(b).digest('hex');
  const existing=await readFile(path).catch(()=>null);if(existing&&hash(existing)===binary.hash)return path;
  const response=await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${binary.name}`,{signal:AbortSignal.timeout(120000)});if(!response.ok||!response.body)throw new Error('Official media runtime download failed');
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>70*1024*1024)throw new Error('Media runtime exceeds maximum size');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=Buffer.concat(chunks);if(hash(bytes)!==binary.hash)throw new Error('Official media runtime checksum mismatch');
  await mkdir(directory,{recursive:true});await writeFile(path+'.partial',bytes);await rename(path+'.partial',path);if(process.platform!=='win32')await chmod(path,0o755);return path;
 })().catch(e=>{installation=undefined;throw e;});return installation;
}
