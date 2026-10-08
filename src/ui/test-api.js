// NightCraft V15 · native ES module (ui/test-api.js); installs into the explicit shared state.
export function install(S) {
// Read-only hook used by the local smoke/integration harness.
window.__NIGHTCRAFT_TEST__ = {
    version: 19,
    B: S.B,
    terrainHeight: S.terrainHeight,
    biomeAt: S.biomeAt,
    caveMouthDepth: S.caveMouthDepth,
    mineshaftInfo: S.mineshaftInfo,
    mineshaftCell: S.mineshaftCell,
    ruinTypes: S.RUIN_TYPES,
    ruinCandidateForCell: S.ruinCandidateForCell,
    blockDefs: S.blockDefs,
    itemDefs: S.itemDefs,
    recipes: S.recipes,
    enemyDefs: S.enemyDefs,
    birdDefs: S.birdDefs,
    equippedPowerFor: S.equippedPowerFor,
    miningSecondsFor: S.miningSecondsFor,
    getBlock: S.getBlock,
    setBlock: S.setBlock,
    spawnPointIsSafe: S.spawnPointIsSafe,
    findSafeSpawn: S.findSafeSpawn,
    resolvePlayerSpawnCollision: S.resolvePlayerSpawnCollision,
    playerGroundedAt: S.playerGroundedAt,
    soundMaterialForBlock: S.soundMaterialForBlock,
    footstepMaterialForTest: S.footstepMaterial, matchingCraftRecipeForTest: S.matchingCraftRecipe, takeCraftOutputForTest: S.takeCraftOutput, setCraftSlotsForTest: slots => { S.player.craftSlots = slots.slice(0, 9).map(S.normalizeStack); while (S.player.craftSlots.length < 9)
        S.player.craftSlots.push(null); S.refreshInventoryUI(); }, breakBlockForTest: (x, y, z) => S.breakBlockByPlayer({ x, y, z, id: S.getBlock(x, y, z) }), spawnItemDropForTest: S.spawnItemDrop, updateDroppedItemsForTest: S.updateDroppedItems, openStarterChestForTest: S.openStarterChest, openFurnaceForTest: (x, y, z) => S.openFurnace({ x, y, z, id: S.B.FURNACE }), setFurnaceStateForTest: (x, y, z, state) => { S.setBlock(x, y, z, S.B.FURNACE); const key = S.fortKey(x, y, z); S.furnaces.set(key, { input: null, fuel: null, output: null, burn: 0, burnMax: 0, progress: 0, ...state }); return S.furnaces.get(key); }, getFurnaceForTest: (x, y, z) => S.furnaces.get(S.fortKey(x, y, z)) || null, updateFurnacesForTest: S.updateFurnaces, respawnForTest: S.respawn, setPlayerPosForTest: p => { S.player.pos = [...p]; }, nudgePlayerForTest: (dx, dz) => { S.movePlayerAxis(0, dx); S.movePlayerAxis(2, dz); return [...S.player.pos]; }, openInventoryForTest: S.openInventory, openFullMapForTest: S.openFullMap, constructionCollisionBoxesForTest: S.constructionCollisionBoxes,
    ensureFortification: S.ensureFortification,
    damageFortification: S.damageFortification,
    FORT_TIERS: S.FORT_TIERS,
    SMELT_RECIPES: S.SMELT_RECIPES,
    currentWorldHourForTest: S.currentWorldHour, currentNightNumberForTest: S.currentNightNumber, playerLevelForTest: S.playerLevel, grantXPForTest: S.grantXP, activateXrayForTest: S.activateXray, generateRuinChestLootForTest: S.generateRuinChestLoot, openWorldChestForTest: S.openWorldChest, sleepAtBedrollForTest: S.sleepAtBedroll, previewInventoryFootprintsForTest: S.previewInventoryFootprints, validInventoryFootprintsForTest: S.validInventoryFootprints, applyInventoryFootprintsForTest: S.applyInventoryFootprints, repairInventoryFootprintsForTest: S.repairInventoryFootprints, moveInventoryRangeForTest: S.moveInventoryRange, mergeOrSwapForTest: S.mergeOrSwap, addItemForTest: S.addItem, removeItemForTest: S.removeItem, saveGameForTest: S.saveGame, loadGameForTest: S.loadGame, planEnemyPathForTest: S.planEnemyPath, navFloorAtForTest: S.navFloorAt, updateMinimapForTest: S.updateMinimap, updateArmorMiniHudForTest: S.updateArmorMiniHud, setYawForTest: ang => { S.player.yaw = ang; }, setPlayerSlotsForTest: (slots) => { S.player.slots = slots.map(S.normalizeStack); while (S.player.slots.length < S.INVENTORY_SIZE)
        S.player.slots.push(null); S.repairInventoryFootprints(); S.refreshHotbar(); S.refreshInventoryUI(); }, getV13SystemsForTest: () => ({ xp: S.xp, level: S.playerLevel(), scanCooldown: S.scanCooldown, scanDuration: S.scanDuration, scanTargets: S.scanTargets.length, bedrolls: [...S.bedrolls.entries()], ruinChests: [...S.ruinChests.entries()], armorSlots: { ...S.armorSlots }, armorWear: { ...S.armorWear }, respawnSite: S.respawnSite, starterChestLoot: S.starterChestLoot, weatherMode: S.weatherMode, rainDropCount: S.rainDrops.length, glassDropCount: S.glassDroplets.length }), updateWeatherForTest: S.updateWeather, setWeatherForTest: (mode, intensity = .8) => { S.weatherMode = mode; S.weatherIntensity = intensity; S.weatherTimer = 500; }, equipArmorForTest: (part, id) => { if (!(part in S.armorSlots) || S.itemDefs[id]?.armorSlot !== part)
        return false; S.armorSlots[part] = { id, count: 1 }; return true; }, absorbArmorDamageForTest: S.absorbArmorDamage, chooseSpawnTypeForTest: S.chooseSpawnType, spawnEnemyForTest: S.spawnEnemy, spawnAroundPlayerForTest: S.spawnAroundPlayer, updateEnemiesForTest: S.updateEnemies, wolfViewStateForTest: S.wolfViewState, updateWolfAwarenessForTest: S.updateWolfAwareness, emitPlayerNoiseForTest: S.emitPlayerNoise, strongestPlayerNoiseForWolfForTest: S.strongestPlayerNoiseForWolf, clearPlayerNoiseForTest: () => { S.playerNoiseEvents.length = 0; }, spawnCanopyLeavesForTest: S.spawnCanopyLeaves, findNearbyLeafEmitterForTest: S.findNearbyLeafEmitter, damageBarrierByEnemyForTest: S.damageBarrierByEnemy, spawnFirstNightApparitionForTest: S.spawnFirstNightApparition, updateHorrorEventsForTest: S.updateHorrorEvents, updateFallingLeavesForTest: S.updateFallingLeaves, setWorldSecondsForTest: v => { S.worldSeconds = v; }, clearEnemiesForTest: () => { S.enemies.length = 0; }, clearApparitionsForTest: () => { S.apparitions.length = 0; },
    getState: () => ({ running: S.running, paused: S.paused, inventoryOpen: S.inventoryOpen, furnaceOpen: S.furnaceOpen, mapOpen: S.mapOpen, worldSeed: S.worldSeed, renderDistance: S.renderDistance, worldSeconds: S.worldSeconds, daySeconds: S.DAY_SECONDS, worldSpawn: S.worldSpawn ? [...S.worldSpawn] : null, enemyCount: S.enemies.length, enemies: S.enemies.map(e => ({ type: e.type, pos: [...e.pos], facing: e.facing, renderFacing: e.renderFacing, sightAwareness: e.sightAwareness || 0, hearingAwareness: e.hearingAwareness || 0, awareness: e.awareness || 0, spotted: !!e.spotted, track: e.track || 0, packId: e.packId || 0, heardTimer: e.heardTimer || 0, searchTimer: e.searchTimer || 0, investigatePos: e.investigatePos ? [...e.investigatePos] : null })), apparitions: S.apparitions.map(a => ({ pos: [...a.pos], age: a.age })), birdCount: S.birds.length, nightNumber: S.currentNightNumber(), worldHour: S.currentWorldHour(), playerLevel: S.playerLevel(), tabReturnArmed: S.tabReturnArmed, fallingLeafCount: S.fallingLeaves.length, playerNoiseCount: S.playerNoiseEvents.length, playerNoises: S.playerNoiseEvents.map(n => ({ kind: n.kind, radius: n.radius, intensity: n.intensity, age: n.age, pos: [...n.pos] })), blackoutTimer: S.blackoutTimer, phantomRun: { active: S.phantomRun.active, cooldown: S.phantomRun.cooldown, step: S.phantomRun.step }, starterChestPos: S.starterChestPos ? [...S.starterChestPos] : null, starterTorchCount: S.starterChestPos ? [...S.edits].filter(([k, v]) => { if (v !== S.B.TORCH)
            return false; const [x, y, z] = k.split(',').map(Number); return Math.hypot(x - S.starterChestPos[0], z - S.starterChestPos[2]) <= 4.6; }).length : 0, starterTorchPositions: S.starterChestPos ? [...S.edits].filter(([k, v]) => v === S.B.TORCH).map(([k]) => k) : [], fortifications: [...S.fortifications.entries()], furnaces: [...S.furnaces.entries()], droppedItems: S.droppedItems.map(d => ({ id: d.id, count: d.count, pos: [...d.pos], age: d.age })), playerColliding: S.aabbHitsWorld(S.playerAabbAt(S.player.pos[0], S.player.pos[1], S.player.pos[2])), player: { ...S.player, pos: [...S.player.pos], slots: S.player.slots.map(S.cloneStack), craftSlots: S.player.craftSlots.map(S.cloneStack) }, cursorStack: S.cloneStack(S.cursorStack) })
};

// Pre-fill a memorable default seed and expose a tiny health marker for tests.
S.UI.seedInput.value = 'black-forest-666';

document.body.dataset.gameBooted = 'true';
}
