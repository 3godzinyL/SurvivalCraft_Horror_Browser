// NightCraft V15 · native ES module (ui/inventory.js); installs into the explicit shared state.
export function install(S) {
S.ingredientIds = spec => Array.isArray(spec) ? spec : [spec];

S.ingredientMatches = (id, spec) => S.ingredientIds(spec).includes(id);

S.ingredientCountInInventory = function ingredientCountInInventory(spec) { let n = 0; for (const id of S.ingredientIds(spec))
    n += S.countItem(id); return n; };

S.ingredientCountEverywhere = function ingredientCountEverywhere(spec) { let n = S.ingredientCountInInventory(spec); for (const st of S.player.craftSlots)
    if (st && S.ingredientMatches(st.id, spec))
        n += st.count; return n; };

S.chooseIngredient = function chooseIngredient(spec) { let best = null, bestCount = -1; for (const id of S.ingredientIds(spec)) {
    const n = S.countItem(id);
    if (n > bestCount) {
        best = id;
        bestCount = n;
    }
} return bestCount > 0 ? best : S.ingredientIds(spec)[0]; };

S.recipeIngredients = function recipeIngredients(r) {
    const groups = [];
    const add = (spec, n = 1) => { const ids = S.ingredientIds(spec), key = ids.slice().sort().join('|'); let g = groups.find(x => x.key === key); if (g)
        g.count += n;
    else
        groups.push({ key, spec, count: n }); };
    if (r.shapeless) {
        for (const [id, n] of Object.entries(r.shapeless))
            add(id, n);
        return groups;
    }
    for (const row of r.pattern || [])
        for (const ch of row)
            if (ch !== ' ' && r.key?.[ch])
                add(r.key[ch], 1);
    return groups;
};

S.recipeLabel = function recipeLabel(spec) { const ids = S.ingredientIds(spec); if (ids === S.LOG_INGREDIENTS || ids.length === S.LOG_INGREDIENTS.length && ids.every(x => S.LOG_INGREDIENTS.includes(x)))
    return 'Dowolne drewno'; return ids.map(id => S.itemDefs[id]?.name || id).join(' / '); };

S.requirementTextForRecipe = function requirementTextForRecipe(r) { return S.recipeIngredients(r).map(g => `${S.recipeLabel(g.spec)} ${S.ingredientCountEverywhere(g.spec)}/${g.count}`).join(' · '); };

S.canCraft = function canCraft(r) { return S.recipeIngredients(r).every(g => S.ingredientCountInInventory(g.spec) >= g.count); };

S.canFillCraftRecipe = function canFillCraftRecipe(r) { return S.recipeIngredients(r).every(g => S.ingredientCountEverywhere(g.spec) >= g.count); };

S.removeIngredientFromInventory = function removeIngredientFromInventory(spec, count) { let left = count; for (const id of S.ingredientIds(spec)) {
    if (left <= 0)
        break;
    const have = S.countItem(id);
    if (have <= 0)
        continue;
    const take = Math.min(have, left);
    S.removeItem(id, take);
    left -= take;
} return left === 0; };

S.quickCraft = function quickCraft(r) {
    if (!S.canCraft(r)) {
        S.showMessage('Brakuje materiałów.');
        return;
    }
    const [outId, outCount] = Object.entries(r.out)[0];
    if (S.inventoryCapacity(outId) < outCount) {
        S.showMessage('Brak miejsca na wynik craftingu.');
        return;
    }
    for (const g of S.recipeIngredients(r))
        S.removeIngredientFromInventory(g.spec, g.count);
    S.addItem(outId, outCount);
    S.sfx('craft');
    S.showMessage(`Wytworzono: ${r.name}`);
    S.refreshInventoryUI();
};

S.itemIconCanvas = function itemIconCanvas(id, cssClass = 'inv-icon') {
    const c = document.createElement('canvas');
    c.width = id === 'bedroll' ? 64 : 32;
    c.height = 32;
    c.className = cssClass;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, 32);
    const def = S.itemDefs[id] || {};
    const drawTile = (tile, dx = 4, dy = 4, dw = 24, dh = 24) => { const sx = (tile % S.atlas.cols) * S.atlas.tile, sy = Math.floor(tile / S.atlas.cols) * S.atlas.tile; x.drawImage(S.atlas.canvas, sx, sy, S.atlas.tile, S.atlas.tile, dx, dy, dw, dh); };
    const drawBlockIcon = (bid) => { const top = S.tileFor(bid, 'top'), side = S.tileFor(bid, 'side'); x.save(); x.beginPath(); x.moveTo(16, 3); x.lineTo(29, 10); x.lineTo(16, 17); x.lineTo(3, 10); x.closePath(); x.clip(); drawTile(top, 3, 3, 26, 14); x.restore(); x.save(); x.beginPath(); x.moveTo(3, 10); x.lineTo(16, 17); x.lineTo(16, 30); x.lineTo(3, 23); x.closePath(); x.clip(); drawTile(side, 3, 10, 13, 20); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(3, 10, 13, 20); x.restore(); x.save(); x.beginPath(); x.moveTo(16, 17); x.lineTo(29, 10); x.lineTo(29, 23); x.lineTo(16, 30); x.closePath(); x.clip(); drawTile(side, 16, 10, 13, 20); x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(16, 10, 13, 20); x.restore(); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1; x.strokeRect(3.5, 10.5, 0, 0); };
    if (def.armorSlot) {
        x.fillStyle = def.tier === 'iron' ? '#9baab4' : '#7a5237';
        x.strokeStyle = def.tier === 'iron' ? '#d4dfe5' : '#c69c6d';
        x.lineWidth = 2;
        x.beginPath();
        if (def.armorSlot === 'head') {
            x.moveTo(8, 19);
            x.lineTo(8, 11);
            x.lineTo(13, 7);
            x.lineTo(20, 7);
            x.lineTo(24, 11);
            x.lineTo(24, 19);
        }
        else if (def.armorSlot === 'chest') {
            x.moveTo(7, 8);
            x.lineTo(12, 5);
            x.lineTo(20, 5);
            x.lineTo(25, 8);
            x.lineTo(28, 14);
            x.lineTo(23, 16);
            x.lineTo(23, 28);
            x.lineTo(9, 28);
            x.lineTo(9, 16);
            x.lineTo(4, 14);
        }
        else if (def.armorSlot === 'legs') {
            x.moveTo(8, 5);
            x.lineTo(24, 5);
            x.lineTo(22, 27);
            x.lineTo(17, 27);
            x.lineTo(16, 13);
            x.lineTo(15, 27);
            x.lineTo(10, 27);
        }
        else {
            x.moveTo(8, 7);
            x.lineTo(14, 7);
            x.lineTo(14, 20);
            x.lineTo(19, 20);
            x.lineTo(19, 27);
            x.lineTo(5, 27);
        }
        x.closePath();
        x.fill();
        x.stroke();
        return c;
    }
    if (id === 'leather' || id === 'rabbit_hide') {
        x.fillStyle = id === 'leather' ? '#765038' : '#a9957c';
        x.beginPath();
        x.moveTo(7, 5);
        x.lineTo(23, 7);
        x.lineTo(27, 25);
        x.lineTo(10, 27);
        x.lineTo(5, 16);
        x.closePath();
        x.fill();
        return c;
    }
    if (id === 'bedroll') {
        // Worn canvas double-length bedding, stitched pillow and straps.
        x.fillStyle = '#070b08';
        x.fillRect(2, 5, 60, 22);
        x.fillStyle = '#4d3724';
        x.fillRect(4, 7, 56, 19);
        x.fillStyle = '#28382c';
        x.fillRect(5, 5, 53, 20);
        x.fillStyle = '#394e3b';
        x.fillRect(6, 6, 51, 17);
        x.fillStyle = '#60785c';
        x.fillRect(7, 7, 47, 3);
        x.fillStyle = '#1b2d23';
        x.fillRect(7, 20, 50, 4);
        x.fillStyle = '#263b2c';
        x.fillRect(10, 10, 43, 10);
        x.fillStyle = '#7c8a6d';
        x.fillRect(9, 9, 14, 12);
        x.fillStyle = '#abb29a';
        x.fillRect(10, 10, 11, 6);
        x.fillStyle = '#56664e';
        x.fillRect(23, 11, 29, 6);
        x.fillStyle = '#829276';
        x.fillRect(25, 12, 23, 2);
        x.fillStyle = '#ac925a';
        x.fillRect(32, 5, 3, 20);
        x.fillRect(49, 5, 3, 20);
        x.fillStyle = '#514329';
        x.fillRect(32, 9, 3, 13);
        x.fillRect(49, 9, 3, 13);
        x.fillStyle = '#e0c78a';
        x.fillRect(31, 15, 5, 3);
        x.fillRect(48, 15, 5, 3);
        x.fillStyle = '#3f3020';
        x.fillRect(32, 16, 3, 1);
        x.fillRect(49, 16, 3, 1);
        x.fillStyle = '#c3a76f';
        for (let i = 8; i < 54; i += 5) {
            x.fillRect(i, 6, 2, 1);
            x.fillRect(i, 23, 2, 1);
        }
        x.fillStyle = '#9caa8e';
        x.fillRect(57, 11, 3, 9);
        x.fillStyle = '#293727';
        x.fillRect(59, 12, 2, 7);
        return c;
    }
    if (def.place && def.place !== S.B.TORCH) {
        drawBlockIcon(def.place);
        return c;
    }
    if (id === 'coal') {
        drawTile(7);
        return c;
    }
    if (id === 'iron') {
        drawTile(8);
        return c;
    }
    if (id === 'gold_ore') {
        drawTile(88);
        return c;
    }
    if (id === 'iron_ingot' || id === 'gold_ingot') {
        x.fillStyle = id === 'iron_ingot' ? '#aeb6b2' : '#d2ad43';
        x.fillRect(6, 11, 20, 10);
        x.fillStyle = 'rgba(255,255,255,.24)';
        x.fillRect(8, 12, 16, 2);
        return c;
    }
    x.save();
    x.translate(16, 16);
    x.rotate(-.42);
    if (def.tool) {
        const wood = def.tier === 'wood', gold = def.tier === 'gold';
        x.fillStyle = wood ? '#6b472a' : '#573d27';
        x.fillRect(-2, -11, 4, 23);
        x.fillStyle = wood ? '#8a6239' : gold ? '#d6ad35' : (def.tool === 'sword' ? '#a2a8a4' : '#747a76');
        if (def.tool === 'pickaxe') {
            x.fillRect(-11, -11, 22, 5);
            x.fillRect(-11, -9, 4, 7);
        }
        else if (def.tool === 'axe') {
            x.fillRect(-3, -11, 12, 8);
            x.fillRect(5, -9, 6, 5);
        }
        else if (def.tool === 'shovel') {
            x.fillRect(-4, -13, 8, 10);
            x.fillRect(-6, -14, 12, 5);
        }
        else {
            x.fillRect(-3, -14, 6, 22);
            x.fillStyle = wood ? '#5f4027' : '#3b3128';
            x.fillRect(-7, 7, 14, 3);
        }
        x.restore();
        return c;
    }
    if (id === 'torch') {
        x.restore();
        x.fillStyle = '#4b321d';
        x.fillRect(14, 11, 4, 17);
        x.fillStyle = '#a46b25';
        x.fillRect(12, 8, 8, 6);
        x.fillStyle = '#dca33e';
        x.fillRect(13, 5, 6, 7);
        x.fillStyle = '#f2c76b';
        x.fillRect(15, 3, 3, 5);
        return c;
    }
    x.restore();
    if (id === 'rawmeat' || id === 'cookedmeat') {
        x.fillStyle = id === 'rawmeat' ? '#6d2425' : '#704123';
        x.fillRect(8, 9, 17, 14);
        x.fillRect(11, 6, 12, 4);
        x.fillStyle = id === 'rawmeat' ? '#b56a66' : '#a77b4f';
        x.fillRect(11, 11, 5, 4);
    }
    else if (id === 'berries') {
        x.fillStyle = '#403757';
        for (const [bx, by] of [[10, 12], [15, 9], [20, 13], [13, 18], [19, 19]])
            x.fillRect(bx, by, 6, 6);
        x.fillStyle = '#385135';
        x.fillRect(15, 5, 3, 6);
    }
    else if (id === 'bandage') {
        x.fillStyle = '#b9b7a8';
        x.fillRect(7, 12, 18, 8);
        x.fillRect(12, 7, 8, 18);
        x.fillStyle = '#6f2d2d';
        x.fillRect(13, 13, 6, 6);
    }
    else if (id === 'stick') {
        x.fillStyle = '#6a472b';
        x.save();
        x.translate(16, 16);
        x.rotate(-.55);
        x.fillRect(-2, -12, 4, 24);
        x.restore();
    }
    else {
        x.fillStyle = '#7c857d';
        x.fillRect(8, 8, 16, 16);
    }
    return c;
};

S.itemTypeLabel = function itemTypeLabel(id, def) { return def?.kind === 'armor' ? 'pancerz' : def?.kind === 'camp' ? 'ekwipunek obozowy' : def?.tool ? 'narzędzie' : def?.food ? 'jedzenie' : def?.heal ? 'medyczne' : def?.kind === 'light' ? 'światło' : def?.place ? 'blok' : 'surowiec'; };

S.getSlotRef = function getSlotRef(source, index = 0) {
    if (source === 'inventory')
        return S.isBedrollTail(S.player.slots[index]) ? null : S.player.slots[index] || null;
    if (source === 'craft')
        return S.player.craftSlots[index] || null;
    if (source === 'chest')
        return (S.activeChestKey && S.ruinChests.has(S.activeChestKey) ? S.ruinChests.get(S.activeChestKey) : S.starterChestLoot)[index] || null;
    if (source === 'armor')
        return S.armorSlots[['head', 'chest', 'legs', 'feet'][index]] || null;
    if (source === 'offhand')
        return S.player.offhand || null;
    if (source === 'mainhand')
        return S.player.slots[S.player.selected] || null;
    const fu = S.furnaceActiveKey ? S.furnaces.get(S.furnaceActiveKey) : null;
    if (source === 'furnace_input')
        return fu?.input || null;
    if (source === 'furnace_fuel')
        return fu?.fuel || null;
    if (source === 'furnace_output')
        return fu?.output || null;
    return null;
};

S.setSlotRef = function setSlotRef(source, index, st) {
    st = S.normalizeStack(st);
    if (source === 'inventory') {
        if (!S.applyInventoryFootprints([[index, st]]))
            return false;
    }
    else if (source === 'craft')
        S.player.craftSlots[index] = st;
    else if (source === 'chest') {
        const loot = S.activeChestKey && S.ruinChests.has(S.activeChestKey) ? S.ruinChests.get(S.activeChestKey) : S.starterChestLoot;
        loot[index] = st;
    }
    else if (source === 'armor') {
        const part = ['head', 'chest', 'legs', 'feet'][index];
        if (S.armorSlots[part]?.id !== st?.id)
            S.armorWear[part] = 0;
        S.armorSlots[part] = st;
    }
    else if (source === 'offhand')
        S.player.offhand = st;
    else if (source === 'mainhand') {
        if (!S.applyInventoryFootprints([[S.player.selected, st]]))
            return false;
    }
    else if (S.furnaceActiveKey && source === 'furnace_input') {
        const f = S.furnaces.get(S.furnaceActiveKey);
        if (f)
            f.input = st;
    }
    else if (S.furnaceActiveKey && source === 'furnace_fuel') {
        const f = S.furnaces.get(S.furnaceActiveKey);
        if (f)
            f.fuel = st;
    }
    else if (S.furnaceActiveKey && source === 'furnace_output') {
        const f = S.furnaces.get(S.furnaceActiveKey);
        if (f)
            f.output = st;
    }
    return true;
};

S.slotAccepts = function slotAccepts(source, st) {
    if (!st)
        return true;
    if (source === 'furnace_output')
        return false;
    if (source === 'furnace_input')
        return !!S.SMELT_RECIPES[st.id];
    if (source === 'furnace_fuel')
        return fuelSeconds(st.id) > 0;
    return true;
};

S.mergeOrSwap = function mergeOrSwap(source, index, targetSource, targetIndex) {
    if (source === targetSource && index === targetIndex || source === 'mainhand' && targetSource === 'inventory' && targetIndex === S.player.selected || targetSource === 'mainhand' && source === 'inventory' && index === S.player.selected)
        return;
    let a = S.cloneStack(S.getSlotRef(source, index)), b = S.cloneStack(S.getSlotRef(targetSource, targetIndex));
    const accepts = (src, idx, st) => !st || src === 'armor' ? (!st || src !== 'armor' || S.itemDefs[st.id]?.armorSlot === ['head', 'chest', 'legs', 'feet'][idx]) : S.slotAccepts(src, st);
    if (!a || !accepts(targetSource, targetIndex, a))
        return;
    if (b && !accepts(source, index, b))
        return;
    const sourceInv = source === 'inventory' ? index : source === 'mainhand' ? S.player.selected : -1, targetInv = targetSource === 'inventory' ? targetIndex : targetSource === 'mainhand' ? S.player.selected : -1;
    const pending = [];
    if (sourceInv >= 0)
        pending.push([sourceInv, b]);
    if (targetInv >= 0)
        pending.push([targetInv, a]);
    if (pending.length && !S.validInventoryFootprints(pending))
        return;
    const max = S.maxStackFor(a.id);
    if (b?.id === a.id && b.count < max) {
        const take = Math.min(max - b.count, a.count);
        b.count += take;
        a.count -= take;
        S.setSlotRef(targetSource, targetIndex, b);
        S.setSlotRef(source, index, a.count > 0 ? a : null);
    }
    else if (sourceInv >= 0 && targetInv >= 0) {
        S.applyInventoryFootprints([[sourceInv, b], [targetInv, a]]);
    }
    else {
        if (source === 'inventory')
            S.setSlotRef(source, index, b);
        S.setSlotRef(targetSource, targetIndex, a);
        if (source !== 'inventory')
            S.setSlotRef(source, index, b);
    }
    S.sfx('inventory', .6);
    S.refreshInventoryUI();
    S.refreshHotbar();
};

S.moveInventoryRange = function moveInventoryRange(index) {
    const st = S.player.slots[index];
    if (!st || S.isBedrollTail(st))
        return;
    if (st.id === 'bedroll') {
        const start = index >= S.HOTBAR_SIZE ? 0 : S.HOTBAR_SIZE, end = index >= S.HOTBAR_SIZE ? S.HOTBAR_SIZE : S.INVENTORY_SIZE;
        for (let i = start; i < end; i++) {
            if (i === index)
                continue;
            if (!S.validInventoryFootprints([[index, null], [i, st]]))
                continue;
            S.applyInventoryFootprints([[index, null], [i, st]]);
            S.sfx('inventory', .6);
            S.refreshInventoryUI();
            S.refreshHotbar();
            return;
        }
        return;
    }
    const start = index >= S.HOTBAR_SIZE ? 0 : S.HOTBAR_SIZE, end = index >= S.HOTBAR_SIZE ? S.HOTBAR_SIZE : S.INVENTORY_SIZE, max = S.maxStackFor(st.id);
    let left = st.count;
    for (let i = start; i < end && left > 0; i++) {
        const dst = S.player.slots[i];
        if (dst?.id === st.id && dst.count < max) {
            const take = Math.min(max - dst.count, left);
            dst.count += take;
            left -= take;
        }
    }
    for (let i = start; i < end && left > 0; i++)
        if (!S.player.slots[i]) {
            const take = Math.min(max, left);
            S.player.slots[i] = { id: st.id, count: take };
            left -= take;
        }
    S.player.slots[index] = left > 0 ? { id: st.id, count: left } : null;
    S.sfx('inventory', .6);
    S.refreshInventoryUI();
    S.refreshHotbar();
};

S.positionCursorStack = function positionCursorStack(x = S.cursorX, y = S.cursorY) { S.cursorX = x; S.cursorY = y; if (!S.UI.cursorStack)
    return; S.UI.cursorStack.style.left = `${x}px`; S.UI.cursorStack.style.top = `${y}px`; };

S.leftClickSlot = function leftClickSlot(source, index, shift = false, x = S.cursorX, y = S.cursorY) {
    S.positionCursorStack(x, y);
    if (S.cursorStack && !(source === 'armor' ? S.itemDefs[S.cursorStack.id]?.armorSlot === ['head', 'chest', 'legs', 'feet'][index] : S.slotAccepts(source, S.cursorStack)))
        return;
    if (source === 'furnace_output' && S.cursorStack) {
        const slot = S.cloneStack(S.getSlotRef(source, index));
        if (!slot || slot.id !== S.cursorStack.id || S.cursorStack.count >= S.maxStackFor(slot.id))
            return;
    }
    if (shift) {
        if (source === 'inventory' || source === 'mainhand') {
            S.moveInventoryRange(source === 'mainhand' ? S.player.selected : index);
            return;
        }
        const moving = S.cloneStack(S.getSlotRef(source, index));
        if (moving && S.addItem(moving.id, moving.count)) {
            S.setSlotRef(source, index, null);
            S.sfx('inventory', .65);
            S.refreshInventoryUI();
            S.refreshHotbar();
        }
        return;
    }
    const slot = S.cloneStack(S.getSlotRef(source, index));
    if ((source === 'inventory' || source === 'mainhand') && S.cursorStack && !S.validInventoryFootprints([[source === 'mainhand' ? S.player.selected : index, S.cursorStack]]))
        return;
    if (!S.cursorStack) {
        if (slot) {
            S.cursorStack = slot;
            S.setSlotRef(source, index, null);
            S.sfx('inventory', .55);
        }
    }
    else if (!slot) {
        S.setSlotRef(source, index, S.cursorStack);
        S.cursorStack = null;
        S.sfx('inventory', .55);
    }
    else if (slot.id === S.cursorStack.id && slot.count < S.maxStackFor(slot.id)) {
        const take = Math.min(S.maxStackFor(slot.id) - slot.count, S.cursorStack.count);
        slot.count += take;
        S.cursorStack.count -= take;
        S.setSlotRef(source, index, slot);
        if (S.cursorStack.count <= 0)
            S.cursorStack = null;
        S.sfx('inventory', .55);
    }
    else {
        S.setSlotRef(source, index, S.cursorStack);
        S.cursorStack = slot;
        S.sfx('inventory', .55);
    }
    S.refreshInventoryUI();
    S.refreshHotbar();
};

S.rightClickSlot = function rightClickSlot(source, index, x = S.cursorX, y = S.cursorY, deferRefresh = false) {
    S.positionCursorStack(x, y);
    const slot = S.cloneStack(S.getSlotRef(source, index));
    if ((source === 'inventory' || source === 'mainhand') && S.cursorStack && !S.validInventoryFootprints([[source === 'mainhand' ? S.player.selected : index, S.cursorStack]]))
        return;
    if (S.cursorStack && !(source === 'armor' ? S.itemDefs[S.cursorStack.id]?.armorSlot === ['head', 'chest', 'legs', 'feet'][index] : S.slotAccepts(source, S.cursorStack)))
        return;
    if (source === 'furnace_output' && S.cursorStack)
        return;
    if (!S.cursorStack && slot) {
        const take = Math.ceil(slot.count / 2);
        S.cursorStack = { ...S.cloneStack(slot), count: take };
        slot.count -= take;
        S.setSlotRef(source, index, slot.count > 0 ? slot : null);
        S.sfx('inventory', .45);
    }
    else if (S.cursorStack && !slot) {
        S.setSlotRef(source, index, { ...S.cloneStack(S.cursorStack), count: 1 });
        S.cursorStack.count--;
        if (S.cursorStack.count <= 0)
            S.cursorStack = null;
        S.sfx('inventory', .45);
    }
    else if (S.cursorStack && slot?.id === S.cursorStack.id && slot.count < S.maxStackFor(slot.id)) {
        slot.count++;
        S.cursorStack.count--;
        S.setSlotRef(source, index, slot);
        if (S.cursorStack.count <= 0)
            S.cursorStack = null;
        S.sfx('inventory', .45);
    }
    if (deferRefresh) {
        S.renderCursorStack();
        return;
    }
    S.refreshInventoryUI();
    S.refreshHotbar();
};

S.showItemTooltip = function showItemTooltip(st, x, y, source = 'inventory') {
    if (!S.UI.itemTooltip || !st) {
        S.hideItemTooltip();
        return;
    }
    const def = S.itemDefs[st.id] || {};
    S.UI.itemTooltip.innerHTML = `<strong>${def.name || st.id}</strong><span>${S.itemTypeLabel(st.id, def)} · ${st.count} szt.${def.kind === 'tool' ? ' · Trwałość ' + Math.max(0, def.durability - (st.wear || 0)) + '/' + def.durability : ''}</span>${source === 'chest' ? '<em>ZNALEZIONA SKRZYNIA</em>' : ''}`;
    S.UI.itemTooltip.classList.remove('hidden');
    S.moveItemTooltip(x, y);
};

S.moveItemTooltip = function moveItemTooltip(x, y) { if (!S.UI.itemTooltip || S.UI.itemTooltip.classList.contains('hidden'))
    return; const pad = 14, w = S.UI.itemTooltip.offsetWidth || 170, h = S.UI.itemTooltip.offsetHeight || 50; S.UI.itemTooltip.style.left = `${Math.min(innerWidth - w - pad, x + 16)}px`; S.UI.itemTooltip.style.top = `${Math.min(innerHeight - h - pad, y + 16)}px`; };

S.hideItemTooltip = function hideItemTooltip() { S.UI.itemTooltip?.classList.add('hidden'); };

S.makeSlotElement = function makeSlotElement(source, index, st, extraClass = '') {
    const el = document.createElement('div');
    el.className = `inv-item ${extraClass}`.trim();
    el.dataset.source = source;
    el.dataset.index = String(index);
    el.draggable = !!st;
    if (source === 'armor' && st) {
        const wear = S.armorWear[['head', 'chest', 'legs', 'feet'][index]], def = S.itemDefs[st.id];
        el.title = `Trwałość: ${Math.max(0, Math.round(def.durability - wear))}/${def.durability}`;
    }
    if (source === 'inventory' && index < S.HOTBAR_SIZE)
        el.classList.add('slot-hotbar');
    if (source === 'inventory' && index === S.player.selected)
        el.classList.add('slot-selected');
    const idx = document.createElement('span');
    idx.className = 'inv-slot-index';
    idx.textContent = source === 'inventory' && index < S.HOTBAR_SIZE ? String(index + 1) : '';
    el.appendChild(idx);
    if (st) {
        if (st.id === 'bedroll' && source === 'inventory')
            el.classList.add('bedroll-wide');
        const icon = S.itemIconCanvas(st.id, '');
        const count = document.createElement('b');
        count.className = 'inv-count';
        count.textContent = st.count > 1 ? String(st.count) : '';
        el.append(icon, count);
        el.title = `${S.itemDefs[st.id]?.name || st.id} · ${S.itemTypeLabel(st.id, S.itemDefs[st.id])}` + (S.itemDefs[st.id]?.durability ? ` · Trwałość: ${S.itemDefs[st.id].durability - (st.wear || 0)}/${S.itemDefs[st.id].durability}` : '');
    }
    el.addEventListener('click', ev => { if (ev.button !== 0)
        return; S.leftClickSlot(source, index, ev.shiftKey, ev.clientX, ev.clientY); });
    el.addEventListener('pointerdown', ev => { if (ev.button !== 2)
        return; ev.preventDefault(); S.rightClickSlot(source, index, ev.clientX, ev.clientY, true); S.slotPaint.active = true; S.slotPaint.visited = new Set([`${source}:${index}`]); });
    el.addEventListener('pointerenter', ev => { if (!S.slotPaint.active || !(ev.buttons & 2) || !S.cursorStack)
        return; const key = `${source}:${index}`; if (S.slotPaint.visited.has(key))
        return; S.slotPaint.visited.add(key); S.rightClickSlot(source, index, ev.clientX, ev.clientY, true); });
    el.addEventListener('contextmenu', ev => ev.preventDefault());
    el.addEventListener('dragstart', ev => { if (!S.getSlotRef(source, index)) {
        ev.preventDefault();
        return;
    } S.dragSource = { source, index }; ev.dataTransfer?.setData('text/plain', `${source}:${index}`); });
    el.addEventListener('dragover', ev => ev.preventDefault());
    el.addEventListener('drop', ev => { ev.preventDefault(); if (S.dragSource)
        S.mergeOrSwap(S.dragSource.source, S.dragSource.index, source, index); S.dragSource = null; });
    el.addEventListener('mouseenter', ev => { const cur = S.getSlotRef(source, index); if (cur)
        S.showItemTooltip(cur, ev.clientX, ev.clientY, source); });
    el.addEventListener('mousemove', ev => { S.positionCursorStack(ev.clientX, ev.clientY); S.moveItemTooltip(ev.clientX, ev.clientY); });
    el.addEventListener('mouseleave', S.hideItemTooltip);
    return el;
};

S.trimmedPattern = function trimmedPattern(r, mirror = false) {
    const raw = (r.pattern || []).map(row => String(row));
    if (!raw.length)
        return [];
    let minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (let y = 0; y < raw.length; y++)
        for (let x = 0; x < raw[y].length; x++)
            if (raw[y][x] && raw[y][x] !== ' ') {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
    if (maxX < 0)
        return [];
    const out = [];
    for (let y = minY; y <= maxY; y++) {
        let row = '';
        for (let x = minX; x <= maxX; x++)
            row += (raw[y][x] || ' ');
        if (mirror)
            row = row.split('').reverse().join('');
        out.push(row);
    }
    return out;
};

S.findCraftMatch = function findCraftMatch() {
    // Shapeless mod recipes still work, but normal items use Minecraft-shaped recipes.
    for (const r of S.recipes) {
        if (r.shapeless) {
            const actual = {};
            for (const st of S.player.craftSlots)
                if (st)
                    actual[st.id] = (actual[st.id] || 0) + 1;
            const want = r.shapeless, ak = Object.keys(actual).sort(), wk = Object.keys(want).sort();
            if (ak.length === wk.length && ak.every((k, i) => k === wk[i] && actual[k] === want[k]))
                return { recipe: r, slots: S.player.craftSlots.map((st, i) => st ? i : -1).filter(i => i >= 0), shapeless: true };
            continue;
        }
        for (const mirror of [false, ...(r.mirror ? [true] : [])]) {
            const p = S.trimmedPattern(r, mirror), h = p.length, w = Math.max(0, ...p.map(x => x.length));
            if (!w || w > 3 || h > 3)
                continue;
            for (let oy = 0; oy <= 3 - h; oy++)
                for (let ox = 0; ox <= 3 - w; ox++) {
                    let ok = true, slots = [];
                    for (let gy = 0; gy < 3 && ok; gy++)
                        for (let gx = 0; gx < 3; gx++) {
                            const idx = gy * 3 + gx, st = S.player.craftSlots[idx], inside = gy >= oy && gy < oy + h && gx >= ox && gx < ox + w, ch = inside ? (p[gy - oy][gx - ox] || ' ') : ' ', spec = ch === ' ' ? null : r.key?.[ch];
                            if (spec) {
                                if (!st || !S.ingredientMatches(st.id, spec)) {
                                    ok = false;
                                    break;
                                }
                                slots.push(idx);
                            }
                            else if (st) {
                                ok = false;
                                break;
                            }
                        }
                    if (ok)
                        return { recipe: r, slots, ox, oy, mirror, pattern: p };
                }
        }
    }
    return null;
};

S.matchingCraftRecipe = function matchingCraftRecipe() { return S.findCraftMatch()?.recipe || null; };

S.craftBatchCount = function craftBatchCount(r) { const m = S.findCraftMatch(); if (!m || m.recipe !== r)
    return 0; if (m.shapeless) {
    let n = Infinity;
    for (const [id, need] of Object.entries(r.shapeless)) {
        let count = 0;
        for (const st of S.player.craftSlots)
            if (st?.id === id)
                count += st.count;
        n = Math.min(n, Math.floor(count / need));
    }
    return Number.isFinite(n) ? n : 0;
} let n = Infinity; for (const i of m.slots)
    n = Math.min(n, S.player.craftSlots[i]?.count || 0); return Number.isFinite(n) ? Math.max(0, n) : 0; };

S.consumeCraftMatch = function consumeCraftMatch(m, batches = 1) { if (m.shapeless) {
    for (const [id, need] of Object.entries(m.recipe.shapeless)) {
        let left = need * batches;
        for (let i = 0; i < 9 && left > 0; i++) {
            const st = S.player.craftSlots[i];
            if (st?.id === id) {
                const take = Math.min(left, st.count);
                st.count -= take;
                left -= take;
                if (st.count <= 0)
                    S.player.craftSlots[i] = null;
            }
        }
    }
    return;
} for (const i of m.slots) {
    const st = S.player.craftSlots[i];
    if (!st)
        continue;
    st.count -= batches;
    if (st.count <= 0)
        S.player.craftSlots[i] = null;
} };

S.takeCraftOutput = function takeCraftOutput(shift = false) {
    const m = S.findCraftMatch();
    if (!m)
        return;
    const r = m.recipe, [outId, outCount] = Object.entries(r.out)[0], max = S.maxStackFor(outId);
    if (shift) {
        const batches = Math.min(S.craftBatchCount(r), Math.floor(S.inventoryCapacity(outId) / outCount));
        if (batches <= 0) {
            S.showMessage('Brak miejsca albo materiałów.');
            return;
        }
        S.consumeCraftMatch(m, batches);
        S.addItem(outId, outCount * batches);
        S.sfx('craft', .9);
        S.refreshInventoryUI();
        return;
    }
    if (S.cursorStack && S.cursorStack.id !== outId) {
        S.showMessage('Kursor trzyma inny przedmiot.');
        return;
    }
    if (S.cursorStack && S.cursorStack.count + outCount > max) {
        S.showMessage('Brak miejsca w stosie.');
        return;
    }
    S.consumeCraftMatch(m, 1);
    if (S.cursorStack)
        S.cursorStack.count += outCount;
    else
        S.cursorStack = { id: outId, count: outCount };
    S.sfx('craft');
    S.refreshInventoryUI();
};

S.clearCraftToInventory = function clearCraftToInventory() { const stacks = S.player.craftSlots.filter(Boolean).map(S.cloneStack); if (!S.canStoreStacks(stacks))
    return false; for (let i = 0; i < S.player.craftSlots.length; i++) {
    const st = S.player.craftSlots[i];
    if (st) {
        if (!S.addItem(st.id, st.count))
            return false;
        S.player.craftSlots[i] = null;
    }
} return true; };

S.fillCraftFromRecipe = function fillCraftFromRecipe(r) {
    if (!S.canCraft(r)) {
        S.showMessage('Brakuje materiałów.');
        return;
    }
    if (!S.clearCraftToInventory()) {
        S.showMessage('Brak miejsca, żeby opróżnić crafting.');
        return;
    }
    if (r.shapeless) {
        let idx = 0;
        for (const [id, n] of Object.entries(r.shapeless))
            for (let k = 0; k < n; k++) {
                S.removeItem(id, 1);
                S.player.craftSlots[idx++] = { id, count: 1 };
            }
    }
    else {
        const p = S.trimmedPattern(r, false), h = p.length, w = Math.max(...p.map(x => x.length)), ox = Math.floor((3 - w) / 2), oy = Math.floor((3 - h) / 2);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const ch = p[y][x] || ' ';
                if (ch === ' ')
                    continue;
                const spec = r.key[ch], id = S.chooseIngredient(spec);
                if (!S.removeIngredientFromInventory(id, 1))
                    continue;
                S.player.craftSlots[(oy + y) * 3 + ox + x] = { id, count: 1 };
            }
    }
    S.sfx('inventory', .7);
    S.refreshInventoryUI();
    S.showMessage('Receptura ułożona w 3×3 — kliknij wynik.', 1.2);
};

S.fillEquipSlot = function fillEquipSlot(el, st, source = 'offhand') {
    if (!el)
        return;
    el.innerHTML = '';
    const clone = S.cloneStack(st);
    if (clone) {
        const icon = S.itemIconCanvas(clone.id, ''), count = document.createElement('span');
        count.className = 'inv-count';
        count.textContent = clone.count > 1 ? String(clone.count) : '';
        el.append(icon, count);
        el.title = S.itemDefs[clone.id]?.name || clone.id;
    }
    else
        el.title = 'Pusty slot';
    if (source === 'offhand' || source === 'mainhand') {
        const idx = 0;
        el.onclick = (ev) => S.leftClickSlot(source, idx, ev.shiftKey, ev.clientX, ev.clientY);
        el.onpointerdown = (ev) => { if (ev.button === 2) {
            ev.preventDefault();
            S.rightClickSlot(source, idx, ev.clientX, ev.clientY);
        } };
        el.oncontextmenu = (ev) => ev.preventDefault();
        el.draggable = !!clone;
        el.ondragstart = ev => { if (!S.getSlotRef(source, idx)) {
            ev.preventDefault();
            return;
        } S.dragSource = { source, index: idx }; ev.dataTransfer?.setData('text/plain', `${source}:${idx}`); };
        el.ondragover = ev => ev.preventDefault();
        el.ondrop = ev => { ev.preventDefault(); if (S.dragSource)
            S.mergeOrSwap(S.dragSource.source, S.dragSource.index, source, idx); S.dragSource = null; };
        el.onmouseenter = ev => { const cur = S.getSlotRef(source, idx); if (cur)
            S.showItemTooltip(cur, ev.clientX, ev.clientY, source); };
        el.onmousemove = ev => S.moveItemTooltip(ev.clientX, ev.clientY);
        el.onmouseleave = S.hideItemTooltip;
    }
};

S.renderCursorStack = function renderCursorStack() {
    if (!S.UI.cursorStack)
        return;
    S.UI.cursorStack.innerHTML = '';
    if (!S.cursorStack) {
        S.UI.cursorStack.classList.add('hidden');
        return;
    }
    S.UI.cursorStack.classList.remove('hidden');
    S.UI.cursorStack.append(S.itemIconCanvas(S.cursorStack.id, ''));
    const b = document.createElement('b');
    b.textContent = S.cursorStack.count > 1 ? String(S.cursorStack.count) : '';
    S.UI.cursorStack.appendChild(b);
};

S.SMELT_RECIPES = { iron: { out: 'iron_ingot', time: 7.5 }, gold_ore: { out: 'gold_ingot', time: 8.5 }, sand: { out: 'glass', time: 6.5 }, redsand: { out: 'glass', time: 6.5 }, cobble: { out: 'smooth_stone', time: 7.0 }, rawmeat: { out: 'cookedmeat', time: 6.0 } };

S.FUEL_TIME = { coal: 64, wood: 12, pinewood: 12, birchwood: 12, darkwood: 14, willowwood: 11, poplarwood: 11, mimosawood: 11, deadwood: 8, planks: 9, old_planks: 8, dark_planks: 10, stick: 3.5 };

S.furnaceState = function furnaceState(key = S.furnaceActiveKey) { if (!key)
    return null; let f = S.furnaces.get(key); if (!f) {
    f = { input: null, fuel: null, output: null, burn: 0, burnMax: 0, progress: 0 };
    S.furnaces.set(key, f);
} return f; };

S.canFurnaceOutput = function canFurnaceOutput(f, recipe) { if (!f || !recipe)
    return false; return !f.output || (f.output.id === recipe.out && f.output.count < S.maxStackFor(recipe.out)); };

S.consumeOneStackField = function consumeOneStackField(f, field) { const st = f[field]; if (!st)
    return; st.count--; if (st.count <= 0)
    f[field] = null; };

S.updateFurnaces = function updateFurnaces(dt) { for (const [key, f] of S.furnaces) {
    const [x, y, z] = key.split(',').map(Number);
    if (S.getBlock(x, y, z) !== S.B.FURNACE) {
        S.furnaces.delete(key);
        continue;
    }
    const recipe = f.input ? S.SMELT_RECIPES[f.input.id] : null;
    if (f.burn <= 0 && recipe && S.canFurnaceOutput(f, recipe) && f.fuel && S.FUEL_TIME[f.fuel.id]) {
        f.burn = f.burnMax = S.FUEL_TIME[f.fuel.id];
        S.consumeOneStackField(f, 'fuel');
        S.sfx('fire', .22);
    }
    if (f.burn > 0) {
        f.burn = Math.max(0, f.burn - dt);
        if (Math.hypot(x + .5 - S.player.pos[0], z + .5 - S.player.pos[2]) < 18 && Math.random() < dt * 1.6)
            S.spawnParticle([x + .5, y + 1.02, z + .5], [(Math.random() - .5) * .09, .22 + Math.random() * .16, (Math.random() - .5) * .09], 1.7, [.15, .14, .13, .34], 3.1, 0, .025);
        if (recipe && S.canFurnaceOutput(f, recipe)) {
            f.progress += dt;
            if (f.progress >= recipe.time) {
                f.progress = 0;
                S.consumeOneStackField(f, 'input');
                if (f.output?.id === recipe.out)
                    f.output.count++;
                else
                    f.output = { id: recipe.out, count: 1 };
                S.sfx('craft', .55);
            }
        }
        else
            f.progress = 0;
    }
    else if (!recipe)
        f.progress = 0;
} if (S.furnaceOpen)
    S.refreshFurnaceUI(); };

S.fillFurnaceSlot = function fillFurnaceSlot(el, source) { if (!el)
    return; el.innerHTML = ''; const st = S.cloneStack(S.getSlotRef(source, 0)); if (st) {
    el.append(S.itemIconCanvas(st.id, ''));
    const b = document.createElement('b');
    b.className = 'inv-count';
    b.textContent = st.count > 1 ? String(st.count) : '';
    el.appendChild(b);
    el.title = S.itemDefs[st.id]?.name || st.id;
}
else
    el.title = 'Pusty slot'; el.onclick = ev => S.leftClickSlot(source, 0, ev.shiftKey, ev.clientX, ev.clientY); el.onpointerdown = ev => { if (ev.button === 2) {
    ev.preventDefault();
    S.rightClickSlot(source, 0, ev.clientX, ev.clientY);
} }; el.oncontextmenu = ev => ev.preventDefault(); el.onmouseenter = ev => { const cur = S.getSlotRef(source, 0); if (cur)
    S.showItemTooltip(cur, ev.clientX, ev.clientY, source); }; el.onmouseleave = S.hideItemTooltip; };

S.refreshFurnaceUI = function refreshFurnaceUI() { if (!S.furnaceOpen || !S.furnaceActiveKey)
    return; const f = S.furnaceState(); S.fillFurnaceSlot(S.UI.furnaceInput, 'furnace_input'); S.fillFurnaceSlot(S.UI.furnaceFuel, 'furnace_fuel'); S.fillFurnaceSlot(S.UI.furnaceOutput, 'furnace_output'); const recipe = f.input ? S.SMELT_RECIPES[f.input.id] : null; S.UI.furnaceBurnFill.style.height = `${f.burnMax ? S.clamp(f.burn / f.burnMax * 100, 0, 100) : 0}%`; S.UI.furnaceProgressFill.style.width = `${recipe ? S.clamp(f.progress / recipe.time * 100, 0, 100) : 0}%`; S.UI.furnaceStatus.textContent = !f.input ? 'Włóż rudę żelaza/złota, piasek, bruk albo mięso.' : !recipe ? 'Tego przedmiotu nie da się przetopić.' : !f.fuel && f.burn <= 0 ? 'Dodaj paliwo: najlepiej węgiel.' : `Przetapianie: ${S.itemDefs[f.input.id]?.name || f.input.id} → ${S.itemDefs[recipe.out]?.name || recipe.out}`; };

S.openFurnace = function openFurnace(hit) { if (S.dead || !S.running)
    return; const key = S.fortKey(hit.x, hit.y, hit.z); S.furnaceActiveKey = key; S.furnaceState(key); S.furnaceOpen = true; S.inventoryOpen = false; S.chestOpen = false; S.adminOpen = false; S.mapOpen = false; S.paused = true; document.exitPointerLock?.(); S.UI.inventoryPanel.classList.add('hidden'); S.UI.adminPanel.classList.add('hidden'); S.UI.fullMapPanel?.classList.add('hidden'); S.UI.furnacePanel.classList.remove('hidden'); S.refreshFurnaceUI(); S.sfx('creak', .45); };

S.closeFurnace = function closeFurnace(resume = true) { S.furnaceOpen = false; S.furnaceActiveKey = null; S.UI.furnacePanel?.classList.add('hidden'); if (resume)
    S.resumeGame(); };

S.refreshInventoryUI = function refreshInventoryUI() {
    if (!S.UI.inventoryGrid)
        return;
    S.UI.inventoryGrid.innerHTML = '';
    for (let i = S.HOTBAR_SIZE; i < S.INVENTORY_SIZE; i++) {
        if (S.isBedrollTail(S.player.slots[i]))
            continue;
        S.UI.inventoryGrid.appendChild(S.makeSlotElement('inventory', i, S.player.slots[i]));
    }
    const sep = document.createElement('div');
    sep.className = 'inventory-hotbar-separator';
    sep.textContent = 'HOTBAR';
    S.UI.inventoryGrid.appendChild(sep);
    for (let i = 0; i < S.HOTBAR_SIZE; i++) {
        if (S.isBedrollTail(S.player.slots[i]))
            continue;
        S.UI.inventoryGrid.appendChild(S.makeSlotElement('inventory', i, S.player.slots[i]));
    }
    S.fillEquipSlot(S.UI.mainHandSlot, S.selectedStack(), 'mainhand');
    S.fillEquipSlot(S.UI.offhandSlot, S.player.offhand, 'offhand');
    S.renderCursorStack();
    if (S.UI.chestSection) {
        S.UI.chestSection.classList.toggle('hidden', !S.chestOpen);
        S.UI.chestGrid.innerHTML = '';
        const loot = S.activeChestKey && S.ruinChests.has(S.activeChestKey) ? S.ruinChests.get(S.activeChestKey) : S.starterChestLoot;
        if (S.chestOpen)
            for (let i = 0; i < loot.length; i++)
                S.UI.chestGrid.appendChild(S.makeSlotElement('chest', i, loot[i]));
        if (S.UI.chestTitle)
            S.UI.chestTitle.textContent = S.activeChestKey && S.ruinChests.has(S.activeChestKey) ? 'ZNALEZIONA SKRZYNIA · RUINY' : 'SKRZYNKA STARTOWA';
    }
    if (S.UI.armorGrid) {
        S.UI.armorGrid.innerHTML = '';
        for (const [i, part] of ['head', 'chest', 'legs', 'feet'].entries()) {
            const slot = S.makeSlotElement('armor', i, S.armorSlots[part], 'armor-slot');
            slot.dataset.part = part;
            const lbl = document.createElement('small');
            lbl.textContent = { head: 'GŁOWA', chest: 'TUŁÓW', legs: 'NOGI', feet: 'STOPY' }[part];
            slot.appendChild(lbl);
            S.UI.armorGrid.appendChild(slot);
        }
        if (S.UI.armorStats)
            S.UI.armorStats.textContent = `Pancerz: ${S.armorRating()} / 15 · redukcja ${Math.round(Math.min(.72, S.armorRating() * .045) * 100)}%`;
    }
    if (S.UI.craftGrid) {
        S.UI.craftGrid.innerHTML = '';
        for (let i = 0; i < 9; i++)
            S.UI.craftGrid.appendChild(S.makeSlotElement('craft', i, S.player.craftSlots[i]));
    }
    if (S.UI.craftOutput) {
        const r = S.matchingCraftRecipe();
        S.UI.craftOutput.innerHTML = '';
        S.UI.craftOutput.classList.toggle('ready', !!r);
        if (r) {
            const [id, n] = Object.entries(r.out)[0];
            S.UI.craftOutput.append(S.itemIconCanvas(id, ''));
            const b = document.createElement('b');
            b.className = 'inv-count';
            b.textContent = n > 1 ? String(n) : '';
            S.UI.craftOutput.appendChild(b);
            S.UI.craftOutput.title = S.itemDefs[id]?.name || id;
            S.UI.craftStatus.textContent = `Gotowe: ${r.name}. Kliknij wynik · Shift+klik = maksimum.`;
        }
        else
            S.UI.craftStatus.textContent = 'Ułóż recepturę w siatce 3×3 jak w Minecraft.';
        S.UI.craftOutput.onclick = ev => S.takeCraftOutput(!!ev.shiftKey);
    }
    const q = (S.UI.craftSearch?.value || '').toLowerCase().trim();
    S.UI.recipeList.innerHTML = '';
    for (const r of S.recipes) {
        const reqText = S.requirementTextForRecipe(r), hay = (r.name + ' ' + reqText).toLowerCase();
        if (q && !hay.includes(q))
            continue;
        const el = document.createElement('div');
        el.className = `recipe ${S.canCraft(r) ? '' : 'cant'}`;
        const left = document.createElement('div');
        left.innerHTML = `<strong>${r.name}</strong><small>${reqText}</small>`;
        const acts = document.createElement('div');
        acts.className = 'recipe-actions';
        const fill = document.createElement('button');
        fill.textContent = 'UŁÓŻ 3×3';
        fill.disabled = !S.canCraft(r);
        fill.onclick = () => S.fillCraftFromRecipe(r);
        acts.append(fill);
        el.append(left, acts);
        S.UI.recipeList.appendChild(el);
    }
};

S.refreshHotbar = function refreshHotbar() {
    S.UI.hotbar.innerHTML = '';
    for (let i = 0; i < S.HOTBAR_SIZE; i++) {
        const st = S.player.slots[i];
        if (S.isBedrollTail(st))
            continue;
        const el = document.createElement('div');
        el.className = 'slot' + (i === S.player.selected ? ' selected' : '');
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);
        el.appendChild(num);
        if (st) {
            if (st.id === 'bedroll')
                el.classList.add('bedroll-wide');
            const icon = S.itemIconCanvas(st.id, ''), count = document.createElement('span');
            count.className = 'count';
            count.textContent = st.count > 1 ? String(st.count) : '';
            el.append(icon, count);
        }
        el.onclick = () => S.setSelected(i);
        S.UI.hotbar.appendChild(el);
    }
    const st = S.selectedStack(), sel = st ? S.itemDefs[st.id] : null;
    S.UI.selectedLabel.textContent = st ? `${sel?.name || st.id} · ${st.count}` : 'Pusta ręka';
};

S.setSelected = function setSelected(i) { S.player.selected = (i + S.HOTBAR_SIZE) % S.HOTBAR_SIZE; if (S.isBedrollTail(S.player.slots[S.player.selected]))
    S.player.selected--; S.refreshHotbar(); S.refreshInventoryUI(); S.player.toolSwing = .28; };

S.showMessage = function showMessage(txt, dur = 1.6) { S.UI.message.textContent = txt; S.UI.message.style.opacity = '1'; S.messageTimer = dur; };

S.openInventory = function openInventory() { if (S.dead || !S.running)
    return; S.inventoryOpen = true; S.adminOpen = false; S.furnaceOpen = false; S.mapOpen = false; S.chestOpen = false; S.paused = true; document.exitPointerLock?.(); S.UI.adminPanel.classList.add('hidden'); S.UI.furnacePanel?.classList.add('hidden'); S.UI.fullMapPanel?.classList.add('hidden'); S.UI.inventoryPanel.classList.remove('hidden'); S.refreshInventoryUI(); S.sfx('inventory', .6); };

S.openStarterChest = function openStarterChest() { S.activeChestKey = null; if (S.dead || !S.running)
    return; S.inventoryOpen = true; S.adminOpen = false; S.furnaceOpen = false; S.mapOpen = false; S.chestOpen = true; S.paused = true; document.exitPointerLock?.(); S.UI.adminPanel.classList.add('hidden'); S.UI.furnacePanel?.classList.add('hidden'); S.UI.fullMapPanel?.classList.add('hidden'); S.UI.inventoryPanel.classList.remove('hidden'); S.refreshInventoryUI(); S.sfx('chest', .9); };

S.closeInventory = function closeInventory(resume = true) {
    if (S.cursorStack) {
        const st = S.cloneStack(S.cursorStack);
        if (!S.addItem(st.id, st.count)) {
            S.showMessage('Brak miejsca — odłóż przedmiot do slotu.');
            S.refreshInventoryUI();
            return;
        }
        S.cursorStack = null;
    }
    S.inventoryOpen = false;
    S.chestOpen = false;
    S.UI.inventoryPanel.classList.add('hidden');
    S.refreshInventoryUI();
    if (resume)
        S.resumeGame();
};

document.addEventListener('mousemove', e => { S.positionCursorStack(e.clientX, e.clientY); S.moveItemTooltip(e.clientX, e.clientY); });

document.addEventListener('pointerup', e => { if (e.button === 2 && S.slotPaint.active) {
    S.slotPaint.active = false;
    S.slotPaint.visited.clear();
    S.refreshInventoryUI();
    S.refreshHotbar();
} });

S.renderFullMap = function renderFullMap() { if (!S.UI.fullMap)
    return; const c = S.UI.fullMap, ctx = c.getContext('2d'), W = c.width, H = c.height, steps = 90, radius = 360, cell = W / steps; ctx.clearRect(0, 0, W, H); ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 4, 0, Math.PI * 2); ctx.clip(); for (let j = 0; j < steps; j++)
    for (let i = 0; i < steps; i++) {
        const dx = (i - (steps - 1) / 2) / (steps - 1) * radius * 2, dz = (j - (steps - 1) / 2) / (steps - 1) * radius * 2, wx = Math.floor(S.player.pos[0] + dx), wz = Math.floor(S.player.pos[2] + dz), key = wx + ',' + wz;
        let cellData = S.minimapCache.get(key);
        if (!cellData) {
            const elev = S.terrainHeight(wx, wz), b = S.biomeAt(wx, wz, elev);
            cellData = [elev, S.biomeMapColor[b] || '#526a4a'];
            S.minimapCache.set(key, cellData);
        }
        const h = cellData[0];
        let col = cellData[1];
        if (h <= S.SEA)
            col = '#244d58';
        ctx.fillStyle = col;
        ctx.fillRect(i * cell, j * cell, Math.ceil(cell) + 1, Math.ceil(cell) + 1);
        if (h > 58) {
            ctx.fillStyle = 'rgba(230,235,231,.13)';
            ctx.fillRect(i * cell, j * cell, Math.ceil(cell) + 1, Math.ceil(cell) + 1);
        }
    } const mark = (pos, col, size, shape = 'square') => { if (!pos)
    return; const dx = (pos[0] - S.player.pos[0]) / radius * (W / 2), dz = (pos[2] - S.player.pos[2]) / radius * (H / 2); if (Math.hypot(dx, dz) > W * .49)
    return; ctx.fillStyle = col; if (shape === 'diamond') {
    ctx.save();
    ctx.translate(W / 2 + dx, H / 2 + dz);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
}
else {
    ctx.fillRect(W / 2 + dx - size / 2, H / 2 + dz - size / 2, size, size);
} }; mark(S.worldSpawn, '#e4d6a6', 10, 'diamond'); mark(S.starterChestPos, '#d7ad50', 8); for (const e of S.enemies) {
    if (S.enemyDefs[e.type].passive)
        continue;
    mark(e.pos, '#9f2e31', 5);
} ctx.restore(); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(S.player.yaw); ctx.fillStyle = '#eef2ed'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(9, 11); ctx.lineTo(0, 7); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.strokeStyle = 'rgba(225,236,227,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 4, 0, Math.PI * 2); ctx.stroke(); if (S.UI.mapStats)
    S.UI.mapStats.textContent = `Przebyto: ${(S.player.distanceWalked || 0).toFixed(1)} m · X ${Math.floor(S.player.pos[0])} · Z ${Math.floor(S.player.pos[2])} · zasięg mapy ±${radius} m`; };

S.openFullMap = function openFullMap() { if (!S.running || S.dead)
    return; S.mapOpen = true; S.paused = true; S.inventoryOpen = false; S.adminOpen = false; S.furnaceOpen = false; document.exitPointerLock?.(); S.UI.inventoryPanel.classList.add('hidden'); S.UI.adminPanel.classList.add('hidden'); S.UI.furnacePanel?.classList.add('hidden'); S.UI.fullMapPanel.classList.remove('hidden'); S.renderFullMap(); };

S.closeFullMap = function closeFullMap(resume = true) { S.mapOpen = false; S.UI.fullMapPanel?.classList.add('hidden'); if (resume)
    S.resumeGame(); };
}
