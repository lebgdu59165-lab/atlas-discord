import {describe,it,expect,vi,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
import {ChannelType} from 'discord.js';
const mocks=vi.hoisted(()=>({config:vi.fn(async()=>({value:{enabled:true,defaultVolume:50,maxQueue:50,idleSeconds:120}})),store:vi.fn(),download:vi.fn(),connect:vi.fn()}));
vi.mock('../src/services/store',()=>({config:mocks.config,json:(v:unknown)=>v}));
vi.mock('../src/lib/db',()=>({db:{entity:{upsert:mocks.store}}}));
vi.mock('../src/lib/redis',()=>({publish:vi.fn()}));
vi.mock('youtubei.js',()=>({Platform:{shim:{}},Innertube:{create:async()=>({search:async(q:string)=>({videos:[{id:q==='second'?'bbbbbbbbbbb':'aaaaaaaaaaa'}]}),getBasicInfo:async(id:string)=>({playability_status:{status:'OK'},basic_info:{title:id}}),download:mocks.download})}}));
vi.mock('node:child_process',async()=>{const {PassThrough}=await import('node:stream'),{EventEmitter}=await import('node:events');return {spawn:()=>{const p:any=new EventEmitter();p.stdin=new PassThrough();p.stdout=new PassThrough();p.kill=()=>{p.stdin.destroy();p.stdout.destroy();return true;};return p;}};});
vi.mock('@discordjs/voice',async()=>{const {EventEmitter}=await import('node:events');return {
 VoiceConnectionStatus:{Ready:'ready',Disconnected:'disconnected',Connecting:'connecting',Signalling:'signalling'},AudioPlayerStatus:{Idle:'idle',Playing:'playing'},NoSubscriberBehavior:{Pause:'pause'},StreamType:{Raw:'raw'},
 joinVoiceChannel:()=>{mocks.connect();const c:any=new EventEmitter();c.state={status:'ready'};c.subscribe=vi.fn();c.destroy=()=>{c.state={status:'destroyed'};};return c;},entersState:async(c:any)=>c,
 createAudioPlayer:()=>{const p:any=new EventEmitter();p.state={status:'idle'};p.play=()=>{p.state={status:'playing'};};p.pause=()=>{const ok=p.state.status==='playing';if(ok)p.state={status:'paused'};return ok;};p.unpause=()=>{const ok=p.state.status==='paused';if(ok)p.state={status:'playing'};return ok;};p.stop=()=>{p.state={status:'idle'};p.emit('idle');return true;};return p;},createAudioResource:()=>({volume:{setVolume:vi.fn()}})
 };});
import {musicAction,findTrack,discordAudioUrl} from '../src/bot/music';
const G='933333333333333333',U='944444444444444444';
let voiceId='955555555555555555';
const channel={id:voiceId,type:ChannelType.GuildVoice,permissionsFor:()=>({has:()=>true})};
const guild:any={id:G,client:{user:{id:'bot'}},voiceAdapterCreator:{},members:{fetch:async()=>({voice:{channelId:voiceId,channel}}),fetchMe:async()=>({id:'bot'})}};
mocks.download.mockImplementation(async()=>new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3,4]));c.close();}}));
afterEach(async()=>{voiceId=channel.id;try{await musicAction(guild,U,'stop');}catch{}vi.unstubAllGlobals();mocks.config.mockResolvedValue({value:{enabled:true,defaultVolume:50,maxQueue:50,idleSeconds:120}});});
const latest=()=>mocks.store.mock.calls.at(-1)![0].update.data;
describe('Music queue and voice controls',()=>{
 it('accepts audio attachments without requiring YouTube and rejects unsafe attachment URLs',async()=>{
  const link='https://cdn.discordapp.com/attachments/933333333333333333/944444444444444444/musique.mp3?ex=abc';
  expect(await findTrack(link,U)).toMatchObject({title:'musique.mp3',url:link});
  expect(discordAudioUrl('https://localhost/test.mp3')).toBeNull();
  expect(()=>discordAudioUrl(link.replace('https:','http:'))).toThrow();
  expect(()=>discordAudioUrl(link.replace('musique.mp3','script.js'))).toThrow();
  expect(()=>discordAudioUrl(link.replace('cdn.discordapp.com','user:password@cdn.discordapp.com'))).toThrow();
 });
 it('streams Discord audio through the same player without following redirects or calling YouTube',async()=>{
  const request=vi.fn(async()=>new Response(new Uint8Array([1,2,3,4])));vi.stubGlobal('fetch',request);const before=mocks.download.mock.calls.length;
  await musicAction(guild,U,'play',undefined,'https://cdn.discordapp.com/attachments/933333333333333333/944444444444444444/musique.mp3');
  expect(request).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:'error'}));expect(mocks.download.mock.calls.length).toBe(before);expect(latest().current.title).toBe('musique.mp3');await musicAction(guild,U,'pause');expect(latest().paused).toBe(true);
 });
 it('joins one voice session, plays audio with the working client and supports the queue controls',async()=>{
  await musicAction(guild,U,'join');expect(mocks.connect).toHaveBeenCalledOnce();await musicAction(guild,U,'play',undefined,'first');expect(mocks.download).toHaveBeenCalledWith('aaaaaaaaaaa',expect.objectContaining({client:'ANDROID_VR',type:'audio'}));
  await musicAction(guild,U,'play',undefined,'second');expect(await musicAction(guild,U,'queue')).toContain('bbbbbbbbbbb');expect(await musicAction(guild,U,'nowplaying')).toContain('aaaaaaaaaaa');
  await musicAction(guild,U,'pause');expect(latest().paused).toBe(true);await musicAction(guild,U,'resume');expect(latest().paused).toBe(false);await musicAction(guild,U,'volume',25);expect(latest().volume).toBe(25);
  await musicAction(guild,U,'loop');expect(latest().loop).toBe(true);await musicAction(guild,U,'shuffle');expect(latest().queue).toHaveLength(1);await musicAction(guild,U,'remove',1);expect(latest().queue).toHaveLength(0);
  await musicAction(guild,U,'stop');expect(latest()).toMatchObject({connected:false,current:null,queue:[]});
 });
 it('refuses control from another voice channel or values outside the current queue',async()=>{
  await musicAction(guild,U,'join');voiceId='966666666666666666';await expect(musicAction(guild,U,'stop')).rejects.toMatchObject({status:403});voiceId=channel.id;
  await expect(musicAction(guild,U,'remove',1)).rejects.toMatchObject({status:400});await expect(musicAction(guild,U,'volume',101)).rejects.toMatchObject({status:400});
 });
 it('serializes simultaneous join requests rather than creating duplicate connections',async()=>{const before=mocks.connect.mock.calls.length;await Promise.all([musicAction(guild,U,'join'),musicAction(guild,U,'join')]);expect(mocks.connect.mock.calls.length-before).toBe(1);});
 it('honors the server music switch',async()=>{mocks.config.mockResolvedValueOnce({value:{enabled:false,defaultVolume:50,maxQueue:50,idleSeconds:120}});await expect(musicAction(guild,U,'join')).rejects.toMatchObject({status:409});});
 it('skip advances to the next track even when repetition was enabled',async()=>{await musicAction(guild,U,'play',undefined,'first');await musicAction(guild,U,'play',undefined,'second');await musicAction(guild,U,'loop');await musicAction(guild,U,'skip');await vi.waitFor(()=>expect(latest()).toMatchObject({loop:false,current:{id:'bbbbbbbbbbb'}}));});
});
