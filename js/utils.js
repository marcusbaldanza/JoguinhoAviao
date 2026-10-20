/* Utilitários matemáticos e helpers gerais */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const randRange = (arr) => rand(arr[0], arr[1]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function weightedPick(obj) {
    let total = 0;
    for (const k in obj) total += obj[k];
    let r = Math.random() * total, last = null;
    for (const k in obj) { last = k; r -= obj[k]; if (r <= 0) return k; }
    return last;
}

function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
}

/** distância de um ponto (px,py) a um segmento (ax,ay)-(bx,by) */
function distToSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
    const cx = ax + vx * t, cy = ay + vy * t;
    return Math.hypot(px - cx, py - cy);
}

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatTime(sec) {
    const s = Math.floor(sec);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatScore(n) {
    return Math.floor(n).toLocaleString('pt-BR');
}

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}

/** Armazenamento local protegido (modo anônimo pode lançar exceção) */
const Store = {
    get(key, fallback) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignora */ }
    }
};
