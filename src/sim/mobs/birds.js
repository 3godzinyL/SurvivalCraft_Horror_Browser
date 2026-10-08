// NightCraft V15 · native ES module (sim/mobs/birds.js); installs into the explicit shared state.
export function install(S) {
S.birds = [];

S.birdDefs = S.GAME_DATA.mobs.birds;

S.birdSpawnTimer = 2.2;

S.chooseBirdType = function chooseBirdType(x, z) {
    const b = S.biomeAt(Math.floor(x), Math.floor(z)), wet = ['beach', 'wet_shore', 'frozen_shore', 'riverlands', 'swamp', 'marsh', 'willow_swamp'].includes(b), r = Math.random();
    if (wet)
        return r < .42 ? 'gull' : r < .76 ? 'duck' : 'raven';
    return r < .73 ? 'raven' : r < .86 ? 'gull' : 'duck';
};

S.spawnBird = function spawnBird(type, x, z) {
    const d = S.birdDefs[type];
    if (!d)
        return;
    const surface = S.findSurface(Math.floor(x), Math.floor(z)), alt = type === 'duck' ? 5 + Math.random() * 4 : 8 + Math.random() * 10;
    S.birds.push({ type, pos: [x, Math.min(S.WORLD_H - 5, surface + alt), z], angle: Math.random() * Math.PI * 2, turn: (Math.random() - .5) * .26, phase: Math.random() * Math.PI * 2, age: 0, voice: 3 + Math.random() * 13 });
};

S.updateBirds = function updateBirds(dt, night) {
    S.birdSpawnTimer -= dt;
    const maxBirds = night > .68 ? 3 : 9;
    if (S.birdSpawnTimer <= 0 && S.birds.length < maxBirds) {
        S.birdSpawnTimer = 1.8 + Math.random() * 4.4;
        const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 38, x = S.player.pos[0] + Math.cos(a) * d, z = S.player.pos[2] + Math.sin(a) * d;
        S.spawnBird(S.chooseBirdType(x, z), x, z);
    }
    for (let i = S.birds.length - 1; i >= 0; i--) {
        const b = S.birds[i], d = S.birdDefs[b.type];
        b.age += dt;
        b.phase += dt * (7 + d.speed * .45);
        b.voice -= dt;
        const pd = Math.hypot(S.player.pos[0] - b.pos[0], S.player.pos[2] - b.pos[2]);
        if (pd > 96 || b.age > 150) {
            S.birds.splice(i, 1);
            continue;
        }
        // gentle circling with avoidance of world ceiling / terrain
        b.angle += b.turn * dt + Math.sin(b.age * .31 + b.phase * .1) * .025 * dt;
        b.pos[0] += Math.sin(b.angle) * d.speed * dt;
        b.pos[2] += -Math.cos(b.angle) * d.speed * dt;
        const floor = S.findSurface(Math.floor(b.pos[0]), Math.floor(b.pos[2]));
        const targetAlt = (b.type === 'duck' ? 4.6 : 9.5) + (Math.sin(b.age * .27 + b.phase) * 2.2);
        b.pos[1] = S.lerp(b.pos[1], Math.min(S.WORLD_H - 4, floor + targetAlt), S.clamp(dt * .42, 0, 1));
        if (b.voice <= 0 && pd < 42 && night < .78) {
            S.sfx(d.sound, S.clamp(1 - pd / 48, .16, .5));
            b.voice = 8 + Math.random() * 18;
        }
    }
};

S.renderBird = function renderBird(b, VP, fogColor, cam) {
    const d = S.birdDefs[b.type], ry = b.angle, flap = Math.sin(b.phase), s = d.size, body = [b.pos[0], b.pos[1], b.pos[2]], head = S.rotatedOffset(body, [0, .09, -.28 * s], ry);
    S.drawBox(VP, body, [.34 * s, .18 * s, .56 * s], d.color, ry, fogColor, cam, 0, flap * .04);
    S.drawBox(VP, head, [.20 * s, .19 * s, .22 * s], d.color, ry, fogColor, cam);
    const beak = b.type === 'raven' ? [.16, .13, .07, 1] : [.65, .48, .14, 1];
    S.drawBox(VP, S.rotatedOffset(head, [0, -.02, -.16 * s], ry), [.09 * s, .055 * s, .20 * s], beak, ry, fogColor, cam);
    for (const side of [-1, 1]) {
        const wing = S.rotatedOffset(body, [side * .27 * s, .02, .02], ry), rz = side * (.30 + flap * .58);
        S.drawBox(VP, wing, [.58 * s, .045 * s, .27 * s], d.wing, ry, fogColor, cam, 0, rz);
    }
    S.drawBox(VP, S.rotatedOffset(body, [0, .01, .32 * s], ry), [.22 * s, .05 * s, .28 * s], d.wing, ry, fogColor, cam, .15);
};
}
