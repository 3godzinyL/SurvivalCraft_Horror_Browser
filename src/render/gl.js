// NightCraft V15 · native ES module (render/gl.js); installs into the explicit shared state.
export function install(S) {
S.compileShader = function compileShader(type, src) { const s = S.gl.createShader(type); S.gl.shaderSource(s, src); S.gl.compileShader(s); if (!S.gl.getShaderParameter(s, S.gl.COMPILE_STATUS))
    throw new Error(S.gl.getShaderInfoLog(s)); return s; };

S.makeProgram = function makeProgram(vs, fs) { const p = S.gl.createProgram(); S.gl.attachShader(p, S.compileShader(S.gl.VERTEX_SHADER, vs)); S.gl.attachShader(p, S.compileShader(S.gl.FRAGMENT_SHADER, fs)); S.gl.linkProgram(p); if (!S.gl.getProgramParameter(p, S.gl.LINK_STATUS))
    throw new Error(S.gl.getProgramInfoLog(p)); return p; };

S.voxelProgram = S.makeProgram(S.GAME_SHADERS.voxelVertex, S.GAME_SHADERS.voxelFragment);

S.colorProgram = S.makeProgram(S.GAME_SHADERS.colorVertex, S.GAME_SHADERS.colorFragment);

S.VL = {
    pos: S.gl.getAttribLocation(S.voxelProgram, 'aPos'), normal: S.gl.getAttribLocation(S.voxelProgram, 'aNormal'), uv: S.gl.getAttribLocation(S.voxelProgram, 'aUV'),
    vp: S.gl.getUniformLocation(S.voxelProgram, 'uVP'), tex: S.gl.getUniformLocation(S.voxelProgram, 'uTex'), cam: S.gl.getUniformLocation(S.voxelProgram, 'uCam'), fogColor: S.gl.getUniformLocation(S.voxelProgram, 'uFogColor'), fogNear: S.gl.getUniformLocation(S.voxelProgram, 'uFogNear'), fogFar: S.gl.getUniformLocation(S.voxelProgram, 'uFogFar'), day: S.gl.getUniformLocation(S.voxelProgram, 'uDay'), torch: S.gl.getUniformLocation(S.voxelProgram, 'uTorch'), torchPower: S.gl.getUniformLocation(S.voxelProgram, 'uTorchPower'), alpha: S.gl.getUniformLocation(S.voxelProgram, 'uAlpha'), time: S.gl.getUniformLocation(S.voxelProgram, 'uTime'), water: S.gl.getUniformLocation(S.voxelProgram, 'uWater')
};

S.CL = { pos: S.gl.getAttribLocation(S.colorProgram, 'aPos'), mvp: S.gl.getUniformLocation(S.colorProgram, 'uMVP'), color: S.gl.getUniformLocation(S.colorProgram, 'uColor'), fog: S.gl.getUniformLocation(S.colorProgram, 'uFog'), fogColor: S.gl.getUniformLocation(S.colorProgram, 'uFogColor') };

S.makeAtlas = function makeAtlas() {
    const tile = 24, cols = 8, rows = 14, c = document.createElement('canvas');
    c.width = tile * cols;
    c.height = tile * rows;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const rnd = (x, y, k) => S.hash3i(x, y, k, 7919), rgb = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    const px = (idx, x, y, col) => { ctx.fillStyle = `rgb(${S.clamp(col[0], 0, 255) | 0},${S.clamp(col[1], 0, 255) | 0},${S.clamp(col[2], 0, 255) | 0})`; ctx.fillRect((idx % cols) * tile + x, Math.floor(idx / cols) * tile + y, 1, 1); };
    const paint = (idx, base, variance = 20, fn = null) => { const b = rgb(base); for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
            let n = (rnd(x, y, idx) - .5) * variance, col = [b[0] + n, b[1] + n, b[2] + n];
            if (fn)
                col = fn(x, y, col, rnd(x + 37, y - 11, idx), rnd(x - 19, y + 23, idx));
            px(idx, x, y, col);
        } };
    const cracks = (x, y, col, n) => { if ((x * 7 + y * 11) % 37 === 0 || ((x + y) % 19 === 0 && n > .74))
        return [col[0] * .5, col[1] * .5, col[2] * .5]; return col; };
    paint(0, '#26371e', 48, (x, y, c, n, m) => { if (n > .78)
        c = [c[0] + 18 + 18 * m, c[1] + 27 + 20 * m, c[2] + 7]; if (n < .17)
        c = [c[0] * .54, c[1] * .62, c[2] * .48]; if ((x * 11 + y * 7) % 41 === 0)
        c = [83, 73, 42]; return c; });
    paint(1, '#4a3422', 40, (x, y, c, n, m) => { if (y < 6) {
        const moss = .74 + .26 * m;
        c = [35 + 16 * m, 67 + 24 * m, 30 + 13 * m];
        if (y === 5)
            c = [c[0] * .82, c[1] * .76, c[2] * .70];
    }
    else {
        if (n > .86)
            c = [c[0] + 18, c[1] + 10, c[2] + 4];
        if ((x * 5 + y * 7) % 29 === 0)
            c = [c[0] * .62, c[1] * .58, c[2] * .52];
    } return c; });
    paint(2, '#493726', 40, (x, y, c, n) => n > .9 ? [c[0] + 22, c[1] + 15, c[2] + 7] : c);
    paint(3, '#4b504e', 46, (x, y, c, n) => cracks(x, y, n > .9 ? [c[0] + 34, c[1] + 32, c[2] + 28] : c, n));
    paint(4, '#80755b', 36, (x, y, c, n, m) => { const grain = Math.sin(x * .82 + y * .17) * 5; return n > .87 ? [c[0] + 26, c[1] + 23, c[2] + 13] : [c[0] + grain, c[1] + grain * .8, c[2] + grain * .45]; });
    paint(5, '#3a2718', 40, (x, y, c, n, m) => { const ring = Math.sin((x * .55) + Math.sin(y * .22) * 1.3); if (Math.abs(ring) > .82)
        c = [c[0] * .57, c[1] * .55, c[2] * .50]; if (n > .90)
        c = [c[0] + 24, c[1] + 14, c[2] + 6]; return c; });
    paint(6, '#1f3420', 50, (x, y, c, n) => { if (n > .79)
        c = [c[0] * .85, c[1] * 1.35, c[2] * .8]; if ((x * 3 + y * 5) % 17 === 0)
        c = [c[0] * .48, c[1] * .6, c[2] * .45]; return c; });
    paint(7, '#343735', 38, (x, y, c, n) => n > .72 ? [14, 16, 15] : cracks(x, y, c, n));
    paint(8, '#55514c', 34, (x, y, c, n, m) => n > .84 ? [116 + 20 * m, 72 + 10 * m, 50 + 6 * m] : cracks(x, y, c, n));
    paint(9, '#163239', 24, (x, y, c, n) => { const w = Math.sin(x * .95 + y * .33) * 7 + (n - .5) * 8; return [c[0] + w * .2, c[1] + w * .7, c[2] + w]; });
    paint(10, '#59402b', 26, (x, y, c, n) => { if (y % 8 === 0)
        c = [c[0] * .52, c[1] * .5, c[2] * .48]; if (x % 12 === 0)
        c = [c[0] * .72, c[1] * .7, c[2] * .68]; return c; });
    paint(11, '#6d4e25', 22, (x, y, c, n) => { if (x > 8 && x < 15 && y < 8)
        return [208 + 25 * n, 125 + 30 * n, 42 + 25 * n]; if (x < 8 || x > 15)
        c = [c[0] * .63, c[1] * .6, c[2] * .55]; return c; });
    paint(12, '#202321', 34, (x, y, c, n) => cracks(x, y, c, n));
    paint(13, '#3e4940', 42, (x, y, c, n) => n > .72 ? [35, 72, 37] : cracks(x, y, c, n));
    paint(14, '#5c5a52', 54, (x, y, c, n, m) => { const q = ((x * 5 + y * 7) % 9 < 3); return q ? [c[0] + 18 * m, c[1] + 17 * m, c[2] + 15 * m] : [c[0] - 17 * n, c[1] - 15 * n, c[2] - 13 * n]; });
    paint(15, '#343127', 34, (x, y, c, n) => n > .83 ? [c[0] + 16, c[1] + 12, c[2] + 5] : [c[0] * .86, c[1] * .88, c[2] * .8]);
    paint(16, '#2f3436', 48, (x, y, c, n) => { if (n > .86)
        c = [c[0] + 20, c[1] + 22, c[2] + 25]; return cracks(x, y, c, n); });
    paint(17, '#3c2d21', 30, (x, y, c, n) => { if (x % 5 === 0)
        c = [c[0] * .6, c[1] * .58, c[2] * .55]; if ((y + x) % 17 === 0)
        c = [c[0] + 22, c[1] + 13, c[2] + 6]; return c; });
    paint(18, '#172b1d', 48, (x, y, c, n) => n > .77 ? [c[0] + 12, c[1] + 27, c[2] + 10] : [c[0] * .82, c[1] * .93, c[2] * .82]);
    paint(19, '#2f251e', 28, (x, y, c, n) => { if (x % 7 < 2)
        c = [c[0] * .48, c[1] * .46, c[2] * .44]; return n > .92 ? [c[0] + 20, c[1] + 14, c[2] + 8] : c; });
    paint(20, '#a7aaa3', 35, (x, y, c, n) => { if (n > .89)
        c = [c[0] + 28, c[1] + 28, c[2] + 28]; if (n < .12)
        c = [c[0] - 35, c[1] - 32, c[2] - 28]; return c; });
    paint(21, '#6a6258', 28, (x, y, c, n) => n > .9 ? [c[0] + 15, c[1] + 10, c[2] + 8] : c);
    paint(22, '#384044', 34, (x, y, c, n) => ((x + y * 3) % 11 === 0) ? [c[0] * .55, c[1] * .57, c[2] * .6] : cracks(x, y, c, n));
    paint(23, '#3c2d1f', 42, (x, y, c, n) => ((x * 2 + y) % 7 < 2) ? [c[0] * .55, c[1] * .5, c[2] * .42] : c);
    paint(24, '#26322b', 44, (x, y, c, n) => n > .82 ? [c[0] + 18, c[1] + 22, c[2] + 13] : c);
    paint(25, '#202a21', 44, (x, y, c, n) => n > .86 ? [c[0] + 8, c[1] + 25, c[2] + 9] : c);
    paint(26, '#47392e', 32, (x, y, c, n) => ((x + y) % 8 < 2) ? [c[0] * .72, c[1] * .68, c[2] * .63] : c);
    paint(27, '#252a2b', 30, (x, y, c, n) => n > .86 ? [c[0] + 25, c[1] + 23, c[2] + 20] : c);
    paint(28, '#4b4b45', 42, (x, y, c, n) => n > .9 ? [c[0] + 25, c[1] + 25, c[2] + 20] : c);
    paint(29, '#2d221a', 40, (x, y, c, n) => ((x * 7 + y * 3) % 13 < 3) ? [c[0] * .55, c[1] * .48, c[2] * .42] : c);
    paint(30, '#5a584f', 32, (x, y, c, n) => n > .87 ? [c[0] + 15, c[1] + 14, c[2] + 12] : c);
    paint(31, '#151c18', 28, (x, y, c, n) => n > .86 ? [c[0] + 12, c[1] + 18, c[2] + 11] : c);
    paint(32, '#334b2e', 46, (x, y, c, n) => { if ((x + y) % 7 < 2)
        c = [c[0] * .55, c[1] * .72, c[2] * .5]; if (n > .83)
        c = [c[0] + 12, c[1] + 30, c[2] + 10]; return c; });
    paint(33, '#e8e1d4', 34, (x, y, c, n) => { if ((x < 5 || x > 18) && n > .45)
        c = [36, 34, 30]; if ((x + y) % 11 === 0)
        c = [45, 43, 39]; return c; });
    paint(34, '#32261d', 32, (x, y, c, n) => { if (x % 5 === 0)
        c = [c[0] * .48, c[1] * .46, c[2] * .44]; return c; });
    paint(35, '#16281a', 42, (x, y, c, n) => n > .78 ? [c[0] + 10, c[1] + 23, c[2] + 9] : [c[0] * .82, c[1] * .9, c[2] * .82]);
    paint(36, '#70452f', 52, (x, y, c, n) => n > .78 ? [c[0] + 28, c[1] + 13, c[2] - 2] : [c[0] * .78, c[1] * .72, c[2] * .66]);
    paint(37, '#31522d', 58, (x, y, c, n) => { if ((x + y * 2) % 9 < 3)
        c = [c[0] * .56, c[1] * .74, c[2] * .55]; return c; });
    paint(38, '#49663d', 48, (x, y, c, n) => n > .75 ? [c[0] + 10, c[1] + 30, c[2] + 8] : c);
    paint(39, '#315f3e', 40, (x, y, c, n) => ((x * 3 + y) % 8 < 2) ? [c[0] * .6, c[1] * .75, c[2] * .62] : c);
    paint(40, '#7d1c24', 42, (x, y, c, n) => { if ((x - 12) * (x - 12) + (y - 10) * (y - 10) < 28)
        return [140 + 50 * n, 24 + 18 * n, 30 + 15 * n]; return [31, 55, 33]; });
    paint(41, '#d7d6c8', 34, (x, y, c, n) => { if ((x - 12) * (x - 12) + (y - 10) * (y - 10) < 26)
        return [205 + 35 * n, 205 + 35 * n, 194 + 30 * n]; return [31, 55, 33]; });
    paint(42, '#62422b', 44, (x, y, c, n) => { if (y < 11 && Math.abs(x - 12) < 8)
        return [92 + 35 * n, 52 + 18 * n, 31 + 12 * n]; return [38, 53, 34]; });
    paint(43, '#91a9ad', 36, (x, y, c, n) => { const w = Math.sin((x + y) * .75) * 11; return [c[0] + w * .3, c[1] + w * .55, c[2] + w * .7]; });
    paint(44, '#555853', 54, (x, y, c, n) => cracks(x, y, n > .86 ? [c[0] + 28, c[1] + 28, c[2] + 25] : c, n));
    paint(45, '#5a3c21', 32, (x, y, c, n) => { if (y < 4 || y > 19 || x < 3 || x > 20)
        c = [c[0] * .58, c[1] * .54, c[2] * .48]; if (y === 11 || x === 11)
        c = [c[0] * .72, c[1] * .62, c[2] * .45]; if (x > 15 && x < 19 && y > 9 && y < 14)
        return [112, 88, 43]; return c; });
    paint(46, '#49382a', 38, (x, y, c, n) => { if (n > .86)
        c = [c[0] + 20, c[1] + 14, c[2] + 8]; if ((x + y) % 17 === 0)
        c = [c[0] * .62, c[1] * .58, c[2] * .52]; return c; });
    paint(47, '#403323', 42, (x, y, c, n) => { if (y < 5)
        c = [c[0] * .7, c[1] * .82, c[2] * .54]; if (n > .9)
        c = [c[0] + 16, c[1] + 11, c[2] + 5]; return c; });
    paint(48, '#5e5849', 34, (x, y, c, n) => n > .86 ? [c[0] + 18, c[1] + 17, c[2] + 12] : c);
    paint(49, '#2f2b24', 35, (x, y, c, n) => { if (n > .84)
        c = [c[0] + 14, c[1] + 11, c[2] + 6]; if ((x * 5 + y * 7) % 31 === 0)
        c = [c[0] * .55, c[1] * .52, c[2] * .48]; return c; });
    paint(50, '#77766a', 42, (x, y, c, n) => cracks(x, y, n > .87 ? [c[0] + 24, c[1] + 23, c[2] + 18] : c, n));
    paint(51, '#61554f', 48, (x, y, c, n) => { if (n > .82)
        c = [c[0] + 28, c[1] + 20, c[2] + 20]; return cracks(x, y, c, n); });
    paint(52, '#272b2c', 34, (x, y, c, n) => { if ((x + y * 2) % 13 === 0)
        c = [c[0] * .55, c[1] * .58, c[2] * .6]; if (n > .9)
        c = [c[0] + 18, c[1] + 19, c[2] + 20]; return c; });
    paint(53, '#a7a59d', 40, (x, y, c, n) => { if ((x * 3 + y * 5) % 23 === 0)
        c = [c[0] * .58, c[1] * .58, c[2] * .6]; if (n > .91)
        c = [c[0] + 26, c[1] + 25, c[2] + 24]; return c; });
    paint(54, '#4b3525', 36, (x, y, c, n) => { if (x % 5 < 2)
        c = [c[0] * .58, c[1] * .55, c[2] * .5]; if (n > .9)
        c = [c[0] + 20, c[1] + 13, c[2] + 6]; return c; });
    paint(55, '#2a472b', 52, (x, y, c, n) => n > .79 ? [c[0] + 12, c[1] + 29, c[2] + 10] : [c[0] * .8, c[1] * .91, c[2] * .78]);
    paint(56, '#5b71b7', 46, (x, y, c, n) => { if ((x - 12) * (x - 12) + (y - 9) * (y - 9) < 27)
        return [78 + 30 * n, 98 + 35 * n, 176 + 45 * n]; return [30, 57, 34]; });
    paint(57, '#d3ac3c', 42, (x, y, c, n) => { if ((x - 12) * (x - 12) + (y - 9) * (y - 9) < 27)
        return [184 + 45 * n, 143 + 38 * n, 38 + 18 * n]; return [30, 57, 34]; });
    paint(58, '#795f87', 42, (x, y, c, n) => { if (y < 15 && Math.abs(x - 12) < 7 && ((x + y) % 3 < 2))
        return [100 + 35 * n, 73 + 28 * n, 116 + 42 * n]; return [31, 55, 33]; });
    paint(59, '#35402c', 44, (x, y, c, n) => { if (y < 6)
        c = [c[0] * .72, c[1] * 1.14, c[2] * .66]; if (n > .86)
        c = [c[0] + 17, c[1] + 21, c[2] + 8]; return c; });
    paint(60, '#77704f', 38, (x, y, c, n) => { if (y < 6)
        c = [c[0] * .72, c[1] * 1.05, c[2] * .55]; if (n > .88)
        c = [c[0] + 22, c[1] + 19, c[2] + 9]; return c; });
    paint(61, '#244427', 48, (x, y, c, n) => { if (y < 6)
        c = [c[0] * .62, c[1] * 1.22, c[2] * .65]; if (n > .84)
        c = [c[0] + 14, c[1] + 29, c[2] + 13]; return c; });
    paint(62, '#6e765f', 34, (x, y, c, n) => { if (y < 7)
        c = [c[0] * .85, c[1] * 1.08, c[2] * .95]; if (n > .90)
        c = [c[0] + 24, c[1] + 26, c[2] + 22]; return c; });
    paint(63, '#8a7654', 32, (x, y, c, n) => { if ((x * 5 + y * 3) % 17 === 0)
        c = [c[0] * .72, c[1] * .68, c[2] * .61]; return c; });
    paint(64, '#915f47', 33, (x, y, c, n) => n > .87 ? [c[0] + 20, c[1] + 10, c[2] + 5] : c);
    paint(65, '#3d4b3b', 45, (x, y, c, n) => { if (n > .78)
        c = [c[0] * .72, c[1] * 1.28, c[2] * .72]; return cracks(x, y, c, n); });
    paint(66, '#d8d2bd', 29, (x, y, c, n) => { if (x % 6 < 2)
        c = [c[0] * .68, c[1] * .66, c[2] * .59]; if (n > .91)
        c = [c[0] + 13, c[1] + 12, c[2] + 9]; return c; });
    paint(67, '#263c2a', 50, (x, y, c, n) => n > .77 ? [c[0] + 9, c[1] + 28, c[2] + 10] : [c[0] * .76, c[1] * .92, c[2] * .77]);
    paint(68, '#4a3020', 32, (x, y, c, n) => { if (x % 7 < 2)
        c = [c[0] * .62, c[1] * .60, c[2] * .57]; return c; });
    paint(69, '#6e8569', 44, (x, y, c, n) => n > .77 ? [c[0] + 19, c[1] + 30, c[2] + 15] : [c[0] * .84, c[1] * .94, c[2] * .82]);
    paint(70, '#28482a', 56, (x, y, c, n) => { if (y < 16 && Math.abs(x - 12) < 9 && n > .24)
        return [c[0] + 5, c[1] + 22, c[2] + 5]; return [25, 45, 26]; });
    paint(71, '#715c39', 42, (x, y, c, n) => { if (y < 16 && Math.abs(x - 12) < 9 && n > .35)
        return [c[0] + 12, c[1] + 7, c[2] - 3]; return [39, 38, 27]; });
    paint(72, '#9d5a17', 35, (x, y, c, n) => { if (x % 6 < 2)
        c = [c[0] * .78, c[1] * .72, c[2] * .62]; if (y < 5)
        c = [54, 72, 28]; return c; });
    paint(73, '#315d30', 39, (x, y, c, n) => { if (x % 5 === 0)
        c = [c[0] * .7, c[1] * .85, c[2] * .68]; if (n > .93)
        c = [c[0] + 20, c[1] + 25, c[2] + 12]; return c; });
    paint(74, '#60635d', 44, (x, y, c, n) => cracks(x, y, n > .88 ? [c[0] + 26, c[1] + 27, c[2] + 24] : c, n));
    paint(75, '#3f3326', 36, (x, y, c, n) => n > .88 ? [c[0] + 18, c[1] + 12, c[2] + 7] : c);
    paint(76, '#5a5b55', 38, (x, y, c, n) => { if (y % 8 < 2 || x % 12 < 2)
        c = [c[0] * .48, c[1] * .49, c[2] * .47]; if (n > .91)
        c = [c[0] + 21, c[1] + 21, c[2] + 18]; return c; });
    paint(77, '#4b4b46', 42, (x, y, c, n) => { if (y % 8 < 2 || x % 12 < 2)
        c = [c[0] * .42, c[1] * .43, c[2] * .42]; if ((x * 7 + y * 11) % 37 < 3)
        c = [c[0] * .48, c[1] * .48, c[2] * .46]; return c; });
    paint(78, '#46513f', 44, (x, y, c, n) => { if (y % 8 < 2 || x % 12 < 2)
        c = [c[0] * .46, c[1] * .47, c[2] * .44]; if (n > .72)
        c = [c[0] * .72, c[1] * 1.18, c[2] * .70]; return c; });
    paint(79, '#66665d', 34, (x, y, c, n) => { const cross = (Math.abs(x - 12) < 2 || Math.abs(y - 12) < 2); if (cross)
        c = [c[0] * .55, c[1] * .55, c[2] * .52]; if (n > .9)
        c = [c[0] + 18, c[1] + 17, c[2] + 14]; return c; });
    paint(80, '#4b3825', 31, (x, y, c, n) => { if (y % 7 < 2)
        c = [c[0] * .48, c[1] * .44, c[2] * .39]; if ((x * 3 + y * 5) % 29 < 2)
        c = [c[0] + 17, c[1] + 9, c[2] + 4]; return c; });
    paint(81, '#2e261e', 34, (x, y, c, n) => { if (y % 7 < 2)
        c = [c[0] * .43, c[1] * .42, c[2] * .39]; if (n > .9)
        c = [c[0] + 14, c[1] + 10, c[2] + 6]; return c; });
    paint(82, '#55534c', 56, (x, y, c, n) => { if (n > .72)
        c = [c[0] + 16, c[1] + 15, c[2] + 12]; if ((x * 5 + y * 3) % 11 < 4)
        c = [c[0] * .68, c[1] * .66, c[2] * .62]; return c; });
    paint(83, '#38352f', 52, (x, y, c, n) => { if (n > .82)
        c = [c[0] + 18, c[1] + 15, c[2] + 11]; if ((x + y) % 9 < 3)
        c = [c[0] * .69, c[1] * .66, c[2] * .61]; return c; });
    paint(84, '#4a4b45', 40, (x, y, c, n) => { const rune = Math.abs(x - 12) < 2 || (y > 6 && y < 18 && Math.abs(x - (y - 2)) < 2) || (y > 7 && y < 18 && Math.abs(x - (25 - y)) < 2); if (rune)
        return [79, 94, 78]; return n > .9 ? [c[0] + 18, c[1] + 18, c[2] + 16] : c; });
    paint(85, '#676057', 39, (x, y, c, n) => { if (y % 8 < 2 || ((x + 6 * (Math.floor(y / 8) % 2)) % 12) < 2)
        c = [c[0] * .50, c[1] * .49, c[2] * .46]; if (n > .9)
        c = [c[0] + 18, c[1] + 15, c[2] + 12]; return c; });
    paint(86, '#5a4033', 35, (x, y, c, n) => { if ((x + y) % 12 < 3)
        c = [c[0] * .53, c[1] * .50, c[2] * .47]; if (n > .88)
        c = [c[0] + 18, c[1] + 10, c[2] + 7]; return c; });
    paint(87, '#565650', 36, (x, y, c, n) => { if (x < 5 || x > 18)
        c = [c[0] * .64, c[1] * .64, c[2] * .61]; if (y < 6)
        c = [c[0] * .76, c[1] * .77, c[2] * .72]; if (n > .9)
        c = [c[0] + 15, c[1] + 15, c[2] + 13]; return c; });
    paint(88, '#5b5348', 36, (x, y, c, n) => n > .83 ? [154 + 28 * n, 117 + 18 * n, 42 + 8 * n] : cracks(x, y, c, n));
    paint(89, '#4b4d49', 30, (x, y, c, n) => { if (y % 8 < 2 || x % 8 < 2)
        c = [c[0] * .54, c[1] * .54, c[2] * .52]; if (x > 8 && x < 15 && y > 8 && y < 15)
        c = [25, 20, 17]; return c; });
    paint(90, '#8fa3a0', 22, (x, y, c, n) => { if ((x + y) % 9 < 2)
        return [181, 202, 198]; return [c[0] + 8 * n, c[1] + 11 * n, c[2] + 13 * n]; });
    paint(91, '#777b76', 34, (x, y, c, n) => { if ((x * 7 + y * 5) % 31 < 2)
        c = [c[0] * .68, c[1] * .68, c[2] * .66]; return c; });
    paint(92, '#656967', 27, (x, y, c, n) => { if (x % 6 < 2 || y % 6 < 2)
        c = [c[0] * .72, c[1] * .72, c[2] * .70]; if (n > .9)
        c = [c[0] + 24, c[1] + 24, c[2] + 24]; return c; });
    paint(93, '#a38230', 30, (x, y, c, n) => { if (x % 6 < 2 || y % 6 < 2)
        c = [c[0] * .72, c[1] * .67, c[2] * .43]; if (n > .9)
        c = [c[0] + 28, c[1] + 23, c[2] + 8]; return c; });
    paint(94, '#5a3e27', 30, (x, y, c, n) => { if (x < 3 || x > 20 || y < 3 || y > 20)
        c = [c[0] * .52, c[1] * .48, c[2] * .42]; if (x > 10 && x < 14 && y > 9 && y < 14)
        return [128, 101, 50]; return c; });
    paint(95, '#6b4b2f', 28, (x, y, c, n) => { if (y % 6 < 2)
        c = [c[0] * .52, c[1] * .48, c[2] * .43]; return c; });
    paint(96, '#594028', 29, (x, y, c, n) => { if (x % 7 < 2)
        c = [c[0] * .5, c[1] * .46, c[2] * .42]; if (y % 9 < 2)
        c = [c[0] * .72, c[1] * .66, c[2] * .58]; return c; });
    const alphaMask = (idx, pred) => { const sx = (idx % cols) * tile, sy = Math.floor(idx / cols) * tile, img = ctx.getImageData(sx, sy, tile, tile), d = img.data; for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++)
            if (!pred(x, y)) {
                d[(y * tile + x) * 4 + 3] = 0;
            } ctx.putImageData(img, sx, sy); };
    alphaMask(37, (x, y) => y > 7 && (Math.abs(x - 5 - (23 - y) * .17) < 1.8 || Math.abs(x - 11 + (23 - y) * .11) < 2 || Math.abs(x - 17 - (23 - y) * .12) < 1.8 || Math.abs(x - 21 + (23 - y) * .2) < 1.4));
    alphaMask(38, (x, y) => y > 5 && (Math.abs(x - 12) < 1.8 || Math.abs(x - (12 + (18 - y) * .58)) < 2.2 || Math.abs(x - (12 - (18 - y) * .58)) < 2.2 || ((y % 5) < 2 && Math.abs(x - 12) < 7)));
    alphaMask(39, (x, y) => y > 2 && (Math.abs(x - 5) < 2 || Math.abs(x - 11) < 2 || Math.abs(x - 17) < 2 || Math.abs(x - 21) < 1.5));
    alphaMask(40, (x, y) => ((x - 12) * (x - 12) + (y - 9) * (y - 9) < 30) || (y > 9 && Math.abs(x - 12) < 1.7));
    alphaMask(41, (x, y) => ((x - 12) * (x - 12) + (y - 9) * (y - 9) < 29) || (y > 9 && Math.abs(x - 12) < 1.7));
    alphaMask(42, (x, y) => (y > 9 && y < 14 && Math.abs(x - 12) < 7) || (y >= 14 && Math.abs(x - 12) < 2));
    alphaMask(56, (x, y) => ((x - 12) * (x - 12) + (y - 9) * (y - 9) < 30) || (y > 9 && Math.abs(x - 12) < 1.7));
    alphaMask(57, (x, y) => ((x - 12) * (x - 12) + (y - 9) * (y - 9) < 30) || (y > 9 && Math.abs(x - 12) < 1.7));
    alphaMask(58, (x, y) => y > 4 && (Math.abs(x - 8) < 2 || Math.abs(x - 12) < 2 || Math.abs(x - 16) < 2 || ((y % 4) < 2 && Math.abs(x - 12) < 7)));
    alphaMask(70, (x, y) => y > 6 && (((x - 12) * (x - 12) + (y - 11) * (y - 11) < 76) || Math.abs(x - 12) < 2));
    alphaMask(71, (x, y) => y > 7 && (Math.abs(x - 7) < 2 || Math.abs(x - 12) < 2 || Math.abs(x - 17) < 2 || ((y % 5) < 2 && Math.abs(x - 12) < 8)));
    // Draw optional artist-made PNGs *after* the deterministic procedural bake.
    // Atlas indices, UVs, ID map and save compatibility remain unchanged.
    for(const [rawIndex,textureName] of Object.entries(S.GAME_DATA.blocks.atlasNames)){
        const img=S.GAME_TEXTURE_OVERRIDES?.[textureName];if(!img)continue;
        const tileIndex=Number(rawIndex);
        if(tileIndex>=cols*rows)continue;
        ctx.drawImage(img,(tileIndex%cols)*tile,Math.floor(tileIndex/cols)*tile,tile,tile);
    }
    const tex = S.gl.createTexture();
    S.gl.bindTexture(S.gl.TEXTURE_2D, tex);
    S.gl.pixelStorei(S.gl.UNPACK_FLIP_Y_WEBGL, false);
    S.gl.texImage2D(S.gl.TEXTURE_2D, 0, S.gl.RGBA, S.gl.RGBA, S.gl.UNSIGNED_BYTE, c);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_MIN_FILTER, S.gl.NEAREST);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_MAG_FILTER, S.gl.NEAREST);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_WRAP_S, S.gl.CLAMP_TO_EDGE);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_WRAP_T, S.gl.CLAMP_TO_EDGE);
    return { tex, tile, cols, rows, canvas: c };
};
}
