/* =====================================================================
   Áudio 100% procedural (Web Audio API) — sem arquivos externos.
   Efeitos: tiros, impactos, explosões, alarme, laser, power-up...
   Música: sequenciador simples com baixo + percussão, muda no chefe.
   ===================================================================== */
const Sound = {
    ctx: null, master: null, sfxBus: null, musicBus: null, noise: null,
    enabled: true, musicOn: true, last: {},

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.55 : 0;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        this.master.connect(comp).connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicOn ? 0.32 : 0; this.musicBus.connect(this.master);
        const len = this.ctx.sampleRate * 1.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (this._pending) { const [n, v] = this._pending; this._pending = null; this.playMusic(n, v); }
    },

    setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.55 : 0; },
    setMusic(v) { this.musicOn = v; if (this.musicBus) this.musicBus.gain.value = v ? 0.32 : 0; },

    /** limita repetição do mesmo som (evita "chiado" com muitos tiros) */
    throttle(name, ms) {
        const now = performance.now();
        if (this.last[name] && now - this.last[name] < ms) return false;
        this.last[name] = now;
        return true;
    },

    tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.2, delay = 0, bus = this.sfxBus }) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(bus);
        o.start(t); o.stop(t + dur + 0.02);
    },

    noiseHit({ dur = 0.2, vol = 0.3, f0 = 2000, f1 = 200, q = 1, type = 'lowpass', delay = 0, bus = this.sfxBus }) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noise;
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(bus);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    },

    // --- efeitos -------------------------------------------------------------
    shot() { if (this.throttle('shot', 70)) { this.noiseHit({ dur: 0.06, vol: 0.12, f0: 5000, f1: 1500, type: 'bandpass', q: 2 }); this.tone({ type: 'square', f0: 900, f1: 300, dur: 0.05, vol: 0.03 }); } },
    missile() { if (this.throttle('missile', 120)) this.noiseHit({ dur: 0.35, vol: 0.1, f0: 800, f1: 3000, type: 'bandpass', q: 3 }); },
    enemyShot() { if (this.throttle('eshot', 90)) this.tone({ type: 'sawtooth', f0: 520, f1: 260, dur: 0.08, vol: 0.035 }); },
    hit() { if (this.throttle('hit', 45)) this.noiseHit({ dur: 0.05, vol: 0.09, f0: 3500, f1: 2000, type: 'highpass' }); },
    graze() { if (this.throttle('graze', 90)) this.tone({ type: 'sine', f0: 1800, f1: 2400, dur: 0.05, vol: 0.04 }); },
    explosion(size = 1) {
        if (!this.throttle('exp' + (size > 1.5 ? 'b' : 's'), 50)) return;
        this.noiseHit({ dur: 0.5 * size, vol: 0.35 * Math.min(1.5, size), f0: 1400, f1: 60 });
        this.tone({ type: 'sine', f0: 120, f1: 30, dur: 0.4 * size, vol: 0.35 * Math.min(1.4, size) });
    },
    bigExplosion() {
        this.noiseHit({ dur: 2.2, vol: 0.6, f0: 2200, f1: 40 });
        this.tone({ type: 'sine', f0: 90, f1: 22, dur: 1.8, vol: 0.6 });
        this.noiseHit({ dur: 1.2, vol: 0.3, f0: 400, f1: 60, delay: 0.25 });
    },
    playerHit() { this.noiseHit({ dur: 0.25, vol: 0.4, f0: 1500, f1: 100 }); this.tone({ type: 'square', f0: 220, f1: 60, dur: 0.25, vol: 0.12 }); },
    shieldHit() { this.tone({ type: 'sine', f0: 1200, f1: 400, dur: 0.2, vol: 0.15 }); },
    powerup() { [0, 0.07, 0.14].forEach((d, i) => this.tone({ type: 'triangle', f0: 520 * (1 + i * 0.26), f1: 1040 * (1 + i * 0.26), dur: 0.12, vol: 0.14, delay: d })); },
    bomb() { this.tone({ type: 'sawtooth', f0: 1600, f1: 80, dur: 0.9, vol: 0.18 }); this.noiseHit({ dur: 1.8, vol: 0.55, f0: 3000, f1: 50, delay: 0.3 }); },
    roll() { this.noiseHit({ dur: 0.35, vol: 0.12, f0: 400, f1: 2400, type: 'bandpass', q: 4 }); },
    alarm() { for (let i = 0; i < 4; i++) { this.tone({ type: 'square', f0: 660, f1: 660, dur: 0.28, vol: 0.09, delay: i * 0.6 }); this.tone({ type: 'square', f0: 440, f1: 440, dur: 0.28, vol: 0.09, delay: i * 0.6 + 0.3 }); } },
    laserCharge() { this.tone({ type: 'sawtooth', f0: 100, f1: 900, dur: 0.8, vol: 0.08 }); },
    laserFire() { if (this.throttle('laser', 400)) { this.tone({ type: 'sawtooth', f0: 180, f1: 140, dur: 1.0, vol: 0.12 }); this.noiseHit({ dur: 1.0, vol: 0.15, f0: 900, f1: 600, type: 'bandpass', q: 1 }); } },
    fury() { [0, 0.08, 0.16, 0.24].forEach((d, i) => this.tone({ type: 'sawtooth', f0: 220 * (i + 1), f1: 440 * (i + 1), dur: 0.2, vol: 0.08, delay: d })); },
    ui() { this.tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.06, vol: 0.08 }); },
    radio() { this.noiseHit({ dur: 0.12, vol: 0.06, f0: 3000, f1: 2000, type: 'bandpass', q: 6 }); },

    levelUp() { [0, 0.06, 0.12, 0.18, 0.3].forEach((d, i) => this.tone({ type: 'square', f0: [523, 659, 784, 1047, 1319][i], f1: [523, 659, 784, 1047, 1319][i] * 1.01, dur: i === 4 ? 0.4 : 0.1, vol: 0.09, delay: d })); },
    gear() { if (this.throttle('gear', 40)) this.tone({ type: 'triangle', f0: 1500 + Math.random() * 400, f1: 2400, dur: 0.05, vol: 0.05 }); }
};
