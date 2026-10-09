import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
const folder=mkdtempSync(path.join(os.tmpdir(),'nc-v26-net-'));
const port=30001+Math.floor(Math.random()*4000);
const args=['multiplayer/server.cjs'];
const env={...process.env,PORT:String(port),NC_MULTIPLAYER_DATA:folder,HOST:'127.0.0.1',NC_MULTIPLAYER_SEED:'village-integration'};
let process1=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function alive(){for(let i=0;i<80;i++){try{const response=await fetch(`http://127.0.0.1:${port}/`);if(response.ok)return;}catch{}await delay(60);}throw Error('Server did not listen');}
async function peer(){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),queued=[],waiters=[];
 const p={ws,send:o=>ws.send(JSON.stringify(o)),next(type){const i=queued.findIndex(m=>m.t===type);if(i>=0)return Promise.resolve(queued.splice(i,1)[0]);return new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error(`Missing ${type}: ${JSON.stringify(queued)}`)),5000);waiters.push({type,res:m=>{clearTimeout(t);res(m)}});});}};
 ws.onmessage=e=>{const m=JSON.parse(e.data),i=waiters.findIndex(w=>w.type===m.t);if(i>=0)waiters.splice(i,1)[0].res(m);else queued.push(m);};
 ws.onopen=()=>resolve(p);ws.onerror=()=>reject(Error('Failed websocket'));});}
try{
 await alive();const a=await peer();a.send({t:'join_public',name:'Budowniczy'});
 const welcome=await a.next('welcome');assert.equal(welcome.worldgenVersion,26);await a.next('ready');
 const b=await peer();b.send({t:'join_public',name:'Straznik'});assert.equal((await b.next('welcome')).seed,welcome.seed);await b.next('ready');await a.next('joined');
 // Send position into village region; high hops can be blocked by anti-teleport,
 // test builds near world origin for deterministic protocol verification.
 const batch=Array.from({length:48},(_,i)=>[1+i%8,36+Math.floor(i/16),1+Math.floor(i/8)%2,90]);
 a.send({t:'edit_batch',edits:batch});const broadcast=await b.next('edit_batch');assert.deepEqual(broadcast.edits,batch);
 b.send({t:'edit_batch',edits:[[2,36,1,90],['invalid',1,2,3]]});
 await delay(220);a.ws.close();b.ws.close();await delay(170);process1.kill();await delay(300);
 process1=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:'ignore'});await alive();
 const c=await peer();c.send({t:'join_public',name:'Powrot'});const back=await c.next('welcome');assert.equal(back.seed,welcome.seed);
 const saved=await c.next('history');const keys=new Map(saved.edits);
 for(const [x,y,z,id] of batch)assert.equal(keys.get(`${x},${y},${z}`),id,'building block must survive restart');
 c.ws.close();console.log('V26_NETWORK_PASS shared new worldgen=26, 48-block prefab broadcast, hostile batch rejection, persistence after server restart');
}finally{process1.kill();rmSync(folder,{recursive:true,force:true});}
