// @ts-check
// Interpolación 1D sobre una tabla de puntos (xs, ys): lineal y spline cúbica natural.
//
// Uso típico: constantes ópticas tabuladas n(λ), k(λ) evaluadas en cualquier λ.
//
//   const n = createNaturalSpline(lambdas, ns);
//   n(532);   // valor interpolado en 532 nm
//
// FUERA DEL INTERVALO TABULADO se lanza un RangeError por defecto: extrapolar datos
// físicos en silencio es una fuente clásica de resultados falsos. Si de verdad se
// quiere prolongar con el valor del extremo, hay que pedirlo: { outOfRange: 'clamp' }.

import { solveTridiagonal } from './linalg.js';

/**
 * @typedef {{ outOfRange?: 'error' | 'clamp' }} InterpOptions
 * @typedef {(x: number) => number} Interpolator
 */

/**
 * Comprueba que la tabla es válida: misma longitud, al menos dos puntos y xs
 * estrictamente creciente.
 * @param {ArrayLike<number>} xs
 * @param {ArrayLike<number>} ys
 */
function checkTable(xs, ys) {
  if (xs.length !== ys.length) {
    throw new RangeError(`interp: xs (${xs.length}) e ys (${ys.length}) deben tener la misma longitud`);
  }
  if (xs.length < 2) throw new RangeError('interp: hacen falta al menos dos puntos');
  for (let i = 1; i < xs.length; i++) {
    if (!(xs[i] > xs[i - 1])) {
      throw new RangeError(`interp: xs debe ser estrictamente creciente (falla en el índice ${i})`);
    }
  }
}

/**
 * Índice i del intervalo [xs[i], xs[i+1]] que contiene a x (búsqueda binaria).
 * Supone xs[0] ≤ x ≤ xs[n−1].
 * @param {ArrayLike<number>} xs
 * @param {number} x
 * @returns {number} entre 0 y n−2
 */
function findInterval(xs, x) {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Trata un x fuera del intervalo tabulado según la opción elegida.
 * @param {ArrayLike<number>} xs
 * @param {number} x
 * @param {'error' | 'clamp'} mode
 * @returns {number} x dentro del intervalo
 */
function handleRange(xs, x, mode) {
  const a = xs[0];
  const b = xs[xs.length - 1];
  if (x >= a && x <= b) return x;
  if (Number.isNaN(x)) throw new RangeError('interp: x no es un número');
  if (mode === 'clamp') return x < a ? a : b;
  throw new RangeError(`interp: x = ${x} está fuera del intervalo tabulado [${a}, ${b}]`);
}

/**
 * Interpolación lineal a trozos. Error O(h²) para funciones suaves:
 * |f − p| ≤ (h²/8)·max|f″|.
 * @param {ArrayLike<number>} xs abscisas, estrictamente crecientes
 * @param {ArrayLike<number>} ys ordenadas
 * @param {InterpOptions} [options]
 * @returns {Interpolator}
 */
export function createLinearInterpolator(xs, ys, { outOfRange = 'error' } = {}) {
  checkTable(xs, ys);
  return (x) => {
    const xc = handleRange(xs, x, outOfRange);
    const i = findInterval(xs, xc);
    const t = (xc - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[i] + t * (ys[i + 1] - ys[i]);
  };
}

/**
 * Atajo: interpola linealmente un único valor.
 * @param {ArrayLike<number>} xs
 * @param {ArrayLike<number>} ys
 * @param {number} x
 * @param {InterpOptions} [options]
 * @returns {number}
 */
export function interpLinear(xs, ys, x, options) {
  return createLinearInterpolator(xs, ys, options)(x);
}

/**
 * Spline cúbica natural: un polinomio de grado 3 en cada intervalo, con primera y
 * segunda derivadas continuas en los nodos y segunda derivada nula en los dos extremos
 * (condición "natural").
 *
 * Error O(h⁴) lejos de los extremos; cerca de ellos baja a O(h²) si la función real no
 * tiene f″ = 0 allí (la condición natural es entonces una aproximación).
 *
 * @param {ArrayLike<number>} xs abscisas, estrictamente crecientes
 * @param {ArrayLike<number>} ys ordenadas
 * @param {InterpOptions} [options]
 * @returns {Interpolator}
 */
export function createNaturalSpline(xs, ys, { outOfRange = 'error' } = {}) {
  checkTable(xs, ys);
  const n = xs.length;
  // m[i] = segunda derivada de la spline en el nodo i. m[0] = m[n−1] = 0 (natural).
  // Las interiores salen de imponer continuidad de la primera derivada en cada nodo:
  //   h_{i−1}·m_{i−1} + 2(h_{i−1} + h_i)·m_i + h_i·m_{i+1}
  //       = 6·[(y_{i+1} − y_i)/h_i − (y_i − y_{i−1})/h_{i−1}],   h_i = x_{i+1} − x_i
  // que es un sistema tridiagonal, simétrico y diagonalmente dominante.
  const m = new Float64Array(n);
  if (n > 2) {
    const size = n - 2;
    const lower = new Float64Array(size);
    const diag = new Float64Array(size);
    const upper = new Float64Array(size);
    const rhs = new Float64Array(size);
    for (let j = 0; j < size; j++) {
      const i = j + 1;
      const h0 = xs[i] - xs[i - 1];
      const h1 = xs[i + 1] - xs[i];
      lower[j] = h0;
      diag[j] = 2 * (h0 + h1);
      upper[j] = h1;
      rhs[j] = 6 * ((ys[i + 1] - ys[i]) / h1 - (ys[i] - ys[i - 1]) / h0);
    }
    const inner = solveTridiagonal(lower, diag, upper, rhs);
    for (let j = 0; j < size; j++) m[j + 1] = inner[j];
  }
  return (x) => {
    const xc = handleRange(xs, x, outOfRange);
    const i = findInterval(xs, xc);
    const h = xs[i + 1] - xs[i];
    const a = xs[i + 1] - xc; // distancia al nodo derecho
    const b = xc - xs[i]; // distancia al nodo izquierdo
    return (
      (m[i] * a * a * a + m[i + 1] * b * b * b) / (6 * h) +
      (ys[i] / h - (m[i] * h) / 6) * a +
      (ys[i + 1] / h - (m[i + 1] * h) / 6) * b
    );
  };
}
