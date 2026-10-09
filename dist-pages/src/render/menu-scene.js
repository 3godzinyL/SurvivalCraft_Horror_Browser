import {install as installNoise} from '../world/noise.js';
import {install as installWorldgen} from '../world/worldgen.js';
/**
 * NightCraft V18.1 - 12-chunk-radius menu panorama.
 * Independent from game saves: LOD terrain meshes stream one sector per frame;
 * the preview uses the real atlas, foliage wind shader, water shader and falling leaves.
 * All geometry is cached on the GPU. No repeated per-frame world generation.
 */
export function install(S) {
  const gl = S.gl;
  const menu = document.getElementById('mainMenu');
  const fx = document.getElementById('menuLeafFx');
  const ctx = fx?.getContext('2d', { alpha:true });
  const CHUNK_RADIUS=12;
  const CHUNK_SIZE=S.CHUNK||16;
  const WORLD_RADIUS=CHUNK_RADIUS*CHUNK_SIZE;
  const SECTOR=CHUNK_SIZE*4;
  // 24x24=576 source chunks, grouped into 36 draw sectors. Mesh geometry
  // is LOD (2/4/8m cells), not 576 fully detailed voxel columns.
  const SIDE=CHUNK_RADIUS*2;
  const REGION_COUNT=Math.ceil(SIDE/4);
  const regions=[];
  const queued=[];
  let particles=[],lastFx=0;
  const f32=t=>((Math.sin(t*127.1+78.23)*43758.5453)%1+1)%1;
  const rand=(x,z,s=0)=>f32(x*29.3+z*79.7+s*103.7);
  const riverCenter=z=>Math.sin(z*.039)*17 + Math.sin(z*.112)*2.8-1.4;
  const riverWidth=z=>6.5 + Math.sin(z*.075)*1.6;
  function riverDistance(x,z){return Math.abs(x-riverCenter(z));}
  // Sample the production generator in an isolated preview context.
  const preview={GAME_DATA:S.GAME_DATA||{ruins:{types:[]}},B:S.B,blockDefs:S.blockDefs,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,smooth:t=>t*t*(3-2*t)};
  installNoise(preview);installWorldgen(preview);
  preview.worldSeed=preview.hashString('hollow-pines-317');preview.worldgenVersion=26;
  let site={x:0,z:0,score:-Infinity};
  for(let z=-512;z<=512;z+=64)for(let x=-512;x<=512;x+=64){
    const h=preview.terrainHeight(x,z);
    const score=-Math.abs(h-preview.SEA-1)+Math.abs(preview.terrainHeight(x+32,z)-h)*.22;
    if(score>site.score)site={x,z,score};
  }
  const columns=new Map();
  function column(x,z){
    const key=Math.floor(x)+','+Math.floor(z);
    if(!columns.has(key)){
      const wx=Math.floor(x)+site.x,wz=Math.floor(z)+site.z;
      const h=preview.terrainHeight(wx,wz),biome=preview.biomeAt(wx,wz,h);
      columns.set(key,{h:Math.max(1,h-preview.SEA+3),id:preview.surfaceBlockFor(biome,wx,wz)});
    }
    return columns.get(key);
  }
  const terrainHeight=(x,z)=>column(x,z).h;
  const blockAt=(x,z,h)=>column(x,z).id;
  // Priority is central first, then outward. The first sector already contains
  // shoreline, water, tree silhouettes and moving grass.
  for(let gz=-REGION_COUNT/2;gz<REGION_COUNT/2;gz++)
    for(let gx=-REGION_COUNT/2;gx<REGION_COUNT/2;gx++)
      queued.push({gx,gz,rank:Math.hypot(gx+.5,gz+.5)});
  queued.sort((a,b)=>a.rank-b.rank || Math.abs(a.gx)-Math.abs(b.gx) || Math.abs(a.gz)-Math.abs(b.gz));
  S.menuPreviewInfo={chunkRadius:CHUNK_RADIUS, diameterChunks:SIDE,
      totalChunks:SIDE*SIDE, totalSectors:queued.length, builtSectors:0,
      worldRadiusBlocks:WORLD_RADIUS,generatedBounds:null,seed:preview.worldSeed,sourceOrigin:[site.x,site.z],productionTerrain:true};

  function buildSector({gx,gz}) {
    const originX=gx*SECTOR,originZ=gz*SECTOR;
    const opaque={p:[],n:[],u:[],w:[]},water={p:[],n:[],u:[],w:[]};
    function quad(out,vertices,normal,tile,wind=0){
      const order=[0,1,2,0,2,3];
      const tex=[[0,1],[1,1],[1,0],[0,0]];
      for(const i of order){
        out.p.push(...vertices[i]);out.n.push(...normal);
        const uv=S.tileUV(tile,...tex[i]);out.u.push(...uv);out.w.push(wind);
      }
    }
    // Use the game's own face winding + UV mapping for boxes: this is also
    // important to keep grass-side top green, rather than upside down.
    function box(out,x,y,z,w,h,d,id,wind=0,topOnly=false) {
      if(h<=0)return;
      for(const face of S.faces){
        if(topOnly && face.side!=='top')continue;
        const tile=S.tileFor(id,face.side);
        for(let i=0;i<6;i++){
          const v=face.v[i],uv=S.tileUV(tile,...face.uv[i]);
          out.p.push(x+v[0]*w,y+v[1]*h,z+v[2]*d);
          out.n.push(...face.n);out.u.push(...uv);out.w.push(wind);
        }
      }
    }
    // Adaptive quadtree grid: inner 96 blocks at 2x2 cells, next ring 4x4,
    // far horizon 8x8. Each cell is built exactly once (no duplicate areas).
    function terrainCell(x,z,size){
      const midx=x+size*.5,midz=z+size*.5;
      const h=terrainHeight(midx,midz);
      const id=blockAt(midx,midz,h);
      // Underground columns are drawn only as a coarse side skirt; none of the
      // expensive underground real-world chunks are allocated for the menu.
      box(opaque,x,-2,z,size,h+2,size,id,0,false);
      if(h<3)box(water,x,3.03,z,size,.08,size,S.B.WATER,0,true);
      if(size<=4 && h>=4 && rand(Math.floor(x),Math.floor(z),72)>.48){
        const dec=rand(x,z,74)>.61?S.B.FERN:S.B.TALLGRASS;
        S.pushDecorMesh(opaque.p,opaque.n,opaque.u,opaque.w,x+size*.30,h,z+size*.30,dec);
      }
    }
    // Recursive grid is aligned at 8-block boundaries across sector borders.
    function emitGrid(x,z,size){
      const radius=Math.hypot(x+size*.5,z+size*.5);
      const target=radius<96?2:radius<154?4:8;
      if(size>target){const h=size/2;emitGrid(x,z,h);emitGrid(x+h,z,h);emitGrid(x,z+h,h);emitGrid(x+h,z+h,h);}
      else terrainCell(x,z,size);
    }
    for(let z=originZ;z<originZ+SECTOR;z+=8)
      for(let x=originX;x<originX+SECTOR;x+=8)emitGrid(x,z,8);

    // Tree density scales down with distance; trees remain true voxel objects,
    // and the same leaf wind flag drives the existing shader animation.
    for(let z=originZ;z<originZ+SECTOR;z+=12){
      for(let x=originX;x<originX+SECTOR;x+=12){
        const tx=x+Math.floor(rand(x,z,4)*7)+2;
        const tz=z+Math.floor(rand(x,z,9)*7)+2;
        const radius=Math.hypot(tx,tz);
        const h=terrainHeight(tx,tz);
        if(h<4 || radius>WORLD_RADIUS || rand(x,z,8)<(radius<100?.44:.57))continue;
        const meadow=Math.sin(tx*.035+1.6)*Math.cos(tz*.032-1.1);
        if(meadow>.60 || riverDistance(tx,tz)<riverWidth(tz)+5)continue;
        const pine=rand(tx,tz,18)<.76;
        const log=pine?S.B.PINEWOOD:S.B.BIRCHWOOD;
        const foliage=pine?S.B.PINELEAVES:S.B.BIRCHLEAVES;
        const tall=(pine?8:6)+Math.floor(rand(tx,tz,33)*5);
        const far=radius>150;
        for(let level=0;level<tall;level++)box(opaque,tx,h+level,tz,1,1,1,log,8);
        if(pine){
          const crowns=far?2:4;
          for(let t=0;t<crowns;t++){
            const spread=(far?2.3:3.6)-t*(far?.25:.35);
            const cy=h+tall-5+t*(far?2.5:1.75);
            box(opaque,tx-spread*.5+.5,cy,tz-spread*.5+.5,spread,2.6,spread,foliage,125);
          }
        }else{
          const spread=far?3.3:4.5;
          box(opaque,tx-spread*.5+.5,h+tall-3,tz-spread*.5+.5,spread,3.3,spread,foliage,125);
          if(!far)box(opaque,tx-1,h+tall-.5,tz-1,3,2.5,3,foliage,125);
        }
      }
    }
    const result={gx,gz,opaque:S.makeMeshBuffers(opaque.p,opaque.n,opaque.u,opaque.w),
        water:S.makeMeshBuffers(water.p,water.n,water.u,water.w)};
    const bounds=S.menuPreviewInfo.generatedBounds;
    S.menuPreviewInfo.generatedBounds=bounds?{
      minX:Math.min(bounds.minX,originX),minZ:Math.min(bounds.minZ,originZ),
      maxX:Math.max(bounds.maxX,originX+SECTOR),maxZ:Math.max(bounds.maxZ,originZ+SECTOR)
    }:{minX:originX,minZ:originZ,maxX:originX+SECTOR,maxZ:originZ+SECTOR};
    S.menuPreviewInfo.builtSectors++;
    regions.push(result);
  }

  function resetParticles(w, h) {
    particles = Array.from({ length: Math.max(32, Math.min(100, Math.floor(w * h / 14500))) }, (_, i) => ({
      x: rand(i, 11) * w, y: rand(i, 27) * h, size: 1.7 + rand(i, 31) * 4.1,
      speed: 13 + rand(i, 38) * 25, sway: rand(i, 45) * 6.28,
      depth: .3 + rand(i, 49) * .7, spin: rand(i, 56) * 6.28,
      warm: rand(i, 58) > .75
    }));
  }
  function paintLeaves(now) {
    if (!ctx || !fx) return;
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (fx.width !== pw || fx.height !== ph) {
      fx.width = pw; fx.height = ph; resetParticles(w, h);
    }
    if (now - lastFx < 27) return; // ~30 fps, independent of game simulation
    const dt = Math.min(.06, (now - lastFx) / 1000 || .033); lastFx = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.y += p.speed * dt * p.depth;
      p.x += dt * (8 + Math.sin(now * .00037 + p.sway) * 6) * p.depth;
      p.spin += dt * (p.warm ? .8 : -.8);
      if (p.y > h + 15 || p.x > w + 15) { p.y = -20; p.x = rand(now, p.spin) * w; }
      const sx = p.x + Math.sin(p.y * .024 + now * .0015 + p.sway) * (16 + 12 * p.depth);
      const s = p.size * p.depth, flip = Math.cos(p.spin) * .72;
      ctx.save(); ctx.translate(sx, p.y); ctx.rotate(p.spin * .3);
      ctx.scale(1, Math.max(.20, Math.abs(flip)));
      ctx.globalAlpha = .23 + p.depth * .42;
      ctx.fillStyle = p.warm ? '#ba9560' : '#869b71';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .85, 0); ctx.lineTo(0, s * 1.5); ctx.lineTo(-s * .9, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = p.warm ? '#5d4932' : '#344b35'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s * 1.5); ctx.stroke();
      ctx.restore();
    }
  }

  S.renderMainMenuBackdrop = function renderMainMenuBackdrop() {
    if(!menu?.classList.contains('active'))return;
    // Progressive GPU builds keep the UI responsive at a full 12-chunk radius.
    if(queued.length)buildSector(queued.shift());
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
    gl.clearColor(.29,.40,.43,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const now=performance.now();const t=now/1000;
    const a=.46+t*.022;
    const eye=[Math.cos(a)*110,49+Math.sin(t*.14)*2,Math.sin(a)*110];
    const target=[0,7,0],fog=[.29,.37,.33];
    S.activeChunkLamps=null;
    S.drawSkyGradient?.([.46,.64,.76],1,.45,'clear');
    const proj=S.M4.perspective(Math.PI/3.0,S.canvas.width/S.canvas.height,.10,445);
    const VP=S.M4.multiply(proj,S.M4.lookAt(eye,target));
    gl.disable(gl.BLEND);
    for(const region of regions)
      if(region.opaque)S.drawVoxelMesh(region.opaque,1,VP,eye,fog,125,365,.97,[0,-100,0],0,0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    for(const region of regions)
      if(region.water)S.drawVoxelMesh(region.water,.82,VP,eye,fog,125,365,.97,[0,-100,0],0,1);
    gl.depthMask(true);gl.disable(gl.BLEND);
    paintLeaves(now);
  };
}
