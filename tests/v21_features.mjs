import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {install as installPlayer} from '../src/sim/player.js';
import {install as installPhysics} from '../src/sim/physics.js';
import {install as installCave} from '../src/sim/mobs/cave-hollowed.js';
import {install as installTree} from '../src/sim/falling-trees.js';
import {install as installEntities} from '../src/render/entities.js';
import {CURRENT_SAVE_VERSION} from '../src/save/migrations.js';
const base=new URL('../',import.meta.url);
const rawItems=JSON.parse(readFileSync(new URL('data/items.json',base),'utf8'));
const items={};for(const [id,d] of Object.entries(rawItems))items[id]={...d,durability:d.durability||(d.kind==='tool'?(d.tier==='iron'?225:d.tier==='gold'?88:105):undefined),name:id};
const B=JSON.parse(readFileSync(new URL('data/blocks.json',base),'utf8')).ids;
globalThis.innerWidth=1280;globalThis.innerHeight=720;
const s={B,itemDefs:items,blockDefs:{[B.IRON]:{tool:'pickaxe',material:'ore'},[B.GOLD]:{tool:'pickaxe',material:'ore'},[B.STONE]:{tool:'pickaxe',material:'stone'}},
  clamp:(x,min,max)=>Math.max(min,Math.min(max,x)),WORLD_H:96,gl:{createBuffer:()=>({})}};
installPlayer(s);installPhysics(s);
s.player.slots[0]={id:'wood_pickaxe',count:1,wear:17};
s.player.slots[1]={id:'pickaxe',count:1,wear:0};
s.player.slots[2]={id:'gold_pickaxe',count:1,wear:0};
const powerWood=s.equippedPowerFor(B.GOLD);s.player.selected=1;
const powerIron=s.equippedPowerFor(B.GOLD);
assert.ok(powerWood<powerIron*.25,'wood mining iron/gold must be significantly slower');
s.player.selected=0;
s.blockHardnessAt=()=>4;
const woodDuration=s.miningSecondsFor(B.GOLD)*1.56;
s.player.selected=1;
const ironDuration=s.miningSecondsFor(B.GOLD)*1.56;
assert.ok(woodDuration>ironDuration*4);
s.player.selected=0;
s.paused=false;s.input.mouseLeft=true;
s.voxelRaycast=()=>({x:0,y:10,z:0,id:B.GOLD,normal:[0,1,0]});
s.enemyRayHit=()=>null;s.editKey=(x,y,z)=>`${x},${y},${z}`;s.fallenLogDamage=new Map();
s.setMiningHud=()=>{};s.spawnDebris=()=>{};s.sfx=()=>{};
s.soundMaterialForBlock=()=> 'ore';s.emitPlayerNoise=()=>{};s.showMessage=()=>{};s.refreshHotbar=()=>{};
s.updateMining(.48);
assert.ok(s.player.slots[0]?.wear>19,'mid-mining tool must wear before gold ore breaks');
assert.ok(s.mineAmount<.1,'wood pickaxe must not instantly break gold');
assert.ok(s.canMineWithEquipped(B.GOLD));
s.player.selected=3;assert.equal(s.canMineWithEquipped(B.GOLD),false,'bare hands cannot mine ore');
// Real offhand placement while tool is selected; consume offhand, not inventory.
s.player.selected=0;s.player.offhand={id:'torch',count:2};
s.voxelRaycast=()=>({id:B.STONE,x:1,y:10,z:1,normal:[0,1,0]});
s.playerAabbAt=()=>[100,100,100,101,101,101];
s.getBlock=()=>B.AIR;const placed=[];s.setBlock=(x,y,z,id)=>placed.push([x,y,z,id]);
s.torchMounts=new Map();s.fortKey=s.editKey;s.isUpgradeableBlockId=()=>false;
s.furnaces=new Map();s.refreshInventoryUI=()=>{};
s.useSelected();
assert.deepEqual(placed,[[1,11,1,B.TORCH]]);
assert.equal(s.player.offhand.count,1,'torch consumed from correct hand');
assert.equal(s.player.slots[0].id,'wood_pickaxe');
assert.deepEqual(s.torchMounts.get('1,11,1'),[0,1,0]);
// Persistent impact damage and flora crushing under horizontal logs.
const data=new Map(),changes=new Map(),debris=[];const K=(x,y,z)=>`${x},${y},${z}`;
for(let x=0;x<6;x++)data.set(K(x,8,0),B.DIRT);
data.set(K(1,9,0),B.RED_FLOWER);
const t={B,edits:changes,WORLD_H:96,blockDefs:{[B.DIRT]:{solid:true},[B.WOOD]:{solid:true,drop:'wood'},[B.RED_FLOWER]:{decor:true}},
  editKey:K,getBlock:(x,y,z)=>data.get(K(x,y,z))||0,
  setBlock:(x,y,z,id)=>{data.set(K(x,y,z),id);changes.set(K(x,y,z),id)},
  spawnDebris:(...args)=>debris.push(args),spawnParticle(){},spawnItemDrop(){},sfx(){},showMessage(){}};
installTree(t);
t.settleFallingTree({id:B.WOOD,root:[0,9,0],dx:1,dz:0,logs:[9,10,11,12].map(y=>[0,y,0,B.WOOD]),leaves:[[0,13,0,B.LEAVES]],height:4});
assert.equal(data.get(K(1,9,0)),B.WOOD,'falling logs must crush flowers');
assert.ok(debris.some(a=>a[3]===B.RED_FLOWER),'destroyed flower produces debris');
assert.ok([...t.fallenLogDamage.values()].every(x=>x>=.05&&x<=.30));
assert.ok(t.fallenLogDamage.size>1);
// Cave creature never causes synchronous chunk generation during spawn search.
let probed=0,spawns=0,paths=0;
const c={player:{pos:[0,10,0]},B,CHUNK:16,WORLD_H:96,enemyDefs:{hollowed:{radius:.5,height:1.65,speed:1.03,damage:20,name:'Wydrążony'}},
  enemies:[],terrainHeight:()=>50,floorDiv:(a,b)=>Math.floor(a/b),chunkKey:(a,b)=>`${a},${b}`,chunks:new Map(),
  blockDefs:{[B.DIRT]:{solid:true}},peekLoadedBlock:(x,y,z)=>{probed++;return y===9?B.DIRT:B.AIR},
  spawnEnemy:(...args)=>{spawns++;return {type:'hollowed',pos:args[4].pos}},
  playerNoiseEvents:[],turnAngle:(from,to)=>to,navCanGo:()=>10,entityCollides:()=>false,
  planEnemyPath:()=>{paths++;return []},sfx(){},hurtPlayer(){}};
installCave(c);c.spawnCaveHollowed();
assert.equal(probed,0,'unloaded caves must not be probed');assert.equal(spawns,0);
// Patch known candidate chunk during a deterministic sample.
const realRandom=Math.random;
try{Math.random=()=>.5;c.chunks.set('-2,0',{});const e=c.spawnCaveHollowed();assert.ok(e);assert.equal(spawns,1);}
finally{Math.random=realRandom;}
const e={type:'hollowed',pos:[1,10,1],attack:0,flash:0,listenTimer:0,noiseMemory:0,
 wander:0,wanderTimer:3,facing:0,renderFacing:0,navTimer:0,navPath:[],gait:0,voice:100};
c.updateCaveHollowed(e,.1);
assert.equal(paths,0,'blind monster may not magically plan toward a silent player');
assert.ok(!e.noiseTarget);
c.playerNoiseEvents.push({pos:[7,10,1],intensity:1,age:0,ttl:4,radius:23});
e.listenTimer=0;c.updateCaveHollowed(e,.1);
assert.ok(paths>=1,'noise causes pursuit path planning');
assert.ok(e.noiseMemory>0);
// Six-sided progressively revealed thin fracture mesh (geometry not text matching).
const gl={ARRAY_BUFFER:1,STATIC_DRAW:2,createBuffer:()=>({}),bindBuffer(){},bufferData(){},getAttribLocation:()=>0,getUniformLocation:()=>({})};
const r={gl,faces:[],B,itemDefs:{},makeProgram:()=>({})};installEntities(r);
assert.equal(r.crackVerts.length,24*36*3);
for(let k=0;k<24;k++){
  const i=k*108,arr=r.crackVerts.slice(i,i+18);
  // Each incremental fracture adds a nonzero XY-area triangle on the first face.
  const a=arr.slice(0,3),b=arr.slice(3,6),d=arr.slice(6,9);
  const twiceArea=Math.abs((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]));
  assert.ok(twiceArea>1e-8,`non-degenerate new crack segment at stage ${k}`);
}
const audio=JSON.parse(readFileSync(new URL('data/audio.json',base),'utf8'));
for(const key of ['hollowed_breath','hollowed_attack']){assert.ok(audio[key]);const file=new URL(audio[key],base);assert.ok(existsSync(file)&&statSync(file).size>2048);}
assert.equal(CURRENT_SAVE_VERSION,24);
for(const needle of ['lastDeathPosition','fallenLogDamage'])assert.match(readFileSync(new URL('src/save/compat.js',base),'utf8'),new RegExp(needle));
assert.match(readFileSync(new URL('style.css',base),'utf8'),/\.durability-track/);
console.log('V21_FEATURES_PASS wood-vs-iron ore power, real-time wear, offhand torch, crushed flora, fallen-log cracks, cave AI sound-only & unloaded chunk safety, 24-stage six-face crack mesh, audio and saves');
