import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {HostService,cleanShareAddress}=require('../electron/host-service.cjs');
const {listen,allowed}=require('../electron/static-server.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(cleanShareAddress('https://forest.ngrok-free.app/'),'https://forest.ngrok-free.app');
for(const bad of ['http://example.com','https://example.com/a','file:///C:/x','https://u:p@example.com/'])assert.throws(()=>cleanShareAddress(bad));
assert.equal(allowed('/src/main.js'),true);
assert.equal(allowed('/electron/main.cjs'),false);
assert.equal(allowed('/multiplayer/server.cjs'),false);
function get(url){return new Promise((resolve,reject)=>{
  http.get(url,res=>{const parts=[];res.on('data',x=>parts.push(x));res.on('end',()=>resolve({status:res.statusCode,data:Buffer.concat(parts).toString('utf8')}));}).on('error',reject);
});}
const web=await listen(root,0);
try{
  for(const file of ['index.html','styles-desktop.css','styles-village.css','src/ui/desktop-host.js','src/net/multiplayer.js']){
    const res=await get(web.url+file);assert.equal(res.status,200,file);assert.ok(res.data.length>50,file);
  }
  assert.equal((await get(web.url+'electron/main.cjs')).status,403);
  console.log('DESKTOP_STATIC_PASS local Chromium origin, modules, CSS, blocked server files');
}finally{web.server.close();}

// Capture every message as soon as the socket is constructed. Earlier versions
// attached an event listener *after* waiting for 'welcome', losing 'ready' on
// fast computers and making a passing server randomly fail its test.
function connect(url){return new Promise((resolve,reject)=>{
  const ws=new WebSocket(url),queue=[],waiters=[];
  const startup=setTimeout(()=>reject(Error('WebSocket connection timeout')),5000);
  const peer={ws,send(message){ws.send(JSON.stringify(message));},
    next(type,ms=5000){
      const index=queue.findIndex(m=>m.t===type);
      if(index!==-1)return Promise.resolve(queue.splice(index,1)[0]);
      return new Promise((res,rej)=>{
        const w={type,res,timer:setTimeout(()=>{
          const index=waiters.indexOf(w);if(index!==-1)waiters.splice(index,1);
          rej(Error('No '+type+'; queued='+queue.map(m=>m.t).join(',')));
        },ms)};
        waiters.push(w);
      });
    }};
  ws.addEventListener('message',e=>{
    let m;try{m=JSON.parse(e.data);}catch{return;}
    const i=waiters.findIndex(w=>w.type===m.t);
    if(i>=0){const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.res(m);}else queue.push(m);
  });
  ws.addEventListener('open',()=>{clearTimeout(startup);resolve(peer);},{once:true});
  ws.addEventListener('error',()=>{clearTimeout(startup);reject(Error('WebSocket connection failed'));},{once:true});
});}
function unauthorizedStop(port){return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:'/__host/shutdown',method:'POST',timeout:2000},res=>{
    res.resume();res.on('end',()=>resolve(res.statusCode));
  });req.on('error',reject);req.end();
});}

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nightcraft-desktop-host-test-'));
const host=new HostService({root,storage:folder,env:{},logger:s=>{if(s.includes('Error:'))console.error(s);}});
try{
  const status=await host.start({seedText:'V25-TEST-SEED'});
  assert.ok(status.running && status.port>0 && status.localUrl.startsWith('http://127.0.0.1:'));
  assert.equal(await unauthorizedStop(status.port),404,'unauthenticated HTTP must not terminate the server');
  const wsUrl='ws://127.0.0.1:'+status.port+'/ws';
  const a=await connect(wsUrl);a.send({t:'join_public',name:'HOST'});
  const wa=await a.next('welcome');assert.equal(wa.seedText,'V25-TEST-SEED');await a.next('ready');
  const b=await connect(wsUrl);b.send({t:'join_public',name:'GOSC'});
  const wb=await b.next('welcome');assert.equal(wb.seed,wa.seed);assert.equal(wb.players.length,1);await b.next('ready');
  // A short burst of acknowledged real edits must survive an immediate stop.
  for(let x=1;x<=24;x++){
    const edit=b.next('edit');a.send({t:'edit',x,y:35,z:1,id:1});
    assert.equal((await edit).x,x);
  }
  // Important Windows regression: stop WHILE clients are still connected.
  // A blind child.kill() uses TerminateProcess, bypasses SIGTERM handlers and
  // loses edits. stop() must instead await the authenticated save acknowledgement.
  await host.updateShareUrl('https://forest.ngrok-free.app');
  assert.equal(host.status.shareUrl,'https://forest.ngrok-free.app');
  await host.stop();
  assert.equal(host.status.running,false);
  const saved=JSON.parse(fs.readFileSync(path.join(folder,'SHAREDXX.json'),'utf8'));
  for(let x=1;x<=24;x++)assert.ok(saved.edits.some(([key,id])=>key===`${x},35,1`&&id===1),
    'edit '+x+' must be flushed DURING host.stop(), even if clients never disconnect');
  const next=await host.start({seedText:'MUST_NOT_RESET_SAVED_WORLD'});
  const c=await connect('ws://127.0.0.1:'+next.port+'/ws');c.send({t:'join_public',name:'RETURN'});
  const wc=await c.next('welcome');assert.equal(wc.seedText,'V25-TEST-SEED','persisted seed must survive restart');
  const history=await c.next('history');
  for(let x=1;x<=24;x++)assert(history.edits.some(([key,id])=>key===`${x},35,1`&&id===1),
    'rejoining player must receive persisted edit '+x);
  await c.next('ready');
  await host.stop();
  console.log('DESKTOP_HOST_PASS local server, two clients, 24 real edits, authenticated graceful flush, active-client Windows shutdown, restart, seed and all edits persisted');
}finally{await host.stop();fs.rmSync(folder,{recursive:true,force:true});}
