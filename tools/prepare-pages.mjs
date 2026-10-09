/**
 * Prepare a pure static NightCraft distribution for GitHub Pages.
 * The local Windows launcher/server remain in the repo and ZIP, but not on the site.
 * Nothing is bundled/transpiled: all JS modules, workers and GLSL stay as files.
 */
import {cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist-pages');
const dirs=['src','data','assets'];
const files=['index.html','style.css','styles-waypoint.css','styles-multiplayer.css','styles-desktop.css'];
if (!files.every(f=>existsSync(path.join(root,f))) || !dirs.every(d=>existsSync(path.join(root,d))))
  throw Error('Missing game runtime files (unpack the complete project before publishing)');
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});
for (const file of files) copyFileSync(path.join(root,file),path.join(output,file));
for (const dir of dirs) cpSync(path.join(root,dir),path.join(output,dir),{recursive:true});
writeFileSync(path.join(output,'.nojekyll'),'');
let count=0, bytes=0;
function walk(folder){for(const name of readdirSync(folder)){const p=path.join(folder,name),st=statSync(p);if(st.isDirectory())walk(p);else{count++;bytes+=st.size;}}}
walk(output);
console.log(`PAGES_BUILD_PASS ${count} static files, ${(bytes/1048576).toFixed(2)} MiB, ${path.relative(root,output)}/`);
