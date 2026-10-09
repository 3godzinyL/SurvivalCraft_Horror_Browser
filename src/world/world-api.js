// NightCraft V15 · native ES module (world/world-api.js); installs into the explicit shared state.
export function install(S) {
// Non-generating lookup for meshing: the mesher MUST NOT synchronously
// create neighbouring chunks while computing border faces at distance 12.
S.peekLoadedBlock = function peekLoadedBlock(x,y,z) {
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    if(y<0 || y>=S.WORLD_H)return S.B.AIR;
    const cx=S.floorDiv(x,S.CHUNK),cz=S.floorDiv(z,S.CHUNK);
    const c=S.chunks.get(S.chunkKey(cx,cz));
    if(!c)return S.B.AIR;
    return c.data[S.idx3(S.mod(x,S.CHUNK),y,S.mod(z,S.CHUNK))];
};

S.getBlock = function getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= S.WORLD_H)
        return S.B.AIR;
    const cx = S.floorDiv(x, S.CHUNK), cz = S.floorDiv(z, S.CHUNK);
    const c = S.ensureChunk(cx, cz);
    return c.data[S.idx3(S.mod(x, S.CHUNK), y, S.mod(z, S.CHUNK))];
};

S.setBlock = function setBlock(x, y, z, id, record = true) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y <= 0 || y >= S.WORLD_H - 1)
        return false;
    const cx = S.floorDiv(x, S.CHUNK), cz = S.floorDiv(z, S.CHUNK), c = S.ensureChunk(cx, cz);
    c.data[S.idx3(S.mod(x, S.CHUNK), y, S.mod(z, S.CHUNK))] = id;
    if (record)
        S.edits.set(S.editKey(x, y, z), id);
    S.worldLampTimer=0;
    if(S.sunShadow)S.sunShadow.dirty=true;
    S.markDirty(cx, cz);
    if (S.mod(x, S.CHUNK) === 0)
        S.markDirty(cx - 1, cz);
    if (S.mod(x, S.CHUNK) === S.CHUNK - 1)
        S.markDirty(cx + 1, cz);
    if (S.mod(z, S.CHUNK) === 0)
        S.markDirty(cx, cz - 1);
    if (S.mod(z, S.CHUNK) === S.CHUNK - 1)
        S.markDirty(cx, cz + 1);
    const key = S.editKey(x, y, z);
    S.fallenLogDamage?.delete(key);
    if(id!==S.B.TORCH)S.torchMounts?.delete(key);
    if (id !== S.B.FURNACE && S.furnaces.has(key))
        S.furnaces.delete(key);
    if(S.enemyBlockDamage && S.enemyBlockDamage.has(key)) S.enemyBlockDamage.delete(key);
    if (!S.isUpgradeableBlockId(id) && S.fortifications.has(key))
        S.fortifications.delete(key);
    return true;
};

S.markDirty = function markDirty(cx, cz) { const c = S.chunks.get(S.chunkKey(cx, cz)); if (c) {
    c.dirty = true;
    S.dirtyChunks.add(S.chunkKey(cx, cz));
} };

S.faces = [
    { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1]], side: 'side', uv: [[0, 1], [0, 0], [1, 0], [0, 1], [1, 0], [1, 1]] },
    { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 0, 0]], side: 'side', uv: [[0, 1], [0, 0], [1, 0], [0, 1], [1, 0], [1, 1]] },
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 1], [1, 1, 0], [0, 1, 0]], side: 'top', uv: [[0, 1], [1, 1], [1, 0], [0, 1], [1, 0], [0, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 0], [1, 0, 1], [0, 0, 1]], side: 'bottom', uv: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] },
    { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 1, 1], [0, 0, 1]], side: 'side', uv: [[1, 1], [1, 0], [0, 0], [1, 1], [0, 0], [0, 1]] },
    { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 0], [1, 1, 0], [1, 0, 0]], side: 'side', uv: [[0, 1], [0, 0], [1, 0], [0, 1], [1, 0], [1, 1]] }
];

S.faceUV = [[0, 1], [1, 1], [1, 0], [0, 1], [1, 0], [0, 0]];

S.tileUV = function tileUV(tileIndex, u, v) { const col = tileIndex % S.atlas.cols, row = Math.floor(tileIndex / S.atlas.cols);if(S.atlas.gutter){const a=S.atlas;return [(col*a.stride+a.gutter+.5+u*(a.tile-1))/(a.cols*a.stride),(row*a.stride+a.gutter+.5+v*(a.tile-1))/(a.uvRows*a.stride)];}const pad = .03 / S.atlas.tile; return [(col + pad + u * (1 - 2 * pad)) / S.atlas.cols, (row + pad + v * (1 - 2 * pad)) / S.atlas.rows]; };

S.tileFor = function tileFor(id, side) { const t = S.blockTile[id]; if (typeof t === 'number')
    return t; if (t)
    return t[side] ?? t.side; return 3; };
}
