// All gameplay definitions originate in JSON. Loader is intentionally side-effect free.
const FILES=['blocks','items','recipes','mobs','biomes','ruins','audio','lang/pl'];
const validId=id=>Number.isInteger(id)&&id>=0&&id<256;
const die=reason=>{throw Error('Invalid NightCraft data: '+reason)};
export function compileBlockMeta(blocks){
  const out=new Uint8Array(256*6);
  for(const [rawId,def] of Object.entries(blocks.definitions)){
    const id=Number(rawId),off=id*6;
    out[off]=def.solid?1:0;out[off+1]=def.transparent?1:0;out[off+2]=def.decor?1:0;
    const tile=blocks.numericTiles[id],faces=typeof tile==='number'?{top:tile,side:tile,bottom:tile}:tile||{};
    out[off+3]=faces.top??faces.side??0;out[off+4]=faces.side??faces.top??0;out[off+5]=faces.bottom??faces.side??faces.top??0;
  }
  return out;
}
export function validateGameData(d){
  const vals=Object.values(d.blocks.ids);
  if(new Set(vals).size!==vals.length||vals.some(id=>!validId(id)))die('duplicate or out-of-range block IDs');
  for(const [key,id]of Object.entries(d.blocks.ids))if(!d.blocks.definitions[id])die(`no definition: ${key} (${id})`);
  for(const [key,r]of Object.entries(d.blocks.definitions)){
    if(!validId(+key)||!Object.prototype.hasOwnProperty.call(d.lang.pl.blocks,key))die('invalid block '+key);
    if(r.drop&&!d.items[r.drop])die('missing block drop '+r.drop);
  }
  for(const [id,def] of Object.entries(d.items)){
    if(!d.lang.pl.items[id])die('missing item translation '+id);
    if(def.place!==undefined&&!validId(def.place))die('invalid place block '+id);
  }
  for(const [i,r]of d.recipes.entries()){
    if(!d.lang.pl.recipes[i])die('missing recipe translation '+i);
    for(const id of Object.keys(r.out||{}))if(!d.items[id])die('missing result '+id);
    for(const ids of Object.values(r.key||{}))for(const id of Array.isArray(ids)?ids:[ids])if(!d.items[id])die('missing recipe component '+id);
    for(const id of Object.keys(r.shapeless||{}))if(!d.items[id])die('missing shapeless component '+id);
  }
  for(const [id,r] of Object.entries(d.mobs.enemies))if(!d.lang.pl.mobs[id])die('missing mob translation '+id);
  for(const tile of Object.values(d.blocks.textureNames))for(const name of (typeof tile==='string'?[tile]:Object.values(tile)))if(!Object.values(d.blocks.atlasNames).includes(name))die('unknown tile '+name);
  for(const name of Object.values(d.audio))if(!/^assets\/audio\/[a-z0-9_-]+\.wav$/.test(name))die('invalid audio URI '+name);
  return d;
}
export async function loadGameData(){
  const docs=await Promise.all(FILES.map(async key=>{
    const resp=await fetch(`/data/${key}.json`,{cache:'no-store'});if(!resp.ok)throw Error(`Cannot load /data/${key}.json (${resp.status})`);
    return resp.json();
  }));
  const d={};for(let i=0;i<FILES.length;i++){const key=FILES[i];if(key==='lang/pl')d.lang={pl:docs[i]};else d[key]=docs[i];}
  validateGameData(d);
  for(const [id,def]of Object.entries(d.blocks.definitions))def.name=d.lang.pl.blocks[id];
  for(const [id,def]of Object.entries(d.items)){
    def.name=d.lang.pl.items[id];if(def.kind==='tool'&&!def.durability)def.durability=def.tier==='iron'?225:def.tier==='gold'?88:105;
  }
  for(const [id,def]of Object.entries(d.mobs.enemies))def.name=d.lang.pl.mobs[id];
  for(const [id,def]of Object.entries(d.mobs.birds))def.name=d.lang.pl.birds[id];
  for(let i=0;i<d.recipes.length;i++)d.recipes[i].name=d.lang.pl.recipes[i];
  d.blocks.meta=compileBlockMeta(d.blocks);
  return d;
}
