/* ASHEN VEIL — an original 2D souls-like
   Built with vanilla canvas. All art, audio and animation are procedural. */
(() => {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Constants & utility
  // ─────────────────────────────────────────────────────────────
  const VW = 1280;
  const VH = 720;
  const WORLD_W = 7480;
  const FLOOR_Y = 590;
  const TAU = Math.PI * 2;
  const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const sign = (v) => v < 0 ? -1 : 1;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInCubic = t => t * t * t;
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const approach = (v, target, delta) => v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);

  function hash(x, y = 0) {
    let h = Math.sin(x * 127.1 + y * 311.7 + 71.3) * 43758.5453123;
    return h - Math.floor(h);
  }

  function rr(ctx, x, y, w, h, r) {
    const n = Math.min(r, w * .5, h * .5);
    ctx.beginPath();
    ctx.moveTo(x + n, y);
    ctx.arcTo(x + w, y, x + w, y + h, n);
    ctx.arcTo(x + w, y + h, x, y + h, n);
    ctx.arcTo(x, y + h, x, y, n);
    ctx.arcTo(x, y, x + w, y, n);
    ctx.closePath();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;

  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = 640;
  lightCanvas.height = 360;
  const lctx = lightCanvas.getContext('2d');

  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 180;
  grainCanvas.height = 180;
  {
    const g = grainCanvas.getContext('2d');
    const img = g.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = randInt(0, 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 12;
    }
    g.putImageData(img, 0, 0);
  }
  const grainPattern = ctx.createPattern(grainCanvas, 'repeat');

  // ─────────────────────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────────────────────
  const input = {
    held: Object.create(null),
    pressed: Object.create(null),
    joyX: 0,
    joyY: 0,
    press(action) {
      if (!this.held[action]) this.pressed[action] = true;
      this.held[action] = true;
    },
    release(action) {
      this.held[action] = false;
    },
    consume(action) {
      if (!this.pressed[action]) return false;
      this.pressed[action] = false;
      return true;
    },
    clearPressed() { this.pressed = Object.create(null); },
    reset() { this.held = Object.create(null); this.pressed = Object.create(null); this.joyX = 0; this.joyY = 0; }
  };

  const KEYMAP = {
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyW: 'jump', ArrowUp: 'jump',
    KeyS: 'block', ArrowDown: 'block',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'dodge',
    KeyJ: 'attack',
    KeyK: 'heavy',
    KeyQ: 'heal',
    KeyE: 'interact',
    Escape: 'pause',
    Enter: 'confirm'
  };

  // ─────────────────────────────────────────────────────────────
  // Procedural audio
  // ─────────────────────────────────────────────────────────────
  class Soundscape {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.music = null;
      this.wind = null;
      this.muted = false;
      this.started = false;
      this.boss = false;
      this.lastStep = 0;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : .42;
      this.master.connect(c.destination);

      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 4;
      comp.attack.value = .004;
      comp.release.value = .28;
      comp.connect(this.master);

      this.bus = c.createGain();
      this.bus.gain.value = .72;
      this.bus.connect(comp);

      // Reverb from a procedurally generated impulse.
      const len = c.sampleRate * 2.8;
      const impulse = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.1);
        }
      }
      this.verb = c.createConvolver();
      this.verb.buffer = impulse;
      this.wet = c.createGain();
      this.wet.gain.value = .25;
      this.verb.connect(this.wet);
      this.wet.connect(comp);

      // Wind.
      const wlen = c.sampleRate * 4;
      const windBuf = c.createBuffer(1, wlen, c.sampleRate);
      const wd = windBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < wlen; i++) {
        last = last * .985 + (Math.random() * 2 - 1) * .015;
        wd[i] = last * 2.2;
      }
      const src = c.createBufferSource();
      src.buffer = windBuf;
      src.loop = true;
      const wf = c.createBiquadFilter();
      wf.type = 'bandpass';
      wf.frequency.value = 340;
      wf.Q.value = .55;
      const wg = c.createGain();
      wg.gain.value = .15;
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = .045;
      lfoGain.gain.value = .075;
      lfo.connect(lfoGain);
      lfoGain.connect(wg.gain);
      src.connect(wf).connect(wg).connect(this.bus);
      src.start();
      lfo.start();
      this.wind = wg;

      // Low drone chord.
      this.music = c.createGain();
      this.music.gain.value = .0001;
      this.music.gain.exponentialRampToValueAtTime(.13, c.currentTime + 5);
      this.music.connect(this.bus);
      this.music.connect(this.verb);
      const freqs = [48.9, 73.4, 98, 146.8];
      this.drones = freqs.map((f, i) => {
        const o = c.createOscillator();
        o.type = i === 3 ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 4;
        const g = c.createGain();
        g.gain.value = i === 3 ? .032 : .042;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = i === 3 ? 300 : 150;
        lp.Q.value = 2.5;
        o.connect(lp).connect(g).connect(this.music);
        o.start();
        return { o, g, lp, base: f };
      });

      this.started = true;
    }

    setMuted(m) {
      this.muted = m;
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.linearRampToValueAtTime(m ? 0 : .42, this.ctx.currentTime + .25);
      }
    }

    setBoss(on) {
      if (!this.ctx || this.boss === on) return;
      this.boss = on;
      const t = this.ctx.currentTime;
      this.drones.forEach((d, i) => {
        d.o.frequency.cancelScheduledValues(t);
        d.o.frequency.linearRampToValueAtTime(d.base * (on ? (i % 2 ? 1.03 : .95) : 1), t + 2);
        d.g.gain.linearRampToValueAtTime(on ? (i === 3 ? .045 : .06) : (i === 3 ? .032 : .042), t + 2);
      });
      if (on) this.music.gain.linearRampToValueAtTime(.2, t + 2);
    }

    env(node, t, vol, attack, decay) {
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(.0001, t);
      node.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + attack);
      node.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
    }

    tone(freq, type, dur, vol, slide, delay = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      this.env(g, t, vol, .008, dur);
      o.connect(g).connect(this.bus);
      g.connect(this.verb);
      o.start(t);
      o.stop(t + dur + .08);
    }

    noise(dur, vol, freq, q = 1, delay = 0, hp = false) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + delay;
      const len = Math.max(1, Math.ceil(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = hp ? 'highpass' : 'bandpass';
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * .45), t + dur);
      f.Q.value = q;
      const g = c.createGain();
      this.env(g, t, vol, .006, dur);
      src.connect(f).connect(g).connect(this.bus);
      g.connect(this.verb);
      src.start(t);
    }

    sfx(name) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'swing-light':
          this.noise(.19, .17, 2100, 1.2, 0, true);
          this.tone(150, 'sine', .12, .03, 70);
          break;
        case 'swing-heavy':
          this.noise(.38, .26, 1400, .9, 0, true);
          this.tone(95, 'sine', .3, .07, 45);
          break;
        case 'hit':
          this.tone(78, 'sine', .24, .2, 34);
          this.noise(.13, .19, 500, 1.8);
          break;
        case 'hit-heavy':
          this.tone(54, 'sine', .38, .3, 25);
          this.noise(.22, .25, 360, 1.4);
          break;
        case 'hurt':
          this.tone(118, 'sawtooth', .28, .12, 68);
          this.noise(.18, .15, 700, 1);
          break;
        case 'block':
          this.tone(1350, 'triangle', .2, .1, 950);
          this.noise(.1, .12, 3400, 3, 0, true);
          break;
        case 'guard-break':
          this.tone(240, 'square', .38, .09, 90);
          this.noise(.25, .18, 1500, 2);
          break;
        case 'roll':
          this.noise(.26, .1, 720, .8);
          break;
        case 'heal':
          [392, 523.3, 659.3].forEach((f, i) => this.tone(f, 'sine', .7, .055, null, i * .11));
          this.noise(.55, .035, 2600, 1.4);
          break;
        case 'bonfire':
          [98, 146.8, 196, 293.7].forEach((f, i) => this.tone(f, 'sine', 2.4, .07, null, i * .13));
          this.noise(.8, .13, 500, .6);
          break;
        case 'soul':
          this.tone(740, 'sine', .45, .045, 1180);
          break;
        case 'level':
          [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(f, 'triangle', 1.1, .05, null, i * .12));
          break;
        case 'death':
          this.tone(82, 'sawtooth', 2.8, .17, 31);
          this.tone(55, 'sine', 3.5, .16, 24);
          this.noise(1.6, .12, 260, .6);
          break;
        case 'arrow':
          this.noise(.18, .08, 2800, 4, 0, true);
          break;
        case 'boss-roar':
          this.tone(42, 'sawtooth', 1.8, .26, 29);
          this.tone(63, 'square', 1.4, .09, 39);
          this.noise(1.5, .2, 180, .5);
          break;
        case 'victory':
          [130.8, 196, 261.6, 329.6, 392].forEach((f, i) => this.tone(f, 'sine', 3.2, .055, null, i * .22));
          break;
        case 'stagger':
          this.tone(92, 'square', .2, .08, 50);
          break;
        case 'step':
          this.noise(.055, .018, 190, .8);
          break;
      }
    }

    step() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (t - this.lastStep < .28) return;
      this.lastStep = t;
      this.sfx('step');
    }
  }

  const audio = new Soundscape();

  // ─────────────────────────────────────────────────────────────
  // World data
  // ─────────────────────────────────────────────────────────────
  const GROUNDS = [
    { x: -420, y: FLOOR_Y, w: 2380, h: 400, kind: 'rampart' },
    { x: 2040, y: FLOOR_Y, w: 1640, h: 400, kind: 'chapel' },
    { x: 3760, y: FLOOR_Y, w: 1510, h: 400, kind: 'crossing' },
    { x: 5270, y: FLOOR_Y, w: 2290, h: 400, kind: 'throne' }
  ];

  const PLATFORMS = [
    { x: 890, y: 545, w: 265, h: 20, kind: 'ledge' },
    { x: 1455, y: 505, w: 200, h: 18, kind: 'ledge' },
    { x: 2310, y: 585, w: 125, h: 55, kind: 'rubble' },
    { x: 2880, y: 540, w: 260, h: 20, kind: 'ledge' },
    { x: 3080, y: 430, w: 180, h: 18, kind: 'ledge' },
    { x: 4280, y: 550, w: 230, h: 19, kind: 'ledge' },
    { x: 5730, y: 555, w: 180, h: 18, kind: 'ledge' }
  ];

  const SOLIDS = [...GROUNDS, ...PLATFORMS];

  const BONFIRES = [
    { x: 382, y: FLOOR_Y, name: 'ASHEN RAMPART', lit: true, discovered: true },
    { x: 3490, y: FLOOR_Y, name: 'SUNKEN CHAPEL', lit: false, discovered: false }
  ];

  const TORCHES = [
    { x: 675, y: 512 }, { x: 1230, y: 485 }, { x: 1730, y: 520 },
    { x: 2170, y: 495 }, { x: 2630, y: 520 }, { x: 3170, y: 480 },
    { x: 3920, y: 505 }, { x: 4380, y: 520 }, { x: 4790, y: 490 },
    { x: 5350, y: 500 }, { x: 6020, y: 485 }, { x: 6880, y: 515 }
  ];

  const SPAWNS = [
    { type: 'husk', x: 865, ground: FLOOR_Y, patrol: 135 },
    { type: 'archer', x: 1030, ground: 545, patrol: 95 },
    { type: 'husk', x: 1520, ground: FLOOR_Y, patrol: 170 },
    { type: 'husk', x: 1830, ground: FLOOR_Y, patrol: 100 },
    { type: 'knight', x: 2410, ground: FLOOR_Y, patrol: 145 },
    { type: 'archer', x: 2995, ground: 540, patrol: 90 },
    { type: 'husk', x: 3260, ground: FLOOR_Y, patrol: 120 },
    { type: 'knight', x: 3910, ground: FLOOR_Y, patrol: 160 },
    { type: 'husk', x: 4270, ground: FLOOR_Y, patrol: 80 },
    { type: 'archer', x: 4620, ground: FLOOR_Y, patrol: 150 },
    { type: 'knight', x: 4935, ground: FLOOR_Y, patrol: 130 }
  ];

  const ZONES = [
    { x: 0, name: 'THE ASHEN RAMPART', sub: '잿빛 성벽' },
    { x: 2050, name: 'THE SUNKEN CHAPEL', sub: '가라앉은 예배당' },
    { x: 3770, name: 'THE BROKEN CROSSING', sub: '부서진 교차로' },
    { x: 5270, name: 'THRONE OF EMBERS', sub: '재의 왕좌' }
  ];

  const WORLD_MESSAGES = [
    { x: 530, y: FLOOR_Y, text: 'A / D  MOVE      W  LEAP', size: 12 },
    { x: 735, y: FLOOR_Y, text: 'SPACE  ROLL THROUGH DEATH', size: 11 },
    { x: 1330, y: FLOOR_Y, text: 'S  HOLD TO GUARD      J  STRIKE', size: 11 },
    { x: 1595, y: FLOOR_Y, text: 'Q  DRINK ESTUS — IT WILL RETURN WHEN YOU REST', size: 10 },
    { x: 3540, y: FLOOR_Y - 100, text: 'THE FLAME REMEMBERS THEE', size: 12 },
    { x: 5020, y: FLOOR_Y, text: 'BEYOND LIES THE THRONE.  DO NOT KNEEL.', size: 11 }
  ];

  let enemies = [];
  let projectiles = [];
  let particles = [];
  let floatingTexts = [];
  let cameraShake = 0;
  let hitStop = 0;
  let flash = 0;
  let gameTime = 0;
  let frameTime = 0;

  const camera = { x: 0, y: 0, targetX: 0, shakeX: 0, shakeY: 0 };
  const game = {
    phase: 'title',
    paused: false,
    uiOpen: false,
    started: false,
    titleTimer: 0,
    zone: 0,
    zoneBanner: 0,
    message: '',
    messageTimer: 0,
    fade: 0,
    fadeDir: 0,
    deaths: 0,
    time: 0,
    lastBonfire: 0,
    bossFight: false,
    bossIntro: 0,
    bossDefeated: false,
    bossDeathTimer: 0,
    victoryShown: false,
    gateSolid: null,
    bloodstain: null,
    tutorialStage: 0,
    hitShake: 0,
    deathTimer: 0,
    lowHp: 0
  };

  // ─────────────────────────────────────────────────────────────
  // Particles & floating text
  // ─────────────────────────────────────────────────────────────
  function spawnParticle(opts) {
    if (particles.length > 440) particles.shift();
    particles.push({
      x: 0, y: 0, vx: 0, vy: 0, life: .6, maxLife: .6,
      size: 2, color: '#fff', gravity: 0, drag: .98,
      glow: 0, type: 'dot', rot: 0, vr: 0,
      ...opts
    });
  }

  function burst(x, y, count, color, power = 150, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(power * .25, power);
      spawnParticle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.lift || 0),
        life: rand(.3, .75), maxLife: .8, size: rand(1.2, 3.4),
        color, gravity: opts.gravity ?? 700, drag: .965, glow: opts.glow ?? 0
      });
    }
  }

  function soulBurst(x, y, amount = 8) {
    for (let i = 0; i < amount; i++) {
      spawnParticle({
        x: x + rand(-18, 18), y: y + rand(-20, 20),
        vx: rand(-25, 25), vy: rand(-70, -25),
        life: rand(.8, 1.6), maxLife: 1.6, size: rand(1, 2.8),
        color: i % 3 ? '#d8c38d' : '#f6e4b0', gravity: -30, drag: .985, glow: 1
      });
    }
  }

  function addText(x, y, text, color = '#eadfc9', size = 17, vy = -46) {
    floatingTexts.push({ x, y, text, color, size, vy, life: .9, maxLife: .9 });
  }

  // ─────────────────────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────────────────────
  class Player {
    constructor() {
      this.w = 38;
      this.h = 72;
      this.x = 300;
      this.y = FLOOR_Y - this.h;
      this.vx = 0;
      this.vy = 0;
      this.face = 1;
      this.hp = 120;
      this.maxHp = 120;
      this.stamina = 100;
      this.maxStamina = 100;
      this.flasks = 3;
      this.maxFlasks = 3;
      this.souls = 0;
      this.level = 1;
      this.damageBonus = 0;
      this.onGround = true;
      this.state = 'idle';
      this.stateTime = 0;
      this.attackType = null;
      this.attackStep = 0;
      this.hitTargets = new Set();
      this.invuln = 0;
      this.hurtFlash = 0;
      this.comboWindow = 0;
      this.comboQueued = false;
      this.staminaDelay = 0;
      this.walkPhase = 0;
      this.rollDir = 1;
      this.airTime = 0;
      this.blocking = false;
      this.healApplied = false;
      this.lastHitBy = null;
      this.prompt = null;
      this.deathX = 0;
      this.deathY = 0;
      this.ghost = 0;
      this.stepTimer = 0;
      this.jumpBuffer = 0;
      this.coyote = 0;
    }

    get left() { return this.x - this.w / 2; }
    get right() { return this.x + this.w / 2; }
    get top() { return this.y; }
    get bottom() { return this.y + this.h; }

    rect() { return { x: this.left, y: this.y, w: this.w, h: this.h }; }

    canAct() {
      return ['idle', 'run', 'jump', 'fall', 'guard'].includes(this.state);
    }

    setState(s) {
      if (this.state !== s) {
        this.state = s;
        this.stateTime = 0;
      }
    }

    damage(amount, sourceX, type = 'normal') {
      if (this.invuln > 0 || game.phase !== 'playing') return false;
      let final = amount;
      const sourceRight = sourceX > this.x;
      const facingSource = (sourceRight && this.face > 0) || (!sourceRight && this.face < 0);
      if (this.blocking && facingSource && this.stamina > 0) {
        const staminaCost = amount * .9;
        this.stamina -= staminaCost;
        this.staminaDelay = .55;
        final = amount * .16;
        this.hp -= final;
        cameraShake = Math.max(cameraShake, 7);
        audio.sfx('block');
        burst(this.x + this.face * 22, this.y + 35, 9, '#f0d39b', 150, { glow: 1, gravity: 300 });
        addText(this.x, this.y - 8, 'GUARD', '#d8c38d', 12);
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.blocking = false;
          this.setState('stagger');
          this.stateTime = 0;
          this.vx = sign(this.x - sourceX) * 260;
          audio.sfx('guard-break');
          addText(this.x, this.y - 24, 'GUARD BROKEN', '#d45d4a', 15);
        } else {
          this.vx = sign(this.x - sourceX) * 90;
          this.vy = Math.min(this.vy, -40);
        }
        this.hurtFlash = .22;
        flash = Math.max(flash, .08);
        return true;
      }

      this.hp -= final;
      this.invuln = .65;
      this.hurtFlash = .4;
      this.staminaDelay = .65;
      this.lastHitBy = sourceX;
      this.vx = sign(this.x - sourceX) * 240;
      this.vy = -170;
      this.onGround = false;
      this.setState('hurt');
      this.stateTime = 0;
      this.blocking = false;
      cameraShake = Math.max(cameraShake, 13);
      flash = .18;
      audio.sfx('hurt');
      burst(this.x, this.y + 32, 15, '#7e1e1c', 220, { gravity: 850 });
      burst(this.x, this.y + 30, 5, '#cf5b45', 120, { glow: 1, gravity: 400 });
      addText(this.x, this.y - 4, `-${Math.round(final)}`, '#d9a69a', 15);
      if (this.hp <= 0) {
        this.hp = 0;
        this.die();
      }
      return true;
    }

    die() {
      if (game.phase !== 'playing') return;
      game.phase = 'dead';
      game.deathTimer = 0;
      this.setState('dead');
      this.deathX = this.x;
      this.deathY = this.y + this.h;
      audio.sfx('death');
      cameraShake = 24;
      flash = .3;
      game.deaths++;
      if (this.souls > 0) {
        game.bloodstain = { x: this.x, y: this.y + this.h - 6, souls: this.souls, time: 0 };
      }
      this.souls = 0;
      setTimeout(() => {
        if (game.phase !== 'dead') return;
        const ds = document.getElementById('death-screen');
        document.getElementById('death-copy').textContent = game.deaths === 1
          ? 'The ash claims all. Your souls remain where you fell.'
          : `Death ${game.deaths}. The ash remembers. Your souls remain where you fell.`;
        ds.hidden = false;
        document.body.classList.remove('playing');
      }, 1250);
    }

    update(dt) {
      this.stateTime += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      this.staminaDelay = Math.max(0, this.staminaDelay - dt);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.coyote = this.onGround ? .1 : Math.max(0, this.coyote - dt);

      if (this.state === 'dead') {
        this.vx = approach(this.vx, 0, 900 * dt);
        this.vy += 1600 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y + this.h > FLOOR_Y) { this.y = FLOOR_Y - this.h; this.vy = 0; }
        return;
      }

      const actionLocked = ['attack', 'heavy', 'roll', 'hurt', 'stagger', 'heal'].includes(this.state);
      let axis = 0;
      if (input.held.left) axis -= 1;
      if (input.held.right) axis += 1;
      if (Math.abs(input.joyX) > .12) axis += input.joyX;
      axis = clamp(axis, -1, 1);

      const sprinting = input.held.sprint && axis !== 0 && this.onGround && this.stamina > 1 &&
        !actionLocked && !this.blocking;
      this.blocking = !!input.held.block && this.onGround && !actionLocked && !sprinting;
      if (this.blocking) this.setState('guard');
      else if (this.state === 'guard') this.setState('idle');

      // Stamina.
      if ((sprinting && axis !== 0) || this.blocking) {
        if (sprinting) this.stamina -= 17 * dt;
      } else if (this.staminaDelay <= 0 && !actionLocked) {
        this.stamina += 37 * dt * (this.state === 'guard' ? .3 : 1);
      }
      this.stamina = clamp(this.stamina, 0, this.maxStamina);

      // Actions.
      if (this.state === 'attack' || this.state === 'heavy') {
        if (input.consume('attack') && this.state === 'attack') this.comboQueued = true;
        input.consume('dodge');
        input.consume('heavy');
        input.consume('heal');
        if (this.state === 'attack' && this.comboQueued && this.stateTime > .22) {
          this.comboQueued = false;
          this.startAttack('light2', 0);
        } else {
          this.handleAttack(dt);
        }
      } else if (this.canAct()) {
        if (input.consume('dodge') && this.stamina >= 22) this.startRoll(axis);
        else if (input.consume('attack')) this.startAttack('light', axis);
        else if (input.consume('heavy')) this.startAttack('heavy', axis);
        else if (input.consume('heal')) this.startHeal();
      } else {
        input.consume('dodge');
        input.consume('attack');
        input.consume('heavy');
        input.consume('heal');
      }
      if (input.consume('jump')) this.jumpBuffer = .12;

      if (this.state === 'roll') {
        this.x += this.vx * dt;
        this.vx = approach(this.vx, 0, 700 * dt);
        if (this.stateTime > .38) {
          this.setState('idle');
          this.vx *= .4;
        }
      }
      if (this.state === 'heal') {
        if (!this.healApplied && this.stateTime > .46) {
          this.healApplied = true;
          const heal = 48;
          this.hp = Math.min(this.maxHp, this.hp + heal);
          this.flasks--;
          soulBurst(this.x, this.y + 30, 12);
          addText(this.x, this.y - 12, `+${heal}`, '#e8c483', 17);
          audio.sfx('heal');
        }
        if (this.stateTime > 1.02) this.setState('idle');
      }
      if (this.state === 'hurt' || this.state === 'stagger') {
        if (this.stateTime > (this.state === 'hurt' ? .45 : .6)) this.setState('idle');
      }

      const movementLocked = ['attack', 'heavy', 'roll', 'hurt', 'stagger', 'heal'].includes(this.state);
      if (!movementLocked) {
        if (axis !== 0) this.face = axis > 0 ? 1 : -1;
        let speed = sprinting ? 315 : this.blocking ? 72 : 215;
        const target = axis * speed;
        const accel = this.onGround ? 2100 : 1150;
        this.vx = approach(this.vx, target, accel * dt);
        if (axis === 0) this.vx = approach(this.vx, 0, (this.onGround ? 2400 : 300) * dt);
      } else if (this.state === 'attack' || this.state === 'heavy') {
        if (axis !== 0) this.face = axis > 0 ? 1 : -1;
        this.vx = approach(this.vx, axis * (this.attackType === 'heavy' ? 45 : 65), 1500 * dt);
      } else if (this.state === 'heal') {
        this.vx = approach(this.vx, 0, 900 * dt);
      } else if (this.state !== 'roll') {
        this.vx = approach(this.vx, 0, 1900 * dt);
      }

      // Jump.
      if (this.jumpBuffer > 0 && this.coyote > 0 && !movementLocked && !this.blocking) {
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.vy = -610;
        this.onGround = false;
        this.setState('jump');
        spawnParticle({ x: this.x + rand(-8, 8), y: this.y + this.h, vx: rand(-40, 40), vy: rand(-30, 10), life: .4, maxLife: .4, size: rand(2, 5), color: 'rgba(151,146,130,.4)', gravity: 0, drag: .93 });
      }

      // Horizontal collision.
      this.x += this.vx * dt;
      const pr = this.rect();
      for (const s of SOLIDS.concat(game.gateSolid ? [game.gateSolid] : [])) {
        if (!aabb(pr, s)) continue;
        if (this.vx > 0) this.x = s.x - this.w / 2;
        else if (this.vx < 0) this.x = s.x + s.w + this.w / 2;
        this.vx = 0;
      }

      // Vertical.
      this.vy += 1680 * dt;
      this.vy = Math.min(this.vy, 900);
      this.y += this.vy * dt;
      this.onGround = false;
      const pr2 = this.rect();
      for (const s of SOLIDS.concat(game.gateSolid ? [game.gateSolid] : [])) {
        if (!aabb(pr2, s)) continue;
        if (this.vy > 0 && this.y + this.h - this.vy * dt <= s.y + 6) {
          this.y = s.y - this.h;
          this.vy = 0;
          this.onGround = true;
          if (this.state === 'fall' || this.state === 'jump') this.setState(axis ? 'run' : 'idle');
        } else if (this.vy < 0) {
          this.y = s.y + s.h;
          this.vy = 0;
        }
      }

      if (!this.onGround) {
        this.airTime += dt;
        if (this.vy > 180 && !['hurt', 'stagger', 'roll', 'attack', 'heavy', 'heal'].includes(this.state)) this.setState('fall');
      } else {
        this.airTime = 0;
        if (!['attack', 'heavy', 'roll', 'hurt', 'stagger', 'heal'].includes(this.state) && !this.blocking) {
          if (Math.abs(this.vx) > 8) this.setState('run');
          else if (this.state !== 'heal') this.setState('idle');
        }
      }

      if (this.onGround && Math.abs(this.vx) > 30) {
        this.walkPhase += Math.abs(this.vx) * dt * .045;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = sprinting ? .19 : .29;
          audio.step();
          if (Math.random() < .6) spawnParticle({
            x: this.x - this.face * 12 + rand(-3, 3), y: this.y + this.h - 2,
            vx: -this.face * rand(10, 40), vy: rand(-32, -8),
            life: rand(.25, .5), maxLife: .5, size: rand(2, 5), color: 'rgba(163,155,136,.32)', gravity: 80, drag: .92
          });
        }
      }

      this.x = clamp(this.x, 20, WORLD_W - 20);
      if (this.y > 900) {
        this.hp = 0;
        this.die();
      }

      // Auto-use souls at bloodstain.
      if (game.bloodstain && dist(this.x, this.y + 30, game.bloodstain.x, game.bloodstain.y) < 58) {
        const amount = game.bloodstain.souls;
        this.souls += amount;
        soulBurst(game.bloodstain.x, game.bloodstain.y, 22);
        addText(game.bloodstain.x, game.bloodstain.y - 40, `+${amount} SOULS`, '#f0d28b', 18);
        game.bloodstain = null;
        audio.sfx('soul');
      }

      // Zone detection.
      let z = 0;
      for (let i = 0; i < ZONES.length; i++) if (this.x >= ZONES[i].x) z = i;
      if (z !== game.zone && game.phase === 'playing') {
        game.zone = z;
        game.zoneBanner = 4.4;
      }

      // Interactables.
      this.prompt = null;
      const nearby = getNearbyInteractable();
      if (nearby) this.prompt = nearby.prompt;
      if (input.consume('interact')) {
        if (nearby) nearby.action();
      }

      // Boss trigger.
      if (!game.bossFight && !game.bossDefeated && this.x > 5495) beginBossFight();
    }

    startRoll(axis) {
      this.stamina -= 23;
      this.staminaDelay = .55;
      this.rollDir = axis !== 0 ? sign(axis) : this.face;
      this.face = this.rollDir;
      this.setState('roll');
      this.vx = this.rollDir * 480;
      this.invuln = .28;
      this.blocking = false;
      audio.sfx('roll');
      for (let i = 0; i < 5; i++) spawnParticle({
        x: this.x + rand(-8, 8), y: this.y + this.h - 4,
        vx: -this.rollDir * rand(30, 100), vy: rand(-50, -10),
        life: rand(.25, .5), maxLife: .5, size: rand(2, 6),
        color: 'rgba(158,151,135,.3)', gravity: 40, drag: .9
      });
    }

    startAttack(type, axis) {
      const heavy = type === 'heavy';
      const cost = heavy ? 29 : 15;
      if (this.stamina < cost) {
        addText(this.x, this.y - 10, 'NO STAMINA', '#9b9385', 11);
        return;
      }
      if (axis !== 0) this.face = axis > 0 ? 1 : -1;
      this.stamina -= cost;
      this.staminaDelay = .7;
      this.blocking = false;
      this.attackType = type;
      this.attackStep = (this.attackStep + 1) % 2;
      this.hitTargets.clear();
      this.comboQueued = false;
      this.setState(heavy ? 'heavy' : 'attack');
      this.stateTime = 0;
      this.vx += this.face * (heavy ? 80 : 42);
      audio.sfx(heavy ? 'swing-heavy' : 'swing-light');
    }

    startHeal() {
      if (this.flasks <= 0) {
        addText(this.x, this.y - 10, 'FLASK EMPTY', '#9b9385', 11);
        return;
      }
      if (this.hp >= this.maxHp) return;
      this.setState('heal');
      this.stateTime = 0;
      this.healApplied = false;
      this.blocking = false;
      this.vx *= .2;
    }

    handleAttack(dt) {
      const heavy = this.attackType === 'heavy';
      const duration = heavy ? .72 : .42;
      const activeStart = heavy ? .27 : .105;
      const activeEnd = heavy ? .49 : .255;
      if (this.stateTime >= activeStart && this.stateTime <= activeEnd) {
        const range = heavy ? 102 : 82;
        const hb = {
          x: this.face > 0 ? this.x + 8 : this.x - 8 - range,
          y: this.y + (heavy ? 0 : 10),
          w: range, h: heavy ? 76 : 62
        };
        for (const e of enemies) {
          if (e.dead || this.hitTargets.has(e.id)) continue;
          if (!aabb(hb, e.rect())) continue;
          this.hitTargets.add(e.id);
          const dmg = (heavy ? 47 : 27) + this.damageBonus;
          e.takeHit(dmg, this.x, heavy);
          hitStop = heavy ? .095 : .055;
          cameraShake = Math.max(cameraShake, heavy ? 12 : 6);
          audio.sfx(heavy ? 'hit-heavy' : 'hit');
          burst(e.x, e.y + e.h * .45, heavy ? 20 : 12, '#7e1e1c', heavy ? 280 : 190, { gravity: 850 });
          burst(e.x, e.y + e.h * .4, heavy ? 9 : 5, '#e2be83', heavy ? 220 : 140, { glow: 1, gravity: 300 });
          addText(e.x, e.y - 4, `${Math.round(dmg)}`, heavy ? '#f0cf95' : '#e4dccb', heavy ? 19 : 15);
        }
        if (game.bossFight && boss && !boss.dead && !this.hitTargets.has(boss.id)) {
          if (aabb(hb, boss.rect())) {
            this.hitTargets.add(boss.id);
            const dmg = (heavy ? 39 : 21) + this.damageBonus;
            boss.takeHit(dmg, this.x, heavy);
            hitStop = heavy ? .08 : .04;
            cameraShake = Math.max(cameraShake, heavy ? 10 : 5);
            audio.sfx(heavy ? 'hit-heavy' : 'hit');
            addText(boss.x, boss.y + 18, `${Math.round(dmg)}`, '#f0cf95', heavy ? 20 : 16);
          }
        }
      }
      if (this.stateTime > duration) {
        if (this.comboWindow > 0 && this.attackType === 'light' && this.comboQueued) {
          this.startAttack(this.attackType === 'light' ? 'light2' : 'light', 0);
        } else {
          this.setState(this.onGround ? 'idle' : 'fall');
          this.comboWindow = .35;
        }
      }
    }
  }

  let player = new Player();
  let boss = null;

  // ─────────────────────────────────────────────────────────────
  // Enemies
  // ─────────────────────────────────────────────────────────────
  let entityId = 1;

  class Enemy {
    constructor(type, x, ground, patrol) {
      this.id = entityId++;
      this.type = type;
      this.x = x;
      this.ground = ground;
      this.w = type === 'knight' ? 44 : 34;
      this.h = type === 'knight' ? 84 : type === 'archer' ? 60 : 58;
      this.y = ground - this.h;
      this.vx = 0;
      this.face = -1;
      this.patrol = patrol;
      this.home = x;
      this.hp = type === 'knight' ? 108 : type === 'archer' ? 58 : 66;
      this.maxHp = this.hp;
      this.state = 'patrol';
      this.stateTime = 0;
      this.dead = false;
      this.deadTimer = 0;
      this.hurtFlash = 0;
      this.invuln = 0;
      this.didHit = false;
      this.aggro = false;
      this.attackCooldown = rand(.4, 1.1);
      this.walkPhase = rand(0, TAU);
      this.aimAngle = 0;
      this.poise = 0;
      this.souls = type === 'knight' ? 95 : type === 'archer' ? 62 : 44;
    }

    get left() { return this.x - this.w / 2; }
    get right() { return this.x + this.w / 2; }
    rect() { return { x: this.left, y: this.y, w: this.w, h: this.h }; }

    takeHit(dmg, sourceX, heavy) {
      if (this.dead) return;
      this.hp -= dmg;
      this.hurtFlash = .2;
      this.invuln = .1;
      this.aggro = true;
      this.poise += heavy ? 2 : 1;
      this.vx = sign(this.x - sourceX) * (heavy ? 190 : 85);
      if (this.type === 'knight' && !heavy && this.poise < 3) {
        this.state = 'brace';
        this.stateTime = 0;
      } else {
        this.state = 'hurt';
        this.stateTime = 0;
        this.vy = -90;
      }
      if (this.hp <= 0) this.die();
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.deadTimer = 0;
      this.hp = 0;
      player.souls += this.souls;
      soulBurst(this.x, this.y + this.h * .45, this.type === 'knight' ? 18 : 12);
      addText(this.x, this.y - 6, `+${this.souls}`, '#d9c07f', 14);
      audio.sfx('soul');
      if (this.type === 'knight') {
        for (let i = 0; i < 8; i++) spawnParticle({
          x: this.x + rand(-18, 18), y: this.y + rand(20, 80),
          vx: rand(-80, 80), vy: rand(-160, -50), life: rand(.5, 1),
          maxLife: 1, size: rand(2, 4), color: '#b9b2a0', gravity: 500, drag: .97
        });
      }
    }

    update(dt) {
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.dead) {
        this.deadTimer += dt;
        this.y += 70 * dt;
        return;
      }
      this.stateTime += dt;
      this.attackCooldown -= dt;
      this.vy = (this.vy || 0) + 1200 * dt;
      const dx = player.x - this.x;
      const distance = Math.abs(dx);
      const dy = Math.abs((player.y + player.h * .5) - (this.y + this.h * .5));
      const playerAlive = game.phase === 'playing';

      if (!this.aggro && distance < (this.type === 'archer' ? 620 : 430) && dy < 180 && playerAlive) {
        this.aggro = true;
        if (this.type === 'knight') addText(this.x, this.y - 10, '!', '#cf5e4d', 20);
      }
      if (this.aggro && playerAlive) this.face = dx > 0 ? 1 : -1;

      if (!playerAlive) {
        this.aggro = false;
        this.state = 'patrol';
      }

      switch (this.state) {
        case 'patrol': {
          this.vx = approach(this.vx, 0, 300 * dt);
          if (this.aggro) { this.state = 'chase'; this.stateTime = 0; }
          break;
        }
        case 'chase': {
          if (this.type === 'archer') this.updateArcher(dt, dx, distance);
          else this.updateMelee(dt, dx, distance);
          break;
        }
        case 'windup': {
          this.vx = approach(this.vx, 0, 850 * dt);
          const wind = this.type === 'knight' ? .66 : .48;
          if (this.stateTime >= wind) {
            this.state = 'strike';
            this.stateTime = 0;
            this.didHit = false;
            if (this.type === 'husk') this.vx = this.face * 230;
            if (this.type === 'knight') this.vx = this.face * 100;
            audio.sfx('swing-light');
          }
          break;
        }
        case 'strike': {
          this.vx = approach(this.vx, 0, 500 * dt);
          const range = this.type === 'knight' ? 72 : 54;
          if (!this.didHit && this.stateTime > .06 && this.stateTime < .24) {
            const hb = {
              x: this.face > 0 ? this.x + 5 : this.x - 5 - range,
              y: this.y + 8, w: range, h: this.h - 18
            };
            if (aabb(hb, player.rect()) && player.state !== 'dead') {
              this.didHit = true;
              const dmg = this.type === 'knight' ? 26 : 18;
              player.damage(dmg, this.x);
            }
          }
          if (this.stateTime > .3) {
            this.state = 'recover';
            this.stateTime = 0;
          }
          break;
        }
        case 'recover': {
          this.vx = approach(this.vx, 0, 800 * dt);
          if (this.stateTime > (this.type === 'knight' ? .78 : .52)) {
            this.state = 'chase';
            this.stateTime = 0;
          }
          break;
        }
        case 'aim': {
          this.vx = 0;
          if (this.stateTime > .62) {
            this.fireArrow();
            this.state = 'recover';
            this.stateTime = 0;
          }
          break;
        }
        case 'hurt': {
          this.vx = approach(this.vx, 0, 500 * dt);
          if (this.stateTime > .3) { this.state = 'chase'; this.stateTime = 0; }
          break;
        }
        case 'brace': {
          this.vx = approach(this.vx, 0, 700 * dt);
          if (this.stateTime > .28) { this.state = 'chase'; this.stateTime = 0; this.poise = 0; }
          break;
        }
      }

      this.x += this.vx * dt;
      const leeway = this.ground === FLOOR_Y ? 220 : this.patrol;
      this.x = clamp(this.x, Math.max(30, this.home - this.patrol - leeway), this.home + this.patrol + leeway);
      if (this.ground === FLOOR_Y) this.x = clamp(this.x, 30, WORLD_W - 30);

      if (this.ground === FLOOR_Y) {
        this.y = clamp(this.y, FLOOR_Y - this.h, FLOOR_Y - this.h);
      } else {
        this.y = this.ground - this.h;
      }
      // prevent walking off a raised ledge
      if (this.ground !== FLOOR_Y) {
        this.x = clamp(this.x, this.home - this.patrol, this.home + this.patrol);
      }
    }

    updateMelee(dt, dx, distance) {
      if (!this.aggro) return;
      const targetDist = this.type === 'knight' ? 54 : 46;
      if (distance > targetDist + 8) {
        const speed = this.type === 'knight' ? 72 : 108;
        this.vx = approach(this.vx, this.face * speed, 620 * dt);
        this.walkPhase += dt * 7;
      } else {
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.attackCooldown <= 0 && Math.abs(player.y - (this.y + this.h - player.h)) < 100) {
          this.state = 'windup';
          this.stateTime = 0;
          this.attackCooldown = this.type === 'knight' ? rand(1.2, 1.8) : rand(.75, 1.25);
        }
      }
    }

    updateArcher(dt, dx, distance) {
      if (!this.aggro) return;
      if (distance < 195) {
        this.vx = approach(this.vx, -this.face * 68, 600 * dt);
      } else if (distance > 340) {
        this.vx = approach(this.vx, this.face * 52, 500 * dt);
      } else {
        this.vx = approach(this.vx, 0, 900 * dt);
      }
      this.aimAngle = Math.atan2((player.y + player.h * .45) - (this.y + 26), player.x - this.x);
      if (this.attackCooldown <= 0 && distance < 620) {
        this.state = 'aim';
        this.stateTime = 0;
        this.attackCooldown = rand(1.7, 2.5);
      }
    }

    fireArrow() {
      const sx = this.x + this.face * 20;
      const sy = this.y + 26;
      const tx = player.x;
      const ty = player.y + player.h * .45;
      const a = Math.atan2(ty - sy, tx - sx);
      projectiles.push(new Projectile(sx, sy, Math.cos(a) * 430, Math.sin(a) * 430, 'arrow', 13));
      audio.sfx('arrow');
    }
  }

  class Projectile {
    constructor(x, y, vx, vy, kind, damage) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = kind; this.damage = damage;
      this.life = 4; this.dead = false;
      this.rot = Math.atan2(vy, vx);
      this.trail = [];
    }
    update(dt) {
      this.life -= dt;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 5) this.trail.shift();
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.kind === 'arrow') this.vy += 55 * dt;
      if (this.life <= 0) this.dead = true;
      if (this.kind === 'ember') {
        const a = Math.atan2(this.vy, this.vx) + Math.sin(gameTime * 10 + this.x) * .12;
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(a) * sp;
        this.vy = Math.sin(a) * sp;
        if (Math.random() < .55) spawnParticle({
          x: this.x, y: this.y, vx: rand(-15, 15), vy: rand(-30, 10),
          life: .4, maxLife: .4, size: rand(1, 3), color: Math.random() < .5 ? '#e69c58' : '#f3ca83',
          gravity: -10, drag: .94, glow: 1
        });
      }
      if (this.x < 20 || this.x > WORLD_W - 20 || this.y > FLOOR_Y + 30 || this.y < -100) this.dead = true;
      const r = { x: this.x - 5, y: this.y - 5, w: 10, h: 10 };
      if (aabb(r, player.rect())) {
        if (player.damage(this.damage, this.x - Math.sign(this.vx) * 10) && this.kind === 'ember') {
          burst(this.x, this.y, 12, '#e08a46', 170, { glow: 1, gravity: 300 });
        }
        this.dead = true;
      }
      for (const s of SOLIDS) {
        if (this.x > s.x && this.x < s.x + s.w && this.y > s.y && this.y < s.y + s.h) {
          this.dead = true;
          if (this.kind === 'arrow') burst(this.x, this.y, 4, '#b7a98b', 80, { gravity: 500 });
        }
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x - camera.x, this.y);
      if (this.kind === 'arrow') {
        ctx.rotate(this.rot);
        ctx.strokeStyle = '#c8bca3';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#d8cdb4';
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,150,128,.6)';
        ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-16, -4); ctx.moveTo(-11, 0); ctx.lineTo(-16, 4); ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        g.addColorStop(0, 'rgba(255,220,150,.95)');
        g.addColorStop(.35, 'rgba(227,124,58,.55)');
        g.addColorStop(1, 'rgba(200,70,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe1a3';
        ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Boss
  // ─────────────────────────────────────────────────────────────
  class Boss {
    constructor() {
      this.id = entityId++;
      this.x = 6490;
      this.y = FLOOR_Y - 190;
      this.w = 78;
      this.h = 190;
      this.hp = 780;
      this.maxHp = 780;
      this.face = -1;
      this.state = 'idle';
      this.stateTime = 0;
      this.dead = false;
      this.deadTimer = 0;
      this.hurtFlash = 0;
      this.invuln = 0;
      this.vx = 0;
      this.phase = 1;
      this.didHit = false;
      this.attackType = '';
      this.attackCooldown = 1.4;
      this.roarDone = false;
      this.deathDone = false;
      this.walkPhase = 0;
      this.summonTimer = 4;
      this.intro = 1.1;
    }

    get left() { return this.x - this.w / 2; }
    rect() { return { x: this.left, y: this.y, w: this.w, h: this.h }; }

    takeHit(dmg, sourceX, heavy) {
      if (this.dead) return;
      this.hp -= dmg;
      this.hurtFlash = .14;
      this.invuln = .04;
      if (this.hp <= 0) { this.hp = 0; this.die(); return; }
      if (this.phase === 1 && this.hp < this.maxHp * .52) {
        this.phase = 2;
        this.state = 'phase';
        this.stateTime = 0;
        this.attackCooldown = 2;
        audio.sfx('boss-roar');
        cameraShake = 18;
        flash = .2;
        addText(this.x, this.y - 20, 'THE CROWN BURNS', '#e3a15d', 19);
      }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.deadTimer = 0;
      this.hp = 0;
      game.bossDeathTimer = 0;
      player.souls += 4000;
      audio.sfx('boss-roar');
      audio.sfx('victory');
      cameraShake = 22;
      flash = .2;
      soulBurst(this.x, this.y + 70, 50);
      addText(this.x, this.y, '+4000 SOULS', '#f3d18e', 23);
      setTimeout(() => {
        if (game.bossDefeated) return;
        game.bossDefeated = true;
        game.gateSolid = null;
        audio.setBoss(false);
      }, 2800);
    }

    update(dt) {
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      if (this.dead) {
        this.deadTimer += dt;
        this.y += 28 * dt;
        this.vx = approach(this.vx, 0, 300 * dt);
        if (!this.deathDone && this.deadTimer > 4.4) {
          this.deathDone = true;
          showVictory();
        }
        return;
      }
      if (game.bossIntro > 0) {
        this.stateTime += dt;
        return;
      }
      this.intro = Math.max(0, this.intro - dt);
      this.stateTime += dt;
      this.attackCooldown -= dt;
      this.invuln = Math.max(0, this.invuln - dt);
      const dx = player.x - this.x;
      const distance = Math.abs(dx);
      this.face = dx > 0 ? 1 : -1;

      if (this.intro > 0) {
        this.vx = 0;
        return;
      }

      switch (this.state) {
        case 'idle': {
          this.vx = approach(this.vx, 0, 500 * dt);
          if (this.attackCooldown <= 0) {
            this.chooseAttack(distance);
          } else if (distance > 260) {
            this.vx = approach(this.vx, this.face * (this.phase === 2 ? 94 : 64), 450 * dt);
            this.walkPhase += dt * 3;
          }
          if (this.phase === 2 && this.summonTimer > 0) {
            this.summonTimer -= dt;
          }
          break;
        }
        case 'windup-slash': {
          this.vx = approach(this.vx, 0, 1000 * dt);
          const dur = this.phase === 2 ? .48 : .62;
          if (this.stateTime > dur) {
            this.state = 'slash';
            this.stateTime = 0;
            this.didHit = false;
            this.vx = this.face * (this.phase === 2 ? 260 : 180);
            audio.sfx('swing-heavy');
          }
          break;
        }
        case 'slash': {
          const range = 170;
          if (!this.didHit && this.stateTime > .06 && this.stateTime < .26) {
            const hb = { x: this.face > 0 ? this.x : this.x - range, y: this.y + 32, w: range, h: 126 };
            if (aabb(hb, player.rect())) {
              this.didHit = true;
              player.damage(this.phase === 2 ? 33 : 27, this.x);
            }
          }
          this.vx = approach(this.vx, 0, 1100 * dt);
          if (this.stateTime > .48) {
            this.state = 'recover';
            this.stateTime = 0;
            this.attackCooldown = this.phase === 2 ? rand(.5, .9) : rand(.9, 1.4);
          }
          break;
        }
        case 'windup-slam': {
          this.vx = approach(this.vx, 0, 800 * dt);
          if (this.stateTime > .78) {
            this.state = 'slam';
            this.stateTime = 0;
            this.didHit = false;
            audio.sfx('swing-heavy');
          }
          break;
        }
        case 'slam': {
          if (this.stateTime > .16 && !this.didHit) {
            this.didHit = true;
            const hb = { x: this.x - 145, y: this.y + 48, w: 290, h: 130 };
            if (aabb(hb, player.rect())) player.damage(31, this.x);
            cameraShake = 18;
            audio.sfx('hit-heavy');
            for (let i = 0; i < 22; i++) {
              spawnParticle({
                x: this.x + rand(-100, 100), y: FLOOR_Y - 4,
                vx: rand(-220, 220), vy: rand(-210, -30),
                life: rand(.35, .9), maxLife: .9, size: rand(2, 6),
                color: i % 3 ? '#57554d' : '#d89557', gravity: 800, drag: .97, glow: i % 3 ? 0 : 1
              });
            }
            // shockwave embers
            [-1, 1].forEach(dir => {
              projectiles.push(new Projectile(this.x + dir * 70, FLOOR_Y - 18, dir * 300, -20, 'ember', 17));
            });
          }
          if (this.stateTime > .55) {
            this.state = 'recover';
            this.stateTime = 0;
            this.attackCooldown = this.phase === 2 ? rand(.35, .7) : rand(.8, 1.2);
          }
          break;
        }
        case 'windup-dash': {
          this.vx = 0;
          if (this.stateTime > .56) {
            this.state = 'dash';
            this.stateTime = 0;
            this.didHit = false;
            this.vx = this.face * 520;
            audio.sfx('swing-heavy');
          }
          break;
        }
        case 'dash': {
          this.walkPhase += dt * 14;
          const hb = { x: this.left, y: this.y + 20, w: this.w, h: 130 };
          if (!this.didHit && aabb(hb, player.rect())) {
            this.didHit = true;
            player.damage(29, this.x);
          }
          if (this.stateTime > .48) {
            this.state = 'recover';
            this.stateTime = 0;
            this.vx = 0;
            this.attackCooldown = this.phase === 2 ? rand(.3, .7) : rand(.9, 1.3);
          }
          break;
        }
        case 'phase': {
          this.vx = 0;
          if (this.stateTime > 2.1) {
            this.state = 'idle';
            this.stateTime = 0;
            this.phase = 2;
          }
          if (this.stateTime > .4 && !this.roarDone) {
            this.roarDone = true;
            audio.sfx('boss-roar');
            cameraShake = 16;
            for (let i = 0; i < 26; i++) {
              spawnParticle({
                x: this.x + rand(-60, 60), y: this.y + rand(0, 120),
                vx: rand(-90, 90), vy: rand(-200, -30), life: rand(.6, 1.4),
                maxLife: 1.4, size: rand(1.5, 4), color: i % 2 ? '#e6974f' : '#f4c981',
                gravity: -25, drag: .97, glow: 1
              });
            }
          }
          break;
        }
        case 'recover': {
          this.vx = approach(this.vx, 0, 700 * dt);
          if (this.stateTime > (this.phase === 2 ? .34 : .55)) {
            this.state = 'idle';
            this.stateTime = 0;
          }
          break;
        }
      }

      if (this.state === 'idle' && this.phase === 2 && this.summonTimer <= 0) {
        this.summonTimer = 7;
        this.rainEmbers();
      }

      this.x += this.vx * dt;
      this.x = clamp(this.x, 5400, WORLD_W - 90);
      this.y = FLOOR_Y - this.h;
      if (distance < 112 && this.state === 'idle') this.vx = -this.face * 40;
    }

    chooseAttack(distance) {
      const r = Math.random();
      if (distance > 360) {
        if (r < .55) this.state = 'windup-dash';
        else this.state = 'windup-slam';
      } else {
        if (r < .58) this.state = 'windup-slash';
        else if (r < .84) this.state = 'windup-slam';
        else this.state = 'windup-dash';
      }
      if (this.phase === 2 && Math.random() < .25) this.state = 'windup-slam';
      this.stateTime = 0;
      this.didHit = false;
    }

    rainEmbers() {
      addText(this.x, this.y - 20, 'EMBERFALL', '#e1a05b', 16);
      for (let i = 0; i < 6; i++) {
        const x = player.x + rand(-330, 330);
        projectiles.push(new Projectile(x, -30 - i * 35, rand(-30, 30), rand(170, 260), 'ember', 14));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Setup & interactions
  // ─────────────────────────────────────────────────────────────
  function spawnEnemies() {
    enemies = SPAWNS.map(s => new Enemy(s.type, s.x, s.ground, s.patrol));
    projectiles = [];
    particles = particles.filter(p => p.life > 0);
  }

  function getNearbyInteractable() {
    if (!player || game.phase !== 'playing') return null;
    for (let i = 0; i < BONFIRES.length; i++) {
      const b = BONFIRES[i];
      if (dist(player.x, player.y + player.h, b.x, b.y) < 105) {
        return {
          type: 'bonfire', index: i,
          prompt: b.discovered ? 'E   REST AT BONFIRE' : 'E   LIGHT THE BONFIRE',
          action: () => openBonfire(i)
        };
      }
    }
    if (game.bloodstain && dist(player.x, player.y + 30, game.bloodstain.x, game.bloodstain.y) < 58) {
      return { type: 'souls', prompt: 'SOULS OF THE FALLEN', action: () => {} };
    }
    if (!game.bossFight && !game.bossDefeated && player.x > 5090 && player.x < 5340) {
      return { type: 'fog', prompt: 'THE FOG PARTS...', action: () => {} };
    }
    return null;
  }

  function restAtBonfire(index) {
    const b = BONFIRES[index];
    b.lit = true;
    b.discovered = true;
    game.lastBonfire = index;
    player.hp = player.maxHp;
    player.stamina = player.maxStamina;
    player.flasks = player.maxFlasks;
    player.invuln = 0;
    player.setState('idle');
    game.bossFight = false;
    game.gateSolid = null;
    boss = null;
    game.bossIntro = 0;
    spawnEnemies();
    projectiles = [];
    closeOverlays();
    game.fade = .75;
    game.fadeDir = -1;
    game.zoneBanner = 2.5;
    game.message = 'THE FLAME IS KINDLED';
    game.messageTimer = 3.2;
    audio.sfx('bonfire');
    for (let i = 0; i < 28; i++) {
      spawnParticle({
        x: b.x + rand(-35, 35), y: b.y - rand(5, 55),
        vx: rand(-40, 40), vy: rand(-140, -40), life: rand(.6, 1.6),
        maxLife: 1.6, size: rand(1.5, 4), color: i % 3 ? '#d98b47' : '#f6d394',
        gravity: -20, drag: .97, glow: 1
      });
    }
  }

  function openBonfire(index) {
    const b = BONFIRES[index];
    game.uiOpen = true;
    input.clearPressed();
    game.activeBonfire = index;
    if (!b.discovered) {
      b.discovered = true;
      b.lit = true;
      audio.sfx('bonfire');
    }
    if (game.phase !== 'playing') return;
    document.getElementById('bonfire-screen').hidden = false;
    updateBonfireUI();
    document.body.classList.remove('playing');
  }

  function updateBonfireUI() {
    const cost = levelCost();
    document.getElementById('bonfire-souls').textContent = player.souls.toLocaleString();
    const btn = document.getElementById('level-button');
    const canLevel = player.souls >= cost;
    btn.disabled = !canLevel;
    document.getElementById('level-copy').textContent = canLevel
      ? `Cost ${cost.toLocaleString()} souls · +vitality, stamina & strength`
      : `${cost.toLocaleString()} souls required · you have ${player.souls.toLocaleString()}`;
    const rest = document.getElementById('rest-button');
    rest.querySelector('small').textContent = game.bossFight
      ? 'Restore HP and estus · the Hollow King will remember'
      : 'Restore HP, stamina and estus · revive enemies';
  }

  function levelCost() {
    return 90 + (player.level - 1) * 72;
  }

  function levelUp() {
    const cost = levelCost();
    if (player.souls < cost) return;
    player.souls -= cost;
    player.level++;
    player.maxHp += 11;
    player.maxStamina += 7;
    player.damageBonus += 2.2;
    player.hp = player.maxHp;
    player.stamina = player.maxStamina;
    audio.sfx('level');
    soulBurst(player.x, player.y + 35, 24);
    updateBonfireUI();
    game.message = `LEVEL ${player.level} — STRENGTH GROWS`;
    game.messageTimer = 2.4;
  }

  function beginBossFight() {
    game.bossFight = true;
    game.bossIntro = 4.2;
    boss = new Boss();
    game.gateSolid = { x: 5205, y: 250, w: 44, h: 390 };
    audio.setBoss(true);
    audio.sfx('boss-roar');
    cameraShake = 14;
    document.getElementById('boss-intro').classList.add('show');
    setTimeout(() => document.getElementById('boss-intro').classList.remove('show'), 3800);
    game.zoneBanner = 0;
    flash = .2;
  }

  function showVictory() {
    if (game.victoryShown) return;
    game.victoryShown = true;
    game.phase = 'victory';
    game.uiOpen = true;
    document.getElementById('victory-souls').textContent = player.souls.toLocaleString();
    document.getElementById('victory-deaths').textContent = String(game.deaths);
    const t = Math.floor(game.time);
    document.getElementById('victory-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    document.getElementById('victory-screen').hidden = false;
    document.body.classList.remove('playing');
    audio.sfx('victory');
    audio.setBoss(false);
  }

  function closeOverlays() {
    game.uiOpen = false;
    game.paused = false;
    document.getElementById('bonfire-screen').hidden = true;
    document.getElementById('pause-screen').hidden = true;
    document.getElementById('death-screen').hidden = true;
    document.body.classList.add('playing');
    document.getElementById('touch-interact').hidden = true;
  }

  function respawn() {
    const b = BONFIRES[game.lastBonfire];
    player.x = b.x + (game.lastBonfire === 0 ? 40 : -30);
    player.y = b.y - player.h;
    player.vx = 0; player.vy = 0;
    player.hp = player.maxHp;
    player.stamina = player.maxStamina;
    player.flasks = player.maxFlasks;
    player.invuln = 1.1;
    player.setState('idle');
    player.souls = 0;
    game.bossFight = false;
    game.gateSolid = null;
    boss = null;
    game.bossIntro = 0;
    game.phase = 'playing';
    game.deathTimer = 0;
    game.fade = 1;
    game.fadeDir = -1;
    game.zone = game.lastBonfire === 0 ? 0 : 1;
    game.zoneBanner = 3.2;
    spawnEnemies();
    projectiles = [];
    flash = 0;
    closeOverlays();
    document.getElementById('death-screen').hidden = true;
    camera.x = clamp(player.x - VW * .42, 0, WORLD_W - VW);
    audio.setBoss(false);
    input.reset();
  }

  function resetRun() {
    player = new Player();
    game.phase = 'playing';
    game.paused = false;
    game.uiOpen = false;
    game.started = true;
    game.time = 0;
    game.deaths = 0;
    game.zone = 0;
    game.zoneBanner = 5;
    game.lastBonfire = 0;
    game.activeBonfire = 0;
    game.bossFight = false;
    game.bossDefeated = false;
    game.bossDeathTimer = 0;
    game.bossIntro = 0;
    game.victoryShown = false;
    game.gateSolid = null;
    game.bloodstain = null;
    game.message = '';
    game.messageTimer = 0;
    game.fade = 1;
    game.fadeDir = -1;
    enemies = [];
    projectiles = [];
    particles = [];
    floatingTexts = [];
    boss = null;
    BONFIRES[0].lit = true;
    BONFIRES[0].discovered = true;
    BONFIRES[1].lit = false;
    BONFIRES[1].discovered = false;
    spawnEnemies();
    camera.x = 0;
    cameraShake = 0;
    hitStop = 0;
    closeOverlays();
    document.getElementById('title-screen').hidden = true;
    document.getElementById('death-screen').hidden = true;
    document.getElementById('victory-screen').hidden = true;
    document.getElementById('bonfire-screen').hidden = true;
    document.getElementById('pause-screen').hidden = true;
    document.body.classList.add('playing');
    audio.init();
    audio.sfx('bonfire');
  }

  // ─────────────────────────────────────────────────────────────
  // Ambient scene data
  // ─────────────────────────────────────────────────────────────
  const stars = Array.from({ length: 110 }, () => ({
    x: rand(0, VW), y: rand(18, 340), r: rand(.35, 1.5),
    a: rand(.18, .8), tw: rand(0, TAU), sp: rand(.5, 1.7)
  }));

  const motes = Array.from({ length: 92 }, () => ({
    x: rand(0, VW), y: rand(0, VH), z: rand(.15, 1),
    vx: rand(-9, 15), vy: rand(5, 22), size: rand(.5, 2.1),
    phase: rand(0, TAU), bright: rand(.2, .8)
  }));

  const fogBands = Array.from({ length: 6 }, (_, i) => ({
    y: 390 + i * 55, h: rand(34, 86), speed: rand(4, 11) * (i % 2 ? 1 : -1),
    alpha: rand(.018, .05), phase: rand(0, TAU)
  }));

  const candles = Array.from({ length: 26 }, () => ({
    x: rand(300, 7000), y: FLOOR_Y - rand(2, 8), h: rand(4, 11), phase: rand(0, TAU)
  }));

  const dust = Array.from({ length: 32 }, () => ({
    x: rand(0, WORLD_W), y: FLOOR_Y - rand(5, 160), size: rand(.6, 1.8), phase: rand(0, TAU)
  }));

  // ─────────────────────────────────────────────────────────────
  // Environment rendering
  // ─────────────────────────────────────────────────────────────
  function drawSky(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, 520);
    sky.addColorStop(0, '#142a35');
    sky.addColorStop(.38, '#1e3641');
    sky.addColorStop(.68, '#2b4548');
    sky.addColorStop(1, '#3a514b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, VH);

    // Pale aurora haze.
    const haze = ctx.createRadialGradient(VW * .68, 245, 20, VW * .68, 245, 520);
    haze.addColorStop(0, 'rgba(129, 156, 146, .055)');
    haze.addColorStop(.55, 'rgba(96, 122, 117, .026)');
    haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, VW, 600);

    // Stars.
    for (const s of stars) {
      const a = s.a * (.6 + .4 * Math.sin(t * s.sp + s.tw));
      ctx.fillStyle = `rgba(216, 220, 207, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }

    // Dead moon.
    const mx = 976 - Math.sin(t * .014) * 18 - camera.x * .009;
    const my = 148;
    const halo = ctx.createRadialGradient(mx, my, 25, mx, my, 150);
    halo.addColorStop(0, 'rgba(204, 199, 176, .12)');
    halo.addColorStop(.4, 'rgba(159, 161, 144, .05)');
    halo.addColorStop(1, 'rgba(100, 120, 115, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 160, my - 160, 320, 320);

    ctx.save();
    ctx.globalAlpha = .82;
    const moon = ctx.createRadialGradient(mx - 18, my - 20, 4, mx, my, 62);
    moon.addColorStop(0, '#d4d0bf');
    moon.addColorStop(.65, '#b5b5a7');
    moon.addColorStop(1, '#8e958d');
    ctx.fillStyle = moon;
    ctx.beginPath(); ctx.arc(mx, my, 61, 0, TAU); ctx.fill();
    // Craters.
    ctx.fillStyle = 'rgba(95, 104, 100, .23)';
    [[-21, -14, 11], [19, 7, 15], [-2, 29, 7], [31, -25, 6], [-35, 18, 5]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(mx + x, my + y, r, 0, TAU); ctx.fill();
    });
    // A dark bite taken from the moon.
    ctx.fillStyle = 'rgba(8, 14, 17, .88)';
    ctx.beginPath();
    ctx.arc(mx + 60, my - 31, 58, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(211, 160, 103, .12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(mx, my, 69, 0, TAU); ctx.stroke();
    ctx.restore();

    // Soft cloud strips.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const y = 150 + i * 45;
      const x = ((i * 270 - t * (2 + i * .7) - camera.x * .018) % (VW + 500)) - 250;
      const g = ctx.createLinearGradient(x, y, x + 420, y);
      g.addColorStop(0, 'rgba(120, 138, 134, 0)');
      g.addColorStop(.4, `rgba(112, 132, 129, ${.026 + i * .005})`);
      g.addColorStop(1, 'rgba(120, 140, 136, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + 200, y, 260, 20 + i * 4, -.04, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMountains() {
    const layers = [
      { depth: .035, base: 428, h: 90, color: '#17282c', step: 58, amp: 34 },
      { depth: .07, base: 466, h: 78, color: '#142226', step: 42, amp: 27 },
      { depth: .12, base: 502, h: 64, color: '#101c1f', step: 34, amp: 19 }
    ];
    for (const L of layers) {
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(0, 580);
      const off = camera.x * L.depth;
      for (let x = -40; x <= VW + 40; x += L.step) {
        const n = Math.sin((x + off) * .006) * L.amp +
          Math.sin((x + off) * .013 + 1.7) * L.amp * .45 +
          Math.sin((x + off) * .029 + .2) * 7;
        ctx.lineTo(x, L.base - L.h - n);
      }
      ctx.lineTo(VW, 580);
      ctx.closePath();
      ctx.fill();
    }

    // Frozen mist caught between the peaks.
    const mist = ctx.createLinearGradient(0, 410, 0, 535);
    mist.addColorStop(0, 'rgba(126, 148, 142, 0)');
    mist.addColorStop(.6, 'rgba(126, 148, 142, .026)');
    mist.addColorStop(1, 'rgba(126, 148, 142, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 400, VW, 145);
  }

  function drawTower(x, baseY, w, h, seed, dim) {
    const c = dim ? '#192d32' : '#1d3338';
    ctx.fillStyle = c;
    ctx.fillRect(x, baseY - h, w, h + 18);
    // Buttresses.
    ctx.fillRect(x - 4, baseY - h * .58, 5, h * .58);
    ctx.fillRect(x + w - 1, baseY - h * .7, 5, h * .7);
    // Roof.
    ctx.beginPath();
    ctx.moveTo(x - 10, baseY - h);
    ctx.lineTo(x + w * .18, baseY - h - w * .36);
    ctx.lineTo(x + w * .42, baseY - h - w * 1.02);
    ctx.lineTo(x + w * .62, baseY - h - w * .4);
    ctx.lineTo(x + w + 8, baseY - h);
    ctx.closePath();
    ctx.fill();
    // Spire.
    ctx.fillRect(x + w * .41, baseY - h - w * 1.42, 2, w * .45);
    ctx.beginPath();
    ctx.arc(x + w * .42, baseY - h - w * 1.42, 2, 0, TAU);
    ctx.fill();
    // Windows.
    for (let r = 0; r < 4; r++) {
      const wy = baseY - h + 22 + r * (h * .18);
      for (let col = 0; col < 2; col++) {
        const lit = hash(seed, r * 3 + col) > .62;
        ctx.fillStyle = lit ? 'rgba(225, 148, 78, .46)' : 'rgba(1, 4, 5, .5)';
        ctx.fillRect(x + 9 + col * (w - 24), wy, 5, 9);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x, baseY - 10, w, 10);
  }

  function drawCastle() {
    const base = 545;
    const off = camera.x * .16;
    ctx.save();
    ctx.globalAlpha = .95;
    // Long wall silhouette.
    ctx.fillStyle = '#192d32';
    ctx.fillRect(0, 432, VW, 122);
    for (let i = -2; i < 12; i++) {
      const spacing = 270;
      const wx = i * spacing - (off % spacing);
      const hh = 100 + hash(i, 2) * 130;
      drawTower(wx + 20, base, 46 + hash(i, 1) * 24, hh, i + 10, false);
      if (hash(i, 7) > .42) {
        drawTower(wx + 100, base, 28, hh * .65, i + 30, true);
      }
      // Wall arches and crenellations.
      ctx.fillStyle = '#192d32';
      const wallY = 492;
      ctx.fillRect(wx, wallY, spacing, 55);
      for (let m = 0; m < 5; m++) {
        ctx.fillRect(wx + m * 48 + 8, wallY - 9, 20, 12);
      }
      ctx.fillStyle = 'rgba(0,0,0,.38)';
      ctx.beginPath();
      ctx.arc(wx + 82, wallY + 8, 18, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(194, 119, 61, .13)';
      for (let k = 0; k < 3; k++) {
        if (hash(i * 9, k) > .58) ctx.fillRect(wx + 50 + k * 42, wallY + 12, 3, 6);
      }
    }
    // A great broken cathedral spire.
    const bx = 1680 - off;
    ctx.fillStyle = '#1c3034';
    ctx.beginPath();
    ctx.moveTo(bx, 474);
    ctx.lineTo(bx, 250);
    ctx.lineTo(bx + 34, 156);
    ctx.lineTo(bx + 67, 250);
    ctx.lineTo(bx + 72, 474);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 30, 250);
    ctx.lineTo(bx + 34, 108);
    ctx.lineTo(bx + 39, 250);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(192, 111, 58, .18)';
    ctx.beginPath();
    ctx.arc(bx + 34, 308, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMidground(t) {
    const depth = .34;
    const off = camera.x * depth;
    ctx.save();

    // Distant hall arches.
    for (let i = -1; i < 8; i++) {
      const wx = i * 430 - (off % 430);
      if (wx < -180 || wx > VW + 180) continue;
      ctx.fillStyle = 'rgba(23, 38, 41, .9)';
      // pillars
      ctx.fillRect(wx + 40, 330, 20, 255);
      ctx.fillRect(wx + 256, 330, 20, 255);
      // arch
      ctx.beginPath();
      ctx.moveTo(wx + 60, 350);
      ctx.quadraticCurveTo(wx + 158, 250, wx + 256, 350);
      ctx.lineTo(wx + 242, 360);
      ctx.quadraticCurveTo(wx + 158, 272, wx + 74, 360);
      ctx.closePath();
      ctx.fill();
      // broken tracery
      if (i % 2 === 0) {
        ctx.strokeStyle = 'rgba(6, 12, 14, .7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx + 158, 290);
        ctx.lineTo(wx + 158, 420);
        ctx.stroke();
      }
      // faint windows
      ctx.fillStyle = 'rgba(93, 106, 91, .025)';
      ctx.fillRect(wx + 74, 372, 168, 180);
    }

    // Broken columns closer to the path.
    for (let i = 0; i < 10; i++) {
      const wx = i * 760 + 260 - ((camera.x * .58) % 760);
      if (wx < -100 || wx > VW + 100) continue;
      const h = 80 + hash(i, 4) * 180;
      ctx.fillStyle = 'rgba(24, 40, 43, .93)';
      ctx.fillRect(wx, FLOOR_Y - h, 32, h);
      ctx.fillRect(wx - 8, FLOOR_Y - h, 48, 9);
      ctx.fillRect(wx - 5, FLOOR_Y - h + h * .5, 42, 6);
      ctx.fillStyle = 'rgba(98, 108, 96, .055)';
      ctx.fillRect(wx + 26, FLOOR_Y - h + 10, 3, h - 16);
      // dead ivy
      ctx.strokeStyle = 'rgba(38, 49, 40, .45)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(wx + 6 + k * 6, FLOOR_Y - h + 7);
        ctx.bezierCurveTo(wx + 3, FLOOR_Y - h + 38, wx + 16, FLOOR_Y - h + 62, wx + 8 + k * 5, FLOOR_Y - h + 95);
        ctx.stroke();
      }
    }

    // Dead trees.
    for (let i = 0; i < 7; i++) {
      const wx = i * 1050 + 90 - ((camera.x * .5) % 1050);
      if (wx < -120 || wx > VW + 120) continue;
      drawDeadTree(wx, FLOOR_Y + 2, .7 + hash(i, 5) * .65, i + 12);
    }

    ctx.restore();

    // Low mist.
    ctx.save();
    for (const b of fogBands) {
      const x = (t * b.speed - camera.x * .18) % (VW + 400) - 200;
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g.addColorStop(0, 'rgba(168, 183, 175, 0)');
      g.addColorStop(.45, `rgba(152, 169, 163, ${b.alpha})`);
      g.addColorStop(1, 'rgba(140, 158, 153, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + 380, b.y + b.h * .5, 430, b.h * .55, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDeadTree(x, baseY, scale, seed) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.strokeStyle = 'rgba(5, 10, 12, .92)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-8, -65, 16, -122, -5, -208);
    ctx.stroke();
    ctx.lineWidth = 4.5;
    const branches = [
      [-2, -100, -52, -142, -79, -188],
      [2, -126, 47, -164, 72, -206],
      [0, -155, -35, -190, -48, -226],
      [5, -176, 28, -208, 33, -247]
    ];
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.bezierCurveTo(b[0] - 16, b[1] - 14, b[2] + 10, b[3] + 12, b[2], b[3]);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 3.5 - i * .5);
      ctx.beginPath();
      ctx.moveTo(b[2], b[3]);
      ctx.lineTo(b[4], b[5]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // Stonework & interactive scenery
  // ─────────────────────────────────────────────────────────────
  function drawGroundSegment(g) {
    const sx = g.x - camera.x;
    if (sx > VW + 30 || sx + g.w < -30) return;
    const top = g.y;
    const grd = ctx.createLinearGradient(0, top, 0, VH);
    grd.addColorStop(0, '#3c4844');
    grd.addColorStop(.14, '#283334');
    grd.addColorStop(1, '#121a1c');
    ctx.fillStyle = grd;
    ctx.fillRect(sx, top, g.w, g.h);

    // Rough top surface.
    ctx.fillStyle = '#5d6657';
    ctx.beginPath();
    ctx.moveTo(sx - 4, top + 7);
    const start = Math.max(g.x, camera.x - 10);
    const end = Math.min(g.x + g.w, camera.x + VW + 10);
    for (let wx = start; wx <= end; wx += 22) {
      const n = hash(Math.floor(wx / 22), 3) * 5;
      ctx.lineTo(wx - camera.x, top + 1 + n);
    }
    ctx.lineTo(sx + g.w + 4, top + 9);
    ctx.lineTo(sx + g.w + 4, top + 17);
    ctx.lineTo(sx - 4, top + 17);
    ctx.closePath();
    ctx.fill();

    // Moonlit lip.
    ctx.strokeStyle = 'rgba(126, 137, 119, .26)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let wx = start; wx <= end; wx += 22) {
      const n = hash(Math.floor(wx / 22), 3) * 5;
      const px = wx - camera.x, py = top + 2.2 + n;
      if (wx === start) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Masonry.
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, top + 15, g.w, Math.min(g.h, VH - top));
    ctx.clip();
    const rowH = 23;
    for (let row = 0; row < 15; row++) {
      const y = top + 18 + row * rowH;
      if (y > VH + 20) break;
      const offset = (row % 2) * 30;
      for (let bx = start - 60 + offset; bx < end + 40; bx += 61) {
        const n = hash(Math.floor(bx / 61), row);
        if (n < .13) continue;
        const px = bx - camera.x;
        ctx.fillStyle = `rgba(${12 + n * 9}, ${17 + n * 10}, ${18 + n * 9}, ${.24 + n * .3})`;
        ctx.fillRect(px + 1, y + 1, 57 + n * 3, rowH - 2);
        ctx.strokeStyle = 'rgba(0,0,0,.32)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, y + 1, 57 + n * 3, rowH - 2);
        if (n > .72) {
          ctx.strokeStyle = 'rgba(84, 94, 79, .14)';
          ctx.beginPath();
          ctx.moveTo(px + 8, y + 4);
          ctx.lineTo(px + 17, y + 12);
          ctx.lineTo(px + 12, y + 17);
          ctx.stroke();
        }
      }
    }
    // Moss and cracked edges.
    for (let i = 0; i < g.w / 150; i++) {
      const mx = g.x + i * 150 + hash(i, 7) * 90;
      const px = mx - camera.x;
      if (px < -50 || px > VW + 50) continue;
      ctx.strokeStyle = `rgba(53, 68, 54, ${.12 + hash(i, 9) * .2})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const yy = top + 4 + k * 8;
        const xx = px + Math.sin(k * 2 + i) * 8;
        if (k === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Gap edge / broken masonry.
    ctx.fillStyle = 'rgba(2, 4, 5, .6)';
    ctx.fillRect(sx + g.w - 14, top + 10, 14, Math.min(190, g.h));
    ctx.fillRect(sx, top + 10, 10, Math.min(160, g.h));
  }

  function drawPlatform(p) {
    const sx = p.x - camera.x;
    if (sx > VW + 60 || sx + p.w < -60) return;
    ctx.save();
    if (p.kind === 'rubble') {
      ctx.fillStyle = '#111719';
      ctx.beginPath();
      ctx.moveTo(sx, p.y + 8);
      ctx.lineTo(sx + 9, p.y);
      ctx.lineTo(sx + p.w - 17, p.y + 3);
      ctx.lineTo(sx + p.w, p.y + 13);
      ctx.lineTo(sx + p.w - 9, p.y + p.h);
      ctx.lineTo(sx + 7, p.y + p.h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(95, 100, 82, .18)';
      ctx.fillRect(sx + 10, p.y + 2, p.w - 30, 4);
      ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.strokeRect(sx + 18, p.y + 18, 37, 16);
      ctx.strokeRect(sx + 64, p.y + 34, 44, 14);
      ctx.restore();
      return;
    }
    const grd = ctx.createLinearGradient(0, p.y, 0, p.y + p.h + 6);
    grd.addColorStop(0, '#626b5a');
    grd.addColorStop(.3, '#3c4744');
    grd.addColorStop(1, '#1e2628');
    ctx.fillStyle = grd;
    ctx.fillRect(sx, p.y + 5, p.w, p.h + 3);
    // Jagged underside.
    ctx.fillStyle = '#0a1012';
    ctx.beginPath();
    ctx.moveTo(sx, p.y + p.h);
    for (let x = 0; x <= p.w; x += 12) {
      ctx.lineTo(sx + x, p.y + p.h + Math.sin(x * .4 + p.x) * 2 + hash(x, p.x) * 7);
    }
    ctx.lineTo(sx + p.w, p.y + p.h + 16);
    ctx.lineTo(sx, p.y + p.h + 16);
    ctx.closePath();
    ctx.fill();
    // Slab top.
    ctx.fillStyle = '#737b68';
    ctx.beginPath();
    ctx.moveTo(sx - 2, p.y + 8);
    for (let x = 0; x <= p.w; x += 18) {
      ctx.lineTo(sx + x, p.y + 3 + hash(Math.floor((p.x + x) / 18), 8) * 5);
    }
    ctx.lineTo(sx + p.w + 2, p.y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(144, 147, 129, .24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, p.y + 4);
    ctx.lineTo(sx + p.w, p.y + 4);
    ctx.stroke();
    // Segments & ivy.
    for (let x = 16; x < p.w; x += 38) {
      ctx.strokeStyle = 'rgba(0,0,0,.32)';
      ctx.beginPath(); ctx.moveTo(sx + x, p.y + 8); ctx.lineTo(sx + x - 2, p.y + p.h + 2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(50, 65, 50, .35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx + 13, p.y + 4);
    ctx.bezierCurveTo(sx + 5, p.y + 24, sx + 21, p.y + 36, sx + 12, p.y + 52);
    ctx.stroke();
    ctx.restore();
  }

  function drawArch(x, height = 300, width = 190, broken = false) {
    const sx = x - camera.x;
    if (sx < -160 || sx > VW + 160) return;
    const base = FLOOR_Y;
    ctx.save();
    ctx.fillStyle = 'rgba(37, 52, 52, .93)';
    ctx.fillRect(sx - width / 2 - 15, base - height, 28, height);
    ctx.fillRect(sx + width / 2 - 13, base - height, 28, height);
    // capitals
    ctx.fillStyle = 'rgba(35, 43, 40, .92)';
    ctx.fillRect(sx - width / 2 - 23, base - height, 44, 12);
    ctx.fillRect(sx + width / 2 - 21, base - height, 44, 12);
    // arch
    ctx.strokeStyle = 'rgba(54, 67, 64, .94)';
    ctx.lineWidth = 27;
    ctx.beginPath();
    ctx.arc(sx, base - height + 12, width / 2, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(89, 96, 81, .1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, base - height + 12, width / 2 - 15, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    if (broken) {
      ctx.fillStyle = '#070c0e';
      ctx.beginPath();
      ctx.moveTo(sx + width * .12, base - height - 20);
      ctx.lineTo(sx + width * .42, base - height - 55);
      ctx.lineTo(sx + width * .55, base - height - 16);
      ctx.lineTo(sx + width * .4, base - height + 4);
      ctx.closePath();
      ctx.fill();
    }
    // chains
    ctx.strokeStyle = 'rgba(55, 58, 51, .36)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const cx = sx - width * .22 + i * 34;
      ctx.beginPath();
      ctx.moveTo(cx, base - height - 18);
      ctx.quadraticCurveTo(cx + Math.sin(gameTime + i) * 5, base - height * .7, cx + 4, base - height * .38);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTorch(torch, t) {
    const x = torch.x - camera.x;
    if (x < -60 || x > VW + 60) return;
    const y = torch.y;
    ctx.save();
    // Bracket & pole.
    ctx.strokeStyle = '#1d2220';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 26);
    ctx.lineTo(x, y + 3);
    ctx.stroke();
    ctx.fillStyle = '#252a25';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 7, 4, 0, 0, TAU);
    ctx.fill();
    // Flame.
    const f = Math.sin(t * 7 + torch.x) * .5 + Math.sin(t * 13 + torch.x * .3) * .5;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, 44 + f * 5);
    glow.addColorStop(0, 'rgba(255, 196, 108, .32)');
    glow.addColorStop(.35, 'rgba(224, 124, 57, .12)');
    glow.addColorStop(1, 'rgba(190, 80, 30, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 60, y - 70, 120, 120);
    ctx.fillStyle = 'rgba(226, 112, 45, .82)';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 1);
    ctx.quadraticCurveTo(x - 9, y - 18 - f * 3, x + f * 2, y - 26 - f * 4);
    ctx.quadraticCurveTo(x + 9, y - 13, x + 4, y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(249, 204, 122, .9)';
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.quadraticCurveTo(x - 4, y - 12, x + 1, y - 17 - f * 2);
    ctx.quadraticCurveTo(x + 5, y - 8, x + 3, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCandle(c, t) {
    const sx = c.x - camera.x;
    if (sx < -20 || sx > VW + 20) return;
    const flick = Math.sin(t * 9 + c.phase) * .6;
    ctx.fillStyle = 'rgba(214, 203, 177, .34)';
    ctx.fillRect(sx - 1.4, c.y - c.h, 2.8, c.h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(241, 173, 84, ${.5 + flick * .2})`;
    ctx.beginPath();
    ctx.ellipse(sx, c.y - c.h - 2, 1.6, 3.2 + flick, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBonfire(b, t) {
    const x = b.x - camera.x;
    const y = b.y;
    if (x < -160 || x > VW + 160) return;
    ctx.save();
    // Ash ring.
    ctx.fillStyle = 'rgba(4, 6, 7, .55)';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 53, 13, 0, 0, TAU); ctx.fill();
    // Swords planted in the ash, a crown of iron.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + .3;
      const rx = x + Math.cos(a) * (33 + (i % 3) * 5);
      const ry = y - 5 + Math.sin(a) * 7;
      ctx.strokeStyle = i % 2 ? '#343630' : '#232624';
      ctx.lineWidth = i === 0 ? 4.5 : 2.4;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.sin(a) * 6, ry - 55 - hash(i, 3) * 25);
      ctx.stroke();
      ctx.fillStyle = '#3e4038';
      if (i === 0) {
        ctx.fillRect(rx - 8, ry - 65, 17, 4);
        ctx.fillRect(rx - 2, ry - 72, 5, 8);
      }
    }
    // Coiled sword.
    ctx.save();
    ctx.translate(x, y - 8);
    ctx.rotate(-.03);
    ctx.fillStyle = '#6a6759';
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(-4, -52); ctx.lineTo(0, -67); ctx.lineTo(4, -52); ctx.lineTo(3, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(224, 194, 137, .38)';
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(0, -58); ctx.lineTo(2, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#32342e';
    ctx.fillRect(-13, -8, 26, 5);
    ctx.fillRect(-4, 2, 8, 16);
    ctx.restore();

    if (b.lit) {
      const f = Math.sin(t * 6) * .5 + Math.sin(t * 11 + 2) * .5;
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, y - 35, 4, x, y - 35, 115 + f * 10);
      glow.addColorStop(0, 'rgba(255, 198, 112, .42)');
      glow.addColorStop(.28, 'rgba(235, 135, 53, .18)');
      glow.addColorStop(1, 'rgba(190, 79, 25, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 140, y - 175, 280, 260);
      // Flame tongues.
      for (let i = 0; i < 4; i++) {
        const ox = Math.sin(t * 2.4 + i * 1.9) * (5 + i * 2);
        const hh = 48 + i * 11 + Math.sin(t * 6 + i) * 7;
        ctx.fillStyle = i === 0 ? 'rgba(249, 213, 142, .75)' : `rgba(225, 117, 43, ${.32 - i * .04})`;
        ctx.beginPath();
        ctx.moveTo(x - 13 + i * 6, y - 10);
        ctx.quadraticCurveTo(x - 18 + ox, y - hh * .6, x + ox, y - hh);
        ctx.quadraticCurveTo(x + 18 + ox, y - hh * .45, x + 13 - i * 3, y - 10);
        ctx.closePath();
        ctx.fill();
      }
      // Embers.
      for (let i = 0; i < 16; i++) {
        const ph = (t * .32 + i * .137) % 1;
        const ex = x + Math.sin(t * 1.4 + i * 2.7) * (8 + ph * 20);
        const ey = y - 20 - ph * 120;
        ctx.fillStyle = `rgba(242, 167, 83, ${(1 - ph) * .45})`;
        ctx.beginPath(); ctx.arc(ex, ey, 1 + hash(i, 4), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawFogGate(t) {
    if (game.bossDefeated) return;
    const x = 5232 - camera.x;
    if (x < -100 || x > VW + 100) return;
    const tall = 260;
    const top = FLOOR_Y - tall;
    ctx.save();
    if (game.bossFight) {
      ctx.fillStyle = 'rgba(8, 20, 21, .5)';
      ctx.fillRect(x - 26, top - 20, 52, tall + 20);
    }
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 16; i++) {
      const ph = t * .5 + i * .4;
      const yy = top + i * (tall / 16);
      const wiggle = Math.sin(ph + i * .7) * 14;
      const g = ctx.createLinearGradient(x - 35, 0, x + 35, 0);
      g.addColorStop(0, 'rgba(162, 188, 177, 0)');
      g.addColorStop(.45, `rgba(160, 187, 177, ${.025 + .035 * Math.sin(ph) ** 2})`);
      g.addColorStop(.6, `rgba(198, 212, 200, ${.05 + .04 * Math.cos(ph) ** 2})`);
      g.addColorStop(1, 'rgba(162, 188, 177, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + wiggle * .3, yy, 43 + Math.sin(ph) * 6, 18, 0, 0, TAU);
      ctx.fill();
    }
    // Vertical wisps.
    ctx.strokeStyle = 'rgba(187, 205, 192, .18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      for (let yy = 0; yy < tall; yy += 14) {
        const px = x + Math.sin(t * .9 + i * 1.4 + yy * .025) * (17 + i * 5);
        if (yy === 0) ctx.moveTo(px, top + yy);
        else ctx.lineTo(px, top + yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMessages(t) {
    for (const m of WORLD_MESSAGES) {
      const x = m.x - camera.x;
      if (x < -260 || x > VW + 260) continue;
      ctx.save();
      ctx.font = `italic ${m.size + 2}px ${SERIF}`;
      ctx.textAlign = 'center';
      const glow = .42 + Math.sin(t * 1.4 + m.x) * .12;
      ctx.fillStyle = `rgba(218, 201, 158, ${glow * .22})`;
      ctx.fillText(m.text, x, m.y + 25);
      ctx.fillStyle = `rgba(205, 188, 150, ${glow})`;
      ctx.fillText(m.text, x, m.y + 25);
      ctx.restore();
    }
  }

  function drawBloodstain(t) {
    if (!game.bloodstain) return;
    const b = game.bloodstain;
    const x = b.x - camera.x;
    const y = b.y - 8;
    if (x < -60 || x > VW + 60) return;
    const pulse = .5 + Math.sin(t * 3.4) * .25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 1, x, y, 34 + pulse * 14);
    g.addColorStop(0, `rgba(244, 224, 166, ${.5 * pulse + .25})`);
    g.addColorStop(.3, `rgba(201, 136, 68, ${.18 * pulse})`);
    g.addColorStop(1, 'rgba(150, 40, 30, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 56, y - 56, 112, 112);
    for (let i = 0; i < 4; i++) {
      const ph = (t * .4 + i * .23) % 1;
      ctx.fillStyle = `rgba(234, 199, 130, ${(1 - ph) * .4})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t + i * 2) * 9, y - 22 - ph * 70, 1.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawThrone() {
    const x = 7010 - camera.x;
    if (x < -400 || x > VW + 400) return;
    const base = FLOOR_Y;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 9, 10, .95)';
    // Steps.
    ctx.fillRect(x - 150, base - 26, 300, 26);
    ctx.fillRect(x - 116, base - 52, 232, 26);
    ctx.fillRect(x - 80, base - 78, 160, 26);
    // Throne.
    ctx.beginPath();
    ctx.moveTo(x - 62, base - 78);
    ctx.lineTo(x - 62, base - 250);
    ctx.lineTo(x - 34, base - 310);
    ctx.lineTo(x - 20, base - 270);
    ctx.lineTo(x, base - 334);
    ctx.lineTo(x + 20, base - 270);
    ctx.lineTo(x + 34, base - 310);
    ctx.lineTo(x + 62, base - 250);
    ctx.lineTo(x + 62, base - 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(112, 88, 57, .18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ember eyes in the backrest.
    ctx.fillStyle = 'rgba(213, 127, 57, .17)';
    ctx.fillRect(x - 22, base - 255, 6, 14);
    ctx.fillRect(x + 16, base - 255, 6, 14);
    ctx.restore();
  }


  function drawBanner(x, top, w, h, t, hue = '83, 40, 34') {
    const sx = x - camera.x;
    if (sx < -w - 30 || sx > VW + w + 30) return;
    const wave = Math.sin(t * .7 + x) * 3;
    ctx.save();
    ctx.globalAlpha = .66;
    const g = ctx.createLinearGradient(sx, top, sx + w, top + h);
    g.addColorStop(0, `rgba(${hue}, .7)`);
    g.addColorStop(.55, `rgba(${hue}, .42)`);
    g.addColorStop(1, `rgba(${hue}, .14)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx + w, top);
    ctx.lineTo(sx + w + wave, top + h);
    ctx.lineTo(sx + w * .82, top + h - 18);
    ctx.lineTo(sx + w * .67, top + h + wave);
    ctx.lineTo(sx + w * .48, top + h - 12);
    ctx.lineTo(sx + w * .3, top + h + 14);
    ctx.lineTo(sx + w * .12, top + h - 6);
    ctx.lineTo(sx + wave, top + h + 4);
    ctx.closePath();
    ctx.fill();
    // Trim.
    ctx.strokeStyle = 'rgba(182, 135, 74, .18)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx + 3, top + 3); ctx.lineTo(sx + w - 3, top + 3); ctx.stroke();
    // Sun / crown sigil.
    ctx.strokeStyle = 'rgba(208, 167, 96, .22)';
    ctx.lineWidth = 1.2;
    const cx = sx + w * .5, cy = top + h * .34;
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
      ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStatue(x, t) {
    const sx = x - camera.x;
    if (sx < -90 || sx > VW + 90) return;
    const base = FLOOR_Y;
    ctx.save();
    // Plinth.
    ctx.fillStyle = 'rgba(25, 33, 33, .95)';
    ctx.fillRect(sx - 26, base - 18, 52, 18);
    ctx.fillRect(sx - 20, base - 27, 40, 10);
    ctx.fillStyle = 'rgba(52, 61, 54, .5)';
    ctx.fillRect(sx - 23, base - 19, 46, 2);
    // Body.
    const stone = ctx.createLinearGradient(sx - 16, base - 125, sx + 18, base - 30);
    stone.addColorStop(0, 'rgba(22, 31, 32, .98)');
    stone.addColorStop(.6, 'rgba(41, 51, 48, .95)');
    stone.addColorStop(1, 'rgba(16, 24, 25, .98)');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(sx - 17, base - 27);
    ctx.lineTo(sx - 12, base - 92);
    ctx.quadraticCurveTo(sx - 26, base - 108, sx - 22, base - 120);
    ctx.quadraticCurveTo(sx, base - 138, sx + 22, base - 120);
    ctx.quadraticCurveTo(sx + 27, base - 107, sx + 12, base - 92);
    ctx.lineTo(sx + 17, base - 27);
    ctx.closePath();
    ctx.fill();
    // Face void.
    ctx.fillStyle = 'rgba(3, 6, 7, .72)';
    ctx.beginPath();
    ctx.ellipse(sx, base - 112, 11, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(190, 136, 71, ${.15 + Math.sin(t * 1.2 + x) * .05})`;
    ctx.fillRect(sx - 4, base - 113, 2, 1.4);
    ctx.fillRect(sx + 2, base - 113, 2, 1.4);
    // Sword planted between feet.
    ctx.strokeStyle = 'rgba(115, 119, 100, .45)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx + 25, base - 26); ctx.lineTo(sx + 25, base - 94); ctx.stroke();
    ctx.strokeStyle = 'rgba(153, 147, 111, .35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + 21, base - 88); ctx.lineTo(sx + 29, base - 88); ctx.stroke();
    // Moss.
    ctx.strokeStyle = 'rgba(49, 66, 50, .36)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - 15, base - 30); ctx.quadraticCurveTo(sx - 8, base - 55, sx - 10, base - 79);
    ctx.stroke();
    ctx.restore();
  }

  function drawHangingChains(t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(105, 107, 94, .1)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
      const x = i * 330 + 120 - ((camera.x * .48) % 330);
      if (x < -120 || x > VW + 120) continue;
      const len = 150 + hash(i, 4) * 210;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y < len; y += 13) {
        const sway = Math.sin(t * .5 + y * .018 + i) * 5 * (y / len);
        ctx.lineTo(x + sway, y);
      }
      ctx.stroke();
      // links
      for (let y = 18; y < len; y += 28) {
        const sway = Math.sin(t * .5 + y * .018 + i) * 5 * (y / len);
        ctx.beginPath(); ctx.arc(x + sway, y, 2.4, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawForeground(t) {
    // Low fog drifting in front of the player.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const x = ((t * (8 + i * 3) - camera.x * .8) % (VW + 600)) - 200;
      const y = 646 + i * 15;
      const g = ctx.createLinearGradient(0, y - 30, 0, y + 48);
      g.addColorStop(0, 'rgba(151, 166, 155, 0)');
      g.addColorStop(.5, `rgba(138, 153, 145, ${.032 + i * .012})`);
      g.addColorStop(1, 'rgba(120, 138, 130, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + 400, y, 500, 50, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Foreground grass silhouettes.
    const off = camera.x % 170;
    for (let i = -1; i < 9; i++) {
      const x = i * 170 - off + 40;
      if (x < -60 || x > VW + 60) continue;
      const h = 18 + hash(i + Math.floor(camera.x / 170), 2) * 38;
      ctx.strokeStyle = 'rgba(2, 5, 6, .6)';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 4, 704);
        ctx.quadraticCurveTo(x + k * 4 - 12 + k * 6, 704 - h * .5, x + k * 4 + Math.sin(t + k) * 7, 704 - h);
        ctx.stroke();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Character rendering
  // ─────────────────────────────────────────────────────────────
  function drawKnightBody(sx, feetY, t, opts = {}) {
    const p = opts.player || player;
    const face = opts.face || p.face || 1;
    const state = opts.state || p.state || 'idle';
    const st = opts.stateTime ?? p.stateTime ?? 0;
    const walk = p.walkPhase || 0;
    const alpha = opts.alpha ?? 1;
    const title = !!opts.title;

    ctx.save();
    ctx.translate(sx, feetY);
    ctx.scale(face * 1.08, 1.08);
    ctx.globalAlpha = alpha;

    // Roll spin.
    if (state === 'roll') {
      const prog = clamp(st / .38, 0, 1);
      ctx.translate(0, -37);
      ctx.rotate(prog * TAU * .92);
      ctx.translate(0, 37);
    }
    if (state === 'dead') {
      ctx.translate(0, 2);
      ctx.rotate(-1.18);
    }

    const running = state === 'run' || state === 'jump' || state === 'fall';
    const moving = Math.abs(p.vx || 0) > 20;
    const stride = running && moving ? Math.sin(walk) * 9 : Math.sin(t * 1.35) * .8;
    const bob = running && moving ? Math.abs(Math.cos(walk)) * 2.2 : Math.sin(t * 1.3) * .6;
    const lean = state === 'run' ? .07 : state === 'heal' ? .04 : 0;
    ctx.translate(0, -bob);
    ctx.rotate(lean);

    const iron = '#363e3f';
    const ironDark = '#1b2224';
    const ironLight = '#737c74';
    const cloth = '#272a26';
    const clothDark = '#191d1c';
    const leather = '#4b3d30';
    const ember = '#d8a35f';

    // Cloak / cape.
    if (state !== 'roll') {
      const cwind = Math.sin(t * 2.4) * 3 + (moving ? Math.sin(walk * .5) * 4 : 0);
      const capeGrad = ctx.createLinearGradient(-34, -58, 8, -4);
      capeGrad.addColorStop(0, 'rgba(26, 33, 32, .95)');
      capeGrad.addColorStop(.7, 'rgba(20, 24, 24, .92)');
      capeGrad.addColorStop(1, 'rgba(13, 17, 18, .86)');
      ctx.fillStyle = capeGrad;
      ctx.beginPath();
      ctx.moveTo(-10, -60);
      ctx.quadraticCurveTo(-28 - cwind, -46, -27 - cwind, -24);
      ctx.lineTo(-34 - cwind * 1.4, -8);
      ctx.lineTo(-23, -16);
      ctx.lineTo(-24 + cwind, -3);
      ctx.lineTo(-11, -20);
      ctx.lineTo(-3, -35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(89, 94, 80, .16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Ragged edge.
      ctx.strokeStyle = 'rgba(9, 12, 13, .8)';
      ctx.beginPath();
      ctx.moveTo(-33 - cwind * 1.4, -8);
      ctx.lineTo(-28, -13);
      ctx.lineTo(-24 + cwind, -3);
      ctx.stroke();
    }

    // Back leg.
    const legSwing = stride;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#242b2c';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.moveTo(-4, -36);
    ctx.lineTo(-7 - legSwing * .35, -19);
    ctx.lineTo(-8 - legSwing, -2);
    ctx.stroke();
    // Boot.
    ctx.fillStyle = '#14191a';
    ctx.beginPath();
    ctx.moveTo(-14 - legSwing, -1);
    ctx.lineTo(-4 - legSwing, -2);
    ctx.lineTo(-2 - legSwing, 2);
    ctx.lineTo(-15 - legSwing, 3);
    ctx.closePath();
    ctx.fill();

    // Front leg.
    ctx.strokeStyle = '#303839';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(5, -37);
    ctx.lineTo(10 + legSwing * .35, -19);
    ctx.lineTo(11 + legSwing, -2);
    ctx.stroke();
    // Front boot.
    ctx.fillStyle = '#1b2122';
    ctx.beginPath();
    ctx.moveTo(5 + legSwing, -1);
    ctx.lineTo(16 + legSwing, -2);
    ctx.lineTo(18 + legSwing, 2);
    ctx.lineTo(4 + legSwing, 3);
    ctx.closePath();
    ctx.fill();
    // Greave highlight.
    ctx.strokeStyle = 'rgba(138, 144, 129, .24)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8 + legSwing * .35, -17);
    ctx.lineTo(10 + legSwing, -3);
    ctx.stroke();

    // Tassets / skirt plates.
    ctx.fillStyle = leather;
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(i * 8 + 2, -39);
      ctx.rotate(i * .08 + lean);
      ctx.fillStyle = i === 0 ? '#43382e' : '#332b25';
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(5, 16); ctx.lineTo(-4, 14); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Torso armour.
    const torso = ctx.createLinearGradient(-12, -62, 16, -38);
    torso.addColorStop(0, '#222a2b');
    torso.addColorStop(.45, '#3d4647');
    torso.addColorStop(.62, '#59615a');
    torso.addColorStop(1, '#242b2c');
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(-13, -57);
    ctx.lineTo(-9, -40);
    ctx.lineTo(0, -36);
    ctx.lineTo(11, -42);
    ctx.lineTo(14, -56);
    ctx.lineTo(9, -65);
    ctx.lineTo(-8, -65);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(7, 10, 11, .55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Breastplate highlight and rivets.
    ctx.strokeStyle = 'rgba(172, 177, 157, .28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, -60);
    ctx.quadraticCurveTo(7, -57, 9, -46);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(7, 10, 11, .55)';
    ctx.beginPath();
    ctx.moveTo(-8, -50);
    ctx.quadraticCurveTo(3, -46, 11, -51);
    ctx.stroke();
    ctx.fillStyle = 'rgba(198, 182, 144, .4)';
    ctx.beginPath(); ctx.arc(-5, -55, 1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -58, 1, 0, TAU); ctx.fill();

    // Belt.
    ctx.fillStyle = '#181d1e';
    ctx.fillRect(-11, -42, 23, 5);
    ctx.fillStyle = '#7b6646';
    ctx.fillRect(2, -42, 4, 5);

    // Shield — on the back by default, in front while guarding.
    const blocking = state === 'guard' || (opts.blocking && state !== 'roll');
    ctx.save();
    if (blocking) {
      ctx.translate(17, -45);
      ctx.rotate(-.22);
    } else {
      ctx.translate(-14, -44);
      ctx.rotate(.22);
    }
    const shieldGrad = ctx.createLinearGradient(-12, -20, 12, 20);
    shieldGrad.addColorStop(0, '#414846');
    shieldGrad.addColorStop(.5, '#252c2d');
    shieldGrad.addColorStop(1, '#141a1b');
    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(15, -16, 13, 2);
    ctx.quadraticCurveTo(8, 18, 0, 25);
    ctx.quadraticCurveTo(-8, 18, -13, 2);
    ctx.quadraticCurveTo(-15, -16, 0, -21);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(146, 148, 128, .3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Shield emblem — a broken crown.
    ctx.strokeStyle = 'rgba(192, 154, 93, .54)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, 1); ctx.lineTo(-4, -6); ctx.lineTo(-1, -1); ctx.lineTo(2, -7); ctx.lineTo(4, 0); ctx.lineTo(7, -5);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(6, 5); ctx.stroke();
    ctx.restore();

    // Sword arm and blade.
    let swordAngle = -1.02;
    if (state === 'attack') {
      if (p.attackType === 'light2') {
        const pr = clamp((st - .06) / .3, 0, 1);
        swordAngle = lerp(.55, -1.75, easeOutCubic(pr));
      } else {
        const pr = clamp((st - .05) / .29, 0, 1);
        swordAngle = lerp(-2.12, .58, easeOutCubic(pr));
      }
    } else if (state === 'heavy') {
      const pr = clamp((st - .19) / .36, 0, 1);
      swordAngle = lerp(-2.65, .72, easeInCubic(pr));
    } else if (state === 'guard') {
      swordAngle = -1.75;
    } else if (state === 'roll') {
      swordAngle = -.4;
    } else if (state === 'heal') {
      swordAngle = -.4;
    } else if (state === 'hurt' || state === 'stagger') {
      swordAngle = -1.75;
    } else if (running) {
      swordAngle = -1.3 + Math.sin(walk) * .08;
    }

    const attackActive = (state === 'attack' && st > .08 && st < .33) ||
      (state === 'heavy' && st > .22 && st < .57);
    if (attackActive) {
      ctx.save();
      ctx.translate(10, -47);
      ctx.globalCompositeOperation = 'lighter';
      const start = state === 'heavy' ? -2.5 : -2.0;
      const cur = swordAngle + .35;
      const mid = (start + cur) * .5;
      const rad = state === 'heavy' ? 70 : 61;
      const alpha = state === 'heavy' ? .28 : .22;
      ctx.strokeStyle = `rgba(233, 194, 123, ${alpha})`;
      ctx.lineWidth = state === 'heavy' ? 12 : 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, rad, start, Math.max(start + .01, cur));
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 245, 213, ${alpha * .8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, rad - 8, start + .12, Math.max(start + .14, cur - .04));
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(9, -48);
    ctx.rotate(swordAngle);
    // Arm.
    ctx.strokeStyle = '#3e4747';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(-1, 3);
    ctx.lineTo(12, 1);
    ctx.stroke();
    ctx.fillStyle = '#202728';
    ctx.beginPath(); ctx.arc(13, 1, 3.6, 0, TAU); ctx.fill();
    // Grip.
    ctx.fillStyle = '#2b231d';
    ctx.fillRect(10, -2.2, 15, 4.4);
    ctx.fillStyle = '#846b48';
    ctx.fillRect(11, -1.3, 12, 1);
    // Crossguard.
    ctx.fillStyle = '#5c6258';
    ctx.fillRect(23, -7, 4, 14);
    ctx.fillStyle = '#8b8d78';
    ctx.fillRect(23.5, -7, 1.5, 14);
    // Blade.
    const blade = ctx.createLinearGradient(26, -3, 74, 2);
    blade.addColorStop(0, '#7f867b');
    blade.addColorStop(.4, '#b6b9a8');
    blade.addColorStop(.75, '#8b9085');
    blade.addColorStop(1, '#50594f');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(26, -4);
    ctx.lineTo(66, -3.2);
    ctx.lineTo(78, 0);
    ctx.lineTo(66, 3.2);
    ctx.lineTo(26, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 228, 203, .4)';
    ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(69, .1); ctx.stroke();
    // Blade nicks.
    ctx.strokeStyle = 'rgba(20, 25, 24, .6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(52, -3.5); ctx.lineTo(54, -1); ctx.moveTo(61, 3); ctx.lineTo(63, .8); ctx.stroke();
    ctx.restore();

    // Head and hood.
    ctx.fillStyle = clothDark;
    ctx.beginPath();
    ctx.moveTo(-11, -62);
    ctx.quadraticCurveTo(-15, -73, -2, -77);
    ctx.quadraticCurveTo(8, -78, 11, -68);
    ctx.lineTo(10, -59);
    ctx.quadraticCurveTo(0, -55, -11, -62);
    ctx.closePath();
    ctx.fill();
    // Helmet.
    const helm = ctx.createLinearGradient(-7, -74, 8, -57);
    helm.addColorStop(0, '#2a3233');
    helm.addColorStop(.55, '#626a62');
    helm.addColorStop(1, '#252d2e');
    ctx.fillStyle = helm;
    ctx.beginPath();
    ctx.moveTo(-7, -69);
    ctx.quadraticCurveTo(-8, -77, 1, -78);
    ctx.quadraticCurveTo(10, -76, 10, -66);
    ctx.lineTo(8, -58);
    ctx.quadraticCurveTo(1, -55, -5, -59);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 9, 10, .65)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Eye slit.
    ctx.fillStyle = '#080b0c';
    ctx.beginPath();
    ctx.moveTo(-1, -68);
    ctx.lineTo(9, -69);
    ctx.lineTo(9, -65.5);
    ctx.lineTo(-1, -65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(240, 185, 104, ${state === 'hurt' ? .9 : .55 + Math.sin(t * 2) * .1})`;
    ctx.fillRect(2, -67.2, 4.5, 1.4);
    // Helmet ridge.
    ctx.strokeStyle = 'rgba(164, 165, 142, .28)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(1, -78);
    ctx.quadraticCurveTo(6, -74, 6, -69);
    ctx.stroke();
    // Scarf tail.
    ctx.strokeStyle = 'rgba(105, 56, 45, .45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -60);
    ctx.quadraticCurveTo(-16, -56 + Math.sin(t * 3) * 2, -23, -51);
    ctx.stroke();

    // Heal glow.
    if (state === 'heal') {
      const pr = clamp(st / .9, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(3, -37, 1, 3, -37, 28 + Math.sin(t * 8) * 4);
      g.addColorStop(0, `rgba(251, 209, 124, ${.32 * (1 - pr * .4)})`);
      g.addColorStop(.5, 'rgba(218, 142, 62, .1)');
      g.addColorStop(1, 'rgba(218, 142, 62, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(3, -37, 28, 0, TAU); ctx.fill();
      // Flask.
      ctx.fillStyle = 'rgba(170, 113, 50, .8)';
      ctx.fillRect(1, -44, 5, 8);
      ctx.fillStyle = 'rgba(236, 187, 102, .9)';
      ctx.fillRect(2, -40, 3, 3);
    }

    // Damage flash.
    if (p.hurtFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.hurtFlash * .35;
      ctx.fillStyle = '#a43a30';
      ctx.beginPath(); ctx.ellipse(0, -42, 19, 34, 0, 0, TAU); ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer(t) {
    if (game.phase === 'title') return;
    const sx = player.x - camera.x;
    const feet = player.y + player.h;
    if (sx < -100 || sx > VW + 100) return;

    // Shadow.
    const air = clamp((FLOOR_Y - feet) / 240, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${.36 * (1 - air * .6)})`;
    ctx.beginPath();
    ctx.ellipse(sx, Math.min(feet, FLOOR_Y) - 1, 25 - air * 6, 6 - air * 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    const flick = player.invuln > 0 && player.state === 'roll' ? (.72 + Math.sin(t * 45) * .12) : 1;
    drawKnightBody(sx, feet, t, {
      alpha: flick,
      blocking: player.blocking && player.state !== 'roll'
    });

    // Heal / block motes.
    if (player.state === 'heal' && player.stateTime < .9 && Math.random() < .35) {
      spawnParticle({
        x: player.x + rand(-18, 18), y: player.y + rand(10, 60),
        vx: rand(-8, 8), vy: rand(-45, -18), life: .5, maxLife: .5,
        size: rand(1, 2), color: '#f1c47d', gravity: -20, drag: .95, glow: 1
      });
    }
  }

  function drawEnemy(e, t) {
    const sx = e.x - camera.x;
    if (sx < -140 || sx > VW + 140) return;
    const feet = e.y + e.h;
    const dead = e.dead;
    const alpha = dead ? clamp(1 - e.deadTimer / 1.6, 0, 1) : 1;
    if (alpha <= 0) return;
    ctx.save();
    // Shadow.
    ctx.fillStyle = `rgba(0,0,0,${.3 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(sx, Math.min(feet, FLOOR_Y) - 1, e.w * .58, 5.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (e.type === 'husk') drawHusk(e, sx, feet, t, alpha);
    else if (e.type === 'archer') drawArcher(e, sx, feet, t, alpha);
    else drawBlackKnight(e, sx, feet, t, alpha);

    if (!dead && (e.aggro || e.hp < e.maxHp)) {
      const w = e.type === 'knight' ? 48 : 38;
      const yy = e.y - 15;
      ctx.fillStyle = 'rgba(0,0,0,.58)';
      ctx.fillRect(sx - w / 2, yy, w, 3);
      ctx.fillStyle = e.hp / e.maxHp > .35 ? '#8d332c' : '#b44a39';
      ctx.fillRect(sx - w / 2, yy, w * clamp(e.hp / e.maxHp, 0, 1), 3);
      ctx.strokeStyle = 'rgba(211, 199, 172, .18)';
      ctx.lineWidth = .5;
      ctx.strokeRect(sx - w / 2, yy, w, 3);
    }
  }

  function drawHusk(e, sx, feet, t, alpha) {
    const scale = .95;
    ctx.save();
    ctx.translate(sx, feet);
    ctx.scale(e.face * scale, scale);
    ctx.globalAlpha = alpha;
    if (e.dead) {
      ctx.translate(0, -5);
      ctx.rotate(-.9 * clamp(e.deadTimer / .6, 0, 1));
      ctx.translate(0, 5);
    }
    const moving = Math.abs(e.vx) > 5 && !e.dead;
    const stride = moving ? Math.sin(t * 9 + e.walkPhase) * 6 : 0;
    const wind = e.state === 'windup' ? clamp(e.stateTime / .48, 0, 1) : 0;
    const strike = e.state === 'strike' ? clamp(e.stateTime / .3, 0, 1) : 0;

    // Ragged cloth.
    ctx.fillStyle = '#2e2b25';
    ctx.beginPath();
    ctx.moveTo(-10, -36);
    ctx.lineTo(-15, -12);
    ctx.lineTo(-8, -17);
    ctx.lineTo(-9, -6);
    ctx.lineTo(0, -18);
    ctx.lineTo(11, -10);
    ctx.lineTo(9, -34);
    ctx.closePath();
    ctx.fill();

    // Legs.
    ctx.strokeStyle = '#716d61';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -22); ctx.lineTo(-6 - stride, -2);
    ctx.moveTo(5, -22); ctx.lineTo(7 + stride, -2);
    ctx.stroke();
    ctx.strokeStyle = '#413c33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8 - stride, -1); ctx.lineTo(-3 - stride, -2);
    ctx.moveTo(5 + stride, -1); ctx.lineTo(10 + stride, -2);
    ctx.stroke();

    // Hunched body.
    const skin = ctx.createLinearGradient(-10, -52, 12, -20);
    skin.addColorStop(0, '#6b675c');
    skin.addColorStop(.5, '#8d8879');
    skin.addColorStop(1, '#57544c');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.quadraticCurveTo(-16, -43, -6, -53);
    ctx.quadraticCurveTo(4, -59, 12, -47);
    ctx.quadraticCurveTo(14, -33, 8, -20);
    ctx.closePath();
    ctx.fill();
    // Ribs.
    ctx.strokeStyle = 'rgba(54, 52, 46, .55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-7 + i, -38 + i * 5);
      ctx.quadraticCurveTo(2, -35 + i * 5, 8, -39 + i * 5);
      ctx.stroke();
    }
    // Head.
    ctx.fillStyle = '#8b8577';
    ctx.beginPath();
    ctx.ellipse(7, -56, 7, 8.5, .22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#191816';
    ctx.beginPath();
    ctx.ellipse(9, -58, 4.5, 5.5, .1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(232, 219, 170, ${.55 + Math.sin(t * 4 + e.id) * .2})`;
    ctx.beginPath(); ctx.arc(8, -59, 1.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -58, .9, 0, TAU); ctx.fill();
    // Jaw.
    ctx.fillStyle = '#a8a08e';
    ctx.beginPath();
    ctx.moveTo(9, -52); ctx.lineTo(14, -51); ctx.lineTo(10, -48); ctx.closePath(); ctx.fill();

    // Arms & cleaver.
    const armAngle = lerp(.65, -2.15, wind) + strike * 2.5;
    ctx.save();
    ctx.translate(4, -41);
    ctx.rotate(armAngle);
    ctx.strokeStyle = '#777265';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(19, 4); ctx.stroke();
    // Cleaver.
    ctx.translate(18, 4);
    ctx.rotate(.1);
    const bladeGrad = ctx.createLinearGradient(0, -3, 34, 6);
    bladeGrad.addColorStop(0, '#6e6d60');
    bladeGrad.addColorStop(.65, '#9c9987');
    bladeGrad.addColorStop(1, '#4e514a');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(24, -6);
    ctx.lineTo(34, 8);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a3025';
    ctx.fillRect(-5, -2, 7, 4);
    ctx.strokeStyle = 'rgba(30, 30, 26, .7)';
    ctx.stroke();
    ctx.restore();

    // Other arm.
    ctx.strokeStyle = '#666257';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-6, -42);
    ctx.quadraticCurveTo(-13, -32, -9, -22);
    ctx.stroke();

    if (e.hurtFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.hurtFlash * .35;
      ctx.fillStyle = '#d35643';
      ctx.beginPath(); ctx.ellipse(0, -35, 16, 26, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawArcher(e, sx, feet, t, alpha) {
    ctx.save();
    ctx.translate(sx, feet);
    ctx.scale(e.face, 1);
    ctx.globalAlpha = alpha;
    if (e.dead) {
      ctx.translate(0, -6);
      ctx.rotate(-1.15 * clamp(e.deadTimer / .7, 0, 1));
    }
    const aim = e.state === 'aim';
    const aiming = aim || e.state === 'recover';
    const stride = Math.abs(e.vx) > 4 ? Math.sin(t * 8 + e.walkPhase) * 5 : 0;

    // Tattered hood.
    ctx.fillStyle = '#252822';
    ctx.beginPath();
    ctx.moveTo(-11, -53);
    ctx.quadraticCurveTo(-17, -35, -10, -20);
    ctx.lineTo(-4, -25);
    ctx.lineTo(-2, -13);
    ctx.lineTo(5, -25);
    ctx.lineTo(11, -20);
    ctx.quadraticCurveTo(13, -39, 9, -53);
    ctx.closePath();
    ctx.fill();

    // Legs.
    ctx.strokeStyle = '#4b493f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-4, -24); ctx.lineTo(-6 - stride, -1);
    ctx.moveTo(5, -24); ctx.lineTo(7 + stride, -1);
    ctx.stroke();

    // Ribcage.
    ctx.fillStyle = '#8b8778';
    ctx.beginPath();
    ctx.moveTo(-8, -42);
    ctx.quadraticCurveTo(0, -50, 8, -41);
    ctx.lineTo(6, -24);
    ctx.lineTo(-6, -24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(44,42,37,.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-6, -39 + i * 4);
      ctx.quadraticCurveTo(0, -36 + i * 4, 6, -39 + i * 4);
      ctx.stroke();
    }

    // Skull.
    ctx.fillStyle = '#aaa390';
    ctx.beginPath();
    ctx.ellipse(4, -53, 7, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#181716';
    ctx.beginPath(); ctx.arc(7, -55, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -55, 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(219, 154, 79, ${aim ? .9 : .25})`;
    ctx.beginPath(); ctx.arc(7, -55, .8, 0, TAU); ctx.fill();

    // Hood drape.
    ctx.fillStyle = '#1d201c';
    ctx.beginPath();
    ctx.moveTo(-4, -60);
    ctx.quadraticCurveTo(3, -63, 11, -56);
    ctx.lineTo(9, -50);
    ctx.quadraticCurveTo(0, -52, -5, -48);
    ctx.closePath();
    ctx.fill();

    // Crossbow.
    const aimAngle = aiming ? e.aimAngle * e.face - (e.face > 0 ? 0 : Math.PI) : -.08;
    ctx.save();
    ctx.translate(6, -37);
    ctx.rotate(aiming ? clamp(e.aimAngle, -1.2, 1.2) : -.1);
    ctx.strokeStyle = '#6f5a3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(30, 0);
    ctx.stroke();
    // Bow arms.
    ctx.strokeStyle = '#9b8a6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, -10); ctx.quadraticCurveTo(32, 0, 20, 10);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(205, 195, 168, .55)';
    ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(20, -10); ctx.lineTo(23, 0); ctx.lineTo(20, 10); ctx.stroke();
    ctx.restore();

    // Light draw indicator.
    if (aim) {
      const p = clamp(e.stateTime / .62, 0, 1);
      ctx.strokeStyle = `rgba(211, 143, 74, ${p * .35})`;
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(12, -37);
      ctx.lineTo(12 + 120 * p, -37 + Math.sin(e.aimAngle) * 40);
      ctx.stroke();
    }

    if (e.hurtFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.hurtFlash * .4;
      ctx.fillStyle = '#d35a48';
      ctx.beginPath(); ctx.ellipse(0, -34, 13, 23, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawBlackKnight(e, sx, feet, t, alpha) {
    ctx.save();
    ctx.translate(sx, feet);
    ctx.scale(e.face, 1);
    ctx.globalAlpha = alpha;
    if (e.dead) {
      ctx.translate(0, -8);
      ctx.rotate(-1.25 * clamp(e.deadTimer / .9, 0, 1));
    }
    const moving = Math.abs(e.vx) > 4;
    const stride = moving ? Math.sin(t * 7 + e.walkPhase) * 8 : 0;
    const wind = e.state === 'windup' ? clamp(e.stateTime / .66, 0, 1) : 0;
    const strike = e.state === 'strike' ? clamp(e.stateTime / .3, 0, 1) : 0;

    // Plume.
    ctx.strokeStyle = 'rgba(100, 34, 31, .8)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -77);
    ctx.quadraticCurveTo(-18, -87, -26 + Math.sin(t * 2) * 3, -69);
    ctx.stroke();

    // Cape.
    ctx.fillStyle = 'rgba(24, 25, 24, .92)';
    ctx.beginPath();
    ctx.moveTo(-10, -65);
    ctx.quadraticCurveTo(-27, -48, -25, -6);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-5, -34);
    ctx.closePath();
    ctx.fill();

    // Legs.
    ctx.strokeStyle = '#252c2e';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -39); ctx.lineTo(-8 - stride * .4, -20); ctx.lineTo(-9 - stride, -2);
    ctx.moveTo(6, -40); ctx.lineTo(9 + stride * .4, -20); ctx.lineTo(11 + stride, -2);
    ctx.stroke();
    ctx.fillStyle = '#14191a';
    ctx.fillRect(-15 - stride, -3, 12, 4);
    ctx.fillRect(6 + stride, -3, 12, 4);

    // Torso.
    const grd = ctx.createLinearGradient(-14, -68, 15, -38);
    grd.addColorStop(0, '#191f21');
    grd.addColorStop(.55, '#343c3e');
    grd.addColorStop(1, '#101516');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-14, -64);
    ctx.lineTo(-10, -42);
    ctx.lineTo(9, -38);
    ctx.lineTo(15, -55);
    ctx.lineTo(9, -69);
    ctx.lineTo(-8, -71);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(118, 124, 110, .2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6, -64); ctx.lineTo(7, -61); ctx.lineTo(10, -48); ctx.stroke();

    // Shoulder guards.
    [[-9, -63, 8], [10, -63, 9]].forEach(([px, py, r]) => {
      ctx.fillStyle = '#22292b';
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(130, 133, 115, .25)';
      ctx.stroke();
    });

    // Helm.
    ctx.fillStyle = '#2b3335';
    ctx.beginPath();
    ctx.moveTo(-9, -71);
    ctx.lineTo(-8, -86);
    ctx.lineTo(7, -88);
    ctx.lineTo(10, -73);
    ctx.lineTo(4, -66);
    ctx.lineTo(-5, -66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#090c0d';
    ctx.fillRect(-4, -78, 12, 3);
    ctx.fillStyle = `rgba(210, 72, 52, ${.5 + Math.sin(t * 3 + e.id) * .2})`;
    ctx.fillRect(1, -77.5, 5, 1.5);

    // Halberd arm.
    const armAngle = lerp(-.4, -2.6, wind) + strike * 2.8;
    ctx.save();
    ctx.translate(8, -54);
    ctx.rotate(armAngle);
    ctx.strokeStyle = '#2a3234';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.stroke();
    // Shaft.
    ctx.save();
    ctx.translate(28, 0);
    ctx.rotate(.02);
    ctx.strokeStyle = '#5b4a35';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(54, 0); ctx.stroke();
    // Axe head.
    ctx.fillStyle = '#6e7267';
    ctx.beginPath();
    ctx.moveTo(40, -2);
    ctx.quadraticCurveTo(56, -25, 65, -12);
    ctx.lineTo(58, 2);
    ctx.quadraticCurveTo(50, 6, 40, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 208, 184, .3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Spike.
    ctx.beginPath(); ctx.moveTo(53, 0); ctx.lineTo(73, 1); ctx.lineTo(53, 3); ctx.closePath();
    ctx.fillStyle = '#898b7c'; ctx.fill();
    ctx.restore();
    ctx.restore();

    // Shield on the other side.
    ctx.save();
    ctx.translate(-15, -47);
    ctx.rotate(.1);
    ctx.fillStyle = '#1f2628';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(12, -12, 10, 9);
    ctx.lineTo(0, 22);
    ctx.lineTo(-10, 9);
    ctx.quadraticCurveTo(-12, -12, 0, -18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(141, 146, 126, .22)';
    ctx.stroke();
    ctx.restore();

    if (e.hurtFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.hurtFlash * .35;
      ctx.fillStyle = '#d35343';
      ctx.beginPath(); ctx.ellipse(0, -46, 19, 35, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss(t) {
    if (!boss) return;
    const sx = boss.x - camera.x;
    if (sx < -260 || sx > VW + 260) return;
    const feet = boss.y + boss.h;
    const alpha = boss.dead ? clamp(1 - boss.deadTimer / 4.5, .1, 1) : 1;

    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${.44 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(sx, FLOOR_Y - 1, 68, 12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, feet);
    ctx.scale(boss.face * .96, 1.32);
    ctx.globalAlpha = alpha;
    if (boss.dead) {
      ctx.translate(0, -10);
      ctx.rotate(-1.32 * clamp(boss.deadTimer / 2.4, 0, 1));
    }
    const bob = Math.sin(t * 1.15) * 2;
    const walk = boss.state === 'idle' && Math.abs(boss.vx) > 10 ? Math.sin(t * 4.4) * 6 : 0;
    const windS = boss.state === 'windup-slash' ? clamp(boss.stateTime / (boss.phase === 2 ? .48 : .62), 0, 1) : 0;
    const slash = boss.state === 'slash' ? clamp(boss.stateTime / .3, 0, 1) : 0;
    const windP = boss.state === 'windup-slam' ? clamp(boss.stateTime / .78, 0, 1) : 0;
    const slam = boss.state === 'slam' ? clamp(boss.stateTime / .45, 0, 1) : 0;
    const dash = boss.state === 'dash' ? clamp(boss.stateTime / .45, 0, 1) : 0;
    const phaseGlow = boss.phase === 2 ? .6 + Math.sin(t * 5) * .2 : 0;

    ctx.translate(0, -bob);
    ctx.rotate(boss.state === 'dash' ? .12 : 0);

    // Aura in phase two.
    if (boss.phase === 2 && !boss.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -70, 10, 0, -70, 140);
      g.addColorStop(0, `rgba(219, 112, 48, ${.14 + phaseGlow * .05})`);
      g.addColorStop(.5, 'rgba(181, 69, 30, .05)');
      g.addColorStop(1, 'rgba(150, 40, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-160, -210, 320, 320);
      ctx.restore();
    }

    // Tattered cloak.
    const cwind = Math.sin(t * 1.8) * 7;
    const cgrad = ctx.createLinearGradient(-70, -130, 20, -10);
    cgrad.addColorStop(0, 'rgba(20, 25, 25, .96)');
    cgrad.addColorStop(.55, 'rgba(13, 18, 18, .98)');
    cgrad.addColorStop(1, 'rgba(4, 7, 8, 1)');
    ctx.fillStyle = cgrad;
    ctx.beginPath();
    ctx.moveTo(-18, -131);
    ctx.quadraticCurveTo(-53 - cwind, -100, -63 - cwind, -43);
    ctx.lineTo(-87 - cwind * 1.4, 2);
    ctx.lineTo(-61, -21);
    ctx.lineTo(-55, 4);
    ctx.lineTo(-35, -32);
    ctx.lineTo(-20, -9);
    ctx.lineTo(-3, -45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(107, 99, 79, .09)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Ragged strips.
    ctx.strokeStyle = 'rgba(34, 39, 35, .55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-40 - i * 7, -70 + i * 12);
      ctx.quadraticCurveTo(-55 - i * 4, -30 + i * 8, -48 - i * 5 + Math.sin(t + i) * 3, 0 - i * 4);
      ctx.stroke();
    }

    // Legs.
    ctx.strokeStyle = '#1b2223';
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -67);
    ctx.lineTo(-27 - walk, -35);
    ctx.lineTo(-31 - walk, -3);
    ctx.stroke();
    ctx.strokeStyle = '#232b2c';
    ctx.beginPath();
    ctx.moveTo(17, -68);
    ctx.lineTo(28 + walk, -34);
    ctx.lineTo(33 + walk, -3);
    ctx.stroke();
    ctx.fillStyle = '#101516';
    ctx.beginPath(); ctx.moveTo(-45 - walk, 0); ctx.lineTo(-24 - walk, -2); ctx.lineTo(-20 - walk, 3); ctx.lineTo(-48 - walk, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(22 + walk, 0); ctx.lineTo(45 + walk, -2); ctx.lineTo(50 + walk, 3); ctx.lineTo(20 + walk, 4); ctx.closePath(); ctx.fill();
    // Knee plates.
    ctx.fillStyle = '#373b36';
    ctx.beginPath(); ctx.arc(-28 - walk, -34, 8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(28 + walk, -34, 8, 0, TAU); ctx.fill();

    // Waist & cuirass.
    const armor = ctx.createLinearGradient(-34, -130, 38, -60);
    armor.addColorStop(0, '#202728');
    armor.addColorStop(.36, '#3a3d38');
    armor.addColorStop(.6, '#55564c');
    armor.addColorStop(1, '#191f20');
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.moveTo(-25, -99);
    ctx.lineTo(-30, -74);
    ctx.lineTo(-17, -56);
    ctx.lineTo(15, -57);
    ctx.lineTo(27, -77);
    ctx.lineTo(23, -107);
    ctx.lineTo(8, -122);
    ctx.lineTo(-13, -120);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(8, 10, 10, .6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Ribs of the cuirass.
    ctx.strokeStyle = 'rgba(142, 137, 115, .17)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-26 + i * 2, -92 + i * 11);
      ctx.quadraticCurveTo(1, -82 + i * 11, 29 - i * 2, -94 + i * 11);
      ctx.stroke();
    }
    // Ember cracks in phase two.
    if (boss.phase === 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(232, 121, 49, ${.24 + phaseGlow * .2})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-19, -97); ctx.lineTo(-5, -87); ctx.lineTo(-11, -74); ctx.lineTo(7, -65);
      ctx.moveTo(16, -105); ctx.lineTo(9, -92); ctx.lineTo(21, -84);
      ctx.stroke();
      ctx.restore();
    }

    // Shoulders — broken, asymmetric plates.
    const sh = ctx.createRadialGradient(-27, -108, 2, -27, -108, 22);
    sh.addColorStop(0, '#5a594b');
    sh.addColorStop(.55, '#262d2d');
    sh.addColorStop(1, '#0e1415');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.moveTo(-44, -105); ctx.lineTo(-34, -127); ctx.lineTo(-12, -122); ctx.lineTo(-13, -103); ctx.lineTo(-29, -94);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#272d2e';
    ctx.beginPath();
    ctx.moveTo(17, -123); ctx.lineTo(36, -121); ctx.lineTo(46, -100); ctx.lineTo(26, -94); ctx.lineTo(12, -105);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(142, 136, 112, .13)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Spikes of blackened iron.
    ctx.fillStyle = '#666354';
    ctx.beginPath(); ctx.moveTo(-41, -115); ctx.lineTo(-48, -141); ctx.lineTo(-32, -122); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, -123); ctx.lineTo(-21, -151); ctx.lineTo(-12, -126); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#77725f';
    ctx.beginPath(); ctx.moveTo(34, -118); ctx.lineTo(47, -142); ctx.lineTo(43, -113); ctx.closePath(); ctx.fill();

    // Tattered tabard from waist to the ashen floor.
    ctx.fillStyle = 'rgba(13, 17, 17, .96)';
    ctx.beginPath();
    ctx.moveTo(-16, -72);
    ctx.lineTo(17, -72);
    ctx.lineTo(21, -35);
    ctx.lineTo(14, -4);
    ctx.lineTo(9, -21);
    ctx.lineTo(3, 3);
    ctx.lineTo(-2, -18);
    ctx.lineTo(-9, 2);
    ctx.lineTo(-15, -25);
    ctx.lineTo(-22, -36);
    ctx.closePath();
    ctx.fill();
    // Gold thread and belt.
    ctx.strokeStyle = 'rgba(191, 147, 80, .16)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-13, -66); ctx.lineTo(-5, -7); ctx.moveTo(11, -68); ctx.lineTo(8, -4); ctx.stroke();
    ctx.fillStyle = 'rgba(29, 25, 20, .9)';
    ctx.fillRect(-24, -79, 48, 9);
    ctx.fillStyle = '#756243';
    ctx.beginPath(); ctx.arc(0, -75, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#161615';
    ctx.beginPath(); ctx.arc(0, -75, 2, 0, TAU); ctx.fill();
    // Hanging chains.
    ctx.strokeStyle = 'rgba(105, 104, 89, .24)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      const cx = -20 + i * 18;
      ctx.beginPath();
      ctx.moveTo(cx, -72);
      ctx.quadraticCurveTo(cx + 3, -44, cx - 2, -20 + i * 2);
      ctx.stroke();
      for (let yy = -64; yy < -22; yy += 9) {
        ctx.beginPath(); ctx.arc(cx + Math.sin(yy) * 1.5, yy, 1.6, 0, TAU); ctx.stroke();
      }
    }

    // Head / crown.
    const headY = -141;
    ctx.fillStyle = '#0c1112';
    ctx.beginPath();
    ctx.ellipse(2, headY, 17, 20, .06, 0, TAU);
    ctx.fill();
    // A long, hollow mask.
    ctx.fillStyle = '#070c0d';
    ctx.beginPath();
    ctx.moveTo(-10, headY - 16);
    ctx.quadraticCurveTo(6, headY - 22, 17, headY - 12);
    ctx.lineTo(15, headY + 12);
    ctx.quadraticCurveTo(6, headY + 24, -4, headY + 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(137, 132, 112, .22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Brow and cheek plates.
    ctx.strokeStyle = 'rgba(109, 105, 88, .28)';
    ctx.beginPath();
    ctx.moveTo(-8, headY - 7); ctx.quadraticCurveTo(5, headY - 4, 15, headY - 7);
    ctx.moveTo(1, headY + 13); ctx.lineTo(7, headY + 18); ctx.lineTo(12, headY + 10);
    ctx.stroke();
    const eyeGlow = boss.phase === 2 ? .95 : .72;
    ctx.fillStyle = `rgba(243, 154, 67, ${eyeGlow})`;
    ctx.beginPath(); ctx.ellipse(4, headY - 1, 2.1, .65, -.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, headY, 1.7, .55, .06, 0, TAU); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(9, headY, 1, 9, headY, 18);
    eg.addColorStop(0, `rgba(241, 137, 55, ${.3 + phaseGlow * .2})`);
    eg.addColorStop(1, 'rgba(220, 100, 40, 0)');
    ctx.fillStyle = eg;
    ctx.fillRect(-10, headY - 20, 40, 40);
    ctx.restore();
    // The broken crown.
    ctx.fillStyle = '#4c4432';
    ctx.beginPath();
    ctx.moveTo(-20, headY - 13);
    ctx.lineTo(-21, headY - 43);
    ctx.lineTo(-12, headY - 30);
    ctx.lineTo(-7, headY - 57);
    ctx.lineTo(1, headY - 36);
    ctx.lineTo(7, headY - 63);
    ctx.lineTo(12, headY - 33);
    ctx.lineTo(21, headY - 49);
    ctx.lineTo(20, headY - 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 202, 143, .24)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Blackened veins in the gold.
    ctx.strokeStyle = 'rgba(20, 20, 17, .55)';
    ctx.beginPath();
    ctx.moveTo(-15, headY - 17); ctx.lineTo(-9, headY - 33); ctx.lineTo(-3, headY - 20);
    ctx.moveTo(5, headY - 21); ctx.lineTo(10, headY - 42); ctx.lineTo(15, headY - 22);
    ctx.stroke();
    // Crown embers.
    [-20, -7, 7, 20].forEach((cx, i) => {
      ctx.fillStyle = `rgba(242, 153, 65, ${.5 + Math.sin(t * 4 + i) * .18})`;
      ctx.beginPath(); ctx.arc(cx, headY - (i === 1 ? 54 : i === 2 ? 60 : 40), 1.6, 0, TAU); ctx.fill();
    });

    // Greatsword.
    let swordAngle = -.62;
    if (boss.state === 'windup-slash') swordAngle = lerp(-1.2, -2.55, easeOutCubic(windS));
    else if (boss.state === 'slash') swordAngle = lerp(-2.55, .75, easeOutCubic(slash));
    else if (boss.state === 'windup-slam') swordAngle = lerp(-1.2, -2.95, easeInOut(windP));
    else if (boss.state === 'slam') swordAngle = lerp(-2.95, .5, easeInCubic(slam));
    else if (boss.state === 'dash') swordAngle = -.2;
    else if (boss.state === 'phase') swordAngle = -1.5;
    else if (boss.state === 'recover') swordAngle = -.95;
    else if (boss.state === 'idle') swordAngle = -.6 + Math.sin(t * 1.4) * .05;

    // Slash trail.
    if ((boss.state === 'slash' && boss.stateTime < .34) || (boss.state === 'slam' && boss.stateTime < .3)) {
      ctx.save();
      ctx.translate(30, -100);
      ctx.globalCompositeOperation = 'lighter';
      const start = boss.state === 'slam' ? -2.9 : -2.5;
      const end = swordAngle + .3;
      ctx.strokeStyle = `rgba(231, 164, 92, ${boss.state === 'slam' ? .2 : .25})`;
      ctx.lineWidth = 19;
      ctx.beginPath(); ctx.arc(0, 0, 118, start, Math.max(start + .02, end)); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 227, 173, .2)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 102, start + .08, Math.max(start + .1, end - .03)); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(29, -99);
    ctx.rotate(swordAngle);
    // Arm.
    ctx.strokeStyle = '#2b3030';
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(31, 0); ctx.stroke();
    ctx.fillStyle = '#393e3b';
    ctx.beginPath(); ctx.arc(33, 0, 7, 0, TAU); ctx.fill();
    // Grip.
    ctx.fillStyle = '#2b2119';
    ctx.fillRect(28, -3.2, 25, 6.4);
    ctx.strokeStyle = '#89714d';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(31 + i * 5, -3); ctx.lineTo(34 + i * 5, 3); ctx.stroke();
    }
    // Guard.
    ctx.fillStyle = '#68654f';
    ctx.fillRect(51, -15, 6, 30);
    ctx.fillStyle = '#9a9274';
    ctx.fillRect(52, -15, 1.6, 30);
    // Blade.
    const bg = ctx.createLinearGradient(57, -9, 163, 9);
    bg.addColorStop(0, '#5b5d51');
    bg.addColorStop(.35, '#a5a28e');
    bg.addColorStop(.62, '#7e7f70');
    bg.addColorStop(1, '#383f39');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(57, -10);
    ctx.lineTo(139, -8);
    ctx.lineTo(169, 0);
    ctx.lineTo(139, 8);
    ctx.lineTo(57, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 225, 195, .22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(59, 0); ctx.lineTo(151, 0); ctx.stroke();
    // Runes on blade.
    if (boss.phase === 2) {
      ctx.strokeStyle = `rgba(242, 132, 55, ${.3 + phaseGlow * .2})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(86, -5); ctx.lineTo(91, 0); ctx.lineTo(86, 5);
      ctx.moveTo(111, -4); ctx.lineTo(116, 0); ctx.lineTo(111, 4);
      ctx.stroke();
    }
    ctx.restore();

    if (boss.hurtFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = boss.hurtFlash * .4;
      ctx.fillStyle = '#bd4b38';
      ctx.beginPath(); ctx.ellipse(0, -85, 44, 70, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // Ambient embers rising from the king.
    if (!boss.dead && Math.random() < .5) {
      spawnParticle({
        x: boss.x + rand(-55, 55), y: boss.y + rand(0, 120),
        vx: rand(-12, 12), vy: rand(-45, -12), life: rand(.5, 1.2),
        maxLife: 1.2, size: rand(.8, 2.2), color: boss.phase === 2 ? '#ec9350' : '#ac8f63',
        gravity: -14, drag: .97, glow: 1
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Particle / light rendering
  // ─────────────────────────────────────────────────────────────
  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      const x = p.x - camera.x;
      if (x < -30 || x > VW + 30) continue;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * (p.glow ? .85 : 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, p.y, p.size * (1.1 + (1 - a) * .5), 0, TAU); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a * .85;
        ctx.fillStyle = p.color;
        if (p.size > 4 && p.life > .3) {
          ctx.fillRect(x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath(); ctx.arc(x, p.y, p.size, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawFloatingTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of floatingTexts) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${f.size}px "Palatino Linotype", Georgia, serif`;
      ctx.fillStyle = 'rgba(0,0,0,.75)';
      ctx.fillText(f.text, f.x - camera.x + 1, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - camera.x, f.y);
    }
    ctx.restore();
  }

  function drawAmbient(t) {
    // Drifting ash.
    ctx.save();
    for (const m of motes) {
      const x = ((m.x - camera.x * m.z * .9 + Math.sin(t * .3 + m.phase) * 20) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const y = ((m.y + t * m.vy) % (VH + 80) + VH + 80) % (VH + 80) - 40;
      const a = m.bright * (.3 + Math.sin(t * 1.2 + m.phase) * .2);
      ctx.fillStyle = `rgba(207, 201, 177, ${Math.max(.05, a)})`;
      ctx.beginPath(); ctx.arc(x, y, m.size, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // Dust catching the light near the ground.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      const x = d.x - camera.x;
      if (x < -10 || x > VW + 10) continue;
      const y = d.y + Math.sin(t * .9 + d.phase) * 5;
      ctx.fillStyle = `rgba(202, 174, 125, ${.07 + Math.sin(t * 1.7 + d.phase) * .035})`;
      ctx.beginPath(); ctx.arc(x, y, d.size, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawLighting(t) {
    lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
    lctx.save();
    lctx.scale(.5, .5);
    lctx.globalCompositeOperation = 'source-over';
    const dark = lctx.createLinearGradient(0, 0, 0, VH);
    dark.addColorStop(0, 'rgba(2, 5, 8, .04)');
    dark.addColorStop(.55, 'rgba(2, 5, 7, .015)');
    dark.addColorStop(1, 'rgba(1, 3, 4, .1)');
    lctx.fillStyle = dark;
    lctx.fillRect(0, 0, VW, VH);

    lctx.globalCompositeOperation = 'destination-out';
    for (const torch of TORCHES) {
      const x = torch.x - camera.x;
      if (x < -120 || x > VW + 120) continue;
      const radius = 185 + Math.sin(t * 7 + torch.x) * 8;
      const g = lctx.createRadialGradient(x, torch.y - 10, 0, x, torch.y - 10, radius);
      g.addColorStop(0, 'rgba(255,255,255,.9)');
      g.addColorStop(.35, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.fillRect(x - radius, torch.y - 10 - radius, radius * 2, radius * 2);
    }
    for (const b of BONFIRES) {
      if (!b.lit) continue;
      const x = b.x - camera.x;
      if (x < -220 || x > VW + 220) continue;
      const radius = 315 + Math.sin(t * 5) * 13;
      const g = lctx.createRadialGradient(x, b.y - 40, 0, x, b.y - 40, radius);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(.28, 'rgba(255,255,255,.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.fillRect(x - radius, b.y - 40 - radius, radius * 2, radius * 2);
    }
    {
      const x = player.x - camera.x;
      const y = player.y + 36;
      const radius = 285;
      const g = lctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, 'rgba(255,255,255,.76)');
      g.addColorStop(.4, 'rgba(255,255,255,.38)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    if (game.bossFight && boss && !boss.dead) {
      const x = boss.x - camera.x;
      const y = boss.y + 70;
      const radius = 245;
      const g = lctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, 'rgba(255,255,255,.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    lctx.restore();
    ctx.drawImage(lightCanvas, 0, 0, VW, VH);

    // Additive fire bloom.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const torch of TORCHES) {
      const x = torch.x - camera.x;
      if (x < -80 || x > VW + 80) continue;
      const g = ctx.createRadialGradient(x, torch.y - 12, 1, x, torch.y - 12, 70);
      g.addColorStop(0, 'rgba(241, 165, 79, .15)');
      g.addColorStop(.4, 'rgba(210, 104, 47, .05)');
      g.addColorStop(1, 'rgba(190, 80, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 75, torch.y - 87, 150, 150);
    }
    for (const b of BONFIRES) {
      if (!b.lit) continue;
      const x = b.x - camera.x;
      if (x < -140 || x > VW + 140) continue;
      const g = ctx.createRadialGradient(x, b.y - 35, 2, x, b.y - 35, 135);
      g.addColorStop(0, 'rgba(255, 195, 105, .18)');
      g.addColorStop(.36, 'rgba(225, 122, 46, .06)');
      g.addColorStop(1, 'rgba(190, 70, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 140, b.y - 175, 280, 260);
    }
    if (boss && boss.phase === 2 && !boss.dead) {
      const x = boss.x - camera.x, y = boss.y + 75;
      const g = ctx.createRadialGradient(x, y, 5, x, y, 170);
      g.addColorStop(0, 'rgba(218, 92, 37, .09)');
      g.addColorStop(1, 'rgba(180, 50, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 170, y - 170, 340, 340);
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // World orchestration
  // ─────────────────────────────────────────────────────────────
  function drawWorld(t) {
    drawGroundSegment(GROUNDS[0]);
    drawGroundSegment(GROUNDS[1]);
    drawGroundSegment(GROUNDS[2]);
    drawGroundSegment(GROUNDS[3]);

    // Background architecture planted on the floor.
    drawArch(2120, 310, 190, true);
    drawArch(3370, 250, 170, false);
    drawArch(3920, 330, 205, true);
    drawArch(4820, 260, 160, true);
    drawArch(5620, 360, 220, false);
    drawArch(6340, 300, 180, true);

    drawThrone();
    drawHangingChains(t);
    drawBanner(2190, 300, 88, 205, t, '84, 42, 37');
    drawBanner(3310, 315, 70, 175, t, '55, 47, 37');
    drawBanner(3980, 292, 96, 220, t, '74, 36, 32');
    drawBanner(4740, 310, 66, 165, t, '42, 51, 44');
    drawBanner(5650, 330, 92, 190, t, '88, 43, 35');
    drawBanner(6330, 305, 70, 180, t, '55, 43, 39');
    drawStatue(3040, t);
    drawStatue(4100, t);
    drawStatue(4980, t);

    for (const p of PLATFORMS) drawPlatform(p);
    for (const c of candles) drawCandle(c, t);
    for (const torch of TORCHES) drawTorch(torch, t);
    drawMessages(t);
    drawFogGate(t);

    for (const b of BONFIRES) drawBonfire(b, t);
    drawBloodstain(t);

    // Enemies (corpses behind living foes).
    const sorted = [...enemies].sort((a, b) => a.y - b.y);
    for (const e of sorted) drawEnemy(e, t);
    drawBoss(t);
    drawPlayer(t);
    for (const p of projectiles) p.draw();
    drawFloatingTexts();
    drawParticles();
    drawAmbient(t);
    drawForeground(t);
    drawLighting(t);
  }

  // ─────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────
  const hud = { hp: 120, stam: 100, hpLag: 120, boss: 780, bossLag: 780 };
  const SERIF = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
  const SANS = '"Avenir Next Condensed", "Arial Narrow", "Helvetica Neue", sans-serif';

  function drawHUD(t) {
    if (!['playing', 'dead'].includes(game.phase) || game.uiOpen) return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    const touchHud = IS_TOUCH;

    // ── Player vitals
    const x = touchHud ? 34 : 40, y = 34, w = touchHud ? 360 : 315;
    ctx.font = `${touchHud ? 15 : 10}px ${SANS}`;
    ctx.letterSpacing = touchHud ? '1px' : '2px';
    ctx.fillStyle = 'rgba(216, 209, 193, .62)';
    ctx.fillText(`THE ASHEN ONE   ·   LV ${player.level}`, x + 3, y - 7);

    // Ornate backing.
    ctx.fillStyle = 'rgba(3, 6, 7, .66)';
    poly(ctx, [[x - 5, y + 2], [x + w + 8, y + 2], [x + w - 3, y + 20], [x + 5, y + 20]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(193, 184, 160, .2)';
    ctx.lineWidth = 1;
    poly(ctx, [[x - 5, y + 2], [x + w + 8, y + 2], [x + w - 3, y + 20], [x + 5, y + 20]]);
    ctx.stroke();
    // HP lag.
    ctx.fillStyle = 'rgba(126, 55, 47, .55)';
    ctx.fillRect(x + 1, y + 5, (w - 2) * clamp(hud.hpLag / player.maxHp, 0, 1), 12);
    const hpGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    hpGrad.addColorStop(0, '#6e1d1b');
    hpGrad.addColorStop(.5, '#a5332c');
    hpGrad.addColorStop(1, '#75231f');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(x + 1, y + 5, (w - 2) * clamp(player.hp / player.maxHp, 0, 1), 12);
    ctx.fillStyle = 'rgba(243, 191, 157, .25)';
    ctx.fillRect(x + 1, y + 5, (w - 2) * clamp(player.hp / player.maxHp, 0, 1), 1);
    // HP notch ticks.
    ctx.strokeStyle = 'rgba(9, 12, 13, .35)';
    for (let i = 1; i < 10; i++) {
      const tx = x + (w - 2) * i / 10;
      ctx.beginPath(); ctx.moveTo(tx, y + 5); ctx.lineTo(tx, y + 17); ctx.stroke();
    }

    // Stamina.
    const sy = y + 22;
    ctx.fillStyle = 'rgba(3, 6, 7, .56)';
    ctx.fillRect(x + 1, sy, w - 8, 7);
    const stGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    stGrad.addColorStop(0, '#415d47');
    stGrad.addColorStop(.6, '#6f8768');
    stGrad.addColorStop(1, '#4d624d');
    ctx.fillStyle = stGrad;
    ctx.fillRect(x + 1, sy, (w - 8) * clamp(player.stamina / player.maxStamina, 0, 1), 7);
    ctx.fillStyle = 'rgba(196, 211, 175, .22)';
    ctx.fillRect(x + 1, sy, (w - 8) * clamp(player.stamina / player.maxStamina, 0, 1), 1);

    // ── Estus flasks
    const fx = 50, fy = touchHud ? 132 : VH - 50;
    ctx.font = `${touchHud ? 15 : 10}px ${SANS}`;
    ctx.fillStyle = 'rgba(216, 209, 193, .58)';
    ctx.fillText('ESTUS', fx - 7, fy - 36);
    for (let i = 0; i < player.maxFlasks; i++) {
      const bx = fx + i * 23;
      const full = i < player.flasks;
      ctx.save();
      ctx.globalAlpha = full ? 1 : .28;
      // Bottle body.
      ctx.fillStyle = full ? 'rgba(172, 108, 48, .3)' : 'rgba(60,60,55,.18)';
      ctx.beginPath();
      ctx.moveTo(bx - 5, fy - 14);
      ctx.lineTo(bx + 5, fy - 14);
      ctx.lineTo(bx + 7, fy + 1);
      ctx.quadraticCurveTo(bx, fy + 5, bx - 7, fy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = full ? 'rgba(225, 179, 113, .55)' : 'rgba(180,175,155,.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Neck.
      ctx.fillStyle = full ? 'rgba(190, 137, 72, .6)' : 'rgba(100,96,84,.3)';
      ctx.fillRect(bx - 2.5, fy - 20, 5, 7);
      ctx.strokeStyle = full ? 'rgba(231, 192, 129, .5)' : 'rgba(150,145,128,.3)';
      ctx.strokeRect(bx - 3.5, fy - 21, 7, 2);
      // Liquid glow.
      if (full) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(bx, fy - 4, 1, bx, fy - 4, 12);
        g.addColorStop(0, 'rgba(241, 171, 82, .25)');
        g.addColorStop(1, 'rgba(241, 140, 60, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, fy - 4, 12, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.font = `italic 12px ${SERIF}`;
    ctx.fillStyle = 'rgba(226, 214, 190, .62)';
    ctx.fillText(`× ${player.flasks}`, fx + player.maxFlasks * 23 + 2, fy + 1);

    // ── Souls
    const soulsText = player.souls.toLocaleString('en-US');
    const soulsY = touchHud ? 148 : VH - 27;
    ctx.font = `${touchHud ? 15 : 11}px ${SANS}`;
    ctx.fillStyle = 'rgba(216, 209, 193, .58)';
    ctx.textAlign = 'right';
    ctx.fillText('SOULS', VW - 42, soulsY - 30);
    ctx.font = `${touchHud ? 38 : 30}px ${SERIF}`;
    ctx.fillStyle = 'rgba(226, 199, 137, .88)';
    ctx.fillText(soulsText, VW - 42, soulsY);
    // Soul glyph.
    const gx = VW - 57 - ctx.measureText(soulsText).width;
    const gy = soulsY - 8;
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(gx, gy, 1, gx, gy, 18);
    sg.addColorStop(0, 'rgba(247, 216, 151, .4)');
    sg.addColorStop(.4, 'rgba(203, 151, 77, .1)');
    sg.addColorStop(1, 'rgba(190, 110, 40, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(gx, gy, 18, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(237, 202, 133, .65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(gx, gy, 6, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(gx, gy, 2.2, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // ── Boss bar
    if (game.bossFight && boss && !boss.dead) {
      const bw = touchHud ? 430 : 600, bx = VW / 2 - bw / 2, by = touchHud ? VH - 232 : VH - 57;
      ctx.textAlign = 'center';
      ctx.font = `${touchHud ? 15 : 11}px ${SANS}`;
      ctx.fillStyle = 'rgba(218, 197, 166, .75)';
      ctx.letterSpacing = '4px';
      ctx.fillText('THE HOLLOW KING', VW / 2, by - 10);
      ctx.fillStyle = 'rgba(2, 4, 5, .76)';
      poly(ctx, [[bx - 8, by], [bx + bw + 8, by], [bx + bw, by + 13], [bx, by + 13]]);
      ctx.fill();
      ctx.fillStyle = 'rgba(86, 29, 24, .85)';
      ctx.fillRect(bx, by + 2, bw * clamp(hud.bossLag / boss.maxHp, 0, 1), 9);
      const bgr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bgr.addColorStop(0, '#5e1917');
      bgr.addColorStop(.45, boss.phase === 2 ? '#b84b31' : '#9a3329');
      bgr.addColorStop(1, '#6b1f1a');
      ctx.fillStyle = bgr;
      ctx.fillRect(bx, by + 2, bw * clamp(boss.hp / boss.maxHp, 0, 1), 9);
      ctx.strokeStyle = 'rgba(220, 187, 137, .26)';
      ctx.strokeRect(bx, by + 2, bw, 9);
      // Decorative points.
      ctx.fillStyle = 'rgba(213, 175, 111, .5)';
      poly(ctx, [[bx - 12, by + 5], [bx - 7, by], [bx - 2, by + 5], [bx - 7, by + 10]]); ctx.fill();
      poly(ctx, [[bx + bw + 2, by + 5], [bx + bw + 7, by], [bx + bw + 12, by + 5], [bx + bw + 7, by + 10]]); ctx.fill();
    }

    // ── Area banner
    if (game.zoneBanner > 0) {
      const z = ZONES[game.zone] || ZONES[0];
      let a = 1;
      if (game.zoneBanner > 3.4) a = (4.4 - game.zoneBanner) / 1;
      else if (game.zoneBanner < 1) a = game.zoneBanner;
      a = clamp(a, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      const cw = 330;
      ctx.strokeStyle = 'rgba(213, 154, 87, .35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(VW / 2 - cw, 176); ctx.lineTo(VW / 2 - 36, 176); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(VW / 2 + 36, 176); ctx.lineTo(VW / 2 + cw, 176); ctx.stroke();
      ctx.font = `11px ${SANS}`;
      ctx.fillStyle = 'rgba(218, 162, 94, .9)';
      ctx.letterSpacing = '5px';
      ctx.fillText(z.name, VW / 2, 172);
      ctx.font = `italic 15px ${SERIF}`;
      ctx.fillStyle = 'rgba(220, 211, 191, .52)';
      ctx.fillText(z.sub, VW / 2, 196);
      ctx.globalAlpha = 1;
    }

    // ── Message
    if (game.messageTimer > 0) {
      const a = clamp(game.messageTimer, 0, 1) * clamp((4 - game.messageTimer) * 2, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `11px ${SANS}`;
      ctx.fillStyle = 'rgba(225, 193, 136, .85)';
      ctx.letterSpacing = '3px';
      ctx.fillText(game.message, VW / 2, 128);
      ctx.globalAlpha = 1;
    }

    // ── Interaction prompt
    if (player.prompt && game.phase === 'playing') {
      const a = .75 + Math.sin(t * 3) * .15;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `11px ${SANS}`;
      ctx.letterSpacing = '2px';
      ctx.fillStyle = 'rgba(240, 226, 198, .9)';
      ctx.fillText(player.prompt, VW / 2, VH - 236);
      ctx.globalAlpha = 1;
    }

    // ── Low-health warning
    if (player.hp / player.maxHp < .3 && game.phase === 'playing') {
      const pulse = .6 + Math.sin(t * 3) * .25;
      const low = ctx.createRadialGradient(VW / 2, VH / 2, VH * .18, VW / 2, VH / 2, VH * .78);
      low.addColorStop(0, 'rgba(90, 8, 6, 0)');
      low.addColorStop(1, `rgba(105, 13, 10, ${.2 + pulse * .09})`);
      ctx.fillStyle = low;
      ctx.fillRect(0, 0, VW, VH);
    }

    // ── Souls available to level at bonfire prompt
    if (player.souls >= levelCost() && player.prompt && player.prompt.includes('BONFIRE')) {
      ctx.textAlign = 'center';
      ctx.font = `8px ${SANS}`;
      ctx.fillStyle = 'rgba(213, 154, 87, .42)';
      ctx.letterSpacing = '2px';
      ctx.fillText(`ENOUGH SOULS TO LEVEL · E`, VW / 2, VH - 218);
    }

    // Pause hint (keyboard only; touch players have the pause button).
    if (!touchHud) {
      ctx.textAlign = 'right';
      ctx.font = `9px ${SANS}`;
      ctx.fillStyle = 'rgba(216,209,193,.24)';
      ctx.letterSpacing = '1px';
      ctx.fillText('ESC  PAUSE', VW - 30, 30);
    }
    ctx.restore();
  }

  function drawPostFX(t) {
    // Lift the deep shadows just enough to read silhouettes.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const lift = ctx.createLinearGradient(0, 0, 0, VH);
    lift.addColorStop(0, 'rgba(77, 108, 117, .17)');
    lift.addColorStop(.55, 'rgba(82, 105, 101, .24)');
    lift.addColorStop(1, 'rgba(44, 60, 56, .1)');
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // Vignette.
    const vg = ctx.createRadialGradient(VW / 2, VH * .47, VH * .24, VW / 2, VH * .5, VH * .82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(.7, 'rgba(0,2,3,.05)');
    vg.addColorStop(1, 'rgba(0,2,3,.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VW, VH);

    // Film grain.
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.translate(randInt(-90, 0), randInt(-90, 0));
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0, 0, VW + 90, VH + 90);
    ctx.restore();

    // Damage flash & fade.
    if (flash > 0) {
      ctx.fillStyle = `rgba(150, 223, 193, ${flash * .35})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (game.fade > 0) {
      ctx.fillStyle = `rgba(2, 4, 5, ${clamp(game.fade, 0, 1)})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Update loop
  // ─────────────────────────────────────────────────────────────
  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
    }
    particles = particles.filter(p => p.life > 0);
    for (const f of floatingTexts) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= .95;
    }
    floatingTexts = floatingTexts.filter(f => f.life > 0);
  }

  function updateCamera(dt) {
    if (game.phase === 'title') {
      game.titleTimer += dt;
      camera.x = 1450 + Math.sin(game.titleTimer * .055) * 180;
      camera.y = 0;
      camera.shakeX = 0;
      camera.shakeY = 0;
      return;
    }
    let target = clamp(player.x - VW * .41 + player.face * 46, 0, WORLD_W - VW);
    if (game.bossFight && boss && !boss.dead) {
      target = clamp((player.x + boss.x) * .5 - VW * .5, 5080, WORLD_W - VW);
    }
    camera.x = lerp(camera.x, target, 1 - Math.pow(.0006, dt));
    camera.y = 0;
    if (cameraShake > .1) {
      camera.shakeX = rand(-1, 1) * cameraShake;
      camera.shakeY = rand(-1, 1) * cameraShake * .6;
      cameraShake *= Math.pow(.05, dt);
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
      cameraShake = 0;
    }
  }

  function updateHUD(dt) {
    hud.hpLag = approach(hud.hpLag, player.hp, dt * 28);
    if (hud.hpLag < player.hp) hud.hpLag = player.hp;
    if (boss) {
      hud.bossLag = approach(hud.bossLag, boss.hp, dt * 90);
      if (hud.bossLag < boss.hp) hud.bossLag = boss.hp;
    } else {
      hud.bossLag = 780;
    }
    const interact = document.getElementById('touch-interact');
    if (player.prompt && game.phase === 'playing' && !game.uiOpen && document.body.classList.contains('touch')) {
      interact.hidden = false;
      interact.textContent = player.prompt.replace(/^E\s+/, '');
    } else {
      interact.hidden = true;
    }
  }

  function updateGame(dt, t) {
    // Global timers.
    game.zoneBanner = Math.max(0, game.zoneBanner - dt);
    game.messageTimer = Math.max(0, game.messageTimer - dt);
    flash = Math.max(0, flash - dt * 2.2);
    if (game.fade > 0) {
      game.fade = approach(game.fade, 0, dt * 1.35);
    }

    if (game.phase === 'title') {
      updateCamera(dt);
      updateParticles(dt);
      if (input.consume('confirm')) {
        document.getElementById('start-button').click();
      }
      return;
    }

    if (game.phase === 'dead') {
      updateCamera(dt);
      updateParticles(dt);
      updateHUD(dt);
      if (boss) boss.update(dt);
      projectiles.forEach(p => p.update(dt));
      projectiles = projectiles.filter(p => !p.dead);
      return;
    }

    if (game.phase === 'victory') {
      updateParticles(dt);
      updateCamera(dt);
      return;
    }

    if (game.uiOpen || game.paused) return;

    game.time += dt;

    if (hitStop > 0) {
      hitStop -= dt;
      updateParticles(dt * .25);
      updateCamera(dt);
      return;
    }

    if (game.bossIntro > 0) game.bossIntro = Math.max(0, game.bossIntro - dt);

    player.update(dt);
    for (const e of enemies) e.update(dt);
    enemies = enemies.filter(e => !e.dead || e.deadTimer < 2.2);
    if (boss) boss.update(dt);

    for (const p of projectiles) p.update(dt);
    projectiles = projectiles.filter(p => !p.dead);

    updateParticles(dt);
    updateCamera(dt);
    updateHUD(dt);

    // Stall the world while death is processed.
    if (game.phase === 'dead') {
      for (const e of enemies) e.aggro = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  function render(t) {
    ctx.save();
    drawSky(t);
    drawMountains();
    drawCastle();
    drawMidground(t);

    ctx.save();
    ctx.translate(camera.shakeX, camera.shakeY);
    drawWorld(t);

    // A knight keeping vigil on the title screen.
    if (game.phase === 'title') {
      const figureX = 985;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath();
      ctx.ellipse(figureX, FLOOR_Y - 1, 26, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      drawKnightBody(figureX, FLOOR_Y, t, {
        player,
        face: -1,
        state: 'idle',
        stateTime: t,
        alpha: .92,
        title: true
      });
    }
    ctx.restore();

    drawPostFX(t);
    drawHUD(t);
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // UI wiring
  // ─────────────────────────────────────────────────────────────
  const el = id => document.getElementById(id);

  function hideAllScreens() {
    ['title-screen', 'bonfire-screen', 'death-screen', 'victory-screen', 'pause-screen'].forEach(id => {
      el(id).hidden = true;
    });
  }

  function startGame() {
    hideAllScreens();
    resetRun();
    game.zoneBanner = 5;
    game.zone = 0;
    game.fade = 1;
    audio.init();
    document.body.classList.add('playing');
    el('title-screen').hidden = true;
    el('boss-intro').classList.remove('show');
    camera.x = 0;
    cameraShake = 0;
  }

  function togglePause() {
    if (game.phase !== 'playing') return;
    if (game.paused) {
      game.paused = false;
      game.uiOpen = false;
      el('pause-screen').hidden = true;
      document.body.classList.add('playing');
    } else {
      game.paused = true;
      game.uiOpen = true;
      input.reset();
      el('pause-screen').hidden = false;
      document.body.classList.remove('playing');
    }
  }

  function goToTitle() {
    hideAllScreens();
    game.phase = 'title';
    game.paused = false;
    game.uiOpen = false;
    game.titleTimer = 0;
    game.bossFight = false;
    game.gateSolid = null;
    boss = null;
    audio.setBoss(false);
    document.body.classList.remove('playing');
    el('title-screen').hidden = false;
    el('boss-intro').classList.remove('show');
    input.reset();
  }

  function resumeFromBonfire() {
    closeOverlays();
    game.paused = false;
    game.uiOpen = false;
    document.body.classList.add('playing');
    input.reset();
  }

  el('start-button').addEventListener('click', () => startGame());
  el('rise-button').addEventListener('click', () => respawn());
  el('again-button').addEventListener('click', () => {
    hideAllScreens();
    startGame();
  });
  el('resume-button').addEventListener('click', () => togglePause());
  el('restart-button').addEventListener('click', () => {
    hideAllScreens();
    goToTitle();
  });
  el('pause-button').addEventListener('click', () => togglePause());
  el('sound-toggle').addEventListener('click', () => {
    audio.init();
    audio.setMuted(!audio.muted);
    el('sound-toggle').classList.toggle('muted', audio.muted);
  });

  el('rest-button').addEventListener('click', () => {
    if (game.phase !== 'playing') return;
    const index = game.activeBonfire ?? game.lastBonfire;
    restAtBonfire(index);
    resumeFromBonfire();
  });

  el('level-button').addEventListener('click', () => {
    if (game.phase !== 'playing') return;
    levelUp();
    updateBonfireUI();
  });

  el('leave-bonfire').addEventListener('click', () => {
    closeOverlays();
    document.body.classList.add('playing');
    input.reset();
  });

  // Keyboard.
  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;

    if (action === 'pause') {
      if (game.uiOpen && game.phase === 'playing') {
        if (!el('bonfire-screen').hidden) el('leave-bonfire').click();
        else if (!el('pause-screen').hidden) togglePause();
      } else {
        togglePause();
      }
      return;
    }
    if (action === 'confirm') {
      if (game.phase === 'dead') { el('rise-button').click(); return; }
      if (game.phase === 'title') { el('start-button').click(); return; }
      if (game.bossDefeated && game.phase === 'victory') return;
    }
    if (game.phase !== 'playing' || game.uiOpen) return;
    input.press(action);
  });

  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    input.release(action);
  });

  window.addEventListener('blur', () => {
    input.reset();
    if (game.phase === 'playing' && !game.uiOpen) togglePause();
  });

  // Mouse attacks for desktop players who prefer it.
  canvas.addEventListener('mousedown', (e) => {
    if (game.phase !== 'playing' || game.uiOpen) return;
    if (e.button === 0) input.press('attack');
    if (e.button === 2) input.press('heavy');
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.release('attack');
    if (e.button === 2) input.release('heavy');
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ─────────────────────────────────────────────────────────────
  // Touch controls
  // ─────────────────────────────────────────────────────────────
  const isTouch = IS_TOUCH;
  if (isTouch) {
    document.body.classList.add('touch');
    document.getElementById('touch-controls').setAttribute('aria-hidden', 'false');
  }

  const stickZone = el('stick-zone');
  const stickKnob = el('stick-knob');
  let stickPointer = null;

  function updateStick(e) {
    const r = stickZone.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width * .5);
    let dy = (e.clientY - cy) / (r.height * .5);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    input.joyX = Math.abs(dx) > .12 ? dx : 0;
    input.joyY = Math.abs(dy) > .35 ? dy : 0;
    stickKnob.style.transform = `translate(calc(-50% + ${dx * r.width * .28}px), calc(-50% + ${dy * r.height * .28}px))`;
    if (input.joyY > .55 && input.joyX === 0) {
      // Pulling down guards; pulling up jumps.
      if (!input.held.block) input.press('block');
    } else if (input.joyY < -.65 && input.joyX === 0) {
      input.press('jump');
    }
  }

  stickZone.addEventListener('pointerdown', (e) => {
    if (game.phase !== 'playing' || game.uiOpen) return;
    stickPointer = e.pointerId;
    stickZone.setPointerCapture(e.pointerId);
    updateStick(e);
  });
  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointer) return;
    updateStick(e);
  });
  const endStick = (e) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    input.joyX = 0;
    input.joyY = 0;
    input.release('block');
    stickKnob.style.transform = 'translate(-50%, -50%)';
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);

  document.querySelectorAll('.touch-btn').forEach(btn => {
    const action = btn.dataset.action;
    const down = (e) => {
      e.preventDefault();
      if (game.phase !== 'playing' || game.uiOpen) return;
      input.press(action);
      btn.classList.add('pressed');
    };
    const up = (e) => {
      e.preventDefault();
      input.release(action);
      btn.classList.remove('pressed');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', (e) => {
      if (e.buttons === 0) up(e);
    });
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  el('touch-interact').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.phase !== 'playing' || game.uiOpen) return;
    input.press('interact');
  });

  // Double-tap protection on iOS.
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // ─────────────────────────────────────────────────────────────
  // Main loop
  // ─────────────────────────────────────────────────────────────
  let lastTime = performance.now();
  let loaded = false;

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    gameTime += dt;

    if (!loaded) {
      loaded = true;
      const loading = el('loading');
      if (loading) loading.classList.add('done');
    }

    if (!game.paused) {
      updateGame(dt, now / 1000);
    }

    render(now / 1000);

    if (!game.paused) input.clearPressed();
    requestAnimationFrame(frame);
  }

  // Initial state: living title backdrop.
  game.titleTimer = 0;
  camera.x = 1450;
  spawnEnemies();
  document.body.classList.remove('playing');
  requestAnimationFrame(frame);

  // Expose a small debug surface for automated smoke tests.
  window.ASHEN_VEIL = {
    get state() {
      return {
        phase: game.phase,
        hp: player.hp,
        maxHp: player.maxHp,
        flasks: player.flasks,
        playerState: player.state,
        stamina: player.stamina,
        souls: player.souls,
        level: player.level,
        x: player.x,
        y: player.y,
        zone: game.zone,
        enemies: enemies.filter(e => !e.dead).length,
        bossFight: game.bossFight,
        bossHp: boss ? boss.hp : null,
        bossState: boss ? boss.state : null,
        bossPhase: boss ? boss.phase : null,
        paused: game.paused,
        bloodstain: game.bloodstain ? { x: Math.round(game.bloodstain.x), souls: game.bloodstain.souls } : null,
        nearest: (() => {
          let n = null, d = 1e9;
          for (const e of enemies) {
            if (e.dead) continue;
            const dd = Math.abs(e.x - player.x);
            if (dd < d) { d = dd; n = e; }
          }
          return n ? { type: n.type, x: n.x, hp: n.hp, state: n.state, st: +n.stateTime.toFixed(2), cd: +n.attackCooldown.toFixed(2), dist: Math.round(d) } : null;
        })(),
        uiOpen: game.uiOpen
      };
    },
    start: startGame,
    warp(x) {
      player.x = clamp(x, 40, WORLD_W - 40);
      player.y = FLOOR_Y - player.h;
      player.vy = 0;
      camera.x = clamp(player.x - VW * .41, 0, WORLD_W - VW);
    },
    heal() { player.hp = player.maxHp; },
    boss() { if (!game.bossFight) beginBossFight(); },
    addSouls(n) { player.souls += n; },
    damageBoss(n) { if (boss && !boss.dead) boss.takeHit(n, boss.x - 10, true); },
    killBoss() { if (boss) boss.takeHit(99999, boss.x - 10, true); }
  };
})();
