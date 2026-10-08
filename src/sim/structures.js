// NightCraft V15 · native ES module (sim/structures.js); installs into the explicit shared state.
export function install(S) {
S.FORT_TIERS = [
    { name: 'DREWNO', maxHp: 80, hard: 1.0, cost: null, color: [.34, .23, .14, 1] },
    { name: 'WZMOCNIONE DREWNO', maxHp: 135, hard: 1.35, cost: { id: 'planks', count: 1 }, color: [.45, .31, .18, 1] },
    { name: 'BRUK', maxHp: 220, hard: 1.9, cost: { id: 'cobble', count: 1 }, color: [.34, .35, .33, 1] },
    { name: 'PRZEPALONY KAMIEŃ', maxHp: 320, hard: 2.5, cost: { id: 'smooth_stone', count: 1 }, color: [.43, .45, .43, 1] },
    { name: 'KAMIENNA CEGŁA', maxHp: 455, hard: 3.2, cost: { id: 'stone_bricks', count: 1 }, color: [.39, .40, .37, 1] },
    { name: 'ŻELAZO', maxHp: 700, hard: 4.4, cost: { id: 'iron_ingot', count: 1 }, color: [.40, .43, .42, 1] }
];

S.UPGRADEABLE_BLOCKS = new Set([S.B.PLANKS, S.B.OLD_PLANKS, S.B.DARK_PLANKS, S.B.WOOD, S.B.PINEWOOD, S.B.BIRCHWOOD, S.B.DARKWOOD, S.B.WILLOWWOOD, S.B.POPLARWOOD, S.B.MIMOSAWOOD, S.B.DEADWOOD, S.B.WOOD_DOOR, S.B.WOOD_STAIRS, S.B.WOOD_FENCE]);

S.fortKey = function fortKey(x, y, z) { return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`; };

S.isUpgradeableBlockId = function isUpgradeableBlockId(id) { return S.UPGRADEABLE_BLOCKS.has(id); };

S.ensureFortification = function ensureFortification(x, y, z, id = S.getBlock(x, y, z), create = true) { const key = S.fortKey(x, y, z); let f = S.fortifications.get(key); if (f)
    return f; if (!create || !S.isUpgradeableBlockId(id) || !S.edits.has(key))
    return null; const t = S.FORT_TIERS[0]; f = { tier: 0, hp: t.maxHp, maxHp: t.maxHp, type: S.blockDefs[id]?.construction || 'wall', orientation: 0, open: false, lastHit: 0 }; S.fortifications.set(key, f); return f; };

S.fortTierAt = function fortTierAt(x, y, z) { return S.ensureFortification(x, y, z, S.getBlock(x, y, z), false)?.tier || 0; };

S.blockHardnessAt = function blockHardnessAt(x, y, z, id) { const f = S.ensureFortification(x, y, z, id, false); return (S.blockDefs[id]?.hard || 1) * (f ? S.FORT_TIERS[f.tier].hard : 1); };

S.damageFortification = function damageFortification(x, y, z, amount, source = 'drapieżnik') { const key = S.fortKey(x, y, z), id = S.getBlock(x, y, z), f = S.ensureFortification(x, y, z, id, true); if (!f)
    return false; f.hp -= amount; f.lastHit = performance.now(); S.spawnDebris(x, y, z, id, 4, false); S.sfx('mine', .45, S.soundMaterialForBlock(id)); if (f.hp <= 0) {
    S.fortifications.delete(key);
    if (id === S.B.FURNACE)
        S.furnaces.delete(key);
    S.setBlock(x, y, z, S.B.AIR);
    S.spawnDebris(x, y, z, id, 16, true);
    S.sfx('break', 1, S.soundMaterialForBlock(id));
    S.showMessage(`${source.toUpperCase()} PRZEBIŁ KONSTRUKCJĘ`, 1.2);
} return true; };

S.constructionStateAt = function constructionStateAt(x, y, z) { return S.fortifications.get(S.fortKey(x, y, z)) || null; };

S.constructionColor = function constructionColor(f) { return S.FORT_TIERS[S.clamp(f?.tier || 0, 0, S.FORT_TIERS.length - 1)].color; };

S.upgradeTargetKey = '';
S.upgradeHold = 0;
S.upgradeMessageCooldown = 0;

S.updateFortifyHud = function updateFortifyHud(hit = null) { if (!S.UI.fortifyHud)
    return; if (!hit) {
    S.UI.fortifyHud.classList.add('hidden');
    return;
} const f = S.ensureFortification(hit.x, hit.y, hit.z, hit.id, false); if (!f) {
    S.UI.fortifyHud.classList.add('hidden');
    return;
} const tier = S.FORT_TIERS[f.tier], next = S.FORT_TIERS[f.tier + 1]; S.UI.fortifyHud.classList.remove('hidden'); S.UI.fortifyHud.classList.toggle('upgrading', S.input.mouseMiddle && S.upgradeTargetKey === S.fortKey(hit.x, hit.y, hit.z)); S.UI.fortifyName.textContent = `${tier.name} · LVL ${f.tier}`; S.UI.fortifyHp.textContent = `${Math.max(0, Math.ceil(f.hp))} / ${f.maxHp}`; S.UI.fortifyFill.style.width = `${S.clamp(f.hp / f.maxHp * 100, 0, 100)}%`; S.UI.fortifyNext.textContent = next ? `ŚPM przytrzymaj: ${S.itemDefs[next.cost.id]?.name || next.cost.id} ×${next.cost.count} · ${(S.upgradeHold / .72 * 100 | 0)}%` : 'MAKSYMALNE WZMOCNIENIE'; };

S.updateUpgrade = function updateUpgrade(dt) { S.upgradeMessageCooldown = Math.max(0, S.upgradeMessageCooldown - dt); if (!S.input.mouseMiddle || S.paused) {
    S.upgradeHold = 0;
    S.upgradeTargetKey = '';
    S.updateFortifyHud(S.currentTarget);
    return;
} const hit = S.voxelRaycast(S.eyePos(), S.lookDir(), 6); if (!hit) {
    S.upgradeHold = 0;
    S.upgradeTargetKey = '';
    S.updateFortifyHud(null);
    return;
} const key = S.fortKey(hit.x, hit.y, hit.z), f = S.ensureFortification(hit.x, hit.y, hit.z, hit.id, true); if (!f) {
    S.upgradeHold = 0;
    S.upgradeTargetKey = '';
    S.updateFortifyHud(null);
    return;
} if (key !== S.upgradeTargetKey) {
    S.upgradeTargetKey = key;
    S.upgradeHold = 0;
} const next = S.FORT_TIERS[f.tier + 1]; if (!next) {
    S.upgradeHold = 0;
    S.updateFortifyHud(hit);
    return;
} if (S.countItem(next.cost.id) < next.cost.count) {
    if (S.upgradeMessageCooldown <= 0) {
        S.showMessage(`Potrzebujesz: ${S.itemDefs[next.cost.id]?.name || next.cost.id} ×${next.cost.count}`, 1.2);
        S.upgradeMessageCooldown = .9;
    }
    S.upgradeHold = 0;
    S.updateFortifyHud(hit);
    return;
} S.upgradeHold += dt; if (S.upgradeHold >= .72) {
    S.removeItem(next.cost.id, next.cost.count);
    f.tier++;
    f.maxHp = S.FORT_TIERS[f.tier].maxHp;
    f.hp = f.maxHp;
    S.upgradeHold = 0;
    S.player.toolSwing = 1;
    S.sfx('place', 1, f.tier === 1 ? 'plank' : f.tier === 2 ? 'cobble' : f.tier === 4 ? 'brick' : f.tier === 5 ? 'metal' : 'stone');
    S.spawnDebris(hit.x, hit.y, hit.z, hit.id, 10, true);
    S.showMessage(`ULEPSZONO: ${S.FORT_TIERS[f.tier].name} · ${f.maxHp} HP`, 1.5);
} S.updateFortifyHud(hit); };
}
