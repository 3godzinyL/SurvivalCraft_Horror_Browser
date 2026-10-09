// NightCraft V15 · native ES module (render/weather.js); installs into the explicit shared state.
export function install(S) {
S.updateRain = function updateRain(dt) {
    const raining = S.weatherMode === 'rain', desired = raining ? Math.floor(90 + S.weatherIntensity * 250) : 0;
    S.rainEmitBudget += dt * (raining ? Math.max(20, desired * 3) : 0);
    while (S.rainEmitBudget >= 1 && S.rainDrops.length < desired) {
        S.rainEmitBudget--;
        S.rainDrops.push(S.makeRainDrop());
    }
    if (!raining) {
        S.rainEmitBudget = 0;
        if (S.rainDrops.length)
            S.rainDrops.splice(0, Math.min(S.rainDrops.length, Math.ceil(dt * 250)));
    }
    for (let i = S.rainDrops.length - 1; i >= 0; i--) {
        const p = S.rainDrops[i];
        const ox = p.pos[0], oy = p.pos[1], oz = p.pos[2];
        p.pos[0] += p.vx * dt;
        p.pos[1] += p.vy * dt;
        p.pos[2] += p.vz * dt;
        let hit = null;
        const steps = Math.max(1, Math.min(5, Math.ceil(Math.abs(p.vy * dt) / .34)));
        for (let k = 1; k <= steps; k++) {
            const t = k / steps, x = ox + (p.pos[0] - ox) * t, y = oy + (p.pos[1] - oy) * t, z = oz + (p.pos[2] - oz) * t;
            const id = S.getBlock(x, y, z);
            if (id !== S.B.AIR && (id === S.B.WATER || S.blockDefs[id]?.solid || id === S.B.LEAVES || id === S.B.PINELEAVES || id === S.B.BIRCHLEAVES)) {
                hit = { x, y: Math.floor(y) + 1.01, z, onWater: id === S.B.WATER };
                break;
            }
        }
        if (hit) {
            if (Math.random() < .58)
                S.splashAtRainImpact(hit.x, hit.y, hit.z, hit.onWater);
            S.rainDrops.splice(i, 1);
        }
        else if (p.pos[1] < S.player.pos[1] - 7 || Math.hypot(p.pos[0] - S.player.pos[0], p.pos[2] - S.player.pos[2]) > 30)
            S.rainDrops.splice(i, 1);
    }
    S.updateGlassRain(dt, raining);
};

S.updateGlassRain = function updateGlassRain(dt, raining) {
    if (!S.UI.rainFx?.getContext)
        return;
    const c = S.UI.rainFx, ratio = Math.min(1.5, window.devicePixelRatio || 1), w = Math.max(1, Math.floor(innerWidth * ratio)), h = Math.max(1, Math.floor(innerHeight * ratio));
    if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (raining) {
        S.glassBudget += dt * (.85 + S.weatherIntensity * 2.5);
        while (S.glassBudget > 1) {
            S.glassBudget--;
            if (S.glassDroplets.length < 24)
                S.glassDroplets.push({ x: Math.random() * w, y: -15, vel: 25 + Math.random() * 42, len: 16 + Math.random() * 40, life: 4 + Math.random() * 8, width: 1 + Math.random() * 1.4 });
        }
    }
    else
        S.glassBudget = 0;
    for (let i = S.glassDroplets.length - 1; i >= 0; i--) {
        const d = S.glassDroplets[i];
        d.vel = Math.min(160, d.vel + dt * 14);
        d.y += d.vel * dt;
        d.x += Math.sin(d.y * .026 + i) * dt * 6;
        d.life -= dt;
        if (d.y > h + 40 || d.life <= 0) {
            S.glassDroplets.splice(i, 1);
            continue;
        }
        const a = S.clamp(d.life / 5, 0, 1) * (raining ? .41 : .12);
        g.strokeStyle = `rgba(169,209,222,${a})`;
        g.lineWidth = d.width * ratio;
        g.beginPath();
        g.moveTo(d.x, d.y);
        g.bezierCurveTo(d.x + 3, d.y - d.len * .36, d.x - 2, d.y - d.len * .76, d.x + 1, d.y - d.len);
        g.stroke();
        g.fillStyle = `rgba(210,230,239,${a * .8})`;
        g.beginPath();
        g.ellipse(d.x, d.y, d.width * 1.5, d.width * 2.8, 0, 0, Math.PI * 2);
        g.fill();
    }
};

S.renderRain = function renderRain(VP) {
    if (!S.rainDrops.length)
        return;
    const coords = [];
    for (const p of S.rainDrops) {
        const dist = Math.hypot(p.pos[0] - S.player.pos[0], p.pos[2] - S.player.pos[2]);
        if (dist > 25)
            continue;
        coords.push(p.pos[0], p.pos[1], p.pos[2], p.pos[0] - p.vx / p.vy * p.length, p.pos[1] + p.length, p.pos[2] - p.vz / p.vy * p.length);
    }
    if (!coords.length)
        return;
    S.gl.useProgram(S.colorProgram);
    S.gl.uniformMatrix4fv(S.CL.mvp, false, VP);
    S.gl.uniform4fv(S.CL.color, new Float32Array([.53, .68, .76, .47]));
    S.gl.uniform1f(S.CL.fog, 0);
    S.gl.uniform3fv(S.CL.fogColor, [.1, .12, .13]);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.rainLineBuffer);
    S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(coords), S.gl.DYNAMIC_DRAW);
    S.gl.enableVertexAttribArray(S.CL.pos);
    S.gl.vertexAttribPointer(S.CL.pos, 3, S.gl.FLOAT, false, 0, 0);
    S.gl.drawArrays(S.gl.LINES, 0, coords.length / 3);
};

S.footstepMaterial = function footstepMaterial(id = null) {
    if (id == null) {
        const gx = Math.floor(S.player.pos[0]), gz = Math.floor(S.player.pos[2]), gy = Math.floor(S.player.pos[1] - .12);
        id = S.getBlock(gx, gy, gz);
    }
    if (id === S.B.WATER)
        return 'water';
    return S.soundMaterialForBlock(id);
};

S.updatePlayer = function updatePlayer(dt, night) {
    S.player.attackCooldown = Math.max(0, S.player.attackCooldown - dt);
    S.player.damageCooldown = Math.max(0, S.player.damageCooldown - dt);
    S.player.toolSwing = Math.max(0, S.player.toolSwing - dt * 3.7);
    S.player.impact = Math.max(0, S.player.impact - dt * 4.8);
    S.player.cameraShake = Math.max(0, S.player.cameraShake - dt * 3.3);
    S.player.sway = S.lerp(S.player.sway, 0, S.clamp(dt * 6, 0, 1));
    const feet = S.getBlock(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[1] + .2), Math.floor(S.player.pos[2])), chest = S.getBlock(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[1] + 1.05), Math.floor(S.player.pos[2])), head = S.getBlock(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[1] + 1.72), Math.floor(S.player.pos[2]));
    S.player.inWater = (feet === S.B.WATER || chest === S.B.WATER);
    if (S.player.inWater !== S.player.wasInWater) {
        S.sfx('splash', S.player.inWater ? 1 : .7);
        S.player.wasInWater = S.player.inWater;
    }
    let ix = (S.input.keys.has('KeyD') ? 1 : 0) - (S.input.keys.has('KeyA') ? 1 : 0), iz = (S.input.keys.has('KeyW') ? 1 : 0) - (S.input.keys.has('KeyS') ? 1 : 0);
    const il = Math.hypot(ix, iz) || 1;
    ix /= il;
    iz /= il;
    const crouch = S.input.keys.has('ControlLeft') && !S.player.inWater, sprint = !crouch && (S.input.keys.has('ShiftLeft') || S.input.keys.has('ShiftRight')) && iz > 0 && S.player.stamina > 2 && !S.player.inWater;
    let speed = S.player.inWater ? 2.95 : crouch ? 2.15 : sprint ? 7.0 : 4.55;
    if (S.player.hunger < 15)
        speed *= .8;
    if (feet === S.B.MUD)
        speed *= .72;
    if (feet === S.B.SNOW)
        speed *= .9;
    const fx = Math.sin(S.player.yaw), fz = -Math.cos(S.player.yaw), rx = Math.cos(S.player.yaw), rz = Math.sin(S.player.yaw), vx = (fx * iz + rx * ix) * speed, vz = (fz * iz + rz * ix) * speed;
    const accel = S.player.grounded ? 15 : S.player.inWater ? 5.6 : 7.8;
    S.player.vel[0] = S.lerp(S.player.vel[0], vx, S.clamp(accel * dt, 0, 1));
    S.player.vel[2] = S.lerp(S.player.vel[2], vz, S.clamp(accel * dt, 0, 1));
    if (S.player.inWater) {
        // Old Minecraft-style swimming: Space to rise, Shift to dive.
        // Neutral buoyancy at the surface, gentle sinking while submerged.
        // Never inject a permanent upward acceleration (old surface pogo bug).
        const submerged = head === S.B.WATER;
        const up = S.input.keys.has('Space');
        const down = S.input.keys.has('ShiftLeft') || S.input.keys.has('ShiftRight');
        const desiredVy = up ? (submerged ? 2.3 : .95) : down ? -2.5 : (submerged ? -.48 : -.22);
        S.player.vel[1] = S.lerp(S.player.vel[1], desiredVy, S.clamp(dt * 6, 0, 1));
        if (submerged && iz > 0 && S.player.pitch < -.30)
            S.player.vel[1] += Math.min(.8, -S.player.pitch * .55) * dt;
        S.player.vel[1] = S.clamp(S.player.vel[1], -2.8, 2.7);
        S.player.swimSound -= dt;
        if ((Math.hypot(S.player.vel[0], S.player.vel[2]) > 1 || S.input.keys.has('Space')) && S.player.swimSound <= 0) {
            S.sfx('swim', .7);
            S.emitPlayerNoise('swim', 15, .85, null, 1.1, 'water');
            S.player.swimSound = .45;
        }
    }
    else {
        S.player.vel[1] -= 19.2 * dt;
        S.player.swimSound = 0;
    }
    S.player.grounded = !S.player.inWater && S.playerGroundedAt();
    S.player.coyote = S.player.grounded ? .12 : Math.max(0, (S.player.coyote || 0) - dt);
    const jumpDown = S.input.keys.has('Space');
    if (jumpDown && !S.player.jumpHeld && !S.player.inWater)
        S.player.jumpBuffer = .14;
    else
        S.player.jumpBuffer = Math.max(0, (S.player.jumpBuffer || 0) - dt);
    S.player.jumpHeld = jumpDown;
    if (S.player.jumpBuffer > 0 && S.player.coyote > 0 && !S.player.inWater) {
        S.player.vel[1] = 7.65;
        S.player.jumpBuffer = 0;
        S.player.coyote = 0;
        S.player.grounded = false;
        S.player.impact = .08;
        const mat = S.footstepMaterial();
        S.sfx('step', .65, mat);
        S.emitPlayerNoise('jump', crouch ? 7 : 13, crouch ? .30 : .72, null, 1.2, mat);
    }
    const preVy = S.player.vel[1], preMoveX = S.player.pos[0], preMoveZ = S.player.pos[2];
    S.movePlayerAxis(0, S.player.vel[0] * dt);
    S.movePlayerAxis(2, S.player.vel[2] * dt);
    S.movePlayerAxis(1, S.player.vel[1] * dt);
    const travelled = Math.hypot(S.player.pos[0] - preMoveX, S.player.pos[2] - preMoveZ);
    if (travelled < 2.5)
        S.player.distanceWalked = (S.player.distanceWalked || 0) + travelled;
    const nowGround = S.playerGroundedAt();
    if (!S.player.inWater && nowGround && preVy < 0) {
        if (preVy < -11.5)
            S.hurtPlayer(Math.min(55, (Math.abs(preVy) - 10.5) * 5), 'upadek');
        if (preVy < -4.8) {
            const mat = S.footstepMaterial(), hard = S.clamp((Math.abs(preVy) - 4.8) / 8, 0, 1);
            S.emitPlayerNoise('landing', 10 + hard * 17, .55 + hard * .65, null, 1.45, mat);
        }
        S.player.grounded = true;
        S.player.vel[1] = 0;
        S.player.impact = Math.min(1, S.player.impact + S.clamp((Math.abs(preVy) - 3) / 12, 0, .6));
    }
    if (S.player.pos[1] < -8)
        S.hurtPlayer(999, 'otchłań');
    const planar = Math.hypot(S.player.vel[0], S.player.vel[2]), moving = planar > .65;
    if (S.player.grounded && moving) {
        S.player.movePhase += dt * (sprint ? 12 : crouch ? 5.6 : 8.3) * (planar / Math.max(speed, .01));
        S.player.stepDistance += planar * dt;
        const stride = sprint ? .92 : crouch ? 1.34 : 1.12;
        if (S.player.stepDistance >= stride) {
            S.player.stepDistance %= stride;
            const mat = S.footstepMaterial();
            S.sfx('step', crouch ? .42 : sprint ? 1.14 : 1.0, mat);
            S.emitPlayerNoise(crouch ? 'crouch_step' : sprint ? 'sprint_step' : 'step', crouch ? 5.5 : sprint ? 26 : 13.5, crouch ? .24 : sprint ? 1.12 : .66, null, crouch ? .72 : 1.35, mat);
        }
    }
    else if (!S.player.inWater)
        S.player.stepDistance = 0;
    const targetBob = S.player.grounded && moving ? Math.sin(S.player.movePhase * 2) * (.035 + (sprint ? .018 : 0)) : S.player.inWater ? Math.sin(performance.now() * .003) * .025 : 0;
    S.player.bob = S.lerp(S.player.bob, targetBob, S.clamp(dt * 14, 0, 1));
    if (moving)
        S.player.sway += Math.sin(S.player.movePhase) * .0025;
    if (sprint && moving) {
        S.player.stamina = S.clamp(S.player.stamina - 13.5 * dt, 0, 100);
        S.player.hunger = S.clamp(S.player.hunger - .05 * dt, 0, 100);
    }
    else
        S.player.stamina = S.clamp(S.player.stamina + (S.player.hunger > 10 ? 17 : 8) * dt, 0, 100);
    S.player.hunger = S.clamp(S.player.hunger - (.018 + (moving ? .014 : 0)) * dt, 0, 100);
    if (S.player.hunger <= 0 && S.player.damageCooldown <= 0)
        S.hurtPlayer(4, 'głód');
    if (S.player.hunger > 76 && S.player.health < 100)
        S.player.health = S.clamp(S.player.health + .46 * dt, 0, 100);
    const hasLight = S.hasHeldTorch(), sanityDelta = night > .62 && !hasLight ? -(.24 + .34 * night) : (.085 * (1 - night));
    S.player.sanity = S.clamp(S.player.sanity + sanityDelta * dt, 0, 100);
    if (S.player.sanity <= 0 && S.player.damageCooldown <= 0)
        S.hurtPlayer(3, 'panika');
    S.whisperTimer -= dt;
    if (S.player.sanity < 32 && S.whisperTimer <= 0) {
        const msgs = ['Coś idzie za tobą.', 'Nie patrz długo w las.', 'Słyszysz kroki, ale nie swoje.', 'W lesie coś oddycha razem z tobą.', 'Nie każda sylwetka jest drzewem.'];
        S.showMessage(msgs[Math.floor(Math.random() * msgs.length)], 2.3);
        S.whisperTimer = 5 + Math.random() * 8;
        S.sfx('howl', .3);
    }
    S.UI.vignette.style.opacity = String(.7 + (100 - S.player.sanity) / 250 + night * .16);
};

S.lineOfSightToEnemy = function lineOfSightToEnemy(e) {
    const o = S.eyePos(), target = [e.pos[0], e.pos[1] + S.enemyDefs[e.type].height, e.pos[2]], v = [target[0] - o[0], target[1] - o[1], target[2] - o[2]], d = Math.hypot(...v);
    if (d < .01)
        return true;
    const dir = [v[0] / d, v[1] / d, v[2] / d], hit = S.voxelRaycast(o, dir, Math.max(.2, d - .45));
    return !hit;
};

S.updateThreatSense = function updateThreatSense(dt) {
    let nearest = 999, visible = false, attacker = false, softWolf = 0;
    for (const e of S.enemies) {
        const def = S.enemyDefs[e.type];
        if (def.passive)
            continue;
        const d = Math.hypot(e.pos[0] - S.player.pos[0], e.pos[2] - S.player.pos[2]);
        if (e.type === 'wolf' && !e.spotted) {
            const sensory = Math.max((e.sightAwareness || 0) * .34, (e.hearingAwareness || 0) * .18);
            softWolf = Math.max(softWolf, sensory);
            continue;
        }
        if (d < nearest) {
            nearest = d;
            visible = d < 22 && S.lineOfSightToEnemy(e);
        }
        if (d < def.aggro * .75)
            attacker = true;
    }
    let target = softWolf;
    if (nearest < 26)
        target = Math.max(target, S.clamp((26 - nearest) / 22, 0, 1) * .62);
    if (visible)
        target = Math.max(target, S.clamp((22 - nearest) / 18, 0, 1) * .88);
    if (attacker)
        target = Math.max(target, .60);
    if (nearest < 5)
        target = 1;
    const rate = target > S.player.threat ? dt * 1.55 : dt * .55;
    S.player.threat = S.lerp(S.player.threat, target, S.clamp(rate, 0, 1));
    if (S.UI.threatPulse) {
        S.UI.threatPulse.style.opacity = String(S.clamp((S.player.threat - .10) * .88, 0, .78));
        S.UI.threatPulse.style.setProperty?.('--pulse', String(S.player.threat));
    }
    S.player.heartbeat -= dt;
    if (S.player.threat > .42 && S.player.heartbeat <= 0) {
        if (!S.playSample('heartbeat', .48 + S.player.threat * .42, .94 + S.player.threat * .08)) {
            S.tone(56, .11, .055 + S.player.threat * .035, 'sine', .72);
            S.tone(42, .13, .040 + S.player.threat * .025, 'sine', .66, .12);
        }
        S.player.heartbeat = S.lerp(1.25, .42, S.player.threat);
    }
    if (S.player.threat > .68)
        S.player.sanity = S.clamp(S.player.sanity - dt * .18 * S.player.threat, 0, 100);
};

S.updateWorld = function updateWorld(dt) {
    if (S.paused || !S.running || S.dead)
        return;
    S.worldSeconds += dt * 1.10; // V18 subtly faster day-night rhythm
    S.playSeconds += dt;
    S.player.days = S.worldSeconds / S.DAY_SECONDS;
    const night = S.nightLevel(), hour = S.currentWorldHour();
    S.scanCooldown = Math.max(0, S.scanCooldown - dt);
    S.scanDuration = Math.max(0, S.scanDuration - dt);
    S.scanPulse = Math.max(0, S.scanPulse - dt);
    S.updatePlayer(dt, night);
    S.updateMining(dt);
    S.updateFallingTrees?.(dt);
    S.updateUpgrade(dt);
    S.updateFurnaces(dt);
    S.updateEnemies(dt, night);
    S.predatorCleanupTick=(S.predatorCleanupTick||0)+dt;
    if(S.predatorCleanupTick>8){S.predatorCleanupTick=0;S.trimPredatorDamage();}
    S.updatePlayerNoiseEvents(dt);
    S.updateThreatSense(dt);
    S.updateHorrorEvents(dt, night);
    S.updateBirds(dt, night);
    S.updateFlyingSpawns(dt, night);
    S.updateWeather(dt, night);
    S.updateFallingLeaves(dt);
    S.updateCampfires?.(dt);
    S.updateParticles(dt);
    S.updateDroppedItems(dt);
    S.ambientAudioTick(dt, night);
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0) {
        S.spawnAroundPlayer(night);
        const afterMidnight = hour < 6, nightDelay = afterMidnight ? (2.4 + Math.random() * 2.4) : (5.2 + Math.random() * 4.0), dayDelay = 8 + Math.random() * 6;
        S.spawnTimer = (night > .5 ? nightDelay : dayDelay) * (S.difficulty === 'insane' ? .72 : S.difficulty === 'nightmare' ? .86 : 1);
    }
    const isNight = night > .68;
    if (isNight && !S.lastNightState) {
        if (S.currentNightNumber() <= 3)
            for (let i = S.enemies.length - 1; i >= 0; i--)
                if (!S.enemyDefs[S.enemies[i].type].passive && S.enemies[i].type !== 'wolf' && S.enemies[i].type !== 'hollowed' && !S.enemyDefs[S.enemies[i].type].flying)
                    S.enemies.splice(i, 1);
        S.UI.nightWarning.classList.remove('hidden');
        void S.UI.nightWarning.offsetWidth;
        S.UI.nightWarning.classList.add('hidden');
        requestAnimationFrame(() => S.UI.nightWarning.classList.remove('hidden'));
        setTimeout(() => S.UI.nightWarning.classList.add('hidden'), 3100);
        S.sfx('howl');
    }
    S.lastNightState = isNight;
    S.lightning = Math.max(0, S.lightning - dt * 3.2);
    S.lightningCooldown -= dt;
    if (isNight && S.lightningCooldown <= 0) {
        S.lightning = 1;
        const bio = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2]));
        if (!['tundra', 'snow_peaks', 'frozen_shore'].includes(bio)) {
            S.weatherMode = 'rain';
            S.weatherIntensity = Math.max(.82, S.weatherIntensity);
        }
        S.sfx('thunder');
        S.lightningCooldown = 15 + Math.random() * 48;
    }
    S.autoSave += dt;
    if (S.autoSave > 18) {
        S.autoSave = 0;
        S.saveGame();
    }
    if (S.messageTimer > 0) {
        S.messageTimer -= dt;
        if (S.messageTimer <= 0)
            S.UI.message.style.opacity = '0';
    }
    S.updateStreaming(S.player.pos[0], S.player.pos[2]);
    S.processDirty(2);
};
}
