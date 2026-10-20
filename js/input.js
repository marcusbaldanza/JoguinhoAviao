/* =====================================================================
   Entrada: teclado (setas/WASD), gamepad e toque (arrastar para mover).
   ===================================================================== */
const Input = {
    keys: {},
    pressed: {},     // teclas apertadas neste quadro (borda de subida)
    mouse: { active: false, x: W / 2, y: H - 150, down: false, lastMoveX: 0, lastMoveY: 0 },
    touch: { active: false, id: null, lastX: 0, lastY: 0, dx: 0, dy: 0, used: false },
    pad: { x: 0, y: 0, fire: false, bomb: false, roll: false, focus: false, pause: false, _prev: {} },
    actionsPressed: new Set(),

    MAP: {
        up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
        fire: ['Space', 'KeyJ'], bomb: ['KeyX', 'KeyK'], roll: ['KeyC', 'KeyL'], focus: ['ShiftLeft', 'ShiftRight'],
        pause: ['KeyP', 'Escape'], mute: ['KeyM']
    },

    init(canvas) {
        window.addEventListener('keydown', (e) => {
            if (e.target && e.target.tagName === 'INPUT') return;
            // usar as setas/WASD devolve o controle ao teclado
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) this.setMouseMode(false);
            if (!this.keys[e.code]) this.pressed[e.code] = true;
            this.keys[e.code] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });

        // Toque: arrastar move o avião relativo ao dedo; tiro automático enquanto toca
        const toLogical = (t) => {
            const r = canvas.getBoundingClientRect();
            return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
        };
        // Mouse (PC): o avião segue o cursor; esquerdo atira, direito bomba, rodinha rola
        const m = this.mouse;
        const toLogicalM = (e) => {
            const r = canvas.getBoundingClientRect();
            return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
        };
        canvas.addEventListener('mousemove', (e) => {
            const p = toLogicalM(e);
            m.x = p.x; m.y = p.y;
            // só ativa com movimento real (evita "roubar" o controle do teclado)
            if (!m.active && Math.hypot(e.clientX - m.lastMoveX, e.clientY - m.lastMoveY) > 6) this.setMouseMode(true);
            m.lastMoveX = e.clientX; m.lastMoveY = e.clientY;
        });
        canvas.addEventListener('mousedown', (e) => {
            const p = toLogicalM(e); m.x = p.x; m.y = p.y;
            this.setMouseMode(true);
            if (e.button === 0) m.down = true;
            if (e.button === 2) this.actionsPressed.add('bomb');
            if (e.button === 1) { e.preventDefault(); this.actionsPressed.add('roll'); }
        });
        window.addEventListener('mouseup', (e) => { if (e.button === 0) m.down = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (m.active) this.actionsPressed.add('roll'); }, { passive: false });
        canvas.addEventListener('mouseleave', () => { m.down = false; });

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touch.used = true;
            document.body.classList.add('touch');
            if (this.touch.active) return;
            const t = e.changedTouches[0], p = toLogical(t);
            Object.assign(this.touch, { active: true, id: t.identifier, lastX: p.x, lastY: p.y });
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (t.identifier !== this.touch.id) continue;
                const p = toLogical(t);
                this.touch.dx += (p.x - this.touch.lastX) * 1.25;
                this.touch.dy += (p.y - this.touch.lastY) * 1.25;
                this.touch.lastX = p.x; this.touch.lastY = p.y;
            }
        }, { passive: false });
        const end = (e) => { for (const t of e.changedTouches) if (t.identifier === this.touch.id) this.touch.active = false; };
        canvas.addEventListener('touchend', end);
        canvas.addEventListener('touchcancel', end);
    },

    setMouseMode(on) {
        if (this.mouse.active === on) return;
        this.mouse.active = on;
        if (!on) this.mouse.down = false;
        const st = document.getElementById('stage');
        if (st) st.classList.toggle('mouse-play', on);
    },

    /** botões na tela (mobile) */
    bindTouchButton(el, action) {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); this.actionsPressed.add(action); }, { passive: false });
        el.addEventListener('mousedown', (e) => { e.preventDefault(); this.actionsPressed.add(action); });
    },

    down(action) {
        if (this.MAP[action].some((k) => this.keys[k])) return true;
        if (action === 'fire' && this.mouse.active && this.mouse.down) return true;
        return !!this.pad[action];
    },
    hit(action) {
        if (this.actionsPressed.has(action)) return true;
        if (this.MAP[action].some((k) => this.pressed[k])) return true;
        return !!(this.pad[action] && !this.pad._prev[action]);
    },

    axis() {
        let x = 0, y = 0;
        if (this.down('left')) x -= 1;
        if (this.down('right')) x += 1;
        if (this.down('up')) y -= 1;
        if (this.down('down')) y += 1;
        if (Math.abs(this.pad.x) > 0.2) x = this.pad.x;
        if (Math.abs(this.pad.y) > 0.2) y = this.pad.y;
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        return { x, y };
    },

    pollGamepad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && [...pads].find((p) => p);
        this.pad._prev = { fire: this.pad.fire, bomb: this.pad.bomb, roll: this.pad.roll, pause: this.pad.pause };
        if (!gp) { Object.assign(this.pad, { x: 0, y: 0, fire: false, bomb: false, roll: false, focus: false, pause: false }); return; }
        const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
        let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
        if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
        Object.assign(this.pad, { x, y, fire: b(0) || b(7), bomb: b(1), roll: b(2), focus: b(5) || b(6), pause: b(9) });
    },

    endFrame() {
        this.pressed = {};
        this.actionsPressed.clear();
        this.touch.dx = 0; this.touch.dy = 0;
    }
};
