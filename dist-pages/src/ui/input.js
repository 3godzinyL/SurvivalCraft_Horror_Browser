// NightCraft V15 · native ES module (ui/input.js); installs into the explicit shared state.
export function install(S) {
S.tabReturnArmed = false;
S.cameraMode = 0; // 0 first-person, 1 third-person behind, 2 third-person front
S.lockPending = false;
S.expectPointerUnlock = false;

S.clearTransientInput = function clearTransientInput() { S.input.keys.clear(); S.input.mouseLeft = false; S.input.mouseRight = false; S.input.mouseMiddle = false; S.mineAmount = 0; S.mineTargetKey = ''; S.upgradeHold = 0; S.upgradeTargetKey = ''; S.setMiningHud(false); };

S.updateAdminButton = function updateAdminButton() { if (!S.UI.adminToggleBtn)
    return; S.UI.adminToggleBtn.classList.toggle('active', S.adminMode); S.UI.adminToggleBtn.textContent = `TRYB ADMINISTRATORA: ${S.adminMode ? 'ON' : 'OFF'}`; };

S.resumeGame = function resumeGame() {
    if (!S.running || S.dead || S.lockPending) return;
    S.tabReturnArmed = false; S.clearTransientInput(); S.clearInventoryHover?.();
    S.inventoryOpen = false; S.adminOpen = false; S.furnaceOpen = false; S.mapOpen = false; S.chestOpen = false;
    S.furnaceActiveKey = null; S.UI.inventoryPanel.classList.add('hidden'); S.closeRecipeCodex?.();
    S.UI.adminPanel.classList.add('hidden'); S.UI.furnacePanel?.classList.add('hidden'); S.UI.fullMapPanel?.classList.add('hidden');
    if (S.canvas.tabIndex < 0) S.canvas.tabIndex = 0;
    S.canvas.focus?.(); S.initAudio(); S.audio.ctx?.resume?.();
    if (document.pointerLockElement === S.canvas) { S.paused = false; S.UI.pauseMenu.classList.remove('active'); return; }
    if (typeof S.canvas.requestPointerLock !== 'function') { S.paused = false; S.UI.pauseMenu.classList.remove('active'); return; }
    S.lockPending = true;
    // A pointer-lock request can return before pointerlockchange is delivered,
    // or be silently ignored by a browser. Never leave a visible world in an
    // indefinitely paused state after the intro book is dismissed.
    const lockDenied = () => {
        if (!S.lockPending) return;
        S.lockPending = false;
        if (document.pointerLockElement === S.canvas) return;
        S.paused = true;
        S.UI.pauseMenu.classList.add('active');
    };
    try {
        const pending = S.canvas.requestPointerLock();
        Promise.resolve(pending).then(() => {
            if (document.pointerLockElement === S.canvas) {
                S.lockPending = false;
                S.paused = false;
                S.UI.pauseMenu.classList.remove('active');
            }
            // Otherwise wait briefly for pointerlockchange, not indefinitely.
        }).catch(lockDenied);
        setTimeout(lockDenied, 1200);
    } catch (_) { lockDenied(); }
};

S.pauseGame = function pauseGame() { S.clearInventoryHover?.(); if (!S.running || S.dead || S.inventoryOpen || S.adminOpen || S.furnaceOpen || S.mapOpen)
    return; S.paused = true; S.clearTransientInput(); S.UI.pauseMenu.classList.add('active'); };

S.quitToMenu = function quitToMenu() { S.clearInventoryHover?.(); S.saveGame(); S.running = false; S.paused = true; document.exitPointerLock?.(); S.UI.pauseMenu.classList.remove('active'); S.UI.deathMenu.classList.remove('active'); S.UI.inventoryPanel.classList.add('hidden'); S.closeRecipeCodex?.(); S.UI.adminPanel.classList.add('hidden'); S.UI.furnacePanel?.classList.add('hidden'); S.UI.fullMapPanel?.classList.add('hidden'); S.UI.hud.classList.add('hidden'); S.UI.mainMenu.classList.add('active'); S.UI.continueBtn.disabled = !S.hasSave(); };

document.addEventListener('pointerlockchange', () => {
    S.input.locked = document.pointerLockElement === S.canvas;
    if (S.input.locked) { S.lockPending = false; S.expectPointerUnlock = false; S.tabReturnArmed = false; S.paused = false; S.UI.pauseMenu.classList.remove('active'); return; }
    if (S.expectPointerUnlock) { S.expectPointerUnlock = false; return; }
    if (S.lockPending) return;
    if (S.running && !S.dead && !S.inventoryOpen && !S.adminOpen && !S.furnaceOpen && !S.mapOpen && !S.paused) S.pauseGame();
});

document.addEventListener('mousemove', e => { if (!S.input.locked || S.paused)
    return; const zoomScale=S.input.keys.has('KeyC')?.28:1; S.player.yaw += e.movementX * S.input.sensitivity*zoomScale; S.player.pitch -= e.movementY * S.input.sensitivity*zoomScale; S.player.sway = S.clamp(S.player.sway + e.movementX * 0.0008, -.08, .08); S.player.pitch = S.clamp(S.player.pitch, -1.53, 1.53); });

document.addEventListener('keydown', e => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'F5'].includes(e.code))
        e.preventDefault();
    if (e.code === 'F5' && S.running && !S.dead) { // prevent browser reload; cycle camera
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) { S.cameraMode = (S.cameraMode + 1) % 3; S.showMessage(['KAMERA · Z OCZU','KAMERA · ZA PLECAMI','KAMERA · OD PRZODU'][S.cameraMode], 1.2); }
        return;
    }
    S.input.keys.add(e.code);
    if (e.code === 'Escape' && S.running && !S.dead) {
        e.preventDefault();
        S.input.keys.delete(e.code);
        if(S.recipeCodexOpen)S.closeRecipeCodex();
        else if (S.mapOpen)
            S.closeFullMap(true);
        else if (S.furnaceOpen)
            S.closeFurnace(true);
        else if (S.adminOpen)
            S.closeAdmin(true);
        else if (S.inventoryOpen)
            S.closeInventory(true);
        else if (S.paused)
            S.resumeGame();
        else {
            S.pauseGame();
            if (document.pointerLockElement === S.canvas) { S.expectPointerUnlock = true; document.exitPointerLock?.(); }
        }
        return;
    }
    if (e.code === 'KeyE' && S.running && !S.dead) {
        e.preventDefault();
        if (S.furnaceOpen)
            S.closeFurnace(true);
        else if(S.recipeCodexOpen)S.closeRecipeCodex();
        else if (S.mapOpen)
            S.closeFullMap(true);
        else if (S.adminOpen)
            S.closeAdmin(true);
        else if (S.inventoryOpen)
            S.closeInventory(true);
        else
            S.openInventory();
    }
    if (e.code === 'KeyM' && S.running && !S.dead) {
        e.preventDefault();
        if(S.recipeCodexOpen)S.closeRecipeCodex();
        else if (S.mapOpen)
            S.closeFullMap(true);
        else
            S.openFullMap();
    }
    if (e.code === 'KeyT' && S.running && !S.dead && S.adminMode) {
        e.preventDefault();
        if (S.adminOpen)
            S.closeAdmin(true);
        else
            S.openAdmin();
    }
    if (e.code === 'F3') {
        e.preventDefault();
        S.debug = !S.debug;
        S.UI.debugPanel.classList.toggle('hidden', !S.debug);
    }
    if (e.code === 'KeyX' && S.running && !S.paused && !S.dead) {
        e.preventDefault();
        S.activateXray();
    }
    if (/^Digit[1-9]$/.test(e.code) && S.running && !S.inventoryOpen && !S.adminOpen && !S.furnaceOpen && !S.mapOpen) {
        e.preventDefault(); S.setSelected(Number(e.code.slice(5)) - 1);
    }
});

document.addEventListener('keyup', e => S.input.keys.delete(e.code));

S.canvas.addEventListener('mousedown', e => { if (!S.input.locked || S.paused)
    return; if (e.button === 0)
    S.input.mouseLeft = true; if (e.button === 1) {
    e.preventDefault();
    S.input.mouseMiddle = true;
    S.upgradeHold = 0;
} if (e.button === 2) {
    S.input.mouseRight = true;
    S.useSelected();
} });

document.addEventListener('mouseup', e => { if (e.button === 0) {
    S.input.mouseLeft = false;
    S.mineAmount = 0;
    S.mineTargetKey = '';
    S.setMiningHud(false);
} if (e.button === 1) {
    S.input.mouseMiddle = false;
    S.upgradeHold = 0;
    S.upgradeTargetKey = '';
} if (e.button === 2)
    S.input.mouseRight = false; });

S.canvas.addEventListener('contextmenu', e => e.preventDefault());

S.canvas.addEventListener('wheel', e => { if (S.running && !S.paused) {
    S.setSelected(S.player.selected + (e.deltaY > 0 ? 1 : -1));
    e.preventDefault();
} }, { passive: false });

window.addEventListener('blur', () => { S.clearTransientInput(); if (S.running && !S.dead && !S.inventoryOpen && !S.adminOpen && !S.furnaceOpen && !S.mapOpen) {
    S.tabReturnArmed = true;
    document.exitPointerLock?.();
    S.pauseGame();
} });

window.addEventListener('focus', () => { if (S.running && !S.dead && S.tabReturnArmed && !S.inventoryOpen && !S.adminOpen && !S.furnaceOpen && !S.mapOpen) {
    S.paused = true;
    S.UI.pauseMenu.classList.add('active');
    S.clearTransientInput();
    S.canvas.focus?.();
} });

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') {
    S.clearTransientInput();
    if (S.running && !S.dead && !S.inventoryOpen && !S.adminOpen && !S.furnaceOpen && !S.mapOpen) {
        S.tabReturnArmed = true;
        document.exitPointerLock?.();
        S.pauseGame();
    }
}
else if (S.running && !S.dead && S.tabReturnArmed) {
    S.paused = true;
    S.UI.pauseMenu.classList.add('active');
    S.canvas.focus?.();
} });

S.canvas.addEventListener('click', () => { if (S.running && !S.dead && S.paused && S.tabReturnArmed && !S.inventoryOpen && !S.adminOpen && !S.furnaceOpen && !S.mapOpen)
    S.resumeGame(); });

window.addEventListener('beforeunload', () => { if (S.running)
    S.saveGame(); });

S.UI.newGameBtn.onclick = S.startNewGame;

S.UI.continueBtn.onclick = S.loadGame;

S.UI.resumeBtn.onclick = S.resumeGame;

S.UI.saveBtn.onclick = S.saveGame;

S.UI.quitBtn.onclick = S.quitToMenu;

S.UI.respawnBtn.onclick = S.respawn;

S.UI.deathQuitBtn.onclick = S.quitToMenu;

S.UI.closeInventoryBtn.onclick = () => S.closeInventory(true);

if (S.UI.closeFurnaceBtn)
    S.UI.closeFurnaceBtn.onclick = () => S.closeFurnace(true);

if (S.UI.closeMapBtn)
    S.UI.closeMapBtn.onclick = () => S.closeFullMap(true);

S.UI.adminToggleBtn.onclick = () => { S.adminMode = !S.adminMode; S.updateAdminButton(); S.sfx('inventory', .7); S.showMessage(S.adminMode ? 'Tryb administratora włączony. T otwiera katalog.' : 'Tryb administratora wyłączony.', 1.5); S.saveGame(); };

S.UI.closeAdminBtn.onclick = () => S.closeAdmin(true);

S.UI.adminBlocksTab.onclick = () => { S.adminTab = 'blocks'; S.UI.adminBlocksTab.classList.add('active'); S.UI.adminMobsTab.classList.remove('active'); S.refreshAdminGrid(); };

S.UI.adminMobsTab.onclick = () => { S.adminTab = 'mobs'; S.UI.adminMobsTab.classList.add('active'); S.UI.adminBlocksTab.classList.remove('active'); S.refreshAdminGrid(); };

S.UI.adminSearch.oninput = S.refreshAdminGrid;

S.UI.sensInput.oninput = () => S.input.sensitivity = Number(S.UI.sensInput.value);

S.UI.volumeInput.oninput = () => S.setAudioVolume(Number(S.UI.volumeInput.value));

S.UI.renderDistanceSelect.onchange = () => { S.renderDistance = Number(S.UI.renderDistanceSelect.value); S.updateStreaming(S.player.pos[0], S.player.pos[2], true); };

if (S.UI.craftSearch)
    S.UI.craftSearch.oninput = S.refreshInventoryUI;

S.UI.continueBtn.disabled = !S.hasSave();

S.updateAdminButton();
}
