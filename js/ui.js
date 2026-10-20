/* =====================================================================
   TELAS: menu, briefing (texto datilografado), resultado da fase,
   escolha de melhorias, pausa, configurações, fim de jogo e ranking.
   ===================================================================== */
const UI = {
    $(id) { return document.getElementById(id); },
    active: null,
    returnTo: null,
    typing: null,

    show(id) {
        if (id !== 'screen-clear') this.clearNext = null;
        if (id !== 'screen-perk') this.onPerk = null;
        document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
        if (id) this.$(id).classList.add('active');
        this.active = id;
    },
    showOverlay(id) { this.$(id).classList.add('active'); this.active = id; },
    hideOverlay(id) { this.$(id).classList.remove('active'); },

    init() {
        const diffDesc = {
            recruta: 'Menos dano recebido, inimigos mais fracos, 3 bombas. Pontuação x0.3',
            veterano: 'A experiência equilibrada. 2 bombas. Pontuação x1.0',
            as: 'Inimigos agressivos e resistentes, 1 bomba. Pontuação x1.7'
        };
        const setDiff = (d) => {
            G.difficulty = d;
            document.querySelectorAll('#difficulty button').forEach((b) => b.classList.toggle('on', b.dataset.d === d));
            this.$('diff-desc').textContent = diffDesc[d];
            Store.set('gnc_diff', d);
        };
        document.querySelectorAll('#difficulty button').forEach((b) => b.addEventListener('click', () => { Sound.init(); Sound.ui(); setDiff(b.dataset.d); }));
        setDiff(Store.get('gnc_diff', 'veterano'));
        this.$('player-name').value = Store.get('gnc_name', '');

        this.$('btn-start').addEventListener('click', () => this.tryStart());
        this.$('player-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.tryStart(); });
        this.$('btn-ranking').addEventListener('click', () => this.openRanking('screen-menu'));
        this.$('btn-settings').addEventListener('click', () => this.openSettings('screen-menu'));
        this.$('btn-launch').addEventListener('click', () => this.briefingNext());
        this.$('btn-clear-next').addEventListener('click', () => this.clearNext && this.clearNext());
        this.$('btn-resume').addEventListener('click', () => G.resume());
        this.$('btn-pause-settings').addEventListener('click', () => this.openSettings('screen-pause'));
        this.$('btn-quit').addEventListener('click', () => { this.hideOverlay('screen-pause'); G.gameOver(true); });
        this.$('btn-settings-back').addEventListener('click', () => this.closeSettings());
        this.$('btn-retry').addEventListener('click', () => { Sound.ui(); G.newGame(); });
        this.$('btn-newpilot').addEventListener('click', () => { Sound.ui(); G.toMenu(); });
        this.$('btn-go-ranking').addEventListener('click', () => this.openRanking('screen-gameover'));
        this.$('btn-ranking-back').addEventListener('click', () => { Sound.ui(); this.show(this.rankingReturn || 'screen-menu'); });
        this.$('btn-loop').addEventListener('click', () => { Sound.ui(); G.nextLoop(); });
        this.$('btn-finish').addEventListener('click', () => { Sound.ui(); G.gameOver(false, true); });
        this.$('btn-export').addEventListener('click', () => this.exportRanking());
        this.$('btn-reset-ranking').addEventListener('click', () => this.resetRanking());
        if (!RANKING_CONFIG.allowReset) this.$('btn-reset-ranking').classList.add('hidden');
        document.querySelectorAll('#rank-tabs button').forEach((b) => b.addEventListener('click', () => { Sound.ui(); this.loadRanking(b.dataset.diff, true); }));

        // configurações
        const s = G.settings;
        const bind = (id, key, fn) => {
            const el = this.$(id);
            el.checked = key === 'quality' ? s.quality === 'alta' : !!s[key];
            el.addEventListener('change', () => { s[key] = key === 'quality' ? (el.checked ? 'alta' : 'baixa') : el.checked; G.applySettings(); fn && fn(); });
        };
        bind('set-sound', 'sound'); bind('set-music', 'music'); bind('set-shake', 'shake'); bind('set-autofire', 'autofire'); bind('set-quality', 'quality');

        Input.bindTouchButton(this.$('touch-bomb'), 'bomb');
        Input.bindTouchButton(this.$('touch-roll'), 'roll');
        this.$('touch-pause').addEventListener('click', () => G.pause());

        window.addEventListener('keydown', (e) => {
            if (this.active === 'screen-briefing' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.briefingNext(); }
            else if (this.active === 'screen-clear' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.clearNext && this.clearNext(); }
            else if (this.active === 'screen-perk' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { const i = +e.code.slice(-1) - 1; this.perkChoices && this.perkChoices[i] && this.pickPerk(i); }
            else if (this.active === 'screen-pause' && (e.code === 'Enter')) G.resume();
        });
    },

    tryStart() {
        Sound.init();
        const name = this.$('player-name').value.trim();
        if (!name) { this.$('player-name').focus(); this.$('player-name').style.borderColor = 'var(--danger)'; return; }
        Store.set('gnc_name', name);
        G.playerName = name;
        Sound.ui();
        G.newGame();
    },

    // ---------------------------------------------------------------- briefing
    briefing(kicker, title, paragraphs, prologue, onDone) {
        this.show('screen-briefing');
        this.$('brief-kicker').textContent = kicker;
        this.$('brief-title').textContent = title;
        const box = this.$('brief-text');
        box.innerHTML = '';
        const items = [...(prologue || []).map((t) => ({ t, cls: 'prologue' })), ...paragraphs.map((t) => ({ t: t.replaceAll('{P}', G.playerName.toUpperCase()), cls: '' }))];
        this.onBriefDone = onDone;
        let i = 0, c = 0, p = null;
        clearInterval(this.typing);
        const cursor = document.createElement('span'); cursor.className = 'cursor';
        this.typing = setInterval(() => {
            if (i >= items.length) { clearInterval(this.typing); this.typing = null; cursor.remove(); return; }
            if (!p) { p = document.createElement('p'); p.className = items[i].cls; box.appendChild(p); }
            c += 2;
            p.textContent = items[i].t.slice(0, c);
            p.appendChild(cursor);
            box.scrollTop = box.scrollHeight;
            if (c % 6 === 0) Sound.radio && Math.random() < 0.15 && Sound.tone({ type: 'square', f0: 1400, dur: 0.015, vol: 0.02 });
            if (c >= items[i].t.length) { p.textContent = items[i].t; i++; c = 0; p = null; }
        }, 16);
        this._briefItems = items;
    },
    briefingNext() {
        if (this.typing) { // primeiro clique completa o texto
            clearInterval(this.typing); this.typing = null;
            const box = this.$('brief-text');
            box.innerHTML = this._briefItems.map((it) => `<p class="${it.cls}">${escapeHTML(it.t)}</p>`).join('');
            return;
        }
        Sound.ui();
        const fn = this.onBriefDone; this.onBriefDone = null;
        fn && fn();
    },

    // ---------------------------------------------------------------- fim de fase
    tally(rows, onNext) {
        this.show('screen-clear');
        this.$('tally').innerHTML = rows.map((r, i) => `<div class="tally-row ${r.total ? 'total' : ''}" style="animation-delay:${i * 0.25}s"><span>${escapeHTML(r.label)}</span><b>${escapeHTML(r.value)}</b></div>`).join('');
        this.clearNext = () => { this.clearNext = null; Sound.ui(); onNext(); };
    },

    perks(choices, onPick) {
        this.show('screen-perk');
        this.perkChoices = choices;
        this.onPerk = onPick;
        this.$('perks').innerHTML = choices.map((p, i) => `<div class="perk" data-i="${i}" style="animation-delay:${i * 0.12}s"><div class="ico">${p.icon}</div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.desc)}</p><div class="num">${i + 1}</div></div>`).join('');
        this.$('perks').querySelectorAll('.perk').forEach((el) => el.addEventListener('click', () => this.pickPerk(+el.dataset.i)));
    },
    pickPerk(i) {
        if (!this.onPerk) return;
        const fn = this.onPerk; this.onPerk = null;
        Sound.powerup();
        fn(this.perkChoices[i]);
    },

    // ---------------------------------------------------------------- fim de jogo
    gameOver(r, victory) {
        this.show('screen-gameover');
        this.$('go-title').textContent = victory ? 'MISSÃO ENCERRADA' : 'MISSÃO FRACASSADA';
        this.$('go-title').classList.toggle('danger-text', !victory);
        this.$('go-story').textContent = this.$('go-title').dataset.story || '';
        const kv = (k, v) => `<div class="kv"><span>${escapeHTML(k)}</span><b>${escapeHTML(v)}</b></div>`;
        const kills = Object.entries(r.kills).filter(([, n]) => n > 0).map(([t, n]) => kv(ENEMY_TYPES[t].name, n)).join('') || '<div class="kv"><span>Nenhum</span></div>';
        const pw = Object.entries(r.powerups).filter(([, n]) => n > 0).map(([t, n]) => kv(POWERUP_TYPES[t].label, n)).join('') || '<div class="kv"><span>Nenhum</span></div>';
        this.$('go-report').innerHTML = `
            <div class="big">${formatScore(r.score)}</div>
            ${kv('Combatente', r.name)}${kv('Dificuldade', r.difficulty)}${kv('Alcance', r.stage)}
            ${kv('Tempo de voo', r.time)}${kv('Chefes derrotados', r.bosses)}${kv('Maior combo', 'x' + r.maxCombo)}
            ${kv('Rasantes (graze)', r.grazes)}${kv('Bombas usadas', r.bombsUsed)}
            ${kv('Avião final', r.model)}${kv('Peças coletadas', r.gears)}${kv('Veteranos abatidos', r.elites)}
            <h3>Relatório de abates (${r.totalKills})</h3>${kills}
            <h3>Suprimentos coletados</h3>${pw}
            <div class="kv"><span id="go-save-status">Registrando no ranking...</span></div>`;
    },
    setSaveStatus(ok) {
        const el = this.$('go-save-status');
        if (el) el.textContent = ok ? `Pontuação registrada no ranking do nível ${DIFFICULTY[G.difficulty].label}.` : 'Sem conexão com o ranking — a pontuação será enviada na próxima partida.';
    },

    victory(lines) {
        this.show('screen-victory');
        this.$('victory-text').innerHTML = lines.map((l) => `<p>${escapeHTML(l)}</p>`).join('');
    },

    // ---------------------------------------------------------------- configurações / ranking
    openSettings(from) {
        Sound.init(); Sound.ui();
        this.settingsReturn = from;
        if (from === 'screen-pause') this.hideOverlay('screen-pause');
        else this.show(null);
        this.showOverlay('screen-settings');
    },
    closeSettings() {
        Sound.ui();
        this.hideOverlay('screen-settings');
        if (this.settingsReturn === 'screen-pause') this.showOverlay('screen-pause');
        else this.show(this.settingsReturn || 'screen-menu');
    },

    openRanking(from) {
        Sound.init(); Sound.ui();
        this.rankingReturn = from;
        if (!G.playerName) G.playerName = this.$('player-name').value.trim();
        this.show('screen-ranking');
        this.loadRanking(G.difficulty, false);
    },
    /** um placar por dificuldade; "cached" reaproveita o que já foi baixado ao trocar de aba */
    async loadRanking(diff, cached) {
        this.rankDiff = diff;
        document.querySelectorAll('#rank-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.diff === diff));
        const tbody = this.$('ranking-table').querySelector('tbody');
        const mine = this.$('rank-mine');
        const label = DIFFICULTY[diff].label;
        try {
            if (!cached || !Ranking.boards) { tbody.innerHTML = '<tr><td colspan="8">Carregando ranking...</td></tr>'; mine.textContent = ''; await Ranking.fetchAll(); }
            if (this.rankDiff !== diff) return;
            const list = Ranking.boards[diff];
            Ranking.render(list, tbody, G.playerName);
            const b = Ranking.best(list, G.playerName);
            mine.innerHTML = !G.playerName ? `Ranking do nível <b>${escapeHTML(label)}</b>`
                : b ? `Seu melhor no nível ${escapeHTML(label)}: <b>#${b.pos}</b> com <b>${formatScore(b.entry.score)}</b> pontos`
                : `Você ainda não está no ranking do nível ${escapeHTML(label)}.`;
        } catch {
            tbody.innerHTML = '<tr><td colspan="8">Não foi possível carregar o ranking online. Verifique a conexão.</td></tr>';
            mine.textContent = '';
        }
    },
    async resetRanking() {
        const diff = this.rankDiff || G.difficulty;
        if (!confirm(`Apagar TODOS os recordes do nível ${DIFFICULTY[diff].label}? Isso afeta todos os jogadores e não pode ser desfeito.`)) return;
        try { await Ranking.resetBoard(diff); this.loadRanking(diff, true); } catch { alert('Não foi possível zerar o ranking online.'); }
    },
    exportRanking() {
        if (typeof html2canvas === 'undefined') { alert('Exportação indisponível (sem conexão com a biblioteca html2canvas).'); return; }
        const box = this.$('ranking-table-container');
        const old = box.style.maxHeight;
        box.style.maxHeight = 'none';
        html2canvas(this.$('screen-ranking'), { backgroundColor: '#0b110d', scale: 2 }).then((c) => {
            box.style.maxHeight = old;
            const a = document.createElement('a');
            a.download = 'ranking-guerra-nos-ceus.png';
            a.href = c.toDataURL();
            a.click();
        });
    }
};
