'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/game.js'),'utf8').replace('player.pos=findScenicSpawn();worldSpawn=[...player.pos];updateStreaming(player.pos[0],player.pos[2],true);createStarterChestNear(player.pos);', 'player.pos=[0,60,0];worldSpawn=[...player.pos];starterChestLoot=randomStarterChestLoot();');

class ClassList{constructor(){this.s=new Set()}add(...x){x.forEach(v=>this.s.add(v))}remove(...x){x.forEach(v=>this.s.delete(v))}toggle(x,force){if(force===undefined){if(this.s.has(x)){this.s.delete(x);return false}this.s.add(x);return true}force?this.s.add(x):this.s.delete(x);return !!force}contains(x){return this.s.has(x)}}
class Elem{
  constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.style={setProperty(k,v){this[k]=v}};this.classList=new ClassList();this.children=[];this.dataset={};this.value='';this.disabled=false;this.textContent='';this.title='';this.draggable=false;this.listeners={};this.width=960;this.height=540;this._inner='';this.offsetWidth=100;}
  appendChild(x){this.children.push(x);return x} append(...xs){xs.forEach(x=>this.appendChild(x))}
  addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)} removeEventListener(){}
  dispatch(t,e={}){for(const fn of this.listeners[t]||[])fn(e)}
  set innerHTML(v){this._inner=String(v);this.children=[]} get innerHTML(){return this._inner}
  getContext(type){if(type==='webgl')return gl;if(type==='2d')return ctx2d;return null}
  requestPointerLock(){document.pointerLockElement=this}
}
const ctx2d=new Proxy({imageSmoothingEnabled:false,fillStyle:'#000',clearRect(){},fillRect(){},drawImage(){},putImageData(){},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}}},{get(t,p){if(p in t)return t[p];return ()=>{}}});
let glConst=1;
const gl=new Proxy({}, {get(t,p){
  if(typeof p==='string'&&p===p.toUpperCase()){if(!(p in t))t[p]=glConst++;return t[p]}
  if(p==='getShaderParameter'||p==='getProgramParameter')return ()=>true;
  if(p==='getShaderInfoLog'||p==='getProgramInfoLog')return ()=>'';
  if(p==='getAttribLocation')return ()=>0;
  if(p==='getUniformLocation')return ()=>({});
  if(p==='getParameter')return ()=> 'Mock WebGL 1.0';
  if(p==='createBuffer'||p==='createTexture'||p==='createShader'||p==='createProgram')return ()=>({});
  if(p==='getExtension')return ()=>null;
  return (...args)=>undefined;
}});
const ids=[...source.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
const elements=new Map(ids.map(id=>[id,new Elem('div',id)]));
elements.set('game',new Elem('canvas','game'));
Object.assign(elements.get('difficultySelect'),{value:'nightmare'});
Object.assign(elements.get('renderDistanceSelect'),{value:'4'});
Object.assign(elements.get('sensInput'),{value:'0.0115'});
Object.assign(elements.get('volumeInput'),{value:'0.82'});
Object.assign(elements.get('seedInput'),{value:'runtime-smoke-seed'});
elements.get('itemTooltip')?.classList.add('hidden');
const document={body:new Elem('body','body'),pointerLockElement:null,getElementById(id){if(!elements.has(id))elements.set(id,new Elem('div',id));return elements.get(id)},createElement(tag){return new Elem(tag)},listeners:{},addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)},exitPointerLock(){this.pointerLockElement=null}};
const raf=[];
const storage=new Map();
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
class Gain{constructor(){this.gain={value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}}}connect(){}}
class Source{constructor(){this.playbackRate={value:1};this.detune={value:0};this.loop=false;this.buffer=null}connect(){}start(){}stop(){}}
class AudioContextMock{constructor(){this.state='running';this.sampleRate=22050;this.currentTime=0;this.destination={}}createGain(){return new Gain()}createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){}}}createBuffer(ch,len,rate){return {getChannelData(){return new Float32Array(len)}}}createBufferSource(){return new Source()}createOscillator(){const x=new Source();x.type='sine';x.frequency={setValueAtTime(){},exponentialRampToValueAtTime(){}};return x}createBiquadFilter(){return {type:'lowpass',frequency:{value:0},connect(){}}}decodeAudioData(){return Promise.resolve({})}resume(){this.state='running';return Promise.resolve()}}
class AudioMock{constructor(){this.volume=1;this.playbackRate=1}addEventListener(){}play(){return Promise.resolve()}}
const windowObj={devicePixelRatio:1,AudioContext:AudioContextMock,webkitAudioContext:AudioContextMock,listeners:{},addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}};
const sandbox={window:windowObj,document,localStorage,Audio:AudioMock,fetch:async(url)=>{try{const b=fs.readFileSync(path.join(root,String(url)));const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);return {ok:true,status:200,arrayBuffer:async()=>ab}}catch{return {ok:false,status:404,arrayBuffer:async()=>new ArrayBuffer(0)}}},console,performance:{now:()=>1000},requestAnimationFrame:fn=>{raf.push(fn);return raf.length},cancelAnimationFrame(){},setTimeout:fn=>0,clearTimeout(){},innerWidth:960,innerHeight:540,Float32Array,Int8Array,Uint8Array,Uint8ClampedArray,ArrayBuffer,Math,Date,JSON,Map,Set,Object,Number,String,Boolean,Promise};
sandbox.globalThis=sandbox;windowObj.window=windowObj;windowObj.document=document;windowObj.localStorage=localStorage;windowObj.performance=sandbox.performance;windowObj.requestAnimationFrame=sandbox.requestAnimationFrame;windowObj.setTimeout=sandbox.setTimeout;
vm.createContext(sandbox);
try{vm.runInContext(source,sandbox,{filename:'game.js',timeout:15000});}catch(e){console.error('BOOT_FAIL',e);process.exit(1)}
const newGame=elements.get('newGameBtn').onclick;if(typeof newGame!=='function'){console.error('NO_NEW_GAME_HANDLER');process.exit(2)}
try{newGame();}catch(e){console.error('NEW_GAME_FAIL',e);process.exit(3)}
const api=windowObj.__NIGHTCRAFT_TEST__;if(!api){console.error('NO_TEST_API');process.exit(4)}
// V14 validation: actual pair reservation, save/load, minimap heading, navigation.
const assert=require('assert').strict;
const slots=()=>api.getState().player.slots;
assert.equal(slots()[9]?.id,'bedroll');assert.equal(slots()[10]?.id,'__bedroll_footprint');
const empty=Array(36).fill(null);
console.log('MARK','api.setPlayerSlotsForTest(empty);');
api.setPlayerSlotsForTest(empty);
assert.equal(api.validInventoryFootprintsForTest([[17,{id:'bedroll',count:1}]]),false,'no wrap over nine-column row');
assert.equal(api.validInventoryFootprintsForTest([[8,{id:'bedroll',count:1}]]),false,'no wrap over hotbar');
assert.equal(api.applyInventoryFootprintsForTest([[9,{id:'bedroll',count:1}]]),true);
assert.equal(slots()[10]?.id,'__bedroll_footprint');
assert.equal(api.validInventoryFootprintsForTest([[10,{id:'wood',count:1}]]),false,'cannot replace reserved partner');
assert.equal(api.applyInventoryFootprintsForTest([[9,null],[12,{id:'bedroll',count:1}]]),true);
assert.equal(slots()[9],null);assert.equal(slots()[10],null);assert.equal(slots()[13]?.id,'__bedroll_footprint');
api.moveInventoryRangeForTest(12);
assert.equal(slots()[0]?.id,'bedroll');assert.equal(slots()[1]?.id,'__bedroll_footprint');
assert.equal(slots()[12],null);assert.equal(slots()[13],null);
api.addItemForTest('torch',2);
assert.equal(slots()[1]?.id,'__bedroll_footprint','loot should not occupy bag space');
console.log('MARK','api.saveGameForTest();');
api.saveGameForTest();
assert.equal(JSON.parse([...storage.values()][0]).slots[1]?.id,'__bedroll_footprint');
api.setPlayerSlotsForTest(empty);
console.log('MARK','api.loadGameForTest();');
api.setPlayerSlotsForTest(JSON.parse([...storage.values()][0]).slots);
assert.equal(slots()[0]?.id,'bedroll','serialized bag restored');assert.equal(slots()[1]?.id,'__bedroll_footprint','serialized bag tail restored');
assert.equal(api.removeItemForTest('bedroll',1),true);
assert.equal(slots()[0],null);assert.equal(slots()[1],null);
api.setYawForTest(Math.PI/2);api.updateMinimapForTest(.2);
assert.match(elements.get('minimapCursor').style.transform,/rotate\(90deg\)/);
api.equipArmorForTest('head','iron_head');api.updateArmorMiniHudForTest();
assert.equal(elements.get('armorOrbHead').classList.contains('equipped'),true);
assert.equal(elements.get('armorOrbChest').classList.contains('equipped'),false);
// Construct a flat grid interrupted by a full-height wall with a single doorway.
console.log('MARK','const x0=95,z0=95,y0=59;');
const x0=95,z0=95,y0=59;
for(let x=x0-1;x<=x0+10;x++)for(let z=z0-4;z<=z0+4;z++){
 api.setBlock(x,y0-1,z,api.B.STONE);
 for(let y=y0;y<=y0+3;y++)api.setBlock(x,y,z,api.B.AIR);
}
for(let z=z0-4;z<=z0+4;z++)if(z!==z0+2)for(let y=y0;y<=y0+2;y++)api.setBlock(x0+4,y,z,api.B.STONE);
const wolf={pos:[x0+.5,y0,z0+.5]},enemy=api.enemyDefs.wolf;
console.log('NAV_DIAG',JSON.stringify({center:api.navFloorAtForTest(x0,z0,y0,.38,1.0),adjacent:api.navFloorAtForTest(x0+1,z0,y0,.38,1.0),door:api.navFloorAtForTest(x0+4,z0+2,y0,.38,1.0),wall:api.navFloorAtForTest(x0+4,z0,y0,.38,1.0),ground:api.getBlock(x0,y0-1,z0),above:api.getBlock(x0,y0,z0),height:enemy.height}));
const way=api.planEnemyPathForTest(wolf,x0+8.5,z0+.5,enemy,450);
assert.ok(way.length>=4,'path should be found around obstacle: '+JSON.stringify(way));
assert.ok(way.some(q=>q[1]>=z0+1.5),'path must detour into doorway: '+JSON.stringify(way));
assert.ok(way.at(-1)[0]>=x0+7.5,'path reaches target vicinity: '+JSON.stringify(way));
console.log('V14_INTEGRATION_PASS',JSON.stringify({twoCellBedroll:true,saveLoad:true,compassRealtime:true,armorOrbs:true,obstaclePath:way,version:api.version}));
process.exit(0);
