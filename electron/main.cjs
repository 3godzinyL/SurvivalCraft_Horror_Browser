/** NightCraft embedded Chromium desktop window. No remote URL is loaded in Electron. */
'use strict';
const {app,BrowserWindow,ipcMain,shell}=require('electron');
const path=require('node:path');
const {listen}=require('./static-server.cjs');
const {HostService}=require('./host-service.cjs');
// Chromium picks the GPU backend automatically; don't force experimental switches on users.
let window=null,server=null,host=null,origin='';
const root=path.resolve(__dirname,'..');
const log=(message)=>console.log('[NightCraft Desktop]',message);
function authorized(e) {return e.sender===window?.webContents && e.senderFrame?.url?.startsWith(origin);}
function registerIPC(){
  ipcMain.handle('nc:host-start',async(e,settings)=>{
    if(!authorized(e))throw Error('Nieautoryzowane okno.');
    const p=settings&&typeof settings==='object'?settings:{};
    return host.start({seedText:p.seedText,shareUrl:p.shareUrl,autoNgrok:!!p.autoNgrok});
  });
  ipcMain.handle('nc:host-status',e=>{if(!authorized(e))throw Error('Brak uprawnień.');return host.status;});
  ipcMain.handle('nc:host-stop',async e=>{if(!authorized(e))throw Error('Brak uprawnień.');await host.stop();return true;});
  ipcMain.handle('nc:host-share-url',(e,url)=>{if(!authorized(e))throw Error('Brak uprawnień.');return host.updateShareUrl(url);});
  ipcMain.on('nc:window-minimize',e=>{if(authorized(e))window.minimize();});
  ipcMain.on('nc:window-fullscreen',e=>{if(authorized(e))window.setFullScreen(!window.isFullScreen());});
}
async function launch(){
  // Port 8177 is stable across launches: IndexedDB worlds remain at one Chromium origin.
  let site;try{site=await listen(root,8177);}catch(e){if(e.code!=='EADDRINUSE')throw e;log('Port 8177 zajęty; uruchamiam alternatywny port (osobny zapis lokalny).');site=await listen(root,0);}
  server=site.server;origin=site.url;
  const projectRoot=app.isPackaged?process.resourcesPath:root;
  // The actual mp source is a physical extraResource when packaged.
  host=new HostService({root:projectRoot,storage:path.join(app.getPath('userData'),'host-world'),executable:process.execPath,env:{ELECTRON_RUN_AS_NODE:'1'},logger:log});
  registerIPC();
  window=new BrowserWindow({width:1440,height:900,minWidth:960,minHeight:650,show:false,
    title:'NightCraft · Cold Forest',autoHideMenuBar:true,backgroundColor:'#080d0c',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin))event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.webContents.on('before-input-event',(event,input)=>{if(input.key==='F11'&&input.type==='keyDown'){window.setFullScreen(!window.isFullScreen());event.preventDefault();}});
  window.once('ready-to-show',()=>window.show());
  await window.loadURL(origin);
  if(!window.isVisible())window.show();
}
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();}else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(launch).catch(e=>{log('FATAL '+(e.stack||e));app.quit();});
}
let shutdownDone=false;
app.on('before-quit',event=>{
  if(shutdownDone)return;
  if(!host){shutdownDone=true;server?.close();return;}
  event.preventDefault();
  host.stop().catch(e=>log('Host shutdown: '+e.message)).finally(()=>{
    shutdownDone=true;server?.close();app.quit();
  });
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
