/** Electron-only host menu; the static web build keeps the online join panel. */
export function install(S){
  const api=window.nightcraftDesktop;
  if(!api?.isDesktop)return;
  const $=id=>document.getElementById(id);
  const button=$('desktopHostToggle'),panel=$('desktopHostPanel');
  button.classList.remove('hidden');
  const status=$('desktopHostStatus'),details=$('desktopHostDetails'),start=$('desktopHostStart');
  let current=null;
  function message(text,error=false){status.textContent=text;status.classList.toggle('is-error',error);}
  const close=()=>panel.classList.add('hidden');
  async function refresh(){
    current=await api.hostStatus();
    const running=current?.running;
    details.classList.toggle('hidden',!running);
    start.disabled=!!running;
    $('desktopHostPort').textContent=running?String(current.port):'—';
    $('desktopHostPublic').textContent=current.shareUrl||'NIE MA JESZCZE TUNELU';
    $('desktopHostCopy').disabled=!current.shareUrl;
    $('desktopHostLink').value=current.shareUrl||$('desktopHostLink').value;
    $('desktopHostHint').textContent=!running?'':current.tunnelState==='active'
      ?'Ngrok jest uruchomiony. Przekaż link HTTPS znajomym; w menu klikną „Dołącz do gry”.'
      :`Aby umożliwić połączenie z Internetu, uruchom ngrok http ${current.port} na tym komputerze, a potem wpisz jego link HTTPS powyżej i kliknij ZAPISZ LINK. Samo wpisanie linku nie uruchamia tunelu.`;
    return current;
  }
  button.addEventListener('click',async()=>{
    panel.classList.remove('hidden');
    $('desktopHostSeed').value=S.UI.seedInput.value.trim()||'NIGHTCRAFT-SHARED-FOREST';
    try{await refresh();}catch(e){message('Nie można odczytać serwera: '+e.message,true);}
  });
  $('desktopHostClose').addEventListener('click',close);
  panel.addEventListener('mousedown',e=>{if(e.target===panel)close();});
  start.addEventListener('click',async()=>{
    if(start.disabled)return;
    start.disabled=true;message('Uruchamiam wspólny świat i sprawdzam ngrok...');
    try{
      current=await api.hostStart({seedText:$('desktopHostSeed').value.trim(),shareUrl:$('desktopHostLink').value.trim(),autoNgrok:$('desktopHostAutoNgrok').checked});
      await refresh();
      message(current.shareUrl?`Host działa. Link do udostępnienia: ${current.shareUrl}`:'Host działa lokalnie. Dla znajomych potrzebujesz aktywnego tunelu ngrok.');
    }catch(e){message('Host nie wystartował: '+(e?.message||String(e)),true);start.disabled=false;}
  });
  $('desktopHostApplyLink').addEventListener('click',async()=>{
    try{current=await api.hostShareUrl($('desktopHostLink').value.trim());await refresh();message('Adres zapisany. Sprawdź, czy tunel rzeczywiście przekierowuje na port '+current.port+'.');}
    catch(e){message(e.message||String(e),true);}
  });
  $('desktopHostCopy').addEventListener('click',async()=>{
    if(!current?.shareUrl)return;
    try{await navigator.clipboard.writeText(current.shareUrl);message('Link skopiowany.');}
    catch{message('Skopiuj link z pola ręcznie.',true);}
  });
  $('desktopHostPlay').addEventListener('click',()=>{
    if(!current?.running){message('Najpierw uruchom hosta.',true);return;}
    close();
    $('mpName').value=$('mpName').value.trim()||'Host';
    S.multiplayer?.joinServer(current.localUrl);
  });
  $('desktopHostStop').addEventListener('click',async()=>{
    if(S.multiplayer?.connected){message('Najpierw wyjdź ze wspólnego świata do menu, a potem zatrzymaj hosta.',true);return;}
    await api.hostStop();await refresh();message('Serwer został zatrzymany.');
  });
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'&&!panel.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close();}
  },true);
}
