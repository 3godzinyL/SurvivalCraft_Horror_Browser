// NightCraft V15 · native ES module (ui/hud.js); installs into the explicit shared state.
export function install(S) {
S.fps = 0;
S.fpsAcc = 0;
S.fpsFrames = 0;
S.lastTime = performance.now();

S.renderHearts = function renderHearts() {
    if (!S.UI.heartHud)
        return;
    const hearts = 10, hp = S.clamp(S.player.health, 0, 100);
    S.UI.heartHud.innerHTML = '';
    for (let i = 0; i < hearts; i++) {
        const span = document.createElement('span');
        const value = S.clamp(hp - i * 10, 0, 10);
        span.className = 'heart ' + (value >= 7 ? 'full' : value > 0 ? 'half' : 'empty');
        span.textContent = value >= 7 ? '♥' : value > 0 ? '◐' : '♡';
        span.title = `HP ${Math.ceil(hp)}/100`;
        S.UI.heartHud.appendChild(span);
    }
};

S.updateHUD = function updateHUD(dt) {
    if (!S.running)
        return;
    const ph = (S.worldSeconds % S.DAY_SECONDS) / S.DAY_SECONDS, hours = ph * 24, hh = Math.floor(hours) % 24, mm = Math.floor((hours - hh) * 60), dayNo = Math.floor(S.worldSeconds / S.DAY_SECONDS) + 1, night = S.nightLevel();
    const biome = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2]));
    if (S.UI.worldClock)
        S.UI.worldClock.textContent = `DZIEŃ ${dayNo} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (S.UI.worldBiome)
        S.UI.worldBiome.textContent = biome.replaceAll('_', ' ').toUpperCase();
    if (S.UI.compassHeading) {
        const heading = ((S.player.yaw * 180 / Math.PI) % 360 + 360) % 360, dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        S.UI.compassHeading.textContent = `${dirs[Math.round(heading / 45) % 8]} · ${String(Math.round(heading)).padStart(3, '0')}°`;
    }
    if (S.UI.compassPosition)
        S.UI.compassPosition.textContent = `X ${Math.floor(S.player.pos[0])}  ·  Y ${Math.floor(S.player.pos[1])}  ·  Z ${Math.floor(S.player.pos[2])}`;
    if (S.UI.compassStrip) {
        const hd = S.player.yaw * 180 / Math.PI;
        S.UI.compassStrip.style.backgroundPositionX = `${(-hd * 1.65).toFixed(1)}px`;
    }
    S.updateArmorMiniHud();
    if (S.UI.scanWave)
        S.UI.scanWave.style.opacity = String(S.scanPulse > 0 ? S.clamp(S.scanPulse, 0, .8) : 0);
    if (S.UI.miniHp)
        S.UI.miniHp.textContent = `${Math.max(0, Math.ceil(S.player.health / 10))}♥`;
    if (S.UI.miniNight)
        S.UI.miniNight.textContent = `N${S.currentNightNumber()}`;
    if (S.UI.miniLevel)
        S.UI.miniLevel.textContent = `L${S.playerLevel()}`;
    if (S.UI.scanAbility)
        S.UI.scanAbility.textContent = S.playerLevel() < 1 ? `X-RAY · ODBLOKUJ LVL 1 (${S.xp}/90 XP)` : S.scanDuration > 0 ? `X-RAY AKTYWNY · ${Math.ceil(S.scanDuration)} s` : S.scanCooldown > 0 ? `X-RAY · ${Math.ceil(S.scanCooldown)} s` : `X · X-RAY GOTOWY`;
    if (S.UI.xpBar)
        S.UI.xpBar.style.width = `${(S.xp % 90) / 90 * 100}%`;
    if (S.UI.xpLabel)
        S.UI.xpLabel.textContent = `POZIOM ${S.playerLevel()}`;
    if (S.UI.xpNumerical)
        S.UI.xpNumerical.textContent = `${S.xp % 90} / 90 XP`;
    if (S.UI.scanAbility)
        S.UI.scanAbility.classList.toggle('active', S.scanDuration > 0);
    if (S.UI.scanAbility)
        S.UI.scanAbility.classList.toggle('ready', S.playerLevel() >= 1 && S.scanCooldown <= 0);
    S.updateWolfAwarenessHud();
    const threat = S.player.threat > .82 ? 'PANIKA' : S.player.threat > .56 ? 'BLISKO' : night > .7 ? 'EKSTREMALNE' : night > .42 ? 'wysokie' : S.player.threat > .20 ? 'kontakt' : 'czujność';
    S.UI.threatInfo.textContent = `Zagrożenie: ${threat}`;
    S.UI.threatInfo.style.color = night > .7 ? '#d16b6e' : '';
    S.renderHearts();
    S.UI.hungerBar.style.width = `${S.clamp(S.player.hunger, 0, 100)}%`;
    S.UI.hungerText.textContent = String(Math.round(S.player.hunger));
    S.UI.staminaBar.style.width = `${S.clamp(S.player.stamina, 0, 100)}%`;
    S.UI.staminaText.textContent = String(Math.round(S.player.stamina));
    S.UI.sanityBar.style.width = `${S.clamp(S.player.sanity, 0, 100)}%`;
    S.UI.sanityText.textContent = String(Math.round(S.player.sanity));
    const focus = S.enemyRayHit(14);
    if (focus) {
        const d = S.enemyDefs[focus.e.type];
        S.UI.enemyHud.classList.remove('hidden');
        S.UI.enemyName.textContent = d.name.toUpperCase();
        S.UI.enemyHpText.textContent = `${Math.max(0, Math.ceil(focus.e.hp))} / ${focus.e.maxHp}`;
        S.UI.enemyHpFill.style.width = `${S.clamp(focus.e.hp / focus.e.maxHp * 100, 0, 100)}%`;
    }
    else
        S.UI.enemyHud.classList.add('hidden');
    S.fpsAcc += dt;
    S.fpsFrames++;
    if (S.fpsAcc >= .5) {
        S.fps = Math.round(S.fpsFrames / S.fpsAcc);
        S.fpsAcc = 0;
        S.fpsFrames = 0;
    }
    if (S.debug)
        S.UI.debugPanel.textContent = `FPS ${S.fps}\nXYZ ${S.player.pos.map(v => v.toFixed(2)).join(' ')}\nchunk ${S.floorDiv(S.player.pos[0], S.CHUNK)}, ${S.floorDiv(S.player.pos[2], S.CHUNK)}\nchunks ${S.chunks.size} · meshQ ${S.dirtyChunks.size}\nenemies ${S.enemies.length} · birds ${S.birds.length} · drops ${S.droppedItems.length} · particles ${S.particles.length}\nmined ${S.player.blocksMined} · kills ${S.player.kills} · walked ${(S.player.distanceWalked || 0).toFixed(1)}m\nweather ${S.weatherMode}\nseed ${S.worldSeed}\nnight ${(night * 100).toFixed(0)}% · noc ${S.currentNightNumber()} · ${S.currentWorldHour().toFixed(2)}h\nWebGL ${S.gl.getParameter(S.gl.VERSION)}`;
};

S.frame = function frame(now) { const dt = Math.min(.05, (now - S.lastTime) / 1000 || .016); S.lastTime = now; if (S.running && !S.paused && !S.dead)
    S.updateWorld(dt); S.render(); S.updateHUD(dt); S.updateMinimap(dt); if (S.mapOpen)
    S.renderFullMap(); requestAnimationFrame(S.frame); };

requestAnimationFrame(S.frame);
}
