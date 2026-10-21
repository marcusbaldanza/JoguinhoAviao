/* =====================================================================
   RANKING ONLINE (JSONBin) — um placar separado para cada dificuldade.
   Formato no servidor: { recruta: [...], veterano: [...], as: [...] }
   (placares antigos em formato de lista são convertidos automaticamente)
   Se a internet falhar, a pontuação fica guardada e é enviada na próxima vez.
   Nomes são escapados antes de ir para o HTML (evita injeção de código).
   ===================================================================== */
const DIFF_KEYS = ['recruta', 'veterano', 'as'];
const PENDING_KEY = 'gnc_ranking_pending';

const Ranking = {
    boards: null,

    headers() { return { 'Content-Type': 'application/json', 'X-Master-Key': RANKING_CONFIG.apiKey }; },

    keyOf(entry) {
        if (DIFF_KEYS.includes(entry.diffKey)) return entry.diffKey;
        const label = String(entry.difficulty || '').toLowerCase();
        if (label.startsWith('rec')) return 'recruta';
        if (label.startsWith('ás') || label === 'as') return 'as';
        return 'veterano'; // registros antigos sem dificuldade
    },

    normalize(record) {
        const b = { recruta: [], veterano: [], as: [] };
        if (Array.isArray(record)) for (const e of record) b[this.keyOf(e)].push(e);
        else if (record && typeof record === 'object') for (const k of DIFF_KEYS) if (Array.isArray(record[k])) b[k] = record[k];
        for (const k of DIFF_KEYS) b[k].sort((x, y) => (y.score || 0) - (x.score || 0));
        return b;
    },

    async fetchAll() {
        const res = await fetch(`${RANKING_CONFIG.url}/latest`, { cache: 'no-cache', headers: this.headers() });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        this.boards = this.normalize(data.record);
        return this.boards;
    },

    async push(boards) {
        const res = await fetch(RANKING_CONFIG.url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(boards) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.boards = boards;
    },

    async save(entry) {
        const pending = Store.get(PENDING_KEY, []);
        pending.push(entry);
        try {
            const boards = await this.fetchAll();
            for (const e of pending) {
                const k = this.keyOf(e);
                boards[k].push(e);
                boards[k].sort((x, y) => y.score - x.score);
                boards[k] = boards[k].slice(0, 100);
            }
            await this.push(boards);
            Store.set(PENDING_KEY, []);
            return true;
        } catch (err) {
            console.warn('Ranking online indisponível — pontuação guardada para envio posterior:', err);
            Store.set(PENDING_KEY, pending.slice(-20));
            return false;
        }
    },

    async resetBoard(key) {
        const boards = await this.fetchAll();
        boards[key] = [];
        await this.push(boards);
    },

    /** posição do melhor resultado do jogador (pelo nome) */
    best(list, name) {
        const n = String(name || '').trim().toLowerCase();
        if (!n) return null;
        const i = list.findIndex((e) => String(e.name || '').trim().toLowerCase() === n);
        return i < 0 ? null : { pos: i + 1, entry: list[i] };
    },

    render(list, tbody, me) {
        if (!list.length) { tbody.innerHTML = '<tr><td colspan="8">Nenhum recorde neste nível ainda. Seja o primeiro!</td></tr>'; return; }
        const meN = String(me || '').trim().toLowerCase();
        tbody.innerHTML = list.slice(0, 100).map((e, i) => {
            const k = e.kills || {};
            const total = typeof e.totalKills === 'number' ? e.totalKills : Object.values(k).reduce((a, b) => a + (b || 0), 0);
            const reach = e.stage ? escapeHTML(e.stage) : `Nv ${escapeHTML(e.level ?? '-')}`;
            const insignia = e.hasInsignia ? ' <img src="assets/opt/insigniaBrasil.png" class="insignia" title="Elite: 5+ chefes derrotados" alt="">' : '';
            const mine = meN && String(e.name || '').trim().toLowerCase() === meN ? ' class="me"' : '';
            return `<tr${mine}><td>${i + 1}</td><td>${escapeHTML(e.name)}${insignia}</td><td>${formatScore(Number(e.score) || 0)}</td><td>${reach}</td><td>${Number(e.bosses) || 0}</td><td>${total}</td><td class="lives">${e.lives === undefined ? '-' : formatScore(Number(e.lives) || 0)}</td><td>${escapeHTML(e.time || '-')}</td></tr>`;
        }).join('');
    }
};
