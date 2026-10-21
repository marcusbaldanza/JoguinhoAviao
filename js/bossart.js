/* =====================================================================
   ARTE DOS NOVOS CHEFES (gerada por código, paleta escura da TRÍADE).
   Todos apontam o nariz para BAIXO (+y), como os sprites originais.
   ===================================================================== */
const TR = { steel: '#4d565d', steelL: '#7b868e', steelD: '#262c31', dark: '#1b1f23', red: '#9b1d1d', redL: '#ff3b2f', olive: '#4b5440', oliveD: '#2c3226', deck: '#3d4448', yellow: '#d9b13b' };

/** emblema fictício da TRÍADE: triângulo com três pontas */
function triadeEmblem(c, x, y, r) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#111'; c.fill();
    c.beginPath();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * TAU) / 3; c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); }
    c.closePath(); c.fillStyle = TR.red; c.fill();
    c.strokeStyle = '#ddd'; c.lineWidth = r * 0.12; c.stroke();
    c.restore();
}

function bossCanvas(S, K, draw) {
    const cv = makeCanvas(S, S), c = cv.getContext('2d');
    c.translate(S / 2, S / 2); c.scale(K, K); c.lineJoin = 'round';
    draw(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    AC.paintAtop(c, () => {
        const g = c.createLinearGradient(0, 0, S, S);
        g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = g; c.fillRect(0, 0, S, S);
    });
    // recorte
    const d = c.getImageData(0, 0, S, S).data;
    let x0 = S, y0 = S, x1 = 0, y1 = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const out = makeCanvas(x1 - x0 + 3, y1 - y0 + 3);
    out.getContext('2d').drawImage(cv, x0 - 1, y0 - 1, out.width, out.height, 0, 0, out.width, out.height);
    return out;
}

const BOSS_ART = {
    // Nave-mãe de drones: núcleo hexagonal + 4 braços com rotores carenados
    boss_ceifador(c) {
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            c.beginPath(); c.moveTo(sx * 20, sy * 10); c.lineTo(sx * 70, sy * 62); c.lineTo(sx * 62, sy * 70); c.lineTo(sx * 10, sy * 20); c.closePath();
            AC.fillShaded(c, TR.steel, -80, 80);
        }
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const x = sx * 72, y = sy * 72;
            c.beginPath(); c.arc(x, y, 27, 0, TAU); AC.fillShaded(c, TR.steelD, x - 27, x + 27);
            c.beginPath(); c.arc(x, y, 21, 0, TAU); c.fillStyle = '#101316'; c.fill();
            c.strokeStyle = 'rgba(150,160,170,0.5)'; c.lineWidth = 1;
            for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3 + 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 21, y + Math.sin(a) * 21); c.stroke(); }
            c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fillStyle = TR.steelL; c.fill();
        }
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + Math.PI / 6; c.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); }
        c.closePath(); AC.fillShaded(c, TR.steel, -46, 46);
        // baias de lançamento
        for (const [x, y] of [[-24, -14], [24, -14], [-24, 14], [24, 14]]) {
            c.fillStyle = '#0d0f11'; c.fillRect(x - 8, y - 6, 16, 12);
            c.fillStyle = TR.redL; c.fillRect(x - 8, y - 6, 16, 2);
        }
        c.beginPath(); c.arc(0, 0, 15, 0, TAU);
        const g = c.createRadialGradient(-4, -4, 1, 0, 0, 15); g.addColorStop(0, '#ff8a7a'); g.addColorStop(0.4, '#c01818'); g.addColorStop(1, '#300404');
        c.fillStyle = g; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke();
        triadeEmblem(c, 0, 34, 7);
    },
    // Avião-canhoneira de 4 motores (nariz para baixo), canhões na lateral esquerda
    boss_espectro(c) {
        AC.wing(c, [[10, -18], [100, -12], [100, -2], [10, 6]], TR.steel);
        AC.wing(c, [[6, -86], [44, -84], [44, -76], [6, -72]], TR.steel);
        AC.fus(c, [[100, 1], [92, 12], [70, 17], [20, 18], [-40, 16], [-80, 11], [-96, 4], [-100, 1]], TR.steel);
        AC.fin(c, 0, -100, -62, 7, TR.steelD);
        for (const x of [-62, -32, 32, 62]) {
            c.beginPath(); c.ellipse(x, -4, 6, 20, 0, 0, TAU); AC.fillShaded(c, TR.steelD, x - 6, x + 6);
            c.beginPath(); c.ellipse(x, 18, 16, 3, 0, 0, TAU); c.fillStyle = 'rgba(30,30,30,0.35)'; c.fill(); // hélice
        }
        // canhões laterais
        for (const y of [-30, -5, 20]) { c.fillStyle = '#121416'; c.fillRect(-30, y - 2.5, 14, 5); c.fillStyle = TR.redL; c.fillRect(-31, y - 1, 2, 2); }
        AC.panelLines(c, [[[0, -60], [0, 90]], [[12, -40], [12, 60]]]);
        c.fillStyle = '#0d1a26'; c.fillRect(-9, 84, 18, 6);
        triadeEmblem(c, 0, -40, 8); triadeEmblem(c, 72, -8, 6); triadeEmblem(c, -72, -8, 6);
    },
    // Helicóptero de carga com dois rotores (os rotores são desenhados girando no jogo)
    boss_tita(c) {
        for (const sx of [-1, 1]) { // tanques laterais (sponsons)
            c.beginPath(); c.ellipse(sx * 40, 4, 11, 34, 0, 0, TAU); AC.fillShaded(c, TR.oliveD, sx * 40 - 11, sx * 40 + 11);
        }
        AC.fus(c, [[78, 1], [70, 22], [52, 32], [-52, 32], [-70, 22], [-78, 1]], TR.olive);
        AC.camo(c, [TR.oliveD, '#5a6650'], 91, 18, [10, 22]);
        for (const y of [-56, 56]) { c.beginPath(); c.ellipse(0, y, 18, 18, 0, 0, TAU); AC.fillShaded(c, TR.oliveD, -18, 18); }
        for (let y = -34; y <= 34; y += 17) for (const x of [-22, 22]) { c.fillStyle = '#1a2230'; c.fillRect(x - 3, y - 4, 6, 8); }
        c.fillStyle = '#26303a'; c.beginPath(); c.ellipse(0, 70, 16, 8, 0, 0, TAU); c.fill();
        c.fillStyle = TR.yellow; for (let i = 0; i < 4; i++) c.fillRect(-6 + i * 3, -76, 1.5, 6);
        triadeEmblem(c, 0, 0, 10);
    },
    // Bombardeiro furtivo de asa voadora
    boss_sombra(c) {
        c.beginPath();
        c.moveTo(0, 70); c.lineTo(100, -12); c.lineTo(92, -24); c.lineTo(70, -12); c.lineTo(48, -30); c.lineTo(24, -16); c.lineTo(0, -34);
        c.lineTo(-24, -16); c.lineTo(-48, -30); c.lineTo(-70, -12); c.lineTo(-92, -24); c.lineTo(-100, -12); c.closePath();
        AC.fillShaded(c, '#25292e', -100, 100);
        AC.panelLines(c, [[[0, 60], [80, -4]], [[0, 40], [56, -8]], [[0, 20], [34, -6]]]);
        for (const x of [-22, 22]) { c.fillStyle = '#0b0c0e'; c.beginPath(); c.moveTo(x - 10, 10); c.lineTo(x + 10, 10); c.lineTo(x + 6, 18); c.lineTo(x - 6, 18); c.fill(); }
        c.beginPath(); c.moveTo(-10, 40); c.lineTo(10, 40); c.lineTo(6, 52); c.lineTo(-6, 52); c.closePath(); c.fillStyle = '#1b2b3a'; c.fill();
        AC.glowLine(c, [[0, 70], [100, -12]], 'rgba(160,80,255,0.6)', 1.2);
        triadeEmblem(c, 60, 0, 6); triadeEmblem(c, -60, 0, 6);
    },
    // Porta-aviões (proa para baixo)
    boss_colosso(c) {
        c.beginPath();
        c.moveTo(0, 100); c.quadraticCurveTo(60, 70, 62, 20); c.lineTo(66, -90); c.lineTo(-58, -96); c.lineTo(-62, 20); c.quadraticCurveTo(-60, 70, 0, 100);
        c.closePath(); AC.fillShaded(c, '#555d63', -66, 66);
        // convés
        c.beginPath(); c.moveTo(0, 92); c.quadraticCurveTo(52, 66, 54, 20); c.lineTo(58, -86); c.lineTo(-52, -90); c.lineTo(-54, 20); c.quadraticCurveTo(-52, 66, 0, 92); c.closePath();
        c.fillStyle = TR.deck; c.fill();
        c.strokeStyle = TR.yellow; c.lineWidth = 1.4; c.setLineDash([6, 5]);
        c.beginPath(); c.moveTo(-10, 80); c.lineTo(-30, -84); c.stroke();
        c.beginPath(); c.moveTo(14, 70); c.lineTo(14, -80); c.stroke();
        c.setLineDash([]);
        c.strokeStyle = '#e8e8e8'; c.lineWidth = 0.8;
        for (let y = -70; y < 60; y += 22) { c.beginPath(); c.moveTo(10, y); c.lineTo(18, y); c.stroke(); }
        // ilha (superestrutura)
        c.beginPath(); c.rect(36, -30, 22, 44); AC.fillShaded(c, '#6a737a', 36, 58);
        c.fillStyle = '#20262b'; c.fillRect(40, -24, 14, 8);
        c.beginPath(); c.arc(47, 4, 6, 0, TAU); c.fillStyle = '#2a3036'; c.fill();
        // jatos estacionados
        for (const [x, y] of [[-34, -60], [-20, -60], [-34, -40], [-20, -40], [30, 40], [40, 54]]) {
            c.save(); c.translate(x, y);
            c.fillStyle = '#7a848c';
            c.beginPath(); c.moveTo(0, 8); c.lineTo(6, -2); c.lineTo(2, -2); c.lineTo(2, -7); c.lineTo(-2, -7); c.lineTo(-2, -2); c.lineTo(-6, -2); c.closePath(); c.fill();
            c.restore();
        }
        c.fillStyle = '#2e353a'; c.fillRect(-46, 0, 18, 18); c.fillRect(-6, -86, 18, 14); // elevadores
        triadeEmblem(c, 0, 50, 9);
    }
};

function buildBossArt() {
    for (const [key, draw] of Object.entries(BOSS_ART)) SPR[key] = buildSprite(bossCanvas(420, 1.95, draw));
}
