import { describe,it,expect,vi } from 'vitest';
import { productionErrors,checkDiscord,waitForServices } from '../scripts/check-production.mjs';

const valid = {DOMAIN:'atlas.example.org',ACME_EMAIL:'owner@example.org',APP_URL:'https://atlas.example.org',NODE_ENV:'production',DISCORD_CLIENT_ID:'123456789012345678',DISCORD_CLIENT_SECRET:'private-oauth-secret',DISCORD_BOT_TOKEN:'private-bot-token',OWNER_DISCORD_ID:'987654321098765432',ENCRYPTION_KEY:'ab'.repeat(32),POSTGRES_PASSWORD:'cd'.repeat(24),DATABASE_URL:'postgresql://atlas:test-password@localhost:5432/atlas',REDIS_URL:'redis://localhost:6379'};
describe('production deployment gates',() => {
  it('accepts managed databases without requiring Caddy or a local database password',() => {
    const managed = {...valid,DOMAIN:'',ACME_EMAIL:'',POSTGRES_PASSWORD:'',REDIS_URL:'rediss://default:test-password@cache.example.org:6379'};
    expect(productionErrors(managed,'cloud')).toEqual([]);
    const errors = productionErrors({...managed,REDIS_URL:'redis://cache.example.org:6379',DATABASE_URL:'invalid-secret-connection'},'cloud').join(' ');
    expect(errors).toContain('chiffrée');
    expect(errors).toContain('DATABASE_URL');
    expect(errors).not.toContain('invalid-secret-connection');
  });
  it('rejects missing credentials and mismatched production origin without leaking values',() => {
    const errors = productionErrors({...valid,DISCORD_CLIENT_ID:'',APP_URL:'https://wrong.example.org',POSTGRES_PASSWORD:'secret-value-never-log'}).join(' ');
    expect(errors).toContain('DISCORD_CLIENT_ID');
    expect(errors).toContain('APP_URL');
    expect(errors).not.toContain('secret-value-never-log');
    expect(productionErrors(valid)).toEqual([]);
  });
  it('rejects a bot token from another Discord application',async () => {
    const request = vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'987654321098765432'})});
    await expect(checkDiscord(valid,request)).rejects.toThrow('applications différentes');
    expect(request).toHaveBeenCalledOnce();
  });
  it('does not announce readiness when HTTP succeeds but the bot is disconnected',async () => {
    const request = vi.fn().mockResolvedValue({ok:true,json:async()=>({database:true,redis:true,oauth:true,bot:false})});
    await expect(waitForServices('http://localhost/api/health',request,async()=>{},2)).rejects.toThrow('bot');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('waits for the real heartbeat before declaring services started',async () => {
    const request = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({database:true,redis:true,oauth:true,bot:false})}).mockResolvedValueOnce({ok:true,json:async()=>({database:true,redis:true,oauth:true,bot:true})});
    await expect(waitForServices('http://localhost/api/health',request,async()=>{},2)).resolves.toEqual({database:true,redis:true,oauth:true,bot:true});
  });
});
