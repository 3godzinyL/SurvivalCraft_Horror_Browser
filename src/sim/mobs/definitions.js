// NightCraft V15 · native ES module (sim/mobs/definitions.js); installs into the explicit shared state.
export function install(S) {
S.enemies = [];

S.enemyDefs = S.GAME_DATA.mobs.enemies;

S.naturalPackSeq = 1;

S.spawnEnemy = function spawnEnemy(type, x, z, adminSpawned = false, extra = {}) {
    const d = S.enemyDefs[type];
    if (!d)
        return null;
    const y = S.findSurface(Math.floor(x), Math.floor(z));
    if (y >= S.WORLD_H - 2)
        return null;
    const feet = S.getBlock(Math.floor(x), Math.floor(y + .08), Math.floor(z)), ground = S.getBlock(Math.floor(x), Math.floor(y - .12), Math.floor(z));
    if (feet === S.B.WATER || ground === S.B.WATER || ground === S.B.ICE)
        return null;
    const initialFacing = Math.random() * Math.PI * 2;
    const e = { type, pos: [x, y, z], velY: 0, hp: d.hp, maxHp: d.hp, attack: 0, wander: initialFacing, wanderTimer: 1 + Math.random() * 4, flash: 0, phase: Math.random() * Math.PI * 2, gait: 0, age: 0, stuck: 0, last: [x, z], facing: initialFacing, renderFacing: initialFacing, voice: 1 + Math.random() * 4, adminSpawned, awareness: adminSpawned ? 1 : 0, sightAwareness: adminSpawned ? 1 : 0, hearingAwareness: 0, spotted: !!adminSpawned, track: adminSpawned ? 30 : 0, packId: extra.packId || 0, lastSeen: [x, z], investigatePos: null, heardTimer: 0, searchTimer: 0, lastNoiseSeq: 0, lookTimer: .35 + Math.random() * 1.4, lookOffset: 0, lookTarget: 0, lookHold: 0, navPath: [], navTimer: Math.random() * .55, navGoal: null, searchStep: 0, roamPause: 0, alertMemory: 0, ...extra };
    S.enemies.push(e);
    return e;
};

S.choosePassiveSpawnType = function choosePassiveSpawnType(x, z) {
    const biome = S.biomeAt(Math.floor(x), Math.floor(z)), r = Math.random();
    if (['forest', 'birch', 'poplar_grove', 'autumn', 'darkwood', 'old_growth', 'mist_forest'].includes(biome))
        return r < .22 ? 'deer' : r < .39 ? 'doe' : r < .51 ? 'fox' : r < .68 ? 'rabbit' : r < .82 ? 'horse' : 'chicken';
    if (['meadow', 'flower_meadow', 'plains', 'riverlands'].includes(biome))
        return r < .22 ? 'cow' : r < .39 ? 'horse' : r < .55 ? 'deer' : r < .70 ? 'sheep' : r < .84 ? 'rabbit' : 'chicken';
    if (['taiga', 'spruce_valley', 'cold_plains', 'tundra'].includes(biome))
        return r < .30 ? 'moose' : r < .55 ? 'deer' : r < .77 ? 'rabbit' : 'fox';
    if (['swamp', 'marsh', 'willow_swamp'].includes(biome))
        return r < .48 ? 'rabbit' : r < .73 ? 'deer' : 'chicken';
    return r < .40 ? 'rabbit' : r < .68 ? 'deer' : r < .84 ? 'horse' : 'chicken';
};

S.chooseSpawnType = function chooseSpawnType(nightFactor, x, z) {
    const r = Math.random(), n = S.currentNightNumber();
    if (nightFactor > .50) {
        // Nights 1-2 are intentionally readable: wolves are the only real hostile.
        // Night 3 opens the rest of the horror roster.
        if (n <= 3)
            return 'wolf';
        if (r < .17)
            return 'crawler';
        if (r < .30)
            return 'watcher';
        if (r < .41)
            return 'wraith';
        if (r < .68)
            return 'wolf';
        if (r < .80)
            return 'boar';
        if (r < .91)
            return 'hyena';
        return 'bear';
    }
    return S.choosePassiveSpawnType(x, z);
};

S.spawnWolfPack = function spawnWolfPack(cx, cz, maxAllowed = 6) {
    // Natural wolf encounters are always real packs. If the population cap has
    // room for fewer than three, postpone the encounter rather than creating a
    // stray 1-2 wolf spawn that breaks the pack rules.
    if (maxAllowed < 3)
        return 0;
    const wanted = 3 + Math.floor(Math.random() * 4), count = Math.min(wanted, maxAllowed), packId = S.naturalPackSeq++;
    let spawned = 0;
    for (let i = 0; i < count; i++)
        for (let tries = 0; tries < 5; tries++) {
            const a = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - .5) * .7, r = 1.4 + Math.random() * 3.8, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
            const e = S.spawnEnemy('wolf', x, z, false, { packId });
            if (e) {
                e.wander = a + Math.PI + (Math.random() - .5) * .5;
                spawned++;
                break;
            }
        }
    return spawned;
};

S.spawnAroundPlayer = function spawnAroundPlayer(nightFactor) {
    const hour = S.currentWorldHour(), afterMidnight = hour < 6, base = S.difficulty === 'insane' ? 22 : S.difficulty === 'nightmare' ? 18 : 15, max = base + Math.floor(nightFactor * 8);
    if (S.enemies.length >= max)
        return 0;
    let tries = 8;
    while (tries--) {
        const ang = Math.random() * Math.PI * 2, dist = (afterMidnight && nightFactor > .5 ? 26 : 30) + Math.random() * (afterMidnight ? 34 : 28), x = S.player.pos[0] + Math.cos(ang) * dist, z = S.player.pos[2] + Math.sin(ang) * dist;
        if (Math.abs(S.terrainHeight(x, z) - S.player.pos[1]) > 30)
            continue;
        const type = S.chooseSpawnType(nightFactor, x, z);
        if (type === 'wolf')
            return S.spawnWolfPack(x, z, max - S.enemies.length);
        const e = S.spawnEnemy(type, x, z);
        return e ? 1 : 0;
    }
    return 0;
};

S.enemyAABB = function enemyAABB(e) { const d = S.enemyDefs[e.type]; return [[e.pos[0] - d.radius, e.pos[1], e.pos[2] - d.radius], [e.pos[0] + d.radius, e.pos[1] + d.height * 2, e.pos[2] + d.radius]]; };

S.enemyRayHit = function enemyRayHit(maxDist = 3.65) { const o = S.eyePos(), d = S.lookDir(); let best = null; for (const e of S.enemies) {
    const [mn, mx] = S.enemyAABB(e), t = S.rayAABB(o, d, mn, mx, maxDist);
    if (t !== null && (!best || t < best.t))
        best = { e, t };
} return best; };

S.attackEnemy = function attackEnemy() {
    if (S.player.attackCooldown > 0)
        return false;
    const h = S.enemyRayHit(3.65);
    if (!h)
        return false;
    S.player.attackCooldown = .34;
    S.player.toolSwing = 1;
    S.player.toolSwingSide *= -1;
    const held = S.itemDefs[S.selectedItem()] || {};
    let dmg = S.heldDamage();
    if (held.tool === 'sword')
        dmg = held.damage || 7;
    else if (held.tool === 'axe')
        dmg = held.damage || 5;
    h.e.hp -= dmg;
    S.wearHeldTool(1);
    h.e.flash = .15;
    S.spawnBlood(h.e.pos, 8 + Math.floor(dmg * .35));
    S.sfx('hit');
    if (h.e.hp <= 0) {
        const deadType = h.e.type, i = S.enemies.indexOf(h.e);
        if (i >= 0)
            S.enemies.splice(i, 1);
        S.player.kills++;
        S.grantXP(S.enemyDefs[deadType].passive ? 12 : 24);
        const def = S.enemyDefs[deadType];
        if (def.passive) {
            const hide = deadType === 'rabbit' ? 'rabbit_hide' : 'leather';
            const qty = deadType === 'rabbit' ? 1 + Math.floor(Math.random() * 2) : deadType === 'cow' || deadType === 'moose' ? 2 + Math.floor(Math.random() * 3) : Math.random() < .83 ? 1 : 0;
            if (qty)
                S.spawnItemDrop(hide, qty, [h.e.pos[0], h.e.pos[1] + .6, h.e.pos[2]], null, .65);
        }
        if (def.drop > 0)
            S.spawnItemDrop('rawmeat', def.drop + Math.floor(Math.random() * 2), [h.e.pos[0], h.e.pos[1] + .55, h.e.pos[2]], null, .65);
        if (Math.random() < .22)
            S.spawnItemDrop('coal', 1, [h.e.pos[0], h.e.pos[1] + .55, h.e.pos[2]], null, .65);
        for (let n = 0; n < 16; n++)
            S.spawnParticle([h.e.pos[0], h.e.pos[1] + .7, h.e.pos[2]], [(Math.random() - .5) * 2.5, 1 + Math.random() * 2, (Math.random() - .5) * 2.5], .35 + Math.random() * .45, [def.color[0] * 1.3, def.color[1] * 1.1, def.color[2] * 1.1, 1], 3 + Math.random() * 3, 8, .9);
        S.showMessage(`${def.name.toUpperCase()} PADŁ`);
    }
    return true;
};

S.entityCollides = function entityCollides(x, y, z, r = .34, h = .9) { return S.aabbHitsWorld([x - r, y, z - r, x + r, y + h * 2, z + r]); };

S.fortificationInPath = function fortificationInPath(e, mx, mz) { const sx = e.pos[0] + mx * 1.3, sz = e.pos[2] + mz * 1.3; for (const yy of [e.pos[1] + .15, e.pos[1] + .8]) {
    const x = Math.floor(sx), y = Math.floor(yy), z = Math.floor(sz), id = S.getBlock(x, y, z);
    if (S.isUpgradeableBlockId(id) && S.ensureFortification(x, y, z, id, true))
        return { x, y, z, id };
} return null; };

S.playerNearBuiltBase = function playerNearBuiltBase(radius = 12) { for (const [k, f] of S.fortifications) {
    if (!f)
        continue;
    const [x, y, z] = k.split(',').map(Number);
    if (Math.hypot(x + .5 - S.player.pos[0], z + .5 - S.player.pos[2]) <= radius)
        return true;
} return false; };
}
