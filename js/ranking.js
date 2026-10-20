/* =====================================================================
   RANKING: online (JSONBin) com cópia local de segurança.
   Nomes são escapados antes de ir para o HTML (evita injeção de código).
   ===================================================================== */
const Ranking = {
    headers() { return { 'Content-Type': 'application/json', 'X-Master-Key': RANKING_CONFIG.apiKey }; },

    async fetchOnline() {
        const res = await fetch(`${RANKING_CONFIG.url}/latest`, { cache: 'no-cache', headers: this.headers() });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        return Array.isArray(data.record) ? data.record : [];
    },

    getLocal() { return Store.get(RANKING_CONFIG.localKey, []); },

    saveLocal(entry) {
        const list = this.getLocal();
        list.push(entry);
        list.sort((a, b) => b.score - a.score);
        Store.set(RANKING_CONFIG.localKey, list.slice(0, 50));
    },

    async save(entry) {
        this.saveLocal(entry);
        try {
            const list = await this.fetchOnline();
            list.push(entry);
            list.sort((a, b) => b.score - a.score);
            const res = await fetch(RANKING_CONFIG.url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(list.slice(0, 100)) });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return true;
        } catch (err) {
            console.warn('Ranking online indisponível:', err);
            return false;
        }
    },

    async reset() {
        await fetch(RANKING_CONFIG.url, { method: 'PUT', headers: this.headers(), body: JSON.stringify([]) });
    },

    render(list, tbody) {
        if (!list.length) { tbody.innerHTML = '<tr><td colspan="8">Nenhum recorde ainda. Seja o primeiro!</td></tr>'; return; }
        tbody.innerHTML = list.map((e, i) => {
            const k = e.kills || {};
            const total = typeof e.totalKills === 'number' ? e.totalKills : Object.values(k).reduce((a, b) => a + (b || 0), 0);
            const reach = e.stage ? escapeHTML(e.stage) : `Nv ${escapeHTML(e.level ?? '-')}`;
            const insignia = e.hasInsignia ? ' <img src="assets/opt/insigniaBrasil.png" class="insignia" title="Elite: 5+ chefes derrotados" alt="">' : '';
            return `<tr><td>${i + 1}</td><td>${escapeHTML(e.name)}${insignia}</td><td>${formatScore(Number(e.score) || 0)}</td><td>${reach}</td><td>${Number(e.bosses) || 0}</td><td>${escapeHTML(e.time || '-')}</td><td>${escapeHTML(e.difficulty || '-')}</td><td>${total}</td></tr>`;
        }).join('');
    }
};
