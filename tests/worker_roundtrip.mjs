import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {loadGameData} from '../src/data/loader.js';
import {createChunkWorker} from '../src/world/worker/client.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('.'+url,root),'utf8'))});
const data=await loadGameData();
const outputs=[];
globalThis.self={postMessage:(data,transfer=[])=>outputs.push({data,transferred:transfer.length})};
await import('../src/world/worker/world-worker.js');
const seed=123456789;
self.onmessage({data:{type:'init',token:10,gameData:data,seed}});
assert.deepEqual(outputs.at(-1).data,{type:'ready',token:10,backend:'js-parity'});
self.onmessage({data:{type:'generate',token:9,cx:0,cz:0}}); // obsolete seed request
assert.equal(outputs.length,1);
self.onmessage({data:{type:'generate',token:10,cx:0,cz:0}});
assert.equal(outputs.length,2);
const result=outputs.at(-1);
assert.equal(result.data.type,'chunk');assert.equal(result.transferred,1);
assert.equal(result.data.buffer.byteLength,24576);
// Determinism when resetting the same world, regardless of earlier world seeds.
const checksum=crypto.createHash('sha256').update(Buffer.from(result.data.buffer)).digest('hex');
self.onmessage({data:{type:'init',token:11,gameData:data,seed:0xffffffff}});
self.onmessage({data:{type:'init',token:12,gameData:data,seed}});
self.onmessage({data:{type:'generate',token:12,cx:0,cz:0}});
assert.equal(crypto.createHash('sha256').update(Buffer.from(outputs.at(-1).data.buffer)).digest('hex'),checksum);
console.log('WORKER_ROUNDTRIP_PASS transferable, seed reset, obsolete-token filter, deterministic hash '+checksum.slice(0,12));

// Fake browser Worker with *synchronous* handoff tests client dedupe and exact edit overlay.
class FakeWorker{
  static instance=null;
  constructor(url,opts){FakeWorker.instance=this;assert.equal(opts.type,'module');this.calls=[];this.onmessage=null;this.terminated=false;}
  postMessage(data){this.calls.push(data);if(data.type==='init'){this.onmessage({data:{type:'ready',token:data.token}});}}
  terminate(){this.terminated=true;}
  deliver(cx,cz,data){const init=this.calls.findLast(x=>x.type==='init');const buffer=Uint8Array.from(data).buffer;this.onmessage({data:{type:'chunk',cx,cz,token:init.token,buffer}});}
}
globalThis.Worker=FakeWorker;
const S={chunks:new Map(),edits:new Map([['0,5,0',7]]),dirtyChunks:new Set(),WORLD_H:96,
 chunkKey:(x,z)=>`${x},${z}`,floorDiv:Math.floor===null?undefined:(n,d)=>Math.floor(n/d),mod:(n,d)=>((n%d)+d)%d,
 idx3:(x,y,z)=>y*256+z*16+x};
const client=createChunkWorker(S,data);client.reset(seed);
assert.equal(client.ready,true);assert.equal(client.request(0,0),true);assert.equal(client.request(0,0),true);
assert.equal(client.pending,1);
const source=new Uint8Array(result.data.buffer);
assert.equal(FakeWorker.instance.calls.filter(v=>v.type==='generate').length,1,'duplicate worker generate request');
FakeWorker.instance.deliver(0,0,source);
assert.equal(S.chunks.get('0,0').data[S.idx3(0,5,0)],7,'main-thread edits must override worker terrain');
assert.ok(S.dirtyChunks.has('0,0'));
assert.equal(client.pending,0);
client.reset(404);
const previousLength=S.chunks.size;
FakeWorker.instance.onmessage({data:{type:'chunk',token:1,cx:1,cz:1,buffer:source.slice().buffer}});
assert.equal(S.chunks.size,previousLength,'stale worker world result must be ignored');
client.stop();
assert.equal(client.ready,false);
console.log('WORKER_CLIENT_PASS dedupe, edited terrain overlay, stale generation discarded, termination');
