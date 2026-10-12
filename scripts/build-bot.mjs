import { build } from 'esbuild';

await build({
  entryPoints:['src/bot/index.ts'],
  outfile:'bot-build/index.mjs',
  bundle:true,
  platform:'node',
  format:'esm',
  target:'node22',
  external:['@prisma/client','dotenv','dotenv/*'],
  banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"},
  legalComments:'linked',
});
console.log('Bot compilé séparément du site.');
