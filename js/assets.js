/* =====================================================================
   Carregamento de imagens + geração de texturas derivadas e procedurais
   (sombras desfocadas, silhuetas de impacto, queimaduras de dano, brilhos,
   nuvens, crateras, drones, baterias antiaéreas e lanchas).
   ===================================================================== */
const ASSET_LIST = {
    jogador: 'assets/opt/jogador.png',
    jogador2: 'assets/opt/jogador2.png',
    jogador3: 'assets/opt/jogador3.png',
    jogador4: 'assets/opt/jogador4.png',
    aviaoEUA: 'assets/opt/aviaoEUA.png',
    aviaoISRAEL: 'assets/opt/aviaoISRAEL.png',
    aviaoJAPAO: 'assets/opt/aviaoJAPAO.png',
    helicopteroEUA: 'assets/opt/helicopteroEUA.png',
    helicopteroISRAEL: 'assets/opt/helicopteroISRAEL.png',
    chefao: 'assets/opt/chefao.png',
    PWbomba: 'assets/opt/PWbomba.png',
    PWcanhao: 'assets/opt/PWcanhao.png',
    PWsaude: 'assets/opt/PWsaude.png',
    PWvelocidade: 'assets/opt/PWvelocidade.png',
    insignia: 'assets/opt/insigniaBrasil.png',
    bg1: 'assets/opt/cenariojogo.jpg',
    bg2: 'assets/opt/cenariojogo2.jpg',
    bg3: 'assets/opt/cenariojogo3.jpg',
    bg4: 'assets/opt/cenariojogo4.jpg',
    bg5: 'assets/opt/cenariojogo5.jpg',
    bg6: 'assets/opt/cenariojogo6.jpg'
};

const IMG = {};   // imagens cruas
const SPR = {};   // sprites com derivados: { img, w, h, white, shadow, burn, pad }
const TEX = {};   // texturas procedurais

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { console.warn('Falha ao carregar', src); resolve(null); };
        img.src = src;
    });
}

async function loadAssets(onProgress) {
    const keys = Object.keys(ASSET_LIST);
    let done = 0;
    const failed = [];
    await Promise.all(keys.map(async (k) => {
        const img = await loadImage(ASSET_LIST[k]);
        if (img) IMG[k] = img; else failed.push(ASSET_LIST[k]);
        done++;
        onProgress && onProgress(done / keys.length);
    }));
    buildProceduralTextures();
    for (const k of keys) if (IMG[k] && !k.startsWith('bg')) SPR[k] = buildSprite(IMG[k]);
    // sprites procedurais
    SPR.drone = buildSprite(TEX.drone);
    SPR.missileIcon = buildSprite(TEX.missileIcon);
    SPR.shieldIcon = buildSprite(TEX.shieldIcon);
    buildHangar(); // 20 aeronaves do jogador
    buildBossArt(); // chefes novos
    // variantes tingidas (bombardeiro e chefes)
    getTinted('aviaoEUA', ENEMY_TYPES.bm.tint);
    for (const b of Object.values(BOSSES)) if (b.tint) getTinted(b.sprite, b.tint);
    return failed;
}

/** Cria a silhueta branca (flash de impacto), sombra desfocada e textura de queimadura */
function buildSprite(img) {
    const w = img.width, h = img.height;
    const spr = { img, w, h };

    const white = makeCanvas(w, h), wc = white.getContext('2d');
    wc.drawImage(img, 0, 0);
    wc.globalCompositeOperation = 'source-in';
    wc.fillStyle = '#fff';
    wc.fillRect(0, 0, w, h);
    spr.white = white;

    const pad = Math.ceil(Math.max(w, h) * 0.06) + 2;
    const shadow = makeCanvas(w + pad * 2, h + pad * 2), sc = shadow.getContext('2d');
    sc.filter = `blur(${Math.max(2, Math.round(pad / 2.5))}px)`;
    sc.drawImage(img, pad, pad);
    sc.filter = 'none';
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = '#000';
    sc.fillRect(0, 0, shadow.width, shadow.height);
    spr.shadow = shadow;
    spr.pad = pad;

    // Queimaduras: manchas escuras + brasas, recortadas na silhueta
    const burn = makeCanvas(w, h), bc = burn.getContext('2d');
    const n = 9 + Math.floor((w * h) / 4000);
    for (let i = 0; i < n; i++) {
        const x = rand(w * 0.15, w * 0.85), y = rand(h * 0.1, h * 0.9), r = rand(6, Math.max(10, w * 0.16));
        const g = bc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(10,6,4,0.95)');
        g.addColorStop(0.55, 'rgba(40,22,10,0.65)');
        g.addColorStop(1, 'rgba(40,22,10,0)');
        bc.fillStyle = g;
        bc.beginPath(); bc.arc(x, y, r, 0, TAU); bc.fill();
        if (i % 3 === 0) {
            const e = bc.createRadialGradient(x, y, 0, x, y, r * 0.3);
            e.addColorStop(0, 'rgba(255,160,40,0.9)');
            e.addColorStop(1, 'rgba(255,60,0,0)');
            bc.fillStyle = e;
            bc.beginPath(); bc.arc(x, y, r * 0.3, 0, TAU); bc.fill();
        }
    }
    // riscos/rasgos de metal
    bc.strokeStyle = 'rgba(15,10,8,0.8)';
    bc.lineWidth = Math.max(1, w / 90);
    for (let i = 0; i < 6; i++) {
        bc.beginPath();
        let x = rand(0, w), y = rand(0, h);
        bc.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += rand(-w * 0.1, w * 0.1); y += rand(-h * 0.1, h * 0.1); bc.lineTo(x, y); }
        bc.stroke();
    }
    bc.globalCompositeOperation = 'destination-in';
    bc.drawImage(img, 0, 0);
    spr.burn = burn;
    return spr;
}

const _tintCache = {};
function getTinted(name, color) {
    const key = name + color;
    if (_tintCache[key]) return _tintCache[key];
    const base = IMG[name];
    if (!base) return null;
    const c = makeCanvas(base.width, base.height), x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'soft-light';
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(base, 0, 0);
    _tintCache[key] = buildSprite(c);
    return _tintCache[key];
}

/** Textura de brilho radial (usada com blend aditivo para luzes/fogo) */
const _glowCache = {};
function getGlow(color, soft = 0) {
    const key = color + soft;
    if (_glowCache[key]) return _glowCache[key];
    const s = 128, c = makeCanvas(s, s), x = c.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, color);
    g.addColorStop(soft ? 0.15 : 0.25, color);
    g.addColorStop(soft ? 0.45 : 0.5, hexToRgba(color, 0.35));
    g.addColorStop(1, hexToRgba(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    _glowCache[key] = c;
    return c;
}

function hexToRgba(hex, a) {
    if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (m, inner) => {
        const p = inner.split(',').slice(0, 3).join(',');
        return `rgba(${p},${a})`;
    });
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function buildProceduralTextures() {
    // Fumaça (puff macio com textura)
    TEX.smoke = (() => {
        const s = 96, c = makeCanvas(s, s), x = c.getContext('2d');
        for (let i = 0; i < 14; i++) {
            const px = s / 2 + rand(-16, 16), py = s / 2 + rand(-16, 16), r = rand(14, 30);
            const g = x.createRadialGradient(px, py, 0, px, py, r);
            const v = randInt(70, 120);
            g.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
            g.addColorStop(1, `rgba(${v},${v},${v},0)`);
            x.fillStyle = g;
            x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
        }
        return c;
    })();

    // Cratera / marca de queimado no chão
    TEX.scorch = (() => {
        const s = 128, c = makeCanvas(s, s), x = c.getContext('2d');
        for (let i = 0; i < 22; i++) {
            const a = rand(0, TAU), d = rand(0, 40), px = s / 2 + Math.cos(a) * d, py = s / 2 + Math.sin(a) * d, r = rand(10, 28);
            const g = x.createRadialGradient(px, py, 0, px, py, r);
            g.addColorStop(0, 'rgba(12,8,6,0.55)');
            g.addColorStop(1, 'rgba(12,8,6,0)');
            x.fillStyle = g;
            x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
        }
        const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, 26);
        g.addColorStop(0, 'rgba(0,0,0,0.85)');
        g.addColorStop(0.7, 'rgba(25,15,10,0.6)');
        g.addColorStop(1, 'rgba(25,15,10,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(s / 2, s / 2, 26, 0, TAU); x.fill();
        // raios de detritos
        x.strokeStyle = 'rgba(10,8,6,0.5)';
        for (let i = 0; i < 14; i++) {
            const a = rand(0, TAU);
            x.lineWidth = rand(1, 3);
            x.beginPath();
            x.moveTo(s / 2 + Math.cos(a) * 20, s / 2 + Math.sin(a) * 20);
            x.lineTo(s / 2 + Math.cos(a) * rand(40, 62), s / 2 + Math.sin(a) * rand(40, 62));
            x.stroke();
        }
        return c;
    })();

    // Nuvens (várias variações)
    TEX.clouds = [];
    for (let k = 0; k < 4; k++) {
        const cw = 360, ch = 220, c = makeCanvas(cw, ch), x = c.getContext('2d');
        const blobs = 26 + k * 4;
        for (let i = 0; i < blobs; i++) {
            const px = rand(70, cw - 70), py = rand(60, ch - 60) + Math.sin(i) * 10, r = rand(28, 62);
            const g = x.createRadialGradient(px, py - r * 0.2, 0, px, py, r);
            g.addColorStop(0, 'rgba(255,255,255,0.55)');
            g.addColorStop(0.6, 'rgba(235,240,248,0.25)');
            g.addColorStop(1, 'rgba(220,228,240,0)');
            x.fillStyle = g;
            x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
        }
        TEX.clouds.push(c);
    }

    // Drone kamikaze (asa delta, nariz para baixo)
    TEX.drone = (() => {
        const s = 96, c = makeCanvas(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        const body = x.createLinearGradient(-40, 0, 40, 0);
        body.addColorStop(0, '#3a3f45'); body.addColorStop(0.5, '#6b737c'); body.addColorStop(1, '#2c3035');
        x.fillStyle = body;
        x.beginPath();
        x.moveTo(0, 42); x.lineTo(40, -26); x.lineTo(30, -32); x.lineTo(0, -18); x.lineTo(-30, -32); x.lineTo(-40, -26);
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#23272b';
        x.fillRect(-5, -40, 10, 70);
        x.fillStyle = '#111';
        x.beginPath(); x.arc(0, -38, 7, 0, TAU); x.fill(); // hélice
        x.fillStyle = '#ff2a2a';
        x.beginPath(); x.arc(0, 30, 3.5, 0, TAU); x.fill();
        return c;
    })();

    // Base da bateria antiaérea
    TEX.samBase = (() => {
        const s = 96, c = makeCanvas(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        // sacos de areia
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * TAU;
            x.fillStyle = i % 2 ? '#8b7a55' : '#a08d63';
            x.beginPath(); x.ellipse(Math.cos(a) * 38, Math.sin(a) * 38, 9, 6, a + Math.PI / 2, 0, TAU); x.fill();
        }
        const g = x.createRadialGradient(0, 0, 4, 0, 0, 34);
        g.addColorStop(0, '#6f7466'); g.addColorStop(1, '#3d4136');
        x.fillStyle = g;
        x.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; x.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); }
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.stroke();
        return c;
    })();

    // Torre giratória (canos para baixo = +y)
    TEX.samTurret = (() => {
        const s = 80, c = makeCanvas(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        x.fillStyle = '#2b2f29';
        x.fillRect(-9, 4, 6, 32); x.fillRect(3, 4, 6, 32);
        x.fillStyle = '#151714';
        x.fillRect(-9, 32, 6, 4); x.fillRect(3, 32, 6, 4);
        const g = x.createRadialGradient(-5, -6, 2, 0, 0, 18);
        g.addColorStop(0, '#8c947f'); g.addColorStop(1, '#3f4538');
        x.fillStyle = g;
        x.beginPath(); x.arc(0, 0, 17, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#c0392b';
        x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill();
        return c;
    })();

    // Lancha armada (proa para baixo)
    TEX.boat = (() => {
        const w = 70, h = 120, c = makeCanvas(w, h), x = c.getContext('2d');
        x.translate(w / 2, h / 2);
        const g = x.createLinearGradient(-26, 0, 26, 0);
        g.addColorStop(0, '#3b434b'); g.addColorStop(0.5, '#8b96a1'); g.addColorStop(1, '#353c43');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(0, 56); x.quadraticCurveTo(26, 20, 24, -50); x.lineTo(-24, -50); x.quadraticCurveTo(-26, 20, 0, 56);
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#4a535c';
        x.fillRect(-14, -36, 28, 30);
        x.fillStyle = '#1d2329';
        x.fillRect(-10, -30, 20, 8);
        return c;
    })();

    // Ícones procedurais de power-up
    TEX.missileIcon = (() => {
        const s = 128, c = makeCanvas(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        for (const ox of [-26, 0, 26]) {
            x.save(); x.translate(ox, ox === 0 ? -8 : 8);
            const g = x.createLinearGradient(-8, 0, 8, 0);
            g.addColorStop(0, '#7a1f6e'); g.addColorStop(0.5, '#ff7af0'); g.addColorStop(1, '#5c1352');
            x.fillStyle = g;
            x.beginPath(); x.moveTo(0, -40); x.lineTo(8, -26); x.lineTo(8, 28); x.lineTo(-8, 28); x.lineTo(-8, -26); x.closePath(); x.fill();
            x.fillStyle = '#3a0b34';
            x.beginPath(); x.moveTo(-8, 14); x.lineTo(-16, 32); x.lineTo(-8, 30); x.fill();
            x.beginPath(); x.moveTo(8, 14); x.lineTo(16, 32); x.lineTo(8, 30); x.fill();
            x.fillStyle = '#ffd36b';
            x.beginPath(); x.moveTo(-6, 30); x.lineTo(0, 46); x.lineTo(6, 30); x.fill();
            x.restore();
        }
        return c;
    })();
    TEX.shieldIcon = (() => {
        const s = 128, c = makeCanvas(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        const g = x.createRadialGradient(0, -10, 6, 0, 0, 52);
        g.addColorStop(0, 'rgba(220,255,255,0.95)'); g.addColorStop(0.6, 'rgba(60,220,255,0.7)'); g.addColorStop(1, 'rgba(20,120,200,0.9)');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(0, -52); x.lineTo(42, -34); x.lineTo(38, 14); x.quadraticCurveTo(24, 40, 0, 54); x.quadraticCurveTo(-24, 40, -38, 14); x.lineTo(-42, -34);
        x.closePath(); x.fill();
        x.strokeStyle = '#e8ffff'; x.lineWidth = 4; x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(-30, i * 18); x.lineTo(30, i * 18); x.stroke(); }
        return c;
    })();
}
