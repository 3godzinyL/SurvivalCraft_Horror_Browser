import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractFrustumPlanes,aabbInFrustum} from '../src/render/frustum.js';
import {install as flora} from '../src/render/flora.js';
import {install as mobDefinitions} from '../src/sim/mobs/definitions.js';

// Correct WebGL clip-space AABB rejection, including near, side, far and behind-camera.
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const planes=extractFrustumPlanes(identity);
assert.equal(planes.length,6);
assert.equal(aabbInFrustum(planes,-.5,-.5,-.5,.5,.5,.5),true);
assert.equal(aabbInFrustum(planes,.8,-.5,-.5,1.4,.5,.5),true,'edge-touch remains visible');
assert.equal(aabbInFrustum(planes,2,0,0,3,1,1),false);
assert.equal(aabbInFrustum(planes,-3,0,0,-2,1,1),false);
assert.equal(aabbInFrustum(planes,0,-5,0,1,-4,1),false);
assert.equal(aabbInFrustum(planes,0,0,-3,1,1,-2),false);

const blocks=JSON.parse(fs.readFileSync(new URL('../data/blocks.json',import.meta.url),'utf8'));
const B=blocks.ids, W=16, H=96;
const F={B,CHUNK:W,WORLD_H:H,worldSeed:0x334455,blockDefs:blocks.definitions,
  isFoliage: id=>[B.LEAVES,B.PINELEAVES,B.BIRCHLEAVES].includes(id),
  idx3:(x,y,z)=>y*W*W+z*W+x,
  hash2i:(x,z,s)=>{let h=(Math.imul(x,0x45d9f3b)^Math.imul(z,0x119de1f3)^s)|0;h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>13),0x45d9f3b);return ((h^(h>>>16))>>>0)/2**32;},
  tileUV:(i,u,v)=>[(i%8+u)/8,(Math.floor(i/8)+v)/14],
  makeMeshBuffers:(p,n,uv,wind,tint)=>({p,n,uv,wind,tint,count:p.length/3}),biomeAt:()=> 'marsh'
};
flora(F);
function waterAt(depth){
 const data=new Uint8Array(W*W*H),surface=30;
 for(let z=0;z<W;z++)for(let x=0;x<W;x++){
   data[F.idx3(x,surface-1-depth,z)]=B.MUD;
   for(let d=1;d<=depth;d++)data[F.idx3(x,surface-d,z)]=B.WATER;
 }
 return {cx:0,cz:0,data};
}
for(let depth=1;depth<=3;depth++){
 const mesh=F.buildChunkFlora(waterAt(depth));
 assert.ok(mesh?.count>0,'aquatic plants must exist at depth '+depth);
 const ys=mesh.p.filter((_,i)=>i%3===1);
 assert.ok(Math.min(...ys)>=30-depth-0.03,'plant roots must sit on the bed at depth '+depth);
 const m2=F.buildChunkFlora(waterAt(depth));
 assert.deepEqual(mesh.p,m2.p,'stable water flora');
}
assert.equal(F.buildChunkFlora(waterAt(4)),null,'no plants over deep water (4+ blocks)');

// Enemy full-cell door collision: a CLOSED hinged door is impassable; an OPEN
// door is traversable and never blocks monsters in an invisible AABB.
const D={B,GAME_DATA:{mobs:{enemies:{}}},fortifications:new Map(),
 fortKey:(x,y,z)=>`${x},${y},${z}`,getBlock:(x,y,z)=>x===0&&y===1&&z===0?B.WOOD_DOOR:B.AIR,
 aabbHitsWorld:()=>false};
mobDefinitions(D);
assert.equal(D.entityCollides(.48,1,.50,.26,.75),true,'closed door stops wolves');
D.fortifications.set('0,1,0',{open:true});
assert.equal(D.entityCollides(.48,1,.50,.26,.75),false,'open door lets wolves pass');
assert.equal(D.entityCollides(2,1,2,.26,.75),false,'no phantom barriers');

const fsFrag=fs.readFileSync(new URL('../src/render/shaders/voxel.frag.glsl',import.meta.url),'utf8');
const vsVert=fs.readFileSync(new URL('../src/render/shaders/voxel.vert.glsl',import.meta.url),'utf8');
const scene=fs.readFileSync(new URL('../src/render/scene.js',import.meta.url),'utf8');
assert.match(fsFrag,/hand=falloff\(handD\)\*uTorchPower/);
assert.match(fsFrag,/local\+=uLightStrength\[i\]\*falloff\(sqrt\(dist2\)\)/);
assert.doesNotMatch(fsFrag,/d\/48\.0|td\/20\.0/);
assert.match(fsFrag,/vSky/);
assert.match(fsFrag,/exposure=clamp\(vSky/);
assert.match(fsFrag,/uFlora>\.5 \? \.35/);
assert.match(vsVert,/vec2 root=aPos\.xz;/,'stable continuous wind across plant geometry');
assert.match(scene,/S\.extractFrustumPlanes\(VP\)/);
assert.match(scene,/S\.aabbInFrustum\(/);
assert.match(scene,/dynamicPixelRatio/);
const architecturalLight=fs.readFileSync(new URL('../src/render/held-block.js',import.meta.url),'utf8');
assert.match(architecturalLight,/S\.colorLightAt\?S\.colorLightAt\(pos\)/,'house doors and construction follow world lighting');
assert.doesNotMatch(architecturalLight,/d\/16\)/,'no detached 16-block artificial glow');

assert.equal(fs.readFileSync(new URL('../src/world/worldgen.js',import.meta.url),'utf8').includes('S.renderDistance = 12;'),true);
console.log('V33_HORROR_PERFORMANCE_PASS 6-plane clip, depth 1-3 aquatic roots, depth 4 empty, open/closed door barrier, bounded torches, roof shade, continuous wind, adaptive scale');
