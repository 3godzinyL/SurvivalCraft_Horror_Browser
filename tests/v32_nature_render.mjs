import assert from 'node:assert/strict';
import fs from 'node:fs';
import {install as flora} from '../src/render/flora.js';
const root=new URL('../',import.meta.url);
const blocks=JSON.parse(fs.readFileSync(new URL('../data/blocks.json',import.meta.url),'utf8'));
const B=blocks.ids,W=16,H=96;
const S={
  B,CHUNK:16,WORLD_H:H,worldSeed:0x2a3265,
  blockDefs:blocks.definitions,
  isFoliage:id=>[B.LEAVES,B.PINELEAVES,B.BIRCHLEAVES,B.DARKLEAVES,B.AUTUMNLEAVES,B.WILLOWLEAVES,B.POPLARLEAVES].includes(id),
  idx3:(x,y,z)=>((y*16+z)*16+x),
  hash2i:(x,z,seed)=>{let n=(Math.imul(x,0x45d9f3b)^Math.imul(z,0x119de1f3)^seed)|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>13),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;},
  tileUV:(i,u,v)=>[(i%8+.001+u*.998)/8,(Math.floor(i/8)+.001+v*.998)/14],
  makeMeshBuffers:(p,n,uv,wind,tint)=>({p,n,uv,wind,tint,count:p.length/3}),
};
flora(S);
assert.equal(S.floraProfiles.totalBiomes,30);
function chunkFor(biome,kind){
 S.biomeAt=()=>biome;
 const data=new Uint8Array(W*H*W);
 for(let z=0;z<W;z++)for(let x=0;x<W;x++){
   data[S.idx3(x,27,z)]=kind==='water'?B.MUD:B.GRASS;
   if(kind==='water')data[S.idx3(x,28,z)]=B.WATER;
   if(kind==='roof')data[S.idx3(x,29,z)]=B.STONE;
 }
 return {cx:1,cz:2,data};
}
const plain=S.buildChunkFlora(chunkFor('flower_meadow','ground'));
assert.ok(plain && plain.count>1000,'flower meadow must create many plant blades');
assert.equal(plain.p.length/3,plain.count);
assert.equal(plain.n.length,plain.p.length);
assert.equal(plain.wind.length,plain.count);
assert.equal(plain.tint.length,plain.count*3);
assert.equal(plain.uv.length,plain.count*2);
assert.ok(plain.uv.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
assert.ok(plain.p.every(Number.isFinite));
const repeat=S.buildChunkFlora(chunkFor('flower_meadow','ground'));
assert.deepEqual(repeat.p,plain.p,'visuals must be deterministic');
assert.deepEqual(repeat.tint,plain.tint,'colors must be deterministic');
const pine=S.buildChunkFlora(chunkFor('taiga','ground'));
assert.ok(pine && pine.count<plain.count,'biome density changes');
assert.notDeepEqual(pine.tint.slice(0,3),plain.tint.slice(0,3),'separate biome palette');
const marsh=S.buildChunkFlora(chunkFor('marsh','water'));
assert.ok(marsh && marsh.count>60,'marsh must have real emergent water vegetation');
const snow=S.buildChunkFlora(chunkFor('snow_peaks','water'));
assert.equal(snow,null,'ice and frozen water must stay clear');
assert.equal(S.buildChunkFlora(chunkFor('meadow','roof')),null,'no foliage grows through roofs');
const s=fs.readFileSync(new URL('../src/render/scene.js',import.meta.url),'utf8');
assert.match(s,/for \(const c of S\.chunks\.values\(\)\) \{\s*if \(!visibleChunk\(c\)\) continue;\s*S\.activeChunkLamps/s);
assert.match(s,/S\.drawVoxelMesh\(c\.water,[\s\S]+?S\.renderParticles/);
const v=fs.readFileSync(new URL('../src/render/shaders/voxel.vert.glsl',import.meta.url),'utf8');
const f=fs.readFileSync(new URL('../src/render/shaders/voxel.frag.glsl',import.meta.url),'utf8');
assert.match(v,/attribute vec3 aTint/);assert.match(v,/vTint=aTint/);
assert.match(f,/vTint/);assert.match(f,/vDepth/);assert.match(f,/uReflectionTex/);
console.log('V32_NATURE_RENDER_PASS determinism, 30 biome palettes, water flowers/reeds, roof rejection, tinted UV vertices, active shader + repaired scoped loops');
