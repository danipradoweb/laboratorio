// @ts-check
// Tests de src/ui/plot-math.js (cálculos del trazador que no dependen del DOM).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceStep, niceTicks, formatTick, extent, padRange, linearScale } from '../src/ui/plot-math.js';

test('niceStep devuelve 1, 2 o 5 por una potencia de 10', () => {
  assert.equal(niceStep(10, 5), 2);
  assert.equal(niceStep(1, 5), 0.2);
  assert.equal(niceStep(100, 4), 20);
  assert.equal(niceStep(7, 7), 1);
  assert.ok(Math.abs(niceStep(0.03, 6) - 0.005) < 1e-15);
  for (const [span, target] of [[3.7, 6], [1234, 8], [0.00042, 5], [9e9, 3]]) {
    const step = niceStep(span, target);
    const mantissa = step / Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
    assert.ok([1, 2, 5].some((m) => Math.abs(mantissa - m) < 1e-9), `paso ${step}`);
  }
});

test('niceTicks: marcas redondas, dentro del intervalo y sin colas de redondeo', () => {
  assert.deepEqual(niceTicks(0, 1, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(0, 3, 6).ticks, [0, 0.5, 1, 1.5, 2, 2.5, 3]);
  assert.deepEqual(niceTicks(-1, 1, 4).ticks, [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual(niceTicks(0.05, 0.95, 5).ticks, [0.2, 0.4, 0.6, 0.8]);
  assert.deepEqual(niceTicks(380, 780, 5).ticks, [400, 500, 600, 700]);
  for (const [min, max] of [[-3.3, 7.1], [1e-6, 9e-6], [100, 100.4], [-2e5, 3e5]]) {
    const { ticks, step } = niceTicks(min, max, 6);
    assert.ok(ticks.length >= 3 && ticks.length <= 12, `${ticks.length} marcas en [${min}, ${max}]`);
    for (const t of ticks) assert.ok(t >= min - step * 1e-6 && t <= max + step * 1e-6);
    for (let i = 1; i < ticks.length; i++) {
      assert.ok(Math.abs(ticks[i] - ticks[i - 1] - step) < step * 1e-6);
    }
  }
});

test('niceTicks con intervalos degenerados no falla', () => {
  assert.deepEqual(niceTicks(2, 2).ticks, [2]);
  assert.deepEqual(niceTicks(NaN, 1).ticks, []);
});

test('formatTick: coma decimal, decimales según el paso y notación 10ⁿ', () => {
  assert.equal(formatTick(0.5, 0.5), '0,5');
  assert.equal(formatTick(1, 0.5), '1,0');
  assert.equal(formatTick(2, 1), '2');
  assert.equal(formatTick(-0.25, 0.05), '−0,25');
  assert.equal(formatTick(0, 0.1), '0');
  assert.equal(formatTick(400, 100), '400');
  assert.equal(formatTick(200000, 100000), '2·10⁵');
  assert.equal(formatTick(2.5e-6, 5e-7), '2,5·10⁻⁶');
  assert.equal(formatTick(-3e8, 1e8), '−3·10⁸');
});

test('extent ignora NaN e infinitos; padRange ensancha', () => {
  assert.deepEqual(extent([[1, NaN, 3], undefined, new Float64Array([-2, Infinity])]), [-2, 3]);
  assert.equal(extent([[NaN], []]), null);
  assert.deepEqual(padRange([0, 10], 0.1), [-1, 11]);
  assert.deepEqual(padRange([5, 5], 0.1), [4.5, 5.5]);
  assert.deepEqual(padRange([0, 0], 0.1), [-1, 1]);
});

test('linearScale: ida y vuelta, también con el eje invertido (y de pantalla)', () => {
  const y = linearScale(0, 10, 300, 20); // dato 0 abajo (píxel 300), dato 10 arriba (píxel 20)
  assert.equal(y.toPixel(0), 300);
  assert.equal(y.toPixel(10), 20);
  assert.equal(y.toPixel(5), 160);
  assert.ok(Math.abs(y.toData(y.toPixel(3.7)) - 3.7) < 1e-12);
});
