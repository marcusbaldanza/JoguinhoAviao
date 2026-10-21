/* =====================================================================
   HUD em DOM — só toca no DOM quando o valor muda (evita custo por quadro)
   ===================================================================== */
const HUD = {
    el: {}, cache: {}, radioT: 0,

    init() {
        const ids = ['hud-lives', 'hud-lives-row', 'boss-strip', 'boss-strip-fill', 'hud-grazes', 'hud-name', 'hud-score', 'hud-mult', 'hud-combo', 'hud-combo-wrap', 'hud-progress', 'hud-progress-wrap', 'hud-boss-wrap', 'hud-boss',
            'hud-boss-ghost', 'hud-boss-name', 'hud-boss-name-small', 'hud-stage', 'hud-stage-name', 'hud-time', 'hud-hp', 'hud-hp-ghost', 'hud-shield', 'hud-hp-text',
            'hud-model', 'lv-cannon', 'lv-engine', 'lv-missile', 'xp-cannon', 'xp-engine', 'xp-missile', 'hud-bombs', 'hud-roll', 'hud-fury', 'radio', 'radio-who', 'radio-text'];
        for (const id of ids) this.el[id] = document.getElementById(id);
    },

    set(id, prop, value) {
        const key = id + '.' + prop;
        if (this.cache[key] === value) return;
        this.cache[key] = value;
        const el = this.el[id];
        if (prop === 'text') el.textContent = value;
        else if (prop === 'width') el.style.width = value;
        else if (prop === 'class') el.className = value;
        else if (prop === 'opacity') el.style.opacity = value;
        else if (prop === 'html') el.innerHTML = value;
        else if (prop === 'hidden') el.classList.toggle('hidden', value);
    },

    show(v) { document.body.classList.toggle('hud-on', v); },

    setAccent(color) { document.documentElement.style.setProperty('--accent', color); },

    flashLives() {
        const el = this.el['hud-lives-row'];
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    },

    radio(who, text) {
        this.el['radio-who'].textContent = who;
        this.el['radio-text'].textContent = text;
        this.el.radio.classList.add('show');
        this.radioT = 4.5;
    },

    pips(id, n, max) {
        this.set(id, 'html', Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''));
    },

    update(dt) {
        const p = G.player;
        if (!p) return;
        if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) this.el.radio.classList.remove('show'); }
        this.set('hud-name', 'text', G.playerName.toUpperCase());
        this.set('hud-score', 'text', formatScore(G.score));
        this.set('hud-mult', 'text', `x${G.mult.toFixed(1)}`);
        this.set('hud-combo', 'width', `${Math.round((G.comboT / 2.4) * 100)}%`);
        this.set('hud-combo-wrap', 'opacity', G.combo > 0 ? '1' : '0.35');
        const st = G.stage;
        if (st) {
            this.set('hud-stage', 'text', `FASE ${st.index + 1}${G.loop ? ' · CICLO ' + (G.loop + 1) : ''}`);
            this.set('hud-stage-name', 'text', st.def.name.toUpperCase());
            this.set('hud-progress', 'width', `${(st.progress * 100).toFixed(1)}%`);
            this.set('hud-boss-name-small', 'text', BOSSES[st.def.boss].name);
        }
        this.set('hud-time', 'text', formatTime(G.playTime));
        const boss = G.boss;
        const bossVisible = !!(boss && boss.state !== 'dead');
        this.set('hud-boss-wrap', 'hidden', !bossVisible);
        this.set('hud-progress-wrap', 'hidden', bossVisible);
        this.set('boss-strip', 'hidden', !bossVisible);
        if (bossVisible) this.set('boss-strip-fill', 'width', `${((boss.hp / boss.maxHp) * 100).toFixed(1)}%`);
        if (G.stats) { this.set('hud-grazes', 'text', `RASANTES ${G.stats.grazes}`); this.set('hud-lives', 'text', formatScore(G.stats.lives || 0)); }
        if (bossVisible) {
            const k = `${((boss.hp / boss.maxHp) * 100).toFixed(1)}%`;
            this.set('hud-boss-name', 'text', boss.def.name + (boss.armored ? ' · BLINDADO' : ''));
            this.set('hud-boss', 'width', k);
            this.set('hud-boss-ghost', 'width', k);
        }
        const hpk = p.hp / p.maxHp;
        this.set('hud-hp', 'width', `${(hpk * 100).toFixed(1)}%`);
        this.set('hud-hp-ghost', 'width', `${(hpk * 100).toFixed(1)}%`);
        this.set('hud-hp', 'class', hpk < 0.3 ? 'low' : hpk < 0.6 ? 'mid' : '');
        this.set('hud-shield', 'width', `${(p.shield / p.shieldMax) * 100}%`);
        this.set('hud-hp-text', 'text', `${Math.ceil(p.hp)}/${Math.round(p.maxHp)}`);
        this.set('hud-model', 'text', p.model.name.toUpperCase());
        for (const k of ['cannon', 'engine', 'missile']) {
            const max = p.isMax(k);
            this.set('lv-' + k, 'text', max ? 'MAX' : String(p.levelOf(k)));
            this.set('xp-' + k, 'width', `${Math.round(p.xpFrac(k) * 100)}%`);
            const cls = 'xp' + (k === 'engine' ? ' eng' : k === 'missile' ? ' mis' : '') + (max ? ' max' : '');
            if (this.cache['xpc' + k] !== cls) { this.cache['xpc' + k] = cls; this.el['xp-' + k].parentElement.className = cls; }
        }
        const bombKey = p.bombs + '/' + p.maxBombs;
        if (this.cache.bombs !== bombKey) {
            this.cache.bombs = bombKey;
            this.el['hud-bombs'].innerHTML = Array.from({ length: p.maxBombs }, (_, i) => `<img src="assets/opt/PWbomba.png" class="${i < p.bombs ? '' : 'empty'}" alt="">`).join('');
        }
        const rollK = p.rollCd > 0 ? 1 - p.rollCd / p.rollCooldown : 1;
        this.set('hud-roll', 'width', `${Math.round(rollK * 100)}%`);
        const furyK = p.furyT > 0 ? p.furyT / PLAYER_CFG.furyDuration : p.fury / PLAYER_CFG.furyMax;
        this.set('hud-fury', 'width', `${Math.round(furyK * 100)}%`);
        this.el['hud-fury'].parentElement.classList.toggle('active', p.furyT > 0);
    }
};
