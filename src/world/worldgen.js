// NightCraft V15 · native ES module (world/worldgen.js); installs into the explicit shared state.
export function install(S) {
S.CHUNK = 16;
S.WORLD_H = 96;
S.SEA = 22;

S.chunks = new Map();

S.edits = new Map();

S.dirtyChunks = new Set();

S.fortifications = new Map();

S.furnaces = new Map();

S.worldSpawn = null;

S.renderDistance = 4;

S.chunkKey = (cx, cz) => `${cx},${cz}`;

S.editKey = (x, y, z) => `${x},${y},${z}`;

S.floorDiv = (n, d) => Math.floor(n / d);

S.mod = (n, d) => ((n % d) + d) % d;

S.idx3 = (lx, y, lz) => y * S.CHUNK * S.CHUNK + lz * S.CHUNK + lx;

S.warpedTerrainXZ = function warpedTerrainXZ(wx, wz) {
    // Domain warp keeps ridges, rivers and biome borders from following obvious
    // noise-grid directions. Seed affects every lookup through hash/noise.
    const warpX = (S.fbm2(wx * .00115 + 311, wz * .00115 - 183) - .5) * 230;
    const warpZ = (S.fbm2(wx * .00115 - 147, wz * .00115 + 269) - .5) * 230;
    return [wx + warpX, wz + warpZ];
};

S.terrainHeight = function terrainHeight(wx, wz) {
    // V6 terrain: macro continents + ridged mountain chains + broad valleys,
    // river erosion, cliff shelves and local relief. The fields are intentionally
    // sampled at very different scales so a seed has landmarks rather than a
    // uniform rolling Roblox-like surface.
    const [x, z] = S.warpedTerrainXZ(wx, wz);
    const continent = S.fbm2(x * .00155 - 121, z * .00155 + 88);
    const region = S.fbm2(x * .0030 + 31, z * .0030 - 42);
    const rolling = S.fbm2(x * .0082, z * .0082);
    const local = S.fbm2(x * .021 + 17, z * .021 - 13);
    const micro = S.fbm2(x * .051 - 91, z * .051 + 44);
    const ridge0 = Math.abs(S.fbm2(x * .00465 - 49, z * .00465 + 39) - .5) * 2;
    const ridge1 = Math.abs(S.fbm2(x * .0092 + 219, z * .0092 - 177) - .5) * 2;
    const ridge = Math.pow(S.clamp(1 - ridge0, 0, 1), 2.35) * .72 + Math.pow(S.clamp(1 - ridge1, 0, 1), 2.8) * .28;
    const mountainMask = S.clamp((continent - .43) * 3.8, 0, 1) * S.clamp((region - .34) * 2.1, 0, 1);
    const highlandMask = S.clamp((region - .52) * 3.3, 0, 1);
    const valley = S.fbm2(x * .00215 + 214, z * .00215 - 151);
    const river = Math.abs(S.fbm2(x * .00135 + 487, z * .00135 - 373) - .5) * 2;
    const tributary = Math.abs(S.fbm2(x * .00315 - 222, z * .00315 + 333) - .5) * 2;
    const riverCut = S.clamp((.12 - river) * 110, 0, 15.5) + S.clamp((.057 - tributary) * 105, 0, 6.2);
    const basin = S.fbm2(x * .00082 - 903, z * .00082 + 711);
    const basinCut = S.clamp((.265 - basin) * 38, 0, 12) * S.clamp((.61 - continent) * 4.2, 0, 1);
    const rugged = S.clamp(ridge * mountainMask * 1.8 + highlandMask * .45, 0, 1);
    const relief = (rolling - .5) * (8 + 13 * rugged) + (local - .5) * (4 + 10 * rugged) + (micro - .5) * (1.5 + 3.4 * rugged);
    const mountains = ridge * mountainMask * (34 + region * 24);
    const broad = 13 + continent * 23 + region * 8;
    // cliff shelves only in rugged country: stepped rock faces like old voxel survivals.
    const shelfRaw = S.fbm2(x * .0061 + 61, z * .0061 + 91);
    const shelf = (Math.floor(shelfRaw * 7) / 7 - .5) * (rugged * 7.5);
    const ravineField = Math.abs(S.fbm2(x * .0052 + 812, z * .0052 - 659) - .5) * 2;
    const ravine = S.clamp((.030 - ravineField) * 170, 0, 5.2) * S.clamp((local - .42) * 4, 0, 1);
    let h = broad + relief + mountains + shelf - riverCut - basinCut - ravine - Math.max(0, .34 - valley) * 8.5;
    // Preserve beaches/low wetlands while allowing true high peaks.
    return S.clamp(Math.floor(h), 5, S.WORLD_H - 7);
};

S.biomeAt = function biomeAt(wx, wz, hKnown = null) {
    const [x, z] = S.warpedTerrainXZ(wx, wz);
    const moisture = S.fbm2(x * .0035 + 101, z * .0035 - 83);
    const temp = S.fbm2(x * .0028 - 271, z * .0028 + 221);
    const weird = S.fbm2(x * .0063 + 703, z * .0063 - 513);
    const forestNoise = S.fbm2(x * .0105 + 133, z * .0105 - 211);
    const river = Math.abs(S.fbm2(x * .00185 + 487, z * .00185 - 373) - .5) * 2;
    const h = hKnown == null ? S.terrainHeight(wx, wz) : hKnown;
    if (h <= S.SEA - 2)
        return temp < .30 ? 'frozen_shore' : 'beach';
    if (h <= S.SEA + 1 && moisture > .68)
        return river < .12 ? 'riverlands' : 'wet_shore';
    if (h > 78)
        return temp < .60 ? 'snow_peaks' : 'alpine';
    if (h > 62)
        return moisture > .49 ? 'mountain_forest' : 'highlands';
    if (h > 50 && moisture < .40)
        return 'rocky';
    if (moisture > .82 && h < S.SEA + 10)
        return weird > .50 ? 'willow_swamp' : 'marsh';
    if (moisture > .72 && h < S.SEA + 14)
        return 'swamp';
    if (temp < .22)
        return 'tundra';
    if (temp < .35)
        return moisture > .58 ? 'spruce_valley' : moisture > .45 ? 'taiga' : 'cold_plains';
    if (temp > .78 && moisture < .25)
        return 'red_barrens';
    if (temp > .68 && moisture < .36)
        return 'chaparral';
    if (moisture > .75 && weird > .60)
        return 'mist_forest';
    if (moisture > .69 && forestNoise > .59)
        return 'old_growth';
    if (moisture > .63 && weird > .55)
        return 'darkwood';
    if (moisture > .59)
        return 'forest';
    if (moisture > .53 && weird > .63)
        return 'poplar_grove';
    if (moisture > .50 && weird > .52)
        return 'birch';
    if (moisture > .48 && weird < .34)
        return 'flower_meadow';
    if (moisture > .43)
        return 'meadow';
    if (weird < .23)
        return 'autumn';
    if (moisture < .24)
        return 'barren';
    if (moisture < .31 && forestNoise > .56)
        return 'pine_barrens';
    return 'plains';
};

S.surfaceBlockFor = function surfaceBlockFor(biome, wx = 0, wz = 0) {
    const h = S.terrainHeight(wx, wz);
    if (h <= S.SEA + 6) {
        const nearWater = h <= S.SEA || [[3, 0], [-3, 0], [0, 3], [0, -3], [6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dz]) => S.terrainHeight(wx + dx, wz + dz) <= S.SEA);
        if (nearWater) {
            const r = S.hash2i(wx, wz, 0x505);
            return h <= S.SEA - 3 ? (r < .52 ? S.B.GRAVEL : S.B.SAND) : h <= S.SEA ? (r < .38 ? S.B.GRAVEL : r < .78 ? S.B.SAND : S.B.CLAY) : (r < .52 ? S.B.SAND : r < .82 ? S.B.GRAVEL : S.B.SILT);
        }
    }
    if (biome === 'beach')
        return S.hash2i(wx, wz, 0x505) > .82 ? S.B.SILT : S.B.SAND;
    if (biome === 'red_barrens')
        return S.hash2i(wx, wz, 0x506) > .32 ? S.B.RED_SAND : S.B.DRY_GRASS;
    if (biome === 'chaparral' || biome === 'barren' || biome === 'pine_barrens')
        return S.hash2i(wx, wz, 0x507) > .52 ? S.B.DRY_GRASS : S.B.GRAVEL;
    if (biome === 'wet_shore' || biome === 'riverlands')
        return S.hash2i(wx, wz, 0x508) > .56 ? S.B.SILT : S.B.FOREST_GRASS;
    if (biome === 'frozen_shore')
        return S.B.SNOW;
    if (['willow_swamp', 'swamp', 'marsh'].includes(biome))
        return S.hash2i(wx, wz, 0x607) > .62 ? S.B.PEAT : S.B.MUD;
    if (['tundra', 'snow_peaks'].includes(biome))
        return S.B.SNOW;
    if (['taiga', 'spruce_valley'].includes(biome))
        return S.hash2i(wx, wz, 0x719) > .42 ? S.B.FROST_GRASS : S.B.PODZOL;
    if (['highlands', 'rocky', 'alpine'].includes(biome))
        return S.hash2i(wx, wz, 0x811) > .61 ? S.B.SLATE : S.B.RIVER_ROCK;
    if (['darkwood', 'old_growth', 'mist_forest'].includes(biome))
        return S.hash2i(wx, wz, 0x912) > .42 ? S.B.MOSSY_DIRT : S.B.FOREST_GRASS;
    if (['forest', 'birch', 'poplar_grove', 'autumn'].includes(biome))
        return S.hash2i(wx, wz, 0xa13) > .58 ? S.B.LOAM : S.B.FOREST_GRASS;
    return S.B.GRASS;
};

S.underBlockFor = function underBlockFor(biome, wx = 0, wz = 0) {
    if (biome === 'beach' || biome === 'red_barrens')
        return biome === 'beach' ? S.B.SAND : S.B.RED_SAND;
    if (biome === 'wet_shore' || biome === 'riverlands')
        return S.B.SILT;
    if (['willow_swamp', 'swamp', 'marsh'].includes(biome))
        return S.hash2i(wx, wz, 0xb19) > .70 ? S.B.PEAT : S.B.MUD;
    if (['tundra', 'snow_peaks', 'frozen_shore', 'taiga', 'spruce_valley'].includes(biome))
        return S.B.DIRT;
    if (['highlands', 'rocky', 'alpine'].includes(biome))
        return S.B.SLATE;
    if (['barren', 'chaparral', 'pine_barrens'].includes(biome))
        return S.B.GRAVEL;
    if (['darkwood', 'old_growth', 'mist_forest'].includes(biome))
        return S.B.PODZOL;
    if (['forest', 'birch', 'poplar_grove', 'autumn'].includes(biome))
        return S.B.LOAM;
    return S.B.DIRT;
};

S.caveMouthDepth = function caveMouthDepth(wx, wz, h) {
    // Sparse surface mouths that widen toward the middle of a 52×52 cell.
    // They expose the underground cave noise and make caves discoverable from
    // the surface instead of being sealed below three blocks of soil.
    const cell = 52, cx = S.floorDiv(wx, cell), cz = S.floorDiv(wz, cell);
    if (S.hash2i(cx, cz, S.worldSeed ^ 0xcafe) < .68)
        return 0;
    const px = cx * cell + 8 + Math.floor(S.hash2i(cx, cz, S.worldSeed ^ 0x91a2) * (cell - 16));
    const pz = cz * cell + 8 + Math.floor(S.hash2i(cx, cz, S.worldSeed ^ 0x72f1) * (cell - 16));
    const dx = wx - px, dz = wz - pz, rx = 3.0 + S.hash2i(cx, cz, 0x123) * 3.2, rz = 2.5 + S.hash2i(cx, cz, 0x456) * 2.8;
    const d = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz);
    if (d >= 1 || h <= S.SEA + 3)
        return 0;
    return 3 + Math.floor((1 - d) * 9);
};

S.mineshaftInfo = function mineshaftInfo(wx, wz) {
    const cell = 64, cx = S.floorDiv(wx, cell), cz = S.floorDiv(wz, cell);
    const centerX = cx * cell + 16 + Math.floor(S.hash2i(cx, cz, S.worldSeed ^ 0x6a11) * 32);
    const centerZ = cz * cell + 16 + Math.floor(S.hash2i(cx, cz, S.worldSeed ^ 0x27b4) * 32);
    const y = 7 + Math.floor(S.hash2i(cx, cz, S.worldSeed ^ 0x9e71) * 18);
    const enabled = S.hash2i(cx, cz, S.worldSeed ^ 0x55f0) > .47;
    return { centerX, centerZ, y, enabled };
};

S.mineshaftCell = function mineshaftCell(wx, y, wz) {
    const m = S.mineshaftInfo(wx, wz);
    if (!m.enabled)
        return 0;
    const dx = wx - m.centerX, dz = wz - m.centerZ, dy = y - m.y;
    const corridorX = Math.abs(dz) <= 1 && Math.abs(dx) <= 27 && dy >= 0 && dy <= 3;
    const corridorZ = Math.abs(dx) <= 1 && Math.abs(dz) <= 27 && dy >= 0 && dy <= 3;
    const room = Math.abs(dx) <= 5 && Math.abs(dz) <= 5 && dy >= 0 && dy <= 4;
    if (!(corridorX || corridorZ || room))
        return 0;
    // 1 air, 2 support beam. Supports appear periodically and make the tunnels
    // read as old mine shafts instead of natural caves.
    const supportLine = (Math.abs(dx) % 7 === 0 && corridorX) || (Math.abs(dz) % 7 === 0 && corridorZ);
    if (supportLine && dy === 3)
        return 2;
    if (supportLine && dy <= 2 && ((corridorX && Math.abs(dz) === 1) || (corridorZ && Math.abs(dx) === 1)))
        return 2;
    return 1;
};

S.caveIsOpen = function caveIsOpen(wx, y, wz, h) {
    if (y <= 3 || y >= h - 3)
        return false;
    const c1 = S.noise3(wx * .082, y * .105, wz * .082);
    const c2 = S.noise3(wx * .038 + 14, y * .057 - 8, wz * .038 - 17);
    const c3 = S.noise3(wx * .018 - 31, y * .033 + 11, wz * .018 + 44);
    const cave = c1 * .55 + c2 * .30 + c3 * .15;
    const tunnel = Math.abs(Math.sin(wx * .043 + wz * .021 + y * .065 + S.noise2(wx * .018, wz * .018) * 5.4));
    const threshold = .718 - (y < 12 ? .025 : 0) + (h > 44 ? .012 : 0);
    return cave > threshold || (cave > .655 && tunnel < .075);
};

S.deepRockAt = function deepRockAt(wx, y, wz, biome) {
    const strata = S.noise3(wx * .035, y * .045, wz * .035);
    if (y < 10 && strata > .61)
        return S.B.BASALT;
    if (strata < .18)
        return S.B.LIMESTONE;
    if (strata > .82)
        return S.B.GRANITE;
    if (strata > .66 && y < 26)
        return S.B.DARKSTONE;
    if ((biome === 'highlands' || biome === 'rocky' || biome === 'alpine' || y > 43) && S.hash3i(wx, y, wz, 0x423) > .48)
        return S.B.SLATE;
    if (strata > .46 && strata < .50 && y < 26)
        return S.B.MARBLE;
    if (y > S.SEA - 2 && strata > .54 && strata < .61)
        return S.B.MOSSY_STONE;
    if (y > S.SEA - 5 && strata > .29 && strata < .34)
        return S.B.CAVE_DIRT;
    return S.B.STONE;
};

S.oreAt = function oreAt(wx, y, wz, baseRock) {
    // coherent veins instead of isolated ore pixels
    const coal = S.noise3(wx * .19 + 70, y * .17 - 20, wz * .19 + 11);
    const iron = S.noise3(wx * .22 - 39, y * .20 + 33, wz * .22 - 61);
    const gold = S.noise3(wx * .235 + 91, y * .23 - 47, wz * .235 + 73);
    if (y < 44 && coal > .78 && S.hash3i(wx >> 1, y >> 1, wz >> 1, 0xc011) > .22)
        return S.B.COAL;
    if (y < 22 && gold > .852 && S.hash3i(wx >> 1, y >> 1, wz >> 1, 0x6f1d) > .48)
        return S.B.GOLD;
    if (y < 38 && iron > .805 && S.hash3i(wx >> 1, y >> 1, wz >> 1, 0x1f30) > .31)
        return S.B.IRON;
    return baseRock;
};

S.RUIN_TYPES = S.GAME_DATA.ruins.types;

S.RUIN_CELL = 88;

S.ruinCandidateForCell = function ruinCandidateForCell(cellX, cellZ) {
    const roll = S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a1);
    if (roll < .46)
        return null;
    const gx = cellX * S.RUIN_CELL + 12 + Math.floor(S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a2) * (S.RUIN_CELL - 24));
    const gz = cellZ * S.RUIN_CELL + 12 + Math.floor(S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a3) * (S.RUIN_CELL - 24));
    const y = S.terrainHeight(gx, gz), biome = S.biomeAt(gx, gz, y);
    if (y <= S.SEA + 2 || ['beach', 'wet_shore', 'riverlands', 'swamp', 'marsh', 'willow_swamp', 'snow_peaks'].includes(biome))
        return null;
    let lo = 999, hi = -999;
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]]) {
        const h = S.terrainHeight(gx + dx, gz + dz);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
    }
    if (hi - lo > 7)
        return null;
    const type = S.RUIN_TYPES[Math.floor(S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a4) * S.RUIN_TYPES.length) % S.RUIN_TYPES.length];
    return { cellX, cellZ, gx, gz, y, biome, type, rot: Math.floor(S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a5) * 4) % 4 };
};

S.generateChunkData = function generateChunkData(cx, cz) {
    const data = new Uint8Array(S.CHUNK * S.WORLD_H * S.CHUNK), topCache = new Int16Array(S.CHUNK * S.CHUNK), bioCache = [];
    for (let lz = 0; lz < S.CHUNK; lz++)
        for (let lx = 0; lx < S.CHUNK; lx++) {
            const wx = cx * S.CHUNK + lx, wz = cz * S.CHUNK + lz, h = S.terrainHeight(wx, wz), biome = S.biomeAt(wx, wz, h);
            topCache[lz * S.CHUNK + lx] = h;
            bioCache[lz * S.CHUNK + lx] = biome;
            const soilDepth = 3 + Math.floor(S.hash2i(wx, wz, 0xd17) * 3), mouth = S.caveMouthDepth(wx, wz, h);
            for (let y = 0; y < S.WORLD_H; y++) {
                let id = S.B.AIR;
                if (y === 0)
                    id = S.B.BEDROCK;
                else if (mouth > 0 && y >= h - mouth && y < h)
                    id = S.B.AIR;
                else if (y < h - soilDepth) {
                    const mine = S.mineshaftCell(wx, y, wz);
                    if (mine === 1)
                        id = S.B.AIR;
                    else if (mine === 2)
                        id = S.B.PINEWOOD;
                    else if (S.caveIsOpen(wx, y, wz, h))
                        id = S.B.AIR;
                    else
                        id = S.oreAt(wx, y, wz, S.deepRockAt(wx, y, wz, biome));
                }
                else if (y < h - 1) {
                    if ((biome === 'beach' || biome === 'red_barrens') && y < h - 3)
                        id = S.B.SANDSTONE;
                    else
                        id = S.underBlockFor(biome, wx, wz);
                }
                else if (y === h - 1)
                    id = S.surfaceBlockFor(biome, wx, wz);
                else if (y >= h && y <= S.SEA)
                    id = (biome === 'frozen_shore' && y === S.SEA) ? S.B.ICE : S.B.WATER;
                data[S.idx3(lx, y, lz)] = id;
            }
        }
    const put = (x, y, z, id, overwrite = false) => { if (x >= 0 && x < S.CHUNK && z >= 0 && z < S.CHUNK && y > 0 && y < S.WORLD_H && (overwrite || data[S.idx3(x, y, z)] === S.B.AIR))
        data[S.idx3(x, y, z)] = id; };
    const putW = (wx, y, wz, id, overwrite = true) => { if (S.floorDiv(wx, S.CHUNK) !== cx || S.floorDiv(wz, S.CHUNK) !== cz || y <= 0 || y >= S.WORLD_H)
        return; put(S.mod(wx, S.CHUNK), y, S.mod(wz, S.CHUNK), id, overwrite); };
    const placeRuin = (r) => {
        const rot = (dx, dz) => r.rot === 0 ? [dx, dz] : r.rot === 1 ? [-dz, dx] : r.rot === 2 ? [-dx, -dz] : [dz, -dx];
        const at = (dx, dz) => { const [a, b] = rot(dx, dz); return [r.gx + a, r.gz + b]; };
        const gy = (dx, dz) => { const [x, z] = at(dx, dz); return S.terrainHeight(x, z); };
        const block = (dx, dy, dz, id, overwrite = true, baseOverride = null) => { const [x, z] = at(dx, dz), base = baseOverride == null ? gy(dx, dz) : baseOverride; putW(x, base + dy, z, id, overwrite); };
        const col = (dx, dz, h, id, holes = 0) => { const base = gy(dx, dz); for (let yy = 0; yy < h; yy++)
            if (!holes || S.hash3i(r.gx + dx, yy, r.gz + dz, S.worldSeed ^ 0x6b11) > holes)
                block(dx, yy, dz, id, true, base); };
        const floorRect = (x0, x1, z0, z1, id, skip = .0) => { for (let dz = z0; dz <= z1; dz++)
            for (let dx = x0; dx <= x1; dx++)
                if (!skip || S.hash3i(r.gx + dx, 0, r.gz + dz, S.worldSeed ^ 0x6b12) > skip)
                    block(dx, 0, dz, id, true); };
        const wallRect = (rx, rz, h, id, gap = .15) => { for (let dz = -rz; dz <= rz; dz++)
            for (let dx = -rx; dx <= rx; dx++) {
                if (Math.abs(dx) !== rx && Math.abs(dz) !== rz)
                    continue;
                if (dz === -rz && Math.abs(dx) <= 1)
                    continue;
                col(dx, dz, h - (S.hash3i(r.gx + dx, 1, r.gz + dz, 0x6b13) > .72 ? 1 : 0), id, gap);
            } };
        switch (r.type) {
            case 'crumbled_tower': {
                floorRect(-4, 4, -4, 4, S.B.RUBBLE, .36);
                wallRect(4, 4, 5, S.B.WEATHERED_BRICKS, .22);
                for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]])
                    col(dx, dz, 7, S.B.STONE_BRICKS, .12);
                block(0, 0, 0, S.B.RUNE_STONE, true);
                break;
            }
            case 'broken_cottage': {
                floorRect(-4, 4, -3, 3, S.B.OLD_PLANKS, .18);
                for (let dx = -4; dx <= 4; dx++) {
                    if (Math.abs(dx) > 1)
                        col(dx, -3, 3, S.B.WEATHERED_BRICKS, .08);
                    if (S.hash2i(dx, r.cellZ, 0x6b14) > .2)
                        col(dx, 3, 2, S.B.MOSSY_BRICKS, .15);
                }
                for (let dz = -2; dz <= 2; dz++) {
                    col(-4, dz, 2, S.B.CRACKED_BRICKS, .12);
                    col(4, dz, 3, S.B.CRACKED_BRICKS, .18);
                }
                for (let dx = -3; dx <= 3; dx++)
                    if (Math.abs(dx) % 2 === 1)
                        block(dx, 3, -1, S.B.OLD_TILES, true);
                break;
            }
            case 'stone_arch': {
                for (const dx of [-3, 3])
                    col(dx, 0, 6, S.B.STONE_BRICKS, .04);
                for (let dx = -3; dx <= 3; dx++)
                    block(dx, 5, 0, S.hash2i(dx, r.gx, 0x6b15) > .22 ? S.B.CHISELED_STONE : S.B.CRACKED_BRICKS, true);
                for (const dx of [-4, 4])
                    col(dx, 0, 2, S.B.RUBBLE, .25);
                break;
            }
            case 'graveyard': {
                for (let dz = -5; dz <= 5; dz += 5)
                    for (let dx = -4; dx <= 4; dx += 2) {
                        if (dx === 0 && dz === -5)
                            continue;
                        block(dx, 0, dz, S.B.GRAVE_STONE, true);
                        if (S.hash3i(dx, 0, dz, S.worldSeed ^ 0x6b16) > .38)
                            block(dx, 1, dz, S.B.GRAVE_STONE, true);
                    }
                for (let x = -6; x <= 6; x++)
                    if (Math.abs(x) > 1)
                        block(x, 0, -6, S.B.MOSSY_BRICKS, true);
                for (let z = -6; z <= 6; z++) {
                    block(-6, 0, z, S.B.MOSSY_BRICKS, true);
                    block(6, 0, z, S.B.MOSSY_BRICKS, true);
                }
                break;
            }
            case 'stone_circle': {
                for (let i = 0; i < 12; i++) {
                    const a = i / 12 * Math.PI * 2, dx = Math.round(Math.cos(a) * 5), dz = Math.round(Math.sin(a) * 5);
                    col(dx, dz, 2 + (i % 3 === 0 ? 1 : 0), i % 2 ? S.B.RUNE_STONE : S.B.CHISELED_STONE, .06);
                }
                block(0, 0, 0, S.B.RUNE_STONE, true);
                break;
            }
            case 'roadside_shrine': {
                floorRect(-2, 2, -2, 2, S.B.STONE_BRICKS, .1);
                for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]])
                    col(dx, dz, 4, S.B.CHISELED_STONE, .05);
                block(0, 1, 0, S.B.RUNE_STONE, true);
                for (let dx = -2; dx <= 2; dx++)
                    block(dx, 4, 0, S.B.OLD_TILES, true);
                break;
            }
            case 'watchpost': {
                floorRect(-3, 3, -3, 3, S.B.OLD_PLANKS, .24);
                for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]])
                    col(dx, dz, 7, S.B.OLD_PLANKS, .06);
                for (let dx = -3; dx <= 3; dx++) {
                    block(dx, 5, -3, S.B.DARK_PLANKS, true);
                    block(dx, 5, 3, S.B.DARK_PLANKS, true);
                }
                for (let dz = -2; dz <= 2; dz++) {
                    block(-3, 5, dz, S.B.DARK_PLANKS, true);
                    block(3, 5, dz, S.B.DARK_PLANKS, true);
                }
                break;
            }
            case 'collapsed_hall': {
                floorRect(-6, 6, -3, 3, S.B.WEATHERED_BRICKS, .28);
                for (let dx = -6; dx <= 6; dx++) {
                    if (Math.abs(dx) > 1)
                        col(dx, -3, 2 + (Math.abs(dx) % 3 === 0 ? 2 : 0), S.B.CRACKED_BRICKS, .22);
                }
                for (let dz = -2; dz <= 2; dz++)
                    if (Math.abs(dz) % 2 === 0) {
                        col(-6, dz, 3, S.B.MOSSY_BRICKS, .18);
                        col(6, dz, 2, S.B.MOSSY_BRICKS, .25);
                    }
                break;
            }
            case 'cellar_mouth': {
                floorRect(-3, 3, -3, 3, S.B.STONE_BRICKS, .0);
                for (let dz = -1; dz <= 1; dz++)
                    for (let dx = -1; dx <= 1; dx++) {
                        const [x, z] = at(dx, dz), base = gy(0, 0);
                        for (let yy = -1; yy >= -5; yy--)
                            putW(x, base + yy, z, S.B.AIR, true);
                    }
                for (let k = 0; k < 5; k++) {
                    const [x, z] = at(0, -1 - k % 2);
                    putW(x, gy(0, 0) - k, z, S.B.OLD_PLANKS, true);
                }
                break;
            }
            case 'broken_wall': {
                for (let dx = -8; dx <= 8; dx++) {
                    const h = 1 + Math.floor(S.hash2i(r.gx + dx, r.gz, 0x6b17) * 4);
                    if (S.hash2i(dx, r.cellX, 0x6b18) > .14)
                        col(dx, 0, h, dx % 4 === 0 ? S.B.MOSSY_BRICKS : S.B.WEATHERED_BRICKS, .08);
                }
                break;
            }
            case 'ash_camp': {
                floorRect(-5, 5, -5, 5, S.B.ASH_BLOCK, .38);
                for (const [dx, dz] of [[-3, -2], [2, -3], [3, 2], [-2, 3]]) {
                    block(dx, 0, dz, S.B.OLD_PLANKS, true);
                    block(dx + 1, 0, dz, S.B.OLD_PLANKS, true);
                }
                block(0, 0, 0, S.B.RUBBLE, true);
                block(1, 0, 0, S.B.RUBBLE, true);
                break;
            }
            case 'rune_altar': {
                floorRect(-4, 4, -4, 4, S.B.MOSSY_BRICKS, .18);
                for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4]])
                    col(dx, dz, 4, S.B.RUNE_STONE, .04);
                block(0, 0, 0, S.B.CHISELED_STONE, true);
                block(0, 1, 0, S.B.RUNE_STONE, true);
                break;
            }
            case 'old_well': {
                for (let dz = -2; dz <= 2; dz++)
                    for (let dx = -2; dx <= 2; dx++) {
                        if (Math.max(Math.abs(dx), Math.abs(dz)) === 2)
                            block(dx, 0, dz, S.B.STONE_BRICKS, true);
                    }
                for (const dx of [-2, 2]) {
                    col(dx, 0, 4, S.B.OLD_PLANKS, .0);
                    block(dx, 4, 0, S.B.DARK_PLANKS, true);
                }
                for (let dx = -2; dx <= 2; dx++)
                    block(dx, 4, 0, S.B.OLD_TILES, true);
                break;
            }
            case 'gatehouse': {
                for (const dx of [-5, -4, 4, 5])
                    for (let dz = -2; dz <= 2; dz++)
                        col(dx, dz, 4, S.B.WEATHERED_BRICKS, .06);
                for (let dx = -5; dx <= 5; dx++)
                    if (Math.abs(dx) > 1)
                        block(dx, 4, 0, S.B.CRACKED_BRICKS, true);
                for (const dx of [-5, 5])
                    col(dx, 0, 7, S.B.CHISELED_STONE, .06);
                break;
            }
            case 'buried_temple': {
                floorRect(-5, 5, -5, 5, S.B.STONE_BRICKS, .08);
                for (let i = -4; i <= 4; i += 2) {
                    col(-5, i, 3, S.B.MOSSY_BRICKS, .12);
                    col(5, i, 3, S.B.MOSSY_BRICKS, .12);
                }
                for (let i = -3; i <= 3; i++) {
                    block(i, 0, -5, S.B.RUNE_STONE, true);
                    if (Math.abs(i) > 1)
                        block(i, 1, -5, S.B.RUNE_STONE, true);
                }
                for (let dx = -2; dx <= 2; dx++)
                    for (let dz = -2; dz <= 2; dz++)
                        if (Math.abs(dx) + Math.abs(dz) <= 2)
                            block(dx, 1, dz, S.B.CHISELED_STONE, true);
                break;
            }
            case 'fallen_monument': {
                floorRect(-3, 3, -3, 3, S.B.RUBBLE, .30);
                for (let i = -4; i <= 4; i++) {
                    block(i, 0, 0, i % 3 === 0 ? S.B.RUNE_STONE : S.B.GRAVE_STONE, true);
                    if (i > -2 && i < 3)
                        block(i, 1, 0, S.B.GRAVE_STONE, true);
                }
                col(-4, 0, 2, S.B.CHISELED_STONE, .0);
                col(4, 0, 3, S.B.CHISELED_STONE, .0);
                break;
            }
        }
        // One chest in selected ruins, consistent across chunk boundaries and reloads.
        if (!['broken_wall', 'stone_arch', 'gatehouse', 'fallen_monument'].includes(r.type)) {
            const dx = 2, dz = 1, [bx, bz] = at(dx, dz), by = gy(dx, dz);
            if (by > S.SEA + 1) {
                putW(bx, by, bz, S.B.CHEST, true);
                putW(bx, by + 1, bz, S.B.AIR, true);
            }
        }
    };
    const leafBlob = (lx, h, lz, leaf, wx, wz, wide = 2, tall = 2) => {
        for (let dy = -tall; dy <= tall; dy++)
            for (let dz = -wide; dz <= wide; dz++)
                for (let dx = -wide; dx <= wide; dx++) {
                    const d = Math.sqrt(dx * dx + dz * dz + (dy * 1.15) * (dy * 1.15));
                    if (d <= wide + .72 && S.hash3i(wx + dx, h + dy, wz + dz, S.worldSeed ^ 0x111) > .065)
                        put(lx + dx, h + dy, lz + dz, leaf);
                }
    };
    const branch = (lx, y, lz, dx, dz, len, wood) => { for (let i = 1; i <= len; i++)
        put(lx + dx * i, y + (i === len ? 1 : 0), lz + dz * i, wood); };
    // Trees are evaluated in a 4-block halo around the chunk. This is important:
    // canopies and branches now continue across chunk borders instead of leaving
    // obvious empty 6-block grid lines between forests.
    for (let lz = -4; lz < S.CHUNK + 4; lz++)
        for (let lx = -4; lx < S.CHUNK + 4; lx++) {
            const wx = cx * S.CHUNK + lx, wz = cz * S.CHUNK + lz, h = S.terrainHeight(wx, wz), biome = S.biomeAt(wx, wz, h), roll = S.hash2i(wx, wz, S.worldSeed ^ 0x55aa);
            const grove = .45 + .95 * S.fbm2(wx * .021 + 19, wz * .021 - 31);
            let chance = { forest: .078, old_growth: .105, mist_forest: .112, darkwood: .094, birch: .073, poplar_grove: .080, taiga: .086, spruce_valley: .118, mountain_forest: .062, autumn: .066, willow_swamp: .070, swamp: .046, marsh: .020, flower_meadow: .012, meadow: .014, plains: .010, cold_plains: .012, pine_barrens: .049, chaparral: .033, barren: .003, tundra: .004 }[biome] ?? .005;
            chance *= grove;
            if (h <= S.SEA + 1 || roll >= chance || S.caveMouthDepth(wx, wz, h) > 0)
                continue;
            if (['taiga', 'spruce_valley', 'tundra', 'snow_peaks', 'mountain_forest', 'pine_barrens'].includes(biome)) {
                const tall = (biome === 'spruce_valley' && S.hash2i(wx, wz, 0x711) > .40) || (biome === 'old_growth' && S.hash2i(wx, wz, 0x712) > .82);
                const giant = tall && S.hash2i(wx, wz, 0x713) > .72;
                const th = (giant ? 20 : tall ? 13 : 8) + Math.floor(S.hash2i(wx, wz, S.worldSeed ^ 0x9911) * (giant ? 8 : tall ? 7 : 6));
                for (let y = h; y < Math.min(S.WORLD_H - 2, h + th); y++)
                    put(lx, y, lz, S.B.PINEWOOD);
                const top = h + th - 1;
                for (let dy = -(giant ? 12 : tall ? 8 : 6); dy <= 0; dy++) {
                    const rad = Math.max(1, Math.floor((1 - dy) * (giant ? .29 : tall ? .34 : .42)));
                    for (let dz = -rad; dz <= rad; dz++)
                        for (let dx = -rad; dx <= rad; dx++)
                            if (Math.abs(dx) + Math.abs(dz) <= rad + 1 && S.hash3i(wx + dx, top + dy, wz + dz, 0x822) > .10)
                                put(lx + dx, top + dy, lz + dz, S.B.PINELEAVES);
                }
            }
            else if (biome === 'birch') {
                const th = 6 + Math.floor(S.hash2i(wx, wz, 0x514) * 5);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.BIRCHWOOD);
                if (th > 7)
                    branch(lx, h + th - 3, lz, 1, 0, 1, S.B.BIRCHWOOD);
                leafBlob(lx, h + th - 1, lz, S.B.BIRCHLEAVES, wx, wz, 2, 2);
            }
            else if (biome === 'poplar_grove' || biome === 'riverlands') {
                const th = 9 + Math.floor(S.hash2i(wx, wz, 0x625) * 6);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.POPLARWOOD);
                for (let dy = -4; dy <= 2; dy++) {
                    const rad = dy > 0 ? 1 : 2;
                    for (let dz = -rad; dz <= rad; dz++)
                        for (let dx = -rad; dx <= rad; dx++)
                            if (Math.abs(dx) + Math.abs(dz) <= rad + 1 && S.hash3i(wx + dx, h + th + dy - 2, wz + dz, 0x626) > .12)
                                put(lx + dx, h + th + dy - 2, lz + dz, S.B.POPLARLEAVES);
                }
            }
            else if (biome === 'chaparral') {
                const th = 4 + Math.floor(S.hash2i(wx, wz, 0x631) * 3);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.MIMOSAWOOD);
                branch(lx, h + th - 2, lz, 1, 0, 2, S.B.MIMOSAWOOD);
                branch(lx, h + th - 2, lz, -1, 0, 2, S.B.MIMOSAWOOD);
                leafBlob(lx, h + th - 1, lz, S.B.MIMOSALEAVES, wx, wz, 3, 1);
            }
            else if (['darkwood', 'old_growth', 'mist_forest'].includes(biome)) {
                const huge = biome === 'old_growth' || biome === 'mist_forest';
                const th = (huge ? 9 : 6) + Math.floor(S.hash2i(wx, wz, 0x918) * 6);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.DARKWOOD);
                if (th > 8) {
                    branch(lx, h + th - 4, lz, 1, 0, 2, S.B.DARKWOOD);
                    branch(lx, h + th - 5, lz, 0, -1, 2, S.B.DARKWOOD);
                    if (huge)
                        branch(lx, h + th - 6, lz, -1, 1, 2, S.B.DARKWOOD);
                }
                leafBlob(lx, h + th - 1, lz, S.B.DARKLEAVES, wx, wz, huge ? 4 : 3, 3);
            }
            else if (biome === 'willow_swamp') {
                const th = 5 + Math.floor(S.hash2i(wx, wz, 0x271) * 3);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.WILLOWWOOD);
                leafBlob(lx, h + th - 1, lz, S.B.WILLOWLEAVES, wx, wz, 3, 2);
                for (let dz = -3; dz <= 3; dz++)
                    for (let dx = -3; dx <= 3; dx++)
                        if (Math.abs(dx) + Math.abs(dz) > 2 && S.hash3i(wx + dx, h, wz + dz, 0x761) > .7)
                            for (let q = 0; q < 2; q++)
                                put(lx + dx, h + th - 2 - q, lz + dz, S.B.WILLOWLEAVES);
            }
            else if (biome === 'autumn') {
                const th = 5 + Math.floor(S.hash2i(wx, wz, 0x515) * 4);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.WOOD);
                leafBlob(lx, h + th - 1, lz, S.B.AUTUMNLEAVES, wx, wz, 3, 2);
            }
            else if (biome === 'barren') {
                const th = 3 + Math.floor(S.hash2i(wx, wz, 0x818) * 4);
                for (let y = h; y < h + th; y++)
                    put(lx, y, lz, S.B.DEADWOOD);
                if (S.hash2i(wx, wz, 0x199) > .5)
                    put(lx + 1, h + th - 2, lz, S.B.DEADWOOD);
            }
            else {
                const swampy = biome === 'swamp' || biome === 'marsh', trunk = swampy ? S.B.DEADWOOD : S.B.WOOD, leaf = swampy ? S.B.DARKLEAVES : S.B.LEAVES;
                const th = 5 + Math.floor(S.hash2i(wx, wz, S.worldSeed ^ 0x9911) * 5);
                for (let y = h; y < Math.min(S.WORLD_H - 2, h + th); y++)
                    put(lx, y, lz, trunk);
                if (th > 7 && S.hash2i(wx, wz, 0x181) > .45) {
                    branch(lx, h + th - 3, lz, 1, 0, 1, trunk);
                    branch(lx, h + th - 4, lz, 0, 1, 1, trunk);
                }
                leafBlob(lx, h + th - 1, lz, leaf, wx, wz, biome === 'forest' ? 3 : 2, 2);
            }
        }
    // Dense but clustered undergrowth; flowers form patches instead of a uniform
    // distribution so a random seed can look like the lush screenshots.
    for (let lz = 1; lz < S.CHUNK - 1; lz++)
        for (let lx = 1; lx < S.CHUNK - 1; lx++) {
            const wx = cx * S.CHUNK + lx, wz = cz * S.CHUNK + lz, h = topCache[lz * S.CHUNK + lx], biome = bioCache[lz * S.CHUNK + lx], r = S.hash2i(wx, wz, S.worldSeed ^ 0x77), patch = S.fbm2(wx * .075 + 7, wz * .075 - 13), above = S.idx3(lx, h, lz);
            if (h <= S.SEA + 1 || !S.blockDefs[data[S.idx3(lx, Math.max(1, h - 1), lz)]]?.solid)
                continue;
            const empty = data[above] === S.B.AIR;
            if (empty) {
                let decor = S.B.AIR;
                if (['forest', 'birch', 'poplar_grove', 'darkwood', 'old_growth', 'mist_forest', 'autumn', 'mountain_forest'].includes(biome)) {
                    if (r < .13 + .09 * patch)
                        decor = S.B.TALLGRASS;
                    else if (r < .21 + .06 * patch)
                        decor = S.B.FERN;
                    else if (r < .245 && patch > .58)
                        decor = S.B.BUSH;
                    else if (r > .982)
                        decor = S.B.MUSHROOM;
                    else if (r > .955 && patch > .58)
                        decor = S.B.BLUE_FLOWER;
                }
                else if (biome === 'flower_meadow') {
                    if (r < .25)
                        decor = S.B.TALLGRASS;
                    else if (r < .315)
                        decor = S.B.RED_FLOWER;
                    else if (r < .38)
                        decor = S.B.WHITE_FLOWER;
                    else if (r < .445)
                        decor = S.B.BLUE_FLOWER;
                    else if (r < .51)
                        decor = S.B.YELLOW_FLOWER;
                }
                else if (biome === 'meadow' || biome === 'riverlands') {
                    if (r < .20)
                        decor = S.B.TALLGRASS;
                    else if (r < .235)
                        decor = S.B.RED_FLOWER;
                    else if (r < .27)
                        decor = S.B.WHITE_FLOWER;
                    else if (r < .305)
                        decor = S.B.YELLOW_FLOWER;
                    else if (r < .33)
                        decor = S.B.BUSH;
                }
                else if (['plains', 'cold_plains'].includes(biome)) {
                    if (r < .15)
                        decor = S.B.TALLGRASS;
                    else if (r > .982)
                        decor = S.B.WHITE_FLOWER;
                    else if (r > .958 && patch > .62)
                        decor = S.B.HEATHER;
                    else if (r < .175 && patch > .68)
                        decor = S.B.BUSH;
                }
                else if (['willow_swamp', 'swamp', 'marsh'].includes(biome)) {
                    if (r < .18)
                        decor = S.B.FERN;
                    else if (r < .29 && h <= S.SEA + 4)
                        decor = S.B.REEDS;
                    else if (r < .33)
                        decor = S.B.BUSH;
                    else if (r > .975)
                        decor = S.B.MUSHROOM;
                }
                else if (['taiga', 'spruce_valley', 'tundra', 'pine_barrens'].includes(biome)) {
                    if (r < .09)
                        decor = S.B.FERN;
                    else if (r > .968)
                        decor = S.B.HEATHER;
                    else if (r < .12 && patch > .63)
                        decor = S.B.BUSH;
                }
                else if (['chaparral', 'barren', 'red_barrens'].includes(biome)) {
                    if (r < .07)
                        decor = S.B.DRY_BUSH;
                }
                if (decor !== S.B.AIR)
                    data[above] = decor;
            }
            if (r > .978 && r < .989 && data[above] === S.B.AIR)
                data[above] = ['highlands', 'rocky', 'snow_peaks', 'alpine'].includes(biome) ? S.B.DARKSTONE : S.B.GRAVEL;
            if (['beach', 'wet_shore'].includes(biome) && S.hash2i(wx, wz, 0x313) > .985 && h < S.SEA + 2)
                data[S.idx3(lx, Math.max(1, h - 2), lz)] = S.B.CLAY;
            if (biome === 'frozen_shore' && h <= S.SEA + 1) {
                for (let yy = h; yy <= S.SEA; yy++)
                    if (data[S.idx3(lx, yy, lz)] === S.B.WATER)
                        data[S.idx3(lx, yy, lz)] = S.B.ICE;
            }
        }
    // Micro-features: boulders, fallen logs, pumpkins and cacti make traversal
    // visually busy without turning every surface block into decoration.
    for (let lz = 2; lz < S.CHUNK - 2; lz++)
        for (let lx = 2; lx < S.CHUNK - 2; lx++) {
            const wx = cx * S.CHUNK + lx, wz = cz * S.CHUNK + lz, h = topCache[lz * S.CHUNK + lx], biome = bioCache[lz * S.CHUNK + lx], r = S.hash2i(wx, wz, S.worldSeed ^ 0x4f33);
            if (data[S.idx3(lx, h, lz)] !== S.B.AIR || !S.blockDefs[data[S.idx3(lx, Math.max(1, h - 1), lz)]]?.solid)
                continue;
            if (r > .994 && ['forest', 'old_growth', 'mist_forest', 'taiga', 'spruce_valley', 'highlands', 'rocky'].includes(biome)) {
                const rock = biome === 'highlands' || biome === 'rocky' ? S.B.RIVER_ROCK : S.B.MOSSY_STONE;
                put(lx, h, lz, rock);
                if (S.hash2i(wx, wz, 0x4f34) > .56)
                    put(lx + 1, h, lz, rock);
                if (S.hash2i(wx, wz, 0x4f35) > .63)
                    put(lx, h + 1, lz, rock);
            }
            else if (r > .988 && r <= .994 && ['forest', 'old_growth', 'mist_forest', 'darkwood', 'taiga', 'spruce_valley'].includes(biome)) {
                const axis = S.hash2i(wx, wz, 0x4f36) > .5;
                const wood = ['taiga', 'spruce_valley'].includes(biome) ? S.B.PINEWOOD : S.B.DEADWOOD;
                for (let i = -1; i <= 2; i++)
                    put(lx + (axis ? i : 0), h, lz + (axis ? 0 : i), wood);
            }
            else if (r > .985 && r <= .988 && ['forest', 'meadow', 'flower_meadow', 'plains'].includes(biome))
                put(lx, h, lz, S.B.PUMPKIN);
            else if (r > .986 && ['red_barrens', 'chaparral'].includes(biome)) {
                const ch = 2 + Math.floor(S.hash2i(wx, wz, 0x4f37) * 3);
                for (let yy = 0; yy < ch; yy++)
                    put(lx, h + yy, lz, S.B.CACTUS);
            }
        }
    // V7 landmark pass: sixteen deterministic ruin archetypes. Each structure
    // is generated from world-space coordinates, so it can cross chunk borders
    // without being chopped at chunk seams.
    const chunkMinX = cx * S.CHUNK - 18, chunkMaxX = (cx + 1) * S.CHUNK + 18, chunkMinZ = cz * S.CHUNK - 18, chunkMaxZ = (cz + 1) * S.CHUNK + 18;
    const c0x = S.floorDiv(chunkMinX, S.RUIN_CELL), c1x = S.floorDiv(chunkMaxX, S.RUIN_CELL), c0z = S.floorDiv(chunkMinZ, S.RUIN_CELL), c1z = S.floorDiv(chunkMaxZ, S.RUIN_CELL);
    for (let rzCell = c0z; rzCell <= c1z; rzCell++)
        for (let rxCell = c0x; rxCell <= c1x; rxCell++) {
            const ruin = S.ruinCandidateForCell(rxCell, rzCell);
            if (!ruin)
                continue;
            if (ruin.gx < chunkMinX || ruin.gx > chunkMaxX || ruin.gz < chunkMinZ || ruin.gz > chunkMaxZ)
                continue;
            placeRuin(ruin);
        }
    for (const [key, val] of S.edits) {
        const [x, y, z] = key.split(',').map(Number);
        if (S.floorDiv(x, S.CHUNK) === cx && S.floorDiv(z, S.CHUNK) === cz && y >= 0 && y < S.WORLD_H)
            data[S.idx3(S.mod(x, S.CHUNK), y, S.mod(z, S.CHUNK))] = val;
    }
    return data;
};

S.ensureChunk = function ensureChunk(cx, cz) {
    const key = S.chunkKey(cx, cz);
    let c = S.chunks.get(key);
    if (!c) {
        c = { cx, cz, data: S.generateChunkData(cx, cz), opaque: null, water: null, dirty: true };
        S.chunks.set(key, c);
    }
    return c;
};
}
