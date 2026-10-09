import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
const dir=mkdtempSync(path.join(os.tmpdir(),'nightcraft-mp-'));
const port=27900+Math.floor(Math.random()*3000);
const child=spawn(process.execPath,['multiplayer/server.cjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NC_MULTIPLAYER_DATA:dir,HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',v=>errors+=v);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function peer(){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);let messages=[],waiting=[];
  const entry={ws,messages,send:o=>ws.send(JSON.stringify(o)),next(t,timeout=3500){const seen=messages.find(m=>m.t===t);if(seen){messages.splice(messages.indexOf(seen),1);return Promise.resolve(seen);}return new Promise((res,rej)=>{const id=setTimeout(()=>rej(Error('Timeout: '+t+' messages='+JSON.stringify(messages.slice(-3)))),timeout);waiting.push({t,res:v=>{clearTimeout(id);res(v)}});});},close:()=>ws.close()};
  ws.onopen=()=>resolve(entry);ws.onerror=()=>reject(Error('WebSocket open failed'));
  ws.onmessage=ev=>{const m=JSON.parse(ev.data),i=waiting.findIndex(q=>q.t===m.t);if(i>=0){waiting.splice(i,1)[0].res(m);}else messages.push(m);};
});}
try{
  let alive=false;for(let i=0;i<65;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`);alive=r.ok;break;}catch{await delay(80);}}
  assert(alive,'server boot: '+errors);
  const a=await peer();a.send({t:'create',seedText:'coop-test',seed:193291039,worldgenVersion:22,name:'ALFA'});
  const wel=await a.next('welcome');assert.match(wel.code,/^[A-HJ-NP-Z2-9]{8}$/);await a.next('ready');
  const b=await peer();b.send({t:'join',code:wel.code,name:'BETA'});
  const bw=await b.next('welcome');assert.equal(bw.code,wel.code);assert.equal(bw.players.length,1);await b.next('ready');await a.next('joined');
  a.send({t:'state',pos:[1,40,1],yaw:1,health:70});const state=await b.next('state');assert.deepEqual(state.pos,[1,40,1]);
  a.send({t:'edit',x:2,y:38,z:2,id:4});const edit=await b.next('edit');assert.equal(edit.id,4);
  b.send({t:'chat',message:'hej!'});const chat=await a.next('chat');assert.equal(chat.message,'hej!');
  const outsider=await peer();outsider.send({t:'join',code:'ZZZZZZZZ',name:'X'});assert.equal((await outsider.next('error')).t,'error');outsider.close();
  b.close();a.close();await delay(450);child.kill();await delay(300);
  // Restart, check room edits persist when players disconnect.
  const child2=spawn(process.execPath,['multiplayer/server.cjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NC_MULTIPLAYER_DATA:dir,HOST:'127.0.0.1'},stdio:'ignore'});
  try{await delay(400);const c=await peer();c.send({t:'join',code:wel.code,name:'Gamma'});await c.next('welcome');const history=await c.next('history');assert(history.edits.some(([k,v])=>k==='2,38,2'&&v===4),'edits must persist');await c.next('ready');c.close();}finally{child2.kill();}
  console.log('MULTIPLAYER_PASS websocket create/join, players, state, edits, chat, rejection, disk persistence');
}finally{child.kill();rmSync(dir,{recursive:true,force:true});}
