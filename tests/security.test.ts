import { describe,it,expect,beforeEach,vi } from 'vitest';
import { encrypt,decrypt,hash } from '../src/lib/crypto';
import { cookie,cookieValue } from '../src/lib/auth';
import { isAdmin,effectivePermissions,botInvite } from '../src/lib/discord';
import { configSchema, recordSchema, modules } from '../src/shared/catalog';
import { publicIPv4 } from '../src/lib/safe-fetch';
import { escapeHtml } from '../src/bot/actions';
describe('Credential protection',()=>{
  beforeEach(()=>{process.env.ENCRYPTION_KEY='ab'.repeat(32);});
  it('encrypts secrets with authentication and distinct nonces',()=>{const a=encrypt('private-token'),b=encrypt('private-token');expect(a).not.toBe(b);expect(a).not.toContain('private-token');expect(decrypt(a)).toBe('private-token');expect(hash('session')).not.toContain('session');});
  it('rejects ciphertext modified by an attacker',()=>{const a=encrypt('secret').split('.');const raw=Buffer.from(a[2],'base64');raw[0]^=1;a[2]=raw.toString('base64');expect(()=>decrypt(a.join('.'))).toThrow();});
  it('uses Secure cookies in production',()=>{vi.stubEnv('NODE_ENV','production');expect(cookie('atlas_session','opaque')).toContain('HttpOnly; SameSite=Lax');expect(cookie('atlas_session','opaque')).toContain('; Secure');expect(cookieValue('another=1; atlas_session=xyz','atlas_session')).toBe('xyz');vi.unstubAllEnvs();});
});
describe('Authorization and input boundaries',()=>{
  it('does not treat Manage Guild as Administrator',()=>{expect(isAdmin('32')).toBe(false);expect(isAdmin('8')).toBe(true);expect(isAdmin('0',true)).toBe(true);});
  it('includes @everyone but excludes roles the actor does not hold',()=>{expect(effectivePermissions({roles:['staff']},[{id:'guild',permissions:'1'},{id:'staff',permissions:'32'},{id:'foreign',permissions:'8'}],'guild')).toBe(33n);});
  it('requests timeout capability without requesting Administrator',()=>{const permissions=BigInt(new URL(botInvite()).searchParams.get('permissions')!);expect(permissions & (1n<<40n)).not.toBe(0n);expect(permissions & 8n).toBe(0n);});
  it('rejects unknown config keys and malformed Discord IDs',()=>{expect(configSchema('moderation').safeParse({enabled:true,dm:true,requireReason:true,logChannelId:'',moderatorRoles:[],guildId:'foreign'}).success).toBe(false);expect(recordSchema('tickets').safeParse({description:'x',color:'#123456',channelId:'123',buttonLabel:'open'}).success).toBe(false);});
  it('never accepts scripts as automation actions',()=>{expect(recordSchema('automations').safeParse({trigger:'join',threshold:0,action:'eval',roleId:'',channelId:'',message:'',amount:0,enabled:true}).success).toBe(false);});
  it('catalog explicitly identifies external-service limitations',()=>{expect(modules.find(m=>m.id==='music')?.status).toBe('partial');expect(modules.find(m=>m.id==='music')?.limitation).toContain('YouTube peut refuser');const integrations=modules.find(m=>m.id==='integrations');expect(integrations?.status).toBe('partial');expect(integrations?.limitation).toContain('YouTube, RSS et webhooks restent à développer');});
});
describe('Untrusted content',()=>{
  it('blocks internal HTTP destinations including metadata and IPv6',()=>{for(const ip of ['127.0.0.1','169.254.169.254','10.0.0.1','172.16.4.5','192.168.1.1','100.64.1.1','::1','0.0.0.0'])expect(publicIPv4(ip)).toBe(false);expect(publicIPv4('8.8.8.8')).toBe(true);});
  it('renders transcript content as text rather than active HTML',()=>{expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');});
});
