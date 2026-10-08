// NightCraft V15 · native ES module (sim/mobs/navigation.js); installs into the explicit shared state.
export function install(S) {
S.navFloorAt = function navFloorAt(x, z, fromY, r = .32, h = .74) {
    const cx = x + .5, cz = z + .5, start = Math.round(fromY);
    for (const off of [0, 1, -1, 2, -2]) {
        const y = start + off;
        if (y < 2 || y >= S.WORLD_H - 4)
            continue;
        const ground = S.getBlock(x, y - 1, z);
        if (ground === S.B.WATER || ground === S.B.ICE || !S.blockDefs[ground]?.solid || S.isFoliage(ground))
            continue;
        if (!S.entityCollides(cx, y, cz, r, h))
            return y;
    }
    return null;
};

S.navCanGo = function navCanGo(x, z, fromY, r, h) {
    const ny = S.navFloorAt(x, z, fromY, r, h);
    return ny !== null && ny - fromY <= 1.2 && fromY - ny <= 1.7 ? ny : null;
};

S.planEnemyPath = function planEnemyPath(e, tx, tz, def, maxNodes = 145) {
    const x0 = Math.floor(e.pos[0]), z0 = Math.floor(e.pos[2]), gx = Math.floor(tx), gz = Math.floor(tz);
    if (Math.abs(gx - x0) + Math.abs(gz - z0) < 2)
        return [];
    const radius = 13, r = Math.min(.38, def.radius * .77), ht = Math.max(.38, def.height * .80), open = [{ x: x0, z: z0, y: Math.round(e.pos[1]), g: 0, f: 0, parent: null }], seen = new Map(), key = (x, z) => x + ',' + z;
    let best = open[0], bestH = Math.hypot(gx - x0, gz - z0), expanded = 0;
    while (open.length && expanded++ < maxNodes) {
        let bi = 0;
        for (let i = 1; i < open.length; i++)
            if (open[i].f < open[bi].f)
                bi = i;
        const cur = open.splice(bi, 1)[0], ck = key(cur.x, cur.z);
        if (seen.has(ck) && seen.get(ck) <= cur.g)
            continue;
        seen.set(ck, cur.g);
        const heuristic = Math.hypot(gx - cur.x, gz - cur.z);
        if (heuristic < bestH) {
            best = cur;
            bestH = heuristic;
        }
        if (heuristic < 1.4) {
            best = cur;
            break;
        }
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const nx = cur.x + ox, nz = cur.z + oz;
            if (Math.abs(nx - x0) > radius || Math.abs(nz - z0) > radius)
                continue;
            const ny = S.navCanGo(nx, nz, cur.y, r, ht);
            if (ny === null)
                continue;
            if (ox && oz && (S.navCanGo(cur.x + ox, cur.z, cur.y, r, ht) === null || S.navCanGo(cur.x, cur.z + oz, cur.y, r, ht) === null))
                continue;
            const g = cur.g + (ox && oz ? 1.414 : 1) + Math.max(0, ny - cur.y) * .55;
            if (seen.has(key(nx, nz)) && seen.get(key(nx, nz)) <= g)
                continue;
            open.push({ x: nx, z: nz, y: ny, g, f: g + Math.hypot(gx - nx, gz - nz) * 1.14, parent: cur });
        }
    }
    if (best === null || !best.parent || bestH > Math.max(3.2, Math.hypot(gx - x0, gz - z0) - 2))
        return [];
    const out = [];
    let node = best;
    while (node.parent && out.length < 32) {
        out.unshift([node.x + .5, node.z + .5]);
        node = node.parent;
    }
    return out.slice(0, 12);
};

S.navSteerAround = function navSteerAround(e, angle, def) {
    const r = def.radius * .77, h = Math.max(.38, def.height * .8), dy = e.pos[1];
    for (const offset of [0, .52, -.52, 1.05, -1.05, 1.55, -1.55, 2.25, -2.25]) {
        const a = angle + offset, x = e.pos[0] + Math.sin(a) * 1.15, z = e.pos[2] - Math.cos(a) * 1.15;
        if (!S.entityCollides(x, dy, z, r, h) && S.navCanGo(Math.floor(x), Math.floor(z), dy, r, h) !== null)
            return a;
    }
    // Entire sector blocked: do not spin 140° every frame. Wait and replan.
    return null;
};

S.updateEnemyLook = function updateEnemyLook(e, dt, dist, active) {
    e.lookTimer = (e.lookTimer ?? .8) - dt;
    if (e.lookTimer <= 0) {
        const interested = e.type === 'wolf' && dist < 12 && !active && Math.random() < .62;
        const toward = Math.atan2(S.player.pos[0] - e.pos[0], -(S.player.pos[2] - e.pos[2]));
        e.lookTarget = active ? 0 : interested ? S.clamp(S.angleDelta(e.facing, toward), -2.1, 2.1) : ((Math.random() - .5) * 2.7);
        e.lookTimer = active ? 1.2 : .75 + Math.random() * 2.2;
        if (!active && Math.random() < .38)
            e.roamPause = .24 + Math.random() * .85;
    }
    e.lookOffset = S.turnAngle(e.lookOffset || 0, active ? 0 : e.lookTarget || 0, dt * (active ? 7 : 2.6));
    e.roamPause = Math.max(0, (e.roamPause || 0) - dt);
};

S.updateEnemies = function updateEnemies(dt, nightFactor) {
    const hour = S.currentWorldHour(), deepNight = hour < 6, scentHour = hour >= 3 && hour < 6, baseNearby = scentHour && S.playerNearBuiltBase(13);
    let navBudget = 3; // spreads expensive path queries over frames
    for (let i = S.enemies.length - 1; i >= 0; i--) {
        const e = S.enemies[i], def = S.enemyDefs[e.type];
        e.age += dt;
        e.attack = Math.max(0, e.attack - dt);
        e.flash = Math.max(0, e.flash - dt);
        e.gait += dt * def.speed * 2.1;
        const dx = S.player.pos[0] - e.pos[0], dz = S.player.pos[2] - e.pos[2], dist = Math.hypot(dx, dz), vertical = Math.abs((S.player.pos[1] + .8) - (e.pos[1] + def.height));
        let active = false, investigating = false, targetX = S.player.pos[0], targetZ = S.player.pos[2], wolfSense = null;
        // Looking around is a real sensory action: a wolf does not see behind
        // itself until its head/body faces the player or the player makes noise.
        S.updateEnemyLook(e, dt, dist, !!e.spotted);
        if (e.type === 'wolf') {
            wolfSense = S.updateWolfAwareness(e, dt, dist);
            const scented = baseNearby && dist < (deepNight ? 43 : 34) && vertical < 12;
            if (scented && !e.spotted && dist < 35) {
                e.hearingAwareness = Math.max(e.hearingAwareness || 0, .30);
                e.investigatePos = [S.player.pos[0], S.player.pos[2]];
                e.heardTimer = Math.max(e.heardTimer || 0, 7);
            }
            if (e.spotted && e.track > 0) {
                active = true;
                if (wolfSense?.los) {
                    targetX = S.player.pos[0];
                    targetZ = S.player.pos[2];
                }
                else if (e.lastSeen) {
                    targetX = e.lastSeen[0];
                    targetZ = e.lastSeen[1];
                }
            }
            else if ((e.heardTimer > 0 || e.searchTimer > 0) && e.investigatePos) {
                investigating = true;
                active = true;
                targetX = e.investigatePos[0];
                targetZ = e.investigatePos[1];
                const td = Math.hypot(targetX - e.pos[0], targetZ - e.pos[2]);
                if (td < 1.85 && e.heardTimer > 0) {
                    e.heardTimer = 0;
                    e.searchTimer = Math.max(e.searchTimer, 4.5 + Math.random() * 3.5);
                    e.searchStep = 0;
                }
            }
            if (e.adminSpawned && dist < 50) {
                active = true;
                e.spotted = true;
                e.sightAwareness = 1;
                e.awareness = 1;
                targetX = S.player.pos[0];
                targetZ = S.player.pos[2];
            }
            if (investigating && e.searchTimer > 0 && e.heardTimer <= 0) {
                e.searchStep += dt;
                if (e.searchStep > 1.1) {
                    e.searchStep = 0;
                    e.searchAngle = (e.searchAngle || 0) + (Math.random() - .5) * 2.6;
                }
                targetX = e.investigatePos[0] + Math.sin(e.searchAngle || 0) * 3;
                targetZ = e.investigatePos[1] + Math.cos(e.searchAngle || 0) * 3;
            }
        }
        else if (!def.passive) {
            const inReach = (e.adminSpawned ? dist < 45 : dist < def.aggro * (def.night && nightFactor > .5 ? 1.2 : 1)) && vertical < 9;
            const visible = inReach && S.wolfLineOfSight(e);
            if (visible) {
                e.alertMemory = def.night ? 12 : 7;
                e.lastSeen = [S.player.pos[0], S.player.pos[2]];
            }
            else
                e.alertMemory = Math.max(0, (e.alertMemory || 0) - dt);
            active = inReach && (visible || e.alertMemory > 0);
            if (active && !visible && e.lastSeen) {
                targetX = e.lastSeen[0];
                targetZ = e.lastSeen[1];
            }
            // Night creatures hearing large nearby sounds may inspect, but don't
            // acquire an exact wall-penetrating live target.
            if (!active && def.night && dist < 18) {
                const sound = S.strongestPlayerNoiseForWolf(e);
                if (sound?.score > .23) {
                    active = true;
                    investigating = true;
                    targetX = sound.event.pos[0];
                    targetZ = sound.event.pos[2];
                }
            }
        }
        const fleeing = !!def.passive && dist < 7.8;
        let desiredAng;
        if (active) {
            desiredAng = Math.atan2(targetX - e.pos[0], -(targetZ - e.pos[2]));
            if (e.type === 'watcher' && dist > 7 && dist < 15)
                desiredAng += Math.sin(e.age * 1.6) * .22;
        }
        else if (fleeing)
            desiredAng = Math.atan2(-dx, dz);
        else {
            e.wanderTimer -= dt;
            if (e.wanderTimer <= 0) {
                e.wander += (-1.3 + Math.random() * 2.6);
                e.wanderTimer = .9 + Math.random() * 3.4;
            }
            desiredAng = e.wander;
        }
        e.navTimer = (e.navTimer || 0) - dt;
        const targetDist = Math.hypot(targetX - e.pos[0], targetZ - e.pos[2]);
        if (active && targetDist > 2.2) {
            const blockedAhead = S.entityCollides(e.pos[0] + Math.sin(desiredAng) * 1.15, e.pos[1], e.pos[2] - Math.cos(desiredAng) * 1.15, def.radius * .76, Math.max(.38, def.height * .8));
            const goalMoved = !e.navGoal || Math.hypot(targetX - e.navGoal[0], targetZ - e.navGoal[1]) > 3;
            if ((blockedAhead || e.stuck > .20 || e.navPath?.length || goalMoved) && e.navTimer <= 0 && navBudget > 0) {
                e.navPath = S.planEnemyPath(e, targetX, targetZ, def);
                e.navGoal = [targetX, targetZ];
                e.navTimer = .65 + Math.random() * .65;
                navBudget--;
            }
            if (e.navPath?.length) {
                while (e.navPath.length && Math.hypot(e.navPath[0][0] - e.pos[0], e.navPath[0][1] - e.pos[2]) < .74)
                    e.navPath.shift();
                if (e.navPath.length)
                    desiredAng = Math.atan2(e.navPath[0][0] - e.pos[0], -(e.navPath[0][1] - e.pos[2]));
            }
            if (blockedAhead && (!e.navPath || !e.navPath.length)) {
                const detour=S.navSteerAround(e,desiredAng,def);
                if(detour===null){
                    e.navHalt=Math.max(e.navHalt||0,.48);
                    e.navTimer=Math.min(e.navTimer,.18);
                    desiredAng=e.facing;
                } else desiredAng=detour;
            }
        }
        else {
            e.navPath = [];
            e.navGoal = null;
        }
        const turnSpeed = e.type === 'wolf' ? (e.spotted ? 9 : investigating ? 4.8 : 2.2) : 4.8;
        e.facing = S.turnAngle(e.facing ?? desiredAng, desiredAng, dt * turnSpeed);
        let ang = e.facing;
        if (e.type === 'wolf' && !active && dist < 11 && Math.abs(e.lookOffset || 0) > 1.2)
            ang = S.turnAngle(ang, ang + e.lookOffset * .55, dt * 3);
        e.voice -= dt;
        if (e.spotted && e.voice <= 0 && dist < 24) {
            S.sfx('growl', S.clamp(1 - dist / 30, .14, .78));
            e.voice = 2.8 + Math.random() * 6.2;
        }
        let activity = active ? 1 : fleeing ? .9 : .24;
        if (!active && e.roamPause > 0)
            activity = .015;
        if (e.type === 'wolf' && investigating && !e.spotted)
            activity = e.searchTimer > 0 ? .42 : .72;
        e.navHalt=Math.max(0,(e.navHalt||0)-dt);
        if(e.navHalt>0)activity=0; // blocked wolves observe instead of rotating in place
        let speed = def.speed * activity * (def.night ? (.44 + nightFactor * .72) : 1);
        if (e.type === 'wolf' && e.spotted && deepNight)
            speed *= 1.08;
        if (e.type === 'bear' && active && dist < 7)
            speed *= 1.22;
        if (e.type === 'crawler')
            speed *= 1 + Math.sin(e.gait) * .07;
        const mx = Math.sin(ang) * speed * dt, mz = -Math.cos(ang) * speed * dt, r = def.radius * .84, h = Math.max(.38, def.height * .82);
        // Deliberate one-block jump. Only jump with clearance AND a landing position,
        // never spam a jump against a wall taller than the creature.
        e.jumpCooldown = Math.max(0, (e.jumpCooldown || 0) - dt);
        if (e.grounded !== false && e.jumpCooldown <= 0 && speed > .1) {
            const probeX = e.pos[0] + Math.sin(ang) * Math.max(.65, r * 1.8), probeZ = e.pos[2] - Math.cos(ang) * Math.max(.65, r * 1.8);
            const stepY = S.navFloorAt(Math.floor(probeX), Math.floor(probeZ), e.pos[1], r, h);
            const rise = stepY == null ? 0 : stepY - e.pos[1];
            if (rise > .49 && rise <= 1.18 && !S.entityCollides(e.pos[0], e.pos[1] + .98, e.pos[2], r, h)) {
                e.velY = Math.max(e.velY, 6.0);
                e.grounded = false;
                e.jumpCooldown = .95;
            }
        }
        const beforeX = e.pos[0], beforeZ = e.pos[2];
        let barrier = null;
        if (!S.entityCollides(e.pos[0] + mx, e.pos[1], e.pos[2], r, h))
            e.pos[0] += mx;
        else if (active && (barrier = S.fortificationInPath(e, mx, 0))) {
            if (e.attack <= 0 && (e.type !== 'wolf' || e.spotted || scentHour))
                S.damageBarrierByEnemy(e, def, barrier);
        }
        else if (e.grounded !== false) {
            const fy = S.navFloorAt(Math.floor(e.pos[0] + mx), Math.floor(e.pos[2]), e.pos[1], r, h);
            if (fy !== null && fy > e.pos[1] + .48 && fy <= e.pos[1] + 1.2 && e.jumpCooldown <= 0) {
                e.velY = Math.max(e.velY, 6.0);
                e.jumpCooldown = .95;
            }
            else
                e.navTimer = Math.min(e.navTimer, .25);
        }
        barrier = null;
        if (!S.entityCollides(e.pos[0], e.pos[1], e.pos[2] + mz, r, h))
            e.pos[2] += mz;
        else if (active && (barrier = S.fortificationInPath(e, 0, mz))) {
            if (e.attack <= 0 && (e.type !== 'wolf' || e.spotted || scentHour))
                S.damageBarrierByEnemy(e, def, barrier);
        }
        else if (e.grounded !== false) {
            const fy = S.navFloorAt(Math.floor(e.pos[0]), Math.floor(e.pos[2] + mz), e.pos[1], r, h);
            if (fy !== null && fy > e.pos[1] + .48 && fy <= e.pos[1] + 1.2 && e.jumpCooldown <= 0) {
                e.velY = Math.max(e.velY, 6.0);
                e.jumpCooldown = .95;
            }
            else
                e.navTimer = Math.min(e.navTimer, .25);
        }
        const movedX = e.pos[0] - beforeX, movedZ = e.pos[2] - beforeZ, moved = Math.hypot(movedX, movedZ);
        if (moved > .002) {
            const moveFacing = Math.atan2(movedX, -movedZ);
            e.renderFacing = S.turnAngle(e.renderFacing ?? moveFacing, moveFacing, dt * (e.spotted ? 13 : 8));
        }
        else
            e.renderFacing = S.turnAngle(e.renderFacing ?? e.facing, e.facing + (e.lookOffset || 0) * .65, dt * 3.8);
        e.stuck = moved < .003 && active && targetDist > 2.2 ? e.stuck + dt : Math.max(0, e.stuck - dt * 2);
        if (e.stuck > .85) {
            e.navTimer = 0;
            e.navPath = [];
            e.navHalt=.45;
            e.navGoal=null;
            // No arbitrary 360° body spin; A* will choose the next safe waypoint.
            e.stuck = 0;
        }
        e.velY -= 17 * dt;
        const ny = e.pos[1] + e.velY * dt;
        if (!S.entityCollides(e.pos[0], ny, e.pos[2], r, h)) {
            e.pos[1] = ny;
            e.grounded = false;
        }
        else {
            if (e.velY < 0)
                e.pos[1] = Math.floor(e.pos[1] + .001);
            e.velY = 0;
            e.grounded = true;
        }
        const reach = e.type === 'bear' ? 1.8 : e.type === 'watcher' ? 1.65 : 1.45, canWolfAttack = e.type !== 'wolf' || e.spotted;
        if (!def.passive && active && canWolfAttack && dist < reach && vertical < 2.2 && e.attack <= 0) {
            e.attack = e.type === 'crawler' ? .78 : e.type === 'wraith' ? .72 : e.type === 'bear' ? 1.35 : e.type === 'wolf' ? .96 : 1.05;
            S.hurtPlayer(def.damage * (S.difficulty === 'insane' ? 1.25 : S.difficulty === 'nightmare' ? 1.08 : 1), def.name);
        }
    }
    S.cleanupEnemies(nightFactor);
};
}
