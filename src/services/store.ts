import { db } from '../lib/db';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { publish } from '../lib/redis';
import { byId, configSchema, defaults, recordSchema, permissionNames } from '../shared/catalog';
import { z } from 'zod';
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function config(guildId:string, module:string) {
  const m=byId(module); if (!m) throw new AppError(404,'Module inconnu.');
  const stored=await db.config.findUnique({where:{guildId_module:{guildId,module}}});
  const keys=new Set(m.fields.map(f=>f.key));
  return { value:{...defaults(m.fields),...Object.fromEntries(Object.entries(stored?.value as object ?? {}).filter(([key])=>keys.has(key)))},revision:stored?.revision ?? 0 };
}
export async function audit(guildId:string,actorId:string,action:string,detail:unknown={},targetId?:string) {
  return db.audit.create({data:{guildId,actorId,action,targetId,detail:json(detail)}});
}
export async function metric(guildId:string,kind:string) {
  const day=new Date().toISOString().slice(0,10);
  await db.metric.upsert({where:{guildId_day_kind:{guildId,day,kind}},create:{guildId,day,kind,count:1},update:{count:{increment:1}}});
  await publish(guildId,'statistics');
}
export async function saveConfig(guildId:string,actorId:string,module:string,input:unknown) {
  const {value,revision}=z.object({value:configSchema(module),revision:z.number().int().min(0)}).strict().parse(input);
  if (!byId(module)?.fields.length) throw new AppError(400,'Ce module n’a pas de paramètres.');
  await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guildId+':config:'+module},0))`;
    if (revision===0) {
      if (await tx.config.findUnique({where:{guildId_module:{guildId,module}}})) throw new AppError(409,'Cette configuration a changé. Rechargez la page.');
      await tx.config.create({data:{guildId,module,value:json(value)}});
    } else {
      const changed=await tx.config.updateMany({where:{guildId,module,revision},data:{value:json(value),revision:{increment:1}}});
      if (!changed.count) throw new AppError(409,'Cette configuration a changé. Rechargez la page.');
    }
    await tx.audit.create({data:{guildId,actorId,action:`config.${module}`,detail:json({value})}});
  });
  await publish(guildId,'config',{module});
  return config(guildId,module);
}
export async function createRecord(guildId:string,actorId:string,module:string,input:unknown) {
  if (!byId(module)?.recordFields) throw new AppError(400,'Création indisponible pour ce module.');
  const parsed=z.object({title:z.string().min(1).max(256),data:recordSchema(module)}).strict().parse(input);
  if (module==='polls' && String(parsed.data.options).split('\n').filter(Boolean).length<2) throw new AppError(400,'Ajoutez au moins deux choix.');
  const record=await db.$transaction(async tx=>{
    const result=await tx.entity.create({data:{guildId,module,ownerId:actorId,title:parsed.title,data:json(parsed.data),status:'active'}});
    await tx.audit.create({data:{guildId,actorId,action:`${module}.create`,targetId:result.id,detail:json({title:parsed.title})}});
    return result;
  });
  await publish(guildId,'records',{module}); return record;
}
export async function getRecord(guildId:string,id:string,module?:string) {
  const record=await db.entity.findFirst({where:{id,guildId,...(module?{module}:{})}});
  if (!record) throw new AppError(404,'Élément introuvable sur ce serveur.'); return record;
}
export async function updateRecord(guildId:string,actorId:string,id:string,input:unknown) {
  const r=await getRecord(guildId,id), parsed=z.object({title:z.string().min(1).max(256),data:recordSchema(r.module),revision:z.number().int().positive()}).strict().parse(input);
  const old=r.data as Record<string,unknown>;
  // Preserve server-owned participants, votes and decision data on form edits.
  const data={...old,...parsed.data};
  await db.$transaction(async tx=>{
    const changed=await tx.entity.updateMany({where:{id,guildId,revision:parsed.revision},data:{title:parsed.title,data:json(data),revision:{increment:1}}});
    if (!changed.count) throw new AppError(409,'Cet élément a changé. Rechargez-le.');
    await tx.audit.create({data:{guildId,actorId,action:`${r.module}.update`,targetId:id,detail:json({title:parsed.title})}});
  });
  await publish(guildId,'records'); return getRecord(guildId,id);
}
export async function deleteRecord(guildId:string,actorId:string,id:string) {
  const r=await getRecord(guildId,id);
  await db.$transaction([db.entity.delete({where:{id}}),db.audit.create({data:{guildId,actorId,action:`${r.module}.delete`,targetId:id,detail:json({title:r.title})}})]);
  await publish(guildId,'records'); return {ok:true};
}
export async function enqueue(guildId:string,actorId:string,kind:string,payload:unknown,runAt=new Date()) {
  const maintenance=await db.globalSetting.findUnique({where:{key:'maintenance'}});
  if (maintenance?.value===true) throw new AppError(503,'La plateforme est en maintenance.');
  const heartbeat=await db.globalSetting.findUnique({where:{key:'botHeartbeat'}});
  if (!heartbeat || Date.now()-Number((heartbeat.value as any).at)>60000) throw new AppError(503,'Le bot est hors ligne. L’action n’a pas été créée.');
  const job=await db.$transaction(async tx=>{
    const j=await tx.job.create({data:{guildId,actorId,kind,payload:json(payload),runAt}});
    await tx.audit.create({data:{guildId,actorId,action:`job.${kind}.queued`,targetId:j.id,detail:json(payload)}});
    return j;
  });
  await publish(guildId,'jobs'); return job;
}
export async function grant(guildId:string,actorId:string,input:unknown) {
  const data=z.object({userId:z.string().regex(/^\d{17,20}$/),permissions:z.array(z.enum(permissionNames)).max(permissionNames.length)}).strict().parse(input);
  return db.$transaction(async tx=>{
    const result=await tx.grant.upsert({where:{guildId_userId:{guildId,userId:data.userId}},create:{guildId,...data},update:{permissions:data.permissions}});
    await tx.audit.create({data:{guildId,actorId,action:'security.grant',targetId:data.userId,detail:json(data)}});
    return result;
  });
}
export async function cleanup() {
  await db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
  const guilds=await db.guild.findMany();
  for (const g of guilds) {
    const c=await config(g.id,'logs'), cutoff=new Date(Date.now()-Number(c.value.retentionDays)*86400000);
    await db.audit.deleteMany({where:{guildId:g.id,createdAt:{lt:cutoff}}});
    await db.job.deleteMany({where:{guildId:g.id,status:{in:['done','failed']},updatedAt:{lt:cutoff}}});
    await db.transaction.deleteMany({where:{guildId:g.id,createdAt:{lt:cutoff}}});
    await db.ticket.updateMany({where:{guildId:g.id,closedAt:{lt:cutoff}},data:{transcript:null,answers:{}}});
    await db.metric.deleteMany({where:{guildId:g.id,day:{lt:cutoff.toISOString().slice(0,10)}}});
  }
}
