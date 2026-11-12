// audio.js: música y efectos 100% procedurales (WebAudio). Vals original en 3/4.
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const CH = { F: [53, 57, 60, 64], G: [55, 59, 62, 65], Em: [52, 55, 59, 62], Am: [57, 60, 64, 67], Dm: [50, 53, 57, 60], C: [48, 52, 55, 59], E: [52, 56, 59, 62] };
const CALM = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C'];
const BOSS = ['Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E'];
// melodía: por compás, pares [nota midi, duración en corcheas] (0 = silencio)
const MEL = [
  [[69, 2], [72, 2], [77, 2]], [[76, 3], [74, 1], [71, 2]], [[67, 2], [71, 2], [76, 2]], [[74, 1], [72, 1], [69, 4]],
  [[65, 2], [69, 2], [74, 2]], [[72, 1], [71, 1], [67, 2], [71, 2]], [[72, 6]], [[0, 2], [64, 2], [67, 2]],
  [[69, 2], [72, 2], [81, 2]], [[79, 3], [77, 1], [74, 2]], [[76, 2], [79, 2], [83, 2]], [[81, 4], [76, 2]],
  [[77, 2], [76, 2], [74, 2]], [[71, 2], [74, 2], [79, 2]], [[76, 4], [72, 2]], [[72, 6]],
];
const MELSTEP = [];
MEL.forEach((bar, b) => { let s = 0; for (const [n, d] of bar) { if (n) MELSTEP[b * 6 + s] = [n, d]; s += d; } });
const IN_SCALE = [69, 71, 72, 76, 77, 81, 83, 84, 88]; // escala japonesa "in" sobre La

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.mode = 'calm'; this.step = 0; this.seed = 7; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
    // reverb sintética
    const len = c.sampleRate * 2.4, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.32; this.rev.connect(rg); rg.connect(this.master);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.next = c.currentTime + 0.12;
    this.timer = setInterval(() => this.tick(), 30);
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05); return this.muted; }
  setMode(m) { this.mode = m; }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  tick() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.16) {
      this.playStep(this.step, this.next);
      this.next += this.mode === 'boss' ? 0.185 : this.mode === 'fight' ? 0.225 : 0.245;
      this.step++;
    }
  }
  playStep(step, t) {
    const boss = this.mode === 'boss', fight = this.mode === 'fight';
    const prog = boss ? BOSS : CALM, bar = Math.floor(step / 6) % prog.length, s = step % 6, ch = CH[prog[bar]];
    if (s === 0) {
      this.pluck(mtof(ch[0] - 12), t, 0.5, 1.4, 'sine');
      for (const n of ch) this.pad(mtof(n), t, boss ? 1.0 : 1.35, 0.045);
    }
    if (s === 2 || s === 4) { this.pluck(mtof(ch[1]), t, 0.16, 0.9); this.pluck(mtof(ch[2]), t + 0.012, 0.16, 0.9); if (ch[3]) this.pluck(mtof(ch[3]), t + 0.024, 0.12, 0.9); }
    if ((s === 3 || s === 5) && bar % 2 === 1) this.pluck(mtof(ch[(s + bar) % ch.length] + 12), t, 0.09, 0.7);
    if (boss) {
      if (s % 2 === 0 || this.rnd() < 0.35) { const n = IN_SCALE[(this.rnd() * IN_SCALE.length) | 0]; this.flute(mtof(n), t, 0.3, 0.13); this.pluck(mtof(n - 12), t, 0.12, 0.5); }
      this.taiko(t, s === 0 ? 0.9 : s === 3 ? 0.6 : s === 5 ? 0.4 : 0); if (s % 2 === 1) this.tick_(t, 0.12);
    } else {
      const m = MELSTEP[step % 96];
      if (m) { const d = m[1] * 0.245; this.flute(mtof(m[0]), t, d, 0.16); this.pluck(mtof(m[0] + 12), t, 0.07, 1.2); }
      if (fight) { if (s === 0) this.taiko(t, 0.8); if (s === 2 || s === 4) this.tick_(t, 0.22); if (s === 5) this.taiko(t, 0.3); this.shaker(t, s % 2 ? 0.03 : 0.06); }
    }
  }
  out(node, wet = 0.5) { node.connect(this.music); if (wet) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(this.rev); } }
  pluck(f, t, vol, dur, type = 'triangle') {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.003;
    const g2 = c.createGain(); g2.gain.value = 0.3;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); this.out(g, 0.5);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  pad(f, t, dur, vol) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
    for (const det of [-6, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.6); }
    lp.connect(g); this.out(g, 0.6);
  }
  flute(f, t, dur, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
    o.type = 'sine'; o.frequency.value = f; l.frequency.value = 5.2; lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency);
    const o2 = c.createOscillator(), g2 = c.createGain(); o2.type = 'triangle'; o2.frequency.value = f * 2; g2.gain.value = 0.12;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.06, dur - 0.05)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.12);
    o.connect(g); o2.connect(g2); g2.connect(g); this.out(g, 0.7);
    for (const x of [o, o2, l]) { x.start(t); x.stop(t + dur + 0.2); }
  }
  noise(t, dur, vol, type, f0, f1, dest) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.music); s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  thump(t, f0, f1, dur, vol, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.music); o.start(t); o.stop(t + dur + 0.02);
  }
  taiko(t, vol) { if (!vol) return; this.thump(t, 130, 48, 0.3, vol * 0.9); this.noise(t, 0.08, vol * 0.25, 'lowpass', 900, 200); }
  tick_(t, vol) { this.noise(t, 0.04, vol, 'bandpass', 2400); }
  shaker(t, vol) { this.noise(t, 0.05, vol, 'highpass', 6000); }
  // ---- efectos ----
  fx(name) {
    const c = this.ctx; if (!c || c.state !== 'running') return; const t = c.currentTime, d = this.sfx;
    switch (name) {
      case 'whoosh': this.noise(t, 0.14, 0.25, 'bandpass', 500, 2400, d); break;
      case 'hit': this.thump(t, 190, 60, 0.12, 0.8, d); this.noise(t, 0.07, 0.45, 'bandpass', 1500, 500, d); break;
      case 'big': this.thump(t, 150, 35, 0.35, 1, d); this.noise(t, 0.22, 0.5, 'lowpass', 1200, 150, d); break;
      case 'jump': this.thump(t, 150, 260, 0.13, 0.35, d); break;
      case 'land': this.thump(t, 95, 38, 0.2, 0.8, d); this.noise(t, 0.12, 0.2, 'lowpass', 500, 120, d); break;
      case 'roll': this.noise(t, 0.3, 0.2, 'bandpass', 300, 1200, d); break;
      case 'hurt': this.thump(t, 320, 110, 0.2, 0.5, d); this.noise(t, 0.1, 0.3, 'highpass', 1500, 0, d); break;
      case 'shuriken': this.noise(t, 0.18, 0.18, 'highpass', 3000, 7000, d); break;
      case 'clang': for (const f of [1900, 2850, 4100]) this.thump(t, f, f * 0.98, 0.25, 0.14, d); break;
      case 'poof': this.noise(t, 0.35, 0.35, 'lowpass', 2500, 200, d); break;
      case 'pickup': [84, 88, 91].forEach((n, i) => this.thump(t + i * 0.06, mtof(n), mtof(n), 0.18, 0.25, d)); break;
      case 'special': [57, 64, 69, 76, 81, 88].forEach((n, i) => this.thump(t + i * 0.05, mtof(n), mtof(n), 0.4, 0.22, d)); this.noise(t, 0.9, 0.3, 'bandpass', 300, 3000, d); break;
      case 'secret': [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this.thump(t + i * 0.07, mtof(n), mtof(n), 0.5, 0.2, d)); break;
      case 'gong': for (const f of [98, 147, 196.5, 311]) this.thump(t, f, f * 0.99, 2.2, 0.3, d); break;
      case 'yawn': this.thump(t, 300, 140, 0.7, 0.25, d); break;
    }
  }
}
