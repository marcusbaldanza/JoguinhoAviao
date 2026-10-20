/* =====================================================================
   EFEITOS VISUAIS: partículas, explosões em camadas, iluminação dinâmica,
   crateras no solo, tremor de câmera, nuvens com sombra e clima.
   ===================================================================== */
const FX = {
    particles: [],
    maxParticles: 1100,
    lights: [],        // luzes do quadro atual (recriadas todo frame)
    dynLights: [],     // luzes com duração (explosões)
    decals: [],
    texts: [],
    clouds: [],
    weather: [],
    spots: [],         // holofotes (fase noturna)
    trauma: 0,
    shakeX: 0, shakeY: 0,
    flashWhite: 0, flashRed: 0, lightning: 0,
    lightmap: null, lmCtx: null,
    quality: 'alta',
    shakeEnabled: true,

    setQuality(q) { this.quality = q; this.maxParticles = q === 'alta' ? 1100 : 550; },

    init() {
        this.lightmap = makeCanvas(W / 2, H / 2);
        this.lmCtx = this.lightmap.getContext('2d');
        TEX.cloudShadows = TEX.clouds.map((c) => {
            const s = makeCanvas(c.width, c.height), x = s.getContext('2d');
            x.drawImage(c, 0, 0);
            x.globalCompositeOperation = 'source-in';
            x.fillStyle = '#000';
            x.fillRect(0, 0, s.width, s.height);
            return s;
        });
        this.glowFire = [getGlow('#fff6d0'), getGlow('#ffb347'), getGlow('#ff5a1a'), getGlow('#a01e08')];
        this.glowWhite = getGlow('#ffffff');
    },

    reset() {
        this.particles.length = 0;
        this.dynLights.length = 0;
        this.decals.length = 0;
        this.texts.length = 0;
        this.weather.length = 0;
        this.spots.length = 0;
        this.trauma = 0; this.flashWhite = 0; this.flashRed = 0; this.lightning = 0;
    },

    // ------------------------------------------------------------------ partículas
    spawn(p) {
        if (this.particles.length >= this.maxParticles) return null;
        p.t = 0;
        p.vx = p.vx || 0; p.vy = p.vy || 0;
        p.rot = p.rot || 0; p.vr = p.vr || 0;
        p.drag = p.drag ?? 1.5;
        p.size1 = p.size1 ?? p.size;
        p.alpha = p.alpha ?? 1;
        this.particles.push(p);
        return p;
    },

    smoke(x, y, size = 16, dark = 0.6, ground = false, vy = 0) {
        return this.spawn({ type: 'smoke', x, y, vx: rand(-12, 12), vy: vy + rand(-10, 10), size, size1: size * rand(2.2, 3.2), life: rand(1.0, 2.0), alpha: dark, rot: rand(0, TAU), vr: rand(-0.6, 0.6), ground });
    },
    fire(x, y, size = 12, vx = 0, vy = 0, life = 0.5) {
        return this.spawn({ type: 'fire', x, y, vx: vx + rand(-20, 20), vy: vy + rand(-20, 20), size, size1: size * 1.8, life: life * rand(0.7, 1.2), drag: 2 });
    },

    /** Explosão completa em camadas */
    explode(x, y, scale = 1, opts = {}) {
        const s = scale;
        const ground = !!opts.ground;
        this.spawn({ type: 'flash', x, y, size: 70 * s, size1: 110 * s, life: 0.14 + 0.04 * s });
        // bola de fogo
        const nFire = Math.round(7 + 7 * s);
        for (let i = 0; i < nFire; i++) {
            const a = rand(0, TAU), sp = rand(20, 150) * s;
            this.spawn({ type: 'fire', x: x + rand(-8, 8) * s, y: y + rand(-8, 8) * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(14, 28) * s, size1: rand(28, 46) * s, life: rand(0.35, 0.8), drag: 3.2, ground });
        }
        // fumaça escura que fica
        const nSmoke = Math.round(3 + 4 * s);
        for (let i = 0; i < nSmoke; i++) {
            const a = rand(0, TAU), sp = rand(10, 70) * s;
            this.spawn({ type: 'smoke', x: x + rand(-10, 10) * s, y: y + rand(-10, 10) * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(16, 26) * s, size1: rand(50, 80) * s, life: rand(1.3, 2.6), alpha: rand(0.55, 0.85), drag: 2.2, rot: rand(0, TAU), vr: rand(-0.5, 0.5), ground, delay: rand(0.05, 0.2) });
        }
        // faíscas
        const nSpark = Math.round(8 + 8 * s);
        for (let i = 0; i < nSpark; i++) {
            const a = rand(0, TAU), sp = rand(220, 560) * Math.sqrt(s);
            this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(1.2, 2.6), life: rand(0.25, 0.6), drag: 2.4 });
        }
        // destroços
        if (opts.debris !== false) {
            const nDeb = Math.round(3 + 4 * s);
            for (let i = 0; i < nDeb; i++) {
                const a = rand(0, TAU), sp = rand(90, 300) * Math.sqrt(s);
                this.spawn({ type: 'debris', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(2, 6) * Math.sqrt(s), life: rand(0.6, 1.3), rot: rand(0, TAU), vr: rand(-12, 12), drag: 1.6, burning: chance(0.6) });
            }
        }
        // onda de choque
        if (s >= 0.9) this.spawn({ type: 'ring', x, y, size: 10 * s, size1: 120 * s, life: 0.45, drag: 0 });
        this.dynLights.push({ x, y, r: 200 * s, color: '#ffa040', intensity: 1.2, life: 0.5 + 0.15 * s, max: 0.5 + 0.15 * s, ground });
        this.addTrauma(0.12 * s);
        if (ground) this.decal(x, y, 0.6 + 0.5 * s);
        if (opts.sound !== false) Sound.explosion(s);
    },

    /** faíscas de impacto de projétil */
    impact(x, y, color = '#ffd27a', n = 5, dir = -Math.PI / 2) {
        for (let i = 0; i < n; i++) {
            const a = dir + rand(-1.1, 1.1), sp = rand(120, 320);
            this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(1, 2), life: rand(0.12, 0.3), drag: 3, color });
        }
        this.spawn({ type: 'flash', x, y, size: 14, size1: 22, life: 0.07, color });
        this.lights.push({ x, y, r: 50, color, intensity: 0.7 });
    },

    muzzle(x, y, color = '#ffd34a', size = 14) {
        this.spawn({ type: 'flash', x, y, size, size1: size * 0.5, life: 0.06, color });
        this.lights.push({ x, y, r: size * 4, color, intensity: 0.6 });
    },

    decal(x, y, scale = 1) {
        this.decals.push({ x, y, size: 128 * scale * rand(0.8, 1.15), rot: rand(0, TAU), alpha: rand(0.75, 1) });
        if (this.decals.length > 60) this.decals.shift();
    },

    text(x, y, str, color = '#ffe066', size = 18, life = 0.9) {
        this.texts.push({ x, y, str, color, size, life, max: life });
    },

    addTrauma(v) { this.trauma = Math.min(1, this.trauma + v); },
    addLight(x, y, r, color, intensity = 1) { this.lights.push({ x, y, r, color, intensity }); },

    // ------------------------------------------------------------------ update
    update(dt, scrollSpeed) {
        const ps = this.particles;
        for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i];
            if (p.delay > 0) { p.delay -= dt; continue; }
            p.t += dt;
            if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
            const d = Math.max(0, 1 - p.drag * dt);
            p.vx *= d; p.vy *= d;
            p.x += p.vx * dt;
            p.y += p.vy * dt + (p.ground ? scrollSpeed * dt : 0);
            p.rot += p.vr * dt;
            if (p.type === 'smoke' && !p.ground) p.y += scrollSpeed * 0.35 * dt; // fumaça no ar fica para trás
            if (p.type === 'debris' && p.burning && chance(0.35)) {
                this.spawn({ type: 'fire', x: p.x, y: p.y, size: p.size * 1.6, size1: p.size * 0.6, life: 0.25, drag: 1 });
                if (chance(0.3)) this.smoke(p.x, p.y, p.size * 1.5, 0.35);
            }
        }
        for (let i = this.dynLights.length - 1; i >= 0; i--) {
            const l = this.dynLights[i];
            l.life -= dt;
            if (l.ground) l.y += scrollSpeed * dt;
            if (l.life <= 0) this.dynLights.splice(i, 1);
        }
        for (let i = this.decals.length - 1; i >= 0; i--) {
            const d = this.decals[i];
            d.y += scrollSpeed * dt;
            if (d.y - d.size > H) this.decals.splice(i, 1);
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt; t.y -= 40 * dt;
            if (t.life <= 0) this.texts.splice(i, 1);
        }
        // tremor de câmera (trauma²)
        this.trauma = Math.max(0, this.trauma - dt * 1.4);
        const amt = this.shakeEnabled ? this.trauma * this.trauma * 22 : 0;
        const tt = performance.now() / 1000;
        this.shakeX = amt * (Math.sin(tt * 47.3) + Math.sin(tt * 91.1) * 0.5) * 0.66;
        this.shakeY = amt * (Math.cos(tt * 53.7) + Math.sin(tt * 77.9) * 0.5) * 0.66;
        this.flashWhite = Math.max(0, this.flashWhite - dt * 1.6);
        this.flashRed = Math.max(0, this.flashRed - dt * 2.2);
        this.lightning = Math.max(0, this.lightning - dt * 3);
    },

    // ------------------------------------------------------------------ desenho
    drawDecals(ctx) {
        for (const d of this.decals) {
            ctx.save();
            ctx.globalAlpha = d.alpha;
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rot);
            ctx.drawImage(TEX.scorch, -d.size / 2, -d.size / 2, d.size, d.size);
            ctx.restore();
        }
    },

    /** camada "normal" (fumaça/destroços); groundOnly separa fumaça de solo */
    /** escala/offset atuais do canvas (para desenhar com setTransform rápido) */
    rs: 1, ox: 0, oy: 0,
    drawNormal(ctx, groundLayer) {
        for (const p of this.particles) {
            if (p.delay > 0) continue;
            if (!!p.ground !== groundLayer) continue;
            const k = p.t / p.life;
            if (p.type === 'smoke' || p.type === 'trail') {
                const s = lerp(p.size, p.size1, easeOutCubic(k)) * (p.alpha > 0.5 ? 1.15 : 1);
                ctx.globalAlpha = Math.min(1, p.alpha * 1.2) * (1 - k) * (k < 0.1 ? k * 10 : 1);
                const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
                ctx.setTransform(cs * this.rs, sn * this.rs, -sn * this.rs, cs * this.rs, (p.x + this.ox) * this.rs, (p.y + this.oy) * this.rs);
                ctx.drawImage(TEX.smoke, -s, -s, s * 2, s * 2);
                ctx.setTransform(this.rs, 0, 0, this.rs, this.ox * this.rs, this.oy * this.rs);
            } else if (p.type === 'debris') {
                ctx.globalAlpha = 1 - k * k;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = '#26211d';
                ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
                ctx.fillStyle = '#5a504a';
                ctx.fillRect(-p.size, -p.size * 0.6, p.size, p.size * 0.5);
                ctx.restore();
            } else if (p.type === 'water') {
                ctx.globalAlpha = (1 - k) * 0.7;
                ctx.fillStyle = '#e8f6ff';
                ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.size, p.size1, k), 0, TAU); ctx.fill();
            } else if (p.type === 'ring') {
                const r = lerp(p.size, p.size1, easeOutCubic(k));
                ctx.globalAlpha = (1 - k) * 0.55;
                ctx.strokeStyle = '#fff1d6';
                ctx.lineWidth = 6 * (1 - k) + 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    },

    /** camada aditiva: fogo, faíscas, clarões */
    drawAdditive(ctx) {
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.particles) {
            if (p.delay > 0) continue;
            const k = p.t / p.life;
            if (p.type === 'fire') {
                const s = lerp(p.size, p.size1, easeOutCubic(k));
                const gi = Math.min(3, Math.floor(k * 4));
                ctx.globalAlpha = (1 - k) * 0.9;
                ctx.drawImage(this.glowFire[gi], p.x - s, p.y - s, s * 2, s * 2);
            } else if (p.type === 'spark') {
                ctx.globalAlpha = 1 - k;
                ctx.strokeStyle = p.color || (k < 0.4 ? '#fff4c8' : '#ffa040');
                ctx.lineWidth = p.size;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
                ctx.stroke();
            } else if (p.type === 'flash') {
                const s = lerp(p.size, p.size1, k);
                ctx.globalAlpha = 1 - k;
                ctx.drawImage(p.color ? getGlow(p.color) : this.glowWhite, p.x - s, p.y - s, s * 2, s * 2);
            } else if (p.type === 'ember') {
                ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(p.t * 20));
                ctx.drawImage(this.glowFire[1], p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    },

    /**
     * Iluminação: escurece a cena conforme o "ambient" e abre buracos de luz
     * onde há explosões, tiros, motores e holofotes. Depois soma luz colorida.
     */
    drawLighting(ctx, ambient) {
        const all = this.lights.concat(this.dynLights.map((l) => ({ x: l.x, y: l.y, r: l.r * (0.6 + 0.4 * l.life / l.max), color: l.color, intensity: l.intensity * (l.life / l.max) })));
        const flashAmb = ambient * (1 - this.lightning * 0.85);
        if (flashAmb > 0.02) {
            if (this.quality === 'alta') {
                const lx = this.lmCtx;
                lx.globalCompositeOperation = 'source-over';
                lx.clearRect(0, 0, W / 2, H / 2);
                lx.fillStyle = `rgba(4,7,18,${flashAmb})`;
                lx.fillRect(0, 0, W / 2, H / 2);
                lx.globalCompositeOperation = 'destination-out';
                for (const l of all) {
                    lx.globalAlpha = clamp(l.intensity, 0, 1);
                    const r = l.r * 1.3 / 2;
                    lx.drawImage(this.glowWhite, l.x / 2 - r, l.y / 2 - r, r * 2, r * 2);
                }
                for (const s of this.spots) {
                    lx.globalAlpha = 0.95;
                    lx.save();
                    lx.translate(s.x / 2, s.y / 2);
                    lx.scale(1, 0.75);
                    lx.drawImage(this.glowWhite, -s.r, -s.r, s.r * 2, s.r * 2);
                    lx.restore();
                    // facho de luz até a origem
                    lx.globalAlpha = 0.25;
                    lx.fillStyle = '#fff';
                    lx.beginPath();
                    lx.moveTo(s.ox / 2, s.oy / 2);
                    const a = Math.atan2(s.y - s.oy, s.x - s.ox) + Math.PI / 2;
                    lx.lineTo((s.x + Math.cos(a) * s.r * 0.9) / 2, (s.y + Math.sin(a) * s.r * 0.9) / 2);
                    lx.lineTo((s.x - Math.cos(a) * s.r * 0.9) / 2, (s.y - Math.sin(a) * s.r * 0.9) / 2);
                    lx.closePath(); lx.fill();
                }
                lx.globalAlpha = 1;
                ctx.drawImage(this.lightmap, 0, 0, W, H);
            } else {
                ctx.fillStyle = `rgba(4,7,18,${flashAmb * 0.8})`;
                ctx.fillRect(0, 0, W, H);
            }
        }
        // luz colorida somada (dá cor aos arredores)
        ctx.globalCompositeOperation = 'lighter';
        const boost = 0.25 + ambient * 0.5;
        for (const l of all) {
            ctx.globalAlpha = clamp(l.intensity * boost, 0, 1);
            const r = l.r;
            ctx.drawImage(getGlow(l.color), l.x - r, l.y - r, r * 2, r * 2);
        }
        for (const s of this.spots) {
            ctx.globalAlpha = 0.28;
            ctx.drawImage(getGlow('#dfe9ff'), s.x - s.r * 1.6, s.y - s.r * 1.2, s.r * 3.2, s.r * 2.4);
            // facho visível no ar
            const a = Math.atan2(s.y - s.oy, s.x - s.ox) + Math.PI / 2;
            const g = ctx.createLinearGradient(s.ox, s.oy, s.x, s.y);
            g.addColorStop(0, 'rgba(220,235,255,0.0)');
            g.addColorStop(1, 'rgba(220,235,255,0.10)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(s.ox - 10, s.oy);
            ctx.lineTo(s.x + Math.cos(a) * s.r * 0.9, s.y + Math.sin(a) * s.r * 0.9);
            ctx.lineTo(s.x - Math.cos(a) * s.r * 0.9, s.y - Math.sin(a) * s.r * 0.9);
            ctx.lineTo(s.ox + 10, s.oy);
            ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.lights.length = 0;
    },

    drawTexts(ctx) {
        ctx.textAlign = 'center';
        for (const t of this.texts) {
            const k = t.life / t.max;
            ctx.globalAlpha = Math.min(1, k * 2);
            ctx.font = `${t.size}px Staatliches, sans-serif`;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(t.str, t.x + 1.5, t.y + 1.5);
            ctx.fillStyle = t.color;
            ctx.fillText(t.str, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    },

    // ------------------------------------------------------------------ nuvens
    initClouds(density = 1) {
        this.clouds.length = 0;
        const n = Math.round(4 * density);
        for (let i = 0; i < n; i++) this.clouds.push(this._newCloud(rand(-200, H)));
    },
    _newCloud(y) {
        const scale = rand(0.9, 1.9);
        return { tex: randInt(0, TEX.clouds.length - 1), x: rand(-120, W - 150), y, scale, speed: rand(150, 220) * (scale * 0.4 + 0.7), alpha: rand(0.35, 0.65), drift: rand(-8, 8) };
    },
    updateClouds(dt) {
        for (let i = 0; i < this.clouds.length; i++) {
            const c = this.clouds[i];
            c.y += c.speed * dt; c.x += c.drift * dt;
            if (c.y > H + 50) this.clouds[i] = this._newCloud(-220 * c.scale - rand(0, 300));
        }
    },
    drawCloudShadows(ctx) {
        if (this.quality !== 'alta') return;
        ctx.globalAlpha = 0.16;
        for (const c of this.clouds) {
            const tex = TEX.cloudShadows[c.tex];
            ctx.drawImage(tex, c.x + 90, c.y + 140, tex.width * c.scale, tex.height * c.scale);
        }
        ctx.globalAlpha = 1;
    },
    drawClouds(ctx, tint = 1) {
        for (const c of this.clouds) {
            const tex = TEX.clouds[c.tex];
            ctx.globalAlpha = c.alpha * tint;
            ctx.drawImage(tex, c.x, c.y, tex.width * c.scale, tex.height * c.scale);
        }
        ctx.globalAlpha = 1;
    },

    // ------------------------------------------------------------------ clima
    updateWeather(dt, kind) {
        const wv = this.weather;
        if (kind === 'embers' && chance(dt * 18)) wv.push({ k: 'ember', x: rand(0, W), y: H + 10, vx: rand(-20, 20), vy: rand(-90, -40), s: rand(1.5, 3.5), life: rand(3, 6), t: 0 });
        if (kind === 'rain') for (let i = 0; i < 6; i++) wv.push({ k: 'rain', x: rand(-100, W), y: rand(-60, -10), vx: 160, vy: rand(900, 1200), s: rand(12, 22), life: 1.2, t: 0 });
        if (kind === 'sand' && chance(dt * 40)) wv.push({ k: 'sand', x: -60, y: rand(0, H), vx: rand(500, 800), vy: rand(30, 80), s: rand(20, 60), life: 2, t: 0 });
        if (kind === 'fog' && chance(dt * 0.9)) wv.push({ k: 'fog', x: rand(-150, W - 150), y: -300, vx: rand(-10, 10), vy: rand(130, 180), s: rand(1.6, 2.6), life: 12, t: 0, tex: randInt(0, 3) });
        if (kind === 'rain' && chance(dt * 0.12)) { this.lightning = 1; Sound.noiseHit({ dur: 1.4, vol: 0.25, f0: 300, f1: 40, delay: 0.3 }); }
        for (let i = wv.length - 1; i >= 0; i--) {
            const p = wv[i];
            p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.t > p.life || p.y > H + 400 || p.x > W + 100) { wv[i] = wv[wv.length - 1]; wv.pop(); }
        }
    },
    drawWeather(ctx, kind) {
        if (kind === 'fog') {
            for (const p of this.weather) {
                const tex = TEX.clouds[p.tex];
                ctx.globalAlpha = 0.35;
                ctx.drawImage(tex, p.x, p.y, tex.width * p.s, tex.height * p.s);
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(210,225,215,0.10)';
            ctx.fillRect(0, 0, W, H);
            return;
        }
        if (kind === 'sand') { ctx.fillStyle = 'rgba(220,170,90,0.08)'; ctx.fillRect(0, 0, W, H); }
        ctx.lineCap = 'round';
        for (const p of this.weather) {
            if (p.k === 'rain') {
                ctx.strokeStyle = 'rgba(200,220,255,0.35)';
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.015, p.y - p.s); ctx.stroke();
            } else if (p.k === 'sand') {
                ctx.strokeStyle = 'rgba(235,200,140,0.35)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.s, p.y - p.s * 0.1); ctx.stroke();
            } else if (p.k === 'ember') {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = (1 - p.t / p.life) * (0.5 + 0.5 * Math.sin(p.t * 9));
                ctx.drawImage(this.glowFire[1], p.x - p.s * 2, p.y - p.s * 2, p.s * 4, p.s * 4);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        ctx.lineCap = 'butt';
        if (this.lightning > 0) {
            ctx.fillStyle = `rgba(220,230,255,${this.lightning * 0.35})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
};
