import assert from 'node:assert/strict';
import {install as installScene} from '../src/render/scene.js';

// Reproduces the exact V28 spawn freeze: a cached torch in a visible chunk.
// A ReferenceError during S.render() cancels the old requestAnimationFrame loop,
// leaving keydown/menu handlers active but WASD and camera visually frozen.
const rendered=[];
const gl={ARRAY_BUFFER:34962,STATIC_DRAW:35044,createBuffer:()=>({}),bindBuffer(){},bufferData(){}};
const S={
  gl,CHUNK:16,renderDistance:8,
  player:{pos:[4.5,35,4.5]},
  chunks:new Map([['0,0',{cx:0,cz:0,torches:[[5,34,5],[6,34,5]]}]]),
  torchMounts:new Map([['5,34,5',[1,0,0]]]),
  editKey:(x,y,z)=>`${x},${y},${z}`,
};
installScene(S);
S.drawBox=(_vp,pos,scale,color,ry,fc,cam,rx,rz)=>rendered.push({pos,scale,color,ry,rx,rz});
assert.doesNotThrow(()=>S.renderPlacedTorches(null,[.5,.5,.5],[4.5,35,4.5]),'spawn with generated torches must not crash the render frame');
assert.equal(rendered.length,6,'both torches must each draw stick, ember and flame');
assert.ok(rendered[0].rz<0,'wall-mounted torch should use its stored wall normal');
assert.equal(Math.abs(rendered[3].rz),0,'procedural torch without wall mounting defaults to upright');
// A loaded world without torches also works (no reliance on S.edits).
S.chunks=new Map([['0,0',{cx:0,cz:0,torches:[]}]]);
rendered.length=0;
assert.doesNotThrow(()=>S.renderPlacedTorches(null,[1,1,1],[4.5,35,4.5]));
assert.equal(rendered.length,0);
console.log('V28_1_SPAWN_INPUT_HOTFIX_PASS generated/player torch render does not break the animation frame');
