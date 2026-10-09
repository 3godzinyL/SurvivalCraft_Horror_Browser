import {skyAt} from './lighting.js';
export function install(S){
 const cache=new Map();let owner=null;
 S.renderVillageCrops=(VP,fogColor,cam,v)=>{
  if(owner!==v){for(const e of cache.values())S.deleteMesh(e.mesh);cache.clear();owner=v;}
  const farms=S.ensureVillageFarms?.()||v.farms||[];
  for(const farm of farms){
   const distance=Math.hypot(cam[0]-(farm.x+farm.width/2),cam[2]-(farm.z+farm.depth/2));if(distance>80)continue;
   const stamp=(farm.plots||[]).map(p=>Math.floor(p.growth*5)).join('');let entry=cache.get(farm.id);
   if(!entry||entry.stamp!==stamp){
    if(entry)S.deleteMesh(entry.mesh);const p=[],n=[],uv=[],wind=[],tint=[],sky=[];
    for(const plot of farm.plots||[]){
     const stage=Math.max(.15,Math.floor(plot.growth*5)/5),height=.26+stage*.95;
     const width=plot.type===1?.70:.54,phi=S.hash2i(plot.x,plot.z,178)*Math.PI,baseY=farm.y??v.y;
     for(let angle of [phi,phi+Math.PI/2]){
      const dx=Math.cos(angle)*width/2,dz=Math.sin(angle)*width/2,x=plot.x+.5,z=plot.z+.5,y=baseY+.03;
      const vertices=[[x-dx,y,z-dz],[x+dx,y,z+dz],[x+dx,y+height,z+dz],[x-dx,y,z-dz],[x+dx,y+height,z+dz],[x-dx,y+height,z-dz]],coords=[[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]];
      const light=Math.round(255*skyAt(S,[x,y+.1,z]));
      for(let i=0;i<6;i++){p.push(...vertices[i]);n.push(0,1,0);uv.push(...S.tileUV(113+plot.type,...coords[i]));wind.push(i===0||i===1||i===3?0:160);tint.push(230,231,213);sky.push(light);}
     }
    }
    entry={stamp,mesh:S.makeMeshBuffers(p,n,uv,wind,tint,sky)};cache.set(farm.id,entry);
   }
   S.activeChunkLamps=S.chunkLampUniforms(Math.floor(farm.x/S.CHUNK),Math.floor(farm.z/S.CHUNK));
   S.gl.disable(S.gl.CULL_FACE);S.drawVoxelMesh(entry.mesh,1,VP,cam,fogColor,Math.max(7,S.renderDistance*S.CHUNK*.32),S.renderDistance*S.CHUNK*.96,S.frameDay||S.sunLevel(),S.frameTorchPos||cam,S.hasHeldTorch()?1:0,0,1);S.gl.enable(S.gl.CULL_FACE);
  }
 };
}
