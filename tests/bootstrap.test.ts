import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prismaClientReady} from '../scripts/prisma-ready.mjs';
describe('Generated Prisma client reuse',()=>{
  it('requires a matching schema and a native engine for the current platform',async()=>{
    const root=await mkdtemp(join(tmpdir(),'atlas-bootstrap-'));
    try{
      await mkdir(join(root,'prisma'),{recursive:true});await mkdir(join(root,'node_modules/.prisma/client'),{recursive:true});
      const generated=join(root,'node_modules/.prisma/client');
      await writeFile(join(root,'prisma/schema.prisma'),'model Example {\r\n id String @id\r\n}\r\n');
      await writeFile(join(generated,'schema.prisma'),'// Generated formatting\nmodel Example {\n  id    String   @id\n}\n');
      await writeFile(join(generated,'default.js'),'');
      expect(await prismaClientReady(root,'linux')).toBe(false);
      await writeFile(join(generated,'libquery_engine-debian-openssl-3.0.x.so.node'),'test-only-engine');
      expect(await prismaClientReady(root,'linux')).toBe(true);
      expect(await prismaClientReady(root,'win32')).toBe(false);
      await writeFile(join(root,'prisma/schema.prisma'),'model Example { id Int @id }');
      expect(await prismaClientReady(root,'linux')).toBe(false);
    }finally{await rm(root,{recursive:true,force:true});}
  });
});
