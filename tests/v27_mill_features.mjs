import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadGameData} from '../src/data/loader.js';
import {install as math} from '../src/math/matrix.js';
import {install as noise} from '../src/world/noise.js';
import {install as registry} from '../src/data/registry.js';
import {install as worldgen} from '../src/world/worldgen.js';
import {install as worldApi} from '../src/world/world-api.js';
import {install as structures} from '../src/sim/structures.js';
import {install as village,updateVillagerAI,canPlacePrefab} from '../src/sim/village.js';
import {villageRoute} from '../src/ui/village-ui.js';
import {selectVillageSite} from '../src/world/village-worldgen.js';
const base=new URL('../',import.meta.url);
globalThis.fetch=async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(u instanceof URL?u:new URL(String(u),base),'utf8'))});
const data=await loadGameData();
const S={GAME_DATA:data};math(S);noise(S);registry(S);worldgen(S);worldApi(S);structures(S);village(S);
S.worldgenVersion=26;S.worldSeed=S.hashString('test-v27-mill');S.player={pos:[0,35,0],yaw:0,pitch:0};S.worldSeconds=390;S.DAY_SECONDS=1200;
S.currentWorldHour=()=>14;S.running=true;S.paused=false;S.enemies=[];S.showMessage=()=>{};S.saveGame=()=>{};S.sfx=()=>{};
S.villagePlan=selectVillageSite(S,S.player.pos);const v=S.villagePlan;S.player.pos=[v.x+12,v.y+1,v.z+12];
// Loaded chunk integration: generated doors are not player edits.
for(let cx=S.floorDiv(v.x-48,16);cx<=S.floorDiv(v.x+48,16);cx++)for(let cz=S.floorDiv(v.z-48,16);cz<=S.floorDiv(v.z+48,16);cz++)S.ensureChunk(cx,cz);
const door=[v.x,v.y+1,v.z+8];
assert.equal(S.peekLoadedBlock(...door),S.B.WOOD_DOOR);
assert.equal(S.edits.has(S.editKey(...door)),false);
updateVillagerAI(S,.05);
assert.equal(S.villagePlan.citizens.length,7);
const f=S.ensureFortification(...door,S.B.WOOD_DOOR,true);
assert.ok(f,'generated door should get metadata despite lacking an edit');
assert.equal(f.open,true,'daylight door is open without deleting the block');
const atStart=v.citizens.map(n=>[...n.pos]);
for(let i=0;i<360;i++)updateVillagerAI(S,.05);
assert.ok(v.citizens.slice(0,4).some((n,i)=>Math.hypot(n.pos[0]-atStart[i][0],n.pos[2]-atStart[i][2])>2),'real mill workers should navigate in loaded voxel town');
assert.equal(S.peekLoadedBlock(...door),S.B.WOOD_DOOR,'daylight does not delete door');
// Walking through and manually toggling affects true collision behavior.
f.open=false;assert.equal(S.blockDefs[S.peekLoadedBlock(...door)].solid,true);f.open=true;
S.currentWorldHour=()=>21;for(let i=0;i<420;i++)updateVillagerAI(S,.06);
assert.equal(v.doorsClosed,true);assert.equal(f.open,false);assert.equal(S.peekLoadedBlock(...door),S.B.WOOD_DOOR,'night door stays rendered/solid');
S.currentWorldHour=()=>10;updateVillagerAI(S,.05);assert.equal(f.open,true,'doors reopen at dawn');
// The causeway surface must be a gentle grade on the island portion.
for(let dx=-104;dx<-44;dx++){
 const a=S.terrainHeight(v.x+dx,v.z),b=S.terrainHeight(v.x+dx+1,v.z);
 assert.ok(Math.abs(a-b)<=1,`causeway steepness ${dx}: ${a} vs ${b}`);
}
for(const point of [[v.x+115,v.z],[v.x,v.z+115],[v.x-145,v.z]]){
 const r=villageRoute(v,...point);
 assert.ok(Number.isFinite(r.target.x)&&Number.isFinite(r.target.z));
 assert.notEqual(r.stage,'MŁYN','never point to the centre from across water');
}
assert.equal(villageRoute(v,v.x+2,v.z+4).stage,'MŁYN');
// Prefab footprint should accept stable, modified flat loaded ground.
const x=v.x+37,z=v.z+32,y=v.y+1;
for(let xx=x;xx<x+3;xx++){S.setBlock(xx,y-1,z,S.B.COBBLE);for(let yy=y;yy<=y+4;yy++)S.setBlock(xx,yy,z,S.B.AIR);}
S.player.pos=[v.x,v.y+1,v.z];S.villagePreviewAxis='x';
assert.equal(canPlacePrefab(S,'wall',x,y,z).ok,true,'real loaded level ground permits construction: '+JSON.stringify(canPlacePrefab(S,'wall',x,y,z)));
const wood=S.B.REINFORCED_WOOD;
const logInventory={wood:100,cobble:100,iron_ingot:20};
S.countItem=id=>logInventory[id]||0;
S.removeItem=(id,n)=>{logInventory[id]-=n;return true;};
S.LOG_INGREDIENTS=['wood'];
S.inventoryCapacity=()=>100;
S.UI={villageResources:{textContent:''},villagePopulation:{textContent:''},villageHouseBtn:{disabled:false},villageWallBtn:{disabled:false},villageRepairBtn:{disabled:false},villageUpgradeBtn:{disabled:false,textContent:''}};
const wall={type:'wall',x,y,z,axis:'x',level:0};v.buildings.push(wall);
for(let yy=0;yy<3;yy++)for(let xx=x;xx<x+3;xx++)S.setBlock(xx,y+yy,z,wood);
assert.ok(S.upgradeVillageWall(),'miller takes payment to upgrade entire wall');
assert.equal(wall.level,1);assert.equal(logInventory.wood,82);assert.equal(logInventory.cobble,92);
for(let yy=0;yy<3;yy++)for(let xx=x;xx<x+3;xx++){
 const q=S.ensureFortification(xx,y+yy,z,wood,true);
 assert.equal(q.level,1);assert.equal(q.hp,q.maxHp);assert.ok(q.hp>165);
}
S.upgradeVillageWall();S.upgradeVillageWall();assert.equal(wall.level,3);assert.equal(logInventory.iron_ingot,10);
const saved=structuredClone(v);S.restoreVillageQuest(saved);assert.equal(S.villagePlan.buildings.at(-1).level,3);
console.log('V27_MILL_FEATURES_PASS generated hinged door day/night, seven residents, traversable causeway, guidance, ground validation, paid 9-voxel wall upgrades and save');
