import {vertexWaterDepth} from './water-depth.js';
import {LOG_NAMES} from '../sim/falling-trees.js';
import {buildSkyColumns, skyAt} from "./lighting.js";
// NightCraft V15 · native ES module (render/held-block.js); installs into the explicit shared state.
export function install(S) {
S.heldBlockProgram = S.makeProgram(`
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; uniform mat4 uMVP; varying mediump vec3 vN; varying highp vec2 vUV;
    void main(){vN=aNormal;vUV=aUV;gl_Position=uMVP*vec4(aPos,1.0);}
  `, `
    precision mediump float; varying mediump vec3 vN; varying highp vec2 vUV;
    uniform sampler2D uTex;uniform float uLight;uniform float uFogFactor;uniform vec3 uFogColor;
    void main(){vec4 t=texture2D(uTex,vUV);if(t.a<.12)discard;vec3 n=normalize(vN);float l=.72+max(0.0,dot(n,normalize(vec3(-.4,.82,.32))))*.28;vec3 col=mix(t.rgb*l*uLight,uFogColor,uFogFactor);gl_FragColor=vec4(col,t.a);}
  `);

S.HBL = { pos: S.gl.getAttribLocation(S.heldBlockProgram, 'aPos'), normal: S.gl.getAttribLocation(S.heldBlockProgram, 'aNormal'), uv: S.gl.getAttribLocation(S.heldBlockProgram, 'aUV'), mvp: S.gl.getUniformLocation(S.heldBlockProgram, 'uMVP'), tex: S.gl.getUniformLocation(S.heldBlockProgram, 'uTex'), light:S.gl.getUniformLocation(S.heldBlockProgram,'uLight'), fogFactor:S.gl.getUniformLocation(S.heldBlockProgram,'uFogFactor'), fogColor:S.gl.getUniformLocation(S.heldBlockProgram,'uFogColor') };

S.heldBlockMeshes = new Map();

S.heldBlockMeshFor = function heldBlockMeshFor(id) {
    if (S.heldBlockMeshes.has(id))
        return S.heldBlockMeshes.get(id);
    const P = [], N = [], U = [];
    for (const f of S.faces) {
        const tile = S.tileFor(id, f.side), fuv = f.uv || S.faceUV;
        for (let i = 0; i < 6; i++) {
            const v = f.v[i];
            P.push(v[0] - .5, v[1] - .5, v[2] - .5);
            N.push(f.n[0], f.n[1], f.n[2]);
            const uv = S.tileUV(tile, fuv[i][0], fuv[i][1]);
            U.push(uv[0], uv[1]);
        }
    }
    const m = S.makeMeshBuffers(P, N, U);
    S.heldBlockMeshes.set(id, m);
    return m;
};

S.drawHeldTexturedBlock = function drawHeldTexturedBlock(VP, pos, scale, id, ry = 0, rx = 0, rz = 0, world = null) {
    const m = S.heldBlockMeshFor(id);
    if (!m)
        return;
    const mvp = S.M4.multiply(VP, S.modelMatrix(pos, scale, ry, rx, rz));
    S.gl.useProgram(S.heldBlockProgram);
    S.gl.uniformMatrix4fv(S.HBL.mvp, false, mvp);
    // Tool and inventory rendering stays as before. Architectural models
    // share the world's night light, fog and nearby lantern intensity.
    if(world?.cam){
        // World-space architectural blocks must obey the SAME shaded, short-range
        // light as voxels/NPCs. Previous 16-block torch glow made house doors
        // appear self-luminous despite night or a solid roof overhead.
        const light=S.colorLightAt?S.colorLightAt(pos):Math.max(.025,.72*S.sunLevel());
        S.gl.uniform1f(S.HBL.light,Math.max(.025,Math.min(.94,light)));
        const visibility=S.renderDistance*S.CHUNK;
        S.gl.uniform1f(S.HBL.fogFactor,S.clamp((S.dist3(pos,world.cam)-visibility*.35)/(visibility*.62),0,1));
        S.gl.uniform3fv(S.HBL.fogColor,world.fogColor);
    }else{
        S.gl.uniform1f(S.HBL.light,1);
        S.gl.uniform1f(S.HBL.fogFactor,0);
        S.gl.uniform3fv(S.HBL.fogColor,[0,0,0]);
    }
    S.gl.activeTexture(S.gl.TEXTURE0);
    S.gl.bindTexture(S.gl.TEXTURE_2D, S.atlas.sharpTex||S.atlas.tex);
    S.gl.uniform1i(S.HBL.tex, 0);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, m.p);
    S.gl.enableVertexAttribArray(S.HBL.pos);
    S.gl.vertexAttribPointer(S.HBL.pos, 3, S.gl.FLOAT, false, 0, 0);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, m.n);
    S.gl.enableVertexAttribArray(S.HBL.normal);
    S.gl.vertexAttribPointer(S.HBL.normal, 3, S.gl.BYTE, false, 0, 0);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, m.u);
    S.gl.enableVertexAttribArray(S.HBL.uv);
    S.gl.vertexAttribPointer(S.HBL.uv, 2, S.gl.FLOAT, false, 0, 0);
    S.gl.drawArrays(S.gl.TRIANGLES, 0, m.count);
};

S.shouldExpose = function shouldExpose(id, nid) { if([S.B.WOOD_DOOR,S.B.WOOD_FENCE,S.B.WOOD_STAIRS].includes(nid))return true; if (id === S.B.WATER)
    return nid !== S.B.WATER && (nid === S.B.AIR || nid === S.B.TORCH || S.blockDefs[nid]?.decor || S.isFoliage(nid)); if (id === S.B.GLASS)
    return nid !== S.B.GLASS && (nid === S.B.AIR || nid === S.B.WATER || S.blockDefs[nid]?.transparent); if (S.isFoliage(id))
    return nid === S.B.AIR || nid === S.B.WATER || nid === S.B.TORCH || S.blockDefs[nid]?.decor; if (id === S.B.TORCH || S.blockDefs[id]?.decor)
    return false; return nid === S.B.AIR || nid === S.B.WATER || nid === S.B.TORCH || S.blockDefs[nid]?.decor || S.isFoliage(nid); };

S.makeMeshBuffers = function makeMeshBuffers(pos, nor, uv, wind = null, tint = null, sky = null, depth = null) {
    if (!pos.length)
        return null;
    const obj = { count: pos.length / 3 };
    obj.p = S.gl.createBuffer();
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, obj.p);
    S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(pos), S.gl.STATIC_DRAW);
    obj.n = S.gl.createBuffer();
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, obj.n);
    S.gl.bufferData(S.gl.ARRAY_BUFFER, new Int8Array(nor), S.gl.STATIC_DRAW);
    obj.u = S.gl.createBuffer();
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, obj.u);
    S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(uv), S.gl.STATIC_DRAW);
    if (wind && wind.length===obj.count) { obj.wind=S.gl.createBuffer();S.gl.bindBuffer(S.gl.ARRAY_BUFFER,obj.wind);S.gl.bufferData(S.gl.ARRAY_BUFFER,new Uint8Array(wind),S.gl.STATIC_DRAW); }
    if (tint && tint.length===obj.count*3) {obj.tint=S.gl.createBuffer();S.gl.bindBuffer(S.gl.ARRAY_BUFFER,obj.tint);S.gl.bufferData(S.gl.ARRAY_BUFFER,new Uint8Array(tint),S.gl.STATIC_DRAW);}
    if(sky && sky.length===obj.count){obj.sky=S.gl.createBuffer();S.gl.bindBuffer(S.gl.ARRAY_BUFFER,obj.sky);S.gl.bufferData(S.gl.ARRAY_BUFFER,new Uint8Array(sky),S.gl.STATIC_DRAW);}
    if(depth&&depth.length===obj.count){obj.depth=S.gl.createBuffer();S.gl.bindBuffer(S.gl.ARRAY_BUFFER,obj.depth);S.gl.bufferData(S.gl.ARRAY_BUFFER,new Uint8Array(depth),S.gl.STATIC_DRAW);}
    return obj;
};

S.deleteMesh = function deleteMesh(m) { if (!m)
    return; S.gl.deleteBuffer(m.p); S.gl.deleteBuffer(m.n); S.gl.deleteBuffer(m.u); if(m.depth)S.gl.deleteBuffer(m.depth); if(m.sky)S.gl.deleteBuffer(m.sky); if(m.wind)S.gl.deleteBuffer(m.wind); if(m.tint)S.gl.deleteBuffer(m.tint); };

S.pushDecorMesh = function pushDecorMesh(P,N,U,W,wx,y,wz,id) {
    const tile=S.tileFor(id,'side'), flower=S.isBillboardPlant(id);
    const eps=.085, sways=[S.B.TALLGRASS,S.B.FERN,S.B.REEDS,S.B.BUSH,S.B.DRY_BUSH].includes(id);
    // All flora is two-sided: backing-face culling must not make it vanish
    // when the camera turns. Flower planes are rotated towards the camera in GLSL.
    const planes=flower?
      [[[eps,0,.5],[1-eps,0,.5],[1-eps,.92,.5],[eps,0,.5],[1-eps,.92,.5],[eps,.92,.5]]]:
      [[[eps,0,eps],[1-eps,0,1-eps],[1-eps,1,1-eps],[eps,0,eps],[1-eps,1,1-eps],[eps,1,eps]],
       [[1-eps,0,eps],[eps,0,1-eps],[eps,1,1-eps],[1-eps,0,eps],[eps,1,1-eps],[1-eps,1,eps]]];
    const uv=[[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]];
    for(const plane of planes)for(const reverse of [false,true])for(let i=0;i<6;i++){
        const q=reverse?Math.floor(i/3)*3+(2-i%3):i,v=plane[q];
        P.push(wx+v[0],y+v[1],wz+v[2]);N.push(0,1,0);
        const t=S.tileUV(tile,uv[q][0],uv[q][1]);U.push(t[0],t[1]);
        W.push(flower?255:sways?Math.round(218*v[1]):0);
    }
};

/** Real UV-mapped cuboids for generated fences. They are batched with the
 * chunk mesh (not S.edits), so worldgen fences don't become invisible colliders.
 * UVs are generated from the game's real atlas and match ordinary voxel blocks. */
S.appendConstructionCuboid = function appendConstructionCuboid(P,N,U,W, x0,y0,z0,x1,y1,z1, id) {
    const sizes=[x1-x0,y1-y0,z1-z0];
    for(const f of S.faces){
        const tile=S.tileFor(id,f.side),fuv=f.uv||S.faceUV;
        for(let i=0;i<6;i++){
            const v=f.v[i];
            P.push(x0+v[0]*sizes[0],y0+v[1]*sizes[1],z0+v[2]*sizes[2]);
            N.push(...f.n);
            const uv=S.tileUV(tile,fuv[i][0],fuv[i][1]);U.push(uv[0],uv[1]);W.push(0);
        }
    }
};
S.appendFenceMesh = function appendFenceMesh(P,N,U,W,x,y,z) {
    const a=(x0,y0,z0,x1,y1,z1)=>S.appendConstructionCuboid(P,N,U,W,x0,y0,z0,x1,y1,z1,S.B.WOOD_FENCE);
    // 4-sided post + two spaced rails on each direction with a real connection.
    a(x+.39,y,z+.39,x+.61,y+1.12,z+.61);
    const connected=(xx,zz)=>{
        const nid=S.peekLoadedBlock(xx,y,zz);
        return nid===S.B.WOOD_FENCE || (nid!==S.B.AIR && nid!==S.B.WATER && nid!==S.B.WOOD_DOOR && !S.blockDefs[nid]?.decor && !!S.blockDefs[nid]?.solid);
    };
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(connected(x+dx,z+dz)){
        const right=dx>0,front=dz>0;
        for(const yy of [.36,.75]){
            if(dx!==0)a(x+(right?.5:0),y+yy,z+.445,x+(right?1:.5),y+yy+.12,z+.555);
            else a(x+.445,y+yy,z+(front?.5:0),x+.555,y+yy+.12,z+(front?1:.5));
        }
    }
};

S.rebuildChunk = function rebuildChunk(c) {
    S.deleteMesh(c.opaque);
    S.deleteMesh(c.water);
    S.deleteMesh(c.flora);
    c.sky=buildSkyColumns(S,c);
    const op = [], on = [], ou = [], ow = [], wp = [], wn = [], wu = [], ww = [], wd=[];
    const depths=new Map();
    let renderMinY=S.WORLD_H, renderMaxY=0;
    // Torches generated in villages must be rendered and illuminate rooms, too.
    c.torches=[];
    const ox = c.cx * S.CHUNK, oz = c.cz * S.CHUNK;
    for (let y = 0; y < S.WORLD_H; y++)
        for (let lz = 0; lz < S.CHUNK; lz++)
            for (let lx = 0; lx < S.CHUNK; lx++) {
                const id = c.data[S.idx3(lx, y, lz)];
                const wx = ox + lx, wz = oz + lz;
                if(id===S.B.TORCH){ c.torches.push([wx,y,wz]);continue; }
                if(id===S.B.WOOD_FENCE){S.appendFenceMesh(op,on,ou,ow,wx,y,wz);renderMinY=Math.min(renderMinY,y);renderMaxY=Math.max(renderMaxY,y+2);continue;}
                if (id === S.B.AIR || id === S.B.BEDROLL || id === S.B.CAMPFIRE || id === S.B.WOOD_DOOR || id === S.B.WOOD_STAIRS)
                    continue;
                const isWater = id === S.B.WATER, isLeaf=S.isFoliage(id);
                const naturalLog=LOG_NAMES.some(k=>S.B[k]===id) && !S.edits.has(S.editKey(wx,y,wz)) && (!S.villagePlan || Math.hypot(wx-S.villagePlan.x,wz-S.villagePlan.z)>52);
                const logWind=naturalLog?Math.min(18,Math.max(1,y-S.terrainHeight(wx,wz))):0;
                const P = isWater ? wp : op, N = isWater ? wn : on, U = isWater ? wu : ou, W=isWater?ww:ow;
                if (S.blockDefs[id]?.decor) {
                    S.pushDecorMesh(P, N, U, W, wx, y, wz, id);
                    renderMinY=Math.min(renderMinY,y);renderMaxY=Math.max(renderMaxY,y+2);
                    continue;
                }
                for (const f of S.faces) {
                    const nid = S.peekLoadedBlock(wx + f.n[0], y + f.n[1], wz + f.n[2]);
                    if (!S.shouldExpose(id, nid))
                        continue;
                    renderMinY=Math.min(renderMinY,y);renderMaxY=Math.max(renderMaxY,y+1);
                    const tile = S.tileFor(id, f.side);
                    // Leaf backs give cutout holes real canopy depth. Keep them
                    // in the existing batch, without another draw per chunk.
                    for (let i = 0; i < (isLeaf?12:6); i++) {
                        const back=i>=6,j=back?Math.floor((i-6)/3)*3+2-(i-6)%3:i;
                        const v = f.v[j],sign=back?-1:1;
                        P.push(wx + v[0], y + v[1], wz + v[2]);
                        N.push(sign*f.n[0],sign*f.n[1],sign*f.n[2]);
                        if(isWater){const key=(wx+v[0])+","+(wz+v[2])+","+(y+1);if(!depths.has(key))depths.set(key,Math.round(vertexWaterDepth(S,wx+v[0],wz+v[2],y+1)*255/16));wd.push(depths.get(key));}
                        const fuv=f.uv||S.faceUV;
                        const tuv=S.tileUV(tile,fuv[j][0],fuv[j][1]);
                        U.push(tuv[0], tuv[1]);
                        W.push(isLeaf?105:logWind);
                    }
                }
            }
    const exposure=(p,n)=>{
      const sky=[];
      for(let i=0;i<p.length;i+=18){
        const pos=[0,1,2].map(k=>(p[i+k]+p[i+3+k]+p[i+6+k])/3+n[i+k]*.03);
        const value=Math.round(255*skyAt(S,pos));
        sky.push(value,value,value,value,value,value);
      }
      return sky;
    };
    c.opaque = S.makeMeshBuffers(op, on, ou, ow, null, exposure(op,on));
    c.water = S.makeMeshBuffers(wp, wn, wu, ww, null, exposure(wp,wn),wd);
    const floraNear=!S.player || Math.hypot((c.cx+.5)*S.CHUNK-S.player.pos[0],(c.cz+.5)*S.CHUNK-S.player.pos[2])<=(S.graphics?.vegetation||80)+S.CHUNK*2;
    c.flora = floraNear?(S.buildChunkFlora?.(c)||null):null;c.floraBuilt=floraNear;c.floraPending=false;
    c.renderMinY=renderMinY<S.WORLD_H?renderMinY:0;
    c.renderMaxY=renderMaxY>0?renderMaxY:S.WORLD_H;
    S.worldLampTimer=Math.min(S.worldLampTimer||0,.15);
    c.dirty = false;
    S.dirtyChunks.delete(S.chunkKey(c.cx, c.cz));
};

S.processDirty = function processDirty(max = 2) {
    // Do not spread and allocate a growing Set on every render frame. Keep a
    // modest main-thread budget; the next frame resumes the queue.
    let n = 0, inspected=0;
    const started=performance.now();
    for (const key of S.dirtyChunks) {
        if(++inspected>96 || (n>0 && performance.now()-started>5.0))break;
    const c = S.chunks.get(key);
    if(c?.floraPending&&!c.dirty){S.deleteMesh(c.flora);c.flora=S.buildChunkFlora?.(c)||null;c.floraBuilt=true;c.floraPending=false;S.dirtyChunks.delete(key);if(++n>=max)break;}
    else if (c && c.dirty) {
        S.rebuildChunk(c);
        if (++n >= max)
            break;
    }
    else
        S.dirtyChunks.delete(key);
} };

// Streaming: distance-prioritized and bounded per frame, including on first spawn.
S.updateStreaming = function updateStreaming(px, pz, force = false) {
    const pcx=S.floorDiv(px,S.CHUNK),pcz=S.floorDiv(pz,S.CHUNK);
    const now=performance.now(),center=pcx+','+pcz;
    // Constantly walking in loaded terrain must not rescan ~500 cells and
    // re-evaluate evictions at 60–144 FPS. A changed chunk bypasses throttle.
    if(!force && S.streamCenter===center && now-(S.streamLastScan||0)<145)return;
    S.streamCenter=center;S.streamLastScan=now;
    const radius=Math.max(2,Math.min(24,S.renderDistance|0)),keep=radius+1;
    S.chunkWorker?.setFocus(pcx,pcz,keep);
    // Cache the ring offsets. Sort nearest first to avoid empty nearby scenery.
    if (!S.streamOffsets || S.streamRadius!==radius) {
        S.streamRadius=radius;
        S.streamOffsets=[];
        for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)
            if(dx*dx+dz*dz<=(radius+.45)**2)
                S.streamOffsets.push([dx,dz,dx*dx+dz*dz]);
        S.streamOffsets.sort((a,b)=>a[2]-b[2]);
    }
    let requests=0,nearBuilt=0;
    // Nearby chunks are guaranteed immediately; all others are requested in worker
    // in small batches. A larger draw distance must not freeze the main thread.
    for(const [dx,dz,dist2] of S.streamOffsets){
        const cx=pcx+dx,cz=pcz+dz,k=S.chunkKey(cx,cz);
        if(S.chunks.has(k)){const c=S.chunks.get(k);if(!c.floraBuilt&&c.opaque&&!c.floraPending&&Math.hypot((cx+.5)*S.CHUNK-px,(cz+.5)*S.CHUNK-pz)<=(S.graphics?.vegetation||80)+S.CHUNK*2){c.floraPending=true;S.dirtyChunks.add(k);}continue;}
        if(S.chunkWorker?.isRequested(cx,cz))continue;
        if(dist2<=1){
            if(nearBuilt++>= (force?5:1))continue;
            S.ensureChunk(cx,cz);continue;
        }
        if(requests>=8)break;
        if(S.chunkWorker?.request(cx,cz))requests++;
        else if(!S.chunkWorker?.ready && requests<2){S.ensureChunk(cx,cz);requests++;}
    }
    // Incremental evictions keep the memory bounded when traveling far away.
    for(const [key,c] of S.chunks){
        if(Math.abs(c.cx-pcx)>keep||Math.abs(c.cz-pcz)>keep){
            S.deleteMesh(c.opaque); S.deleteMesh(c.water); S.deleteMesh(c.flora);
            S.chunks.delete(key); S.dirtyChunks.delete(key);
            S.markDirty(c.cx-1,c.cz); S.markDirty(c.cx+1,c.cz);
            S.markDirty(c.cx,c.cz-1); S.markDirty(c.cx,c.cz+1);
        }
    }
    if(force)S.processDirty(18);
};

S.findSurface = function findSurface(x, z) {
    for (let y = S.WORLD_H - 2; y >= 1; y--) {
        const b = S.getBlock(x, y, z);
        if (S.blockDefs[b]?.solid && !S.isFoliage(b))
            return y + 1;
    }
    return S.SEA + 2;
};

S.spawnPointIsSafe = function spawnPointIsSafe(pos) {
    const [px, py, pz] = pos, x = Math.floor(px), z = Math.floor(pz), groundY = Math.floor(py - .12), ground = S.getBlock(x, groundY, z);
    if (!S.blockDefs[ground]?.solid || ground === S.B.WATER || ground === S.B.ICE || S.isFoliage(ground))
        return false;
    const feet = S.getBlock(x, Math.floor(py + .10), z), body = S.getBlock(x, Math.floor(py + .95), z), head = S.getBlock(x, Math.floor(py + 1.72), z);
    if (feet === S.B.WATER || body === S.B.WATER || head === S.B.WATER)
        return false;
    return !S.aabbHitsWorld(S.playerAabbAt(px, py, pz));
};

S.clearSpawnPocket = function clearSpawnPocket(x, y, z) {
    // Emergency-only fallback. It is better to trim a fern/one obstructing block than
    // respawn the player inside geometry with zero movement available.
    for (let yy = y; yy <= Math.min(S.WORLD_H - 2, y + 2); yy++) {
        const id = S.getBlock(x, yy, z);
        if (id !== S.B.AIR && id !== S.B.BEDROCK && id !== S.B.WATER)
            S.setBlock(x, yy, z, S.B.AIR);
    }
    const floor = S.getBlock(x, y - 1, z);
    if (!S.blockDefs[floor]?.solid || floor === S.B.WATER || floor === S.B.ICE || S.isFoliage(floor))
        S.setBlock(x, y - 1, z, S.B.COBBLE);
    return [x + .5, y + .08, z + .5];
};

S.findSafeSpawn = function findSafeSpawn(cx = 0, cz = 0, maxRadius = 18) {
    const candidates = [];
    for (let r = 0; r <= maxRadius; r++)
        for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
                if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r)
                    continue;
                const x = Math.floor(cx + dx), z = Math.floor(cz + dz), y = S.findSurface(x, z), ground = S.getBlock(x, y - 1, z);
                if (y < 2 || y >= S.WORLD_H - 3 || !S.blockDefs[ground]?.solid || ground === S.B.WATER || ground === S.B.ICE || S.isFoliage(ground) || S.blockDefs[ground]?.material === 'wood')
                    continue;
                const pos = [x + .5, y + .08, z + .5], ids = [S.getBlock(x, y, z), S.getBlock(x, y + 1, z), S.getBlock(x, y + 2, z)];
                if (ids.some(id => id === S.B.WATER || id === S.B.BEDROCK))
                    continue;
                // Remove only soft decoration / foliage before the collision check.
                for (let yy = y; yy <= y + 2; yy++) {
                    const id = S.getBlock(x, yy, z);
                    if (S.blockDefs[id]?.decor || S.isFoliage(id))
                        S.setBlock(x, yy, z, S.B.AIR);
                }
                if (!S.spawnPointIsSafe(pos))
                    continue;
                const h0 = S.terrainHeight(x, z), h1 = S.terrainHeight(x + 1, z), h2 = S.terrainHeight(x - 1, z), h3 = S.terrainHeight(x, z + 1), h4 = S.terrainHeight(x, z - 1), slope = Math.max(Math.abs(h0 - h1), Math.abs(h0 - h2), Math.abs(h0 - h3), Math.abs(h0 - h4));
                candidates.push({ pos, score: r * 2 + slope * .7 });
                if (candidates.length >= 8 && r > 3)
                    break;
            }
    if (candidates.length) {
        candidates.sort((a, b) => a.score - b.score);
        return candidates[0].pos;
    }
    const x = Math.floor(cx), z = Math.floor(cz), y = S.clamp(S.findSurface(x, z), 2, S.WORLD_H - 4);
    return S.clearSpawnPocket(x, y, z);
};
}
