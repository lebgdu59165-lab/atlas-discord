import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
const mocks=vi.hoisted(()=>({spawn:vi.fn(),install:vi.fn(async()=>'/verified/media')}));
vi.mock('node:child_process',()=>({spawn:mocks.spawn}));
vi.mock('../scripts/media-runtime.mjs',async()=>({...await vi.importActual('../scripts/media-runtime.mjs'),ensureMediaRuntime:mocks.install}));
import {youtubeAudioStream} from '../src/bot/youtube-stream';
import {mediaRuntimeArgs,mediaRuntimeEnv} from '../scripts/media-runtime.mjs';
let child:any;
beforeEach(()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=vi.fn();mocks.spawn.mockReturnValue(child);});
afterEach(()=>{child.stdout.destroy();child.stderr.destroy();vi.useRealTimers();});
describe('YouTube source process',()=>{
 it('uses only a validated video id and disables configuration, cookies and extra plugins',()=>{const args=mediaRuntimeArgs('aqz-KE-bpKQ');expect(args).toContain('--ignore-config');expect(args).toContain('--no-plugin-dirs');expect(args).toContain('--no-remote-components');expect(args).toContain('--no-playlist');expect(args.at(-1)).toBe('https://www.youtube.com/watch?v=aqz-KE-bpKQ');expect(()=>mediaRuntimeArgs('--exec attack')).toThrow();});
 it('keeps Discord and database credentials out of the media subprocess environment',()=>{const old=process.env.DISCORD_BOT_TOKEN;process.env.DISCORD_BOT_TOKEN='test-private-value';try{expect(mediaRuntimeEnv()).not.toHaveProperty('DISCORD_BOT_TOKEN');expect(Object.keys(mediaRuntimeEnv())).not.toContain('DATABASE_URL');}finally{if(old===undefined)delete process.env.DISCORD_BOT_TOKEN;else process.env.DISCORD_BOT_TOKEN=old;}});
 it('waits for actual audio, keeps the first bytes, and terminates downloads when stopped',async()=>{const pending=youtubeAudioStream('aqz-KE-bpKQ');await vi.waitFor(()=>expect(mocks.spawn).toHaveBeenCalled());child.stdout.write(Buffer.from([1,2,3]));const stream=await pending,reader=stream.getReader();expect((await reader.read()).value).toEqual(new Uint8Array([1,2,3]));child.stdout.write(Buffer.from([4,5]));expect((await reader.read()).value).toEqual(new Uint8Array([4,5]));await reader.cancel();expect(child.kill).toHaveBeenCalled();expect(mocks.spawn.mock.calls.at(-1)![2].env).not.toHaveProperty('DISCORD_BOT_TOKEN');});
 it('reports a source refusal before announcing playback and hides raw source messages',async()=>{const pending=youtubeAudioStream('aqz-KE-bpKQ');const rejection=expect(pending).rejects.toMatchObject({status:502,message:expect.stringContaining('privée')});await vi.waitFor(()=>expect(mocks.spawn).toHaveBeenCalled());child.stderr.write('ERROR private video https://example.com/private-token');child.emit('exit',1);await rejection;});
 it('bounds startup time without imposing a duration limit on a playing track',async()=>{vi.useFakeTimers();const pending=youtubeAudioStream('aqz-KE-bpKQ');const rejection=expect(pending).rejects.toMatchObject({status:504});await vi.advanceTimersByTimeAsync(45001);await rejection;expect(child.kill).toHaveBeenCalled();});
});
