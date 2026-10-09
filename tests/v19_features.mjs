import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {install,collectTree,isNaturalRoot,pickFallDirection} from '../src/sim/falling-trees.js';
const B={AIR:0,DIRT:2,WATER:11,WOOD:5,PINEWOOD:17,LEAVES:6,PINELEAVES:18};
const cells=new Map(), edits=new Map(), drops=[], particles=[];
const key=(x,y,z)=>`${x},${y},${z}`;
function place(x,y,z,id,record=false){cells.set(key(x,y,z),id);if(record)edits.set(key(x,y,z),id);}
const S={B,edits,WORLD_H:96,blockDefs:{[B.DIRT]:{solid:true},[B.WOOD]:{solid:true,drop:'wood'},[B.PINEWOOD]:{solid:true,drop:'pinewood'},[B.LEAVES]:{decor:false},[B.WATER]:{solid:false}},
 editKey:key,getBlock:(x,y,z)=>cells.get(key(x,y,z))||0,setBlock:(x,y,z,id)=>place(x,y,z,id,true),
 lookDir:()=>[1,0,-1],sfx(){},showMessage(){},blockParticlePalette:{},spawnParticle:p=>particles.push(p),spawnItemDrop:(id,n,p)=>drops.push([id,n,p])};
install(S);
for(let x=0;x<=14;x++)for(let z=-5;z<=5;z++)place(x,8,z,B.DIRT);
for(let y=9;y<=15;y++)place(0,y,0,B.WOOD);
for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)if(x!==0||z!==0)place(x,15,z,B.LEAVES);
assert.equal(isNaturalRoot(S,0,9,0),true);
assert.equal(isNaturalRoot(S,0,10,0),false,'cutting middle trunk must not trigger felling');
assert.ok(collectTree(S,0,9,0).logs.length>=7);
assert.ok(collectTree(S,0,9,0).leaves.length>=20);
// A placed log cannot be felled even when it looks like a generated one.
for(let y=9;y<=13;y++)place(6,y,0,B.WOOD,true);
assert.equal(isNaturalRoot(S,6,9,0),false);
// A straight weighted look vector falls to a diagonal, not the last sample.
S.lookDir=()=>[1,0,0];
const hit={x:0,y:9,z:0};
for(let i=0;i<7;i++)S.sampleTreeChopAim(hit,.1);
S.lookDir=()=>[0,0,-1];
for(let i=0;i<3;i++)S.sampleTreeChopAim(hit,.1);
assert.equal(S.chopTreeRoot(hit),true);
assert.equal(S.getBlock(0,9,0),B.AIR);
assert.equal(S.fallingTrees.length,1);
const t=S.fallingTrees[0];
assert.ok(t.dx>.8&&t.dz<-.2,`direction should be biased east ${t.dx} ${t.dz}`);
assert.ok(Math.hypot(...pickFallDirection(.7,.3))>.99);
// New assembly must not overwrite player-placed logs or stone/houses.
place(3,10,-1,B.WOOD,true);
for(let i=0;i<80;i++)S.updateFallingTrees(.05);
assert.equal(S.fallingTrees.length,0);
assert.equal(S.getBlock(3,10,-1),B.WOOD);
assert.ok(edits.size>29,'felling recorded all removed voxel edits');
const remainingWood=[...cells].filter(([k,v])=>v===B.WOOD&&k.startsWith('6,')).length;
assert.ok(remainingWood>0,'player structure unchanged');
assert.ok([...cells].some(([k,id])=>id===B.WOOD&&k!==key(3,10,-1)),'fallen log resting on terrain');
assert.ok(drops.length>=0);
assert.ok(particles.length>0,'leaf impact emits debris');
// Matrix of eight compass headings, negative coordinates, and a one-block slope.
for(const [vx,vz] of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]){
  const terrain=new Map(),altered=new Map(),loot=[];
  const root=[-13,24,17];const coord=(x,y,z)=>`${x},${y},${z}`;
  for(let x=-24;x<0;x++)for(let z=0;z<32;z++)terrain.set(coord(x,23+((x+z)%9===0?1:0),z),B.DIRT);
  for(let h=0;h<5;h++)terrain.set(coord(root[0],root[1]+h,root[2]),B.WOOD);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(dx||dz)terrain.set(coord(root[0]+dx,root[1]+5,root[2]+dz),B.LEAVES);
  const sim={B,edits:altered,WORLD_H:96,blockDefs:S.blockDefs,editKey:coord,
    getBlock:(x,y,z)=>terrain.get(coord(x,y,z))||0,setBlock:(x,y,z,id)=>{terrain.set(coord(x,y,z),id);altered.set(coord(x,y,z),id)},
    lookDir:()=>[vx,0,vz],sfx(){},showMessage(){},spawnParticle(){},blockParticlePalette:{},spawnItemDrop:(id,n,pos)=>loot.push(id)};
  install(sim);
  assert.equal(isNaturalRoot(sim,...root),true,'natural root on varied terrain');
  sim.sampleTreeChopAim({x:root[0],y:root[1],z:root[2]},.8);
  assert.equal(sim.chopTreeRoot({x:root[0],y:root[1],z:root[2]}),true);
  for(let n=0;n<48;n++)sim.updateFallingTrees(.05);
  assert.equal(sim.fallingTrees.length,0,'heading '+vx+','+vz);
  assert.ok([...terrain].some(([k,id])=>id===B.WOOD),'fallen logs remain for '+vx+','+vz);
}
// Tiny stump, unsupported wood and a player-planted pole must not initiate a fall.
{
 const data=new Map(), edits=new Map(), K=(x,y,z)=>`${x},${y},${z}`;
 const mock={B,edits,WORLD_H:96,blockDefs:S.blockDefs,editKey:K,getBlock:(x,y,z)=>data.get(K(x,y,z))||0};
 data.set(K(0,5,0),B.WOOD);data.set(K(0,4,0),B.DIRT);
 assert.equal(isNaturalRoot(mock,0,5,0),false,'a single log cannot act like a full tree');
 data.set(K(0,6,0),B.WOOD);data.set(K(0,7,0),B.WOOD);
 assert.equal(isNaturalRoot(mock,0,5,0),true);
 edits.set(K(0,7,0),B.WOOD);
 assert.equal(isNaturalRoot(mock,0,5,0),false,'a player extension invalidates native-trunk assumption');
 edits.clear();data.delete(K(0,4,0));
 assert.equal(isNaturalRoot(mock,0,5,0),false,'floating columns are not native roots');
}
// Save changes remain additive, no change of existing data ids.
const compat=readFileSync(new URL('../src/save/compat.js',import.meta.url),'utf8');
assert.match(compat,/fallingTrees:\s*\(S\.fallingTrees/);
assert.match(compat,/Array\.isArray\(d\.fallingTrees\)/);
const renderer=readFileSync(new URL('../src/render/scene.js',import.meta.url),'utf8');
assert.match(renderer,/cameraUnderwater = S\.getBlock/);
assert.doesNotMatch(renderer,/let fogColor = S\.player\.inWater/);
assert.match(renderer,/S\.renderFallingTrees/);
const cracks=readFileSync(new URL('../src/render/entities.js',import.meta.url),'utf8');
assert.match(cracks,/S\.crackStages=24/);
assert.match(cracks,/S\.crackVertsPerStage=36/);
assert.match(renderer,/Math\.ceil\(visual \* S\.crackStages\) \* S\.crackVertsPerStage/);
assert.match(renderer,/S\.drawEquipmentModel/);
console.log('V19_FEATURES_PASS natural vs player logs, direction weighted over chop, falling/landing, foliage particles, persisted animation, camera eye filter, 6-face staged cracks, unified equipment');
