// NightCraft V15 · native ES module (sim/player.js); installs into the explicit shared state.
export function install(S) {
S.INVENTORY_SIZE = 36;
S.HOTBAR_SIZE = 9;
S.DEFAULT_STACK = 64;

S.player = {
    pos: [0, 26, 0], vel: [0, 0, 0], yaw: 0, pitch: -.1, height: 1.8, eye: 1.62, width: .31,
    health: 100, hunger: 100, stamina: 100, sanity: 100, grounded: false, inWater: false,
    selected: 0, offhand: null, slots: Array(S.INVENTORY_SIZE).fill(null), craftSlots: Array(9).fill(null),
    torchRaised: false, attackCooldown: 0, damageCooldown: 0, fallSpeed: 0, kills: 0, blocksMined: 0, days: 0, stepTimer: 0,
    movePhase: 0, bob: 0, sway: 0, impact: 0, toolSwing: 0, toolSwingSide: 1, lastGroundY: 0, wasInWater: false, swimSound: 0, stepDistance: 0, threat: 0, cameraShake: 0, heartbeat: 0
};

S.input = { keys: new Set(), mouseLeft: false, mouseRight: false, mouseMiddle: false, locked: false, sensitivity: .0115 };

S.inventoryOpen = false;
S.adminOpen = false;
S.furnaceOpen = false;
S.mapOpen = false;
S.paused = true;
S.dead = false;
S.running = false;
S.debug = false;
S.adminMode = false;

S.currentTarget = null;
S.mineTargetKey = '';
S.mineAmount = 0;
S.messageTimer = 0;
S.cursorStack = null;
S.dragSource = null;

S.cursorX = innerWidth * .5;
S.cursorY = innerHeight * .5;
S.slotPaint = { active: false, visited: new Set() };

S.starterChestPos = null;
S.starterChestLoot = Array(9).fill(null);
S.chestOpen = false;
S.furnaceActiveKey = null;
S.activeChestKey = null;

S.ruinChests = new Map();
S.bedrolls = new Map();

S.respawnSite = null;

S.armorSlots = { head: null, chest: null, legs: null, feet: null };

S.armorWear = { head: 0, chest: 0, legs: 0, feet: 0 };

S.xp = 0;
S.scanCooldown = 0;
S.scanDuration = 0;
S.scanPulse = 0;
S.scanTargets = [];

S.cloneStack = (st) => st ? { id: st.id, count: st.count, ...(Number.isFinite(st.wear) ? { wear: st.wear } : {}) } : null;

S.maxStackFor = (id) => S.itemDefs[id]?.maxStack || S.DEFAULT_STACK;

S.BEDROLL_TAIL = '__bedroll_footprint';

S.isBedrollTail = st => st?.id === S.BEDROLL_TAIL;

S.bedrollPartnerIndex = i => i >= 0 && i < S.INVENTORY_SIZE && i % 9 !== 8 ? i + 1 : -1;

S.previewInventoryFootprints = function previewInventoryFootprints(changes = [], sourceSlots = S.player.slots) {
    const slots = sourceSlots.map(st => S.isBedrollTail(st) ? null : S.cloneStack(st));
    for (const [index, stack] of changes)
        if (index >= 0 && index < S.INVENTORY_SIZE)
            slots[index] = S.cloneStack(stack);
    // Two real inventory cells are reserved for each sleeping bag. Reject any
    // overlaps instead of silently overwriting items in the adjacent cell.
    for (let i = 0; i < slots.length; i++)
        if (slots[i]?.id === 'bedroll') {
            const partner = S.bedrollPartnerIndex(i);
            if (partner < 0 || slots[partner])
                return null;
            slots[partner] = { id: S.BEDROLL_TAIL, count: 1 };
        }
    return slots;
};

S.applyInventoryFootprints = function applyInventoryFootprints(changes = []) { const next = S.previewInventoryFootprints(changes); if (!next)
    return false; S.player.slots = next; return true; };

S.validInventoryFootprints = function validInventoryFootprints(changes = []) { return !!S.previewInventoryFootprints(changes); };

S.repairInventoryFootprints = function repairInventoryFootprints() {
    const source = S.player.slots.map(st => S.isBedrollTail(st) ? null : S.cloneStack(st));
    const bags = [];
    for (let i = 0; i < source.length; i++)
        if (source[i]?.id === 'bedroll') {
            bags.push(source[i]);
            source[i] = null;
        }
    for (const bag of bags) {
        let placed = false;
        for (let i = 0; i < source.length; i++) {
            const next = S.bedrollPartnerIndex(i);
            if (next < 0 || source[i] || source[next])
                continue;
            source[i] = bag;
            source[next] = { id: S.BEDROLL_TAIL, count: 1 };
            placed = true;
            break;
        }
        if (!placed) { // Legacy full inventories: preserve bag in offhand if available.
            if (!S.player.offhand)
                S.player.offhand = bag;
            else {
                const free = source.findIndex(st => !st);
                if (free >= 0)
                    source[free] = bag;
            }
        }
    }
    S.player.slots = source;
};

S.normalizeStack = function normalizeStack(st) { if (!st || !st.id || st.count <= 0)
    return null; const out = { id: st.id, count: Math.max(1, Math.floor(st.count)) }; if (Number.isFinite(st.wear) && S.itemDefs[st.id]?.durability)
    out.wear = S.clamp(Math.floor(st.wear), 0, S.itemDefs[st.id].durability - 1); return out; };

S.countItem = function countItem(id) { let n = 0; for (const st of S.player.slots)
    if (st?.id === id)
        n += st.count; if (S.player.offhand?.id === id)
    n += S.player.offhand.count; return n; };

S.firstEmptySlot = function firstEmptySlot(rangeStart = 0, rangeEnd = S.INVENTORY_SIZE) { for (let i = rangeStart; i < rangeEnd; i++)
    if (!S.player.slots[i])
        return i; return -1; };

S.addItem = function addItem(id, count = 1, preferredSlot = -1) {
    if (!S.itemDefs[id] || count <= 0)
        return false;
    count = Math.floor(count);
    if (S.inventoryCapacity(id) < count)
        return false;
    let left = count, max = S.maxStackFor(id);
    if (preferredSlot >= 0 && preferredSlot < S.INVENTORY_SIZE && !S.isBedrollTail(S.player.slots[preferredSlot]) && (id !== 'bedroll' || (S.bedrollPartnerIndex(preferredSlot) >= 0 && !S.player.slots[preferredSlot] && !S.player.slots[preferredSlot + 1]))) {
        const st = S.player.slots[preferredSlot];
        if (!st) {
            const take = Math.min(max, left);
            S.player.slots[preferredSlot] = { id, count: take };
            if (id === 'bedroll')
                S.player.slots[preferredSlot + 1] = { id: S.BEDROLL_TAIL, count: 1 };
            left -= take;
        }
        else if (st.id === id && st.count < max) {
            const take = Math.min(max - st.count, left);
            st.count += take;
            left -= take;
        }
    }
    for (let i = 0; i < S.INVENTORY_SIZE && left > 0; i++) {
        const st = S.player.slots[i];
        if (st?.id === id && st.count < max) {
            const take = Math.min(max - st.count, left);
            st.count += take;
            left -= take;
        }
    }
    for (let i = 0; i < S.INVENTORY_SIZE && left > 0; i++)
        if (!S.player.slots[i]) {
            if (id === 'bedroll' && (S.bedrollPartnerIndex(i) < 0 || S.player.slots[i + 1]))
                continue;
            const take = Math.min(max, left);
            S.player.slots[i] = { id, count: take };
            if (id === 'bedroll')
                S.player.slots[i + 1] = { id: S.BEDROLL_TAIL, count: 1 };
            left -= take;
        }
    S.refreshInventoryUI();
    S.refreshHotbar();
    return left === 0;
};

S.removeItem = function removeItem(id, count = 1) {
    if (S.countItem(id) < count)
        return false;
    let left = count;
    for (let i = S.INVENTORY_SIZE - 1; i >= 0 && left > 0; i--) {
        const st = S.player.slots[i];
        if (st?.id === id) {
            const take = Math.min(st.count, left);
            st.count -= take;
            left -= take;
            if (st.count <= 0) {
                S.player.slots[i] = null;
                if (id === 'bedroll' && S.isBedrollTail(S.player.slots[i + 1]))
                    S.player.slots[i + 1] = null;
            }
        }
    }
    if (left > 0 && S.player.offhand?.id === id) {
        const take = Math.min(S.player.offhand.count, left);
        S.player.offhand.count -= take;
        left -= take;
        if (S.player.offhand.count <= 0)
            S.player.offhand = null;
    }
    S.refreshInventoryUI();
    S.refreshHotbar();
    return left === 0;
};

S.selectedStack = function selectedStack() { return S.normalizeStack(S.player.slots[S.player.selected]); };

S.selectedItem = function selectedItem() { return S.selectedStack()?.id || null; };

S.offhandItem = function offhandItem() { return S.normalizeStack(S.player.offhand)?.id || null; };

S.hasHeldTorch = function hasHeldTorch() { return S.selectedItem() === 'torch' || S.offhandItem() === 'torch' || (S.player.torchRaised && S.countItem('torch') > 0); };

S.equippedPowerFor = function equippedPowerFor(blockId) {
    const item = S.itemDefs[S.selectedItem()] || {}, need = S.blockDefs[blockId]?.tool;
    if (!need)
        return item.tool ? 1.10 : .92;
    if (item.tool === need)
        return item.power || 2.6;
    // Wrong tool and bare hand always work, but they are clearly slower. Wooden
    // tools are deliberately early-game tools instead of instant block erasers.
    if (item.tool)
        return .88;
    return .68;
};

S.miningSecondsFor = function miningSecondsFor(blockId, x = 0, y = 0, z = 0) { return Math.max(.11, S.blockHardnessAt(x, y, z, blockId) * 1.12 / Math.max(.05, S.equippedPowerFor(blockId))); };

S.heldDamage = function heldDamage() { const it = S.itemDefs[S.selectedItem()] || {}; return it.damage || 3; };

S.lookDir = function lookDir() { const cp = Math.cos(S.player.pitch); return [Math.sin(S.player.yaw) * cp, Math.sin(S.player.pitch), -Math.cos(S.player.yaw) * cp]; };

S.eyePos = function eyePos() { return [S.player.pos[0], S.player.pos[1] + S.player.eye, S.player.pos[2]]; };

S.cameraEyePos = function cameraEyePos() { const base = S.eyePos(), right = [Math.cos(S.player.yaw), 0, Math.sin(S.player.yaw)], sh = S.player.cameraShake || 0, t = performance.now() * .045; return [base[0] + right[0] * S.player.sway * .45 + Math.sin(t * 1.7) * sh * .045, base[1] + S.player.bob - S.player.impact * .028 + Math.cos(t * 2.1) * sh * .028, base[2] + right[2] * S.player.sway * .45 + Math.cos(t * 1.3) * sh * .045]; };

S.playerAabbAt = function playerAabbAt(x, y, z) { return [x - S.player.width, y, z - S.player.width, x + S.player.width, y + S.player.height, z + S.player.width]; };

S.blockSolidAt = function blockSolidAt(x, y, z) { const b = S.getBlock(x, y, z); if (b === S.B.WOOD_DOOR) {
    const f = S.fortifications.get(S.fortKey(x, y, z));
    return !f?.open;
} return !!S.blockDefs[b]?.solid; };

S.aabbOverlap = function aabbOverlap(a, b) { return a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2]; };

S.constructionCollisionBoxes = function constructionCollisionBoxes(x, y, z, id) {
    const f = S.ensureFortification(x, y, z, id, true), q = ((Math.round((f?.orientation || 0) / (Math.PI / 2)) % 4) + 4) % 4;
    if (id === S.B.WOOD_DOOR) {
        if (f?.open)
            return [];
        const alongX = (q % 2) === 0;
        return [alongX ? [x + .08, y, z + .445, x + .92, y + 1.9, z + .555] : [x + .445, y, z + .08, x + .555, y + 1.9, z + .92]];
    }
    if (id === S.B.WOOD_FENCE) {
        return [[x + .41, y, z + .41, x + .59, y + 1.08, z + .59], [x + .04, y + .28, z + .435, x + .96, y + .76, z + .565], [x + .435, y + .28, z + .04, x + .565, y + .76, z + .96]];
    }
    if (id === S.B.WOOD_STAIRS) {
        const boxes = [[x, y, z, x + 1, y + .50, z + 1]];
        if (q === 0)
            boxes.push([x, y + .50, z, x + 1, y + 1, z + .50]);
        else if (q === 2)
            boxes.push([x, y + .50, z + .50, x + 1, y + 1, z + 1]);
        else if (q === 1)
            boxes.push([x, y + .50, z, x + .50, y + 1, z + 1]);
        else
            boxes.push([x + .50, y + .50, z, x + 1, y + 1, z + 1]);
        return boxes;
    }
    return [[x, y, z, x + 1, y + 1, z + 1]];
};

S.aabbHitsWorld = function aabbHitsWorld(a) {
    const minX = Math.floor(a[0]), minY = Math.floor(a[1] + 1e-5), minZ = Math.floor(a[2]), maxX = Math.floor(a[3] - 1e-5), maxY = Math.floor(a[4] - 1e-5), maxZ = Math.floor(a[5] - 1e-5);
    for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
            for (let x = minX; x <= maxX; x++) {
                const id = S.getBlock(x, y, z);
                if (!S.blockSolidAt(x, y, z))
                    continue;
                if (id === S.B.WOOD_DOOR || id === S.B.WOOD_STAIRS || id === S.B.WOOD_FENCE) {
                    for (const box of S.constructionCollisionBoxes(x, y, z, id))
                        if (S.aabbOverlap(a, box))
                            return true;
                }
                else
                    return true;
            }
    return false;
};

S.playerGroundedAt = function playerGroundedAt(pos = S.player.pos) { return S.aabbHitsWorld(S.playerAabbAt(pos[0], pos[1] - .13, pos[2])); };

S.movePlayerAxis = function movePlayerAxis(axis, delta) {
    if (!delta)
        return;
    const p = [...S.player.pos];
    p[axis] += delta;
    if (!S.aabbHitsWorld(S.playerAabbAt(p[0], p[1], p[2]))) {
        S.player.pos[axis] = p[axis];
        return;
    }
    if ((axis === 0 || axis === 2) && S.player.grounded && !S.player.inWater) {
        for (const rise of [.22, .34, .51]) {
            const step = [...S.player.pos];
            step[1] += rise;
            step[axis] += delta;
            if (!S.aabbHitsWorld(S.playerAabbAt(step[0], step[1], step[2]))) {
                S.player.pos[1] = step[1];
                S.player.pos[axis] = step[axis];
                return;
            }
        }
    }
    if ((axis === 0 || axis === 2) && S.player.inWater) {
        // Water-edge mantle: test several heights, not one fixed 0.72 step. This
        // prevents the classic “stuck forever at the shore” bug.
        if (S.input.keys.has('Space') && S.player.vel[1] > -.8) {
            for (const rise of [.13, .27, .42]) {
                const climb = [...S.player.pos];
                climb[1] += rise;
                climb[axis] += delta;
                if (!S.aabbHitsWorld(S.playerAabbAt(climb[0], climb[1], climb[2]))) {
                    S.player.pos[1] = climb[1];
                    S.player.pos[axis] = climb[axis];
                    S.player.vel[1] = Math.max(S.player.vel[1], 1.1);
                    return;
                }
            }
        }
    }
    if ((axis === 0 || axis === 2) && Math.abs(delta) > .015) {
        S.player.impact = Math.min(1, S.player.impact + .34);
        if (Math.random() < .08)
            S.sfx('step', .35, 'stone');
    }
    S.player.vel[axis] = 0;
};

S.voxelRaycast = function voxelRaycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
    const sx = dir[0] >= 0 ? 1 : -1, sy = dir[1] >= 0 ? 1 : -1, sz = dir[2] >= 0 ? 1 : -1;
    const invX = dir[0] === 0 ? 1e30 : Math.abs(1 / dir[0]), invY = dir[1] === 0 ? 1e30 : Math.abs(1 / dir[1]), invZ = dir[2] === 0 ? 1e30 : Math.abs(1 / dir[2]);
    let tX = dir[0] === 0 ? 1e30 : ((sx > 0 ? x + 1 - origin[0] : origin[0] - x) * invX), tY = dir[1] === 0 ? 1e30 : ((sy > 0 ? y + 1 - origin[1] : origin[1] - y) * invY), tZ = dir[2] === 0 ? 1e30 : ((sz > 0 ? z + 1 - origin[2] : origin[2] - z) * invZ);
    let t = 0, normal = [0, 0, 0];
    for (let i = 0; i < 128 && t <= maxDist; i++) {
        const b = S.getBlock(x, y, z);
        if (b !== S.B.AIR && b !== S.B.WATER) {
            return { x, y, z, id: b, normal, distance: t };
        }
        if (tX < tY && tX < tZ) {
            x += sx;
            t = tX;
            tX += invX;
            normal = [-sx, 0, 0];
        }
        else if (tY < tZ) {
            y += sy;
            t = tY;
            tY += invY;
            normal = [0, -sy, 0];
        }
        else {
            z += sz;
            t = tZ;
            tZ += invZ;
            normal = [0, 0, -sz];
        }
    }
    return null;
};

S.rayAABB = function rayAABB(origin, dir, min, max, maxDist) {
    let tmin = 0, tmax = maxDist;
    for (let i = 0; i < 3; i++) {
        if (Math.abs(dir[i]) < 1e-8) {
            if (origin[i] < min[i] || origin[i] > max[i])
                return null;
        }
        else {
            let t1 = (min[i] - origin[i]) / dir[i], t2 = (max[i] - origin[i]) / dir[i];
            if (t1 > t2) {
                const q = t1;
                t1 = t2;
                t2 = q;
            }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax)
                return null;
        }
    }
    return tmin;
};

S.useSelected = function useSelected() {
    const hit = S.voxelRaycast(S.eyePos(), S.lookDir(), 6);
    if (hit?.id === S.B.CHEST) {
        S.openWorldChest(hit);
        return;
    }
    if (hit?.id === S.B.BEDROLL) {
        S.sleepAtBedroll(hit);
        return;
    }
    if (hit?.id === S.B.FURNACE) {
        S.openFurnace(hit);
        return;
    }
    if (hit?.id === S.B.WOOD_DOOR) {
        const f = S.ensureFortification(hit.x, hit.y, hit.z, hit.id, true);
        f.open = !f.open;
        S.sfx('creak', .65);
        S.showMessage(f.open ? 'Drzwi otwarte.' : 'Drzwi zamknięte.', .8);
        return;
    }
    const id = S.selectedItem(), def = S.itemDefs[id];
    if (!def)
        return;
    if (def.food && S.countItem(id) > 0) {
        S.removeItem(id, 1);
        S.player.hunger = S.clamp(S.player.hunger + def.food, 0, 100);
        S.player.health = S.clamp(S.player.health + (def.heal || 0) - (def.hurt || 0), 0, 100);
        S.sfx('eat');
        S.showMessage(`${def.name}: głód +${def.food}`);
        return;
    }
    if (def.heal && S.countItem(id) > 0) {
        S.removeItem(id, 1);
        S.player.health = S.clamp(S.player.health + def.heal, 0, 100);
        S.sfx('eat');
        S.showMessage(`${def.name}: HP +${def.heal}`);
        return;
    }
    if (def.place !== undefined && S.countItem(id) > 0) {
        if (!hit)
            return;
        const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
        if (y <= 0 || y >= S.WORLD_H - 1)
            return;
        const a = S.playerAabbAt(S.player.pos[0], S.player.pos[1], S.player.pos[2]);
        if (x + 1 > a[0] && x < a[3] && y + 1 > a[1] && y < a[4] && z + 1 > a[2] && z < a[5]) {
            S.showMessage('Nie możesz postawić bloku w sobie.');
            return;
        }
        if (S.getBlock(x, y, z) === S.B.AIR || S.getBlock(x, y, z) === S.B.WATER) {
            S.setBlock(x, y, z, def.place);
            S.removeItem(id, 1);
            const key = S.fortKey(x, y, z);
            if (def.place === S.B.BEDROLL) {
                S.bedrolls.set(key, { orientation: Math.round(S.player.yaw / (Math.PI / 2)) * (Math.PI / 2) });
                S.showMessage('Śpiwór rozłożony. PPM: zapisz odrodzenie i prześpij noc.', 2.4);
            }
            if (S.isUpgradeableBlockId(def.place)) {
                const t = S.FORT_TIERS[0];
                S.fortifications.set(key, { tier: 0, hp: t.maxHp, maxHp: t.maxHp, type: S.blockDefs[def.place]?.construction || 'wall', orientation: Math.round(S.player.yaw / (Math.PI / 2)) * (Math.PI / 2), open: false, lastHit: 0 });
            }
            if (def.place === S.B.FURNACE && !S.furnaces.has(key))
                S.furnaces.set(key, { input: null, fuel: null, output: null, burn: 0, burnMax: 0, progress: 0 });
            const placeMat = S.soundMaterialForBlock(def.place);
            S.sfx(def.place === S.B.TORCH ? 'torch' : 'place', 1.0, placeMat);
            S.emitPlayerNoise(def.place === S.B.TORCH ? 'torch_place' : 'block_place', def.place === S.B.TORCH ? 10 : 16, def.place === S.B.TORCH ? .45 : .72, [x + .5, y + .5, z + .5], 1.0, placeMat);
        }
    }
};

S.hurtPlayer = function hurtPlayer(amount, source = 'coś w ciemności') {
    if (S.player.damageCooldown > 0 || S.dead)
        return;
    S.player.damageCooldown = .45;
    amount = S.absorbArmorDamage(amount);
    S.player.health -= amount;
    S.player.cameraShake = Math.max(S.player.cameraShake, .72);
    S.player.threat = Math.max(S.player.threat, .88);
    S.UI.damageFlash.style.opacity = '.88';
    setTimeout(() => S.UI.damageFlash.style.opacity = '0', 145);
    S.canvas.classList.remove('shake');
    void S.canvas.offsetWidth;
    S.canvas.classList.add('shake');
    S.sfx('hurt');
    if (S.player.health <= 0)
        S.killPlayer(source);
};

S.killPlayer = function killPlayer(source) {
    S.dead = true;
    S.paused = true;
    S.input.mouseLeft = false;
    document.exitPointerLock?.();
    S.player.health = 0;
    S.UI.deathTitle.textContent = Math.random() < .5 ? 'LAS CIĘ ZNALAZŁ' : 'ZOSTAŁEŚ POŻARTY';
    S.UI.deathStats.textContent = `Przyczyna: ${source}. Zabici wrogowie: ${S.player.kills}. Wykopane bloki: ${S.player.blocksMined}. Przetrwane dni: ${Math.floor(S.player.days)}.`;
    S.UI.deathMenu.classList.add('active');
};

S.respawn = function respawn() {
    S.dead = false;
    S.UI.deathMenu.classList.remove('active');
    S.player.health = 75;
    S.player.hunger = 65;
    S.player.sanity = 70;
    S.player.stamina = 100;
    S.player.vel = [0, 0, 0];
    const base = (S.respawnSite && S.getBlock(...S.respawnSite) === S.B.BEDROLL ? [S.respawnSite[0] + .5, S.respawnSite[1] + 1.1, S.respawnSite[2] + .5] : S.worldSpawn) || S.starterChestPos || S.player.pos;
    S.updateStreaming(base[0], base[2], true);
    const atBag = S.respawnSite && S.getBlock(...S.respawnSite) === S.B.BEDROLL;
    let next = atBag && S.spawnPointIsSafe(base) ? [...base] : S.resolvePlayerSpawnCollision(S.findSafeSpawn(base[0], base[2], 12), 24);
    S.player.pos = next;
    if (S.aabbHitsWorld(S.playerAabbAt(...S.player.pos)))
        S.player.pos = S.resolvePlayerSpawnCollision(base, 28);
    S.player.vel = [0, 0, 0];
    S.player.grounded = S.playerGroundedAt();
    S.player.wasInWater = false;
    S.player.inWater = false;
    const lose = (id, f) => { const n = S.countItem(id), keep = Math.floor(n * f); if (n > keep)
        S.removeItem(id, n - keep); };
    lose('rawmeat', .5);
    lose('stone', .7);
    lose('wood', .7);
    S.saveGame();
    S.resumeGame();
};
}
