import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const output=resolve('../atlas-bot-discloud');
const pkg=JSON.parse(await readFile('package.json','utf8'));
for(const file of ['bot-build/index.mjs','bot-build/index.mjs.LEGAL.txt','scripts/start-discloud.mjs','scripts/check-production.mjs','prisma/schema.prisma','discloud.config','.env.example','.gitignore','.discloudignore']){
  const destination=resolve(output,file);await mkdir(dirname(destination),{recursive:true});await copyFile(file,destination);
}
await writeFile(resolve(output,'package.json'),JSON.stringify({name:'atlas-bot-discloud',version:pkg.version,private:true,type:'module',engines:{node:'>=22.12'},scripts:{start:'node scripts/start-discloud.mjs','db:generate':'prisma generate'},dependencies:Object.fromEntries(['@prisma/client','prisma','dotenv'].map(key=>[key,pkg.dependencies[key]]))},null,2)+'\n');
await writeFile(resolve(output,'README.md'),`# Bot Atlas pour Discloud gratuit\n\nPaquet compilé sans le site et sans secrets. Les migrations doivent d’abord être appliquées par le site web. Les variables privées sont à configurer dans l’hébergement ; elles ne figurent pas dans cette archive. Une seule instance du bot est autorisée.\n\nLimite Free : 100 Mo. La mesure locale avant Gateway est d’environ 81 Mo ; ce chiffre ne garantit pas la tenue en charge. Il faut vérifier la mémoire après connexion réelle au serveur Discord. Le redémarrage automatique du fournisseur est réservé au plan Platinum ; la disponibilité permanente n’est pas encore validée.\n\nLe démarrage refuse une configuration incomplète et vérifie le token auprès de Discord. Il ne lance ni Next.js, ni compilateur TypeScript, ni processus de migration.\n`);
console.log('Paquet du bot créé sans secrets : atlas-bot-discloud.');
