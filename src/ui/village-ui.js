import {buildUserStructure} from '../world/village-worldgen.js';
import {VILLAGE_PLANS} from '../world/village-plans.js';
/** Expanded illustrated medieval folios and a functional village construction board. */
// Campaign folios: concise readable instructions tied to actual implemented systems.
const pages=[
  {chapter:'I · PROLOG',title:'ZAPISKÓW KSIĘGA',kicker:'ŚWIATŁO NA KRAŃCU LASU',visual:'forest',body:'Ostatni ogień tli się na wyspie. Niedaleko, za puszczą, kryje się osada młynarzy. Nie jesteś jej władcą z urodzenia — musisz zasłużyć na zaufanie i ocalić jej ludzi przed ciemnością.',tasks:['Rozglądaj się i zbierz ekwipunek ze skrzyni startowej.','Podążaj za kompasem wyprawy: pokazuje kierunek, odległość i etap trasy.','Najpierw dotrzyj do zachodniej grobli, potem przez most do młyna.']},
  {chapter:'II · SZLAK',title:'DROGA PRZEZ MGŁĘ',kicker:'JAK ODNALEŹĆ OSADĘ',visual:'map',body:'Osadę otacza głęboka laguna. Nie idź na ślepo prosto ku wodzie: omijaj ją po brzegu i przekrocz zachodnią groblę. Kompas wyświetla, o ile skręcić. Na minimapie ślad biegnie ku następnemu punktowi.',tasks:['ZŁOTY KIERUNEK: ▲ skierowany w górę = patrzysz dokładnie na aktualny punkt trasy.','WPROST / LEWO / PRAWO: podpowiedź względem twojej kamery.','M — mapa całego świata; G — powrót do tej księgi.']},
  {chapter:'III · MŁYN',title:'SERCE WSI',kicker:'CZŁOWIEK, KTÓRY PODEJMUJE DECYZJE',visual:'mill',body:'W starym wysokim młynie pracuje Mistrz Aldryk i trzech jego pomocników. Na północnym zachodzie osady znajduje się oświetlone wejście do starej kopalni. Aldryk kieruje wymianą surowców, odbudową murów i powiększaniem wsi. Nocą robotnicy zostają w schronieniu, a drzwi zamykają się po ich powrocie.',tasks:['Wejdź do młyna i podejdź do Aldryka.','V — otwórz warsztat, kiedy jesteś przy młynie.','Rolniczka zbiera żywność, kowal pracuje, strażnik broni wsi.']},
  {chapter:'IV · FUNDAMENTY',title:'DOM DLA OCALAŁYCH',kicker:'STAWIANIE PREFABRYKATÓW',visual:'village',body:'Wymieniasz kłody na gotowe projekty. Wybierz plan z hotbara, znajdź stabilny teren i zobacz przezroczysty zarys. Kolor zielony oznacza poprawne miejsce, a czerwony wskazuje, że coś przeszkadza.',tasks:['90 kłód → umeblowany dom (11×9).','27 kłód → obronny segment muru (3 bloki × 3 bloki).','Celuj w podłoże, ustaw obrys i naciśnij PPM, aby zbudować.']},
  {chapter:'V · MURY',title:'KAMIEŃ I ŻELAZO',kicker:'PRAWDZIWE ULEPSZENIA OBRONY',visual:'walls',body:'Ochrona wymaga nie tylko wysokich ścian, ale także mocnych bloków. Poszczególne elementy wzmacniasz przytrzymując środkowy przycisk myszy. U Aldryka można za jednym razem podnieść poziom całego postawionego segmentu muru.',tasks:['Mur LVL 0 → 1: 18 drewna + 8 kamienia.','Mur LVL 1 → 2: 12 drewna + 22 kamienia.','Mur LVL 2 → 3: 18 drewna + 35 kamienia + 10 żelaza.']},
  {chapter:'VI · RZEMIOSŁO',title:'WYTRZYMAŁOŚĆ',kicker:'ULEPSZANIE POJEDYNCZYCH BLOKÓW',visual:'craft',body:'Nie musisz ulepszać całej wioski jednocześnie. Własne drzwi, belki, ogrodzenia i ściany możesz wzmacniać osobno: spójrz na konstrukcję i przytrzymaj kółko myszy. Na ekranie zobaczysz koszt oraz postęp.',tasks:['Bloki wzmocnionego drewna: trzy poziomy, koszt 3 / 6 / 9 sztuk materiału.','Zwykłe drewniane bloki i drzwi mają osobne poziomy zbrojenia.','Przytrzymuj ŚPM aż postęp osiągnie 100%; ulepszenie zwiększa realne HP.']},
  {chapter:'VII · OSTATNI OGNIEŃ',title:'OBROŃ OSADĘ',kicker:'NOC ZBLIŻA SIĘ DO GROBLI',visual:'camp',body:'Czas ucieka. Za dnia robotnicy pracują przy młynie, a zbiory rosną. Wieczorem wracają do bezpiecznych wnętrz. Kiedy nadejdą wilki i inni napastnicy, twój mur i przygotowanie zadecydują, kto doczeka świtu.',tasks:['Wzmacniaj wejścia i zachodnią stronę wyspy.','20 drewna + 10 kamienia → naprawa obrony w warsztacie (+35%).','Rozbudowuj domy, pilnuj zapasów i osłaniaj strażnika.']},
  {chapter:'VIII · PLANY ROZBUDOWY',title:'TABLICA ULEPSZEŃ',kicker:'KOWAL • FARMA • ZBROJOWNIA',visual:'village',body:'Mistrz Aldryk stoi w środku młyna i zamienia surowce na przedmioty-projekty. Każdy projekt można postawić po wybraniu go w hotbarze, gdy hologram jest zielony. Nowe budynki zmieniają życie osady i jej zasoby.',tasks:['Dom 90 drewna; mur 27 drewna.','Kuźnia: 110 drewna, 35 kamienia, 8 żelaza.','Chata rolnika: 75 drewna, 12 kamienia; farma: 42 drewna, 8 kamienia.','Strażnica, zbrojownia i spichlerz są dostępne w radzie osady.']},
  {chapter:'IX · POLA I PLONY',title:'ŻYCIE ROLNIKÓW',kicker:'TRZY ODMIANY ROŚLIN',visual:'forest',body:'Uprawy przechodzą rzeczywiste etapy wzrostu. Rolnicy mają własne stanowiska: idą do dojrzałego krzaka, zbierają plony, a na jego miejscu zaczyna rosnąć kolejna sadzonka. Każde pole ma niezależną historię zbiorów.',tasks:['Jedna farma obsługuje kilka rzędów roślin.','Dodatkowa chata rolnika daje nowego pracownika.','Plony trafiają do zapasów wioski, nie do bezpośredniego ekwipunku.']},
  {chapter:'X · WYKUWANIE',title:'KUŹNIA I ZBROJOWNIA',kicker:'WYTWARZAJ NARZĘDZIA',visual:'craft',body:'Postaw kuźnię, aby uruchomić pracę nowego kowala. Przynieś żelazo i drewno do rady osady, a zamówienie narzędzi stanie się dostępne. Strażnica poprawia obronę, spichlerz magazynuje żywność.',tasks:['Żelazny miecz: 5 sztabek żelaza i 2 drewna.','Żelazny kilof lub topór: 4 żelaza i 2 drewna.','Księga receptur zawiera zakładki „Ulepszenia” i „Budynki”.']},
];

/** Safe planar route via the only causeway, with a short arc around the lagoon.
 * Every step is deterministic and depends on player's actual position. */
export function villageRoute(v,x,z){
  const dx=x-v.x,dz=z-v.z,r=Math.hypot(dx,dz);
  const mill={x:v.x+.5,z:v.z+10.5,label:'WEJŚCIE DO MŁYNA'};
  const shore={x:v.x-127,z:v.z,label:'POCZĄTEK GROBLI'};
  const bridge={x:v.x-49,z:v.z,label:'WEJŚCIE NA WYSPĘ'};
  // All pointers are STATIONARY real waypoints (never a rotating virtual orbit).
  if(r<46 || (dx>-50&&dx<0&&Math.abs(dz)<6))return {target:mill,stage:'MŁYN',final:true};
  if(dx<=-50&&Math.abs(dz)<=10)return {target:bridge,stage:'GROBLA',final:false};
  if(dx<-65)return {target:shore,stage:'DO GROBLI',final:false};
  // Circumnavigate the ring of water without hopping across the lagoon.
  // Which bank to use is derived solely from current position (fixed points).
  const side=dz<0?-1:1;
  if(dx>48&&Math.abs(dz)<76)return {target:{x:v.x+76,z:v.z+side*94},stage:'WZDŁUŻ BRZEGU',final:false};
  if(dx>-12&&Math.abs(dz)>=57)return {target:{x:v.x-13,z:v.z+side*102},stage:'WZDŁUŻ BRZEGU',final:false};
  if(dx>-65&&Math.abs(dz)>12)return {target:{x:v.x-92,z:v.z+side*82},stage:'DO GROBLI',final:false};
  // Player east/southeast of town but close to shore: prefer the same outer bank.
  if(dx>=-65)return {target:{x:v.x-92,z:v.z+side*82},stage:'DO GROBLI',final:false};
  return {target:shore,stage:'DO GROBLI',final:false};
}

/** Small canvas cutaway sketches: generated locally, no borrowed game textures. */
export function drawVillagePlanMiniature(kind,S){
  if(S?.atlas?.canvas)return drawVoxelPlan(kind,S);
  const canvas=document.createElement('canvas');canvas.width=106;canvas.height=78;
  canvas.className='village-building-mini';
  const g=canvas.getContext('2d');if(!g)return canvas;
  g.clearRect(0,0,106,78);
  const poly=(points,color)=>{g.fillStyle=color;g.beginPath();g.moveTo(...points[0]);for(const point of points.slice(1))g.lineTo(...point);g.closePath();g.fill();};
  const dark=['guard','armory','forge'].includes(kind);
  const wall=dark?'#82775f':'#997a51',side=dark?'#5c5b50':'#665039';
  const roof=kind==='forge'?'#4a504d':kind==='guard'?'#48483c':'#563a2b';
  poly([[16,45],[52,25],[92,44],[55,66]],'#403d2c');
  if(kind==='wall'){
    for(let i=0;i<3;i++){g.fillStyle=i%2?'#756d58':'#8b7d62';g.fillRect(29+i*16,22,15,38);g.fillStyle='#b0a18a';g.fillRect(29+i*16,21,15,3);}
  }else if(kind==='farm'){
    for(let i=0;i<4;i++)for(let j=0;j<5;j++){g.fillStyle=['#57763e','#799348','#728a3c'][i%3];g.fillRect(23+j*12,35+i*7,4,6);g.fillStyle='#c8ab62';g.fillRect(24+j*12,34+i*7,2,3);}
  }else{
    poly([[26,38],[55,23],[82,36],[54,53]],wall);poly([[26,38],[26,58],[54,72],[54,53]],side);poly([[54,53],[82,36],[82,57],[54,72]],wall);
    poly([[20,36],[54,14],[90,33],[54,53]],roof);
    poly([[20,36],[54,14],[54,18],[24,39]],'#886b43');
    g.fillStyle='#2e2921';g.fillRect(59,49,9,17);g.fillStyle='#bda575';g.fillRect(30,45,8,8);
    if(kind==='forge') {g.fillStyle='#696963';g.fillRect(70,14,11,19);}
    if(kind==='guard'){g.fillStyle='#947a4a';g.fillRect(45,4,4,19);g.fillStyle='#cc9c52';g.fillRect(49,4,12,9);}
    if(kind==='armory'){g.fillStyle='#cfb27b';g.fillRect(46,42,14,6);}
    if(kind==='granary'){for(let j=0;j<3;j++){g.fillStyle='#c8a46b';g.fillRect(28+j*14,55,9,4);}}
  }
  g.strokeStyle='rgba(238,210,158,.30)';g.lineWidth=1;g.strokeRect(.5,.5,105,77);
  return canvas;
}
export function install(S){
  const guide=document.getElementById('villageGuide'),board=document.getElementById('villageBoard');
  if(!guide||!board)return;
  S.UI.villageGuide=guide;S.UI.villageBoard=board;
  S.villagePlanMiniature=kind=>drawVillagePlanMiniature(kind,S);
  S.villageCostBadges=kind=>villageCostBadges(kind,S);
  const chiefPrompt=document.createElement('div');
  chiefPrompt.id='villageChiefPrompt';chiefPrompt.className='hidden';
  chiefPrompt.textContent='✦ MISTRZ ALDRYK · F / V — ROZMOWA';
  document.body.append(chiefPrompt);
  S.updateVillageChiefPrompt=function(){
    if(!S.running||S.paused||!S.villagePlan?.citizens?.length||!S.canvas?.width){chiefPrompt.classList.add('hidden');return;}
    const chief=S.villagePlan.citizens[0],pos=chief?.pos;
    if(!pos||Math.hypot(pos[0]-S.player.pos[0],pos[2]-S.player.pos[2])>12){chiefPrompt.classList.add('hidden');return;}
    const m=S.lastVP;if(!m){chiefPrompt.classList.add('hidden');return;}
    const x=pos[0],y=pos[1]+3.25,z=pos[2];
    const w=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(w<=.08){chiefPrompt.classList.add('hidden');return;}
    const nx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w;
    const ny=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
    if(Math.abs(nx)>1||Math.abs(ny)>1){chiefPrompt.classList.add('hidden');return;}
    const bounds=S.canvas.getBoundingClientRect();
    chiefPrompt.style.left=(bounds.left+(nx*.5+.5)*bounds.width)+'px';
    chiefPrompt.style.top=(bounds.top+(-ny*.5+.5)*bounds.height)+'px';
    chiefPrompt.classList.remove('hidden');
  };

  S.UI.villageResources=document.getElementById('villageResources');
  S.UI.villagePopulation=document.getElementById('villagePopulation');
  S.UI.villageHouseBtn=document.getElementById('villageHouseBtn');
  S.UI.villageWallBtn=document.getElementById('villageWallBtn');
  S.UI.villageRepairBtn=document.getElementById('villageRepairBtn');
  S.UI.villageUpgradeBtn=document.getElementById('villageUpgradeBtn');
  if(!document.getElementById('villageExpansionInfo')){
    const wrap=document.querySelector('#villageBoard .village-board');
    if(wrap){
      const box=document.createElement('section');box.id='villageExpansionInfo';box.className='village-expansion';
      const header=document.createElement('h3');header.textContent='KATALOG PROJEKTÓW OSADY';
      const cards=document.createElement('div');cards.id='villageExpansionText';cards.className='village-expansion-grid';
      box.append(header,cards);wrap.insertBefore(box,document.getElementById('villageUpgradeBtn'));
      const forge=document.createElement('section');forge.id='villageForgeOrders';forge.className='village-expansion';
      const h=document.createElement('h3');h.textContent='ZAMÓWIENIA KOWALA';
      const info=document.createElement('p');info.id='villageForgeStatus';
      const orders=document.createElement('div');orders.id='villageForgeButtons';orders.className='village-expansion-grid';
      forge.append(h,info,orders);wrap.insertBefore(forge,document.getElementById('villageUpgradeBtn'));
    }
  }
  for(const [i,kind] of ['house','wall'].entries()){
    const card=document.querySelectorAll('.village-board-actions>div')[i];
    if(card)card.prepend(S.villagePlanMiniature(kind),S.villageCostBadges(kind));
  }
  const title=document.getElementById('guideTitle'),chapter=document.getElementById('guideChapter'),kicker=document.getElementById('guideKicker'),body=document.getElementById('guideBody'),tasks=document.getElementById('guideTasks'),drawing=document.getElementById('guideDrawing'),page=document.getElementById('guidePageNumber');
  let current=0;
  const render=()=>{
    const p=pages[current];title.textContent=p.title;chapter.textContent=p.chapter;kicker.textContent=p.kicker;body.textContent=p.body;
    tasks.replaceChildren();for(const line of p.tasks){const li=document.createElement('li');li.textContent=line;tasks.append(li);}
    drawing.className='guide-art guide-art-'+p.visual;page.textContent=`${current+1} / ${pages.length}`;
    document.getElementById('guidePrev').disabled=current===0;
    document.getElementById('guideNext').textContent=current===pages.length-1?'ROZPOCZNIJ WYPRAWĘ':'NASTĘPNA STRONA →';
  };
  S.openVillageGuide=function(){
    if(!S.running)return;
    S.paused=true;S.clearTransientInput?.();S.clearInventoryHover?.();S.expectPointerUnlock=true;
    document.exitPointerLock?.();guide.classList.remove('hidden');S.UI.pauseMenu?.classList.remove('active');current=0;render();
  };
  S.closeVillageGuide=function(resume=true){guide.classList.add('hidden');if(resume)S.resumeGame?.();};
  document.getElementById('guidePrev').onclick=()=>{current=Math.max(0,current-1);render();};
  document.getElementById('guideNext').onclick=()=>{if(current===pages.length-1)S.closeVillageGuide();else{current++;render();}};
  document.getElementById('guideDismiss').onclick=()=>S.closeVillageGuide();
  document.getElementById('villageBoardClose').onclick=()=>S.closeVillageBoard();
  S.UI.villageHouseBtn.onclick=()=>S.craftVillageKit('house');
  S.UI.villageWallBtn.onclick=()=>S.craftVillageKit('wall');
  S.UI.villageRepairBtn.onclick=()=>S.repairVillage();
  if(S.UI.villageUpgradeBtn)S.UI.villageUpgradeBtn.onclick=()=>S.upgradeVillageWall();
  const forgePanel=document.getElementById('villageForgeButtons');
  if(forgePanel){
    for(const [item,name,cost] of [['sword','Miecz żelazny','5 żelaza + 2 drewna'],['pickaxe','Kilof żelazny','4 żelaza + 2 drewna'],['axe','Topór żelazny','4 żelaza + 2 drewna'],['iron_chest','Pancerz żelazny','9 żelaza']]){
      const card=document.createElement('article');card.className='village-expansion-card';
      const desc=document.createElement('div');const label=document.createElement('strong');label.textContent=name;const sub=document.createElement('small');sub.textContent=cost;desc.append(label,sub);
      const button=document.createElement('button');button.textContent='ZAMÓW';button.dataset.craft=item;
      button.onclick=()=>{if(!S.villageBlacksmithCraft(item))S.showMessage('Zbuduj kuźnię i zbierz wymagane materiały.');};
      card.append(desc,button);forgePanel.append(card);
    }
  }

  S.updateVillageNavigation=function(){
    const el=document.getElementById('villageQuestHud');if(!el)return;
    const v=S.villagePlan;
    const custom=!!(v&&S.waypoint&&Math.hypot(S.waypoint.x-v.x,S.waypoint.z-v.z)>5);
    el.classList.toggle('hidden',!S.running||!v||custom);
    if(!S.running||!v||!S.player||custom){S.villageNavigation=null;return;}
    const x=S.player.pos[0],z=S.player.pos[2],route=villageRoute(v,x,z);
    const dx=route.target.x-x,dz=route.target.z-z;
    const bearing=Math.atan2(dx,-dz),angle=Math.atan2(Math.sin(bearing-S.player.yaw),Math.cos(bearing-S.player.yaw));
    const degrees=Math.abs(Math.round(angle*180/Math.PI));
    const towards=Math.hypot(dx,dz),total=Math.hypot(v.x-x,v.z-z);
    const direction=degrees<=12?'PROSTO':degrees>=165?'ZAWRÓĆ':angle>0?'W PRAWO':'W LEWO';
    S.villageNavigation={...route,bearing,angle,distance:towards,remaining:total};
    document.getElementById('villageQuestArrow').style.transform=`rotate(${angle}rad)`;
    document.getElementById('villageQuestText').textContent=direction;
    document.getElementById('villageQuestStage').textContent=route.stage;
    document.getElementById('villageQuestDistance').textContent=total<24?'OSADA · MŁYN':`${Math.round(towards)} m · DO CELU ${Math.round(total)} m`;
    document.getElementById('villageQuestHint').textContent=total<24?'V · RADY ALDRYKA':route.final?'WEJDŹ DO MŁYNA':'OBRÓĆ SIĘ, AŻ ▲ BĘDZIE U GÓRY';
  };
  document.addEventListener('keydown',e=>{
    if(e.code==='KeyG'&&S.running&&!S.dead){e.preventDefault();if(!guide.classList.contains('hidden'))S.closeVillageGuide();else if(board.classList.contains('hidden'))S.openVillageGuide();return;}
    if(e.code==='KeyF'&&S.running&&!S.dead&&!S.paused&&S.villagePlan){
      const c=S.villagePlan.citizens?.[0];
      if(c&&Math.hypot(S.player.pos[0]-c.pos[0],S.player.pos[2]-c.pos[2])<5){e.preventDefault();S.openVillageBoard();return;}
    }
    if(e.code==='KeyV'&&S.running&&!S.dead){e.preventDefault();if(!board.classList.contains('hidden'))S.closeVillageBoard();else if(guide.classList.contains('hidden'))S.openVillageBoard();return;}
    if(e.code==='Escape'&&!guide.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();S.closeVillageGuide();return;}
    if(e.code==='Escape'&&!board.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();S.closeVillageBoard();return;}
  },true);
}

const planPreviewCache=new Map();
function drawVoxelPlan(kind,S){
  if(planPreviewCache.has(kind)){
    const copy=document.createElement('canvas');copy.width=210;copy.height=150;copy.className='village-building-mini';copy.getContext('2d').drawImage(planPreviewCache.get(kind),0,0);return copy;
  }
  const canvas=document.createElement('canvas');canvas.width=210;canvas.height=150;canvas.className='village-building-mini';
  const g=canvas.getContext('2d'),voxels=new Map();
  buildUserStructure(S,kind,0,1,0,(x,y,z,id)=>{const key=x+','+y+','+z;if(id===S.B.AIR)voxels.delete(key);else voxels.set(key,{x,y,z,id});});
  const project=(x,y,z)=>[(x-z)*.866,(x+z)*.43-y];
  const faces=[];
  for(const v of voxels.values())for(const f of S.faces){
    if(f.n[0]<0||f.n[1]<0||f.n[2]<0)continue;
    if(voxels.has([v.x+f.n[0],v.y+f.n[1],v.z+f.n[2]].join(',')))continue;
    const corners=[0,1,2,5].map(i=>project(v.x+f.v[i][0],v.y+f.v[i][1],v.z+f.v[i][2]));
    const tile=S.tileFor(v.id,f.side),image=S.atlas.canvas.getContext('2d').getImageData(tile%S.atlas.cols*24,Math.floor(tile/S.atlas.cols)*24,24,24).data;
    let col=[0,0,0];for(let i=0;i<image.length;i+=4)for(let k=0;k<3;k++)col[k]+=image[i+k]/576;
    const shade=f.n[1]===1?1.16:f.n[0]===1?.70:.90;
    faces.push({corners,col:col.map(v=>Math.min(255,v*shade)),depth:v.x+v.z+v.y*.01});
  }
  const all=faces.flatMap(f=>f.corners);
  const minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
  const scale=Math.min(188/(maxX-minX||1),124/(maxY-minY||1));
  g.fillStyle='#21291b';g.fillRect(0,0,210,150);
  g.fillStyle='rgba(0,0,0,.24)';g.beginPath();g.ellipse(105,131,78,9,0,0,Math.PI*2);g.fill();
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces){
    g.fillStyle='rgb('+f.col.map(Math.round).join(',')+')';g.beginPath();
    f.corners.forEach((p,i)=>{const x=105+(p[0]-(minX+maxX)/2)*scale,y=14+(p[1]-minY)*scale;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.fill();
  }
  planPreviewCache.set(kind,canvas);return canvas;
}
export function villageCostBadges(kind,S){
  const wrap=document.createElement('div');wrap.className='village-costs';wrap.dataset.plan=kind;
  for(const [material,required] of Object.entries(VILLAGE_PLANS[kind]?.cost||{})){
    const available=material==='wood'?S.LOG_INGREDIENTS.reduce((t,id)=>t+S.countItem(id),0):material==='stone'?S.countItem('stone')+S.countItem('cobble'):S.countItem('iron_ingot');
    const badge=document.createElement('span');badge.className='village-cost '+(available>=required?'ready':'missing');
    const icon=document.createElement('canvas');icon.width=24;icon.height=24;icon.setAttribute('aria-hidden','true');
    const g=icon.getContext('2d');g.imageSmoothingEnabled=false;
    const tile=S.tileFor(material==='wood'?S.B.WOOD:material==='stone'?S.B.COBBLE:S.B.IRON_BLOCK,'side');
    g.drawImage(S.atlas.canvas,tile%S.atlas.cols*24,Math.floor(tile/S.atlas.cols)*24,24,24,3,3,18,18);
    const text=document.createElement('span');text.textContent=required+' '+({wood:'drewna',stone:'kamienia',iron:'żelaza'}[material]);
    badge.title='Masz '+available+' / wymagane '+required;badge.append(icon,text);wrap.append(badge);
  }
  return wrap;
}
