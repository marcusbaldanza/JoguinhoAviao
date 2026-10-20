/* =====================================================================
   NÚCLEO DO JOGO: estado global, laço principal, colisões, pontuação,
   fluxo entre fases e renderização em camadas.
   ===================================================================== */
const G = {
    state: 'loading',
    settings: Object.assign({ sound: true, music: true, shake: true, autofire: false, quality: 'alta' }, Store.get('gnc_settings', {})),
    playerName: '', difficulty: 'veterano',
    mod: { hp: 1, dmg: 1, dmgTaken: 1, bulletSpeed: 1, fireRate: 1, score: 1 },
    player: null, enemies: [], pBullets: [], eBullets: [], beams: [], powerups: [], gears: [], boss: null, stage: null,
    stageIndex: 0, loop: 0,
    score: 0, mult: 1, combo: 0, comboT: 0,
    playTime: 0, scroll: 0, scrollSpeed: 95,
    timeScale: 1, slowT: 0,
    bomb: { active: false, t: 0, y: 0, id: 0 },
    timers: [],
    bannerData: null, warning: null,
    stats: null, nextDrop: 8, dropKills: 0,
    renderScale: 1, bgKey: 'bg1', ambient: 0.1, weather: 'none', grade: null,

    // ------------------------------------------------------------------ setup
    applySettings() {
        const s = this.settings;
        Sound.setEnabled(s.sound);
        Sound.setMusic(s.music);
        FX.shakeEnabled = s.shake;
        FX.setQuality(s.quality);
        Store.set('gnc_settings', s);
    },

    /** progressão global: 0 na fase 1, +1 por fase, +5 por ciclo */
    get progress() { return this.stageIndex + this.loop * 5; },

    computeMod() {
        const d = DIFFICULTY[this.difficulty], L = this.loop, g = this.progress, S = SCALING, C = S.loopCompound;
        const pw = this.player ? this.player.power : 0;
        this.mod = {
            hp: d.enemyHp * (1 + S.hpPerStage * g) * Math.pow(C.hp, L) * (1 + S.powerHp * pw),
            dmg: (1 + S.dmgPerStage * g) * Math.pow(C.dmg, L),
            dmgTaken: d.dmgTaken,
            bulletSpeed: Math.min(S.caps.bulletSpeed, d.bulletSpeed * (1 + S.bulletSpeedPerStage * g)),
            fireRate: Math.min(S.caps.fireRate, d.fireRate * (1 + S.fireRatePerStage * g) * Math.pow(C.fireRate, L)),
            density: Math.min(S.caps.density, d.density * (1 + S.densityPerStage * g) * Math.pow(C.density, L) * (1 + S.powerDensity * pw)),
            elite: Math.min(S.caps.elite, d.elite + S.elitePerStage * g),
            extraShots: Math.floor((g + (this.difficulty === 'as' ? 1 : 0)) / 2),
            score: d.score * (1 + 0.25 * g)
        };
    },

    newStats() {
        return { kills: Object.fromEntries(Object.keys(ENEMY_TYPES).map((k) => [k, 0])), totalKills: 0, bosses: 0, powerups: {}, gears: 0, elites: 0, maxCombo: 0, grazes: 0, bombsUsed: 0 };
    },

    toMenu() {
        this.state = 'menu';
        HUD.show(false);
        this.clearWorld();
        this.setScenery(0);
        UI.show('screen-menu');
        Sound.playMusic('menu', 'full');
        setTimeout(() => UI.$('player-name').focus(), 50);
    },

    newGame() {
        this.clearWorld();
        this.player = new Player(DIFFICULTY[this.difficulty]);
        this.score = 0; this.mult = 1; this.combo = 0; this.comboT = 0;
        this.playTime = 0; this.stageIndex = 0; this.loop = 0;
        this.stats = this.newStats();
        this.nextDrop = 4; this.dropKills = 0;
        this.saved = false;
        this.showBriefing(true);
    },

    clearWorld() {
        this.enemies = []; this.pBullets = []; this.eBullets = []; this.beams = []; this.powerups = []; this.gears = [];
        this.boss = null; this.timers = []; this.bannerData = null; this.warning = null;
        this.bomb.active = false; this.timeScale = 1; this.slowT = 0;
        FX.reset();
    },

    setScenery(index) {
        const def = STAGES[index];
        this.bgKey = def.bg; this.ambient = def.ambient; this.weather = def.weather; this.grade = def.grade;
        HUD.setAccent(def.hudColor);
        FX.initClouds(def.weather === 'fog' ? 0.6 : def.weather === 'rain' ? 1.5 : 1);
    },

    showBriefing(withPrologue) {
        this.state = 'briefing';
        HUD.show(false);
        const i = this.stageIndex, def = STAGES[i];
        this.setScenery(i);
        Sound.playMusic(def.music, 'calm');
        let pro = withPrologue ? STORY.prologue : null;
        if (!pro && this.loop > 0 && i === 0) pro = [STORY.loops[Math.min(this.loop - 1, STORY.loops.length - 1)]];
        UI.briefing(`CAPÍTULO ${i + 1} · ${def.chapter}${this.loop ? ' · CICLO ' + (this.loop + 1) : ''}`, def.name.toUpperCase(), def.briefing, pro, () => this.startStage());
    },

    startStage() {
        const i = this.stageIndex;
        this.clearWorld();
        this.computeMod();
        this.stage = new StageDirector(i, this.loop);
        this.setScenery(i);
        const p = this.player;
        p.x = W / 2; p.y = H - 150; p.vx = p.vy = 0; p.invuln = 2; p.dead = false;
        if (p.regenShield) p.giveShield();
        this.state = 'playing';
        UI.show(null);
        HUD.show(true);
        Sound.playMusic(STAGES[i].music, 'full');
        this.banner(`FASE ${i + 1}`, '#ffffff', 2.6, STAGES[i].name.toUpperCase());
    },

    // ------------------------------------------------------------------ eventos
    after(delay, fn) { this.timers.push({ t: delay, fn }); },

    banner(text, color = '#fff', dur = 2, sub = '') { this.bannerData = { text, color, dur, t: 0, sub }; },

    radio(who, text) { HUD.radio(who, text.replaceAll('{P}', this.playerName.toUpperCase())); Sound.radio(); },

    slowmo(scale, dur) { this.timeScale = scale; this.slowT = dur; },

    bossWarning(name) {
        this.warning = { t: 0, dur: 3.8, name };
        Sound.alarm();
        Sound.playMusic(this.stageIndex === STAGES.length - 1 ? 'final' : STAGES[this.stageIndex].music, 'boss');
    },

    spawnBoss(key) { this.boss = new Boss(key); },

    addScore(v, x, y, raw) {
        const pts = Math.round(v * (raw ? 1 : this.mult) * this.mod.score);
        this.score += pts;
        if (x !== undefined && pts >= 10) FX.text(x, y, `+${pts}`, pts >= 500 ? '#ffd36b' : '#fff1c4', pts >= 500 ? 24 : 16, 0.8);
        return pts;
    },

    breakCombo() { this.combo = 0; this.mult = 1; this.comboT = 0; if (this.stage) this.stage.hitsTaken++; },

    onEnemyKilled(e) {
        this.combo++;
        this.comboT = 2.4;
        this.mult = Math.min(5, 1 + Math.floor(this.combo / 6) * 0.5);
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
        this.addScore(e.def.score * (e.veteran ? 2.5 : 1), e.x, e.y - 10);
        this.stats.kills[e.type]++;
        this.stats.totalKills++;
        this.stage.kills++;
        this.player.addFury(e.def.elite ? 35 : e.veteran ? 12 : e.def.kind === 'drone' ? 2 : 5);
        if (e.veteran) this.stats.elites++;
        const gears = e.def.elite ? 7 : e.veteran ? 3 : e.def.kind !== 'drone' && chance(GEAR_DROP / Math.sqrt(this.mod.density)) ? 1 : 0;
        if (gears) dropGears(e.x, e.y, gears);
        if (e.def.elite) {
            dropPowerUp(e.x - 40, e.y, !this.player.isMax('cannon') ? 'cannon' : undefined);
            dropPowerUp(e.x + 40, e.y);
            return;
        }
        if (++this.dropKills >= this.nextDrop) {
            this.dropKills = 0;
            const first = this.stats.totalKills <= 5;
            this.nextDrop = randInt(...POWERUP_PITY_KILLS) + this.stageIndex * 2 + this.loop * 3;
            dropPowerUp(e.x, e.y, first ? 'cannon' : undefined);
        }
    },

    onEnemyEscaped(e) {
        if (!this.stage || e.def.kind === 'drone') return;
        this.stage.onEscaped();
        FX.text(clamp(e.x, 60, W - 60), H - 140, 'ESCOLTA -200', '#ff8a7a', 16, 1.2);
    },

    onBossDefeated(boss) {
        this.stats.bosses++;
        this.addScore(3000 * (this.stageIndex + 1), boss.x, boss.y, true);
        for (const e of this.enemies) if (!e.dying) { e.kill(); }
        this.eBullets.length = 0;
        const [who, line] = boss.def.outro;
        this.radio(who, line);
        if (this.stageIndex === STAGES.length - 1) this.after(2.2, () => this.radio(STAGES[STAGES.length - 1].radio.slice(-1)[0][1], 'A TRÍADE caiu, {P}! A flotilha está atracando!'));
        Sound.jingle('clear');
        this.after(3.2, () => this.stageClear());
    },

    stageClear() {
        const st = this.stage, p = this.player;
        this.campWarned = false;
        this.state = 'clear';
        HUD.show(false);
        const bossBonus = 3000 * (this.stageIndex + 1);
        const escort = Math.round(st.escortBonus * this.mod.score);
        const noHit = st.hitsTaken === 0 ? Math.round(5000 * this.mod.score) : 0;
        const hpBonus = Math.round((p.hp / p.maxHp) * 1500 * this.mod.score);
        this.score += escort + noHit + hpBonus;
        p.maxHp += PLAYER_CFG.hpPerStage;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * PLAYER_CFG.clearHeal);
        const rows = [
            { label: 'Chefe derrotado', value: '+' + formatScore(bossBonus * this.mod.score) },
            { label: `Bônus de escolta (${st.escaped} escaparam)`, value: '+' + formatScore(escort) },
            { label: 'Blindagem restante', value: '+' + formatScore(hpBonus) },
            { label: 'Fase sem dano', value: noHit ? '+' + formatScore(noHit) : '—' },
            { label: 'Abates na fase', value: String(st.kills) },
            { label: 'Avião atual', value: `${p.model.name} · Motor ${p.engine}` },
            { label: 'Reparos de campo', value: `+${Math.round(PLAYER_CFG.clearHeal * 100)}% vida · +${PLAYER_CFG.hpPerStage} máx.` },
            { label: 'PONTUAÇÃO', value: formatScore(this.score), total: true }
        ];
        UI.tally(rows, () => {
            if (this.stageIndex >= STAGES.length - 1) { this.state = 'victory'; Sound.playMusic('menu', 'full'); UI.victory(STORY.epilogue); return; }
            this.offerPerks();
        });
    },

    offerPerks() {
        this.state = 'perk';
        const p = this.player;
        const pool = PERKS.filter((k) => !(k.once && p.perks.includes(k.id)) && !(k.id === 'missiles' && p.isMax('missile')) && !(k.id === 'turbo' && p.isMax('engine')) && !(k.id === 'armory' && p.isMax('cannon')));
        const choices = pool.sort(() => Math.random() - 0.5).slice(0, 3);
        UI.perks(choices, (perk) => {
            this.applyPerk(perk);
            this.stageIndex++;
            this.showBriefing(false);
        });
    },

    applyPerk(perk) {
        const p = this.player;
        p.perks.push(perk.id);
        switch (perk.id) {
            case 'armor': p.maxHp += 30; p.hp = p.maxHp; break;
            case 'ap_ammo': p.dmgMult *= 1.15; break;
            case 'turbo': p.addXP('engine', 150); break;
            case 'armory': p.addXP('cannon', 150); break;
            case 'magnet': p.magnet = true; break;
            case 'bombbay': p.maxBombs++; p.bombs = Math.min(p.maxBombs, p.bombs + 1); break;
            case 'regen': p.regenShield = true; break;
            case 'missiles': p.addXP('missile', 150); break;
            case 'fury': p.furyGain *= 1.4; break;
            case 'repair': p.repair = true; break;
        }
    },

    nextLoop() {
        this.loop++;
        this.stageIndex = 0;
        this.offerPerksThenBrief();
    },
    offerPerksThenBrief() {
        this.state = 'perk';
        const pool = PERKS.filter((k) => !(k.once && this.player.perks.includes(k.id)));
        UI.perks(pool.sort(() => Math.random() - 0.5).slice(0, 3), (perk) => { this.applyPerk(perk); this.showBriefing(false); });
    },

    useBomb() {
        const p = this.player;
        if (this.state !== 'playing' || !p || p.dead || p.bombs <= 0 || this.bomb.active) return;
        p.bombs--;
        this.stats.bombsUsed++;
        this.bomb = { active: true, t: 0, y: H + 80, id: this.bomb.id + 1, bossHit: false };
        FX.flashWhite = 0.45;
        Sound.bomb();
        this.radio('ALA', 'Ataque aéreo a caminho! Abaixem-se!');
    },

    updateBomb(dt) {
        const b = this.bomb;
        if (!b.active) return;
        b.t += dt;
        b.y = H + 80 - b.t * 1100;
        // linha de explosões varrendo a tela de baixo para cima
        if (b.y > -60) {
            for (let i = 0; i < 2; i++) FX.explode(rand(30, W - 30), b.y + rand(-20, 40), rand(0.6, 1.1), { ground: true, sound: false });
            if (chance(0.3)) Sound.explosion(1);
            FX.addTrauma(0.06);
        }
        for (const eb of this.eBullets) if (eb.y > b.y - 40) eb.dead = true;
        for (const e of this.enemies) {
            if (e.dying || e._bombId === b.id || e.y < b.y - 30) continue;
            e._bombId = b.id;
            e.takeDamage(160 * this.player.dmgMult, e.x, e.y);
        }
        const boss = this.boss;
        if (boss && boss.state === 'fight' && !b.bossHit && boss.y > b.y) {
            b.bossHit = true;
            for (const pt of boss.parts) if (pt.alive) boss.hitTest(...boss.at(pt.ox, pt.oy), 1, pt.maxHp * 0.4);
            boss.hp -= boss.maxHp * 0.06;
            boss.hitFlash = 1;
            if (boss.hp <= 0) boss.die();
        }
        if (b.t > 1.4) { b.active = false; this.player.invuln = Math.max(this.player.invuln, 0.4); }
    },

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        UI.showOverlay('screen-pause');
    },
    resume() {
        if (this.state !== 'paused') return;
        UI.hideOverlay('screen-pause');
        UI.hideOverlay('screen-settings');
        UI.active = null;
        this.state = 'playing';
    },

    stageLabel() {
        return `Fase ${this.stageIndex + 1}${this.loop ? ` (Ciclo ${this.loop + 1})` : ''}`;
    },

    gameOver(abandoned = false, victory = false) {
        this.state = 'gameover';
        HUD.show(false);
        if (victory) Sound.playMusic('menu', 'full'); else Sound.jingle('gameover');
        const st = this.stats;
        UI.$('go-title').dataset.story = victory ? '' : pick(STORY.gameOver);
        const report = {
            name: this.playerName, score: this.score, difficulty: DIFFICULTY[this.difficulty].label,
            stage: victory ? `Vitória${this.loop ? ' · C' + (this.loop + 1) : ''}` : this.stageLabel(),
            time: formatTime(this.playTime), bosses: st.bosses, kills: st.kills, totalKills: st.totalKills,
            powerups: st.powerups, maxCombo: st.maxCombo, grazes: st.grazes, bombsUsed: st.bombsUsed,
            model: `${this.player.model.name} (C${this.player.cannon}/M${this.player.engine}/R${this.player.missiles})`, gears: st.gears, elites: st.elites
        };
        UI.gameOver(report, victory);
        if (this.saved) return;
        this.saved = true;
        const entry = {
            name: report.name, score: report.score, stage: report.stage, level: this.stageIndex + 1 + this.loop * 5,
            bosses: st.bosses, hasInsignia: st.bosses >= 5, time: report.time, difficulty: report.difficulty, diffKey: this.difficulty,
            kills: st.kills, totalKills: st.totalKills,
            powerups: Object.values(st.powerups).reduce((a, b) => a + b, 0), date: new Date().toLocaleDateString('pt-BR')
        };
        if (this.score > 0) Ranking.save(entry).then((ok) => UI.setSaveStatus(ok));
        else UI.setSaveStatus(false);
    },

    // ------------------------------------------------------------------ atualização
    update(dt) {
        const p = this.player;
        this.playTime += dt;
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const t = this.timers[i];
            t.t -= dt;
            if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
        }
        if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; this.mult = 1; } }

        this.computeMod();
        this.stage.update(dt);
        p.update(dt);
        this.antiCamp(dt);
        for (const e of this.enemies) e.update(dt);
        this.enemies = this.enemies.filter((e) => !e.dead);
        if (this.boss) { this.boss.update(dt); if (this.boss.state === 'dead') this.boss = null; }
        updateBullets(this.pBullets, dt, true);
        updateBullets(this.eBullets, dt, false);
        updateBeams(dt);
        for (const pu of this.powerups) pu.update(dt);
        this.powerups = this.powerups.filter((pu) => !pu.dead);
        for (const g of this.gears) g.update(dt);
        this.gears = this.gears.filter((g) => !g.dead);
        this.updateBomb(dt);
        if (!p.dead) this.collisions();

        if (p.dead && p.deathT > 3 && this.state === 'playing') this.gameOver();
        if (this.bannerData) { this.bannerData.t += dt; if (this.bannerData.t > this.bannerData.dur) this.bannerData = null; }
        if (this.warning) { this.warning.t += dt; if (this.warning.t > this.warning.dur) this.warning = null; }
    },

    /** quem fica parado num canto atrai drones de flanco (evita o "macete" de acampar) */
    antiCamp(dt) {
        const p = this.player, st = this.stage;
        if (p.dead || st.phase === 'intro') return;
        const corner = p.x < 130 || p.x > W - 130;
        if (this.campX === undefined || !corner || Math.hypot(p.x - this.campX, p.y - this.campY) > 100) {
            this.campT = 0; this.campX = p.x; this.campY = p.y; return;
        }
        this.campT += dt;
        if (this.campT < 4) return;
        this.campT = 1.5; // repete a cada 2,5 s enquanto continuar acampado
        const side = p.x < W / 2 ? -1 : 1;
        const n = 2 + Math.min(3, Math.floor(this.progress / 2));
        for (let i = 0; i < n; i++) st.later(i * 0.25, () => {
            const e = spawnEnemy('dr', side < 0 ? -30 : W + 30, clamp(p.y - 260 + i * 60, 60, H - 200));
            e.vx = -side * 260; e.vy = 40;
        });
        st.later(0.4, () => spawnEnemy('ap', clamp(p.x + side * -40, 40, W - 40), -60));
        if (!this.campWarned) { this.campWarned = true; this.radio('RADAR', 'Alvo parado no canto detectado — drones de flanco a caminho! Mexa-se!'); }
    },

    /** cenário sempre animado (também atrás das telas de menu/briefing) */
    updateAmbient(dt) {
        this.scroll += this.scrollSpeed * dt;
        FX.update(dt, this.scrollSpeed);
        FX.updateClouds(dt);
        FX.updateWeather(dt, this.weather);
    },

    collisions() {
        const p = this.player;
        // projéteis do jogador
        for (const b of this.pBullets) {
            if (b.dead) continue;
            let hit = false;
            if (this.boss && this.boss.hitTest(b.x, b.y, b.r, b.dmg)) hit = true;
            if (!hit) for (const e of this.enemies) {
                if (!e.targetable || (b.hits && b.hits.includes(e))) continue;
                const rr = e.r + b.r;
                if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
                    e.takeDamage(b.dmg, b.x, b.y);
                    if (b.pierce > 0) { b.pierce--; (b.hits || (b.hits = [])).push(e); b.dmg *= 0.8; continue; } // perfurante: segue em frente
                    hit = true; break;
                }
            }
            if (!hit) for (const eb of this.eBullets) { // minas e foguetes podem ser abatidos
                if (eb.dead || (eb.kind !== 'mine' && eb.kind !== 'rocket')) continue;
                const rr = eb.r + b.r + 4;
                if (dist2(b.x, b.y, eb.x, eb.y) < rr * rr) {
                    eb.hp = (eb.hp ?? 1) - b.dmg;
                    if (eb.hp <= 0) { eb.dead = true; FX.explode(eb.x, eb.y, 0.45, { debris: false }); this.addScore(eb.kind === 'mine' ? 50 : 20, eb.x, eb.y); }
                    hit = true; break;
                }
            }
            if (hit) {
                b.dead = true;
                if (b.kind === 'pmissile') {
                    FX.explode(b.x, b.y, 0.5, { debris: false, sound: false });
                    Sound.explosion(0.5);
                    for (const e of this.enemies) if (e.targetable && dist2(b.x, b.y, e.x, e.y) < 70 * 70) e.takeDamage(b.splash, e.x, e.y);
                }
            }
        }
        // projéteis inimigos x jogador (+ rasante)
        for (const eb of this.eBullets) {
            if (eb.dead) continue;
            const d2 = dist2(eb.x, eb.y, p.x, p.y);
            const rr = eb.r * 0.75 + p.r;
            if (d2 < rr * rr) {
                if (!p.invulnerable) {
                    p.hurt(eb.dmg, eb.x, eb.y);
                    eb.dead = true;
                    if (eb.kind === 'rocket' || eb.kind === 'flak' || eb.kind === 'mine') FX.explode(eb.x, eb.y, 0.5, { debris: false });
                }
            } else if (!eb.grazed && d2 < PLAYER_CFG.grazeRadius ** 2 && !p.invulnerable) {
                eb.grazed = true;
                this.stats.grazes++;
                this.addScore(5, undefined, undefined, true);
                p.addFury(1.5);
                Sound.graze();
                FX.spawn({ type: 'spark', x: (eb.x + p.x) / 2, y: (eb.y + p.y) / 2, vx: rand(-80, 80), vy: rand(-80, 80), size: 1.2, life: 0.2, color: '#9ff' });
            }
        }
        // colisão de corpo
        for (const e of this.enemies) {
            if (!e.isAir || e.dying) continue;
            const rr = e.r * 0.8 + p.r + 4;
            if (dist2(e.x, e.y, p.x, p.y) < rr * rr && !p.invulnerable) {
                p.hurt(e.def.dmg * 1.8, (e.x + p.x) / 2, (e.y + p.y) / 2);
                e.takeDamage(e.def.kind === 'drone' ? 999 : 80, e.x, e.y);
            }
        }
        if (this.boss && this.boss.state === 'fight' && !p.invulnerable) {
            const b = this.boss, dx = (p.x - b.x) / (b.w * 0.4), dy = (p.y - b.y) / (b.h * 0.38);
            if (dx * dx + dy * dy < 1) p.hurt(25, p.x, p.y - 10);
        }
        // power-ups
        for (const pu of this.powerups) {
            if (!pu.dead && dist2(pu.x, pu.y, p.x, p.y) < (pu.r + 22) ** 2) { pu.dead = true; applyPowerUp(pu); }
        }
    },

    // ------------------------------------------------------------------ renderização
    render(ctx) {
        ctx.save();
        ctx.translate(FX.shakeX, FX.shakeY);
        FX.ox = FX.shakeX; FX.oy = FX.shakeY; FX.rs = this.renderScale;
        this.drawBackground(ctx);
        FX.drawDecals(ctx);
        FX.drawNormal(ctx, true); // fumaça de solo
        const playing = !!this.player && ['playing', 'paused', 'clear'].includes(this.state);
        if (playing) for (const e of this.enemies) if (!e.isAir) e.draw(ctx);
        FX.drawCloudShadows(ctx);
        if (playing) {
            for (const e of this.enemies) if (e.isAir) e.drawShadow(ctx);
            if (this.boss) this.boss.drawShadow(ctx);
            if (this.state !== 'clear') this.player.drawShadow(ctx);
            this.drawBombJets(ctx, true);
            for (const pu of this.powerups) pu.draw(ctx);
            for (const g of this.gears) g.draw(ctx);
            for (const e of this.enemies) if (e.isAir && e.def.kind === 'heli') e.draw(ctx);
            for (const e of this.enemies) if (e.isAir && e.def.kind !== 'heli') e.draw(ctx);
            if (this.boss) this.boss.draw(ctx);
            if (this.state !== 'clear') this.player.draw(ctx);
            this.drawBombJets(ctx, false);
        }
        FX.drawNormal(ctx, false);
        if (this.grade) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = this.grade;
            ctx.fillRect(-30, -30, W + 60, H + 60);
            ctx.globalCompositeOperation = 'source-over';
        }
        FX.drawLighting(ctx, this.ambient);
        if (playing) {
            drawPlayerBullets(ctx);
            drawEnemyBullets(ctx);
            drawBeams(ctx);
        }
        FX.drawAdditive(ctx);
        FX.drawClouds(ctx, 1 - this.ambient * 0.75);
        FX.drawWeather(ctx, this.weather);
        FX.drawTexts(ctx);
        ctx.restore();
        this.drawScreenFx(ctx);
    },

    drawBackground(ctx) {
        const img = IMG[this.bgKey];
        if (!img) { ctx.fillStyle = '#223'; ctx.fillRect(0, 0, W, H); return; }
        const T = W + 40; // ligeiramente maior que a tela para cobrir o tremor
        const k0 = Math.floor((this.scroll - H) / T) - 1;
        for (let k = k0; k < k0 + Math.ceil(H / T) + 3; k++) {
            const y = this.scroll - T * (k + 1) + H;
            if (y > H + 30 || y + T < -30) continue;
            ctx.save();
            ctx.translate(-20, y);
            if (((k % 2) + 2) % 2 === 1) { ctx.translate(0, T); ctx.scale(1, -1); } // espelha tiles alternados: emenda invisível
            ctx.drawImage(img, 0, 0, T, T);
            ctx.restore();
        }
    },

    drawBombJets(ctx, shadow) {
        const b = this.bomb;
        if (!b.active || !SPR.model6) return;
        for (const [fx, dy] of [[0.2, 60], [0.5, 0], [0.8, 60]]) {
            const x = W * fx, y = b.y + 120 + dy, w = 52, h = w * (SPR.model6.h / SPR.model6.w);
            if (shadow) drawSpriteShadow(ctx, SPR.model6, x, y, w, h, 0, 1.2);
            else { drawAfterburner(ctx, x, y + h * 0.42, 40, 9, '#ff9a4a'); drawSpriteFull(ctx, SPR.model6, x, y, w, h); FX.addLight(x, y + h * 0.5, 100, '#ff9a4a', 0.8); }
        }
    },

    drawScreenFx(ctx) {
        // vinheta permanente
        ctx.drawImage(this.vignette, 0, 0, W, H);
        const p = this.player;
        if (p && this.state === 'playing' && !p.dead) {
            const low = p.hp / p.maxHp < 0.3;
            if (low) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(performance.now() / 160); ctx.drawImage(this.redVignette, 0, 0, W, H); ctx.globalAlpha = 1; }
            if (p.detected) {
                ctx.font = '22px Staatliches, sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff4a3a' : '#ffd36b';
                ctx.fillText('⚠ DETECTADO PELOS HOLOFOTES', W / 2, 150);
            }
        }
        if (FX.flashRed > 0) { ctx.globalAlpha = FX.flashRed; ctx.drawImage(this.redVignette, 0, 0, W, H); ctx.globalAlpha = 1; }
        if (FX.flashWhite > 0) { ctx.fillStyle = `rgba(255,250,235,${FX.flashWhite})`; ctx.fillRect(0, 0, W, H); }
        if (this.state === 'playing' || this.state === 'paused') {
            if (this.warning) this.drawWarning(ctx);
            if (this.bannerData) this.drawBanner(ctx);
        }
    },

    drawBanner(ctx) {
        const b = this.bannerData, k = b.t / b.dur;
        const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        const y = H * 0.36;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, y - 58, W, b.sub ? 96 : 78);
        let fs = 64;
        ctx.font = `${fs}px Staatliches, sans-serif`;
        const tw = ctx.measureText(b.text).width;
        if (tw > W - 60) { fs = Math.floor(fs * (W - 60) / tw); ctx.font = `${fs}px Staatliches, sans-serif`; }
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color; ctx.shadowBlur = 18;
        ctx.fillText(b.text, W / 2 + (1 - a) * 40, y);
        ctx.shadowBlur = 0;
        if (b.sub) { ctx.font = '22px Staatliches, sans-serif'; ctx.fillStyle = '#e7ecdf'; ctx.fillText(b.sub, W / 2, y + 30); }
        ctx.restore();
    },

    drawWarning(ctx) {
        const w = this.warning, k = w.t / w.dur;
        const a = (k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1);
        ctx.save();
        ctx.globalAlpha = a * (0.25 + 0.2 * Math.sin(w.t * 10));
        ctx.fillStyle = '#ff1a1a';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = a;
        const y = H * 0.4;
        ctx.fillStyle = 'rgba(20,0,0,0.75)';
        ctx.fillRect(0, y - 70, W, 120);
        // faixas de alerta animadas
        ctx.fillStyle = '#ffcc00';
        for (const yy of [y - 70, y + 44]) {
            ctx.save(); ctx.beginPath(); ctx.rect(0, yy, W, 6); ctx.clip();
            for (let x = -40 + ((w.t * 120) % 40); x < W + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 20, yy); ctx.lineTo(x + 14, yy + 6); ctx.lineTo(x - 6, yy + 6); ctx.fill(); }
            ctx.restore();
        }
        ctx.textAlign = 'center';
        ctx.font = '62px Staatliches, sans-serif';
        ctx.fillStyle = '#ff4a3a';
        ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20;
        ctx.fillText('⚠ ALERTA ⚠', W / 2, y);
        ctx.shadowBlur = 0;
        ctx.font = '28px Staatliches, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(w.name, W / 2, y + 34);
        ctx.restore();
    },

    buildScreenTextures() {
        this.vignette = makeCanvas(W, H);
        let x = this.vignette.getContext('2d');
        let g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        this.redVignette = makeCanvas(W, H);
        x = this.redVignette.getContext('2d');
        g = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
        g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(200,0,0,0.75)');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
};

// ====================================================================== bootstrap
(function boot() {
    const stageEl = document.getElementById('stage');
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let renderScale = 1;

    function resize() {
        // escolhe o layout que deixa a área de jogo maior: painéis nas laterais (PC) ou em cima/embaixo (celular)
        const vw = window.innerWidth, vh = window.innerHeight;
        const sWide = Math.min(vw / 1120, vh / 960), sTall = Math.min(vw / 720, vh / 1240);
        const wide = sWide >= sTall;
        stageEl.classList.toggle('wide', wide);
        stageEl.classList.toggle('tall', !wide);
        const s = wide ? sWide : sTall;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        stageEl.style.transform = `scale(${s}) translate(-50%, -50%)`;
        // backing store na resolução real da tela (nitidez em telas grandes/retina)
        renderScale = Math.max(0.5, s * dpr);
        canvas.width = Math.round(W * renderScale);
        canvas.height = Math.round(H * renderScale);
    }
    window.addEventListener('resize', resize);
    resize();

    Input.init(canvas);
    HUD.init();
    UI.init();
    G.applySettings();

    window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        if (e.code === 'KeyM') { G.settings.sound = !G.settings.sound; G.applySettings(); const el = document.getElementById('set-sound'); if (el) el.checked = G.settings.sound; }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
    window.addEventListener('pointerdown', () => { Sound.init(); if (G.state === 'menu') Sound.playMusic('menu', 'full'); }, { once: true });

    loadAssets((k) => { document.getElementById('loading-fill').style.width = `${Math.round(k * 100)}%`; }).then((failed) => {
        FX.init();
        G.buildScreenTextures();
        if (failed.length) document.getElementById('loading-text').textContent = `Aviso: ${failed.length} imagem(ns) não carregaram.`;
        G.toMenu();
        requestAnimationFrame(loop);
    });

    let last = performance.now();
    function loop(now) {
        const realDt = Math.min(0.05, (now - last) / 1000);
        last = now;
        Input.pollGamepad();
        if (G.state === 'playing' && Input.hit('pause')) G.pause();
        else if (G.state === 'paused' && Input.hit('pause') && UI.active === 'screen-pause') G.resume();

        if (G.state !== 'paused') {
            let dt = realDt;
            if (G.slowT > 0) { G.slowT -= realDt; dt *= G.timeScale; if (G.slowT <= 0) G.timeScale = 1; }
            G.updateAmbient(dt);
            if (G.state === 'playing') G.update(dt);
            HUD.update(realDt);
        }
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        G.renderScale = renderScale;
        G.render(ctx);
        Input.endFrame();
        requestAnimationFrame(loop);
    }
})();
