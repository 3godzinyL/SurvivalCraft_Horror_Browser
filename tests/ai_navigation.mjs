import assert from 'node:assert/strict';
import {install as installNav} from '../src/sim/mobs/navigation.js';
const def={speed:4.15,radius:.42,height:.58,aggro:25,hp:30,damage:12,name:'wilk',passive:false,night:false};
function enemy(){return {type:'wolf',pos:[0.5,0,0.5],velY:0,grounded:true,age:0,attack:0,flash:0,gait:0,
 spotted:true,track:20,awareness:1,sightAwareness:1,hearingAwareness:0,voice:10,wander:Math.PI/2,wanderTimer:5,
 facing:Math.PI/2,renderFacing:Math.PI/2,stuck:0,navTimer:2,navPath:[],lastSeen:[4.5,.5],lookTimer:1,lookOffset:0,roamPause:0};}
function mockS(){
 const S={player:{pos:[4.5,0,.5]},enemies:[],enemyDefs:{wolf:def},difficulty:'normal',WORLD_H:96,
 blockDefs:[{solid:false},{solid:true}],B:{AIR:0,WATER:9,ICE:99},
 currentWorldHour:()=>14,playerNearBuiltBase:()=>false,
 updateWolfAwareness:()=>({los:true}),strongestPlayerNoiseForWolf:()=>null,
 wolfLineOfSight:()=>true,
 angleDelta:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),
 turnAngle:(a,b,step)=>a+Math.max(-step,Math.min(step,Math.atan2(Math.sin(b-a),Math.cos(b-a)))),
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),getBlock:(x,y,z)=>y<0?1:0,isFoliage:()=>false,
 playerAabbAt:()=>{},sfx:()=>{},damageBarrierByEnemy:()=>{},fortificationInPath:()=>null,
 cleanupEnemies:()=>{},hurtPlayer:()=>{},entityCollides:()=>true};
 installNav(S);return S;
}
const S=mockS(),blocked=enemy();S.enemies=[blocked];
assert.equal(S.navSteerAround(blocked,Math.PI/2,def),null,'all blocked should report no steering solution');
S.planEnemyPath=()=>[];
S.updateEnemies(.05,.6);
assert.ok(blocked.navHalt>0,'blocked enemy should halt without spinning');
assert.equal(blocked.pos[0],.5);assert.equal(blocked.pos[2],.5);
assert.ok(Math.abs(blocked.facing-Math.PI/2)<.01,'facing must not flip 140 degrees at a dead end');

const S2=mockS();const jumper=enemy();S2.enemies=[jumper];jumper.navPath=[[2.5,.5]];
S2.entityCollides=(x,y,z)=> y < -.1 || (x>=.95 && y<.7); // one-block step in front
S2.navFloorAt=(x,z,fromY)=>x>=1?1:0;
S2.getBlock=()=>1;S2.blockDefs[1]={solid:true};
S2.updateEnemies(.05,.6);
assert.ok(jumper.velY>3,'wolf must jump towards valid elevated ground');
assert.ok(jumper.pos[1]>0,'wolf should rise after the jump');
console.log('AI_NAVIGATION_PASS no 360° spin in closed corridor + intentional jump at traversable step');
