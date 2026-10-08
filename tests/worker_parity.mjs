import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {install as math} from '../src/math/matrix.js';import {install as noise} from '../src/world/noise.js';import {install as registry} from '../src/data/registry.js';import {install as worldgen} from '../src/world/worldgen.js';
import {loadGameData} from '../src/data/loader.js';
const root=new URL('../',import.meta.url);globalThis.fetch=async url=>{const txt=fs.readFileSync(new URL('.'+url,root),'utf8');return {ok:true,json:async()=>JSON.parse(txt)}};
const data=await loadGameData(),golden=JSON.parse(fs.readFileSync(new URL('golden_v14.json',import.meta.url),'utf8'));
const S={GAME_DATA:data};math(S);noise(S);registry(S);worldgen(S);
function sha(data){return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');}
let checked=0;
for(const [key,expected]of Object.entries(golden.chunks)){
 const [seed,coord]=key.split(':');const [cx,cz]=coord.split(',').map(Number);S.worldSeed=S.hashString(seed);S.edits.clear();
 const actual=S.generateChunkData(cx,cz);assert.equal(actual.length,24576);assert.equal(sha(actual),expected,`chunk world parity failed ${key}`);checked++;
}
console.log('WORLDGEN_GOLDEN_PASS',checked,'chunks; 3 seeds; Uint8 byte-for-byte V14 parity');
