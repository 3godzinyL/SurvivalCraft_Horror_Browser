import {VILLAGE_PLANS,VILLAGE_KIT_KINDS,VILLAGE_KIT_ID,kitKindFromItem,villageKitCostText} from '../world/village-plans.js';
/** Village campaign systems. No DOM dependency in simulation loops or procedural worldgen. */
import {selectVillageSite,buildUserStructure} from '../world/village-worldgen.js';
export const VILLAGER_ROLES=[
  {name:'Mistrz Aldryk',role:'młynarz · starszy osady',home:[0,5],work:[0,5],color:[.57,.38,.23,1]},
  {name:'Kornel',role:'robotnik młyna',home:[-3,-2],work:[-5,8],color:[.44,.49,.29,1]},
  {name:'Iwo',role:'robotnik młyna',home:[3,-3],work:[5,10],color:[.46,.37,.28,1]},
  {name:'Runa',role:'robotniczka młyna',home:[0,-4],work:[-4,6],color:[.38,.48,.41,1]},
  {name:'Mira',role:'rolniczka',home:[-25,-16],work:[5,30],color:[.41,.55,.33,1]},
  {name:'Borys',role:'kowal',home:[25,-18],work:[25,-18],color:[.52,.34,.22,1]},
  {name:'Oskar',role:'strażnik',home:[-25,-16],work:[-36,0],color:[.30,.39,.43,1]},
];
export const VILLAGE_DOORS=[{dx:0,dz:8,type:'mill'},{dx:-24,dz:-13,type:'house'},{dx:24,dz:-14,type:'forge'},{dx:26,dz:20,type:'hall'}];
export function activeVillage(S){return !!(S.villagePlan&&(S.worldgenVersion||16)>=26);}
export function canPlacePrefab(S,kind,x,y,z) {
  const v=S.villagePlan;if(!v)return {ok:false,reason:'Brak wioski w tym świecie.'};
  if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z))return {ok:false,reason:'Niepoprawna pozycja.'};
  if(Math.hypot(x-v.x,z-v.z)>95)return {ok:false,reason:'Buduj w promieniu 95 kratek od osady.'};
  if(!VILLAGE_PLANS[kind])return {ok:false,reason:'Nieznana konstrukcja.'};
  const axis=S.villagePreviewAxis||'x';
  const [w,d]=VILLAGE_PLANS[kind].size;
  const sx=kind==='wall'?(axis==='z'?1:3):w,sz=kind==='wall'?(axis==='z'?3:1):d;
  if(y<2||y+10>=S.WORLD_H)return {ok:false,reason:'Za mało miejsca w pionie.'};
  for(let dz=0;dz<sz;dz++)for(let dx=0;dx<sx;dx++){
    const xx=x+dx,zz=z+dz;
    // Validate *actual loaded terrain* rather than procedural height: paved
    // village floor and player modifications need not equal terrainHeight.
    // Chunk lookups must be non-generating while previewing.
    const cx=S.floorDiv(xx,16),cz=S.floorDiv(zz,16);
    if(!S.chunks.has(S.chunkKey(cx,cz)))return {ok:false,reason:'Poczekaj na załadowanie chunków.'};
    const base=S.peekLoadedBlock(xx,y-1,zz);
    if(!S.blockDefs[base]?.solid||base===S.B.WOOD_DOOR)return {ok:false,reason:'Brak stabilnego podłoża. Wyrównaj teren.'};
    for(let yy=y;yy<y+(kind==='farm'?2:kind==='wall'?4:13);yy++){
      const tile=S.peekLoadedBlock(xx,yy,zz);
      if(tile!==S.B.AIR&&tile!==S.B.WATER&&!S.blockDefs[tile]?.decor)return {ok:false,reason:'Teren zajęty przez inne bloki.'};
    }
  }
  const px=S.player?.pos?.[0],pz=S.player?.pos?.[2];
  if(px>=x-.6&&px<=x+sx+.6&&pz>=z-.6&&pz<=z+sz+.6)return {ok:false,reason:'Odsuń się od stawianej konstrukcji.'};
  return {ok:true,reason:'Można budować.'};
}
// Bounded grid search around the settlement. Results are cached per citizen and
// recalculated on intention changes / collisions, not every render frame.
function walkable(S,x,z){
  const v=S.villagePlan;if(!v)return false;
  if(!S.chunks.has(S.chunkKey(S.floorDiv(x,S.CHUNK),S.floorDiv(z,S.CHUNK))))return false;
  const y=villageFloorY(S,x+.5,z+.5,v.y+1);
  if(Math.abs(y-(v.y+1))>2)return false;
  for(const yy of [y,y+1]){
    const tile=S.peekLoadedBlock(x+.5,yy,z+.5);
    if(tile===S.B.WOOD_DOOR){const f=S.fortifications.get(S.fortKey(x,yy,z));if(!f?.open)return false;}
    else if(tile!==S.B.AIR&&tile!==S.B.WATER&&S.blockDefs[tile]?.solid)return false;
  }
  return true;
}
function villageFloorY(S,x,z,guess){
  const base=Math.max(2,Math.floor(guess??((S.villagePlan?.y||0)+1)));
  for(let y=Math.min(S.WORLD_H-3,base+3);y>=Math.max(1,base-4);y--){
    const under=S.peekLoadedBlock(Math.floor(x)+.5,y-1,Math.floor(z)+.5);
    const at=S.peekLoadedBlock(Math.floor(x)+.5,y,Math.floor(z)+.5);
    const head=S.peekLoadedBlock(Math.floor(x)+.5,y+1,Math.floor(z)+.5);
    if(under!=null&&S.blockDefs[under]?.solid&&(!S.blockDefs[at]?.solid||at===S.B.WOOD_DOOR)&&!S.blockDefs[head]?.solid)return y;
  }
  return base;
}
function findVillageRoute(S,sx,sz,tx,tz){
  const v=S.villagePlan,ox=v.x,oz=v.z;
  const start=[Math.floor(sx)-ox,Math.floor(sz)-oz],dest=[Math.floor(tx)-ox,Math.floor(tz)-oz];
  const inside=([x,z])=>x>=-50&&x<=50&&z>=-50&&z<=50;
  if(!inside(start)||!inside(dest))return [];
  const key=([x,z])=>`${x},${z}`,queue=[start],visited=new Map([[key(start),null]]);
  let best=start,bestD=Infinity,head=0;
  for(;head<queue.length&&head<7500;head++){
    const node=queue[head],d=Math.abs(node[0]-dest[0])+Math.abs(node[1]-dest[1]);
    if(d<bestD){best=node;bestD=d;}
    if(d===0)break;
    for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){
      const next=[node[0]+dx,node[1]+dz],k=key(next);
      if(!inside(next)||visited.has(k)||!walkable(S,ox+next[0],oz+next[1]))continue;
      visited.set(k,node);queue.push(next);
    }
  }
  const path=[];let at=best;
  while(at&&path.length<10201){path.push([ox+at[0]+.5,oz+at[1]+.5]);at=visited.get(key(at));}
  path.reverse();return path.slice(1);
}
function roleFor(S,i){
  if(i<VILLAGER_ROLES.length)return VILLAGER_ROLES[i];
  const v=S.villagePlan;
  const extras=(v.buildings||[]).filter(b=>['house','forge','farmer','guard','armory','granary'].includes(b.type));
  const building=extras[i-VILLAGER_ROLES.length];if(!building)return null;
  const roles={house:['osadnik','budowniczy'],forge:['kowal','kowal'],farmer:['rolnik','rolnik'],guard:['strażnik','strażnik'],armory:['płatnerz','płatnerz'],granary:['magazynier','magazynier']};
  const [title,job]=roles[building.type]||roles.house;
  const dims=VILLAGE_PLANS[building.type]?.size||[9,7];
  const dx=building.x+Math.floor(dims[0]/2)-v.x,dz=building.z+Math.floor(dims[1]/2)-v.z;
  const work=building.type==='farmer'?[5,28]:building.type==='guard'?[dx+5,dz+5]:[dx,dz];
  return {name:`${title.charAt(0).toUpperCase()+title.slice(1)} ${i-VILLAGER_ROLES.length+1}`,role:job,home:[dx,dz],work,color:[.43,.48,.39,1]};
}
function villagerStart(S,role,i){
  const v=S.villagePlan;
  return {name:role.name,role:role.role,pos:[v.x+(i===0?role.work[0]:role.home[0])+.5,v.y+1,v.z+(i===0?role.work[1]:role.home[1])+.5],yaw:0,step:0,mode:'home',workTime:0,seed:i,path:[],pathMode:'',pathClock:0};
}
function setVillageDoors(S,open){
  const v=S.villagePlan;
  const doors=[...VILLAGE_DOORS.map(p=>[v.x+p.dx,v.y+1,v.z+p.dz]),...(v.buildings||[]).filter(b=>VILLAGE_PLANS[b.type]&&b.type!=='wall'&&b.type!=='farm').map(b=>[b.x+Math.floor(VILLAGE_PLANS[b.type].size[0]/2),b.y+1,b.z+VILLAGE_PLANS[b.type].size[1]-1])];
  for(const [x,y,z] of doors){
    const id=S.peekLoadedBlock(x,y,z);
    // Opening a door never destroys the block: the hinge state controls
    // visibility, collision and interaction, including generated doors.
    if(id!==S.B.WOOD_DOOR){
      // Old V26 stored AIR edits when doors opened: migrate those once.
      if(id===S.B.AIR&&S.edits.get(S.editKey(x,y,z))===S.B.AIR)S.setBlock(x,y,z,S.B.WOOD_DOOR);
      else continue;
    }
    const f=S.ensureFortification(x,y,z,id,true);
    if(f)f.open=!!open;
  }
}
/** Farms are persistent simulation entities. Each plot has type, growth progress and regeneration. */
function seedFarmPlots(S, farm, centerX, centerZ, width, depth) {
  if(Array.isArray(farm.plots)&&farm.plots.length)return farm;
  const plots=[];
  for(let dz=1;dz<depth-1;dz++)for(let dx=1;dx<width-1;dx++){
    if(dx===Math.floor(width/2)||dx%2===1&&dz%3===0)continue;
    const wx=centerX+dx,wz=centerZ+dz;
    const r=S.hash2i(wx,wz,S.worldSeed^0xa34d);
    plots.push({x:wx,z:wz,type:(r*3)|0,growth:.15+.85*S.hash2i(wx,wz,S.worldSeed^0x213b),harvested:0});
  }
  farm.plots=plots;return farm;
}
function ensureVillageFarms(S){
  const v=S.villagePlan;if(!v)return [];
  v.farms=Array.isArray(v.farms)?v.farms:[];
  const natural={id:'starter',y:v.y,x:v.x-4,z:v.z+25,width:19,depth:11};
  const defined=[natural,...(v.buildings||[]).filter(b=>b.type==='farm').map((b,i)=>({id:`built:${b.x}:${b.z}`,x:b.x,y:b.y,z:b.z,width:13,depth:11}))];
  for(const desc of defined){
    let farm=v.farms.find(f=>f.id===desc.id);
    if(!farm){farm={...desc,plots:[],harvestCount:0};v.farms.push(farm);}
    farm.y=desc.y;
    seedFarmPlots(S,farm,desc.x,desc.z,desc.width,desc.depth);
  }
  return v.farms;
}
function updateFarmCrops(S,dt,atWork){
  const v=S.villagePlan,farms=ensureVillageFarms(S);
  const farmers=(v.citizens||[]).filter(c=>c.role==='rolniczka'||c.role==='rolnik');
  let ripe=null,bestDistance=Infinity;
  for(const f of farms)for(const p of f.plots){
    if(p.growth<1)p.growth=Math.min(1,p.growth+dt*(S.weatherMode==='rain'?1.35:1)/((p.type+1)*60+95));
    if(p.growth>=1&&atWork){
      for(const npc of farmers){const d=Math.hypot(npc.pos[0]-(p.x+.5),npc.pos[2]-(p.z+.5));if(d<bestDistance){bestDistance=d;ripe={plot:p,npc};}}
    }
  }
  if(ripe){
    for(const npc of farmers){
      if(npc!==ripe.npc)continue;
      npc.farmTarget=[ripe.plot.x+.5,ripe.plot.z+.5];
      if(Math.hypot(npc.pos[0]-npc.farmTarget[0],npc.pos[2]-npc.farmTarget[1])<2.2){
        ripe.plot.growth=.08;ripe.plot.harvested++;
        v.food=(v.food||0)+(ripe.plot.type===1?3:2);
        npc.harvestMoment=S.worldSeconds;
        npc.pathClock=17;npc.farmTarget=null;
        for(const farm of farms)if(farm.plots.includes(ripe.plot)){farm.harvestCount++;break;}
      }
    }
  }
}
export function updateVillagerAI(S,dt){
  const v=S.villagePlan;
  if(!activeVillage(S)||!S.running||!S.player?.pos)return;
  const d=Math.hypot(S.player.pos[0]-v.x,S.player.pos[2]-v.z);
  // Farms keep producing between visits; cap catch-up after a long absence.
  const thisDay=Math.floor(S.worldSeconds/S.DAY_SECONDS);
  if(!Number.isInteger(v.lastDay))v.lastDay=thisDay;
  const days=Math.min(14,Math.max(0,thisDay-v.lastDay));
  if(days){const grain=(v.buildings||[]).filter(b=>b.type==='granary').length;v.food=(v.food||0)+days*(4+grain*3+Math.floor((v.buildings||[]).filter(b=>b.type==='house').length/2));v.lastDay=thisDay;}
  if(d>135)return;
  const size=Math.min(22,VILLAGER_ROLES.length+(v.buildings||[]).filter(b=>['house','forge','farmer','guard','armory','granary'].includes(b.type)).length);
  if(!Array.isArray(v.citizens))v.citizens=[];
  while(v.citizens.length<size){const i=v.citizens.length,role=roleFor(S,i);if(!role)break;v.citizens.push(villagerStart(S,role,i));}
  const hour=S.currentWorldHour(),night=hour>=19||hour<6;
  let danger=false;
  for(const e of S.enemies||[]){if(e.spotted&&Math.hypot(e.pos[0]-v.x,e.pos[2]-v.z)<55){danger=true;break;}}
  const hide=night||danger,atWork=!hide&&hour>=7.2&&hour<18;
  // One limited raid per night, approaching by the western island causeway.
  // Old worlds never enter this branch, and ordinary mob spawn caps still apply.
  const raidNumber=typeof S.currentNightNumber==='function'?S.currentNightNumber():1;
  if(night&&hour>=20&&hour<21.5&&d<88&&v.lastRaidNight!==raidNumber&&
     S.spawnEnemy && (S.enemies||[]).length<17){
    v.lastRaidNight=raidNumber;
    const wave=raidNumber<4?2:3,packId=100000+raidNumber;
    for(let i=0;i<wave;i++){
      const ex=v.x-77+(i%2)*2,ez=v.z-1+i*2;
      const e=S.spawnEnemy(raidNumber>4&&i===wave-1?'boar':'wolf',ex,ez,false,{packId});
      if(e){e.spotted=true;e.track=22;e.awareness=1;e.lastSeen=[v.x,v.z];}
    }
    S.showMessage?.('ALARM OSADY! Nocne drapieżniki zbliżają się od grobli.',5);
  }
  const shouldClose=hide&&(hour>=19.12||hour<6||danger);
  // Leave entrances open while the citizens are returning. Do not lock them
  // outside the mill during the first seconds of sunset.
  if(!shouldClose)v.doorCloseDelay=0;
  else v.doorCloseDelay=(v.doorCloseDelay||0)+dt;
  const incoming=v.citizens.some((c,i)=>{const r=roleFor(S,i);return r&&Math.hypot(c.pos[0]-(v.x+r.home[0]+.5),c.pos[2]-(v.z+r.home[1]+.5))>2.5;});
  const closeNow=shouldClose&&(!incoming||v.doorCloseDelay>18);
  if(v.doorsClosed!==closeNow){setVillageDoors(S,!closeNow);v.doorsClosed=closeNow;}
  for(let i=0;i<v.citizens.length;i++){
    const npc=v.citizens[i],role=roleFor(S,i),anchored=i===0;
    const goal=(hide && !anchored)?role.home:(role.role==='rolniczka'||role.role==='rolnik')&&npc.farmTarget?[(npc.farmTarget[0]-v.x),(npc.farmTarget[1]-v.z)]:role.work;
    const mode=anchored?'guide':hide?'rest':atWork?'work':'wander';npc.mode=mode;
    const tx=v.x+goal[0]+.5,tz=v.z+goal[1]+.5;
    npc.pathClock=(npc.pathClock||0)+dt;
    if(npc.pathMode!==mode||!Array.isArray(npc.path)||npc.pathClock>12||Math.hypot((npc.goalX??9999)-tx,(npc.goalZ??9999)-tz)>.65){
      npc.path=findVillageRoute(S,npc.pos[0],npc.pos[2],tx,tz);npc.pathMode=mode;npc.pathClock=0;npc.goalX=tx;npc.goalZ=tz;
    }
    const beforeX=npc.pos[0],beforeZ=npc.pos[2];
    if(anchored){npc.pos[0]=tx;npc.pos[2]=tz;npc.path=[];}
    if(!anchored && npc.path.length){
      const waypoint=npc.path[0],dx=waypoint[0]-npc.pos[0],dz=waypoint[1]-npc.pos[2],length=Math.hypot(dx,dz);
      if(length<.15)npc.path.shift();
      else {
        const speed=((hide&&!anchored)?1.85:(anchored ? .95 : 1.28))*dt,step=Math.min(speed,length),nx=npc.pos[0]+dx/length*step,nz=npc.pos[2]+dz/length*step;
        if(walkable(S,Math.floor(nx),Math.floor(nz))){npc.pos[0]=nx;npc.pos[2]=nz;npc.yaw=Math.atan2(dx,dz);npc.step+=step*(anchored?4.2:8);}
        else npc.pathClock=16;
      }
    }else if(Math.hypot(tx-npc.pos[0],tz-npc.pos[2])>.65)npc.pathClock=16;
    for(let j=0;j<v.citizens.length;j++)if(i!==j){
      const other=v.citizens[j],sx=npc.pos[0]-other.pos[0],sz=npc.pos[2]-other.pos[2],dist=Math.hypot(sx,sz);
      if(dist>.001&&dist<.54){const push=(.54-dist)*.05;npc.pos[0]+=sx/dist*push;npc.pos[2]+=sz/dist*push;}
    }
    const moved=Math.hypot(npc.pos[0]-beforeX,npc.pos[2]-beforeZ);
    npc.prevVX=(npc.pos[0]-beforeX)/Math.max(dt,.001);npc.prevVZ=(npc.pos[2]-beforeZ)/Math.max(dt,.001);
    npc.stuckTimer=moved<.004?(npc.stuckTimer||0)+dt:0;
    if(npc.stuckTimer>1.2){npc.path=findVillageRoute(S,npc.pos[0],npc.pos[2],tx,tz);npc.pathClock=0;npc.stuckTimer=0;}
    npc.pos[1]=villageFloorY(S,npc.pos[0],npc.pos[2],v.y+1);
    if(anchored)npc.yaw=Math.atan2((v.x+.5)-npc.pos[0],(v.z+10.5)-npc.pos[2]);
    if(role.role==='strażnik'&&npc.mode==='work'){
      npc.guardCooldown=Math.max(0,(npc.guardCooldown||0)-dt);
      if(npc.guardCooldown<=0)for(const e of S.enemies||[]){
        if(e.hp<=0||Math.hypot(e.pos[0]-npc.pos[0],e.pos[2]-npc.pos[2])>8)continue;
        const armor=(v.buildings||[]).filter(b=>b.type==='armory').length;
        e.hp=Math.max(0,e.hp-3.5*(1+Math.min(armor,3)*.25));e.flash=Math.max(e.flash||0,.32);
        npc.guardCooldown=2.4;break;
      }
    }
    if(hide&&!anchored){npc.hideTimer=(npc.hideTimer||0)+dt;
      if(npc.hideTimer>24 && Math.hypot(tx-npc.pos[0],tz-npc.pos[2])>3){npc.pos[0]=tx;npc.pos[2]=tz;npc.path=[];}
    }else npc.hideTimer=0;
  }
  updateFarmCrops(S,dt,atWork);
  if(v.lastDay!==Math.floor(S.worldSeconds/S.DAY_SECONDS)&&hour>=7&&hour<8){
    v.lastDay=Math.floor(S.worldSeconds/S.DAY_SECONDS);
    v.stock=v.stock||{wood:0,stone:0,iron:0};v.food=(v.food||0)+2+Math.floor(v.citizens.length/3);
  }
  v.threatened=danger;v.sheltered=hide;
  // Settlement strength is not cosmetic: pressure from hostiles lowers defense;
  // repairs restore it through the dedicated crafting board.
  if(danger){
    const attackers=(S.enemies||[]).filter(e=>e.spotted&&e.hp>0&&Math.hypot(e.pos[0]-v.x,e.pos[2]-v.z)<45).length;
    v.integrity=Math.max(0,(v.integrity??100)-dt*.12*Math.max(1,attackers));
  }
}

export function install(S){
  S.villagePlan=null;
  S.ensureVillageFarms=()=>ensureVillageFarms(S);
  S.createVillageQuest=function(){
    S.villagePlan=selectVillageSite(S,S.player.pos);
    S.waypoint={x:S.villagePlan.x,z:S.villagePlan.z};
    return S.villagePlan;
  };
  S.restoreVillageQuest=function(raw){
    if(!raw||!Number.isSafeInteger(raw.x)||!Number.isSafeInteger(raw.z)||!Number.isSafeInteger(raw.y)||Math.abs(raw.x)>1e6||Math.abs(raw.z)>1e6){S.villagePlan=null;return;}
    S.villagePlan={x:raw.x,z:raw.z,y:raw.y,seed:S.worldSeed>>>0,stage:Math.max(0,Number(raw.stage)||0),stock:{wood:0,stone:0,iron:0,...raw.stock},buildings:Array.isArray(raw.buildings)?raw.buildings.filter(b=>VILLAGE_KIT_KINDS.includes(b.type)&&[b.x,b.y,b.z].every(Number.isInteger)).slice(0,130).map(b=>({...b,axis:b.axis==='z'?'z':'x',level:Math.max(0,Math.min(3,b.level||0))})):[],citizens:Array.isArray(raw.citizens)?raw.citizens.slice(0,22):null,farms:Array.isArray(raw.farms)?raw.farms.slice(0,18):[],craftStock:raw.craftStock&&typeof raw.craftStock==='object'?raw.craftStock:{},food:Number(raw.food)||0,integrity:Number.isFinite(raw.integrity)?Math.max(0,Math.min(100,raw.integrity)):100,created:true};
  };
  S.villageDoorPositions=()=>{const v=S.villagePlan;if(!v)return [];return [...VILLAGE_DOORS.map(d=>[v.x+d.dx,v.y+1,v.z+d.dz]),...(v.buildings||[]).filter(b=>VILLAGE_PLANS[b.type]&&b.type!=='wall'&&b.type!=='farm').map(b=>[b.x+Math.floor(VILLAGE_PLANS[b.type].size[0]/2),b.y+1,b.z+VILLAGE_PLANS[b.type].size[1]-1])];};
  S.isNearVillage=(range=38)=>activeVillage(S)&&Math.hypot(S.player.pos[0]-S.villagePlan.x,S.player.pos[2]-S.villagePlan.z)<range;
  S.isNearVillageChief=()=>activeVillage(S)&&Math.hypot(S.player.pos[0]-(S.villagePlan.x+.5),S.player.pos[2]-(S.villagePlan.z+6.5))<15;
  S.openVillageBoard=function(){
    if(!S.isNearVillageChief()){S.showMessage('Podejdź do młyna i porozmawiaj z Mistrzem Aldrykiem (V).',3);return;}
    S.paused=true;S.clearTransientInput?.();S.expectPointerUnlock=true;document.exitPointerLock?.();
    S.UI.villageBoard.classList.remove('hidden');S.refreshVillageBoard();
  };
  S.closeVillageBoard=function(resume=true){S.UI.villageBoard.classList.add('hidden');if(resume)S.resumeGame();};
  S.refreshVillageBoard=function(){
    const v=S.villagePlan;if(!v)return;
    const wood=S.LOG_INGREDIENTS.reduce((total,id)=>total+S.countItem(id),0),stone=S.countItem('cobble')+S.countItem('stone');
    S.UI.villageResources.textContent=`TWOJE ZASOBY: ${wood} drewna · ${stone} kamienia · ${S.countItem('iron_ingot')} żelaza   |   MŁYN: ${v.food||0} zapasów żywności`;
    S.UI.villagePopulation.textContent=`Mistrz Aldryk + 3 robotników młyna · ${v.citizens?.length||VILLAGER_ROLES.length} mieszkańców łącznie · ${v.buildings.length} nowych budowli · OBRONA ${Math.ceil(v.integrity??100)}% · ${v.sheltered?'SCHRONIENIE':'PRACA / PATROL'}`;
    if(typeof document!=='undefined'){
      for(const badge of document.querySelectorAll('.village-board-actions .village-costs[data-plan]'))
        if(S.villageCostBadges)badge.replaceWith(S.villageCostBadges(badge.dataset.plan));
      const cards=document.getElementById('villageExpansionText');
      if(cards){cards.replaceChildren();
        for(const [kind,plan] of Object.entries(VILLAGE_PLANS)){
          if(kind==='house'||kind==='wall')continue;
          const box=document.createElement('article');box.className='village-expansion-card';
          const meta=document.createElement('div');
          const title=document.createElement('strong');title.textContent=`${plan.icon} ${plan.name}`;
          const details=document.createElement('small');details.textContent=`${plan.size.join('×')} · ${villageKitCostText(kind)} · ${plan.description}`;
          meta.append(title,details);
          if(S.villageCostBadges)meta.append(S.villageCostBadges(kind));
          const btn=document.createElement('button');btn.textContent='WYTWÓRZ PROJEKT';
          btn.disabled=!S.villageCanAfford(kind)||S.inventoryCapacity(VILLAGE_KIT_ID(kind))<1;
          btn.onclick=()=>S.craftVillageKit(kind);
          if(S.villagePlanMiniature)box.append(S.villagePlanMiniature(kind));
          box.append(meta,btn);cards.append(box);
        }
      }
    }
    if(typeof document!=='undefined'){
      const builtForge=(v.buildings||[]).some(b=>b.type==='forge');
      const forgeStatus=document.getElementById('villageForgeStatus');
      if(forgeStatus)forgeStatus.textContent=builtForge?'Kuźnia czynna. Przynieś surowce, by zlecić produkcję.':'Postaw kuźnię, aby odblokować zamówienia.';
      for(const button of document.querySelectorAll('#villageForgeButtons [data-craft]')){
        const item=button.dataset.craft;
        const costs={sword:[5,2],pickaxe:[4,2],axe:[4,2],iron_chest:[9,0]};
        const cost=costs[item];
        button.disabled=!builtForge||!S.itemDefs[item]||S.inventoryCapacity(item)<1||S.countItem('iron_ingot')<cost[0]||wood<cost[1];
      }
    }
    S.UI.villageHouseBtn.disabled=wood<90||S.inventoryCapacity('village_house_kit')<1;
    S.UI.villageWallBtn.disabled=wood<27||S.inventoryCapacity('village_wall_kit')<1;
    S.UI.villageRepairBtn.disabled=wood<20||stone<10||(v.integrity??100)>=99;
    if(S.UI.villageUpgradeBtn){
      const target=(v.buildings||[]).find(b=>b.type==='wall'&&(b.level||0)<3);
      const lvl=target?.level||0,cost=[{wood:18,stone:8,iron:0},{wood:12,stone:22,iron:0},{wood:18,stone:35,iron:10}][lvl];
      S.UI.villageUpgradeBtn.disabled=!target||wood<cost.wood||stone<cost.stone||S.countItem('iron_ingot')<cost.iron;
      S.UI.villageUpgradeBtn.textContent=target?`ULEPSZ SEGMENT MURU · LVL ${lvl} → ${lvl+1} · ${cost.wood} DREWNA + ${cost.stone} KAMIENIA${cost.iron?' + '+cost.iron+' ŻELAZA':''}`:'WSZYSTKIE SEGMENTY MURÓW ULEPSZONE';
    }
  };
  const removeWood=n=>{
    if(S.LOG_INGREDIENTS.reduce((t,id)=>t+S.countItem(id),0)<n)return false;
    for(const id of S.LOG_INGREDIENTS){const q=Math.min(S.countItem(id),n);if(q>0){S.removeItem(id,q);n-=q;}if(!n)break;}
    return true;
  };
  const removeStone=n=>{if(S.countItem('cobble')+S.countItem('stone')<n)return false;for(const id of ['cobble','stone']){const q=Math.min(n,S.countItem(id));if(q){S.removeItem(id,q);n-=q;}}return true;};
  S.upgradeVillageWall=()=>{
    if(!S.isNearVillageChief())return false;
    const b=S.villagePlan.buildings.find(p=>p.type==='wall'&&(p.level||0)<3);
    if(!b){S.showMessage('Nie ma segmentów muru do ulepszenia.');return false;}
    const cost=[{wood:18,stone:8,iron:0},{wood:12,stone:22,iron:0},{wood:18,stone:35,iron:10}][b.level||0];
    if(S.LOG_INGREDIENTS.reduce((t,id)=>t+S.countItem(id),0)<cost.wood||S.countItem('cobble')+S.countItem('stone')<cost.stone||S.countItem('iron_ingot')<cost.iron){S.showMessage('Brak materiałów na ulepszenie muru.');return false;}
    removeWood(cost.wood);removeStone(cost.stone);if(cost.iron)S.removeItem('iron_ingot',cost.iron);
    b.level=(b.level||0)+1;
    // All nine cells gain real fortification HP, rather than a cosmetic score.
    for(let yy=0;yy<3;yy++)for(let d=0;d<3;d++){
      const x=b.x+(b.axis==='z'?0:d),z=b.z+(b.axis==='z'?d:0),y=b.y+yy;
      if(S.peekLoadedBlock(x,y,z)!==S.B.REINFORCED_WOOD)continue;
      const f=S.ensureFortification(x,y,z,S.B.REINFORCED_WOOD,true);
      if(f){f.level=b.level;f.maxHp=S.wallStats(f).maxHp;f.hp=f.maxHp;}
    }
    S.showMessage(`Cały segment muru: poziom ${b.level}/3 · mocniejsze bloki i większe HP!`,3);
    S.refreshVillageBoard();S.saveGame?.();return true;
  };
  S.repairVillage=()=>{
    if(!S.isNearVillage(42)||!S.villagePlan)return false;
    if(S.countItem('cobble')+S.countItem('stone')<10||!removeWood(20)){S.showMessage('Potrzeba 20 drewna oraz 10 kamienia/bruku.');return false;}
    removeStone(10);
    S.villagePlan.integrity=Math.min(100,(S.villagePlan.integrity??100)+35);S.refreshVillageBoard();S.saveGame?.();return true;
  };
  S.villageCanAfford=kind=>{
    const p=VILLAGE_PLANS[kind];if(!p)return false;
    const wood=S.LOG_INGREDIENTS.reduce((total,id)=>total+S.countItem(id),0);
    const stone=S.countItem('cobble')+S.countItem('stone');
    return wood>=(p.cost.wood||0)&&stone>=(p.cost.stone||0)&&S.countItem('iron_ingot')>=(p.cost.iron||0);
  };
  S.craftVillageKit=kind=>{
    const plan=VILLAGE_PLANS[kind],item=VILLAGE_KIT_ID(kind);
    if(!plan||!S.isNearVillageChief())return false;
    if(!S.villageCanAfford(kind)||S.inventoryCapacity(item)<1){S.showMessage('Brak wymaganych materiałów lub miejsca w plecaku.');return false;}
    if(plan.cost.wood)removeWood(plan.cost.wood);
    if(plan.cost.stone)removeStone(plan.cost.stone);
    if(plan.cost.iron)S.removeItem('iron_ingot',plan.cost.iron);
    S.addItem(item,1);S.sfx?.('craft',.65);S.refreshVillageBoard();
    S.showMessage(`Mistrz Aldryk wydał: ${plan.name}. Wybierz zestaw i ustaw hologram.`,3);
    S.saveGame?.();return true;
  };
  S.villageBlacksmithCraft=(item='iron_sword')=>{
    if(!S.isNearVillageChief()||!(S.villagePlan.buildings||[]).some(b=>b.type==='forge'))return false;
    const costs={sword:{iron_ingot:5,wood:2},pickaxe:{iron_ingot:4,wood:2},axe:{iron_ingot:4,wood:2},iron_chest:{iron_ingot:9}};
    const cost=costs[item];if(!cost||!S.itemDefs[item]||S.inventoryCapacity(item)<1)return false;
    if((cost.iron_ingot||0)>S.countItem('iron_ingot')||(cost.wood||0)>S.LOG_INGREDIENTS.reduce((n,id)=>n+S.countItem(id),0))return false;
    if(cost.wood)removeWood(cost.wood);if(cost.iron_ingot)S.removeItem('iron_ingot',cost.iron_ingot);
    S.addItem(item,1);S.sfx?.('craft');S.refreshVillageBoard();S.saveGame?.();return true;
  };
  S.villageBuildPreview=function(){
    if(!activeVillage(S)||S.paused)return null;
    const held=S.selectedItem?.(),kind=kitKindFromItem(held);if(!kind)return null;
    const plan=VILLAGE_PLANS[kind],dir=S.lookDir(),pos=S.player.pos;
    const reach=kind==='wall'?5:9;
    const aim=S.voxelRaycast?.(S.eyePos(),dir,reach+3);
    const axis=kind==='wall'&&Math.abs(dir[2])>Math.abs(dir[0])?'x':'z';
    // Align to the REAL block the crosshair hits. Previously the hologram
    // appeared at a fixed distance, regardless of the targeted terrain.
    const groundHit=aim&&aim.normal?.[1]===1;
    const targetX=groundHit?aim.x+.5:pos[0]+dir[0]*reach;
    const targetZ=groundHit?aim.z+.5:pos[2]+dir[2]*reach;
    const sx=kind==='wall'?(axis==='z'?1:3):plan.size[0];
    const sz=kind==='wall'?(axis==='z'?3:1):plan.size[1];
    const x=Math.floor(targetX-sx/2),z=Math.floor(targetZ-sz/2);
    const y=groundHit?aim.y+1:Math.floor(pos[1]);
    S.villagePreviewAxis=axis;
    return {kind,x,y,z,axis,...canPlacePrefab(S,kind,x,y,z)};
  };
  S.placeVillageKit=function(){
    const p=S.villageBuildPreview();if(!p){S.showMessage('Plan można postawić blisko wioski.');return false;}
    if(!p.ok){S.showMessage(p.reason);return false;}
    const item=VILLAGE_KIT_ID(p.kind);
    if(S.countItem(item)<1)return false;
    // Batch edit support used by multiplayer, while local edits remain persisted.
    const bat=[];S.villageBatchBuilding=true;
    try{buildUserStructure(S,p.kind,p.x,p.y,p.z,(x,y,z,id)=>{
      if(S.setBlock(x,y,z,id)){bat.push([x,y,z,id]);}
    },p.axis);}finally{S.villageBatchBuilding=false;}
    S.netBroadcastVillageBatch?.(bat);
    S.villagePlan.buildings.push({type:p.kind,x:p.x,y:p.y,z:p.z,axis:p.axis,level:0});
    S.updateVillage?.(0);
    S.villagePlan.stage=Math.min(20,(S.villagePlan.stage||0)+1);
    S.removeItem(item,1);S.sfx?.('place',1,'wood');S.showMessage(`Postawiono: ${VILLAGE_PLANS[p.kind].name}!`);
    S.saveGame?.();return true;
  };
  S.updateVillage=(dt)=>updateVillagerAI(S,dt);
  S.renderVillage=(VP,fogColor,cam)=>{
    if(!activeVillage(S)||Math.hypot(S.player.pos[0]-S.villagePlan.x,S.player.pos[2]-S.villagePlan.z)>100)return;
    // Wind-driven 4-sail rotor on the south elevation of the voxel windmill.
    // Render as visible in-world geometric components, with speed modulated
    // by prevailing wind and no chunk remeshing per frame.
    const v=S.villagePlan,wind=Math.max(.025,Math.abs(S.windStrength||.45));
    const theta=((S.worldSeconds||0)*(.12+wind*.32))%(Math.PI*2);
    if(Math.hypot(S.player.pos[0]-v.x,S.player.pos[2]-v.z)<Math.min(90,S.renderDistance*S.CHUNK+8)){
      const ox=v.x+.5,oy=v.y+20.4,oz=v.z+9.4;
      S.drawBox(VP,[ox,oy,oz],[.95,.95,.9],[.22,.16,.11,1],0,fogColor,cam);
      for(let blade=0;blade<4;blade++){
        const a=theta+blade*Math.PI/2,ux=Math.cos(a),uy=Math.sin(a),rr=5.25;
        const beam=[ox+ux*rr,oy+uy*rr,oz+.22];
        S.drawBox(VP,beam,[9.8,.36,.4],[.39,.26,.15,1],0,fogColor,cam,0,a);
        for(let t=1;t<=5;t++){
          const r=t*1.44+1.3,px=ox+ux*r,py=oy+uy*r;
          const fx=-uy,fy=ux;
          // Taut ivory canvas fastened to slatted oak spars.
          S.drawBox(VP,[px+fx*.94,py+fy*.94,oz+.39],[1.9,1.9,.10],[.78,.72,.56,1],0,fogColor,cam,0,a);
          S.drawBox(VP,[px+fx*1.83,py+fy*1.83,oz+.47],[.19,.19,.21],[.39,.28,.17,1],0,fogColor,cam,0,a);
        }
      }
      S.drawBox(VP,[ox,oy,oz+.54],[1.15,1.15,.25],[.36,.29,.20,1],0,fogColor,cam);
    }
    const drawVillageBed=(x,y,z,rot=0,accent=[.45,.35,.22,1])=>{
      const pos=[x+.5,y+.08,z+.5];
      S.drawBox(VP,[pos[0],y+.04,pos[2]],[.92,.10,1.88],[.18,.12,.09,1],rot,fogColor,cam);
      S.drawBox(VP,S.rotatedOffset(pos,[0,.09,-.62],rot),[.76,.18,.42],accent,rot,fogColor,cam);
      S.drawBox(VP,S.rotatedOffset(pos,[0,.13,.18],rot),[.84,.17,1.05],[.25,.30,.26,1],rot,fogColor,cam);
    };
    drawVillageBed(v.x-23,v.y+1,v.z-17,0,[.58,.42,.26,1]);
    drawVillageBed(v.x-20,v.y+1,v.z-17,0,[.46,.34,.19,1]);
    drawVillageBed(v.x+1,v.y+1,v.z+2,0,[.52,.40,.21,1]);
    drawVillageBed(v.x+3,v.y+1,v.z+2,0,[.44,.36,.20,1]);
    drawVillageBed(v.x+5,v.y+1,v.z+2,0,[.38,.31,.18,1]);
    for(let i=0;i<(S.villagePlan.citizens||[]).length;i++){
      const c=S.villagePlan.citizens[i],role=roleFor(S,i);if(!c||!role||!Array.isArray(c.pos))continue;
      const p=c.pos,yaw=c.yaw||0,step=Math.sin(c.step||0)*.26,legSwing=Math.sin(c.step||0)*.42;
      // Without personal-space culling the camera can enter a villager's
      // untextured face/body, creating the enormous flat brown occlusion seen
      // inside the crowded mill. Keep the NPC interactive in the simulation.
      if(i!==0 && Math.hypot(cam[0]-p[0],cam[2]-p[2])<.70 && Math.abs(cam[1]-(p[1]+1.45))<2.1)continue;
      const restRole=roleFor(S,i),atHome=restRole&&Math.hypot(c.pos[0]-(v.x+restRole.home[0]+.5),c.pos[2]-(v.z+restRole.home[1]+.5))<2.4;
      const sleeping=c.mode==='rest' && atHome && (S.currentWorldHour?.()>=19 || S.currentWorldHour?.()<6) && i>0;
      if(sleeping){
        S.drawBox(VP,[p[0],p[1]+.54,p[2]],[.92,.26,.40],role.color,yaw+Math.PI/2,fogColor,cam);
        S.drawBox(VP,[p[0]-.26,p[1]+.72,p[2]],[.28,.28,.26],[.69,.54,.41,1],yaw,fogColor,cam);
      }else{
        S.drawBox(VP,[p[0],p[1]+1.11,p[2]],[.56,.78,.35],role.color,yaw,fogColor,cam);
        S.drawBox(VP,[p[0],p[1]+1.65,p[2]],[.43,.43,.42],[.69,.54,.41,1],yaw,fogColor,cam);
        S.drawBox(VP,[p[0],p[1]+1.96,p[2]],[.49,.13,.48],i===0?[.50,.37,.16,1]:[.24,.22,.17,1],yaw,fogColor,cam);
      }
      if(i===0 && !sleeping){
        // The elder/master is immediately identifiable by golden hat, apron
        // and an iron insignia; he is the only village manager.
        S.drawBox(VP,[p[0],p[1]+2.14,p[2]],[.49,.25,.44],[.40,.28,.18,1],yaw,fogColor,cam);
        S.drawBox(VP,S.rotatedOffset([p[0],p[1]+1.24,p[2]],[0,0,-.29],yaw),[.42,.46,.07],[.72,.57,.26,1],yaw,fogColor,cam);
        S.drawBox(VP,S.rotatedOffset([p[0],p[1]+1.44,p[2]],[0,0,-.33],yaw),[.16,.16,.09],[.86,.75,.46,1],yaw,fogColor,cam);
        const bob=.06*Math.sin((S.worldSeconds||0)*2.7);
        S.drawBox(VP,[p[0],p[1]+2.95+bob,p[2]],[.36,.24,.18],[.96,.92,.68,.96],0,fogColor,cam);
        S.drawBox(VP,[p[0],p[1]+2.95+bob,p[2]],[.14,.14,.10],[.54,.40,.13,1],0,fogColor,cam);
      }else if(i<=3 && !sleeping){
        S.drawBox(VP,S.rotatedOffset([p[0],p[1]+1.1,p[2]],[0,0,-.28],yaw),[.38,.47,.07],[.73,.68,.54,1],yaw,fogColor,cam);
        if(c.mode==='work')S.drawBox(VP,S.rotatedOffset([p[0],p[1]+.74,p[2]],[.42,0,-.19],yaw),[.3,.37,.32],[.61,.46,.28,1],yaw,fogColor,cam);
      }
      if(!sleeping)for(const side of [-1,1]){
        const walking=Math.min(1.0,Math.hypot(c.prevVX||0,c.prevVZ||0)*5);
        const cycle=Math.sin(c.step||0)*walking;
        const eye=S.rotatedOffset([p[0],p[1]+1.74,p[2]],[side*.13,0,-.225],yaw);
        S.drawBox(VP,eye,[.071,.066,.036],[.88,.85,.72,1],yaw,fogColor,cam);
        const zStride=cycle*side*.21;
        const legPos=S.rotatedOffset([p[0],p[1],p[2]],[side*.16,.57,zStride*.65],yaw);
        S.drawBox(VP,legPos,[.21,.80,.24],[.24,.25,.22,1],yaw,fogColor,cam,side*cycle*.24);
        const foot=S.rotatedOffset([p[0],p[1],p[2]],[side*.16,.12,zStride],yaw);
        S.drawBox(VP,foot,[.25,.23,.35],[.18,.14,.11,1],yaw,fogColor,cam);
        const armPos=S.rotatedOffset([p[0],p[1],p[2]],[side*.37,1.19,0],yaw);
        S.drawBox(VP,armPos,[.18,.65,.23],role.color,yaw,fogColor,cam,-side*cycle*.16);
        const hand=S.rotatedOffset([p[0],p[1],p[2]],[side*.37,.86,0],yaw);
        S.drawBox(VP,hand,[.18,.13,.22],[.66,.49,.37,1],yaw,fogColor,cam);
      }
    }
    // Cached alpha-cutout wheat, leafy vegetables and rye share terrain lighting.
    S.renderVillageCrops?.(VP,fogColor,cam,v);
    const p=S.villageBuildPreview();if(!p)return;
    const pulse=.68+.32*Math.sin((S.worldSeconds||0)*3.5),base=p.ok?[.35,.93,.70,.18+pulse*.12]:[.97,.24,.23,.28];
    S.gl.enable(S.gl.BLEND);S.gl.blendFunc(S.gl.SRC_ALPHA,S.gl.ONE_MINUS_SRC_ALPHA);S.gl.depthMask(false);
    const box=(x,y,z,w,h,d,alpha=1)=>S.drawBox(VP,[x,y,z],[w,h,d],[base[0],base[1],base[2],base[3]*alpha],0,fogColor,cam);
    if(p.kind==='wall'){
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(p.x+(p.axis==='z'?0:i)+.5,p.y+j+.5,p.z+(p.axis==='z'?i:0)+.5,.96,.94,.84,.72);
    }else{
      const [sx,sz]=VILLAGE_PLANS[p.kind].size,cx=p.x+sx/2,cz=p.z+sz/2;
      box(cx,p.y+.08,cz,sx,.16,sz);
      if(p.kind!=='farm'){
        for(const dx of [0,sx-1])box(p.x+dx+.5,p.y+2.6,cz,.30,5.0,sz,.85);
        for(const dz of [0,sz-1])box(cx,p.y+2.6,p.z+dz+.5,sx,5,.30,.85);
        box(cx,p.y+5.6,cz,sx+1,.40,sz+1);
      }else for(let dz=1;dz<sz-1;dz+=2)box(cx,p.y+.34,p.z+dz+.5,sx-2,.38,.24);
    }
    S.gl.depthMask(true);S.gl.disable(S.gl.BLEND);
  };
}
