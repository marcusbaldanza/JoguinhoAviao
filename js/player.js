/* =====================================================================
   JOGADOR + helpers de desenho de sprites (sombra, queimadura, flash)
   ===================================================================== */

/** Sombra projetada no chão: deslocada pela "altitude" (luz vinda do alto-esquerda) */
function drawSpriteShadow(ctx, spr, x, y, w, h, rot = 0, alt = 1, sx = 1) {
    if (!spr || alt <= 0) return;
    const ox = 22 * alt, oy = 34 * alt, k = 1 - 0.12 * alt;
    const padW = (spr.pad / spr.w) * w, padH = (spr.pad / spr.h) * h;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.translate(x + ox, y + oy);
    ctx.rotate(rot);
    ctx.scale(sx * k, k);
    ctx.drawImage(spr.shadow, -w / 2 - padW, -h / 2 - padH, w + padW * 2, h + padH * 2);
    ctx.restore();
}

/** Sprite com camadas de dano (queimado) e flash branco de impacto */
function drawSpriteFull(ctx, spr, x, y, w, h, rot = 0, opts = {}) {
    if (!spr) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (opts.sx !== undefined || opts.sy !== undefined) ctx.scale(opts.sx ?? 1, opts.sy ?? 1);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(spr.img, -w / 2, -h / 2, w, h);
    if (opts.burn > 0.02) {
        ctx.globalAlpha = Math.min(1, opts.burn) * (opts.alpha ?? 1);
        ctx.drawImage(spr.burn, -w / 2, -h / 2, w, h);
    }
    if (opts.flash > 0) {
        ctx.globalAlpha = Math.min(1, opts.flash);
        ctx.drawImage(spr.white, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
}

/** chama de pós-combustão (aditiva) */
function drawAfterburner(ctx, x, y, len, width, color = '#4fb4ff', angle = Math.PI / 2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle - Math.PI / 2);
    ctx.globalCompositeOperation = 'lighter';
    const fl = len * rand(0.8, 1.15);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(getGlow(color), -width, -width * 0.6, width * 2, fl + width);
    ctx.drawImage(getGlow('#ffffff'), -width * 0.45, -width * 0.3, width * 0.9, fl * 0.5);
    ctx.restore();
}

class Player {
    constructor(diff) {
        this.x = W / 2; this.y = H - 150;
        this.vx = 0; this.vy = 0;
        this.r = PLAYER_CFG.radius;
        this.maxHp = PLAYER_CFG.maxHp; this.hp = this.maxHp;
        this.cannon = UPGRADES.cannon.start; this.engine = UPGRADES.engine.start; this.missiles = UPGRADES.missile.start;
        this.xp = { cannon: 0, engine: 0, missile: 0 };
        this.bombs = diff.bombs; this.maxBombs = PLAYER_CFG.maxBombs;
        this.shield = 0; this.shieldMax = 60; this.shieldT = 0; this.shieldHit = 0;
        this.invuln = 1.5; this.hitFlash = 0;
        this.rollT = 0; this.rollCd = 0;
        this.fury = 0; this.furyT = 0;
        this.fireCd = 0; this.missileCd = 0;
        this.bank = 0;
        this.dmgMult = 1; this.speedMult = 1; this.rollCdMult = 1; this.furyGain = 1;
        this.magnet = false; this.regenShield = false; this.repair = false;
        this.perks = [];
        this.dead = false; this.deathT = 0;
        this.detected = false;
        this.focus = false;
        this.evolveT = 0;
        this.t = 0;
    }

    get model() { return AIRCRAFT_MODELS[Math.min(this.cannon, 12) - 1]; }
    get spr() { return SPR[this.model.sprite]; }
    get w() { return this.model.w; }
    get h() { const s = this.spr; return s ? this.w * (s.h / s.w) : this.w; }
    get eng() { return ENGINE_LEVELS[this.engine]; }
    get maxSpeed() { return PLAYER_CFG.baseSpeed * this.eng.speed * this.speedMult; }
    get rollCooldown() { return PLAYER_CFG.rollCooldown * this.eng.roll * this.rollCdMult; }
    get invulnerable() { return this.invuln > 0 || this.rollT > 0 || G.bomb.active || this.dead; }
    /** 0..1 — quão evoluído está o avião (usado na pressão adaptativa) */
    get power() {
        return ((this.cannon - 1) / 11) * 0.6 + ((this.engine - 1) / 7) * 0.15 + (this.missiles / 6) * 0.25;
    }
    levelOf(kind) { return kind === 'cannon' ? this.cannon : kind === 'engine' ? this.engine : this.missiles; }
    xpNeeded(kind) {
        const u = UPGRADES[kind], lvl = this.levelOf(kind);
        if (lvl >= u.max) return Infinity;
        return u.xp[lvl - (u.start === 0 ? 0 : 1)];
    }
    xpFrac(kind) { const n = this.xpNeeded(kind); return n === Infinity ? 1 : this.xp[kind] / n; }
    isMax(kind) { return this.levelOf(kind) >= UPGRADES[kind].max; }

    /** soma XP; retorna quantos níveis subiu (-1 se já estava no máximo) */
    addXP(kind, amount) {
        if (this.isMax(kind)) return -1;
        this.xp[kind] += amount;
        let ups = 0;
        while (!this.isMax(kind) && this.xp[kind] >= this.xpNeeded(kind)) {
            this.xp[kind] -= this.xpNeeded(kind);
            if (kind === 'cannon') this.cannon++; else if (kind === 'engine') this.engine++; else this.missiles++;
            ups++;
        }
        if (this.isMax(kind)) this.xp[kind] = 0;
        if (ups) this.onLevelUp(kind);
        return ups;
    }

    onLevelUp(kind) {
        this.evolveT = 1;
        this.invuln = Math.max(this.invuln, 0.6);
        FX.spawn({ type: 'ring', x: this.x, y: this.y, size: 20, size1: 140, life: 0.6 });
        FX.spawn({ type: 'flash', x: this.x, y: this.y, size: 60, size1: 150, life: 0.35, color: kind === 'cannon' ? '#ffd34a' : kind === 'engine' ? this.eng.flame : '#ff3df2' });
        for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; FX.spawn({ type: 'spark', x: this.x, y: this.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, size: 2, life: 0.45, color: i % 3 === 0 ? '#129b47' : i % 3 === 1 ? '#f6d21e' : '#4f7fe4' }); }
        Sound.levelUp();
        if (kind === 'cannon') G.banner('EVOLUÇÃO!', '#ffd34a', 2.2, `${this.model.name.toUpperCase()} — ${this.model.desc}`);
        else if (kind === 'engine') G.banner(`MOTOR NV ${this.engine}`, this.eng.flame, 1.6, this.eng.name.toUpperCase());
        else G.banner(`MÍSSEIS NV ${this.missiles}`, '#ff6af0', 1.6, `${MISSILE_LEVELS[this.missiles].count} por salva`);
    }

    update(dt) {
        this.t += dt;
        if (this.dead) { this.updateDeath(dt); return; }
        this.invuln = Math.max(0, this.invuln - dt);
        this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
        this.evolveT = Math.max(0, this.evolveT - dt * 1.5);
        this.rollCd = Math.max(0, this.rollCd - dt);
        this.shieldHit = Math.max(0, this.shieldHit - dt * 3);
        if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
        if (this.repair) this.hp = Math.min(this.maxHp, this.hp + 0.5 * dt);

        // --- movimento com inércia
        this.focus = Input.down('focus');
        const ax = Input.axis();
        const speed = this.maxSpeed * (this.focus ? PLAYER_CFG.focusFactor : 1) * (this.rollT > 0 ? 1.5 : 1);
        const tvx = ax.x * speed, tvy = ax.y * speed;
        const acc = PLAYER_CFG.accel * dt * (0.9 + this.engine * 0.05);
        this.vx += clamp(tvx - this.vx, -acc, acc);
        this.vy += clamp(tvy - this.vy, -acc, acc);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (Input.touch.active || Input.touch.dx || Input.touch.dy) {
            this.x += Input.touch.dx; this.y += Input.touch.dy;
            this.vx = Input.touch.dx / Math.max(dt, 0.001) * 0.3;
        }
        this.x = clamp(this.x, 30, W - 30);
        this.y = clamp(this.y, 70, H - 50);
        this.bank = lerp(this.bank, clamp(this.vx / 300, -1, 1), Math.min(1, dt * 10));

        // --- rolagem evasiva (invencível)
        if (this.rollT > 0) this.rollT -= dt;
        else if (Input.hit('roll') && this.rollCd <= 0) {
            this.rollT = PLAYER_CFG.rollDuration;
            this.rollCd = this.rollCooldown;
            Sound.roll();
        }

        // --- fúria
        if (this.furyT > 0) {
            this.furyT -= dt;
            if (chance(0.5)) FX.spawn({ type: 'ember', x: this.x + rand(-20, 20), y: this.y + rand(0, 30), vx: rand(-30, 30), vy: rand(60, 140), size: rand(3, 6), life: 0.6, drag: 0 });
        }

        // --- bomba
        if (Input.hit('bomb')) G.useBomb();

        // --- armas
        const firing = G.settings.autofire || Input.down('fire') || Input.touch.active;
        this.fireCd -= dt;
        if (firing && this.fireCd <= 0) this.fireCannon();
        if (this.missiles > 0) {
            this.missileCd -= dt;
            if (firing && this.missileCd <= 0) this.fireMissiles();
        }

        // --- efeitos de dano: fumaça, fogo e faíscas conforme a vida
        const hpk = this.hp / this.maxHp;
        if (hpk < 0.6 && chance((0.6 - hpk) * 1.6)) FX.smoke(this.x + rand(-14, 14), this.y + rand(0, 20), rand(5, 9), 0.5 + (0.6 - hpk));
        if (hpk < 0.3 && chance(0.5)) FX.fire(this.x + rand(-16, 16), this.y + rand(-4, 18), rand(5, 9), 0, 120, 0.35);
        if (hpk < 0.3 && chance(0.04)) FX.impact(this.x + rand(-18, 18), this.y + rand(-10, 10), '#ffd27a', 4, rand(0, TAU));
        // modelo T-27: rastro de fumaça verde-amarela (homenagem à Esquadrilha da Fumaça) quando acelera
        if (this.model.prop && this.vy < -60 && chance(0.6)) FX.spawn({ type: 'smoke', x: this.x + rand(-4, 4), y: this.y + this.h * 0.45, vx: 0, vy: 40, size: 4, size1: 14, life: 0.9, alpha: 0.25, drag: 1 });

        // luz do motor
        FX.addLight(this.x, this.y + this.h * 0.45, 70 + this.engine * 10, this.furyT > 0 ? '#ff8c2a' : this.eng.flame, 0.75);
        // detecção pelos holofotes
        this.detected = FX.spots.some((s) => dist2(s.x, s.y, this.x, this.y) < s.r * s.r * 3.4);
    }

    cannonStats() {
        const lvl = CANNON_LEVELS[Math.min(this.cannon, 12)];
        const fury = this.furyT > 0;
        return { rate: lvl.rate * (fury ? 1.6 : 1), dmg: lvl.dmg * this.dmgMult * (fury ? 1.25 : 1), guns: lvl.guns, w: lvl.w + (fury ? 1 : 0), pierce: lvl.pierce || 0 };
    }

    fireCannon() {
        const st = this.cannonStats();
        const fury = this.furyT > 0;
        const color = fury ? FACTION_COLORS.fury : this.cannon >= 9 ? FACTION_COLORS.player2 : FACTION_COLORS.player;
        const focusK = this.focus ? 0.25 : 1;
        for (const [ox, deg] of st.guns) {
            const a = -Math.PI / 2 + deg * DEG * focusK;
            const x = this.x + ox * (this.focus ? 0.6 : 1), y = this.y - this.h * 0.38 + Math.abs(ox) * 0.4;
            const center = Math.abs(ox) <= 7;
            G.pBullets.push(makeBullet({ x, y, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, r: 5 + st.w * 0.5, w: st.w, dmg: st.dmg, kind: 'tracer', color, life: 1.2, pierce: center ? st.pierce : 0, hits: null }));
            FX.muzzle(x, y - 4, color.glow, 8 + st.w);
        }
        this.fireCd += 1 / st.rate;
        if (this.fireCd < 0) this.fireCd = 0;
        Sound.shot();
    }

    fireMissiles() {
        const lvl = MISSILE_LEVELS[this.missiles];
        for (let i = 0; i < lvl.count; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const spread = Math.floor(i / 2);
            const a = -Math.PI / 2 + side * (0.6 + spread * 0.3);
            const dmg = (MISSILE_DMG + MISSILE_DMG_PER_LVL * this.missiles) * this.dmgMult;
            G.pBullets.push(makeBullet({ x: this.x + side * (14 + spread * 8), y: this.y + 4, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 7, dmg, splash: MISSILE_SPLASH * this.dmgMult, kind: 'pmissile', life: 2.6, color: FACTION_COLORS.player }));
        }
        this.missileCd = lvl.every;
        Sound.missile();
    }

    addFury(v) {
        if (this.furyT > 0) return;
        this.fury += v * this.furyGain;
        if (this.fury >= PLAYER_CFG.furyMax) {
            this.fury = 0;
            this.furyT = PLAYER_CFG.furyDuration;
            Sound.fury();
            G.banner('FÚRIA!', '#ff9a3c', 1.2, 'Cadência e dano aumentados');
        }
    }

    giveShield() { this.shield = this.shieldMax; this.shieldT = 14; }

    hurt(dmg, hx, hy) {
        if (this.invulnerable) return false;
        dmg *= G.mod.dmgTaken;
        if (this.shield > 0) {
            this.shield -= dmg;
            this.shieldHit = 1;
            this.invuln = 0.25;
            Sound.shieldHit();
            FX.impact(hx, hy, '#8ff6ff', 8, angleTo(this.x, this.y, hx, hy));
            if (this.shield <= 0) { this.shield = 0; this.shieldT = 0; FX.spawn({ type: 'ring', x: this.x, y: this.y, size: 30, size1: 90, life: 0.4 }); }
            return true;
        }
        this.hp -= dmg;
        this.invuln = PLAYER_CFG.invuln;
        this.hitFlash = 1;
        FX.flashRed = Math.min(1, 0.4 + dmg / 40);
        FX.addTrauma(0.35 + dmg / 80);
        FX.impact(hx, hy, '#ffcf7a', 12, angleTo(this.x, this.y, hx, hy));
        for (let i = 0; i < 5; i++) FX.spawn({ type: 'debris', x: hx, y: hy, vx: rand(-160, 160), vy: rand(-160, 160), size: rand(1.5, 3), life: 0.6, rot: rand(0, TAU), vr: rand(-10, 10), drag: 2 });
        FX.smoke(hx, hy, 10, 0.6);
        FX.text(this.x, this.y - 40, `-${Math.round(dmg)}`, '#ff5b4a', 22);
        Sound.playerHit();
        G.breakCombo();
        if (this.hp <= 0) { this.hp = 0; this.die(); }
        return true;
    }

    die() {
        this.dead = true;
        this.deathT = 0;
        this.spin = rand(-1, 1) > 0 ? 7 : -7;
        FX.explode(this.x, this.y, 1.6);
        G.slowmo(0.3, 1.6);
        Sound.bigExplosion();
    }

    updateDeath(dt) {
        this.deathT += dt;
        this.x += this.vx * 0.3 * dt; this.y += 60 * dt;
        if (chance(0.7)) FX.fire(this.x + rand(-15, 15), this.y + rand(-15, 15), rand(10, 18), 0, 60, 0.5);
        if (chance(0.6)) FX.smoke(this.x, this.y, rand(10, 18), 0.8);
        if (this.deathT > 0.4 && chance(dt * 6)) FX.explode(this.x + rand(-25, 25), this.y + rand(-25, 25), 0.7);
        if (this.deathT > 1.6 && !this.finalBoom) {
            this.finalBoom = true;
            FX.explode(this.x, this.y, 2.4, { ground: true });
            FX.flashWhite = 0.7;
        }
    }

    drawShadow(ctx) {
        if (this.dead && this.finalBoom) return;
        const k = this.dead ? Math.max(0.3, 1 - this.deathT / 1.6) : 1;
        drawSpriteShadow(ctx, this.spr, this.x, this.y, this.w * k, this.h * k, this.dead ? this.deathT * this.spin : 0, 1.1 * k, this.rollScale());
    }

    rollScale() {
        if (this.rollT <= 0) return 1 - Math.abs(this.bank) * 0.16;
        const k = 1 - this.rollT / PLAYER_CFG.rollDuration;
        return Math.cos(k * TAU);
    }

    /** chamas em cada bocal do modelo + propulsores extras do motor */
    drawEngines(ctx, w, h, sx) {
        const m = this.model, e = this.eng;
        const fury = this.furyT > 0;
        const col = fury ? '#ff8c2a' : e.flame;
        const boost = (this.vy < -50 ? 1.35 : this.vy > 50 ? 0.65 : 1) * e.len;
        // propulsores laterais
        if (e.boosters) {
            const pairs = e.boosters / 2;
            for (let i = 0; i < pairs; i++) {
                for (const s of [-1, 1]) {
                    const bx = this.x + s * sx * w * (0.2 + i * 0.13), by = this.y + h * (0.18 + i * 0.06);
                    drawAfterburner(ctx, bx, by + 13, 16 * boost, 5, col);
                    const g = ctx.createLinearGradient(bx - 4, 0, bx + 4, 0);
                    g.addColorStop(0, '#2a3034'); g.addColorStop(0.5, this.engine >= 7 ? '#d9b13b' : '#8f9ca3'); g.addColorStop(1, '#22282b');
                    ctx.fillStyle = g;
                    ctx.fillRect(bx - 3.5, by - 11, 7, 24);
                    ctx.fillStyle = col; ctx.fillRect(bx - 3.5, by + 9, 7, 2);
                }
            }
        }
        for (const n of m.nozzleFrac) {
            const nx = this.x + n.fx * w * sx, ny = this.y + n.fy * h;
            if (n.kind === 'prop') { // escapamento do motor a hélice
                drawAfterburner(ctx, nx, ny + 4, 6 * boost, 3, '#ff9a3a');
                continue;
            }
            const rr = Math.max(4, n.r * w);
            drawAfterburner(ctx, nx, ny + rr * 0.6, (18 + rr * 1.6) * boost, rr * 1.1, col);
        }
    }

    draw(ctx) {
        if (this.dead && this.finalBoom) return;
        const blink = this.invuln > 0 && this.rollT <= 0 && !this.dead && this.evolveT <= 0 && Math.floor(this.t * 20) % 2 === 0;
        const k = this.dead ? Math.max(0.3, 1 - this.deathT / 1.6) : 1;
        const w = this.w * k, h = this.h * k;
        const sx = this.rollScale();
        if (!this.dead) this.drawEngines(ctx, w, h, sx);
        drawSpriteFull(ctx, this.spr, this.x, this.y, w, h, this.dead ? this.deathT * this.spin : this.bank * 0.08, {
            sx, alpha: blink ? 0.35 : 1, burn: (1 - this.hp / this.maxHp) * 0.95, flash: Math.max(this.hitFlash, this.evolveT * 0.8)
        });
        // hélice girando (modelos 1 e 2)
        const m = this.model;
        if (m.propFrac && !this.dead) {
            const px = this.x, py = this.y + m.propFrac.fy * h, R = m.propFrac.r * w;
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(sx, 0.35);
            ctx.globalAlpha = 0.18; ctx.fillStyle = '#d8dde0';
            ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
            ctx.globalAlpha = 0.7; ctx.strokeStyle = '#1a1d1f'; ctx.lineWidth = 3;
            const a = this.t * 45;
            for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a + i * TAU / 4) * R, Math.sin(a + i * TAU / 4) * R); ctx.stroke(); }
            ctx.restore();
        }
        // escudo
        if (this.shield > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const pulse = 0.35 + 0.15 * Math.sin(this.t * 8) + this.shieldHit * 0.5;
            const fade = this.shieldT < 3 && Math.floor(this.t * 8) % 2 ? 0.4 : 1;
            const R = Math.max(46, this.w * 0.62);
            ctx.globalAlpha = pulse * fade;
            ctx.drawImage(getGlow('#5ff0ff'), this.x - R * 1.25, this.y - R * 1.25, R * 2.5, R * 2.5);
            ctx.strokeStyle = `rgba(170,250,255,${0.6 * fade})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU + this.t; ctx.lineTo(this.x + Math.cos(a) * R, this.y + Math.sin(a) * R); }
            ctx.stroke();
            ctx.restore();
        }
        // brilho de evolução
        if (this.evolveT > 0) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.evolveT;
            ctx.drawImage(getGlow('#f6d21e'), this.x - w, this.y - w, w * 2, w * 2);
            ctx.restore();
        }
        // ponto de colisão visível no modo precisão
        if (this.focus && !this.dead) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#ff2d55';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.7, 0, TAU); ctx.fill(); ctx.stroke();
        }
    }
}
