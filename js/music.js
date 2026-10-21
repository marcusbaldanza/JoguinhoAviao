/* =====================================================================
   TRILHA SONORA PROCEDURAL — cada fase tem seu tema, com 3 versões:
     'calm' (briefing: só atmosfera), 'full' (fase), 'boss' (remix acelerado,
     baixo distorcido, bateria dobrada, stabs e lead uma oitava acima).
   O chefe final tem tema próprio. Tudo sintetizado em tempo real.

   Formato das faixas:
     root  = nota MIDI da tônica (oitava do baixo)
     chords[bar] = [deslocamento em semitons, qualidade 'm' | 'M' | '5' | 'd']
     bass.pattern (16 passos): 0 tônica · 3 terça · 5 quinta · 7 sétima · O oitava · 1 segunda menor · . pausa
     lead.notes = [passo (0..63), semitons acima da tônica, duração em passos]
     drums: kick snare hat ohat clap tom tomHi taiko dum tek shaker (16 passos, x = toque, X = acento)
   ===================================================================== */
const MUSIC_TRACKS = {
    // Hino do Corredor — menu, vitória
    menu: {
        bpm: 88, root: 45, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']],
        bass: { wave: 'sawtooth', pattern: '0.......5.......', vol: 0.11, cutoff: 380, decay: 1.2 },
        pad: { wave: 'sawtooth', vol: 0.045, cutoff: 1100, attack: 0.7, octave: 12, voices: 2 },
        arp: { wave: 'triangle', seq: [0, 1, 2, 3, 2, 1], every: 2, octave: 24, vol: 0.035, decay: 0.5 },
        lead: { wave: 'triangle', octave: 24, vol: 0.06, attack: 0.05, vibrato: 5,
            notes: [[0, 7, 6], [6, 8, 2], [8, 7, 4], [12, 3, 4], [16, 12, 6], [22, 10, 2], [24, 8, 8], [32, 7, 6], [38, 3, 2], [40, 5, 4], [44, 7, 4], [48, 10, 6], [54, 7, 2], [56, 5, 8]] },
        drums: { taiko: 'x...............', shaker: '....x.......x...' },
        delay: 0.35
    },
    // Fase 1 — Céus em Chamas: rock de guerra em Mi menor
    stage1: {
        bpm: 136, root: 40, chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'm']],
        bass: { wave: 'sawtooth', pattern: '0.0.0O0.0.0.0O5.', vol: 0.12, cutoff: 900, decay: 0.18 },
        pad: { wave: 'sawtooth', vol: 0.035, cutoff: 1500, attack: 0.05, octave: 12, voices: 2, quality: '5' },
        arp: { wave: 'square', seq: [0, 2, 3, 2], every: 2, octave: 24, vol: 0.022, decay: 0.12, cutoff: 2400 },
        lead: { wave: 'square', octave: 24, vol: 0.045, cutoff: 3000,
            notes: [[0, 7, 3], [3, 10, 1], [4, 12, 4], [8, 14, 2], [10, 12, 2], [12, 10, 4], [16, 7, 3], [19, 8, 1], [20, 7, 4], [24, 3, 4], [28, 5, 4], [32, 10, 3], [35, 12, 1], [36, 14, 4], [40, 17, 2], [42, 14, 2], [44, 12, 4], [48, 14, 4], [52, 12, 2], [54, 10, 2], [56, 7, 8]] },
        drums: { kick: 'x.....x.x.....x.', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..............x.' },
        delay: 0.15
    },
    // Fase 2 — Cidade às Escuras: darksynth em Dó menor, pulsante e sombrio
    stage2: {
        bpm: 108, root: 36, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-5, 'M']],
        bass: { wave: 'sawtooth', pattern: '0000000000000000', vol: 0.09, cutoff: 320, decay: 0.12 },
        pad: { wave: 'sawtooth', vol: 0.05, cutoff: 800, attack: 0.9, octave: 12, voices: 3 },
        arp: { wave: 'sine', seq: [0, 1, 2, 3, 4, 3, 2, 1], every: 1, octave: 24, vol: 0.03, decay: 0.15 },
        lead: { wave: 'triangle', octave: 24, vol: 0.05, attack: 0.15, vibrato: 7,
            notes: [[0, 15, 8], [8, 14, 8], [16, 12, 12], [32, 15, 6], [38, 17, 2], [40, 19, 8], [48, 14, 16]] },
        drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'x.xxx.xxx.xxx.xx' },
        delay: 0.45
    },
    // Fase 3 — Floresta Silenciosa: Ré dórico, tambores tribais, flauta e marimba
    stage3: {
        bpm: 116, root: 38, chords: [[0, 'm'], [5, 'M'], [0, 'm'], [-2, 'M']],
        bass: { wave: 'triangle', pattern: '0.....0...5.....', vol: 0.16, cutoff: 700, decay: 0.4 },
        pad: { wave: 'triangle', vol: 0.045, cutoff: 1200, attack: 0.6, octave: 12, voices: 2 },
        arp: { wave: 'sine', seq: [0, 2, 1, 3, 2, 4, 3, 5], every: 1, octave: 24, vol: 0.04, decay: 0.1 },
        lead: { wave: 'triangle', octave: 24, vol: 0.06, attack: 0.08, vibrato: 6,
            notes: [[0, 12, 4], [4, 10, 2], [6, 7, 2], [8, 10, 8], [16, 12, 3], [19, 15, 1], [20, 17, 4], [24, 15, 4], [28, 12, 4], [32, 10, 6], [38, 7, 2], [40, 5, 8], [48, 7, 4], [52, 10, 4], [56, 12, 8]] },
        drums: { kick: 'x.......x.......', tom: 'x..x..x...x.x...', tomHi: '......x.......x.', shaker: 'xxxxxxxxxxxxxxxx' },
        delay: 0.3
    },
    // Fase 4 — Deserto de Fogo: escala Hijaz (Mi), darbuka e alaúde dedilhado
    stage4: {
        bpm: 140, root: 40, chords: [[0, 'M'], [1, 'M'], [0, 'M'], [-2, 'm']],
        bass: { wave: 'sawtooth', pattern: '0..0..1.0..0.5..', vol: 0.12, cutoff: 650, decay: 0.2 },
        pad: { wave: 'sawtooth', vol: 0.03, cutoff: 900, attack: 0.4, octave: 12, voices: 2 },
        arp: { wave: 'sawtooth', seq: [0, 1, 2, 1], every: 2, octave: 24, vol: 0.02, decay: 0.08, cutoff: 1800 },
        lead: { wave: 'sawtooth', octave: 24, vol: 0.055, decay: 0.22, cutoff: 2600, pluck: true,
            notes: [[0, 12, 2], [2, 13, 1], [3, 12, 1], [4, 10, 2], [6, 8, 2], [8, 7, 4], [12, 8, 1], [13, 7, 1], [14, 5, 2], [16, 4, 2], [18, 5, 2], [20, 7, 2], [22, 8, 2], [24, 7, 6], [30, 5, 2], [32, 12, 2], [34, 13, 2], [36, 16, 4], [40, 13, 2], [42, 12, 2], [44, 10, 2], [46, 8, 2], [48, 7, 2], [50, 5, 2], [52, 4, 2], [54, 1, 2], [56, 0, 8]] },
        drums: { dum: 'x.....x...x.....', tek: '..x.x...x...x.x.', kick: 'x.......x.......', clap: '............x...', shaker: 'x.x.x.x.x.x.x.x.' },
        delay: 0.2
    },
    // Fase 5 — Mar da Flotilha: épico em Lá menor, coral e taikos
    stage5: {
        bpm: 146, root: 33, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']],
        bass: { wave: 'sawtooth', pattern: '0.0.0.0.0.0.O.0.', vol: 0.13, cutoff: 700, decay: 0.2 },
        pad: { wave: 'sawtooth', vol: 0.06, cutoff: 1600, attack: 0.35, octave: 24, voices: 3 },
        arp: { wave: 'square', seq: [0, 1, 2, 3], every: 1, octave: 36, vol: 0.016, decay: 0.07, cutoff: 3000 },
        lead: { wave: 'sawtooth', octave: 36, vol: 0.045, cutoff: 3200, vibrato: 4,
            notes: [[0, 0, 4], [4, 3, 2], [6, 7, 2], [8, 12, 6], [14, 10, 2], [16, 8, 4], [20, 7, 2], [22, 8, 2], [24, 12, 8], [32, 7, 4], [36, 10, 2], [38, 12, 2], [40, 15, 6], [46, 14, 2], [48, 12, 4], [52, 10, 4], [56, 14, 8]] },
        drums: { kick: 'x..x..x.x..x....', snare: '....X.......X...', tom: '..............xx', hat: 'x.x.x.x.x.x.x.x.', taiko: 'x.......x.......' },
        delay: 0.25
    },
    // Fase 2 — Campos de Tendas: lamento em Ré frígio, tambor de moldura e ney (flauta de cana)
    camp: {
        bpm: 96, root: 38, chords: [[0, 'm'], [1, 'M'], [0, 'm'], [-2, 'm']],
        bass: { wave: 'triangle', pattern: '0.......0...1...', vol: 0.15, cutoff: 600, decay: 0.6 },
        pad: { wave: 'sawtooth', vol: 0.035, cutoff: 700, attack: 1.0, octave: 12, voices: 3 },
        arp: { wave: 'sine', seq: [0, 1, 2, 1], every: 4, octave: 24, vol: 0.03, decay: 0.3 },
        lead: { wave: 'triangle', octave: 24, vol: 0.06, attack: 0.12, vibrato: 9,
            notes: [[0, 12, 6], [6, 13, 2], [8, 12, 4], [12, 10, 4], [16, 8, 6], [22, 7, 2], [24, 8, 8], [32, 7, 4], [36, 8, 2], [38, 10, 2], [40, 12, 8], [48, 13, 4], [52, 12, 4], [56, 7, 8]] },
        drums: { dum: 'x.......x.x.....', tek: '....x.......x..x', shaker: '..x...x...x...x.' },
        delay: 0.4
    },
    // Fase 4 — Hospital Sitiado: tensão em Fá menor, batida de coração, cordas pulsantes
    hospital: {
        bpm: 100, root: 41, chords: [[0, 'm'], [-4, 'M'], [-7, 'm'], [-5, 'M']],
        bass: { wave: 'sawtooth', pattern: '0.0.....0.0.....', vol: 0.13, cutoff: 420, decay: 0.2 },
        pad: { wave: 'sawtooth', vol: 0.045, cutoff: 1000, attack: 0.5, octave: 12, voices: 3 },
        arp: { wave: 'square', seq: [3, 2, 1, 2], every: 2, octave: 24, vol: 0.018, decay: 0.1, cutoff: 1800 },
        lead: { wave: 'sine', octave: 36, vol: 0.05, attack: 0.02, decay: 0.6,
            notes: [[0, 7, 4], [4, 8, 4], [8, 7, 4], [12, 3, 4], [16, 8, 4], [20, 7, 4], [24, 5, 8], [32, 3, 4], [36, 5, 4], [40, 7, 8], [48, 8, 4], [52, 10, 4], [56, 7, 8]] },
        drums: { kick: 'x..x............', tom: '........x.......', hat: '..x...x...x...x.', ohat: '..............x.' },
        delay: 0.35
    },
    // Fase 6 — A Travessia do Rio: folk acelerado em Sol menor, flauta e percussão de mãos
    river: {
        bpm: 124, root: 43, chords: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 'M']],
        bass: { wave: 'triangle', pattern: '0..5..0.0..5..O.', vol: 0.15, cutoff: 800, decay: 0.3 },
        pad: { wave: 'triangle', vol: 0.04, cutoff: 1400, attack: 0.3, octave: 12, voices: 2 },
        arp: { wave: 'sine', seq: [0, 1, 2, 3, 2, 1], every: 1, octave: 24, vol: 0.03, decay: 0.09 },
        lead: { wave: 'triangle', octave: 24, vol: 0.06, attack: 0.04, vibrato: 6,
            notes: [[0, 7, 2], [2, 10, 2], [4, 12, 4], [8, 10, 2], [10, 12, 2], [12, 14, 4], [16, 15, 4], [20, 14, 2], [22, 12, 2], [24, 10, 8], [32, 12, 2], [34, 10, 2], [36, 7, 4], [40, 5, 2], [42, 7, 2], [44, 10, 4], [48, 12, 4], [52, 14, 4], [56, 12, 8]] },
        drums: { dum: 'x..x..x...x..x..', tek: '..x..x..x..x..x.', kick: 'x.......x.......', shaker: 'xxxxxxxxxxxxxxxx' },
        delay: 0.25
    },
    // Fase 8 — Céu de Ferro: industrial em Dó# menor, pesado e implacável
    ironsky: {
        bpm: 150, root: 37, chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']],
        bass: { wave: 'sawtooth', pattern: '0.00.00.0.00.0O.', vol: 0.12, cutoff: 900, decay: 0.12, drive: true },
        pad: { wave: 'square', vol: 0.03, cutoff: 1200, attack: 0.2, octave: 12, voices: 2, quality: '5' },
        arp: { wave: 'sawtooth', seq: [0, 3, 2, 1], every: 1, octave: 24, vol: 0.016, decay: 0.06, cutoff: 2200 },
        lead: { wave: 'sawtooth', octave: 24, vol: 0.045, cutoff: 2600, drive: true,
            notes: [[0, 12, 3], [3, 15, 3], [6, 14, 2], [8, 12, 8], [16, 8, 3], [19, 10, 3], [22, 12, 2], [24, 7, 8], [32, 12, 3], [35, 15, 3], [38, 17, 2], [40, 19, 8], [48, 17, 4], [52, 15, 4], [56, 14, 8]] },
        drums: { kick: 'x..x..x.x.x..x..', snare: '....X.......X...', clap: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', taiko: 'x...............' },
        delay: 0.12
    },
    // Fase 9 — Porto da Esperança: hino esperançoso em Si bemol maior
    port: {
        bpm: 132, root: 34, chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']],
        bass: { wave: 'sawtooth', pattern: '0...0.0.0...0.5.', vol: 0.12, cutoff: 750, decay: 0.25 },
        pad: { wave: 'sawtooth', vol: 0.055, cutoff: 1700, attack: 0.4, octave: 24, voices: 3 },
        arp: { wave: 'square', seq: [0, 1, 2, 3, 2, 1], every: 2, octave: 36, vol: 0.016, decay: 0.08, cutoff: 3000 },
        lead: { wave: 'square', octave: 36, vol: 0.045, cutoff: 3200, vibrato: 4,
            notes: [[0, 7, 4], [4, 9, 2], [6, 11, 2], [8, 12, 6], [14, 14, 2], [16, 14, 4], [20, 12, 4], [24, 11, 8], [32, 9, 4], [36, 12, 4], [40, 16, 6], [46, 14, 2], [48, 12, 4], [52, 14, 4], [56, 12, 8]] },
        drums: { kick: 'x.......x.x.....', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', taiko: 'x...............', tom: '..............xx' },
        delay: 0.3
    },
    // Chefe final — O Arquiteto: Ré menor, órgão, baixo distorcido
    final: {
        bpm: 160, root: 38, chords: [[0, 'm'], [-4, 'M'], [5, 'm'], [7, 'M']],
        bass: { wave: 'sawtooth', pattern: '0O0O0O0O0O0O0O5O', vol: 0.12, cutoff: 1300, decay: 0.12, drive: true },
        pad: { wave: 'square', vol: 0.04, cutoff: 1800, attack: 0.05, octave: 12, voices: 2 },
        arp: { wave: 'sawtooth', seq: [0, 1, 2, 3, 2, 1], every: 1, octave: 24, vol: 0.02, decay: 0.08, cutoff: 2600 },
        lead: { wave: 'sawtooth', octave: 24, vol: 0.05, cutoff: 3500, drive: true,
            notes: [[0, 12, 2], [2, 13, 2], [4, 12, 2], [6, 10, 2], [8, 9, 4], [12, 7, 4], [16, 5, 4], [20, 7, 2], [22, 9, 2], [24, 10, 8], [32, 7, 2], [34, 8, 2], [36, 10, 4], [40, 12, 4], [44, 13, 4], [48, 16, 6], [54, 13, 2], [56, 12, 8]] },
        stab: { pattern: '..x...x...x..x.x', vol: 0.03 },
        drums: { kick: 'x..xx..xx..xx..x', snare: '....X.......X...', hat: 'xxxxxxxxxxxxxxxx', taiko: 'x.......x.....x.', clap: '....x.......x..x' },
        delay: 0.15, noRemix: true
    }
};

const MUSIC_JINGLES = {
    clear: { bpm: 140, notes: [[0, 67, 1], [1, 72, 1], [2, 76, 1], [3, 79, 3], [6, 76, 1], [7, 79, 6]], chord: [60, 64, 67, 72], wave: 'square' },
    gameover: { bpm: 70, notes: [[0, 64, 2], [2, 62, 2], [4, 60, 2], [6, 59, 6]], chord: [45, 52, 57, 60], wave: 'triangle' }
};

/** versão "chefe": mais rápida, mais pesada */
function remixForBoss(t) {
    const r = JSON.parse(JSON.stringify(t));
    r.bpm = Math.min(176, Math.round(t.bpm * 1.18));
    r.bass.pattern = '0O0O0O0O0O0O5O0O';
    r.bass.drive = true; r.bass.cutoff = Math.max(900, t.bass.cutoff * 1.6); r.bass.decay = 0.11;
    r.arp.every = 1; r.arp.vol *= 1.1;
    r.lead.octave += 12; r.lead.drive = true; r.lead.vol *= 0.85;
    r.stab = { pattern: '..x...x...x...x.', vol: 0.028 };
    r.drums = Object.assign({}, t.drums, { kick: 'x..x..x.x..x..x.', snare: '....X.......X.xx', hat: 'xxxxxxxxxxxxxxxx', clap: '....x.......x...' });
    r.delay = 0.12;
    return r;
}

/* ------------------------------------------------------------------ motor */
Object.assign(Sound, {
    music: { timer: null, step: 0, nextTime: 0, name: '', variant: '', track: null },
    _cache: {},

    _musicNodes() {
        if (this._mn) return this._mn;
        const c = this.ctx;
        const delay = c.createDelay(1.5), fb = c.createGain(), wet = c.createGain(), send = c.createGain();
        fb.gain.value = 0.32; wet.gain.value = 0.5;
        send.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.musicBus);
        const drive = c.createWaveShaper();
        const n = 1024, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; curve[i] = Math.tanh(x * 3.2) * 0.8; }
        drive.curve = curve; drive.oversample = '2x';
        const driveOut = c.createGain(); driveOut.gain.value = 0.7;
        drive.connect(driveOut).connect(this.musicBus);
        this._mn = { delay, send, drive };
        return this._mn;
    },

    playMusic(name, variant = 'full') {
        if (!this.ctx) { this._pending = [name, variant]; return; }
        if (this.music.name === name && this.music.variant === variant) return;
        const base = MUSIC_TRACKS[name] || MUSIC_TRACKS.menu;
        const key = name + ':' + variant;
        let track = this._cache[key];
        if (!track) track = this._cache[key] = variant === 'boss' && !base.noRemix ? remixForBoss(base) : base;
        const m = this.music;
        m.name = name; m.variant = variant; m.track = track; m.step = 0;
        this._musicNodes().delay.delayTime.value = (60 / track.bpm) * 0.75;
        const now = this.ctx.currentTime;
        this.musicBus.gain.cancelScheduledValues(now);
        this.musicBus.gain.setValueAtTime(0.0001, now);
        this.musicBus.gain.linearRampToValueAtTime(this.musicOn ? 0.32 : 0, now + 0.4);
        m.nextTime = now + 0.08;
        if (!m.timer) m.timer = setInterval(() => this._schedule(), 25);
    },
    stopMusic() { this.music.name = ''; this.music.track = null; },

    jingle(name) {
        this.stopMusic();
        if (!this.ctx) return;
        const j = MUSIC_JINGLES[name], step = 60 / j.bpm / 2, t0 = this.ctx.currentTime + 0.05;
        for (const [s, midi, len] of j.notes) this._note(t0 + s * step, midi, len * step, { wave: j.wave, vol: 0.07, cutoff: 3000, bus: this.musicBus });
        for (const midi of j.chord) this._note(t0, midi, step * 8, { wave: 'sawtooth', vol: 0.035, cutoff: 1400, attack: 0.3, voices: 2, bus: this.musicBus });
        this.musicBus.gain.setValueAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime);
    },

    _mf(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },

    /** voz sintetizada: osciladores (com desafinação) → filtro → envelope */
    _note(t, midi, dur, o) {
        const c = this.ctx, f = this._mf(midi);
        const g = c.createGain(), flt = c.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(o.cutoff || 2000, t);
        if (o.pluck) flt.frequency.exponentialRampToValueAtTime(Math.max(200, (o.cutoff || 2000) * 0.25), t + dur);
        flt.Q.value = o.q || 0.7;
        const vol = o.vol || 0.05, atk = o.attack || 0.005, rel = o.decay !== undefined ? Math.min(o.decay, dur + 0.3) : dur;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + atk);
        if (o.decay !== undefined) g.gain.exponentialRampToValueAtTime(0.0001, t + atk + rel);
        else { g.gain.setValueAtTime(vol, t + Math.max(atk, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12); }
        const end = t + atk + (o.decay !== undefined ? rel : dur + 0.15) + 0.05;
        const voices = o.voices || 1;
        for (let v = 0; v < voices; v++) {
            const osc = c.createOscillator();
            osc.type = o.wave || 'sawtooth';
            osc.frequency.setValueAtTime(f, t);
            osc.detune.value = voices > 1 ? (v - (voices - 1) / 2) * 12 : 0;
            if (o.vibrato) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = o.vibrato; lfo.connect(lg).connect(osc.detune); lfo.start(t + 0.12); lfo.stop(end); }
            osc.connect(flt);
            osc.start(t); osc.stop(end);
        }
        flt.connect(g);
        const out = o.drive ? this._musicNodes().drive : (o.bus || this.musicBus);
        g.connect(out);
        if (o.send) { const s = c.createGain(); s.gain.value = o.send; g.connect(s).connect(this._musicNodes().send); }
    },

    _drum(kind, t, accent) {
        const v = accent ? 1.25 : 1, bus = this.musicBus, c = this.ctx;
        switch (kind) {
            case 'kick': this.tone({ type: 'sine', f0: 150, f1: 42, dur: 0.22, vol: 0.45 * v, delay: t - c.currentTime, bus }); break;
            case 'snare': this.noiseHit({ dur: 0.17, vol: 0.18 * v, f0: 2200, f1: 1200, type: 'bandpass', q: 0.8, delay: t - c.currentTime, bus }); this.tone({ type: 'triangle', f0: 200, f1: 150, dur: 0.1, vol: 0.12 * v, delay: t - c.currentTime, bus }); break;
            case 'hat': this.noiseHit({ dur: 0.035, vol: 0.05 * v, f0: 9000, f1: 7000, type: 'highpass', delay: t - c.currentTime, bus }); break;
            case 'ohat': this.noiseHit({ dur: 0.22, vol: 0.05 * v, f0: 8000, f1: 6000, type: 'highpass', delay: t - c.currentTime, bus }); break;
            case 'clap': for (let i = 0; i < 3; i++) this.noiseHit({ dur: 0.06 + i * 0.03, vol: 0.12 * v, f0: 1400, f1: 900, type: 'bandpass', q: 1.2, delay: t - c.currentTime + i * 0.011, bus }); break;
            case 'tom': this.tone({ type: 'sine', f0: 190, f1: 95, dur: 0.28, vol: 0.28 * v, delay: t - c.currentTime, bus }); break;
            case 'tomHi': this.tone({ type: 'sine', f0: 300, f1: 170, dur: 0.18, vol: 0.2 * v, delay: t - c.currentTime, bus }); break;
            case 'taiko': this.tone({ type: 'sine', f0: 90, f1: 38, dur: 0.6, vol: 0.5 * v, delay: t - c.currentTime, bus }); this.noiseHit({ dur: 0.25, vol: 0.12 * v, f0: 500, f1: 120, delay: t - c.currentTime, bus }); break;
            case 'dum': this.tone({ type: 'sine', f0: 130, f1: 70, dur: 0.3, vol: 0.38 * v, delay: t - c.currentTime, bus }); break;
            case 'tek': this.noiseHit({ dur: 0.03, vol: 0.12 * v, f0: 4000, f1: 3200, type: 'bandpass', q: 3, delay: t - c.currentTime, bus }); this.tone({ type: 'sine', f0: 950, f1: 800, dur: 0.04, vol: 0.06 * v, delay: t - c.currentTime, bus }); break;
            case 'shaker': this.noiseHit({ dur: 0.045, vol: 0.025 * v, f0: 6500, f1: 5500, type: 'bandpass', q: 2, delay: t - c.currentTime, bus }); break;
        }
    },

    _chordTones(chord, quality) {
        const q = quality || chord[1];
        const third = q === 'm' || q === 'd' ? 3 : 4, fifth = q === 'd' ? 6 : 7;
        if (q === '5') return [0, 7, 12, 19].map((x) => x + chord[0]);
        return [0, third, fifth, 12, 12 + third, 12 + fifth].map((x) => x + chord[0]);
    },

    _schedule() {
        const m = this.music, tr = m.track;
        if (!this.ctx || !tr || !this.enabled) return;
        const step = 60 / tr.bpm / 4;
        const calm = m.variant === 'calm';
        const bars = tr.chords.length, total = bars * 16;
        // se a aba ficou em segundo plano, não tenta "recuperar" notas atrasadas
        if (m.nextTime < this.ctx.currentTime - 0.2) m.nextTime = this.ctx.currentTime + 0.05;
        while (m.nextTime < this.ctx.currentTime + 0.12) {
            const t = m.nextTime, s = m.step % 16, bar = Math.floor(m.step / 16) % bars, pos = m.step % total;
            const chord = tr.chords[bar];
            const tones = this._chordTones(chord);
            const R = tr.root;
            // PAD (acorde sustentado no início de cada compasso)
            if (s === 0) {
                const pt = this._chordTones(chord, tr.pad.quality).slice(0, 4);
                for (const x of pt) this._note(t, R + tr.pad.octave + x, step * 16, { wave: tr.pad.wave, vol: tr.pad.vol * (calm ? 1.2 : 1), cutoff: tr.pad.cutoff, attack: tr.pad.attack, voices: tr.pad.voices, send: 0.2 });
            }
            // BAIXO
            const bc = calm ? (s === 0 ? '0' : '.') : tr.bass.pattern[s];
            if (bc && bc !== '.') {
                const semi = chord[0] + (bc === '3' ? tones[1] - chord[0] : bc === '5' ? 7 : bc === 'O' ? 12 : bc === '7' ? 10 : bc === '1' ? 1 : 0);
                this._note(t, R + semi, step * (calm ? 16 : 1), { wave: tr.bass.wave, vol: tr.bass.vol * (calm ? 0.8 : 1), cutoff: tr.bass.cutoff, decay: calm ? 2 : tr.bass.decay, drive: !calm && tr.bass.drive });
            }
            // ARPEJO
            if (s % tr.arp.every === 0 && (!calm || s % 2 === 0)) {
                const idx = tr.arp.seq[Math.floor(m.step / tr.arp.every) % tr.arp.seq.length];
                this._note(t, R + tr.arp.octave + tones[idx % tones.length], step * tr.arp.every, { wave: tr.arp.wave, vol: tr.arp.vol * (calm ? 0.8 : 1), cutoff: tr.arp.cutoff || 2500, decay: tr.arp.decay, send: 0.35 });
            }
            // MELODIA (na versão calma só nas voltas pares, mais suave)
            if (!calm || Math.floor(m.step / total) % 2 === 1) {
                for (const [ns, semi, len] of tr.lead.notes) if (ns === pos) {
                    this._note(t, R + tr.lead.octave + semi, step * len, { wave: tr.lead.wave, vol: tr.lead.vol * (calm ? 0.6 : 1), cutoff: tr.lead.cutoff || 2500, attack: tr.lead.attack || 0.01, decay: tr.lead.pluck ? (tr.lead.decay || 0.25) : undefined, pluck: tr.lead.pluck, vibrato: tr.lead.vibrato, drive: !calm && tr.lead.drive, send: tr.delay || 0.2 });
                }
            }
            if (!calm) {
                // STABS (versão chefe)
                if (tr.stab && tr.stab.pattern[s] === 'x') for (const x of tones.slice(0, 3)) this._note(t, R + 24 + x, step * 0.8, { wave: 'sawtooth', vol: tr.stab.vol, cutoff: 2600, decay: 0.12 });
                // BATERIA
                for (const [k, pat] of Object.entries(tr.drums)) { const ch = pat[s]; if (ch === 'x' || ch === 'X') this._drum(k, t, ch === 'X'); }
                // virada no último compasso
                if (bar === bars - 1 && s >= 12 && (tr.drums.snare || tr.drums.tom)) this._drum(tr.drums.snare ? 'snare' : 'tom', t + step / 2, false);
            }
            m.nextTime += step;
            m.step++;
        }
    }
});
