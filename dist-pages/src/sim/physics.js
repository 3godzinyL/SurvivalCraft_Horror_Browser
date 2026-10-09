// NightCraft V15 · native ES module (sim/physics.js); installs into the explicit shared state.
export function install(S) {
S.sunLevel = function sunLevel() {
    const h = ((S.worldSeconds % S.DAY_SECONDS) + S.DAY_SECONDS) % S.DAY_SECONDS / S.DAY_SECONDS * 24;
    const smooth = t => t*t*(3-2*t);
    if (h < 5.4 || h >= 21.2) return .045;
    if (h < 7.15) return .045 + .955*smooth((h-5.4)/1.75);
    if (h < 19) return 1;
    return 1 - .955*smooth((h-19)/2.2);
};

S.nightLevel = function nightLevel() { return 1 - S.sunLevel(); };

S.mineParticleTimer = 0;
S.weatherTimer = 0;
S.weatherMode = 'mist';
S.weatherIntensity = .35;
S.lastVP = null;

S.projectWorldToScreen = function projectWorldToScreen(pos) {
    if (!S.lastVP)
        return null;
    const m = S.lastVP, x = pos[0], y = pos[1], z = pos[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= .01)
        return null;
    const nx = cx / cw, ny = cy / cw;
    if (nx < -1.2 || nx > 1.2 || ny < -1.2 || ny > 1.2)
        return null;
    return [(nx * .5 + .5) * innerWidth, (-ny * .5 + .5) * innerHeight];
};

S.setMiningHud = function setMiningHud(active, hit = null) {
    if (S.UI.mineProgress)
        S.UI.mineProgress.style.opacity = '0';
    if (S.UI.mineHud)
        S.UI.mineHud.classList.remove('active');
    if (!active || !hit) {
        S.UI.worldMineBar?.classList.add('hidden');
        if (S.UI.worldMineFill)
            S.UI.worldMineFill.style.width = '0%';
        return;
    }
    const pct = Math.round(S.clamp(S.mineAmount, 0, 1) * 100), scr = S.projectWorldToScreen([hit.x + .5, hit.y + 1.12, hit.z + .5]);
    S.UI.worldMineBar.classList.remove('hidden');
    S.UI.worldMineFill.style.width = `${pct}%`;
    S.UI.worldMinePct.textContent = `${pct}%`;
    S.UI.worldMineName.textContent = S.blockDefs[hit.id]?.name || 'BLOK';
    if (scr) {
        S.UI.worldMineBar.style.left = `${scr[0]}px`;
        S.UI.worldMineBar.style.top = `${scr[1]}px`;
    }
    else {
        S.UI.worldMineBar.style.left = '50%';
        S.UI.worldMineBar.style.top = '50%';
    }
};

S.dropStackFromBlock = function dropStackFromBlock(st, x, y, z, boost = 1) { if (!st || !st.id || st.count <= 0)
    return; const a = Math.random() * Math.PI * 2; S.spawnItemDrop(st.id, st.count, [x + .5, y + .58, z + .5], [Math.cos(a) * (.45 + .45 * Math.random()) * boost, 2.25 + Math.random() * 1.15 * boost, Math.sin(a) * (.45 + .45 * Math.random()) * boost], .52); };

S.wearHeldTool = function wearHeldTool(amount = 1) {
    const st = S.player.slots[S.player.selected], def = st ? S.itemDefs[st.id] : null;
    if (!def?.durability || def.kind !== 'tool')
        return;
    st.wear = Math.max(0, (st.wear || 0) + Math.max(0, amount));
    if (st.wear >= def.durability) {
        S.player.slots[S.player.selected] = null;
        S.showMessage(`${def.name} uległ zniszczeniu!`, 2);
        S.sfx('break', .5, 'wood');
        S.mineAmount = 0;
        S.mineTargetKey = '';
    }
    S.refreshHotbar();
};

S.breakBlockByPlayer = function breakBlockByPlayer(hit) {
    const def = S.blockDefs[hit.id];
    if (!def)
        return false;
    const brokenKey = S.fortKey(hit.x, hit.y, hit.z);
    if (hit.id === S.B.CHEST && S.starterChestPos && hit.x === S.starterChestPos[0] && hit.y === S.starterChestPos[1] && hit.z === S.starterChestPos[2]) {
        for (const st of S.starterChestLoot)
            if (st)
                S.dropStackFromBlock(st, hit.x, hit.y, hit.z, .85);
        S.starterChestLoot = Array(9).fill(null);
        S.starterChestPos = null;
        S.showMessage('Skrzynia rozbita — loot wypadł na ziemię.', 1.5);
    }
    if (hit.id === S.B.CHEST && brokenKey !== S.fortKey(...(S.starterChestPos || [-999, -999, -999]))) {
        const loot = S.ruinChests.get(brokenKey) || S.generateRuinChestLoot(hit.x, hit.y, hit.z);
        for (const st of loot)
            if (st)
                S.dropStackFromBlock(st, hit.x, hit.y, hit.z, .8);
        S.ruinChests.delete(brokenKey);
    }
    if (hit.id === S.B.BEDROLL) {
        S.bedrolls.delete(brokenKey);
        if (S.respawnSite && S.fortKey(...S.respawnSite) === brokenKey) {
            S.respawnSite = null;
            S.showMessage('Punkt odrodzenia usunięty.');
        }
    }
    if (hit.id === S.B.FURNACE) {
        const fu = S.furnaces.get(brokenKey);
        if (fu) {
            for (const st of [fu.input, fu.fuel, fu.output])
                if (st)
                    S.dropStackFromBlock(st, hit.x, hit.y, hit.z, .8);
            S.furnaces.delete(brokenKey);
        }
    }
    S.fortifications.delete(brokenKey);
    S.fallenLogDamage?.delete(brokenKey);
    if(S.chopTreeRoot?.(hit)){
        S.player.blocksMined++;S.wearHeldTool(.65);S.grantXP(2);return true;
    }
    S.setBlock(hit.x, hit.y, hit.z, S.B.AIR);
    S.player.blocksMined++;
    S.wearHeldTool(hit.id === S.B.IRON || hit.id === S.B.GOLD ? .7 : .45);
    S.grantXP(hit.id === S.B.IRON || hit.id === S.B.GOLD ? 6 : hit.id === S.B.COAL ? 4 : 1);
    if (def.drop)
        S.dropStackFromBlock({ id: def.drop, count: 1 }, hit.x, hit.y, hit.z, 1);
    // Harvestable botanical loot. Flower rarities follow their own RNG pools.
    if ([S.B.TALLGRASS,S.B.FERN,S.B.REEDS,S.B.BUSH,S.B.DRY_BUSH].includes(hit.id) && Math.random()<.74)
        S.dropStackFromBlock({id:'plant_fiber',count:1+Math.floor(Math.random()*2)},hit.x,hit.y,hit.z,.8);
    if ([S.B.RED_FLOWER,S.B.WHITE_FLOWER,S.B.BLUE_FLOWER,S.B.YELLOW_FLOWER,S.B.HEATHER,S.B.MUSHROOM].includes(hit.id)) {
        const roll=Math.random(), id=hit.id===S.B.RED_FLOWER && roll<.19 ? 'blood_petal' : (hit.id===S.B.WHITE_FLOWER||hit.id===S.B.BLUE_FLOWER) && roll<.31 ? 'moonflower':'field_herbs';
        S.dropStackFromBlock({id,count:1},hit.x,hit.y,hit.z,.8);
        if(id==='blood_petal')S.showMessage('RZADKIE ZIOŁO · KRWAWY PŁATEK',2);
    }
    if ([S.B.LEAVES, S.B.PINELEAVES, S.B.BIRCHLEAVES, S.B.DARKLEAVES, S.B.AUTUMNLEAVES, S.B.WILLOWLEAVES, S.B.POPLARLEAVES, S.B.MIMOSALEAVES].includes(hit.id) && Math.random() < .24)
        S.dropStackFromBlock({ id: 'berries', count: 1 }, hit.x, hit.y, hit.z, .75);
    const breakMat = S.soundMaterialForBlock(hit.id);
    S.spawnDebris(hit.x, hit.y, hit.z, hit.id, 22, true);
    S.sfx('break', 1, breakMat);
    S.emitPlayerNoise('block_break', 26, 1.05, [hit.x + .5, hit.y + .5, hit.z + .5], 1.7, breakMat);
    S.player.impact = Math.min(1, S.player.impact + .18);
    S.player.toolSwing = 1;
    return true;
};

S.updateMining = function updateMining(dt) {
    S.currentTarget = S.voxelRaycast(S.eyePos(), S.lookDir(), 6);
    if (!S.input.mouseLeft || S.paused) {
        S.mineAmount = 0;
        S.mineTargetKey = '';
        S.treeChopAim=null;
        S.setMiningHud(false);
        return;
    }
    if (S.enemyRayHit(3.65)) {
        S.attackEnemy();
        S.mineAmount = 0;
        S.mineTargetKey = '';
        S.treeChopAim=null;
        S.setMiningHud(false);
        return;
    }
    const hit = S.currentTarget;
    if (!hit || hit.id === S.B.BEDROCK || hit.id === S.B.WATER) {
        S.mineAmount = 0;
        S.mineTargetKey = '';
        S.treeChopAim=null;
        S.setMiningHud(false);
        return;
    }
    if(!S.canMineWithEquipped(hit.id)) {
        S.mineAmount=0;S.mineTargetKey='';S.treeChopAim=null;S.setMiningHud(false);
        if(!S.miningWarningTimer || S.miningWarningTimer<=0){S.showMessage('KAMIEŃ I RUDY: WYMAGANY KILOF',1.1);S.miningWarningTimer=1.8;}
        S.miningWarningTimer-=dt;
        return;
    }
    S.miningWarningTimer=0;
    const key = S.editKey(hit.x, hit.y, hit.z);
    if (key !== S.mineTargetKey) {
        S.mineTargetKey = key;
        S.mineAmount = 0;
        S.mineParticleTimer = 0;
        S.player.toolSwing = .45;
    }
    const def = S.blockDefs[hit.id], ore = hit.id === S.B.IRON || hit.id === S.B.GOLD;
    const tool = S.itemDefs[S.selectedItem()] || {};
    const baseNeed = S.miningSecondsFor(hit.id, hit.x, hit.y, hit.z) * 1.56;
    const need = Math.max(.54, ore && tool.tier === 'wood' ? Math.max(22, baseNeed) : baseNeed);
    const fallenDamage = S.fallenLogDamage?.get(key) || 0;
    if (S.mineAmount === 0 && fallenDamage > 0) S.mineAmount = fallenDamage;
    S.sampleTreeChopAim?.(hit,dt);
    S.mineAmount += dt / need;
    // Continuous durability cost, not just one point after breaking the block.
    // A wooden pickaxe on iron/gold incurs severe wear even when the attempt
    // is interrupted; stronger pickaxes are faster and last longer.
    if (tool.kind === 'tool') {
        const rate = ore ? (tool.tier === 'wood' ? 6.8 : tool.tier === 'gold' ? 1.65 : 1.0)
            : tool.tool === def.tool ? .32 : .80;
        S.mineWearTimer = (S.mineWearTimer || 0) + dt * rate;
        if (S.mineWearTimer >= .55) {
            const spend = S.mineWearTimer;
            S.mineWearTimer = 0;
            S.wearHeldTool(spend);
            if (!S.selectedItem() || !S.itemDefs[S.selectedItem()]?.tool) {
                S.mineAmount = 0; S.mineTargetKey = ''; S.setMiningHud(false); return;
            }
        }
    }
    S.setMiningHud(true, hit);
    S.mineParticleTimer -= dt;
    S.player.toolSwing = Math.max(S.player.toolSwing, .24 + Math.sin(performance.now() * .02) * .05);
    if (S.mineParticleTimer <= 0) {
        S.mineParticleTimer = .23 + Math.random() * .115;
        const mineMat = S.soundMaterialForBlock(hit.id);
        S.spawnDebris(hit.x, hit.y, hit.z, hit.id, S.mineAmount < .12 ? 4 : 2, false);
        S.sfx('mine', .72, mineMat);
        if (Math.random() < .34)
            S.emitPlayerNoise('mining', 18, .62, [hit.x + .5, hit.y + .5, hit.z + .5], .72, mineMat);
    }
    if (S.mineAmount >= 1) {
        S.breakBlockByPlayer(hit);
        S.mineAmount = 0;
        S.mineTargetKey = '';
        S.treeChopAim=null;
        S.setMiningHud(false);
    }
};

S.lastNightState = false;
S.whisperTimer = 8;

S.updateWeather = function updateWeather(dt, night) {
    S.weatherTimer -= dt;
    if (S.weatherTimer <= 0) {
        S.weatherTimer = 20 + Math.random() * 45;
        const biome = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2])), r = Math.random();
        if (['tundra', 'snow_peaks', 'frozen_shore'].includes(biome))
            S.weatherMode = r < .72 ? 'snow' : 'mist';
        else if (['swamp', 'marsh', 'forest', 'birch', 'darkwood', 'taiga', 'mountain_forest'].includes(biome))
            S.weatherMode = r < .48 ? 'rain' : r < .72 ? 'mist' : 'ash';
        else if (biome === 'highlands' || biome === 'barren')
            S.weatherMode = r < .55 ? 'ash' : 'mist';
        else
            S.weatherMode = r < .3 ? 'rain' : r < .55 ? 'ash' : 'mist';
        S.weatherIntensity = .25 + Math.random() * .7;
    }
    // True independent raindrops: world-space falling lines, voxel collision and
    // localized multi-droplet splash, never pre-placed random splashes.
    S.updateRain(dt);
    const count = Math.floor((S.weatherMode === 'snow' ? 5 : S.weatherMode === 'ash' ? 3 : S.weatherMode === 'mist' ? 1 : 0) * S.weatherIntensity * dt * 60);
    for (let i = 0; i < count; i++) {
        const x = S.player.pos[0] + (Math.random() - .5) * 26, z = S.player.pos[2] + (Math.random() - .5) * 26, y = S.player.pos[1] + 7 + Math.random() * 10;
        if (S.weatherMode === 'snow')
            S.spawnParticle([x, y, z], [(Math.random() - .5) * .65, -1.2 - Math.random() * 1.2, (Math.random() - .5) * .65], 4.5, [.72, .76, .73, .72], 3.2 + Math.random() * 2, 0, .05);
        else if (S.weatherMode === 'ash')
            S.spawnParticle([x, y, z], [(Math.random() - .5) * .8, -.65 - Math.random() * .8, (Math.random() - .5) * .8], 5.0, [.24, .25, .23, .54], 2.3 + Math.random() * 2, 0, .06);
        else if (Math.random() < .25)
            S.spawnParticle([x, y, z], [(Math.random() - .5) * .22, -.08, (Math.random() - .5) * .22], 7, [.48, .54, .5, .16], 5, 0, .02);
    }
    if (S.hasHeldTorch() && Math.random() < dt * 18) {
        const cam = S.eyePos(), d = S.lookDir(), right = [Math.cos(S.player.yaw), 0, Math.sin(S.player.yaw)];
        S.spawnParticle([cam[0] + right[0] * .42 + d[0] * .45, cam[1] - .34 + d[1] * .25, cam[2] + right[2] * .42 + d[2] * .45], [(Math.random() - .5) * .3, .5 + Math.random() * .8, (Math.random() - .5) * .3], .35 + Math.random() * .35, [1, .48 + .25 * Math.random(), .12, .9], 2.5 + Math.random() * 2, 1.2, .2);
    }
    const ph = (S.worldSeconds % S.DAY_SECONDS) / S.DAY_SECONDS, dusk = Math.max(0, 1 - Math.abs(ph - .73) / .10), bio = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2]));
    if (dusk > .25 && S.weatherMode !== 'rain' && ['forest', 'old_growth', 'mist_forest', 'willow_swamp', 'swamp', 'marsh', 'flower_meadow'].includes(bio) && Math.random() < dt * 2.1 * dusk) {
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 10;
        S.spawnParticle([S.player.pos[0] + Math.cos(a) * r, S.player.pos[1] + .6 + Math.random() * 2.6, S.player.pos[2] + Math.sin(a) * r], [(Math.random() - .5) * .18, (Math.random() - .5) * .08, (Math.random() - .5) * .18], 3.5 + Math.random() * 3, [.72, .82, .38, .82], 3 + Math.random() * 2, 0, .05);
    }
    S.UI.weatherInfo.textContent = S.weatherMode === 'rain' ? 'ULEWA · MOKRY TEREN' : S.weatherMode === 'snow' ? 'ŚNIEG · ZIMNO' : S.weatherMode === 'ash' ? 'POPIÓŁ W POWIETRZU' : 'CIĘŻKA MGŁA';
    S.UI.weatherInfo.style.opacity = String(.45 + S.weatherIntensity * .4 + night * .12);
};

S.rainDrops = [];
S.rainLineBuffer = S.gl.createBuffer();
S.glassDroplets = [];

S.rainEmitBudget = 0;
S.glassBudget = 0;
S.rainOverlayTime = 0;

S.makeRainDrop = function makeRainDrop() {
    const angle = Math.random() * Math.PI * 2, dist = 2 + Math.sqrt(Math.random()) * 23;
    const x = S.player.pos[0] + Math.cos(angle) * dist, z = S.player.pos[2] + Math.sin(angle) * dist;
    return { pos: [x, S.player.pos[1] + 8 + Math.random() * 16, z], vx: -2.7 + Math.random() * 1.1, vz: .8 + Math.random() * .8, vy: -25 - Math.random() * 12, length: .47 + Math.random() * .60 };
};

S.splashAtRainImpact = function splashAtRainImpact(x, y, z, onWater) {
    const tint = onWater ? [.53, .73, .77, 1] : [.60, .72, .75, 1];
    for (let j = 0; j < (onWater ? 5 : 3); j++) {
        const ang = Math.random() * Math.PI * 2, r = .45 + Math.random() * .85;
        S.spawnParticle([x, y + .025, z], [Math.cos(ang) * r, .75 + Math.random() * 1.2, Math.sin(ang) * r], .20 + Math.random() * .17, [...tint.slice(0, 3), .58 + Math.random() * .22], 2.0 + Math.random() * 1.8, 9, .23);
    }
    if (Math.random() < .11)
        S.spawnParticle([x, y + .03, z], [0, .11, 0], .23, [.64, .82, .86, .42], 3.6, 0, 0);
};
}
