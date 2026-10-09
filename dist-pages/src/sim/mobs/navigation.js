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

S.planEnemyPath = function planEnemyPath(e, tx, tz, def, maxNodes = 380) {
    const x0 = Math.floor(e.pos[0]), z0 = Math.floor(e.pos[2]), gx = Math.floor(tx), gz = Math.floor(tz);
    if (Math.abs(gx - x0) + Math.abs(gz - z0) < 2)
        return [];
    const radius = 28, r = Math.min(.38, def.radius * .77), ht = Math.max(.38, def.height * .80), open = [{ x: x0, z: z0, y: Math.round(e.pos[1]), g: 0, f: 0, parent: null }], seen = new Map(), key = (x, z, y) => x + ',' + z + ',' + Math.round(y);
    let best = open[0], bestH = Math.hypot(gx - x0, gz - z0), expanded = 0;
    const mates=e.type==='wolf'?S.enemies.filter(o=>o!==e&&o.type==='wolf'&&o.packId===e.packId):[];
    while (open.length && expanded++ < maxNodes) {
        let bi = 0;
        for (let i = 1; i < open.length; i++)
            if (open[i].f < open[bi].f)
                bi = i;
        const cur = open.splice(bi, 1)[0], ck = key(cur.x, cur.z, cur.y);
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
            // Dynamic congestion cost: alternate routes instead of queueing at one tile.
            let crowd=0;
            for(const mate of mates){
                const dd=(nx+.5-mate.pos[0])**2+(nz+.5-mate.pos[2])**2;
                if(dd<5.0)crowd+=(5.0-dd)*.27;
            }
            const g = cur.g + (ox && oz ? 1.414 : 1) + Math.max(0, ny - cur.y) * .55 + crowd;
            if (seen.has(key(nx, nz, ny)) && seen.get(key(nx, nz, ny)) <= g)
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
    return out.slice(0, 28);
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
    let navBudget = 9; // spreads expensive path queries over frames
    for (let i = S.enemies.length - 1; i >= 0; i--) {
        const e = S.enemies[i], def = S.enemyDefs[e.type];
        e.age += dt;
        if(e.knockVel){
            const [vx,vz]=e.knockVel,r=def.radius*.8,ht=Math.max(.4,def.height*.82);
            const px=e.pos[0]+vx*dt,pz=e.pos[2]+vz*dt;
            if(!S.entityCollides(px,e.pos[1],pz,r,ht)){e.pos[0]=px;e.pos[2]=pz;}
            const fade=Math.exp(-7.0*dt);e.knockVel=[vx*fade,vz*fade];
            if(Math.hypot(...e.knockVel)<.06)e.knockVel=null;
        }
        e.impactAnim=Math.max(0,(e.impactAnim||0)-dt);
        if(def.flying){S.updateFlyingPredator(e,def,dt,nightFactor);continue;}
        if(e.type==='hollowed'){S.updateCaveHollowed(e,dt);continue;}
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
        // Once a pack has spotted the player it remembers movement cues for longer.
        if(e.type==='wolf'&&e.spotted&&e.track>0&&dist<20){
            if(e.heardTimer>0){targetX=S.player.pos[0];targetZ=S.player.pos[2];}
            e.track=Math.max(e.track,9);
        }
        if(active && e.type==='wolf') [targetX,targetZ]=S.predatorFormationTarget(e,targetX,targetZ,dist);
        // Hurt animals retain the attacker's position and find an obstacle-safe
        // escape corridor, rather than freezing once knockback runs out.
        e.fleeTimer=Math.max(0,(e.fleeTimer||0)-dt);
        const fleeing=!!def.passive&&(dist<9 || e.fleeTimer>0);
        if(fleeing){
            e.roamPause=0;
            e.fleeGoalTimer=(e.fleeGoalTimer||0)-dt;
            const origin=e.fleeTimer>0&&e.fleeOrigin?e.fleeOrigin:S.player.pos;
            const ax=e.pos[0]-origin[0], az=e.pos[2]-origin[1];
            const l=Math.max(.001,Math.hypot(ax,az));
            if(!e.fleeGoal || e.fleeGoalTimer<=0 || Math.hypot(e.fleeGoal[0]-e.pos[0],e.fleeGoal[1]-e.pos[2])<2){
                const side=e.fleeSide ?? (e.fleeSide=Math.random()<.5?-1:1);
                const drift=(.8+Math.random()*2.1)*side;
                e.fleeGoal=[e.pos[0]+ax/l*13-az/l*drift,e.pos[2]+az/l*13+ax/l*drift];
                e.fleeGoalTimer=1.9+Math.random()*.9;
                e.navTimer=0;
            }
            targetX=e.fleeGoal[0];targetZ=e.fleeGoal[1];
        }
        let desiredAng;
        if (active) {
            desiredAng = Math.atan2(targetX - e.pos[0], -(targetZ - e.pos[2]));
            if (e.type === 'watcher' && dist > 7 && dist < 15)
                desiredAng += Math.sin(e.age * 1.6) * .22;
        }
        else if (fleeing)
            desiredAng = Math.atan2(targetX-e.pos[0],-(targetZ-e.pos[2]));
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
        if ((active || fleeing) && targetDist > 2.2) {
            const blockedAhead = S.entityCollides(e.pos[0] + Math.sin(desiredAng) * 1.15, e.pos[1], e.pos[2] - Math.cos(desiredAng) * 1.15, def.radius * .76, Math.max(.38, def.height * .8));
            const goalMoved = !e.navGoal || Math.hypot(targetX - e.navGoal[0], targetZ - e.navGoal[1]) > 1.7;
            if ((blockedAhead || e.stuck > .13 || !e.navPath?.length || goalMoved) && e.navTimer <= 0 && navBudget > 0) {
                e.navPath = S.planEnemyPath(e, targetX, targetZ, def, e.stuck>.65?580:380);
                e.navGoal = [targetX, targetZ];
                e.navTimer = .22 + Math.random() * .24;
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
                    if(active && (!e.navPath?.length) && (e.type!=='wolf'||e.spotted)){
                        const obstacle=S.predatorObstacle(e,Math.atan2(targetX-e.pos[0],-(targetZ-e.pos[2])),def,1.65);
                        if(obstacle) S.damageObstacleByPredator(e,def,obstacle);
                    }
                    e.navHalt=Math.max(e.navHalt||0,.17);
                    e.navTimer=Math.min(e.navTimer,.18);
                    desiredAng=e.facing;
                } else desiredAng=detour;
            }
        }
        else {
            e.navPath = [];
            e.navGoal = null;
        }
        const turnSpeed = e.type === 'wolf' ? (e.spotted ? 6.8 : investigating ? 4.2 : 2.2) : 4.8;
        e.facing = S.turnAngle(e.facing ?? desiredAng, desiredAng, dt * turnSpeed);
        let ang = e.facing;
        if (e.type === 'wolf' && !active && dist < 11 && Math.abs(e.lookOffset || 0) > 1.2)
            ang = S.turnAngle(ang, ang + e.lookOffset * .55, dt * 3);
        e.voice -= dt;
        if (e.spotted && e.voice <= 0 && dist < 24) {
            S.sfx(Math.random()<.38?'wolf_bark':'growl', S.clamp(1 - dist / 30, .14, .78));
            e.voice = 2.8 + Math.random() * 6.2;
        }
        // Wild boars are a daytime threat too: audible snorts before a charge.
        if(e.type==='boar' && active && dist<20 && e.voice<=0){
            S.sfx(Math.random()<.5?'boar_grunt_1':'boar_grunt_2',S.clamp(1-dist/30,.28,.7));
            e.voice=2.7+Math.random()*3.7;
        }
        // Pounce has three states: readable anticipation -> brief jump -> recovery.
        // It cannot target through walls and has an independent 8-14 s cooldown.
        const mayPounce=(e.type==='wolf'||e.type==='boar')&&active&&
            (e.type!=='wolf'||e.spotted)&&!def.passive&&vertical<1.5;
        e.pounceCooldown=Math.max(0,(e.pounceCooldown??(4+((e.huntSlot??0)%5)))-dt);
        const previousPounceWindup=e.pounceWindup||0;
        e.pounceWindup=Math.max(0,previousPounceWindup-dt);
        e.pounceBurst=Math.max(0,(e.pounceBurst||0)-dt);
        if(mayPounce && dist>2.5 && dist<5.7 && e.pounceCooldown===0 &&
           e.pounceWindup===0 && e.pounceBurst===0 && e.grounded!==false &&
           !S.entityCollides(e.pos[0]+Math.sin(e.facing)*1.05,e.pos[1],e.pos[2]-Math.cos(e.facing)*1.05,def.radius*.85,def.height*.82)){
            e.pounceWindup=.43;e.pounceCooldown=9+Math.random()*5;e.navHalt=0;
            S.sfx(e.type==='wolf'?'growl':'boar_grunt_1',.54);
        }
        if(previousPounceWindup>0 && e.pounceWindup===0){
            e.pounceBurst=.38;
            e.velY=Math.max(e.velY||0,3.4);
            e.pounceHit=false;
            e.facing=Math.atan2(S.player.pos[0]-e.pos[0],-(S.player.pos[2]-e.pos[2]));
        }
        let activity = active ? 1 : fleeing ? 1.12 : .24;
        if (!active && e.roamPause > 0)
            activity = .015;
        if (e.type === 'wolf' && investigating && !e.spotted)
            activity = e.searchTimer > 0 ? .42 : .72;
        e.navHalt=Math.max(0,(e.navHalt||0)-dt);
        if(e.navHalt>0 && !fleeing)activity=0; // blocked wolves observe instead of rotating in place
        if(e.pounceWindup>0)activity=0;
        let speed = def.speed * activity * (def.night ? (.44 + nightFactor * .72) : 1);
        if (e.type === 'wolf' && e.spotted && deepNight)
            speed *= 1.08;
        if (e.type === 'bear' && active && dist < 7)
            speed *= 1.22;
        if (fleeing) speed*=1.12;
        if(e.pounceBurst>0){ speed*=2.0;ang=e.facing; }
        if (e.type === 'crawler')
            speed *= 1 + Math.sin(e.gait) * .07;
        const separation=S.predatorSeparation(e);
        // Blend steering with local velocity separation; prevent 3–6 wolves
        // collapsing into a single doorway/cell without teleportation.
        let walkX=Math.sin(ang),walkZ=-Math.cos(ang);
        const strength=active?.95:.70;
        const bx=walkX+separation[0]*strength,bz=walkZ+separation[1]*strength;
        const bn=Math.hypot(bx,bz);
        if(bn>.1){walkX=bx/bn;walkZ=bz/bn;}
        const mx = walkX * speed * dt, mz = walkZ * speed * dt, r = def.radius * .84, h = Math.max(.38, def.height * .82);
        // Deliberate one-block jump. Only jump with clearance AND a landing position,
        // never spam a jump against a wall taller than the creature.
        e.jumpCooldown = Math.max(0, (e.jumpCooldown || 0) - dt);
        if (e.grounded !== false && e.jumpCooldown <= 0 && speed > .1) {
            const probeX = e.pos[0] + walkX * Math.max(.78, r * 2.2), probeZ = e.pos[2] + walkZ * Math.max(.78, r * 2.2);
            const stepY = S.navFloorAt(Math.floor(probeX), Math.floor(probeZ), e.pos[1], r, h);
            const rise = stepY == null ? 0 : stepY - e.pos[1];
            if (rise > .49 && rise <= 1.18 && !S.entityCollides(e.pos[0], e.pos[1] + .98, e.pos[2], r, h)) {
                e.velY = Math.max(e.velY, 7.1);
                e.grounded = false;
                e.jumpCooldown = .72;
            }
        }
        const beforeX = e.pos[0], beforeZ = e.pos[2];
        let barrier = null;
        if (!S.entityCollides(e.pos[0] + mx, e.pos[1], e.pos[2], r, h))
            e.pos[0] += mx;
        else if (active && (barrier = S.predatorObstacle(e,ang,def))) {
            if(e.spotted||e.type!=='wolf'||scentHour)S.damageObstacleByPredator(e,def,barrier);
        }
        else if (e.grounded !== false) {
            const fy = S.navFloorAt(Math.floor(e.pos[0] + mx), Math.floor(e.pos[2]), e.pos[1], r, h);
            if (fy !== null && fy > e.pos[1] + .48 && fy <= e.pos[1] + 1.2 && e.jumpCooldown <= 0) {
                e.velY = Math.max(e.velY, 7.1);
                e.jumpCooldown = .72;
            }
            else
                e.navTimer = Math.min(e.navTimer, .25);
        }
        barrier = null;
        if (!S.entityCollides(e.pos[0], e.pos[1], e.pos[2] + mz, r, h))
            e.pos[2] += mz;
        else if (active && (barrier = S.predatorObstacle(e,ang,def))) {
            if(e.spotted||e.type!=='wolf'||scentHour)S.damageObstacleByPredator(e,def,barrier);
        }
        else if (e.grounded !== false) {
            const fy = S.navFloorAt(Math.floor(e.pos[0]), Math.floor(e.pos[2] + mz), e.pos[1], r, h);
            if (fy !== null && fy > e.pos[1] + .48 && fy <= e.pos[1] + 1.2 && e.jumpCooldown <= 0) {
                e.velY = Math.max(e.velY, 7.1);
                e.jumpCooldown = .72;
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
        e.stuck = moved < .003 && (active || fleeing) && targetDist > 2.2 ? e.stuck + dt : Math.max(0, e.stuck - dt * 2);
        if (e.stuck > .85) {
            e.navTimer = 0;
            e.navPath = [];
            e.navHalt=.17;
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
        const leapHit=e.pounceBurst>0 && !e.pounceHit;
        const canHitPlayer=e.type==='wolf' ? S.wolfLineOfSight(e) : !S.voxelRaycast([e.pos[0],e.pos[1]+.76,e.pos[2]], S.norm3([S.player.pos[0]-e.pos[0],S.player.pos[1]+.85-e.pos[1],S.player.pos[2]-e.pos[2]]), Math.max(0,dist-.45));
        if (!def.passive && active && canWolfAttack && canHitPlayer && dist < reach+(leapHit?.52:0) && vertical < 2.2 && e.attack <= 0 && e.pounceWindup===0) {
            e.attack = e.type === 'crawler' ? .78 : e.type === 'wraith' ? .72 : e.type === 'bear' ? 1.35 : e.type === 'wolf' ? .96 : 1.0;
            if(leapHit){
                e.pounceHit=true;
                const vx=S.player.pos[0]-e.pos[0],vz=S.player.pos[2]-e.pos[2],n=Math.max(.1,Math.hypot(vx,vz));
                S.player.vel[0]+=vx/n*1.65; S.player.vel[2]+=vz/n*1.65;
                S.cameraShake=Math.max(S.cameraShake||0,.21);
                S.sfx('hit',.72);
            }
            S.hurtPlayer(def.damage*(leapHit?.81:1) * (S.difficulty === 'insane' ? 1.25 : S.difficulty === 'nightmare' ? 1.08 : 1), def.name);
        }
    }
    S.cleanupEnemies(nightFactor);
};
}
