import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadGameData} from '../src/data/loader.js';
import {install as math} from '../src/math/matrix.js';
import {install as noise} from '../src/world/noise.js';
import {install as registry} from '../src/data/registry.js';
import {install as worldgen} from '../src/world/worldgen.js';
import {install as worldApi} from '../src/world/world-api.js';
import {selectVillageSite,BUILDINGS,buildUserStructure,villageIslandHeight} from '../src/world/village-worldgen.js';
import {install as village,canPlacePrefab,updateVillagerAI,VILLAGER_ROLES} from '../src/sim/village.js';
import {install as storage} from '../src/save/compat.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(u instanceof URL?u:new URL(String(u),root),'utf8'))});
const d=await loadGameData();
const S={GAME_DATA:d};math(S);noise(S);registry(S);worldgen(S);worldApi(S);
S.player={pos:[0,35,0]};S.running=true;S.paused=false;S.worldSeconds=800;S.DAY_SECONDS=1200;S.currentWorldHour=()=>14;
S.enemies=[];S.showMessage=()=>{};S.saveGame=()=>{};S.sfx=()=>{};S.dirtyChunks=new Set();
S.markDirty=()=>{};S.isUpgradeableBlockId=()=>false;S.fallenLogDamage=new Map();S.enemyBlockDamage=new Map();
let first;
for(const seed of ['nightcraft','nightcraft-two','testing']){
 S.worldSeed=S.hashString(seed);S.worldgenVersion=26;S.villagePlan=null;S.edits.clear();S.chunks.clear();
 const chosen=selectVillageSite(S,S.player.pos),distance=Math.hypot(chosen.x,chosen.z);
 assert.ok(distance>=255&&distance<=455,'island should be approximately 270–430 m from spawn');
 S.villagePlan=chosen;
 assert.equal(S.terrainHeight(chosen.x,chosen.z),S.SEA+6,'island ground must be flat');
 assert.equal(villageIslandHeight(S,chosen.x+58,chosen.z,45),S.SEA-3,'village should be surrounded by water');
 const tile=(x,y,z)=>{const chunk=S.generateChunkData(S.floorDiv(x,16),S.floorDiv(z,16));return chunk[S.idx3(S.mod(x,16),y,S.mod(z,16))];};
 for(const b of BUILDINGS){const bx=chosen.x+b.dx,bz=chosen.z+b.dz;
  assert.ok(tile(bx,chosen.y-(b.type==="farm"||b.type==="well"?1:0),bz)!==S.B.AIR,`missing ${b.type} at ${bx},${bz}`);
 }
 assert.equal(tile(chosen.x,chosen.y,chosen.z),S.B.OLD_PLANKS,'mill must have a timber floor');
 assert.equal(tile(chosen.x,chosen.y+1,chosen.z+8),S.B.WOOD_DOOR,'mill entrance must contain a functional wood door');
 assert.equal(tile(chosen.x,chosen.y+32,chosen.z),S.B.WOOD,'mill must have high finial');
 const cx=S.floorDiv(chosen.x,16),cz=S.floorDiv(chosen.z,16);
 const a=S.generateChunkData(cx,cz),b=S.generateChunkData(cx,cz);
 assert.deepEqual(a,b,`deterministic village chunk for ${seed}`);
 if(!first)first=chosen;
 // Village is V26 only; V22 worlds do not acquire built-up island geometry.
 S.worldgenVersion=22;assert.equal(villageIslandHeight(S,chosen.x,chosen.z,43),43);
 S.worldgenVersion=26;
}
// Verify the actual worker receives the village descriptor and produces the
// same chunk bytes as synchronous terrain generation across the same seed.
{
 S.worldSeed=first.seed;S.worldgenVersion=26;S.villagePlan=first;S.edits.clear();
 const cx=S.floorDiv(first.x,16),cz=S.floorDiv(first.z,16),direct=S.generateChunkData(cx,cz);
 const responses=[];globalThis.self={postMessage:(data)=>responses.push(data)};
 await import('../src/world/worker/world-worker.js');
 self.onmessage({data:{type:'init',token:126,seed:S.worldSeed,worldgenVersion:26,villagePlan:first,gameData:d}});
 self.onmessage({data:{type:'generate',token:126,cx,cz}});
 assert.deepEqual(new Uint8Array(responses.at(-1).buffer),direct,'worker must generate the same village as the main thread');
}
const V={...S};V.player={pos:[first.x,first.y+1,first.z],yaw:0};V.villagePlan={...first,buildings:[],stock:{wood:0,stone:0,iron:0}};
V.worldSeed=first.seed;V.worldgenVersion=26;V.running=true;V.paused=false;
V.chunks=new Map();V.edits=new Map();V.dirtyChunks=new Set();V.fortifications=new Map();V.torchMounts=new Map();V.furnaces=new Map();V.enemyBlockDamage=new Map();
V.ensureChunk=(cx,cz)=>{const k=V.chunkKey(cx,cz);if(!V.chunks.has(k))V.chunks.set(k,{cx,cz,data:V.generateChunkData(cx,cz),dirty:false});return V.chunks.get(k);};
const inventory={wood:130,cobble:15};const added={};V.countItem=id=>(inventory[id]||0)+(added[id]||0);
V.removeItem=(id,n)=>{if(inventory[id] >= n)inventory[id]-=n;else added[id]-=n;};
V.addItem=(id,n)=>{added[id]=(added[id]||0)+n;return true;};V.inventoryCapacity=()=>100;
V.UI={villageResources:{textContent:''},villagePopulation:{textContent:''},villageHouseBtn:{disabled:false},villageWallBtn:{disabled:false},villageRepairBtn:{disabled:false}};
V.LOG_INGREDIENTS=S.LOG_INGREDIENTS;V.currentWorldHour=()=>14;V.showMessage=()=>{};V.sfx=()=>{};
const oldSet=V.setBlock;V.setBlock=(...args)=>oldSet(...args);
village(V);V.villagePlan={...first,buildings:[],stock:{wood:0,stone:0,iron:0},integrity:70};
assert.ok(V.craftVillageKit('house'));assert.equal(inventory.wood,40);assert.equal(added.village_house_kit,1);
assert.ok(V.craftVillageKit('wall'));assert.equal(inventory.wood,13);assert.equal(added.village_wall_kit,1);
const prefab=[];buildUserStructure(V,'wall',first.x+41,first.y+1,first.z,(...a)=>prefab.push(a));
assert.equal(prefab.filter(row=>row[3]===S.B.REINFORCED_WOOD).length,9);
assert.ok(V.isNearVillage(42));
const startWork=first;V.player.pos=[startWork.x+10,first.y+1,startWork.z];
// Preload the city district for citizen pathfinding (no synchronous expansion).
for(let cx=V.floorDiv(first.x-48,16);cx<=V.floorDiv(first.x+48,16);cx++)for(let cz=V.floorDiv(first.z-48,16);cz<=V.floorDiv(first.z+48,16);cz++)V.ensureChunk(cx,cz);
updateVillagerAI(V,.05);assert.equal(V.villagePlan.citizens.length,7);
const initial=V.villagePlan.citizens.map(c=>[...c.pos]);
for(let i=0;i<200;i++){V.worldSeconds+=.05;updateVillagerAI(V,.05);}
assert.ok(V.villagePlan.citizens.some((c,i)=>Math.hypot(c.pos[0]-initial[i][0],c.pos[2]-initial[i][2])>2),'villagers must leave houses and move to work');
V.currentWorldHour=()=>21;
for(let i=0;i<300;i++){V.worldSeconds+=.05;updateVillagerAI(V,.05);}
assert.equal(V.villagePlan.sheltered,true);assert.equal(V.villagePlan.doorsClosed,true);
// Saved descriptor restores enough structure and citizens to continue the same world.
const raw=structuredClone(V.villagePlan);V.restoreVillageQuest(raw);assert.equal(V.villagePlan.x,first.x);assert.equal(V.villagePlan.citizens.length,7);
assert.equal(d.items.village_house_kit.name,'Projekt domu osadnika');assert.ok(d.items.village_wall_kit);
console.log('V26_VILLAGE_PASS three seeded near-spawn islands; buildings + chunk parity; 90/27 timber costs; 3x3 walls; seven moving villagers, nightly doors, saved quest');
