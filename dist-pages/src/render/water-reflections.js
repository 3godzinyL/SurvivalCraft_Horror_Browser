export function install(S){
 const gl=S.gl,placeholder=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,placeholder);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([14,20,18,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 const fallback=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,fallback);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([14,20,18,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 const r=S.waterReflection={tex:placeholder,fallback,ready:false,VP:S.M4.identity(),last:0,passes:0,visible:false,invalidate(){this.last=0;this.ready=false;this.visible=false;}};
 S.refreshWaterReflection=({cam,dir,proj,sky,day,fogColor,torchPos,torchPower})=>{
  if(S.graphics?.water!==2 || S.cameraMode===2 || cam[1]<S.SEA+1.05){r.visible=false;return;}
  const plane=S.SEA+1;
  const visible=[...S.chunks.values()].some(c=>{
   if(!c.water)return false;
   const x=c.cx*S.CHUNK,z=c.cz*S.CHUNK;
   return !S.framePlanes||S.aabbInFrustum(S.framePlanes,x,plane-.2,z,x+S.CHUNK,plane+.2,z+S.CHUNK);
  });
  if(!visible){r.visible=false;return;}
  const now=performance.now(),moving=!r.cam||cam.some((v,i)=>Math.abs(v-r.cam[i])>.00001)||dir.some((v,i)=>Math.abs(v-r.dir[i])>.00001)||Math.abs(proj[0]-r.projX)>.00001||Math.abs(proj[5]-r.projY)>.00001;
  // Match every moving view; reuse while stationary and skip invisible water.
  if(r.ready&&r.visible&&r.seed===S.worldSeed&&!moving&&now-r.last<100)return;
  const cpuStart=performance.now();
  const size=S.graphics.resolution>1?512:256;
  if(r.size!==size){
   if(r.fbo){gl.deleteFramebuffer(r.fbo);gl.deleteRenderbuffer(r.depth);}
   r.size=size;r.fbo=gl.createFramebuffer();r.depth=gl.createRenderbuffer();
   gl.bindTexture(gl.TEXTURE_2D,r.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.bindFramebuffer(gl.FRAMEBUFFER,r.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,r.tex,0);
   gl.bindRenderbuffer(gl.RENDERBUFFER,r.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);
   gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,r.depth);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.bindFramebuffer(gl.FRAMEBUFFER,null);r.ready=false;return;}
  }
  const eye=[cam[0],2*plane-cam[1],cam[2]],target=[cam[0]+dir[0],2*plane-cam[1]-dir[1],cam[2]+dir[2]];
  r.VP=S.M4.multiply(proj,S.M4.lookAt(eye,target,[0,-1,0]));const planes=S.extractFrustumPlanes(r.VP);
  gl.bindFramebuffer(gl.FRAMEBUFFER,r.fbo);gl.viewport(0,0,size,size);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);S.drawSkyGradient?.(sky,day,(S.worldSeconds%S.DAY_SECONDS)/S.DAY_SECONDS,S.weatherMode);
  S.reflectionPass=true;let drawCount=0;
  try{
   for(const c of S.chunks.values()){
    const x=c.cx*S.CHUNK,z=c.cz*S.CHUNK;
    if(!c.opaque || c.renderMaxY<=plane || Math.hypot(x+S.CHUNK*.5-cam[0],z+S.CHUNK*.5-cam[2])>80 ||
       !S.aabbInFrustum(planes,x,plane,z,x+S.CHUNK,c.renderMaxY||S.WORLD_H,z+S.CHUNK))continue;
    S.activeChunkLamps=S.chunkLampUniforms(c.cx,c.cz);
    S.drawVoxelMesh(c.opaque,1,r.VP,eye,fogColor,35,90,day,torchPos,torchPower,0);drawCount++;
   }
   r.ready=true;r.visible=true;r.last=now;r.seed=S.worldSeed;r.cam=[...cam];r.dir=[...dir];r.projX=proj[0];r.projY=proj[5];r.passes++;r.drawCount=drawCount;r.cpuMs=performance.now()-cpuStart;
  }finally{S.reflectionPass=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,S.canvas.width,S.canvas.height);gl.depthMask(true);}
 };
}
