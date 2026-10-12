import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export function productionErrors(env, hosting = 'compose') {
  const errors = [];
  const required = ['APP_URL','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','DISCORD_BOT_TOKEN','OWNER_DISCORD_ID','ENCRYPTION_KEY','DATABASE_URL','REDIS_URL',...(hosting === 'compose' ? ['DOMAIN','ACME_EMAIL','POSTGRES_PASSWORD'] : [])];
  for (const key of required) {
    if (!env[key]?.trim() || /^(CHANGE_ME|YOUR_|REPLACE_|EXAMPLE)/i.test(env[key])) errors.push(`${key} : à renseigner.`);
  }
  const domain = hosting === 'compose' ? env.DOMAIN ?? '' : '';
  if (domain && (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain) || /(^|\.)localhost$/i.test(domain))) errors.push('DOMAIN : indiquez un nom DNS public, sans https:// ni chemin.');
  if (env.APP_URL && domain && env.APP_URL.replace(/\/$/,'') !== `https://${domain}`) errors.push('APP_URL : doit correspondre à https:// suivi de DOMAIN.');
  if (env.NODE_ENV !== 'production') errors.push('NODE_ENV : doit être production pour ce contrôle.');
  if (hosting === 'compose' && env.ACME_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ACME_EMAIL)) errors.push('ACME_EMAIL : adresse e-mail invalide.');
  for (const key of ['DISCORD_CLIENT_ID','OWNER_DISCORD_ID']) if (env[key] && !/^\d{17,20}$/.test(env[key])) errors.push(`${key} : identifiant Discord invalide.`);
  if (env.ENCRYPTION_KEY && (!/^[a-f0-9]{64}$/i.test(env.ENCRYPTION_KEY) || /^0+$/.test(env.ENCRYPTION_KEY))) errors.push('ENCRYPTION_KEY : utilisez la clé aléatoire générée par setup-env.mjs.');
  if (hosting === 'compose' && env.POSTGRES_PASSWORD && !/^[a-f0-9]{32,}$/i.test(env.POSTGRES_PASSWORD)) errors.push('POSTGRES_PASSWORD : utilisez le mot de passe aléatoire généré par setup-env.mjs (hexadécimal, au moins 32 caractères).');
  if (env.APP_URL) {
    try {
      const url = new URL(env.APP_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    } catch { errors.push('APP_URL : origine HTTPS sans identifiants, chemin, paramètres ni fragment attendue.'); }
  }
  for (const [key,protocols] of [['DATABASE_URL',['postgresql:','postgres:']],['REDIS_URL',['redis:','rediss:']]]) {
    if (!env[key]) continue;
    try {
      const url = new URL(env[key]);
      if (!protocols.includes(url.protocol) || !url.hostname) throw new Error();
      if (hosting === 'cloud' && key === 'REDIS_URL' && url.protocol !== 'rediss:') errors.push('REDIS_URL : utilisez la connexion TCP chiffrée rediss:// du fournisseur externe.');
    } catch { errors.push(`${key} : URL de connexion invalide.`); }
  }
  for (const key of ['DISCORD_MEMBERS_INTENT','DISCORD_MESSAGE_CONTENT_INTENT','DISCORD_PRESENCE_INTENT']) if (env[key] && !['true','false'].includes(env[key])) errors.push(`${key} : true ou false attendu.`);
  return errors;
}

export async function checkDiscord(env, request = fetch) {
  let response;
  try {
    response = await request('https://discord.com/api/v10/oauth2/applications/@me', {headers:{Authorization:`Bot ${env.DISCORD_BOT_TOKEN}`},signal:AbortSignal.timeout(15000)});
  } catch { throw new Error('Discord est inaccessible. Vérifiez la connexion du serveur.'); }
  if (!response.ok) throw new Error(`Discord refuse le token du bot (HTTP ${response.status}).`);
  let application;
  try { application = await response.json(); } catch { throw new Error('Discord a renvoyé une réponse invalide.'); }
  if (application.id !== env.DISCORD_CLIENT_ID) throw new Error('Le token du bot et DISCORD_CLIENT_ID appartiennent à des applications différentes.');
}

/** @param {(milliseconds: number) => Promise<unknown>} pause */
export async function waitForServices(url, request = fetch, pause = sleep, attempts = 40) {
  let state = {};
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await request(url, {signal:AbortSignal.timeout(5000)});
      const data = await response.json();
      state = Object.fromEntries(['database','redis','oauth','bot'].map(key => [key,data[key] === true]));
      if (response.ok && Object.values(state).every(Boolean)) return state;
    } catch { state = {}; }
    if (attempt + 1 < attempts) await pause(2000);
  }
  const missing = ['database','redis','oauth','bot'].filter(key => !state[key]);
  throw new Error(`Services non prêts : ${missing.join(', ')}. Consultez les journaux Docker.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--wait') {
    const url = args[1] ?? 'http://127.0.0.1:3000/api/health';
    const state = await waitForServices(url);
    console.log('Services démarrés :',Object.keys(state).join(', '));
    console.log('Il reste à tester la connexion OAuth2 dans le navigateur et à inviter le bot sur votre serveur.');
    return;
  }
  if (args.some(arg => !['--discord','--cloud'].includes(arg))) throw new Error('Options disponibles : --discord, --cloud ou --wait URL.');
  const { config } = await import('dotenv');
  config({quiet:true});
  const errors = productionErrors(process.env,args.includes('--cloud') ? 'cloud' : 'compose');
  if (errors.length) throw new Error(`Configuration incomplète :\n${errors.join('\n')}`);
  console.log('Configuration de production vérifiée. Aucune valeur secrète affichée.');
  if (args.includes('--discord')) {
    await checkDiscord(process.env);
    console.log('Token du bot accepté par Discord ; application correspondante vérifiée.');
    console.log('Le secret OAuth2 et les intents seront vérifiés lors de la connexion réelle.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {console.error(error.message);process.exitCode=1;});
