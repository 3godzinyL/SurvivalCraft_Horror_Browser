export const DEFAULT_SEED='hollow-pines-317';
export const DEFAULT_GRAPHICS=Object.freeze({version:35,renderDistance:12,resolution:1,adaptive:false,filtering:'mipmap',anisotropy:4,vegetation:80,shadows:true,water:2});
export function normalizeGraphics(raw={}){
 raw=raw&&typeof raw==="object"?raw:{};
 const bound=(n,a,b,f)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;
 return {...DEFAULT_GRAPHICS,renderDistance:Math.round(bound(raw.renderDistance,2,24,12)),resolution:bound(raw.resolution,.5,1.5,1),adaptive:raw.adaptive===true,filtering:raw.filtering==='pixel'?'pixel':'mipmap',anisotropy:bound(raw.anisotropy,1,16,4),vegetation:bound(raw.vegetation,32,128,80),shadows:raw.shadows!==false,water:Math.round(bound(raw.water,0,2,2))};
}
export function zoomFov(base,amount){return base+(Math.PI/12-base)*Math.max(0,Math.min(1,amount));}
