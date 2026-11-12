// main.js: bucle de juego, entrada, combate, IA, HUD y secretos.
import { TAU, clamp, lerp, ell, TUNE, LANE, stepBody, inReach, inRadius, applyDamage, nextCombo, ENEMY, LEVEL, Director, CODES, SecretCodes, paletteAt } from './core.js';
import { Sound } from './audio.js';
import { drawBack, drawFront, spiritSpots } from './world.js';
import { setLight, drawMochi, drawNinja, drawShuriken, drawDango, drawLog, drawSpirit, ninjaScale } from './actors.js';

const cv = document.getElementById('game'), g = cv.getContext('2d');
const V = { w: 960, h: 540, hor: 365, scale: 1 };
const snd = new Sound(), codes = new SecretCodes(CODES);
const FONT = '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';
const EGGS = { konami: 'Mochi Gigante', mochi: 'Lluvia de dango', fable: 'Modo tinta', moon: 'El conejo de la luna', sun: 'El sol dormilón', picnic: 'La merienda', neko: 'El gato-montaña despierta', bow: '¡El lazo no se toca!' };
const store = { get() { try { return JSON.parse(localStorage.getItem('mochi-fable-eggs') || '[]'); } catch { return []; } }, set(v) { try { localStorage.setItem('mochi-fable-eggs', JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };

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
  return { x, y: 0, z: 62, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, meter: 0, state: 'idle', st: 0, walkPhase: 0, squash: 1, sqV: 0, combo: 0, comboT: 0, atkDur: 0.26, hitDone: false, queue: false,
    inv: 0, rollCd: 0, flash: 0, blush: 0, spin: 0, idleT: 0, big: 1, rainbow: false, hitSet: new Set(), pulse: 0 };
}
function reset(arenaIdx = 0) {
  const startX = arenaIdx ? LEVEL.arenas[arenaIdx].x - 520 : 140;
  Object.assign(G, { mode: 'play', p: newPlayer(startX), enemies: [], shots: [], picks: [], parts: [], texts: [], logs: [], dir: new Director(LEVEL, arenaIdx), waveT: 0, lock: null,
    score: arenaIdx ? G.score || 0 : 0, hits: 0, hitsT: 0, giantT: 0, banner: null, act: -1, winT: 0, overT: 0, boss: null, slow: 0, fireT: 0, paused: false });
  G.cam = clamp(startX - V.w / 2, 0, LEVEL.length - V.w); G.pcam = G.cam; G.fx.wake = 0;
  snd.setMode('calm');
}
G.p = newPlayer(300); G.enemies = []; G.shots = []; G.picks = []; G.parts = []; G.texts = []; G.logs = []; G.score = 0;

// ------------------------------------------------------------------ entrada
const KEYMAP = { arrowleft: 'L', a: 'L', arrowright: 'R', d: 'R', arrowup: 'U', w: 'U', arrowdown: 'D', s: 'D', z: 'atk', j: 'atk', x: 'jump', k: 'jump', c: 'roll', l: 'roll', shift: 'roll', ' ': 'spec', v: 'spec' };
const held = {}, pressed = {};
function begin() { snd.start(); if (G.mode === 'title') reset(0); else if (G.mode === 'over') reset(Math.min(G.dir.i, LEVEL.arenas.length - 1)); else if (G.mode === 'win') { G.mode = 'title'; G.cam = 0; snd.setMode('calm'); } }
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  snd.start();
  if (!e.repeat) { const code = codes.feed(key); if (code) secret(code); }
  if (key === 'Enter') { begin(); return; }
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
  if (G.mode !== 'play') { begin(); return; }
  const p = G.p, px = p.x - G.cam, py = groundY(p.z) - p.y - 88 * depthS(p.z) * p.big;
  if (Math.hypot(pt.x - px, pt.y - py) < 30) { p.blush = 1.6; secret('bow'); say(p.x, py - 20, '¡Eh, el lazo!', '#ffd0d8', 18); return; }
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
  if (name === 'sun') { G.fx.sunFace = 4; p.hp = Math.min(100, p.hp + 30); snd.fx('yawn'); }
  if (name === 'neko') G.fx.wake = 6;
  snd.fx('secret');
  G.toast = { t: 0, txt: `✿ Secreto${fresh ? '' : ' (otra vez)'}: ${EGGS[name]}`, sub: `${G.eggs.size} de ${Object.keys(EGGS).length} encontrados` };
}

// ------------------------------------------------------------------ partículas y textos
function part(o) { if (G.parts.length < 400) G.parts.push(Object.assign({ t: 0, life: 0.5, vx: 0, vy: 0, size: 6, kind: 'dust', col: '#fff' }, o)); }
function dust(x, z, n = 6, col = 'rgba(255,244,214,.8)') { for (let i = 0; i < n; i++) part({ x: x + (Math.random() - 0.5) * 30, y: groundY(z) - 3, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 50, size: 5 + Math.random() * 8, life: 0.4 + Math.random() * 0.3, col }); }
function spark(x, y, col, n = 7, screen = false) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 120 + Math.random() * 220; part({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.22 + Math.random() * 0.15, col, size: 3, screen }); } }
function ring(x, z, r, col = 'rgba(255,250,220,.9)') { part({ kind: 'ring', x, y: groundY(z), size: r, life: 0.45, col }); }
function smoke(x, y, n = 12) { for (let i = 0; i < n; i++) part({ kind: 'smoke', x: x + (Math.random() - 0.5) * 34, y: y - Math.random() * 70, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, size: 12 + Math.random() * 16, life: 0.6 + Math.random() * 0.4, col: 'rgba(225,215,240,.85)' }); }
function say(x, y, txt, col = '#fff', size = 22) { G.texts.push({ x, y, txt, col, size, t: 0, rot: (Math.random() - 0.5) * 0.3 }); }
const WORDS = ['¡PAF!', '¡POM!', '¡ZAS!', '¡TOC!', '¡PUM!'];

// ------------------------------------------------------------------ jugador
function quake(p, power) { G.shake = Math.max(G.shake, power); if (!G.eggs.has('neko') || G.fx.wake <= 0) { if (power >= 9) { if (!G.eggs.has('neko')) secret('neko'); else G.fx.wake = 5; } } }
function hitEnemies(test, dmg, o = {}) {
  let n = 0;
  for (const e of G.enemies) {
    if (e.delay > 0 || e.dead || e.state === 'down' || e.state === 'enter' || (e.state === 'fly' && !o.juggle)) continue;
    if (o.set) { if (o.set.has(e.id)) continue; }
    if (!test(e)) continue;
    if (o.set) o.set.add(e.id);
    damageEnemy(e, dmg, o.dir || Math.sign(e.x - G.p.x) || 1, o); n++;
  }
  return n;
}
function damageEnemy(e, dmg, dir, o = {}) {
  const T = ENEMY[e.kind], p = G.p, big = G.giantT > 0 ? 1.5 : 1;
  const dead = applyDamage(e, dmg * big);
  e.flash = 0.1; e.engaged = false;
  G.hitstop = Math.max(G.hitstop, o.launch ? 0.09 : 0.05); G.shake = Math.max(G.shake, o.launch ? 7 : 3);
  const hy = groundY(e.z) - e.y - 60;
  spark(e.x, hy, '#fff3c0', o.launch ? 10 : 6); part({ kind: 'flash', x: e.x, y: hy, size: o.launch ? 46 : 30, life: 0.12 });
  if (o.launch || Math.random() < 0.4) say(e.x + (Math.random() - 0.5) * 30, hy - 30, o.word || WORDS[(Math.random() * WORDS.length) | 0], o.launch ? '#ffe27a' : '#fff', o.launch ? 30 : 22);
  G.hits++; G.hitsT = 2.2; p.meter = Math.min(100, p.meter + (o.noMeter ? 0 : 6)); G.score += 10 * Math.min(10, G.hits);
  snd.fx(o.launch ? 'big' : 'hit');
  if (dead || (o.launch && e.kind !== 'boss')) { e.state = 'fly'; e.st = 0; e.vy = dead ? 300 : 250; e.vx = dir * (dead ? 260 : 200); e.vz = 0; e.spin = 0; }
  else if (T.armor && !o.launch) { e.x += dir * 5; }
  else if (e.kind === 'boss') { e.x += dir * 14; if (e.state !== 'leap') { e.state = 'hurt'; e.st = 0; e.vx = dir * 60; } }
  else { e.state = 'hurt'; e.st = 0; e.vx = dir * 110; e.vz = 0; }
  if (dead && e.kind === 'boss') { G.slow = 1.6; G.winT = 3.2; snd.fx('gong'); for (const o2 of G.enemies) if (o2 !== e && !o2.dead) { o2.hp = 0; o2.state = 'fly'; o2.st = 0; o2.vy = 260; o2.vx = (Math.sign(o2.x - e.x) || 1) * 200; } }
}
function hurtPlayer(dmg, dir) {
  const p = G.p; if (p.inv > 0 || p.state === 'roll' || p.state === 'special' || p.state === 'dead' || G.winT > 0) return false;
  p.hp -= G.giantT > 0 ? dmg * 0.5 : dmg; p.flash = 0.12; p.inv = 0.9; G.hits = 0; G.shake = Math.max(G.shake, 6); G.hitstop = 0.06; snd.fx('hurt');
  spark(p.x, groundY(p.z) - p.y - 50, '#ff9aa8', 8);
  if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; p.st = 0; p.vy = 240; p.vx = dir * 200; G.overT = 2; G.slow = 0.8; }
  else { p.state = 'hurt'; p.st = 0; p.vx = dir * 170; p.vz = 0; }
  return true;
}
function startAttack(p) {
  p.combo = nextCombo(p.combo, p.comboT); p.state = 'attack'; p.st = 0; p.hitDone = false; p.queue = false; p.atkDur = p.combo === 3 ? 0.42 : 0.24; snd.fx('whoosh');
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
      else if (pressed.roll && p.rollCd <= 0) { p.idleT = 0; p.state = 'roll'; p.st = 0; p.spin = 0; p.hitSet.clear(); p.rollCd = 0.75; if (Math.abs(ax) > 0.2) p.face = Math.sign(ax); snd.fx('roll'); }
      else if (pressed.spec && p.meter >= 100) { p.idleT = 0; p.state = 'special'; p.st = 0; p.meter = 0; p.pulse = 0; p.spin = 0; p.vx = p.vz = 0; snd.fx('special'); say(p.x, groundY(p.z) - 130, '¡TIFÓN DE LAZO!', '#ff9aa8', 30); }
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
        const n = hitEnemies(e => inReach(p, e, reach, 20 * big, 80), third ? 18 : 10, { dir: p.face, launch: third, word: third ? '¡BARRIGAZO!' : null });
        for (const s of G.shots) if (s.from === 'enemy' && inReach(p, s, reach + 10, 22, 999)) { s.vx = p.face * 420; s.from = 'player'; snd.fx('clang'); spark(s.x, groundY(s.z) - s.y, '#fff', 6); say(s.x, groundY(s.z) - 80, '¡CLANG!', '#cfe8ff', 20); }
        if (third) { dust(p.x + p.face * 40, p.z, 6); if (n) quake(p, 9); }
      }
      if (p.st >= p.atkDur) { p.comboT = 0.4; if (p.queue && p.combo < 3) startAttack(p); else { p.state = 'idle'; p.st = 0; } }
      break;
    }
    case 'roll': p.vx = p.face * 340; p.vz = az * 60; p.spin += dt * 17; if (Math.random() < dt * 30) dust(p.x - p.face * 20, p.z, 1);
      hitEnemies(e => inRadius(p, e, 46 * big) && e.y < 40, 8, { set: p.hitSet, dir: p.face, word: '¡BOING!' });
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
    if (p.state === 'slam') { const r = 92 * big; ring(p.x, p.z, r); dust(p.x, p.z, 14); snd.fx('land'); snd.fx('big'); hitEnemies(e => inRadius(p, e, r) && e.y < 40, 16, { launch: true, word: '¡PLANCHAZO!' }); quake(p, 11); p.squash = 0.6; p.state = 'idle'; p.st = 0; }
    else if (p.state === 'jump') { p.state = 'idle'; p.st = 0; p.squash = 0.72; dust(p.x, p.z, 9); snd.fx('land'); G.shake = Math.max(G.shake, 4); }
    else if (p.state === 'dead' || p.state === 'win') { p.squash = 0.8; dust(p.x, p.z, 5); }
  }
  p.sqV += (1 - p.squash) * 260 * dt; p.sqV *= Math.exp(-11 * dt); p.squash = clamp(p.squash + p.sqV * dt, 0.5, 1.4);
  if (free && p.hp > 0 && p.hp < 100 && p.state === 'sit') p.hp = Math.min(100, p.hp + dt * 4);
}

// ------------------------------------------------------------------ enemigos
function spawn(kind, i, arena) {
  const T = ENEMY[kind], side = kind === 'boss' ? 1 : (i % 2 ? -1 : 1) * (Math.random() < 0.8 ? 1 : -1);
  const e = { id: uid++, kind, hp: T.hp, maxHp: T.hp, x: arena.x + side * (V.w / 2 + 70), y: 0.01, z: 15 + Math.random() * 90, vx: 0, vy: 0, vz: 0, face: -side, state: 'enter', st: 0, walkPhase: Math.random() * 6, flash: 0, cd: 0.4 + i * 0.5 + Math.random() * 0.5,
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
        if (!e.engaged && e.cd <= 0 && G.attackers < (boss ? 3 : 2)) { e.engaged = true; G.attackers++; }
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
    case 'windup': if (e.st >= T.windup) { if (e.kind === 'thrower') { shoot(e); e.state = 'recover'; e.st = 0; e.cd = 1.6 + Math.random(); } else { e.state = 'strike'; e.st = 0; e.vx = e.face * (boss ? 260 : 150); snd.fx('whoosh'); } } break;
    case 'fanwind': if (e.st >= 0.6) { for (const o of [-30, 0, 30]) shoot(e, o); e.state = 'recover'; e.st = 0; e.cd = 1.4; } break;
    case 'strike':
      if (!e.struck && e.st >= 0.05) { e.struck = true; if (inReach(e, p, T.reach + 14, 17, 46)) hurtPlayer(T.dmg, e.face); }
      if (e.st >= 0.2) { e.state = 'recover'; e.st = 0; e.vx = 0; } break;
    case 'recover': e.vx *= Math.exp(-8 * dt); if (e.st >= T.recover) { e.state = 'move'; e.st = 0; e.engaged = false; e.cd = (boss ? 0.5 : 0.7) + Math.random() * 1.1; } break;
    case 'hurt': e.vx *= Math.exp(-7 * dt); if (e.st >= (boss ? 0.16 : 0.32)) { e.state = 'move'; e.st = 0; } break;
    case 'fly': e.spin -= dt * 9 * Math.sign(e.vx || 1); break;
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
      if (e.hp <= 0) { e.dead = true; smoke(e.x, groundY(e.z), boss ? 40 : 14); snd.fx('poof'); G.score += T.score; G.logs.push({ x: e.x, z: e.z, y: 60, vy: 120, t: 0, s: ninjaScale(e.kind) }); if (Math.random() < (e.kind === 'brute' ? 0.9 : 0.3)) G.picks.push({ x: e.x, z: e.z, y: 50, vy: 160, t: 0 }); }
      else { e.state = 'down'; e.st = 0; dust(e.x, e.z, 6); snd.fx('land'); }
    }
  }
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
  for (const k of G.picks) { k.t += dt; if (k.y > 0) { k.vy -= 700 * dt; k.y += k.vy * dt; if (k.y <= 0) { k.y = 0; k.vy = 0; } } if (!k.got && k.y < 30 && Math.abs(k.x - p.x) < 36 && Math.abs(k.z - p.z) < 24 && p.state !== 'dead') { k.got = true; p.hp = Math.min(100, p.hp + 14); p.meter = Math.min(100, p.meter + 10); snd.fx('pickup'); say(k.x, groundY(k.z) - 60, '¡Ñam!', '#c8f0a0', 20); spark(k.x, groundY(k.z) - 20, '#fff', 5); } }
  G.picks = G.picks.filter(k => !k.got && k.t < 25);
  for (const l of G.logs) { l.t += dt; if (l.y > 0) { l.vy -= 800 * dt; l.y = Math.max(0, l.y + l.vy * dt); } }
  G.logs = G.logs.filter(l => l.t < 2.4);
  // director de oleadas
  if (G.mode === 'play' && p.state !== 'dead') {
    const alive = G.enemies.length;
    if (alive === 0 && G.dir.locked) G.waveT += dt; else G.waveT = 0;
    if (!G.dir.locked || G.waveT > 0.9) {
      const ev = G.dir.update(p.x, alive);
      if (ev) { G.waveT = 0;
        if (ev.type === 'spawn') { G.lock = ev.arena; ev.kinds.forEach((k, i) => spawn(k, i, ev.arena)); if (ev.kinds[0] === 'boss') { snd.setMode('boss'); G.banner = { t: 0, name: 'Maestro Kurokasa', sub: 'La sombra del sombrero de paja' }; } else snd.setMode('fight'); }
        else { G.lock = null; if (!ev.done) { snd.setMode('calm'); G.goT = 4; } }
      }
    }
    const ai = LEVEL.acts.findLastIndex(a => p.x > a.x); if (ai > G.act) { G.act = ai; G.banner = { t: 0, name: LEVEL.acts[ai].name, sub: LEVEL.acts[ai].sub }; }
  }
  if (G.goT > 0) G.goT -= dt;
  if (G.winT > 0) { G.winT -= dt; if (G.winT <= 0 && G.mode === 'play') { G.mode = 'win'; snd.setMode('calm'); snd.fx('secret'); } }
  if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) G.mode = 'over'; }
  if (G.banner) { G.banner.t += dt; if (G.banner.t > 3.6) G.banner = null; }
  // cámara
  const target = clamp(G.lock ? G.lock.x - V.w / 2 : p.x - V.w / 2 + p.face * 46, 0, LEVEL.length - V.w);
  G.cam = lerp(G.cam, target, 1 - Math.exp(-(G.lock ? 2.2 : 4) * dt));
  for (const q of G.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.kind === 'spark' || q.kind === 'fire') { q.vx *= Math.exp(-3 * dt); q.vy = q.vy * Math.exp(-3 * dt) + (q.kind === 'fire' ? 40 * dt : 0); } if (q.kind === 'petal') q.vy += 160 * dt; }
  G.parts = G.parts.filter(q => q.t < q.life);
  for (const s of G.texts) { s.t += dt; s.y -= 34 * dt; }
  G.texts = G.texts.filter(s => s.t < 0.9);
  G.shake = Math.max(0, G.shake - dt * 30);
}

// ------------------------------------------------------------------ dibujo
function shadow(x, z, y, r) { const k = clamp(1 - y / 260, 0.3, 1); g.fillStyle = `rgba(20,12,50,${0.3 * k})`; ell(g, x - G.cam, groundY(z) + 1, r * k, r * 0.26 * k); g.fill(); }
function drawActors() {
  const p = G.p, t = G.t, list = [];
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
  bar(84, 26, 190, 15, p.hp / 100, p.hp < 30 ? '#ff6a6a' : '#ff9aa8', p.hp < 30 ? '#ffb07a' : '#ffd27a');
  const full = p.meter >= 100; bar(84, 50, 130, 9, p.meter / 100, full ? `hsl(${(t * 300) % 360},90%,70%)` : '#8fd0ff', full ? '#fff' : '#c8a8ff');
  if (full) ink(G.touch ? '✿ ¡LISTO!' : 'ESPACIO: ¡Tifón de Lazo!', 224, 60, 13, '#fff', 'left');
  ink(String(G.score).padStart(6, '0'), w / 2, 36, 22);
  ink(G.muted ? '♪̸' : '♪', w - 30, 36, 22, G.muted ? '#ff9aa8' : '#fff7e6');
  if (G.hits > 1) { const k = 1 + Math.max(0, G.hitsT - 2) * 2; g.save(); g.translate(w - 64, 92); g.scale(k, k); g.rotate(-0.08); ink(String(G.hits), 0, 0, 44, '#ffe27a', 'right', 'italic bold'); ink('golpes', 6, 0, 16, '#fff7e6', 'left', 'italic'); g.restore(); }
  if (G.giantT > 0) ink(`MOCHI GIGANTE ${Math.ceil(G.giantT)}`, w / 2, 62, 15, `hsl(${(t * 300) % 360},90%,75%)`);
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
  g.save(); g.translate(w / 2, V.h - 150 + 60); const s = 1.5; g.scale(s, s); PORTRAIT.state = 'walk'; PORTRAIT.walkPhase = t * 9; PORTRAIT.vx = 150; PORTRAIT.rainbow = false; g.fillStyle = 'rgba(20,12,50,.3)'; ell(g, 0, 1, 44, 11); g.fill(); drawMochi(g, PORTRAIT, t); PORTRAIT.vx = 0; g.restore();
  if (Math.sin(t * 4) > -0.5) ink(G.touch ? 'Toca para empezar' : 'Pulsa ENTER o haz clic para empezar', w / 2, V.h * 0.36 + 100, 22, '#ffe9b0');
  ink('← ↑ ↓ → mover   ·   Z golpe   ·   X saltito   ·   C rodar   ·   ESPACIO especial   ·   N sonido', w / 2, V.h - 18, 13, '#fff7e6', 'center', 'normal');
  ink(`✿ ${G.eggs.size}/${Object.keys(EGGS).length} secretos`, w - 16, V.h - 18, 13, '#ffd9a0', 'right', 'italic');
}
function frameDraw(dt) {
  const t = G.t, progress = G.mode === 'title' ? 0.5 - 0.5 * Math.cos(t * 0.09) : clamp(G.cam / 4500, 0, 1);
  const pal = (G.pal = paletteAt(progress)); setLight(pal);
  g.setTransform(V.scale, 0, 0, V.scale, 0, 0);
  const sh = G.shake; g.save(); if (sh > 0.2) g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh * 0.7);
  G.cel = drawBack(g, V, G.cam, t, pal, G.fx);
  drawActors(); drawTexts();
  drawFront(g, V, G.cam, G.cam - G.pcam, t, dt, pal, G.cel); G.pcam = G.cam;
  g.restore();
  if (G.mode === 'title') drawTitle();
  else {
    drawHUD();
    if (G.mode === 'over') { veil(0.55); ink('Mochi necesita una siesta…', V.w / 2, V.h * 0.42, 44, '#fff7e6', 'center', 'italic bold'); ink(G.touch ? 'Toca para volver a intentarlo' : 'ENTER para volver a intentarlo desde aquí', V.w / 2, V.h * 0.42 + 44, 20, '#ffd9a0', 'center', 'italic'); }
    if (G.mode === 'win') { veil(0.25); ink('Fin', V.w / 2, V.h * 0.3, 80, '#fffdf0', 'center', 'italic bold'); ink('…y Mochi por fin pudo merendar en paz.', V.w / 2, V.h * 0.3 + 44, 22, '#ffe9b0', 'center', 'italic'); ink(`Puntos: ${G.score}   ·   Secretos: ${G.eggs.size}/${Object.keys(EGGS).length}`, V.w / 2, V.h * 0.3 + 80, 18); if (G.eggs.size < 8) ink('Pista: prueba un código clásico, teclea su nombre, toca el cielo… o no hagas nada.', V.w / 2, V.h * 0.3 + 106, 14, '#e8d8ff', 'center', 'italic'); }
    if (G.paused) { veil(0.6); ink('Pausa', V.w / 2, V.h * 0.36, 60, '#fffdf0', 'center', 'italic bold'); ['← ↑ ↓ → / WASD  mover por el camino', 'Z / J  golpe (x3 = barrigazo)   ·   X / K  saltito (+ golpe = planchazo)', 'C / L  rodar (esquiva y atropella)   ·   ESPACIO  Tifón de Lazo', 'Golpea los shuriken para devolverlos   ·   N  sonido   ·   P  seguir'].forEach((s, i) => ink(s, V.w / 2, V.h * 0.36 + 50 + i * 26, 16, '#fff7e6', 'center', 'normal')); }
  }
  drawToast();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (!G.paused) update(dt);
  frameDraw(G.paused ? 0 : dt);
  for (const k in pressed) pressed[k] = false;
  requestAnimationFrame(loop);
}
if (new URLSearchParams(location.search).has('debug')) window.__mochi = { G, V, reset, secret, held, pressed, update, snd };
requestAnimationFrame(loop);
