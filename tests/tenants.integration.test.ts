import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
// Discord network boundaries are controlled here; PostgreSQL is real and isolated.
const discordMock=vi.hoisted(()=>vi.fn());
vi.mock('../src/lib/discord',async original=>({...await original<any>(),discord:discordMock}));
vi.mock('../src/lib/redis',()=>({publish:vi.fn(),rateLimit:vi.fn()}));
import {db} from '../src/lib/db';
import {authorize,requireOwner,authenticate} from '../src/lib/auth';
import {hash} from '../src/lib/crypto';
import {config,saveConfig,createRecord,getRecord,updateRecord,deleteRecord} from '../src/services/store';
import {economy,participate,decision} from '../src/services/community';
import {defaults,byId} from '../src/shared/catalog';
import {DELETE as apiDelete} from '../src/app/api/[...path]/route';
const A='111111111111111111',B='222222222222222222',USER='333333333333333333',OTHER='444444444444444444';
beforeAll(async()=>{
  if(!process.env.DATABASE_URL?.includes('atlas_test'))throw new Error('Use an isolated DATABASE_URL containing atlas_test. Never use a production database.');
  await db.guild.deleteMany({where:{id:{in:[A,B]}}});
  await db.guild.createMany({data:[{id:A,name:'Tenant A',ownerId:USER},{id:B,name:'Tenant B',ownerId:OTHER}]});
  await db.user.upsert({where:{id:USER},create:{id:USER,name:'Test',token:'unused',refreshToken:'unused',tokenExpiresAt:new Date()},update:{}});
  await db.session.upsert({where:{id:hash('integration-session')},create:{id:hash('integration-session'),userId:USER,csrf:'integration-csrf',expiresAt:new Date(Date.now()+60000)},update:{expiresAt:new Date(Date.now()+60000)}});
});
afterAll(async()=>{await db.guild.deleteMany({where:{id:{in:[A,B]}}});await db.user.deleteMany({where:{id:USER}});await db.$disconnect();});
beforeEach(()=>{
  discordMock.mockImplementation(async(path:string)=>path.endsWith('/roles')?[{id:A,permissions:'0'},{id:B,permissions:'0'},{id:'staff',permissions:'8'}]:{roles:[]});
});
describe('Tenant isolation and revocation',()=>{
  it('rejects missing sessions, cross-origin writes and forged CSRF',async()=>{
    process.env.APP_URL='http://localhost:3000';
    await expect(authenticate(new Request('http://localhost:3000/api/me'))).rejects.toMatchObject({status:401});
    const headers={cookie:'atlas_session=integration-session','x-csrf-token':'integration-csrf',origin:'https://evil.example'};
    await expect(authenticate(new Request('http://localhost:3000/api/guilds',{method:'POST',headers}))).rejects.toMatchObject({status:403});
    await expect(authenticate(new Request('http://localhost:3000/api/guilds',{method:'POST',headers:{...headers,origin:'http://localhost:3000','x-csrf-token':'forged'}}))).rejects.toMatchObject({status:403});
    expect((await authenticate(new Request('http://localhost:3000/api/guilds',{method:'POST',headers:{...headers,origin:'http://localhost:3000'}}))).userId).toBe(USER);
  });
  it('owner of one server cannot read another without permission',async()=>{expect((await authorize(A,USER,'config')).admin).toBe(true);await expect(authorize(B,USER,'config')).rejects.toMatchObject({status:403});});
  it('global owner never bypasses Discord guild authorization',async()=>{process.env.OWNER_DISCORD_ID=USER;expect(()=>requireOwner(USER)).not.toThrow();await expect(authorize(B,USER,'config')).rejects.toMatchObject({status:403});});
  it('delegated permissions apply only to their guild and requested operation',async()=>{await db.grant.upsert({where:{guildId_userId:{guildId:A,userId:OTHER}},create:{guildId:A,userId:OTHER,permissions:['tickets']},update:{permissions:['tickets']}});expect((await authorize(A,OTHER,'tickets')).permissions).toEqual(['tickets']);await expect(authorize(A,OTHER,'economy')).rejects.toMatchObject({status:403});await db.grant.delete({where:{guildId_userId:{guildId:A,userId:OTHER}}});await expect(authorize(A,OTHER,'tickets')).rejects.toMatchObject({status:403});});
  it('a grant cannot authorize a user who left Discord',async()=>{await db.grant.create({data:{guildId:A,userId:OTHER,permissions:['config']}});discordMock.mockImplementation(async()=>{throw new Error('Not a guild member');});await expect(authorize(A,OTHER,'config')).rejects.toThrow();await db.grant.delete({where:{guildId_userId:{guildId:A,userId:OTHER}}});});
  it('blocks record reads, edits and deletes across guilds',async()=>{const r=await createRecord(A,USER,'shop',{title:'Private item',data:{description:'tenant A',price:10,roleId:''}});await expect(getRecord(B,r.id)).rejects.toMatchObject({status:404});await expect(updateRecord(B,USER,r.id,{title:'stolen',data:{description:'',price:1,roleId:''},revision:1})).rejects.toMatchObject({status:404});await expect(deleteRecord(B,USER,r.id)).rejects.toMatchObject({status:404});expect((await getRecord(A,r.id)).title).toBe('Private item');});
  it('rejects stale configurations without corrupting another tenant',async()=>{const values=defaults(byId('welcome')!.fields);await saveConfig(A,USER,'welcome',{revision:0,value:{...values,enabled:true,message:'Private A'}});await expect(saveConfig(A,USER,'welcome',{revision:0,value:values})).rejects.toMatchObject({status:409});expect((await config(B,'welcome')).value.message).not.toBe('Private A');expect(await db.audit.count({where:{guildId:A,action:'config.welcome'}})).toBe(1);});
});
describe('Transactional economy and community',()=>{
  beforeAll(async()=>{await saveConfig(A,USER,'economy',{revision:0,value:{...defaults(byId('economy')!.fields),enabled:true}});});
  it('serializes simultaneous spending and cannot produce a negative wallet',async()=>{
    await economy(A,USER,{action:'adjust',amount:100,userId:USER,reason:'test'},true);
    const results=await Promise.allSettled([economy(A,USER,{action:'transfer',amount:80,userId:OTHER}),economy(A,USER,{action:'transfer',amount:80,userId:OTHER})]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect((await db.account.findUniqueOrThrow({where:{guildId_userId:{guildId:A,userId:USER}}})).wallet).toBe(20);
    expect((await db.account.findUniqueOrThrow({where:{guildId_userId:{guildId:A,userId:OTHER}}})).wallet).toBe(80);
    expect(await db.account.count({where:{guildId:B}})).toBe(0);
  });
  it('prevents duplicate daily claims under concurrency',async()=>{const results=await Promise.allSettled([economy(A,OTHER,{action:'daily'}),economy(A,OTHER,{action:'daily'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);});
  it('rolls back an unaffordable purchase and does not change inventory',async()=>{const r=await createRecord(A,USER,'shop',{title:'Expensive',data:{description:'',price:100000,roleId:''}});await expect(economy(A,USER,{action:'buy',itemId:r.id})).rejects.toMatchObject({status:409});const a=await db.account.findUniqueOrThrow({where:{guildId_userId:{guildId:A,userId:USER}}});expect(a.wallet).toBe(20);expect(a.inventory).toEqual([]);});
  it('never exceeds event capacity during simultaneous registrations',async()=>{const event=await createRecord(A,USER,'events',{title:'One place',data:{description:'',startsAt:'2030-01-01T12:00:00Z',capacity:1,channelId:''}});await Promise.all([participate(A,USER,event.id,{action:'join'}),participate(A,OTHER,event.id,{action:'join'})]);const d=(await getRecord(A,event.id)).data as any;expect(d.participants).toHaveLength(1);expect(d.waitlist).toHaveLength(1);await expect(participate(A,USER,event.id,{action:'join'})).rejects.toMatchObject({status:409});});
  it('stores one vote per user and rejects voting after closure',async()=>{const poll=await createRecord(A,USER,'polls',{title:'Vote',data:{options:'A\nB',endsAt:''}});await participate(A,USER,poll.id,{action:'vote',choice:0});await participate(A,USER,poll.id,{action:'vote',choice:1});expect((await getRecord(A,poll.id)).data).toMatchObject({votes:{[USER]:1}});await decision(A,OTHER,poll.id,{status:'closed'});await expect(participate(A,USER,poll.id,{action:'vote',choice:0})).rejects.toMatchObject({status:409});});
  it('retains votes when an administrator edits the poll',async()=>{const poll=await createRecord(A,USER,'polls',{title:'Edit',data:{options:'A\nB',endsAt:''}});await participate(A,USER,poll.id,{action:'vote',choice:0});const current=await getRecord(A,poll.id);await updateRecord(A,USER,poll.id,{title:'New title',data:{options:'A\nB',endsAt:''},revision:current.revision});expect((await getRecord(A,poll.id)).data).toMatchObject({votes:{[USER]:0}});});
  it('refuses data erasure during an action and preserves the other tenant',async()=>{
    const b=await createRecord(B,OTHER,'shop',{title:'Keep B',data:{description:'',price:10,roleId:''}});
    const running=await db.job.create({data:{guildId:A,actorId:USER,kind:'test',payload:{},status:'running'}});
    const call=()=>apiDelete(new Request(`http://localhost:3000/api/guilds/${A}/data`,{method:'DELETE',headers:{cookie:'atlas_session=integration-session',origin:'http://localhost:3000','x-csrf-token':'integration-csrf','content-type':'application/json'},body:JSON.stringify({confirmation:'SUPPRIMER'})}),{params:Promise.resolve({path:['guilds',A,'data']})});
    expect((await call()).status).toBe(409);
    expect(await db.account.count({where:{guildId:A}})).toBeGreaterThan(0);
    await db.job.delete({where:{id:running.id}});
    expect((await call()).status).toBe(200);
    expect(await db.account.count({where:{guildId:A}})).toBe(0);
    expect((await getRecord(B,b.id)).title).toBe('Keep B');
  });
});
