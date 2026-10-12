import 'dotenv/config';
import next from 'next';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { sessionFromCookie, authorize } from './src/lib/auth';
import { redis } from './src/lib/redis';
import { snowflake } from './src/shared/catalog';
const dev=process.env.NODE_ENV!=='production',port=Number(process.env.PORT??3000);
const app=next({dev,hostname:'0.0.0.0',port});
await app.prepare();
const http=createServer(app.getRequestHandler());
const io=new Server(http,{cors:{origin:process.env.APP_URL??'http://localhost:3000',credentials:true},maxHttpBufferSize:16384});
io.use(async(socket,done)=>{
  try{if(socket.handshake.headers.origin!==new URL(process.env.APP_URL??'http://localhost:3000').origin)throw new Error('Origin refused');const s=await sessionFromCookie(socket.handshake.headers.cookie??null);socket.data.userId=s.userId;socket.data.sessionId=s.id;done();}catch{done(new Error('Authentification requise'));}
});
io.on('connection',socket=>{
  let joins=0;
  socket.on('subscribe',async(value:unknown,ack:(data:unknown)=>void)=>{
    try{if(++joins>10)throw new Error('Too many subscriptions');const id=snowflake.parse(value);await authorize(id,socket.data.userId);for(const room of socket.rooms)if(room!==socket.id)await socket.leave(room);await socket.join(id);if(typeof ack==='function')ack({ok:true});}catch{if(typeof ack==='function')ack({error:'Accès refusé'});}
  });
});
setInterval(async()=>{
  for(const socket of io.sockets.sockets.values()) {
    try{await sessionFromCookie(socket.handshake.headers.cookie??null);for(const room of socket.rooms)if(room!==socket.id)await authorize(room,socket.data.userId);}catch{socket.disconnect(true);}
  }
},30000).unref();
try {
  const sub=redis().duplicate();sub.on('error',()=>{});await sub.subscribe('atlas:events');
  sub.on('message',(_channel,raw)=>{try{const event=JSON.parse(raw);io.to(event.guildId).emit('update',event);}catch{}});
}catch{console.warn('Redis unavailable: realtime disabled until server restart; HTTP refresh remains available.');}
http.listen(port,'0.0.0.0',()=>console.log(`Local: http://localhost:${port}`));
process.on('SIGTERM',()=>{io.close();http.close();process.exit(0);});
