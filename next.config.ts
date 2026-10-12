import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['@prisma/client', 'ioredis', 'discord.js'],
  async headers() { return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV==='development'?"'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://discord.com` }
  ] }]; }
};
export default config;
