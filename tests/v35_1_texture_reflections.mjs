import assert from 'node:assert/strict';
import {buildLeafTile} from '../src/render/leaf-texture.js';
import {install as reflections} from '../src/render/water-reflections.js';
for(const id of [6,18,25,32,35,55,67,69]){
 const a=buildLeafTile([57,75,49],id),b=buildLeafTile([57,75,49],id);
 assert.deepEqual(a,b,'foliage is deterministic');
 let holes=0;const colors=new Set();
 for(let i=0;i<a.length;i+=4){assert.ok(a[i+3]===0||a[i+3]===255,'no translucent leaf sorting');if(!a[i+3])holes++;else colors.add(a.slice(i,i+3).join(','));}
 assert.ok(holes/576>.10&&holes/576<.30,'canopy has controlled gaps, not an opaque slab');
 assert.ok(colors.size>=24,'leaves retain veins and local detail');
}
assert.notDeepEqual(buildLeafTile([57,75,49],6),buildLeafTile([57,75,49],18),'tree species vary');
const noop=()=>{},gl={};
for(const k of ['TEXTURE_2D','RGBA','UNSIGNED_BYTE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','NEAREST','FRAMEBUFFER','RENDERBUFFER','DEPTH_COMPONENT16','COLOR_ATTACHMENT0','DEPTH_ATTACHMENT','FRAMEBUFFER_COMPLETE','BLEND','CULL_FACE','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE'])gl[k]=k;
for(const k of ['bindTexture','texImage2D','texParameteri','deleteFramebuffer','deleteRenderbuffer','bindFramebuffer','framebufferTexture2D','bindRenderbuffer','renderbufferStorage','framebufferRenderbuffer','viewport','depthMask','disable','enable','clearColor','clear'])gl[k]=noop;
for(const k of ['createTexture','createFramebuffer','createRenderbuffer'])gl[k]=()=>({});
gl.checkFramebufferStatus=()=>gl.FRAMEBUFFER_COMPLETE;
let visible=true,draws=0,now=1000;
const realPerformance=globalThis.performance;
Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
try{
 const S={gl,graphics:{water:2,resolution:1},cameraMode:0,SEA:20,CHUNK:16,WORLD_H:96,worldSeed:123,canvas:{width:1280,height:800},worldSeconds:100,DAY_SECONDS:1000,
 chunks:new Map([['near',{cx:0,cz:0,water:{},opaque:{},renderMaxY:35}],['far',{cx:40,cz:0,water:{},opaque:{},renderMaxY:35}]]),framePlanes:[],aabbInFrustum:()=>visible,
 M4:{identity:()=>[],lookAt:(eye,target)=>[...eye,...target],multiply:(_p,v)=>v},extractFrustumPlanes:()=>[],chunkLampUniforms:()=>null,drawVoxelMesh:()=>draws++};
 reflections(S);
 const view={cam:[8,30,8],dir:[0,0,-1],proj:[1,0,0,0,0,1],sky:[.2,.3,.3],day:1,fogColor:[0,0,0],torchPos:[0,0,0],torchPower:0};
 const update=()=>S.refreshWaterReflection(view);
 update();assert.equal(S.waterReflection.passes,1);assert.equal(draws,1,'far chunks are not drawn into reflection');
 now+=16;update();assert.equal(S.waterReflection.passes,1,'stationary camera reuses reflection');
 view.cam[0]+=.02;update();assert.equal(S.waterReflection.passes,2,'walking refreshes within one frame');
 now+=16;view.dir[0]=.002;update();assert.equal(S.waterReflection.passes,3,'turning refreshes within one frame');
 view.proj[0]=2;update();assert.equal(S.waterReflection.passes,4,'zoom updates projection immediately');
 visible=false;view.cam[0]++;update();assert.equal(S.waterReflection.passes,4,'invisible water costs no pass');
 visible=true;update();assert.equal(S.waterReflection.passes,5,'looking back never reuses stale view');
 now+=101;update();assert.equal(S.waterReflection.passes,6,'idle wind can refresh');
 S.graphics.water=1;view.cam[0]++;update();assert.equal(S.waterReflection.passes,6,'lower quality skips planar reflection');
 S.graphics.water=2;update();assert.equal(S.waterReflection.passes,7);
 view.cam[1]=20;update();assert.equal(S.waterReflection.passes,7,'underwater camera skips reflection');
}finally{Object.defineProperty(globalThis,'performance',{configurable:true,value:realPerformance});}
console.log('V35_1_TEXTURE_REFLECTION_PASS perforated detailed leaves; per-frame camera/zoom reflection; stationary reuse; invisible/underwater/low-quality pass skipped');

