// NightCraft V15 · native ES module (save/compat.js); installs into the explicit shared state.
export function install(S) {
S.SAVE_KEY = 'nightcraft-cold-forest-save-v15';
S.LEGACY_SAVE_KEYS = ['nightcraft-cold-forest-save-v14', 'nightcraft-cold-forest-save-v13', 'nightcraft-cold-forest-save-v12', 'nightcraft-cold-forest-save-v11', 'nightcraft-cold-forest-save-v10', 'nightcraft-cold-forest-save-v9', 'nightcraft-cold-forest-save-v8', 'nightcraft-cold-forest-save-v7', 'nightcraft-cold-forest-save-v6', 'nightcraft-cold-forest-save-v5', 'nightcraft-cold-forest-save-v4', 'nightcraft-the-hunt-save-v3'];

S.DAY_SECONDS = 1200;
S.WORLD_START_HOUR = 16;

S.difficulty = 'nightmare';
S.worldSeconds = (S.WORLD_START_HOUR / 24) * S.DAY_SECONDS;
S.playSeconds = 0;
S.autoSave = 0;
S.spawnTimer = 4;
S.lightning = 0;
S.lightningCooldown = 20;

S.currentWorldHour = function currentWorldHour() { return ((S.worldSeconds % S.DAY_SECONDS) + S.DAY_SECONDS) % S.DAY_SECONDS / S.DAY_SECONDS * 24; };

S.currentNightNumber = function currentNightNumber() { return Math.max(1, Math.floor(Math.max(0, S.worldSeconds - (S.WORLD_START_HOUR / 24) * S.DAY_SECONDS) / S.DAY_SECONDS) + 1); };

S.playerLevel = function playerLevel() { return S.clamp(Math.floor(S.xp / 90), 0, 99); };

S.grantXP = function grantXP(points) { const before = S.playerLevel(); S.xp += Math.max(0, points); if (S.playerLevel() > before) {
    S.showMessage(`POZIOM ${S.playerLevel()} · X-RAY ODBLOKOWANY!`, 2.5);
    S.sfx('pickup', 1.2);
} };

S.getAnySave = function getAnySave() { if (S.cachedSave)
    return S.cachedSave; try {
    return localStorage.getItem(S.SAVE_KEY) || S.LEGACY_SAVE_KEYS.map(k => localStorage.getItem(k)).find(Boolean) || null;
}
catch {
    return null;
} };

S.hasSave = function hasSave() { return !!S.getAnySave(); };

S.saveGame = function saveGame() {
    if (!S.running)
        return;
    try {
        const data = {
            version: 24, worldgenVersion: S.worldgenVersion || 16, seed: S.worldSeed, seedText: S.UI.seedInput.value || String(S.worldSeed),
            difficulty: S.difficulty,
            worldSeconds: S.worldSeconds,
            playSeconds: S.playSeconds,
            worldSpawn: S.worldSpawn,
            villagePlan: S.villagePlan ? JSON.parse(JSON.stringify(S.villagePlan)) : null,
            distanceWalked: S.player.distanceWalked || 0,
            pos: S.player.pos, yaw: S.player.yaw, pitch: S.player.pitch, health: S.player.health, hunger: S.player.hunger, stamina: S.player.stamina, sanity: S.player.sanity,
            slots: S.player.slots, craftSlots: S.player.craftSlots, offhand: S.player.offhand, kills: S.player.kills, blocksMined: S.player.blocksMined,
            starterChestPos: S.starterChestPos,
            starterChestLoot: S.starterChestLoot,
            ruinChests: [...S.ruinChests.entries()], bedrolls: [...S.bedrolls.entries()],
            respawnSite: S.respawnSite, lastDeathPosition: S.lastDeathPosition, waypoint: S.waypoint,
            fallenLogDamage: [...(S.fallenLogDamage || new Map()).entries()],
            armorSlots: S.armorSlots,
            armorWear: S.armorWear,
            xp: S.xp,
            adminMode: S.adminMode,
            fallingTrees: (S.fallingTrees||[]).map(({root,id,logs,leaves,height,dx,dz,age,angle})=>({root,id,logs,leaves,height,dx,dz,age,angle})),
            edits: [...S.edits.entries()], enemyBlockDamage: [...S.enemyBlockDamage.entries()], fortifications: [...S.fortifications.entries()], torchMounts: [...S.torchMounts.entries()], furnaces: [...S.furnaces.entries()], droppedItems: S.droppedItems.slice(-120).map(d => ({ id: d.id, count: d.count, pos: d.pos, vel: d.vel, age: d.age, pickupDelay: d.pickupDelay, spin: d.spin, bob: d.bob })),
            settings: { sensitivity: S.input.sensitivity, volume: S.audio.volume, renderDistance: S.renderDistance, graphics: S.graphics ? {...S.graphics} : undefined }
        };
        S.cachedSave = JSON.stringify(data);
        const pending=S.persistWorldSave(S.cachedSave);
        S.UI.continueBtn.disabled = false;
        Promise.resolve(pending).then(()=>{
            S.showMessage('Świat zapisany.', 1.1);
        },err=>{
            console.error('IndexedDB save failed',err);
            S.showMessage('Błąd zapisu: sprawdź pamięć przeglądarki.');
        });
    }
    catch (err) {
        console.warn('Save failed', err);
        S.showMessage('Nie udało się zapisać świata.');
    }
};

S.clearWorldRuntime = function clearWorldRuntime() {
    if(S.fallingTrees) S.fallingTrees.length=0;
    S.fallenLogDamage?.clear();
    S.lastDeathPosition = null; S.waypoint=null; S.villagePlan=null;
    S.treeChopAim=null;
    S.rainDrops.length = 0;
    S.glassDroplets.length = 0;
    S.rainEmitBudget = 0;
    S.glassBudget = 0;
    S.minimapCache.clear();
    S.ruinChests.clear();
    S.bedrolls.clear();
    S.respawnSite = null;
    S.activeChestKey = null;
    S.scanTargets = [];
    S.xp = 0;
    S.scanDuration = 0;
    S.scanCooldown = 0;
    for (const c of S.chunks.values()) {
        S.deleteMesh(c.opaque);
        S.deleteMesh(c.water);
    }
    S.chunks.clear();
    S.chunkWorker?.reset(0); // invalidate obsolete chunk responses on world exit
    S.dirtyChunks.clear();
    S.edits.clear();
    S.fortifications.clear();
    S.enemyBlockDamage.clear();
    S.furnaces.clear();
    S.torchMounts.clear();
    S.enemies.length = 0;
    S.skySpawnTimer=11;
    if (typeof S.birds !== 'undefined')
        S.birds.length = 0;
    if (typeof S.apparitions !== 'undefined')
        S.apparitions.length = 0;
    if(S.forestEyes) S.forestEyes.length=0;
    S.forestScareAge=0; S.forestScareOpacity=0;
    if (typeof S.fallingLeaves !== 'undefined')
        S.fallingLeaves.length = 0;
    if (typeof S.playerNoiseEvents !== 'undefined')
        S.playerNoiseEvents.length = 0;
    S.particles.length = 0;
    S.droppedItems.length = 0;
    S.starterChestPos = null;
    S.starterChestLoot = Array(9).fill(null);
    S.cursorStack = null;
    S.player.craftSlots = Array(9).fill(null);
    S.worldSpawn = null;
    S.furnaceActiveKey = null;
    S.mapOpen = false;
    S.furnaceOpen = false;
};

S.randomStartingEquipment = function randomStartingEquipment() {
    const parts = ['head', 'chest', 'legs', 'feet'];
    const chosen = [];
    let pool = [...parts];
    for (let i = 0; i < 2; i++) {
        const r = S.hash2i(S.worldSeed ^ (i * 0x9c37), 0x5f8 + i, 0x45611 + i), j = Math.min(pool.length - 1, Math.floor(r * pool.length));
        const part = pool.splice(j, 1)[0], id = 'leather_' + part, max = S.itemDefs[id].durability;
        S.armorSlots[part] = { id, count: 1 };
        S.armorWear[part] = Math.round(max * (.15 + .59 * S.hash2i(S.worldSeed ^ (i * 0x3ad5), 0x9412 + i, 0x5a12)));
        S.armorSlots[part].wear=S.armorWear[part];
        chosen.push(part);
    }
    return chosen;
};

S.seedInitialInventory = function seedInitialInventory() {
    S.player.slots = Array(S.INVENTORY_SIZE).fill(null);
    S.player.slots[0] = { id: 'wood_pickaxe', count: 1, wear: Math.floor(S.itemDefs.wood_pickaxe.durability * (.12 + .66 * S.hash2i(S.worldSeed, 0x3f14, 222))) };
    S.player.slots[1] = { id: 'wood_axe', count: 1, wear: Math.floor(S.itemDefs.wood_axe.durability * (.12 + .66 * S.hash2i(S.worldSeed, 0x3f14, 223))) };
    S.player.slots[2] = { id: 'wood_shovel', count: 1, wear: Math.floor(S.itemDefs.wood_shovel.durability * (.12 + .66 * S.hash2i(S.worldSeed, 0x3f14, 224))) };
    S.player.slots[3] = { id: 'wood_sword', count: 1, wear: Math.floor(S.itemDefs.wood_sword.durability * (.12 + .66 * S.hash2i(S.worldSeed, 0x3f14, 225))) };
    S.player.slots[4] = { id: 'torch', count: 24 };
    S.player.slots[5] = { id: 'dirt', count: 12 };
    S.player.slots[6] = { id: 'cookedmeat', count: 2 };
    S.player.slots[7] = { id: 'berries', count: 4 };
    S.player.slots[8] = { id: 'planks', count: 4 };
    S.player.slots[9] = { id: 'bedroll', count: 1 };
    S.player.slots[10] = { id: S.BEDROLL_TAIL, count: 1 };
};

S.resetPlayer = function resetPlayer() {
    Object.assign(S.player, { pos: [0, 26, 0], vel: [0, 0, 0], yaw: 0, pitch: -.1, health: 100, hunger: 100, stamina: 100, sanity: 100, grounded: false, inWater: false, selected: 0, torchRaised: false, attackCooldown: 0, damageCooldown: 0, fallSpeed: 0, kills: 0, blocksMined: 0, days: 0, stepTimer: 0, movePhase: 0, bob: 0, sway: 0, impact: 0, toolSwing: 0, toolSwingSide: 1, lastGroundY: 0, wasInWater: false, swimSound: 0, stepDistance: 0, threat: 0, cameraShake: 0, heartbeat: 0, distanceWalked: 0, jumpBuffer: 0, coyote: 0, jumpHeld: false, waterRiseCooldown: 0 });
    S.xp = 0;
    S.scanCooldown = 0;
    S.scanDuration = 0;
    S.scanTargets = [];
    S.respawnSite = null;
    for (const part of Object.keys(S.armorSlots)) {
        S.armorSlots[part] = null;
        S.armorWear[part] = 0;
    }
    S.player.offhand = null;
    S.player.craftSlots = Array(9).fill(null);
    S.seedInitialInventory();
    S.randomStartingEquipment();
    S.input.sensitivity = .0115;
    S.UI.sensInput.value = String(S.input.sensitivity);
    S.audio.volume = .82;
    S.UI.volumeInput.value = '0.82';
    S.setAudioVolume(S.audio.volume);
};

S.migrateLegacyInventory = function migrateLegacyInventory(inv) {
    S.player.slots = Array(S.INVENTORY_SIZE).fill(null);
    let idx = 0;
    for (const [id, count] of Object.entries(inv || {})) {
        let left = Math.floor(count || 0);
        if (!S.itemDefs[id] || left <= 0)
            continue;
        const max = S.maxStackFor(id);
        while (left > 0 && idx < S.INVENTORY_SIZE) {
            const take = Math.min(max, left);
            S.player.slots[idx++] = { id, count: take };
            left -= take;
        }
    }
    if (!S.player.slots.some(Boolean))
        S.seedInitialInventory();
};

S.randomStarterChestLoot = function randomStarterChestLoot() {
    const loot = Array(9).fill(null), roll = (salt) => S.hash2i(S.worldSeed & 0xffff, (S.worldSeed >>> 16) & 0xffff, salt), put = (slot, id, min, max) => { const n = min + Math.floor(roll(0x500 + slot) * (max - min + 1)); loot[slot] = { id, count: n }; };
    put(0, 'torch', 8, 16);
    loot[1] = { id: 'wood_door', count: 1 };
    loot[2] = { id: 'glass', count: 3 };
    put(3, 'cookedmeat', 1, 3);
    if (roll(0x811) > .35)
        loot[4] = { id: 'bandage', count: 1 + Math.floor(roll(0x812) * 2) };
    if (roll(0x813) > .48)
        loot[5] = { id: ['axe', 'pickaxe', 'shovel'][Math.floor(roll(0x814) * 3)], count: 1 };
    if (roll(0x815) > .42)
        loot[6] = { id: 'planks', count: 4 + Math.floor(roll(0x816) * 8) };
    if (roll(0x817) > .58)
        loot[7] = { id: 'berries', count: 2 + Math.floor(roll(0x818) * 5) };
    return loot;
};

S.createStarterChestNear = function createStarterChestNear(spawn) {
    const sx = Math.floor(spawn[0]), sz = Math.floor(spawn[2]);
    let best = null;
    for (let r = 4; r <= 10 && !best; r++)
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + S.hash2i(sx, sz, 0x919) * 1.7, x = sx + Math.round(Math.cos(a) * r), z = sz + Math.round(Math.sin(a) * r), y = S.findSurface(x, z);
            if (y <= S.SEA + 1 || y >= S.WORLD_H - 3)
                continue;
            const ground = S.getBlock(x, y - 1, z);
            if ([S.B.WATER, S.B.ICE].includes(ground))
                continue;
            const h0 = S.terrainHeight(x, z), h1 = S.terrainHeight(x + 1, z), h2 = S.terrainHeight(x, z + 1);
            if (Math.max(Math.abs(h0 - h1), Math.abs(h0 - h2)) > 2)
                continue;
            if (S.getBlock(x, y, z) === S.B.AIR) {
                best = [x, y, z];
                break;
            }
        }
    if (!best) {
        const x = sx + 3, z = sz + 3, y = S.findSurface(x, z);
        best = [x, y, z];
    }
    S.starterChestPos = best;
    S.starterChestLoot = S.randomStarterChestLoot();
    S.setBlock(best[0], best[1], best[2], S.B.CHEST);
    // Four tiny cobble pads + torches form a visible starter camp. Keeping the
    // lamps on the chest level guarantees they exist even on slopes / shoreline.
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const tx = best[0] + dx, tz = best[2] + dz, ty = best[1];
        S.setBlock(tx, ty - 1, tz, S.B.COBBLE);
        S.setBlock(tx, ty, tz, S.B.TORCH);
        if (S.blockDefs[S.getBlock(tx, ty + 1, tz)]?.decor || S.isFoliage(S.getBlock(tx, ty + 1, tz)))
            S.setBlock(tx, ty + 1, tz, S.B.AIR);
    }
    return best;
};

S.startNewGame = function startNewGame() {
    S.initAudio();
    S.clearWorldRuntime();
    const seedText = (S.UI.seedInput.value.trim() || `${Date.now()}-${Math.floor(Math.random() * 9999)}`);
    S.UI.seedInput.value = seedText;
    S.worldSeed = S.hashString(seedText);
    S.worldgenVersion = S.worldgenOverride || 26;
    // Village descriptor must exist before worker init, so all chunks agree.

    S.difficulty = S.UI.difficultySelect.value;
    S.resetPlayer();
    S.worldSeconds = (S.WORLD_START_HOUR / 24) * S.DAY_SECONDS;
    S.playSeconds = 0;
    S.spawnTimer = 5;
    S.apparitionTimer = 24 + Math.random() * 24;
    S.forestEyes.length=0; S.forestEyeClock=13+Math.random()*18;
    S.forestScareAge=0; S.forestScareOpacity=0; S.forestScareClock=95+Math.random()*90;
    S.phantomRun.active = false;
    S.phantomRun.cooldown = 42 + Math.random() * 75;
    S.blackoutTimer = 0;
    S.lightning = 0;
    S.lightningCooldown = 12 + Math.random() * 34;
    S.adminMode = false;
    S.updateAdminButton();
    S.player.pos = S.findScenicSpawn();
    S.worldSpawn = [...S.player.pos];
    if(S.worldgenVersion>=26)S.createVillageQuest?.();
    S.chunkWorker?.reset(S.worldSeed);
    S.updateStreaming(S.player.pos[0], S.player.pos[2], true);
    S.createStarterChestNear(S.player.pos);
    S.running = true;
    S.dead = false;
    S.paused = true;
    S.UI.mainMenu.classList.remove('active');
    S.UI.hud.classList.remove('hidden');
    S.refreshHotbar();
    S.refreshInventoryUI();
    S.saveGame();
    if(!S.multiplayer?.active && S.openVillageGuide)S.openVillageGuide();
    else S.resumeGame();
};

S.loadGame = function loadGame() {
    S.initAudio();
    let d;
    try {
        d = JSON.parse(S.getAnySave() || 'null');
    }
    catch { }
    if (!d) {
        S.startNewGame();
        return;
    }
    S.clearWorldRuntime();
    S.resetPlayer();
    S.worldSeed = d.seed >>> 0;
    S.worldgenVersion = d.worldgenVersion || 16;
    S.restoreVillageQuest?.(d.villagePlan);
    S.chunkWorker?.reset(S.worldSeed);
    S.UI.seedInput.value = d.seedText || String(S.worldSeed);
    S.difficulty = d.difficulty || 'nightmare';
    S.UI.difficultySelect.value = S.difficulty;
    {
        const raw = d.worldSeconds ?? ((16 / 24) * 720);
        if ((d.version || 0) < 8) {
            const oldDay = Math.floor(raw / 720), oldPh = (raw % 720) / 720;
            S.worldSeconds = (oldDay + oldPh) * S.DAY_SECONDS;
        }
        else
            S.worldSeconds = raw;
    }
    S.playSeconds = d.playSeconds || 0;
    if(Array.isArray(d.fallingTrees))S.fallingTrees=d.fallingTrees.filter(t=>
        t&&Array.isArray(t.root)&&t.root.length===3&&Array.isArray(t.logs)&&t.logs.length<=185&&
        Array.isArray(t.leaves)&&t.leaves.length<=750&&Number.isFinite(t.age)&&Number.isFinite(t.dx)&&Number.isFinite(t.dz)
    ).slice(0,8);
    if (Array.isArray(d.edits))
        for (const [k, v] of d.edits)
            S.edits.set(k, v);
    if(Array.isArray(d.torchMounts))for(const [k,n] of d.torchMounts)
        if(S.edits.get(k)===S.B.TORCH && Array.isArray(n) && n.length===3)S.torchMounts.set(k,n);
    S.player.pos = Array.isArray(d.pos) ? d.pos : [0, 26, 0];
    S.worldSpawn = Array.isArray(d.worldSpawn) ? d.worldSpawn : (Array.isArray(d.starterChestPos) ? [d.starterChestPos[0], S.findSurface(d.starterChestPos[0], d.starterChestPos[2]), d.starterChestPos[2]] : [...S.player.pos]);
    S.player.distanceWalked = Number(d.distanceWalked) || 0;
    S.player.yaw = d.yaw || 0;
    S.player.pitch = d.pitch || -.1;
    S.player.health = S.clamp(d.health ?? 100, 1, 100);
    S.player.hunger = S.clamp(d.hunger ?? 100, 0, 100);
    S.player.stamina = S.clamp(d.stamina ?? 100, 0, 100);
    S.player.sanity = S.clamp(d.sanity ?? 100, 0, 100);
    if (Array.isArray(d.slots)) {
        S.player.slots = Array(S.INVENTORY_SIZE).fill(null);
        for (let i = 0; i < Math.min(S.INVENTORY_SIZE, d.slots.length); i++)
            S.player.slots[i] = S.normalizeStack(d.slots[i]);
    }
    else
        S.migrateLegacyInventory(d.inventory);
    S.player.craftSlots = Array.isArray(d.craftSlots) ? d.craftSlots.slice(0, 9).map(S.normalizeStack) : Array(9).fill(null);
    while (S.player.craftSlots.length < 9)
        S.player.craftSlots.push(null);
    S.player.offhand = S.normalizeStack(typeof d.offhand === 'string' ? { id: d.offhand, count: 1 } : d.offhand);
    S.repairInventoryFootprints();
    S.xp = Math.max(0, Number(d.xp) || 0);
    S.respawnSite = Array.isArray(d.respawnSite) ? d.respawnSite : null;
    S.lastDeathPosition = Array.isArray(d.lastDeathPosition) && d.lastDeathPosition.length===3 && d.lastDeathPosition.every(Number.isFinite) ? d.lastDeathPosition : null;
    S.waypoint = d.waypoint && Number.isFinite(d.waypoint.x) && Number.isFinite(d.waypoint.z) && Math.abs(d.waypoint.x)<1000000 && Math.abs(d.waypoint.z)<1000000 ? {x:Math.round(d.waypoint.x),z:Math.round(d.waypoint.z)} : null;
    S.fallenLogDamage = new Map((Array.isArray(d.fallenLogDamage) ? d.fallenLogDamage : []).filter(entry=>Array.isArray(entry)&&/^-?\d+,-?\d+,-?\d+$/.test(entry[0])&&Number.isFinite(entry[1])&&entry[1]>=.05&&entry[1]<=.3));
    for (const k of Object.keys(S.armorSlots)) {
        S.armorSlots[k] = S.normalizeStack(d.armorSlots?.[k]);
        S.armorWear[k] = Math.max(0, Number(d.armorWear?.[k]) || 0);
    }
    if (Array.isArray(d.bedrolls))
        for (const [k, v] of d.bedrolls)
            S.bedrolls.set(k, v);
    if (Array.isArray(d.ruinChests))
        for (const [k, v] of d.ruinChests)
            S.ruinChests.set(k, v);
    S.player.kills = d.kills || 0;
    S.player.blocksMined = d.blocksMined || 0;
    S.starterChestPos = Array.isArray(d.starterChestPos) ? d.starterChestPos : null;
    S.starterChestLoot = Array.isArray(d.starterChestLoot) ? d.starterChestLoot.slice(0, 9).map(S.normalizeStack) : Array(9).fill(null);
    while (S.starterChestLoot.length < 9)
        S.starterChestLoot.push(null);
    if(Array.isArray(d.enemyBlockDamage))for(const [k,v] of d.enemyBlockDamage){if(typeof k==='string'&&v&&Number.isFinite(v.hp)&&v.hp>0)S.enemyBlockDamage.set(k,v);}
    if (Array.isArray(d.fortifications))
        for (const [k, v] of d.fortifications)
            S.fortifications.set(k, v);
    if (Array.isArray(d.furnaces))
        for (const [k, v] of d.furnaces)
            S.furnaces.set(k, v);
    if (Array.isArray(d.droppedItems))
        for (const q of d.droppedItems.slice(-120)) {
            const st = S.normalizeStack(q);
            if (!st || !Array.isArray(q.pos))
                continue;
            S.droppedItems.push({ id: st.id, count: st.count, pos: q.pos.slice(0, 3).map(Number), vel: Array.isArray(q.vel) ? q.vel.slice(0, 3).map(Number) : [0, 0, 0], age: Math.max(.5, Number(q.age) || 0), pickupDelay: Number.isFinite(Number(q.pickupDelay)) ? Number(q.pickupDelay) : .45, spin: Number(q.spin) || 0, bob: Number(q.bob) || 0, onGround: false });
        }
    S.adminMode = !!d.adminMode;
    S.updateAdminButton();
    S.updateStreaming(S.worldSpawn?.[0] || S.player.pos[0], S.worldSpawn?.[2] || S.player.pos[2], true);
    if (!S.spawnPointIsSafe(S.player.pos))
        S.player.pos = S.findSafeSpawn(S.worldSpawn?.[0] || S.player.pos[0], S.worldSpawn?.[2] || S.player.pos[2], 28);
    if (!S.spawnPointIsSafe(S.player.pos)) {
        const bx = Math.floor(S.worldSpawn?.[0] || S.player.pos[0]), bz = Math.floor(S.worldSpawn?.[2] || S.player.pos[2]);
        S.player.pos = S.clearSpawnPocket(bx, S.clamp(S.findSurface(bx, bz), 2, S.WORLD_H - 4), bz);
    }
    if (d.settings) {
        const oldSens = Number(d.settings.sensitivity) || .0095;
        S.input.sensitivity = S.clamp(d.version >= 5 ? oldSens : Math.max(.0105, oldSens * 1.18), .002, .022);
        S.audio.volume = S.clamp(d.settings.volume ?? .7, 0, 1);
        const oldRange=d.settings.graphics?.version>=35?Number(d.settings.renderDistance)||12:12;
        if(!S.graphicsFromStorage){S.renderDistance=S.clamp(oldRange,2,24);S.setGraphicsSettings?.({...d.settings.graphics,renderDistance:S.renderDistance},false);}
        S.UI.sensInput.value = String(S.input.sensitivity);
        S.UI.volumeInput.value = String(S.audio.volume);
        S.UI.renderDistanceSelect.value = String(S.renderDistance);
        S.setAudioVolume(S.audio.volume);
    }
    S.updateStreaming(S.player.pos[0], S.player.pos[2], true);
    if (!S.starterChestPos)
        S.createStarterChestNear(S.player.pos);
    S.running = true;
    S.dead = false;
    S.paused = true;
    S.UI.mainMenu.classList.remove('active');
    S.UI.hud.classList.remove('hidden');
    S.refreshHotbar();
    S.refreshInventoryUI();
    S.saveGame();
    S.resumeGame();
};
}
