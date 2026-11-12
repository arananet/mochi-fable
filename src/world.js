// world.js: cielo pintado, parallax multicapa, luz y primer plano.
import { TAU, hash, rng, clamp, lerp, A, mulRGB, mixRGB, ell } from './core.js';

const sprites = new Map(); let spritesVer = -1;
function baked(key, ver, w, h, draw) {
  if (ver !== spritesVer) { sprites.clear(); spritesVer = ver; }
  let c = sprites.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); sprites.set(key, c); }
  return c;
}
// recorre los elementos visibles de una capa sembrada
function tiles(cam, factor, spacing, V, margin, fn) {
  const off = cam * factor, i0 = Math.floor((off - margin) / spacing), i1 = Math.ceil((off + V.w + margin) / spacing);
  for (let i = i0; i <= i1; i++) fn(i, i * spacing - off);
}

// ---------------------------------------------------------------- sprites horneados
function cloudSprite(seed, pal) {
  return baked('cloud' + seed, pal.bake, 560, 300, (g, w, h) => {
    const r = rng(seed * 977 + 3), blobs = [], n = 10 + ((r() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), arch = Math.sin(u * Math.PI);
      blobs.push([70 + u * (w - 140) + (r() - 0.5) * 36, h - 78 - arch * 62 * (0.5 + r() * 0.7), 34 + arch * 50 * (0.6 + r() * 0.5)]);
    }
    for (let i = 0; i < 5; i++) { const b = blobs[2 + ((r() * (n - 4)) | 0)]; blobs.push([b[0] + (r() - 0.5) * 50, b[1] - b[2] * 0.75, b[2] * (0.5 + r() * 0.35)]); }
    blobs.sort((a, b) => a[1] - b[1]);
    g.fillStyle = pal.cloudL; g.beginPath();
    for (const b of blobs) { g.moveTo(b[0] + b[2], b[1]); g.arc(b[0], b[1], b[2], 0, TAU); }
    g.ellipse(w / 2, h - 70, w / 2 - 46, 36, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-atop';
    for (const b of blobs) { // sombra inferior de cada borbotón + luz del sol arriba a la derecha
      const gr = g.createRadialGradient(b[0] + b[2] * 0.25, b[1] - b[2] * 0.35, b[2] * 0.25, b[0], b[1], b[2] * 1.12);
      gr.addColorStop(0, A(pal.cloudRim, 0.6)); gr.addColorStop(0.5, A(pal.cloudL, 0)); gr.addColorStop(0.85, A(pal.cloudS, 0.2)); gr.addColorStop(1, A(pal.cloudS, 0.3));
      g.fillStyle = gr; ell(g, b[0], b[1], b[2] * 1.12, b[2] * 1.12); g.fill();
    }
    const lg = g.createLinearGradient(0, h - 150, 0, h - 30); lg.addColorStop(0, A(pal.cloudS, 0)); lg.addColorStop(1, A(pal.cloudS, 0.85));
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const fg = g.createLinearGradient(0, h - 78, 0, h - 34); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fg; g.fillRect(0, h - 78, w, 80);
  });
}
function treeSprite(seed, col, pal, tag) {
  return baked('tree' + tag + seed, pal.bake, 240, 290, (g, w, h) => {
    const r = rng(seed * 131 + 9), cx = w / 2;
    g.fillStyle = pal.trunk; g.beginPath(); g.moveTo(cx - 13, h); g.quadraticCurveTo(cx - 5, h - 70, cx - 9, h - 150); g.lineTo(cx + 7, h - 150); g.quadraticCurveTo(cx + 5, h - 70, cx + 15, h); g.fill();
    g.strokeStyle = pal.trunk; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 2, h - 120); g.lineTo(cx - 42, h - 165); g.moveTo(cx, h - 110); g.lineTo(cx + 44, h - 160); g.stroke();
    const blobs = [];
    for (let i = 0; i < 11; i++) { const a = r() * TAU, d = r() * 62; blobs.push([cx + Math.cos(a) * d * 1.15, 112 + Math.sin(a) * d * 0.72, 30 + r() * 26]); }
    blobs.sort((a, b) => a[1] - b[1]);
    const light = mixRGB(col, pal.rim, 0.42), dark = mulRGB(col, 0.6);
    g.fillStyle = col; g.beginPath(); for (const b of blobs) { g.moveTo(b[0] + b[2], b[1]); g.arc(b[0], b[1], b[2], 0, TAU); } g.fill();
    g.globalCompositeOperation = 'source-atop';
    for (const b of blobs) {
      const gr = g.createRadialGradient(b[0] + b[2] * 0.3, b[1] - b[2] * 0.4, b[2] * 0.2, b[0], b[1], b[2] * 1.1);
      gr.addColorStop(0, A(light, 0.8)); gr.addColorStop(0.55, A(col, 0)); gr.addColorStop(1, A(dark, 0.38));
      g.fillStyle = gr; ell(g, b[0], b[1], b[2] * 1.1, b[2] * 1.1); g.fill();
    }
    for (let i = 0; i < 46; i++) { // pinceladas de hoja
      const b = blobs[(r() * blobs.length) | 0], a = r() * TAU, d = r() * b[2] * 0.9, up = Math.sin(a) < 0;
      g.fillStyle = A(up ? light : dark, 0.35 + r() * 0.3); ell(g, b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 3 + r() * 5, 2 + r() * 2.5, r() * 3); g.fill();
    }
  });
}
let grain = null;
function grainPattern(g) {
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'), d = x.createImageData(160, 160), r = rng(42);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 13; }
  x.putImageData(d, 0, 0); grain = g.createPattern(c, 'repeat'); return grain;
}

// ---------------------------------------------------------------- astros
export function celestial(V, cam, pal) {
  return {
    sun: { x: V.w * 0.74 - cam * 0.012, y: lerp(V.hor * 0.16, V.hor * 0.98, pal.sunY), r: 30 },
    moon: { x: V.w * 0.27 - cam * 0.006 + 30, y: Math.max(64, V.hor * 0.26), r: 34 },
  };
}
function drawStars(g, V, pal, t) {
  if (pal.night < 0.05) return;
  g.fillStyle = '#fff';
  for (let i = 0; i < 130; i++) {
    const x = hash(i, 1) * V.w, y = hash(i, 2) * V.hor * 0.9, tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i, 3) * 2) + i);
    g.globalAlpha = pal.night * (0.25 + 0.75 * tw) * (1 - (y / V.hor) * 0.7); const s = 0.6 + hash(i, 4) * 1.4; g.fillRect(x, y, s, s);
  }
  g.globalAlpha = pal.night * 0.1; // vía láctea
  const mg = g.createLinearGradient(0, 0, V.w, V.hor * 0.7); mg.addColorStop(0.2, 'rgba(180,200,255,0)'); mg.addColorStop(0.5, 'rgba(200,215,255,1)'); mg.addColorStop(0.8, 'rgba(180,200,255,0)');
  g.fillStyle = mg; g.fillRect(0, 0, V.w, V.hor); g.globalAlpha = 1;
}
function drawSunMoon(g, V, c, pal, t, fx) {
  g.save();
  if (pal.sunA > 0.01) {
    const s = c.sun; g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r * 9); gr.addColorStop(0, A(pal.glow, 0.5 * pal.sunA)); gr.addColorStop(0.3, A(pal.glow, 0.2 * pal.sunA)); gr.addColorStop(1, A(pal.glow, 0));
    g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h);
    // rayos de luz
    g.translate(s.x, s.y); const L = V.w * 0.9; gr = g.createRadialGradient(0, 0, s.r, 0, 0, L); gr.addColorStop(0, A(pal.glow, 0.2 * pal.rays)); gr.addColorStop(1, A(pal.glow, 0)); g.fillStyle = gr;
    for (let i = 0; i < 11; i++) {
      const a = t * 0.025 + (i * TAU) / 11 + Math.sin(t * 0.13 + i * 2) * 0.06, wd = 0.05 + 0.06 * hash(i, 8);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - wd) * L, Math.sin(a - wd) * L); g.lineTo(Math.cos(a + wd) * L, Math.sin(a + wd) * L); g.fill();
    }
    g.setTransform(g.getTransform()); g.translate(-s.x, -s.y); g.globalCompositeOperation = 'source-over';
    g.fillStyle = pal.sun; g.globalAlpha = pal.sunA; ell(g, s.x, s.y, s.r, s.r); g.fill(); g.globalAlpha = 1;
    if (fx.sunFace > 0) { // sol dormilón
      g.strokeStyle = 'rgba(190,110,40,.9)'; g.lineWidth = 2.5; g.lineCap = 'round'; const yawn = Math.sin(Math.min(1, fx.sunFace / 4) * Math.PI);
      g.beginPath(); g.arc(s.x - 10, s.y - 4, 5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); g.beginPath(); g.arc(s.x + 10, s.y - 4, 5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(190,90,60,.9)'; ell(g, s.x, s.y + 11, 4 + yawn * 3, 2 + yawn * 7); g.fill();
      g.fillStyle = 'rgba(255,150,130,.6)'; ell(g, s.x - 18, s.y + 5, 5, 3); g.fill(); ell(g, s.x + 18, s.y + 5, 5, 3); g.fill();
    }
  }
  if (pal.moonA > 0.01) {
    const m = c.moon; g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(m.x, m.y, m.r * 0.6, m.x, m.y, m.r * 6); gr.addColorStop(0, A(pal.glow, 0.42 * pal.moonA)); gr.addColorStop(1, A(pal.glow, 0));
    g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = pal.moonA;
    g.fillStyle = '#fbf6dc'; ell(g, m.x, m.y, m.r, m.r); g.fill();
    g.fillStyle = 'rgba(190,190,170,.35)'; ell(g, m.x - 12, m.y - 8, 8, 6); g.fill(); ell(g, m.x + 10, m.y + 12, 6, 5); g.fill(); ell(g, m.x + 13, m.y - 14, 4, 3); g.fill();
    if (fx.rabbit) { // el conejo de la luna machacando mochi
      const hit = Math.abs(Math.sin(t * 5)); g.fillStyle = 'rgba(120,125,150,.85)'; g.strokeStyle = 'rgba(120,125,150,.85)'; g.lineWidth = 3; g.lineCap = 'round';
      ell(g, m.x - 8, m.y + 6, 9, 11); g.fill(); ell(g, m.x - 6, m.y - 8, 6, 6); g.fill();
      ell(g, m.x - 9, m.y - 19, 2.4, 8, -0.2); g.fill(); ell(g, m.x - 3, m.y - 19, 2.4, 8, 0.25); g.fill();
      g.beginPath(); g.moveTo(m.x, m.y + 2); g.lineTo(m.x + 12, m.y - 8 + hit * 14); g.stroke();
      g.fillRect(m.x + 8, m.y - 14 + hit * 14, 10, 7); g.fillRect(m.x + 6, m.y + 12, 16, 8);
      g.fillStyle = '#fff'; ell(g, m.x + 14, m.y + 11, 6, 3 - hit); g.fill();
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

// ---------------------------------------------------------------- capas lejanas
function ridgeY(wx, base, amp, seed) {
  return base - amp * (0.5 + 0.5 * Math.sin(wx * 0.0031 + seed)) * (0.62 + 0.38 * Math.sin(wx * 0.0113 + seed * 2.1)) - amp * 0.16 * Math.sin(wx * 0.031 + seed * 5) - amp * 0.05 * Math.sin(wx * 0.09 + seed);
}
function ridge(g, V, off, base, amp, seed, col, haze) {
  g.beginPath(); g.moveTo(0, V.h);
  for (let sx = 0; sx <= V.w + 12; sx += 12) g.lineTo(sx, ridgeY(sx + off, base, amp, seed));
  g.lineTo(V.w + 12, V.h); g.closePath();
  const gr = g.createLinearGradient(0, base - amp, 0, base + 30); gr.addColorStop(0, col); gr.addColorStop(1, haze); g.fillStyle = gr; g.fill();
}
function koi(g, x, y, s, t, seed, pal) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const n = 10, body = mixRGB('rgb(255,246,230)', pal.cloudL, 0.4), red = mixRGB('rgb(232,84,74)', pal.cloudS, 0.25);
  if (pal.lantern > 0.05) { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(-40, 0, 4, -40, 0, 90); gr.addColorStop(0, `rgba(255,190,110,${0.3 * pal.lantern})`); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; ell(g, -40, 0, 90, 90); g.fill(); g.globalCompositeOperation = 'source-over'; }
  const py = i => Math.sin(t * 2.2 + seed - i * 0.55) * (2 + i * 1.3);
  g.fillStyle = A(red, 0.85); g.beginPath(); g.moveTo(-n * 9, py(n)); g.quadraticCurveTo(-n * 9 - 18, py(n + 1) - 20, -n * 9 - 34, py(n + 2) - 16); g.quadraticCurveTo(-n * 9 - 20, py(n + 1), -n * 9 - 36, py(n + 2) + 18); g.quadraticCurveTo(-n * 9 - 16, py(n + 1) + 14, -n * 9, py(n)); g.fill();
  for (let i = n; i >= 0; i--) {
    const rr = 15 * Math.sin((Math.PI * (i + 2.2)) / (n + 3.2)) + 2;
    g.fillStyle = hash(i, seed) > 0.55 ? red : body; ell(g, -i * 9, py(i), rr * 1.05, rr); g.fill();
  }
  g.fillStyle = A(red, 0.8); g.beginPath(); g.moveTo(-22, py(2) + 8); g.quadraticCurveTo(-34, py(3) + 30, -46, py(4) + 20); g.quadraticCurveTo(-36, py(3) + 14, -30, py(3) + 8); g.fill();
  g.fillStyle = '#2a2030'; ell(g, 4, py(0) - 3, 2, 2); g.fill();
  g.restore();
}
// el Yamaneko: la montaña que es un gato dormido
function yamaneko(g, x, base, pal, t, wake) {
  g.save(); g.translate(x, base);
  g.beginPath(); g.moveTo(-250, 30); g.bezierCurveTo(-225, -115, -160, -176, -100, -182); g.lineTo(-90, -230); g.lineTo(-48, -190);
  g.quadraticCurveTo(0, -200, 48, -190); g.lineTo(90, -230); g.lineTo(100, -182); g.bezierCurveTo(160, -176, 225, -115, 250, 30); g.closePath();
  const gr = g.createLinearGradient(0, -230, 0, 30); gr.addColorStop(0, mulRGB(pal.far2, 0.9)); gr.addColorStop(1, pal.haze); g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  g.fillStyle = A(pal.hill, 0.55); ell(g, 0, -205, 170, 40); g.fill();
  g.fillStyle = A(pal.forest, 0.5); for (let i = 0; i < 9; i++) { ell(g, -150 + i * 38 + hash(i, 5) * 14, -160 + Math.abs(i - 4) * 14, 15 + hash(i, 6) * 9, 12); g.fill(); }
  g.restore();
  const ink = A(mulRGB(pal.far2, 0.45), 0.8); g.strokeStyle = ink; g.lineWidth = 4; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    if (wake > 0) {
      const o = Math.min(1, wake * 2); g.save(); g.globalCompositeOperation = 'lighter'; const eg = g.createRadialGradient(s * 52, -122, 2, s * 52, -122, 46); eg.addColorStop(0, 'rgba(255,210,90,.55)'); eg.addColorStop(1, 'rgba(255,210,90,0)'); g.fillStyle = eg; ell(g, s * 52, -122, 46, 46); g.fill(); g.restore();
      g.fillStyle = '#ffd96a'; ell(g, s * 52, -122, 22, 15 * o); g.fill(); g.stroke();
      g.fillStyle = '#2a1a2e'; ell(g, s * 52 + Math.sin(t * 2) * 6, -122, 4, 13 * o); g.fill();
    } else { g.beginPath(); g.arc(s * 52, -130, 21, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    g.lineWidth = 2; g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(s * 34, -92 + i * 5); g.lineTo(s * 118, -98 + i * 16); } g.stroke(); g.lineWidth = 4;
  }
  g.fillStyle = ink; g.beginPath(); g.moveTo(-8, -104); g.lineTo(8, -104); g.lineTo(0, -95); g.fill();
  g.lineWidth = 3; g.beginPath(); g.arc(-9, -93, 9, 0.05 * Math.PI, 0.95 * Math.PI); g.stroke(); g.beginPath(); g.arc(9, -93, 9, 0.05 * Math.PI, 0.95 * Math.PI); g.stroke();
  if (!(wake > 0)) { g.fillStyle = A(pal.cloudL, 0.8); g.font = 'italic bold 20px Georgia'; for (let i = 0; i < 3; i++) { const u = (t * 0.35 + i / 3) % 1; g.globalAlpha = (1 - u) * 0.8; g.font = `italic bold ${12 + u * 16}px Georgia`; g.fillText('z', 110 + u * 46 + Math.sin(u * 8) * 5, -200 - u * 70); } g.globalAlpha = 1; }
  g.restore();
}
const hillY = (wx, hor) => hor - 4 - 46 * (0.5 + 0.5 * Math.sin(wx * 0.0042 + 1.3)) - 15 * Math.sin(wx * 0.013);
function hills(g, V, cam, pal, t) {
  const off = cam * 0.25, hor = V.hor;
  g.beginPath(); g.moveTo(0, V.h); for (let sx = 0; sx <= V.w + 12; sx += 12) g.lineTo(sx, hillY(sx + off, hor)); g.lineTo(V.w + 12, V.h); g.closePath();
  const gr = g.createLinearGradient(0, hor - 70, 0, hor + 20); gr.addColorStop(0, pal.hill2); gr.addColorStop(1, pal.hill); g.fillStyle = gr; g.fill();
  tiles(cam, 0.25, 52, V, 40, (i, x) => { // arbolitos en la cresta
    if (hash(i, 11) < 0.35) return; const wx = i * 52 + hash(i, 12) * 30, r = 9 + hash(i, 13) * 9, sx = wx - off;
    g.fillStyle = pal.forest; ell(g, sx, hillY(wx, hor) - r * 0.5, r * 1.15, r); g.fill();
    g.fillStyle = A(pal.rim, 0.22); ell(g, sx + r * 0.3, hillY(wx, hor) - r * 0.8, r * 0.55, r * 0.4); g.fill();
  });
  tiles(cam, 0.25, 610, V, 80, (i, x) => { // casitas con ventana encendida
    const wx = i * 610 + 120 + hash(i, 21) * 300, sx = wx - off, y = hillY(wx, hor) + 6;
    g.fillStyle = mixRGB(pal.cloudL, pal.hill, 0.3); g.fillRect(sx - 14, y - 16, 28, 16);
    g.fillStyle = pal.trunk; g.beginPath(); g.moveTo(sx - 20, y - 15); g.lineTo(sx - 9, y - 29); g.lineTo(sx + 9, y - 29); g.lineTo(sx + 20, y - 15); g.fill();
    g.fillStyle = mixRGB('rgb(60,50,70)', 'rgb(255,214,130)', clamp(pal.lantern * 1.4, 0, 1)); g.fillRect(sx - 4, y - 11, 7, 7);
    if (pal.lantern > 0.1) { g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(sx, y - 8, 1, sx, y - 8, 30); lg.addColorStop(0, `rgba(255,200,110,${0.5 * pal.lantern})`); lg.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = lg; ell(g, sx, y - 8, 30, 30); g.fill(); g.restore(); }
    g.fillStyle = A(pal.cloudL, 0.35); for (let k = 0; k < 4; k++) { const u = (t * 0.25 + k / 4) % 1; ell(g, sx + 8 + Math.sin(u * 5 + i) * 5 + u * 10, y - 32 - u * 34, 3 + u * 6, 3 + u * 5); g.fill(); }
  });
}
function mist(g, V, y, hgt, col, alpha) {
  const gr = g.createLinearGradient(0, y - hgt, 0, y + hgt * 0.4); gr.addColorStop(0, A(col, 0)); gr.addColorStop(0.7, A(col, alpha)); gr.addColorStop(1, A(col, 0));
  g.fillStyle = gr; g.fillRect(0, y - hgt, V.w, hgt * 1.4);
}
function torii(g, x, y, pal) {
  const red = mixRGB('rgb(206,66,56)', pal.haze, 0.25); g.fillStyle = mulRGB(red, pal.ambRGB[0] * 0.9 + 0.1);
  g.fillRect(x - 34, y - 78, 8, 78); g.fillRect(x + 26, y - 78, 8, 78); g.fillRect(x - 40, y - 62, 80, 6);
  g.beginPath(); g.moveTo(x - 52, y - 88); g.quadraticCurveTo(x, y - 78, x + 52, y - 88); g.lineTo(x + 50, y - 78); g.quadraticCurveTo(x, y - 69, x - 50, y - 78); g.fill();
}
function bamboo(g, x, y, pal, t, i) {
  for (let k = 0; k < 4; k++) {
    const bx = x + k * 17 - 26 + hash(i * 7 + k, 3) * 8, hgt = 190 + hash(i * 7 + k, 4) * 110, sw = Math.sin(t * 0.8 + i + k) * 7;
    g.strokeStyle = k % 2 ? pal.tree : mulRGB(pal.tree, 0.8); g.lineWidth = 6; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx, y - hgt * 0.5, bx + sw, y - hgt); g.stroke();
    g.strokeStyle = A(pal.rim, 0.35); g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx + 2, y); g.quadraticCurveTo(bx + 2, y - hgt * 0.5, bx + sw + 2, y - hgt); g.stroke();
    g.fillStyle = mulRGB(pal.tree, 0.6); for (let n = 1; n < 6; n++) g.fillRect(bx - 3.5 + (sw * n * n) / 36, y - (hgt * n) / 6, 7, 2);
    g.fillStyle = pal.tree; for (let n = 0; n < 5; n++) ell(g, bx + sw + (n - 2) * 12, y - hgt + 8 + Math.abs(n - 2) * 9, 14, 3.5, (n - 2) * 0.5 + Math.sin(t + n) * 0.1), g.fill();
  }
}
function stoneLantern(g, x, y, pal, t, i) {
  const st = mixRGB(mulRGB(pal.far1, 0.75), 'rgb(150,150,150)', 0.3);
  g.fillStyle = st; g.fillRect(x - 11, y - 6, 22, 6); g.fillRect(x - 4, y - 30, 8, 24); g.fillRect(x - 10, y - 46, 20, 16);
  g.beginPath(); g.moveTo(x - 17, y - 45); g.quadraticCurveTo(x, y - 62, x + 17, y - 45); g.fill(); ell(g, x, y - 58, 3.5, 3.5); g.fill();
  g.fillStyle = A(pal.grass, 0.6); ell(g, x - 5, y - 52, 8, 3); g.fill();
  const on = clamp(pal.lantern * 1.3, 0, 1), fl = 0.85 + 0.15 * Math.sin(t * 9 + i * 3) * Math.sin(t * 5.3 + i);
  g.fillStyle = mixRGB('rgb(50,45,60)', 'rgb(255,214,120)', on); g.fillRect(x - 6, y - 43, 12, 10);
  if (on > 0.05) { g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(x, y - 38, 2, x, y - 38, 84); lg.addColorStop(0, `rgba(255,190,90,${0.6 * on * fl})`); lg.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = lg; ell(g, x, y - 38, 84, 84); g.fill();
    const gl = g.createRadialGradient(x, y + 34, 2, x, y + 34, 130); gl.addColorStop(0, `rgba(255,180,90,${0.32 * on * fl})`); gl.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = gl; g.save(); g.translate(x, y + 34); g.scale(1, 0.33); ell(g, 0, 0, 130, 130); g.fill(); g.restore(); g.restore(); }
}

// ---------------------------------------------------------------- fondo completo
export function drawBack(g, V, cam, t, pal, fx) {
  const { w, h, hor } = V;
  let gr = g.createLinearGradient(0, 0, 0, hor + 30); gr.addColorStop(0, pal.skyTop); gr.addColorStop(0.58, pal.skyMid); gr.addColorStop(1, pal.skyBot);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  drawStars(g, V, pal, t);
  const cel = celestial(V, cam, pal);
  drawSunMoon(g, V, cel, pal, t, fx);
  // cúmulos gigantes del horizonte
  tiles(cam + t * 3, 0.035, 430, V, 520, (i, x) => { const s = 1.25 + hash(i, 31) * 0.9, c = cloudSprite(1 + ((i % 5) + 5) % 5, pal); g.drawImage(c, x + hash(i, 32) * 160 - 280 * s, hor - 232 * s + 30 + hash(i, 33) * 40, 560 * s, 300 * s); });
  // koi del cielo
  tiles(cam + t * 14, 0.1, 900, V, 220, (i, x) => { koi(g, x + hash(i, 41) * 400, hor * (0.22 + hash(i, 42) * 0.3) + Math.sin(t * 0.4 + i) * 12, 0.55 + hash(i, 43) * 0.5, t, i * 3.1, pal); });
  ridge(g, V, cam * 0.07 + 300, hor + 6, 150, 1.7, pal.far1, pal.haze);
  tiles(cam + t * 6, 0.09, 520, V, 400, (i, x) => { const s = 0.5 + hash(i, 51) * 0.45, c = cloudSprite(6 + ((i % 4) + 4) % 4, pal); g.globalAlpha = 0.85; g.drawImage(c, x + hash(i, 52) * 200 - 280 * s, hor * (0.3 + hash(i, 53) * 0.42) - 150 * s, 560 * s, 300 * s); g.globalAlpha = 1; });
  tiles(cam, 0.14, 2300, V, 300, (i, x) => yamaneko(g, x + 760, hor + 8, pal, t, fx.wake));
  ridge(g, V, cam * 0.14, hor + 8, 92, 4.2, pal.far2, pal.haze);
  mist(g, V, hor - 6, 90, pal.haze, 0.55);
  hills(g, V, cam, pal, t);
  mist(g, V, hor + 4, 46, pal.haze, 0.4);
  // bosque redondo y torii
  tiles(cam, 0.42, 96, V, 150, (i, x) => {
    if (((i % 16) + 16) % 16 === 7) { torii(g, x, hor + 12, pal); return; }
    if (hash(i, 63) < 0.42) return;
    const s = 0.4 + hash(i, 61) * 0.3, c = treeSprite(((i % 4) + 4) % 4, pal.forest, pal, 'f'); g.drawImage(c, x + hash(i, 62) * 50 - 120 * s, hor + 14 - 290 * s, 240 * s, 290 * s);
  });
  mist(g, V, hor + 12, 30, pal.haze, 0.25);
  tiles(cam, 0.68, 470, V, 260, (i, x) => {
    if (hash(i, 71) < 0.3) return; const s = 0.95 + hash(i, 72) * 0.45, c = treeSprite(4 + ((i % 3) + 3) % 3, pal.tree, pal, 'n');
    g.save(); g.translate(x + hash(i, 73) * 150, hor + 22); g.rotate(Math.sin(t * 0.6 + i) * 0.012); g.drawImage(c, -120 * s, -290 * s, 240 * s, 290 * s); g.restore();
  });
  tiles(cam, 0.84, 1180, V, 120, (i, x) => bamboo(g, x + hash(i, 81) * 300, hor + 22, pal, t, i));
  // ---- suelo ----
  const gy = hor + 16;
  gr = g.createLinearGradient(0, gy, 0, h); gr.addColorStop(0, pal.ground); gr.addColorStop(1, pal.ground2); g.fillStyle = gr; g.fillRect(0, gy, w, h - gy);
  g.fillStyle = pal.grass; g.beginPath(); g.moveTo(0, gy + 4);
  for (let sx = -((cam % 9) + 9) % 9; sx <= w + 9; sx += 9) { const k = Math.round((sx + cam) / 9); g.lineTo(sx, gy - 4 - hash(k, 91) * 9); g.lineTo(sx + 4.5, gy + 3); }
  g.lineTo(w, gy + 4); g.fill();
  g.fillStyle = pal.path; g.beginPath();
  for (let sx = 0; sx <= w + 24; sx += 24) { const wx = sx + cam; g.lineTo(sx, hor + 46 + Math.sin(wx * 0.012) * 5 + Math.sin(wx * 0.05) * 2); }
  for (let sx = w + 24; sx >= 0; sx -= 24) { const wx = sx + cam; g.lineTo(sx, h - 36 + Math.sin(wx * 0.01 + 2) * 6 + Math.sin(wx * 0.045) * 2); }
  g.fill();
  const lane = h - 36 - (hor + 46);
  tiles(cam, 1, 70, V, 40, (i, x) => { // guijarros y matas
    g.fillStyle = mulRGB(pal.path, 0.86); ell(g, x + hash(i, 101) * 60, hor + 52 + hash(i, 102) * (lane - 14), 5 + hash(i, 103) * 7, 2 + hash(i, 103) * 2); g.fill();
    if (hash(i, 104) < 0.4) { const tx = x + hash(i, 105) * 60, ty = hash(i, 106) < 0.5 ? hor + 30 + hash(i, 107) * 14 : h - 30 + hash(i, 107) * 16; g.strokeStyle = pal.grassDark; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(tx + k * 3, ty); g.quadraticCurveTo(tx + k * 5, ty - 8, tx + k * 8 + Math.sin(t * 2 + i) * 2, ty - 12); } g.stroke(); }
    if (hash(i, 108) < 0.5) { const fx2 = x + hash(i, 109) * 60, fy = hash(i, 110) < 0.5 ? hor + 26 + hash(i, 111) * 16 : h - 26 + hash(i, 111) * 18; g.fillStyle = mixRGB(['rgb(255,255,255)', 'rgb(255,190,210)', 'rgb(255,226,120)'][(hash(i, 112) * 3) | 0], pal.ground2, pal.night * 0.5); for (let k = 0; k < 5; k++) { ell(g, fx2 + Math.cos(k * 1.257) * 2.6, fy + Math.sin(k * 1.257) * 2.2, 1.9, 1.7); g.fill(); } g.fillStyle = 'rgb(255,200,80)'; ell(g, fx2, fy, 1.2, 1.1); g.fill(); }
  });
  g.save(); g.globalCompositeOperation = 'soft-light'; // luz moteada entre las hojas
  tiles(cam, 1, 210, V, 160, (i, x) => { g.fillStyle = A(pal.rim, 0.5 * (1 - pal.night * 0.6)); ell(g, x + hash(i, 121) * 150 + Math.sin(t * 0.5 + i) * 12, hor + 56 + hash(i, 122) * (lane - 20), 60 + hash(i, 123) * 70, 10 + hash(i, 124) * 10); g.fill(); });
  g.restore();
  tiles(cam, 1, 640, V, 160, (i, x) => stoneLantern(g, x + 180 + hash(i, 131) * 90, hor + 28, pal, t, i));
  return cel;
}
export const spiritSpots = (cam, V, fn) => tiles(cam, 1, 1040, V, 60, (i, x) => fn(x + 520 + hash(i, 141) * 200, i));

// ---------------------------------------------------------------- primer plano + luz
const motes = [];
export function drawFront(g, V, cam, dcam, t, dt, pal, cel) {
  const { w, h } = V;
  if (!motes.length) for (let i = 0; i < 80; i++) motes.push({ x: hash(i, 201) * 1400, y: hash(i, 202), ph: hash(i, 203) * 10, s: 0.6 + hash(i, 204) });
  // hojas / pétalos de día, luciérnagas de noche
  for (let i = 0; i < motes.length; i++) {
    const m = motes[i], fire = i % 2 === 1, a = fire ? pal.night : 1 - pal.night;
    m.x -= (fire ? 6 : 34 * m.s) * dt + dcam * (0.9 + m.s * 0.6); m.ph += dt * (fire ? 1.2 : 2.4);
    if (m.x < -20) m.x += w + 40; if (m.x > w + 20) m.x -= w + 40;
    if (a < 0.03) continue;
    const y = fire ? V.hor - 150 + m.y * 230 + Math.sin(m.ph) * 18 : ((m.y * h + t * 26 * m.s + Math.sin(m.ph) * 20) % (h + 20)) - 10, x = m.x + (fire ? Math.cos(m.ph * 0.7) * 20 : 0);
    if (fire) {
      const p = 0.5 + 0.5 * Math.sin(m.ph * 3); g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y, 0, x, y, 8); gr.addColorStop(0, `rgba(225,255,150,${0.95 * a * p})`); gr.addColorStop(0.25, `rgba(210,255,130,${0.4 * a * p})`); gr.addColorStop(1, 'rgba(220,255,140,0)'); g.fillStyle = gr; ell(g, x, y, 8, 8); g.fill(); g.restore();
    } else {
      g.save(); g.translate(x, y); g.rotate(m.ph); g.globalAlpha = a * 0.85;
      g.fillStyle = i % 4 === 0 ? mixRGB('rgb(255,190,205)', pal.cloudL, 0.3) : mixRGB(pal.hill2, pal.rim, 0.3); ell(g, 0, 0, 5 * m.s, 2.2 * m.s * Math.abs(Math.cos(m.ph * 1.3)) + 0.5); g.fill(); g.restore();
    }
  }
  // hierba cercana meciéndose
  g.fillStyle = pal.fg;
  tiles(cam, 1.5, 58, V, 60, (i, x) => {
    const n = 4 + ((hash(i, 211) * 3) | 0);
    for (let k = 0; k < n; k++) {
      const bx = x + k * 9 + hash(i * 9 + k, 212) * 8, hgt = 26 + hash(i * 9 + k, 213) * 58 * (0.4 + hash(i, 214)), sw = Math.sin(t * 1.6 + i + k * 0.7) * 7 + (k - n / 2) * 5;
      g.beginPath(); g.moveTo(bx - 4, h + 4); g.quadraticCurveTo(bx - 2, h - hgt * 0.6, bx + sw, h - hgt); g.quadraticCurveTo(bx + 3, h - hgt * 0.5, bx + 5, h + 4); g.fill();
    }
    if (hash(i, 215) < 0.22) { const fx2 = x + 20, fy = h - 34 - hash(i, 216) * 20 + Math.sin(t * 1.6 + i) * 2; g.fillStyle = mixRGB('rgb(255,236,214)', pal.fg, 0.25 + pal.night * 0.4); for (let k = 0; k < 5; k++) { ell(g, fx2 + Math.cos(k * 1.257) * 5, fy + Math.sin(k * 1.257) * 5, 3.6, 3.6); g.fill(); } g.fillStyle = pal.fg; }
  });
  // farolillos colgantes y bambú en silueta, muy cerca de la cámara
  tiles(cam, 1.7, 1250, V, 120, (i, x) => {
    const lx = x + 300 + hash(i, 221) * 400, sw = Math.sin(t * 1.1 + i) * 0.1, len = 54 + hash(i, 222) * 50;
    g.save(); g.translate(lx, -6); g.rotate(sw); g.strokeStyle = pal.fg; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
    const lit = 0.35 + 0.65 * pal.lantern; g.fillStyle = mixRGB('rgb(150,50,45)', 'rgb(255,120,70)', lit); g.beginPath(); g.ellipse(0, len + 22, 17, 22, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,10,10,.35)'; g.lineWidth = 1.2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(0, len + 22, Math.abs(k) * 7 + 2, 22, 0, 0, TAU); g.stroke(); }
    g.fillStyle = pal.fg; g.fillRect(-7, len - 2, 14, 5); g.fillRect(-6, len + 42, 12, 4);
    g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0, len + 22, 2, 0, len + 22, 120); gr.addColorStop(0, `rgba(255,150,80,${0.5 * lit})`); gr.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gr; ell(g, 0, len + 22, 120, 120); g.fill();
    g.restore();
  });
  tiles(cam, 2.1, 3100, V, 200, (i, x) => {
    g.globalAlpha = 0.5; g.fillStyle = A(pal.fg, 0.93);
    for (let k = 0; k < 2; k++) { const bx = x + 700 + k * 62 + hash(i, 231) * 300, bw = 20 - k * 7; g.fillRect(bx, -10, bw, h + 20); g.fillStyle = A(mulRGB(pal.fg, 1.6), 0.9); for (let n = 0; n < 5; n++) g.fillRect(bx - 2, 40 + n * (h / 5) + k * 40, bw + 4, 4); g.fillStyle = A(pal.fg, 0.93); for (let n = 0; n < 4; n++) { ell(g, bx + bw + 28 + n * 8, 60 + n * 22 + k * 30 + Math.sin(t + n) * 3, 34, 6, 0.5 + n * 0.12); g.fill(); } }
    g.globalAlpha = 1;
  });
  // resplandor del sol sobre la lente, etalonaje, viñeta y grano de papel
  g.save();
  if (pal.sunA > 0.01) { g.globalCompositeOperation = 'lighter'; const s = cel.sun, gr = g.createRadialGradient(s.x, s.y, 10, s.x, s.y, w * 0.62); gr.addColorStop(0, A(pal.glow, 0.2)); gr.addColorStop(1, A(pal.glow, 0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.globalCompositeOperation = 'soft-light'; g.fillStyle = A(pal.grade, 0.26); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  const vg = g.createRadialGradient(w / 2, h * 0.52, h * 0.42, w / 2, h * 0.52, Math.max(w, h) * 0.78); vg.addColorStop(0, 'rgba(12,6,34,0)'); vg.addColorStop(1, 'rgba(12,6,34,.5)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'overlay'; g.fillStyle = grainPattern(g); g.fillRect(0, 0, w, h);
  g.restore();
}
