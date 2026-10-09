// NightCraft V15 · native ES module (world/noise.js); installs into the explicit shared state.
export function install(S) {
S.worldSeed = 1337;

S.hashString = function hashString(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return h >>> 0; };

S.hash2i = function hash2i(x, z, seed = S.worldSeed) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed; h = (h ^ (h >>> 13)); h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

S.hash3i = function hash3i(x, y, z, seed = S.worldSeed) { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791) ^ seed; h = (h ^ (h >>> 13)); h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

S.noise2 = function noise2(x, z) { const x0 = Math.floor(x), z0 = Math.floor(z), tx = S.smooth(x - x0), tz = S.smooth(z - z0); const a = S.hash2i(x0, z0), b = S.hash2i(x0 + 1, z0), c = S.hash2i(x0, z0 + 1), d = S.hash2i(x0 + 1, z0 + 1); return S.lerp(S.lerp(a, b, tx), S.lerp(c, d, tx), tz); };

S.fbm2 = function fbm2(x, z) { let s = 0, a = .55, f = 1; for (let i = 0; i < 4; i++) {
    s += S.noise2(x * f, z * f) * a;
    f *= 2.03;
    a *= .5;
} return s / 1.03125; };

S.noise3 = function noise3(x, y, z) { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), tx = S.smooth(x - X), ty = S.smooth(y - Y), tz = S.smooth(z - Z); const h = (dx, dy, dz) => S.hash3i(X + dx, Y + dy, Z + dz); const x00 = S.lerp(h(0, 0, 0), h(1, 0, 0), tx), x10 = S.lerp(h(0, 1, 0), h(1, 1, 0), tx), x01 = S.lerp(h(0, 0, 1), h(1, 0, 1), tx), x11 = S.lerp(h(0, 1, 1), h(1, 1, 1), tx); return S.lerp(S.lerp(x00, x10, ty), S.lerp(x01, x11, ty), tz); };
}
