/** Only serves local gameplay assets. The multiplayer service uses a separate port. */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json; charset=utf-8','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wasm':'application/wasm','.glsl':'text/plain; charset=utf-8'};
const files=new Set(['index.html','style.css','styles-waypoint.css','styles-multiplayer.css','styles-desktop.css','favicon.svg','favicon.ico']);
function allowed(route){const p=route.slice(1);return files.has(p)||['src/','assets/','data/'].some(prefix=>p.startsWith(prefix));}
function makeServer(root){return http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let pathname;
  try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname==='/')pathname='/index.html';
  if(!allowed(pathname)){res.writeHead(403);return res.end();}
  const file=path.resolve(root,'.'+pathname),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?'':data);
  });
});}
async function listen(root,port=8177){const server=makeServer(root);const chosen=await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,'127.0.0.1',()=>resolve(server.address().port));
});return {server,port:chosen,url:`http://127.0.0.1:${chosen}/`};}
module.exports={makeServer,listen,allowed};
