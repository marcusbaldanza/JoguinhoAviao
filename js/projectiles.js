/* =====================================================================
   PROJÉTEIS: traçantes, mísseis teleguiados, orbes, foguetes, flak,
   minas (podem ser abatidas) e feixes de laser com aviso prévio.
   ===================================================================== */
function makeBullet(o) {
    return Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 10, kind: 'orb', t: 0, life: 6, color: FACTION_COLORS.us, dead: false, grazed: false }, o);
}

/** Dispara um projétil inimigo em ângulo (aplica multiplicadores de dificuldade) */
function enemyShoot(x, y, angle, speed, opts = {}) {
    const sp = speed * G.mod.bulletSpeed;
    const b = makeBullet(Object.assign({ x, y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r: 6, dmg: 10 }, opts));
    b.dmg *= G.mod.dmg;
    G.eBullets.push(b);
    return b;
}

function aimAngle(x, y, spread = 0) {
    const p = G.player;
    let a = angleTo(x, y, p.x, p.y);
    // fora do holofote (fase noturna) a mira dos inimigos é menos precisa
    if (G.stage && G.stage.def.searchlights && !p.detected) a += rand(-0.18, 0.18);
    return a + spread;
}

function updateBullets(list, dt, isPlayer) {
    for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.t += dt;
        switch (b.kind) {
            case 'pmissile': {
                // procura alvo mais próximo à frente
                if (!b.target || b.target.dead || b.target.dying) b.target = findMissileTarget(b.x, b.y);
                const spd = Math.min(680, Math.hypot(b.vx, b.vy) + 900 * dt);
                let a = Math.atan2(b.vy, b.vx);
                if (b.target && b.t > 0.12) a += clamp(angleDiff(a, angleTo(b.x, b.y, b.target.x, b.target.y)), -6 * dt, 6 * dt);
                b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
                if (chance(0.8)) FX.spawn({ type: 'smoke', x: b.x - b.vx * 0.02, y: b.y - b.vy * 0.02, size: 4, size1: 12, life: 0.5, alpha: 0.35, drag: 1 });
                FX.addLight(b.x, b.y, 40, '#ff8a3a', 0.5);
                break;
            }
            case 'rocket': {
                if (b.t < 1.3 && G.player && !G.player.dead) {
                    let a = Math.atan2(b.vy, b.vx);
                    a += clamp(angleDiff(a, angleTo(b.x, b.y, G.player.x, G.player.y)), -1.6 * dt, 1.6 * dt);
                    const spd = Math.hypot(b.vx, b.vy) + 60 * dt;
                    b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
                }
                if (chance(0.6)) FX.spawn({ type: 'smoke', x: b.x - b.vx * 0.03, y: b.y - b.vy * 0.03, size: 4, size1: 11, life: 0.6, alpha: 0.3, drag: 1 });
                FX.addLight(b.x, b.y, 36, '#ff7a2a', 0.45);
                break;
            }
            case 'flak':
                if (b.t >= b.fuse) { burstFlak(b); b.dead = true; }
                break;
            case 'mine':
                b.vx *= 1 - 1.2 * dt; b.vy = Math.max(40, b.vy * (1 - 1.2 * dt));
                if (b.t > 0.8 && G.player && dist2(b.x, b.y, G.player.x, G.player.y) < 80 * 80) { burstMine(b); b.dead = true; }
                if (b.t > 7) { burstMine(b); b.dead = true; }
                break;
            case 'curve':
                { const a = Math.atan2(b.vy, b.vx) + b.curve * dt, s = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; }
                break;
            case 'accel':
                { const s = Math.hypot(b.vx, b.vy), ns = Math.min(b.maxSpeed || 420, s + b.acc * dt); b.vx *= ns / s; b.vy *= ns / s; }
                break;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.dead || b.t > b.life || b.x < -60 || b.x > W + 60 || b.y < -80 || b.y > H + 60) {
            list[i] = list[list.length - 1];
            list.pop();
        }
    }
}

function findMissileTarget(x, y) {
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
        if (e.dying || e.y < -20) continue;
        const d = dist2(x, y, e.x, e.y) + (e.y > y ? 200000 : 0);
        if (d < bd) { bd = d; best = e; }
    }
    if (G.boss && G.boss.targetable) {
        const d = dist2(x, y, G.boss.x, G.boss.y);
        if (d < bd) best = G.boss;
    }
    return best;
}

function burstFlak(b) {
    FX.explode(b.x, b.y, 0.35, { debris: false, sound: false });
    Sound.explosion(0.4);
    const n = b.frags || 8, off = rand(0, TAU);
    for (let i = 0; i < n; i++) enemyShoot(b.x, b.y, off + (i / n) * TAU, 150, { r: 4, dmg: b.baseDmg * 0.6, color: b.color, life: 3 });
}
function burstMine(b) {
    FX.explode(b.x, b.y, 0.6, { debris: false });
    const n = 12, off = rand(0, TAU);
    for (let i = 0; i < n; i++) enemyShoot(b.x, b.y, off + (i / n) * TAU, 180, { r: 5, dmg: b.baseDmg * 0.6, color: FACTION_COLORS.boss2, life: 4 });
}

// --------------------------------------------------------------------- desenho
function drawPlayerBullets(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.pBullets) {
        if (b.kind === 'pmissile') continue;
        const a = Math.atan2(b.vy, b.vx), len = 26;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(a);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(getGlow(b.color.glow), -len * 0.9, -b.w * 2.2, len * 1.6, b.w * 4.4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = b.color.core;
        ctx.beginPath();
        ctx.ellipse(-len * 0.15, 0, len * 0.5, b.w * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const b of G.pBullets) if (b.kind === 'pmissile') drawMissile(ctx, b, '#d9dde2', '#ff9c3a');
}

function drawMissile(ctx, b, body, flame) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.fillStyle = body;
    ctx.fillRect(-9, -2.5, 16, 5);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(7, -2.5); ctx.lineTo(11, 0); ctx.lineTo(7, 2.5); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.fillRect(-9, -4.5, 4, 9);
    ctx.globalCompositeOperation = 'lighter';
    const fl = rand(10, 16);
    ctx.drawImage(getGlow(flame), -9 - fl, -6, fl + 4, 12);
    ctx.drawImage(getGlow('#ffffff'), -12, -3, 6, 6);
    ctx.restore();
}

function drawEnemyBullets(ctx) {
    // glows aditivos
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.eBullets) {
        if (b.kind === 'rocket') continue;
        const pulse = b.kind === 'mine' ? 0.6 + 0.4 * Math.sin(b.t * 12) : 0.85;
        const s = b.r * (b.kind === 'flak' ? 3 : 3.4);
        ctx.globalAlpha = pulse;
        ctx.drawImage(getGlow(b.color.glow), b.x - s, b.y - s, s * 2, s * 2);
        FX.lights.length < 140 && FX.addLight(b.x, b.y, b.r * 7, b.color.glow, 0.35);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // núcleos (sempre visíveis, mesmo em fundo claro: contorno escuro + centro branco)
    for (const b of G.eBullets) {
        if (b.kind === 'rocket') { drawMissile(ctx, b, '#4b5148', '#ff6a1a'); continue; }
        if (b.kind === 'needle') {
            const a = Math.atan2(b.vy, b.vx);
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
            ctx.fillStyle = b.color.glow; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 2.4, b.r * 0.9, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = b.color.core; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.7, b.r * 0.45, 0, 0, TAU); ctx.fill();
            ctx.restore();
            continue;
        }
        if (b.kind === 'mine') {
            ctx.fillStyle = '#2b2b2b';
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + b.t; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); ctx.lineTo(b.x + Math.cos(a) * (b.r + 5), b.y + Math.sin(a) * (b.r + 5)); ctx.stroke(); }
            ctx.fillStyle = Math.sin(b.t * 12) > 0 ? '#ff3030' : '#661010';
            ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, TAU); ctx.fill();
            continue;
        }
        ctx.fillStyle = 'rgba(30,0,10,0.55)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = b.color.glow;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.fillStyle = b.color.core;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill();
    }
}

// --------------------------------------------------------------------- lasers
/** Feixe com fase de aviso (linha fina piscando) e fase ativa */
function makeBeam(o) {
    const beam = Object.assign({ x: 0, y: 0, angle: Math.PI / 2, len: 1400, width: 26, t: 0, warn: 0.9, dur: 1.4, dmg: 18, spin: 0, follow: null, dead: false, sounded: false }, o);
    G.beams.push(beam);
    Sound.laserCharge();
    return beam;
}

function updateBeams(dt) {
    for (let i = G.beams.length - 1; i >= 0; i--) {
        const b = G.beams[i];
        b.t += dt;
        if (b.follow) b.follow(b, dt);
        if (b.t > b.warn) {
            b.angle += b.spin * dt;
            if (!b.sounded) { Sound.laserFire(); b.sounded = true; FX.addTrauma(0.25); }
            const ex = b.x + Math.cos(b.angle) * b.len, ey = b.y + Math.sin(b.angle) * b.len;
            const p = G.player;
            if (p && !p.dead && distToSegment(p.x, p.y, b.x, b.y, ex, ey) < b.width * 0.42 + p.r) p.hurt(b.dmg * G.mod.dmg, p.x, p.y);
            // luzes ao longo do feixe
            for (let k = 0; k < 6; k++) FX.addLight(b.x + Math.cos(b.angle) * k * 150, b.y + Math.sin(b.angle) * k * 150, 120, b.color || '#ff3df2', 0.8);
            if (chance(0.5)) {
                const d = rand(0, b.len);
                FX.spawn({ type: 'spark', x: b.x + Math.cos(b.angle) * d, y: b.y + Math.sin(b.angle) * d, vx: rand(-200, 200), vy: rand(-200, 200), size: 1.5, life: 0.3, color: '#ffb0ff' });
            }
        }
        if (b.t > b.warn + b.dur || b.dead) G.beams.splice(i, 1);
    }
}

function drawBeams(ctx) {
    for (const b of G.beams) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        if (b.t < b.warn) {
            const blink = Math.sin(b.t * 40) > 0 ? 0.9 : 0.4;
            ctx.globalAlpha = blink;
            ctx.strokeStyle = '#ff3355';
            ctx.lineWidth = 2;
            ctx.setLineDash([16, 10]);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.len, 0); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalCompositeOperation = 'lighter';
            const ch = 10 + 30 * (b.t / b.warn);
            ctx.drawImage(getGlow(b.color || '#ff3df2'), -ch, -ch, ch * 2, ch * 2);
        } else {
            const k = (b.t - b.warn) / b.dur;
            const wv = b.width * (k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1) * (0.9 + 0.1 * Math.sin(b.t * 60));
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, -wv, 0, wv);
            const col = b.color || '#ff3df2';
            g.addColorStop(0, hexToRgba(col, 0));
            g.addColorStop(0.3, hexToRgba(col, 0.7));
            g.addColorStop(0.5, '#ffffff');
            g.addColorStop(0.7, hexToRgba(col, 0.7));
            g.addColorStop(1, hexToRgba(col, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, -wv, b.len, wv * 2);
            ctx.drawImage(getGlow(col), -wv * 2.5, -wv * 2.5, wv * 5, wv * 5);
        }
        ctx.restore();
    }
}
