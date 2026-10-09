import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bat = readFileSync(path.join(root, 'START_WINDOWS.bat'));
const batText = bat.toString('utf8');
assert(batText.includes('\r\n') && !batText.includes('\n\n'), 'BAT file must be CRLF');
assert(batText.includes('node "server.cjs"'), 'server must stay in foreground');
assert(!batText.includes('start "NightCraft Server" cmd /k'), 'old detached launcher must be gone');
assert(batText.includes(':USE_POWERSHELL') && batText.includes('serve-windows.ps1'));
assert(batText.includes('pause >nul'), 'launcher must keep console visible on errors');
for (const filename of ['tools/serve-windows.ps1', 'tools/open-browser.ps1', 'DIAGNOSTYKA_WINDOWS.bat']) {
  assert(existsSync(path.join(root, filename)), `Missing launcher support: ${filename}`);
}
const psFallback = readFileSync(path.join(root, 'tools/serve-windows.ps1'), 'utf8');
assert(psFallback.includes('TcpListener') && psFallback.includes("Parse('127.0.0.1')"));
assert(psFallback.includes('application/wasm') && psFallback.includes('text/javascript'));
assert(psFallback.includes('Partial Content'), 'audio range requests should work in fallback');

const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const assigned = s.address().port;
    s.close(() => resolve(assigned));
  });
});
const child = spawn(process.execPath, ['server.cjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', d => output += d.toString());
child.stderr.on('data', d => output += d.toString());
const get = (pathname, method='GET') => new Promise((resolve, reject) => {
  const req = http.request({ hostname:'127.0.0.1', port, path: pathname, method, timeout: 1500 }, res => {
    const chunks=[];
    res.on('data', c => chunks.push(c));
    res.on('end', () => resolve({ status:res.statusCode, headers:res.headers, body:Buffer.concat(chunks) }));
  });
  req.once('error', reject);
  req.once('timeout', () => req.destroy(new Error('timeout')));
  req.end();
});
try {
  let ready=false;
  for(let i=0;i<40;i++){
    try { const r=await get('/'); if(r.status===200){ready=true; break;} }catch{}
    await new Promise(r=>setTimeout(r,75));
  }
  assert(ready,'HTTP server never started: '+output);
  const routes = [
    ['/', 'text/html'],
    ['/src/main.js', 'text/javascript'],
    ['/src/world/worker/world-worker.js', 'text/javascript'],
    ['/data/blocks.json', 'application/json'],
    ['/src/render/shaders/voxel.vert.glsl', 'text/plain'],
    ['/assets/audio/bird.wav', 'audio/wav'],
    ['/assets/favicon.svg', 'image/svg+xml'],
    ['/src/render/menu-scene.js', 'text/javascript'],
  ];
  for(const [url,mime] of routes){
    const r=await get(url);
    assert.equal(r.status,200,`${url} status`);
    assert(r.headers['content-type']?.startsWith(mime),`${url} MIME`);
    assert(r.body.length>0,`${url} body`);
    const head=await get(url,'HEAD');
    assert.equal(head.status,200,`${url} HEAD status`);
    assert.equal(head.body.length,0,`${url} HEAD body`);
  }
  assert.equal((await get('/does-not-exist-nightcraft')).status,404);
  console.log('WINDOWS_LAUNCHER_STATIC_PASS CRLF, persistent console, Node/PowerShell fallback, diagnostics');
  console.log('WINDOWS_SERVER_SMOKE_PASS 8 routes (+HEAD), MIME, HTTP 404, browser assets');
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,800))]);
}
