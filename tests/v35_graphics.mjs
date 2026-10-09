import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildAtlasMipmaps} from '../src/render/atlas-mips.js';
import {DEFAULT_GRAPHICS,DEFAULT_SEED,normalizeGraphics,zoomFov} from '../src/render/graphics-config.js';
import {columnWaterDepth,vertexWaterDepth} from '../src/render/water-depth.js';
import {install as worldAPI} from '../src/world/world-api.js';
import {install as crops} from '../src/render/crops.js';
assert.equal(DEFAULT_GRAPHICS.renderDistance,12);
assert.equal(DEFAULT_SEED,'hollow-pines-317');
assert.deepEqual(normalizeGraphics(),DEFAULT_GRAPHICS);assert.deepEqual(normalizeGraphics(null),DEFAULT_GRAPHICS);
assert.equal(normalizeGraphics({renderDistance:999}).renderDistance,24);
assert.equal(normalizeGraphics({renderDistance:NaN}).renderDistance,12);
assert.equal(normalizeGraphics({renderDistance:-4,resolution:5}).renderDistance,2);
assert.equal(normalizeGraphics({resolution:5}).resolution,1.5);
assert.ok(Math.abs(zoomFov(Math.PI/3,1)-Math.PI/12)<1e-12);
assert.equal(zoomFov(Math.PI/3,0),Math.PI/3);
const B={AIR:0,WATER:9,DIRT:2},W=16,H=96;
const S={B,CHUNK:W,WORLD_H:H,chunks:new Map(),chunkKey:(x,z)=>x+','+z,idx3:(x,y,z)=>y*256+z*16+x,floorDiv:(x,n)=>Math.floor(x/n),mod:(x,n)=>(x%n+n)%n,atlas:{cols:8,rows:15,tile:24,stride:32,gutter:4,uvRows:16}};
worldAPI(S);
const c={cx:0,cz:0,data:new Uint8Array(W*W*H)};S.chunks.set('0,0',c);
for(let z=0;z<16;z++)for(let x=0;x<16;x++){
 const depth=x<8?2:10;
 c.data[S.idx3(x,29-depth,z)]=B.DIRT;
 for(let y=30-depth;y<30;y++)c.data[S.idx3(x,y,z)]=B.WATER;
}
assert.equal(columnWaterDepth(S,2,2,30),2);
assert.equal(columnWaterDepth(S,10,2,30),10);
assert.equal(vertexWaterDepth(S,8,2,30),6,'bank vertices blend neighboring depths');
assert.equal(vertexWaterDepth(S,-64,-64,30),2,'unloaded water uses fallback without generating chunks');
assert.equal(S.chunks.size,1);
for(const tile of [0,6,60,112,113,115])for(const u of [0,1])for(const v of [0,1]){
 const uv=S.tileUV(tile,u,v),col=tile%8,row=Math.floor(tile/8);
 assert.ok(uv[0]*256>col*32+4&&uv[0]*256<col*32+28);
 assert.ok(uv[1]*512>row*32+4&&uv[1]*512<row*32+28);
}
let meshBuilds=0,draws=0;const farm={id:'starter',x:0,y:28,z:0,width:13,depth:11,plots:[{x:0,z:0,type:0,growth:.9},{x:1,z:0,type:1,growth:.6},{x:2,z:0,type:2,growth:.4}]};
const C={gl:{CULL_FACE:1,disable(){},enable(){}},villagePlan:{farms:[farm]},hash2i:()=>.25,hasHeldTorch:()=>false,renderDistance:12,frameDay:1,graphics:DEFAULT_GRAPHICS,ensureVillageFarms:()=>[farm],tileUV:S.tileUV,atlas:S.atlas,CHUNK:16,makeMeshBuffers:(p,n,u,w,t,sky)=>{meshBuilds++;assert.equal(w.length,p.length/3);assert.equal(sky.length,w.length);return{count:w.length};},drawVoxelMesh:()=>draws++,deleteMesh(){},chunkLampUniforms:()=>null,sunLevel:()=>1};
crops(C);C.renderVillageCrops(null,[0,0,0],[0,30,0],C.villagePlan);C.renderVillageCrops(null,[0,0,0],[1,30,0],C.villagePlan);
assert.equal(meshBuilds,1,'walking does not rebuild farm geometry');assert.equal(draws,2,'one farm draw per frame');
farm.plots[0].growth=.05;C.renderVillageCrops(null,[0,0,0],[1,30,0],C.villagePlan);assert.equal(meshBuilds,2,'harvesting changes visible height');
const sounds=['swim','swim_stroke_2','swim_stroke_3'].map(n=>fs.readFileSync(new URL('../assets/audio/'+n+'.wav',import.meta.url)));
for(const b of sounds){assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),44100);let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i))/32767);assert.ok(peak>.2&&peak<.4,'gentle strokes retain ample headroom');}
assert.notDeepEqual(sounds[0],sounds[1]);
const mip=buildAtlasMipmaps(new Uint8Array([60,100,40,255,0,0,0,0,0,0,0,0,0,0,0,0]),2,2,2);assert.deepEqual([...mip[1].data],[60,100,40,64],'transparent black cannot darken a filtered plant');
console.log('V35_GRAPHICS_PASS default12/max24, zoom, depth interpolation, loaded-only water probes, padded UVs, cached crop batching, three unclipped water strokes');
