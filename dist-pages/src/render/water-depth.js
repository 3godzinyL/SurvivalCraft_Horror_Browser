export function columnWaterDepth(S,x,z,surface){
 const chunk=S.chunks?.get(S.chunkKey(Math.floor(x/S.CHUNK),Math.floor(z/S.CHUNK)));if(!chunk)return null;
 for(let y=surface-1;y>=Math.max(0,surface-16);y--)if(S.peekLoadedBlock(x,y,z)!==S.B.WATER)return Math.max(0,surface-y-1);
 return 16;
}
export function vertexWaterDepth(S,x,z,surface,fallback=2){
 let total=0,count=0;for(const dx of [-1,0])for(const dz of [-1,0]){
  const depth=columnWaterDepth(S,Math.floor(x)+dx,Math.floor(z)+dz,surface);
  if(depth!==null){total+=depth;count++;}
 }
 return count?total/count:fallback;
}
