import { z } from 'zod';
import { AppError } from './errors';

export function twitchLogin(value:string) {
  const trimmed=value.trim();
  const match=trimmed.match(/^https:\/\/(?:www\.)?twitch\.tv\/([a-z0-9_]{1,25})\/?$/i);
  const login=(match?.[1]??trimmed).toLowerCase();
  if(!/^[a-z0-9_]{1,25}$/.test(login))throw new AppError(400,'Indiquez le nom ou le lien HTTPS de la chaîne Twitch.');
  return login;
}
const streamSchema=z.object({id:z.string().regex(/^\d+$/),user_id:z.string(),user_login:z.string(),user_name:z.string(),type:z.literal('live'),title:z.string(),game_name:z.string(),started_at:z.string().datetime()});
export type TwitchStream=z.infer<typeof streamSchema>;
export const TWITCH_MESSAGE='🔴 {name} est en live !\n{title}\n{url}';
export function twitchMessage(template:string,stream:TwitchStream) {
  const url=`https://www.twitch.tv/${twitchLogin(stream.user_login)}`;
  const values:Record<string,string>={name:stream.user_name,title:stream.title,game:stream.game_name,url};
  const text=template.replace(/\{(name|title|game|url)\}/g,(_,key)=>values[key]);
  return template.includes('{url}')&&text.length<=2000?text:`${text.slice(0,1900)}\n${url}`;
}

export class TwitchApi {
  private token='';
  private expiresAt=0;
  private validatedAt=0;
  constructor(private clientId:string,private secret:string,private request:typeof fetch=fetch,private clock=Date.now){}
  get configured(){return !!this.clientId&&!!this.secret;}
  private async call(url:string,options:RequestInit={}) {
    try{return await this.request(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});}
    catch{throw new AppError(503,'Connexion à Twitch interrompue ; une nouvelle vérification sera effectuée.');}
  }
  private async accessToken() {
    if(!this.configured)throw new AppError(503,'Les identifiants Twitch ne sont pas encore configurés sur le bot.');
    if(this.token&&this.expiresAt>this.clock()+60000){
      if(this.clock()-this.validatedAt<3600000)return this.token;
      const validation=await this.call('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${this.token}`}});
      if(validation.ok){const body=await validation.json();if(body.client_id!==this.clientId)throw new AppError(503,'Identifiants Twitch incompatibles.');this.validatedAt=this.clock();return this.token;}
      if(validation.status!==401)throw new AppError(503,'Validation Twitch momentanément indisponible.');
    }
    const response=await this.call('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:this.clientId,client_secret:this.secret,grant_type:'client_credentials'})});
    if(!response.ok)throw new AppError(503,'Twitch refuse les identifiants de l’application.');
    const body=z.object({access_token:z.string().min(1),expires_in:z.number().positive()}).parse(await response.json());
    this.token=body.access_token;this.expiresAt=this.clock()+body.expires_in*1000;
    // Validation de la nouvelle session OAuth auprès de Twitch.
    const validation=await this.call('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${this.token}`}});
    if(!validation.ok){this.token='';throw new AppError(503,'Le jeton Twitch ne peut pas être validé.');}
    const info=await validation.json();if(info.client_id!==this.clientId){this.token='';throw new AppError(503,'Identifiants Twitch incompatibles.');}
    this.validatedAt=this.clock();return this.token;
  }
  async streams(logins:string[]) {
    const results:TwitchStream[]=[];
    const unique=[...new Set(logins.map(twitchLogin))];
    for(let offset=0;offset<unique.length;offset+=100){
      const batch=unique.slice(offset,offset+100),query=new URLSearchParams({first:'100'});
      batch.forEach(login=>query.append('user_login',login));
      let response:Response|undefined;
      for(let attempt=0;attempt<2;attempt++){
        const token=await this.accessToken();
        response=await this.call(`https://api.twitch.tv/helix/streams?${query}`,{headers:{Authorization:`Bearer ${token}`,'Client-Id':this.clientId}});
        if(response.status!==401)break;
        this.token='';
      }
      if(!response?.ok)throw new AppError(503,response?.status===429?'Twitch limite les requêtes ; nouvelle vérification dans une minute.':'État du live Twitch momentanément indisponible.');
      const data=z.object({data:z.array(streamSchema)}).parse(await response.json());
      results.push(...data.data.filter(stream=>batch.includes(stream.user_login.toLowerCase())));
    }
    return results;
  }
}
