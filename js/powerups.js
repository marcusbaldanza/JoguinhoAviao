/* =====================================================================
   POWER-UPS: sorteio adaptativo (considera vida e níveis atuais),
   ímã, coleta com efeito e conversão em pontos quando já no máximo.
   ===================================================================== */
class PowerUp {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.def = POWERUP_TYPES[type];
        this.spr = this.def.sprite ? SPR[this.def.sprite] : type === 'missile' ? SPR.missileIcon : SPR.shieldIcon;
        this.t = 0; this.vy = 85; this.r = 26; this.dead = false;
        this.baseX = x;
    }
    update(dt) {
        this.t += dt;
        const p = G.player;
        const d2 = p ? dist2(this.x, this.y, p.x, p.y) : Infinity;
        if (p && !p.dead && (p.magnet || d2 < 120 * 120)) {
            const a = angleTo(this.x, this.y, p.x, p.y), sp = p.magnet ? 420 : 300;
            this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt;
        } else {
            this.y += this.vy * dt;
            this.x = this.baseX + Math.sin(this.t * 2) * 24;
        }
        if (this.y > H + 40) this.dead = true;
        FX.addLight(this.x, this.y, 70, this.def.color, 0.6);
    }
    draw(ctx) {
        const pulse = 0.75 + 0.25 * Math.sin(this.t * 6);
        const blink = this.y > H - 120 && Math.floor(this.t * 10) % 2 === 0;
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.t * 3) * 3);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * pulse;
        ctx.drawImage(getGlow(this.def.color), -46, -46, 92, 92);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = blink ? 0.4 : 1;
        // cápsula
        ctx.fillStyle = 'rgba(8,14,20,0.7)';
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
        ctx.strokeStyle = this.def.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 25, this.t * 3, this.t * 3 + TAU * 0.8); ctx.stroke();
        if (this.spr) {
            const s = 40, k = Math.min(s / this.spr.w, s / this.spr.h);
            ctx.drawImage(this.spr.img, (-this.spr.w * k) / 2, (-this.spr.h * k) / 2, this.spr.w * k, this.spr.h * k);
        }
        ctx.restore();
    }
}

function choosePowerUp() {
    const p = G.player, weights = {};
    for (const [k, d] of Object.entries(POWERUP_TYPES)) weights[k] = d.weight;
    const hpk = p.hp / p.maxHp;
    weights.health *= hpk < 0.4 ? 2.4 : hpk > 0.9 ? 0.25 : 1;
    if (p.isMax('cannon')) weights.cannon = 2;
    if (p.isMax('engine')) weights.feather = 1;
    if (p.isMax('missile')) weights.missile = 1;
    if (p.bombs >= p.maxBombs) weights.bomb *= 0.3;
    if (p.shield > 0) weights.shield = 0.5;
    if (G.boss) weights.shield *= 1.6;
    return weightedPick(weights);
}

function dropPowerUp(x, y, type) {
    G.powerups.push(new PowerUp(clamp(x, 40, W - 40), y, type || choosePowerUp()));
}

const XP_KIND = { cannon: 'cannon', feather: 'engine', missile: 'missile' };

function applyPowerUp(pu) {
    const p = G.player, t = pu.type;
    let label = POWERUP_TYPES[t].label, bonus = 0;
    if (XP_KIND[t]) {
        const kind = XP_KIND[t];
        const ups = p.addXP(kind, 100);
        if (ups < 0) bonus = 500;
        else label = ups ? '' : `${POWERUP_TYPES[t].label} +100 XP`;
    } else switch (t) {
        case 'health': { const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + 25); label = `+${Math.round(p.hp - before)} Vida`; if (p.hp - before < 5) bonus = 300; break; }
        case 'bomb': if (p.bombs < p.maxBombs) { p.bombs++; label = '+1 Bomba'; } else bonus = 400; break;
        case 'shield': p.giveShield(); label = 'Escudo Ativo'; break;
    }
    if (bonus) { G.addScore(bonus, pu.x, pu.y, true); label = `Máximo! +${bonus}`; }
    G.stats.powerups[t] = (G.stats.powerups[t] || 0) + 1;
    if (label) FX.text(pu.x, pu.y - 30, label, POWERUP_TYPES[t].color, 22, 1.2);
    FX.spawn({ type: 'ring', x: pu.x, y: pu.y, size: 20, size1: 80, life: 0.35 });
    FX.spawn({ type: 'flash', x: pu.x, y: pu.y, size: 50, size1: 90, life: 0.25, color: POWERUP_TYPES[t].color });
    Sound.powerup();
}

/* ---------------------------------------------------------------- PEÇAS
   Engrenagens soltas pelos inimigos: laranja = canhão, azul = motor, rosa = mísseis */
const GEAR_KINDS = {
    cannon: { color: '#ffa53a', label: 'CANHÃO' },
    engine: { color: '#4fc3ff', label: 'MOTOR' },
    missile: { color: '#ff5af0', label: 'MÍSSIL' }
};
class Gear {
    constructor(x, y, kind) {
        this.x = x; this.y = y; this.kind = kind;
        const a = rand(0, TAU), sp = rand(60, 160);
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp - 40;
        this.t = 0; this.dead = false; this.rot = rand(0, TAU);
    }
    update(dt) {
        this.t += dt;
        this.rot += dt * 4;
        const p = G.player;
        const d2 = p && !p.dead ? dist2(this.x, this.y, p.x, p.y) : Infinity;
        if (this.t > 0.35 && (d2 < 170 * 170 || (p && p.magnet))) {
            const a = angleTo(this.x, this.y, p.x, p.y), sp = 520;
            this.vx = lerp(this.vx, Math.cos(a) * sp, Math.min(1, dt * 8));
            this.vy = lerp(this.vy, Math.sin(a) * sp, Math.min(1, dt * 8));
        } else {
            this.vx *= 1 - 2 * dt; this.vy = this.vy * (1 - 2 * dt) + 70 * dt;
        }
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y > H + 20 || this.t > 9) this.dead = true;
        if (p && !p.dead && d2 < 30 * 30) { this.dead = true; collectGear(this); }
    }
    draw(ctx) {
        const c = GEAR_KINDS[this.kind].color;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55;
        ctx.drawImage(getGlow(c), -16, -16, 32, 32);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.rotate(this.rot);
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 7 : 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
        ctx.restore();
    }
}

function dropGears(x, y, n) {
    const p = G.player;
    for (let i = 0; i < n; i++) {
        const w = { cannon: p.isMax('cannon') ? 0.1 : 0.55, engine: p.isMax('engine') ? 0.1 : 0.3, missile: p.missiles === 0 || p.isMax('missile') ? 0.05 : 0.2 };
        G.gears.push(new Gear(x + rand(-10, 10), y + rand(-10, 10), weightedPick(w)));
    }
}

function collectGear(g) {
    const p = G.player;
    const ups = p.addXP(g.kind, Math.max(4, Math.round(GEAR_XP / G.mod.density)));
    if (ups < 0) G.addScore(40, undefined, undefined, true);
    G.stats.gears = (G.stats.gears || 0) + 1;
    FX.spawn({ type: 'flash', x: g.x, y: g.y, size: 14, size1: 26, life: 0.15, color: GEAR_KINDS[g.kind].color });
    Sound.gear();
}
