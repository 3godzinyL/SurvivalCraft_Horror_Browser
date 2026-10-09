// NightCraft V15 · native ES module (render/entities.js); installs into the explicit shared state.
export function install(S) {
S.cubeVerts = [];

for (const f of S.faces)
    for (const v of f.v)
        S.cubeVerts.push(v[0] - .5, v[1] - .5, v[2] - .5);

S.cubeBuffer = S.gl.createBuffer();

S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.cubeBuffer);

S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(S.cubeVerts), S.gl.STATIC_DRAW);

S.modelMatrix = function modelMatrix(pos, scale, ry = 0, rx = 0, rz = 0) { let m = S.M4.translation(pos[0], pos[1], pos[2]); if (ry)
    m = S.M4.multiply(m, S.M4.rotY(ry)); if (rx)
    m = S.M4.multiply(m, S.M4.rotX(rx)); if (rz)
    m = S.M4.multiply(m, S.M4.rotZ(rz)); m = S.M4.multiply(m, S.M4.scale(scale[0], scale[1], scale[2])); return m; };

S.outlineVerts = [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1];

S.outlineBuffer = S.gl.createBuffer();

S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.outlineBuffer);

S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(S.outlineVerts), S.gl.STATIC_DRAW);

// Six complete faces per damage stage: each +4% uncovers one more fine
// fracture on EVERY face.  The old buffer interleaved whole faces and
// truncating by percentage made the other five faces look undamaged.
S.crackVerts = [];
S.crackStages=24;
S.crackVertsPerStage=36; // one ribbon = 6 vertices, 6 faces
(() => {
    const faces=[['z',-.0016],['z',1.0016],['x',-.0016],['x',1.0016],['y',-.0016],['y',1.0016]];
    function ribbon(axis,fixed,a,b,c,d,width,reverse=false){
      const dx=c-a,dy=d-b,scale=width/(Math.hypot(dx,dy)||1),px=-dy*scale,py=dx*scale;
      const verts=[[a+px,b+py],[a-px,b-py],[c-px,d-py],[a+px,b+py],[c-px,d-py],[c+px,d+py]];
      for(let idx=0;idx<6;idx++){
        const [u,v]=verts[reverse ? Math.floor(idx/3)*3+2-idx%3 : idx];
        if(axis==='z')S.crackVerts.push(u,v,fixed);
        else if(axis==='x')S.crackVerts.push(fixed,u,v);
        else S.crackVerts.push(u,fixed,v);
      }
    }
    // A few branching fracture networks instead of 24 radial star-spokes.
    // Every stage adds ONE small linked segment on each face; after a couple
    // of percent damage even all six faces show fine but subtle cracking.
    const branches=[
      [[.17,.13],[.32,.23],[.42,.33],[.51,.48],[.57,.61],[.67,.70],[.78,.78],[.90,.86],[.95,.90]],
      [[.42,.33],[.39,.44],[.31,.52],[.24,.61],[.18,.71],[.13,.79]],
      [[.57,.61],[.68,.56],[.75,.47],[.80,.36],[.89,.31],[.94,.25]],
      [[.67,.70],[.64,.81],[.61,.90]],
      [[.51,.48],[.51,.38],[.60,.31],[.69,.26],[.79,.20]]
    ];
    const segments=[];
    // Interleave the branches so growing damage looks like advancing veins.
    const offsets=Array(branches.length).fill(0);
    const schedule=[0,0,0,1,0,1,0,2,0,1,2,0,1,2,3,2,1,3,4,2,4,4,4,0];
    for(const id of schedule){
      const path=branches[id],i=offsets[id]++;
      if(i<path.length-1)segments.push([path[i],path[i+1]]);
      else segments.push([[.48,.48],[.48,.48]]);
    }
    for(let stage=0;stage<S.crackStages;stage++){
      for(let face=0;face<6;face++){
        const [axis,fixed]=faces[face],[[ax,ay],[bx,by]]=segments[stage];
        // Stable tiny per-face offset avoids perfect repeated screen-space glyphs.
        const offset=(face-2.5)*.005;
        const clamp=x=>Math.max(.02,Math.min(.98,x));
        ribbon(axis,fixed,clamp(ax+offset),clamp(ay-offset),clamp(bx+offset),clamp(by-offset),.0010+(stage%6===0?.00032:0),face===0||face===2||face===5);
      }
    }
})();

S.crackBuffer = S.gl.createBuffer();

S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.crackBuffer);

S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(S.crackVerts), S.gl.STATIC_DRAW);

S.particleProgram = S.makeProgram(`
    attribute vec3 aPos; attribute vec4 aColor; attribute float aSize; uniform mat4 uVP; varying mediump vec4 vColor;
    void main(){vColor=aColor;gl_Position=uVP*vec4(aPos,1.0);gl_PointSize=aSize;}
  `, `
    precision mediump float; varying mediump vec4 vColor;
    void main(){vec2 p=gl_PointCoord-vec2(.5);if(dot(p,p)>.25)discard;gl_FragColor=vColor;}
  `);

S.PL = { pos: S.gl.getAttribLocation(S.particleProgram, 'aPos'), color: S.gl.getAttribLocation(S.particleProgram, 'aColor'), size: S.gl.getAttribLocation(S.particleProgram, 'aSize'), vp: S.gl.getUniformLocation(S.particleProgram, 'uVP') };

S.particlePosBuffer = S.gl.createBuffer();
S.particleColorBuffer = S.gl.createBuffer();
S.particleSizeBuffer = S.gl.createBuffer();

S.particles = [];

S.blockParticlePalette = {
    [S.B.GRASS]: [.23, .34, .18, 1], [S.B.DIRT]: [.34, .25, .16, 1], [S.B.STONE]: [.34, .36, .35, 1], [S.B.SAND]: [.46, .42, .31, 1], [S.B.WOOD]: [.28, .18, .11, 1], [S.B.LEAVES]: [.12, .25, .13, 1], [S.B.COAL]: [.08, .09, .085, 1], [S.B.IRON]: [.48, .31, .24, 1], [S.B.PLANKS]: [.39, .27, .16, 1], [S.B.MOSS]: [.18, .29, .18, 1], [S.B.GRAVEL]: [.34, .33, .30, 1], [S.B.MUD]: [.20, .18, .13, 1], [S.B.DARKSTONE]: [.18, .20, .21, 1], [S.B.PINEWOOD]: [.23, .16, .11, 1], [S.B.PINELEAVES]: [.08, .20, .11, 1], [S.B.DEADWOOD]: [.18, .13, .10, 1], [S.B.SNOW]: [.67, .69, .66, 1], [S.B.CLAY]: [.42, .38, .33, 1], [S.B.SLATE]: [.22, .25, .27, 1], [S.B.ROOTS]: [.24, .16, .10, 1]
};

S.spawnParticle = function spawnParticle(pos, vel, life, color, size = 4, gravity = 6, drag = .4) { if (S.particles.length > 420)
    S.particles.splice(0, S.particles.length - 420); S.particles.push({ pos: [...pos], vel: [...vel], life, maxLife: life, color: [...color], size, gravity, drag }); };

S.spawnDebris = function spawnDebris(x, y, z, id, count = 10, violent = false) { const mat = S.soundMaterialForBlock(id), fallback = mat === 'wood' ? [.32, .21, .12, 1] : mat === 'dirt' ? [.33, .24, .15, 1] : mat === 'grass' || mat === 'leaves' ? [.17, .29, .14, 1] : mat === 'sand' ? [.50, .44, .31, 1] : mat === 'snow' ? [.72, .75, .72, 1] : mat === 'glass' ? [.48, .64, .66, 1] : mat === 'metal' ? [.48, .50, .49, 1] : mat === 'ore' ? (id === S.B.GOLD ? [.54, .42, .16, 1] : id === S.B.IRON ? [.48, .31, .24, 1] : [.10, .10, .09, 1]) : mat === 'gravel' ? [.38, .36, .32, 1] : [.35, .36, .35, 1], c = S.blockParticlePalette[id] || fallback; for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = (violent ? 2.8 : 1.5) * (0.35 + Math.random());
    S.spawnParticle([x + .5 + (Math.random() - .5) * .6, y + .5 + (Math.random() - .5) * .6, z + .5 + (Math.random() - .5) * .6], [Math.cos(a) * s, (violent ? 2.0 : 1.1) + Math.random() * 2.0, Math.sin(a) * s], .35 + Math.random() * .55, [c[0] * (.75 + Math.random() * .4), c[1] * (.75 + Math.random() * .4), c[2] * (.75 + Math.random() * .4), 1], 3 + Math.random() * 3, 8, .8);
} };

S.spawnBlood = function spawnBlood(pos, count = 8) { for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = .6 + Math.random() * 2.2;
    S.spawnParticle([pos[0], pos[1] + .9, pos[2]], [Math.cos(a) * s, .7 + Math.random() * 2.3, Math.sin(a) * s], .3 + Math.random() * .35, [.38 + .18 * Math.random(), .025, .02, .95], 3 + Math.random() * 3, 9, 1.2);
} };

S.updateParticles = function updateParticles(dt) { for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
        S.particles.splice(i, 1);
        continue;
    }
    p.vel[1] -= p.gravity * dt;
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vel[0] *= drag;
    p.vel[2] *= drag;
    p.pos[0] += p.vel[0] * dt;
    p.pos[1] += p.vel[1] * dt;
    p.pos[2] += p.vel[2] * dt;
    if (p.gravity > 0 && S.blockDefs[S.getBlock(p.pos[0], p.pos[1], p.pos[2])]?.solid) {
        p.life = Math.min(p.life, .06);
    }
} };

S.droppedItems = [];

S.inventoryCapacity = function inventoryCapacity(id) { const max = S.maxStackFor(id); let cap = 0; for (let i = 0; i < S.INVENTORY_SIZE; i++) {
    const st = S.player.slots[i];
    if (st?.id === id)
        cap += Math.max(0, max - st.count);
    else if (!st && id !== 'bedroll')
        cap += max;
    else if (!st && id === 'bedroll') {
        const partner = S.bedrollPartnerIndex(i);
        if (partner >= 0 && !S.player.slots[partner]) {
            cap += max;
            i++;
        }
    }
} return cap; };

S.canStoreStacks = function canStoreStacks(stacks) {
    const sim = S.player.slots.map(S.cloneStack);
    for (const raw of stacks) {
        const st = S.normalizeStack(raw);
        if (!st)
            continue;
        let left = st.count, max = S.maxStackFor(st.id);
        for (let i = 0; i < sim.length && left > 0; i++) {
            const q = sim[i];
            if (q?.id === st.id && q.count < max) {
                const take = Math.min(max - q.count, left);
                q.count += take;
                left -= take;
            }
        }
        for (let i = 0; i < sim.length && left > 0; i++)
            if (!sim[i]) {
                const take = Math.min(max, left);
                sim[i] = { id: st.id, count: take };
                left -= take;
            }
        if (left > 0)
            return false;
    }
    return true;
};

S.spawnItemDrop = function spawnItemDrop(id, count, pos, vel = null, pickupDelay = .45) {
    if (!S.itemDefs[id] || count <= 0)
        return null;
    let left = Math.floor(count), max = S.maxStackFor(id);
    for (const d of S.droppedItems) {
        if (d.id !== id || d.count >= max || S.dist3(d.pos, pos) > 1.15 || d.age > .8)
            continue;
        const take = Math.min(max - d.count, left);
        d.count += take;
        left -= take;
        if (left <= 0)
            return d;
    }
    let first = null;
    while (left > 0) {
        const take = Math.min(max, left), a = Math.random() * Math.PI * 2, v = vel ? [...vel] : [Math.cos(a) * (.45 + Math.random() * .55), 2.1 + Math.random() * 1.4, Math.sin(a) * (.45 + Math.random() * .55)];
        const d = { id, count: take, pos: [...pos], vel: v, age: 0, pickupDelay, spin: Math.random() * Math.PI * 2, bob: Math.random() * Math.PI * 2, onGround: false };
        S.droppedItems.push(d);
        if (!first)
            first = d;
        left -= take;
    }
    if (S.droppedItems.length > 180)
        S.droppedItems.splice(0, S.droppedItems.length - 180);
    return first;
};

S.tryPickupDrop = function tryPickupDrop(d) {
    const cap = S.inventoryCapacity(d.id);
    if (cap <= 0)
        return false;
    const take = Math.min(cap, d.count), before = d.count;
    if (!S.addItem(d.id, take))
        return false;
    d.count -= take;
    if (before !== d.count)
        S.sfx('pickup', .74);
    return d.count <= 0;
};

S.updateDroppedItems = function updateDroppedItems(dt) {
    for (let i = S.droppedItems.length - 1; i >= 0; i--) {
        const d = S.droppedItems[i];
        d.age += dt;
        d.spin += dt * (1.65 + Math.min(1, Math.hypot(...(d.vel || [0, 0, 0]))));
        if (d.age > 300) {
            S.droppedItems.splice(i, 1);
            continue;
        }
        const bx = Math.floor(d.pos[0]), by = Math.floor(d.pos[1] - .17), bz = Math.floor(d.pos[2]), here = S.getBlock(bx, Math.floor(d.pos[1]), bz), below = S.getBlock(bx, by, bz);
        const inWater = here === S.B.WATER;
        if (inWater) {
            d.vel[1] += 8.5 * dt;
            d.vel[0] *= Math.pow(.35, dt);
            d.vel[2] *= Math.pow(.35, dt);
            d.vel[1] *= Math.pow(.28, dt);
        }
        else
            d.vel[1] -= 16.5 * dt;
        d.pos[0] += d.vel[0] * dt;
        d.pos[1] += d.vel[1] * dt;
        d.pos[2] += d.vel[2] * dt;
        d.vel[0] *= Math.pow(.55, dt);
        d.vel[2] *= Math.pow(.55, dt);
        const gy = Math.floor(d.pos[1] - .18), gid = S.getBlock(Math.floor(d.pos[0]), gy, Math.floor(d.pos[2]));
        if (S.blockDefs[gid]?.solid && gid !== S.B.WATER && d.vel[1] <= 0) {
            const top = gy + 1 + .18;
            if (d.pos[1] < top + .08) {
                d.pos[1] = top;
                d.vel[1] *= -.10;
                d.vel[0] *= .68;
                d.vel[2] *= .68;
                d.onGround = true;
            }
        }
        const dx = S.player.pos[0] - d.pos[0], dy = (S.player.pos[1] + .75) - d.pos[1], dz = S.player.pos[2] - d.pos[2], dist = Math.hypot(dx, dy, dz);
        if (d.age > d.pickupDelay && dist < 2.75) {
            const pull = S.clamp((2.8 - dist) * 5.4, 2.2, 12) * dt;
            d.pos[0] += dx / (dist || 1) * pull;
            d.pos[1] += dy / (dist || 1) * pull;
            d.pos[2] += dz / (dist || 1) * pull;
            if (dist < .72 && S.tryPickupDrop(d)) {
                S.droppedItems.splice(i, 1);
                continue;
            }
        }
    }
};
}
