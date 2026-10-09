import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {install as installShadows,sampleColumnTop,SHADOW_SIZE,SHADOW_STEP} from '../src/render/shadows.js';
import {install as installMobs} from '../src/sim/mobs/definitions.js';
import {install as installLeaves} from '../src/render/leaves.js';

// Spatial shadow map: leaves cast from their real loaded voxel heights, no chunk generation.
const B={AIR:0,DIRT:2,WOOD:5,LEAVES:6,WATER:9,ICE:10};
const data=new Uint8Array(16*96*16),idx=(x,y,z)=>y*256+z*16+x;
for(let y=0;y<11;y++)data[idx(4,y,6)]=B.DIRT;
data[idx(4,13,6)]=B.WOOD;data[idx(4,18,6)]=B.LEAVES;
let heightCalls=0;
const S={B,CHUNK:16,WORLD_H:96,LEAF_BLOCKS:new Set([B.LEAVES]),
  chunks:new Map([['0,0',{data}]]),chunkKey:(x,z)=>`${x},${z}`,idx3:idx,
  terrainHeight:()=>{heightCalls++;return 11},blockDefs:{[B.DIRT]:{solid:true},[B.WOOD]:{solid:true},[B.LEAVES]:{solid:true}}};
assert.equal(sampleColumnTop(S,4,6),19,'tree crown must cast a shadow');
assert.equal(sampleColumnTop(S,64,6),0,'unloaded chunks never generate terrain');
assert.equal(S.chunks.size,1);
assert.equal(SHADOW_SIZE,128);assert.equal(SHADOW_STEP,2);
let uploads=0;
const gl={TEXTURE_2D:3553,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,
 TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,NEAREST:9728,CLAMP_TO_EDGE:33071,
 RGBA:6408,UNSIGNED_BYTE:5121,TEXTURE0:33984,TEXTURE1:33985,
 createTexture:()=>({}),bindTexture(){},texParameteri(){},texImage2D(){},activeTexture(){},
 texSubImage2D(){uploads++}};
S.gl=gl;S.running=true;S.player={pos:[5,12,7]};
installShadows(S);
for(let i=0;i<22;i++) S.updateSunShadows(.016);
assert.ok(S.sunShadow.valid,'height texture should become available progressively');
assert.equal(uploads,1,'should upload once, not every frame after finishing');
for(let i=0;i<20;i++) S.updateSunShadows(.016);
assert.equal(uploads,1,'do not re-upload unchanged pixels every frame');
S.player.pos[0]+=32;S.updateSunShadows(.016);
assert.equal(S.sunShadow.valid,false,'on relocation stale shadow texture must be hidden');
for(let i=0;i<22;i++) S.updateSunShadows(.016);
assert.equal(uploads,2);

// Boars should spawn during day from the start, not only in night-four roster.
const mobs=JSON.parse(readFileSync(new URL('../data/mobs.json',import.meta.url),'utf8'));
const animals={GAME_DATA:{mobs},enemyDefs:mobs.enemies,predatorSequence:1,B:{AIR:0,WATER:9,ICE:10},
  player:{pos:[0,10,0],attackCooldown:0,toolSwing:0,toolSwingSide:1},
  biomeAt:()=> 'forest',currentNightNumber:()=>1};
installMobs(animals);
let originalRandom=Math.random;
try{
  Math.random=()=>.04;
  assert.equal(animals.choosePassiveSpawnType(2,3),'boar');
  Math.random=()=>.15;
  assert.notEqual(animals.choosePassiveSpawnType(2,3),'boar');
}finally{Math.random=originalRandom;}
assert.equal(animals.enemyDefs.boar.passive,undefined);
const audio=JSON.parse(readFileSync(new URL('../data/audio.json',import.meta.url),'utf8'));
assert.ok(audio.boar_grunt_1 && audio.boar_grunt_2); 
let cow={type:'cow',pos:[3,10,0],hp:50,knockVel:null,velY:0,navPath:[[5,5]],navGoal:[5,5],navHalt:1,roamPause:4,stuck:2};
animals.enemies=[cow];animals.enemyRayHit=()=>({e:cow,t:2});animals.itemDefs={};
animals.selectedItem=()=>'';animals.heldDamage=()=>2;animals.wearHeldTool=()=>{};
animals.spawnBlood=()=>{};animals.sfx=()=>{};animals.showMessage=()=>{};
assert.equal(animals.attackEnemy(),true);
assert.ok(cow.fleeTimer>=8,'wounded cow must remember attack');
assert.deepEqual(cow.fleeOrigin,[0,0]);
assert.equal(cow.navHalt,0);assert.equal(cow.roamPause,0);
assert.deepEqual(cow.navPath,[],'attacked cow must replan immediately');

// Impact canopy emits richer leaf sprites and is capacity-bounded.
const leafS={B:{...B,AUTUMNLEAVES:11,BIRCHLEAVES:12,PINELEAVES:13,DARKLEAVES:14,WILLOWLEAVES:15,POPLARLEAVES:16,MIMOSALEAVES:17},
  player:{pos:[0,5,0],vel:[0,0,0]},worldSeconds:0,weatherIntensity:0};
installLeaves(leafS);
const crash={root:[0,8,0],dx:1,dz:0,height:8,
  leaves:Array.from({length:90},(_,i)=>[i%4,16,0,B.LEAVES])};
const emitted=leafS.emitTreeCrashLeaves(crash,9);
assert.ok(emitted>=100,'fallen canopy needs a dense impact burst');
assert.ok(leafS.fallingLeaves.some(p=>p.vel[1]>1 && p.spinSpeed!==0));
for(let i=0;i<5;i++)leafS.emitTreeCrashLeaves(crash,9);
assert.ok(leafS.fallingLeaves.length<=520,'maximum leaf budget enforced');

const vert=readFileSync(new URL('../src/render/shaders/voxel.vert.glsl',import.meta.url),'utf8');
const frag=readFileSync(new URL('../src/render/shaders/voxel.frag.glsl',import.meta.url),'utf8');
assert.match(vert,/canopy=1\.0-step/);
assert.match(frag,/uniform sampler2D uShadowHeight/);
assert.match(frag,/sunVisibility/);
assert.match(readFileSync(new URL('../src/render/scene.js',import.meta.url),'utf8'),/S\.updateSunShadows/);
console.log('V20_FEATURES_PASS streamed voxel/canopy shadows, safe relocation, single GPU upload, daytime boars, passive flight on hit, dense capped crown impact, stronger wind shader');
