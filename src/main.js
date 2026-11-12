// main.js: bucle de juego, entrada, combate, IA, HUD y secretos.
import { TAU, clamp, lerp, ell, TUNE, LANE, stepBody, inReach, inRadius, applyDamage, nextCombo, ENEMY, LEVEL, Director, CODES, SecretCodes, paletteAt, RANKS, rankIdx, rankMult } from './core.js';
import { Sound } from './audio.js';
import { drawBack, drawFront, spiritSpots } from './world.js';
import { setLight, drawMochi, drawNinja, drawShuriken, drawDango, drawLog, drawSpirit, ninjaScale } from './actors.js';

const cv = document.getElementById('game'), g = cv.getContext('2d');
const V = { w: 960, h: 540, hor: 365, scale: 1 };
const snd = new Sound(), codes = new SecretCodes(CODES);
const FONT = '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';
const EGGS = { konami: 'Mochi Gigante', mochi: 'Lluvia de dango', fable: 'Modo tinta', moon: 'El conejo de la luna', sun: 'El sol dormilón', picnic: 'La merienda', neko: 'El gato-montaña despierta', bow: '¡La cinta no se toca!' };
const store = { get() { try { return JSON.parse(localStorage.getItem('mochi-fable-eggs') || '[]'); } catch { return []; } }, set(v) { try { localStorage.setItem('mochi-fable-eggs', JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };

const best = { get() { try { return JSON.parse(localStorage.getItem('mochi-fable-best') || '{}'); } catch { return {}; } }, set(v) { try { localStorage.setItem('mochi-fable-best', JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };
const PERKS = { dmg: ['Puños de acero', '+25% de daño'], vamp: ['Cinta vampira', 'Cada baja te cura 4'], hp: ['Barriga llena', '+30 de vida máxima y cura total'], meter: ['Ansia de mochi', 'El Tifón se carga un 60% más rápido'],
  boom: ['Barrigazo sísmico', 'El tercer golpe lanza una onda expansiva'], roll: ['Bola de demolición', 'Rodar hace x3 de daño y sin espera'], fury: ['Mecha corta', 'La Furia salta con solo 8 golpes'], shur: ['Estrellas de mochi', 'El tercer golpe lanza un shuriken'] };
const ONCE = ['boom', 'roll', 'fury', 'shur'];

function resize() {
  const r = cv.getBoundingClientRect(), cw = r.width || innerWidth, ch = r.height || innerHeight, dpr = Math.min(2, devicePixelRatio || 1, 2200 / cw);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  let h = 540, w = (cw / ch) * 540; if (w < 780) { w = 780; h = (780 * ch) / cw; }
  V.w = w; V.h = h; V.hor = h - 175; V.scale = cv.width / w;
}
addEventListener('resize', resize); resize();
const groundY = z => V.hor + 34 + z * 0.92;
const depthS = z => 0.86 + (z / LANE.zMax) * 0.22;

// ------------------------------------------------------------------ estado
const G = { mode: 'title', t: 0, cam: 0, pcam: 0, shake: 0, hitstop: 0, paused: false, eggs: new Set(store.get()), fx: { wake: 0, sunFace: 0, rabbit: false }, toast: null, ink: false, touch: false };
let uid = 1;
function newPlayer(x) {
  return { x, y: 0, z: 62, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, maxHp: 100, meter: 0, state: 'idle', st: 0, walkPhase: 0, squash: 1, sqV: 0, combo: 0, comboT: 0, atkDur: 0.26, hitDone: false, queue: false,
    inv: 0, rollCd: 0, flash: 0, blush: 0, spin: 0, idleT: 0, big: 1, rainbow: false, hitSet: new Set(), pulse: 0 };
}
function reset(arenaIdx = 0, endless = false) {
  const startX = endless ? 3000 : arenaIdx ? LEVEL.arenas[arenaIdx].x - 520 : 140, keep = arenaIdx > 0 && !endless;
  const maxHp = keep ? G.p.maxHp : 100;
  Object.assign(G, { mode: 'play', p: newPlayer(startX), enemies: [], shots: [], picks: [], parts: [], texts: [], logs: [], decals: keep ? G.decals : [], dir: new Director(LEVEL, endless ? LEVEL.arenas.length : arenaIdx), waveT: 0, lock: null,
    score: keep ? G.score || 0 : 0, hits: 0, hitsT: 0, giantT: 0, banner: endless ? { t: 0, name: 'Reto sin fin', sub: '¿Cuántas oleadas aguanta un mochi?' } : null, act: -1, winT: 0, overT: 0, boss: null, slow: 0, fireT: 0, paused: false,
    perks: keep ? G.perks : {}, choice: null, endless, waveN: 0, offered: 0, hpScale: 1, kills: keep ? G.kills : 0, maxHits: keep ? G.maxHits : 0, multiN: 0, multiT: 0, furyT: 0, zoom: 1, hurtT: 0, announce: null, newBest: false, goT: 0, endP: 0.3 });
  G.p.maxHp = G.p.hp = maxHp;
  G.cam = clamp(startX - V.w / 2, 0, LEVEL.length - V.w); G.pcam = G.cam; G.fx.wake = 0;
  snd.setMode('calm');
}
G.p = newPlayer(300); G.enemies = []; G.shots = []; G.picks = []; G.parts = []; G.texts = []; G.logs = []; G.score = 0; G.decals = []; G.perks = {}; G.zoom = 1; G.hurtT = 0; G.furyT = 0;

// ------------------------------------------------------------------ entrada
const KEYMAP = { arrowleft: 'L', a: 'L', arrowright: 'R', d: 'R', arrowup: 'U', w: 'U', arrowdown: 'D', s: 'D', z: 'atk', j: 'atk', x: 'jump', k: 'jump', c: 'roll', l: 'roll', shift: 'roll', ' ': 'spec', v: 'spec' };
const held = {}, pressed = {};
function begin(endless) {
  snd.start();
  if (G.choice) { if (G.choice.t > 0.35) pick(G.choice.sel); return; }
  if (G.mode === 'title') reset(0, !!endless);
  else if (G.mode === 'over') { if (G.endless || endless) reset(0, true); else reset(Math.min(G.dir.i, LEVEL.arenas.length - 1)); }
  else if (G.mode === 'win') { if (endless) reset(0, true); else { G.mode = 'title'; G.cam = 0; snd.setMode('calm'); } }
}
function offer() { const keys = Object.keys(PERKS).filter(k => !(G.perks[k] && ONCE.includes(k))), opts = []; while (opts.length < 3 && keys.length) opts.push(keys.splice((Math.random() * keys.length) | 0, 1)[0]); G.choice = { opts, sel: 1, t: 0 }; for (const k in held) held[k] = false; stick = null; }
function pick(i) { const k = G.choice.opts[i]; if (!k) return; G.perks[k] = (G.perks[k] || 0) + 1; if (k === 'hp') { G.p.maxHp += 30; G.p.hp = G.p.maxHp; } G.choice = null; snd.fx('secret'); say(G.p.x, groundY(G.p.z) - 130, PERKS[k][0], '#ffe27a', 26); }
const cardRect = i => { const cw = Math.min(236, (V.w - 80) / 3); return { x: V.w / 2 + (i - 1) * (cw + 16) - cw / 2, y: V.h * 0.3, w: cw, h: 180 }; };
const endlessBtn = () => ({ x: V.w / 2 + 12, y: V.h * 0.36 + 112, w: 230, h: 40 });
function saveBest() { const b = best.get(), k = G.endless ? 'endless' : 'story'; G.newBest = G.score > (b[k] || 0); if (G.newBest) b[k] = G.score; if (G.endless) b.wave = Math.max(b.wave || 0, G.waveN); b.combo = Math.max(b.combo || 0, G.maxHits); best.set(b); }
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  snd.start();
  if (!e.repeat) { const code = codes.feed(key); if (code) secret(code); }
  if (key === 'Enter') { begin(); return; }
  if (G.choice && '123'.includes(key)) { if (G.choice.t > 0.35) pick(+key - 1); return; }
  if (key === 'r' && G.mode !== 'play') { begin(true); if (G.mode !== 'play') reset(0, true); return; }
  if (key === 'n') { G.muted = snd.toggleMute(); return; }
  if ((key === 'p' || key === 'Escape') && G.mode === 'play') { G.paused = !G.paused; return; }
  const m = KEYMAP[key.toLowerCase()];
  if (m) { if (!held[m]) pressed[m] = true; held[m] = true; e.preventDefault(); }
});
addEventListener('keyup', e => { const m = KEYMAP[e.key.toLowerCase()]; if (m) held[m] = false; });
addEventListener('blur', () => { for (const k in held) held[k] = false; });

const touches = new Map(); let stick = null;
const BTN = () => [{ n: 'atk', x: V.w - 82, y: V.h - 74, r: 40, l: 'GOLPE' }, { n: 'jump', x: V.w - 172, y: V.h - 50, r: 31, l: 'SALTO' }, { n: 'roll', x: V.w - 62, y: V.h - 162, r: 31, l: 'RODAR' }, { n: 'spec', x: V.w - 156, y: V.h - 134, r: 29, l: '✿' }];
const toView = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * V.w, y: ((e.clientY - r.top) / r.height) * V.h }; };
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); snd.start();
  const pt = toView(e); if (e.pointerType === 'touch') G.touch = true;
  if (Math.hypot(pt.x - (V.w - 30), pt.y - 28) < 22) { G.muted = snd.toggleMute(); return; }
  if (G.cel) { // astros clicables
    for (const k of ['sun', 'moon']) {
      const c = G.cel[k], vis = k === 'sun' ? G.pal.sunA > 0.3 && c.y < V.hor - 20 : G.pal.moonA > 0.5;
      if (vis && Math.hypot(pt.x - c.x, pt.y - c.y) < c.r * 1.7) { G[k + 'Taps'] = (G[k + 'Taps'] || 0) + 1; spark(c.x + G.cam, c.y, '#fff7c0', 8, true); snd.fx('pickup'); if (G[k + 'Taps'] === 3) secret(k); return; }
    }
  }
  if (G.choice) { for (let i = 0; i < 3; i++) { const r = cardRect(i); if (pt.x > r.x && pt.x < r.x + r.w && pt.y > r.y && pt.y < r.y + r.h && G.choice.t > 0.35) pick(i); } return; }
  if (G.mode !== 'play') { const r = endlessBtn(); begin((G.mode === 'title' || G.mode === 'win') && pt.x > r.x && pt.x < r.x + r.w && pt.y > r.y - 8 && pt.y < r.y + r.h + 8); return; }
  const p = G.p, px = p.x - G.cam, py = groundY(p.z) - p.y - 76 * depthS(p.z) * p.big;
  if (Math.hypot(pt.x - px, pt.y - py) < 30) { p.blush = 1.6; secret('bow'); say(p.x, py - 20, '¡Eh, la cinta!', '#ffd0d8', 18); return; }
  if (e.pointerType !== 'touch') return;
  if (G.paused) { G.paused = false; return; }
  for (const b of BTN()) if (Math.hypot(pt.x - b.x, pt.y - b.y) < b.r + 10) { touches.set(e.pointerId, b.n); pressed[b.n] = held[b.n] = true; return; }
  if (pt.x < V.w * 0.5) { stick = { id: e.pointerId, ox: pt.x, oy: pt.y, x: pt.x, y: pt.y }; }
});
cv.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { const pt = toView(e); stick.x = pt.x; stick.y = pt.y; } });
const pup = e => { if (stick && e.pointerId === stick.id) stick = null; const n = touches.get(e.pointerId); if (n) { held[n] = false; touches.delete(e.pointerId); } };
cv.addEventListener('pointerup', pup); cv.addEventListener('pointercancel', pup);
cv.addEventListener('contextmenu', e => e.preventDefault());

// ------------------------------------------------------------------ secretos
function secret(name) {
  const fresh = !G.eggs.has(name); G.eggs.add(name); store.set([...G.eggs]);
  const p = G.p;
  if (name === 'konami') { G.giantT = 20; p.rainbow = true; snd.fx('gong'); }
  if (name === 'mochi') { for (let i = 0; i < 14; i++) G.picks.push({ x: G.cam + 40 + Math.random() * (V.w - 80), z: 10 + Math.random() * 100, y: 380 + Math.random() * 500, vy: 0, t: 0 }); }
  if (name === 'fable') { G.ink = !G.ink; cv.style.filter = G.ink ? 'grayscale(1) sepia(.45) contrast(1.25) brightness(1.05)' : ''; }
  if (name === 'moon') { G.fx.rabbit = true; p.meter = 100; }
  if (name === 'sun') { G.fx.sunFace = 4; p.hp = Math.min(p.maxHp || 100, p.hp + 30); snd.fx('yawn'); }
  if (name === 'neko') G.fx.wake = 6;
  snd.fx('secret');
  G.toast = { t: 0, txt: `✿ Secreto${fresh ? '' : ' (otra vez)'}: ${EGGS[name]}`, sub: `${G.eggs.size} de ${Object.keys(EGGS).length} encontrados` };
}

// ------------------------------------------------------------------ partículas y textos
function part(o) { if (G.parts.length < 800) G.parts.push(Object.assign({ t: 0, life: 0.5, vx: 0, vy: 0, size: 6, kind: 'dust', col: '#fff' }, o)); }
function dust(x, z, n = 6, col = 'rgba(255,244,214,.8)') { for (let i = 0; i < n; i++) part({ x: x + (Math.random() - 0.5) * 30, y: groundY(z) - 3, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 50, size: 5 + Math.random() * 8, life: 0.4 + Math.random() * 0.3, col }); }
function spark(x, y, col, n = 7, screen = false) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 120 + Math.random() * 220; part({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.22 + Math.random() * 0.15, col, size: 3, screen }); } }
function ring(x, z, r, col = 'rgba(255,250,220,.9)') { part({ kind: 'ring', x, y: groundY(z), size: r, life: 0.45, col }); }
function smoke(x, y, n = 12) { for (let i = 0; i < n; i++) part({ kind: 'smoke', x: x + (Math.random() - 0.5) * 34, y: y - Math.random() * 70, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, size: 12 + Math.random() * 16, life: 0.6 + Math.random() * 0.4, col: 'rgba(225,215,240,.85)' }); }
function blood(x, z, y, n, dir = 0, pow = 1) { const gy = groundY(z); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (60 + Math.random() * 230) * pow; part({ kind: 'blood', x, y: gy - y, gy: gy - 22 + Math.random() * 46, vx: Math.cos(a) * v * 0.7 + dir * (60 + Math.random() * 220) * pow, vy: -Math.abs(Math.sin(a)) * v - 70, size: 2 + Math.random() * 3.5, life: 3 }); } }
function decal(x, y, r) { G.decals.push({ x, y, r, rx: 1 + Math.random() * 1.3, rot: (Math.random() - 0.5) * 0.5 }); if (G.decals.length > 340) G.decals.shift(); }
const GIBCOL = { grunt: ['#5c547c', '#e4525f'], thrower: ['#3b7682', '#f4c44f'], bomber: ['#d9772e', '#2a2030'], brute: ['#8c4452', '#f4e5c6'], boss: ['#2e2644', '#cfa95e'] };
function gibs(e) { const gy = groundY(e.z), c = GIBCOL[e.kind], n = e.kind === 'boss' ? 16 : 8; for (let i = 0; i < n; i++) part({ kind: 'gib', x: e.x + (Math.random() - 0.5) * 24, y: gy - 20 - Math.random() * 60, gy: gy - 3 + Math.random() * 10, vx: (Math.random() - 0.5) * 460, vy: -160 - Math.random() * 330, size: 4 + Math.random() * 5, life: 2.8, col: i % 3 === 2 ? '#f0d3b6' : c[i % 2] }); }
function say(x, y, txt, col = '#fff', size = 22) { G.texts.push({ x, y, txt, col, size, t: 0, rot: (Math.random() - 0.5) * 0.3 }); }
const WORDS = ['¡PAF!', '¡POM!', '¡ZAS!', '¡TOC!', '¡PUM!'];

// ------------------------------------------------------------------ jugador
function quake(p, power) { G.shake = Math.max(G.shake, power); if (!G.eggs.has('neko') || G.fx.wake <= 0) { if (power >= 9) { if (!G.eggs.has('neko')) secret('neko'); else G.fx.wake = 5; } } }
function hitEnemies(test, dmg, o = {}) {
  let n = 0;
  for (const e of G.enemies) {
    if (e.delay > 0 || e.dead || (e.state === 'down' && !o.ground) || e.state === 'enter' || (e.state === 'fly' && !o.juggle)) continue;
    if (o.set) { if (o.set.has(e.id)) continue; }
    if (!test(e)) continue;
    if (o.set) o.set.add(e.id);
    damageEnemy(e, dmg, o.dir || Math.sign(e.x - G.p.x) || 1, o); n++;
  }
  return n;
}
function damageEnemy(e, dmg, dir, o = {}) {
  const T = ENEMY[e.kind], p = G.p, was = e.hp > 0;
  const mult = (G.giantT > 0 ? 1.5 : 1) * (1 + 0.25 * (G.perks.dmg || 0)) * (G.furyT > 0 ? 1.5 : 1);
  const dead = applyDamage(e, dmg * mult), kill = dead && was;
  e.flash = 0.1; e.engaged = false;
  G.hitstop = Math.max(G.hitstop, kill ? 0.11 : o.launch ? 0.09 : 0.05); G.shake = Math.max(G.shake, o.launch || kill ? 8 : 3); if (o.launch || kill) G.zoom = 1.06;
  const hy = groundY(e.z) - e.y - 60;
  spark(e.x, hy, '#fff3c0', o.launch ? 10 : 6); part({ kind: 'flash', x: e.x, y: hy, size: o.launch ? 46 : 30, life: 0.12 });
  blood(e.x, e.z, e.y + 55, kill ? 30 : o.launch ? 14 : 7, dir, kill ? 1.35 : 1);
  if (o.launch || Math.random() < 0.4) say(e.x + (Math.random() - 0.5) * 30, hy - 30, o.word || WORDS[(Math.random() * WORDS.length) | 0], o.launch ? '#ffe27a' : '#fff', o.launch ? 30 : 22);
  const r0 = rankIdx(G.hits); G.hits++; G.hitsT = 2.6; G.maxHits = Math.max(G.maxHits, G.hits);
  if (rankIdx(G.hits) > r0) { G.rankPop = 0.5; snd.fx('pickup'); }
  p.meter = Math.min(100, p.meter + (o.noMeter ? 0 : 6 * (1 + 0.6 * (G.perks.meter || 0)))); G.score += Math.round(10 * rankMult(G.hits));
  if (G.furyT > 0) G.furyT = Math.max(G.furyT, 3.5);
  else if (G.hits === (G.perks.fury ? 8 : 15)) { G.furyT = 7; G.announce = { txt: '¡¡FURIA!!', t: 0, col: '#ff4a5a' }; snd.fx('gong'); }
  snd.fx(o.launch || kill ? 'big' : 'hit');
  if (kill) onKill(e);
  if (dead || (o.launch && e.kind !== 'boss')) { const air = e.state === 'fly' && e.y > 0; e.state = 'fly'; e.st = 0; e.vy = air ? 250 : dead ? 300 : 250; e.vx = dir * (air ? 170 : dead ? 260 : 200); e.vz = 0; if (!air) e.spin = 0; e.flyHits = new Set(); if (e.y <= 0) e.y = 0.01; }
  else if (e.state === 'fly') { e.vy = 230; e.vx = dir * 150; }
  else if (T.armor && !o.launch) { e.x += dir * 5; }
  else if (e.kind === 'boss') { e.x += dir * 14; if (e.state !== 'leap') { e.state = 'hurt'; e.st = 0; e.vx = dir * 60; } }
  else { e.state = 'hurt'; e.st = 0; e.vx = dir * 110; e.vz = 0; }
  if (kill && e.kind === 'boss') { G.slow = 1.6; if (!G.endless) G.winT = 3.2; snd.fx('gong'); for (const o2 of G.enemies) if (o2 !== e && !o2.dead && o2.hp > 0) { o2.hp = 0; o2.state = 'fly'; o2.st = 0; o2.y = Math.max(o2.y, 0.01); o2.vy = 260; o2.vx = (Math.sign(o2.x - e.x) || 1) * 200; o2.flyHits = new Set(); } }
}
const MULTI = ['', '', '¡DOBLE!', '¡TRIPLE!', '¡MASACRE!', '¡¡CARNICERÍA!!'];
function onKill(e) {
  const p = G.p; G.kills++; G.multiN = G.multiT > 0 ? G.multiN + 1 : 1; G.multiT = 1.5;
  if (G.multiN >= 2) { G.announce = { txt: MULTI[Math.min(5, G.multiN)], t: 0, col: '#ffe27a' }; G.score += 100 * G.multiN; }
  if (G.perks.vamp) p.hp = Math.min(p.maxHp, p.hp + 4 * G.perks.vamp);
  G.score += Math.round(ENEMY[e.kind].score * rankMult(G.hits));
  if (!G.enemies.some(o => o !== e && o.hp > 0)) G.slow = Math.max(G.slow, 0.6);
}
function explode(e) {
  e.dead = true; e.hp = 0; const gy = groundY(e.z), p = G.p;
  ring(e.x, e.z, 135, 'rgba(255,170,60,.95)'); part({ kind: 'flash', x: e.x, y: gy - 40, size: 95, life: 0.2 });
  for (let i = 0; i < 24; i++) { const a = Math.random() * TAU, v = 80 + Math.random() * 260; part({ kind: 'fire', x: e.x, y: gy - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, life: 0.45 + Math.random() * 0.4, col: i % 2 ? '#ffb03a' : '#ff5a2a', size: 5 + Math.random() * 6 }); }
  smoke(e.x, gy, 10); gibs(e); blood(e.x, e.z, 40, 22, 0, 1.25); decal(e.x, gy + 2, 24); G.shake = Math.max(G.shake, 13); snd.fx('big'); snd.fx('poof');
  if (inRadius(e, p, 95) && p.y < 30) hurtPlayer(ENEMY.bomber.dmg, Math.sign(p.x - e.x) || 1);
  for (const o of G.enemies) if (o !== e && !o.dead && o.delay <= 0 && o.state !== 'enter' && inRadius(e, o, 115)) damageEnemy(o, 26, Math.sign(o.x - e.x) || 1, { launch: true, word: '¡BUM!' });
}
function hurtPlayer(dmg, dir) {
  const p = G.p; if (p.inv > 0 || p.state === 'roll' || p.state === 'special' || p.state === 'dead' || G.winT > 0) return false;
  p.hp -= G.giantT > 0 ? dmg * 0.5 : dmg; p.flash = 0.12; p.inv = 0.9; G.hits = 0; G.shake = Math.max(G.shake, 6); G.hitstop = 0.06; snd.fx('hurt'); G.hurtT = 0.6; blood(p.x, p.z, p.y + 50, 12, dir);
  spark(p.x, groundY(p.z) - p.y - 50, '#ff9aa8', 8);
  if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; p.st = 0; p.vy = 240; p.vx = dir * 200; G.overT = 2; G.slow = 0.8; }
  else { p.state = 'hurt'; p.st = 0; p.vx = dir * 170; p.vz = 0; }
  return true;
}
function startAttack(p) {
  p.combo = nextCombo(p.combo, p.comboT); p.state = 'attack'; p.st = 0; p.hitDone = false; p.queue = false; p.atkDur = (p.combo === 3 ? 0.42 : 0.24) * (G.furyT > 0 ? 0.72 : 1); snd.fx('whoosh');
}
function updatePlayer(dt) {
  const p = G.p, big = (p.big = lerp(p.big, G.giantT > 0 ? 1.6 : 1, 1 - Math.exp(-6 * dt)));
  p.st += dt; p.inv = Math.max(0, p.inv - dt); p.rollCd -= dt; p.flash = Math.max(0, p.flash - dt); p.blush = Math.max(0, p.blush - dt); p.comboT -= dt;
  let ax = (held.R ? 1 : 0) - (held.L ? 1 : 0), az = (held.D ? 1 : 0) - (held.U ? 1 : 0);
  if (stick) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy); if (d > 10) { ax = clamp(dx / 46, -1, 1); az = clamp(dy / 46, -1, 1); } }
  if (G.winT > 0 && G.winT < 2 && p.y === 0 && p.state !== 'win') { p.state = 'win'; p.st = 0; }
  const free = p.state === 'idle' || p.state === 'walk' || p.state === 'sit';
  switch (p.state) {
    case 'idle': case 'walk': case 'sit': {
      p.vx = ax * TUNE.playerSpeed; p.vz = az * TUNE.playerZSpeed; if (Math.abs(ax) > 0.2) p.face = Math.sign(ax);
      const moving = Math.abs(ax) + Math.abs(az) > 0.1;
      if (moving) { p.state = 'walk'; p.walkPhase += dt * 11; p.idleT = 0; if (Math.random() < dt * 5) dust(p.x - p.face * 20, p.z, 1); }
      else { p.idleT += dt; if (p.state === 'walk') p.state = 'idle'; if (p.idleT > 9 && !G.enemies.length && p.state === 'idle') { p.state = 'sit'; p.st = 0; if (!G.eggs.has('picnic')) secret('picnic'); } }
      if (pressed.atk) { p.idleT = 0; startAttack(p); }
      else if (pressed.jump) { p.idleT = 0; p.state = 'jump'; p.st = 0; p.vy = TUNE.playerJumpV; p.y = 0.01; p.squash = 1.22; snd.fx('jump'); dust(p.x, p.z, 5); }
      else if (pressed.roll && p.rollCd <= 0) { p.idleT = 0; p.state = 'roll'; p.st = 0; p.spin = 0; p.hitSet.clear(); p.rollCd = G.perks.roll ? 0.1 : 0.75; if (Math.abs(ax) > 0.2) p.face = Math.sign(ax); snd.fx('roll'); }
      else if (pressed.spec && p.meter >= 100) { p.idleT = 0; p.state = 'special'; p.st = 0; p.meter = 0; p.pulse = 0; p.spin = 0; p.vx = p.vz = 0; snd.fx('special'); say(p.x, groundY(p.z) - 130, '¡TIFÓN DE CINTA!', '#ff9aa8', 30); }
      break;
    }
    case 'jump': p.vx = ax * TUNE.playerSpeed * 0.75; p.vz = az * TUNE.playerZSpeed * 0.6; if (Math.abs(ax) > 0.2) p.face = Math.sign(ax);
      if (pressed.atk) { p.state = 'slam'; p.st = 0; p.vy = Math.min(p.vy, 60); snd.fx('whoosh'); } break;
    case 'slam': p.vx *= Math.exp(-4 * dt); p.vz = 0; break;
    case 'attack': {
      const third = p.combo === 3; p.vx = p.face * (p.st < 0.14 ? (third ? 210 : 70) : 0); p.vz = az * 30;
      if (pressed.atk) p.queue = true;
      if (!p.hitDone && p.st >= (third ? 0.13 : 0.07)) {
        p.hitDone = true; const reach = (third ? 86 : 72) * big;
        const n = hitEnemies(e => inReach(p, e, reach, 20 * big, 80), third ? 18 : 10, { dir: p.face, launch: third, juggle: true, word: third ? '¡BARRIGAZO!' : null });
        for (const s of G.shots) if (s.from === 'enemy' && inReach(p, s, reach + 10, 22, 999)) { s.vx = p.face * 420; s.from = 'player'; snd.fx('clang'); spark(s.x, groundY(s.z) - s.y, '#fff', 6); say(s.x, groundY(s.z) - 80, '¡CLANG!', '#cfe8ff', 20); }
        if (third) { dust(p.x + p.face * 40, p.z, 6); if (n) quake(p, 9);
          if (G.perks.boom) { const c = { x: p.x + p.face * 55, z: p.z }; ring(c.x, c.z, 125, 'rgba(255,200,120,.9)'); hitEnemies(e => inRadius(c, e, 125), 10, { launch: true, juggle: true, ground: true }); }
          if (G.perks.shur) { G.shots.push({ x: p.x + p.face * 40, y: 44, z: p.z, vx: p.face * 470, from: 'player', dmg: 0, life: 3 }); snd.fx('shuriken'); } }
      }
      if (p.st >= p.atkDur) { p.comboT = 0.4; if (p.queue && p.combo < 3) startAttack(p); else { p.state = 'idle'; p.st = 0; } }
      break;
    }
    case 'roll': p.vx = p.face * 340; p.vz = az * 60; p.spin += dt * 17; if (Math.random() < dt * 30) dust(p.x - p.face * 20, p.z, 1);
      hitEnemies(e => inRadius(p, e, 46 * big) && e.y < 40, G.perks.roll ? 24 : 8, { set: p.hitSet, dir: p.face, word: '¡BOING!' });
      if (p.st >= 0.42) { p.state = 'idle'; p.st = 0; p.vx = 0; p.squash = 0.85; } break;
    case 'special': {
      p.spin += dt * 22; const k = Math.floor(p.st / 0.25);
      if (k > p.pulse && k <= 4) { p.pulse = k; const last = k === 4; ring(p.x, p.z, last ? 210 : 150, 'rgba(255,120,140,.9)'); hitEnemies(e => inRadius(p, e, last ? 200 : 150), last ? 22 : 11, { launch: last, juggle: true, noMeter: true, word: last ? '¡FUUUSH!' : null }); G.shake = Math.max(G.shake, last ? 12 : 5); if (last) quake(p, 12); for (const s of G.shots) if (s.from === 'enemy' && inRadius(p, s, 160)) { s.vx = -s.vx * 1.4; s.from = 'player'; } }
      if (Math.random() < dt * 60) { const a = Math.random() * TAU; part({ kind: 'petal', x: p.x + Math.cos(a) * 30, y: groundY(p.z) - 50 + Math.sin(a) * 20, vx: Math.cos(a) * 260, vy: Math.sin(a) * 110 - 40, life: 0.7, size: 5, col: Math.random() < 0.5 ? '#ff8fa0' : '#ffd0d8' }); }
      if (p.st >= 1.15) { p.state = 'idle'; p.st = 0; } break;
    }
    case 'hurt': p.vx *= Math.exp(-6 * dt); if (p.st > 0.32) { p.state = 'idle'; p.st = 0; } break;
    case 'dead': p.vx *= Math.exp(-2 * dt); break;
    case 'win': p.vx = p.vz = 0; if (p.y === 0 && (p.st * 2.4) % 1 < dt * 2.4) { p.vy = 150; p.y = 0.01; p.squash = 1.15; } break;
  }
  const bounds = [G.cam + 26, G.cam + V.w - 26];
  const landed = stepBody(p, dt, bounds);
  if (landed) {
    if (p.state === 'slam') { const r = 92 * big; ring(p.x, p.z, r); dust(p.x, p.z, 14); snd.fx('land'); snd.fx('big'); hitEnemies(e => inRadius(p, e, r) && e.y < 60, 16, { launch: true, ground: true, juggle: true, word: '¡PLANCHAZO!' }); quake(p, 11); p.squash = 0.6; p.state = 'idle'; p.st = 0; }
    else if (p.state === 'jump') { p.state = 'idle'; p.st = 0; p.squash = 0.72; dust(p.x, p.z, 9); snd.fx('land'); G.shake = Math.max(G.shake, 4); }
    else if (p.state === 'dead' || p.state === 'win') { p.squash = 0.8; dust(p.x, p.z, 5); }
  }
  p.sqV += (1 - p.squash) * 260 * dt; p.sqV *= Math.exp(-11 * dt); p.squash = clamp(p.squash + p.sqV * dt, 0.5, 1.4);
  if (free && p.hp > 0 && p.hp < p.maxHp && p.state === 'sit') p.hp = Math.min(p.maxHp, p.hp + dt * 4);
}

// ------------------------------------------------------------------ enemigos
function spawn(kind, i, arena) {
  const T = ENEMY[kind], side = kind === 'boss' ? 1 : (i % 2 ? -1 : 1) * (Math.random() < 0.8 ? 1 : -1);
  const hp0 = T.hp * (G.hpScale || 1) * (G.endless && kind === 'boss' ? 0.5 : 1);
  const e = { id: uid++, kind, hp: hp0, maxHp: hp0, x: arena.x + side * (V.w / 2 + 70), y: 0.01, z: 15 + Math.random() * 90, vx: 0, vy: 0, vz: 0, face: -side, state: 'enter', st: 0, walkPhase: Math.random() * 6, flash: 0, cd: 0.4 + i * 0.5 + Math.random() * 0.5,
    side, zoff: (Math.random() - 0.5) * 70, delay: i * 0.38, engaged: false, spin: 0, struck: false, adds: false, dead: false };
  const landX = arena.x + side * (120 + Math.random() * (V.w / 2 - 190)), vy = TUNE.ninjaJumpV * (kind === 'brute' ? 0.8 : 1), air = (2 * vy) / TUNE.gravity;
  e.vy = vy; e.vx = (landX - e.x) / air;
  if (kind === 'boss') { e.x = arena.x + 170; e.y = 520; e.vy = 0; e.vx = 0; e.z = 60; G.boss = e; }
  G.enemies.push(e);
}
function shoot(e, dz = 0) { G.shots.push({ x: e.x + e.face * 30, y: 44, z: clamp(e.z + dz, 2, 118), vx: e.face * 270, from: 'enemy', dmg: ENEMY[e.kind].dmg * (e.kind === 'boss' ? 0.6 : 1), life: 4 }); snd.fx('shuriken'); }
function updateEnemy(e, dt) {
  if (e.delay > 0) { e.delay -= dt; return; }
  const T = ENEMY[e.kind], p = G.p, boss = e.kind === 'boss';
  e.st += dt; e.flash = Math.max(0, e.flash - dt); e.cd -= dt;
  const dx = p.x - e.x, dz = p.z - e.z, alive = p.state !== 'dead';
  switch (e.state) {
    case 'enter': e.spin += dt * (boss ? 0 : 9) * -e.side; break;
    case 'move': {
      e.face = Math.sign(dx) || 1;
      let tx, tz, want = false;
      if (e.kind === 'thrower') { tx = p.x - e.face * 270; tz = p.z; want = Math.abs(dz) < 9 && e.cd <= 0 && Math.abs(dx) > 150 && e.x > G.cam + 10 && e.x < G.cam + V.w - 10; }
      else {
        if (!e.engaged && e.cd <= 0 && (e.kind === 'bomber' || G.attackers < (boss ? 3 : 2))) { e.engaged = true; G.attackers++; }
        if (e.engaged) { tx = p.x - e.face * T.reach * 0.72; tz = p.z; want = Math.abs(dx) < T.reach * 0.86 && Math.abs(dz) < 11 && p.y < 50; }
        else { tx = p.x + e.side * (150 + (e.id % 3) * 36); tz = clamp(p.z + e.zoff, 4, 116); }
      }
      if (boss && e.cd <= 0 && Math.abs(dx) > 240 && alive) { // el jefe elige: salto o abanico
        e.engaged = false;
        if (Math.random() < 0.55) { e.state = 'leap'; e.st = 0; const vy = TUNE.ninjaJumpV * 1.05, air = (2 * vy) / TUNE.gravity; e.vy = vy; e.y = 0.01; e.vx = (p.x - e.x) / air; e.vz = (p.z - e.z) / air; dust(e.x, e.z, 8); snd.fx('whoosh'); }
        else { e.state = 'fanwind'; e.st = 0; e.vx = e.vz = 0; }
        break;
      }
      if (want && alive) { e.state = 'windup'; e.st = 0; e.vx = e.vz = 0; e.struck = false; break; }
      tx = clamp(tx, G.cam + 44, G.cam + V.w - 44); // nadie se esconde fuera de la pantalla
      const ddx = tx - e.x, ddz = tz - e.z, d = Math.hypot(ddx, ddz);
      if (d > 6) { const sp = T.speed * (e.engaged ? 1.15 : 0.85); e.vx = (ddx / d) * sp; e.vz = (ddz / d) * sp * 0.7; e.walkPhase += dt * 10; } else { e.vx = e.vz = 0; }
      break;
    }
    case 'windup': if (e.st >= T.windup) { if (e.kind === 'bomber') { explode(e); return; } if (e.kind === 'thrower') { shoot(e); e.state = 'recover'; e.st = 0; e.cd = 1.6 + Math.random(); } else { e.state = 'strike'; e.st = 0; e.vx = e.face * (boss ? 260 : 150); snd.fx('whoosh'); } } break;
    case 'fanwind': if (e.st >= 0.6) { for (const o of [-30, 0, 30]) shoot(e, o); e.state = 'recover'; e.st = 0; e.cd = 1.4; } break;
    case 'strike':
      if (!e.struck && e.st >= 0.05) { e.struck = true; if (inReach(e, p, T.reach + 14, 17, 46)) hurtPlayer(T.dmg, e.face); }
      if (e.st >= 0.2) { e.state = 'recover'; e.st = 0; e.vx = 0; } break;
    case 'recover': e.vx *= Math.exp(-8 * dt); if (e.st >= T.recover) { e.state = 'move'; e.st = 0; e.engaged = false; e.cd = (boss ? 0.5 : 0.7) + Math.random() * 1.1; } break;
    case 'hurt': e.vx *= Math.exp(-7 * dt); if (e.st >= (boss ? 0.16 : 0.32)) { e.state = 'move'; e.st = 0; } break;
    case 'fly': e.spin -= dt * 9 * Math.sign(e.vx || 1);
      if (e.y > 0 && e.y < 80) for (const o of G.enemies) if (o !== e && !o.dead && o.delay <= 0 && o.hp > 0 && o.state !== 'fly' && o.state !== 'enter' && o.state !== 'down' && !(e.flyHits ||= new Set()).has(o.id) && Math.abs(o.x - e.x) < 32 && Math.abs(o.z - e.z) < 20) { e.flyHits.add(o.id); damageEnemy(o, 9, Math.sign(e.vx) || 1, { word: '¡STRIKE!' }); }
      if (G.lock && ((e.x < G.cam + 26 && e.vx < 0) || (e.x > G.cam + V.w - 26 && e.vx > 0))) { blood(e.x, e.z, e.y + 40, 16, -Math.sign(e.vx)); G.shake = Math.max(G.shake, 6); say(e.x - Math.sign(e.vx) * 40, groundY(e.z) - e.y - 70, '¡SPLAT!', '#ff8a9a', 24); snd.fx('hit'); e.vx *= -0.55; if (e.hp > 0 && applyDamage(e, 6)) onKill(e); }
      break;
    case 'down': e.vx *= Math.exp(-8 * dt); if (e.st >= 0.7) { e.state = 'rise'; e.st = 0; } break;
    case 'rise': if (e.st >= 0.3) { e.state = 'move'; e.st = 0; e.cd = 0.4; } break;
    case 'leap': break;
  }
  if (boss && !e.adds && e.hp < e.maxHp * 0.5 && e.hp > 0) { e.adds = true; say(e.x, groundY(e.z) - 190, '¡A mí, sombras!', '#d9a8ff', 24); ['grunt', 'grunt', 'thrower'].forEach((k, i) => spawn(k, i, G.lock || LEVEL.arenas.at(-1))); }
  const landed = stepBody(e, dt, e.state === 'enter' ? null : [G.cam + 18, G.cam + V.w - 18]);
  if (landed) {
    if (e.state === 'enter') { e.state = 'move'; e.st = 0; e.vx = 0; e.spin = 0; dust(e.x, e.z, 6); if (boss) { ring(e.x, e.z, 150, 'rgba(190,120,255,.9)'); G.shake = 14; snd.fx('big'); snd.fx('gong'); dust(e.x, e.z, 16); } }
    else if (e.state === 'leap') { e.state = 'recover'; e.st = 0; e.vx = e.vz = 0; e.cd = 1; ring(e.x, e.z, 120, 'rgba(190,120,255,.9)'); dust(e.x, e.z, 14); G.shake = Math.max(G.shake, 10); snd.fx('big'); if (inRadius(e, p, 112) && p.y < 6) hurtPlayer(18, Math.sign(p.x - e.x) || 1); }
    else if (e.state === 'fly') {
      if (e.hp <= 0) {
        if (e.kind === 'bomber') explode(e);
        else { e.dead = true; gibs(e); blood(e.x, e.z, 30, boss ? 70 : 26, 0, 1.25); decal(e.x, groundY(e.z) + 2, boss ? 44 : 22); smoke(e.x, groundY(e.z), boss ? 34 : 5); snd.fx('poof'); if (Math.random() < (e.kind === 'brute' ? 0.9 : 0.28)) G.picks.push({ x: e.x, z: e.z, y: 50, vy: 160, t: 0 }); }
      }
      else { e.state = 'down'; e.st = 0; dust(e.x, e.z, 6); snd.fx('land'); }
    }
  }
}

function nextWave() {
  const n = ++G.waveN, arena = (G.lock = { x: 3000 }), bossW = n % 5 === 0, kinds = bossW ? ['boss'] : [];
  G.hpScale = 1 + n * 0.1;
  const pool = ['grunt', 'grunt', 'thrower']; if (n >= 2) pool.push('bomber'); if (n >= 3) pool.push('brute'); if (n >= 6) pool.push('bomber', 'brute');
  for (let i = Math.min(9, 2 + Math.ceil(n * 0.7)) - (bossW ? 3 : 0); i > 0; i--) kinds.push(pool[(Math.random() * pool.length) | 0]);
  kinds.forEach((k, i) => spawn(k, i, arena)); snd.setMode(bossW ? 'boss' : 'fight'); G.score += n * 50;
  G.banner = { t: 0, name: `Oleada ${n}`, sub: bossW ? '¡Vuelve el Maestro Kurokasa!' : ['Que no decaiga', 'Más madera', 'Huele a mochi quemado', 'Vienen con hambre'][n % 4] };
}
// ------------------------------------------------------------------ actualización
function update(dt) {
  G.t += dt;
  G.fx.wake = Math.max(0, G.fx.wake - dt); G.fx.sunFace = Math.max(0, G.fx.sunFace - dt);
  if (G.toast) { G.toast.t += dt; if (G.toast.t > 4.5) G.toast = null; }
  if (G.mode === 'title') { G.cam += dt * 34; return; }
  if (G.mode === 'win') { G.fireT -= dt; if (G.fireT <= 0) { G.fireT = 0.35 + Math.random() * 0.4; const fx = G.cam + 80 + Math.random() * (V.w - 160), fy = 50 + Math.random() * (V.hor - 160), col = `hsl(${Math.random() * 360},90%,70%)`; for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU, v = 90 + Math.random() * 90; part({ kind: 'fire', x: fx, y: fy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 + Math.random() * 0.5, col, size: 3 }); } snd.fx('pickup'); } }
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  if (G.slow > 0) { G.slow -= dt; dt *= 0.35; }
  const p = G.p;
  G.giantT = Math.max(0, G.giantT - dt); if (G.giantT <= 0) p.rainbow = false;
  G.hitsT -= dt; if (G.hitsT <= 0) G.hits = 0;
  G.multiT -= dt; G.furyT = Math.max(0, G.furyT - dt); G.hurtT = Math.max(0, G.hurtT - dt); G.rankPop = Math.max(0, (G.rankPop || 0) - dt); G.zoom = lerp(G.zoom, 1, 1 - Math.exp(-9 * dt));
  if (G.announce) { G.announce.t += dt; if (G.announce.t > 1.3) G.announce = null; }
  if (G.endless) G.endP = lerp(G.endP, (0.3 + G.waveN * 0.14) % 1, 1 - Math.exp(-0.5 * dt));
  if (G.mode === 'play' || G.mode === 'win') updatePlayer(dt);
  else if (G.mode === 'over') { stepBody(p, dt); }
  G.attackers = 0; for (const e of G.enemies) if (e.engaged || e.state === 'windup' || e.state === 'strike') G.attackers++;
  for (const e of G.enemies) updateEnemy(e, dt);
  G.enemies = G.enemies.filter(e => !e.dead);
  for (const s of G.shots) {
    s.x += s.vx * dt; s.life -= dt;
    if (s.from === 'enemy') { if (Math.abs(s.x - p.x) < 24 * p.big && Math.abs(s.z - p.z) < 14 && p.y < 34 && p.state !== 'roll' && p.state !== 'special') { if (hurtPlayer(s.dmg, Math.sign(s.vx))) s.life = 0; } }
    else for (const e of G.enemies) if (!e.dead && e.delay <= 0 && e.state !== 'fly' && e.state !== 'down' && Math.abs(s.x - e.x) < 24 && Math.abs(s.z - e.z) < 18) { damageEnemy(e, 14, Math.sign(s.vx), { word: '¡TOMA!' }); s.life = 0; break; }
  }
  G.shots = G.shots.filter(s => s.life > 0);
  for (const k of G.picks) { k.t += dt; if (k.y > 0) { k.vy -= 700 * dt; k.y += k.vy * dt; if (k.y <= 0) { k.y = 0; k.vy = 0; } } if (!k.got && k.y < 30 && Math.abs(k.x - p.x) < 36 && Math.abs(k.z - p.z) < 24 && p.state !== 'dead') { k.got = true; p.hp = Math.min(p.maxHp, p.hp + 14); p.meter = Math.min(p.maxHp, p.meter + 10); snd.fx('pickup'); say(k.x, groundY(k.z) - 60, '¡Ñam!', '#c8f0a0', 20); spark(k.x, groundY(k.z) - 20, '#fff', 5); } }
  G.picks = G.picks.filter(k => !k.got && k.t < 25);
  for (const l of G.logs) { l.t += dt; if (l.y > 0) { l.vy -= 800 * dt; l.y = Math.max(0, l.y + l.vy * dt); } }
  G.logs = G.logs.filter(l => l.t < 2.4);
  // director de oleadas
  if (G.mode === 'play' && p.state !== 'dead' && G.endless) {
    if (G.enemies.length === 0) { G.waveT += dt; if (G.waveT > 1.1) { G.waveT = 0; if (G.waveN > 0 && G.waveN % 2 === 0 && G.offered !== G.waveN) { G.offered = G.waveN; offer(); } else nextWave(); } }
  } else if (G.mode === 'play' && p.state !== 'dead') {
    const alive = G.enemies.length;
    if (alive === 0 && G.dir.locked) G.waveT += dt; else G.waveT = 0;
    if (!G.dir.locked || G.waveT > 0.9) {
      const ev = G.dir.update(p.x, alive);
      if (ev) { G.waveT = 0;
        if (ev.type === 'spawn') { G.lock = ev.arena; ev.kinds.forEach((k, i) => spawn(k, i, ev.arena)); if (ev.kinds[0] === 'boss') { snd.setMode('boss'); G.banner = { t: 0, name: 'Maestro Kurokasa', sub: 'La sombra del sombrero de paja' }; } else snd.setMode('fight'); }
        else { G.lock = null; if (!ev.done) { snd.setMode('calm'); G.goT = 4; offer(); } }
      }
    }
    const ai = G.endless ? -1 : LEVEL.acts.findLastIndex(a => p.x > a.x); if (ai > G.act) { G.act = ai; G.banner = { t: 0, name: LEVEL.acts[ai].name, sub: LEVEL.acts[ai].sub }; }
  }
  if (G.goT > 0) G.goT -= dt;
  if (G.winT > 0) { G.winT -= dt; if (G.winT <= 0 && G.mode === 'play') { G.mode = 'win'; saveBest(); snd.setMode('calm'); snd.fx('secret'); } }
  if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) { G.mode = 'over'; saveBest(); } }
  if (G.banner) { G.banner.t += dt; if (G.banner.t > 3.6) G.banner = null; }
  // cámara
  const target = clamp(G.lock ? G.lock.x - V.w / 2 : p.x - V.w / 2 + p.face * 46, 0, LEVEL.length - V.w);
  G.cam = lerp(G.cam, target, 1 - Math.exp(-(G.lock ? 2.2 : 4) * dt));
  for (const q of G.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind === 'blood' || q.kind === 'gib') { q.vy += 900 * dt; if (q.y >= q.gy && q.vy > 0) { if (q.kind === 'blood') { decal(q.x, q.gy, q.size * 1.7); q.t = q.life; } else { if (q.vy > 120) decal(q.x, q.gy, q.size * 1.2); q.y = q.gy; q.vy *= -0.42; q.vx *= 0.55; } } } if (q.kind === 'spark' || q.kind === 'fire') { q.vx *= Math.exp(-3 * dt); q.vy = q.vy * Math.exp(-3 * dt) + (q.kind === 'fire' ? 40 * dt : 0); } if (q.kind === 'petal') q.vy += 160 * dt; }
  G.parts = G.parts.filter(q => q.t < q.life);
  for (const s of G.texts) { s.t += dt; s.y -= 34 * dt; }
  G.texts = G.texts.filter(s => s.t < 0.9);
  G.shake = Math.max(0, G.shake - dt * 30);
}

// ------------------------------------------------------------------ dibujo
function shadow(x, z, y, r) { const k = clamp(1 - y / 260, 0.3, 1); g.fillStyle = `rgba(20,12,50,${0.3 * k})`; ell(g, x - G.cam, groundY(z) + 1, r * k, r * 0.26 * k); g.fill(); }
function drawActors() {
  const p = G.p, t = G.t, list = [];
  g.fillStyle = G.pal.night > 0.5 ? 'rgba(74,8,44,.78)' : 'rgba(156,12,32,.74)';
  for (const d of G.decals) { const x = d.x - G.cam; if (x < -50 || x > V.w + 50) continue; ell(g, x, d.y, d.r * d.rx, d.r * 0.4, d.rot); g.fill(); }
  spiritSpots(G.cam, V, (x, i) => list.push({ z: -3, f: () => { g.save(); g.translate(x, V.hor + 30); g.scale(0.9, 0.9); drawSpirit(g, t + i, G.pal.night); g.restore(); } }));
  for (const l of G.logs) list.push({ z: l.z - 0.1, f: () => { g.save(); g.globalAlpha = clamp(2.4 - l.t, 0, 1); g.translate(l.x - G.cam, groundY(l.z) - l.y); g.scale(l.s, l.s); g.rotate(l.y > 0 ? l.t * 5 : 1.5); drawLog(g); g.restore(); } });
  for (const k of G.picks) list.push({ z: k.z, f: () => { shadow(k.x, k.z, k.y, 10); g.save(); g.globalAlpha = k.t > 21 ? 0.5 + 0.5 * Math.sin(k.t * 20) : 1; g.translate(k.x - G.cam, groundY(k.z) - k.y - (k.y > 0 ? 0 : Math.abs(Math.sin(k.t * 3)) * 5)); g.rotate(k.y > 0 ? k.t * 6 : 0.25); drawDango(g, t); g.restore(); } });
  for (const e of G.enemies) if (e.delay <= 0) list.push({ z: e.z, f: () => { const s = depthS(e.z); shadow(e.x, e.z, e.y, 26 * ninjaScale(e.kind)); g.save(); g.translate(e.x - G.cam, groundY(e.z) - e.y); g.scale(s * e.face, s); drawNinja(g, e, t); g.restore(); } });
  for (const s of G.shots) list.push({ z: s.z, f: () => { shadow(s.x, s.z, 40, 9); g.save(); g.translate(s.x - G.cam, groundY(s.z) - s.y); drawShuriken(g, s, t); g.restore(); } });
  if (G.mode !== 'title') list.push({ z: p.z + 0.05, f: () => {
    const s = depthS(p.z) * p.big; shadow(p.x, p.z, p.y, 44 * p.big);
    if (p.state === 'sit') { g.save(); g.translate(p.x - G.cam - p.face * 62, groundY(p.z) + 2); drawSpirit(g, t, G.pal.night); g.restore(); }
    if (p.state === 'special') { g.save(); g.translate(p.x - G.cam, groundY(p.z) - 44 * s); g.strokeStyle = 'rgba(232,64,79,.85)'; g.lineWidth = 7; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const r = 60 + i * 34 + Math.sin(t * 9 + i) * 8, a0 = p.spin * (1 + i * 0.25) + i * 2; g.beginPath(); g.ellipse(0, i * 8, r, r * 0.3, 0, a0, a0 + 2.6); g.stroke(); } g.restore(); }
    if (p.inv > 0 && p.state !== 'hurt' && p.state !== 'dead' && Math.sin(t * 50) > 0.3) return;
    g.save(); g.translate(p.x - G.cam, groundY(p.z) - p.y); g.scale(s * p.face, s); if (p.state === 'dead' && p.y === 0) { g.rotate(-1.45); g.translate(-36, 34); } drawMochi(g, p, t); g.restore();
  } });
  list.sort((a, b) => a.z - b.z); for (const o of list) o.f();
  for (const q of G.parts) {
    const u = q.t / q.life, x = q.x - G.cam, y = q.y;
    if (q.kind === 'dust' || q.kind === 'smoke') { g.globalAlpha = (1 - u) * 0.8; g.fillStyle = q.col; ell(g, x, y, q.size * (0.5 + u), q.size * (0.5 + u) * (q.kind === 'dust' ? 0.7 : 1)); g.fill(); }
    else if (q.kind === 'spark') { g.globalAlpha = 1 - u; g.strokeStyle = q.col; g.lineWidth = q.size; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - q.vx * 0.04, y - q.vy * 0.04); g.stroke(); }
    else if (q.kind === 'ring') { g.globalAlpha = 1 - u; g.strokeStyle = q.col; g.lineWidth = 6 * (1 - u) + 1; g.beginPath(); g.ellipse(x, y, q.size * (0.2 + 0.8 * u), q.size * 0.3 * (0.2 + 0.8 * u), 0, 0, TAU); g.stroke(); }
    else if (q.kind === 'flash') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u; g.fillStyle = '#fff6d0'; g.translate(x, y); g.rotate(q.x); g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? q.size * 0.3 : q.size; g.lineTo(Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r); } g.fill(); g.restore(); }
    else if (q.kind === 'blood') { g.fillStyle = '#b3102a'; ell(g, x, y, q.size * 1.5, q.size * 0.7, Math.atan2(q.vy, q.vx)); g.fill(); }
    else if (q.kind === 'gib') { g.globalAlpha = Math.min(1, (q.life - q.t) * 2); g.save(); g.translate(x, y - q.size * 0.5); g.rotate(q.y < q.gy ? q.t * 12 : 0.4); g.fillStyle = q.col; g.fillRect(-q.size, -q.size * 0.6, q.size * 2, q.size * 1.2); g.fillStyle = '#8a0f24'; g.fillRect(-q.size, -q.size * 0.6, q.size * 0.6, q.size * 1.2); g.restore(); }
    else if (q.kind === 'petal') { g.globalAlpha = 1 - u; g.fillStyle = q.col; ell(g, x, y, q.size, q.size * 0.5, q.t * 9); g.fill(); }
    else if (q.kind === 'fire') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u; g.fillStyle = q.col; ell(g, x, y, q.size, q.size); g.fill(); g.restore(); }
    g.globalAlpha = 1;
  }
}
function ink(txt, x, y, size, col = '#fff7e6', align = 'center', style = 'bold') {
  g.font = `${style} ${size}px ${FONT}`; g.textAlign = align; g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.16); g.strokeStyle = 'rgba(40,22,52,.85)'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y);
}
function drawTexts() { for (const s of G.texts) { const u = s.t / 0.9, k = u < 0.15 ? 0.5 + u / 0.15 * 0.7 : 1.2 - Math.min(0.2, (u - 0.15) * 2); g.save(); g.translate(s.x - G.cam, s.y); g.rotate(s.rot); g.scale(k, k); g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; ink(s.txt, 0, 0, s.size, s.col, 'center', 'italic bold'); g.restore(); } }
function bar(x, y, w, h, f, c1, c2) {
  g.fillStyle = 'rgba(40,22,52,.75)'; g.beginPath(); g.roundRect(x - 3, y - 3, w + 6, h + 6, h / 2 + 3); g.fill();
  g.fillStyle = 'rgba(255,247,230,.22)'; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  if (f > 0.01) { const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, Math.max(h, w * f), h, h / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(x + 4, y + 2, Math.max(2, w * f - 8), h * 0.3, h * 0.15); g.fill(); }
}
const PORTRAIT = { state: 'idle', st: 0, walkPhase: 0, squash: 1, vx: 0, vy: 0, y: 0, face: 1, flash: 0, blush: 0, combo: 0, atkDur: 1 };
function drawHUD() {
  const p = G.p, t = G.t, w = V.w;
  g.save(); g.fillStyle = 'rgba(40,22,52,.75)'; ell(g, 44, 44, 31, 31); g.fill(); g.fillStyle = G.pal.skyMid; ell(g, 44, 44, 27, 27); g.fill(); g.save(); g.clip(); g.translate(40, 82); g.scale(0.62, 0.62); PORTRAIT.rainbow = p.rainbow; PORTRAIT.state = p.hp < 30 ? 'hurt' : 'idle'; drawMochi(g, PORTRAIT, t); g.restore(); g.restore();
  bar(84, 26, Math.min(320, 1.9 * p.maxHp), 15, p.hp / p.maxHp, p.hp < 30 ? '#ff6a6a' : '#ff9aa8', p.hp < 30 ? '#ffb07a' : '#ffd27a');
  const full = p.meter >= 100; bar(84, 50, 130, 9, p.meter / 100, full ? `hsl(${(t * 300) % 360},90%,70%)` : '#8fd0ff', full ? '#fff' : '#c8a8ff');
  if (full) ink(G.touch ? '✿ ¡LISTO!' : 'ESPACIO: ¡Tifón de Cinta!', 224, 60, 13, '#fff', 'left');
  ink(String(G.score).padStart(6, '0'), w / 2, 36, 22);
  ink(G.muted ? '♪̸' : '♪', w - 30, 36, 22, G.muted ? '#ff9aa8' : '#fff7e6');
  if (G.hits > 1) {
    const ri = rankIdx(G.hits), k = 1 + Math.max(0, G.hitsT - 2.4) * 2.5, RC = ['', '#cfe8ff', '#a8f0a0', '#ffe27a', '#ffa04a', '#ff5a6a', `hsl(${(t * 400) % 360},95%,70%)`];
    g.save(); g.translate(w - 70, 96); g.scale(k, k); g.rotate(-0.08); ink(String(G.hits), 0, 0, 44, '#ffe27a', 'right', 'italic bold'); ink('golpes', 6, 0, 16, '#fff7e6', 'left', 'italic'); g.restore();
    g.fillStyle = 'rgba(40,22,52,.6)'; g.fillRect(w - 152, 106, 134, 5); g.fillStyle = '#ffe27a'; g.fillRect(w - 152, 106, 134 * clamp(G.hitsT / 2.6, 0, 1), 5);
    if (ri) { const k2 = 1 + G.rankPop * 1.6; g.save(); g.translate(w - 70, 152); g.scale(k2, k2); g.rotate(-0.08); ink(RANKS[ri][1], 0, 0, ri >= 6 ? 30 : 42, RC[ri], 'right', 'italic bold'); ink('x' + rankMult(G.hits), 6, 0, 17, '#fff7e6', 'left', 'italic bold'); g.restore(); }
  }
  const pk = Object.keys(G.perks); if (pk.length) ink(pk.map(k => PERKS[k][0] + (G.perks[k] > 1 ? ' x' + G.perks[k] : '')).join(' · '), 16, 84, 11, '#ffe9b0', 'left', 'italic');
  if (G.endless) ink(`Oleada ${G.waveN}`, w / 2, 58, 14, '#ffd9a0', 'center', 'italic');
  if (G.furyT > 0) ink(`FURIA ${G.furyT.toFixed(1)}`, w / 2, G.endless ? 76 : 60, 15, '#ff6a7a');
  if (G.announce) { const a = G.announce, u = a.t / 1.3, k = u < 0.12 ? 0.4 + (u / 0.12) * 0.8 : 1.2 - Math.min(0.2, (u - 0.12) * 1.5); g.save(); g.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1; g.translate(w / 2, V.h * 0.24); g.scale(k, k); g.rotate(-0.04); ink(a.txt, 0, 0, 58, a.col, 'center', 'italic bold'); g.restore(); }
  if (G.giantT > 0) ink(`MOCHI GIGANTE ${Math.ceil(G.giantT)}`, w / 2, 94, 15, `hsl(${(t * 300) % 360},90%,75%)`);
  if (G.boss && !G.boss.dead && G.boss.delay <= 0 && G.mode === 'play') { ink('Maestro Kurokasa', w / 2, V.h - 34, 16, '#e2c8ff'); bar(w / 2 - 170, V.h - 26, 340, 10, G.boss.hp / G.boss.maxHp, '#8a4af0', '#ff7ad0'); }
  if (G.goT > 0 && !G.lock && Math.sin(t * 9) > -0.2) { g.save(); g.translate(w - 110 + Math.sin(t * 6) * 8, V.h * 0.42); ink('¡Vamos! →', 0, 0, 32, '#ffe27a', 'center', 'italic bold'); g.restore(); }
  if (G.banner) { const b = G.banner, a = clamp(Math.min(b.t / 0.5, (3.6 - b.t) / 0.6), 0, 1), y = V.h * 0.3; g.save(); g.globalAlpha = a; const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(30,16,44,0)'); gr.addColorStop(0.5, 'rgba(30,16,44,.6)'); gr.addColorStop(1, 'rgba(30,16,44,0)'); g.fillStyle = gr; g.fillRect(0, y - 46, w, 84); ink(b.name, w / 2 - (1 - a) * 40, y, 40, '#fff7e6', 'center', 'italic bold'); ink(b.sub, w / 2 + (1 - a) * 40, y + 28, 18, '#ffd9a0', 'center', 'italic'); g.restore(); }
  if (G.touch && G.mode === 'play') {
    g.lineWidth = 2.5;
    for (const b of BTN()) { const on = held[b.n], dim = b.n === 'spec' && p.meter < 100; g.globalAlpha = dim ? 0.3 : 0.75; g.fillStyle = on ? 'rgba(255,220,160,.6)' : 'rgba(40,22,52,.4)'; g.strokeStyle = '#fff7e6'; ell(g, b.x, b.y, b.r, b.r); g.fill(); g.stroke(); ink(b.l, b.x, b.y + 5, b.l.length > 2 ? 12 : 26); }
    g.globalAlpha = 0.6; if (stick) { g.strokeStyle = '#fff7e6'; ell(g, stick.ox, stick.oy, 46, 46); g.stroke(); const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.max(1, Math.hypot(dx, dy)), k = Math.min(46, d) / d; g.fillStyle = 'rgba(255,247,230,.7)'; ell(g, stick.ox + dx * k, stick.oy + dy * k, 20, 20); g.fill(); }
    else { g.globalAlpha = 0.25; g.strokeStyle = '#fff7e6'; ell(g, 96, V.h - 90, 46, 46); g.stroke(); }
    g.globalAlpha = 1;
  }
}
function drawToast() {
  if (!G.toast) return; const o = G.toast, a = clamp(Math.min(o.t / 0.3, (4.5 - o.t) / 0.5), 0, 1), y = 96 - (1 - a) * 30;
  g.save(); g.globalAlpha = a; g.font = `italic bold 18px ${FONT}`; const tw = Math.max(240, g.measureText(o.txt).width + 50);
  g.fillStyle = 'rgba(40,22,52,.85)'; g.beginPath(); g.roundRect(V.w / 2 - tw / 2, y - 24, tw, 54, 27); g.fill(); g.strokeStyle = '#ffd27a'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#ffe9b0'; g.fillText(o.txt, V.w / 2, y); g.font = `italic 13px ${FONT}`; g.fillStyle = '#e8d8ff'; g.fillText(o.sub, V.w / 2, y + 19); g.restore();
}
function edge(rgb, a) { if (a <= 0.01) return; const gr = g.createRadialGradient(V.w / 2, V.h / 2, V.h * 0.3, V.w / 2, V.h / 2, Math.max(V.w, V.h) * 0.7); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${a})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
function drawChoice() {
  const c = G.choice; veil(0.62); ink('Elige tu mejora', V.w / 2, V.h * 0.3 - 28, 34, '#fffdf0', 'center', 'italic bold');
  c.opts.forEach((k, i) => { const r = cardRect(i), on = i === c.sel, lift = on ? -8 : 0;
    g.fillStyle = on ? 'rgba(74,36,84,.96)' : 'rgba(40,22,52,.9)'; g.beginPath(); g.roundRect(r.x, r.y + lift, r.w, r.h, 16); g.fill(); g.strokeStyle = on ? '#ffd27a' : 'rgba(255,247,230,.35)'; g.lineWidth = on ? 3.5 : 1.5; g.stroke();
    ink(String(i + 1), r.x + 22, r.y + lift + 34, 22, on ? '#ffd27a' : '#bfa8d8'); ink(PERKS[k][0], r.x + r.w / 2, r.y + lift + 76, 21, '#ffe9b0', 'center', 'italic bold');
    g.font = `15px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#fff7e6'; const words = PERKS[k][1].split(' '); let line = '', y = r.y + lift + 108;
    for (const wd of words) { if (g.measureText(line + wd).width > r.w - 28) { g.fillText(line, r.x + r.w / 2, y); y += 20; line = ''; } line += wd + ' '; } g.fillText(line, r.x + r.w / 2, y);
    if (G.perks[k]) ink('ya tienes x' + G.perks[k], r.x + r.w / 2, r.y + lift + r.h - 14, 12, '#c8a8ff', 'center', 'italic'); });
  ink(G.touch ? 'Toca una carta' : '← → y Z / ENTER, o pulsa 1 · 2 · 3', V.w / 2, V.h * 0.3 + 216, 15, '#e8d8ff', 'center', 'italic');
}
function veil(a) { g.fillStyle = `rgba(22,10,40,${a})`; g.fillRect(0, 0, V.w, V.h); }
function drawTitle() {
  const t = G.t, w = V.w, cy = V.h * 0.36;
  g.save(); g.translate(w / 2, cy + Math.sin(t * 1.4) * 5);
  g.font = `italic bold 96px ${FONT}`; g.textAlign = 'center'; g.lineJoin = 'round';
  g.lineWidth = 20; g.strokeStyle = 'rgba(40,22,52,.9)'; g.strokeText('Mochi Fable', 0, 0);
  g.lineWidth = 8; g.strokeStyle = '#e8404f'; g.strokeText('Mochi Fable', 0, 0);
  const gr = g.createLinearGradient(0, -80, 0, 10); gr.addColorStop(0, '#fffdf0'); gr.addColorStop(1, '#ffd9a0'); g.fillStyle = gr; g.fillText('Mochi Fable', 0, 0);
  ink('La fábula del ninja redondo que casi no salta', 0, 40, 21, '#fff7e6', 'center', 'italic');
  g.restore();
  g.save(); g.translate(w / 2, V.h - 150 + 60); const s = 1.2; g.scale(s, s); PORTRAIT.state = 'walk'; PORTRAIT.walkPhase = t * 9; PORTRAIT.vx = 150; PORTRAIT.rainbow = false; g.fillStyle = 'rgba(20,12,50,.3)'; ell(g, 0, 1, 44, 11); g.fill(); drawMochi(g, PORTRAIT, t); PORTRAIT.vx = 0; g.restore();
  const eb = endlessBtn(), b = best.get();
  g.fillStyle = 'rgba(40,22,52,.8)'; g.beginPath(); g.roundRect(eb.x - 254, eb.y, 230, eb.h, 20); g.fill(); g.strokeStyle = '#ffd27a'; g.lineWidth = 2 + Math.sin(t * 4); g.stroke();
  g.fillStyle = 'rgba(90,16,40,.85)'; g.beginPath(); g.roundRect(eb.x, eb.y, eb.w, eb.h, 20); g.fill(); g.strokeStyle = '#ff6a7a'; g.lineWidth = 2; g.stroke();
  ink(G.touch ? 'Historia' : 'ENTER · Historia', eb.x - 139, eb.y + 27, 19, '#ffe9b0'); ink(G.touch ? 'Reto sin fin' : 'R · Reto sin fin', eb.x + eb.w / 2, eb.y + 27, 19, '#ffd0d8');
  if (b.story || b.endless) ink(`Récord historia ${b.story || 0}   ·   sin fin ${b.endless || 0} (oleada ${b.wave || 0})   ·   mejor combo ${b.combo || 0}`, w / 2, eb.y + 66, 13, '#ffd9a0', 'center', 'italic');
  ink('← ↑ ↓ → mover   ·   Z golpe   ·   X saltito   ·   C rodar   ·   ESPACIO especial   ·   N sonido', w / 2, V.h - 18, 13, '#fff7e6', 'center', 'normal');
  ink(`✿ ${G.eggs.size}/${Object.keys(EGGS).length} secretos`, w - 16, V.h - 18, 13, '#ffd9a0', 'right', 'italic');
}
function frameDraw(dt) {
  const t = G.t, progress = G.mode === 'title' ? 0.5 - 0.5 * Math.cos(t * 0.09) : G.endless ? G.endP : clamp(G.cam / 4500, 0, 1);
  const pal = (G.pal = paletteAt(progress)); setLight(pal);
  g.setTransform(V.scale, 0, 0, V.scale, 0, 0);
  const sh = G.shake; g.save(); if (sh > 0.2) g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh * 0.7);
  if (G.zoom > 1.002) { g.translate(V.w / 2, V.h * 0.66); g.scale(G.zoom, G.zoom); g.translate(-V.w / 2, -V.h * 0.66); }
  G.cel = drawBack(g, V, G.cam, t, pal, G.fx);
  drawActors(); drawTexts();
  drawFront(g, V, G.cam, G.cam - G.pcam, t, dt, pal, G.cel); G.pcam = G.cam;
  g.restore();
  if (G.mode === 'title') drawTitle();
  else {
    if (G.mode === 'play') { if (G.furyT > 0) edge('255,20,50', 0.3 + 0.1 * Math.sin(t * 12)); edge('200,0,30', G.hurtT * 1.1); if (G.p.hp > 0 && G.p.hp < G.p.maxHp * 0.3) edge('160,0,20', 0.25 + 0.2 * Math.sin(t * 6)); }
    drawHUD();
    if (G.mode === 'over') { veil(0.55); ink('Mochi necesita una siesta…', V.w / 2, V.h * 0.42, 44, '#fff7e6', 'center', 'italic bold'); ink(G.endless ? `Oleada ${G.waveN}   ·   ${G.score} puntos   ·   ${G.kills} bajas   ·   combo ${G.maxHits}` : `${G.score} puntos   ·   ${G.kills} bajas   ·   combo ${G.maxHits}`, V.w / 2, V.h * 0.42 + 40, 19); if (G.newBest) ink('¡NUEVO RÉCORD!', V.w / 2, V.h * 0.42 + 70, 22, `hsl(${(t * 300) % 360},95%,72%)`); ink(G.touch ? 'Toca para volver a intentarlo' : G.endless ? 'ENTER para otra ronda' : 'ENTER para reintentar desde aquí  ·  R reto sin fin', V.w / 2, V.h * 0.42 + 102, 18, '#ffd9a0', 'center', 'italic'); }
    if (G.mode === 'win') { veil(0.25); ink('Fin', V.w / 2, V.h * 0.3, 80, '#fffdf0', 'center', 'italic bold'); ink('…y Mochi por fin pudo merendar en paz.', V.w / 2, V.h * 0.3 + 44, 22, '#ffe9b0', 'center', 'italic'); ink(`Puntos: ${G.score}${G.newBest ? ' ¡récord!' : ''}   ·   Bajas: ${G.kills}   ·   Combo: ${G.maxHits}   ·   Secretos: ${G.eggs.size}/${Object.keys(EGGS).length}`, V.w / 2, V.h * 0.3 + 80, 18); { const r = endlessBtn(); g.fillStyle = 'rgba(90,16,40,.85)'; g.beginPath(); g.roundRect(r.x - r.w / 2 - 12, r.y + 60, r.w, r.h, 20); g.fill(); ink(G.touch ? 'Reto sin fin' : 'R · Reto sin fin', V.w / 2, r.y + 87, 19, '#ffd0d8'); } if (G.eggs.size < 8) ink('Pista: prueba un código clásico, teclea su nombre, toca el cielo… o no hagas nada.', V.w / 2, V.h * 0.3 + 106, 14, '#e8d8ff', 'center', 'italic'); }
    if (G.choice) drawChoice();
    if (G.paused) { veil(0.6); ink('Pausa', V.w / 2, V.h * 0.36, 60, '#fffdf0', 'center', 'italic bold'); ['← ↑ ↓ → / WASD  mover por el camino', 'Z / J  golpe (x3 = barrigazo)   ·   X / K  saltito (+ golpe = planchazo)', 'C / L  rodar (esquiva y atropella)   ·   ESPACIO  Tifón de Cinta', 'Golpea los shuriken para devolverlos   ·   N  sonido   ·   P  seguir'].forEach((s, i) => ink(s, V.w / 2, V.h * 0.36 + 50 + i * 26, 16, '#fff7e6', 'center', 'normal')); }
  }
  drawToast();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (G.choice) { const c = G.choice; c.t += dt; if (pressed.L) c.sel = Math.max(0, c.sel - 1); if (pressed.R) c.sel = Math.min(c.opts.length - 1, c.sel + 1); if ((pressed.atk || pressed.jump || pressed.spec) && c.t > 0.35) pick(c.sel); }
  else if (!G.paused) update(dt);
  frameDraw(G.paused || G.choice ? 0 : dt);
  for (const k in pressed) pressed[k] = false;
  requestAnimationFrame(loop);
}
if (new URLSearchParams(location.search).has('debug')) window.__mochi = { G, V, reset, secret, held, pressed, update, snd, pick, offer };
requestAnimationFrame(loop);
