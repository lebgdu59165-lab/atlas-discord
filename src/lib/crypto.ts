import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
export const nonce = () => randomBytes(32).toString('hex');
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function key() {
  const value = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('ENCRYPTION_KEY must be 32 random bytes in hexadecimal');
  return Buffer.from(value, 'hex');
}
export function encrypt(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split('.').map(s => Buffer.from(s, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
