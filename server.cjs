// Zero-dependency local dev/runtime server. No bundler; serves native ES modules.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname),port=Number(process.env.PORT)||8177;
// Keep a diagnostic log even when the Windows launcher cannot keep its console open.
const logFile=path.join(root,'logs','server.log');
function logLine(level,message){
 const line=`[${new Date().toISOString()}] [${level}] ${message}`;
 try { fs.mkdirSync(path.dirname(logFile),{recursive:true}); fs.appendFileSync(logFile,line+'\n'); }
 catch (_) { /* Read-only install: console output is still available. */ }
 if(level==='ERROR') console.error(line); else console.log(line);
}
process.on('uncaughtException',err=>{logLine('ERROR','Uncaught exception: '+(err?.stack||err));process.exit(1)});
process.on('unhandledRejection',err=>logLine('ERROR','Unhandled rejection: '+(err?.stack||err)));

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json; charset=utf-8','.wav':'audio/wav','.wasm':'application/wasm','.glsl':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/')pathname='/index.html';
  const file=path.resolve(root,'.'+pathname),rel=path.relative(root,file);
  if(rel.startsWith('..')||path.isAbsolute(rel)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,bytes)=>{
   if(err){res.writeHead(404);return res.end('Not found');}
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
  });
 }catch(e){res.writeHead(400);res.end('Invalid URL');}
});
server.on('error',err=>{
 const advice=err?.code==='EADDRINUSE' ? 'Port '+port+' is already in use. Close the old game server before starting another.' : 'HTTP server could not start.';
 logLine('ERROR',advice+' '+(err?.stack||err));
 process.exit(1);
});
server.listen(port,'127.0.0.1',()=>logLine('INFO','NightCraft V22 ready: http://127.0.0.1:'+port));
