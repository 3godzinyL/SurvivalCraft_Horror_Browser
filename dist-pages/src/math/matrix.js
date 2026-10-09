// NightCraft V15 · native ES module (math/matrix.js); installs into the explicit shared state.
export function install(S) {
S.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

S.lerp = (a, b, t) => a + (b - a) * t;

S.smooth = t => t * t * (3 - 2 * t);

S.dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

S.norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
}
