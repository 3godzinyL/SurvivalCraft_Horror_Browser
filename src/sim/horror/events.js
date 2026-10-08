// NightCraft V15 · native ES module (sim/horror/events.js); installs into the explicit shared state.
export function install(S) {
S.apparitions = [];

S.apparitionTimer = 24 + Math.random() * 24;
S.blackoutTimer = 0;

S.phantomRun = { active: false, cooldown: 42 + Math.random() * 75, step: 0, total: 0, timer: 0, pan: 0, material: 'leaves' };

S.triggerBlackout = function triggerBlackout() { S.blackoutTimer = .92; S.apparitions.length = 0; S.sfx('wind', 1.0); S.sfx('growl', .25); };

S.spawnFirstNightApparition = function spawnFirstNightApparition() {
    if (S.currentNightNumber() !== 1 || S.apparitions.length)
        return false;
    const a = S.player.yaw + (Math.random() - .5) * 2.4, d = 22 + Math.random() * 15, x = S.player.pos[0] + Math.sin(a) * d, z = S.player.pos[2] - Math.cos(a) * d, y = S.findSurface(Math.floor(x), Math.floor(z));
    if (S.getBlock(Math.floor(x), Math.floor(y + .1), Math.floor(z)) === S.B.WATER)
        return false;
    S.apparitions.push({ pos: [x, y, z], age: 0, gait: 0, facing: Math.atan2(S.player.pos[0] - x, -(S.player.pos[2] - z)) });
    return true;
};

S.updateHorrorEvents = function updateHorrorEvents(dt, night) {
    S.blackoutTimer = Math.max(0, S.blackoutTimer - dt);
    if (S.UI.blackoutFlash)
        S.UI.blackoutFlash.style.opacity = String(S.clamp(S.blackoutTimer / .32, 0, 1));
    if (S.currentNightNumber() === 1 && night > .62) {
        S.apparitionTimer -= dt;
        if (S.apparitionTimer <= 0 && S.player.threat < .66) {
            S.spawnFirstNightApparition();
            S.apparitionTimer = 38 + Math.random() * 72;
        }
    }
    else {
        S.apparitions.length = 0;
        S.apparitionTimer = Math.max(S.apparitionTimer, 20);
    }
    for (let i = S.apparitions.length - 1; i >= 0; i--) {
        const a = S.apparitions[i], dx = S.player.pos[0] - a.pos[0], dz = S.player.pos[2] - a.pos[2], d = Math.hypot(dx, dz);
        a.age += dt;
        a.gait += dt * 11;
        a.facing = Math.atan2(dx, -dz);
        const sp = 6.3 + Math.min(2, a.age * .28);
        a.pos[0] += Math.sin(a.facing) * sp * dt;
        a.pos[2] -= Math.cos(a.facing) * sp * dt;
        a.pos[1] = S.lerp(a.pos[1], S.findSurface(Math.floor(a.pos[0]), Math.floor(a.pos[2])), S.clamp(dt * 4, 0, 1));
        if (d < 5.2) {
            S.triggerBlackout();
            break;
        }
        if (a.age > 10 || d > 70)
            S.apparitions.splice(i, 1);
    }
    const hostileNear = S.enemies.some(e => !S.enemyDefs[e.type].passive && Math.hypot(e.pos[0] - S.player.pos[0], e.pos[2] - S.player.pos[2]) < 30 && (e.type !== 'wolf' || e.spotted));
    if (!S.phantomRun.active) {
        S.phantomRun.cooldown -= dt;
        if (S.phantomRun.cooldown <= 0 && night > .32 && S.player.threat < .20 && S.player.sanity > 38 && !hostileNear) {
            S.phantomRun.active = true;
            S.phantomRun.step = 0;
            S.phantomRun.total = 10 + Math.floor(Math.random() * 7);
            S.phantomRun.timer = .15;
            S.phantomRun.pan = Math.random() < .5 ? -.82 : .82;
            S.phantomRun.material = Math.random() < .55 ? 'leaves' : 'dirt';
        }
    }
    else {
        S.phantomRun.timer -= dt;
        if (S.phantomRun.timer <= 0) {
            const p = S.phantomRun.step / Math.max(1, S.phantomRun.total - 1), variant = 1 + (S.phantomRun.step & 1), key = `step_${S.phantomRun.material}_${variant}`;
            S.playSpatialSample(key, .10 + p * .75, 1.02 + p * .28, S.phantomRun.pan * (1 - p * .80), (Math.random() - .5) * 45);
            S.phantomRun.step++;
            S.phantomRun.timer = S.lerp(.50, .17, p);
            if (S.phantomRun.step >= S.phantomRun.total) {
                S.phantomRun.active = false;
                S.phantomRun.cooldown = 55 + Math.random() * 110;
            }
        }
    }
};

S.renderApparitions = function renderApparitions(VP, fogColor, cam) { for (const a of S.apparitions) {
    const ry = -a.facing, g = Math.sin(a.gait), fade = S.clamp(Math.min(a.age * 1.6, 1), 0, 1), col = [.012, .014, .015, .96 * fade], base = a.pos;
    S.drawBox(VP, [base[0], base[1] + 1.45, base[2]], [.42, 2.55, .34], col, ry, fogColor, cam, 0, Math.sin(a.age * 1.9) * .025);
    S.drawBox(VP, S.rotatedOffset(base, [0, 2.92, -.08], ry), [.40, .50, .34], [.008, .009, .010, .98 * fade], ry, fogColor, cam);
    for (const side of [-1, 1])
        S.drawBox(VP, S.rotatedOffset(base, [side * .34, 1.38 + g * side * .06, -.02], ry), [.13, 1.65, .13], col, ry, fogColor, cam, g * side * .26);
    const ep = S.rotatedOffset(base, [0, 3.02, -.27], ry);
    for (const side of [-1, 1])
        S.drawBox(VP, S.rotatedOffset(ep, [side * .105, 0, 0], ry), [.024, .024, .018], [.72, .76, .68, .64 * fade], ry, fogColor, cam);
} };
}
