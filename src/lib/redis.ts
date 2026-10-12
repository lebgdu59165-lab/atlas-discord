import Redis from 'ioredis';
import { AppError } from './errors';
let instance: Redis | undefined;
export function redis() {
  if (!process.env.REDIS_URL) throw new AppError(503, 'Redis n’est pas configuré.');
  if (!instance) {
    instance = new Redis(process.env.REDIS_URL, { family: 0, lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2000, retryStrategy: attempt => Math.min(attempt * 500, 15000) });
    instance.on('error', () => {});
  }
  return instance;
}
export async function rateLimit(key: string, limit = 60, seconds = 60) {
  const n = Number(await redis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, `rate:${key}`, seconds));
  if (n > limit) throw new AppError(429, 'Trop de requêtes. Réessayez dans une minute.');
}
export async function publish(guildId: string, event: string, payload: unknown = {}) {
  try { await redis().publish('atlas:events', JSON.stringify({ guildId, event, payload })); }
  catch { /* Database is authoritative; clients also refresh periodically. */ }
}
