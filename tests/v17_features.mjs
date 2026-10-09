import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadGameData} from '../src/data/loader.js';
import {install as installMath} from '../src/math/matrix.js';
import {install as installNoise} from '../src/world/noise.js';
import {install as installRegistry} from '../src/data/registry.js';
import {install as installWorldgen} from '../src/world/worldgen.js';
import {install as installHorror} from '../src/sim/horror/events.js';
import {install as installPhysics} from '../src/sim/physics.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync((u instanceof URL?u:new URL('.'+u,root)),'utf8'))});
const data=await loadGameData();
assert.equal(data.ruins.types.length,18,'two old wooden house archetypes');
for(const id of ['field_herbs','moonflower','blood_petal','forest_poultice','healing_wrap','hunter_salve']) assert.ok(data.items[id],`medicinal item missing ${id}`);
for(const id of ['forest_poultice','healing_wrap','hunter_salve','bandage']) assert.ok(data.recipes.some(r=>Object.hasOwn(r.out,id)),`healing recipe missing ${id}`);
for(const url of Object.values(data.audio)) assert.ok(fs.existsSync(new URL('../'+url,import.meta.url)),`missing audio ${url}`);
const S={GAME_DATA:data}; installMath(S);installNoise(S);installRegistry(S);installWorldgen(S);
S.worldSeed=S.hashString('v17-houses-test');S.worldgenVersion=17;
let found=null;
for(let cz=-14;cz<=14&&!found;cz++)for(let cx=-14;cx<=14&&!found;cx++){
 const r=S.ruinCandidateForCell(cx,cz);
 if(!r||!r.type.includes('wood_house'))continue;
 if(S.mod(r.gx,S.CHUNK)<5||S.mod(r.gx,S.CHUNK)>10||S.mod(r.gz,S.CHUNK)<5||S.mod(r.gz,S.CHUNK)>10)continue;
 found=r;
}
assert.ok(found,'new wooden house archetype should be reachable in random worldgen');
const cx=S.floorDiv(found.gx,S.CHUNK),cz=S.floorDiv(found.gz,S.CHUNK);
const chunk=S.generateChunkData(cx,cz);
const rot=(dx,dz)=>found.rot===0?[dx,dz]:found.rot===1?[-dz,dx]:found.rot===2?[-dx,-dz]:[dz,-dx];
const blockAt=(dx,dy,dz)=>{const [x,z]=rot(dx,dz);return chunk[S.idx3(S.mod(found.gx+x,S.CHUNK),found.y+dy,S.mod(found.gz+z,S.CHUNK))];};
assert.equal(blockAt(-2,-4,1),S.B.CHEST, 'cellar contains a chest');
assert.equal(blockAt(2,1,2),S.B.CHEST,'house contains a chest');
assert.equal(blockAt(0,-5,0),S.B.STONE_BRICKS,'basement foundation generated');
assert.ok([S.B.AIR,S.B.STONE_BRICKS].includes(blockAt(0,-3,0)),'basement interior accessible');
S.worldgenVersion=16;
const old=S.ruinCandidateForCell(found.cellX,found.cellZ);
assert.ok(old&&!old.type.includes('wood_house'),'old save must never acquire new structure archetype');
S.DAY_SECONDS=1200;S.gl={createBuffer:()=>({})};installPhysics(S);
for(const [h,v] of [[18.9,1],[19,1],[21.2,.045],[23,.045]]) {
 S.worldSeconds=h*1200/24;assert.ok(Math.abs(S.sunLevel()-v)<.000001,`sun at ${h}: ${S.sunLevel()}`);
}
const H={player:{pos:[0,10,0],yaw:0,pitch:0,threat:0,sanity:100},blockDefs:{2:{solid:true}},getBlock:(x,y,z)=>z===-1&&y===11?2:0,clamp:(a,min,max)=>Math.max(min,Math.min(max,a)),B:{},};
installHorror(H);
assert.ok(H.closeFrontOcclusion()>.5,'close forward wall should cover more than half sampled screen');
H.getBlock=()=>0;assert.equal(H.closeFrontOcclusion(),0,'clear line of sight should not trigger obstruction');
console.log(`V17_FEATURES_PASS all healing crafts/audio present; houses with cellar + 2 chests (${found.type}); sunset >=19:00; occlusion sampled correctly; legacy structure pool unchanged`);
