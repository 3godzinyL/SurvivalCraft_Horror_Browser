// Optional PNG overrides are explicitly listed so normal boots make no 404 requests.
export async function loadTextureOverrides(){
  const r=await fetch(new URL('../../data/texture-overrides.json',import.meta.url));if(!r.ok)return Object.create(null);
  const manifest=await r.json();const images=Object.create(null);
  await Promise.all(Object.entries(manifest).map(async ([tile,path])=>{
    if(!/^tile_\d{3}$/.test(tile) || !/^assets\/textures\/[a-zA-Z0-9_-]+\.png$/.test(path))throw Error('Invalid texture override: '+tile);
    try {
      const img=new Image();img.decoding='async';img.src=new URL('../../'+path,import.meta.url).href;
      await img.decode();images[tile]=img;
    }catch(e){console.warn('PNG missing; using procedural tile:',tile,e);}
  }));return images;
}
