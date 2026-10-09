// NightCraft V15 · native ES module (render/scene.js); installs into the explicit shared state.
export function install(S) {
S.resize = function resize() { const dpr = Math.min(1.5, window.devicePixelRatio || 1), w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr); if (S.canvas.width !== w || S.canvas.height !== h) {
    S.canvas.width = w;
    S.canvas.height = h;
    S.gl.viewport(0, 0, w, h);
} };

S.drawVoxelMesh = function drawVoxelMesh(m, alpha, VP, cam, fogColor, fogNear, fogFar, day, torchPos, torchPower, waterMode = 0) {
    if (!m)
        return;
    S.gl.useProgram(S.voxelProgram);
    S.gl.uniformMatrix4fv(S.VL.vp, false, VP);
    S.gl.uniform3fv(S.VL.cam, cam);
    S.gl.uniform3fv(S.VL.fogColor, fogColor);
    S.gl.uniform1f(S.VL.fogNear, fogNear);
    S.gl.uniform1f(S.VL.fogFar, fogFar);
    S.gl.uniform1f(S.VL.day, day);
    S.gl.uniform3fv(S.VL.torch, torchPos);
    S.gl.uniform1f(S.VL.torchPower, torchPower);
    S.gl.uniform1f(S.VL.alpha, alpha);
    S.gl.uniform1f(S.VL.time, performance.now() / 1000);
    S.gl.uniform1f(S.VL.water, waterMode);
    const shadow=S.sunShadow;
    S.gl.uniform2fv(S.VL.shadowOrigin, shadow?.origin || [0,0]);
    S.gl.uniform1f(S.VL.shadowSpan, shadow?.span || 256);
    S.gl.uniform1f(S.VL.shadowAmount, shadow?.valid && S.running && !waterMode ? 1 : 0);
    S.gl.activeTexture(S.gl.TEXTURE1);
    S.gl.bindTexture(S.gl.TEXTURE_2D,shadow?.tex || null);
    S.gl.uniform1i(S.VL.shadowHeight,1);
    S.gl.activeTexture(S.gl.TEXTURE0);
    S.gl.bindTexture(S.gl.TEXTURE_2D, S.atlas.tex);
    S.gl.uniform1i(S.VL.tex, 0);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, m.p);
    S.gl.enableVertexAttribArray(S.VL.pos);
    S.gl.vertexAttribPointer(S.VL.pos, 3, S.gl.FLOAT, false, 0, 0);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, m.n);
    S.gl.enableVertexAttribArray(S.VL.normal);
    S.gl.vertexAttribPointer(S.VL.normal, 3, S.gl.BYTE, false, 0, 0);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, m.u);
    S.gl.enableVertexAttribArray(S.VL.uv);
    S.gl.vertexAttribPointer(S.VL.uv, 2, S.gl.FLOAT, false, 0, 0);
    if(S.VL.wind>=0){
        if(m.wind){S.gl.bindBuffer(S.gl.ARRAY_BUFFER,m.wind);S.gl.enableVertexAttribArray(S.VL.wind);S.gl.vertexAttribPointer(S.VL.wind,1,S.gl.UNSIGNED_BYTE,true,0,0);}
        else {S.gl.disableVertexAttribArray(S.VL.wind);S.gl.vertexAttrib1f(S.VL.wind,0);}
    }
    S.gl.drawArrays(S.gl.TRIANGLES, 0, m.count);
};

S.drawBox = function drawBox(VP, pos, scale, color, ry, fogColor, cam, rx = 0, rz = 0) {
    const model = S.modelMatrix(pos, scale, ry || 0, rx || 0, rz || 0), mvp = S.M4.multiply(VP, model), fog = S.clamp((S.dist3(pos, cam) - 14) / (S.renderDistance * S.CHUNK - 10), 0, 1);
    S.gl.useProgram(S.colorProgram);
    S.gl.uniformMatrix4fv(S.CL.mvp, false, mvp);
    S.gl.uniform4fv(S.CL.color, color);
    S.gl.uniform1f(S.CL.fog, fog);
    S.gl.uniform3fv(S.CL.fogColor, fogColor);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.cubeBuffer);
    S.gl.enableVertexAttribArray(S.CL.pos);
    S.gl.vertexAttribPointer(S.CL.pos, 3, S.gl.FLOAT, false, 0, 0);
    S.gl.drawArrays(S.gl.TRIANGLES, 0, 36);
};

S.rotatedOffset = function rotatedOffset(base, off, ry) { const c = Math.cos(ry), s = Math.sin(ry); return [base[0] + off[0] * c + off[2] * s, base[1] + off[1], base[2] - off[0] * s + off[2] * c]; };

S.shadowDiscVerts = [];

for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, b = (i + 1) / 24 * Math.PI * 2;
    S.shadowDiscVerts.push(0, 0, 0, Math.cos(a), 0, Math.sin(a), Math.cos(b), 0, Math.sin(b));
}

S.shadowDiscBuffer = S.gl.createBuffer();

S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.shadowDiscBuffer);

S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(S.shadowDiscVerts), S.gl.STATIC_DRAW);

S.drawShadowDisc = function drawShadowDisc(VP, pos, rx, rz, alpha, fogColor, cam) { const model = S.M4.multiply(S.M4.translation(pos[0], pos[1], pos[2]), S.M4.scale(rx, .012, rz)), mvp = S.M4.multiply(VP, model), fog = S.clamp((S.dist3(pos, cam) - 12) / (S.renderDistance * S.CHUNK - 8), 0, 1); S.gl.useProgram(S.colorProgram); S.gl.uniformMatrix4fv(S.CL.mvp, false, mvp); S.gl.uniform4fv(S.CL.color, new Float32Array([.012, .016, .018, alpha])); S.gl.uniform1f(S.CL.fog, fog); S.gl.uniform3fv(S.CL.fogColor, fogColor); S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.shadowDiscBuffer); S.gl.enableVertexAttribArray(S.CL.pos); S.gl.vertexAttribPointer(S.CL.pos, 3, S.gl.FLOAT, false, 0, 0); S.gl.drawArrays(S.gl.TRIANGLES, 0, S.shadowDiscVerts.length / 3); };

S.renderContactShadows = function renderContactShadows(VP, fogColor, cam, day) {
    const strength = .18 + .26 * S.clamp(day, 0, 1);
    let drawn = 0;
    for (const e of S.enemies) {
        if (drawn > 48)
            break;
        const def = S.enemyDefs[e.type], dx = e.pos[0] - cam[0], dz = e.pos[2] - cam[2], dist = Math.hypot(dx, dz);
        if (dist > 48)
            continue;
        const gy = e.pos[1] + .018, base = Math.max(.42, (def.width || .75) * .82);
        for (const [sc, a] of [[1, .20], [1.35, .085], [1.75, .035]])
            S.drawShadowDisc(VP, [e.pos[0], gy, e.pos[2]], base * sc, base * .70 * sc, a * strength, fogColor, cam);
        drawn++;
    }
    for (const d of S.droppedItems) {
        if (drawn > 72)
            break;
        if (Math.hypot(d.pos[0] - cam[0], d.pos[2] - cam[2]) > 32)
            continue;
        const gy = S.findSurface(Math.floor(d.pos[0]), Math.floor(d.pos[2])) + .014;
        S.drawShadowDisc(VP, [d.pos[0], gy, d.pos[2]], .22, .16, .16 * strength, fogColor, cam);
        drawn++;
    }
};

S.renderPlayerAvatar=function renderPlayerAvatar(VP,fogColor,cam){
    const p=S.player.pos, yaw=-S.player.yaw, moving=Math.hypot(S.player.vel[0],S.player.vel[2])>.7;
    const stride=moving?Math.sin(S.player.movePhase*1.5)*.32:0, bounce=moving?Math.abs(Math.sin(S.player.movePhase*1.5))*.045:Math.sin(performance.now()*.002)*.011;
    const skin=[.57,.43,.33,1],cloth=[.12,.19,.15,1],pants=[.11,.13,.14,1];
    const partTint=part=>{const st=S.armorSlots[part],d=st&&S.itemDefs[st.id];return !d?null:d.tier==='iron'?[.45,.51,.55,1]:[.43,.29,.18,1]};
    const draw=(off,sz,col,rx=0)=>S.drawBox(VP,S.rotatedOffset(p,[off[0],off[1]+bounce,off[2]],yaw),sz,col,yaw,fogColor,cam,rx);
    draw([0,1.30,0],[.56,.69,.29],partTint('chest')||cloth);
    draw([0,1.86,0],[.40,.38,.36],partTint('head')||skin);
    draw([-.35,1.3,0],[.18,.68,.22],partTint('chest')||cloth,-stride);
    draw([.35,1.3,0],[.18,.68,.22],partTint('chest')||cloth,stride);
    for (const side of [-1,1]) {
        draw([side*.15,.49,side*stride*.24],[.22,.95,.24],partTint('legs')||pants,side*stride);
        draw([side*.15,.115,-.075+side*stride*.4],[.23,.22,.39],partTint('feet')||[.17,.12,.10,1]);
    }
    // Face: head orientation, expressive eyes, nose, hair and shoulder seams.
    draw([0,2.075,-.02],[.45,.13,.41],[.16,.12,.085,1]);
    for(const sx of [-1,1]){
        draw([sx*.156,1.90,-.194],[.080,.075,.018],[.83,.87,.78,1]);
        draw([sx*.161,1.90,-.211],[.035,.053,.018],[.12,.15,.17,1]);
        draw([sx*.156,1.967,-.200],[.09,.027,.019],[.19,.12,.09,1]);
    }
    draw([0,1.78,-.191],[.145,.022,.018],[.29,.16,.12,1]);
    const equipped=S.selectedItem();
    if(equipped&&S.countItem(equipped)>0){
      const hand=S.rotatedOffset(p,[.52,.9+bounce,-.26+stride*.12],yaw);
      S.drawBox(VP,hand,[.11,.24,.12],[.50,.34,.25,1],yaw,fogColor,cam,-stride*.36);
      S.drawEquipmentModel(VP,S.rotatedOffset(hand,[0,.21,-.05],yaw),yaw,-stride*.20,.03,equipped,fogColor,cam,.70);
    }
    if(partTint('chest')){draw([0,1.41,-.17],[.45,.15,.07],[.18,.13,.10,1]);draw([0,1.13,-.17],[.46,.065,.07],[.64,.47,.29,1]);}
};

S.renderEnemy = function renderEnemy(e, VP, fogColor, cam) {
    const def = S.enemyDefs[e.type], ry = -(e.renderFacing ?? e.facing ?? Math.atan2(S.player.pos[0] - e.pos[0], -(S.player.pos[2] - e.pos[2]))), flash = e.flash > 0 ? [.72, .10, .08, 1] : def.color, g = Math.sin(e.gait), g2 = Math.sin(e.gait + Math.PI), breath = Math.sin(e.age * 2.2) * .035;
    const eyeColor = e.type === 'wraith' ? [.35, .55, 1, 1] : e.type === 'watcher' || e.type === 'crawler' ? [1, .04, .025, 1] : [.82, .66, .22, 1];
    if(def.flying){
        const scale=e.type==='night_harrier'?1.38:1,beat=Math.sin(e.gait)*.5,flutter=Math.cos(e.age*13)*.13;
        const body=[e.pos[0],e.pos[1],e.pos[2]];
        S.drawBox(VP,body,[.38*scale,.47*scale,.68*scale],flash,ry,fogColor,cam,.12);
        S.drawBox(VP,S.rotatedOffset(body,[0,.11*scale,-.38*scale],ry),[.38*scale,.30*scale,.34*scale],flash,ry,fogColor,cam);
        const wing=def.color.map((c,i)=>i===3?1:c*.88);
        for(const side of [-1,1]){
            const anchor=S.rotatedOffset(body,[side*.48*scale,.05+beat*.17,.01],ry);
            S.drawBox(VP,anchor,[.81*scale,.045,.41*scale],wing,ry,fogColor,cam,0,side*(beat*.45+flutter));
            const tip=S.rotatedOffset(body,[side*1.0*scale,.08+beat*.27,.12],ry);
            S.drawBox(VP,tip,[.62*scale,.035,.24*scale],wing,ry,fogColor,cam,0,side*(beat*.62));
        }
        for(const side of [-1,1]){
            const eye=S.rotatedOffset(body,[side*.15*scale,.12*scale,-.55*scale],ry);
            S.drawBox(VP,eye,[.08,.055,.04],e.skyState==='dive'?[1,.22,.05,1]:[.93,.50,.08,1],ry,fogColor,cam);
        }
        S.drawBox(VP,S.rotatedOffset(body,[0,-.14,.42*scale],ry),[.2,.08,.51*scale],flash,ry,fogColor,cam,-.23);
        return;
    }
    if(e.type==='hollowed'){
        const body=S.rotatedOffset(e.pos,[0,1.13+breath,0],ry);
        const skin=e.flash>0?flash:[.18,.205,.19,1], rot=(Math.sin(e.age*1.2)*.04);
        S.drawBox(VP,body,[1.05,1.56,.64],skin,ry,fogColor,cam,rot);
        S.drawBox(VP,S.rotatedOffset(e.pos,[0,2.15+breath,-.11],ry),[.69,.79,.67],[.22,.23,.21,1],ry,fogColor,cam,-.12);
        S.drawBox(VP,S.rotatedOffset(e.pos,[0,1.83,-.48],ry),[.27,.45,.12],[.045,.038,.038,1],ry,fogColor,cam);
        for(const side of [-1,1]){
            S.drawBox(VP,S.rotatedOffset(e.pos,[side*.27,2.24,-.463],ry),[.21,.17,.032],[.025,.024,.026,1],ry,fogColor,cam);
            const sway=Math.sin(e.age*1.9+side*1.9)*.09;
            S.drawBox(VP,S.rotatedOffset(e.pos,[side*.29+sway*.3,1.93,-.51],ry),[.034,.66,.041],[.37,.12,.13,1],ry,fogColor,cam,sway);
            S.drawBox(VP,S.rotatedOffset(e.pos,[side*.29+sway,1.57+Math.sin(e.age*2+side)*.11,-.54],ry),[.22,.19,.20],[.77,.69,.56,1],ry,fogColor,cam);
            S.drawBox(VP,S.rotatedOffset(e.pos,[side*.29+sway,1.57+Math.sin(e.age*2+side)*.11,-.653],ry),[.09,.10,.032],[.20,.095,.07,1],ry,fogColor,cam);
            S.drawBox(VP,S.rotatedOffset(e.pos,[side*.68,1.36,.02],ry),[.22,1.7,.27],skin,ry,fogColor,cam,Math.sin(e.gait)*.09);
            S.drawBox(VP,S.rotatedOffset(e.pos,[side*.25,.36,.02+Math.sin(e.gait+side)*.08],ry),[.32,.77,.33],skin,ry,fogColor,cam);
        }
    }
    else if (['deer', 'doe', 'moose', 'horse'].includes(e.type)) {
        const scale = e.type === 'moose' ? 1.22 : e.type === 'horse' ? 1.08 : e.type === 'deer' ? 1 : .86, body = [e.pos[0], e.pos[1] + .78 * scale + breath, e.pos[2]], neck = S.rotatedOffset(e.pos, [0, 1.14 * scale, -.56 * scale], ry), head = S.rotatedOffset(e.pos, [0, 1.48 * scale, -.82 * scale], ry);
        S.drawBox(VP, body, [1.02 * scale, .62 * scale, .48 * scale], flash, ry, fogColor, cam);
        S.drawBox(VP, neck, [.28 * scale, .72 * scale, .28 * scale], flash, ry, fogColor, cam, -.35);
        S.drawBox(VP, head, [.42 * scale, .38 * scale, .48 * scale], flash, ry, fogColor, cam);
        for (const [ox, oz, ph] of [[-.28, -.30, g], [.28, -.30, g2], [-.28, .30, g2], [.28, .30, g]])
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox, .31 * scale, oz + ph * .10], ry), [.10 * scale, .70 * scale, .10 * scale], flash, ry, fogColor, cam, ph * .12);
        S.drawBox(VP, S.rotatedOffset(head, [-.18 * scale, .25 * scale, 0], ry), [.07, .22, .06], flash, ry, fogColor, cam, 0, -.3);
        S.drawBox(VP, S.rotatedOffset(head, [.18 * scale, .25 * scale, 0], ry), [.07, .22, .06], flash, ry, fogColor, cam, 0, .3);
        if (e.type === 'deer' || e.type === 'moose') {
            for (const side of [-1, 1]) {
                const a = S.rotatedOffset(head, [side * .12, .30, -.02], ry);
                S.drawBox(VP, a, [.035, .48, .035], [.29, .21, .14, 1], ry, fogColor, cam, 0, side * .2);
                S.drawBox(VP, S.rotatedOffset(a, [side * .09, .20, 0], ry), [.025, .22, .025], [.29, .21, .14, 1], ry, fogColor, cam, 0, side * .55);
            }
        }
        const ep = S.rotatedOffset(head, [0, .03, -.25], ry);
        for (const ex of [-.11, .11])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.035, .035, .02], [.06, .05, .04, 1], ry, fogColor, cam);
    }
    else if (e.type === 'cow' || e.type === 'sheep') {
        const cs = e.type === 'sheep' ? .78 : 1, body = [e.pos[0], e.pos[1] + .66 * cs + breath, e.pos[2]];
        S.drawBox(VP, body, [1.38 * cs, .86 * cs, .66 * cs], flash, ry, fogColor, cam);
        if (e.type === 'sheep')
            S.drawBox(VP, [body[0], body[1] + .05, body[2]], [1.48 * cs, .93 * cs, .72 * cs], [.70, .69, .63, 1], ry, fogColor, cam);
        const hd = S.rotatedOffset(e.pos, [0, .75 * cs, -.92 * cs], ry);
        S.drawBox(VP, hd, [.62 * cs, .58 * cs, .54 * cs], e.type === 'sheep' ? [.28, .25, .22, 1] : flash, ry, fogColor, cam);
        for (const [ox, oz, ph] of [[-.42, -.34, g], [.42, -.34, g2], [-.42, .34, g2], [.42, .34, g]])
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox * cs, .25 * cs, oz * cs + ph * .06], ry), [.17 * cs, .62 * cs, .17 * cs], e.type === 'sheep' ? [.24, .22, .20, 1] : flash, ry, fogColor, cam, ph * .08);
        for (const side of [-1, 1])
            S.drawBox(VP, S.rotatedOffset(hd, [side * .33 * cs, .18 * cs, -.03], ry), [.07, .20, .06], [.58, .51, .39, 1], ry, fogColor, cam, 0, side * .55);
        if (e.type === 'cow') {
            const sn = S.rotatedOffset(hd, [0, -.08, -.34 * cs], ry);
            S.drawBox(VP, sn, [.35 * cs, .20 * cs, .22 * cs], [.45, .30, .25, 1], ry, fogColor, cam);
            for (const side of [-1, 1])
                S.drawBox(VP, S.rotatedOffset(hd, [side * .24 * cs, .30 * cs, -.04], ry), [.035, .19, .035], [.68, .61, .45, 1], ry, fogColor, cam, 0, side * .48);
        }
        const ep = S.rotatedOffset(hd, [0, .06, -.29 * cs], ry);
        for (const ex of [-.16, .16])
            S.drawBox(VP, S.rotatedOffset(ep, [ex * cs, 0, 0], ry), [.04, .04, .025], [.04, .035, .03, 1], ry, fogColor, cam);
    }
    else if (e.type === 'rabbit') {
        const p = [e.pos[0], e.pos[1] + .27 + Math.abs(g) * .11, e.pos[2]], coat = flash, light = [Math.min(1, coat[0] * 1.18), Math.min(1, coat[1] * 1.18), Math.min(1, coat[2] * 1.17), 1], dark = [coat[0] * .72, coat[1] * .72, coat[2] * .72, 1];
        // Rounded haunches, breast, separate elongated ears, muzzle, paws and cotton tail.
        S.drawBox(VP, p, [.52, .43, .70], coat, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(p, [0, .055, .27], ry), [.49, .44, .42], coat, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(p, [0, .08, -.36], ry), [.39, .39, .33], light, ry, fogColor, cam, -.1);
        const hd = S.rotatedOffset(p, [0, .28, -.48], ry);
        S.drawBox(VP, hd, [.42, .39, .42], coat, ry, fogColor, cam);
        for (const side of [-1, 1]) {
            const ear = S.rotatedOffset(hd, [side * .135, .35, .04], ry);
            S.drawBox(VP, ear, [.12, .54, .12], coat, ry, fogColor, cam, -side * .10, side * .16);
            S.drawBox(VP, S.rotatedOffset(ear, [0, .015, -.069], ry), [.065, .37, .018], [.68, .40, .43, 1], ry, fogColor, cam, -side * .10, side * .16);
            const eye = S.rotatedOffset(hd, [side * .19, .085, -.18], ry);
            S.drawBox(VP, eye, [.055, .066, .032], [.08, .065, .045, 1], ry, fogColor, cam);
            S.drawBox(VP, S.rotatedOffset(eye, [side * .012, .016, -.020], ry), [.017, .023, .013], [.92, .87, .77, 1], ry, fogColor, cam);
            S.drawBox(VP, S.rotatedOffset(p, [side * .21, -.20, -.31 + g * side * .07], ry), [.19, .15, .30], dark, ry, fogColor, cam);
            S.drawBox(VP, S.rotatedOffset(p, [side * .22, -.19, .29 - g * side * .07], ry), [.23, .19, .30], coat, ry, fogColor, cam);
            S.drawBox(VP, S.rotatedOffset(hd, [side * .09, -.09, -.23], ry), [.16, .14, .12], light, ry, fogColor, cam);
        }
        S.drawBox(VP, S.rotatedOffset(hd, [0, -.06, -.315], ry), [.075, .070, .045], [.65, .30, .30, 1], ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(p, [0, .09, .48], ry), [.21, .23, .19], [.91, .88, .78, 1], ry, fogColor, cam);
    }
    else if (e.type === 'chicken') {
        const body = [e.pos[0], e.pos[1] + .32 + Math.abs(g) * .03, e.pos[2]];
        S.drawBox(VP, body, [.45, .50, .40], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(body, [-.28, .02, .02], ry), [.18, .34, .31], [flash[0] * .92, flash[1] * .92, flash[2] * .90, 1], ry, fogColor, cam, 0, -.25 + g * .08);
        S.drawBox(VP, S.rotatedOffset(body, [.28, .02, .02], ry), [.18, .34, .31], [flash[0] * .92, flash[1] * .92, flash[2] * .90, 1], ry, fogColor, cam, 0, .25 - g * .08);
        const hd = S.rotatedOffset(e.pos, [0, .65, -.22], ry);
        S.drawBox(VP, hd, [.28, .28, .28], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(hd, [0, -.02, -.20], ry), [.10, .08, .20], [.73, .46, .18, 1], ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(hd, [0, .18, .02], ry), [.10, .14, .08], [.65, .10, .08, 1], ry, fogColor, cam);
        for (const side of [-1, 1])
            S.drawBox(VP, S.rotatedOffset(e.pos, [side * .12, .08, .03], ry), [.035, .22, .035], [.58, .40, .15, 1], ry, fogColor, cam, g * side * .08);
        const ep = S.rotatedOffset(hd, [0, .04, -.15], ry);
        for (const ex of [-.08, .08])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.025, .025, .018], [.03, .03, .025, 1], ry, fogColor, cam);
    }
    else if (e.type === 'wolf') {
        const hitMotion=(e.impactAnim||0)/.46,run = Math.sin(e.gait)+hitMotion*.32, run2 = Math.sin(e.gait + Math.PI)-hitMotion*.28, headRy = ry - (e.lookOffset || 0) * .72, body = [e.pos[0], e.pos[1] + .56 + breath, e.pos[2]], chest = S.rotatedOffset(e.pos, [0, .66, -.46], ry), neck = S.rotatedOffset(e.pos, [0, .76, -.70], ry), head = S.rotatedOffset(neck, [0, .07-hitMotion*.12, -.24-hitMotion*.19], headRy), muzzle = S.rotatedOffset(head, [0, -.11, -.31], headRy);
        S.drawBox(VP, body, [1.26, .64, .54], flash, ry, fogColor, cam);
        S.drawBox(VP, chest, [.72, .73, .58], [flash[0] * .94, flash[1] * .94, flash[2] * .94, 1], ry, fogColor, cam, .06);
        S.drawBox(VP, neck, [.53, .62, .48], flash, ry, fogColor, cam, -.18);
        S.drawBox(VP, head, [.57, .52, .52], flash, headRy, fogColor, cam);
        S.drawBox(VP, muzzle, [.34, .25, .47], [flash[0] * .72, flash[1] * .72, flash[2] * .70, 1], headRy, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(muzzle, [0, -.01, -.26], headRy), [.16, .12, .11], [.045, .04, .035, 1], headRy, fogColor, cam);
        for (const [ox, oz, phase] of [[-.38, -.34, run], [.38, -.34, run2], [-.38, .36, run2], [.38, .36, run]]) {
            const swing = phase * .18+((e.impactAnim||0)>0 && oz<0?Math.sin((.46-e.impactAnim)*21)*.19:0), upper = S.rotatedOffset(e.pos, [ox, .30, oz + swing * .24], ry), lower = S.rotatedOffset(e.pos, [ox, .095, oz + swing * .48], ry);
            S.drawBox(VP, upper, [.16, .48, .16], flash, ry, fogColor, cam, phase * .20);
            S.drawBox(VP, lower, [.135, .34, .135], [flash[0] * .90, flash[1] * .90, flash[2] * .88, 1], ry, fogColor, cam, -phase * .16);
        }
        for (const side of [-1, 1])
            S.drawBox(VP, S.rotatedOffset(head, [side * .20, .31, .02], headRy), [.14, .34, .115], flash, headRy, fogColor, cam, -.14, side * .20);
        const tailBase = S.rotatedOffset(e.pos, [0, .66, .62], ry), tailTip = S.rotatedOffset(e.pos, [0, .83, 1.02], ry);
        S.drawBox(VP, tailBase, [.18, .18, .58], flash, ry, fogColor, cam, -.46 + run * .08);
        S.drawBox(VP, tailTip, [.13, .13, .46], [flash[0] * .90, flash[1] * .90, flash[2] * .90, 1], ry, fogColor, cam, -.62 + run * .08);
        const ep = S.rotatedOffset(head, [0, .055, -.285], headRy);
        for (const ex of [-.135, .135])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], headRy), [.052, .045, .025], e.spotted ? [1, .10, .035, 1] : eyeColor, headRy, fogColor, cam);
    }
    else if (e.type === 'fox' || e.type === 'hyena') {
        const ws = e.type === 'fox' ? .72 : .92;
        S.drawBox(VP, [e.pos[0], e.pos[1] + .53 * ws + breath, e.pos[2]], [1.22 * ws, .68 * ws, .52 * ws], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .65 * ws, -.72 * ws], ry), [.60 * ws, .57 * ws, .54 * ws], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .54 * ws, -1.04 * ws], ry), [.38 * ws, .28 * ws, .48 * ws], [flash[0] * .82, flash[1] * .82, flash[2] * .82, 1], ry, fogColor, cam);
        for (const [ox, oz, phase] of [[-.38, -.34, g], [.38, -.34, g2], [-.38, .36, g2], [.38, .36, g]]) {
            const swing = phase * .12;
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox, .22 + Math.abs(phase) * .03, oz + swing], ry), [.17, .58, .17], flash, ry, fogColor, cam, phase * .09);
        }
        S.drawBox(VP, S.rotatedOffset(e.pos, [-.24, .91, -.73], ry), [.16, .34, .12], flash, ry, fogColor, cam, 0, -.28);
        S.drawBox(VP, S.rotatedOffset(e.pos, [.24, .91, -.73], ry), [.16, .34, .12], flash, ry, fogColor, cam, 0, .28);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .65, .78], ry), [.14, .14, .72], flash, ry, fogColor, cam, .34 + g * .12);
        const ep = S.rotatedOffset(e.pos, [0, .73, -1.02], ry);
        for (const ex of [-.13, .13])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.055, .055, .028], eyeColor, ry, fogColor, cam);
    }
    else if (e.type === 'boar') {
        S.drawBox(VP, [e.pos[0], e.pos[1] + .52 + breath, e.pos[2]], [1.48, .83, .78], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .55, -.91], ry), [.78, .70, .62], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .43, -1.27], ry), [.56, .34, .48], [flash[0] * .88, flash[1] * .8, flash[2] * .72, 1], ry, fogColor, cam);
        for (const [ox, oz, ph] of [[-.46, -.32, g], [.46, -.32, g2], [-.46, .35, g2], [.46, .35, g]])
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox, .18, oz + ph * .08], ry), [.20, .52, .20], flash, ry, fogColor, cam, ph * .07);
        S.drawBox(VP, S.rotatedOffset(e.pos, [-.38, .38, -1.48], ry), [.085, .08, .42], [.73, .68, .53, 1], ry, fogColor, cam, 0, -.12);
        S.drawBox(VP, S.rotatedOffset(e.pos, [.38, .38, -1.48], ry), [.085, .08, .42], [.73, .68, .53, 1], ry, fogColor, cam, 0, .12);
        const ep = S.rotatedOffset(e.pos, [0, .68, -1.18], ry);
        for (const ex of [-.17, .17])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.05, .05, .025], eyeColor, ry, fogColor, cam);
    }
    else if (e.type === 'bear') {
        S.drawBox(VP, [e.pos[0], e.pos[1] + .72 + breath, e.pos[2]], [1.55, 1.22, .96], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, 1.08, -.83], ry), [.88, .82, .76], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .91, -1.32], ry), [.60, .45, .55], [flash[0] * .8, flash[1] * .8, flash[2] * .78, 1], ry, fogColor, cam);
        for (const [ox, oz, ph] of [[-.54, -.3, g], [.54, -.3, g2], [-.54, .4, g2], [.54, .4, g]])
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox, .28, oz + ph * .08], ry), [.30, .72, .31], flash, ry, fogColor, cam, ph * .05);
        S.drawBox(VP, S.rotatedOffset(e.pos, [-.31, 1.49, -.78], ry), [.24, .25, .18], flash, ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [.31, 1.49, -.78], ry), [.24, .25, .18], flash, ry, fogColor, cam);
        const ep = S.rotatedOffset(e.pos, [0, 1.18, -1.19], ry);
        for (const ex of [-.19, .19])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.06, .06, .03], eyeColor, ry, fogColor, cam);
    }
    else if (e.type === 'crawler') {
        const body = [e.pos[0], e.pos[1] + .53 + Math.abs(g) * .06, e.pos[2]];
        S.drawBox(VP, body, [.72, .43, 1.08], flash, ry, fogColor, cam, .12 + g * .08);
        S.drawBox(VP, S.rotatedOffset(e.pos, [0, .61, -.73], ry), [.55, .42, .48], flash, ry, fogColor, cam, .28);
        for (const [ox, oz, ph, rz] of [[-.43, -.25, g, -.42], [.43, -.25, g2, .42], [-.45, .39, g2, -.48], [.45, .39, g, .48]]) {
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox, .27, oz + ph * .16], ry), [.15, .83, .14], flash, ry, fogColor, cam, ph * .32, rz);
            S.drawBox(VP, S.rotatedOffset(e.pos, [ox * 1.25, .08, oz + ph * .28], ry), [.13, .58, .13], flash, ry, fogColor, cam, -ph * .25, rz * .7);
        }
        const ep = S.rotatedOffset(e.pos, [0, .69, -1.02], ry);
        for (const ex of [-.13, .13])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.075, .055, .03], eyeColor, ry, fogColor, cam);
    }
    else if (e.type === 'watcher') {
        S.drawBox(VP, [e.pos[0], e.pos[1] + 1.48 + breath, e.pos[2]], [.43, 2.05, .34], flash, ry, fogColor, cam);
        S.drawBox(VP, [e.pos[0], e.pos[1] + 2.71 + breath, e.pos[2]], [.55, .68, .49], [flash[0] * .92, flash[1] * .94, flash[2] * .92, 1], ry, fogColor, cam);
        S.drawBox(VP, S.rotatedOffset(e.pos, [-.42, 1.42, .02], ry), [.14, 1.92, .14], flash, ry, fogColor, cam, g * .12, -.05);
        S.drawBox(VP, S.rotatedOffset(e.pos, [.42, 1.42, .02], ry), [.14, 1.92, .14], flash, ry, fogColor, cam, g2 * .12, .05);
        S.drawBox(VP, S.rotatedOffset(e.pos, [-.17, .52, .02], ry), [.16, 1.03, .16], flash, ry, fogColor, cam, g * .15);
        S.drawBox(VP, S.rotatedOffset(e.pos, [.17, .52, .02], ry), [.16, 1.03, .16], flash, ry, fogColor, cam, g2 * .15);
        const ep = S.rotatedOffset(e.pos, [0, 2.78, -.26], ry);
        for (const ex of [-.14, .14])
            S.drawBox(VP, S.rotatedOffset(ep, [ex, 0, 0], ry), [.072, .055, .025], eyeColor, ry, fogColor, cam);
    }
    else {
        const floatY = .25 + Math.sin(e.age * 3.2) * .18;
        S.drawBox(VP, [e.pos[0], e.pos[1] + 1.25 + floatY, e.pos[2]], [.46, 1.58, .34], flash, ry, fogColor, cam, Math.sin(e.age * 1.4) * .08);
        S.drawBox(VP, [e.pos[0], e.pos[1] + 2.18 + floatY, e.pos[2]], [.53, .62, .48], flash, ry, fogColor, cam);
        for (const side of [-1, 1])
            S.drawBox(VP, S.rotatedOffset(e.pos, [side * .43, 1.28 + floatY, 0], ry), [.12, 1.55, .12], flash, ry, fogColor, cam, side * .28 + Math.sin(e.age * 2) * .12, side * .15);
        const ep = S.rotatedOffset(e.pos, [0, 2.23 + floatY, -.25], ry);
        S.drawBox(VP, ep, [.19, .065, .025], eyeColor, ry, fogColor, cam);
    }
};

S.renderParticles = function renderParticles(VP) { if (!S.particles.length)
    return; const ps = [], cs = [], ss = []; for (const p of S.particles) {
    const alpha = S.clamp(p.life / p.maxLife, 0, 1);
    ps.push(...p.pos);
    cs.push(p.color[0], p.color[1], p.color[2], p.color[3] * Math.min(1, alpha * 2.2));
    ss.push(p.size);
} if (!ps.length)
    return; S.gl.useProgram(S.particleProgram); S.gl.uniformMatrix4fv(S.PL.vp, false, VP); S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.particlePosBuffer); S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(ps), S.gl.DYNAMIC_DRAW); S.gl.enableVertexAttribArray(S.PL.pos); S.gl.vertexAttribPointer(S.PL.pos, 3, S.gl.FLOAT, false, 0, 0); S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.particleColorBuffer); S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(cs), S.gl.DYNAMIC_DRAW); S.gl.enableVertexAttribArray(S.PL.color); S.gl.vertexAttribPointer(S.PL.color, 4, S.gl.FLOAT, false, 0, 0); S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.particleSizeBuffer); S.gl.bufferData(S.gl.ARRAY_BUFFER, new Float32Array(ss), S.gl.DYNAMIC_DRAW); S.gl.enableVertexAttribArray(S.PL.size); S.gl.vertexAttribPointer(S.PL.size, 1, S.gl.FLOAT, false, 0, 0); S.gl.drawArrays(S.gl.POINTS, 0, ps.length / 3); };

S.renderTargetOutline = function renderTargetOutline(VP, fogColor, cam) {
    if (!S.currentTarget || S.currentTarget.id === S.B.WATER || S.blockDefs[S.currentTarget.id]?.decor)
        return;
    const f = S.constructionStateAt(S.currentTarget.x, S.currentTarget.y, S.currentTarget.z), structuralDamage = f ? S.clamp(1 - f.hp / Math.max(1, f.maxHp), 0, 1) : 0, damage = Math.max(S.clamp(S.mineAmount, 0, 1), structuralDamage), model = S.M4.multiply(S.M4.translation(S.currentTarget.x - .003, S.currentTarget.y - .003, S.currentTarget.z - .003), S.M4.scale(1.006, 1.006, 1.006)), mvp = S.M4.multiply(VP, model);
    S.gl.useProgram(S.colorProgram);
    S.gl.uniformMatrix4fv(S.CL.mvp, false, mvp);
    S.gl.uniform1f(S.CL.fog, 0);
    S.gl.uniform3fv(S.CL.fogColor, fogColor);
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.outlineBuffer);
    S.gl.enableVertexAttribArray(S.CL.pos);
    S.gl.vertexAttribPointer(S.CL.pos, 3, S.gl.FLOAT, false, 0, 0);
    S.gl.uniform4fv(S.CL.color, new Float32Array([.65, .70, .66, .18 + .18 * damage]));
    S.gl.drawArrays(S.gl.LINES, 0, S.outlineVerts.length / 3);
    if ((S.input.mouseLeft || structuralDamage > .002) && damage > .001) {
        const visual = S.clamp(damage, 0, 1);
        S.gl.bindBuffer(S.gl.ARRAY_BUFFER, S.crackBuffer);
        S.gl.vertexAttribPointer(S.CL.pos, 3, S.gl.FLOAT, false, 0, 0);
        S.gl.uniform4fv(S.CL.color, new Float32Array([.052, .039, .030, .55 + .14 * visual]));
        const count = Math.ceil(visual * S.crackStages) * S.crackVertsPerStage;
        S.gl.drawArrays(S.gl.TRIANGLES, 0, count);
    }
};

// Persistent predator / fortification damage appears on visible block faces,
// not just when the crosshair is placed over the voxel.
S.renderBlockDamage=function renderBlockDamage(VP,fogColor,cam){
    let drawn=0;
    const visible=(key,id,ratio,hit)=>{
        if(ratio<=.012 || drawn>52)return;
        const [x,y,z]=key.split(',').map(Number);
        if(Math.hypot(x+.5-cam[0],y+.5-cam[1],z+.5-cam[2])>23 || S.getBlock(x,y,z)!==id)return;
        const visual=S.clamp(ratio,0,1),model=S.M4.multiply(S.M4.translation(x-.006,y-.006,z-.006),S.M4.scale(1.012,1.012,1.012));
        S.gl.useProgram(S.colorProgram);
        S.gl.uniformMatrix4fv(S.CL.mvp,false,S.M4.multiply(VP,model));
        S.gl.uniform1f(S.CL.fog,0);
        S.gl.uniform3fv(S.CL.fogColor,fogColor);
        S.gl.uniform4fv(S.CL.color,new Float32Array(hit?[.11,.062,.041,.73]:[.052,.039,.030,.57]));
        S.gl.bindBuffer(S.gl.ARRAY_BUFFER,S.crackBuffer);
        S.gl.enableVertexAttribArray(S.CL.pos);
        S.gl.vertexAttribPointer(S.CL.pos,3,S.gl.FLOAT,false,0,0);
        const count=Math.ceil(visual*S.crackStages)*S.crackVertsPerStage;
        S.gl.drawArrays(S.gl.TRIANGLES,0,count);drawn++;
    };
    for(const [key,f] of S.fortifications){
        if(f.hp>=f.maxHp || !f.maxHp)continue;
        const [x,y,z]=key.split(',').map(Number);
        visible(key,S.getBlock(x,y,z),1-f.hp/f.maxHp,(performance.now()-f.lastHit)<240);
        if(drawn>52)break;
    }
    for(const [key,d] of S.enemyBlockDamage){
        visible(key,d.id,1-d.hp/d.maxHp,S.worldSeconds-d.lastHit<.3);
        if(drawn>52)break;
    }
    for(const [key,ratio] of S.fallenLogDamage || []){
        const [x,y,z]=key.split(',').map(Number);
        visible(key,S.getBlock(x,y,z),ratio,false);
        if(drawn>52)break;
    }
};

S.renderHeldItem = function renderHeldItem(VP,fogColor,cam){
  const id=S.selectedItem(),def=S.itemDefs[id];
  if(!def||S.countItem(id)<=0)return;
  const look=S.lookDir(),right=[Math.cos(S.player.yaw),0,Math.sin(S.player.yaw)];
  const swing=Math.sin(S.clamp(S.player.toolSwing,0,1)*Math.PI),walk=Math.sin(S.player.movePhase)*.025;
  const sway=S.player.sway||0;
  const origin=[cam[0]+look[0]*.89+right[0]*(.36+sway*.11),cam[1]-.43+walk-swing*.12,cam[2]+look[2]*.89+right[2]*(.36+sway*.11)];
  const yaw=S.player.yaw-.17+swing*.21*S.player.toolSwingSide,pitch=-.23-S.player.pitch*.28+swing*.52,roll=-.19+swing*.18;
  const grip=[origin[0]-right[0]*.026,origin[1]-.22,origin[2]-right[2]*.026];
  S.drawBox(VP,grip,[.14,.30,.15],[.21,.15,.105,1],yaw,fogColor,cam,pitch,roll);
  S.drawBox(VP,[origin[0],origin[1]-.018,origin[2]],[.125,.126,.128],[.46,.31,.22,1],yaw,fogColor,cam,pitch,roll);
  if(S.drawEquipmentModel(VP,origin,yaw,pitch,roll,id,fogColor,cam,1))return;
  if(def.place){S.drawHeldTexturedBlock(VP,origin,[.29,.29,.29],def.place,yaw,pitch,roll);return;}
  if(id==='berries'){
    for(const [ox,oy]of [[-.07,.03],[.04,.07],[.085,-.03],[-.02,-.04]])
      S.drawBox(VP,S.rotatedOffset(origin,[ox,oy,0],yaw),[.057,.057,.06],[.27,.11,.25,1],yaw,fogColor,cam,pitch);
  } else if(id==='rawmeat'||id==='cookedmeat'){
    S.drawBox(VP,origin,[.19,.13,.23],id==='rawmeat'?[.46,.15,.16,1]:[.36,.24,.14,1],yaw,fogColor,cam,pitch);
  } else S.drawBox(VP,origin,[.14,.15,.13],[.33,.33,.31,1],yaw,fogColor,cam,pitch);
};

S.renderOffhandItem = function renderOffhandItem(VP,fogColor,cam){
 const id=S.offhandItem();if(!id)return;
 const def=S.itemDefs[id];if(!def)return;
 const look=S.lookDir(),right=[Math.cos(S.player.yaw),0,Math.sin(S.player.yaw)];
 const bob=Math.sin(S.player.movePhase)*.019;
 const origin=[cam[0]+look[0]*.70-right[0]*.40,cam[1]-.45+bob,cam[2]+look[2]*.70-right[2]*.40];
 const yaw=S.player.yaw+.19,pitch=-.18-S.player.pitch*.24;
 S.drawBox(VP,[origin[0]+right[0]*.04,origin[1]-.23,origin[2]+right[2]*.04],[.14,.31,.15],[.23,.16,.115,1],yaw,fogColor,cam,pitch,-.15);
 if(S.drawEquipmentModel(VP,origin,yaw,pitch,-.1,id,fogColor,cam,.87))return;
 if(def.place){S.drawHeldTexturedBlock(VP,origin,[.265,.265,.265],def.place,yaw,pitch,-.1);return;}
 S.drawBox(VP,origin,[.14,.12,.15],[.34,.31,.27,1],yaw,fogColor,cam,pitch,-.10);
};

// Campfires are bespoke low-poly assemblies; no full voxel cube. Ember
// flicker and smoke are rendered as inexpensive colored boxes/particles.
S.renderCampfires = function renderCampfires(VP,fogColor,cam){
    let shown=0;
    const t=performance.now()*.001;
    for(const [key,id] of S.edits){
        if(id!==S.B.CAMPFIRE)continue;
        const [x,y,z]=key.split(',').map(Number);
        if(Math.hypot(x+.5-cam[0],z+.5-cam[2])>42)continue;
        const pos=[x+.5,y+.06,z+.5],f=.85+.15*Math.sin(t*9+x*3+z);
        for(const a of [0,Math.PI/3,2*Math.PI/3]){
            const angle=a+Math.PI/4;
            S.drawBox(VP,[pos[0],pos[1]+.14,pos[2]],[.95,.17,.16],[.25,.13,.075,1],angle,fogColor,cam);
            S.drawBox(VP,[pos[0],pos[1]+.16,pos[2]],[.85,.08,.075],[.48,.28,.13,1],angle,fogColor,cam);
        }
        for(let k=0;k<9;k++){
            const a=k*Math.PI*2/9;
            S.drawBox(VP,[pos[0]+Math.cos(a)*.51,pos[1]+.04,pos[2]+Math.sin(a)*.51],[.22,.17,.23],k%2?[.37,.35,.30,1]:[.22,.23,.22,1],a,fogColor,cam);
        }
        const flameY=pos[1]+.35+.07*Math.sin(t*11+x+z);
        S.drawBox(VP,[pos[0],flameY,pos[2]],[.27,.60*f,.22],[.95,.37,.08,.92],t*.15,fogColor,cam);
        S.drawBox(VP,[pos[0],flameY+.10,pos[2]],[.15,.40*f,.15],[1,.73,.24,.89],-t*.21,fogColor,cam);
        S.drawBox(VP,[pos[0],flameY+.20,pos[2]],[.065,.20*f,.065],[1,.92,.57,.83],0,fogColor,cam);
        if(++shown>=36)break;
    }
};
S.updateCampfires=function updateCampfires(dt){
    S.campfireEffectBudget=(S.campfireEffectBudget||0)+dt;
    if(S.campfireEffectBudget<.13)return;
    S.campfireEffectBudget=0;
    let n=0;
    for(const [key,id] of S.edits){
        if(id!==S.B.CAMPFIRE)continue;
        const [x,y,z]=key.split(',').map(Number);
        if(Math.hypot(x-S.player.pos[0],z-S.player.pos[2])>27)continue;
        const fire=Math.random()>.45;
        S.spawnParticle([x+.5+(Math.random()-.5)*.25,y+.48,z+.5+(Math.random()-.5)*.25],[(Math.random()-.5)*.33,fire?1.35:.65,(Math.random()-.5)*.33],fire?.45:1.6,fire?[1,.47,.10,.84]:[.21,.23,.22,.32],fire?3.5:6.8,fire?1.3:.05,.40);
        if(++n>=12)break;
    }
    // Quiet local crackle: event frequency is independent from particle count,
    // faded with distance and never loops on every rendered frame.
    S.campfireSoundDelay=(S.campfireSoundDelay||0)-dt;
    if(n>0 && S.campfireSoundDelay<=0){
        S.campfireSoundDelay=2.4+Math.random()*2.0;
        S.sfx('fire',.20);
    }
};
S.renderPlacedTorches = function renderPlacedTorches(VP,fogColor,cam) {
    let n=0;
    for(const [key,id] of S.edits){
        if(id!==S.B.TORCH)continue;
        const [x,y,z]=key.split(',').map(Number);
        if(Math.hypot(x+.5-S.player.pos[0],z+.5-S.player.pos[2])>Math.min(55,S.renderDistance*S.CHUNK))continue;
        const normal=S.torchMounts?.get(key)||[0,1,0];
        const side=normal[1]===0;
        const nx=normal[0]||0,nz=normal[2]||0;
        const foot=[x+.5-nx*.36,y+(side?.29:.18),z+.5-nz*.36];
        const head=[foot[0]+nx*(side?.25:0),foot[1]+(side?.45:.54),foot[2]+nz*(side?.25:0)];
        const mid=foot.map((v,i)=>(v+head[i])*.5);
        // Align the real shaft rotation with the wall normal: the stick must
        // lean AWAY from the supporting wall, toward its own flame/head.
        const angle=.40,rx=nz*angle,rz=-nx*angle;
        const flick=.85+.15*Math.sin(performance.now()*.017+x*2.1+z);
        // Lower base physically contacts the supporting face; shaft follows a lean.
        S.drawBox(VP,mid,[.067,side?.59:.55,.067],[.30,.20,.11,1],0,fogColor,cam,rx,rz);
        S.drawBox(VP,head,[.088,.12,.088],[.74*flick,.30,.075,1],0,fogColor,cam);
        S.drawBox(VP,[head[0],head[1]+.09,head[2]],[.055,.13,.055],[1,.69*flick,.19,.92],0,fogColor,cam);
        if(++n>110)break;
    }
};

S.droppedItemColor = function droppedItemColor(id) { if (id === 'coal')
    return [.08, .085, .08, 1]; if (id === 'iron' || id === 'iron_ingot')
    return [.53, .47, .42, 1]; if (id === 'gold_ore' || id === 'gold_ingot')
    return [.72, .55, .16, 1]; if (id === 'berries')
    return [.23, .08, .28, 1]; if (id === 'rawmeat')
    return [.44, .13, .13, 1]; if (id === 'cookedmeat')
    return [.38, .23, .12, 1]; if (id === 'bandage')
    return [.74, .73, .66, 1]; return [.34, .31, .27, 1]; };

S.renderDroppedItems = function renderDroppedItems(VP, fogColor, cam) {
    let shown = 0;
    for (const d of S.droppedItems) {
        if (S.dist3(d.pos, S.player.pos) > Math.min(42, S.renderDistance * S.CHUNK))
            continue;
        const bob = Math.sin(d.age * 3.6 + d.bob) * .055, pos = [d.pos[0], d.pos[1] + bob, d.pos[2]], def = S.itemDefs[d.id] || {}, ry = d.spin;
        if (def.place === S.B.CAMPFIRE)
            S.drawEquipmentModel(VP,pos,ry,.16,.10,'campfire',fogColor,cam,.56);
        else if (def.place && def.place !== S.B.TORCH)
            S.drawHeldTexturedBlock(VP, pos, [.23, .23, .23], def.place, ry, .10, 0);
        else if (def.place === S.B.TORCH) {
            S.drawBox(VP, pos, [.032, .22, .032], [.29, .18, .09, 1], ry, fogColor, cam, .12, .06);
            S.drawBox(VP, [pos[0], pos[1] + .15, pos[2]], [.075, .075, .075], [.94, .48, .12, 1], ry, fogColor, cam);
        }
        else if (def.tool) {
            const wood = def.tier === 'wood', gold = def.tier === 'gold', head = wood ? [.47, .31, .18, 1] : gold ? [.78, .58, .15, 1] : [.42, .45, .44, 1], handle = [.31, .21, .13, 1];
            S.drawBox(VP, pos, [.025, .27, .025], handle, ry, fogColor, cam, .35, .15);
            const h = S.rotatedOffset(pos, [0, .18, 0], ry);
            if (def.tool === 'pickaxe')
                S.drawBox(VP, h, [.24, .055, .055], head, ry, fogColor, cam, .35, .15);
            else if (def.tool === 'axe')
                S.drawBox(VP, h, [.17, .17, .055], head, ry, fogColor, cam, .35, .15);
            else if (def.tool === 'shovel')
                S.drawBox(VP, h, [.13, .17, .05], head, ry, fogColor, cam, .35, .15);
            else
                S.drawBox(VP, h, [.045, .35, .04], head, ry, fogColor, cam, .35, .15);
        }
        else
            S.drawBox(VP, pos, [.10, .10, .10], S.droppedItemColor(d.id), ry, fogColor, cam, .12, .08);
        if (++shown > 110)
            break;
    }
};

S.torchCacheTimer = 0;
S.cachedTorch = null;

S.nearestPlacedTorch = function nearestPlacedTorch() { let best = null, bd = 999; for (const [k, v] of S.edits) {
    if (v !== S.B.TORCH && v !== S.B.CAMPFIRE)
        continue;
    const [x, y, z] = k.split(',').map(Number), d = Math.hypot(x + .5 - S.player.pos[0], y + .5 - (S.player.pos[1] + 1), z + .5 - S.player.pos[2]);
    if (d < bd && d < Math.min(14, S.renderDistance * S.CHUNK)) {
        bd = d;
        best = [x + .5, y + .6, z + .5];
    }
} return best; };

S.renderCloudLayer = function renderCloudLayer(VP, fogColor, cam, day) {
    const drift = S.worldSeconds * .34, cell = 28, baseX = Math.floor((S.player.pos[0] + drift) / cell), baseZ = Math.floor(S.player.pos[2] / cell), night = 1 - day;
    for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) {
            const gx = baseX + dx, gz = baseZ + dz, r = S.hash2i(gx, gz, S.worldSeed ^ 0xc10d);
            if (r < .61)
                continue;
            const cx = gx * cell - drift + (S.hash2i(gx, gz, 0x811) - .5) * 12, cz = gz * cell + (S.hash2i(gx, gz, 0x912) - .5) * 12, cy = 76 + S.hash2i(gx, gz, 0xa13) * 8;
            const shade = .72 - day * .05 - night * .36, alpha = .84;
            const col = [shade * .92, shade * .98, shade, alpha], w = 6 + S.hash2i(gx, gz, 0x414) * 7, d = 3.2 + S.hash2i(gx, gz, 0x515) * 5;
            S.drawBox(VP, [cx, cy, cz], [w, .65, d], col, 0, fogColor, cam);
            if (r > .81)
                S.drawBox(VP, [cx + w * .42, cy + .38, cz - d * .08], [w * .58, .82, d * .72], [col[0] * .96, col[1] * .98, col[2], alpha], 0, fogColor, cam);
            if (r > .91)
                S.drawBox(VP, [cx - w * .38, cy + .24, cz + d * .18], [w * .44, .58, d * .55], [col[0] * .93, col[1] * .96, col[2] * .98, alpha], 0, fogColor, cam);
        }
};

S.renderConstructions = function renderConstructions(VP, fogColor, cam) {
    let n = 0;
    for (const [k, id] of S.edits) {
        if (id !== S.B.WOOD_DOOR && id !== S.B.WOOD_STAIRS && id !== S.B.WOOD_FENCE)
            continue;
        const [x, y, z] = k.split(',').map(Number);
        if (Math.hypot(x + .5 - S.player.pos[0], z + .5 - S.player.pos[2]) > S.renderDistance * S.CHUNK + 6)
            continue;
        const f = S.ensureFortification(x, y, z, id, true), col = S.constructionColor(f), ry = (f.orientation || 0) + (id === S.B.WOOD_DOOR && f.open ? Math.PI / 2 : 0);
        if (id === S.B.WOOD_DOOR) {
            S.drawBox(VP, [x + .5, y + .93, z + .5], [.82, 1.86, .11], col, ry, fogColor, cam);
            S.drawBox(VP, S.rotatedOffset([x + .5, y + .93, z + .5], [.31, .03, -.075], ry), [.08, .08, .07], [.66, .52, .24, 1], ry, fogColor, cam);
            if (f.tier >= 1) {
                const band = f.tier === 5 ? [.58, .61, .59, 1] : f.tier >= 4 ? [.46, .47, .44, 1] : f.tier >= 2 ? [.34, .35, .33, 1] : [.49, .33, .18, 1];
                for (const oy of [-.48, .16, .53])
                    S.drawBox(VP, S.rotatedOffset([x + .5, y + .93, z + .5], [0, oy, -.071], ry), [.72, .065, .035], band, ry, fogColor, cam);
            }
        }
        else if (id === S.B.WOOD_STAIRS) {
            S.drawBox(VP, S.rotatedOffset([x + .5, y + .25, z + .5], [0, 0, .20], ry), [.96, .50, .56], col, ry, fogColor, cam);
            S.drawBox(VP, S.rotatedOffset([x + .5, y + .65, z + .5], [0, 0, -.22], ry), [.96, .30, .48], col, ry, fogColor, cam);
            if (f.tier >= 1) {
                const band = f.tier === 5 ? [.58, .61, .59, 1] : f.tier >= 2 ? [.37, .38, .36, 1] : [.50, .34, .18, 1];
                S.drawBox(VP, S.rotatedOffset([x + .5, y + .51, z + .5], [0, 0, .18], ry), [.90, .055, .54], band, ry, fogColor, cam);
            }
        }
        else {
            S.drawBox(VP, [x + .5, y + .5, z + .5], [.16, 1.05, .16], col, ry, fogColor, cam);
            S.drawBox(VP, [x + .5, y + .68, z + .5], [1.02, .13, .14], col, ry, fogColor, cam);
            S.drawBox(VP, [x + .5, y + .34, z + .5], [1.02, .11, .12], col, ry, fogColor, cam);
            if (f.tier >= 1) {
                const band = f.tier === 5 ? [.58, .61, .59, 1] : f.tier >= 2 ? [.37, .38, .36, 1] : [.50, .34, .18, 1];
                S.drawBox(VP, [x + .5, y + .51, z + .5], [1.04, .055, .17], band, ry, fogColor, cam);
            }
        }
        if (++n > 180)
            break;
    }
    // Regular wooden walls/logs stay in the chunk mesh, but upgraded pieces get
    // visible reinforcement bands/corner plates so every tier is readable.
    let overlays = 0;
    for (const [k, f] of S.fortifications) {
        if (!f.family && f.tier < 1)
            continue;
        const [x, y, z] = k.split(',').map(Number), id = S.getBlock(x, y, z);
        if (id === S.B.WOOD_DOOR || id === S.B.WOOD_STAIRS || id === S.B.WOOD_FENCE || !S.isUpgradeableBlockId(id))
            continue;
        if (Math.hypot(x + .5 - S.player.pos[0], z + .5 - S.player.pos[2]) > Math.min(48, S.renderDistance * S.CHUNK + 4))
            continue;
        // Four families of reinforced walls, each with a readable visual progression.
        // The actual solid block belongs to the chunk mesh; details are overlaid,
        // avoiding remeshing when upgrading an individual voxel.
        if (f.family) {
            const family=S.WALL_FAMILIES.get(f.family), tier=S.clamp(f.level||0,0,3);
            const metal=family.tint==='iron', wood=family.tint==='wood';
            const base=metal?[.45,.52,.54,1]:wood?[.40,.25,.13,1]:family.tint==='cobble'?[.40,.40,.38,1]:[.45,.47,.44,1];
            const band=metal?[.68,.75,.77,1]:wood?[.54,.37,.19,1]:[.56,.59,.56,1];
            const edge=metal?[.12,.17,.19,1]:wood?[.15,.09,.052,1]:[.20,.22,.21,1];
            const pz=z+.009, nz=z+.991;
            // Even freshly crafted L0 walls have bolted corners and face grooves.
            for(const face of [pz,nz]) {
                for(const xx of [.13,.87]) {
                    S.drawBox(VP,[x+xx,y+.5,face],[.074,.93,.046],edge,0,fogColor,cam);
                    for(const yy of [.16,.84])
                        S.drawBox(VP,[x+xx,y+yy,face+(face===pz?-.023:.023)],[.082,.078,.044],band,0,fogColor,cam);
                }
                if(tier>=1){
                    for(const yy of [.20,.79])
                        S.drawBox(VP,[x+.5,y+yy,face],[.92,.092,.059],band,0,fogColor,cam);
                }
                if(tier>=2){
                    // Structural X-bracing; the sides are placed slightly beyond
                    // the block faces so they cannot z-fight with voxel textures.
                    S.drawBox(VP,[x+.5,y+.49,face],[.078,1.15,.071],edge,0,fogColor,cam,0,.70);
                    S.drawBox(VP,[x+.5,y+.49,face],[.078,1.15,.071],edge,0,fogColor,cam,0,-.70);
                }
                if(tier>=3){
                    S.drawBox(VP,[x+.5,y+.5,face],[.23,.23,.082],base,0,fogColor,cam);
                    S.drawBox(VP,[x+.5,y+.5,face+(face===pz?-.049:.049)],[.11,.11,.035],band,0,fogColor,cam);
                    for(const xx of [.30,.70])for(const yy of [.33,.67])
                        S.drawBox(VP,[x+xx,y+yy,face+(face===pz?-.035:.035)],[.08,.08,.05],band,0,fogColor,cam);
                }
            }
            if(++overlays>100)break;
            continue;
        }
        const band = f.tier === 5 ? [.58, .61, .59, 1] : f.tier === 4 ? [.43, .44, .41, 1] : f.tier >= 2 ? [.34, .35, .33, 1] : [.49, .33, .18, 1], c = .048;
        S.drawBox(VP, [x + .5, y + .12, z + .018], [.92, .07, c], band, 0, fogColor, cam);
        S.drawBox(VP, [x + .5, y + .88, z + .018], [.92, .07, c], band, 0, fogColor, cam);
        S.drawBox(VP, [x + .018, y + .5, z + .5], [c, .78, .92], band, 0, fogColor, cam);
        S.drawBox(VP, [x + .982, y + .5, z + .5], [c, .78, .92], band, 0, fogColor, cam);
        if (f.tier >= 3) {
            S.drawBox(VP, [x + .5, y + .50, z + .982], [.90, .055, c], band, 0, fogColor, cam);
            S.drawBox(VP, [x + .5, y + .982, z + .5], [.90, c, .90], band, 0, fogColor, cam);
        }
        if (++overlays > 120)
            break;
    }
    // A burning furnace gets a small emissive-looking mouth, while smoke is
    // emitted by updateFurnaces().
    let lit = 0;
    for (const [k, f] of S.furnaces) {
        if (f.burn <= 0)
            continue;
        const [x, y, z] = k.split(',').map(Number);
        if (Math.hypot(x + .5 - S.player.pos[0], z + .5 - S.player.pos[2]) > 40)
            continue;
        const flick = .80 + .20 * Math.sin(performance.now() * .02 + x * 3 + z);
        S.drawBox(VP, [x + .5, y + .43, z + .992], [.38, .24, .026], [.78 * flick, .27, .045, 1], 0, fogColor, cam);
        S.drawBox(VP, [x + .5, y + .43, z + 1.008], [.20, .11, .018], [1, .58 * flick, .10, .92], 0, fogColor, cam);
        if (++lit > 24)
            break;
    }
};


S.renderFallingTrees = function renderFallingTrees(VP,fogColor,cam){
  // The entire captured natural tree rotates as a rigid body around its root.
  // Neither terrain nor neighbouring trees participate in the fall collision.
  for(const tree of S.fallingTrees||[]){
    const [bx,by,bz]=tree.root,ca=Math.cos(tree.angle),sa=Math.sin(tree.angle),dx=tree.dx,dz=tree.dz;
    const ry=Math.atan2(dx,dz);
    const point=(x,y,z)=>{
      const vx=x-bx,vy=y-by,vz=z-bz;
      const ax=dz,az=-dx,dot=ax*vx+az*vz;
      const crossx=-az*vy,crossy=az*vx-ax*vz,crossz=ax*vy;
      const f=1-ca;
      return [bx+.5+vx*ca+crossx*sa+ax*dot*f,by+.5+vy*ca+crossy*sa,bz+.5+vz*ca+crossz*sa+az*dot*f];
    };
    for(const [x,y,z,id]of tree.logs){
      S.drawHeldTexturedBlock(VP,point(x,y,z),[.99,.99,.99],id,ry,tree.angle);
    }
    for(let i=0;i<tree.leaves.length;i+=Math.max(1,Math.floor(tree.leaves.length/100))){
      const [x,y,z,id]=tree.leaves[i];
      S.drawHeldTexturedBlock(VP,point(x,y,z),[.97,.97,.97],id,ry,tree.angle);
    }
  }
};

S.render = function render() {
    S.resize();
    S.gl.enable(S.gl.DEPTH_TEST);
    S.gl.enable(S.gl.CULL_FACE);
    S.gl.cullFace(S.gl.BACK);
    S.gl.depthFunc(S.gl.LEQUAL);
    // The main menu is an independent, non-persistent voxel scene. Never
    // interrogate the active world before a player has loaded a save.
    if (!S.running) {
        S.renderMainMenuBackdrop?.();
        return;
    }
    S.updateSunShadows?.(1 / 60);
    const day = S.sunLevel(), night = 1 - day, lf = S.lightning * .62, biome = S.biomeAt(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2]));
    let sky = [S.lerp(.005, .22, day) + lf, S.lerp(.008, .29, day) + lf, S.lerp(.010, .33, day) + lf];
    if (biome === 'swamp') {
        sky[0] *= .78;
        sky[1] *= .9;
    }
    if (S.weatherMode === 'rain' || S.weatherMode === 'mist')
        sky = sky.map(v => v * .78);
    // Water color is a CAMERA effect, not a swimming/movement effect.
    // Near the waterline the view returns to normal as soon as eyes emerge.
    const cam = S.cameraEyePos();
    const cameraUnderwater = S.getBlock(Math.floor(cam[0]),Math.floor(cam[1]+.075),Math.floor(cam[2]))===S.B.WATER;
    if (cameraUnderwater)
        sky = [.018, .092, .105];
    let fogColor = cameraUnderwater ? [.018, .102, .112] : [sky[0] * .67, sky[1] * .71, sky[2] * .69];
    S.gl.clearColor(sky[0], sky[1], sky[2], 1);
    S.gl.clear(S.gl.COLOR_BUFFER_BIT | S.gl.DEPTH_BUFFER_BIT);
    const dir = S.lookDir(), target = S.cameraMode === 2 ? [S.player.pos[0], S.player.pos[1]+1.15, S.player.pos[2]] : [cam[0] + dir[0], cam[1] + dir[1], cam[2] + dir[2]], speed = Math.hypot(S.player.vel[0], S.player.vel[2]), fov = Math.PI / 3 + S.clamp((speed - 5) * .014, 0, .07), proj = S.M4.perspective(fov, S.canvas.width / S.canvas.height, .055, S.renderDistance * S.CHUNK + 35), view = S.M4.lookAt(cam, target), VP = S.M4.multiply(proj, view);
    S.lastVP = VP;
    let fogNear = Math.max(7, S.renderDistance * S.CHUNK * (S.weatherMode === 'mist' ? .21 : .34)), fogFar = S.renderDistance * S.CHUNK * (S.weatherMode === 'mist' ? .72 : .95);
    if (cameraUnderwater) {
        fogNear = 1.5;
        fogFar = 20;
    }
    S.torchCacheTimer -= 1 / 60;
    if (S.torchCacheTimer <= 0) {
        S.cachedTorch = S.nearestPlacedTorch();
        S.torchCacheTimer = .2;
    }
    const heldTorch = S.hasHeldTorch();
    let torchPos = S.cachedTorch || cam, torchPower = S.cachedTorch ? 1.08 : 0;
    if (heldTorch) {
        torchPos = [cam[0] + dir[0] * .35, cam[1] - .18, cam[2] + dir[2] * .35];
        torchPower = 1.45;
    }
    S.gl.disable(S.gl.BLEND);
    S.renderCloudLayer(VP, fogColor, cam, day);
    const visibleChunk = c => {
        const dx=(c.cx+.5)*S.CHUNK-cam[0],dz=(c.cz+.5)*S.CHUNK-cam[2];
        const d=Math.hypot(dx,dz);
        if(d<31)return true;
        return (dx*dir[0]+dz*dir[2])/Math.max(.01,d)>-.30;
    };
    for (const c of S.chunks.values())if(visibleChunk(c))
        S.drawVoxelMesh(c.opaque, 1, VP, cam, fogColor, fogNear, fogFar, S.clamp(day + S.lightning, 0, 1), torchPos, torchPower, 0);
    S.renderFallingTrees(VP,fogColor,cam);
    S.renderPlacedTorches(VP, fogColor, cam);
    S.renderCampfires(VP,fogColor,cam);
    S.renderConstructions(VP, fogColor, cam);
    S.renderBedrolls(VP, fogColor, cam);
    if (S.cameraMode) S.renderPlayerAvatar(VP, fogColor, cam);
    S.renderRemotePlayers?.(VP,fogColor,cam);
    S.gl.enable(S.gl.BLEND);
    S.gl.blendFunc(S.gl.SRC_ALPHA, S.gl.ONE_MINUS_SRC_ALPHA);
    S.gl.depthMask(false);
    S.renderContactShadows(VP, fogColor, cam, day);
    S.gl.depthMask(true);
    S.gl.disable(S.gl.BLEND);
    S.renderDroppedItems(VP, fogColor, cam);
    for (const e of S.enemies)
        S.renderEnemy(e, VP, fogColor, cam);
    S.renderApparitions(VP, fogColor, cam);
    for (const b of S.birds)
        S.renderBird(b, VP, fogColor, cam);
    S.renderFallingLeaves(VP, fogColor, cam);
    S.gl.enable(S.gl.BLEND);
    S.gl.blendFunc(S.gl.SRC_ALPHA, S.gl.ONE_MINUS_SRC_ALPHA);
    S.gl.depthMask(false);
    for (const c of S.chunks.values())if(visibleChunk(c))
        S.drawVoxelMesh(c.water, .68, VP, cam, fogColor, fogNear, fogFar, S.clamp(day + S.lightning, 0, 1), torchPos, torchPower, 1);
    S.renderParticles(VP);
    S.renderRain(VP);
    S.renderScanHighlights(VP, fogColor, cam);
    S.renderTargetOutline(VP, fogColor, cam);
    S.renderBlockDamage(VP, fogColor, cam);
    S.gl.depthMask(true);
    S.gl.disable(S.gl.BLEND);
    S.gl.clear(S.gl.DEPTH_BUFFER_BIT);
    S.renderHeldItem(VP, fogColor, cam);
    S.renderOffhandItem(VP, fogColor, cam);
};
}
