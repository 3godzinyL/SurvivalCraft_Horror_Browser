import fs from 'node:fs';import assert from 'node:assert/strict';
import {loadGameData} from '../src/data/loader.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('.'+url,root),'utf8'))});
const d=await loadGameData(),base=JSON.parse(fs.readFileSync(new URL('./golden_v14.json',import.meta.url),'utf8')).definitions;
const plain=v=>JSON.parse(JSON.stringify(v));
assert.deepEqual(plain(d.blocks.definitions),base.blocks,'Block defs changed in data conversion');
const items=plain(d.items);
// New tool wear introduced in V15; this is the only accepted delta to legacy item defs.
for(const [key,def] of Object.entries(items))if(def.kind==='tool' && !(key in base.items && 'durability' in base.items[key]))delete def.durability;
assert.deepEqual(items,base.items,'Item defs changed in data conversion');
assert.deepEqual(plain(d.recipes),base.recipes,'Recipes changed in data conversion');
assert.deepEqual(plain(d.mobs.enemies),base.mobs,'Mob defs changed in data conversion');
console.log('DATA_PARITY_PASS V14 block/item/recipe/mob definitions identical (except explicit V15 tool durability)');
