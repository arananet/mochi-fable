// core.js: lógica pura de Mochi Fable (sin DOM). Cubierta por tests/core.test.mjs
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function hash(n, seed = 0) { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); }
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// colores 'rgb(r,g,b)'
export const A = (c, a) => 'rgba(' + c.slice(4, -1) + ',' + a + ')';
const parseRgb = c => c.slice(4, -1).split(',').map(Number);
export function mulRGB(c, m) { const p = parseRgb(c); return `rgb(${(p[0] * m) | 0},${(p[1] * m) | 0},${(p[2] * m) | 0})`; }
export function mixRGB(c1, c2, t) { const p = parseRgb(c1), q = parseRgb(c2); return `rgb(${lerp(p[0], q[0], t) | 0},${lerp(p[1], q[1], t) | 0},${lerp(p[2], q[2], t) | 0})`; }
export const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); };

// ---------- mundo ----------
export const LANE = { zMin: 0, zMax: 120 };
export const TUNE = { gravity: 900, playerJumpV: 210, ninjaJumpV: 470, playerSpeed: 165, playerZSpeed: 105 };
export const jumpPeak = v => (v * v) / (2 * TUNE.gravity);

export function stepBody(b, dt, bounds) {
  let landed = false;
  b.x += b.vx * dt;
  b.z = clamp(b.z + b.vz * dt, LANE.zMin, LANE.zMax);
  if (b.y > 0 || b.vy > 0) {
    b.vy -= TUNE.gravity * dt; b.y += b.vy * dt;
    if (b.y <= 0) { b.y = 0; b.vy = 0; landed = true; }
  }
  if (bounds) b.x = clamp(b.x, bounds[0], bounds[1]);
  return landed;
}
export function inReach(a, t, reach, zTol = 18, yTol = 60) {
  const dx = (t.x - a.x) * a.face;
  return dx > -12 && dx < reach && Math.abs(t.z - a.z) < zTol && Math.abs((t.y || 0) - (a.y || 0)) < yTol;
}
export function inRadius(a, t, r) { const dx = t.x - a.x, dz = (t.z - a.z) * 1.7; return dx * dx + dz * dz < r * r; }
export function applyDamage(t, dmg) { t.hp = Math.max(0, t.hp - dmg); return t.hp === 0; }
export const nextCombo = (combo, window) => (window > 0 && combo > 0 && combo < 3 ? combo + 1 : 1);

export const ENEMY = {
  grunt: { hp: 30, speed: 100, dmg: 8, reach: 66, windup: 0.45, recover: 0.5, score: 100, armor: false },
  thrower: { hp: 22, speed: 115, dmg: 6, reach: 0, windup: 0.5, recover: 0.6, score: 150, armor: false },
  bomber: { hp: 16, speed: 150, dmg: 20, reach: 52, windup: 0.8, recover: 0.1, score: 200, armor: false },
  brute: { hp: 75, speed: 62, dmg: 16, reach: 78, windup: 0.7, recover: 0.8, score: 300, armor: true },
  boss: { hp: 420, speed: 95, dmg: 14, reach: 96, windup: 0.5, recover: 0.55, score: 2000, armor: true },
};

export const LEVEL = {
  length: 6100,
  acts: [
    { x: -1, name: 'Acto I', sub: 'La pradera dorada' },
    { x: 2050, name: 'Acto II', sub: 'El camino de los farolillos' },
    { x: 3950, name: 'Acto III', sub: 'El santuario de la luna' },
  ],
  arenas: [
    { x: 800, waves: [['grunt', 'grunt', 'grunt'], ['grunt', 'grunt', 'thrower', 'bomber']] },
    { x: 1600, waves: [['grunt', 'thrower', 'grunt', 'bomber'], ['brute', 'grunt', 'grunt']] },
    { x: 2600, waves: [['grunt', 'grunt', 'thrower', 'thrower', 'bomber'], ['bomber', 'bomber', 'grunt', 'grunt']] },
    { x: 3400, waves: [['brute', 'grunt', 'grunt', 'thrower'], ['thrower', 'thrower', 'brute', 'bomber', 'grunt']] },
    { x: 4400, waves: [['grunt', 'grunt', 'grunt', 'thrower', 'bomber', 'bomber'], ['brute', 'brute', 'thrower', 'grunt']] },
    { x: 5400, waves: [['boss']] },
  ],
};

export class Director {
  constructor(level, start = 0) { this.level = level; this.i = start; this.wave = 0; this.locked = false; this.done = start >= level.arenas.length; }
  get arena() { return this.level.arenas[this.i]; }
  update(px, alive) {
    if (this.done) return null;
    const a = this.arena;
    if (!this.locked) {
      if (px >= a.x - 120) { this.locked = true; this.wave = 0; return { type: 'spawn', kinds: a.waves[0], arena: a, first: true }; }
      return null;
    }
    if (alive > 0) return null;
    this.wave++;
    if (this.wave < a.waves.length) return { type: 'spawn', kinds: a.waves[this.wave], arena: a };
    this.locked = false; this.i++;
    if (this.i >= this.level.arenas.length) this.done = true;
    return { type: 'clear', done: this.done };
  }
}

// ---------- secretos ----------
export const CODES = {
  konami: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
  mochi: [...'mochi'],
  fable: [...'fable'],
};
export class SecretCodes {
  constructor(codes) { this.codes = codes; this.buf = []; this.max = Math.max(...Object.values(codes).map(c => c.length)); }
  feed(key) {
    this.buf.push(key); if (this.buf.length > this.max) this.buf.shift();
    for (const [name, seq] of Object.entries(this.codes)) {
      if (seq.length <= this.buf.length && seq.every((k, i) => this.buf[this.buf.length - seq.length + i] === k)) { this.buf.length = 0; return name; }
    }
    return null;
  }
}

// ---------- paleta: tarde -> hora dorada -> ocaso -> noche ----------
const KEYS = [
  [0, { skyTop: '#3f8fd6', skyMid: '#93d2ee', skyBot: '#f6f1cc', sun: '#fffbe6', glow: '#ffe9a0', cloudL: '#ffffff', cloudS: '#b4cbe6', cloudRim: '#fff4c8',
    far1: '#a6c8dc', far2: '#7fb3b6', haze: '#e9f4e4', hill: '#62a866', hill2: '#93cb72', forest: '#3d8a5e', tree: '#4f9f50', trunk: '#6b4a34',
    ground: '#93c75c', ground2: '#56963f', path: '#e8d5a0', grass: '#6db34a', grassDark: '#3f7a3a', fg: '#1d4a31', amb: '#ffffff', rim: '#fff2b8', grade: '#ffe7a8',
    night: 0, rays: 0.55, sunY: 0.2, sunA: 1, moonA: 0, lantern: 0 }],
  [0.38, { skyTop: '#5a80c8', skyMid: '#f4bd8c', skyBot: '#ffe4a8', sun: '#fff3c8', glow: '#ffc36b', cloudL: '#fff2de', cloudS: '#d59c90', cloudRim: '#ffd27a',
    far1: '#b99db6', far2: '#9b87a6', haze: '#ffdcb4', hill: '#86985c', hill2: '#b8ad5e', forest: '#4f7450', tree: '#6c8c46', trunk: '#5e3f33',
    ground: '#b9b75a', ground2: '#778842', path: '#f0cb90', grass: '#a5a84a', grassDark: '#56683a', fg: '#2c382b', amb: '#ffeacb', rim: '#ffcf7a', grade: '#ffb86b',
    night: 0, rays: 0.85, sunY: 0.55, sunA: 1, moonA: 0, lantern: 0.15 }],
  [0.62, { skyTop: '#353a8c', skyMid: '#e96f7c', skyBot: '#ffb56d', sun: '#ffe0aa', glow: '#ff7a4a', cloudL: '#ffc4aa', cloudS: '#875890', cloudRim: '#ffb060',
    far1: '#8a6a9e', far2: '#6a5288', haze: '#f89c7c', hill: '#5b5870', hill2: '#7d6c72', forest: '#384360', tree: '#495462', trunk: '#3d2c38',
    ground: '#8c7c68', ground2: '#544e6a', path: '#dcab8a', grass: '#7c7c5c', grassDark: '#3b3d52', fg: '#1c1932', amb: '#ffcbb3', rim: '#ff9a5a', grade: '#ff7a6b',
    night: 0.3, rays: 0.65, sunY: 0.9, sunA: 1, moonA: 0, lantern: 0.75 }],
  [0.86, { skyTop: '#090e36', skyMid: '#1d2d6c', skyBot: '#4c6da4', sun: '#ffd0a0', glow: '#9fc4ff', cloudL: '#7d99d0', cloudS: '#28386e', cloudRim: '#cfe0ff',
    far1: '#2f4682', far2: '#253a6c', haze: '#5b7cb2', hill: '#21376a', hill2: '#2d4c7a', forest: '#152952', tree: '#1d3b5e', trunk: '#131b36',
    ground: '#2f5c7a', ground2: '#1a3356', path: '#6288a4', grass: '#2f6c7c', grassDark: '#152e4a', fg: '#060a20', amb: '#a3b8ec', rim: '#cfe2ff', grade: '#5a7aff',
    night: 1, rays: 0.3, sunY: 1.25, sunA: 0, moonA: 1, lantern: 1 }],
];
KEYS.push([1, KEYS[3][1]]);
const hex3 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const KP = KEYS.map(([t, o]) => [t, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? hex3(v) : v]))]);
const pcache = new Map();
export function paletteAt(p) {
  const q = Math.round(clamp(p, 0, 1) * 200);
  let r = pcache.get(q); if (r) return r;
  const u = q / 200; let i = 0;
  while (i < KP.length - 2 && u > KP[i + 1][0]) i++;
  const [t0, a] = KP[i], [t1, b] = KP[i + 1], f = clamp((u - t0) / (t1 - t0 || 1), 0, 1);
  r = { ver: q, bake: Math.round(q / 4) };
  for (const k in a) {
    if (Array.isArray(a[k])) r[k] = `rgb(${Math.round(lerp(a[k][0], b[k][0], f))},${Math.round(lerp(a[k][1], b[k][1], f))},${Math.round(lerp(a[k][2], b[k][2], f))})`;
    else r[k] = lerp(a[k], b[k], f);
  }
  r.ambRGB = [0, 1, 2].map(j => lerp(a.amb[j], b.amb[j], f) / 255);
  pcache.set(q, r); return r;
}

// ---------- estilo: rangos de combo ----------
export const RANKS = [[0, ''], [5, 'C'], [10, 'B'], [18, 'A'], [28, 'S'], [40, 'SS'], [60, 'MOCHI']];
export function rankIdx(h) { let i = 0; while (i < RANKS.length - 1 && h >= RANKS[i + 1][0]) i++; return i; }
export const rankMult = h => 1 + rankIdx(h) * 0.5;
