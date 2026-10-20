/* =====================================================================
   DIRETOR DE FASE: formações de ataque, unidades terrestres, mini-chefe,
   mensagens de rádio, holofotes e entrada do chefe.
   ===================================================================== */
const WAVES = {
    lineDive(d) {
        const n = Math.round(4 * Math.min(2, G.mod.density)), dir = chance(0.5) ? 1 : -1;
        const x0 = dir > 0 ? rand(60, 200) : rand(W - 200, W - 60);
        for (let i = 0; i < n; i++) d.later(i * 0.35, () => spawnEnemy('ap', clamp(x0 + dir * i * 90, 40, W - 40), -60));
    },
    vForm(d) {
        const cx = rand(180, W - 180), phase = rand(0, TAU), amp = rand(50, 110);
        const ks = G.mod.density > 1.6 ? [0, -1, 1, -2, 2, -3, 3] : [0, -1, 1, -2, 2];
        ks.forEach((k) => d.later(Math.abs(k) * 0.12, () => spawnEnemy('ip', cx + k * 62, -60 - Math.abs(k) * 50, { amp, freq: 1.8, phase })));
    },
    swoop(d) {
        const side = chance(0.5) ? -1 : 1, n = Math.round(5 * Math.min(1.8, G.mod.density));
        const p0 = [side < 0 ? -70 : W + 70, rand(40, 180)], p1 = [W / 2 + rand(-120, 120), rand(480, 680)], p2 = [side < 0 ? W + 90 : -90, rand(40, 220)];
        for (let i = 0; i < n; i++) d.later(i * 0.28, () => spawnEnemy('jp', p0[0], p0[1], { p0, p1, p2, dur: 3.4 }));
    },
    heliPair(d) {
        const ty = rand(130, 260);
        spawnEnemy('ah', W * 0.25, -70, { tx: W * 0.25, ty });
        d.later(0.6, () => spawnEnemy('ah', W * 0.75, -70, { tx: W * 0.75, ty: ty + 40 }));
        if (G.mod.density > 1.5) d.later(1.2, () => spawnEnemy('ih', W * 0.5, -70, { ty: ty - 30 }));
    },
    ringHeli(d) {
        spawnEnemy('ih', W / 2 + rand(-150, 150), -70, { ty: rand(150, 260) });
        if (d.loop > 0 || d.index >= 2) d.later(1.5, () => WAVES.drones(d, 3));
    },
    drones(d, n = Math.round(6 * Math.min(2.2, G.mod.density))) {
        for (let i = 0; i < n; i++) d.later(i * 0.22, () => { const e = spawnEnemy('dr', rand(40, W - 40), -40); e.vy = 200; });
    },
    mixed(d) {
        WAVES.lineDive(d);
        d.later(1.2, () => spawnEnemy(chance(0.5) ? 'ah' : 'ih', rand(120, W - 120), -70, { ty: rand(120, 240) }));
    }
};

class StageDirector {
    constructor(index, loop) {
        this.index = index; this.loop = loop;
        this.def = STAGES[index];
        this.t = 0;
        this.phase = 'intro';
        this.waveT = 2.8;
        this.groundT = randRange(this.def.groundEvery) * 0.5;
        this.radioIdx = 0;
        this.midbossDone = false;
        this.pending = [];
        this.escaped = 0;
        this.escortBonusMax = 2000 + 1000 * index;
        this.escortBonus = this.escortBonusMax;
        this.kills = 0;
        this.hitsTaken = 0;
        this.warnT = 0;
        this.spotSeeds = [0, 1, 2].map((i) => ({ ox: W * (0.2 + i * 0.3), ph: rand(0, TAU), s: rand(0.35, 0.55), s2: rand(0.25, 0.4) }));
    }

    later(delay, fn) { this.pending.push({ t: delay, fn }); }

    get progress() { return clamp(this.t / this.def.duration, 0, 1); }

    update(dt) {
        this.t += dt;
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const p = this.pending[i];
            p.t -= dt;
            if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
        }
        // rádio
        const r = this.def.radio[this.radioIdx];
        if (r && this.t >= r[0] && this.phase !== 'boss') { G.radio(r[1], r[2]); this.radioIdx++; }

        // holofotes
        if (this.def.searchlights) {
            FX.spots = this.spotSeeds.map((s) => ({
                ox: s.ox, oy: H + 60,
                x: W / 2 + Math.sin(this.t * s.s + s.ph) * W * 0.42,
                y: 330 + Math.sin(this.t * s.s2 + s.ph * 2) * 230,
                r: 62
            }));
        }

        const airCount = G.enemies.filter((e) => e.isAir && !e.dying).length;
        switch (this.phase) {
            case 'intro':
                if (this.t > 2.5) this.phase = 'waves';
                break;
            case 'waves':
                this.waveT -= dt;
                if (this.waveT <= 0 && airCount < Math.round(this.def.maxEnemies * G.mod.density)) {
                    WAVES[weightedPick(this.def.pool)](this);
                    // ondas simultâneas quando a pressão está alta
                    if (chance(clamp((G.mod.density - 1) * 0.45, 0, 0.75))) this.later(rand(0.6, 1.4), () => WAVES[weightedPick(this.def.pool)](this));
                    this.waveT = randRange(this.def.waveEvery) / Math.sqrt(G.mod.density);
                }
                this.updateGround(dt);
                if (!this.midboss2Done && G.progress >= 2 && this.t >= this.def.duration * 0.8) {
                    this.midboss2Done = true;
                    spawnEnemy('bm', W * 0.3, -120); spawnEnemy('bm', W * 0.7, -160);
                    G.banner('ESQUADRA DE BOMBARDEIROS', '#ff7a3a', 2, 'Dois alvos pesados');
                }
                if (!this.midbossDone && this.t >= this.def.midboss) {
                    this.midbossDone = true;
                    spawnEnemy('bm', W / 2, -120);
                    G.banner('BOMBARDEIRO PESADO', '#ffb020', 2, 'Derrube-o para receber suprimentos');
                }
                if (this.t >= this.def.duration) {
                    this.phase = 'warning';
                    this.warnT = 4;
                    for (const e of G.enemies) if (e.def.ai === 'bomber' || e.def.ai === 'hover' || e.def.ai === 'ringer') e.state = 'exit';
                    G.bossWarning(BOSSES[this.def.boss].name);
                }
                break;
            case 'warning':
                this.warnT -= dt;
                if (this.warnT <= 0) {
                    this.phase = 'boss';
                    G.spawnBoss(this.def.boss);
                }
                break;
            case 'boss':
                if (this.def.ground === 'gb') this.updateGround(dt * 0.4);
                break;
        }
    }

    updateGround(dt) {
        if (!this.def.ground) return;
        this.groundT -= dt;
        if (this.groundT <= 0) {
            this.groundT = randRange(this.def.groundEvery) / Math.sqrt(G.mod.density);
            spawnEnemy(this.def.ground, rand(60, W - 60), -50);
        }
    }

    onEscaped() {
        this.escaped++;
        this.escortBonus = Math.max(0, this.escortBonus - 200);
    }
}
