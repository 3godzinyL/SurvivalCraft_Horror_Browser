import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let tested=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 const f=path.join(dir,e.name);if(e.isDirectory())walk(f);
 else if(/\.(?:js|mjs|cjs)$/.test(e.name)){
  const proc=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(proc.status!==0)throw Error('Syntax '+f+'\n'+proc.stderr);
  tested++;
 }
}}
for(const dir of ['src','tools','tests'])walk(path.join(root,dir));
const server=spawnSync(process.execPath,['--check',path.join(root,'server.cjs')],{encoding:'utf8'});
if(server.status!==0)throw Error(server.stderr);tested++;
console.log('SOURCE_SYNTAX_PASS',tested,'modules and server');
