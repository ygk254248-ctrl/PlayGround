/* ═══════════════════════════════════════════════════════════
   Azure Blade — Procedural audio engine (Web Audio API)
   Every sound effect and the ambient music loop are synthesized
   at runtime — no audio files required.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = localStorage.getItem('azureblade_muted') === '1';
  let musicTimer = null;
  let musicStep = 0;
  let musicEnabled = false;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    return ctx;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function envGain(dest, peak, attack, decay, sustain = 0.0001) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now() + attack);
    g.gain.exponentialRampToValueAtTime(sustain, now() + attack + decay);
    g.connect(dest);
    return g;
  }

  function tone({ type = 'sine', freq = 440, freqEnd = null, peak = 0.5, attack = 0.008, decay = 0.25, dest = null, when = 0 }) {
    if (!ensureCtx()) return;
    const t0 = now() + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }

  function noise({ peak = 0.4, attack = 0.004, decay = 0.18, type = 'bandpass', freq = 1800, q = 1.2, dest = null, when = 0 }) {
    if (!ensureCtx()) return;
    const t0 = now() + when;
    const len = Math.floor(ctx.sampleRate * (attack + decay + 0.02));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    src.connect(filter); filter.connect(g); g.connect(dest || sfxGain);
    src.start(t0);
  }

  // ── Named SFX ────────────────────────────────────────────
  const sfx = {
    uiMove()  { tone({ type: 'sine', freq: 660, peak: 0.12, attack: 0.004, decay: 0.07 }); },
    uiConfirm() { tone({ type: 'sine', freq: 523, peak: 0.25, decay: 0.12 }); tone({ type: 'sine', freq: 784, peak: 0.25, decay: 0.2, when: 0.09 }); },
    jump()    { tone({ type: 'square', freq: 300, freqEnd: 520, peak: 0.18, attack: 0.006, decay: 0.14 }); },
    doubleJump() { tone({ type: 'square', freq: 420, freqEnd: 720, peak: 0.18, attack: 0.006, decay: 0.14 }); },
    wallJump(){ tone({ type: 'square', freq: 260, freqEnd: 480, peak: 0.18, attack: 0.006, decay: 0.15 }); noise({ peak: 0.12, decay: 0.1, freq: 900 }); },
    dash()    { noise({ peak: 0.28, attack: 0.002, decay: 0.16, freq: 2400, q: 0.8, type: 'highpass' }); },
    roll()    { noise({ peak: 0.2, attack: 0.002, decay: 0.14, freq: 700, q: 1.0 }); },
    slash()   { noise({ peak: 0.3, attack: 0.002, decay: 0.12, freq: 3200, q: 2.2, type: 'bandpass' }); tone({ type: 'sawtooth', freq: 900, freqEnd: 300, peak: 0.08, decay: 0.1 }); },
    slashHeavy() { noise({ peak: 0.4, attack: 0.002, decay: 0.22, freq: 1600, q: 2.0 }); tone({ type: 'sawtooth', freq: 300, freqEnd: 90, peak: 0.25, decay: 0.28 }); },
    hit() {
      tone({ type: 'square', freq: 180, freqEnd: 120, peak: 0.35, attack: 0.004, decay: 0.12 });
      noise({ peak: 0.3, decay: 0.1, freq: 1100 });
    },
    hitHeavy() {
      tone({ type: 'square', freq: 120, freqEnd: 70, peak: 0.45, attack: 0.004, decay: 0.22 });
      noise({ peak: 0.4, decay: 0.2, freq: 700 });
    },
    enemyDie() {
      tone({ type: 'triangle', freq: 500, freqEnd: 900, peak: 0.25, decay: 0.12 });
      tone({ type: 'triangle', freq: 900, freqEnd: 1400, peak: 0.2, decay: 0.18, when: 0.08 });
      noise({ peak: 0.15, decay: 0.2, freq: 500 });
    },
    hurt() {
      tone({ type: 'sawtooth', freq: 220, freqEnd: 90, peak: 0.4, attack: 0.004, decay: 0.3 });
      noise({ peak: 0.2, decay: 0.15, freq: 400 });
    },
    coin() { tone({ type: 'sine', freq: 988, peak: 0.22, attack: 0.004, decay: 0.09 }); tone({ type: 'sine', freq: 1319, peak: 0.22, attack: 0.004, decay: 0.22, when: 0.07 }); },
    heart() { tone({ type: 'sine', freq: 660, peak: 0.25, decay: 0.15 }); tone({ type: 'sine', freq: 880, peak: 0.25, decay: 0.3, when: 0.12 }); },
    chest() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, peak: 0.25, decay: 0.3, when: i * 0.1 }));
    },
    checkpoint() {
      [392, 523, 659].forEach((f, i) => tone({ type: 'sine', freq: f, peak: 0.3, decay: 0.4, when: i * 0.14 }));
    },
    spikeHit() { noise({ peak: 0.35, decay: 0.14, freq: 2500, type: 'bandpass', q: 3 }); tone({ type: 'square', freq: 240, freqEnd: 130, peak: 0.3, decay: 0.18 }); },
    fireJet() { noise({ peak: 0.18, decay: 0.5, freq: 300, type: 'lowpass' }); },
    bossRoar() {
      tone({ type: 'sawtooth', freq: 60, freqEnd: 45, peak: 0.55, attack: 0.05, decay: 1.2 });
      tone({ type: 'sawtooth', freq: 90, freqEnd: 65, peak: 0.4, attack: 0.05, decay: 1.1, when: 0.08 });
      noise({ peak: 0.3, attack: 0.05, decay: 1.0, freq: 180, type: 'lowpass' });
    },
    bossHit() { tone({ type: 'square', freq: 150, freqEnd: 100, peak: 0.35, decay: 0.14 }); noise({ peak: 0.25, decay: 0.12, freq: 900 }); },
    bossDie() {
      tone({ type: 'sawtooth', freq: 80, freqEnd: 30, peak: 0.6, attack: 0.03, decay: 1.8 });
      [1047, 784, 659, 523].forEach((f, i) => tone({ type: 'triangle', freq: f, peak: 0.3, decay: 0.5, when: 1.0 + i * 0.18 }));
    },
    victory() {
      [523, 587, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, peak: 0.32, attack: 0.01, decay: 0.55, when: i * 0.16 }));
    },
    gameover() { [392, 330, 262, 196].forEach((f, i) => tone({ type: 'sine', freq: f, peak: 0.3, decay: 0.6, when: i * 0.3 })); },
    swing() { noise({ peak: 0.12, decay: 0.08, freq: 4000, type: 'highpass' }); },
  };

  // ── Ambient music: sparse minor-key koto-ish arpeggio ────
  const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; // A minor pentatonic-ish
  const PATTERN = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 2, -1];
  function musicTick() {
    if (!musicEnabled || !ctx) return;
    const idx = PATTERN[musicStep % PATTERN.length];
    if (idx >= 0) {
      tone({ type: 'triangle', freq: SCALE[idx], peak: 0.5, attack: 0.01, decay: 1.6, dest: musicGain, when: 0 });
      tone({ type: 'sine', freq: SCALE[idx] * 2.01, peak: 0.12, attack: 0.01, decay: 1.1, dest: musicGain, when: 0.02 });
    }
    if (musicStep % 8 === 0) {
      tone({ type: 'sine', freq: 55, peak: 0.5, attack: 0.02, decay: 2.6, dest: musicGain, when: 0 });
    }
    musicStep += 1;
  }

  function startMusic() {
    if (!ensureCtx()) return;
    musicEnabled = true;
    if (musicTimer) return;
    musicTick();
    musicTimer = setInterval(musicTick, 460);
  }
  function stopMusic() {
    musicEnabled = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setMuted(m) {
    muted = !!m;
    localStorage.setItem('azureblade_muted', muted ? '1' : '0');
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.03);
  }

  return {
    ensureCtx,
    sfx,
    startMusic,
    stopMusic,
    setMuted,
    isMuted: () => muted,
    toggleMuted: () => { setMuted(!muted); return muted; },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})();
