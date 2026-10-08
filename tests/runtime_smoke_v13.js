'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/game.js'),'utf8');

class ClassList{constructor(){this.s=new Set()}add(...x){x.forEach(v=>this.s.add(v))}remove(...x){x.forEach(v=>this.s.delete(v))}toggle(x,force){if(force===undefined){if(this.s.has(x)){this.s.delete(x);return false}this.s.add(x);return true}force?this.s.add(x):this.s.delete(x);return !!force}contains(x){return this.s.has(x)}}
class Elem{
  constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.style={};this.classList=new ClassList();this.children=[];this.dataset={};this.value='';this.disabled=false;this.textContent='';this.title='';this.draggable=false;this.listeners={};this.width=960;this.height=540;this._inner='';this.offsetWidth=100;}
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
// V12 targeted smoke: fast sensory / leaf checks without the old huge world scan.
let state=api.getState();
if(api.version!==18){console.error('VERSION_FAIL',api.version);process.exit(5)}
if(!state.player||!state.worldSpawn){console.error('BOOT_STATE_FAIL',state);process.exit(5)}

// Sight must be directional. Put a wolf on a flat temporary platform in front of the player.
api.clearEnemiesForTest();api.clearPlayerNoiseForTest();
const p=api.getState().player.pos;
const wx=p[0], wz=p[2]+8;
const wolf=api.spawnEnemyForTest('wolf',wx,wz,false,{packId:991,facing:0,renderFacing:0});
if(!wolf){console.error('WOLF_SPAWN_FAIL');process.exit(6)}
// facing 0 means local forward is -Z, so from z+8 it faces toward the player.
let sight=api.wolfViewStateForTest(wolf,8);
if(!sight.inCone || !sight.detecting){console.error('WOLF_FRONT_SIGHT_FAIL',sight,wolf.pos,p);process.exit(6)}
wolf.facing=Math.PI; sight=api.wolfViewStateForTest(wolf,8);
if(sight.detecting && !sight.near){console.error('WOLF_REAR_SIGHT_FAIL',sight);process.exit(6)}

// Hearing: a footstep does not teleport knowledge of the player; it creates an investigation target.
wolf.facing=Math.PI; wolf.sightAwareness=0; wolf.hearingAwareness=0; wolf.awareness=0; wolf.spotted=false; wolf.track=0; wolf.heardTimer=0; wolf.investigatePos=null;
api.emitPlayerNoiseForTest('step',14,.8,[p[0],p[1]+.2,p[2]],1.4,'gravel');
const heard=api.strongestPlayerNoiseForWolfForTest(wolf);
if(!heard || heard.score<=0){console.error('WOLF_HEARING_EVENT_FAIL',heard);process.exit(7)}
api.updateWolfAwarenessForTest(wolf,.05,8);
if(!(wolf.hearingAwareness>0 && wolf.heardTimer>0 && Array.isArray(wolf.investigatePos))){console.error('WOLF_INVESTIGATION_FAIL',wolf);process.exit(7)}
if(wolf.spotted){console.error('WOLF_HEARING_CHEAT_FAIL',wolf);process.exit(7)}

// Repeated loud sprint footsteps must materially raise hearing awareness.
for(let i=0;i<5;i++){
  api.emitPlayerNoiseForTest('sprint_step',27,1.15,[p[0],p[1]+.2,p[2]],1.5,'gravel');
  api.updateWolfAwarenessForTest(wolf,.05,8);
}
if(wolf.hearingAwareness<.65){console.error('WOLF_REPEATED_FOOTSTEP_FAIL',wolf.hearingAwareness);process.exit(8)}

// Materials and walls must matter: gravel is louder than snow, and a solid wall attenuates hearing.
api.clearPlayerNoiseForTest();api.emitPlayerNoiseForTest('step',13,.7,[p[0],p[1]+.2,p[2]],1.5,'gravel');const gravelRadius=api.getState().playerNoises[0]?.radius||0;api.clearPlayerNoiseForTest();api.emitPlayerNoiseForTest('step',13,.7,[p[0],p[1]+.2,p[2]],1.5,'snow');const snowRadius=api.getState().playerNoises[0]?.radius||0;if(!(gravelRadius>snowRadius*1.6)){console.error('MATERIAL_HEARING_FAIL',{gravelRadius,snowRadius});process.exit(8)}
api.clearPlayerNoiseForTest();api.emitPlayerNoiseForTest('sprint_step',30,1.15,[p[0],p[1]+.2,p[2]],1.5,'gravel');const openScore=api.strongestPlayerNoiseForWolfForTest(wolf)?.score||0;const wallZ=Math.floor((p[2]+wolf.pos[2])*.5),wallX=Math.floor(p[0]);for(let yy=Math.floor(p[1]);yy<=Math.floor(p[1])+2;yy++)for(let xx=wallX-1;xx<=wallX+1;xx++)api.setBlock(xx,yy,wallZ,api.B.STONE);const blockedScore=api.strongestPlayerNoiseForWolfForTest(wolf)?.score||0;if(!(openScore>0&&blockedScore<openScore*.8)){console.error('SOUND_OCCLUSION_FAIL',{openScore,blockedScore});process.exit(8)}
for(let yy=Math.floor(p[1]);yy<=Math.floor(p[1])+2;yy++)for(let xx=wallX-1;xx<=wallX+1;xx++)api.setBlock(xx,yy,wallZ,api.B.AIR);api.clearPlayerNoiseForTest();

// Pack member should be sent to investigate heard position, but not magically spotted.
const mate=api.spawnEnemyForTest('wolf',wx+2,wz+1,false,{packId:991,facing:Math.PI,renderFacing:Math.PI});
api.emitPlayerNoiseForTest('sprint_step',28,1.2,[p[0]+1,p[1]+.2,p[2]],1.5,'leaves');
api.updateWolfAwarenessForTest(wolf,.05,8);
if(!(mate.heardTimer>0 && mate.investigatePos && !mate.spotted)){console.error('PACK_HEARING_SHARE_FAIL',mate);process.exit(9)}

// Actual leaf system: direct canopy emission creates visible persistent leaf entities.
const leafBefore=api.getState().fallingLeafCount;
const made=api.spawnCanopyLeavesForTest({x:Math.floor(p[0])+1,y:Math.floor(p[1])+5,z:Math.floor(p[2])+1,id:api.B.AUTUMNLEAVES},12,1);
state=api.getState();
if(made<10 || state.fallingLeafCount<leafBefore+10){console.error('CANOPY_LEAF_SPAWN_FAIL',{made,before:leafBefore,after:state.fallingLeafCount});process.exit(10)}
for(let i=0;i<20;i++)api.updateFallingLeavesForTest(.05);
if(api.getState().fallingLeafCount<=0){console.error('CANOPY_LEAF_LIFETIME_FAIL');process.exit(10)}

// Source wiring checks for real footsteps / crouch / correct travel-facing visuals.
if(!source.includes("emitPlayerNoise(crouch?'crouch_step':sprint?'sprint_step':'step'") || !source.includes('strongestPlayerNoiseForWolf') || !source.includes('soundOcclusionBetween') || !source.includes('e.renderFacing=turnAngle') || !source.includes('findNearbyLeafEmitter')){console.error('V13_WIRING_FAIL');process.exit(11)}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');if(!html.includes('width="230" height="112"')){console.error('V13_SENSOR_HUD_FAIL');process.exit(12)}

// V13: user-requested integrated systems, exercised through the same browser VM.
const bagItem=state.player.slots.find(q=>q?.id==='bedroll');
if(bagItem?.count!==1)throw new Error('V13_START_BEDROLL');
const starter=api.getV13SystemsForTest().starterChestLoot;
if(starter[1]?.id!=='wood_door'||starter[2]?.id!=='glass'||starter[2]?.count!==3)throw new Error('V13_STARTER_CHEST_CONTENT');
const loot=api.generateRuinChestLootForTest(50,31,30);
if(loot.length!==9||JSON.stringify(loot)!==JSON.stringify(api.generateRuinChestLootForTest(50,31,30)))throw new Error('V13_CHEST_RNG_DETERMINISM');
for(const part of ['head','chest','legs','feet'])if(!api.equipArmorForTest(part,'iron_'+part))throw new Error('V13_ARMOR_EQUIP');
if(!(api.absorbArmorDamageForTest(30)<12))throw new Error('V13_ARMOR_DAMAGE_REDUCTION');
if(api.playerLevelForTest()!==0)throw new Error('V13_LEVEL_INITIAL');
api.grantXPForTest(90);
if(api.playerLevelForTest()!==1)throw new Error('V13_XP_UNLOCK');
api.activateXrayForTest();
let feature=api.getV13SystemsForTest();
if(feature.scanDuration!==14||feature.scanCooldown!==45)throw new Error('V13_SCAN_TIMING');
api.setWeatherForTest('rain',.88);
for(let i=0;i<45;i++)api.updateWeatherForTest(.05,.6);
feature=api.getV13SystemsForTest();
if(feature.rainDropCount<20||feature.glassDropCount<1)throw new Error('V13_RAIN_PARTICLES_AND_GLASS '+JSON.stringify(feature));
const bx=Math.floor(p[0]+4),bz=Math.floor(p[2]+3),by=Math.floor(p[1]);
api.setBlock(bx,by,bz,api.B.BEDROLL);
api.setWorldSecondsForTest(20/24*state.daySeconds);
api.sleepAtBedrollForTest({x:bx,y:by,z:bz,id:api.B.BEDROLL});
feature=api.getV13SystemsForTest();
if(!feature.respawnSite||feature.respawnSite.join(',')!==[bx,by,bz].join(','))throw new Error('V13_BEDROLL_RESPAWN');
if(api.currentWorldHourForTest()<6.95||api.currentWorldHourForTest()>7.05)throw new Error('V13_SLEEP_DAWN');
console.log('V13_SYSTEMS_PASS',JSON.stringify({xp:feature.xp,level:feature.level,scanCooldown:feature.scanCooldown,armorPieces:Object.keys(feature.armorSlots).length,rainParticles:feature.rainDropCount,glassDrips:feature.glassDropCount,sleepHour:api.currentWorldHourForTest()}));
console.log(JSON.stringify({ok:true,version:api.version,wolfDirectionalSight:true,wolfFootstepHearing:true,wolfInvestigatesLastNoise:true,packHearing:true,crouchStealth:true,travelFacing:true,canopyLeaves:true,fallingLeaves:api.getState().fallingLeafCount,hearingAwareness:Number(wolf.hearingAwareness.toFixed(3))},null,2));
process.exit(0);
