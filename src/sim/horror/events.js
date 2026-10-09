// NightCraft V15 · native ES module (sim/horror/events.js); installs into the explicit shared state.
export function install(S) {
S.apparitions = [];
S.forestEyes=[];
S.forestEyeClock=13+Math.random()*18;
S.forestScareClock=95+Math.random()*90;
S.forestScareAge=0;
S.forestScareOpacity=0;
S.occlusionClock=.18;
S.priorCloseOcclusion=0;
// Eye apparitions exist as actual distant world-space glows, not fixed HUD marks.
S.spawnForestEyes=function(){
    if(S.forestEyes.length>=2 || S.paused || S.dead)return;
    const biome=S.biomeAt(Math.floor(S.player.pos[0]),Math.floor(S.player.pos[2]));
    if(!['darkwood','old_growth','mist_forest','forest','taiga','spruce_valley','mountain_forest','birch','autumn'].includes(biome))return;
    for(let tries=0;tries<9;tries++){
        const theta=S.player.yaw+(Math.random()-.5)*2.8,d=13+Math.random()*19;
        const x=S.player.pos[0]+Math.sin(theta)*d,z=S.player.pos[2]-Math.cos(theta)*d,gy=S.findSurface(Math.floor(x),Math.floor(z));
        if(gy<=S.SEA||gy>S.WORLD_H-7)continue;
        let nearTree=false;
        for(const [ox,oz] of [[-1,0],[1,0],[0,-1],[0,1]]){
            const block=S.getBlock(Math.floor(x)+ox,Math.floor(gy)+2,Math.floor(z)+oz);
            if(S.LEAF_BLOCKS?.has(block)||[S.B.WOOD,S.B.PINEWOOD,S.B.DARKWOOD,S.B.BIRCHWOOD].includes(block))nearTree=true;
        }
        if(!nearTree)continue;
        S.forestEyes.push({x,y:gy+1.75+Math.random()*.45,z,ttl:4+Math.random()*6,blink:Math.random()*6.28});
        return;
    }
};
// Approximation of near-screen obstruction by voxel ray probes in a short camera frustum.
S.closeFrontOcclusion=function(){
    const yaw=S.player.yaw,pitch=S.player.pitch,px=S.player.pos[0],py=S.player.pos[1]+1.6,pz=S.player.pos[2];
    let covered=0;
    for(const h of [-.42,-.22,0,.22,.42])for(const v of [-.28,-.14,0,.14,.28]){
        const a=yaw+h,b=S.clamp(pitch+v,-1.4,1.4),dir=[Math.sin(a)*Math.cos(b),Math.sin(b),-Math.cos(a)*Math.cos(b)];
        let hit=false;
        for(const d of [.35,.7,1.05,1.38]){
            const x=Math.floor(px+dir[0]*d),y=Math.floor(py+dir[1]*d),z=Math.floor(pz+dir[2]*d);
            if(S.blockDefs[S.getBlock(x,y,z)]?.solid){hit=true;break;}
        }
        if(hit)covered++;
    }
    return covered/25;
};


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
    S.forestEyeClock-=dt;
    S.forestScareClock-=dt;
    S.forestScareAge=Math.max(0,S.forestScareAge-dt);
    for(const eye of S.forestEyes) {eye.ttl-=dt;eye.blink+=dt*1.5;}
    S.forestEyes=S.forestEyes.filter(e=>e.ttl>0&&Math.hypot(e.x-S.player.pos[0],e.z-S.player.pos[2])<48);
    if(night<.44)S.forestEyes.length=0;
    else if(S.forestEyeClock<=0){S.spawnForestEyes();S.forestEyeClock=18+Math.random()*38;}
    S.forestScareOpacity=Math.min(1,S.forestScareAge*5)*.93;
    S.occlusionClock-=dt;
    if(S.occlusionClock<=0){
        S.occlusionClock=.16;
        const planar=Math.hypot(S.player.vel[0],S.player.vel[2]);
        const movingFast=planar>5.0&&S.input.locked&&!S.paused;
        if(movingFast && night>.55 && S.forestScareClock<=0){
            const cover=S.closeFrontOcclusion();
            // Trigger on the instant a dense nearby tree occlusion opens up.
            if(S.priorCloseOcclusion>=.52&&cover<.42&&Math.random()<.42){
                S.forestScareAge=.42+Math.random()*.16;
                S.forestScareClock=105+Math.random()*145;
                S.sfx('jumpscare',.65);
                S.player.sanity=S.clamp(S.player.sanity-3.5,0,100);
            }
            S.priorCloseOcclusion=cover;
        }else if(!movingFast||night<=.55)S.priorCloseOcclusion=0;
    }
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

S.renderApparitions = function renderApparitions(VP, fogColor, cam) {
    for(const eye of S.forestEyes){
        const fade=S.clamp(Math.min(eye.ttl*1.5,1),0,1),blink=Math.sin(eye.blink*2.3)>.98?.02:1;
        const face=Math.atan2(S.player.pos[0]-eye.x,-(S.player.pos[2]-eye.z));
        for(const side of [-1,1]){
            const pos=S.rotatedOffset([eye.x,eye.y,eye.z],[side*.105,0,-.10],-face);
            S.drawBox(VP,pos,[.06,.031,.023],[.89,.95,.9,.90*fade*blink],-face,fogColor,cam);
        }
    }
    for (const a of S.apparitions) {
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
