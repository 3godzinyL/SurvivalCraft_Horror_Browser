// Shared light contract: equipped and placed torches use identical radii/power.
export const TORCH_RADIUS = 7.2;
export const TORCH_POWER = 1;
export const MAX_LIGHTS = 12;
export function lightFalloff(distance, power = 1) {
  const x = Math.max(0, 1 - distance / TORCH_RADIUS);
  return power * x * x * (3 - 2 * x);
}
export function skyTransmission(S, id) {
  if (S.isFoliage(id)) return .91;
  if (id === S.B.GLASS || id === S.B.ICE) return .88;
  if (id === S.B.WATER || S.blockDefs[id]?.decor) return 1;
  return S.blockDefs[id]?.solid ? 0 : 1;
}
export function buildSkyColumns(S, chunk) {
  const sky = new Uint8Array(chunk.data.length);
  chunk.skyMemo=null;chunk.shadowTop=new Uint8Array(S.CHUNK*S.CHUNK);chunk.shadowLeaf=new Uint8Array(S.CHUNK*S.CHUNK);
  for (let z = 0; z < S.CHUNK; z++) for (let x = 0; x < S.CHUNK; x++) {
    let exposure = 1;
    for (let y = S.WORLD_H - 1; y >= 0; y--) {
      const i = S.idx3(x, y, z);
      sky[i] = Math.round(255 * exposure);
      const id=chunk.data[i],column=z*S.CHUNK+x;
      if(!chunk.shadowTop[column]&&id!==S.B.WATER&&id!==S.B.ICE&&id!==S.B.GLASS&&!S.blockDefs[id]?.decor&&(S.blockDefs[id]?.solid||S.isFoliage(id))){chunk.shadowTop[column]=y+1;chunk.shadowLeaf[column]=S.isFoliage(id)?255:0;}
      exposure *= skyTransmission(S, chunk.data[i]);
    }
  }
  return sky;
}
export function skyAt(S, pos) {
  const x = Math.floor(pos[0]), z = Math.floor(pos[2]);
  const chunk = S.chunks?.get(S.chunkKey?.(Math.floor(x/S.CHUNK), Math.floor(z/S.CHUNK)));
  if (!chunk?.sky) return 1;
  const y = Math.max(0, Math.min(S.WORLD_H - 1, Math.floor(pos[1])));
  const direct=chunk.sky[S.idx3((x%S.CHUNK+S.CHUNK)%S.CHUNK,y,(z%S.CHUNK+S.CHUNK)%S.CHUNK)]/255;
  if(direct>.95 || !S.peekLoadedBlock)return direct;
  const index=S.idx3((x%S.CHUNK+S.CHUNK)%S.CHUNK,y,(z%S.CHUNK+S.CHUNK)%S.CHUNK);
  chunk.skyMemo ||= new Uint8Array(chunk.data.length);
  if(chunk.skyMemo[index])return (chunk.skyMemo[index]-1)/255;
  let fill=direct;
  // Short lateral sky paths give eaves and exterior walls diffuse daylight.
  // Opaque walls stop the probe, so an enclosed room cannot see exterior sky.
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    for(let step=1;step<=3;step++){
      const xx=x+dx*step,zz=z+dz*step,id=S.peekLoadedBlock(xx,y,zz);
      if(skyTransmission(S,id)===0)break;
      const neighbor=S.chunks.get(S.chunkKey(Math.floor(xx/S.CHUNK),Math.floor(zz/S.CHUNK)));
      if(!neighbor?.sky)break;
      const sky=neighbor.sky[S.idx3((xx%S.CHUNK+S.CHUNK)%S.CHUNK,y,(zz%S.CHUNK+S.CHUNK)%S.CHUNK)]/255;
      fill=Math.max(fill,sky*Math.pow(.80,step));
    }
  }
  chunk.skyMemo[index]=Math.round(fill*255)+1;
  return fill;
}
export function selectChunkLights(lights, cx, cz, size, camera) {
  const x0=cx*size, z0=cz*size;
  return lights.map(p => {
    const dx=Math.max(x0-p[0],0,p[0]-x0-size);
    const dz=Math.max(z0-p[2],0,p[2]-z0-size);
    const near=lightFalloff(Math.hypot(p[0]-(x0+size*.5),0,p[2]-(z0+size*.5)),p[3]);
    return {p, distance:dx*dx+dz*dz, near};
  }).filter(o=>o.distance<TORCH_RADIUS**2)
    .sort((a,b)=>b.near-a.near || a.distance-b.distance || a.p[0]-b.p[0] || a.p[2]-b.p[2])
    .slice(0,MAX_LIGHTS).map(o=>o.p);
}
