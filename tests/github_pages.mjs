/** Static GitHub Pages regression: test project-site subfolder AND domain-root hosting. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(project,'dist-pages');
const runtime=['index.html','style.css','styles-waypoint.css','styles-multiplayer.css','styles-village.css','.nojekyll','src/main.js','src/data/loader.js','src/world/worker/world-worker.js','src/render/shaders/voxel.frag.glsl','data/blocks.json','data/lang/pl.json','data/texture-overrides.json','data/multiplayer.json','src/net/multiplayer.js','assets/favicon.svg','assets/audio/bird.wav'];
for (const file of runtime) assert(existsSync(path.join(out,file)),`Missing GitHub Pages runtime asset: ${file}`);
assert(!existsSync(path.join(out,'server.cjs')) && !existsSync(path.join(out,'START_WINDOWS.bat')) && !existsSync(path.join(out,'crates')), 'Only static client runtime should be published');
const html=readFileSync(path.join(out,'index.html'),'utf8');
assert(html.includes('href="styles-waypoint.css"') && !/\b(?:src|href)="\//.test(html),'URLs in HTML must be relative');
for (const mod of ['src/data/loader.js','src/render/shaders/loader.js','src/render/texture-overrides.js']) {
  const text=readFileSync(path.join(out,mod),'utf8');
  assert(text.includes('import.meta.url'),`${mod} should derive its URLs relative to its own module`);
  assert(!/fetch\s*\(\s*[\x27\x22`]\//.test(text),`Root-absolute fetch() in ${mod}`);
}
const worker=readFileSync(path.join(out,'src/world/worker/client.js'),'utf8');
assert(worker.includes("new URL('./world-worker.js',import.meta.url)"),'Worker path must be resolved relative to module');
const storage=readFileSync(path.join(out,'src/save/indexed-db.js'),'utf8');
assert(storage.includes("KEY=APP_PATH==='/'?'main':'main@'+APP_PATH"),'Separate repo hosted saves, preserve local saves');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wav':'audio/wav','.svg':'image/svg+xml','.png':'image/png','.glsl':'text/plain'};
function collect(folder, prefix='') {
  const files=[];
  for(const entry of readdirSync(folder,{withFileTypes:true})){
    const name=prefix+entry.name;
    if(entry.isDirectory())files.push(...collect(path.join(folder,entry.name),name+'/'));
    else files.push(name);
  }
  return files;
}
const all=collect(out).filter(f=>f!=='.nojekyll');
for(const prefix of ['/nightcraft/','/']) {
  const server=createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith(prefix)){res.writeHead(404);return res.end('Not found');}
    const relative=pathname.slice(prefix.length)||'index.html';
    const location=path.resolve(out,relative);
    if(!location.startsWith(out+path.sep)||!existsSync(location)||!statSync(location).isFile()){
      res.writeHead(404);return res.end('Not found');
    }
    const ext=path.extname(location);
    res.writeHead(200,{'content-type':(mime[ext]||'application/octet-stream')+'; charset=utf-8'});
    res.end(readFileSync(location));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {
    const base=`http://127.0.0.1:${port}${prefix}`;
    let fetched=0;
    for(let i=0;i<all.length;i+=24){
      await Promise.all(all.slice(i,i+24).map(async f=>{
        const r=await fetch(new URL(f,base));
        assert.equal(r.status,200,`404 at ${prefix}${f}`);
        assert.equal((await r.arrayBuffer()).byteLength,statSync(path.join(out,f)).size,`Bad bytes ${f}`);
        fetched++;
      }));
    }
    const doc=await fetch(base);assert.equal(doc.status,200);
    const wrongPrefix=await fetch(`http://127.0.0.1:${port}/wrong-prefix/data/blocks.json`);
    assert.equal(wrongPrefix.status,404);
    console.log(`PAGES_HTTP_PASS ${prefix} ${fetched} runtime files; document 200; wrong-prefix 404`);
  }finally{await new Promise(resolve=>server.close(resolve));}
}
console.log('PAGES_STATIC_PASS worker/module/data/shader/audio URLs, repo-scoped IndexedDB keys, Windows runtime preserved outside site');
