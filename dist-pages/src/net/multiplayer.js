/** NightCraft V24: direct join by ngrok HTTPS address, shared persistent world, TAB player list. */
export function normalizeServerAddress(raw, pageProtocol='https:') {
  let value=String(raw||'').trim();
  if(!value)return null;
  if(!/^[a-z]+:\/\//i.test(value))value='https://'+value;
  let target;try{target=new URL(value);}catch{return null;}
  let secure=target.protocol==='https:'||target.protocol==='wss:';
  if(!['https:','http:','ws:','wss:'].includes(target.protocol)||target.username||target.password||target.search||target.hash)return null;
  // ngrok HTTP tunnels expose TLS; accept a pasted http://ngrok address on HTTPS Pages.
  if(pageProtocol==='https:'&&!secure){
    if(/(?:^|\.)ngrok(?:-free)?\.(?:app|io)$/i.test(target.hostname))secure=true;
    else return null;
  }
  // ngrok http creates an HTTPS endpoint; WebSocket traffic uses WSS on that same tunnel.
  const path=target.pathname==='/'?'':target.pathname.replace(/\/+$/,'');
  return (secure?'wss://':'ws://')+target.host+(path||'/ws');
}

export function install(S) {
  const $=id=>document.getElementById(id);
  const ui={panel:$('multiplayerPanel'),host:$('mpHost'),join:$('mpJoin'),url:$('mpUrl'),code:$('mpRoom'),name:$('mpName'),status:$('mpStatus'),exit:$('mpExit'),copy:$('mpCopy'),hud:$('mpHud'),chat:$('mpChat'),chatMessages:$('mpMessages'),chatInput:$('mpChatInput'),players:$('mpPlayers'),toggle:$('mpToggle'),close:$('mpClose'),badge:$('mpRoomBadge'),quick:$('mpQuickJoin'),tab:$('mpTabList'),tabRows:$('mpTabRows'),entry:$('mpEnterWorld'),entryButton:$('mpEnterButton')};
  const me={active:false,coopSession:false,connecting:false,connected:false,room:'',id:'',ws:null,remote:new Map(),edits:[],clock:0,lastSend:0,host:false,latestPos:0,joinMode:'public'};
  S.multiplayer=me;
  const say=(message,error=false)=>{if(ui.status){ui.status.textContent=message;ui.status.style.color=error?'#ed9e8a':'#d8ceaa';}};
  const write=(text,system=false)=>{const line=document.createElement('div');line.className=system?'mp-system':'mp-line';line.textContent=text;ui.chatMessages.append(line);if(ui.chatMessages.children.length>100)ui.chatMessages.firstChild.remove();ui.chatMessages.scrollTop=ui.chatMessages.scrollHeight;};
  const send=m=>{if(me.ws?.readyState===WebSocket.OPEN)me.ws.send(JSON.stringify(m));};
  const refresh=()=>{
    ui.hud.classList.toggle('hidden',!me.connected);ui.exit.classList.toggle('hidden',!me.connected);
    if(ui.badge)ui.badge.textContent=me.room?'POKÓJ '+me.room:'OFFLINE';
    if(ui.copy)ui.copy.disabled=!me.room;
    ui.players.textContent=me.connected?`GRACZE ${me.remote.size+1}/12`:'';
  };
  function clear(errMsg=''){
    const ws=me.ws;me.ws=null;if(ws)try{ws.close()}catch{}
    me.connected=false;me.connecting=false;me.active=false;me.room='';me.id='';me.remote.clear();me.edits=[];me.host=false;ui.tab?.classList.add('hidden');ui.entry?.classList.add('hidden');
    refresh();if(errMsg)say(errMsg,true);
  }
  function applyEdit(x,y,z,id){
    const key=S.editKey(x,y,z);S.edits.set(key,id);
    const cx=S.floorDiv(x,S.CHUNK),cz=S.floorDiv(z,S.CHUNK),chunk=S.chunks.get(S.chunkKey(cx,cz));
    if(chunk){chunk.data[S.idx3(S.mod(x,S.CHUNK),y,S.mod(z,S.CHUNK))]=id;S.markDirty(cx,cz);if(S.mod(x,S.CHUNK)===0)S.markDirty(cx-1,cz);if(S.mod(x,S.CHUNK)===S.CHUNK-1)S.markDirty(cx+1,cz);if(S.mod(z,S.CHUNK)===0)S.markDirty(cx,cz-1);if(S.mod(z,S.CHUNK)===S.CHUNK-1)S.markDirty(cx,cz+1);}
  }
  function receive(m){
    if(!m||typeof m!=='object')return;
    if(m.t==='error'){say(m.message||'Błąd serwera.',true);if(!me.connected){clear(m.message||'Nie udało się połączyć.');}return;}
    if(m.t==='welcome'){
      me.id=m.id;me.room=m.code;me.host=!Array.isArray(m.players)||m.players.length===0;me.clock=Number(m.clock)||800;me.edits=[];
      for(const player of m.players||[])me.remote.set(player.id,{...player,received:performance.now(),displayPos:player.pos});
      if(S.hashString(m.seedText)!==(m.seed>>>0)){clear('Błędny seed otrzymany z serwera.');return;}
      say('Wczytuję świat '+m.code+'...');return;
    }
    if(m.t==='history'){if(Array.isArray(m.edits))me.edits.push(...m.edits);return;}
    if(m.t==='ready'){
      // Preserve solo IndexedDB save: co-op worlds are server-side rooms.
      // Ready is an asynchronous WebSocket event, so pointer lock requires a further real click.
      // Connecting must be cleared BEFORE startNewGame or the V23 guard prevents world creation.
      me.connecting=false;
      S.startNewGame();
      if(!S.running){clear('Nie udało się uruchomić wspólnego świata.');return;}
      for(const edit of me.edits){if(!Array.isArray(edit))continue;const [x,y,z]=String(edit[0]).split(',').map(Number),id=edit[1];if(Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)&&id>=0&&id<256)applyEdit(x,y,z,id);}
      me.edits=[];S.worldSeconds=me.clock;me.coopSession=true;me.connected=true;me.connecting=false;refresh();
      say('Połączono ze wspólnym światem hosta.');ui.panel.classList.add('hidden');
      // WebSocket callbacks do not carry user activation for requestPointerLock.
      // Show an explicit user-gesture button to ensure the controls actually work.
      S.paused=true;S.UI.pauseMenu.classList.remove('active');ui.entry?.classList.remove('hidden');
      write('Połączono z hostem. TAB — gracze i XYZ, Enter — czat.',true);
      send({t:'state',pos:S.player.pos,yaw:S.player.yaw,pitch:S.player.pitch,health:S.player.health});
      return;
    }
    if(m.t==='joined'){me.remote.set(m.player.id,{...m.player,displayPos:m.player.pos,received:performance.now()});write(m.player.name+' dołączył do gry.',true);refresh();return;}
    if(m.t==='host'){me.host=m.id===me.id;write(me.host?'Jesteś teraz gospodarzem zegara świata.':'Nowy gospodarz pokoju.',true);return;}
    if(m.t==='left'){const p=me.remote.get(m.id);if(p)write(p.name+' opuścił grę.',true);me.remote.delete(m.id);refresh();return;}
    if(m.t==='state'){
      let p=me.remote.get(m.id);if(!p){p={id:m.id,name:'Gracz',pos:m.pos};me.remote.set(m.id,p);}
      p.pos=m.pos;p.yaw=m.yaw;p.pitch=m.pitch;p.health=m.health;p.received=performance.now();return;
    }
    if(m.t==='edit'){
      if(Number.isInteger(m.x)&&Number.isInteger(m.y)&&Number.isInteger(m.z)&&Number.isInteger(m.id))applyEdit(m.x,m.y,m.z,m.id);
      return;
    }
    if(m.t==='clock'){if(!me.host&&Number.isFinite(m.clock))S.worldSeconds+=Math.max(-2,Math.min(2,(m.clock-S.worldSeconds)*.2));return;}
    if(m.t==='chat'){write(`${m.name}: ${m.message}`);return;}
  }
  function connect(mode='public',urlOverride=''){
    if(me.connecting||me.active)return;
    const typed=urlOverride||ui.url.value.trim()||((location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://127.0.0.1:8787':'');
    const url=normalizeServerAddress(typed,location.protocol);
    if(!url){say('Wklej poprawny adres HTTPS ngroka, np. https://abc.ngrok-free.app. Przy HTTPS nie można używać ws:// ani http://.',true);return;}
    const name=ui.name.value.trim().slice(0,22)||'Ocalały';
    try{if(!urlOverride)localStorage.setItem('nightcraft-mp-settings',JSON.stringify({url,name}));}catch{}
    let ws;try{ws=new WebSocket(url);}catch(e){say('Niepoprawny adres serwera: '+e.message,true);return;}
    me.ws=ws;me.active=true;me.connecting=true;me.joinMode=mode;say('Łączenie z '+url+' ...');
    ws.onopen=()=>{if(mode==='host'){
      const seedText=S.UI.seedInput.value.trim()||String(Date.now());S.UI.seedInput.value=seedText;
      send({t:'create',seedText,seed:S.hashString(seedText),worldgenVersion:22,difficulty:S.UI.difficultySelect.value,name});
    }else if(mode==='join')send({t:'join',code:ui.code.value.replace(/\s/g,'').toUpperCase(),name});
    else send({t:'join_public',name});};
    ws.onmessage=ev=>{try{
      const m=JSON.parse(ev.data);
      if(m.t==='welcome'){S.UI.seedInput.value=m.seedText;S.UI.difficultySelect.value=m.difficulty;}
      receive(m);
    }catch(e){console.warn('Multiplayer packet rejected',e);}};
    ws.onerror=()=>say('Nie udało się połączyć z serwerem.',true);
    ws.onclose=()=>{if(me.ws!==ws)return;const was=me.connected;clear('Rozłączono z serwerem multiplayer.');
      if(was){write('Połączenie utracone. Gra sieciowa została wstrzymana.',true);S.paused=true;S.UI.pauseMenu.classList.add('active');}
    };
  }
  S.multiplayer.joinServer = url => connect('public',url);
  ui.quick.addEventListener('click',()=>connect('public'));
  ui.url.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();connect('public');}});
  ui.host.addEventListener('click',()=>connect('host'));ui.join.addEventListener('click',()=>connect('join'));
  ui.entryButton.addEventListener('click',()=>{S.resumeGame();if(!S.paused||S.lockPending)ui.entry.classList.add('hidden');});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===S.canvas)ui.entry.classList.add('hidden');});
  function refreshTab(){
    if(!me.connected)return;
    const rows=[{name:ui.name.value.trim()||'JA',pos:S.player.pos,me:true},...Array.from(me.remote.values()).map(p=>({...p,me:false}))];
    ui.tabRows.replaceChildren();
    for(const p of rows){
      const row=document.createElement('div');row.className='mp-tab-row'+(p.me?' self':'');
      const name=document.createElement('b');name.textContent=(p.me?'★ ':'')+(p.name||'Gracz');
      const xyz=document.createElement('span');xyz.textContent=Array.isArray(p.pos)?`X ${Math.floor(p.pos[0])}   Y ${Math.floor(p.pos[1])}   Z ${Math.floor(p.pos[2])}`:'---';
      row.append(name,xyz);ui.tabRows.append(row);
    }
  }
  document.addEventListener('keydown',e=>{if(e.code!=='Tab'||!me.connected||!S.running)return;
    e.preventDefault();e.stopPropagation();if(!ui.tab.classList.contains('hidden'))return;
    refreshTab();ui.tab.classList.remove('hidden');
  },true);
  document.addEventListener('keyup',e=>{if(e.code==='Tab')ui.tab.classList.add('hidden');},true);
  window.addEventListener('blur',()=>ui.tab.classList.add('hidden'));

  ui.exit.addEventListener('click',()=>{S.quitToMenu();say('Rozłączono. Możesz grać solo.');ui.panel.classList.add('hidden');});
  ui.copy.addEventListener('click',()=>{if(me.room)navigator.clipboard?.writeText(me.room);});
  ui.toggle.addEventListener('click',()=>ui.panel.classList.toggle('hidden'));
  $('mpChatToggle').addEventListener('click',()=>{ui.chat.classList.toggle('hidden');if(!ui.chat.classList.contains('hidden')){S.expectPointerUnlock=true;document.exitPointerLock?.();ui.chatInput.focus();}});
  ui.close.addEventListener('click',()=>ui.panel.classList.add('hidden'));
  ui.chatInput.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();const message=ui.chatInput.value.trim();if(message){send({t:'chat',message});ui.chatInput.value='';}ui.chat.classList.add('hidden');S.input.keys.clear();ui.chatInput.blur();S.resumeGame?.();}if(e.key==='Escape'){ui.chat.classList.add('hidden');ui.chatInput.blur();S.resumeGame?.();}});
  document.addEventListener('keydown',e=>{if(e.code==='Enter'&&me.connected&&!S.inventoryOpen&&!S.mapOpen&&!S.paused&&!S.dead&&e.target!==ui.chatInput){e.preventDefault();S.expectPointerUnlock=true;document.exitPointerLock?.();ui.chat.classList.remove('hidden');ui.chatInput.focus();S.input.keys.clear();}},true);
  let hasStoredServer=false;
  try{const saved=JSON.parse(localStorage.getItem('nightcraft-mp-settings')||'null');if(saved?.url){ui.url.value=saved.url;hasStoredServer=true;}if(saved?.name)ui.name.value=saved.name;}catch{}
  fetch(new URL('../../data/multiplayer.json',import.meta.url)).then(r=>r.ok?r.json():null).then(cfg=>{
    if(!hasStoredServer && !ui.url.value && typeof cfg?.server==='string' && /^wss?:\/\//.test(cfg.server))ui.url.value=cfg.server;
  }).catch(()=>{});
  const setBlock=S.setBlock;
  S.setBlock=function(x,y,z,id,record=true){const changed=setBlock(x,y,z,id,record);if(changed&&record&&me.connected)send({t:'edit',x:Math.floor(x),y:Math.floor(y),z:Math.floor(z),id});return changed;};
  const saveGame=S.saveGame;S.saveGame=function(){if(me.active||me.coopSession)return;return saveGame();};
  const quit=S.quitToMenu;S.quitToMenu=function(){
    if(!me.active&&!me.coopSession)return quit();
    clear();const orig=S.saveGame;S.saveGame=()=>{};
    try{return quit();}finally{S.saveGame=orig;me.coopSession=false;}
  };
  const newGame=S.startNewGame;S.startNewGame=function(){if(me.connecting)return;return newGame();};
  const resume=S.resumeGame;
  S.resumeGame=function(...args){
    if(me.coopSession&&!me.connected){S.showMessage?.('Utracono połączenie z hostem. Wróć do menu.');return;}
    return resume(...args);
  };
  S.netUpdate=function(now){
    if(!me.connected||!S.running)return;
    if(!ui.tab.classList.contains('hidden')&&now-(me.lastTab||0)>260){me.lastTab=now;refreshTab();}
    if(now-me.lastSend>115){me.lastSend=now;send({t:'state',pos:S.player.pos,yaw:S.player.yaw,pitch:S.player.pitch,health:S.player.health});}
    if(me.host&&now-(me.lastClock||0)>3000){me.lastClock=now;send({t:'clock',clock:S.worldSeconds});}
  };
  S.renderRemotePlayers=function(VP,fogColor,cam){
    const now=performance.now();for(const p of me.remote.values()){
      if(now-p.received>15000||!Array.isArray(p.pos))continue;
      const pos=p.displayPos||(p.displayPos=[...p.pos]);const s=Math.min(1,(now-(p.frame||now))*.010);p.frame=now;
      for(let i=0;i<3;i++)pos[i]+=(p.pos[i]-pos[i])*s;
      if(Math.hypot(pos[0]-cam[0],pos[2]-cam[2])>95)continue;
      const ry=-(p.yaw||0),phase=now*.005+(p.id.charCodeAt(0)||0),moving=Math.hypot(pos[0]-p.pos[0],pos[2]-p.pos[2])>.012;
      const draw=(ox,oy,oz,sz,c,rx=0)=>S.drawBox(VP,S.rotatedOffset(pos,[ox,oy,oz],ry),sz,c,ry,fogColor,cam,rx);
      const cloth=[.14,.27,.28,1],skin=[.57,.41,.30,1];
      draw(0,1.31,0,[.56,.71,.30],cloth);draw(0,1.88,0,[.44,.42,.40],skin);
      draw(0,2.08,0,[.46,.12,.41],[.16,.13,.10,1]);
      for(const side of [-1,1]){draw(side*.155,1.91,-.202,[.078,.067,.018],[.88,.89,.76,1]);draw(side*.155,1.91,-.222,[.030,.047,.016],[.06,.10,.12,1]);
        const step=moving?Math.sin(phase+side)*.27:0;
        draw(side*.36,1.25,0,[.19,.68,.23],cloth,-step);draw(side*.17,.52,step*.12,[.24,.97,.25],[.11,.14,.17,1],step);}
      draw(0,1.36,.19,[.42,.30,.12],[.32,.25,.18,1]);
    }
  };
  S.mpDrawMarkers=(ctx,W,H,radius)=>{
    for(const p of me.remote.values()){const dx=(p.pos[0]-S.player.pos[0])/radius*(W/2),dz=(p.pos[2]-S.player.pos[2])/radius*(H/2);
      if(Math.hypot(dx,dz)>W*.47)continue;ctx.save();ctx.fillStyle='#70dece';ctx.beginPath();ctx.arc(W/2+dx,H/2+dz,3,0,Math.PI*2);ctx.fill();ctx.restore();}
  };
  refresh();
}
