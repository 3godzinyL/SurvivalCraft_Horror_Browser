import {buildLeafTile} from './leaf-texture.js';
import {buildAtlasMipmaps} from './atlas-mips.js';
// NightCraft V15 · native ES module (render/gl.js); installs into the explicit shared state.
export function install(S) {
S.compileShader = function compileShader(type, src) { const s = S.gl.createShader(type); S.gl.shaderSource(s, src); S.gl.compileShader(s); if (!S.gl.getShaderParameter(s, S.gl.COMPILE_STATUS))
    throw new Error(S.gl.getShaderInfoLog(s)); return s; };

S.makeProgram = function makeProgram(vs, fs) { const p = S.gl.createProgram(); S.gl.attachShader(p, S.compileShader(S.gl.VERTEX_SHADER, vs)); S.gl.attachShader(p, S.compileShader(S.gl.FRAGMENT_SHADER, fs)); // Attribute zero stays a position array on every program (ANGLE/D3D11).
    S.gl.bindAttribLocation?.(p,0,"aPos"); S.gl.linkProgram(p); if (!S.gl.getProgramParameter(p, S.gl.LINK_STATUS))
    throw new Error(S.gl.getProgramInfoLog(p)); return p; };

S.textureDerivatives=!!S.gl.getExtension('OES_standard_derivatives');
const textureDefines=S.textureDerivatives?'#extension GL_OES_standard_derivatives : enable\n#define TEXTURE_DERIVATIVES\n':'';
S.voxelProgram = S.makeProgram(S.GAME_SHADERS.voxelVertex, textureDefines+S.GAME_SHADERS.voxelFragment);

S.colorProgram = S.makeProgram(S.GAME_SHADERS.colorVertex, S.GAME_SHADERS.colorFragment);
// V31 sky: physically-inspired vertical gradient + illuminated horizon + dusk hue.
S.skyProgram=S.makeProgram(`
  attribute vec2 aPos;varying vec2 vUV;
  void main(){vUV=(aPos+1.0)*.5;gl_Position=vec4(aPos,0.99,1.0);}
`, `
  precision mediump float;varying vec2 vUV;
  uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uDusk;
  uniform float uDuskAmount;
  void main(){
    float h=clamp(vUV.y,0.0,1.0);
    float blend=smoothstep(.16,.98,h);
    vec3 col=mix(uHorizon,uZenith,blend);
    float dh=(h-.31)*4.5;float glow=exp(-dh*dh)*uDuskAmount;
    col=mix(col,uDusk,glow*.62);
    gl_FragColor=vec4(col,1.0);
  }
`);
S.skyLocation={pos:S.gl.getAttribLocation(S.skyProgram,'aPos'),zenith:S.gl.getUniformLocation(S.skyProgram,'uZenith'),horizon:S.gl.getUniformLocation(S.skyProgram,'uHorizon'),dusk:S.gl.getUniformLocation(S.skyProgram,'uDusk'),amount:S.gl.getUniformLocation(S.skyProgram,'uDuskAmount')};
S.skyBuffer=S.gl.createBuffer();
S.gl.bindBuffer(S.gl.ARRAY_BUFFER,S.skyBuffer);
S.gl.bufferData(S.gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),S.gl.STATIC_DRAW);
S.drawSkyGradient=(sky,day,ph,weather)=>{
    const night=1-day,dusk=Math.max(0,1-Math.min(Math.abs(ph-.25),Math.abs(ph-.75))/.13);
    const cloudCover=weather==='mist'?.66:weather==='rain'?.81:1;
    const horizon=[sky[0]*1.19,sky[1]*1.17,sky[2]*1.10].map(x=>Math.min(.9,x*cloudCover+.012));
    S.gl.disable(S.gl.DEPTH_TEST);S.gl.depthMask(false);
    // Rebuilt chunks can delete buffers still referenced by enabled attributes.
    // The sky uses only its own position attribute; clear voxel/plant bindings.
    for(const i of [S.VL.pos,S.VL.normal,S.VL.uv,S.VL.wind,S.VL.tint,S.VL.sky,S.VL.depth])if(i>=0)S.gl.disableVertexAttribArray(i);
    S.gl.useProgram(S.skyProgram);
    S.gl.uniform3fv(S.skyLocation.zenith,sky);
    S.gl.uniform3fv(S.skyLocation.horizon,horizon);
    S.gl.uniform3fv(S.skyLocation.dusk,[.64,.32,.16]);
    S.gl.uniform1f(S.skyLocation.amount,dusk*(1-night*.55)*(weather==='rain'?.36:1));
    S.gl.bindBuffer(S.gl.ARRAY_BUFFER,S.skyBuffer);
    S.gl.enableVertexAttribArray(S.skyLocation.pos);
    S.gl.vertexAttribPointer(S.skyLocation.pos,2,S.gl.FLOAT,false,0,0);
    S.gl.drawArrays(S.gl.TRIANGLES,0,6);
    S.gl.depthMask(true);S.gl.enable(S.gl.DEPTH_TEST);
};

S.applyAtlasFiltering=()=>{const gl=S.gl;if(!S.atlas)return;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.atlas.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,S.graphics?.filtering==="pixel"?gl.NEAREST:gl.NEAREST_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);const ext=S.anisotropyExt??(S.anisotropyExt=gl.getExtension("EXT_texture_filter_anisotropic")||gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic")||false);if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT),S.graphics?.filtering==="pixel"?1:(S.graphics?.anisotropy||4)));};

S.VL = {
    sharpTex:S.gl.getUniformLocation(S.voxelProgram,"uTexSharp"),
    depth:S.gl.getAttribLocation(S.voxelProgram,"aDepth"),reflectionTex:S.gl.getUniformLocation(S.voxelProgram,"uReflectionTex"),reflectionVP:S.gl.getUniformLocation(S.voxelProgram,"uReflectionVP"),reflectionEnabled:S.gl.getUniformLocation(S.voxelProgram,"uReflectionEnabled"),waterQuality:S.gl.getUniformLocation(S.voxelProgram,"uWaterQuality"),clipHeight:S.gl.getUniformLocation(S.voxelProgram,"uClipHeight"),
    floraFar:S.gl.getUniformLocation(S.voxelProgram,"uFloraFar"), wet:S.gl.getUniformLocation(S.voxelProgram,'uWet'), sky: S.gl.getAttribLocation(S.voxelProgram, 'aSky'), pos: S.gl.getAttribLocation(S.voxelProgram, 'aPos'), normal: S.gl.getAttribLocation(S.voxelProgram, 'aNormal'), uv: S.gl.getAttribLocation(S.voxelProgram, 'aUV'), wind: S.gl.getAttribLocation(S.voxelProgram, 'aWind'), tint: S.gl.getAttribLocation(S.voxelProgram, 'aTint'),
    vp: S.gl.getUniformLocation(S.voxelProgram, 'uVP'), tex: S.gl.getUniformLocation(S.voxelProgram, 'uTex'), cam: S.gl.getUniformLocation(S.voxelProgram, 'uCam'), fogColor: S.gl.getUniformLocation(S.voxelProgram, 'uFogColor'), fogNear: S.gl.getUniformLocation(S.voxelProgram, 'uFogNear'), fogFar: S.gl.getUniformLocation(S.voxelProgram, 'uFogFar'), day: S.gl.getUniformLocation(S.voxelProgram, 'uDay'), torch: S.gl.getUniformLocation(S.voxelProgram, 'uTorch'), torchPower: S.gl.getUniformLocation(S.voxelProgram, 'uTorchPower'), lightPos:S.gl.getUniformLocation(S.voxelProgram,'uLightPos[0]'),lightStrength:S.gl.getUniformLocation(S.voxelProgram,'uLightStrength[0]'), alpha: S.gl.getUniformLocation(S.voxelProgram, 'uAlpha'), time: S.gl.getUniformLocation(S.voxelProgram, 'uTime'), water: S.gl.getUniformLocation(S.voxelProgram, 'uWater'), flora: S.gl.getUniformLocation(S.voxelProgram, 'uFlora'), shadowHeight: S.gl.getUniformLocation(S.voxelProgram,'uShadowHeight'), shadowOrigin: S.gl.getUniformLocation(S.voxelProgram,'uShadowOrigin'), shadowSpan: S.gl.getUniformLocation(S.voxelProgram,'uShadowSpan'), shadowAmount: S.gl.getUniformLocation(S.voxelProgram,'uShadowAmount')
};

S.CL = { pos: S.gl.getAttribLocation(S.colorProgram, 'aPos'), mvp: S.gl.getUniformLocation(S.colorProgram, 'uMVP'), color: S.gl.getUniformLocation(S.colorProgram, 'uColor'), fog: S.gl.getUniformLocation(S.colorProgram, 'uFog'), fogColor: S.gl.getUniformLocation(S.colorProgram, 'uFogColor') };

S.makeAtlas = function makeAtlas() {
    const tile = 24, cols = 8, rows = 15, c = document.createElement('canvas');
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
    // V33: natural grass turf with small coherent moss/soil patches, never
    // random high-contrast confetti per pixel. Tile ids stay save-compatible.
    paint(0, '#35552b', 13, (x,y,c,n,m)=>{
        const patch=Math.sin(x*.29+y*.19)*.5+Math.cos(y*.34-x*.12)*.5;
        const blade=(x*3+y*5)%17<3;
        return [c[0]+patch*9+(blade?5:0),c[1]+patch*13+(blade?10:0),c[2]+patch*6];
    });
    paint(1, '#473526', 13, (x,y,c,n,m)=>{
        const moss=y<4 ? 1 : y<7 && (Math.sin(x*.39+y*.23)>.14) ? .72 : 0;
        const soil=Math.sin(x*.32+y*.25)*7;
        return [c[0]+soil*(1-moss)-moss*15,c[1]+soil*(1-moss)+moss*31,c[2]+soil*.7-moss*5];
    });
    paint(2, '#493726', 40, (x, y, c, n) => n > .9 ? [c[0] + 22, c[1] + 15, c[2] + 7] : c);
    paint(3, '#4b504e', 46, (x, y, c, n) => cracks(x, y, n > .9 ? [c[0] + 34, c[1] + 32, c[2] + 28] : c, n));
    paint(4, '#655e4b', 17, (x, y, c, n, m) => { const grain = Math.sin(x * .82 + y * .17) * 5; return n > .87 ? [c[0] + 26, c[1] + 23, c[2] + 13] : [c[0] + grain, c[1] + grain * .8, c[2] + grain * .45]; });
    paint(5, '#3a2718', 40, (x, y, c, n, m) => { const ring = Math.sin((x * .55) + Math.sin(y * .22) * 1.3); if (Math.abs(ring) > .82)
        c = [c[0] * .57, c[1] * .55, c[2] * .50]; if (n > .90)
        c = [c[0] + 24, c[1] + 14, c[2] + 6]; return c; });
    paint(6, '#1f3420', 50, (x, y, c, n) => { if (n > .79)
        c = [c[0] * .85, c[1] * 1.35, c[2] * .8]; if ((x * 3 + y * 5) % 17 === 0)
        c = [c[0] * .48, c[1] * .6, c[2] * .45]; return c; });
    paint(7, '#343735', 38, (x, y, c, n) => n > .72 ? [14, 16, 15] : cracks(x, y, c, n));
    paint(8, '#55514c', 34, (x, y, c, n, m) => n > .84 ? [116 + 20 * m, 72 + 10 * m, 50 + 6 * m] : cracks(x, y, c, n));
    paint(9, '#183138', 14, (x, y, c, n) => { const w = Math.sin(x * .95 + y * .33) * 7 + (n - .5) * 8; return [c[0] + w * .2, c[1] + w * .7, c[2] + w]; });
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
    paint(60, '#56583b', 15, (x,y,c,n)=>{const b=Math.sin(x*.29+y*.24)*7;return [c[0]+b,c[1]+b*.85,c[2]+b*.54];});
    paint(61, '#2e4e32', 14, (x,y,c,n)=>{const b=Math.sin(x*.29+y*.24)*8;return [c[0]+b*.55,c[1]+b,c[2]+b*.56];});
    paint(62, '#566755', 13, (x,y,c,n)=>{const b=Math.sin(x*.29+y*.24)*6;return [c[0]+b,c[1]+b,c[2]+b*.85];});
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
    // Layered procedural flower sprites: a shaded stalk, leaves and separate
    // petal pixels. Cut-out alpha ensures the world doesn't show square cards.
    const blossom=(idx,petals,count=1)=>{
        const ox=(idx%cols)*tile, oy=Math.floor(idx/cols)*tile;
        ctx.clearRect(ox,oy,tile,tile);
        const fill=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(ox+x,oy+y,w,h);};
        for(let n=0;n<count;n++){
            const px=count===1?12:6+n*7,py=8+((n*3)%5);
            for(let y=py+3;y<24;y++){fill(px,y,1,1,y%3===0?'#2a5228':'#3e7630');if(y%7===0){fill(px+1,y,3,2,'#3c7236');fill(px-3,y+1,3,2,'#37672d');}}
            const petal=petals[n%petals.length];
            for(const [dx,dy] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,2]]){
                fill(px+dx-1,py+dy-1,3,3,petal);
                fill(px+dx,py+dy,1,1,'#e5d8c0');
            }
            fill(px-1,py-1,3,3,'#d6ad45');fill(px,py,1,1,'#f7e8a2');
        }
    };
    blossom(40,['#ad283a','#cb3d4d','#e26b62']);
    blossom(41,['#d3d6c8','#f0f1de','#bcbfac']);
    blossom(56,['#526db1','#7999e9','#a5b4e5']);
    blossom(57,['#c5a13b','#f4d158','#eab747']);
    blossom(58,['#aa719c','#c191bd','#85608b'],3);
    // V32 natural-ground microtextures. Texture coordinates and block IDs stay
    // unchanged so existing saves, mods and held-blocks remain compatible.
    const groundTiles = [[0,[65,78,43]],[60,[89,83,57]],[61,[52,67,39]],[62,[86,96,82]]];
    for(const [tileIndex,base] of groundTiles){
        const tx=(tileIndex%cols)*tile,ty=Math.floor(tileIndex/cols)*tile;
        const image=ctx.getImageData(tx,ty,tile,tile),d=image.data;
        for(let yy=0;yy<tile;yy++)for(let xx=0;xx<tile;xx++){
            const i=(yy*tile+xx)*4,n=rnd(xx,yy,tileIndex+371),m=rnd(xx>>2,yy>>2,tileIndex+489);
            const blade=(xx+yy*3)%7===0&&n>.32,soil=n<.085&&m<.65;
            const patch=Math.sin(xx*Math.PI/12)*Math.cos(yy*Math.PI/12)+.4*Math.sin((xx+yy)*Math.PI/6);
            const shade=.95+.085*patch+.085*(n-.5);
            for(let k=0;k<3;k++) d[i+k]=S.clamp(base[k]*shade+(blade?(k===1?10: k===0?6:2):0)-(soil?12:0),0,255);
        }
        ctx.putImageData(image,tx,ty);
    }
    // Original mineral/soil tiles: ochre sand, coherent pebbles and loamy earth.
    paint(4,'#8d8065',12,(x,y,c,n)=>c.map((v,k)=>v+Math.sin((x+y*.3)*.8)*(k===2?2:4)));
    paint(14,'#69685f',10,(x,y,c,n)=>{
      const cell=rnd(x>>2,y>>2,781),rim=x%4===0||y%4===0;
      return c.map((v,k)=>v+(cell-.5)*24-(rim?8:0));
    });
    for(const [i,base] of [[2,'#4e3c2d'],[46,'#514532'],[47,'#483c2d'],[48,'#5c5544'],[49,'#514c36'],[59,'#414934']]){
      paint(i,base,10,(x,y,c,n)=>{
        const patch=Math.sin(x*Math.PI/12)*Math.cos(y*Math.PI/12)*8;
        const pebble=n>.96?13:0;
        return c.map((v,k)=>v+patch*(k===2?.6:1)+pebble);
      });
    }
    paint(1,'#4e3c2d',11,(x,y,c,n)=>{
      const edge=4+Math.round(2*Math.sin(x*.7)+Math.sin(x*1.4));
      if(y<edge)return [56+n*8,72+n*8,35+n*5];
      const root=(x+y*2)%23===0 && y<14;
      return [c[0]+(root?12:0),c[1]+(root?6:0),c[2]];
    });
    for(const [i,base] of [[6,'#394b31'],[18,'#304735'],[25,'#414e32'],[32,'#686043'],[35,'#2c3f2b'],[55,'#465334'],[67,'#3c4b32'],[69,'#566444']]){
      const pixels=buildLeafTile(rgb(base),i,tile);
      ctx.putImageData(new ImageData(pixels,tile,tile),(i%cols)*tile,Math.floor(i/cols)*tile);
    }
    // Leaf tips with transparent space between small branches (tile 112).
    {
      const ox=0,oy=14*tile;ctx.clearRect(ox,oy,tile,tile);
      for(let y=3;y<23;y++)for(let x=1;x<23;x++){
        const branch=Math.abs(x-12-(23-y)*.2)<1;
        const leaf=(Math.abs(x-12)<(23-y)*.45+3 && (x+2*y)%7<4 && rnd(x>>1,y>>1,813)>.23);
        if(branch||leaf){ctx.fillStyle=branch?'#66753a':`rgb(${72+Math.floor(rnd(x,y,719)*35)},${110+Math.floor(rnd(x,y,816)*38)},43)`;ctx.fillRect(ox+x,oy+y,1,1);}
      }
    }
    // 15 alpha-cutout plant sprites (97-111), authored in pixels, not translucent
    // rectangles. They are purely visual and require no new gameplay block IDs.
    const sprites = [
      {type:'grass',base:'#496538',tips:'#8a985e',blades:11}, // 97 lush grass
      {type:'grass',base:'#354c2e',tips:'#697d44',blades:15}, // 98 long woodland grass
      {type:'flower',base:'#4b892e',tips:'#af83cf',blades:10}, // 99 lavender/heather
      {type:'grass',base:'#3f5640',tips:'#7a8c60',blades:11}, // 100 marsh sedge
      {type:'cattail',base:'#4c8252',tips:'#ae9b6a',blades:8}, // 101 cattails
      {type:'arrow',base:'#3e7961',tips:'#a1c89b',blades:9}, // 102 arrowhead plant
      {type:'lily',base:'#357b54',tips:'#6caa68',blades:0}, // 103 lily pads
      {type:'fern',base:'#35472e',tips:'#6b7b48',blades:11}, // 104 woodland fern
      {type:'flower',base:'#4f962b',tips:'#e0e5c8',blades:11}, // 105 white wildflower
      {type:'flower',base:'#6b9530',tips:'#e9bc55',blades:9}, // 106 yellow flower
      {type:'clover',base:'#477b31',tips:'#a9c75c',blades:10}, // 107 clover
      {type:'grass',base:'#687e67',tips:'#bcccb3',blades:8}, // 108 alpine vegetation
      {type:'grass',base:'#867b43',tips:'#c5b66d',blades:9}, // 109 dried grass
      {type:'flower',base:'#497a30',tips:'#d0a1d0',blades:12}, // 110 pink meadow
      {type:'lilyFlower',base:'#427d53',tips:'#e9d9d2',blades:0} // 111 flowering lily
    ];
    const cssToRGB=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
    sprites.forEach((spec,ii)=>{
      const index=97+ii,px0=index%cols*tile,py0=Math.floor(index/cols)*tile;
      ctx.clearRect(px0,py0,tile,tile);
      const base=cssToRGB(spec.base),tip=cssToRGB(spec.tips);
      const dot=(x,y,col,w=1,h=1)=>{if(x<0||y<0||x>=24||y>=24)return;ctx.fillStyle=`rgb(${col.map(q=>q|0).join(',')})`;ctx.fillRect(px0+x,py0+y,w,h);};
      const blade=(x,top,lean,width,shade)=>{
        for(let y=23;y>=top;y--){
          const f=(23-y)/Math.max(1,23-top),cx=Math.round(x+lean*f*f);
          const co=base.map((b,j)=>S.clamp(b*(.70+shade*.22+f*.32)+(tip[j]-b)*f*.42,0,255));
          const wid=f>.76?1:width;
          for(let k=0;k<wid;k++)dot(cx+k,y,co);
        }
      };
      if(spec.type==='lily'||spec.type==='lilyFlower'){
        // This top-down sprite is mapped to a horizontal quad by the mesh builder.
        for(let y=2;y<22;y++)for(let x=2;x<22;x++){
          const dx=x-12,dy=y-12,d=dx*dx/95+dy*dy/72;
          if(d<1 && !(dx>0&&dy<0&&dy>-dx*.34-1)){
            let shade=.68+.31*rnd(x,y,index+44);
            dot(x,y,base.map((v,j)=>v*shade+(j===1?20:0)));
          }
        }
        if(spec.type==='lilyFlower') for(const [x,y] of [[10,8],[12,7],[14,8],[10,10],[14,10],[12,12]])dot(x,y,[227,216,201],2,2);
        return;
      }
      for(let k=0;k<spec.blades;k++){
        const r=rnd(k,ii,index), x=2+Math.floor(r*19),h=7+Math.floor(rnd(k,22,index)*14),lean=(rnd(k,31,index)-.5)*9;
        blade(x,h,lean,r>.5?2:1,r);
      }
      if(spec.type==='fern') for(let y=9;y<19;y+=3)for(const dir of [-1,1]){
        const x=12+dir*(20-y)/2;
        for(let k=0;k<5;k++)dot(Math.round(x+dir*k),y+Math.floor(k*.52),[86,137,60]);
      }
      if(spec.type==='cattail')for(const [x,y] of [[7,5],[15,8],[20,11]]){
        for(let yy=y;yy<23;yy++)dot(x,yy,[65,126,70]);
        for(let yy=y;yy<y+6;yy++)dot(x-1,yy,[103+(yy%3)*8,72,43],3);
      }
      if(spec.type==='arrow')for(const x of [7,13,19])for(let y=6;y<18;y++){
        const w=Math.max(0,5-Math.abs(y-12));
        if(y<14)for(let k=-w;k<=w;k++)dot(x+k,y,[74,139,96]);
      }
      if(spec.type==='flower'){
        for(const [x,y] of [[6,7],[13,4],[18,10]]){
          for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1]])dot(x+dx,y+dy,tip,2);
          dot(x,y,[232,197,104]);
        }
      }
      if(spec.type==='clover')for(let x=3;x<22;x+=5)for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]])dot(x+dx,14+(x%3)+dy,tip,2,2);
    });

    // Wheat, leafy vegetables and rye. No purple heads or floating cubes.
    for(let species=0;species<3;species++){
      const idx=113+species,ox=idx%cols*tile,oy=Math.floor(idx/cols)*tile;ctx.clearRect(ox,oy,tile,tile);
      for(let blade=0;blade<(species===1?8:9);blade++){
        const root=3+blade*2,tip=4+Math.floor(rnd(blade,species,493)*8),lean=(blade%3)-1;
        for(let y=tip;y<24;y++){
          const x=Math.round(root+lean*(24-y)*.18);ctx.fillStyle=species===1?'#506341':'#647344';ctx.fillRect(ox+x,oy+y,1,1);
          if(y>10&&y%4===1){ctx.fillStyle=species===1?'#68784a':'#75814c';ctx.fillRect(ox+x-2,oy+y,4,1);}
        }
        if(species!==1){ctx.fillStyle=species===0?'#a29561':'#8d865c';for(let y=tip;y<tip+5;y++)ctx.fillRect(ox+root-1+lean,oy+y,2+(y%2),1);}
        else {ctx.fillStyle='#73824f';ctx.fillRect(ox+root-2,oy+tip+5,4,3);}
      }
    }

    // Draw optional artist-made PNGs *after* the deterministic procedural bake.
    // Atlas indices, UVs, ID map and save compatibility remain unchanged.
    for(const [rawIndex,textureName] of Object.entries(S.GAME_DATA.blocks.atlasNames)){
        const img=S.GAME_TEXTURE_OVERRIDES?.[textureName];if(!img)continue;
        const tileIndex=Number(rawIndex);
        if(tileIndex>=cols*rows)continue;
        ctx.drawImage(img,(tileIndex%cols)*tile,Math.floor(tileIndex/cols)*tile,tile,tile);
    }

    // GPU-friendly POT atlas. Each 24px tile has a replicated 4px gutter,
    // so mipmaps filter one material without pulling a neighbour's colours.
    const textureCanvas=document.createElement('canvas');textureCanvas.width=256;textureCanvas.height=512;
    const tg=textureCanvas.getContext('2d');tg.imageSmoothingEnabled=false;
    const stride=32,gutter=4;
    for(let i=0;i<cols*rows;i++){
      const sx=i%cols*tile,sy=Math.floor(i/cols)*tile,dx=i%cols*stride+gutter,dy=Math.floor(i/cols)*stride+gutter;
      tg.drawImage(c,sx,sy,tile,tile,dx,dy,tile,tile);
      tg.drawImage(c,sx,sy,1,tile,dx-gutter,dy,gutter,tile);tg.drawImage(c,sx+tile-1,sy,1,tile,dx+tile,dy,gutter,tile);
      tg.drawImage(c,sx,sy,tile,1,dx,dy-gutter,tile,gutter);tg.drawImage(c,sx,sy+tile-1,tile,1,dx,dy+tile,tile,gutter);
      for(const [xx,yy] of [[0,0],[1,0],[0,1],[1,1]])tg.drawImage(c,sx+xx*(tile-1),sy+yy*(tile-1),1,1,dx+(xx?tile:-gutter),dy+(yy?tile:-gutter),gutter,gutter);
    }

    const tex = S.gl.createTexture();
    S.gl.bindTexture(S.gl.TEXTURE_2D, tex);
    S.gl.pixelStorei(S.gl.UNPACK_FLIP_Y_WEBGL, false);
    const mipmaps=buildAtlasMipmaps(tg.getImageData(0,0,256,512).data,256,512);
    mipmaps.forEach((m,level)=>S.gl.texImage2D(S.gl.TEXTURE_2D,level,S.gl.RGBA,m.width,m.height,0,S.gl.RGBA,S.gl.UNSIGNED_BYTE,m.data));
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_MIN_FILTER, S.gl.NEAREST_MIPMAP_LINEAR);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_MAG_FILTER, S.gl.NEAREST);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_WRAP_S, S.gl.CLAMP_TO_EDGE);
    S.gl.texParameteri(S.gl.TEXTURE_2D, S.gl.TEXTURE_WRAP_T, S.gl.CLAMP_TO_EDGE);
    // ANGLE can apply linear magnification whenever anisotropy > 1.
    // Keep nearby texels on a separate nearest sampler.
    const sharpTex=S.gl.createTexture();S.gl.bindTexture(S.gl.TEXTURE_2D,sharpTex);
    S.gl.texImage2D(S.gl.TEXTURE_2D,0,S.gl.RGBA,256,512,0,S.gl.RGBA,S.gl.UNSIGNED_BYTE,mipmaps[0].data);
    S.gl.texParameteri(S.gl.TEXTURE_2D,S.gl.TEXTURE_MIN_FILTER,S.gl.NEAREST);
    S.gl.texParameteri(S.gl.TEXTURE_2D,S.gl.TEXTURE_MAG_FILTER,S.gl.NEAREST);
    S.gl.texParameteri(S.gl.TEXTURE_2D,S.gl.TEXTURE_WRAP_S,S.gl.CLAMP_TO_EDGE);
    S.gl.texParameteri(S.gl.TEXTURE_2D,S.gl.TEXTURE_WRAP_T,S.gl.CLAMP_TO_EDGE);
    return { tex, sharpTex, tile, cols, rows, canvas: c, textureCanvas, stride, gutter, uvRows:16 };
};
}
