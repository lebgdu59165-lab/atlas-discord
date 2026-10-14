import {describe,it,expect} from 'vitest';
import {calculate,rollDice,positiveAmount,decodeBase64} from '../src/lib/command-tools';
import {prefixArguments} from '../src/bot/prefix';
import {builtinCommands,commandsForSync} from '../src/shared/commands';
import {youtubeId} from '../src/bot/music';
describe('Input validation for all native commands',()=>{
 it.each([['2+3*4',14],['(2+3)*4',20],['2^3^2',512],['-2^2',-4],['10%3',1],['1e2/4',25]])('calculates %s without evaluating JavaScript',(s,result)=>expect(calculate(s)).toBe(result));
 it.each(['process.exit()','globalThis','1/0','1;2','(1','1 2','2^^3','9^9999'])('rejects invalid or executable expressions: %s',s=>expect(()=>calculate(s)).toThrow());
 it('bounds dice rolls and monetary amounts',()=>{const r=rollDice('20d6');expect(r.rolls).toHaveLength(20);expect(r.rolls.every(n=>n>=1&&n<=6)).toBe(true);for(const v of ['0d6','21d6','1d1','1d99999999'])expect(()=>rollDice(v)).toThrow();expect(positiveAmount('all',123)).toBe(123);for(const v of ['-1','1.5','Infinity','1e10'])expect(()=>positiveAmount(v,100)).toThrow();});
 it('requires valid UTF-8 Base64 and preserves Unicode',()=>{expect(decodeBase64(Buffer.from('été 🎵').toString('base64'))).toBe('été 🎵');for(const v of ['a===','!!!','/w=='])expect(()=>decodeBase64(v)).toThrow();});
 it('preserves large Discord IDs and quoted prefix arguments',()=>{const unban=builtinCommands.find(c=>c.name==='unban')!;expect(unban.options[0].type).toBe(3);expect(prefixArguments('1395698900215795732 "Motif avec espaces"',unban)).toEqual({user_id:'1395698900215795732',raison:'Motif avec espaces'});expect(()=>prefixArguments('1000',builtinCommands.find(c=>c.name==='clear')!)).toThrow();});
 it('rejects non-YouTube music URLs and private addresses',()=>{expect(youtubeId('https://youtu.be/jNQXAC9IVRw')).toBe('jNQXAC9IVRw');for(const u of ['https://localhost/a','http://youtube.com/watch?v=jNQXAC9IVRw','https://youtube.com.evil.test/watch?v=jNQXAC9IVRw'])expect(()=>youtubeId(u)).toThrow();});
 it('omits disabled native commands when registering and does not leak UI category metadata',()=>{const defs=commandsForSync([],['play']);expect(defs.some(d=>d.name==='play')).toBe(false);expect(defs.every(d=>!('category'in d))).toBe(true);});
});
