import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNE, LANE, jumpPeak, stepBody, inReach, inRadius, SecretCodes, CODES, Director, LEVEL,
  paletteAt, applyDamage, nextCombo, ENEMY } from '../src/core.js';

test('Mochi casi no salta: menos de un tercio que un ninja', () => {
  assert.ok(jumpPeak(TUNE.playerJumpV) < 30);
  assert.ok(jumpPeak(TUNE.ninjaJumpV) >= 3 * jumpPeak(TUNE.playerJumpV));
});

test('stepBody: gravedad, aterrizaje y límite de carril', () => {
  const b = { x: 0, y: 0, z: 60, vx: 100, vy: TUNE.playerJumpV, vz: 0 };
  let landed = false, peak = 0, n = 0;
  while (!landed && n++ < 1000) { landed = stepBody(b, 1 / 120); peak = Math.max(peak, b.y); }
  assert.ok(landed); assert.equal(b.y, 0); assert.equal(b.vy, 0);
  assert.ok(Math.abs(peak - jumpPeak(TUNE.playerJumpV)) < 1.5);
  b.vz = 9999; stepBody(b, 1); assert.equal(b.z, LANE.zMax);
  b.vz = -9999; stepBody(b, 1); assert.equal(b.z, LANE.zMin);
  b.vx = 9999; stepBody(b, 1, [0, 50]); assert.equal(b.x, 50);
});

test('inReach: solo de frente y a la misma profundidad', () => {
  const a = { x: 100, y: 0, z: 50, face: 1 };
  assert.ok(inReach(a, { x: 150, y: 0, z: 55 }, 70));
  assert.ok(!inReach(a, { x: 50, y: 0, z: 50 }, 70), 'de espaldas');
  assert.ok(!inReach(a, { x: 150, y: 0, z: 90 }, 70), 'otra profundidad');
  assert.ok(!inReach(a, { x: 190, y: 0, z: 50 }, 70), 'lejos');
  a.face = -1; assert.ok(inReach(a, { x: 50, y: 0, z: 50 }, 70));
  assert.ok(inRadius(a, { x: 130, z: 60 }, 60)); assert.ok(!inRadius(a, { x: 130, z: 110 }, 60));
});

test('SecretCodes: konami y palabras sobre un flujo con ruido', () => {
  const s = new SecretCodes(CODES); const out = [];
  for (const k of ['x', 'ArrowUp', ...CODES.konami, 'q', ...'momochi', ...'fable']) { const r = s.feed(k); if (r) out.push(r); }
  assert.deepEqual(out, ['konami', 'mochi', 'fable']);
});

test('Director: oleadas en orden, bloqueo y final', () => {
  const lvl = { arenas: [{ x: 500, waves: [['grunt'], ['brute']] }, { x: 900, waves: [['boss']] }] };
  const d = new Director(lvl);
  assert.equal(d.update(100, 0), null);
  let ev = d.update(400, 0); assert.equal(ev.type, 'spawn'); assert.deepEqual(ev.kinds, ['grunt']); assert.ok(d.locked);
  assert.equal(d.update(400, 1), null);
  ev = d.update(400, 0); assert.deepEqual(ev.kinds, ['brute']);
  ev = d.update(400, 0); assert.equal(ev.type, 'clear'); assert.ok(!d.locked); assert.ok(!ev.done);
  ev = d.update(800, 0); assert.deepEqual(ev.kinds, ['boss']);
  ev = d.update(800, 0); assert.ok(ev.done); assert.equal(d.update(9999, 0), null);
});

test('LEVEL: termina con jefe y solo usa enemigos definidos', () => {
  const kinds = LEVEL.arenas.flatMap(a => a.waves.flat());
  for (const k of kinds) assert.ok(ENEMY[k], k);
  assert.deepEqual(LEVEL.arenas.at(-1).waves.at(-1), ['boss']);
  assert.ok(LEVEL.arenas.every(a => a.x < LEVEL.length));
});

test('paletteAt: de tarde a noche', () => {
  const a = paletteAt(0), z = paletteAt(1), m = paletteAt(0.5);
  assert.equal(a.night, 0); assert.equal(z.night, 1);
  assert.ok(m.night > 0 && m.night < 1);
  assert.match(m.skyTop, /^rgb\(\d+,\d+,\d+\)$/);
  assert.equal(a.ambRGB.length, 3); assert.notEqual(a.ver, z.ver);
});

test('daño y combo', () => {
  const e = { hp: 20 };
  assert.equal(applyDamage(e, 8), false); assert.equal(applyDamage(e, 50), true); assert.equal(e.hp, 0);
  assert.equal(nextCombo(0, 0), 1); assert.equal(nextCombo(1, 0.2), 2);
  assert.equal(nextCombo(2, 0.2), 3); assert.equal(nextCombo(3, 0.2), 1); assert.equal(nextCombo(2, 0), 1);
});

test('rangos de combo: suben con los golpes y multiplican la puntuación', async () => {
  const { rankIdx, rankMult, RANKS } = await import('../src/core.js');
  assert.equal(rankIdx(0), 0); assert.equal(RANKS[rankIdx(5)][1], 'C'); assert.equal(RANKS[rankIdx(27)][1], 'A');
  assert.equal(RANKS[rankIdx(999)][1], 'MOCHI'); assert.equal(rankMult(0), 1); assert.ok(rankMult(28) > rankMult(10));
});
