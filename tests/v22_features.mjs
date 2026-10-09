import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadGameData} from '../src/data/loader.js';
import {install as installMath} from '../src/math/matrix.js';
import {install as installNoise} from '../src/world/noise.js';
import {install as installRegistry} from '../src/data/registry.js';
import {install as installWorldgen} from '../src/world/worldgen.js';
import {install as installSkills} from '../src/sim/skills.js';
import {install as installNavigation} from '../src/sim/mobs/navigation.js';
import {migrateSave,CURRENT_SAVE_VERSION} from '../src/save/migrations.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync((u instanceof URL?u:new URL('.'+u,root)),'utf8'))});
const data=await loadGameData();
const S={GAME_DATA:data};installMath(S);installNoise(S);installRegistry(S);installWorldgen(S);
assert.equal(CURRENT_SAVE_VERSION,24);
assert.equal(S.B.CAMPFIRE,94);
assert.equal(data.items.campfire.place,S.B.CAMPFIRE);
assert.ok(data.recipes.some(r=>r.out.campfire===1&&r.key.S==='stick'&&r.key.C==='cobble'));
assert.equal(data.blocks.definitions[S.B.CAMPFIRE].solid,false);
assert.ok(fs.readFileSync(new URL('../src/render/equipment-models.js',import.meta.url),'utf8').includes("if(id==='campfire')"));
assert.ok(fs.readFileSync(new URL('../src/render/scene.js',import.meta.url),'utf8').includes('S.renderCampfires'));
assert.match(fs.readFileSync(new URL('../src/render/scene.js',import.meta.url),'utf8'),/angle=\.40,rx=nz\*angle,rz=-nx\*angle/,'wall-mounted shaft must tilt towards the torch head');
const stage={};
for(const seed of ['nightcraft','nightcraft-two','testing']){
 S.worldSeed=S.hashString(seed);S.worldgenVersion=22;
 let outcrop=null,wreck=null;
 for(let cz=-20;cz<=20&&(!outcrop||!wreck);cz++)for(let cx=-20;cx<=20&&(!outcrop||!wreck);cx++){
   outcrop??=S.outcropForCell(cx,cz);wreck??=S.wreckForCell(cx,cz);
 }
 assert.ok(outcrop&&wreck,`V22 outcrop+shipwreck available for ${seed}`);
 const rot=(dx,dz,r)=>r===0?[dx,dz]:r===1?[-dz,dx]:r===2?[-dx,-dz]:[dz,-dx];
 const [rx,rz]=rot(-1,-3,wreck.rot);
 const chestX=wreck.x+rx,chestZ=wreck.z+rz;
 const chestChunk=S.generateChunkData(S.floorDiv(chestX,16),S.floorDiv(chestZ,16));
 assert.equal(chestChunk[S.idx3(S.mod(chestX,16),wreck.y+1,S.mod(chestZ,16))],S.B.CHEST,`sunken chest missing for ${seed}`);
 const oreChunk=S.generateChunkData(S.floorDiv(outcrop.x,16),S.floorDiv(outcrop.z,16));
 assert.ok(oreChunk.some(v=>v===S.B.COBBLE),'ore outcrop must have exposed stone');
 assert.deepEqual(oreChunk,S.generateChunkData(S.floorDiv(outcrop.x,16),S.floorDiv(outcrop.z,16)),'new world deterministic');
 stage[seed]=[outcrop.x,outcrop.z,wreck.x,wreck.z];
 S.worldgenVersion=21;
 assert.equal(S.outcropForCell(0,0),null,'old saves do not receive deposits');
 assert.equal(S.wreckForCell(0,0),null,'old saves do not receive wrecks');
}
const saved={version:23,worldgenVersion:21,waypoint:{x:-424,z:838},edits:[['1,2,3',S.B.TORCH]]};
const updated=migrateSave(saved);
assert.equal(updated.version,24);assert.equal(updated.worldgenVersion,21);
assert.deepEqual(updated.waypoint,{x:-424,z:838});assert.deepEqual(updated.edits,saved.edits);
const U={B:S.B,clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x)),player:{health:35,pos:[0,24,0]},enemies:[],WORLD_H:96,xp:90,
 playerLevel(){return Math.floor(this.xp/90)},getBlock(){return 0},scanCooldown:0,showMessage(){},sfx(){},dist3(){return 100}};
installSkills(U);U.activateXray();
assert.equal(U.player.health,45,'level 1 X heals one full heart = 10 HP');assert.equal(U.scanDuration,14);assert.equal(U.scanCooldown,45);
U.scanCooldown=0;U.xp=450;U.activateXray();
assert.ok(U.player.health>65,'higher X skills heal more');assert.ok(U.scanDuration>19,'duration increases with level');
const fragment=fs.readFileSync(new URL('../src/render/shaders/voxel.frag.glsl',import.meta.url),'utf8');
const vertex=fs.readFileSync(new URL('../src/render/shaders/voxel.vert.glsl',import.meta.url),'utf8');
assert.match(vertex,/uniform mediump float uWater/);assert.match(vertex,/swell=/);assert.match(fragment,/foam=smoothstep/);
const input=fs.readFileSync(new URL('../src/ui/inventory.js',import.meta.url),'utf8');
assert.match(input,/S.clearInventoryHover/);assert.match(input,/S\.waypoint = S\.waypoint/);assert.match(input,/ev.button===2/);
const mini=fs.readFileSync(new URL('../src/ui/minimap.js',import.meta.url),'utf8');
assert.match(mini,/S\.mapView\?\.radius/);assert.match(mini,/if\(S\.waypoint\)/);
// Verify wolves and boars have nontrivial, capped anticipation and cooldown.
const nav=fs.readFileSync(new URL('../src/sim/mobs/navigation.js',import.meta.url),'utf8');
assert.match(nav,/e\.pounceWindup=\.43/);assert.match(nav,/e\.pounceCooldown=9\+Math\.random\(\)\*5/);
assert.match(nav,/e\.type==='wolf'\|\|e\.type==='boar'/);
// Live state-machine check: windup, burst, impact once, and no burst spam.
{
 const d={speed:4.15,radius:.42,height:.58,aggro:25,hp:30,damage:12,name:'wilk',passive:false,night:false};
 const w={type:'wolf',pos:[.5,0,.5],velY:0,grounded:true,age:0,attack:0,flash:0,gait:0,
 spotted:true,track:20,awareness:1,sightAwareness:1,hearingAwareness:0,voice:10,wander:1.57,wanderTimer:5,
 facing:1.57,renderFacing:1.57,stuck:0,navTimer:2,navPath:[],lastSeen:[4,.5],lookTimer:1,lookOffset:0,roamPause:0,pounceCooldown:0};
 let hits=0;
 const Q={player:{pos:[4.5,0,.5],vel:[0,0,0]},enemies:[w],enemyDefs:{wolf:d},difficulty:'normal',WORLD_H:96,
 blockDefs:[{solid:false},{solid:true}],B:{AIR:0,WATER:9,ICE:99},currentWorldHour:()=>14,playerNearBuiltBase:()=>false,
 updateWolfAwareness:()=>({los:true}),strongestPlayerNoiseForWolf:()=>null,wolfLineOfSight:()=>true,
 angleDelta:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),turnAngle:(a,b,step)=>a+Math.max(-step,Math.min(step,Math.atan2(Math.sin(b-a),Math.cos(b-a)))),
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),getBlock:(x,y,z)=>y<0?1:0,isFoliage:()=>false,
 playerAabbAt:()=>{},sfx:()=>{},predatorSeparation:()=>[0,0],predatorFormationTarget:(e,x,z)=>[x,z],
 predatorObstacle:()=>null,damageObstacleByPredator:()=>false,cleanupEnemies:()=>{},hurtPlayer:()=>{hits++},
 entityCollides:(x,y)=>y<0};
 installNavigation(Q);Q.planEnemyPath=()=>[];
 Q.updateEnemies(.05,.6);
 assert.ok(w.pounceWindup>.4,'wolf must visibly prepare before leaping');
 assert.ok(w.pounceCooldown>8,'pounce must have a long cooldown');
 let jumped=false;
 for(let i=0;i<15;i++){
   if(i===8)Q.player.pos=[w.pos[0]+.5,0,w.pos[2]];
   Q.updateEnemies(.05,.6);
   if(w.pounceBurst>0)jumped=true;
 }
 assert.ok(jumped,'lunge is reached after warning window');
 assert.ok(w.pounceHit,'the pounce can connect when player is within reach');
 assert.equal(hits,1,'one leap cannot register repeated impacts');
}
console.log('V22_FEATURES_PASS 3 seeds shipwreck chests + mineral outcrops, old generation isolated, campfire craft & models, waypoint migration, X healing growth, water shaders, UI cleanup, leap cooldown');
