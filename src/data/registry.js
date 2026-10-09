// NightCraft V15 · native ES module (data/registry.js); installs into the explicit shared state.
export function install(S) {
S.B = S.GAME_DATA.blocks.ids;

S.blockDefs = S.GAME_DATA.blocks.definitions;

S.FOLIAGE_BLOCKS = new Set([S.B.LEAVES, S.B.PINELEAVES, S.B.BIRCHLEAVES, S.B.DARKLEAVES, S.B.AUTUMNLEAVES, S.B.WILLOWLEAVES, S.B.POPLARLEAVES, S.B.MIMOSALEAVES]);

S.isFoliage = (id) => S.FOLIAGE_BLOCKS.has(id);
S.BILLBOARD_PLANTS = new Set([S.B.RED_FLOWER,S.B.WHITE_FLOWER,S.B.BLUE_FLOWER,S.B.YELLOW_FLOWER,S.B.MUSHROOM].filter(v=>Number.isInteger(v)));
S.isBillboardPlant = id => S.BILLBOARD_PLANTS.has(id);
S.GRASS_TOP_BLOCKS = new Set([S.B.GRASS,S.B.DRY_GRASS,S.B.FOREST_GRASS,S.B.FROST_GRASS].filter(v=>Number.isInteger(v)));

S.itemDefs = S.GAME_DATA.items;

for (const def of Object.values(S.itemDefs))
    if (def.kind === 'tool' && !def.durability)
        def.durability = def.tier === 'iron' ? 225 : def.tier === 'gold' ? 88 : 105;

S.blockItemById = {};

for (const [id, d] of Object.entries(S.itemDefs))
    if (d.place !== undefined)
        S.blockItemById[d.place] = id;

S.LOG_INGREDIENTS = ['wood', 'pinewood', 'birchwood', 'darkwood', 'willowwood', 'poplarwood', 'mimosawood', 'deadwood'];

S.recipes = S.GAME_DATA.recipes;
}
