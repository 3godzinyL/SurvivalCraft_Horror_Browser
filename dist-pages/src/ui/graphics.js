import {DEFAULT_GRAPHICS,normalizeGraphics} from '../render/graphics-config.js';
export function install(S){
 const key='nightcraft-graphics-v35';let raw={};
 try{const stored=localStorage.getItem(key);if(stored){raw=JSON.parse(stored);S.graphicsFromStorage=true;}}catch{}
 S.graphics=normalizeGraphics(raw);S.renderDistance=S.graphics.renderDistance;S.dynamicPixelRatio=S.graphics.resolution;
 const panel=document.getElementById('graphicsPanel');if(!panel)return;
 const controls={renderDistance:'graphicsRange',resolution:'graphicsResolution',filtering:'graphicsFilter',anisotropy:'graphicsAnisotropy',vegetation:'graphicsVegetation',water:'graphicsWater',adaptive:'graphicsAdaptive',shadows:'graphicsShadows'};
 S.syncGraphicsUI=()=>{for(const [name,id] of Object.entries(controls)){const el=document.getElementById(id);if(el.type==='checkbox')el.checked=S.graphics[name];else el.value=String(S.graphics[name]);}S.UI.renderDistanceSelect.value=String(S.renderDistance);};
 S.setGraphicsSettings=(values,persist=true)=>{
  const before=S.renderDistance;S.graphics=normalizeGraphics({...S.graphics,...values});S.renderDistance=S.graphics.renderDistance;S.dynamicPixelRatio=S.graphics.resolution;
  S.applyAtlasFiltering?.();S.resize?.();S.syncGraphicsUI();S.waterReflection?.invalidate?.();
  if(S.running&&before!==S.renderDistance)S.updateStreaming(S.player.pos[0],S.player.pos[2],true);
  if(persist)try{localStorage.setItem(key,JSON.stringify(S.graphics));S.graphicsFromStorage=true;}catch{}
 };
 for(const [name,id] of Object.entries(controls))document.getElementById(id).onchange=e=>{
  const el=e.currentTarget,value=el.type==='checkbox'?el.checked:name==='filtering'?el.value:Number(el.value);S.setGraphicsSettings({[name]:value});
 };
 S.UI.renderDistanceSelect.onchange=()=>S.setGraphicsSettings({renderDistance:Number(S.UI.renderDistanceSelect.value)});
 let wasPaused=true;
 S.openGraphicsSettings=()=>{wasPaused=S.paused;if(S.running){S.paused=true;S.clearTransientInput?.();S.expectPointerUnlock=true;document.exitPointerLock?.();}S.syncGraphicsUI();panel.classList.remove('hidden');};
 S.closeGraphicsSettings=()=>{panel.classList.add('hidden');if(S.running&&!wasPaused)S.resumeGame?.();};
 for(const id of ['openGraphicsMain','openGraphicsPause'])document.getElementById(id).onclick=S.openGraphicsSettings;
 document.getElementById('graphicsClose').onclick=S.closeGraphicsSettings;
 const presets={
 low:{...DEFAULT_GRAPHICS,resolution:.75,vegetation:48,water:1,anisotropy:2},
 balanced:DEFAULT_GRAPHICS,
 high:{...DEFAULT_GRAPHICS,resolution:1.25,vegetation:112,anisotropy:8}
 };
 for(const button of panel.querySelectorAll('[data-preset]'))button.onclick=()=>S.setGraphicsSettings(presets[button.dataset.preset]);
 document.addEventListener('keydown',e=>{if(!panel.classList.contains('hidden')){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();S.closeGraphicsSettings();}}},true);
 S.syncGraphicsUI();S.applyAtlasFiltering?.();
}
