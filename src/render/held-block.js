// NightCraft V15 · native ES module (render/held-block.js); installs into the explicit shared state.
export function install(S) {
S.heldBlockProgram = S.makeProgram(`
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; uniform mat4 uMVP; varying vec3 vN; varying vec2 vUV;
    void main(){vN=aNormal;vUV=aUV;gl_Position=uMVP*vec4(aPos,1.0);}
  `, `
    precision mediump float; varying vec3 vN; varying vec2 vUV; uniform sampler2D uTex;
    void main(){vec4 t=texture2D(uTex,vUV);if(t.a<.12)discard;vec3 n=normalize(vN);float l=.72+max(0.0,dot(n,normalize(vec3(-.4,.82,.32))))*.28;gl_FragColor=vec4(t.rgb*l,t.a);}
  `);

S.HBL = { pos: S.gl.getAttribLocation(S.heldBlockProgram, 'aPos'), normal: S.gl.getAttribLocation(S.heldBlockProgram, 'aNormal'), uv: S.gl.getAttribLocation(S.heldBlockProgram, 'aUV'), mvp: S.gl.getUniformLocation(S.heldBlockProgram, 'uMVP'), tex: S.gl.getUniformLocation(S.heldBlockProgram, 'uTex') };

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

S.drawHeldTexturedBlock = function drawHeldTexturedBlock(VP, pos, scale, id, ry = 0, rx = 0, rz = 0) {
    const m = S.heldBlockMeshFor(id);
    if (!m)
        return;
    const mvp = S.M4.multiply(VP, S.modelMatrix(pos, scale, ry, rx, rz));
    S.gl.useProgram(S.heldBlockProgram);
    S.gl.uniformMatrix4fv(S.HBL.mvp, false, mvp);
    S.gl.activeTexture(S.gl.TEXTURE0);
    S.gl.bindTexture(S.gl.TEXTURE_2D, S.atlas.tex);
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

S.shouldExpose = function shouldExpose(id, nid) { if (id === S.B.WATER)
    return nid !== S.B.WATER && nid === S.B.AIR; if (id === S.B.GLASS)
    return nid !== S.B.GLASS && (nid === S.B.AIR || nid === S.B.WATER || S.blockDefs[nid]?.transparent); if (S.isFoliage(id))
    return nid === S.B.AIR || nid === S.B.WATER || nid === S.B.TORCH || S.blockDefs[nid]?.decor; if (id === S.B.TORCH || S.blockDefs[id]?.decor)
    return false; return nid === S.B.AIR || nid === S.B.WATER || nid === S.B.TORCH || S.blockDefs[nid]?.decor || S.isFoliage(nid); };

S.makeMeshBuffers = function makeMeshBuffers(pos, nor, uv) {
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
    return obj;
};

S.deleteMesh = function deleteMesh(m) { if (!m)
    return; S.gl.deleteBuffer(m.p); S.gl.deleteBuffer(m.n); S.gl.deleteBuffer(m.u); };

S.pushDecorMesh = function pushDecorMesh(P, N, U, wx, y, wz, id) {
    const tile = S.tileFor(id, 'side'), eps = .03;
    const planes = [[[eps, 0, eps], [1 - eps, 0, 1 - eps], [1 - eps, 1, 1 - eps], [eps, 0, eps], [1 - eps, 1, 1 - eps], [eps, 1, eps]], [[1 - eps, 0, eps], [eps, 0, 1 - eps], [eps, 1, 1 - eps], [1 - eps, 0, eps], [eps, 1, 1 - eps], [1 - eps, 1, eps]]];
    for (const plane of planes) {
        for (let i = 0; i < 6; i++) {
            const v = plane[i];
            P.push(wx + v[0], y + v[1], wz + v[2]);
            N.push(0, 1, 0);
            const tuv = S.tileUV(tile, S.faceUV[i][0], S.faceUV[i][1]);
            U.push(tuv[0], tuv[1]);
        }
    }
};

S.rebuildChunk = function rebuildChunk(c) {
    S.deleteMesh(c.opaque);
    S.deleteMesh(c.water);
    const op = [], on = [], ou = [], wp = [], wn = [], wu = [];
    const ox = c.cx * S.CHUNK, oz = c.cz * S.CHUNK;
    for (let y = 0; y < S.WORLD_H; y++)
        for (let lz = 0; lz < S.CHUNK; lz++)
            for (let lx = 0; lx < S.CHUNK; lx++) {
                const id = c.data[S.idx3(lx, y, lz)];
                if (id === S.B.AIR || id === S.B.TORCH || id === S.B.BEDROLL || id === S.B.WOOD_DOOR || id === S.B.WOOD_STAIRS || id === S.B.WOOD_FENCE)
                    continue;
                const wx = ox + lx, wz = oz + lz, isWater = id === S.B.WATER;
                const P = isWater ? wp : op, N = isWater ? wn : on, U = isWater ? wu : ou;
                if (S.blockDefs[id]?.decor) {
                    S.pushDecorMesh(P, N, U, wx, y, wz, id);
                    continue;
                }
                for (const f of S.faces) {
                    const nid = S.getBlock(wx + f.n[0], y + f.n[1], wz + f.n[2]);
                    if (!S.shouldExpose(id, nid))
                        continue;
                    const tile = S.tileFor(id, f.side);
                    for (let i = 0; i < 6; i++) {
                        const v = f.v[i];
                        P.push(wx + v[0], y + v[1], wz + v[2]);
                        N.push(f.n[0], f.n[1], f.n[2]);
                        const fuv = f.uv || S.faceUV, tuv = S.tileUV(tile, fuv[i][0], fuv[i][1]);
                        U.push(tuv[0], tuv[1]);
                    }
                }
            }
    c.opaque = S.makeMeshBuffers(op, on, ou);
    c.water = S.makeMeshBuffers(wp, wn, wu);
    c.dirty = false;
    S.dirtyChunks.delete(S.chunkKey(c.cx, c.cz));
};

S.processDirty = function processDirty(max = 2) { let n = 0; for (const key of [...S.dirtyChunks]) {
    const c = S.chunks.get(key);
    if (c && c.dirty) {
        S.rebuildChunk(c);
        if (++n >= max)
            break;
    }
    else
        S.dirtyChunks.delete(key);
} };

S.updateStreaming = function updateStreaming(px, pz, force = false) {
    const pcx = S.floorDiv(px, S.CHUNK), pcz = S.floorDiv(pz, S.CHUNK), keep = S.renderDistance + 1;
    S.chunkWorker?.setFocus(pcx,pcz,keep);
    for (let dz = -S.renderDistance; dz <= S.renderDistance; dz++)
        for (let dx = -S.renderDistance; dx <= S.renderDistance; dx++) {
            if (dx * dx + dz * dz > (S.renderDistance + .6) * (S.renderDistance + .6))
                continue;
            const cx=pcx+dx,cz=pcz+dz;
            // Keep the near player collision area synchronous. Distant terrain is
            // generated off-thread; on-demand block lookups still work immediately.
            if(!force && Math.max(Math.abs(dx),Math.abs(dz))>=2 &&
               !S.chunks.has(S.chunkKey(cx,cz)) && S.chunkWorker?.request(cx,cz)) continue;
            const c = S.ensureChunk(cx,cz);
            if (c.dirty)
                S.dirtyChunks.add(S.chunkKey(c.cx, c.cz));
        }
    for (const [key, c] of S.chunks) {
        if (Math.abs(c.cx - pcx) > keep || Math.abs(c.cz - pcz) > keep) {
            S.deleteMesh(c.opaque);
            S.deleteMesh(c.water);
            S.chunks.delete(key);
            S.dirtyChunks.delete(key);
        }
    }
    if (force) {
        let guard = 0;
        while (S.dirtyChunks.size && guard++ < 1000)
            S.processDirty(8);
    }
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
