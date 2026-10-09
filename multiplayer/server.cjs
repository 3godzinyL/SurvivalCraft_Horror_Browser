/** NightCraft cooperative rooms — zero external Node dependencies.
 * Deploy this separately from GitHub Pages. Rooms persist on a mounted volume.
 * No accounts/authentication: an unguessable room code is the invitation key.
 */
'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const PORT=Number(process.env.PORT||8787);
const DATA_DIR=path.resolve(process.env.NC_MULTIPLAYER_DATA||path.join(__dirname,'room-data'));
const MAX_PLAYERS=12,MAX_EDITS=100000,MAX_BYTES=65536;
// Local Electron host can request a durable flush before Windows terminates
// its child process. The random token never goes to the renderer or tunnel.
const HOST_SHUTDOWN_TOKEN=String(process.env.NC_HOST_SHUTDOWN_TOKEN||'');
const ALLOWED=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
const rooms=new Map();
const PUBLIC_CODE='SHAREDXX'; // one persistent shared world per running host
const PUBLIC_SEED=String(process.env.NC_WORLD_SEED||'NIGHTCRAFT-SHARED-FOREST');
function seedHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode=()=>Array.from(crypto.randomBytes(8),x=>letters[x%letters.length]).join('');
function send(socket,obj){if(!socket||socket.destroyed)return;const bytes=Buffer.from(JSON.stringify(obj));if(bytes.length>MAX_BYTES)return;const hdr=bytes.length<126?Buffer.from([0x81,bytes.length]):Buffer.from([0x81,126,bytes.length>>8,bytes.length&255]);socket.write(Buffer.concat([hdr,bytes]));}
function broadcast(room,msg,except=null){for(const p of room.peers)if(p!==except)send(p.socket,msg);}
function err(peer,message){send(peer.socket,{t:'error',message});}
function roomFile(code){return path.join(DATA_DIR,code+'.json');}
function store(room){
  if(!room.dirty)return true;room.dirty=false;
  try{fs.mkdirSync(DATA_DIR,{recursive:true});const target=roomFile(room.code),temp=target+'.tmp';
    fs.writeFileSync(temp,JSON.stringify({v:1,seed:room.seed,seedText:room.seedText,difficulty:room.difficulty,worldgenVersion:room.worldgenVersion,edits:[...room.edits],clock:room.clock}));fs.renameSync(temp,target);return true;
  }catch(e){room.dirty=true;console.error('Save room failed',room.code,e.message);return false;}
}
function loadRoom(code){if(rooms.has(code))return rooms.get(code);let raw;
  try{raw=JSON.parse(fs.readFileSync(roomFile(code),'utf8'));}catch{return null;}
  if(!raw||raw.v!==1||!Number.isInteger(raw.seed)||!Array.isArray(raw.edits))return null;
  const room={code,seed:raw.seed>>>0,seedText:String(raw.seedText||''),difficulty:raw.difficulty||'nightmare',worldgenVersion:raw.worldgenVersion||22,edits:new Map(raw.edits.filter(v=>Array.isArray(v)&&/^[-\d]+,[-\d]+,[-\d]+$/.test(v[0])&&Number.isInteger(v[1])&&v[1]>=0&&v[1]<256).slice(0,MAX_EDITS)),clock:Number(raw.clock)||800,peers:new Set(),dirty:false};rooms.set(code,room);return room;
}
function publicRoom(){
  let room=loadRoom(PUBLIC_CODE);
  if(room)return room;
  room={code:PUBLIC_CODE,seed:seedHash(PUBLIC_SEED),seedText:PUBLIC_SEED,difficulty:'nightmare',worldgenVersion:26,edits:new Map(),clock:800,peers:new Set(),dirty:true};
  rooms.set(PUBLIC_CODE,room);store(room);return room;
}
function cleanName(v){return String(v||'Gracz').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,22)||'Gracz';}
function isFinitePos(pos){return Array.isArray(pos)&&pos.length===3&&pos.every(n=>Number.isFinite(n)&&Math.abs(n)<100000);}
function validEdit(m){return Number.isInteger(m.x)&&Math.abs(m.x)<100000&&Number.isInteger(m.y)&&m.y>0&&m.y<127&&Number.isInteger(m.z)&&Math.abs(m.z)<100000&&Number.isInteger(m.id)&&m.id>=0&&m.id<256;}
function drop(peer){const room=peer.room;if(!room)return;const wasHost=room.peers.values().next().value===peer;room.peers.delete(peer);broadcast(room,{t:'left',id:peer.id});if(wasHost&&room.peers.size)broadcast(room,{t:'host',id:room.peers.values().next().value.id});peer.room=null;store(room);}
function join(peer,room,name){if(peer.room)drop(peer);if(room.peers.size>=MAX_PLAYERS)return err(peer,'Pokój jest pełny (12 graczy).');
  peer.id=crypto.randomUUID().slice(0,12);peer.name=cleanName(name);peer.room=room;peer.pos=[0,35,0];peer.yaw=0;peer.pitch=0;peer.health=100;
  const players=[...room.peers].map(p=>({id:p.id,name:p.name,pos:p.pos,yaw:p.yaw,pitch:p.pitch,health:p.health}));room.peers.add(peer);
  send(peer.socket,{t:'welcome',id:peer.id,code:room.code,seed:room.seed,seedText:room.seedText,difficulty:room.difficulty,worldgenVersion:room.worldgenVersion,clock:room.clock,players});
  const entries=[...room.edits];for(let i=0;i<entries.length;i+=1000)send(peer.socket,{t:'history',edits:entries.slice(i,i+1000)});
  send(peer.socket,{t:'ready'});
  broadcast(room,{t:'joined',player:{id:peer.id,name:peer.name,pos:peer.pos,yaw:0,pitch:0,health:100}},peer);
}
function receive(peer,m){if(!m||typeof m!=='object'||typeof m.t!=='string')return;const now=Date.now();if(now-peer.windowStart>1000){peer.windowStart=now;peer.budget=0;}if(++peer.budget>40)return;
  if(m.t==='join_public'){join(peer,publicRoom(),m.name);return;}
  if(m.t==='create'){
    if(peer.room)return err(peer,'Najpierw opuść obecny pokój.');
    if(typeof m.seedText!=='string'||m.seedText.length>32||!Number.isInteger(m.seed)||!Number.isInteger(m.worldgenVersion)||![22,26].includes(m.worldgenVersion))return err(peer,'Nieprawidłowe dane świata (wersja V22 lub V26).');
    let code;do{code=roomCode();}while(rooms.has(code)||fs.existsSync(roomFile(code)));
    const room={code,seed:m.seed>>>0,seedText:m.seedText,difficulty:['normal','nightmare','insane'].includes(m.difficulty)?m.difficulty:'nightmare',worldgenVersion:m.worldgenVersion,clock:800,edits:new Map(),peers:new Set(),dirty:true};rooms.set(code,room);store(room);join(peer,room,m.name);return;
  }
  if(m.t==='join'){
    const code=String(m.code||'').trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))return err(peer,'Kod pokoju ma 8 znaków.');
    const room=loadRoom(code);if(!room)return err(peer,'Pokój nie istnieje.');if(![22,26].includes(room.worldgenVersion))return err(peer,'Niekompatybilna wersja świata.');join(peer,room,m.name);return;
  }
  if(m.t==='leave'){drop(peer);return;}
  if(!peer.room)return;
  const room=peer.room;
  if(m.t==='state'){
    if(now-peer.lastState<55||!isFinitePos(m.pos))return;peer.lastState=now;
    const maxSpeed=45,maxDist=Math.max(16,(now-peer.lastPosTime)/1000*maxSpeed);if(peer.lastPosTime && Math.hypot(m.pos[0]-peer.pos[0],m.pos[2]-peer.pos[2])>maxDist)return;
    peer.pos=m.pos.map(n=>Math.round(n*100)/100);peer.lastPosTime=now;peer.yaw=Number.isFinite(m.yaw)?m.yaw:0;peer.pitch=Number.isFinite(m.pitch)?m.pitch:0;peer.health=Number.isFinite(m.health)?Math.max(0,Math.min(100,m.health)):100;
    broadcast(room,{t:'state',id:peer.id,pos:peer.pos,yaw:peer.yaw,pitch:peer.pitch,health:peer.health},peer);return;
  }
  if(m.t==='edit_batch'){
    if(!Array.isArray(m.edits)||m.edits.length<1||m.edits.length>450)return;
    const clean=[];
    for(const row of m.edits){
      if(!Array.isArray(row)||row.length!==4||!row.every(Number.isInteger))return;
      const [x,y,z,id]=row,edit={x,y,z,id};
      if(!validEdit(edit)||Math.hypot(x-peer.pos[0],z-peer.pos[2])>120||Math.abs(y-peer.pos[1])>80)return;
      clean.push(row);
    }
    if(room.edits.size+clean.length>MAX_EDITS)return err(peer,'Limit edycji świata osiągnięty.');
    for(const [x,y,z,id] of clean)room.edits.set(`${x},${y},${z}`,id);
    room.dirty=true;broadcast(room,{t:'edit_batch',edits:clean},peer);return;
  }
  if(m.t==='edit'){
    if(!validEdit(m))return;const key=`${m.x},${m.y},${m.z}`;
    if(room.edits.size>=MAX_EDITS&&!room.edits.has(key))return err(peer,'Limit zmian bloków w pokoju osiągnięty.');
    if(Math.hypot(m.x-peer.pos[0],m.z-peer.pos[2])>35||Math.abs(m.y-peer.pos[1])>35)return;
    room.edits.set(key,m.id);room.dirty=true;broadcast(room,{t:'edit',x:m.x,y:m.y,z:m.z,id:m.id,by:peer.id},peer);return;
  }
  if(m.t==='chat'){
    const body=String(m.message||'').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,160);
    if(!body||now-peer.lastChat<550)return;peer.lastChat=now;
    broadcast(room,{t:'chat',id:peer.id,name:peer.name,message:body});return;
  }
  if(m.t==='clock'){
    if(room.peers.values().next().value!==peer||!Number.isFinite(m.clock))return;
    room.clock=m.clock;room.dirty=true;broadcast(room,{t:'clock',clock:room.clock},peer);
  }
}
function unpack(peer,chunk){peer.buffer=Buffer.concat([peer.buffer,chunk]);if(peer.buffer.length>MAX_BYTES*2){peer.socket.destroy();return;}
  while(peer.buffer.length>=2){const b=peer.buffer;const opcode=b[0]&15,fin=!!(b[0]&0x80),masked=!!(b[1]&0x80);let len=b[1]&127,off=2;
    if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4;}else if(len===127){if(b.length<10)return;const hi=b.readUInt32BE(2),lo=b.readUInt32BE(6);if(hi!==0||lo>MAX_BYTES){peer.socket.destroy();return;}len=lo;off=10;}
    if(!masked||len>MAX_BYTES||!fin){peer.socket.destroy();return;}if(b.length<off+4+len)return;
    const mask=b.subarray(off,off+4),data=Buffer.from(b.subarray(off+4,off+4+len));peer.buffer=b.subarray(off+4+len);
    for(let i=0;i<len;i++)data[i]^=mask[i%4];
    if(opcode===8){peer.socket.end(Buffer.from([0x88,0]));return;}
    if(opcode===9){peer.socket.write(Buffer.concat([Buffer.from([0x8A,len]),data]));continue;}
    if(opcode!==1)continue;
    try{receive(peer,JSON.parse(data.toString('utf8')));}catch{err(peer,'Niepoprawna wiadomość JSON.');}
  }
}
let shuttingDown=false;
function flushRooms(){let ok=true;for(const r of rooms.values())if(!store(r))ok=false;return ok;}
function shutdown(){
  if(shuttingDown)return;
  shuttingDown=true;
  if(!flushRooms()){console.error('NightCraft: could not persist all rooms during shutdown');shuttingDown=false;return;}
  httpServer.close();
  // Connected WebSockets keep the HTTP server alive; close them only AFTER
  // the persisted snapshot has been written, then release the child process.
  for(const room of rooms.values())for(const peer of room.peers)peer.socket.destroy();
  setTimeout(()=>process.exit(0),250).unref();
}
const httpServer=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__host/shutdown'){
    const supplied=Buffer.from(String(req.headers['x-nightcraft-host-token']||''));
    const expected=Buffer.from(HOST_SHUTDOWN_TOKEN);
    const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if(req.method!=='POST'||!HOST_SHUTDOWN_TOKEN||!loopback||supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected)){
      res.writeHead(404).end();return;
    }
    if(!flushRooms()){res.writeHead(503).end('Unable to persist world');return;}
    res.writeHead(200,{'Content-Type':'application/json'}).end('{"saved":true}');
    setImmediate(shutdown);return;
  }
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({service:'NightCraft Multiplayer',status:'ok',rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.peers.size,0)}));
});
httpServer.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/ws'||req.headers.upgrade?.toLowerCase()!=='websocket'||!/^13$/.test(String(req.headers['sec-websocket-version']))){socket.destroy();return;}
  if(ALLOWED.length&&!ALLOWED.includes(req.headers.origin)){socket.destroy();return;}
  const key=req.headers['sec-websocket-key'];if(typeof key!=='string'||!Buffer.from(key,'base64').length){socket.destroy();return;}
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
  const peer={socket,buffer:Buffer.alloc(0),room:null,budget:0,windowStart:0,lastState:0,lastPosTime:0,lastChat:0};
  socket.setNoDelay(true);socket.on('data',data=>unpack(peer,data));socket.on('error',()=>{});socket.on('close',()=>drop(peer));if(head.length)unpack(peer,head);
});
setInterval(flushRooms,4000).unref();
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
publicRoom();
httpServer.listen(PORT,process.env.HOST||'0.0.0.0',()=>console.log(`NIGHTCRAFT_MP_READY ${PORT} SHARED_WORLD ${PUBLIC_CODE}`));
