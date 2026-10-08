import fs from 'node:fs';
const root=new URL('../data/',import.meta.url);
const blocks=JSON.parse(fs.readFileSync(new URL('blocks.json',root),'utf8'));
const pairs=Object.entries(blocks.ids).sort((a,b)=>a[1]-b[1]);
const rust=pairs.map(([key,id])=>`pub const ${key}: u8 = ${id};`).join('\n')+'\n';
const js='// Generated and committed, do not renumber.\nexport const BLOCK_IDS = Object.freeze('+JSON.stringify(blocks.ids,null,2)+');\n';
fs.writeFileSync(new URL('../crates/world-core/src/ids.rs',import.meta.url),rust);
fs.writeFileSync(new URL('../src/data/generated-ids.js',import.meta.url),js);
console.log('Generated',pairs.length,'frozen block IDs');
