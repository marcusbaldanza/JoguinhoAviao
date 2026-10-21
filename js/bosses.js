/* =====================================================================
   CHEFES: 5 chefes com fases de vida, padrões de ataque combináveis,
   partes destrutíveis (torres), modo fúria e sequência de morte cinematográfica.
   ===================================================================== */
const PATTERN_DUR = {
    aimedFan: 3, sideTurrets: 3, ring: 3.2, spiral: 4, spiralDouble: 4.5, missiles: 2.6, minigun: 3, minigunDouble: 3.4,
    rocketBarrage: 2.6, drones: 1.8, fanWide: 3.2, laserSweep: 3.6, laserTwin: 3.4, dashRun: 3.2, mines: 2.2, partsFire: 3.5,
    droneSwarm: 2.4, droneRing: 2.4, broadside: 3.2, flakBarrage: 2.6, mineCarpet: 2.6, carpetBomb: 3.4, cloak: 2.8, launchJets: 2.8
};

const PATTERNS = {
    aimedFan(b, p) {
        if (p.every(b.rate(0.55))) {
            const [x, y] = b.at(0, 0.42), base = aimAngle(x, y), n = b.rage ? 9 : 7;
            for (let i = 0; i < n; i++) enemyShoot(x, y, base + (i / (n - 1) - 0.5) * 0.9, 260 * b.spd(), { color: FACTION_COLORS.boss, dmg: 12, r: 7 });
            FX.muzzle(x, y, '#b45cff', 30); Sound.enemyShot();
        }
    },
    sideTurrets(b, p) {
        if (p.every(b.rate(0.16))) {
            p.side = -(p.side || 1);
            const [x, y] = b.at(0.36 * p.side, 0.1);
            enemyShoot(x, y, aimAngle(x, y, rand(-0.05, 0.05)), 340 * b.spd(), { kind: 'needle', color: FACTION_COLORS.us, dmg: 10, r: 5 });
            FX.muzzle(x, y, '#ff3b2f', 14); Sound.enemyShot();
        }
    },
    ring(b, p) {
        if (p.every(b.rate(0.7))) {
            const [x, y] = b.at(0, 0.1), n = b.rage ? 26 : 20;
            p.off = (p.off || 0) + 0.5 / n * TAU;
            for (let i = 0; i < n; i++) enemyShoot(x, y, p.off + (i / n) * TAU, 160 * b.spd(), { color: FACTION_COLORS.boss2, dmg: 11, r: 7 });
            FX.muzzle(x, y, '#ffb020', 50); Sound.enemyShot();
        }
    },
    spiral(b, p) {
        p.a = (p.a || 0) + 2.3 * p.dt;
        if (p.every(b.rate(0.075))) {
            const [x, y] = b.at(0, 0.15);
            for (let k = 0; k < 3; k++) enemyShoot(x, y, p.a + (k / 3) * TAU, 190 * b.spd(), { color: FACTION_COLORS.boss, dmg: 10, r: 6 });
            Sound.enemyShot();
        }
    },
    spiralDouble(b, p) {
        p.a = (p.a || 0) + 1.9 * p.dt;
        if (p.every(b.rate(0.09))) {
            const [x, y] = b.at(0, 0.15);
            for (let k = 0; k < 3; k++) {
                enemyShoot(x, y, p.a + (k / 3) * TAU, 180 * b.spd(), { color: FACTION_COLORS.boss, dmg: 10, r: 6 });
                enemyShoot(x, y, -p.a + (k / 3) * TAU + 0.5, 150 * b.spd(), { color: FACTION_COLORS.boss2, dmg: 10, r: 6 });
            }
            Sound.enemyShot();
        }
    },
    missiles(b, p) {
        if (p.every(1.2)) {
            for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
                const [x, y] = b.at(0.3 * s, 0.05);
                enemyShoot(x, y, Math.PI / 2 + s * (0.6 + k * 0.4), 170 * b.spd(), { kind: 'rocket', color: FACTION_COLORS.us, dmg: 16, r: 7, life: 6 });
            }
            Sound.missile();
        }
    },
    minigun(b, p) {
        if (p.every(b.rate(0.05))) {
            const [x, y] = b.at(0, 0.45);
            const a = Math.PI / 2 + Math.sin(p.t * 2.4) * 0.9;
            enemyShoot(x, y, a, 330 * b.spd(), { kind: 'needle', color: FACTION_COLORS.us, dmg: 9, r: 5 });
            FX.muzzle(x, y, '#ffb020', 16); Sound.enemyShot();
        }
    },
    minigunDouble(b, p) {
        if (p.every(b.rate(0.06))) {
            for (const s of [-1, 1]) {
                const [x, y] = b.at(0.2 * s, 0.4);
                const a = Math.PI / 2 + s * Math.sin(p.t * 2.2) * 0.85;
                enemyShoot(x, y, a, 320 * b.spd(), { kind: 'needle', color: FACTION_COLORS.us, dmg: 9, r: 5 });
                FX.muzzle(x, y, '#ffb020', 14);
            }
            Sound.enemyShot();
        }
    },
    rocketBarrage(b, p) {
        if (p.t < 1.6 && p.every(0.2)) {
            p.side = -(p.side || 1);
            const [x, y] = b.at(0.32 * p.side, 0);
            enemyShoot(x, y, Math.PI / 2 + p.side * rand(0.3, 1.1), 150 * b.spd(), { kind: 'rocket', color: FACTION_COLORS.us, dmg: 15, r: 7, life: 6 });
            Sound.missile();
        }
    },
    drones(b, p) {
        if (!p.done) {
            p.done = true;
            const n = b.rage ? 6 : 4;
            for (let i = 0; i < n; i++) {
                const s = i % 2 ? 1 : -1, [x, y] = b.at(0.4 * s, 0);
                const d = spawnEnemy('dr', x, y, { hpMult: 1 });
                d.vx = s * rand(120, 220); d.vy = rand(-40, 60);
            }
            G.radio('ALA', 'Ele lançou drones!');
        }
    },
    fanWide(b, p) {
        if (p.every(b.rate(0.6))) {
            p.flip = !p.flip;
            const [x, y] = b.at(0, 0.4), n = 13;
            for (let i = 0; i < n; i++) {
                const a = Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4;
                enemyShoot(x, y, a, 210 * b.spd(), { kind: 'curve', curve: p.flip ? 0.5 : -0.5, color: FACTION_COLORS.jp, dmg: 11, r: 6 });
            }
            FX.muzzle(x, y, '#ff4fd8', 30); Sound.enemyShot();
        }
    },
    laserSweep(b, p) {
        if (!p.done) {
            p.done = true;
            const [x, y] = b.at(0, 0.45);
            const dir = G.player.x < b.x ? 1 : -1;
            makeBeam({ x, y, angle: Math.PI / 2 - dir * 0.85, spin: dir * 0.75, warn: 0.9, dur: 2.3, width: 34, dmg: 22, color: '#ff3df2',
                follow: (beam) => { const [bx, by] = b.at(0, 0.45); beam.x = bx; beam.y = by; if (b.state !== 'fight') beam.dead = true; } });
        }
        b.hold = true; // fica parado enquanto mira
    },
    laserTwin(b, p) {
        if (!p.done) {
            p.done = true;
            for (const s of [-1, 1]) makeBeam({ angle: Math.PI / 2, warn: 1.0, dur: 2.0, width: 26, dmg: 20, color: '#ff3355',
                follow: (beam) => { const [bx, by] = b.at(0.3 * s, 0.2); beam.x = bx; beam.y = by; if (b.state !== 'fight') beam.dead = true; } });
        }
        b.trackPlayer = 55;
        if (p.t > 1.0 && p.every(b.rate(0.5))) { const [x, y] = b.at(0, 0.4); for (let i = -2; i <= 2; i++) enemyShoot(x, y, aimAngle(x, y, i * 0.2), 200 * b.spd(), { color: FACTION_COLORS.boss, dmg: 10, r: 6 }); }
    },
    dashRun(b, p) {
        // vai para um lado, depois atravessa a tela soltando projéteis
        if (!p.side) { p.side = b.x < W / 2 ? -1 : 1; p.from = b.x; }
        b.override = true;
        if (p.t < 0.8) {
            b.x = lerp(b.x, p.side > 0 ? W - b.w * 0.45 : b.w * 0.45, Math.min(1, p.dt * 5));
            b.y = lerp(b.y, 260, Math.min(1, p.dt * 3));
        } else if (p.t < 2.4) {
            b.x -= p.side * 520 * p.dt;
            b.x = clamp(b.x, b.w * 0.45, W - b.w * 0.45);
            if (p.every(b.rate(0.07))) {
                const [x, y] = b.at(0, 0.3);
                enemyShoot(x, y, Math.PI / 2 + rand(-0.15, 0.15), 240 * b.spd(), { kind: 'needle', color: FACTION_COLORS.jp, dmg: 11, r: 5 });
            }
            FX.addTrauma(0.02);
            if (chance(0.5)) FX.spawn({ type: 'smoke', x: b.x + p.side * b.w * 0.3, y: b.y, size: 14, size1: 40, life: 0.8, alpha: 0.35, drag: 1 });
        } else {
            b.y = lerp(b.y, 215, Math.min(1, p.dt * 2));
        }
    },
    mines(b, p) {
        if (p.every(0.35) && (p.count = (p.count || 0) + 1) <= 5) {
            const [x, y] = b.at(rand(-0.3, 0.3), 0.3);
            enemyShoot(x, y, Math.PI / 2 + rand(-0.6, 0.6), 160, { kind: 'mine', color: FACTION_COLORS.boss2, r: 11, hp: 30, baseDmg: 12, dmg: 18, life: 8 });
        }
    },
    // ---- padrões dos chefes novos ----
    droneSwarm(b, p) { // nave-mãe solta drones pelas baias
        if (p.every(b.rage ? 0.35 : 0.5) && G.enemies.filter((e) => e.type === 'dr').length < 14) {
            const bays = [[-0.12, -0.07], [0.12, -0.07], [-0.12, 0.07], [0.12, 0.07]];
            const [bx, by] = pick(bays), [x, y] = b.at(bx, by);
            const d = spawnEnemy('dr', x, y, { veteran: false });
            d.vx = rand(-160, 160); d.vy = rand(80, 160);
            FX.muzzle(x, y, '#ff3b2f', 16);
        }
    },
    droneRing(b, p) { // anel de tiros + drones nas pontas dos braços
        PATTERNS.ring(b, p);
        if (!p.done) {
            p.done = true;
            for (const [ox, oy] of [[-0.38, 0.38], [0.38, 0.38]]) { const [x, y] = b.at(ox, oy); const d = spawnEnemy('dr', x, y); d.vx = ox * 400; d.vy = 120; }
        }
    },
    broadside(b, p) { // canhoneira: rajadas dos canhões laterais com antecipação
        if (p.every(b.rate(0.12))) {
            p.k = ((p.k || 0) + 1) % 3;
            const [x, y] = b.at(-0.13, -0.12 + p.k * 0.11);
            const pl = G.player, lead = 0.35;
            const a = angleTo(x, y, pl.x + pl.vx * lead, pl.y + pl.vy * lead) + rand(-0.06, 0.06);
            enemyShoot(x, y, a, 330 * b.spd(), { kind: 'needle', color: FACTION_COLORS.boss2, dmg: 10, r: 5 });
            FX.muzzle(x, y, '#ffb020', 16); Sound.enemyShot();
        }
    },
    flakBarrage(b, p) {
        if (p.every(b.rate(0.45))) {
            const [x, y] = b.at(rand(-0.3, 0.3), 0.2), pl = G.player;
            const tx = pl.x + rand(-90, 90), ty = pl.y + rand(-120, 40);
            const sp = 260 * b.spd();
            enemyShoot(x, y, angleTo(x, y, tx, ty), sp, { kind: 'flak', fuse: Math.hypot(tx - x, ty - y) / (sp * G.mod.bulletSpeed), baseDmg: 12, dmg: 12, r: 6, color: FACTION_COLORS.boss2, frags: b.rage ? 10 : 8 });
            Sound.explosion(0.25);
        }
    },
    mineCarpet(b, p) { // fileira de minas magnéticas sobre o rio
        if (p.every(1.1)) {
            const n = b.rage ? 7 : 5;
            for (let i = 0; i < n; i++) {
                const x = W * (0.1 + 0.8 * (i / (n - 1))) + rand(-20, 20);
                enemyShoot(b.x, b.y + b.h * 0.3, angleTo(b.x, b.y + b.h * 0.3, x, b.y + 260), 220, { kind: 'mine', color: FACTION_COLORS.boss2, r: 11, hp: 26, baseDmg: 12, dmg: 18, life: 8 });
            }
            Sound.missile();
        }
    },
    carpetBomb(b, p) { // bombardeio em tapete: faixas de bombas pesadas caindo
        b.override = true;
        if (!p.dir) p.dir = b.x < W / 2 ? 1 : -1;
        b.x += p.dir * 200 * p.dt;
        if (b.x > W - b.w * 0.45 || b.x < b.w * 0.45) p.dir *= -1;
        if (p.every(b.rate(0.16))) {
            for (const ox of [-0.25, 0, 0.25]) {
                const [x, y] = b.at(ox, 0.1);
                enemyShoot(x, y, Math.PI / 2 + rand(-0.04, 0.04), 170 * b.spd(), { kind: 'accel', acc: 160, maxSpeed: 380, color: FACTION_COLORS.boss2, dmg: 14, r: 8 });
            }
        }
    },
    cloak(b, p) { // fica quase invisível e reaparece em outro lugar
        if (!p.tx) { p.tx = rand(b.w * 0.5, W - b.w * 0.5); Sound.laserCharge(); }
        b.cloaked = p.t < p.dur - 0.4;
        b.override = true;
        b.x = lerp(b.x, p.tx, Math.min(1, p.dt * 1.5));
        if (p.t > 1.2 && p.every(b.rate(0.6))) { const [x, y] = b.at(0, 0.3); for (let i = -2; i <= 2; i++) enemyShoot(x, y, aimAngle(x, y, i * 0.15), 230, { color: FACTION_COLORS.boss, dmg: 11, r: 6 }); }
    },
    launchJets(b, p) { // porta-aviões: catapulta caças enquanto as baterias estiverem de pé
        if (!b.armored) { PATTERNS.spiral(b, p); return; }
        if (p.every(b.rage ? 0.7 : 1.0)) {
            for (const ox of [-0.1, 0.12]) {
                const [x, y] = b.at(ox, 0.4);
                spawnEnemy('ap', x, y + 10);
                FX.spawn({ type: 'smoke', x, y: y - 20, size: 10, size1: 30, life: 0.8, alpha: 0.4 });
            }
            Sound.missile();
        }
    },
    partsFire(b, p) {
        const alive = b.parts.filter((pt) => pt.alive);
        if (!alive.length) return PATTERNS.ring(b, p);
        if (p.every(b.rate(0.38))) {
            for (const pt of alive) {
                const [x, y] = b.at(pt.ox, pt.oy);
                for (let i = -1; i <= 1; i++) enemyShoot(x, y, aimAngle(x, y, i * 0.16), 270 * b.spd(), { kind: 'needle', color: FACTION_COLORS.boss2, dmg: 11, r: 5 });
                FX.muzzle(x, y, '#ffb020', 18);
            }
            Sound.enemyShot();
        }
    }
};

class Boss {
    constructor(key) {
        const def = BOSSES[key];
        this.key = key; this.def = def;
        this.x = W / 2; this.y = -def.w * 0.6;
        this.w = def.w;
        this.spr = def.tint ? getTinted(def.sprite, def.tint) : SPR[def.sprite];
        this.h = this.spr ? this.w * (this.spr.h / this.spr.w) : this.w;
        this.maxHp = def.hp * G.mod.hp; this.hp = this.maxHp;
        this.r = def.r;
        this.state = 'enter';
        this.t = 0; this.phase = 0; this.hitFlash = 0;
        this.queue = []; this.pattern = null; this.pauseT = 1.0;
        this.parts = (def.parts || []).map((pt) => ({ ...pt, maxHp: pt.hp * G.mod.hp, hp: pt.hp * G.mod.hp, alive: true, flash: 0, turret: Math.PI / 2 }));
        this.rotorA = 0;
        this.rot = 0;
        this.cloaked = false; this.cloakA = 1;
        this.restY = def.sea ? 270 : 215;
        this.scale = 1;
        this.alt = def.alt;
    }

    get targetable() { return this.state === 'fight'; }
    get rage() { return !!this.def.phases[this.phase].rage; }
    rate(v) { return v * (this.rage ? 0.75 : 1) / Math.min(1.9, G.mod.fireRate); }
    spd() { return this.rage ? 1.12 : 1; }
    at(ox, oy) { return [this.x + ox * this.w, this.y + oy * this.h]; }
    get armored() { return this.parts.some((p) => p.alive); }

    update(dt) {
        this.t += dt;
        this.hitFlash = Math.max(0, this.hitFlash - dt * 8);
        this.rotorA += dt * 30;
        for (const pt of this.parts) pt.flash = Math.max(0, pt.flash - dt * 8);
        this.cloakA = lerp(this.cloakA, this.cloaked ? 0.12 : 1, Math.min(1, dt * 6));
        if (this.def.sea && chance(0.8)) FX.spawn({ type: 'water', x: this.x + rand(-this.w * 0.35, this.w * 0.35), y: this.y + this.h * 0.45 + rand(-10, 10), vx: rand(-40, 40), vy: rand(0, 40), size: 4, size1: 16, life: 1.0, ground: true, drag: 1 });
        if (this.state === 'enter') {
            this.y = lerp(this.y, this.restY, Math.min(1, dt * 1.1));
            if (this.y > this.restY - 10) { this.state = 'fight'; G.radio(this.def.pilot, this.def.intro); }
            this.ambientFx(dt);
            return;
        }
        if (this.state === 'dying') return this.updateDying(dt);

        // fase atual conforme a vida
        const frac = this.hp / this.maxHp;
        while (this.phase + 1 < this.def.phases.length && frac <= this.def.phases[this.phase + 1].at) {
            this.phase++;
            this.onPhaseChange();
        }

        // padrão de ataque
        this.hold = false; this.override = false; this.trackPlayer = 0; this.cloaked = false;
        if (this.pattern) {
            const p = this.pattern;
            p.t += dt; p.dt = dt;
            PATTERNS[p.name](this, p, dt);
            if (p.t >= p.dur) { this.pattern = null; this.pauseT = this.rage ? 0.35 : rand(0.6, 1.0); }
        } else {
            this.pauseT -= dt;
            if (this.pauseT <= 0) this.nextPattern();
        }

        // movimento
        if (!this.override) {
            const m = this.def.move;
            let tx = this.x, ty = 215;
            if (this.trackPlayer) tx = this.x + clamp(G.player.x - this.x, -1, 1) * this.trackPlayer * dt * 20;
            else if (m === 'sway' || m === 'dash') { tx = W / 2 + Math.sin(this.t * 0.45) * W * 0.27; ty = 215 + Math.sin(this.t * 0.9) * 22; }
            else if (m === 'strafe') { tx = clamp(G.player.x, 140, W - 140); ty = 225 + Math.sin(this.t * 1.3) * 30; }
            else if (m === 'orbit') { tx = W / 2 + Math.cos(this.t * 0.6) * W * 0.27; ty = 240 + Math.sin(this.t * 0.6) * 95; }
            else if (m === 'fixed') { tx = W / 2 + Math.sin(this.t * 0.25) * 40; ty = this.restY; }
            if (!this.hold) {
                const sp = this.def.speed * (this.rage ? 1.3 : 1) * dt;
                const ox = this.x;
                this.x += clamp(tx - this.x, -sp, sp);
                this.y += clamp(ty - this.y, -sp, sp);
                if (m === 'orbit') this.rot = lerp(this.rot, clamp((this.x - ox) / Math.max(dt, 0.001) * 0.004, -0.5, 0.5), Math.min(1, dt * 3));
            }
        }
        this.x = clamp(this.x, this.w * 0.45, W - this.w * 0.45);
        for (const pt of this.parts) if (pt.alive) {
            const [px, py] = this.at(pt.ox, pt.oy);
            pt.turret += clamp(angleDiff(pt.turret, angleTo(px, py, G.player.x, G.player.y)), -2 * dt, 2 * dt);
        }
        this.ambientFx(dt);
    }

    nextPattern() {
        if (!this.queue.length) {
            this.queue = [...this.def.phases[this.phase].patterns].sort(() => Math.random() - 0.5);
        }
        const name = this.queue.shift();
        this.pattern = { name, t: 0, dur: PATTERN_DUR[name] || 3, dt: 0, _acc: {},
            every(interval) { // dispara a cada "interval" segundos dentro do padrão
                const k = Math.floor(this.t / interval), prev = Math.floor((this.t - this.dt) / interval);
                return this.t - this.dt <= 0 ? true : k !== prev;
            } };
    }

    onPhaseChange() {
        this.pattern = null; this.queue = []; this.pauseT = 1.2;
        G.eBullets.length = 0;
        const [x, y] = this.at(rand(-0.3, 0.3), rand(-0.2, 0.2));
        FX.explode(x, y, 1.6);
        FX.flashWhite = 0.35;
        G.banner(this.rage ? 'ALERTA: MODO FÚRIA' : 'O INIMIGO MUDOU DE TÁTICA', this.rage ? '#ff4a3a' : '#ffd36b', 1.4);
        if (this.rage) Sound.alarm();
    }

    ambientFx(dt) {
        // motores pulsantes + luz
        for (const [ex, ey] of this.def.engines) {
            const [x, y] = this.at(ex, ey);
            FX.addLight(x, y, 70, this.rage ? '#ff5a3a' : '#4fb4ff', 0.6 + 0.3 * Math.sin(this.t * 10 + ex * 9));
        }
        const frac = this.hp / this.maxHp;
        if (chance((1 - frac) * 0.5)) FX.smoke(this.x + rand(-this.w * 0.35, this.w * 0.35), this.y + rand(-this.h * 0.3, this.h * 0.3), rand(10, 20), 0.6 + (1 - frac) * 0.3);
        if (frac < 0.5 && chance((0.5 - frac) * 1.0)) FX.fire(this.x + rand(-this.w * 0.3, this.w * 0.3), this.y + rand(-this.h * 0.3, this.h * 0.3), rand(10, 18), 0, -30, 0.5);
        for (const pt of this.parts) if (!pt.alive && chance(0.6)) {
            const [x, y] = this.at(pt.ox, pt.oy);
            FX.fire(x + rand(-8, 8), y + rand(-8, 8), rand(10, 16), 0, -20, 0.4);
            if (chance(0.4)) FX.smoke(x, y, 12, 0.7);
        }
    }

    /** retorna true se o projétil acertou alguma coisa */
    hitTest(bx, by, br, dmg) {
        if (this.state !== 'fight') return false;
        for (const pt of this.parts) {
            if (!pt.alive) continue;
            const [x, y] = this.at(pt.ox, pt.oy);
            if (dist2(bx, by, x, y) < (pt.r + br) ** 2) {
                pt.hp -= dmg; pt.flash = 1;
                FX.impact(bx, by, '#ffe08a', 3);
                if (pt.hp <= 0) {
                    pt.alive = false;
                    FX.explode(x, y, 1.4);
                    G.addScore(250, x, y);
                    G.banner(pt.rotor ? 'ROTOR DESTRUÍDO' : 'TORRE DESTRUÍDA', '#ffd36b', 1.0);
                    if (!this.armored) G.radio('RADAR', 'Núcleo exposto! Dano total!');
                }
                return true;
            }
        }
        // corpo: elipse aproximada
        const dx = (bx - this.x) / (this.w * 0.42), dy = (by - this.y) / (this.h * 0.4);
        if (dx * dx + dy * dy < 1) {
            const real = dmg * (this.armored ? 0.35 : 1) * (this.cloaked ? 0.2 : 1);
            this.hp -= real;
            this.hitFlash = 0.7;
            if (chance(this.armored ? 0.7 : 0.35)) FX.impact(bx, by, this.armored ? '#9fd8ff' : '#ffe08a', this.armored ? 4 : 3);
            if (chance(0.25)) FX.text(bx + rand(-10, 10), by, Math.round(real), this.armored ? '#9fd8ff' : '#fff1a8', 15, 0.5);
            Sound.hit();
            if (this.hp <= 0) this.die();
            return true;
        }
        return false;
    }

    die() {
        this.hp = 0;
        this.state = 'dying';
        this.dyingT = 0;
        G.beams.forEach((b) => (b.dead = true));
        G.eBullets.length = 0;
        G.slowmo(0.35, 1.4);
        Sound.alarm();
    }

    updateDying(dt) {
        this.dyingT += dt;
        this.y += 22 * dt;
        this.scale = 1 - 0.15 * Math.min(1, this.dyingT / 2.8);
        FX.addTrauma(0.05);
        if (chance(dt * 16)) {
            const [x, y] = this.at(rand(-0.4, 0.4), rand(-0.35, 0.35));
            FX.explode(x, y, rand(0.7, 1.3));
        }
        this.ambientFx(dt);
        if (this.dyingT > 2.8) {
            FX.explode(this.x, this.y, 3.6);
            for (let i = 0; i < 6; i++) FX.explode(this.x + rand(-this.w * 0.4, this.w * 0.4), this.y + rand(-this.h * 0.4, this.h * 0.4), 1.2, { sound: false });
            FX.flashWhite = 1;
            FX.addTrauma(1);
            Sound.bigExplosion();
            this.state = 'dead';
            G.onBossDefeated(this);
        }
    }

    drawShadow(ctx) {
        if (this.state === 'dead') return;
        if (this.cloakA < 0.5) return;
        drawSpriteShadow(ctx, this.spr, this.x, this.y, this.w * this.scale, this.h * this.scale, this.rot, this.alt);
    }

    draw(ctx) {
        if (this.state === 'dead') return;
        const frac = this.hp / this.maxHp;
        // brilho dos motores
        ctx.globalCompositeOperation = 'lighter';
        for (const [ex, ey] of this.def.engines) {
            const [x, y] = this.at(ex, ey);
            const s = 26 + 8 * Math.sin(this.t * 12 + ex * 10);
            ctx.globalAlpha = 0.8; // os motores continuam visíveis mesmo camuflado (a dica do briefing)
            ctx.drawImage(getGlow(this.def.sprite === 'boss_sombra' ? '#b48cff' : this.rage ? '#ff5a3a' : '#5fc4ff'), x - s, y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        drawSpriteFull(ctx, this.spr, this.x, this.y, this.w * this.scale, this.h * this.scale, this.rot, { burn: (1 - frac) * 0.95, flash: this.hitFlash * 0.6, alpha: this.cloakA });
        if (this.cloakA < 0.9) { // tremulação da camuflagem
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - this.cloakA) * 0.25 * (0.6 + 0.4 * Math.sin(this.t * 30));
            ctx.drawImage(getGlow('#b48cff'), this.x - this.w * 0.5, this.y - this.h * 0.5, this.w, this.h); ctx.restore();
        }
        if (this.def.rotor) {
            ctx.save();
            ctx.translate(this.x, this.y);
            const R = this.w * 0.56;
            ctx.globalAlpha = 0.15; ctx.fillStyle = '#20241f';
            ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#151614'; ctx.lineWidth = 6;
            for (let i = 0; i < 4; i++) { const a = this.rotorA + (i * TAU) / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
            ctx.restore();
        }
        // rotores duplos (Titã): discos grandes girando enquanto a peça existir
        for (const pt of this.parts) if (pt.rotor && pt.alive) {
            const [x, y] = this.at(pt.ox, pt.oy), R = this.w * 0.62;
            ctx.save(); ctx.translate(x, y);
            ctx.globalAlpha = 0.22; ctx.fillStyle = '#2a3026'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
            ctx.globalAlpha = 0.3; ctx.strokeStyle = '#9aa38f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
            ctx.globalAlpha = 0.7; ctx.strokeStyle = '#2b3027'; ctx.lineWidth = 9;
            const a0 = this.rotorA * (pt.oy < 0 ? 1 : -1);
            for (let i = 0; i < 3; i++) { const a = a0 + (i * TAU) / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
            if (pt.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pt.flash; ctx.drawImage(getGlow('#ffffff'), -pt.r, -pt.r, pt.r * 2, pt.r * 2); }
            ctx.restore();
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 22, y + pt.r + 6, 44, 5);
            ctx.fillStyle = '#ffb020'; ctx.fillRect(x - 21, y + pt.r + 7, 42 * (pt.hp / pt.maxHp), 3);
        }
        // torres
        for (const pt of this.parts) {
            if (pt.rotor) { if (!pt.alive) { const [x, y] = this.at(pt.ox, pt.oy); ctx.fillStyle = 'rgba(15,10,8,0.85)'; ctx.beginPath(); ctx.arc(x, y, pt.r * 0.7, 0, TAU); ctx.fill(); } continue; }
            const [x, y] = this.at(pt.ox, pt.oy);
            ctx.save();
            ctx.translate(x, y);
            if (pt.alive) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.arc(3, 4, pt.r + 4, 0, TAU); ctx.fill();
                ctx.rotate(pt.turret - Math.PI / 2);
                ctx.drawImage(TEX.samTurret, -pt.r * 1.5, -pt.r * 1.5, pt.r * 3, pt.r * 3);
                if (pt.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pt.flash; ctx.drawImage(getGlow('#ffffff'), -pt.r, -pt.r, pt.r * 2, pt.r * 2); }
            } else {
                ctx.fillStyle = 'rgba(15,10,8,0.85)';
                ctx.beginPath(); ctx.arc(0, 0, pt.r * 0.9, 0, TAU); ctx.fill();
            }
            ctx.restore();
            if (pt.alive) {
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 22, y + pt.r + 6, 44, 5);
                ctx.fillStyle = '#ffb020'; ctx.fillRect(x - 21, y + pt.r + 7, 42 * (pt.hp / pt.maxHp), 3);
            }
        }
        // escudo do núcleo enquanto houver torres
        if (this.armored && this.state === 'fight') {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.12 + 0.06 * Math.sin(this.t * 5) + this.hitFlash * 0.25;
            ctx.drawImage(getGlow('#6fc8ff'), this.x - this.w * 0.45, this.y - this.h * 0.45, this.w * 0.9, this.h * 0.9);
            ctx.restore();
        }
    }
}
