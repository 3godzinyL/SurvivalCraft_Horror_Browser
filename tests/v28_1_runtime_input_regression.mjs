import assert from 'node:assert/strict';
import {install as installInput} from '../src/ui/input.js';
import {install as installHud} from '../src/ui/hud.js';

const listeners=new Map();
const makeElement=()=>{
  const values=new Set();
  return {classList:{add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle:(v,on)=>on?values.add(v):values.delete(v)},addEventListener:()=>{},focus:()=>{},style:{},textContent:''};
};
const elements=new Map();
globalThis.document={
  pointerLockElement:null,body:{append:e=>elements.set(e.id,e)},
  addEventListener:(type,fn)=>{const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},
  exitPointerLock:()=>{document.pointerLockElement=null;},
  getElementById:id=>elements.get(id)||null,
  createElement:()=>makeElement(),
};
globalThis.window={addEventListener:()=>{}};
let scheduled=0;
globalThis.requestAnimationFrame=()=>{scheduled++;};

const ui=new Proxy({}, {get:(obj,prop)=>obj[prop]??(obj[prop]=makeElement())});
const canvas=makeElement();canvas.tabIndex=-1;
const S={UI:ui,canvas,running:true,dead:false,paused:true,lockPending:false,
  input:{keys:new Set(),locked:false,mouseLeft:false,mouseRight:false,mouseMiddle:false,sensitivity:.011},
  audio:{ctx:{resume:()=>Promise.resolve()}},initAudio:()=>{},setMiningHud:()=>{},
  clearInventoryHover:()=>{},closeRecipeCodex:()=>{},hasSave:()=>false,player:{yaw:0,pitch:0},
};
installInput(S);
const pointerChanged=()=>listeners.get('pointerlockchange')?.forEach(f=>f());
// Closing the startup book must resume an actually captured game immediately.
canvas.requestPointerLock=()=>{
  document.pointerLockElement=canvas;
  pointerChanged();
  return Promise.resolve();
};
S.resumeGame();await Promise.resolve();
assert.equal(S.paused,false,'game unpauses when cursor is captured');
assert.equal(S.input.locked,true,'mouse capture is recognized');
assert.equal(canvas.tabIndex,0,'game canvas is keyboard focusable');
const keyDown=listeners.get('keydown')[0];
keyDown({code:'KeyW',preventDefault(){},stopPropagation(){},repeat:false});
assert.equal(S.input.keys.has('KeyW'),true,'WASD keyboard events are still processed');

// Some webviews acknowledge requestPointerLock yet never grant the lock.
// This must show the pause controls, not leave an invisible permanent freeze.
S.input.keys.clear();S.paused=true;S.lockPending=false;S.input.locked=false;
document.pointerLockElement=null;
canvas.requestPointerLock=()=>Promise.resolve();
S.resumeGame();await new Promise(resolve=>setTimeout(resolve,1300));
assert.equal(S.lockPending,false,'pointer lock cannot remain pending forever');
assert.equal(S.paused,true,'game remains correctly paused on capture failure');
assert.equal(ui.pauseMenu.classList.contains('active'),true,'resume button is visible for retry');

// A render-time exception must never kill the requestAnimationFrame chain.
const overlayID='gameRuntimeError';
let simulationSteps=0;
const H={running:true,paused:false,dead:false,mapOpen:false,UI:ui,player:{},
  updateWorld:()=>{simulationSteps++;},updateVillage:()=>{},
  render:()=>{throw new ReferenceError('missing render identifier');},
  updateMinimap:()=>{},netUpdate:()=>{},
};
installHud(H);
const before=scheduled;
H.frame(performance.now()+16);
assert.equal(scheduled,before+1,'RAF must reschedule even when rendering throws');
assert.equal(simulationSteps,1);
assert.match(elements.get(overlayID)?.textContent||'',/missing render identifier/,'error should be visible');
H.render=()=>{};H.updateHUD=()=>{};
H.frame(performance.now()+32);
assert.equal(scheduled,before+2,'game loop must continue on the following frame');
assert.equal(simulationSteps,2,'simulation resumes on subsequent frames');
console.log('V28_1_RUNTIME_INPUT_PASS startup-book pointer lock, WASD, capture failure recovery, and RAF error resilience');
