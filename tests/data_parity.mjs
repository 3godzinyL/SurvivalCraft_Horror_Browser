import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadGameData} from '../src/data/loader.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync((url instanceof URL?url:new URL('.'+url,root)),'utf8'))});
const d=await loadGameData(),base=JSON.parse(fs.readFileSync(new URL('./golden_v14.json',import.meta.url),'utf8')).definitions;
const plain=v=>JSON.parse(JSON.stringify(v));
const old=(current,frozen)=>Object.fromEntries(Object.keys(frozen).map(key=>[key,current[key]]));
assert.deepEqual(old(plain(d.blocks.definitions),base.blocks),base.blocks,'Legacy block definitions changed');
const items=plain(d.items);
// V15 intentionally added tool wear to previously unbreakable tools.
for(const [key,def] of Object.entries(items))if(def.kind==='tool' && !(key in base.items && 'durability' in base.items[key]))delete def.durability;
assert.deepEqual(old(items,base.items),base.items,'Legacy item definitions changed');
assert.deepEqual(plain(d.recipes).slice(0,base.recipes.length),base.recipes,'Legacy recipe definitions changed');
assert.deepEqual(old(plain(d.mobs.enemies),base.mobs),base.mobs,'Legacy mob definitions changed');
console.log('DATA_PARITY_PASS V14 legacy definitions preserved; V16 additions isolated');
