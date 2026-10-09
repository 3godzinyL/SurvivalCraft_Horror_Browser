// NightCraft V15 · native ES module (ui/admin.js); installs into the explicit shared state.
export function install(S) {
S.adminTab = 'blocks';

S.mobIconElement = function mobIconElement(type, def) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    c.className = 'mob-head-icon';
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const col = def.passive ? '#776b55' : '#342a27', dark = def.passive ? '#2d2922' : '#100f0e', eye = def.passive ? '#e0c45d' : '#e24736';
    x.fillStyle = 'rgba(0,0,0,.28)';
    x.fillRect(7, 50, 50, 6);
    x.fillStyle = col;
    x.fillRect(14, 16, 36, 34);
    x.fillStyle = dark;
    x.fillRect(10, 11, 10, 14);
    x.fillRect(44, 11, 10, 14);
    if (['boar', 'bear', 'wolf', 'fox', 'hyena', 'cow', 'moose', 'deer', 'doe'].includes(type)) {
        x.fillStyle = col;
        x.fillRect(20, 39, 24, 13);
    }
    if (type === 'watcher') {
        x.fillStyle = dark;
        x.fillRect(22, 4, 20, 50);
    }
    if (type === 'crawler') {
        x.fillStyle = dark;
        x.fillRect(9, 29, 46, 18);
    }
    x.fillStyle = eye;
    x.fillRect(21, 28, 5, 4);
    x.fillRect(38, 28, 5, 4);
    x.fillStyle = '#080706';
    x.fillRect(23, 29, 2, 2);
    x.fillRect(40, 29, 2, 2);
    if (type === 'boar') {
        x.fillStyle = '#d7cfb4';
        x.fillRect(15, 43, 5, 11);
        x.fillRect(44, 43, 5, 11);
    }
    if (type === 'deer' || type === 'moose') {
        x.fillStyle = '#56412c';
        x.fillRect(16, 3, 4, 15);
        x.fillRect(44, 3, 4, 15);
    }
    return c;
};

S.refreshAdminGrid = function refreshAdminGrid() {
    if (!S.UI.adminGrid)
        return;
    S.UI.adminGrid.innerHTML = '';
    const q = (S.UI.adminSearch?.value || '').trim().toLowerCase();
    if (S.adminTab === 'blocks') {
        for (const [num, def] of Object.entries(S.blockDefs)) {
            const bid = Number(num);
            if (bid === S.B.AIR || bid === S.B.BEDROCK || bid === S.B.WATER || def.decor)
                continue;
            const id = S.blockItemById[bid];
            if (!id)
                continue;
            if (q && !def.name.toLowerCase().includes(q))
                continue;
            const el = document.createElement('div');
            el.className = 'admin-card';
            el.appendChild(S.itemIconCanvas(id, ''));
            const t = document.createElement('strong');
            t.textContent = def.name;
            const sm = document.createElement('small');
            sm.textContent = 'DODAJ ×64';
            el.append(t, sm);
            el.onclick = () => { const n = S.maxStackFor(id) === 1 ? 1 : 64; if (S.addItem(id, n)) {
                S.sfx('inventory', .8);
                S.showMessage(`${def.name}: dodano.`);
            }
            else
                S.showMessage('Brak miejsca w ekwipunku.'); };
            S.UI.adminGrid.appendChild(el);
        }
    }
    else {
        for (const [type, def] of Object.entries(S.enemyDefs)) {
            if (q && !def.name.toLowerCase().includes(q) && !type.includes(q))
                continue;
            const el = document.createElement('div');
            el.className = 'admin-card';
            const icon = S.mobIconElement(type, def);
            const t = document.createElement('strong');
            t.textContent = def.name;
            const sm = document.createElement('small');
            sm.textContent = `HP ${def.hp} · PRZYWOŁAJ`;
            el.append(icon, t, sm);
            el.onclick = () => { const d = S.lookDir(), x = S.player.pos[0] + d[0] * 5, z = S.player.pos[2] + d[2] * 5; S.spawnEnemy(type, x, z, true); S.sfx(def.passive ? 'bird' : 'growl', .35); S.showMessage(`${def.name}: przywołano${def.passive ? '' : ' — agresja aktywna'}.`); };
            S.UI.adminGrid.appendChild(el);
        }
    }
};

S.openAdmin = function openAdmin() { if (!S.adminMode || !S.running || S.dead)
    return; S.adminOpen = true; S.inventoryOpen = false; S.furnaceOpen = false; S.mapOpen = false; S.paused = true; S.furnaceActiveKey = null; document.exitPointerLock?.(); S.UI.inventoryPanel.classList.add('hidden'); S.UI.furnacePanel?.classList.add('hidden'); S.UI.fullMapPanel?.classList.add('hidden'); S.UI.pauseMenu.classList.remove('active'); S.UI.adminPanel.classList.remove('hidden'); S.refreshAdminGrid(); };

S.closeAdmin = function closeAdmin(resume = true) { S.adminOpen = false; S.UI.adminPanel.classList.add('hidden'); if (resume)
    S.resumeGame(); };
}
