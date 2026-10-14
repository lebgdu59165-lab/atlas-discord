import {describe,it,expect,vi,afterEach} from 'vitest';
import {databaseOptions} from '../src/lib/database-options';
import {interactionErrorMessage} from '../src/bot/presentation';
import {AppError} from '../src/lib/errors';
import {request,ApiError} from '../src/components/api';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('Database connection budget',()=>{
 it('bounds the pool while preserving managed certificate validation',()=>{const options=databaseOptions('postgresql://user:password@database.example:5432/atlas?sslmode=require&sslaccept=strict&sslcert=%2Fhome%2Fcontainer%2Fcerts%2Faiven-ca.pem');const url=new URL(options.datasourceUrl!);expect(url.searchParams.get('connection_limit')).toBe('4');expect(url.searchParams.get('pool_timeout')).toBe('10');expect(url.searchParams.get('sslmode')).toBe('require');expect(url.searchParams.get('sslaccept')).toBe('strict');expect(url.searchParams.get('sslcert')).toBe('/home/container/certs/aiven-ca.pem');});
 it('keeps explicitly configured pool settings',()=>{const url=new URL(databaseOptions('postgresql://localhost/atlas?connection_limit=2&pool_timeout=15').datasourceUrl!);expect(url.searchParams.get('connection_limit')).toBe('2');expect(url.searchParams.get('pool_timeout')).toBe('15');});
 it('never includes credentials in configuration errors',()=>{expect(()=>databaseOptions('secret-invalid-value')).toThrow('mal configurée');expect(()=>databaseOptions('secret-invalid-value')).not.toThrow('secret-invalid-value');});
});
describe('Useful, safe errors',()=>{
 it('keeps specific business errors and distinguishes database from Discord permission failures',()=>{expect(interactionErrorMessage(new AppError(409,'Commande désactivée.'))).toBe('Commande désactivée.');expect(interactionErrorMessage({code:'P2024'})).toContain('données');expect(interactionErrorMessage({code:50013})).toContain('position');expect(interactionErrorMessage({code:10008})).toContain('plus disponible');});
 it('does not expose raw internal messages',()=>{expect(interactionErrorMessage(new Error('postgresql://user:secret@host'))).not.toContain('secret');});
});
describe('Dashboard requests',()=>{
 it('explains cold starts when the provider responds with HTML',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>Starting</html>',{status:503})));await expect(request('me')).rejects.toMatchObject({status:503,message:expect.stringContaining('démarrage')});});
 it('preserves API permission errors',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'Permission requise : tickets.'},{status:403})));await expect(request('guilds/1/tickets')).rejects.toMatchObject({status:403,message:'Permission requise : tickets.'});});
 it('never retries a failed mutation that may already have executed',async()=>{const fetchMock=vi.fn().mockRejectedValue(new TypeError('Network failed'));vi.stubGlobal('fetch',fetchMock);await expect(request('guilds/1/tickets','csrf','POST',{action:'close'})).rejects.toBeInstanceOf(ApiError);expect(fetchMock).toHaveBeenCalledTimes(1);});
 it('warns to check an action before repeating it after a timeout',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));const pending=expect(request('guilds/1/tickets','csrf','POST',{})).rejects.toMatchObject({status:504,message:expect.stringContaining('suivi des actions')});await vi.advanceTimersByTimeAsync(30000);await pending;});
});
