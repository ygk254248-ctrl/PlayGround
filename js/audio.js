// Tiny synthesized audio engine. No external assets, no network requests.
export class AudioEngine {
  constructor(settings = {}) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.ready = false;
  }

  init() {
    if (this.ready) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.sound === false ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.62;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.music === false ? 0 : 0.2;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate * 1.4;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.ready = true;
      this.startMusic();
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }

  resume() {
    this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  syncSettings() {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(this.settings.sound === false ? 0 : 0.9, this.ctx.currentTime, 0.04);
    this.musicGain.gain.setTargetAtTime(this.settings.music === false ? 0 : 0.2, this.ctx.currentTime, 0.2);
  }

  tone({ freq = 220, to = freq, dur = 0.15, type = 'sine', gain = 0.2, delay = 0, filter = null }) {
    if (!this.ready || this.settings.sound === false) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.setValueAtTime(filter.freq || 1200, t);
      if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
      osc.connect(f);
      f.connect(g);
    } else osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noise({ dur = 0.18, gain = 0.16, type = 'highpass', freq = 900, to = null, delay = 0 }) {
    if (!this.ready || this.settings.sound === false) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ready || this.settings.sound === false) return;
    switch (name) {
      case 'ui':
        this.tone({ freq: 620, to: 820, dur: 0.055, type: 'triangle', gain: 0.07 });
        break;
      case 'hover':
        this.tone({ freq: 480, to: 500, dur: 0.03, type: 'sine', gain: 0.026 });
        break;
      case 'slash':
        this.noise({ dur: 0.16, gain: 0.13, freq: 1800, to: 600 });
        this.tone({ freq: 320, to: 150, dur: 0.1, type: 'sawtooth', gain: 0.035 });
        break;
      case 'hit':
        this.noise({ dur: 0.1, gain: 0.17, freq: 900, to: 200 });
        this.tone({ freq: 130, to: 55, dur: 0.16, type: 'square', gain: 0.09 });
        break;
      case 'crit':
        this.tone({ freq: 1050, to: 1650, dur: 0.1, type: 'triangle', gain: 0.12 });
        this.tone({ freq: 135, to: 55, dur: 0.2, type: 'square', gain: 0.1, delay: 0.01 });
        break;
      case 'hurt':
        this.tone({ freq: 190, to: 70, dur: 0.25, type: 'sawtooth', gain: 0.13 });
        this.noise({ dur: 0.18, gain: 0.08, freq: 500, to: 120 });
        break;
      case 'dash':
        this.noise({ dur: 0.22, gain: 0.1, freq: 300, to: 2400, type: 'bandpass' });
        this.tone({ freq: 260, to: 600, dur: 0.15, type: 'sine', gain: 0.035 });
        break;
      case 'lance':
        this.tone({ freq: 520, to: 1500, dur: 0.22, type: 'triangle', gain: 0.12 });
        this.noise({ dur: 0.15, gain: 0.07, freq: 2600, to: 900 });
        break;
      case 'nova':
        this.tone({ freq: 150, to: 60, dur: 0.45, type: 'sawtooth', gain: 0.12 });
        this.tone({ freq: 800, to: 220, dur: 0.4, type: 'triangle', gain: 0.08 });
        this.noise({ dur: 0.5, gain: 0.1, freq: 300, to: 2600, type: 'bandpass' });
        break;
      case 'pickup':
        this.tone({ freq: 800, to: 1250, dur: 0.09, type: 'sine', gain: 0.1 });
        this.tone({ freq: 1250, to: 1600, dur: 0.1, type: 'sine', gain: 0.07, delay: 0.06 });
        break;
      case 'shard':
        this.tone({ freq: 1200, to: 1900, dur: 0.055, type: 'triangle', gain: 0.035 });
        break;
      case 'chest':
        this.tone({ freq: 230, to: 300, dur: 0.25, type: 'triangle', gain: 0.1 });
        this.tone({ freq: 700, to: 1100, dur: 0.3, type: 'sine', gain: 0.08, delay: 0.16 });
        break;
      case 'shrine':
        this.tone({ freq: 330, to: 660, dur: 0.5, type: 'sine', gain: 0.1 });
        this.tone({ freq: 495, to: 990, dur: 0.5, type: 'sine', gain: 0.06, delay: 0.08 });
        break;
      case 'portal':
        this.tone({ freq: 180, to: 900, dur: 0.7, type: 'sine', gain: 0.1 });
        this.tone({ freq: 300, to: 1400, dur: 0.7, type: 'triangle', gain: 0.05, delay: 0.1 });
        break;
      case 'boss':
        this.tone({ freq: 75, to: 42, dur: 1.1, type: 'sawtooth', gain: 0.15 });
        this.tone({ freq: 140, to: 80, dur: 0.9, type: 'square', gain: 0.06 });
        this.noise({ dur: 0.8, gain: 0.08, freq: 180, to: 80 });
        break;
      case 'death':
        this.tone({ freq: 300, to: 55, dur: 1.2, type: 'sawtooth', gain: 0.12 });
        this.tone({ freq: 150, to: 30, dur: 1.4, type: 'sine', gain: 0.1 });
        break;
      case 'rank':
        [440, 554, 659, 880].forEach((f, i) => this.tone({ freq: f, dur: 0.32, type: 'triangle', gain: 0.08, delay: i * 0.09 }));
        break;
      case 'boon':
        [330, 440, 660].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sine', gain: 0.08, delay: i * 0.08 }));
        break;
      case 'victory':
        [261, 329, 392, 523, 659].forEach((f, i) => this.tone({ freq: f, dur: 0.7, type: 'triangle', gain: 0.09, delay: i * 0.13 }));
        break;
      case 'error':
        this.tone({ freq: 140, to: 110, dur: 0.16, type: 'square', gain: 0.08 });
        break;
      default:
        break;
    }
  }

  startMusic() {
    if (!this.ready || this.musicTimer) return;
    const chords = [
      [110, 164.81, 220, 293.66],
      [98, 146.83, 196, 261.63],
      [87.31, 130.81, 174.61, 246.94],
      [82.41, 123.47, 164.81, 220]
    ];
    const playChord = () => {
      if (!this.ready || this.settings.music === false) return;
      const t = this.ctx.currentTime;
      const chord = chords[this.musicStep % chords.length];
      const gain = this.musicGain;
      chord.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 560 + index * 160;
        osc.type = index === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 7;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045 / (index + 1), t + 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 7.5);
        osc.connect(filter);
        filter.connect(g);
        g.connect(gain);
        osc.start(t);
        osc.stop(t + 7.7);
      });
      // A sparse, distant bell gives the tower a sense of scale.
      if (this.musicStep % 2 === 0) {
        const bell = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bell.type = 'sine';
        bell.frequency.value = chord[2] * 4;
        bg.gain.setValueAtTime(0.0001, t + 1.1);
        bg.gain.exponentialRampToValueAtTime(0.016, t + 1.2);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
        bell.connect(bg);
        bg.connect(gain);
        bell.start(t + 1.1);
        bell.stop(t + 5.6);
      }
      this.musicStep++;
    };
    playChord();
    this.musicTimer = setInterval(playChord, 7200);
  }
}
