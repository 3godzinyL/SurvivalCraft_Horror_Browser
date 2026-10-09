import {villageIslandHeight,stampVillageChunk} from './village-worldgen.js';
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
S.torchMounts = new Map();

S.worldSpawn = null;
S.worldgenVersion = 16;

S.renderDistance = 12;

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
    if((S.worldgenVersion||16)>=18){
        const hills=S.fbm2(x*.0067+353,z*.0067-167),foothills=S.clamp((hills-.47)*3.4,0,1);
        h+=foothills*8.5+Math.pow(S.clamp(S.fbm2(x*.0101-117,z*.0101+303)-.59,0,1)*4,1.3)*36;
        // Longer gentle patches contrast with wooded and steep country.
        const glade=S.fbm2(x*.014-813,z*.014+932);
        if(glade>.52&&glade<.62)h-=S.clamp((glade-.52)*15,0,1)*1.6;
    }
    return S.clamp(Math.floor(villageIslandHeight(S,wx,wz,h)), 5, S.WORLD_H - 7);
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
    // V22 wider, connected meadow patches. Sampling at macro frequency makes
    // outcrops and wildlife occur in recognizable clearings, not 1-block dots.
    // Older worldgen versions are deliberately byte-identical.
    if((S.worldgenVersion||16)>=22 && h>S.SEA+5 && h<55 &&
       temp>.32 && temp<.75 && moisture>.41 && moisture<.75){
        const meadowField=S.fbm2(x*.0029+711,z*.0029-491);
        if(meadowField>.535 && meadowField<.725)
            return weird>.65?'flower_meadow':'meadow';
    }
    if((S.worldgenVersion||16)>=18 && h> S.SEA+4 && h<56 && moisture>.49 && moisture<.79){
        const clearing=S.fbm2(x*.0131+425,z*.0131-734);
        if(clearing>.54 && clearing<.635)return weird>.52?'flower_meadow':'meadow';
    }
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
    if((S.worldgenVersion||16)>=18){
        const entrance=2+Math.floor((1-d)*3);
        // Partial diagonal cave entrance rather than a deep vertical pit.
        return Math.min(5,entrance);
    }
    return 3 + Math.floor((1 - d) * 9);
};

// V18 diagonal surface entries: winding ramps connecting the natural caves;
// old worldgen versions never evaluate this branch.
S.caveRampOpen = function caveRampOpen(wx,y,wz,h){
    if((S.worldgenVersion||16)<18)return false;
    const d=h-y;if(d<2||d>19||h<=S.SEA+3)return false;
    const cell=52,cx=S.floorDiv(wx,cell),cz=S.floorDiv(wz,cell);
    if(S.hash2i(cx,cz,S.worldSeed^0xcafe)<.68)return false;
    const px=cx*cell+8+Math.floor(S.hash2i(cx,cz,S.worldSeed^0x91a2)*(cell-16));
    const pz=cz*cell+8+Math.floor(S.hash2i(cx,cz,S.worldSeed^0x72f1)*(cell-16));
    const ux=px+(d-2)*.78,uz=pz+Math.sin((d-2)*.32)*1.6;
    return (wx-ux)**2+(wz-uz)**2 <(d>15?2.7:1.95)**2;
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
    if((S.worldgenVersion||16)>=18){
        // Branching, rising tunnels with room pockets and warped walls.
        const phase=S.hash2i(S.floorDiv(m.centerX,64),S.floorDiv(m.centerZ,64),0xf0b)*6.283;
        const bendX=Math.round(Math.sin(dx*.085+phase)*3.1);
        const bendZ=Math.round(Math.sin(dz*.09-phase)*2.6);
        const pathX=Math.abs(dz-bendX)<=1.5&&Math.abs(dx)<=26;
        const pathZ=Math.abs(dx-bendZ)<=1.5&&Math.abs(dz)<=26;
        const spur=Math.abs(dz-12-Math.sin(dx*.16)*2)<=1&&dx>4&&dx<22;
        const chamber=(dx+10)**2+(dz-10)**2<52||(dx-13)**2+(dz+8)**2<48||dx*dx+dz*dz<37;
        const floor=m.y+Math.round(Math.sin(dx*.12+dz*.09+phase)*1.2);
        const yoff=y-floor;
        if(yoff<0||yoff>4||!(pathX||pathZ||spur||chamber))return 0;
        const broken=S.hash2i(wx,wz,0xdecd)>.983;
        if(broken && yoff<3)return 0;
        const beam=(pathX&&Math.abs(dx)%7===0)||(pathZ&&Math.abs(dz)%7===0);
        if(beam&&yoff===4)return 2;
        if(beam&&yoff<=3 && (pathX?Math.abs(dz-bendX)>1.05:Math.abs(dx-bendZ)>1.05))return 2;
        return 1;
    }
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
        return (S.worldgenVersion || 16) >= 21
            ? (S.hash3i(wx,y,wz,0xD411)<.075 ? S.B.DARKSTONE : S.hash3i(wx,y,wz,0xC0BB)<.68 ? S.B.COBBLE : S.B.STONE)
            : S.B.DARKSTONE;
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

S.RUIN_TYPES = S.GAME_DATA.ruins.types.slice(0,16); // frozen V14 archetypes for old save hashes
S.NEW_RUIN_TYPES = S.GAME_DATA.ruins.types;

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
    const types=(S.worldgenVersion||16)>=17?S.NEW_RUIN_TYPES:S.RUIN_TYPES;
    const type = types[Math.floor(S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a4) * types.length) % types.length];
    return { cellX, cellZ, gx, gz, y, biome, type, rot: Math.floor(S.hash2i(cellX, cellZ, S.worldSeed ^ 0x66a5) * 4) % 4 };
};

// V22 landmark candidates use independent hash cells. They must not read
// loaded chunks and must generate identically in the worker and fallback JS.
S.OUTCROP_CELL=96;
S.WRECK_CELL=144;
S.outcropForCell=function outcropForCell(cx,cz){
    if((S.worldgenVersion||16)<22)return null;
    if(S.hash2i(cx,cz,S.worldSeed^0xE31A)<.36)return null;
    const x=cx*S.OUTCROP_CELL+12+Math.floor(S.hash2i(cx,cz,S.worldSeed^0xE31B)*(S.OUTCROP_CELL-24));
    const z=cz*S.OUTCROP_CELL+12+Math.floor(S.hash2i(cx,cz,S.worldSeed^0xE31C)*(S.OUTCROP_CELL-24));
    const y=S.terrainHeight(x,z),b=S.biomeAt(x,z,y);
    if(!['meadow','flower_meadow','plains','cold_plains'].includes(b)||y<=S.SEA+3||y>76)return null;
    if(Math.max(...[[6,0],[-6,0],[0,6],[0,-6]].map(([dx,dz])=>Math.abs(S.terrainHeight(x+dx,z+dz)-y)))>5)return null;
    const t=S.hash2i(cx,cz,S.worldSeed^0xE31D);
    return {x,z,y,type:t>.90?'gold':t>.52?'iron':'coal',radius:3+Math.floor(S.hash2i(cx,cz,S.worldSeed^0xE31E)*2)};
};
S.wreckForCell=function wreckForCell(cx,cz){
    if((S.worldgenVersion||16)<22)return null;
    if(S.hash2i(cx,cz,S.worldSeed^0xA701)<.20)return null;
    const x=cx*S.WRECK_CELL+14+Math.floor(S.hash2i(cx,cz,S.worldSeed^0xA702)*(S.WRECK_CELL-28));
    const z=cz*S.WRECK_CELL+14+Math.floor(S.hash2i(cx,cz,S.worldSeed^0xA703)*(S.WRECK_CELL-28));
    const h=S.terrainHeight(x,z);
    if(h>S.SEA-2||h<S.SEA-15)return null;
    const rot=Math.floor(S.hash2i(cx,cz,S.worldSeed^0xA704)*4);
    // Prevent stranding on dry land in the forward direction.
    const v=rot%2?[1,0]:[0,1];
    if(S.terrainHeight(x+v[0]*7,z+v[1]*7)>S.SEA+1)return null;
    return {x,z,y:S.SEA-1,rot};
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
                    if (S.caveRampOpen(wx,y,wz,h) || mine === 1)
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
            case 'abandoned_wood_house':
            case 'collapsed_wood_house': {
                // A complete *world-space* structure: cross-chunk walls, broken
                // roof, excavated basement, interior loot and walkable stairs.
                const broken=r.type==='collapsed_wood_house';
                const floor=r.y,hash=(x,y,z)=>S.hash3i(r.gx+x,y,r.gz+z,S.worldSeed^0x17777);
                const putHouse=(x,y,z,id)=>block(x,y-floor,z,id,true,floor);
                // Solid cellar boundary and fully excavated 5-block chamber.
                for(let z=-3;z<=3;z++)for(let x=-4;x<=4;x++){
                    for(let yy=floor-5;yy<=floor;yy++) {
                        const edge=Math.abs(x)===4||Math.abs(z)===3;
                        putHouse(x,yy,z, yy===floor-5?S.B.STONE_BRICKS:edge?S.B.MOSSY_BRICKS:S.B.AIR);
                    }
                    if(Math.abs(x)<=3&&Math.abs(z)<=2)putHouse(x,floor,z,S.B.OLD_PLANKS);
                }
                // A 2-block-wide entrance/shaft and graded stone stair landing.
                for(let k=0;k<5;k++){
                    for(const dx of [0,1]){
                        putHouse(dx,floor-k,-2+k,S.B.AIR);
                        if(k<4)putHouse(dx,floor-k-1,-2+k,S.B.STONE_BRICKS);
                    }
                }
                for(let z=-4;z<=4;z++)for(let x=-5;x<=5;x++){
                    const perimeter=Math.abs(x)===5||Math.abs(z)===4;
                    if(!perimeter)continue;
                    const door=z===-4&&Math.abs(x)<=1;
                    for(let h=0;h<(broken?3:4);h++){
                        if(door&&h<=2)continue;
                        if(hash(x,h,z)>(broken?.63:.82))continue;
                        putHouse(x,floor+h,z,(h===0?S.B.DEADWOOD:(hash(x,h+2,z)>.75?S.B.DARK_PLANKS:S.B.OLD_PLANKS)));
                    }
                }
                for(const [x,z] of [[-5,-4],[5,-4],[-5,4],[5,4]])for(let h=0;h<5;h++)putHouse(x,floor+h,z,S.B.PINEWOOD);
                for(let z=-4;z<=4;z++)for(let x=-5;x<=5;x++){
                    if(hash(x,9,z)<(broken?.54:.21))continue;
                    putHouse(x,floor+5+(Math.abs(x)===5?0:Math.abs(x)>2?1:2),z,
                       hash(x,8,z)>.28?S.B.DARK_PLANKS:S.B.OLD_TILES);
                }
                // Broken floor reveals the cellar and creates a path to descend.
                for(let z=-2;z<=1;z++)for(let x=-1;x<=2;x++)putHouse(x,floor,z,S.B.AIR);
                // Old crate in the basement; deterministic loot is keyed to XYZ.
                putHouse(-2,floor-4,1,S.B.CHEST);
                putHouse(2,floor+1,2,S.B.CHEST);
                for(const [x,z] of [[-4,-2],[4,2]])putHouse(x,floor+1,z,S.B.COBBLE);
                if((S.worldgenVersion||16)>=18){
                    // Larger homestead site; keep the historic basement coordinates.
                    for(let x=-9;x<=9;x++)for(const z of [-8,8]){
                        if(hash(x,13,z)>.36)putHouse(x,floor,z,S.B.DEADWOOD);
                    }
                    for(let z=-7;z<=7;z++)for(const x of [-9,9]){
                        if(hash(x,17,z)>.41)putHouse(x,floor,z,S.B.OLD_PLANKS);
                    }
                    for(let x=-8;x<=8;x++)for(let z=-7;z<=7;z++){
                        if(hash(x,18,z)>.94)putHouse(x,floor,z,S.B.RUBBLE);
                    }
                    for(let x=-8;x<=-3;x++)for(let z=5;z<=7;z++){
                        putHouse(x,floor,z,S.B.OLD_PLANKS);
                        if(x===-8||x===-3||z===5||z===7){
                            if(hash(x,20,z)>.30)putHouse(x,floor+1,z,S.B.DEADWOOD);
                        }
                    }
                }
                break;
            }
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
                if((S.worldgenVersion||16)>=26 && [S.B.RED_FLOWER,S.B.WHITE_FLOWER,S.B.BLUE_FLOWER,S.B.YELLOW_FLOWER].includes(decor) && S.hash2i(wx,wz,S.worldSeed^0x3499)>.18){
                    decor=patch>.64?S.B.FERN:patch>.48?S.B.BUSH:S.B.TALLGRASS;
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
    // V22 surface landmarks: small ore-bearing rocky mounds in broad meadows.
    // The surrounding vegetation is displaced only where the stone lands.
    if((S.worldgenVersion||16)>=22){
        const minx=cx*S.CHUNK-18,maxx=(cx+1)*S.CHUNK+18;
        const minz=cz*S.CHUNK-18,maxz=(cz+1)*S.CHUNK+18;
        const forCells=(size,fn,place)=>{
            for(let iz=S.floorDiv(minz,size);iz<=S.floorDiv(maxz,size);iz++)
                for(let ix=S.floorDiv(minx,size);ix<=S.floorDiv(maxx,size);ix++){
                    const c=fn(ix,iz);if(c&&c.x>=minx&&c.x<=maxx&&c.z>=minz&&c.z<=maxz)place(c);
                }
        };
        forCells(S.OUTCROP_CELL,S.outcropForCell,c=>{
            for(let dz=-c.radius;dz<=c.radius;dz++)for(let dx=-c.radius;dx<=c.radius;dx++){
                const dist=Math.hypot(dx,dz),w=c.x+dx,q=c.z+dz;
                const noise=S.hash2i(w,q,S.worldSeed^0xE342);
                if(dist>c.radius+.2 || noise<(dist/c.radius-.72)*.5)continue;
                const y=S.terrainHeight(w,q),rise=Math.max(1,Math.round(2.8-dist*.52+noise*.8));
                for(let iy=0;iy<rise;iy++){
                    const ore=noise>.65 && (iy===rise-1 || (iy===rise-2 && noise>.91));
                    const stone=noise>.83?S.B.STONE:S.B.COBBLE;
                    putW(w,y+iy,q,ore?(c.type==='gold'?S.B.GOLD:c.type==='iron'?S.B.IRON:S.B.COAL):stone,true);
                }
            }
        });
        // Half-sunken wrecks: hull / broken rails / mast / hold chest. All
        // pieces are world-space, so a chunk seam cannot cut the structure.
        forCells(S.WRECK_CELL,S.wreckForCell,c=>{
            const axis=(dx,dz)=>c.rot===0?[dx,dz]:c.rot===1?[-dz,dx]:c.rot===2?[-dx,-dz]:[dz,-dx];
            const set=(dx,dy,dz,id)=>{const [a,b]=axis(dx,dz);putW(c.x+a,c.y+dy,c.z+b,id,true);};
            const rr=(dx,dy,dz)=>S.hash3i(c.x+dx,c.y+dy,c.z+dz,S.worldSeed^0xA71A);
            for(let z=-8;z<=8;z++)for(let x=-3;x<=3;x++){
                const edge=Math.abs(x)===3;
                if(Math.abs(z)>=7 && Math.abs(x)>1)continue;
                const smashed=(z>3 && rr(x,0,z)>.55)||(z<-4 && rr(x,0,z)>.74);
                if(!smashed){
                    set(x,-1,z,rr(x,-2,z)>.83?S.B.DEADWOOD:S.B.OLD_PLANKS);
                    set(x,0,z,edge?S.B.DARK_PLANKS:(rr(x,2,z)>.27?S.B.OLD_PLANKS:S.B.AIR));
                    if(edge && rr(x,3,z)>.45)set(x,1,z,S.B.DEADWOOD);
                }
            }
            for(const z of [-6,-1,5])for(let x=-3;x<=3;x++)if(rr(x,7,z)>.13)set(x,1,z,S.B.PINEWOOD);
            for(let y=1;y<8;y++){
                if(y>5&&rr(0,y,0)>.52)continue;
                set(0,y,0,S.B.PINEWOOD);
            }
            for(let y=3;y<6;y++)for(let x=-2;x<=2;x++)if((x+y)%3!==0)set(x,y,0,S.B.OLD_PLANKS);
            set(-1,1,-3,S.B.CHEST);
            set(-1,2,-3,S.B.AIR);
            for(let i=0;i<5;i++)set(2,1+i,i-6,S.B.DEADWOOD);
        });
    }
    stampVillageChunk(S,cx,cz,putW);
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
        S.dirtyChunks.add(key);
        // As neighbouring chunks arrive, rebuild seam geometry using real blocks.
        if(S.markDirty){
            S.markDirty(cx-1,cz);S.markDirty(cx+1,cz);
            S.markDirty(cx,cz-1);S.markDirty(cx,cz+1);
        }
    }
    return c;
};
}
