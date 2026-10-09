'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nightcraftDesktop',Object.freeze({
  isDesktop:true,
  hostStart:details=>ipcRenderer.invoke('nc:host-start',details),
  hostStop:()=>ipcRenderer.invoke('nc:host-stop'),
  hostStatus:()=>ipcRenderer.invoke('nc:host-status'),
  hostShareUrl:url=>ipcRenderer.invoke('nc:host-share-url',url),
  minimize:()=>ipcRenderer.send('nc:window-minimize'),
  fullscreen:()=>ipcRenderer.send('nc:window-fullscreen')
}));
