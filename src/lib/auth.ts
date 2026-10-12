import { db } from './db';
import { decrypt, encrypt, hash, nonce } from './crypto';
import { discord, effectivePermissions, isAdmin, type DiscordGuild } from './discord';
import { AppError } from './errors';
import { permissionNames, type Permission } from '../shared/catalog';
import { rateLimit } from './redis';
export function cookieValue(header: string | null, name: string) { return header?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1); }
export function cookie(name: string, value: string, maxAge = 604800) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
export async function sessionFromCookie(header: string | null) {
  const raw = cookieValue(header,'atlas_session');
  if (!raw) throw new AppError(401,'Connectez-vous avec Discord.');
  const session = await db.session.findUnique({where:{id:hash(raw)},include:{user:true}});
  if (!session || session.expiresAt < new Date()) throw new AppError(401,'Votre session a expiré.');
  return session;
}
export async function authenticate(req: Request) {
  const s = await sessionFromCookie(req.headers.get('cookie'));
  await rateLimit(`user:${s.userId}`);
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    if (req.headers.get('origin') !== new URL(process.env.APP_URL ?? 'http://localhost:3000').origin || req.headers.get('x-csrf-token') !== s.csrf) throw new AppError(403,'Vérification de sécurité du formulaire échouée.');
  }
  return s;
}
export async function accessToken(userId: string) {
  const user = await db.user.findUniqueOrThrow({where:{id:userId}});
  if (user.tokenExpiresAt.getTime() > Date.now()+60000) return decrypt(user.token);
  const response = await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:decrypt(user.refreshToken),client_id:process.env.DISCORD_CLIENT_ID!,client_secret:process.env.DISCORD_CLIENT_SECRET!}),signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new AppError(401,'Autorisation Discord expirée. Reconnectez-vous.');
  const t = await response.json();
  await db.user.update({where:{id:userId},data:{token:encrypt(t.access_token),refreshToken:encrypt(t.refresh_token),tokenExpiresAt:new Date(Date.now()+t.expires_in*1000)}});
  return t.access_token as string;
}
export async function userGuilds(userId: string) { return discord<DiscordGuild[]>('/users/@me/guilds',{},await accessToken(userId)); }
export async function authorize(guildId: string, userId: string, permission?: Permission) {
  const guild = await db.guild.findUnique({where:{id:guildId}});
  if (!guild?.installed) throw new AppError(404,'Le bot n’est pas installé sur ce serveur.');
  const [member, roles] = await Promise.all([discord<{roles:string[]}>(`/guilds/${guildId}/members/${userId}`),discord<{id:string;permissions:string}[]>(`/guilds/${guildId}/roles`)]);
  const admin = isAdmin(effectivePermissions(member,roles,guildId).toString(),guild.ownerId===userId);
  const grant = await db.grant.findUnique({where:{guildId_userId:{guildId,userId}}});
  const moderation=await db.config.findUnique({where:{guildId_module:{guildId,module:'moderation'}}});
  const moderatorRoles=(moderation?.value as any)?.moderatorRoles ?? [];
  const roleModerator=member.roles.some(r=>moderatorRoles.includes(r));
  const delegated=[...new Set([...(grant?.permissions ?? []),...(roleModerator?['moderation']:[])])];
  if (!admin && (!delegated.length || (permission && !delegated.includes(permission)))) throw new AppError(403,'Vous ne disposez pas de cette permission sur ce serveur.');
  return { guild, admin, permissions:admin ? [...permissionNames] : delegated };
}
export async function newSession(userId: string) {
  const raw=nonce(), csrf=nonce();
  await db.session.create({data:{id:hash(raw),userId,csrf,expiresAt:new Date(Date.now()+604800000)}});
  return {raw,csrf};
}
export function requireOwner(userId:string) { if (!process.env.OWNER_DISCORD_ID || userId!==process.env.OWNER_DISCORD_ID) throw new AppError(403,'Espace réservé au propriétaire du bot.'); }
