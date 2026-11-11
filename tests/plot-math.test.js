// @ts-check
// Tests de src/ui/plot-math.js (cálculos del trazador que no dependen del DOM).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceStep, niceTicks, formatTick, formatTicks, extent, padRange, linearScale } from '../src/ui/plot-math.js';

// Criterio de diseño: las marcas de un eje se leen bien si avanzan de 1 en 1, de 2 en 2 o
// de 5 en 5 (por una potencia de 10). Valores esperados: calculados a mano.
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

// Criterio: las marcas son múltiplos exactos del paso, caen dentro del intervalo y no
// arrastran errores de coma flotante (0.30000000000000004). Valores esperados: a mano.
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

// Robustez: un intervalo de longitud cero o no numérico no debe lanzar un error.
test('niceTicks con intervalos degenerados no falla', () => {
  assert.deepEqual(niceTicks(2, 2).ticks, [2]);
  assert.deepEqual(niceTicks(NaN, 1).ticks, []);
});

// Convenio de escritura en español (coma decimal, signo menos tipográfico) y notación
// mantisa·10ⁿ para valores muy grandes o muy pequeños. Valores esperados: a mano.
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

// Definición de mínimo y máximo ignorando valores no finitos, y de ensanchar un
// intervalo una fracción de su longitud. Valores esperados: a mano.
test('extent ignora NaN e infinitos; padRange ensancha', () => {
  assert.deepEqual(extent([[1, NaN, 3], undefined, new Float64Array([-2, Infinity])]), [-2, 3]);
  assert.equal(extent([[NaN], []]), null);
  assert.deepEqual(padRange([0, 10], 0.1), [-1, 11]);
  assert.deepEqual(padRange([5, 5], 0.1), [4.5, 5.5]);
  assert.deepEqual(padRange([0, 0], 0.1), [-1, 1]);
});

// Una escala lineal queda fijada por dos puntos; pasar a píxeles y volver devuelve el dato.
test('linearScale: ida y vuelta, también con el eje invertido (y de pantalla)', () => {
  const y = linearScale(0, 10, 300, 20); // dato 0 abajo (píxel 300), dato 10 arriba (píxel 20)
  assert.equal(y.toPixel(0), 300);
  assert.equal(y.toPixel(10), 20);
  assert.equal(y.toPixel(5), 160);
  assert.ok(Math.abs(y.toData(y.toPixel(3.7)) - 3.7) < 1e-12);
});

// Principio: un rótulo no puede enseñar un número distinto del valor de la marca. Con
// marcas fijadas a mano cada 0,25 (o cada 1,5), deducir los decimales solo del paso las
// redondearía a 0,3 y 0,8 (o a 2 y 5). Valores esperados: los propios valores, escritos
// con los decimales justos.
test('formatTicks: marcas cada 0,25 y cada 1,5 se escriben exactas', () => {
  assert.deepEqual(formatTicks([0, 0.25, 0.5, 0.75, 1], 0.25), ['0', '0,25', '0,50', '0,75', '1,00']);
  assert.deepEqual(formatTicks([0, 1.5, 3, 4.5], 1.5), ['0', '1,5', '3,0', '4,5']);
  assert.deepEqual(formatTicks([0, 45, 90, 135, 180], 45), ['0', '45', '90', '135', '180']);
});

// Principio: en un eje, dos marcas distintas llevan rótulos distintos, y cada rótulo,
// leído como número, devuelve el valor de su marca. Caso difícil: un intervalo muy
// estrecho comparado con su valor (por ejemplo, alrededor de c = 299 792 458).
test('formatTicks: rótulos distintos y exactos en intervalos muy estrechos', () => {
  /** @param {string} label */
  const parse = (label) => {
    const [mantissa, exponent] = label.replace('−', '-').replace(',', '.').split('·10');
    if (exponent === undefined) return Number(mantissa);
    const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const e = [...exponent].map((ch) => (ch === '⁻' ? '-' : String(digits.indexOf(ch)))).join('');
    return Number(mantissa) * Math.pow(10, Number(e));
  };
  for (const [min, max] of [
    [1234565, 1234568],
    [299792457.2, 299792458.9],
    [0.00366143, 0.00366147],
    [-3.3, 7.1],
    [1e-9, 5e-9],
    [99999.2, 100000.9],
  ]) {
    const { ticks, step } = niceTicks(min, max, 6);
    const labels = formatTicks(ticks, step);
    assert.equal(new Set(labels).size, labels.length, `rótulos repetidos en [${min}, ${max}]: ${labels}`);
    labels.forEach((label, i) => {
      assert.ok(Math.abs(parse(label) - ticks[i]) <= step * 1e-5, `"${label}" no representa ${ticks[i]}`);
    });
  }
});
