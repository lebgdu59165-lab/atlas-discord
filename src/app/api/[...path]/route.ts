import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { authenticate, authorize, cookie, cookieValue, newSession, requireOwner, userGuilds } from '../../../lib/auth';
import { nonce, encrypt } from '../../../lib/crypto';
import { discord, isAdmin, botInvite } from '../../../lib/discord';
import { publicError, AppError } from '../../../lib/errors';
import { redis, rateLimit } from '../../../lib/redis';
import { config, saveConfig, createRecord, updateRecord, deleteRecord, getRecord, enqueue, grant, audit, json } from '../../../services/store';
import { economy, participate, decision, endShift, assistant } from '../../../services/community';
import { byId, permissionFor, snowflake } from '../../../shared/catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const response=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function body(req:Request) {
  if(Number(req.headers.get('content-length') ?? 0)>65536) throw new AppError(413,'Formulaire trop volumineux.');
  const raw=await req.text(); if(raw.length>65536) throw new AppError(413,'Formulaire trop volumineux.');
  try{return JSON.parse(raw);}catch{throw new AppError(400,'Formulaire invalide.');}
}
async function handler(req:Request,{params}:{params:Promise<{path:string[]}>}) {
  try {
    const {path}=await params, [root,a,b,c,d]=path, method=req.method, url=new URL(req.url);
    if(root==='health') {
      const checks=await Promise.allSettled([db.$queryRaw`SELECT 1`,Promise.resolve().then(()=>redis().ping())]);
      const database=checks[0].status==='fulfilled',cache=checks[1].status==='fulfilled';
      let bot:any=null;
      if(database) {const h=await db.globalSetting.findUnique({where:{key:'botHeartbeat'}});bot=h?.value;}
      return response({database,redis:cache,oauth:Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.ENCRYPTION_KEY),bot:Boolean(bot && Date.now()-bot.at<60000),latency:bot?.latency ?? null},database && cache ? 200:503);
    }
    if(root==='auth' && a==='login') {
      if(method!=='GET') throw new AppError(405,'Méthode non autorisée.');
      if(!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) throw new AppError(503,'Configurez l’application Discord dans .env avant la connexion.');
      await rateLimit('oauth:login',100);
      const state=nonce();await redis().set(`oauth:${state}`,'1','EX',300);
      const target=new URL('https://discord.com/oauth2/authorize');
      target.search=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,redirect_uri:`${process.env.APP_URL}/api/auth/callback`,response_type:'code',scope:'identify guilds',state}).toString();
      const r=NextResponse.redirect(target);r.headers.append('Set-Cookie',cookie('atlas_oauth',state,300));return r;
    }
    if(root==='auth' && a==='callback') {
      if(method!=='GET') throw new AppError(405,'Méthode non autorisée.');
      const state=url.searchParams.get('state'), code=url.searchParams.get('code');
      if(!state || !code || cookieValue(req.headers.get('cookie'),'atlas_oauth')!==state || !await redis().getdel(`oauth:${state}`)) throw new AppError(403,'La connexion Discord a expiré ou a été refusée.');
      const tokenResponse=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID!,client_secret:process.env.DISCORD_CLIENT_SECRET!,grant_type:'authorization_code',code,redirect_uri:`${process.env.APP_URL}/api/auth/callback`}),signal:AbortSignal.timeout(10000)});
      if(!tokenResponse.ok) throw new AppError(401,'Connexion Discord refusée.');
      const t=await tokenResponse.json(), me=await discord<{id:string;username:string;global_name:string|null;avatar:string|null}>('/users/@me',{},t.access_token);
      const data={name:me.global_name ?? me.username,avatar:me.avatar,token:encrypt(t.access_token),refreshToken:encrypt(t.refresh_token),tokenExpiresAt:new Date(Date.now()+t.expires_in*1000)};
      await db.user.upsert({where:{id:me.id},create:{id:me.id,...data},update:data});
      const s=await newSession(me.id),r=NextResponse.redirect(`${process.env.APP_URL}/servers`);
      r.headers.append('Set-Cookie',cookie('atlas_session',s.raw));r.headers.append('Set-Cookie',cookie('atlas_oauth','',0));return r;
    }
    const s=await authenticate(req), actor=s.userId;
    if(root==='me') return response({id:actor,name:s.user.name,avatar:s.user.avatar?`https://cdn.discordapp.com/avatars/${actor}/${s.user.avatar}.png`:null,csrf:s.csrf,owner:actor===process.env.OWNER_DISCORD_ID});
    if(root==='auth' && a==='logout' && method==='POST') {await db.session.delete({where:{id:s.id}});const r=response({ok:true});r.headers.append('Set-Cookie',cookie('atlas_session','',0));return r;}
    if(root==='global') {
      requireOwner(actor);
      if(method==='GET') return response({guilds:await db.guild.findMany({select:{id:true,name:true,installed:true,memberCount:true}}),settings:await db.globalSetting.findMany({where:{key:{in:['maintenance','botHeartbeat']}}}),errors:await db.job.findMany({where:{status:'failed'},select:{id:true,kind:true,error:true,updatedAt:true},take:50,orderBy:{updatedAt:'desc'}})});
      if(method==='PUT') {const {maintenance}=z.object({maintenance:z.boolean()}).strict().parse(await body(req));await db.globalSetting.upsert({where:{key:'maintenance'},create:{key:'maintenance',value:maintenance},update:{value:maintenance}});await db.globalSetting.upsert({where:{key:'globalAudit'},create:{key:'globalAudit',value:json({actor,maintenance,at:new Date()})},update:{value:json({actor,maintenance,at:new Date()})}});return response({ok:true});}
    }
    if(root!=='guilds') throw new AppError(404,'Route inconnue.');
    if(!a) {
      const [all,installed,grants,moderations]=await Promise.all([userGuilds(actor),db.guild.findMany(),db.grant.findMany({where:{userId:actor}}),db.config.findMany({where:{module:'moderation'}})]);
      const roleAccess:string[]=[];
      for(const g of all.filter(g=>moderations.some(c=>c.guildId===g.id&&(c.value as any).moderatorRoles?.length))){const member=await discord<{roles:string[]}>(`/guilds/${g.id}/members/${actor}`).catch(()=>null);const roles=(moderations.find(c=>c.guildId===g.id)!.value as any).moderatorRoles;if(member?.roles.some(r=>roles.includes(r)))roleAccess.push(g.id);}
      return response(all.filter(g=>isAdmin(g.permissions,g.owner)||grants.some(x=>x.guildId===g.id)||roleAccess.includes(g.id)).map(g=>({...g,installed:installed.some(x=>x.id===g.id&&x.installed),invite:botInvite(g.id)})));
    }
    const guildId=snowflake.parse(a);
    if(b==='community' || b==='participate' || b==='my-economy') {
      const guild=await db.guild.findUnique({where:{id:guildId}});if(!guild?.installed) throw new AppError(404,'Serveur introuvable.');
      await discord(`/guilds/${guildId}/members/${actor}`);
      if(b==='community' && method==='POST'){const p=z.object({title:z.string().min(1).max(256),description:z.string().min(1).max(4000)}).strict().parse(await body(req));return response(await createRecord(guildId,actor,'suggestions',{title:p.title,data:{description:p.description,staffReply:''}}),201);}
      if(b==='community' && method==='GET') {
        const entries=await db.entity.findMany({where:{guildId,module:{in:['shop','events','giveaways','polls','suggestions','recruitment']},status:{in:['active','closed','accepted','rejected']}}});
        return response({guild:{id:guild.id,name:guild.name},records:entries.map(r=>{
          const data=r.data as any,{votes,participants,waitlist,...safe}=data;
          return {...r,data:{...safe,participantCount:participants?.length??0,waitlistCount:waitlist?.length??0,voteCounts:Object.values(votes??{}).reduce((acc:any,v:any)=>({...acc,[v]:(acc[v]??0)+1}),{})}};
        })});
      }
      if(b==='participate' && c && method==='POST') return response(await participate(guildId,actor,c,await body(req)));
      if(b==='my-economy' && method==='POST') return response(await economy(guildId,actor,await body(req)));
      if(b==='my-economy' && method==='GET') return response(await db.account.findUnique({where:{guildId_userId:{guildId,userId:actor}}}) ?? {wallet:0,bank:0,inventory:[]});
    }
    const module=b==='config'?c:b==='records'?c:b;
    const permission=(!b || ['overview','statistics','decision','publish','shifts','verify'].includes(b))?undefined:b==='config'?'config':b==='jobs'?'logs':permissionFor(module ?? 'overview');
    const auth=await authorize(guildId,actor,permission);
    if(!b || b==='overview' || b==='statistics') {
      const [metrics,tickets,cases,audits,heartbeat]=await Promise.all([db.metric.findMany({where:{guildId},orderBy:{day:'asc'}}),db.ticket.groupBy({by:['status'],where:{guildId},_count:true}),db.case.count({where:{guildId}}),db.audit.findMany({where:{guildId},take:12,orderBy:{createdAt:'desc'}}),db.globalSetting.findUnique({where:{key:'botHeartbeat'}})]);
      return response({guild:auth.guild,permissions:auth.permissions,metrics,tickets,cases,audits:auth.permissions.includes('logs')?audits:[],heartbeat:heartbeat?.value ?? null});
    }
    if(b==='config' && c && byId(c)) {
      if(method==='GET') return response(await config(guildId,c));
      if(method==='PUT') return response(await saveConfig(guildId,actor,c,await body(req)));
    }
    if(b==='records' && c && byId(c)) {
      if(d) {
        const record=await getRecord(guildId,d,c);
        if(method==='GET') return response(record);
        if(method==='PUT') return response(await updateRecord(guildId,actor,record.id,await body(req)));
        if(method==='DELETE') return response(await deleteRecord(guildId,actor,record.id));
      }
      if(method==='GET') return response(await db.entity.findMany({where:{guildId,module:c},orderBy:{createdAt:'desc'},take:200}));
      if(method==='POST') return response(await createRecord(guildId,actor,c,await body(req)),201);
    }
    if(b==='decision' && c && method==='POST') {
      const record=await getRecord(guildId,c);await authorize(guildId,actor,permissionFor(record.module==='applications'?'recruitment':record.module));
      return response(await decision(guildId,actor,c,await body(req)));
    }
    if(b==='publish' && c && method==='POST') {
      const r=await getRecord(guildId,c);
      if(!['embeds','tickets','commands'].includes(r.module)) throw new AppError(400,'Cet élément ne peut pas être publié sur Discord.');
      await authorize(guildId,actor,permissionFor(r.module));
      const at=(r.data as any).sendAt;return response(await enqueue(guildId,actor,r.module==='commands'?'syncCommands':'publish',{id:r.id},at?new Date(at):new Date()),202);
    }
    if(b==='moderation') {
      if(method==='GET') return response(await db.case.findMany({where:{guildId,...(url.searchParams.get('userId')?{userId:snowflake.parse(url.searchParams.get('userId'))}:{})},orderBy:{createdAt:'desc'},take:200}));
      if(method==='POST') {const p=z.object({action:z.enum(['ban','unban','tempban','kick','timeout','untimeout','warn','unwarn']),userId:snowflake,reason:z.string().max(1000).default(''),seconds:z.number().int().min(1).max(2419200).optional(),caseId:z.string().max(100).optional()}).strict().parse(await body(req));const cfg=await config(guildId,'moderation');if(cfg.value.requireReason && !p.reason.trim()) throw new AppError(400,'Indiquez un motif.');if(['timeout','tempban'].includes(p.action)&&!p.seconds) throw new AppError(400,'La durée est obligatoire.');return response(await enqueue(guildId,actor,'moderation',p),202);}
    }
    if(b==='members' && method==='GET') {
      const search=url.searchParams.get('q') ?? '';if(search.length>100) throw new AppError(400,'Recherche trop longue.');
      const list=await discord<any[]>(`/guilds/${guildId}/members${search?`/search?query=${encodeURIComponent(search)}&limit=100`:'?limit=100'}`);
      return response(list.map(m=>({id:m.user.id,name:m.nick??m.user.global_name??m.user.username,roles:m.roles,avatar:m.user.avatar,joinedAt:m.joined_at})));
    }
    if(b==='roles' && method==='GET') return response(await discord(`/guilds/${guildId}/roles`));
    if((b==='members'||b==='roles') && method==='POST') {
      const p=z.object({action:z.enum(['addRole','removeRole','createRole','updateRole','deleteRole']),userId:snowflake.optional(),roleId:snowflake.optional(),name:z.string().min(1).max(100).optional(),color:z.string().regex(/^#[\da-f]{6}$/i).optional()}).strict().parse(await body(req));
      if(b==='members' && !['addRole','removeRole'].includes(p.action)) throw new AppError(400,'Action membre invalide.');
      if(['addRole','removeRole'].includes(p.action)&&(!p.userId||!p.roleId)) throw new AppError(400,'Membre et rôle obligatoires.');
      if(p.action==='createRole'&&!p.name) throw new AppError(400,'Nom obligatoire.');
      if(['updateRole','deleteRole'].includes(p.action)&&!p.roleId) throw new AppError(400,'Rôle obligatoire.');
      return response(await enqueue(guildId,actor,'roles',p),202);
    }
    if(b==='tickets') {
      if(method==='GET') return response(await db.ticket.findMany({where:{guildId},orderBy:{createdAt:'desc'},take:200,select:{id:true,userId:true,status:true,priority:true,assignedTo:true,channelId:true,createdAt:true,closedAt:true,rating:true,reason:true}}));
      if(method==='POST') {const p=z.object({action:z.enum(['claim','close','reopen','addParticipant','removeParticipant','priority']),id:z.string().max(100),reason:z.string().max(1000).optional(),userId:snowflake.optional(),priority:z.enum(['low','normal','high','urgent']).optional()}).strict().parse(await body(req));if(!await db.ticket.findFirst({where:{guildId,id:p.id}})) throw new AppError(404,'Ticket introuvable.');return response(await enqueue(guildId,actor,'ticket',p),202);}
      if(c && method==='GET') { const ticket=await db.ticket.findFirst({where:{guildId,id:c}});return response(ticket); }
    }
    if(b==='transcript' && c && method==='GET') {
      await authorize(guildId,actor,'tickets');const t=await db.ticket.findFirst({where:{id:c,guildId}});if(!t?.transcript) throw new AppError(404,'Transcription indisponible.');
      return new Response(t.transcript,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="ticket-${t.id}.html"`,'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
    }
    if(b==='levels') {
      if(method==='GET') return response(await db.level.findMany({where:{guildId},orderBy:{xp:'desc'},take:100}));
      if(method==='POST') {const p=z.object({action:z.enum(['set','reset']),userId:snowflake.optional(),xp:z.number().int().min(0).max(100000000).optional(),confirm:z.boolean().optional()}).strict().parse(await body(req));if(p.action==='reset'){if(!p.confirm)throw new AppError(400,'Confirmation requise.');await db.level.deleteMany({where:{guildId}});}else{if(!p.userId||p.xp===undefined)throw new AppError(400,'Membre et XP obligatoires.');await db.level.upsert({where:{guildId_userId:{guildId,userId:p.userId}},create:{guildId,userId:p.userId,xp:p.xp},update:{xp:p.xp}});}await audit(guildId,actor,'levels.adjust',p);return response({ok:true});}
    }
    if(b==='economy') {
      if(method==='GET') return response({accounts:await db.account.findMany({where:{guildId},orderBy:{wallet:'desc'},take:100}),transactions:await db.transaction.findMany({where:{guildId},orderBy:{createdAt:'desc'},take:100})});
      if(method==='POST') return response(await economy(guildId,actor,await body(req),true));
    }
    if(b==='applications' && method==='GET') return response(await db.entity.findMany({where:{guildId,module:'applications'},orderBy:{createdAt:'desc'},take:100}));
    if(b==='shifts') {
      if(method==='GET') {await authorize(guildId,actor,'staff');return response(await db.entity.findMany({where:{guildId,module:'shifts'},orderBy:{createdAt:'desc'},take:100}));}
      if(method==='POST'&&c) return response(await endShift(guildId,actor,c));
    }
    if(b==='verify' && method==='POST') {await authorize(guildId,actor,'config');return response(await enqueue(guildId,actor,'verifyPanel',{}),202);}
    if(b==='ai' && method==='POST') return response(await assistant(guildId,actor,await body(req)));
    if(b==='fivem-status') {
      const c=await config(guildId,'fivem');if(!c.value.enabled||!c.value.statusUrl)throw new AppError(503,'Aucun serveur FiveM configuré.');
      const {safeFetch}=await import('../../../lib/safe-fetch');return response(await safeFetch(String(c.value.statusUrl)));
    }
    if(b==='logs') return response(await db.audit.findMany({where:{guildId,...(url.searchParams.get('q')?{action:{contains:url.searchParams.get('q')!,mode:'insensitive'}}:{})},orderBy:{createdAt:'desc'},take:200}));
    if(b==='jobs') return response(await db.job.findMany({where:{guildId},orderBy:{createdAt:'desc'},take:100}));
    if(b==='twitch-status'&&method==='GET') {
      await authorize(guildId,actor,'content');
      const [runtime,lastDelivery,lastJob]=await Promise.all([
        db.entity.findFirst({where:{id:`twitch-status:${guildId}`,guildId,module:'twitch-status'},select:{data:true}}),
        db.entity.findFirst({where:{guildId,module:'twitch-delivery',status:'done'},orderBy:{updatedAt:'desc'},select:{data:true}}),
        db.job.findFirst({where:{guildId,kind:'twitchLive'},orderBy:{createdAt:'desc'},select:{status:true,error:true}})
      ]);
      return response({runtime:runtime?.data??null,lastDelivery:lastDelivery?.data??null,lastJob});
    }
    if(b==='security') {
      if(!auth.admin) throw new AppError(403,'Seul un administrateur Discord peut modifier les accès.');
      if(method==='GET') return response(await db.grant.findMany({where:{guildId}}));
      if(method==='PUT') {const p=await body(req);await discord(`/guilds/${guildId}/members/${p.userId}`);return response(await grant(guildId,actor,p));}
      if(method==='DELETE'&&c) {await db.grant.deleteMany({where:{guildId,userId:snowflake.parse(c)}});await audit(guildId,actor,'security.revoke',{},c);return response({ok:true});}
    }
    if(b==='data') {
      if(!auth.admin) throw new AppError(403,'Export et suppression réservés aux administrateurs Discord.');
      if(method==='GET') {const [configs,entities,cases,tickets,accounts,levels,audits]=await Promise.all([db.config.findMany({where:{guildId}}),db.entity.findMany({where:{guildId}}),db.case.findMany({where:{guildId}}),db.ticket.findMany({where:{guildId}}),db.account.findMany({where:{guildId}}),db.level.findMany({where:{guildId}}),db.audit.findMany({where:{guildId}})]);await audit(guildId,actor,'data.export');return response({exportedAt:new Date(),guild:auth.guild,configs,entities,cases,tickets,accounts,levels,audits});}
      if(method==='DELETE') {const p=z.object({confirmation:z.literal('SUPPRIMER')}).strict().parse(await body(req));await db.$transaction(async tx=>{
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('atlas:job-claim',0))`;
        if(await tx.job.findFirst({where:{guildId,status:'running'}}))throw new AppError(409,'Une action est en cours. Attendez sa fin avant d’effacer les données.');
        await tx.job.deleteMany({where:{guildId}});
        await tx.entity.deleteMany({where:{guildId}});
        await tx.case.deleteMany({where:{guildId}});
        await tx.ticket.deleteMany({where:{guildId}});
        await tx.level.deleteMany({where:{guildId}});
        await tx.account.deleteMany({where:{guildId}});
        await tx.transaction.deleteMany({where:{guildId}});
        await tx.metric.deleteMany({where:{guildId}});
        await tx.audit.deleteMany({where:{guildId}});
        await tx.config.deleteMany({where:{guildId}});
      });await audit(guildId,actor,'data.erase',p);return response({ok:true});}
    }
    throw new AppError(404,'Action indisponible.');
  }catch(e){const error=publicError(e);return response({error:error.message},error.status);}
}
export {handler as GET,handler as POST,handler as PUT,handler as DELETE};
