import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import { productionErrors,checkDiscord } from './check-production.mjs';

config({quiet:true});
const role = process.argv[2];
if (!['web','bot'].includes(role)) {
  console.error('Usage : node scripts/start-hosted.mjs web|bot');
  process.exit(1);
}
// Render fournit l'origine publique après la création du service.
// Une origine explicitement configurée reste prioritaire, notamment pour un domaine personnalisé.
if (role === 'web' && !process.env.APP_URL && process.env.RENDER_EXTERNAL_URL) process.env.APP_URL = process.env.RENDER_EXTERNAL_URL;

let child;
let stopping = false;
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{stopping=true;if(child)child.kill(signal);});
function run(args) {
  return new Promise((resolve,reject)=>{
    child = spawn(process.execPath,args,{stdio:'inherit',env:process.env});
    child.once('error',()=>reject(new Error('Impossible de lancer le processus requis.')));
    child.once('exit',(code,signal)=>{child=undefined;resolve(code ?? (signal ? 143 : 1));});
  });
}

try {
  const errors = productionErrors(process.env,'cloud');
  if (errors.length) throw new Error(`Configuration incomplète :\n${errors.join('\n')}`);
  await checkDiscord(process.env);
  if (stopping) process.exit(143);
  const migrated = await run(['node_modules/prisma/build/index.js','migrate','deploy']);
  if (migrated !== 0 || stopping) process.exit(Number(migrated) || 143);
  const exited = await run(['--import','tsx',role === 'bot' ? 'src/bot/index.ts' : 'server.ts']);
  process.exitCode = Number(exited);
} catch (error) {console.error(error.message);process.exitCode=1;}
