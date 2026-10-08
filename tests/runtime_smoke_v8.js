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
// Exercise generated world and data systems.
const biomes=new Set(),heights=[];let mouths=0,mines=0;
for(let z=-1024;z<=1024;z+=32)for(let x=-1024;x<=1024;x+=32){const h=api.terrainHeight(x,z);heights.push(h);biomes.add(api.biomeAt(x,z));if(api.caveMouthDepth(x,z,h)>0)mouths++;const mi=api.mineshaftInfo(x,z);if(mi.enabled)mines++;}
let state=api.getState();
if(state.player.slots[4]?.id!=='torch'||state.player.slots[4]?.count<20){console.error('START_TORCH_FAIL',state.player.slots[4]);process.exit(5)}
for(const [i,id] of [[0,'wood_pickaxe'],[1,'wood_axe'],[2,'wood_shovel'],[3,'wood_sword']])if(state.player.slots[i]?.id!==id){console.error('START_WOOD_TOOLS_FAIL',i,state.player.slots[i]);process.exit(5)}
if(!state.starterChestPos||Math.hypot(state.starterChestPos[0]-state.player.pos[0],state.starterChestPos[2]-state.player.pos[2])>14){console.error('START_CHEST_FAIL',state.starterChestPos,state.player.pos);process.exit(5)}
if(state.starterTorchCount<2){console.error('START_CHEST_TORCH_FAIL',state.starterTorchCount,state.starterChestPos,state.player.pos,state.starterTorchPositions);process.exit(5)}
const startHour=(state.worldSeconds%state.daySeconds)/state.daySeconds*24;if(startHour<15.9||startHour>16.1||state.daySeconds<1100){console.error('START_TIME_FAIL',{startHour,daySeconds:state.daySeconds});process.exit(5)}
const sx=Math.floor(state.player.pos[0]),sz=Math.floor(state.player.pos[2]),spawnHs=[];for(const[dx,dz]of[[0,0],[12,0],[-12,0],[0,12],[0,-12],[9,9],[-9,-9]])spawnHs.push(api.terrainHeight(sx+dx,sz+dz));const spawnRelief=Math.max(...spawnHs)-Math.min(...spawnHs);if(spawnRelief<3){console.error('SCENIC_SPAWN_FAIL',state.player.pos,spawnHs);process.exit(5)}
let coal=0,iron=0;for(let z=sz-48;z<=sz+48;z+=3)for(let x=sx-48;x<=sx+48;x+=3)for(let y=4;y<=34;y+=2){const b=api.getBlock(x,y,z);if(b===7)coal++;else if(b===8)iron++;}
if(coal===0||iron===0){console.error('ORE_GENERATION_FAIL',{coal,iron});process.exit(5)}
if(!Array.isArray(api.ruinTypes)||api.ruinTypes.length<16){console.error('RUIN_TYPE_COUNT_FAIL',api.ruinTypes);process.exit(5)}
const ruinSeen=new Set();let firstRuin=null;for(let cz=-10;cz<=10;cz++)for(let cx=-10;cx<=10;cx++){const r=api.ruinCandidateForCell(cx,cz);if(r){ruinSeen.add(r.type);if(!firstRuin)firstRuin=r;}}
if(ruinSeen.size<6||!firstRuin){console.error('RUIN_DIVERSITY_FAIL',ruinSeen.size,[...ruinSeen]);process.exit(5)}
let ruinBlocks=0;for(let z=firstRuin.gz-10;z<=firstRuin.gz+10;z++)for(let x=firstRuin.gx-10;x<=firstRuin.gx+10;x++){const h=api.terrainHeight(x,z);for(let y=Math.max(1,h-5);y<=Math.min(95,h+10);y++){const b=api.getBlock(x,y,z);if(b>=68&&b<=79)ruinBlocks++;}}
if(ruinBlocks<8){console.error('RUIN_GENERATION_FAIL',firstRuin,ruinBlocks);process.exit(5)}
for(const id of ['stone_bricks','mossy_bricks','rune_stone','old_tiles'])if(!api.itemDefs[id]){console.error('NEW_BLOCK_ITEM_FAIL',id);process.exit(5)}
if(!source.includes('gl.drawArrays(gl.TRIANGLES,0,count-count%6)')||!source.includes('ribbon(axis,v,a,b,c,d,.036')){console.error('THICK_CRACK_RENDER_FAIL');process.exit(5)}
if(biomes.size<8){console.error('BIOME_DIVERSITY_FAIL',biomes.size,[...biomes]);process.exit(6)}
if(Math.max(...heights)-Math.min(...heights)<10){console.error('HEIGHT_VARIETY_FAIL');process.exit(7)}
// Mining must remain possible even with a wrong tool / bare hand.
if(!(api.equippedPowerFor(3)>0)){console.error('UNIVERSAL_MINING_FAIL');process.exit(8)}
// Open inventory through the real KeyE handler and swap hotbar slot 0/1 through UI click handlers.
const keyEv={code:'KeyE',preventDefault(){}};for(const fn of document.listeners.keydown||[])fn(keyEv);
const inv=elements.get('inventoryGrid');const findInv=i=>inv.children.find?.(e=>e.dataset?.source==='inventory'&&e.dataset?.index===String(i))||inv.children.filter(e=>e.dataset?.source==='inventory'&&e.dataset?.index===String(i))[0];
const slot0=findInv(0),slot1=findInv(1);
if(!slot0||!slot1){console.error('INVENTORY_SLOT_RENDER_FAIL');process.exit(9)}
slot0.dispatch('click',{button:0,shiftKey:false,clientX:310,clientY:220});slot1.dispatch('click',{button:0,shiftKey:false,clientX:370,clientY:220});slot0.dispatch('click',{button:0,shiftKey:false,clientX:310,clientY:220});
state=api.getState();if(state.player.slots[0]?.id!=='wood_axe'||state.player.slots[1]?.id!=='wood_pickaxe'){console.error('INVENTORY_SWAP_FAIL',state.player.slots.slice(0,2));process.exit(10)}
const cursorEl=elements.get('cursorStack');if(!String(cursorEl.style.left||'').includes('310')){console.error('CURSOR_POSITION_FAIL',cursorEl.style);process.exit(10)}
// Minecraft-like right-drag: split a 12-stack, then paint one item into all four crafting slots.
const dirtSlot=findInv(5),craft=elements.get('craftGrid');if(!dirtSlot||craft.children.length<4){console.error('CRAFT_GRID_FAIL');process.exit(10)}
dirtSlot.dispatch('pointerdown',{button:2,buttons:2,preventDefault(){},clientX:430,clientY:280});for(let i=0;i<4;i++)craft.children[i].dispatch('pointerenter',{buttons:2,clientX:650+(i%2)*64,clientY:220+Math.floor(i/2)*64});
for(const fn of document.listeners.pointerup||[])fn({button:2});
if(!craft.children.every?.(e=>true)){}
const craftCounts=craft.children.map(e=>e.dataset?.source==='craft'?e:null).filter(Boolean);if(craftCounts.length!==4){console.error('CRAFT_SLOT_RENDER_FAIL');process.exit(10)}
// Read the rendered count state after right-drag by reopening/refreshing via a harmless mouse move.
state=api.getState();if(!state.player.craftSlots.every(st=>st?.id==='dirt'&&st.count===1)||state.cursorStack?.id!=='dirt'||state.cursorStack.count!==2){console.error('RIGHT_DRAG_DISTRIBUTION_FAIL',state.player.craftSlots,state.cursorStack);process.exit(10)}
// A right-click that places the final cursor item must still refresh the UI on pointerup.
let c0=craft.children[0];c0.dispatch('pointerdown',{button:2,buttons:2,preventDefault(){},clientX:650,clientY:220});for(const fn of document.listeners.pointerup||[])fn({button:2});c0=craft.children[0];c0.dispatch('pointerdown',{button:2,buttons:2,preventDefault(){},clientX:650,clientY:220});for(const fn of document.listeners.pointerup||[])fn({button:2});state=api.getState();const countNode=craft.children[0]?.children?.find?.(e=>e.className==='inv-count');if(state.cursorStack||state.player.craftSlots[0]?.count!==3||String(countNode?.textContent)!=='3'){console.error('RIGHT_CLICK_FINAL_REFRESH_FAIL',state.player.craftSlots,state.cursorStack,countNode?.textContent);process.exit(10)}
// Starter chest uses the same interactive slot component and must expose a hover tooltip.
try{api.openStarterChestForTest();}catch(e){console.error('CHEST_OPEN_FAIL',e);process.exit(10)}
const chestGrid=elements.get('chestGrid'), chestSlot=chestGrid.children.find?.(e=>e.dataset?.source==='chest'&&e.children.length>1)||chestGrid.children.find?.(e=>e.dataset?.source==='chest');
if(!chestSlot){console.error('CHEST_SLOT_RENDER_FAIL');process.exit(10)}
chestSlot.dispatch('mouseenter',{clientX:200,clientY:160});const tip=elements.get('itemTooltip');if(!tip.innerHTML||!tip.innerHTML.includes('SKRZYNIA STARTOWA')){console.error('CHEST_TOOLTIP_FAIL',tip.innerHTML);process.exit(10)}
// Audio assets critical to traversal/atmosphere must exist and contain non-zero PCM payload.
for(const file of ['step_grass.wav','hurt.wav','heartbeat.wav','fire_crackle.wav','water_lap.wav','evening_ambience.wav']){const b=fs.readFileSync(path.join(root,'assets/audio',file));if(b.length<1000||!b.subarray(44).some(v=>v!==0)){console.error('AUDIO_ASSET_FAIL',file,b.length);process.exit(10)}}
// Admin toggle + T should really open the catalogue.
elements.get('adminToggleBtn').onclick();for(const fn of document.listeners.keydown||[])fn({code:'KeyT',preventDefault(){}});
if(elements.get('adminPanel').classList.contains('hidden')){console.error('ADMIN_PANEL_FAIL');process.exit(11)}
// Close admin, then execute a few frame callbacks to catch HUD/render runtime regressions.
for(const fn of document.listeners.keydown||[])fn({code:'KeyT',preventDefault(){}});
try{for(let i=0;i<Math.min(4,raf.length);i++)raf[i](1016+i*16);}catch(e){console.error('FRAME_FAIL',e);process.exit(12)}

// ---------------------------------------------------------------------------
// V8 regression / integration checks
// ---------------------------------------------------------------------------
const press=(code)=>{for(const fn of document.listeners.keydown||[])fn({code,preventDefault(){}})};
// ESC must toggle pause and close every modal straight back into gameplay.
let s8=api.getState();if(s8.paused){console.error('V8_EXPECT_RUNNING_BEFORE_ESC',s8);process.exit(20)}
press('Escape');s8=api.getState();if(!s8.paused){console.error('ESC_PAUSE_FAIL',s8);process.exit(20)}
press('Escape');s8=api.getState();if(s8.paused){console.error('ESC_RESUME_FAIL',s8);process.exit(20)}
press('KeyE');s8=api.getState();if(!s8.inventoryOpen||!s8.paused){console.error('V8_INVENTORY_OPEN_FAIL',s8);process.exit(20)}
press('Escape');s8=api.getState();if(s8.inventoryOpen||s8.paused){console.error('ESC_INVENTORY_RETURN_FAIL',s8);process.exit(20)}
press('KeyM');s8=api.getState();if(!s8.mapOpen||!s8.paused||!String(elements.get('mapStats').textContent).includes('Przebyto:')){console.error('FULL_MAP_OPEN_FAIL',s8,elements.get('mapStats').textContent);process.exit(20)}
press('Escape');s8=api.getState();if(s8.mapOpen||s8.paused){console.error('ESC_MAP_RETURN_FAIL',s8);process.exit(20)}

// Gold must actually exist underground, not only in the item catalogue.
let gold=0;for(let z=sz-56;z<=sz+56;z+=4)for(let x=sx-56;x<=sx+56;x+=4)for(let y=4;y<=22;y+=2){if(api.getBlock(x,y,z)===api.B.GOLD)gold++;}
if(gold===0){console.error('GOLD_ORE_GENERATION_FAIL');process.exit(21)}

// Real furnace recipes: iron, gold, glass and smooth stone.
const fx=Math.floor(s8.worldSpawn[0])+3,fz=Math.floor(s8.worldSpawn[2])+3,fy=api.terrainHeight(fx,fz)+1;
const smelt=(input,out,seconds)=>{api.setFurnaceStateForTest(fx,fy,fz,{input:{id:input,count:1},fuel:{id:'coal',count:1},output:null,burn:0,burnMax:0,progress:0});for(let i=0;i<seconds;i++)api.updateFurnacesForTest(1);const f=api.getFurnaceForTest(fx,fy,fz);if(f?.output?.id!==out||f.output.count<1){console.error('SMELT_FAIL',input,out,f);process.exit(22)}return f;};
smelt('iron','iron_ingot',9);smelt('gold_ore','gold_ingot',10);smelt('sand','glass',8);smelt('cobble','smooth_stone',9);
for(const [id,out] of [['iron_ingot','pickaxe'],['gold_ingot','gold_pickaxe']]){if(!api.recipes.some(r=>r.out?.[out]&&r.need?.[id])){console.error('METAL_CRAFT_RECIPE_FAIL',id,out);process.exit(22)}}

// Furnace is a real modal and ESC must close it/resume the game.
api.openFurnaceForTest(fx,fy,fz);s8=api.getState();if(!s8.furnaceOpen||!s8.paused){console.error('FURNACE_OPEN_FAIL',s8);process.exit(23)}
press('Escape');s8=api.getState();if(s8.furnaceOpen||s8.paused){console.error('ESC_FURNACE_RETURN_FAIL',s8);process.exit(23)}

// Fortification ladder and destructibility.
const wx=fx+3,wz=fz,wy=api.terrainHeight(wx,wz)+1;api.setBlock(wx,wy,wz,api.B.PLANKS);const fort=api.ensureFortification(wx,wy,wz,api.B.PLANKS,true);
if(!fort||api.FORT_TIERS.length!==6||api.FORT_TIERS[1].cost?.id!=='planks'||api.FORT_TIERS[2].cost?.id!=='cobble'||api.FORT_TIERS[3].cost?.id!=='smooth_stone'||api.FORT_TIERS[4].cost?.id!=='stone_bricks'||api.FORT_TIERS[5].cost?.id!=='iron_ingot'){console.error('FORT_LADDER_FAIL',fort,api.FORT_TIERS);process.exit(24)}
const hp0=fort.hp;api.damageFortification(wx,wy,wz,11,'test');if(!(fort.hp<hp0&&api.getBlock(wx,wy,wz)===api.B.PLANKS)){console.error('FORT_DAMAGE_FAIL',fort,api.getBlock(wx,wy,wz));process.exit(24)}
api.damageFortification(wx,wy,wz,999,'test');if(api.getBlock(wx,wy,wz)!==api.B.AIR){console.error('FORT_DESTROY_FAIL',api.getBlock(wx,wy,wz));process.exit(24)}

// Door/stair/fence collision shapes need to match their visible geometry.
const cy=api.terrainHeight(wx+2,wz)+1;api.setBlock(wx+2,cy,wz,api.B.WOOD_DOOR);const df=api.ensureFortification(wx+2,cy,wz,api.B.WOOD_DOOR,true),doorBoxes=api.constructionCollisionBoxesForTest(wx+2,cy,wz,api.B.WOOD_DOOR);if(!doorBoxes.length){console.error('DOOR_COLLISION_FAIL');process.exit(25)}df.open=true;if(api.constructionCollisionBoxesForTest(wx+2,cy,wz,api.B.WOOD_DOOR).length!==0){console.error('OPEN_DOOR_COLLISION_FAIL');process.exit(25)}
api.setBlock(wx+3,cy,wz,api.B.WOOD_STAIRS);api.ensureFortification(wx+3,cy,wz,api.B.WOOD_STAIRS,true);if(api.constructionCollisionBoxesForTest(wx+3,cy,wz,api.B.WOOD_STAIRS).length!==2){console.error('STAIR_COLLISION_FAIL');process.exit(25)}
api.setBlock(wx+4,cy,wz,api.B.WOOD_FENCE);api.ensureFortification(wx+4,cy,wz,api.B.WOOD_FENCE,true);if(api.constructionCollisionBoxesForTest(wx+4,cy,wz,api.B.WOOD_FENCE).length<3){console.error('FENCE_COLLISION_FAIL');process.exit(25)}

// Respawn must return near the remembered world spawn, never a random ocean/origin.
const ws=[...s8.worldSpawn];api.setPlayerPosForTest([ws[0]+420,20,ws[2]+420]);api.respawnForTest();s8=api.getState();const respawnDist=Math.hypot(s8.player.pos[0]-ws[0],s8.player.pos[2]-ws[2]);const respawnGround=api.getBlock(Math.floor(s8.player.pos[0]),Math.floor(s8.player.pos[1]-.1),Math.floor(s8.player.pos[2]));if(respawnDist>13||respawnGround===api.B.WATER){console.error('RESPAWN_ANCHOR_FAIL',{ws,pos:s8.player.pos,respawnDist,respawnGround});process.exit(26)}

// V8 new material/structure definitions are available as real placeables.
for(const id of ['furnace','glass','smooth_stone','iron_block','gold_block','wood_door','wood_stairs','wood_fence','gold_pickaxe','gold_axe','gold_shovel','gold_sword'])if(!api.itemDefs[id]){console.error('V8_ITEM_DEF_FAIL',id);process.exit(27)}
console.log(JSON.stringify({ok:true,version:api.version,biomes:biomes.size,heightRange:[Math.min(...heights),Math.max(...heights)],mouthSamples:mouths,mineshaftEnabledSamples:mines,startTorch:24,starterWoodTools:true,renderDistance:state.renderDistance,inventorySwap:true,rightDragCraft:true,rightClickFinalRefresh:true,adminPanel:true,universalMining:true,enemyDefs:Object.keys(api.enemyDefs).length,birdDefs:Object.keys(api.birdDefs).length,starterChest:true,starterChestTorches:state.starterTorchCount,startHour:Number(startHour.toFixed(2)),daySeconds:state.daySeconds,spawnRelief,audioAssets:true,chestTooltip:true,coalSamples:coal,ironSamples:iron,ruinTypes:api.ruinTypes.length,ruinSeen:ruinSeen.size,ruinBlocks,goldSamples:gold,escResume:true,furnaceSmelting:true,fortificationLadder:true,respawnDistance:Number(respawnDist.toFixed(2)),fullMap:true},null,2));
process.exit(0);
