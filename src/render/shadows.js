// V20: streamed height-field sun shadows. The height texture comes exclusively
// from already loaded chunks; it never generates terrain or blocks the worker.
// WebGL1 compatible: unsigned byte R channel, LINEAR sampling, no extensions.
export const SHADOW_SIZE = 128;
export const SHADOW_STEP = 2;
export function sampleColumnTop(S, wx, wz) {
  const cx=Math.floor(wx/S.CHUNK), cz=Math.floor(wz/S.CHUNK);
  const chunk=S.chunks.get(S.chunkKey(cx,cz));
  if(!chunk?.data) return 0;
  const lx=((wx%S.CHUNK)+S.CHUNK)%S.CHUNK;
  const lz=((wz%S.CHUNK)+S.CHUNK)%S.CHUNK;
  if(chunk.shadowTop)return chunk.shadowTop[lz*S.CHUNK+lx];
  const isCaster=id=>id!==S.B.AIR && id!==S.B.WATER && id!==S.B.ICE &&
    !S.blockDefs[id]?.decor && (S.blockDefs[id]?.solid || S.LEAF_BLOCKS?.has(id));
  for(let y=S.WORLD_H-2;y>=1;y--){
    const id=chunk.data[S.idx3(lx,y,lz)];
    if(isCaster(id))return y+1;
  }
  return 0;
}
export function install(S){
  const gl=S.gl, size=SHADOW_SIZE;
  const rgba=new Uint8Array(size*size*4);
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
  S.sunShadow={tex,rgba,origin:[0,0],pendingOrigin:[0,0],span:size*SHADOW_STEP,valid:false,cursor:0,refresh:0,dirty:true};
  S.updateSunShadows=function updateSunShadows(dt){
    if(!S.running||!S.player?.pos)return;
    const map=S.sunShadow;
    map.refresh+=Math.max(0,dt);
    const [px,,pz]=S.player.pos;
    const center=[Math.floor(px/16)*16,Math.floor(pz/16)*16];
    const newOrigin=[center[0]-map.span/2,center[1]-map.span/2];
    const displaced=Math.abs(map.origin[0]-newOrigin[0])>=16||Math.abs(map.origin[1]-newOrigin[1])>=16;
    const pendingMoved=Math.abs((map.pendingOrigin?.[0]??0)-newOrigin[0])>=16||Math.abs((map.pendingOrigin?.[1]??0)-newOrigin[1])>=16;
    if((map.cursor===0||map.cursor===size*size)&&(map.dirty||pendingMoved||map.refresh>3.4)){
      map.pendingOrigin=newOrigin;map.cursor=0;map.refresh=0;map.dirty=false;
      // Keep the last complete map visible until its replacement is ready.
    }
    // Stagger work: no synchronous chunk loads, bounded effort every frame.
    const end=Math.min(size*size,map.cursor+768);
    for(let i=map.cursor;i<end;i++){
      const ix=i%size, iz=(i/size)|0;
      const x=(map.pendingOrigin||map.origin)[0]+ix*SHADOW_STEP+1,z=(map.pendingOrigin||map.origin)[1]+iz*SHADOW_STEP+1;
      const height=sampleColumnTop(S,x,z),p=i*4;
      map.rgba[p]=height;const c=S.chunks.get(S.chunkKey(Math.floor(x/S.CHUNK),Math.floor(z/S.CHUNK)));
      map.rgba[p+1]=c?.shadowLeaf?.[((z%S.CHUNK+S.CHUNK)%S.CHUNK)*S.CHUNK+(x%S.CHUNK+S.CHUNK)%S.CHUNK]||0;map.rgba[p+2]=height;map.rgba[p+3]=255;
    }
    const completed=map.cursor<size*size && end===size*size;
    map.cursor=end;
    if(completed){
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,map.tex);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,map.rgba);
      gl.activeTexture(gl.TEXTURE0);map.origin=[...(map.pendingOrigin||map.origin)];map.valid=true;
      // Wait until next refresh cycle instead of copying the texture every frame.
    }
  };
}
