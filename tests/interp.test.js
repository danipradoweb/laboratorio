// @ts-check
// Tests de src/core/interp.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinearInterpolator, createNaturalSpline, interpLinear } from '../src/core/interp.js';

/**
 * Tabla de f en n+1 nodos equiespaciados de [a, b].
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n número de intervalos
 */
function table(f, a, b, n) {
  const xs = Float64Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  xs[n] = b;
  return { xs, ys: xs.map(f) };
}

/**
 * Error máximo de un interpolador frente a f, muestreando fino.
 * @param {(x: number) => number} p
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 */
function maxError(p, f, a, b) {
  let err = 0;
  const samples = 2000;
  for (let i = 0; i <= samples; i++) {
    const x = Math.min(b, a + ((b - a) * i) / samples);
    err = Math.max(err, Math.abs(p(x) - f(x)));
  }
  return err;
}

// Nodos no equiespaciados, para no depender de una malla regular.
const irregular = [0, 0.3, 0.5, 1.4, 2, 2.1, 3.7, 5];

// Principio: una función lineal queda determinada por dos puntos; ambos métodos deben
// reproducirla exactamente (salvo redondeo) con cualquier malla.
test('lineal y spline reproducen exactamente una función lineal', () => {
  const f = (/** @type {number} */ x) => 3 - 2.5 * x;
  const ys = irregular.map(f);
  const lin = createLinearInterpolator(irregular, ys);
  const spl = createNaturalSpline(irregular, ys);
  for (let x = 0; x <= 5; x += 0.0625) {
    assert.ok(Math.abs(lin(x) - f(x)) < 1e-13, `lineal en x=${x}`);
    assert.ok(Math.abs(spl(x) - f(x)) < 1e-13, `spline en x=${x}`);
  }
});

// Principio: un interpolador pasa por los puntos de la tabla.
test('ambos interpoladores pasan por los nodos', () => {
  const ys = irregular.map((x) => Math.exp(-x) * Math.cos(3 * x));
  const lin = createLinearInterpolator(irregular, ys);
  const spl = createNaturalSpline(irregular, ys);
  irregular.forEach((x, i) => {
    assert.ok(Math.abs(lin(x) - ys[i]) < 1e-14);
    assert.ok(Math.abs(spl(x) - ys[i]) < 1e-14);
  });
});

// Principio: el error de la interpolación lineal está acotado por (h²/8)·max|f″| y es de
// orden 2: al dividir h entre 2, el error se divide entre 4. Función: sen x en [0, π],
// con max|f″| = 1.
test('interpolación lineal: cota h²/8 y orden 2', () => {
  /** @type {number[]} */
  const errors = [];
  for (const n of [10, 20, 40, 80]) {
    const { xs, ys } = table(Math.sin, 0, Math.PI, n);
    const err = maxError(createLinearInterpolator(xs, ys), Math.sin, 0, Math.PI);
    const h = Math.PI / n;
    assert.ok(err <= (h * h) / 8, `n=${n}: error ${err} supera la cota ${(h * h) / 8}`);
    errors.push(err);
  }
  for (let i = 1; i < errors.length; i++) {
    const ratio = errors[i - 1] / errors[i];
    assert.ok(ratio > 3.8 && ratio < 4.2, `razón de errores ${ratio}, esperada ≈ 4`);
  }
});

// Principio: la spline cúbica tiene error de orden 4 (al dividir h entre 2, el error se
// divide entre 16) cuando la condición de contorno es exacta. Se usa sen x en [0, π]
// precisamente porque f″ = −sen x se anula en ambos extremos, así que la condición
// natural (S″ = 0) es exacta y vale la cota clásica (5/384)·h⁴·max|f⁗| con max|f⁗| = 1.
test('spline natural: orden 4 y cota (5/384)·h⁴ en sen x sobre [0, π]', () => {
  /** @type {number[]} */
  const errors = [];
  for (const n of [8, 16, 32, 64]) {
    const { xs, ys } = table(Math.sin, 0, Math.PI, n);
    const err = maxError(createNaturalSpline(xs, ys), Math.sin, 0, Math.PI);
    const h = Math.PI / n;
    assert.ok(err <= (5 / 384) * h ** 4, `n=${n}: error ${err}`);
    errors.push(err);
  }
  for (let i = 1; i < errors.length; i++) {
    const ratio = errors[i - 1] / errors[i];
    assert.ok(ratio > 14.5 && ratio < 17.5, `razón de errores ${ratio}, esperada ≈ 16`);
  }
});

// Principio: definición de spline "natural": segunda derivada nula en los extremos.
// Dentro de un intervalo la spline es un polinomio cúbico, para el que la diferencia
// central segunda [S(x−d) − 2S(x) + S(x+d)]/d² es exactamente S″(x). Como S″ es lineal
// en el intervalo, S″(extremo) = 2·S″(extremo ± d) − S″(extremo ± 2d).
// Función de prueba: eˣ, cuya segunda derivada NO se anula en los extremos.
test('spline natural: S″ = 0 en los dos extremos', () => {
  const { xs, ys } = table(Math.exp, 0, 2, 8);
  const s = createNaturalSpline(xs, ys);
  const d = 0.25 / 4;
  /** @param {number} x */
  const second = (x) => (s(x - d) - 2 * s(x) + s(x + d)) / (d * d);
  const left = 2 * second(0 + d) - second(0 + 2 * d);
  const right = 2 * second(2 - d) - second(2 - 2 * d);
  assert.ok(Math.abs(left) < 1e-9, `S″(0) = ${left}`);
  assert.ok(Math.abs(right) < 1e-9, `S″(2) = ${right}`);
});

// Principio: la spline tiene primera y segunda derivadas continuas en los nodos
// interiores. Se comparan las derivadas laterales, calculadas con diferencias exactas
// para cúbicas a cada lado del nodo.
test('spline natural: derivadas primera y segunda continuas en los nodos', () => {
  const xs = [0, 0.5, 1.5, 2, 3];
  const ys = xs.map((x) => Math.cos(2 * x) + x);
  const s = createNaturalSpline(xs, ys);
  const d = 0.05;
  for (const node of [0.5, 1.5, 2]) {
    // Segunda derivada lateral: diferencia segunda centrada en node ∓ d, extrapolada al nodo.
    /** @param {number} x */
    const second = (x) => (s(x - d) - 2 * s(x) + s(x + d)) / (d * d);
    const secondLeft = 2 * second(node - d) - second(node - 2 * d);
    const secondRight = 2 * second(node + d) - second(node + 2 * d);
    assert.ok(Math.abs(secondLeft - secondRight) < 1e-9, `S″ en ${node}`);
    // Primera derivada lateral exacta para una cúbica: fórmula de 4 puntos hacia un lado.
    const firstLeft = (11 * s(node) - 18 * s(node - d) + 9 * s(node - 2 * d) - 2 * s(node - 3 * d)) / (6 * d);
    const firstRight = (-11 * s(node) + 18 * s(node + d) - 9 * s(node + 2 * d) + 2 * s(node + 3 * d)) / (6 * d);
    assert.ok(Math.abs(firstLeft - firstRight) < 1e-10, `S′ en ${node}`);
  }
});

// Con solo dos puntos, la spline natural es la recta que los une.
test('spline con dos puntos = recta', () => {
  const s = createNaturalSpline([1, 3], [10, 20]);
  assert.ok(Math.abs(s(2) - 15) < 1e-14);
});

// Fuera del intervalo tabulado: error por defecto; valor del extremo solo si se pide.
test('fuera de rango: error por defecto, clamp si se pide', () => {
  const xs = [1, 2, 3];
  const ys = [10, 20, 15];
  assert.throws(() => interpLinear(xs, ys, 0.5), /fuera del intervalo/);
  assert.throws(() => createNaturalSpline(xs, ys)(3.01), /fuera del intervalo/);
  assert.throws(() => interpLinear(xs, ys, NaN), /no es un número/);
  assert.equal(interpLinear(xs, ys, 0.5, { outOfRange: 'clamp' }), 10);
  assert.equal(createNaturalSpline(xs, ys, { outOfRange: 'clamp' })(99), 15);
  // Los extremos exactos sí pertenecen al intervalo.
  assert.equal(interpLinear(xs, ys, 1), 10);
  assert.equal(interpLinear(xs, ys, 3), 15);
  assert.equal(interpLinear(xs, ys, 2.5), 17.5);
});

test('tablas inválidas lanzan un error claro', () => {
  assert.throws(() => createLinearInterpolator([1, 2], [1]), /misma longitud/);
  assert.throws(() => createLinearInterpolator([1], [1]), /al menos dos puntos/);
  assert.throws(() => createNaturalSpline([1, 3, 2], [0, 0, 0]), /estrictamente creciente/);
  assert.throws(() => createNaturalSpline([1, 1, 2], [0, 0, 0]), /estrictamente creciente/);
});
