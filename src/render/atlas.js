// NightCraft V15 · native ES module (render/atlas.js); installs into the explicit shared state.
export function install(S) {
S.atlas = S.makeAtlas();

S.blockTile = S.GAME_DATA.blocks.numericTiles;
}
