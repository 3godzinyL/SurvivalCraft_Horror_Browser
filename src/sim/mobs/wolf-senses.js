// NightCraft V15 · native ES module (sim/mobs/wolf-senses.js); installs into the explicit shared state.
export function install(S) {
S.playerNoiseEvents = [];

S.playerNoiseSeq = 1;

S.NOISE_MATERIAL = { grass: .82, dirt: .78, mud: .63, clay: .82, stone: 1.06, cobble: 1.12, brick: 1.12, wood: .96, plank: 1.02, sand: .72, snow: .58, gravel: 1.28, leaves: 1.24, glass: 1.18, metal: 1.36, ore: 1.20, water: 1.35 };

S.emitPlayerNoise = function emitPlayerNoise(kind, radius, intensity = 1, pos = null, ttl = 1.55, material = '') {
    if (!S.running || S.dead)
        return null;
    const p = pos ? [...pos] : [S.player.pos[0], S.player.pos[1] + .25, S.player.pos[2]], m = S.NOISE_MATERIAL[material] || 1;
    const ev = { seq: S.playerNoiseSeq++, kind, pos: p, radius: Math.max(1, radius * m), intensity: Math.max(.02, intensity), age: 0, ttl: Math.max(.18, ttl), material };
    S.playerNoiseEvents.push(ev);
    if (S.playerNoiseEvents.length > 36)
        S.playerNoiseEvents.splice(0, S.playerNoiseEvents.length - 36);
    return ev;
};

S.updatePlayerNoiseEvents = function updatePlayerNoiseEvents(dt) { for (let i = S.playerNoiseEvents.length - 1; i >= 0; i--) {
    const n = S.playerNoiseEvents[i];
    n.age += dt;
    if (n.age > n.ttl)
        S.playerNoiseEvents.splice(i, 1);
} };

S.soundOcclusionBetween = function soundOcclusionBetween(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz);
    if (d < 1)
        return 1;
    const step = .72, steps = Math.min(80, Math.ceil(d / step));
    let last = '', hard = 0, soft = 0;
    for (let i = 1; i < steps; i++) {
        const t = i / steps, x = Math.floor(a[0] + dx * t), y = Math.floor(a[1] + dy * t), z = Math.floor(a[2] + dz * t), key = `${x},${y},${z}`;
        if (key === last)
            continue;
        last = key;
        const id = S.getBlock(x, y, z);
        if (id === S.B.AIR || id === S.B.WATER || id === S.B.TORCH || S.blockDefs[id]?.decor)
            continue;
        if (S.isFoliage(id)) {
            soft++;
            continue;
        }
        if (S.blockDefs[id]?.solid) {
            hard++;
            if (hard >= 4)
                break;
        }
    }
    return S.clamp(Math.pow(.60, hard) * Math.pow(.89, soft), .10, 1);
};

S.strongestPlayerNoiseForWolf = function strongestPlayerNoiseForWolf(e) {
    let best = null, bestScore = 0;
    const ear = [e.pos[0], e.pos[1] + .72, e.pos[2]], hour = S.currentWorldHour(), deep = hour < 6;
    for (const n of S.playerNoiseEvents) {
        const dx = n.pos[0] - e.pos[0], dz = n.pos[2] - e.pos[2], d = Math.hypot(dx, dz), fade = S.clamp(1 - n.age / n.ttl, 0, 1);
        if (fade <= 0)
            continue;
        const rawRadius = n.radius * (deep ? 1.16 : 1) * (.88 + .12 * n.intensity);
        if (d >= rawRadius)
            continue;
        const occ = S.soundOcclusionBetween(ear, n.pos), effective = rawRadius * occ;
        if (d >= effective)
            continue;
        const score = S.clamp((1 - d / effective) * n.intensity * fade * (.72 + .28 * occ), 0, 1.35);
        if (score > bestScore) {
            bestScore = score;
            best = { event: n, score, dist: d, effectiveRadius: effective, occlusion: occ };
        }
    }
    return best;
};

S.wolfLineOfSight = function wolfLineOfSight(e) {
    const o = [e.pos[0], e.pos[1] + .72, e.pos[2]], target = [S.player.pos[0], S.player.pos[1] + 1.10, S.player.pos[2]], v = [target[0] - o[0], target[1] - o[1], target[2] - o[2]], d = Math.hypot(...v);
    if (d < .1)
        return true;
    const dir = [v[0] / d, v[1] / d, v[2] / d], hit = S.voxelRaycast(o, dir, Math.max(.15, d - .35));
    return !hit;
};

S.wolfSightState = function wolfSightState(e, dist) {
    const dx = S.player.pos[0] - e.pos[0], dz = S.player.pos[2] - e.pos[2], dl = dist || Math.hypot(dx, dz) || 1, fx = Math.sin((e.facing || 0) + (e.lookOffset || 0)), fz = -Math.cos((e.facing || 0) + (e.lookOffset || 0)), dot = (fx * dx + fz * dz) / dl, hour = S.currentWorldHour(), deep = hour < 6, planar = Math.hypot(S.player.vel[0], S.player.vel[2]), torch = S.hasHeldTorch();
    let range = deep ? 34 : 28;
    if (torch)
        range += 11;
    if (planar > 5.2)
        range += 3.5;
    else if (planar < .35)
        range -= 3;
    const fovDot = deep ? .14 : .23, near = dl < 7.0, inCone = dot > fovDot || near, los = dl < range && inCone && S.wolfLineOfSight(e), proximity = S.clamp(1 - dl / range, 0, 1), angle = near ? 1 : S.clamp((dot - fovDot) / (1 - fovDot), 0, 1);
    const motion = planar > 5.2 ? 1.20 : planar > 1.2 ? 1 : .70, light = torch ? 1.34 : 1, visibility = los ? S.clamp((.14 + proximity * .72 + angle * .32) * motion * light, 0, 1.55) : 0;
    return { dot, range, los, inCone, detecting: los, proximity, deep, visibility, fovDot, near };
};

S.wolfViewState = function wolfViewState(e, dist) { const sight = S.wolfSightState(e, dist), heard = S.strongestPlayerNoiseForWolf(e); return { ...sight, hearingSignal: heard?.score || 0, hearingRange: heard?.effectiveRadius || 0, heardKind: heard?.event?.kind || '', investigating: !!(e.heardTimer > 0 && e.investigatePos) }; };

S.alertWolfPack = function alertWolfPack(source, duration) { for (const w of S.enemies) {
    if (w.type !== 'wolf')
        continue;
    if (source.packId && w.packId !== source.packId && Math.hypot(w.pos[0] - source.pos[0], w.pos[2] - source.pos[2]) > 14)
        continue;
    w.spotted = true;
    w.sightAwareness = 1;
    w.awareness = 1;
    w.track = Math.max(w.track || 0, duration);
    w.lastSeen = [S.player.pos[0], S.player.pos[2]];
    w.investigatePos = [S.player.pos[0], S.player.pos[2]];
    w.heardTimer = Math.max(w.heardTimer || 0, 5);
} };

S.alertWolfPackToNoise = function alertWolfPackToNoise(source, pos, strength = .5) { for (const w of S.enemies) {
    if (w.type !== 'wolf' || w === source)
        continue;
    if (source.packId && w.packId !== source.packId)
        continue;
    const d = Math.hypot(w.pos[0] - source.pos[0], w.pos[2] - source.pos[2]);
    if (d > 18)
        continue;
    w.investigatePos = [pos[0], pos[1]];
    w.heardTimer = Math.max(w.heardTimer || 0, 3.5 + strength * 5);
    w.hearingAwareness = Math.max(w.hearingAwareness || 0, .18 + strength * .34);
} };

S.updateWolfAwareness = function updateWolfAwareness(e, dt, dist) {
    if (e.sightAwareness == null)
        e.sightAwareness = e.awareness || 0;
    if (e.hearingAwareness == null)
        e.hearingAwareness = 0;
    if (e.heardTimer == null)
        e.heardTimer = 0;
    if (e.searchTimer == null)
        e.searchTimer = 0;
    const v = S.wolfSightState(e, dist), heard = S.strongestPlayerNoiseForWolf(e);
    if (v.detecting) {
        const rate = .40 + v.visibility * 1.7 + (v.near ? 8.5 : 0);
        e.sightAwareness = S.clamp(e.sightAwareness + dt * rate, 0, 1);
        e.lastSeen = [S.player.pos[0], S.player.pos[2]];
        if (e.spotted)
            e.track = Math.max(e.track || 0, v.deep ? 34 : 20);
    }
    else
        e.sightAwareness = S.clamp(e.sightAwareness - dt * (e.spotted ? .045 : .17), 0, 1);
    if (heard && heard.event.seq !== e.lastNoiseSeq) {
        e.lastNoiseSeq = heard.event.seq;
        const pulse = S.clamp(.155 + heard.score * .58, 0, .59);
        e.hearingAwareness = S.clamp(e.hearingAwareness + pulse, 0, 1);
        e.investigatePos = [heard.event.pos[0], heard.event.pos[2]];
        e.heardTimer = Math.max(e.heardTimer, 3.2 + heard.score * 6.5);
        e.searchTimer = 0;
        if (heard.score > .26)
            S.alertWolfPackToNoise(e, e.investigatePos, heard.score);
    }
    e.heardTimer = Math.max(0, e.heardTimer - dt);
    e.searchTimer = Math.max(0, e.searchTimer - dt);
    e.hearingAwareness = S.clamp(e.hearingAwareness - dt * (e.heardTimer > 0 ? .035 : .105), 0, 1);
    if (e.sightAwareness >= 1 && !e.spotted) {
        e.spotted = true;
        e.track = v.deep ? 38 : 23;
        e.lastSeen = [S.player.pos[0], S.player.pos[2]];
        S.alertWolfPack(e, e.track);
        S.sfx('growl', .74);
    }
    // Very loud/repeated footsteps do not magically reveal the exact player
    // through walls: they put the wolf into a committed investigation/search.
    if (!e.spotted && e.hearingAwareness >= .92 && e.investigatePos) {
        e.heardTimer = Math.max(e.heardTimer, 9);
        e.searchTimer = Math.max(e.searchTimer, 4);
    }
    if (e.spotted) {
        if (v.los) {
            e.track = Math.max(e.track || 0, v.deep ? 38 : 23);
            e.lastSeen = [S.player.pos[0], S.player.pos[2]];
        }
        else
            e.track = Math.max(0, (e.track || 0) - dt);
        if (e.track <= 0 && dist > 10) {
            e.spotted = false;
            e.sightAwareness = Math.min(e.sightAwareness, .42);
            if (e.lastSeen) {
                e.investigatePos = [...e.lastSeen];
                e.heardTimer = Math.max(e.heardTimer, 6);
                e.searchTimer = Math.max(e.searchTimer, 5);
            }
        }
    }
    e.awareness = S.clamp(Math.max(e.sightAwareness, e.hearingAwareness * .88), 0, 1);
    return { ...v, heard, hearingSignal: heard?.score || 0 };
};

S.damageBarrierByEnemy = function damageBarrierByEnemy(e, def, barrier) {
    const wolf = e.type === 'wolf';
    e.attack = wolf ? 2.5 + Math.random() * 1.35 : 1.0 + Math.random() * .35;
    const damage = wolf ? Math.max(.7, def.damage * .075) : Math.max(4, def.damage * .48);
    S.damageFortification(barrier.x, barrier.y, barrier.z, damage, def.name);
};

S.cleanupEnemies = function cleanupEnemies(nightFactor) { for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i], d = S.enemyDefs[e.type], dist = Math.hypot(S.player.pos[0] - e.pos[0], S.player.pos[2] - e.pos[2]);
    if (dist > 82 || e.pos[1] < -5 || e.age > 240 || (d.night && nightFactor < .28 && dist > 34))
        S.enemies.splice(i, 1);
} const hardMax = S.difficulty === 'insane' ? 34 : S.difficulty === 'nightmare' ? 29 : 24; if (S.enemies.length > hardMax)
    S.enemies.sort((a, b) => Math.hypot(a.pos[0] - S.player.pos[0], a.pos[2] - S.player.pos[2]) - Math.hypot(b.pos[0] - S.player.pos[0], b.pos[2] - S.player.pos[2])).splice(hardMax); };

S.angleDelta = function angleDelta(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); };

S.turnAngle = function turnAngle(a, b, t) { return a + S.angleDelta(a, b) * S.clamp(t, 0, 1); };
}
