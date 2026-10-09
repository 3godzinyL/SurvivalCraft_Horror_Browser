/** NightCraft desktop host service. Pure Node.js; integration-testable without Electron. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const {spawn} = require('node:child_process');
const crypto = require('node:crypto');

async function reservePort(preferred = 8787) {
  async function test(port) {
    return new Promise((resolve, reject) => {
      const sock = net.createServer();
      sock.once('error', reject);
      sock.listen(port, '127.0.0.1', () => {
        const chosen = sock.address().port;
        sock.close(() => resolve(chosen));
      });
    });
  }
  try { return await test(preferred); } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    return test(0);
  }
}
function cleanShareAddress(input) {
  if (!input || !String(input).trim()) return '';
  let u;
  try { u = new URL(String(input).trim()); } catch { throw Error('Niepoprawny adres tunelu ngrok.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/') {
    throw Error('Podaj sam adres HTTPS, np. https://twoj-host.ngrok-free.app/');
  }
  return u.origin;
}
function fetchTunnels() {
  return new Promise(resolve => {
    const request = http.get('http://127.0.0.1:4040/api/tunnels', {timeout:700}, response => {
      let data='';response.on('data', b => { if (data.length < 60000) data += b; });
      response.on('end', () => { try { resolve(JSON.parse(data).tunnels || []); } catch { resolve([]); } });
    });
    request.on('timeout', ()=>request.destroy());request.on('error',()=>resolve([]));
  });
}
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
class HostService {
  constructor({root,storage,executable=process.execPath,env={},logger=()=>{}}) {
    this.root=root;this.storage=storage;this.executable=executable;this.env=env;this.logger=logger;
    this.child=null;this.ngrok=null;this.port=null;this.shareUrl='';this.tunnelState='off';this.seedText='';
    this.shutdownToken=crypto.randomBytes(32).toString('hex');this.stopping=null;
  }
  get status() { return {running:!!this.child && this.child.exitCode===null,port:this.port,localUrl:this.port?`http://127.0.0.1:${this.port}`:'',shareUrl:this.shareUrl,tunnelState:this.tunnelState,seedText:this.seedText}; }
  async start({seedText='',shareUrl='',autoNgrok=false}={}) {
    if(this.stopping)await this.stopping;
    if (this.child && this.child.exitCode===null) return this.status;
    const verified = cleanShareAddress(shareUrl);
    const seed=String(seedText || 'NIGHTCRAFT-SHARED-FOREST').trim().slice(0,32);
    const port=await reservePort();
    const script=path.join(this.root,'multiplayer','server.cjs');
    const environment={...process.env,...this.env,PORT:String(port),HOST:'127.0.0.1',NC_MULTIPLAYER_DATA:this.storage,NC_WORLD_SEED:seed,NC_HOST_SHUTDOWN_TOKEN:this.shutdownToken};
    const child=spawn(this.executable,[script],{env:environment,stdio:['ignore','pipe','pipe'],windowsHide:true});
    this.child=child;this.port=port;this.seedText=seed;this.shareUrl=verified;this.tunnelState=verified?'manual':'off';
    child.stderr.on('data',b=>this.logger('server error: '+String(b).slice(0,1000)));
    child.on('error',e=>this.logger('server process error: '+e.message));
    child.once('exit',(code)=>{if(this.child===child){this.child=null;this.logger('server exited: '+code);}});
    try {
      await new Promise((resolve,reject)=>{
        let buffer='',done=false;
        const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);err?reject(err):resolve();};
        const onData=b=>{buffer+=String(b);this.logger(String(b).trim());if(buffer.includes('NIGHTCRAFT_MP_READY'))finish();if(buffer.length>8192)buffer=buffer.slice(-2048);};
        const onError=e=>finish(e);
        const onExit=code=>finish(Error('Serwer zakończył pracę ('+code+').'));
        const timer=setTimeout(()=>finish(Error('Serwer nie uruchomił się w ciągu 10 sekund.')),10000);
        child.stdout.on('data',onData);child.once('error',onError);child.once('exit',onExit);
      });
    } catch(e){await this.stop();throw e;}
    if(autoNgrok && !verified)await this.openNgrok();
    return this.status;
  }
  async openNgrok() {
    if(!this.port)throw Error('Najpierw uruchom serwer.');
    // A tunnel started outside this application should be reused rather than duplicated.
    let url=await this.findNgrokTunnel();
    if(url){this.shareUrl=url;this.tunnelState='active';return this.status;}
    const portable=process.env.PORTABLE_EXECUTABLE_DIR && path.join(process.env.PORTABLE_EXECUTABLE_DIR,process.platform==='win32'?'ngrok.exe':'ngrok');
    const command=portable && fs.existsSync(portable)?portable:(process.platform==='win32'?'ngrok.exe':'ngrok');
    const child=spawn(command,['http',String(this.port),'--log=stdout'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    this.ngrok=child;let failed=false;
    child.once('error',e=>{failed=true;this.logger('ngrok error: '+e.message);if(this.ngrok===child)this.ngrok=null;});
    child.once('exit',code=>{failed=true;this.logger('ngrok exited: '+code);if(this.ngrok===child)this.ngrok=null;});
    child.stdout.on('data',b=>this.logger('ngrok: '+String(b).slice(0,400)));
    child.stderr.on('data',b=>this.logger('ngrok stderr: '+String(b).slice(0,400)));
    for(let i=0;i<24&&!failed;i++){
      await wait(500);url=await this.findNgrokTunnel();
      if(url){this.shareUrl=url;this.tunnelState='active';return this.status;}
    }
    this.tunnelState='manual';
    return this.status;
  }
  async findNgrokTunnel() {
    const tunnels=await fetchTunnels();
    const matching=tunnels.find(t=>{
      if(typeof t.public_url!=='string'||!t.public_url.startsWith('https://'))return false;
      const addr=String(t.config?.addr||'');
      return addr === String(this.port) || addr.endsWith(':'+this.port);
    });
    return matching?cleanShareAddress(matching.public_url):'';
  }
  async updateShareUrl(input) {
    this.shareUrl=cleanShareAddress(input);
    this.tunnelState=this.shareUrl?'manual':'off';
    return this.status;
  }
  // On Windows ChildProcess.kill() uses TerminateProcess, so SIGTERM handlers
  // in the server may NOT run. Do not kill before its HTTP flush acknowledgement.
  async stop() {
    if(this.stopping)return this.stopping;
    const child=this.child, ngrok=this.ngrok,port=this.port;
    const work=(async()=>{
      if(ngrok && ngrok.exitCode===null && ngrok.signalCode===null){try{ngrok.kill();}catch{}}
      if(child && child.exitCode===null && child.signalCode===null){
        let acknowledged=false;
        if(port){
          try{
            acknowledged=await new Promise((resolve,reject)=>{
              const req=http.request({hostname:'127.0.0.1',port,path:'/__host/shutdown',method:'POST',
                headers:{'x-nightcraft-host-token':this.shutdownToken},timeout:2500},res=>{
                res.resume();res.on('end',()=>res.statusCode===200?resolve(true):reject(Error('world flush HTTP '+res.statusCode)));
              });
              req.once('timeout',()=>req.destroy(Error('world flush timeout')));
              req.once('error',reject);req.end();
            });
          }catch(e){this.logger('host graceful shutdown failed: '+e.message);}
        }
        if(acknowledged){
          await Promise.race([
            new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('exit',resolve);}),
            wait(2500)
          ]);
        }
        if(child.exitCode===null&&child.signalCode===null){
          this.logger('host process did not close cleanly; force terminating');
          try{child.kill();}catch{}
        }
      }
      if(this.child===child)this.child=null;
      if(this.ngrok===ngrok)this.ngrok=null;
      this.port=null;this.shareUrl='';this.tunnelState='off';
    })();
    this.stopping=work;
    try{await work;}finally{if(this.stopping===work)this.stopping=null;}
  }
}
module.exports={HostService,cleanShareAddress,reservePort};
