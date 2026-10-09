import assert from 'node:assert/strict';
import fs from 'node:fs';
import {install as structures} from '../src/sim/structures.js';
import {install as tactics} from '../src/sim/mobs/predator-tactics.js';
import {install as flying} from '../src/sim/mobs/flying.js';

const root=new URL('../',import.meta.url);
const B=JSON.parse(fs.readFileSync(new URL('data/blocks.json',root),'utf8')).ids;
const blocks=JSON.parse(fs.readFileSync(new URL('data/blocks.json',root),'utf8')).definitions;
const items=JSON.parse(fs.readFileSync(new URL('data/items.json',root),'utf8'));
const rec=JSON.parse(fs.readFileSync(new URL('data/recipes.json',root),'utf8'));
for(const [id,ingredient] of [['reinforced_wood','planks'],['reinforced_cobble','cobble'],['reinforced_stone','stone'],['reinforced_iron','iron_ingot']]){
  const r=rec.find(r=>r.out?.[id]);
  assert.ok(r,`missing 3x3 recipe for ${id}`);
  assert.deepEqual(r.pattern,['XXX','XXX','XXX']);
  assert.equal(r.key.X,ingredient);
  assert.equal(items[id].place,B[id.toUpperCase()]);
}
let currentId=B.REINFORCED_WOOD;
const inv={reinforced_wood:18};
const key='1,2,3';
const hit={x:1,y:2,z:3,id:currentId};
const names=['fortifyHud','fortifyName','fortifyHp','fortifyFill','fortifyNext'];
const UI=Object.fromEntries(names.map(k=>[k,{textContent:'',style:{},classList:{toggle(){}}}]));
const S={B,blockDefs:blocks,fortifications:new Map(),edits:new Map([[key,currentId]]),furnaces:new Map(),WORLD_H:96,worldSeconds:10,
  player:{pos:[0,2,0],toolSwing:0},input:{mouseMiddle:true},UI,itemDefs:items,enemies:[],enemyDefs:{wolf:{name:'wilk',damage:10,radius:.4}},
  voxelRaycast:()=>hit,eyePos:()=>[0,0,0],lookDir:()=>[0,0,1],getBlock:()=>currentId,
  spawnDebris:()=>{},sfx:()=>{},showMessage:()=>{},
  countItem:id=>inv[id]||0,removeItem:(id,count)=>{if((inv[id]||0)<count)return false;inv[id]-=count;return true},
  setBlock:(x,y,z,id)=>{currentId=id},clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
  soundMaterialForBlock:()=> 'wood',get target(){return hit},
};
structures(S);tactics(S);
const f=S.ensureFortification(1,2,3,currentId,true);
assert.equal(f.family,B.REINFORCED_WOOD);
assert.equal(S.wallStats(f).level,0);
assert.equal(f.maxHp,165);
for(const [i,cost] of [[1,3],[2,6],[3,9]]){
  const before=inv.reinforced_wood;
  S.updateUpgrade(.76);
  assert.equal(f.level,i,`fortification must reach tier ${i}`);
  assert.equal(inv.reinforced_wood,before-cost,`tier ${i} must deduct ${cost}`);
  assert.equal(f.hp,f.maxHp);
}
S.updateUpgrade(2);assert.equal(f.level,3);assert.equal(inv.reinforced_wood,0);
let hits=0;
const wolf={type:'wolf',pos:[1.5,2,2.55],attack:0,velY:0};
S.enemies=[wolf];
assert.ok(S.canPredatorBreakBlock(wolf,currentId,1,2,3));
while(currentId!==B.AIR&&hits<250){wolf.attack=0;const okay=S.damageObstacleByPredator(wolf,S.enemyDefs.wolf,hit);assert.ok(okay);hits++;}
assert.ok(hits>20&&hits<250,'reinforced wall should take sustained attacks');
assert.equal(currentId,B.AIR);
S.enemies=[];
S.player.pos=[4,2,5];S.findSurface=()=>2;
S.WORLD_H=96;S.currentNightNumber=()=>1;
S.spawnEnemy=(type,x,z)=>{const e={type,pos:[x,2,z],age:0,gait:0,skyState:'patrol',attack:0,flash:0,velY:0};S.enemies.push(e);return e;};
S.wolfLineOfSight=()=>true;S.hurtPlayer=()=>{};S.turnAngle=(a,b,step)=>a+Math.max(-step,Math.min(step,b-a));
S.enemyDefs.night_moth={name:'nocny zwiadowca',speed:7,damage:3,flying:true};
S.enemyDefs.night_harrier={name:'nocny łowca',speed:8,damage:5,flying:true};
flying(S);
assert.ok(S.spawnNightFlyer());assert.ok(S.spawnNightFlyer());assert.equal(S.spawnNightFlyer(),null,'first night cap 2');
const flyer=S.enemies[0];S.enemies.push({type:'wolf',pos:[flyer.pos[0],2,flyer.pos[2]],spotted:false,awareness:0});
S.updateFlyingPredator(flyer,S.enemyDefs.night_moth,.12,.9);
assert.equal(flyer.spotted,true);assert.equal(S.enemies.at(-1).spotted,true,'spotter must alert nearby wolf');
assert.ok(flyer.pos[1]>2,'flying entity must leave surface');
S.enemies=[];S.currentNightNumber=()=>4;
assert.equal(S.spawnNightFlyer().type,'night_harrier','evolved variant after night three');
console.log('V16_FEATURES_PASS 4 wall recipes; 3-tier costs/HP; breakable fort; capped aerial scout, pack signal and evolution');
