import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeServerAddress,install} from '../src/net/multiplayer.js';
assert.equal(normalizeServerAddress('https://abc.ngrok-free.app'),'wss://abc.ngrok-free.app/ws');
assert.equal(normalizeServerAddress('abc.ngrok-free.app'),'wss://abc.ngrok-free.app/ws');
assert.equal(normalizeServerAddress('https://abc.ngrok-free.app/ws'),'wss://abc.ngrok-free.app/ws');
assert.equal(normalizeServerAddress('http://127.0.0.1:8787','http:'),'ws://127.0.0.1:8787/ws');
assert.equal(normalizeServerAddress('http://abc.ngrok-free.app','https:'),'wss://abc.ngrok-free.app/ws');
assert.equal(normalizeServerAddress('http://unknown-example.com','https:'),null);
assert.equal(normalizeServerAddress('https://bad.example/?token=x'),null);
const bat=readFileSync(new URL('../START_SERVER.bat',import.meta.url),'utf8');
assert.match(bat,/ngrok http 8787/i);assert.match(bat,/set \/p "NC_PUBLIC_URL=/i);
assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/id="mpTabRows"/);
// URL.pathname is NOT a filesystem path on Windows: /C:/... is an invalid cwd.
// fileURLToPath resolves drive letters, URL-escaped characters and Unicode correctly.
const PROJECT_ROOT=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const SERVER_ENTRY=path.join(PROJECT_ROOT,'multiplayer','server.cjs');
const dir=mkdtempSync(path.join(os.tmpdir(),'nightcraft-shared-'));
const port=31000+Math.floor(Math.random()*900);
let proc=null;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let spawnError=null;
function launch(){
  spawnError=null;
  proc=spawn(process.execPath,[SERVER_ENTRY],{
    cwd:PROJECT_ROOT,
    env:{...process.env,PORT:String(port),NC_MULTIPLAYER_DATA:dir,HOST:'127.0.0.1',NC_WORLD_SEED:'fixed-ngrok-test'},
    stdio:['ignore','pipe','pipe'],windowsHide:true
  });
  // A failed spawn emits an async 'error'. Catch it so Windows reports the actual
  // executable/cwd instead of crashing with an unhandled EventEmitter error.
  proc.once('error',e=>{spawnError=e;});
}

async function ready(){
  for(let i=0;i<60;i++){
    if(spawnError)throw Error(`Cannot start multiplayer server: ${spawnError.message} (cwd=${PROJECT_ROOT}, executable=${process.execPath})`);
    if(proc?.exitCode!==null)throw Error(`Multiplayer server exited early: ${proc?.exitCode}`);
    try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok)return;}catch{}
    await sleep(65);
  }
  throw Error('server did not start on port '+port);
}
async function peer(){return await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);const messages=[],waits=[];ws.onopen=()=>resolve({ws,messages,send:m=>ws.send(JSON.stringify(m)),next(t){const seen=messages.find(x=>x.t===t);if(seen){messages.splice(messages.indexOf(seen),1);return Promise.resolve(seen);}return new Promise((res,rej)=>{const to=setTimeout(()=>rej(Error('waiting for '+t+': '+JSON.stringify(messages))),3000);waits.push({t,res:x=>{clearTimeout(to);res(x)}});});}});ws.onmessage=e=>{const m=JSON.parse(e.data);const i=waits.findIndex(w=>w.t===m.t);if(i>=0)waits.splice(i,1)[0].res(m);else messages.push(m);};ws.onerror=reject;});}
try{
  launch();await ready();
  const a=await peer();a.send({t:'join_public',name:'Host'});const aw=await a.next('welcome');assert.equal(aw.code,'SHAREDXX');await a.next('ready');
  const b=await peer();b.send({t:'join_public',name:'Guest'});const bw=await b.next('welcome');assert.equal(bw.seed,aw.seed);assert.equal(bw.players.length,1);await b.next('ready');await a.next('joined');
  a.send({t:'edit',x:5,y:30,z:7,id:9});assert.equal((await b.next('edit')).id,9);
  a.send({t:'state',pos:[22,41,-7],yaw:1,pitch:.2,health:75});assert.deepEqual((await b.next('state')).pos,[22,41,-7]);
  // New late joiner gets the same world history without any room code.
  const c=await peer();c.send({t:'join_public',name:'Late'});const cw=await c.next('welcome');assert.equal(cw.code,'SHAREDXX');assert.equal(cw.players.length,2);assert((await c.next('history')).edits.some(([k,v])=>k==='5,30,7'&&v===9));await c.next('ready');
  // Mock the DOM enough to exercise the *real browser networking install and ready -> game* path.
  class ClassList{constructor(){this.set=new Set(['hidden']);}add(v){this.set.add(v);}remove(v){this.set.delete(v);}toggle(v,b){if(b===undefined)b=!this.set.has(v);b?this.set.add(v):this.set.delete(v);}contains(v){return this.set.has(v);}}
  class Elem{constructor(){this.value='';this.children=[];this.classList=new ClassList();this.handlers={};this.style={};this.textContent='';}addEventListener(t,f){(this.handlers[t]??=[]).push(f);}click(){for(const f of this.handlers.click||[])f();}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}remove(){}focus(){}blur(){}get firstChild(){return this.children[0];}set innerHTML(v){}get scrollHeight(){return this.children.length*12;}set scrollTop(v){}}
  const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,new Elem());return elements.get(id);};const listeners={};
  globalThis.document={getElementById:el,createElement:()=>new Elem(),addEventListener(t,f){(listeners[t]??=[]).push(f);},exitPointerLock(){}};
  globalThis.window={addEventListener(){}};
  globalThis.location={protocol:'http:',hostname:'127.0.0.1'};
  globalThis.localStorage={getItem:()=>null,setItem(){}};
  const url=`http://127.0.0.1:${port}`;el('mpUrl').value=url;el('mpName').value='UI-Peer';
  const player={pos:[0,33,0],yaw:0,pitch:0,health:100};
  let starts=0;const S={player,UI:{seedInput:el('seedInput'),difficultySelect:el('difficultySelect'),pauseMenu:el('pauseMenu')},canvas:el('fakeCanvas'),input:{keys:new Set()},running:false,
    hashString(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;},
    startNewGame(){starts++;S.running=true;S.paused=true;},saveGame(){},quitToMenu(){S.running=false;},setBlock(){return true;},resumeGame(){S.paused=false;},edits:new Map(),chunks:new Map(),chunkKey:(a,b)=>`${a},${b}`,editKey:(a,b,c)=>`${a},${b},${c}`,floorDiv:Math.floor,mod:(a,b)=>((a%b)+b)%b,idx3:()=>0,markDirty(){},CHUNK:16};
  install(S);el('mpQuickJoin').click();
  for(let i=0;i<120 && !S.multiplayer.connected;i++)await sleep(25);
  assert.equal(starts,1,'real multiplayer ready must enter the world; V23 had a connecting guard bug');
  assert(S.multiplayer.connected);assert(!el('mpEnterWorld').classList.contains('hidden'),'explicit pointer-lock activation');
  (listeners.keydown||[]).forEach(f=>f({code:'Tab',preventDefault(){},stopPropagation(){}}));
  assert(!el('mpTabList').classList.contains('hidden'));assert(el('mpTabRows').children.length>=4,'TAB shows self and other peers');
  (listeners.keyup||[]).forEach(f=>f({code:'Tab'}));assert(el('mpTabList').classList.contains('hidden'));
  S.multiplayer.ws.close();a.ws.close();b.ws.close();c.ws.close();await sleep(250);
  proc.kill();await sleep(220);launch();await ready();
  const d=await peer();d.send({t:'join_public',name:'Return'});const dw=await d.next('welcome');assert.equal(dw.seed,aw.seed);assert((await d.next('history')).edits.some(([k,v])=>k==='5,30,7'&&v===9));await d.next('ready');d.ws.close();
  console.log('NGROK_DIRECT_JOIN_PASS URL conversion, default shared world, avatars/coords, block broadcast/history, TAB DOM, client world start, restart persistence');
}finally{proc?.kill();rmSync(dir,{recursive:true,force:true});}
