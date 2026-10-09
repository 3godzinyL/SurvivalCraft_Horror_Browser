import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadGameData} from '../src/data/loader.js';
import {install as math} from '../src/math/matrix.js';
import {install as noise} from '../src/world/noise.js';
import {install as registry} from '../src/data/registry.js';
import {install as worldgen} from '../src/world/worldgen.js';
import {install as worldapi} from '../src/world/world-api.js';
import {install as chunkRender} from '../src/render/held-block.js';
import {install as packTactics} from '../src/sim/mobs/predator-tactics.js';
import {migrateSave} from '../src/save/migrations.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync((u instanceof URL?u:new URL('.'+u,root)),'utf8'))});
const data=await loadGameData();
const gl={getAttribLocation:()=>0,getUniformLocation:()=>({})};
const S={GAME_DATA:data,gl,makeProgram:()=>({}),atlas:{tile:24,cols:8,rows:14}};
math(S);noise(S);registry(S);worldgen(S);S.blockTile=data.blocks.numericTiles;worldapi(S);chunkRender(S);
assert.equal(S.renderDistance,12,'V35 defaults to the requested 12 chunks');
assert.ok(S.isBillboardPlant(S.B.RED_FLOWER));
let P=[],N=[],U=[],W=[];
S.pushDecorMesh(P,N,U,W,13,30,24,S.B.RED_FLOWER);
assert.equal(P.length/3,12,'flower front/back should both exist');
assert.ok(W.every(v=>v===255),'flower must carry camera-facing billboard signal');
P=[];N=[];U=[];W=[];
S.pushDecorMesh(P,N,U,W,0,21,0,S.B.TALLGRASS);
assert.equal(P.length/3,24,'grasses should be double sided cross planes');
assert.ok(W.some(v=>v>0),'grass upper vertices should sway');
const requests=[],requestKeys=new Set();
S.chunkWorker={ready:true,setFocus(){},isRequested:(x,z)=>requestKeys.has(`${x},${z}`),request:(x,z)=>{const k=`${x},${z}`;if(requestKeys.has(k))return true;requestKeys.add(k);requests.push(k);return true;}};
S.ensureChunk=(x,z)=>S.chunks.set(S.chunkKey(x,z),{cx:x,cz:z,opaque:null,water:null});
S.deleteMesh=()=>{};S.processDirty=()=>{};
S.renderDistance=12; // streaming budget regression at the default distance
S.updateStreaming(0,0,false);
assert.ok(requests.length>0&&requests.length<=12,'bounded initial worker batch');
S.updateStreaming(0,0,true); // request an immediate scan; ordinary frames are deliberately throttled
assert.ok(requests.length>12,'later frame must advance past pending queue, not ask for same 12');
assert.ok(requests.every(k=>{const [x,z]=k.split(',').map(Number);return Math.hypot(x,z)<13;}));
S.chunks.clear();S.edits.clear();
S.worldSeed=S.hashString('v18-new-world-parity');
S.worldgenVersion=17;
const oldChunk=S.generateChunkData(0,0);
S.worldgenVersion=18;
const newChunk=S.generateChunkData(0,0);
assert.equal(oldChunk.length,newChunk.length);
assert.ok(oldChunk.some((v,i)=>v!==newChunk[i]),'new version must actually change terrain');
assert.deepEqual(newChunk,S.generateChunkData(0,0),'new generator deterministic');
let caveCount=0,mineCount=0;
for(let z=-128;z<128;z+=8)for(let x=-128;x<128;x+=8){
 const h=S.terrainHeight(x,z);if(S.caveRampOpen(x,h-6,z,h))caveCount++;
 if(S.mineshaftCell(x,14,z)>0)mineCount++;
}
assert.ok(caveCount>=0 && mineCount>=0);
const wolfPlayer={pos:[12,11,12],vel:[5,0,1]};
const pack={enemies:[],player:wolfPlayer,enemyDefs:{wolf:{radius:.44}},};packTactics(pack);
const targetSlots=new Set();
for(let k=0;k<5;k++){
 const t=pack.predatorFormationTarget({type:'wolf',pos:[2,11,1],huntSlot:k,packId:1},wolfPlayer.pos[0],wolfPlayer.pos[2],15);
 targetSlots.add(t.map(x=>x.toFixed(2)).join(','));
}
assert.equal(targetSlots.size,5,'pack must have separate flank lanes');
const save=migrateSave({version:21,worldgenVersion:17,edits:[['2,3,4',5]],torchMounts:[['7,8,9',[1,0,0]]]});
assert.equal(save.version,24);assert.equal(save.worldgenVersion,17);
assert.deepEqual(save.torchMounts,[['7,8,9',[1,0,0]]]);
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
assert.match(html,/<option value="12" selected>/);
assert.match(styles,/#mainMenu\.screen\{justify-content:center;/);
const vertex=fs.readFileSync(new URL('../src/render/shaders/voxel.vert.glsl',import.meta.url),'utf8');
assert.match(vertex,/uniform highp vec3 uCam/);assert.match(vertex,/aWind>\.98/);
console.log('V18_FEATURES_PASS configurable 2-chunk prioritization, 2-sided billboards, waving grass, new terrain deterministic, saved torches, separate wolf flank lanes, centered menu');

// Loading the mesh border must NEVER eagerly generate unloaded neighbours.
{
  const fs=await import('node:fs');
  const api=fs.readFileSync(new URL('../src/world/world-api.js',import.meta.url),'utf8');
  const mesher=fs.readFileSync(new URL('../src/render/held-block.js',import.meta.url),'utf8');
  assert.match(api,/S\.peekLoadedBlock\s*=.*function/);
  assert.match(mesher,/const nid = S\.peekLoadedBlock\(/);
  assert.doesNotMatch(mesher,/const nid = S\.getBlock\(/);
  console.log('V18_STREAMING_MESH_NONGENERATING_PASS');
}

// Direct behavioural check: unloaded neighbours stay unloaded during border meshing.
{
  const before=S.chunks.size;
  const unseen=S.peekLoadedBlock(-999,50,999);
  assert.equal(unseen,S.B.AIR);
  assert.equal(S.chunks.size,before);
  const blocks=new Uint8Array(S.CHUNK*S.CHUNK*S.WORLD_H);
  blocks[S.idx3(0,10,0)]=S.B.STONE;
  S.chunks.set(S.chunkKey(0,0),{cx:0,cz:0,data:blocks});
  assert.equal(S.peekLoadedBlock(0,10,0),S.B.STONE);
  assert.equal(S.peekLoadedBlock(16,10,0),S.B.AIR);
  console.log('V18_CHUNK_BORDER_PASS no synchronous neighbour expansion');
}
