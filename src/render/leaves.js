// NightCraft V15 · native ES module (render/leaves.js); installs into the explicit shared state.
export function install(S) {
S.fallingLeaves = [];

S.LEAF_BLOCKS = new Set([S.B.LEAVES, S.B.PINELEAVES, S.B.BIRCHLEAVES, S.B.DARKLEAVES, S.B.AUTUMNLEAVES, S.B.WILLOWLEAVES, S.B.POPLARLEAVES, S.B.MIMOSALEAVES]);

S.leafEmitTimer = .05;
S.leafGustTimer = 3 + Math.random() * 5;
S.leafRustleTimer = 0;

S.leafColorForBlock = function leafColorForBlock(id) { if (id === S.B.AUTUMNLEAVES)
    return Math.random() < .45 ? [.63, .25, .065, .96] : Math.random() < .55 ? [.48, .34, .06, .95] : [.42, .16, .045, .95]; if (id === S.B.BIRCHLEAVES)
    return [.42, .54, .18, .92]; if (id === S.B.PINELEAVES)
    return [.075, .22, .105, .94]; if (id === S.B.DARKLEAVES)
    return [.095, .18, .095, .94]; if (id === S.B.WILLOWLEAVES)
    return [.20, .38, .13, .92]; if (id === S.B.POPLARLEAVES)
    return [.25, .42, .12, .93]; if (id === S.B.MIMOSALEAVES)
    return [.34, .44, .13, .92]; return [.18 + .05 * Math.random(), .34 + .07 * Math.random(), .11 + .035 * Math.random(), .93]; };

S.findNearbyLeafEmitter = function findNearbyLeafEmitter(radius = 20, attempts = 18) {
    for (let n = 0; n < attempts; n++) {
        const a = Math.random() * Math.PI * 2, r = 2.5 + Math.sqrt(Math.random()) * radius, x = Math.floor(S.player.pos[0] + Math.cos(a) * r), z = Math.floor(S.player.pos[2] + Math.sin(a) * r), base = S.terrainHeight(x, z) + 1;
        for (let y = Math.min(S.WORLD_H - 2, base + 15); y >= base + 2; y--) {
            const id = S.getBlock(x, y, z);
            if (S.LEAF_BLOCKS.has(id))
                return { x, y, z, id };
        }
    }
    return null;
};

S.spawnCanopyLeaves = function spawnCanopyLeaves(emitter, count = 1, gust = 0) { if (!emitter)
    return 0; let made = 0; for (let i = 0; i < count && S.fallingLeaves.length < 150; i++) {
    const size = .12 + Math.random() * .10, a = Math.random() * Math.PI * 2, windA = S.worldSeconds * .055 + Math.sin(S.worldSeconds * .013) * .8, wind = .18 + S.weatherIntensity * .28 + gust * .46;
    const col = S.leafColorForBlock(emitter.id);
    S.fallingLeaves.push({ pos: [emitter.x + .5 + (Math.random() - .5) * 1.25, emitter.y + .15 + (Math.random() - .5) * .8, emitter.z + .5 + (Math.random() - .5) * 1.25], vel: [Math.cos(windA) * wind + (Math.random() - .5) * .36, -.38 - Math.random() * .58, Math.sin(windA) * wind + (Math.random() - .5) * .36], life: 10 + Math.random() * 10, spin: Math.random() * 6.28, spin2: Math.random() * 6.28, spinSpeed: (Math.random() - .5) * 4.8, flutter: Math.random() * 6.28, size, color: col, settle: 0 });
    made++;
} return made; };

S.updateFallingLeaves = function updateFallingLeaves(dt) {
    S.leafRustleTimer = Math.max(0, S.leafRustleTimer - dt);
    S.leafEmitTimer -= dt;
    S.leafGustTimer -= dt;
    const bio = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2])), forest = ['forest', 'old_growth', 'mist_forest', 'darkwood', 'birch', 'autumn', 'taiga', 'spruce_valley', 'poplar_grove', 'mountain_forest', 'willow_swamp'].includes(bio), planar = Math.hypot(S.player.vel[0], S.player.vel[2]);
    if (S.leafEmitTimer <= 0) {
        const emitter = S.findNearbyLeafEmitter(21, 22);
        if (emitter) {
            const running = planar > 4.8, baseCount = 1 + (Math.random() < (running ? .62 : .26) ? 1 : 0) + (S.weatherMode === 'rain' && Math.random() < .32 ? 1 : 0);
            S.spawnCanopyLeaves(emitter, baseCount, running ? .25 : 0);
            if (running && S.leafRustleTimer <= 0 && Math.random() < .16) {
                S.sfx('step', .20, 'leaves');
                S.leafRustleTimer = 1.2;
            }
        }
        else if (forest && Math.random() < .55) {
            const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 14, x = Math.floor(S.player.pos[0] + Math.cos(a) * r), z = Math.floor(S.player.pos[2] + Math.sin(a) * r), gy = S.findSurface(x, z);
            S.spawnCanopyLeaves({ x, y: gy + 5 + Math.floor(Math.random() * 4), z, id: bio === 'autumn' ? S.B.AUTUMNLEAVES : bio === 'birch' ? S.B.BIRCHLEAVES : S.B.LEAVES }, 1, 0);
        }
        S.leafEmitTimer = (S.weatherMode === 'rain' ? .075 : .12) + Math.random() * .10;
    }
    if (S.leafGustTimer <= 0) {
        const emitter = S.findNearbyLeafEmitter(22, 30);
        if (emitter)
            S.spawnCanopyLeaves(emitter, 6 + Math.floor(Math.random() * 8), 1);
        S.leafGustTimer = 4 + Math.random() * 9;
    }
    const windA = S.worldSeconds * .055 + Math.sin(S.worldSeconds * .013) * .8, windStrength = .12 + S.weatherIntensity * .22 + (S.weatherMode === 'rain' ? .18 : 0);
    for (let i = S.fallingLeaves.length - 1; i >= 0; i--) {
        const l = S.fallingLeaves[i];
        l.life -= dt;
        l.spin += l.spinSpeed * dt;
        l.spin2 += Math.sin(l.flutter + l.spin) * dt * 2.6;
        l.flutter += dt * (3.2 + Math.abs(l.spinSpeed));
        const flutter = Math.sin(l.flutter);
        l.vel[0] += Math.cos(windA) * windStrength * dt + Math.sin(l.flutter * .73) * dt * .15;
        l.vel[2] += Math.sin(windA) * windStrength * dt + Math.cos(l.flutter * .61) * dt * .15;
        l.vel[1] += (flutter * .10 - .055) * dt;
        l.vel[0] *= Math.pow(.94, dt);
        l.vel[2] *= Math.pow(.94, dt);
        l.pos[0] += l.vel[0] * dt;
        l.pos[1] += l.vel[1] * dt;
        l.pos[2] += l.vel[2] * dt;
        const gy = S.findSurface(Math.floor(l.pos[0]), Math.floor(l.pos[2]));
        if (l.pos[1] <= gy + .055) {
            l.pos[1] = gy + .055;
            l.settle += dt;
            l.vel = [0, 0, 0];
        }
        if (l.life <= 0 || l.settle > 1.3 || Math.hypot(l.pos[0] - S.player.pos[0], l.pos[2] - S.player.pos[2]) > 34)
            S.fallingLeaves.splice(i, 1);
    }
};

S.renderFallingLeaves = function renderFallingLeaves(VP, fogColor, cam) { let n = 0; for (const l of S.fallingLeaves) {
    if (Math.hypot(l.pos[0] - S.player.pos[0], l.pos[2] - S.player.pos[2]) > 30)
        continue;
    const fade = S.clamp(Math.min(l.life / 1.2, 1) * (l.settle ? 1 - l.settle / 1.3 : 1), 0, 1), col = [l.color[0], l.color[1], l.color[2], l.color[3] * fade], tilt = Math.sin(l.flutter) * .62;
    S.drawBox(VP, l.pos, [l.size, .018, l.size * .66], col, l.spin, fogColor, cam, tilt, l.spin2);
    if (++n > 130)
        break;
} };
}
