/* =====================================================================
   HANGAR — 12 aeronaves brasileiras geradas por código (cores do Brasil).
   O modelo muda a cada nível de CANHÃO; o MOTOR muda chamas, cor do
   pós-combustor e acrescenta propulsores laterais (ver player.js).
   Cada avião é pré-renderizado uma vez em canvas e vira sprite normal
   (com sombra, silhueta de impacto e textura de queimadura).
   ===================================================================== */
const BR = {
    green: '#129b47', greenL: '#46c977', greenD: '#06602a',
    olive: '#4f6b48', oliveD: '#2c4029', oliveL: '#7c9670',
    yellow: '#f6d21e', yellowL: '#fff27a', yellowD: '#b48f08',
    blue: '#22489c', blueL: '#4f7fe4', blueD: '#0d2559',
    white: '#eef2f5', whiteD: '#a9b3bc', grey: '#76838b', greyD: '#3a4349', greyL: '#a7b3ba',
    black: '#151c1f', gold: '#d9b13b', goldL: '#ffe58a'
};

const HANGAR_S = 360, HANGAR_K = 1.62; // canvas e escala (unidades: nariz em y=-100)

function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
    r = Math.round((f - r) * t + r); g = Math.round((f - g) * t + g); b = Math.round((f - b) * t + b);
    return `rgb(${r},${g},${b})`;
}

function seeded(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const AC = {
    // ---------- caminhos ----------
    sym(ctx, half) { // polígono simétrico: half = pontos do lado direito
        ctx.beginPath();
        half.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = half.length - 1; i >= 0; i--) ctx.lineTo(-half[i][0], half[i][1]);
        ctx.closePath();
    },
    side(ctx, half, s) { // só um lado (s = 1 direita, -1 esquerda)
        ctx.beginPath();
        half.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y) : ctx.moveTo(x * s, y)));
        ctx.closePath();
    },
    profile(ctx, prof, angular) { // fuselagem a partir de [y, meia-largura]
        const pts = prof.map(([y, w]) => [w, y]).concat(prof.slice().reverse().map(([y, w]) => [-w, y]));
        ctx.beginPath();
        if (angular) { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); return; }
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const n = pts.length;
        let m = mid(pts[0], pts[1]);
        ctx.moveTo(m[0], m[1]);
        for (let i = 1; i <= n; i++) {
            const p = pts[i % n], q = pts[(i + 1) % n], mm = mid(p, q);
            ctx.quadraticCurveTo(p[0], p[1], mm[0], mm[1]);
        }
        ctx.closePath();
    },

    // ---------- peças com sombreamento ----------
    fillShaded(ctx, base, x0, x1, vertical = false, y0 = -100, y1 = 100) {
        const g = vertical ? ctx.createLinearGradient(0, y0, 0, y1) : ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, shadeHex(base, -0.45));
        g.addColorStop(0.3, shadeHex(base, 0.22));
        g.addColorStop(0.5, shadeHex(base, 0.05));
        g.addColorStop(0.8, shadeHex(base, -0.18));
        g.addColorStop(1, shadeHex(base, -0.5));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(8,12,10,0.65)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
    },
    wing(ctx, half, base) {
        for (const s of [1, -1]) {
            AC.side(ctx, half, s);
            const xs = half.map((p) => p[0] * s), ys = half.map((p) => p[1]);
            const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
            g.addColorStop(0, shadeHex(base, 0.28));
            g.addColorStop(0.25, shadeHex(base, 0.08));
            g.addColorStop(0.85, shadeHex(base, -0.15));
            g.addColorStop(1, shadeHex(base, -0.4));
            ctx.fillStyle = g; ctx.fill();
            // leve variação lateral (luz vinda da esquerda)
            const g2 = ctx.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0);
            g2.addColorStop(0, s < 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.0)');
            g2.addColorStop(1, s < 0 ? 'rgba(0,0,0,0.0)' : 'rgba(0,0,0,0.14)');
            ctx.fillStyle = g2; ctx.fill();
            ctx.strokeStyle = 'rgba(8,12,10,0.65)'; ctx.lineWidth = 1.1; ctx.stroke();
        }
    },
    fus(ctx, prof, base, angular) {
        AC.profile(ctx, prof, angular);
        const w = Math.max(...prof.map((p) => p[1]));
        AC.fillShaded(ctx, base, -w, w);
    },
    fin(ctx, x, y0, y1, w, base, lean = 0) { // deriva vista de cima
        for (const s of x === 0 ? [1] : [1, -1]) {
            ctx.beginPath();
            ctx.moveTo(s * x - w / 2, y1); ctx.lineTo(s * (x + lean) - w * 0.25, y0); ctx.lineTo(s * (x + lean) + w * 0.25, y0); ctx.lineTo(s * x + w / 2, y1);
            ctx.closePath();
            AC.fillShaded(ctx, base, s * x - w, s * x + w);
        }
    },
    canopy(ctx, y, w, h, tint = '#1b4f8a') {
        ctx.beginPath(); ctx.ellipse(0, y, w / 2, h / 2, 0, 0, TAU);
        const g = ctx.createLinearGradient(-w / 2, y - h / 2, w / 2, y + h / 2);
        g.addColorStop(0, shadeHex(tint, 0.55)); g.addColorStop(0.35, tint); g.addColorStop(1, shadeHex(tint, -0.6));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,20,0.85)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-w * 0.15, y - h * 0.18, w * 0.13, h * 0.26, -0.2, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
    },
    intake(ctx, x, y, w, h) {
        for (const s of [1, -1]) {
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s * x - w / 2, y - h / 2, w, h, 2) : ctx.rect(s * x - w / 2, y - h / 2, w, h);
            ctx.fillStyle = '#12171a'; ctx.fill();
            ctx.strokeStyle = 'rgba(160,170,175,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        }
    },
    nozzle(ctx, x, y, r, rect) {
        ctx.beginPath();
        if (rect) ctx.rect(x - r, y - r * 0.55, r * 2, r * 1.1); else ctx.arc(x, y, r, 0, TAU);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, '#ff9a4a'); g.addColorStop(0.35, '#3a2a22'); g.addColorStop(1, '#5c666c');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#1a1f22'; ctx.lineWidth = 1.2; ctx.stroke();
    },
    roundel(ctx, x, y, r) { // cocar da FAB
        for (const s of [1, -1]) {
            const cx = x * s;
            ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fillStyle = BR.green; ctx.fill();
            ctx.beginPath(); ctx.arc(cx, y, r * 0.72, 0, TAU); ctx.fillStyle = BR.yellow; ctx.fill();
            ctx.beginPath(); ctx.arc(cx, y, r * 0.46, 0, TAU); ctx.fillStyle = BR.blue; ctx.fill();
            AC.star(ctx, cx, y, r * 0.3, '#ffffff');
        }
    },
    star(ctx, x, y, r, color, glow) {
        ctx.save();
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = r * 3; }
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
        ctx.restore();
    },
    flagFin(ctx, x, y0, y1, w) { // listras verde/amarelo/azul na deriva
        const h = y1 - y0;
        [[BR.green, 0, 0.4], [BR.yellow, 0.4, 0.7], [BR.blue, 0.7, 1]].forEach(([c, a, b]) => {
            ctx.fillStyle = c; ctx.fillRect(x - w / 2, y0 + h * a, w, h * (b - a));
        });
    },
    camo(ctx, colors, seed, n = 26, size = [10, 26]) { // pintar SOMENTE sobre o que já existe
        const r = seeded(seed);
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            const cx = (r() - 0.5) * 200, cy = (r() - 0.5) * 200, rr = size[0] + r() * (size[1] - size[0]);
            for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; const d = rr * (0.6 + r() * 0.6); ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8); }
            ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill();
            ctx.lineTo(-cx, cy); // espelha levemente
            ctx.beginPath();
            for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; const d = rr * (0.6 + r() * 0.6); ctx.lineTo(-cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8); }
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },
    paintAtop(ctx, fn) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; fn(); ctx.restore(); },
    panelLines(ctx, lines) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.7;
        for (const l of lines) { ctx.beginPath(); l.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.beginPath(); l.forEach(([x, y], i) => (i ? ctx.lineTo(-x, y) : ctx.moveTo(-x, y))); ctx.stroke(); }
        ctx.restore();
    },
    glowLine(ctx, pts, color, w = 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
        for (const s of [1, -1]) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y) : ctx.moveTo(x * s, y))); ctx.stroke(); }
        ctx.restore();
    },
    missileRail(ctx, x, y, len, tip = BR.yellow) {
        for (const s of [1, -1]) {
            ctx.fillStyle = BR.greyL; ctx.fillRect(s * x - 1.8, y - len / 2, 3.6, len);
            ctx.fillStyle = tip; ctx.fillRect(s * x - 1.8, y - len / 2, 3.6, 4);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.strokeRect(s * x - 1.8, y - len / 2, 3.6, len);
        }
    }
};

/* ------------------------------------------------------------------ MODELOS
   nozzles: [x, y, raio, 'jet'|'prop'|'rect']  em unidades do desenho        */
const AIRCRAFT_MODELS = [
    {
        name: 'T-27 Tucano', desc: 'Treinador a hélice', w: 54, prop: { y: -98, r: 30 },
        nozzles: [[-9, -66, 3, 'prop'], [9, -66, 3, 'prop']],
        draw(c) {
            AC.wing(c, [[6, -12], [94, -5], [96, 5], [6, 14]], BR.white);
            AC.wing(c, [[4, 62], [36, 66], [36, 74], [4, 78]], BR.white);
            AC.fus(c, [[-96, 1], [-90, 8], [-72, 11], [-40, 12], [0, 10], [40, 7], [80, 4], [88, 1]], BR.white);
            AC.paintAtop(c, () => {
                c.fillStyle = BR.blue; c.fillRect(-3.5, -90, 7, 180);
                c.fillStyle = BR.yellow; for (const s of [1, -1]) c.fillRect(s > 0 ? 78 : -97, -7, 19, 13);
                c.fillStyle = BR.green; for (const s of [1, -1]) c.fillRect(s > 0 ? 72 : -78, -7, 6, 13);
            });
            AC.panelLines(c, [[[10, -12], [10, 14]], [[50, -10], [50, 11]]]);
            AC.fin(c, 0, 56, 90, 5, BR.blue);
            AC.canopy(c, -40, 13, 34, '#2f6db0');
            AC.roundel(c, 55, 1, 8);
            c.beginPath(); c.arc(0, -95, 6, 0, TAU); c.fillStyle = BR.yellow; c.fill(); c.stroke();
        }
    },
    {
        name: 'A-29 Super Tucano', desc: 'Ataque leve a hélice', w: 58, prop: { y: -100, r: 32 },
        nozzles: [[-10, -70, 3, 'prop'], [10, -70, 3, 'prop']],
        draw(c) {
            AC.wing(c, [[7, -12], [102, -4], [102, 6], [7, 16]], BR.olive);
            AC.wing(c, [[4, 64], [40, 68], [40, 76], [4, 80]], BR.olive);
            AC.fus(c, [[-98, 1], [-92, 8], [-66, 12], [-24, 13], [20, 11], [60, 7], [88, 4], [94, 1]], BR.olive);
            AC.camo(c, [BR.oliveD, BR.oliveL, '#3a5a35'], 11, 30, [8, 20]);
            AC.panelLines(c, [[[12, -12], [12, 16]], [[60, -9], [60, 12]], [[0, -60], [0, 80]]]);
            // casulos de metralhadora
            for (const s of [1, -1]) { c.fillStyle = BR.greyD; c.fillRect(s * 34 - 3, -26, 6, 30); c.fillStyle = '#111'; c.fillRect(s * 34 - 1, -32, 2, 6); }
            AC.fin(c, 0, 58, 92, 5, BR.oliveD);
            AC.flagFin(c, 0, 66, 90, 4);
            AC.canopy(c, -44, 12, 22, '#2b5f8f'); AC.canopy(c, -22, 12, 20, '#2b5f8f');
            AC.roundel(c, 62, 2, 8);
            c.beginPath(); c.arc(0, -97, 6, 0, TAU); c.fillStyle = BR.yellow; c.fill(); c.stroke();
        }
    },
    {
        name: 'AT-26 Xavante', desc: 'Primeiro jato de ataque', w: 60,
        nozzles: [[0, 94, 7, 'jet']],
        draw(c) {
            AC.wing(c, [[8, -12], [86, 0], [88, 10], [8, 22]], BR.green);
            AC.wing(c, [[5, 66], [38, 72], [38, 80], [5, 84]], BR.green);
            AC.fus(c, [[-98, 1], [-90, 6], [-60, 11], [-20, 13], [30, 12], [70, 9], [90, 7], [95, 1]], BR.green);
            AC.paintAtop(c, () => { c.fillStyle = BR.yellow; c.beginPath(); c.moveTo(-6, -98); c.lineTo(6, -98); c.lineTo(12, -60); c.lineTo(-12, -60); c.fill(); });
            for (const s of [1, -1]) { // tanques de ponta de asa
                c.beginPath(); c.ellipse(s * 90, 4, 6, 20, 0, 0, TAU); AC.fillShaded(c, BR.yellow, s * 90 - 6, s * 90 + 6);
            }
            AC.panelLines(c, [[[14, -10], [14, 20]], [[50, -6], [50, 16]], [[0, -50], [0, 85]]]);
            AC.fin(c, 0, 60, 94, 5, BR.greenD);
            AC.canopy(c, -44, 12, 34);
            AC.roundel(c, 52, 6, 8);
        }
    },
    {
        name: 'A-1 Falcão', desc: 'Caça-bombardeiro de asa enflechada', w: 62,
        nozzles: [[0, 95, 8, 'jet']],
        draw(c) {
            AC.wing(c, [[10, -16], [86, 26], [88, 38], [10, 32]], BR.green);
            AC.wing(c, [[7, 66], [42, 84], [42, 92], [7, 88]], BR.green);
            AC.fus(c, [[-100, 1], [-88, 7], [-52, 13], [0, 15], [60, 13], [90, 10], [96, 1]], BR.green);
            AC.paintAtop(c, () => {
                c.fillStyle = BR.yellow;
                for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 12, -16); c.lineTo(s * 86, 26); c.lineTo(s * 86, 31); c.lineTo(s * 12, -9); c.fill(); }
                c.fillStyle = BR.blue; c.fillRect(-15, 20, 30, 6);
            });
            AC.panelLines(c, [[[0, -70], [0, 90]], [[30, -2], [30, 30]], [[60, 12], [60, 34]]]);
            AC.intake(c, 16, -22, 8, 24);
            AC.fin(c, 0, 58, 96, 6, BR.greenD);
            AC.missileRail(c, 88, 34, 22);
            AC.canopy(c, -50, 13, 32);
            AC.roundel(c, 56, 22, 8);
        }
    },
    {
        name: 'F-5EM Tigre', desc: 'Interceptador ágil', w: 62,
        nozzles: [[-6, 97, 6, 'jet'], [6, 97, 6, 'jet']],
        draw(c) {
            AC.wing(c, [[13, -6], [26, -16], [30, -2], [72, 22], [73, 30], [13, 36]], '#6d8396');
            AC.wing(c, [[9, 72], [38, 84], [38, 92], [9, 92]], '#6d8396');
            AC.fus(c, [[-100, 0.5], [-82, 5], [-42, 10], [0, 14], [50, 14], [90, 12], [97, 1]], '#6d8396');
            AC.paintAtop(c, () => {
                c.fillStyle = BR.green; c.fillRect(-5, -40, 10, 130);
                c.fillStyle = BR.yellow; c.beginPath(); c.moveTo(0, -100); c.lineTo(8, -72); c.lineTo(0, -64); c.lineTo(-8, -72); c.fill();
            });
            AC.panelLines(c, [[[13, 0], [73, 26]], [[10, 40], [10, 90]]]);
            AC.missileRail(c, 74, 24, 28);
            AC.fin(c, 0, 52, 97, 5, BR.green);
            AC.canopy(c, -50, 12, 30);
            AC.roundel(c, 44, 22, 7);
        }
    },
    {
        name: 'Carcará', desc: 'Delta supersônico', w: 64,
        nozzles: [[0, 99, 10, 'jet']],
        draw(c) {
            AC.wing(c, [[12, -30], [92, 62], [92, 70], [12, 72]], BR.green);
            AC.fus(c, [[-100, 1], [-80, 6], [-42, 12], [0, 14], [60, 14], [94, 12], [99, 1]], BR.green);
            AC.camo(c, [BR.greenD, '#0b7a37'], 22, 20, [10, 22]);
            AC.paintAtop(c, () => {
                c.strokeStyle = BR.yellow; c.lineWidth = 5;
                for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 14, -26); c.lineTo(s * 90, 62); c.stroke(); }
                c.fillStyle = BR.blue; for (const s of [1, -1]) c.fillRect(s > 0 ? 80 : -92, 62, 12, 10);
            });
            AC.panelLines(c, [[[30, 0], [30, 70]], [[60, 30], [60, 70]], [[0, -60], [0, 95]]]);
            AC.intake(c, 16, -26, 7, 18);
            AC.fin(c, 0, 44, 99, 7, BR.greenD);
            AC.flagFin(c, 0, 56, 92, 5);
            AC.canopy(c, -54, 12, 34);
            AC.roundel(c, 50, 40, 9);
        }
    },
    {
        name: 'F-39 Gavião', desc: 'Delta com canards', w: 66,
        nozzles: [[0, 97, 10, 'jet']],
        draw(c) {
            AC.wing(c, [[13, -6], [50, 30], [94, 52], [94, 62], [13, 64]], '#61786a');
            AC.wing(c, [[13, -50], [44, -32], [44, -26], [13, -30]], '#61786a');
            AC.fus(c, [[-100, 1], [-84, 7], [-50, 12], [0, 15], [60, 15], [92, 12], [97, 1]], '#61786a');
            AC.paintAtop(c, () => {
                c.fillStyle = 'rgba(30,50,40,0.45)';
                for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 20, 10); c.lineTo(s * 70, 44); c.lineTo(s * 40, 58); c.fill(); }
                c.fillStyle = BR.yellow; for (const s of [1, -1]) c.fillRect(s > 0 ? 86 : -94, 50, 8, 12);
                c.fillStyle = BR.green; c.beginPath(); c.moveTo(0, -100); c.lineTo(6, -84); c.lineTo(-6, -84); c.fill();
            });
            AC.panelLines(c, [[[13, -6], [94, 56]], [[40, 24], [40, 62]], [[0, -70], [0, 95]]]);
            AC.intake(c, 16, -30, 7, 20);
            AC.missileRail(c, 95, 50, 26);
            AC.fin(c, 0, 40, 97, 6, '#4b6053');
            AC.flagFin(c, 0, 52, 90, 4.5);
            AC.canopy(c, -58, 12, 32, '#7a5a1a');
            AC.roundel(c, 52, 42, 8);
        }
    },
    {
        name: 'Harpia', desc: 'Caça pesado bimotor', w: 70,
        nozzles: [[-11, 98, 9, 'jet'], [11, 98, 9, 'jet']],
        draw(c) {
            AC.wing(c, [[22, -10], [100, 40], [100, 56], [22, 52]], BR.olive);
            AC.wing(c, [[20, 70], [60, 88], [60, 98], [20, 96]], BR.olive);
            AC.fus(c, [[-100, 1], [-86, 8], [-60, 14], [-30, 24], [20, 28], [70, 26], [94, 24], [98, 1]], BR.olive);
            AC.camo(c, [BR.oliveD, BR.greenD, BR.oliveL], 33, 34, [10, 24]);
            AC.paintAtop(c, () => { c.fillStyle = BR.yellow; c.fillRect(-2.5, -90, 5, 170); });
            AC.panelLines(c, [[[22, 0], [100, 48]], [[50, 10], [50, 54]], [[10, -40], [10, 90]]]);
            AC.intake(c, 24, -26, 10, 26);
            AC.fin(c, 18, 52, 96, 6, BR.oliveD, 2);
            AC.flagFin(c, 18, 62, 90, 4); AC.flagFin(c, -18, 62, 90, 4);
            AC.missileRail(c, 100, 48, 30);
            AC.canopy(c, -60, 13, 36);
            AC.roundel(c, 64, 30, 9);
        }
    },
    {
        name: 'Arara Azul', desc: 'Asa de enflechamento negativo', w: 70,
        nozzles: [[-10, 96, 8, 'jet'], [10, 96, 8, 'jet']],
        draw(c) {
            AC.wing(c, [[20, 30], [100, -8], [100, 6], [22, 56]], BR.blue);
            AC.wing(c, [[16, -46], [48, -32], [48, -24], [16, -28]], BR.blue);
            AC.wing(c, [[18, 74], [52, 90], [52, 98], [18, 96]], BR.blue);
            AC.fus(c, [[-100, 1], [-82, 8], [-50, 14], [-10, 22], [40, 24], [86, 20], [96, 1]], BR.blue);
            AC.paintAtop(c, () => {
                c.strokeStyle = BR.yellow; c.lineWidth = 5;
                for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 20, 32); c.lineTo(s * 99, -4); c.stroke(); }
                c.strokeStyle = BR.green; c.lineWidth = 3;
                for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 22, 52); c.lineTo(s * 99, 4); c.stroke(); }
                c.fillStyle = BR.yellow; c.beginPath(); c.moveTo(-10, -60); c.lineTo(10, -60); c.lineTo(4, 40); c.lineTo(-4, 40); c.fill();
            });
            AC.panelLines(c, [[[40, 20], [40, 44]], [[70, 6], [70, 26]]]);
            AC.intake(c, 20, -20, 9, 22);
            AC.fin(c, 16, 56, 94, 6, BR.blueD, 3);
            AC.canopy(c, -62, 13, 34, '#9a7a10');
            AC.roundel(c, 70, 14, 8);
        }
    },
    {
        name: 'Onça Furtiva', desc: 'Caça furtivo de 5ª geração', w: 72,
        nozzles: [[-10, 93, 8, 'rect'], [10, 93, 8, 'rect']],
        draw(c) {
            AC.wing(c, [[24, -6], [98, 40], [92, 58], [24, 52]], '#25412f');
            AC.wing(c, [[20, 62], [56, 78], [50, 96], [20, 92]], '#25412f');
            AC.fus(c, [[-100, 0.5], [-80, 10], [-50, 18], [-20, 26], [40, 28], [86, 24], [93, 1]], '#25412f', true);
            AC.paintAtop(c, () => { // rosetas de onça discretas
                const r = seeded(77);
                c.strokeStyle = 'rgba(10,20,14,0.6)'; c.lineWidth = 1.6;
                for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 190, y = (r() - 0.5) * 180, rr = 2 + r() * 4; c.beginPath(); c.arc(x, y, rr, r() * 2, r() * 2 + 4.5); c.stroke(); }
            });
            AC.glowLine(c, [[24, -6], [98, 40], [92, 58]], BR.yellow, 1.6);
            AC.glowLine(c, [[0.5, -100], [10, -80], [18, -50], [26, -20]], BR.yellow, 1.4);
            AC.intake(c, 26, -16, 8, 22);
            AC.fin(c, 22, 52, 90, 7, '#1c3324', 6);
            AC.canopy(c, -60, 13, 38, '#c08a1a');
            AC.roundel(c, 62, 30, 7);
        }
    },
    {
        name: 'Boitatá', desc: 'Asa voadora — a serpente de fogo', w: 74,
        nozzles: [[-22, 62, 7, 'jet'], [0, 72, 8, 'jet'], [22, 62, 7, 'jet']],
        draw(c) {
            c.beginPath();
            c.moveTo(0, -100); c.lineTo(102, 58); c.lineTo(78, 70); c.lineTo(52, 56); c.lineTo(30, 70); c.lineTo(0, 74);
            c.lineTo(-30, 70); c.lineTo(-52, 56); c.lineTo(-78, 70); c.lineTo(-102, 58); c.closePath();
            AC.fillShaded(c, '#14261b', -100, 100);
            AC.fus(c, [[-100, 0.5], [-70, 9], [-20, 16], [40, 18], [72, 12], [76, 1]], '#1d3527');
            // serpente de fogo
            AC.glowLine(c, [[0, -80], [20, -40], [8, 0], [34, 30], [70, 56]], '#ffb020', 2.6);
            AC.glowLine(c, [[0, -100], [102, 58]], BR.yellow, 1.6);
            AC.glowLine(c, [[46, 30], [60, 40], [52, 50]], '#ff6a1a', 2);
            AC.canopy(c, -50, 11, 28, '#a0300a');
            AC.roundel(c, 60, 38, 7);
        }
    },
    {
        name: 'Cruzeiro do Sul', desc: 'Protótipo de duplo delta — o orgulho do Brasil', w: 80,
        nozzles: [[-14, 96, 8, 'jet'], [0, 99, 9, 'jet'], [14, 96, 8, 'jet']],
        draw(c) {
            AC.wing(c, [[16, -4], [102, 60], [102, 72], [16, 76]], BR.white);
            AC.wing(c, [[14, -52], [38, -12], [38, 0], [14, 0]], BR.white);
            AC.fus(c, [[-100, 0.5], [-80, 8], [-40, 14], [0, 18], [60, 20], [92, 18], [99, 1]], BR.white);
            AC.paintAtop(c, () => {
                c.strokeStyle = BR.gold; c.lineWidth = 3;
                for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 16, -4); c.lineTo(s * 101, 60); c.stroke(); c.beginPath(); c.moveTo(s * 14, -52); c.lineTo(s * 38, -12); c.stroke(); }
                c.fillStyle = BR.green; for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 30, 50); c.lineTo(s * 80, 64); c.lineTo(s * 80, 72); c.lineTo(s * 30, 72); c.fill(); }
                c.fillStyle = BR.yellow; for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 40, 58); c.lineTo(s * 66, 64); c.lineTo(s * 40, 66); c.fill(); }
                c.fillStyle = BR.blue; c.beginPath(); c.arc(0, 40, 13, 0, TAU); c.fill();
            });
            // Cruzeiro do Sul: 5 estrelas brilhantes
            [[0, 26, 3.4], [0, 54, 3.8], [-9, 40, 3], [9, 38, 3.2], [5, 47, 1.8]].forEach(([x, y, r]) => AC.star(c, x, y, r, '#ffffff', '#9fd8ff'));
            AC.glowLine(c, [[16, -4], [102, 60]], BR.goldL, 1.2);
            AC.fin(c, 20, 60, 96, 6, BR.whiteD, 4);
            AC.flagFin(c, 20, 66, 90, 4); AC.flagFin(c, -20, 66, 90, 4);
            AC.canopy(c, -62, 13, 36, '#1f60c8');
            AC.roundel(c, 72, 44, 8);
        }
    }
];

/** gera os sprites dos 12 modelos */
function buildHangar() {
    const S = HANGAR_S, K = HANGAR_K;
    AIRCRAFT_MODELS.forEach((m, i) => {
        const cv = makeCanvas(S, S), c = cv.getContext('2d');
        c.translate(S / 2, S / 2); c.scale(K, K);
        c.lineJoin = 'round';
        m.draw(c);
        // luz global: alto-esquerda clara, baixo-direita escura
        c.setTransform(1, 0, 0, 1, 0, 0);
        AC.paintAtop(c, () => {
            const g = c.createLinearGradient(0, 0, S, S);
            g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
            c.fillStyle = g; c.fillRect(0, 0, S, S);
        });
        // recorte do retângulo útil
        const data = c.getImageData(0, 0, S, S).data;
        let x0 = S, y0 = S, x1 = 0, y1 = 0;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (data[(y * S + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(S - 1, x1 + 2); y1 = Math.min(S - 1, y1 + 2);
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        const out = makeCanvas(cw, ch);
        out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
        const toFrac = (ux, uy) => [((S / 2 + ux * K) - x0) / cw - 0.5, ((S / 2 + uy * K) - y0) / ch - 0.5];
        m.nozzleFrac = m.nozzles.map(([x, y, r, kind]) => { const [fx, fy] = toFrac(x, y); return { fx, fy, r: (r * K) / cw, kind }; });
        if (m.prop) { const [fx, fy] = toFrac(0, m.prop.y); m.propFrac = { fx, fy, r: (m.prop.r * K) / cw }; }
        m.halfWidthFrac = 0.5;
        SPR['model' + i] = buildSprite(out);
        m.sprite = 'model' + i;
    });
}
