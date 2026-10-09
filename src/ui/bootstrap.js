// NightCraft V15 · native ES module (ui/bootstrap.js); installs into the explicit shared state.
export function install(S) {
S.GAME_DATA = window.__NIGHTCRAFT_DATA__;

S.persistWorldSave = window.__NIGHTCRAFT_PERSIST_SAVE__ || (() => { });

S.cachedSave = window.__NIGHTCRAFT_PRELOADED_SAVE__ || null;

S.$ = (id) => document.getElementById(id);

S.canvas = S.$('game');

S.gl = S.canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });

if (!S.gl) {
    document.body.innerHTML = '<div style="padding:40px;color:white;background:#111;font-family:monospace">Ta przeglądarka nie udostępnia WebGL. Włącz akcelerację sprzętową albo użyj aktualnego Chrome/Edge/Firefox.</div>';
    return;
}

S.UI = {
    mainMenu: S.$('mainMenu'), pauseMenu: S.$('pauseMenu'), deathMenu: S.$('deathMenu'), hud: S.$('hud'),
    inventoryPanel: S.$('inventoryPanel'), inventoryGrid: S.$('inventoryGrid'), recipeList: S.$('recipeList'),
    chestSection: S.$('chestSection'), chestGrid: S.$('chestGrid'), cursorStack: S.$('cursorStack'),
    craftGrid: S.$('craftGrid'), craftOutput: S.$('craftOutput'), craftStatus: S.$('craftStatus'),
    seedInput: S.$('seedInput'), difficultySelect: S.$('difficultySelect'), newGameBtn: S.$('newGameBtn'), continueBtn: S.$('continueBtn'),
    resumeBtn: S.$('resumeBtn'), saveBtn: S.$('saveBtn'), adminToggleBtn: S.$('adminToggleBtn'), quitBtn: S.$('quitBtn'), respawnBtn: S.$('respawnBtn'), deathQuitBtn: S.$('deathQuitBtn'),
    closeInventoryBtn: S.$('closeInventoryBtn'), sensInput: S.$('sensInput'), volumeInput: S.$('volumeInput'), renderDistanceSelect: S.$('renderDistanceSelect'),
    hungerBar: S.$('hungerBar'), staminaBar: S.$('staminaBar'), sanityBar: S.$('sanityBar'),
    hungerText: S.$('hungerText'), staminaText: S.$('staminaText'), sanityText: S.$('sanityText'), heartHud: S.$('heartHud'),
    worldClock: S.$('worldClock'), worldBiome: S.$('worldBiome'), threatInfo: S.$('threatInfo'), message: S.$('message'), hotbar: S.$('hotbar'), selectedLabel: S.$('selectedLabel'),
    debugPanel: S.$('debugPanel'), nightWarning: S.$('nightWarning'), mineProgress: S.$('mineProgress'),
    mineHud: S.$('mineHud'), mineBlockName: S.$('mineBlockName'), minePercent: S.$('minePercent'), mineBarFill: S.$('mineBarFill'), weatherInfo: S.$('weatherInfo'),
    worldMineBar: S.$('worldMineBar'), worldMineName: S.$('worldMineName'), worldMineFill: S.$('worldMineFill'), worldMinePct: S.$('worldMinePct'),
    forestScare: S.$('forestScare'), damageFlash: S.$('damageFlash'), vignette: S.$('vignette'), deathStats: S.$('deathStats'), deathTitle: S.$('deathTitle'),
    mainHandSlot: S.$('mainHandSlot'), offhandSlot: S.$('offhandSlot'), craftSearch: S.$('craftSearch'), enemyHud: S.$('enemyHud'), enemyName: S.$('enemyName'), enemyHpText: S.$('enemyHpText'), enemyHpFill: S.$('enemyHpFill'),
    adminPanel: S.$('adminPanel'), closeAdminBtn: S.$('closeAdminBtn'), adminGrid: S.$('adminGrid'), adminBlocksTab: S.$('adminBlocksTab'), adminMobsTab: S.$('adminMobsTab'), adminSearch: S.$('adminSearch'),
    itemTooltip: S.$('itemTooltip'), waypointHud: S.$('waypointHud'), waypointArrow: S.$('waypointArrow'), waypointText: S.$('waypointText'), minimap: S.$('minimap'), minimapWrap: S.$('minimapWrap'), minimapBiome: S.$('minimapBiome'), minimapCursor: S.$('minimapCursor'), armorOrbs: ['Head', 'Chest', 'Legs', 'Feet'].map(k => S.$('armorOrb' + k)), threatPulse: S.$('threatPulse'),
    compassHeading: S.$('compassHeading'), compassStrip: S.$('compassStrip'), compassPosition: S.$('compassPosition'), scanAbility: S.$('scanAbility'), scanWave: S.$('scanWave'), xpBar: S.$('xpBar'), xpLabel: S.$('xpLabel'), xpNumerical: S.$('xpNumerical'), armorGrid: S.$('armorGrid'), armorStats: S.$('armorStats'), chestTitle: S.$('chestTitle'),
    wolfAwareness: S.$('wolfAwareness'), blackoutFlash: S.$('blackoutFlash'), rainFx: S.$('rainFx'), miniHp: S.$('miniHp'), miniNight: S.$('miniNight'), miniLevel: S.$('miniLevel'),
    furnacePanel: S.$('furnacePanel'), furnaceInput: S.$('furnaceInput'), furnaceFuel: S.$('furnaceFuel'), furnaceOutput: S.$('furnaceOutput'), furnaceBurnFill: S.$('furnaceBurnFill'), furnaceProgressFill: S.$('furnaceProgressFill'), furnaceStatus: S.$('furnaceStatus'), closeFurnaceBtn: S.$('closeFurnaceBtn'),
    fullMapPanel: S.$('fullMapPanel'), fullMap: S.$('fullMap'), mapStats: S.$('mapStats'), closeMapBtn: S.$('closeMapBtn'), fortifyHud: S.$('fortifyHud'), fortifyName: S.$('fortifyName'), fortifyHp: S.$('fortifyHp'), fortifyFill: S.$('fortifyFill'), fortifyNext: S.$('fortifyNext')
};

S.M4 = {
    identity() {
        return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    },
    perspective(fov, aspect, near, far) {
        const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, (2 * far * near) * nf, 0
        ]);
    },
    multiply(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++)
            for (let r = 0; r < 4; r++) {
                o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
            }
        return o;
    },
    translation(x, y, z) {
        const m = this.identity();
        m[12] = x;
        m[13] = y;
        m[14] = z;
        return m;
    },
    scale(x, y, z) {
        const m = this.identity();
        m[0] = x;
        m[5] = y;
        m[10] = z;
        return m;
    },
    rotY(a) {
        const c = Math.cos(a), s = Math.sin(a);
        return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
    },
    rotX(a) {
        const c = Math.cos(a), s = Math.sin(a);
        return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
    },
    rotZ(a) {
        const c = Math.cos(a), s = Math.sin(a);
        return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    },
    lookAt(eye, target, up = [0, 1, 0]) {
        let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
        let l = Math.hypot(zx, zy, zz) || 1;
        zx /= l;
        zy /= l;
        zz /= l;
        let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
        l = Math.hypot(xx, xy, xz) || 1;
        xx /= l;
        xy /= l;
        xz /= l;
        let yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
        return new Float32Array([
            xx, yx, zx, 0,
            xy, yy, zy, 0,
            xz, yz, zz, 0,
            -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
            -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
            -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1
        ]);
    }
};
}
