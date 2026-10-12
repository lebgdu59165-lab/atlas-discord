import { AppError } from './errors';
const BASE = 'https://discord.com/api/v10';
export async function discord<T = any>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const auth = token ? `Bearer ${token}` : `Bot ${process.env.DISCORD_BOT_TOKEN ?? ''}`;
  if (!token && !process.env.DISCORD_BOT_TOKEN) throw new AppError(503,'Le token du bot Discord est absent.');
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { Authorization: auth, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(10000), cache:'no-store' });
  if (!response.ok) {
    if (response.status === 429) throw new AppError(429,'Discord limite les requêtes. Réessayez plus tard.');
    if ([401,403,404].includes(response.status)) throw new AppError(403,'Discord refuse cet accès : vérifiez l’appartenance, les permissions et la hiérarchie des rôles.');
    throw new AppError(502,`Discord est indisponible (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const botInvite = (guildId = '') => `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID ?? ''}&scope=bot%20applications.commands&permissions=1099780189206&guild_id=${guildId}`;
export type DiscordGuild = { id:string; name:string; icon:string|null; owner:boolean; permissions:string };
export function isAdmin(permissions: string, owner = false) {
  return owner || (BigInt(permissions) & 8n) !== 0n;
}
export function effectivePermissions(member: { roles:string[] }, roles: { id:string; permissions:string }[], guildId: string) {
  return roles.filter(r=>r.id===guildId || member.roles.includes(r.id)).reduce((p,r)=>p | BigInt(r.permissions),0n);
}
