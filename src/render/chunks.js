// NightCraft V15 · native ES module (render/chunks.js); installs into the explicit shared state.
export function install(S) {
S.resolvePlayerSpawnCollision = function resolvePlayerSpawnCollision(preferred, maxRadius = 24) {
    let p = [...preferred];
    if (S.spawnPointIsSafe(p))
        return p;
    p = S.findSafeSpawn(preferred[0], preferred[2], maxRadius);
    if (S.spawnPointIsSafe(p))
        return p;
    const x = Math.floor(preferred[0]), z = Math.floor(preferred[2]), y = S.clamp(S.findSurface(x, z), 2, S.WORLD_H - 4);
    p = S.clearSpawnPocket(x, y, z);
    // Absolute final guarantee: if an edited/fortified neighboring shape still overlaps,
    // scan a tiny local lattice for the first collision-free player AABB.
    if (!S.spawnPointIsSafe(p))
        for (let r = 1; r <= 4; r++)
            for (let dz = -r; dz <= r; dz++)
                for (let dx = -r; dx <= r; dx++) {
                    const q = S.findSafeSpawn(x + dx, z + dz, 2);
                    if (S.spawnPointIsSafe(q))
                        return q;
                }
    return p;
};

S.findScenicSpawn = function findScenicSpawn() {
    // Sample a small deterministic set of candidates spread across a wide area.
    // This gives each seed a scenic start without making world creation expensive.
    let best = { x: 0, z: 0, score: -1e9 };
    const preferred = new Set(['forest', 'birch', 'poplar_grove', 'flower_meadow', 'meadow', 'old_growth', 'mist_forest', 'spruce_valley', 'taiga', 'autumn', 'riverlands', 'mountain_forest']);
    const candidates = [[0, 0]];
    for (let i = 0; i < 34; i++) {
        const rx = S.hash2i(i, S.worldSeed & 65535, 0x5ce1), rz = S.hash2i(i, (S.worldSeed >>> 16) & 65535, 0x5ce2);
        candidates.push([Math.round((rx - .5) * 1024 / 8) * 8, Math.round((rz - .5) * 1024 / 8) * 8]);
    }
    for (const [wx, wz] of candidates) {
        const h = S.terrainHeight(wx, wz), b = S.biomeAt(wx, wz, h);
        if (h <= S.SEA + 2 || h > 72 || ['swamp', 'marsh', 'willow_swamp', 'red_barrens', 'barren', 'snow_peaks'].includes(b))
            continue;
        let lo = 999, hi = -999, water = 0, forest = 0, slope = 0;
        for (const [dx, dz] of [[-16, 0], [16, 0], [0, -16], [0, 16], [-12, -12], [12, -12], [-12, 12], [12, 12]]) {
            const hh = S.terrainHeight(wx + dx, wz + dz);
            lo = Math.min(lo, hh);
            hi = Math.max(hi, hh);
            if (hh <= S.SEA + 1)
                water++;
            const bb = S.biomeAt(wx + dx, wz + dz, hh);
            if (preferred.has(bb))
                forest++;
            slope = Math.max(slope, Math.abs(h - hh));
        }
        const relief = hi - lo;
        let score = Math.min(relief, 22) * 2.4 + water * 3.5 + forest * 1.3 + (preferred.has(b) ? 7.5 : 0) - Math.max(0, slope - 15) * 2.2 - Math.abs(h - 36) * .10;
        if (relief < 4)
            score -= 8;
        if (water > 0 && water < 6)
            score += 5.5;
        score += (S.hash2i(wx, wz, S.worldSeed ^ 0x5ce9) - .5) * 3.5;
        if (score > best.score)
            best = { x: wx, z: wz, score };
    }
    return S.findSafeSpawn(best.x, best.z, 6);
};
}
