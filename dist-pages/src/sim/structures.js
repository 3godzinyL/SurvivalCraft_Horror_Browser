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

S.WALL_FAMILIES = new Map([[90, { label: "Ściana z utwardzonego drewna", item:"reinforced_wood", hp:165, factor:1.9, tint:"wood" }],[91, { label: "Ściana z utwardzonego bruku", item:"reinforced_cobble", hp:280, factor:2.9, tint:"cobble" }],[92, { label: "Ściana z utwardzonego kamienia", item:"reinforced_stone", hp:410, factor:3.5, tint:"stone" }],[93, { label: "Ściana z utwardzonego żelaza", item:"reinforced_iron", hp:690, factor:5.0, tint:"iron" }]]);
S.UPGRADEABLE_BLOCKS = new Set([S.B.REINFORCED_WOOD,S.B.REINFORCED_COBBLE,S.B.REINFORCED_STONE,S.B.REINFORCED_IRON,S.B.PLANKS, S.B.OLD_PLANKS, S.B.DARK_PLANKS, S.B.WOOD, S.B.PINEWOOD, S.B.BIRCHWOOD, S.B.DARKWOOD, S.B.WILLOWWOOD, S.B.POPLARWOOD, S.B.MIMOSAWOOD, S.B.DEADWOOD, S.B.WOOD_DOOR, S.B.WOOD_STAIRS, S.B.WOOD_FENCE]);

S.wallStats = function wallStats(f) {
    if(f?.family && S.WALL_FAMILIES.has(f.family)) {
        const d=S.WALL_FAMILIES.get(f.family), lvl=Math.max(0,Math.min(3,f.level||0));
        return {name:d.label,level:lvl,maxHp:Math.round(d.hp*[1,1.85,3.15,5.1][lvl]),color:d.tint};
    }
    const tier=S.FORT_TIERS[Math.max(0,Math.min(5,f?.tier||0))];
    return {name:tier.name,level:f?.tier||0,maxHp:tier.maxHp,color:'legacy'};
};
S.enemyBlockDamage=new Map(); // non-wall destructible blocks, persisted separately
S.BLOCK_DAMAGE_TTL=60;
S.fortKey = function fortKey(x, y, z) { return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`; };

S.isUpgradeableBlockId = function isUpgradeableBlockId(id) { return S.UPGRADEABLE_BLOCKS.has(id); };

S.ensureFortification = function ensureFortification(x, y, z, id = S.getBlock(x, y, z), create = true) { const key = S.fortKey(x, y, z); let f = S.fortifications.get(key); if (f)
    return f; if (!create || !S.isUpgradeableBlockId(id) || !S.edits.has(key))
    return null; const family=S.WALL_FAMILIES.has(id)?id:null, t = family ? {maxHp:S.WALL_FAMILIES.get(id).hp} : S.FORT_TIERS[0]; f = { tier: 0, family, level:0, hp: t.maxHp, maxHp: t.maxHp, type: S.blockDefs[id]?.construction || 'wall', orientation: 0, open: false, lastHit: 0 }; S.fortifications.set(key, f); return f; };

S.fortTierAt = function fortTierAt(x, y, z) { return S.ensureFortification(x, y, z, S.getBlock(x, y, z), false)?.tier || 0; };

S.blockHardnessAt = function blockHardnessAt(x, y, z, id) { const f = S.ensureFortification(x, y, z, id, false); return (S.blockDefs[id]?.hard || 1) * (f ? (f.family ? 1+(f.level||0)*1.1 : S.FORT_TIERS[f.tier].hard) : 1); };

S.damageFortification = function damageFortification(x, y, z, amount, source = 'drapieżnik') { const key = S.fortKey(x, y, z), id = S.getBlock(x, y, z), f = S.ensureFortification(x, y, z, id, true); if (!f)
    return false; f.hp -= amount; f.lastHit = performance.now(); f.hitPulse=.33; S.spawnDebris(x, y, z, id, 4, false); S.sfx('mine', .45, S.soundMaterialForBlock(id)); if (f.hp <= 0) {
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

S.updateFortifyHud = function updateFortifyHud(hit=null) {
    if(!S.UI.fortifyHud)return;
    const f=hit?S.ensureFortification(hit.x,hit.y,hit.z,hit.id,S.WALL_FAMILIES.has(hit.id)):null;
    S.UI.fortifyHud.classList.toggle('hidden',!f);
    if(!f)return;
    const st=S.wallStats(f),next=f.family?(f.level<3?{cost:{id:S.WALL_FAMILIES.get(f.family).item,count:[3,6,9][f.level]}}:null):S.FORT_TIERS[f.tier+1];
    S.UI.fortifyHud.classList.toggle('upgrading',S.input.mouseMiddle&&S.upgradeTargetKey===S.fortKey(hit.x,hit.y,hit.z));
    S.UI.fortifyName.textContent=st.name+' · LVL '+st.level+' / '+(f.family?3:5);
    S.UI.fortifyHp.textContent=Math.ceil(Math.max(0,f.hp))+' / '+f.maxHp;
    S.UI.fortifyFill.style.width=S.clamp(100*f.hp/f.maxHp,0,100)+'%';
    S.UI.fortifyNext.textContent=next?'PRZYTRZYMAJ ŚPM · '+(S.itemDefs[next.cost.id]?.name||next.cost.id)+' ×'+next.cost.count+' · '+Math.round(S.upgradeHold/.72*100)+'%':'MAKSYMALNE WZMOCNIENIE';
};
S.updateUpgrade=function updateUpgrade(dt) {
    S.upgradeMessageCooldown=Math.max(0,S.upgradeMessageCooldown-dt);
    const hit=S.voxelRaycast(S.eyePos(),S.lookDir(),6);
    S.updateFortifyHud(hit);
    if(!S.input.mouseMiddle||S.paused||!hit){S.upgradeHold=0;S.upgradeTargetKey='';return;}
    const key=S.fortKey(hit.x,hit.y,hit.z),f=S.ensureFortification(hit.x,hit.y,hit.z,hit.id,true);
    if(!f){S.upgradeHold=0;return;}
    if(key!==S.upgradeTargetKey){S.upgradeHold=0;S.upgradeTargetKey=key;}
    const next=f.family ? (f.level<3?{cost:{id:S.WALL_FAMILIES.get(f.family).item,count:[3,6,9][f.level]}}:null) : S.FORT_TIERS[f.tier+1];
    if(!next){S.upgradeHold=0;return;}
    if(S.countItem(next.cost.id)<next.cost.count){
        if(S.upgradeMessageCooldown<=0){S.showMessage('Potrzebujesz '+(S.itemDefs[next.cost.id]?.name||next.cost.id)+' ×'+next.cost.count,1.2);S.upgradeMessageCooldown=1.5;}
        S.upgradeHold=0;return;
    }
    S.upgradeHold+=dt;
    if(S.upgradeHold<.72)return;
    if(!S.removeItem(next.cost.id,next.cost.count)){S.upgradeHold=0;return;}
    if(f.family){f.level=Math.min(3,(f.level||0)+1);f.maxHp=S.wallStats(f).maxHp;}
    else{f.tier++;f.maxHp=S.FORT_TIERS[f.tier].maxHp;}
    f.hp=f.maxHp;f.hitPulse=.3;S.upgradeHold=0;S.player.toolSwing=1;
    S.sfx('place',.9, f.family===S.B.REINFORCED_WOOD?'plank':f.family===S.B.REINFORCED_IRON?'metal':'stone');
    S.spawnDebris(hit.x,hit.y,hit.z,hit.id,12,true);
    S.showMessage('ULEPSZONO · '+S.wallStats(f).name+' LVL '+S.wallStats(f).level+' · '+f.maxHp+' HP',2);
};
}
