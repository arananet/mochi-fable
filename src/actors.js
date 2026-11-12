// actors.js: personajes vectoriales animados por código. Origen en los pies, mirando a la derecha.
import { TAU, clamp, A, ell } from './core.js';

let ambL = [1, 1, 1], verL = 0, rimL = 'rgb(255,240,180)', white = false;
const tintCache = new Map();
const INK = 'rgba(34,20,44,.78)';
export function setLight(pal) { ambL = pal.ambRGB; verL = pal.ver; rimL = pal.rim; }
function K(hex) {
  if (white) return '#fff';
  const k = hex + verL; let v = tintCache.get(k);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `rgb(${((n >> 16 & 255) * ambL[0]) | 0},${((n >> 8 & 255) * ambL[1]) | 0},${((n & 255) * ambL[2]) | 0})`;
    if (tintCache.size > 5000) tintCache.clear();
    tintCache.set(k, v);
  }
  return v;
}

// ------------------------------------------------------------------ Mochi
function bodyPath(g) {
  g.beginPath(); g.moveTo(0, -90);
  g.bezierCurveTo(30, -90, 44, -62, 45, -36); g.bezierCurveTo(46, -8, 26, 0, 0, 0);
  g.bezierCurveTo(-26, 0, -46, -8, -45, -36); g.bezierCurveTo(-44, -62, -30, -90, 0, -90); g.closePath();
}
function bowColors(p, t) {
  if (p.rainbow) return [`hsl(${(t * 220) % 360},90%,62%)`, `hsl(${(t * 220 + 50) % 360},85%,45%)`];
  return [K('#e8404f'), K('#a52438')];
}
// cinta ninja (hachimaki): banda en la frente, nudo detrás y dos colas al viento
function ribbons(g, p, t) {
  const [red, dk] = bowColors(p, t), sp = Math.min(46, Math.abs(p.vx) * 0.1), shake = p.blush > 0 ? Math.sin(t * 38) * 6 : 0;
  g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const ph = t * 7 + i * 1.7, ex = -74 - sp - i * 9, ey = -62 + i * 12 + Math.sin(ph) * 6 - clamp(p.vy * 0.05, -22, 22) + shake;
    g.beginPath(); g.moveTo(-38, -71); g.quadraticCurveTo(-54 - sp * 0.5, -80 + Math.sin(ph + 1) * 5 + i * 6, ex, ey);
    g.lineWidth = 7.5 - i * 1.5; g.strokeStyle = i ? dk : red; g.stroke();
  }
}
function band(g, p, t) {
  const [red, dk] = bowColors(p, t);
  g.save(); bodyPath(g); g.clip();
  g.beginPath(); g.moveTo(-52, -73); g.quadraticCurveTo(0, -93, 52, -73); g.lineTo(52, -64); g.quadraticCurveTo(0, -84, -52, -64); g.closePath();
  g.fillStyle = red; g.fill(); g.strokeStyle = white ? '#fff' : INK; g.lineWidth = 1.6; g.stroke();
  g.strokeStyle = dk; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-44, -68); g.quadraticCurveTo(0, -86, 44, -68); g.stroke();
  g.restore();
  g.fillStyle = red; ell(g, -39, -70, 6, 6.5, 0.3); g.fill(); g.strokeStyle = white ? '#fff' : INK; g.lineWidth = 1.8; g.stroke();
}
export function drawMochi(g, p, t) {
  white = p.flash > 0;
  const st = p.state, a = p.st, air = p.y > 0;
  let lean = 0, reach = 0, belly = 0, eye = 'open', mouth = 'smile', armUp = 0, punch = 0;
  if (st === 'walk') lean = 0.05 + Math.sin(p.walkPhase * 2) * 0.025;
  if (st === 'attack') {
    punch = Math.sin(Math.min(1, clamp(a / p.atkDur, 0, 1) * 1.5) * Math.PI);
    if (p.combo < 3) { reach = punch * 28; lean = 0.12 * punch; } else { belly = punch; lean = 0.22 * punch; }
    eye = 'fierce'; mouth = 'o';
  }
  if (st === 'hurt' || st === 'dead') { lean = -0.28; eye = 'hurt'; mouth = 'o'; }
  if (st === 'jump') { eye = 'fierce'; armUp = 1; }
  if (st === 'slam') { lean = 0.55; eye = 'fierce'; mouth = 'o'; armUp = 0.6; }
  if (st === 'special') { eye = 'fierce'; mouth = 'o'; armUp = 0.5; }
  if (st === 'sit') { eye = 'happy'; mouth = (t * 3) % 1 < 0.5 ? 'o' : 'smile'; }
  if (st === 'win') { eye = 'happy'; armUp = 0.5 + 0.5 * Math.sin(t * 10); mouth = 'o'; }
  if (p.blush > 0) eye = 'happy';
  const blink = eye === 'open' && (t * 0.7) % 3 < 0.1;
  const sq = p.squash + (st === 'idle' || st === 'sit' ? Math.sin(t * 2.6) * 0.018 : 0);
  const walking = st === 'walk';
  // pies
  if (st !== 'roll' && st !== 'sit') {
    const f1 = walking ? Math.max(0, Math.sin(p.walkPhase)) * 7 : 0, f2 = walking ? Math.max(0, Math.sin(p.walkPhase + Math.PI)) * 7 : 0;
    const fo = walking ? Math.cos(p.walkPhase) * 7 : 0;
    g.fillStyle = K('#262238');
    ell(g, -16 + fo, -4 - f1 + (air ? 5 : 0), 13, 6.5, air ? 0.4 : 0); g.fill();
    ell(g, 17 - fo, -4 - f2 + (air ? 5 : 0), 13, 6.5, air ? -0.3 : 0); g.fill();
  }
  g.save();
  if (st === 'sit') g.translate(0, 5);
  g.rotate(lean); g.scale((1 / Math.sqrt(sq)) * (1 + belly * 0.16), sq);
  if (st === 'roll') { g.translate(0, -44); g.rotate(p.spin); g.translate(0, 44); }
  if (st === 'special') { const c = Math.cos(p.spin); g.scale(Math.abs(c) < 0.2 ? 0.2 * (c < 0 ? -1 : 1) : c, 1); }
  ribbons(g, p, t);
  // brazo trasero
  g.fillStyle = K('#2e3162'); ell(g, -36, -42 - armUp * 16, 10, 8, -0.4 + armUp); g.fill();
  bodyPath(g);
  const gr = g.createRadialGradient(14, -66, 6, 0, -44, 62);
  gr.addColorStop(0, K('#6672c2')); gr.addColorStop(0.6, K('#414a90')); gr.addColorStop(1, K('#2a2c5c'));
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  g.strokeStyle = K('#f5ecd6'); g.lineWidth = 3.8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, -47); g.lineTo(12, -27); g.moveTo(36, -46); g.lineTo(12, -27); g.stroke();
  g.fillStyle = K('#ecbd4c'); g.beginPath(); g.moveTo(-52, -27); g.quadraticCurveTo(0, -15, 52, -27); g.lineTo(52, -16); g.quadraticCurveTo(0, -4, -52, -16); g.fill();
  if (!white) { // luz de contorno hacia el sol
    const rx = 34 * (p.face || 1), rg = g.createRadialGradient(rx, -78, 3, rx, -70, 48);
    rg.addColorStop(0, A(rimL, 0.6)); rg.addColorStop(1, A(rimL, 0)); g.fillStyle = rg; g.fillRect(-60, -100, 120, 110);
    const sh = g.createLinearGradient(0, -30, 0, 2); sh.addColorStop(0, 'rgba(20,10,50,0)'); sh.addColorStop(1, 'rgba(20,10,50,.35)'); g.fillStyle = sh; g.fillRect(-60, -30, 120, 34);
  }
  g.restore();
  bodyPath(g); g.strokeStyle = white ? '#fff' : INK; g.lineWidth = 2.2; g.stroke();
  // nudo del cinturón
  g.fillStyle = K('#d39a2c'); g.beginPath(); g.roundRect(8, -22, 10, 10, 3); g.fill();
  g.strokeStyle = K('#d39a2c'); g.lineWidth = 4; g.beginPath(); g.moveTo(13, -13); g.quadraticCurveTo(10, -6, 5 - Math.sin(t * 4) * 2, -2); g.moveTo(14, -13); g.quadraticCurveTo(19, -7, 21 + Math.sin(t * 4 + 1) * 2, -3); g.stroke();
  // cara
  g.fillStyle = K('#ffe4c8'); ell(g, 13, -61, 23, 13.5, -0.05); g.fill(); g.strokeStyle = white ? '#fff' : 'rgba(34,20,44,.6)'; g.lineWidth = 1.6; g.stroke();
  if (!white) {
    g.fillStyle = `rgba(255,105,125,${p.blush > 0 ? 0.9 : 0.5})`; ell(g, -1, -55, 5.5, 3.2); g.fill(); ell(g, 29, -55, 5.5, 3.2); g.fill();
    g.strokeStyle = g.fillStyle = '#2a1a2e'; g.lineWidth = 2.2; g.lineCap = 'round';
    for (const ex of [5, 22]) {
      g.beginPath();
      if (eye === 'happy') { g.arc(ex, -60, 3.5, Math.PI, TAU); g.stroke(); }
      else if (eye === 'hurt') { const s = ex < 10 ? 1 : -1; g.moveTo(ex - 3 * s, -65); g.lineTo(ex + 2 * s, -62); g.lineTo(ex - 3 * s, -59); g.stroke(); }
      else if (blink) { g.moveTo(ex - 3, -62); g.lineTo(ex + 3, -62); g.stroke(); }
      else {
        g.arc(ex, -62, 3, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1, -63, 1, 0, TAU); g.fill(); g.fillStyle = '#2a1a2e';
        if (eye === 'fierce') { const s = ex < 10 ? 1 : -1; g.beginPath(); g.moveTo(ex - 5 * s, -68.5); g.lineTo(ex + 4 * s, -66); g.stroke(); }
      }
    }
    g.beginPath();
    if (mouth === 'o') { g.ellipse(14, -54, 2.6, 3.2, 0, 0, TAU); g.fillStyle = '#7a2a3a'; g.fill(); }
    else { g.arc(14, -56.5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  }
  // brazo delantero
  const ax = 34 + reach * 0.6, ay = -42 - armUp * 18;
  g.fillStyle = K('#3b4180'); ell(g, ax, ay, 11 + reach * 0.4, 8.5, 0.3 - armUp * 0.9); g.fill(); g.strokeStyle = white ? '#fff' : INK; g.lineWidth = 1.8; g.stroke();
  g.fillStyle = K('#ffe4c8'); ell(g, ax + 9 + reach * 0.45, ay + 2 - armUp * 8, 6.5, 6); g.fill(); g.stroke();
  if (st === 'sit') { // dango de merienda
    const dx = ax + 12, dy = ay - 6; g.strokeStyle = K('#c9a070'); g.lineWidth = 2; g.beginPath(); g.moveTo(dx, dy + 8); g.lineTo(dx, dy - 20); g.stroke();
    ['#ffb7c8', '#ffffff', '#b9dd8a'].forEach((c, i) => { if (i < 3 - Math.floor((a * 0.25) % 3)) { g.fillStyle = K(c); ell(g, dx, dy - 16 + i * 8, 5, 5); g.fill(); } });
  }
  if (st === 'attack' && punch > 0.15) { // estela del golpe
    g.strokeStyle = `rgba(255,250,225,${punch * 0.8})`; g.lineWidth = 5 * punch; g.lineCap = 'round';
    g.beginPath(); if (p.combo < 3) g.arc(30, -40, 44 + reach * 0.5, -0.7, 0.6); else g.arc(0, -40, 62, -0.9, 0.9); g.stroke();
  }
  band(g, p, t);
  g.restore(); white = false;
}

// ------------------------------------------------------------------ ninjas
const NT = {
  grunt: { m: '#5c547c', d: '#39334f', a: '#e4525f', s: 1, w: 1 },
  thrower: { m: '#3b7682', d: '#264e58', a: '#f4c44f', s: 0.95, w: 0.88 },
  bomber: { m: '#d9772e', d: '#8a4418', a: '#2a2030', s: 0.82, w: 0.95 },
  brute: { m: '#8c4452', d: '#5c2a36', a: '#f4e5c6', s: 1.32, w: 1.55 },
  boss: { m: '#2e2644', d: '#19132a', a: '#b860f4', s: 1.58, w: 1.25 },
};
export const ninjaScale = k => NT[k].s;
export function drawNinja(g, e, t) {
  const T = NT[e.kind], st = e.state, a = e.st, w = T.w; white = e.flash > 0;
  const air = e.y > 0, moving = st === 'move' && (Math.abs(e.vx) + Math.abs(e.vz) > 5);
  let lean = 0.06, ang = 0.9, crouch = 0, rot = 0, drop = 0, tele = false, swoosh = 0;
  if (moving) lean = 0.14;
  if (st === 'windup' || st === 'fanwind') { lean = -0.16; ang = -2.3 - Math.sin(a * 34) * 0.06; tele = true; }
  if (st === 'strike') { const u = clamp(a / 0.12, 0, 1); ang = -2.3 + u * 3.1; lean = 0.32; swoosh = 1 - clamp(a / 0.22, 0, 1); }
  if (st === 'recover') { ang = 0.8; lean = 0.22; }
  if (st === 'hurt') { lean = -0.38; ang = 1.5; }
  if (st === 'enter' || st === 'leap') { crouch = 0.5; ang = -1.3; rot = e.spin || 0; }
  if (st === 'fly') { rot = e.spin || 0; ang = 1.8; }
  if (st === 'down') { rot = -1.5; drop = 38; }
  if (st === 'rise') { const k = 1 - clamp(a / 0.3, 0, 1); rot = -1.5 * k; drop = 38 * k; }
  g.save(); g.scale(T.s, T.s);
  if (rot || drop) { g.translate(0, drop - 45); g.rotate(rot); g.translate(0, 45); }
  const hipY = -46 * (1 - crouch * 0.45);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (e.kind === 'boss') { // capa
    const f = Math.sin(t * 5) * 6; g.fillStyle = K('#40305e');
    g.beginPath(); g.moveTo(-6, hipY - 36); g.quadraticCurveTo(-40, hipY - 20 + f, -46 - Math.abs(e.vx) * 0.05, hipY + 26 + f); g.quadraticCurveTo(-20, hipY + 12, -4, hipY + 4); g.fill();
  }
  for (const s of [-1, 1]) { // piernas
    const ph = e.walkPhase + (s > 0 ? 0 : Math.PI);
    const fx = s * 9 * w + (moving ? Math.sin(ph) * 13 : 0) + (air ? -s * 4 : 0), fy = -(moving ? Math.max(0, Math.cos(ph)) * 8 : 0) - (air ? 14 : 0);
    g.strokeStyle = K(T.d); g.lineWidth = 7.5 * w; g.beginPath(); g.moveTo(s * 4 * w, hipY); g.quadraticCurveTo(fx / 2 + 7, (hipY + fy) / 2, fx, fy - 3); g.stroke();
    g.fillStyle = K('#231d30'); ell(g, fx + 3, fy - 2, 7 * w, 3.6); g.fill();
  }
  g.translate(0, hipY); g.rotate(lean);
  // bufanda
  const fl = Math.sin(t * 8 + e.id) * 5, sp = Math.min(20, Math.abs(e.vx) * 0.08);
  g.strokeStyle = K(T.a); g.lineWidth = 5;
  g.beginPath(); g.moveTo(-3, -39); g.quadraticCurveTo(-18 - sp, -44 + fl, -34 - sp * 1.4, -34 - fl); g.stroke();
  // brazo trasero
  g.strokeStyle = K(T.d); g.lineWidth = 6 * w; g.beginPath(); g.moveTo(-8 * w, -32); g.lineTo(-13 * w - 3, -15); g.stroke();
  // torso
  g.fillStyle = K(T.m); g.beginPath(); g.moveTo(-8 * w, 2); g.quadraticCurveTo(-13 * w, -20, -11 * w, -37); g.quadraticCurveTo(0, -42, 11 * w, -37); g.quadraticCurveTo(13 * w, -20, 8 * w, 2); g.closePath(); g.fill();
  g.strokeStyle = white ? '#fff' : INK; g.lineWidth = 1.8; g.stroke();
  g.fillStyle = K(T.a); g.fillRect(-9.5 * w, -9, 19 * w, 4.5);
  // cabeza
  const hx = 2, hy = -50, hr = e.kind === 'brute' ? 11 : 12;
  g.fillStyle = K(T.m); ell(g, hx, hy, hr, hr); g.fill(); g.strokeStyle = white ? '#fff' : INK; g.stroke();
  g.fillStyle = K('#f0d3b6'); ell(g, hx + 4, hy - 1, 8.5, 4); g.fill();
  if (!white) {
    g.strokeStyle = tele ? ((a * 12) % 1 < 0.5 ? '#ff3b3b' : '#fff') : '#1c1424'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(hx, hy - 3); g.lineTo(hx + 4, hy - 0.5); g.moveTo(hx + 11, hy - 3); g.lineTo(hx + 7, hy - 0.5); g.stroke();
  }
  if (e.kind === 'boss') { // kasa
    g.fillStyle = K('#cfa95e'); g.beginPath(); g.moveTo(hx - 24, hy - 5); g.lineTo(hx + 2, hy - 26); g.lineTo(hx + 27, hy - 5); g.quadraticCurveTo(hx + 2, hy - 1, hx - 24, hy - 5); g.fill(); g.strokeStyle = white ? '#fff' : INK; g.lineWidth = 1.8; g.stroke();
    g.strokeStyle = K('#a07c3c'); g.lineWidth = 1; g.beginPath(); for (const k of [-14, -5, 5, 14]) { g.moveTo(hx + 2, hy - 26); g.lineTo(hx + 2 + k * 1.4, hy - 4); } g.stroke();
    if (!white) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(190,100,255,.8)'; ell(g, hx + 3, hy - 1.5, 2.2, 1.6); g.fill(); ell(g, hx + 9, hy - 1.5, 2.2, 1.6); g.fill(); g.restore(); }
  }
  if (e.kind === 'brute') { g.strokeStyle = K(T.a); g.lineWidth = 3; g.beginPath(); g.moveTo(hx - 10, hy - 6); g.lineTo(hx + 11, hy - 7); g.stroke(); }
  // brazo delantero + arma
  const sx = 9 * w, sy = -32, hx2 = sx + Math.cos(ang) * 24, hy2 = sy + Math.sin(ang) * 24;
  if (swoosh > 0) { g.strokeStyle = `rgba(255,255,255,${swoosh * 0.7})`; g.lineWidth = 7 * swoosh; g.beginPath(); g.arc(sx, sy, e.kind === 'boss' ? 74 : 60, ang - 1.5, ang - 0.2); g.stroke(); }
  g.strokeStyle = K(T.m); g.lineWidth = 6.5 * w; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx2, hy2); g.stroke();
  const wa = ang - 0.55, wx = Math.cos(wa), wy = Math.sin(wa);
  if (e.kind === 'grunt' || e.kind === 'boss') {
    const L = e.kind === 'boss' ? 62 : 44;
    g.strokeStyle = K('#2a2030'); g.lineWidth = 4; g.beginPath(); g.moveTo(hx2 - wx * 7, hy2 - wy * 7); g.lineTo(hx2 + wx * 5, hy2 + wy * 5); g.stroke();
    g.strokeStyle = e.kind === 'boss' ? K('#e9d4ff') : K('#eef3f8'); g.lineWidth = 3; g.beginPath(); g.moveTo(hx2 + wx * 5, hy2 + wy * 5); g.lineTo(hx2 + wx * L, hy2 + wy * L); g.stroke();
  } else if (e.kind === 'brute') {
    g.strokeStyle = K('#6b4a34'); g.lineWidth = 5; g.beginPath(); g.moveTo(hx2 - wx * 6, hy2 - wy * 6); g.lineTo(hx2 + wx * 16, hy2 + wy * 16); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.moveTo(hx2 + wx * 18, hy2 + wy * 18); g.lineTo(hx2 + wx * 48, hy2 + wy * 48); g.stroke();
    g.fillStyle = K('#d8d2c4'); for (let i = 0; i < 3; i++) { ell(g, hx2 + wx * (24 + i * 10), hy2 + wy * (24 + i * 10), 2, 2); g.fill(); }
  } else if (e.kind === 'bomber') {
    g.fillStyle = K('#1d1a26'); ell(g, hx2 + 5, hy2 - 7, 10, 10); g.fill(); g.strokeStyle = K('#c9a070'); g.lineWidth = 2; g.beginPath(); g.moveTo(hx2 + 9, hy2 - 16); g.quadraticCurveTo(hx2 + 14, hy2 - 24, hx2 + 11, hy2 - 27); g.stroke();
    if (!white) { g.fillStyle = (t * (tele ? 22 : 9)) % 1 < 0.5 ? '#ffe04a' : '#ff6a2a'; ell(g, hx2 + 11, hy2 - 28, tele ? 5 : 3, tele ? 5 : 3); g.fill(); }
  } else if (tele) { g.save(); g.translate(hx2, hy2); g.rotate(t * 20); star(g, 8, K('#dfe8f0')); g.restore(); }
  g.fillStyle = K('#f0d3b6'); ell(g, hx2, hy2, 4, 4); g.fill();
  if (tele && !white) { g.fillStyle = '#ff4a4a'; g.font = 'bold 22px Georgia'; g.textAlign = 'center'; g.fillText('!', hx + 2, hy - 30 - Math.abs(Math.sin(a * 14)) * 5); }
  g.restore(); white = false;
}

// ------------------------------------------------------------------ props
function star(g, r, col) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 8; i++) { const a2 = (i * TAU) / 8, rr = i % 2 ? r * 0.35 : r; g.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); }
  g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
}
export function drawShuriken(g, s, t) { g.save(); g.rotate(t * 24 * Math.sign(s.vx)); star(g, 10, s.from === 'player' ? '#ffe9a0' : K('#e2eaf2')); g.restore(); }
export function drawDango(g, t) {
  g.strokeStyle = K('#c9a070'); g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -32); g.stroke();
  ['#b9dd8a', '#ffffff', '#ffb7c8'].forEach((c, i) => { g.fillStyle = K(c); ell(g, 0, -8 - i * 9, 6, 5.6); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke(); });
}
export function drawLog(g) {
  g.fillStyle = K('#9a6b42'); g.beginPath(); g.roundRect(-9, -40, 18, 40, 5); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
  g.fillStyle = K('#d9b98a'); ell(g, 0, -38, 8, 3.5); g.fill(); g.stroke();
  g.strokeStyle = K('#6e4526'); g.beginPath(); g.moveTo(-4, -28); g.lineTo(-4, -12); g.moveTo(3, -22); g.lineTo(3, -6); g.stroke();
}
// espíritu de piedra con hojita: los "kororin" del camino
export function drawSpirit(g, t, glow) {
  g.fillStyle = K('#b9c2b4'); g.beginPath(); g.moveTo(-13, 0); g.bezierCurveTo(-17, -22, -9, -30, 0, -30); g.bezierCurveTo(9, -30, 17, -22, 13, 0); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = K('#7fae62'); ell(g, -5, -4, 7, 3, 0.3); g.fill();
  g.fillStyle = glow > 0.4 ? '#fff6c0' : '#2a1a2e'; ell(g, -5, -18, 1.8, 2.2); g.fill(); ell(g, 5, -18, 1.8, 2.2); g.fill();
  g.strokeStyle = '#2a1a2e'; g.lineWidth = 1.3; g.beginPath(); g.arc(0, -14, 2.5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  g.save(); g.translate(0, -30); g.rotate(Math.sin(t * 2) * 0.25); g.strokeStyle = K('#5a8a44'); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -6); g.stroke(); g.fillStyle = K('#8fd06a'); ell(g, 4, -8, 5.5, 2.8, -0.5); g.fill(); g.restore();
}
