import assert from 'node:assert/strict';
import {install as installNav} from '../src/sim/mobs/navigation.js';
const S={WORLD_H:96,B:{WATER:9,ICE:99},blockDefs:[{solid:false},{solid:true}],
 getBlock(x,y,z){if(y<10)return 1; if(x===2 && z>=-2&&z<=2 && y<12)return 1;return 0},
 isFoliage:()=>false};
S.entityCollides=(x,y,z,r,h)=>{
 if(y<10)return true;
 return x+r>2&&x-r<3&&z+r>-2&&z-r<3&&y<12&&y+h>10;
};
installNav(S);
const e={pos:[.5,10,.5]},d={radius:.42,height:.58};
const p=S.planEnemyPath(e,5.5,.5,d,550);
assert.ok(p.length>=6,'wolf should plan around the wall via one of two openings');
for(const [x,z] of p)assert.ok(S.navCanGo(Math.floor(x),Math.floor(z),10,.35,.4)!==null,'route waypoint must be traversable');
assert.ok(p.some(([x,z])=>Math.abs(z)>2.5),'route must go around a wall, not through it');
assert.ok(Math.abs(p.at(-1)[0]-5.5)<2.1,'route must approach player on other side');
console.log('V16_MAZE_PASS detour around 5-block barrier; each waypoint traversable');
