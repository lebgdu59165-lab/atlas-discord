import { config } from 'dotenv';
import { productionErrors,checkDiscord } from './check-production.mjs';

config({quiet:true});
const errors=productionErrors(process.env,'cloud');
if(errors.length){console.error(`Configuration incomplète :\n${errors.join('\n')}`);process.exit(1);}
try{await checkDiscord(process.env);}
catch(error){console.error(error.message);process.exit(1);}
// Les migrations sont appliquées par le web, avant ce lancement.
// Le bot reste dans un seul processus pour économiser la mémoire.
try{await import('../bot-build/index.mjs');}
catch(error){console.error('Le bot ne peut pas démarrer. Vérifiez Discord et les connexions aux bases.',error?.name??'Error');process.exit(1);}
