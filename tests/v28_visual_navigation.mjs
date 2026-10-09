import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadGameData} from '../src/data/loader.js';
import {install as math} from '../src/math/matrix.js';
import {install as noise} from '../src/world/noise.js';
import {install as registry} from '../src/data/registry.js';
import {install as worldgen} from '../src/world/worldgen.js';
import {install as worldApi} from '../src/world/world-api.js';
import {install as heldBlock} from '../src/render/held-block.js';
import {villageRoute} from '../src/ui/village-ui.js';
const base=new URL('../',import.meta.url);
globalThis.fetch=async p=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(p instanceof URL?p:new URL(String(p),base),'utf8'))});
const S={GAME_DATA:await loadGameData()};
math(S);noise(S);registry(S);worldgen(S);worldApi(S);
S.worldgenVersion=26;S.worldSeed=S.hashString('v28-geometry');
S.villagePlan={x:320,z:160,y:S.SEA+6,buildings:[],stock:{}};
const v=S.villagePlan;
const mock={createBuffer:()=>({}),bindBuffer:()=>{},bufferData:()=>{},deleteBuffer:()=>{},getAttribLocation:()=>1,getUniformLocation:()=>({}),ARRAY_BUFFER:34962,STATIC_DRAW:35044};
S.gl=mock;S.makeProgram=()=>({});S.atlas={cols:12,rows:12,tile:16};S.blockTile=S.GAME_DATA.blocks.numericTiles;
heldBlock(S);
const read=(x,y,z)=>S.getBlock(x,y,z);
for(const [dx,dz] of [[-12,-35],[-12,-25],[-12,-13]]){
 const step=dz+35,level=v.y-Math.floor(Math.max(0,step)/3);
 assert.equal(read(v.x+dx,level-1,v.z+dz),S.B.COBBLE,'a true solid mine floor exists');
 assert.equal(read(v.x+dx,level,v.z+dz),S.B.AIR,'mine tunnel entry is walkable');
 assert.equal(read(v.x+dx,level+1,v.z+dz),S.B.AIR,'mine has head clearance');
}
assert.equal(read(v.x-12,v.y+5,v.z-36),S.B.DARK_PLANKS,'portal lintel is built');
assert.equal(read(v.x-18,v.y+3,v.z+4),S.B.TORCH,'village lamppost is generated');
// Fences must exist in opaque chunk buffers EVEN WHEN NO USER EDIT WAS MADE.
// V31: the perimeter deliberately has only scattered unfinished fences.
const fy=v.y;
const fenceSamples=[];
for(let z=-46;z<=46;z++)for(let x=-46;x<=46;x++){
  const r=Math.hypot(x,z);
  if(r<=44||r>=46)continue;
  fenceSamples.push([v.x+x,v.z+z]);
}
const partial=fenceSamples.filter(([x,z])=>read(x,fy,z)===S.B.WOOD_FENCE);
assert.ok(partial.length>0&&partial.length<fenceSamples.length*.55,'perimeter must contain gaps for the player to complete');
const [fx,fz]=partial[0];
const chunk=S.ensureChunk(S.floorDiv(fx,S.CHUNK),S.floorDiv(fz,S.CHUNK));
assert.ok(!S.edits.has(S.editKey(fx,fy,fz)),'procedural fence has no player edit');
S.rebuildChunk(chunk);
assert.ok(chunk.opaque?.count>0,'fence mesh drawn');
assert.ok(chunk.torches?.length>0,'procedural torch cache created');
assert.equal(S.shouldExpose(S.B.OLD_PLANKS,S.B.WOOD_FENCE),true,'voxel walls are not culled against partial geometry');
const P=[],N=[],U=[],W=[];
S.appendFenceMesh(P,N,U,W,fx,fy,fz);
assert.ok(P.length>=108,'post has 6 true textured faces');
assert.equal(U.length,P.length/3*2,'each fence triangle vertex has atlas UVs');
assert.ok(U.every(Number.isFinite),'no invalid UVs');
// A compass with a NORTH-pointing glyph is correct when yaw == desired bearing.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html, /id="villageQuestArrow"[^>]*>▲<\/span>/);
const css=fs.readFileSync(new URL('../styles-village.css',import.meta.url),'utf8');
assert.match(css,/\.village-quest-hud\s*\{\s*position:fixed;left:auto;right:85px;top:264px/);
const routes=[[150,0],[0,150],[0,-150],[-160,140],[-250,0],[100,-100]];
for(const [dx,dz] of routes){
 let x=v.x+dx,z=v.z+dz,arrived=false;
 for(let i=0;i<1600;i++){
  const route=villageRoute(v,x,z),a=route.target.x-x,b=route.target.z-z,d=Math.hypot(a,b);
  assert.ok(Number.isFinite(d));
  if(Math.hypot(x-v.x,z-v.z)<16){arrived=true;break;}
  if(d<.001)break;
  x+=a/d;z+=b/d;
 }
 assert.ok(arrived,`route from ${dx},${dz} must reach the mill rather than orbit forever`);
}
console.log('V28_VISUAL_NAVIGATION_PASS atlas-textured fence mesh + partial-block occlusion, torch cache, lamp posts, underground mine entrance and routes from 6 shores');
