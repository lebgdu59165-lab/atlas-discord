import {readFile,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
try{await access('.env');console.log('.env existe déjà. Aucun secret modifié.');}
catch{
  const password=randomBytes(24).toString('hex'),key=randomBytes(32).toString('hex');
  const template=await readFile('.env.example','utf8');
  const value=template.replaceAll('CHANGE_ME',password).replace('ENCRYPTION_KEY=','ENCRYPTION_KEY='+key);
  await writeFile('.env',value,{mode:0o600});
  console.log('.env créé. Renseignez les identifiants Discord dans ce fichier ; ne le partagez pas.');
}
