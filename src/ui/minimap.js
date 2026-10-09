// NightCraft V15 · native ES module (ui/minimap.js); installs into the explicit shared state.
export function install(S) {
S.minimapTimer = 0;

S.minimapCache = new Map();

S.biomeMapColor = { beach: '#9a8d68', wet_shore: '#596d50', riverlands: '#4d725d', frozen_shore: '#aeb9b3', willow_swamp: '#344b35', swamp: '#30452f', marsh: '#415844', tundra: '#778078', snow_peaks: '#c6cbc7', alpine: '#828883', taiga: '#314b39', spruce_valley: '#284235', cold_plains: '#687462', red_barrens: '#7d4b35', chaparral: '#6f6647', mist_forest: '#294032', old_growth: '#203429', darkwood: '#1d3026', forest: '#315237', poplar_grove: '#486343', birch: '#4f6847', flower_meadow: '#64835a', meadow: '#607b53', autumn: '#665235', barren: '#605b4c', pine_barrens: '#4d5b43', plains: '#5e7650', mountain_forest: '#354c3b', highlands: '#5e655b', rocky: '#66645f' };

S.updateMinimap = function updateMinimap(dt) {
    if (!S.UI.minimap || !S.running)
        return;
    // Heading is updated each rendered frame, independently of slow terrain sampling.
    if (S.UI.minimapCursor)
        S.UI.minimapCursor.style.transform = `translate(-50%,-50%) rotate(${S.player.yaw * 180 / Math.PI}deg)`;
    S.minimapTimer -= dt;
    if (S.minimapTimer > 0)
        return;
    S.minimapTimer = .12;
    const c = S.UI.minimap, ctx = c.getContext('2d'), W = c.width, H = c.height, steps = 41, radius = S.clamp((S.mapView?.radius || 360) * 57 / 360, 22, 330), cell = W / steps;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    for (let j = 0; j < steps; j++)
        for (let i = 0; i < steps; i++) {
            const dx = (i - (steps - 1) / 2) / (steps - 1) * radius * 2, dz = (j - (steps - 1) / 2) / (steps - 1) * radius * 2, wx = Math.floor(S.player.pos[0] + dx), wz = Math.floor(S.player.pos[2] + dz), h = S.terrainHeight(wx, wz), b = S.biomeAt(wx, wz, h);
            let col = S.biomeMapColor[b] || '#526a4a';
            if (h <= S.SEA)
                col = '#244d58';
            ctx.fillStyle = col;
            ctx.fillRect(i * cell, j * cell, Math.ceil(cell) + 1, Math.ceil(cell) + 1);
            if (h > S.SEA + 22) {
                ctx.fillStyle = 'rgba(225,232,226,.12)';
                ctx.fillRect(i * cell, j * cell, Math.ceil(cell) + 1, Math.ceil(cell) + 1);
            }
        }
    // Last grave marker remains after respawn and points to the actual death.
    if (S.lastDeathPosition) {
        const dx=(S.lastDeathPosition[0]-S.player.pos[0])/radius*(W/2),dz=(S.lastDeathPosition[2]-S.player.pos[2])/radius*(H/2);
        if(Math.hypot(dx,dz)<W*.47){
            ctx.strokeStyle='#f18f8f';ctx.lineWidth=2.1;
            ctx.beginPath();ctx.moveTo(W/2+dx-4,H/2+dz-4);ctx.lineTo(W/2+dx+4,H/2+dz+4);
            ctx.moveTo(W/2+dx+4,H/2+dz-4);ctx.lineTo(W/2+dx-4,H/2+dz+4);ctx.stroke();
        }
    }
    // Waypoint is world-anchored. Edge arrow stays visible even when marker
    // is beyond mini-map range (it never teleports to the player).
    if(S.waypoint){
        // When the goal is the mill, follow the CURRENT route leg, not the island
        // centre behind the water. Custom player waypoints stay untouched.
        const millGoal=S.villagePlan&&Math.hypot(S.waypoint.x-S.villagePlan.x,S.waypoint.z-S.villagePlan.z)<5;
        const waypoint=millGoal&&S.villageNavigation?.target?S.villageNavigation.target:S.waypoint;
        const dx=(waypoint.x-S.player.pos[0])/radius*(W/2);
        const dz=(waypoint.z-S.player.pos[2])/radius*(H/2);
        const len=Math.hypot(dx,dz),scale=len>W*.43?(W*.43/len):1;
        const mx=W/2+dx*scale,mz=H/2+dz*scale;
        ctx.save();ctx.translate(mx,mz);ctx.rotate(Math.atan2(dx,-dz));
        ctx.strokeStyle='#261f10';ctx.lineWidth=2.5;ctx.fillStyle='#ffe3a1';
        ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,4);ctx.lineTo(0,1);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
    // Route is drawn in WORLD coordinates, and the edge-of-map pointer
    // leads to the immediate stage (not blindly across the lagoon).
    if(S.villageNavigation){
        const t=S.villageNavigation.target,dx=t.x-S.player.pos[0],dz=t.z-S.player.pos[2];
        const len=Math.hypot(dx,dz)||1,frac=Math.min(1,radius*.43/len);
        const ex=W/2+dx/radius*(W/2)*frac,ez=H/2+dz/radius*(H/2)*frac;
        ctx.save();ctx.strokeStyle='#eed18c';ctx.lineWidth=2.4;ctx.setLineDash([6,4]);
        ctx.beginPath();ctx.moveTo(W/2,H/2);ctx.lineTo(ex,ez);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#f3dda1';ctx.strokeStyle='#3c2f1c';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(ex,ez,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    }
    // Village mine entrance is visible on the minimap when inside map radius.
    if(S.villagePlan){
        const dx=(S.villagePlan.x-12-S.player.pos[0])/radius*(W/2),dz=(S.villagePlan.z-35-S.player.pos[2])/radius*(H/2);
        if(Math.hypot(dx,dz)<W*.45){
            ctx.save();ctx.fillStyle='#c6e3e4';ctx.strokeStyle='#243c3d';ctx.lineWidth=2;
            ctx.fillRect(W/2+dx-4,H/2+dz-4,8,8);ctx.strokeRect(W/2+dx-4,H/2+dz-4,8,8);
            ctx.restore();
        }
    }
    // chest + nearby hostile markers
    if (S.starterChestPos) {
        const dx = (S.starterChestPos[0] + .5 - S.player.pos[0]) / radius * (W / 2), dz = (S.starterChestPos[2] + .5 - S.player.pos[2]) / radius * (H / 2);
        if (Math.hypot(dx, dz) < W * .48) {
            ctx.fillStyle = '#d4ae58';
            ctx.fillRect(W / 2 + dx - 2, H / 2 + dz - 2, 4, 4);
        }
    }
    S.mpDrawMarkers?.(ctx,W,H,radius);
    for (const e of S.enemies) {
        const def = S.enemyDefs[e.type];
        if (def.passive)
            continue;
        const dx = (e.pos[0] - S.player.pos[0]) / radius * (W / 2), dz = (e.pos[2] - S.player.pos[2]) / radius * (H / 2);
        if (Math.hypot(dx, dz) < W * .47) {
            ctx.fillStyle = '#9d302d';
            ctx.beginPath();
            ctx.arc(W / 2 + dx, H / 2 + dz, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
    if (S.minimapCache.size > 6800)
        S.minimapCache.clear();
    ctx.strokeStyle = 'rgba(213,174,79,.92)';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    if (S.UI.minimapBiome)
        S.UI.minimapBiome.textContent = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2])).replaceAll('_', ' ');
};

S.updateArmorMiniHud = function updateArmorMiniHud() {
    const names = ['head', 'chest', 'legs', 'feet'];
    for (let i = 0; i < 4; i++) {
        const el = S.UI.armorOrbs?.[i];
        if (!el)
            continue;
        const part = names[i], st = S.armorSlots[part], def = st ? S.itemDefs[st.id] : null;
        const value = def ? Math.max(0, Math.round(100 * (1 - S.armorWear[part] / def.durability))) : 0;
        el.style.setProperty('--wear', `${value}%`);
        el.classList.toggle('equipped', !!st);
        el.classList.toggle('warn', !!st && value <= 25);
        const label = el.querySelector?.('em');
        if (label)
            label.textContent = st ? `${value}%` : '—';
        el.title = st ? `${def.name}: ${value}% trwałości` : `${['Hełm', 'Napierśnik', 'Spodnie', 'Buty'][i]}: brak`;
    }
};

S.updateWolfAwarenessHud = function updateWolfAwarenessHud() {
    if (!S.UI.wolfAwareness)
        return;
    const c = S.UI.wolfAwareness, ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    let sight = 0, hearing = 0, spotted = false, nearest = 999, investigating = false;
    for (const e of S.enemies) {
        if (e.type !== 'wolf')
            continue;
        const d = Math.hypot(e.pos[0] - S.player.pos[0], e.pos[2] - S.player.pos[2]);
        if (d > 62)
            continue;
        nearest = Math.min(nearest, d);
        sight = Math.max(sight, e.sightAwareness || 0);
        hearing = Math.max(hearing, e.hearingAwareness || 0);
        investigating = investigating || (!e.spotted && (e.heardTimer || 0) > 0);
        if (e.spotted) {
            spotted = true;
            sight = 1;
        }
    }
    if (Math.max(sight, hearing) < .018 && !spotted)
        return;
    const bg = 'rgba(8,10,9,.52)', r = Math.min(58, W * .27), cy = H - 8, lw = 7, startL = Math.PI * .61, endL = Math.PI * .965, startR = Math.PI * .035, endR = Math.PI * .39;
    ctx.lineCap = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = bg;
    for (const [a, b] of [[startL, endL], [startR, endR]]) {
        ctx.beginPath();
        ctx.arc(W / 2, cy, r, a, b);
        ctx.stroke();
    }
    const sightCol = spotted || sight > .94 ? 'rgba(242,43,34,.98)' : sight > .62 ? 'rgba(232,125,37,.96)' : 'rgba(218,193,117,.94)', hearCol = hearing > .90 ? 'rgba(238,63,39,.96)' : hearing > .58 ? 'rgba(224,145,50,.94)' : 'rgba(184,171,118,.90)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = sightCol;
    ctx.shadowColor = sightCol;
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, startL, startL + (endL - startL) * S.clamp(sight, 0, 1));
    ctx.stroke();
    ctx.strokeStyle = hearCol;
    ctx.shadowColor = hearCol;
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, endR, endR - (endR - startR) * S.clamp(hearing, 0, 1), true);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(225,214,176,.80)';
    ctx.fillText('WZROK', W / 2 - r * .77, H - 7);
    ctx.fillText('SŁUCH', W / 2 + r * .77, H - 7);
    if (spotted) {
        ctx.fillStyle = 'rgba(244,54,42,.96)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('WYKRYTO', W / 2, H - 22);
    }
    else if (investigating) {
        ctx.fillStyle = 'rgba(226,167,74,.92)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('NASŁUCHUJE', W / 2, H - 22);
    }
};
}
