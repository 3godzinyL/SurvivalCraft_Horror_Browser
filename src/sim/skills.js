// NightCraft V15 · native ES module (sim/skills.js); installs into the explicit shared state.
export function install(S) {
S.generateRuinChestLoot = function generateRuinChestLoot(x, y, z) {
    const loot = Array(9).fill(null), r = (i) => S.hash3i(x + i * 17, y + 19, z - i * 13, S.worldSeed ^ 0xA981), pick = (i, options) => options[Math.floor(r(i) * options.length) % options.length];
    // Mostly trash with rare survival supplies and uncommon 1-2 ingots.
    const pool = ['scrap', 'stick', 'cobble', 'gravel', 'old_planks', 'roots', 'coal', 'berries', 'rope', 'torch', 'leather', 'bandage'];
    for (let i = 0; i < 9; i++) {
        if (r(i + 67) < .31)
            continue;
        const id = pick(i + 21, pool), count = ['scrap', 'stick', 'cobble', 'gravel', 'old_planks', 'roots'].includes(id) ? 1 + Math.floor(r(i + 89) * 5) : 1 + Math.floor(r(i + 89) * 2);
        loot[i] = { id, count };
    }
    if (r(202) > .66)
        loot[7] = { id: 'iron_ingot', count: r(203) > .70 ? 2 : 1 };
    if (r(205) > .935)
        loot[8] = { id: 'gold_ingot', count: 1 };
    if (r(206) > .90)
        loot[5] = { id: 'leather_chest', count: 1 };
    return loot;
};

S.openWorldChest = function openWorldChest(hit) {
    const key = S.fortKey(hit.x, hit.y, hit.z), isStart = S.starterChestPos && key === S.fortKey(...S.starterChestPos);
    if (!isStart && !S.ruinChests.has(key))
        S.ruinChests.set(key, S.generateRuinChestLoot(hit.x, hit.y, hit.z));
    S.openStarterChest();
    S.activeChestKey = isStart ? null : key;
    S.refreshInventoryUI();
};

S.sleepAtBedroll = function sleepAtBedroll(hit) {
    const key = S.fortKey(hit.x, hit.y, hit.z);
    if (!S.bedrolls.has(key))
        S.bedrolls.set(key, { orientation: 0 });
    S.respawnSite = [hit.x, hit.y, hit.z];
    const hour = S.currentWorldHour();
    if (hour >= 19 || hour < 6) {
        const timeToDawn = ((7 - hour + 24) % 24) / 24 * S.DAY_SECONDS;
        S.worldSeconds += timeToDawn;
        S.player.health = S.clamp(S.player.health + 28, 0, 100);
        S.player.sanity = S.clamp(S.player.sanity + 40, 0, 100);
        S.player.stamina = 100;
        S.player.hunger = S.clamp(S.player.hunger - 10, 0, 100);
        S.lastNightState = false;
        S.spawnTimer = 7;
        S.enemies.splice(0, S.enemies.length, ...S.enemies.filter(e => S.enemyDefs[e.type]?.passive));
        S.showMessage('Noc przespana · odrodzenie zapisane', 3);
    }
    else
        S.showMessage('Punkt odrodzenia zapisany. Śpij od 19:00 do 06:00.', 3);
    S.sfx('creak', .8);
    S.saveGame();
};

S.armorRating = function armorRating() { return Object.values(S.armorSlots).reduce((n, st) => n + (S.itemDefs[st?.id]?.armor || 0), 0); };

S.absorbArmorDamage = function absorbArmorDamage(damage) {
    const protection = Math.min(.72, S.armorRating() * .045), taken = damage * (1 - protection);
    if (protection > 0) {
        for (const part of Object.keys(S.armorSlots)) {
            const st = S.armorSlots[part];
            if (!st)
                continue;
            const def = S.itemDefs[st.id];
            S.armorWear[part] += (damage / 12) * (1 + Math.random() * .15);
            st.wear = S.armorWear[part];
            if (S.armorWear[part] >= def.durability) {
                S.armorSlots[part] = null;
                S.armorWear[part] = 0;
                S.showMessage(`${def.name} zniszczona!`, 2);
                S.sfx('break', .35, 'metal');
            }
        }
    }
    return taken;
};

S.activateXray = function activateXray() {
    if (S.playerLevel() < 1) {
        S.showMessage(`Zdobądź 1 LVL XP (${S.xp}/90).`, 1.7);
        return;
    }
    if (S.scanCooldown > 0) {
        S.showMessage(`X-RAY dostępny za ${Math.ceil(S.scanCooldown)} s`, 1.2);
        return;
    }
    const level=S.playerLevel();
    const duration=Math.min(32,14+Math.max(0,level-1)*1.7);
    const heal=Math.min(38,10+Math.max(0,level-1)*3.5); // 1 heart at L1, grows with progression
    S.player.health=S.clamp(S.player.health+heal,0,100);
    S.scanCooldown = 45;
    S.scanDuration = duration;
    S.scanPulse = 1.3;
    S.scanTargets = [];
    for (const e of S.enemies) {
        if (S.dist3(e.pos, S.player.pos) < 52)
            S.scanTargets.push({ type: 'enemy', entity: e });
    }
    const cx = Math.floor(S.player.pos[0]), cy = Math.floor(S.player.pos[1]), cz = Math.floor(S.player.pos[2]);
    for (let dz = -22; dz <= 22; dz += 2)
        for (let dx = -22; dx <= 22; dx += 2) {
            if (dx * dx + dz * dz > 22 * 22)
                continue;
            for (let y = Math.max(2, cy - 12); y <= Math.min(S.WORLD_H - 2, cy + 9); y += 2) {
                for (const ox of [0, 1])
                    for (const oz of [0, 1])
                        for (const oy of [0, 1]) {
                            const x = cx + dx + ox, z = cz + dz + oz, yy = y + oy, b = S.getBlock(x, yy, z);
                            if (b === S.B.IRON || b === S.B.COAL || b === S.B.GOLD || b === S.B.CHEST) {
                                S.scanTargets.push({ type: 'block', pos: [x + .5, yy + .5, z + .5], id: b });
                                if (S.scanTargets.length >= 210)
                                    break;
                            }
                        }
                if (S.scanTargets.length >= 210)
                    break;
            }
            if (S.scanTargets.length >= 210)
                break;
        }
    S.showMessage(`X-RAY LVL ${level} · +${Math.round(heal/10*10)/10} HP · ${S.scanTargets.length} celów na ${Math.round(duration)} s`, 2.1);
    S.sfx('pickup', .8);
};

S.renderScanHighlights = function renderScanHighlights(VP, fogColor, cam) {
    if (S.scanDuration <= 0)
        return;
    const t = S.scanDuration, blink = .62 + .23 * Math.sin(t * 7);
    S.gl.disable(S.gl.DEPTH_TEST);
    for (const obj of S.scanTargets) {
        let pos, scale, col;
        if (obj.type === 'enemy') {
            const e = obj.entity;
            if (!S.enemies.includes(e))
                continue;
            const def = S.enemyDefs[e.type];
            pos = [e.pos[0], e.pos[1] + def.height, e.pos[2]];
            scale = [def.radius * 2 + .30, def.height * 2 + .35, def.radius * 2 + .30];
            col = [1, .55, .10, .20 * blink];
        }
        else {
            if (S.getBlock(Math.floor(obj.pos[0]), Math.floor(obj.pos[1]), Math.floor(obj.pos[2])) !== obj.id)
                continue;
            pos = obj.pos;
            scale = [1.10, 1.10, 1.10];
            col = obj.id === S.B.CHEST ? [1, .72, .20, .30 * blink] : [.97, .66, .18, .18 * blink];
        }
        if (S.dist3(pos, cam) > 56)
            continue;
        S.drawBox(VP, pos, scale, col, 0, fogColor, cam);
    }
    S.gl.enable(S.gl.DEPTH_TEST);
};

S.renderBedrolls = function renderBedrolls(VP, fogColor, cam) {
    for (const [key, d] of S.bedrolls) {
        const [x, y, z] = key.split(',').map(Number);
        if (S.getBlock(x, y, z) !== S.B.BEDROLL)
            continue;
        if (Math.hypot(x + .5 - cam[0], z + .5 - cam[2]) > 48)
            continue;
        const pos = [x + .5, y + .11, z + .5], rot = d.orientation || 0, accent = S.respawnSite && key === S.fortKey(...S.respawnSite) ? [.66, .52, .22, 1] : [.35, .43, .35, 1];
        S.drawBox(VP, [pos[0], y + .055, pos[2]], [.85, .11, 1.12], [.18, .13, .10, 1], rot, fogColor, cam);
        S.drawBox(VP, [pos[0], y + .17, pos[2]], [.73, .22, 1.02], [.19, .24, .19, 1], rot, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(pos, [0, .11, -.28], rot), [.68, .20, .30], accent, rot, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(pos, [0, .115, -.32], rot), [.42, .035, .18], [.08, .10, .08, 1], rot, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(pos, [.28, .14, .09], rot), [.035, .025, .90], [.65, .56, .34, 1], rot, fogColor, cam);
        for (const az of [-.44, .44])
            S.drawBox(VP, S.rotatedOffset(pos, [0, .00, az], rot), [.84, .12, .06], [.40, .30, .18, 1], rot, fogColor, cam);
    }
};
}
