import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { prismaClientReady } from './prisma-ready.mjs';

// Wispbyte lance ce fichier directement, avant l'installation des dépendances.
// Le bot rejoint ensuite le même processus, sans lanceur permanent supplémentaire.
async function runNpm(args) {
  return new Promise(resolve => {
    const child = spawn('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.once('error', () => resolve(1));
    child.once('exit', code => resolve(code ?? 1));
  });
}

const lockHash = createHash('sha256').update(await readFile('package-lock.json')).digest('hex');
const stampPath = 'node_modules/.atlas-lock.sha256';
const installedHash = await readFile(stampPath, 'utf8').catch(() => '');
if (installedHash !== lockHash) {
  const code = await runNpm(['ci', '--omit=dev', '--no-audit', '--no-fund']);
  if (code !== 0) process.exit(code);
  await writeFile(stampPath, lockHash);
}

// Une coupure du téléchargement ne force pas la réinstallation des dépendances.
if(!await prismaClientReady()){
  let generationCode = 1;
  for (let attempt = 0; attempt < 3; attempt++) {
    generationCode = await runNpm(['run', 'db:generate']);
    if (generationCode === 0) break;
    if (attempt < 2) {
      console.error('Génération Prisma interrompue ; nouvelle tentative dans cinq secondes.');
      await pause(5000);
    }
  }
  if (generationCode !== 0) process.exit(generationCode);
}else console.log('Client Prisma déjà généré pour ce schéma ; lancement direct du bot.');

await import('./start-discloud.mjs');
