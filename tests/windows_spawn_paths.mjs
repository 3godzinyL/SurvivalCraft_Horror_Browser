import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const testFile=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(testFile),'..');
const packageURL=new URL('../package.json',import.meta.url);
const resolved=path.dirname(fileURLToPath(packageURL));
assert.equal(resolved,root,'native URL-to-path conversion must resolve project root');
assert.equal(fileURLToPath(pathToFileURL(path.join(root,'multiplayer','server.cjs'))),path.join(root,'multiplayer','server.cjs'));
assert(fs.existsSync(path.join(resolved,'multiplayer','server.cjs')),'server entrypoint must exist');
const integrationTest=fs.readFileSync(path.join(root,'tests','ngrok_direct_join.mjs'),'utf8');
assert.match(integrationTest,/fileURLToPath\(new URL\('\.\.\/package\.json'/,'Windows-safe native path conversion');
assert(!integrationTest.includes("cwd:path.dirname(new URL('../package.json',import.meta.url).pathname)"),
  'never pass URL pathname as a Windows cwd');
// On Windows a file: URL exposes /C:/... for pathname, NOT C:\... as required by spawn().
const url=new URL('file:///C:/Program%20Files/NightCraft/tests/ngrok_direct_join.mjs');
assert(url.pathname.startsWith('/C:/Program%20Files/'),'URL pathname does not yield a native Windows path');
console.log('WINDOWS_SPAWN_PATHS_PASS fileURLToPath native cwd, absolute entrypoint and Windows URL regression');
