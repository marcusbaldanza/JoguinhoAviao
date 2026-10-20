/* =====================================================================
   INIMIGOS: aviões, helicópteros, drones, bombardeiro, baterias SAM e lanchas.
   Cada tipo tem uma IA de movimento e um padrão de tiro (ver config.js).
   ===================================================================== */
class Enemy {
    constructor(type, x, y, opts = {}) {
        const def = ENEMY_TYPES[type];
        this.type = type; this.def = def;
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.opts = opts;
        this.t = 0;
        // inimigo "veterano": mais resistente, atira mais e mais rápido (chance cresce com a progressão)
        this.veteran = opts.veteran ?? (['ap', 'ip', 'jp', 'ah', 'ih'].includes(type) && chance(G.mod.elite));
        this.maxHp = def.hp * G.mod.hp * (opts.hpMult || 1) * (this.veteran ? 1.9 : 1);
        this.hp = this.maxHp;
        this.spr = def.tint ? getTinted(def.sprite, def.tint) : def.sprite ? SPR[def.sprite] : SPR.drone;
        this.w = def.w * (opts.scale || 1) * (this.veteran ? 1.12 : 1);
        this.h = this.spr ? this.w * (this.spr.h / this.spr.w) : this.w;
        this.r = Math.min(this.w, this.h) * (def.kind === 'heli' ? 0.36 : 0.4);
        this.rot = 0;              // rotação visual (sprite aponta para baixo)
        this.turret = Math.PI / 2; // ângulo da torre (terrestres)
        this.hitFlash = 0;
        this.dying = false; this.dead = false;
        this.fireT = def.fire ? randRange(def.fire.every) * rand(0.4, 0.9) : 0;
        this.burst = 0; this.burstT = 0;
        this.state = 'enter';
        this.alt = def.alt;
        this.scale = 1;
        this.spinRot = 0;
        this.rotorA = rand(0, TAU);
        this.isAir = def.kind !== 'ground';
        if (def.ai === 'diver') {
            const tx = clamp((G.player ? G.player.x : W / 2) + rand(-120, 120), 40, W - 40);
            const a = angleTo(x, y, tx, H + 100);
            this.vx = Math.cos(a) * def.speed; this.vy = Math.sin(a) * def.speed;
        }
        if (def.ai === 'weaver') { this.baseX = x; this.amp = opts.amp ?? rand(60, 130); this.freq = opts.freq ?? rand(1.6, 2.4); this.phase = opts.phase ?? 0; }
        if (def.ai === 'hover' || def.ai === 'ringer') { this.tx = opts.tx ?? clamp(x, 80, W - 80); this.ty = opts.ty ?? rand(120, 300); this.hold = rand(7, 10); }
        if (def.ai === 'bomber') { this.ty = 190; this.hold = 20; this.baseX = x; }
        if (def.ai === 'boat') { this.vx = opts.dir ? opts.dir * def.speed : (x < W / 2 ? 1 : -1) * def.speed; }
    }

    get targetable() { return !this.dying && this.y > -this.h * 0.3; }

    update(dt) {
        this.t += dt;
        this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
        this.rotorA += dt * 40;
        if (this.dying) return this.updateDying(dt);
        const def = this.def, p = G.player;
        switch (def.ai) {
            case 'diver':
                if (this.t < 1.0 && p) this.vx += clamp(p.x - this.x, -1, 1) * 80 * dt;
                this.faceVelocity(dt);
                break;
            case 'weaver':
                this.vy = def.speed * 0.75;
                { const nx = this.baseX + Math.sin(this.t * this.freq + this.phase) * this.amp; this.vx = (nx - this.x) / Math.max(dt, 0.001); }
                this.faceVelocity(dt, 0.6);
                break;
            case 'swooper': {
                const o = this.opts, dur = o.dur || 3.2;
                const k = this.t / dur;
                if (k >= 1) { this.dead = true; return; }
                const u = 1 - k;
                const nx = u * u * o.p0[0] + 2 * u * k * o.p1[0] + k * k * o.p2[0];
                const ny = u * u * o.p0[1] + 2 * u * k * o.p1[1] + k * k * o.p2[1];
                this.vx = (nx - this.x) / Math.max(dt, 0.001); this.vy = (ny - this.y) / Math.max(dt, 0.001);
                this.x = nx; this.y = ny;
                this.faceVelocity(dt, 1);
                this.tryFire(dt);
                return;
            }
            case 'hover':
            case 'ringer':
                if (this.state === 'enter') {
                    this.x = lerp(this.x, this.tx, Math.min(1, dt * 1.2));
                    this.y = lerp(this.y, this.ty, Math.min(1, dt * 1.4));
                    if (Math.abs(this.y - this.ty) < 6) this.state = 'hold';
                } else if (this.state === 'hold') {
                    this.hold -= dt;
                    if (p) this.x += clamp(p.x - this.x, -1, 1) * (def.ai === 'hover' ? 45 : 20) * dt;
                    this.y += Math.sin(this.t * 2) * 12 * dt;
                    if (this.hold <= 0) this.state = 'exit';
                } else {
                    this.vy = Math.min(this.vy + 220 * dt, 260);
                    this.y += this.vy * dt;
                }
                if (p) { const want = angleTo(this.x, this.y, p.x, p.y) - Math.PI / 2; this.rot += clamp(angleDiff(this.rot, want), -2 * dt, 2 * dt); }
                this.vx = 0;
                this.tryFire(dt);
                this.emitDamageFx();
                if (this.y > H + this.h) { this.dead = true; G.onEnemyEscaped(this); }
                return;
            case 'kamikaze': {
                const spd = Math.min(def.speed * 1.8, def.speed + this.t * 90);
                let a = Math.atan2(this.vy || 1, this.vx);
                if (p && !p.dead && this.t < 3.5) a += clamp(angleDiff(a, angleTo(this.x, this.y, p.x, p.y)), -2.4 * dt, 2.4 * dt);
                this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
                this.rot = a - Math.PI / 2;
                FX.addLight(this.x, this.y, 40, '#ff2a2a', Math.sin(this.t * 14) > 0 ? 0.9 : 0.2);
                break;
            }
            case 'bomber':
                if (this.state === 'enter') { this.vy = (this.ty - this.y) * 0.8 + 10; if (this.y > this.ty - 5) this.state = 'hold'; }
                else if (this.state === 'hold') {
                    this.hold -= dt; this.vy = 0;
                    this.vx = Math.cos(this.t * 0.6) * 60;
                    if (this.hold <= 0) this.state = 'exit';
                } else { this.vy = Math.max(-def.speed * 2, this.vy - 60 * dt); }
                this.rot = this.vx * 0.0012;
                for (const s of [-0.3, 0.3]) FX.addLight(this.x + s * this.w, this.y - this.h * 0.35, 70, '#5fb8ff', 0.5);
                break;
            case 'ground':
                this.vy = G.scrollSpeed; this.vx = 0;
                if (p) this.turret += clamp(angleDiff(this.turret, angleTo(this.x, this.y, p.x, p.y)), -1.6 * dt, 1.6 * dt);
                break;
            case 'boat':
                this.vy = G.scrollSpeed * 0.75;
                if (this.x < 50 && this.vx < 0 || this.x > W - 50 && this.vx > 0) this.vx *= -1;
                this.rot += clamp(angleDiff(this.rot, Math.atan2(this.vy, this.vx) - Math.PI / 2), -1.2 * dt, 1.2 * dt);
                if (p) this.turret += clamp(angleDiff(this.turret, angleTo(this.x, this.y, p.x, p.y)), -2 * dt, 2 * dt);
                if (chance(0.7)) FX.spawn({ type: 'water', x: this.x - Math.cos(this.rot + Math.PI / 2) * 40 + rand(-6, 6), y: this.y - Math.sin(this.rot + Math.PI / 2) * 40, vx: rand(-20, 20), vy: rand(-10, 10), size: 3, size1: 10, life: 1.2, ground: true, drag: 1 });
                break;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y > -10) this.tryFire(dt);
        this.emitDamageFx();
        // saiu da tela
        if (this.y > H + this.h || this.y < -this.h * 2 - 200 || this.x < -200 || this.x > W + 200) {
            this.dead = true;
            if (this.isAir && this.y > H) G.onEnemyEscaped(this);
        }
    }

    faceVelocity(dt, k = 1) {
        const want = Math.atan2(this.vy, this.vx) - Math.PI / 2;
        this.rot += clamp(angleDiff(this.rot, want), -4 * dt, 4 * dt) * k;
    }

    emitDamageFx() {
        const k = this.hp / this.maxHp;
        if (k < 0.55 && chance((0.55 - k) * 0.5)) FX.smoke(this.x + rand(-this.w * 0.2, this.w * 0.2), this.y + rand(-this.h * 0.2, this.h * 0.2), this.w * 0.12, 0.55);
        if (k < 0.3 && chance(0.25)) FX.fire(this.x + rand(-this.w * 0.2, this.w * 0.2), this.y + rand(-this.h * 0.2, this.h * 0.2), this.w * 0.12, 0, -40, 0.35);
    }

    tryFire(dt) {
        const f = this.def.fire;
        if (!f || !G.player || G.player.dead) return;
        if (this.burst > 0) {
            this.burstT -= dt;
            if (this.burstT <= 0) {
                this.burst--; this.burstT = 0.09;
                this.shootOne(aimAngle(this.x, this.y + this.h * 0.4), f.speed, 'needle');
            }
        }
        if (this.y < 10 || this.y > H * 0.8) return;
        this.fireT -= dt * G.mod.fireRate * (this.veteran ? 1.35 : 1);
        if (this.fireT > 0) return;
        this.fireT = randRange(f.every);
        const mx = this.x, my = this.y + this.h * 0.35;
        const col = FACTION_COLORS[this.def.faction];
        const dmg = this.def.dmg;
        const extra = G.mod.extraShots + (this.veteran ? 1 : 0);
        switch (f.type) {
            case 'aimedBurst':
                this.burst = f.count + extra; this.burstT = 0;
                break;
            case 'spread': {
                const base = aimAngle(mx, my), n = f.count + extra, arc = f.arc + extra * 10;
                for (let i = 0; i < n; i++) {
                    const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc * DEG);
                    enemyShoot(mx, my, a, f.speed, { color: col, dmg, r: 6 });
                }
                FX.muzzle(mx, my, col.glow, 14);
                Sound.enemyShot();
                break;
            }
            case 'rockets':
                for (const s of [-1, 1]) for (let k = 0; k <= Math.min(2, Math.floor(extra / 2)); k++) {
                    const a = Math.PI / 2 + s * (0.35 + k * 0.3);
                    enemyShoot(this.x + s * this.w * 0.25, my, a, f.speed, { kind: 'rocket', color: col, dmg: dmg * 1.3, r: 6, life: 5 });
                }
                // e uma rajada curta de metralhadora
                this.burst = 3 + extra; this.burstT = 0.3;
                Sound.missile();
                break;
            case 'ring': {
                const off = rand(0, TAU), n = f.count + extra * 2;
                for (let i = 0; i < n; i++) enemyShoot(mx, this.y, off + (i / n) * TAU, f.speed, { color: col, dmg, r: 6 });
                FX.muzzle(mx, this.y, col.glow, 30);
                Sound.enemyShot();
                break;
            }
            case 'bomber': {
                for (const s of [-0.32, 0.32]) {
                    const tx = this.x + s * this.w, ty = this.y;
                    const nk = 1 + Math.min(3, Math.floor(extra / 2));
                    for (let k = -nk; k <= nk; k++) enemyShoot(tx, ty, aimAngle(tx, ty) + k * 0.12, f.speed, { kind: 'needle', color: col, dmg, r: 5 });
                    FX.muzzle(tx, ty, col.glow, 14);
                }
                if (chance(0.5)) for (let i = 0; i < 7; i++) enemyShoot(this.x, this.y + this.h * 0.4, Math.PI / 2 + (i / 6 - 0.5) * 1.4, f.speed * 0.7, { color: FACTION_COLORS.boss2, dmg, r: 7 });
                Sound.enemyShot();
                break;
            }
            case 'flak': {
                const p = G.player;
                const tx = p.x + rand(-40, 40), ty = p.y + rand(-60, 20);
                const a = angleTo(mx, this.y, tx, ty);
                const sp = f.speed * (p.detected ? 1.3 : 1);
                const fuse = Math.hypot(tx - mx, ty - this.y) / (sp * G.mod.bulletSpeed);
                enemyShoot(mx, this.y, a, sp, { kind: 'flak', fuse, baseDmg: dmg, dmg: dmg, r: 6, color: FACTION_COLORS.boss2, frags: (p.detected ? 10 : 7) + extra });
                if (p.detected) this.fireT *= 0.5;
                FX.muzzle(mx + Math.cos(this.turret) * 30, this.y + Math.sin(this.turret) * 30, '#ffb020', 20);
                FX.smoke(mx + Math.cos(this.turret) * 34, this.y + Math.sin(this.turret) * 34, 8, 0.5, true);
                Sound.explosion(0.25);
                break;
            }
        }
    }

    shootOne(a, speed, kind = 'orb') {
        const col = FACTION_COLORS[this.def.faction];
        const mx = this.def.kind === 'ground' ? this.x + Math.cos(this.turret) * 26 : this.x;
        const my = this.def.kind === 'ground' ? this.y + Math.sin(this.turret) * 26 : this.y + this.h * 0.4;
        enemyShoot(mx, my, a, speed, { kind, color: col, dmg: this.def.dmg, r: 5 });
        FX.muzzle(mx, my, col.glow, 12);
        Sound.enemyShot();
    }

    takeDamage(dmg, hx, hy) {
        if (this.dying) return false;
        this.hp -= dmg;
        this.hitFlash = 1;
        if (chance(0.5)) FX.impact(hx, hy, '#ffe08a', 3, Math.PI / 2 + rand(-0.5, 0.5));
        Sound.hit();
        if (this.hp <= 0) { this.kill(); return true; }
        return false;
    }

    kill() {
        this.dying = true;
        this.dyingT = 0;
        G.onEnemyKilled(this);
        const k = this.def.kind;
        if (k === 'drone') { FX.explode(this.x, this.y, 0.7); this.dead = true; return; }
        if (k === 'ground') { FX.explode(this.x, this.y, 1.1, { ground: true }); FX.decal(this.x, this.y, 1.0); this.dead = true; return; }
        if (this.def.elite) { this.dyingDur = 1.6; this.spin = rand(-1.2, 1.2); }
        else if (k === 'heli') { this.dyingDur = 1.1; this.spin = rand(0, 1) > 0.5 ? 9 : -9; FX.explode(this.x, this.y, 0.6, { debris: true }); }
        else if (chance(0.55)) { this.dyingDur = rand(0.8, 1.1); this.spin = rand(-5, 5); FX.explode(this.x, this.y, 0.55); }
        else { FX.explode(this.x, this.y, 1.0); this.dead = true; }
    }

    /** queda em parafuso até o solo, com rastro de fogo, terminando em cratera */
    updateDying(dt) {
        this.dyingT += dt;
        const k = this.dyingT / this.dyingDur;
        this.spinRot += this.spin * dt;
        this.vx *= 1 - 0.8 * dt; this.vy = this.vy * (1 - 0.8 * dt) + G.scrollSpeed * 0.6 * dt;
        this.x += this.vx * dt; this.y += this.vy * dt + G.scrollSpeed * 0.4 * dt;
        this.scale = 1 - 0.45 * k;
        this.alt = this.def.alt * (1 - k);
        if (chance(0.7)) FX.fire(this.x + rand(-6, 6), this.y + rand(-6, 6), this.w * 0.18, 0, 0, 0.45);
        if (chance(0.5)) FX.smoke(this.x, this.y, this.w * 0.14, 0.75);
        if (this.def.elite && chance(dt * 10)) FX.explode(this.x + rand(-this.w * 0.35, this.w * 0.35), this.y + rand(-this.h * 0.3, this.h * 0.3), 0.8);
        if (k >= 1) {
            this.dead = true;
            FX.explode(this.x, this.y, this.def.elite ? 2.0 : 0.9, { ground: true });
        }
    }

    drawShadow(ctx) {
        if (!this.isAir) return;
        drawSpriteShadow(ctx, this.spr, this.x, this.y, this.w * this.scale, this.h * this.scale, this.rot + this.spinRot, this.alt);
    }

    draw(ctx) {
        const def = this.def;
        if (def.kind === 'ground') return this.drawGround(ctx);
        const burn = (1 - this.hp / this.maxHp) * 0.9 + (this.dying ? 0.4 : 0);
        if (def.kind === 'plane' && !this.dying) {
            // motor
            const ex = this.x - Math.sin(-this.rot) * 0, ey = this.y;
            const back = this.rot + Math.PI / 2 + Math.PI; // direção da cauda
            drawAfterburner(ctx, ex + Math.cos(back) * this.h * 0.45, ey + Math.sin(back) * this.h * 0.45, this.w * 0.35, this.w * 0.12, def.faction === 'jp' ? '#ff8ad8' : '#ff9a4a', back);
        }
        if (this.veteran && !this.dying) { // aura vermelha pulsante dos veteranos
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.t * 7);
            const R = this.w * 0.8;
            ctx.drawImage(getGlow('#ff2a2a'), this.x - R, this.y - R, R * 2, R * 2);
            ctx.restore();
        }
        drawSpriteFull(ctx, this.spr, this.x, this.y, this.w * this.scale, this.h * this.scale, this.rot + this.spinRot, { burn, flash: this.hitFlash });
        if (this.veteran && !this.dying) { // insígnia de veterano
            ctx.fillStyle = '#ffcc00';
            for (let i = 0; i < 2; i++) { const yy = this.y - this.h * 0.55 - 14 - i * 5; ctx.beginPath(); ctx.moveTo(this.x - 7, yy); ctx.lineTo(this.x, yy + 4); ctx.lineTo(this.x + 7, yy); ctx.lineTo(this.x + 7, yy + 2.5); ctx.lineTo(this.x, yy + 6.5); ctx.lineTo(this.x - 7, yy + 2.5); ctx.fill(); }
        }
        if (def.kind === 'heli') {
            // rotor girando (borrão + pás)
            ctx.save();
            ctx.translate(this.x, this.y - this.h * 0.03);
            ctx.rotate(this.rot + this.spinRot);
            const R = this.w * 0.55 * this.scale;
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = '#20241f';
            ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = '#1b1d1a';
            ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) {
                const a = this.rotorA + (i * TAU) / 4;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
            }
            ctx.restore();
        }
        if (def.kind === 'drone') {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.sin(this.t * 14) > 0 ? 1 : 0.2;
            ctx.drawImage(getGlow('#ff2a2a'), this.x - 10, this.y - 10, 20, 20);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        if (this.hp < this.maxHp && !this.dying && (def.elite || this.veteran || this.maxHp > 80)) {
            const bw = this.w * 0.7, x = this.x - bw / 2, y = this.y - this.h * 0.55 - 8;
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 1, y - 1, bw + 2, 5);
            ctx.fillStyle = this.hp / this.maxHp > 0.4 ? '#7dff6a' : '#ff6a3a';
            ctx.fillRect(x, y, bw * (this.hp / this.maxHp), 3);
        }
    }

    drawGround(ctx) {
        const base = this.type === 'gb' ? TEX.boat : TEX.samBase;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.type === 'gb') {
            ctx.save(); ctx.rotate(this.rot);
            ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.ellipse(6, 8, 26, 52, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.drawImage(base, -35, -60, 70, 120);
            ctx.restore();
        } else {
            ctx.drawImage(base, -40, -40, 80, 80);
        }
        if (this.hitFlash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = this.hitFlash * 0.6;
            ctx.drawImage(getGlow('#ffffff'), -30, -30, 60, 60);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.rotate(this.turret - Math.PI / 2);
        ctx.drawImage(TEX.samTurret, -28, -28, 56, 56);
        ctx.restore();
        const k = this.hp / this.maxHp;
        if (k < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(this.x - 25, this.y + 38, 50, 5);
            ctx.fillStyle = k > 0.4 ? '#7dff6a' : '#ff6a3a'; ctx.fillRect(this.x - 24, this.y + 39, 48 * k, 3);
        }
    }
}

function spawnEnemy(type, x, y, opts) {
    const e = new Enemy(type, x, y, opts);
    G.enemies.push(e);
    return e;
}
