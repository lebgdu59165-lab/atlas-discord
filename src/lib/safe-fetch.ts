import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
import { AppError } from './errors';
export function publicIPv4(ip:string) {
  if(isIP(ip)!==4)return false;
  const [a,b]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));
}
export async function safeFetch(value:string):Promise<unknown> {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port && url.port!=='443') throw new AppError(400,'Une URL HTTPS publique sur le port 443 est requise.');
  const addresses=await lookup(url.hostname,{all:true,family:4});
  if(!addresses.length || addresses.some(a=>!publicIPv4(a.address)))throw new AppError(400,'Adresse privée ou réservée interdite.');
  const pinned=addresses[0].address;
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{lookup:(_host,_options,cb)=>cb(null,pinned,4),timeout:5000},res=>{
      if(res.statusCode!==200){res.resume();reject(new AppError(502,'Serveur FiveM indisponible. Redirections interdites.'));return;}
      let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>1000000){req.destroy();reject(new AppError(502,'Réponse FiveM trop volumineuse.'));}});
      res.on('end',()=>{try{resolve(JSON.parse(text));}catch{reject(new AppError(502,'Le serveur FiveM ne renvoie pas de JSON valide.'));}});
    });req.on('timeout',()=>req.destroy(new AppError(504,'Délai FiveM dépassé.')));req.on('error',reject);
  });
}
