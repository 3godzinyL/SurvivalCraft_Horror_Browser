import {VILLAGE_PLANS} from './village-plans.js';
/** NightCraft V26: deterministic island village, usable from browser and chunk worker.
 * Never touches the DOM and never generates a neighbouring chunk.
 * The descriptor is created once for each new world and persisted in its save.
 */
export const VILLAGE_RADIUS = 48;
const FLOOR_RADIUS = 46;
export function selectVillageSite(S, spawn) {
  const seed=S.worldSeed>>>0;
  let best=null;
  for(let i=0;i<92;i++){
    const a=(i/92)*Math.PI*2 + S.hash2i(i,seed&65535,0x8a10)*.28;
    const dist=270+S.hash2i(i,(seed>>>16)&65535,0x8a11)*160;
    const x=Math.round((spawn[0]+Math.cos(a)*dist)/8)*8;
    const z=Math.round((spawn[2]+Math.sin(a)*dist)/8)*8;
    const h=S.terrainHeight(x,z);
    if(h>S.SEA+28 || h<S.SEA-12)continue;
    const samples=[[28,0],[-28,0],[0,28],[0,-28],[66,0],[-66,0],[0,66],[0,-66]];
    let coast=0,rough=0;
    for(const [dx,dz] of samples){const yh=S.terrainHeight(x+dx,z+dz);if(yh<=S.SEA+2)coast++;rough+=Math.abs(h-yh);}
    const score=coast*13 - rough*.35-Math.abs(h-(S.SEA+5))*1.4 + S.hash2i(x,z,seed^0xa8bf)*9;
    if(!best||score>best.score)best={x,z,y:S.SEA+6,score};
  }
  if(!best){const a=S.hash2i(seed&65535,seed>>>16,0x7af)*Math.PI*2;best={x:Math.round((spawn[0]+Math.cos(a)*335)/8)*8,z:Math.round((spawn[2]+Math.sin(a)*335)/8)*8,y:S.SEA+6};}
  return {x:best.x|0,z:best.z|0,y:best.y|0,seed,stage:0,buildings:[],stock:{wood:0,stone:0,iron:0},created:true};
}
export function villageIslandHeight(S,x,z,base) {
  const v=S.villagePlan;if(!v||(S.worldgenVersion||16)<26)return base;
  const dx=x-v.x,dz=z-v.z,r=Math.hypot(dx,dz);
  // An actually walkable western embankment connects across the lagoon
  // to mainland terrain. Gradual ramps eliminate the previous 5-block cliff.
  const bridge=dx<-42&&dx>-142&&Math.abs(dz)<4;
  if(bridge){
    const far=-dx;
    if(far<106)return Math.round(v.y-4*Math.min(1,(far-42)/64));
    const blend=Math.max(0,Math.min(1,(142-far)/36));
    return Math.round(base*(1-blend)+(v.y-4)*blend);
  }
  if(r>=84)return base;
  if(r<=48)return v.y;
  if(r<54)return Math.round(v.y+(S.SEA-2-v.y)*(r-48)/6);
  if(r<=69)return S.SEA-3;
  const t=Math.max(0,Math.min(1,(r-69)/15));
  return Math.round((S.SEA-3)*(1-t)+base*t);
}
export const BUILDINGS = [
  {type:'mill',dx:0,dz:0,w:17,d:17,h:27},
  {type:'house',dx:-24,dz:-16,w:9,d:7,h:5},
  {type:'forge',dx:24,dz:-18,w:9,d:9,h:6},
  {type:'farm',dx:5,dz:30,w:19,d:9,h:2},
  {type:'hall',dx:26,dz:17,w:9,d:7,h:5},
  {type:'well',dx:-28,dz:18,w:7,d:7,h:4},
];
function renderHouse(set,S,cx,cz,y,w,d,h,type){
  const x0=cx-Math.floor(w/2),z0=cz-Math.floor(d/2),B=S.B;
  const wood=type==='hall'?B.DARK_PLANKS:B.OLD_PLANKS,roof=type==='forge'?B.STONE_BRICKS:type==='hall'?B.DARK_PLANKS:B.DARK_PLANKS;
  for(let z=0;z<d;z++)for(let x=0;x<w;x++){
    const wx=x0+x,wz=z0+z,edge=x===0||z===0||x===w-1||z===d-1,post=(x===0||x===w-1)&&(z===0||z===d-1);
    set(wx,y,wz,B.COBBLE);
    for(let h0=1;h0<=h;h0++){
      let tile=B.AIR;
      if(edge){tile=post?B.WOOD:(h0===3&&((x===0||x===w-1)&&z===Math.floor(d/2) || (z===0||z===d-1)&&x===Math.floor(w/3)) ? B.GLASS:wood);}
      if(z===d-1&&x===Math.floor(w/2)&&h0<=2)tile=h0===1?B.WOOD_DOOR:B.AIR;
      set(wx,y+h0,wz,tile);
    }
  }
  const maxRise=Math.ceil(w/2)+1;
  for(let rise=0;rise<maxRise;rise++){
    const inset=rise-1;
    for(let z=-1;z<=d;z++)for(let x=inset;x<w-inset;x++){
      set(x0+x,y+h+1+rise,z0+z,roof);
    }
    // Timber gables seal the roof instead of holes admitting rain and sunlight.
    for(let x=rise;x<w-rise;x++)for(const z of [0,d-1])
      if(rise>0)set(x0+x,y+h+rise,z0+z,wood);
  }
  for(const z of [0,d-1])for(const x of [0,w-1])for(let yy=1;yy<=h;yy++)set(x0+x,y+yy,z0+z,B.WOOD);
  for(let x=1;x<w-1;x++)for(const z of [0,d-1])if(x%3===1){
    set(x0+x,y+3,z0+z,B.GLASS);set(x0+x,y+2,z0+z,B.OLD_PLANKS);
  }
  // Entrance stays two blocks tall after the window pass.
  set(cx,y+1,z0+d-1,B.WOOD_DOOR);set(cx,y+2,z0+d-1,B.AIR);
  for(let x=-1;x<=1;x++)set(cx+x,y,z0+d,B.OLD_PLANKS);
  // Windowsills, porch supports, forge anvil and chimney.
  for(let x of [1,w-2])for(let z of [1,d-2])set(x0+x,y+1,z0+z,B.WOOD);
  if(type==='forge'){
    for(let sy=1;sy<11;sy++)set(x0+2,y+sy,z0+2,B.STONE_BRICKS);
    set(x0+4,y+1,z0+4,B.FURNACE);set(x0+6,y+1,z0+4,B.IRON_BLOCK);
    set(x0+7,y+1,z0+4,B.CAMPFIRE);
  }else{
    set(x0+2,y+1,z0+2,B.CHEST);
    set(x0+w-3,y+1,z0+2,B.TORCH);
    if(type==='hall')set(x0+Math.floor(w/2)+3,y+1,z0+Math.floor(d/2),B.CHISELED_STONE);
  }
}
/** Chunk-safe octagonal grain mill. The rotor is animated by renderVillage,
 * the stone foundation/timber stories, roof, interior and doorway are voxels. */
export function renderMill(set,S,cx,cz,y){
  const B=S.B;
  const inside=(dx,dz,r=8)=>Math.abs(dx)<=r&&Math.abs(dz)<=r&&Math.abs(dx)+Math.abs(dz)<=Math.round(r*1.56);
  const hasEdge=(dx,dz,r)=>!inside(dx-1,dz,r)||!inside(dx+1,dz,r)||!inside(dx,dz-1,r)||!inside(dx,dz+1,r);
  // Stone socle and elevated oak-framed octagonal structure.
  for(let dz=-10;dz<=10;dz++)for(let dx=-10;dx<=10;dx++){
    if(!inside(dx,dz,10))continue;
    set(cx+dx,y-1,cz+dz,B.COBBLE);
    if(inside(dx,dz,8))set(cx+dx,y,cz+dz,B.OLD_PLANKS);
  }
  for(let floor=1;floor<=22;floor++){
    const r=floor>14?7:8;
    for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
      if(!inside(dx,dz,r))continue;
      const edge=hasEdge(dx,dz,r),post=edge&&((Math.abs(dx)>=r-1&&Math.abs(dz)<=2)||(Math.abs(dz)>=r-1&&Math.abs(dx)<=2)||(Math.abs(dx)+Math.abs(dz)>=Math.round(r*1.56)-1));
      let id=B.AIR;
      if(edge){
        id=floor<=3?B.STONE_BRICKS:post||floor===4||floor===14||floor===22?B.WOOD:B.OLD_PLANKS;
        if(floor>=6&&floor<=7&&((Math.abs(dx)===r&&dz===0)||(Math.abs(dz)===r&&dx===0)))id=B.GLASS;
        if(floor>=17&&floor<=18&&((Math.abs(dx)===r&&dz===0)||(Math.abs(dz)===r&&dx===0)))id=B.GLASS;
      }
      if(dz===8&&dx===0&&floor<=3)id=floor===1?B.WOOD_DOOR:B.AIR;
      if((floor===7||floor===14)&&Math.abs(dx)<=r&&Math.abs(dz)<=r&&!edge){
        id=dx>=-5&&dx<=-3&&dz>=-3&&dz<=1?B.AIR:B.DARK_PLANKS;
      }
      set(cx+dx,y+floor,cz+dz,id);
    }
  }
  // Layered, weathered steep octagonal cap, with roof-tip finial.
  for(let t=0;t<8;t++){
    const r=Math.max(0,9-Math.floor(t*1.28));
    for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)if(inside(dx,dz,r)){
      const roof=t<2?B.DARK_PLANKS:t<5?B.OLD_PLANKS:B.DARK_PLANKS;
      set(cx+dx,y+23+t,cz+dz,roof);
    }
  }
  for(let j=0;j<3;j++)set(cx,y+31+j,cz,B.WOOD);
  set(cx,y+34,cz,B.TORCH);
  // Storage, millstones, grain bins and stair-like internal ladder.
  for(let k=0;k<4;k++){
    set(cx-5+k,y+1,cz-3,B.OLD_PLANKS);
    set(cx-5+k,y+2,cz-3,B.OLD_PLANKS);
  }
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)set(cx+dx,y+1,cz-2+dz,B.CHISELED_STONE);
  for(let floor=1;floor<=20;floor++)set(cx-5,y+floor,cz,B.WOOD_FENCE);
  for(let dx of [-5,5])for(let dz of [-5,5]){
    set(cx+dx,y+1,cz+dz,B.CHEST);
    set(cx+dx,y+3,cz+dz,B.TORCH);
  }
  // Timber transom framing both sides of the doorway (true hinge door at centre).
  for(let dx of [-2,2])for(let floor=1;floor<=5;floor++)set(cx+dx,y+floor,cz+9,B.WOOD);
  for(let dx=-2;dx<=2;dx++)set(cx+dx,y+5,cz+9,B.DARK_PLANKS);
  // Decorative oak balconies, cross-braces, window gables and grain chutes.
  for(const dz of [-8,8])for(const dx of [-7,7]){
    for(let h=8;h<=13;h++)set(cx+dx,y+h,cz+dz,B.WOOD);
    set(cx+dx,y+8,cz+dz+(dz>0?1:-1),B.DARK_PLANKS);
  }
  for(const dx of [-4,4]){
    for(let dz=6;dz<=10;dz++)set(cx+dx,y+14,cz+dz,B.OLD_PLANKS);
    set(cx+dx,y+15,cz+10,B.WOOD_FENCE);
  }
  for(const z0 of [-5,5]){
    set(cx+7,y+9,cz+z0,B.GLASS);
    set(cx-7,y+9,cz+z0,B.GLASS);
    set(cx+7,y+10,cz+z0,B.GLASS);
  }
  for(let d=0;d<3;d++)set(cx-4+d,y+1,cz+4,B.OLD_PLANKS);
  set(cx-3,y+2,cz+4,B.CHEST);
  // Lit upper floors and continuous gallery rails give the mill a readable silhouette.
  for(const level of [10,18])for(const dx of [-5,5])set(cx+dx,y+level,cz+3,B.TORCH);
  for(let dx=-5;dx<=5;dx++)if(Math.abs(dx)>2){
    set(cx+dx,y+14,cz+9,B.OLD_PLANKS);set(cx+dx,y+15,cz+10,B.WOOD_FENCE);
  }
  // Wooden landing, a path from the entrance to the market and milling yard.
  for(let dz=9;dz<=13;dz++)for(let dx=-2;dx<=2;dx++)set(cx+dx,y,cz+dz,B.OLD_PLANKS);
}
/** Every purchasable project produces real persistent voxels, not a mock plan. */
export function buildUserStructure(S,kind,x,y,z,set,axis='x') {
  const B=S.B,plan=VILLAGE_PLANS[kind];if(!plan)return;
  if(kind==='wall'){
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)set(x+(axis==='z'?0:b),y+a,z+(axis==='z'?b:0),B.REINFORCED_WOOD);
    for(const d of [0,2])set(x+(axis==='z'?0:d),y+3,z+(axis==='z'?d:0),B.WOOD);
    return;
  }
  if(kind==='farm'){
    for(let dz=0;dz<11;dz++)for(let dx=0;dx<13;dx++){
      const edge=dx===0||dz===0||dx===12||dz===10;
      set(x+dx,y-1,z+dz,edge?B.OLD_PLANKS:dx===6?B.WATER:B.LOAM);
      set(x+dx,y,z+dz,B.AIR);
      if(edge&&((dx*31+dz*17)%9>5))set(x+dx,y,z+dz,B.WOOD_FENCE);
    }
    for(const dz of [1,9])set(x+6,y,z+dz,B.OLD_PLANKS);
    return;
  }
  const w=plan.size[0],d=plan.size[1];
  const forge=kind==='forge',dark=kind==='guard'||kind==='armory';
  renderHouse(set,S,x+Math.floor(w/2),z+Math.floor(d/2),y,w,d,dark?6:5,forge?'forge':dark?'hall':'house');
  if(kind==='armory'){
    for(let k=1;k<4;k++)set(x+k,y+1,z+2,B.IRON_BLOCK);
    set(x+w-3,y+1,z+3,B.CHEST);
  }
  if(kind==='guard'){
    for(let i=0;i<2;i++)for(let h=1;h<=8;h++)set(x+1+i*6,y+h,z+1,B.WOOD);
    for(let i=1;i<w-1;i++)set(x+i,y+8,z+1,B.OLD_PLANKS);
  }
  if(kind==='granary'){
    for(let i=2;i<w-2;i+=2){set(x+i,y+1,z+2,B.OLD_PLANKS);set(x+i,y+2,z+2,B.OLD_PLANKS);}
    set(x+2,y+1,z+4,B.CHEST);
  }
  if(kind==='farmer')set(x+w-3,y+1,z+d-3,B.CHEST);
}
export function stampVillageChunk(S,cx,cz,put){
  const v=S.villagePlan;if(!v||(S.worldgenVersion||16)<26)return;
  const minx=cx*16,maxx=minx+15,minz=cz*16,maxz=minz+15;
  if(v.x<minx-153||v.x>maxx+75||v.z<minz-75||v.z>maxz+75)return;
  const y=v.y,B=S.B;
  const set=(x,h,z,id)=>{if(x>=minx&&x<=maxx&&z>=minz&&z<=maxz&&h>0&&h<S.WORLD_H-1)put(x,h,z,id);};
  // Remove natural foliage, clear walkways and vegetation in the city radius.
  for(let wz=Math.max(minz,v.z-50);wz<=Math.min(maxz,v.z+50);wz++)for(let wx=Math.max(minx,v.x-50);wx<=Math.min(maxx,v.x+50);wx++){
    const dx=wx-v.x,dz=wz-v.z,r=Math.hypot(dx,dz);
    if(r>FLOOR_RADIUS+2)continue;
    for(let yy=y;yy<Math.min(S.WORLD_H-1,y+(r<13?39:17));yy++)set(wx,yy,wz,B.AIR);
    // Paved spokes, inner square and architectural edging.
    const road=(Math.abs(dx)<2&&Math.abs(dz)<38)||(Math.abs(dz)<2&&Math.abs(dx)<38);
    const plaza=Math.abs(dx)<11&&Math.abs(dz)<10;
    const tile=road||plaza?((wx+wz)%11===0?B.STONE_BRICKS:B.COBBLE):r>FLOOR_RADIUS-2?B.WEATHERED_BRICKS:B.GRASS;
    set(wx,y-1,wz,tile);
    if(r>FLOOR_RADIUS-2&&r<FLOOR_RADIUS&&S.hash2i(wx,wz,v.seed^0x10ac)>.74){set(wx,y,wz,B.WOOD_FENCE);if((wx+wz)%23===0)set(wx,y+1,wz,B.TORCH);}
    else if(r>15&&r<FLOOR_RADIUS-4&&!road&&!plaza){const f=S.hash2i(wx,wz,v.seed^0x93aa);if(f>.984)set(wx,y,wz,f>.999?B.HEATHER:f>.994?B.FERN:B.TALLGRASS);}
  }
  // Stamp the causeway separately, including where it exits the island.
  // Clearing natural tree/foliage avoids a deceptive "bridge" blocked by trunks.
  if(minz<=v.z+5&&maxz>=v.z-5&&minx<=v.x-39&&maxx>=v.x-143){
    for(let x=Math.max(minx,v.x-141);x<=Math.min(maxx,v.x-43);x++){
      for(let dz=-3;dz<=3;dz++){
        const z=v.z+dz;if(z<minz||z>maxz)continue;
        const surface=S.terrainHeight(x,z);
        set(x,surface,z,Math.abs(dz)===3?B.COBBLE:B.OLD_PLANKS);
        for(let h=surface+1;h<=Math.min(S.WORLD_H-2,surface+18);h++)set(x,h,z,B.AIR);
        if(Math.abs(dz)===3&&x%12===0)set(x,surface+1,z,B.WOOD_FENCE);
        if(Math.abs(dz)===3&&x%12===0)set(x,surface+2,z,B.TORCH);
      }
    }
  }
  for(const b of BUILDINGS){const x=v.x+b.dx,z=v.z+b.dz;
    if(x+b.w<minx||x-b.w>maxx||z+b.d<minz||z-b.d>maxz)continue;
    if(b.type==='mill')renderMill(set,S,x,z,y);
    if(b.type==='house'||b.type==='forge'||b.type==='hall')renderHouse(set,S,x,z,y,b.w,b.d,b.h,b.type);
    if(b.type==='farm'){
      for(let dz=-5;dz<=5;dz++)for(let dx=-9;dx<=9;dx++){
        const px=x+dx,pz=z+dz,edge=Math.abs(dx)===9||Math.abs(dz)===5;
        const channel=Math.abs(dx)===0;
        set(px,y-1,pz,edge?B.OLD_PLANKS:channel?B.WATER:B.LOAM);
        if(edge && S.hash2i(px,pz,v.seed^0x51a2)>.82)set(px,y,pz,B.WOOD_FENCE);
        else set(px,y,pz,B.AIR);
      }
      for(const dz of [-5,5])set(x,y,dz+z,B.OLD_PLANKS);
    }
    if(b.type==='well'){
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
        const d=Math.max(Math.abs(dx),Math.abs(dz));set(x+dx,y-1,z+dz,d===3?B.COBBLE:B.WATER);
        if(d===3)set(x+dx,y,z+dz,B.STONE_BRICKS);
      }
      for(let dx of [-2,2])for(let dz of [-2,2])for(let yy=1;yy<=4;yy++)set(x+dx,y+yy,z+dz,B.WOOD);
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)set(x+dx,y+5,z+dz,B.DARK_PLANKS);
    }
  }
  // V28 · Actual accessible old mine under the north-west part of the village.
  // A 3-wide descending corridor has a solid stepped floor, air clearance,
  // timbered supports and lamps. World-gen writes are chunk-safe and deterministic.
  const mx=v.x-12,mouthZ=v.z-35;
  for(let step=0;step<=22;step++){
    const zz=mouthZ+step,level=y-Math.floor(step/3);
    for(let xx=-2;xx<=2;xx++){
      const ax=mx+xx;
      set(ax,level-1,zz,Math.abs(xx)===2?B.STONE_BRICKS:B.COBBLE);
      for(let yy=level;yy<=level+3;yy++)set(ax,yy,zz,Math.abs(xx)===2?B.STONE_BRICKS:B.AIR);
      if(step%5===0){
        for(let yy=level;yy<=level+3;yy++)if(Math.abs(xx)===2)set(ax,yy,zz,B.WOOD);
        if(xx===0)set(ax,level+3,zz,B.WOOD);
      }
    }
    if(step%6===3){set(mx-1,level+2,zz,B.TORCH);set(mx+1,level+2,zz,B.TORCH);}
  }
  // A larger bottom chamber with deposits to mine and an actual working face.
  const bottom=y-7;
  for(let zz=mouthZ+23;zz<=mouthZ+31;zz++)for(let xx=-5;xx<=5;xx++){
    const edge=Math.abs(xx)>=4||zz>=mouthZ+30;
    set(mx+xx,bottom-1,zz,B.COBBLE);
    for(let yy=bottom;yy<=bottom+4;yy++)set(mx+xx,yy,zz,edge?B.STONE_BRICKS:B.AIR);
    if(zz===mouthZ+27&&Math.abs(xx)<3)set(mx+xx,bottom+1,zz,xx===0?B.IRON:B.COAL);
  }
  // Continued cave branch going deeper, so the mine does not dead-end abruptly.
  for(let step=0;step<=18;step++){
    const zz=mouthZ+31+step,level=bottom-Math.floor(step/4);
    for(let xx=-3;xx<=3;xx++){
      const ax=mx+xx;
      set(ax,level-1,zz,Math.abs(xx)===3?B.SLATE:B.COBBLE);
      for(let yy=level;yy<=level+3;yy++)set(ax,yy,zz,Math.abs(xx)===3?B.SLATE:B.AIR);
      if(step%7===2&&Math.abs(xx)===3)for(let yy=level;yy<=level+3;yy++)set(ax,yy,zz,B.WOOD);
    }
    if(step%6===1){set(mx-2,level+2,zz,B.TORCH);set(mx+2,level+2,zz,B.TORCH);}
  }
  for(let zz=mouthZ+49;zz<=mouthZ+55;zz++)for(let xx=-5;xx<=5;xx++){
    const edge=Math.abs(xx)>=4||zz===mouthZ+55;
    set(mx+xx,bottom-6-1,zz,B.COBBLE);
    for(let yy=bottom-6;yy<=bottom-1;yy++)set(mx+xx,yy,zz,edge?B.DARKSTONE:B.AIR);
    if((zz===mouthZ+53||zz===mouthZ+54)&&Math.abs(xx)<=2)set(mx+xx,bottom-4,zz,xx===0?B.GOLD:B.IRON);
  }
  // Iconic dark-oak/stone entry arch above the surface walkway.
  for(let side of [-2,2]){
    set(mx+side,y,mouthZ-1,B.STONE_BRICKS);
    for(let h=1;h<=4;h++)set(mx+side,y+h,mouthZ-1,h<2?B.STONE_BRICKS:B.WOOD);
    set(mx+side,y+3,mouthZ-2,B.TORCH);
  }
  for(let xx=-2;xx<=2;xx++)set(mx+xx,y+5,mouthZ-1,B.DARK_PLANKS);
  for(let dz=-2;dz<=-1;dz++)for(let xx=-1;xx<=1;xx++)set(mx+xx,y-1,mouthZ+dz,B.COBBLE);
  // Genuinely present lantern poles, not only blocks without a render pass.
  const lanterns=[[-18,4],[18,5],[-9,23],[14,24],[-32,-9],[33,-6],[-30,33],[27,34]];
  for(const [dx,dz] of lanterns){
    if(Math.hypot(dx,dz)>47)continue;
    for(let h=1;h<=2;h++)set(v.x+dx,y+h,v.z+dz,B.WOOD);
    set(v.x+dx,y+3,v.z+dz,B.TORCH);
  }
  // Central construction board, reachable by right click or V.
  for(let yy=0;yy<=2;yy++)set(v.x-13,y+yy,v.z+2,B.WOOD);
  set(v.x-13,y+2,v.z+3,B.OLD_PLANKS);
  set(v.x-13,y+3,v.z+2,B.TORCH);
  // User-placed completed prefabs reconstructed in the same chunk-local pass.
  for(const p of v.buildings||[]){
    if(!p||!['house','wall'].includes(p.type))continue;
    const radius=p.type==='house'?12:3;
    if(p.x+radius<minx||p.x-radius>maxx||p.z+radius<minz||p.z-radius>maxz)continue;
    buildUserStructure(S,p.type,p.x,p.y,p.z,set,p.axis||'x');
  }
}
