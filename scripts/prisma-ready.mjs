import {access,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function prismaClientReady(root='.',platform=process.platform) {
  try{
    const folder=resolve(root,'node_modules/.prisma/client');
    const [source,generated,files]=await Promise.all([
      readFile(resolve(root,'prisma/schema.prisma'),'utf8'),readFile(resolve(folder,'schema.prisma'),'utf8'),readdir(folder)
    ]);
    await access(resolve(folder,'default.js'));
    const normalize=value=>JSON.stringify((value.match(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s]/g)??[]).filter(token=>!token.startsWith('//')&&!token.startsWith('/*')));
    const engine=platform==='win32'?/^query_engine-windows\.dll\.node$/:platform==='linux'?/^libquery_engine-.*\.so\.node$/:/^libquery_engine-.*\.dylib\.node$/;
    return normalize(source)===normalize(generated)&&files.some(file=>engine.test(file));
  }catch{return false;}
}
