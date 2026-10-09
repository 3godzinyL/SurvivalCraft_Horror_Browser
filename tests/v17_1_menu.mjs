import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {install as installWorldApi} from '../src/world/world-api.js';
import {install as installMenuScene} from '../src/render/menu-scene.js';

const shader = (name) => readFileSync(new URL('../src/render/shaders/' + name, import.meta.url), 'utf8');
for (const name of ['voxel.vert.glsl', 'voxel.frag.glsl']) {
  assert.match(shader(name), /uniform\s+mediump\s+float\s+uTime\s*;/, name + ' must match precision in both stages');
  for (const [kind, type] of [['vWorld','vec3'], ['vNormal','vec3'], ['vUV','vec2']])
    assert.match(shader(name), new RegExp('varying\\s+mediump\\s+'+type+'\\s+'+kind+'\\s*;'));
}
for (const file of ['../src/render/held-block.js','../src/render/entities.js']) {
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 assert.doesNotMatch(source,/varying\s+(?!mediump|lowp|highp)vec[234]/,'Inline shader varyings must have a shared precision: '+file);
}
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html, /id="menuLeafFx"/);
assert.match(html, /assets\/favicon\.svg/);
assert.ok(existsSync(new URL('../assets/favicon.svg',import.meta.url)));

const ids = JSON.parse(readFileSync(new URL('../data/blocks.json',import.meta.url),'utf8'));
let meshCalls = [], drawCalls = [], screenW = 1280, screenH = 720;
const ctx = new Proxy({}, { get(target, prop) { if (prop === 'setTransform' || prop === 'clearRect' || prop === 'save' || prop === 'restore' || prop === 'translate' || prop === 'rotate' || prop === 'scale' || prop === 'beginPath' || prop === 'moveTo' || prop === 'lineTo' || prop === 'closePath' || prop === 'fill' || prop === 'stroke') return () => {}; return target[prop]; }, set(target,p,v){target[p]=v;return true;} });
const canvas = {width:0,height:0,getContext(){return ctx;}};
const menu = { classList:{ contains(k){return k==='active';} } };
globalThis.document = {getElementById(id){return id==='mainMenu' ? menu : id==='menuLeafFx' ? canvas : null;}};
globalThis.window = {innerWidth:screenW,innerHeight:screenH,devicePixelRatio:1};
globalThis.innerWidth = screenW; globalThis.innerHeight = screenH;
const gl = {DEPTH_TEST:1,LEQUAL:2,CULL_FACE:3,BACK:4,COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,BLEND:5,SRC_ALPHA:6,ONE_MINUS_SRC_ALPHA:7,enable(){},depthFunc(){},cullFace(){},clearColor(){},clear(){},disable(){},blendFunc(){},depthMask(){}};
const S = {gl,B:ids.ids,blockTile:ids.numericTiles,atlas:{cols:8,rows:14,tile:24}, canvas:{width:1280,height:720},
 isFoliage(id){return [6,18,25,27,28,47].includes(id);},
 makeMeshBuffers(p,n,u,w){ assert.equal(p.length,n.length);assert.equal(p.length/3,u.length/2);assert.equal(p.length/3,w.length);const mesh={count:p.length/3,windy:w.filter(v=>v>0).length}; meshCalls.push(mesh);return mesh;},
 drawVoxelMesh(mesh,alpha){drawCalls.push({mesh,alpha});},
 M4:{perspective(){return [];},lookAt(){return [];},multiply(){return [];}}
};
installWorldApi(S);
S.pushDecorMesh=(P,N,U,W,x,y,z,id)=>{
 for (let k=0;k<12;k++){
  const uv=S.tileUV(S.tileFor(id,'side'),(k%2),((k>>1)%2));
  P.push(x+.2+k%3*.18,y+.15+k%4*.12,z+.2+k%2*.21);N.push(0,1,0);U.push(...uv);W.push(180);
 }
};
installMenuScene(S);
S.renderMainMenuBackdrop();
assert.equal(meshCalls.length,2,'terrain and river should make separate GPU buffers');
assert.ok(meshCalls[0].count>9000,'a large real textured voxel landscape should be generated');
assert.ok(meshCalls[1].count>100,'river should have textured, animated water geometry');
assert.ok(meshCalls[0].windy>500,'trees and grass must sway in the shader');
assert.equal(drawCalls.length,2,'both water and terrain should be drawn');
assert.ok(canvas.width>0 && canvas.height>0,'fallen-leaf overlay should resize and paint');
S.renderMainMenuBackdrop();
assert.equal(meshCalls.length,4,'progressive menu must build another terrain/water sector on the next frame');
for(let frame=2;frame<36;frame++) S.renderMainMenuBackdrop();
assert.equal(S.menuPreviewInfo.chunkRadius,12,'menu radius must be twelve chunks');
assert.equal(S.menuPreviewInfo.totalChunks,576,'preview 24x24 chunk footprint');
assert.equal(S.menuPreviewInfo.builtSectors,36,'all 36 GPU mesh sectors must stream in');
assert.deepEqual(S.menuPreviewInfo.generatedBounds,{minX:-192,minZ:-192,maxX:192,maxZ:192},'preview must cover twelve chunks in all directions');
assert.equal(meshCalls.length,72,'36 cached terrain and water meshes');
const built=meshCalls.length;
S.renderMainMenuBackdrop();
assert.equal(meshCalls.length,built,'scene must be cached instead of rebuilding every frame');
console.log(`V18_1_MENU_PASS radius=${S.menuPreviewInfo.chunkRadius} chunks=${S.menuPreviewInfo.totalChunks} sectors=${S.menuPreviewInfo.builtSectors} first=${meshCalls[0].count} last=${meshCalls.at(-2).count}; shaders + cached panorama`);
