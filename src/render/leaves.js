// NightCraft V15 · native ES module (render/leaves.js); installs into the explicit shared state.
export function install(S) {
S.fallingLeaves = [];

S.LEAF_BLOCKS = new Set([S.B.LEAVES, S.B.PINELEAVES, S.B.BIRCHLEAVES, S.B.DARKLEAVES, S.B.AUTUMNLEAVES, S.B.WILLOWLEAVES, S.B.POPLARLEAVES, S.B.MIMOSALEAVES]);

S.leafEmitTimer = .035;
S.leafCachedEmitter=null;S.leafCacheTimer=0;
S.leafGustTimer = 1.5 + Math.random() * 3;
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
    return 0; let made = 0; for (let i = 0; i < count && S.fallingLeaves.length < 410; i++) {
    const size = .095 + Math.random() * .15, a = Math.random() * Math.PI * 2, windA = S.worldSeconds * .055 + Math.sin(S.worldSeconds * .013) * .8, wind = .18 + S.weatherIntensity * .28 + gust * .46;
    const col = S.leafColorForBlock(emitter.id);
    const mode=Math.random()<.32?'flutter':Math.random()<.54?'spiral':Math.random()<.76?'glide':'tumble';
    S.fallingLeaves.push({mode,phase:Math.random()*Math.PI*2,anchorWind:Math.random()*.5, pos: [emitter.x + .5 + (Math.random() - .5) * 1.25, emitter.y + .15 + (Math.random() - .5) * .8, emitter.z + .5 + (Math.random() - .5) * 1.25], vel: [Math.cos(windA) * wind + (Math.random() - .5) * .36, -.38 - Math.random() * .58, Math.sin(windA) * wind + (Math.random() - .5) * .36], life: 11 + Math.random() * 11, spin: Math.random() * 6.28, spin2: Math.random() * 6.28, spinSpeed: (Math.random() - .5) * 4.8, flutter: Math.random() * 6.28, size, color: col, settle: 0 });
    made++;
} return made; };

// A crown that hits the ground throws out actual tumbling leaves rather than
// just tiny square debris; velocity and color are inherited from the tree.
S.emitTreeCrashLeaves = function emitTreeCrashLeaves(tree, layY) {
    if (!tree?.leaves?.length) return 0;
    const count = Math.min(270,Math.max(72,Math.round(tree.leaves.length*1.45)));
    let made=0;
    for(let i=0;i<count;i++){
        if(S.fallingLeaves.length>=520) S.fallingLeaves.shift();
        const leaf=tree.leaves[Math.floor(Math.random()*tree.leaves.length)];
        const along=Math.random()*Math.max(2,tree.height*.86),theta=Math.random()*Math.PI*2;
        const radius=.6+Math.random()*2.7,dx=Math.cos(theta),dz=Math.sin(theta);
        const wind=.24+Math.random()*.8;
        const x=tree.root[0]+.5+tree.dx*along+radius*dx;
        const z=tree.root[2]+.5+tree.dz*along+radius*dz;
        S.fallingLeaves.push({
            mode:['tumble','flutter','glide','spiral'][i%4],phase:Math.random()*6.28,
            anchorWind:Math.random()*.5,
            pos:[x,layY+.12+Math.random()*1.3,z],
            vel:[dx*(1.0+Math.random()*2.8)+tree.dx*wind,.65+Math.random()*2.3,dz*(1.0+Math.random()*2.8)+tree.dz*wind],
            life:5+Math.random()*9,spin:Math.random()*6.28,spin2:Math.random()*6.28,
            spinSpeed:(Math.random()-.5)*10,flutter:Math.random()*6.28,
            size:.11+Math.random()*.18,color:S.leafColorForBlock(leaf[3]),settle:0
        });
        made++;
    }
    return made;
};

S.updateFallingLeaves = function updateFallingLeaves(dt) {
    S.leafRustleTimer = Math.max(0, S.leafRustleTimer - dt);
    S.leafCacheTimer -= dt;
    S.leafEmitTimer -= dt;
    S.leafGustTimer -= dt;
    const bio = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2])), forest = ['forest', 'old_growth', 'mist_forest', 'darkwood', 'birch', 'autumn', 'taiga', 'spruce_valley', 'poplar_grove', 'mountain_forest', 'willow_swamp'].includes(bio), planar = Math.hypot(S.player.vel[0], S.player.vel[2]);
    if (S.leafEmitTimer <= 0) {
        let emitter=S.leafCachedEmitter;
        if(S.leafCacheTimer<=0){emitter=S.findNearbyLeafEmitter(21,24);S.leafCachedEmitter=emitter;S.leafCacheTimer=.65+Math.random()*.6;}
        if (emitter) {
            const running = planar > 4.8, baseCount = 2 + Math.floor(Math.random()*3) + (running ? 2 : 0) + (S.weatherMode === 'rain'?1:0);
            S.spawnCanopyLeaves(emitter, baseCount, running ? .25 : 0);
            if (running && S.leafRustleTimer <= 0 && Math.random() < .16) {
                S.sfx('step', .20, 'leaves');
                S.leafRustleTimer = 1.2;
            }
        }
        else if (forest && Math.random() < .55) {
            const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 14, x = Math.floor(S.player.pos[0] + Math.cos(a) * r), z = Math.floor(S.player.pos[2] + Math.sin(a) * r), gy = S.findSurface(x, z);
            S.spawnCanopyLeaves({ x, y: gy + 5 + Math.floor(Math.random() * 4), z, id: bio === 'autumn' ? S.B.AUTUMNLEAVES : bio === 'birch' ? S.B.BIRCHLEAVES : S.B.LEAVES }, 2+Math.floor(Math.random()*3), 0);
        }
        S.leafEmitTimer = (S.weatherMode === 'rain' ? .07 : .105) + Math.random() * .09;
    }
    if (S.leafGustTimer <= 0) {
        const emitter = S.findNearbyLeafEmitter(22, 30);
        if (emitter)
            S.spawnCanopyLeaves(emitter, 10 + Math.floor(Math.random() * 12), 1);
        S.leafGustTimer = 2.8 + Math.random() * 6;
    }
    const windA = S.worldSeconds * .055 + Math.sin(S.worldSeconds * .013) * .8, windStrength = .12 + S.weatherIntensity * .22 + (S.weatherMode === 'rain' ? .18 : 0);
    for (let i = S.fallingLeaves.length - 1; i >= 0; i--) {
        const l = S.fallingLeaves[i];
        l.life -= dt;
        l.spin += l.spinSpeed * dt;
        l.spin2 += Math.sin(l.flutter + l.spin) * dt * 2.6;
        l.flutter += dt * (3.2 + Math.abs(l.spinSpeed));
        const flutter = Math.sin(l.flutter);
        const mode=l.mode||'flutter', t=l.flutter+l.phase;
        // Four movement families: gliding, tumble, spiral and flutter.
        if(mode==='spiral'){
            l.vel[0]+=Math.cos(t*.72)*dt*.7;l.vel[2]+=Math.sin(t*.72)*dt*.7;
            l.vel[1]+=Math.sin(t)*dt*.055;
        }else if(mode==='tumble'){
            l.vel[0]+=Math.sin(t*1.9)*dt*.45;l.vel[2]+=Math.cos(t*1.6)*dt*.45;
            l.vel[1]-=dt*.10;l.spinSpeed=Math.max(-5,Math.min(5,l.spinSpeed));
        }else if(mode==='glide'){
            l.vel[1]+=dt*.18;l.vel[0]+=Math.cos(t*.4)*dt*.18;
        }else{
            l.vel[1]+=Math.sin(t*2)*dt*.2;l.vel[2]+=Math.cos(t)*dt*.18;
        }
        l.vel[0] += Math.cos(windA) * windStrength * dt + Math.sin(l.flutter * .73) * dt * .15;
        l.vel[2] += Math.sin(windA) * windStrength * dt + Math.cos(l.flutter * .61) * dt * .15;
        l.vel[1] += (flutter * .09 - .055) * dt;
        l.vel[1]=S.clamp(l.vel[1],-1.9,-.18);
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
    if (++n > 330)
        break;
} };
}
