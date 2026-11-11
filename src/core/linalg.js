// @ts-check
// Álgebra lineal numérica mínima para el laboratorio:
//   - solveTridiagonal:   sistema tridiagonal real (algoritmo de Thomas).
//   - eigTridiagonal:     autovalores y autovectores de una matriz tridiagonal simétrica
//                         (bisección de Sturm + iteración inversa).
//   - solveComplexDense:  sistema lineal complejo denso pequeño (eliminación de Gauss).
//
// CONVENIO PARA MATRICES TRIDIAGONALES (n × n):
//   diag[i]   elemento (i, i),            i = 0…n−1
//   lower[i]  elemento (i, i−1),          i = 1…n−1   (lower[0] no se usa)
//   upper[i]  elemento (i, i+1),          i = 0…n−2   (upper[n−1] no se usa)
// Los tres arrays tienen longitud n. En el caso simétrico se da un único array
// `off` de longitud n−1, con off[i] = elemento (i, i+1) = elemento (i+1, i).

import { complex, sub, mul, div, abs } from './complex.js';

/** @typedef {import('./complex.js').Complex} Complex */

// --- Utilidades -----------------------------------------------------------------------

/**
 * Producto escalar de dos vectores reales.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 */
export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Norma euclídea de un vector real.
 * @param {ArrayLike<number>} a
 * @returns {number}
 */
export function norm(a) {
  return Math.sqrt(dot(a, a));
}

/**
 * Producto de una matriz tridiagonal simétrica por un vector: y = T·x.
 * @param {ArrayLike<number>} diag longitud n
 * @param {ArrayLike<number>} off longitud n−1
 * @param {ArrayLike<number>} x longitud n
 * @returns {Float64Array}
 */
export function multiplySymTridiagonal(diag, off, x) {
  const n = diag.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    y[i] = diag[i] * x[i];
    if (i > 0) y[i] += off[i - 1] * x[i - 1];
    if (i < n - 1) y[i] += off[i] * x[i + 1];
  }
  return y;
}

// --- Sistema tridiagonal (Thomas) --------------------------------------------------------

/**
 * Resuelve el sistema tridiagonal A·x = rhs con el algoritmo de Thomas (eliminación de
 * Gauss sin pivoteo, coste O(n)).
 *
 * Es estable cuando la matriz es diagonalmente dominante o simétrica definida positiva,
 * que es el caso de las matrices que salen de discretizar la ecuación de difusión, la
 * de Schrödinger (Crank-Nicolson) o una spline cúbica. Si aparece un pivote nulo,
 * lanza un error en vez de devolver basura.
 *
 * @param {ArrayLike<number>} lower subdiagonal (lower[0] no se usa)
 * @param {ArrayLike<number>} diag diagonal
 * @param {ArrayLike<number>} upper superdiagonal (upper[n−1] no se usa)
 * @param {ArrayLike<number>} rhs término independiente
 * @returns {Float64Array} solución x
 */
export function solveTridiagonal(lower, diag, upper, rhs) {
  const n = diag.length;
  if (lower.length !== n || upper.length !== n || rhs.length !== n) {
    throw new RangeError('solveTridiagonal: lower, diag, upper y rhs deben tener la misma longitud');
  }
  const c = new Float64Array(n); // superdiagonal modificada
  const x = new Float64Array(n);
  let pivot = diag[0];
  if (pivot === 0) throw new Error('solveTridiagonal: pivote nulo en la fila 0');
  c[0] = upper[0] / pivot;
  x[0] = rhs[0] / pivot;
  for (let i = 1; i < n; i++) {
    pivot = diag[i] - lower[i] * c[i - 1];
    if (pivot === 0) throw new Error(`solveTridiagonal: pivote nulo en la fila ${i}`);
    c[i] = upper[i] / pivot;
    x[i] = (rhs[i] - lower[i] * x[i - 1]) / pivot;
  }
  for (let i = n - 2; i >= 0; i--) x[i] -= c[i] * x[i + 1];
  return x;
}

// --- Autovalores de una tridiagonal simétrica ------------------------------------------------

/**
 * Número de autovalores de la matriz tridiagonal simétrica estrictamente menores que x.
 *
 * Se basa en la sucesión de Sturm: al factorizar T − x·I = L·D·Lᵀ, el número de
 * elementos negativos de D es el número de autovalores menores que x (ley de inercia
 * de Sylvester). Los elementos de D se obtienen con la recurrencia
 *   q₀ = d₀ − x,   qᵢ = dᵢ − x − eᵢ₋₁²/qᵢ₋₁.
 *
 * @param {ArrayLike<number>} diag
 * @param {ArrayLike<number>} off
 * @param {number} x
 * @param {number} tiny valor que sustituye a un q exactamente nulo
 * @returns {number}
 */
function sturmCount(diag, off, x, tiny) {
  let count = 0;
  let q = diag[0] - x;
  if (q === 0) q = -tiny;
  if (q < 0) count++;
  for (let i = 1; i < diag.length; i++) {
    q = diag[i] - x - (off[i - 1] * off[i - 1]) / q;
    if (q === 0) q = -tiny;
    if (q < 0) count++;
  }
  return count;
}

/**
 * Intervalo que contiene todos los autovalores (círculos de Gershgorin).
 * @param {ArrayLike<number>} diag
 * @param {ArrayLike<number>} off
 * @returns {[number, number]}
 */
function gershgorinBounds(diag, off) {
  const n = diag.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = (i > 0 ? Math.abs(off[i - 1]) : 0) + (i < n - 1 ? Math.abs(off[i]) : 0);
    lo = Math.min(lo, diag[i] - r);
    hi = Math.max(hi, diag[i] + r);
  }
  return [lo, hi];
}

/**
 * Autovalores más bajos de una matriz tridiagonal simétrica, en orden creciente,
 * por bisección de Sturm. Cada autovalor se calcula con precisión cercana a la de máquina.
 *
 * @param {ArrayLike<number>} diag diagonal (longitud n)
 * @param {ArrayLike<number>} off fuera de la diagonal (longitud n−1)
 * @param {number} [count] cuántos autovalores se piden (por defecto, todos)
 * @returns {Float64Array}
 */
export function eigenvaluesTridiagonal(diag, off, count = diag.length) {
  const n = diag.length;
  if (off.length !== n - 1) {
    throw new RangeError('eigenvaluesTridiagonal: off debe tener longitud n − 1');
  }
  if (!Number.isInteger(count) || count < 0 || count > n) {
    throw new RangeError(`eigenvaluesTridiagonal: count debe estar entre 0 y ${n}`);
  }
  const [lo0, hi0] = gershgorinBounds(diag, off);
  const scale = Math.max(Math.abs(lo0), Math.abs(hi0), Number.MIN_VALUE);
  const tiny = scale * Number.EPSILON;
  const values = new Float64Array(count);
  let lower = lo0 - tiny;
  for (let k = 0; k < count; k++) {
    // Busca λ_k: el punto donde el recuento de Sturm pasa de ≤ k a ≥ k+1.
    let lo = lower; // los autovalores están ordenados: λ_k ≥ λ_{k−1}
    let hi = hi0 + tiny;
    for (let iter = 0; iter < 200; iter++) {
      const mid = lo + (hi - lo) / 2;
      if (mid <= lo || mid >= hi) break; // ya no hay números representables en medio
      if (sturmCount(diag, off, mid, tiny) > k) hi = mid;
      else lo = mid;
    }
    values[k] = lo + (hi - lo) / 2;
    lower = lo;
  }
  return values;
}

/**
 * Resuelve (T − shift·I)·x = b para T tridiagonal simétrica, con pivoteo parcial.
 * Hace falta pivoteo porque en la iteración inversa la matriz es casi singular a
 * propósito. Función interna.
 * @param {ArrayLike<number>} diag
 * @param {ArrayLike<number>} off
 * @param {number} shift
 * @param {Float64Array} b
 * @param {number} tiny
 * @returns {Float64Array}
 */
function solveShifted(diag, off, shift, b, tiny) {
  const n = diag.length;
  // Tras la eliminación con pivoteo, U tiene diagonal y dos superdiagonales.
  const u0 = new Float64Array(n);
  const u1 = new Float64Array(n);
  const u2 = new Float64Array(n);
  const x = Float64Array.from(b);
  // Fila de trabajo actual (la fila i ya reducida): [p0, p1] en las columnas i, i+1.
  let p0 = diag[0] - shift;
  let p1 = n > 1 ? off[0] : 0;
  for (let i = 0; i < n - 1; i++) {
    // Fila siguiente, sin tocar: [e_i, d_{i+1} − shift, e_{i+1}] en columnas i, i+1, i+2.
    const r0 = off[i];
    const r1 = diag[i + 1] - shift;
    const r2 = i + 2 < n ? off[i + 1] : 0;
    if (Math.abs(p0) >= Math.abs(r0)) {
      // Sin intercambio.
      if (p0 === 0) p0 = tiny;
      const m = r0 / p0;
      u0[i] = p0;
      u1[i] = p1;
      u2[i] = 0;
      x[i + 1] -= m * x[i];
      p0 = r1 - m * p1;
      p1 = r2;
    } else {
      // Intercambio de filas: la fila i+1 pasa a ser el pivote.
      const m = p0 / r0;
      u0[i] = r0;
      u1[i] = r1;
      u2[i] = r2;
      const t = x[i];
      x[i] = x[i + 1];
      x[i + 1] = t - m * x[i];
      p0 = p1 - m * r1;
      p1 = -m * r2;
    }
  }
  if (p0 === 0) p0 = tiny;
  u0[n - 1] = p0;
  // Sustitución hacia atrás.
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    if (i + 1 < n) s -= u1[i] * x[i + 1];
    if (i + 2 < n) s -= u2[i] * x[i + 2];
    x[i] = s / u0[i];
  }
  return x;
}

/**
 * Autovalores y autovectores más bajos de una matriz tridiagonal simétrica.
 *
 * Método: bisección de Sturm para los autovalores e iteración inversa para los
 * autovectores, reortogonalizando entre sí los que pertenecen a autovalores muy
 * próximos (casi degenerados). Permite pedir solo los `count` estados más bajos con
 * coste O(count·n), que es lo que necesita, por ejemplo, la ecuación de Schrödinger
 * estacionaria discretizada en una malla de n puntos.
 *
 * Los autovectores salen normalizados (Σ vᵢ² = 1). El signo de un autovector es
 * arbitrario; aquí se fija para que el resultado sea reproducible: la suma
 * Σ (n − i)·vᵢ es positiva (en la práctica, "el vector empieza siendo positivo").
 *
 * @param {ArrayLike<number>} diag diagonal (longitud n)
 * @param {ArrayLike<number>} off fuera de la diagonal (longitud n−1)
 * @param {{ count?: number }} [options] count: número de autopares (por defecto, todos)
 * @returns {{ values: Float64Array, vectors: Float64Array[] }}
 *   values[k] es el k-ésimo autovalor (orden creciente) y vectors[k] su autovector.
 */
export function eigTridiagonal(diag, off, { count = diag.length } = {}) {
  const n = diag.length;
  const values = eigenvaluesTridiagonal(diag, off, count);
  const [lo0, hi0] = gershgorinBounds(diag, off);
  const scale = Math.max(Math.abs(lo0), Math.abs(hi0), Number.MIN_VALUE);
  const tiny = scale * Number.EPSILON;
  // Dos autovalores más cercanos que esto se tratan como un grupo casi degenerado
  // (mismo criterio que la rutina DSTEIN de LAPACK: 1e-3·‖T‖).
  const clusterTol = 1e-3 * scale;

  /** @type {Float64Array[]} */
  const vectors = [];
  let clusterStart = 0;
  let previousShift = -Infinity;
  for (let k = 0; k < count; k++) {
    if (k > 0 && values[k] - values[k - 1] > clusterTol) clusterStart = k;
    // Dentro de un grupo, se separan un poco los desplazamientos para que la
    // iteración inversa no converja dos veces al mismo vector.
    let shift = values[k];
    if (k > clusterStart && shift - previousShift < 10 * tiny) shift = previousShift + 10 * tiny;
    previousShift = shift;

    // Vector inicial determinista, sin simetrías que lo hagan ortogonal al autovector.
    /** @type {Float64Array} */
    let v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = 1 + 0.37 * Math.sin(1.7 * (i + 1) * (k + 1) + 0.3);

    for (let iter = 0; iter < 6; iter++) {
      v = solveShifted(diag, off, shift, v, tiny);
      // Reortogonalización (Gram-Schmidt modificado) frente al resto del grupo.
      for (let j = clusterStart; j < k; j++) {
        const proj = dot(v, vectors[j]);
        for (let i = 0; i < n; i++) v[i] -= proj * vectors[j][i];
      }
      const len = norm(v);
      for (let i = 0; i < n; i++) v[i] /= len;
    }

    // Convenio de signo.
    let weighted = 0;
    for (let i = 0; i < n; i++) weighted += (n - i) * v[i];
    if (weighted < 0) for (let i = 0; i < n; i++) v[i] = -v[i];
    vectors.push(v);
  }
  return { values, vectors };
}

// --- Sistema complejo denso -------------------------------------------------------------------

/**
 * Resuelve el sistema lineal complejo A·x = b por eliminación de Gauss con pivoteo
 * parcial. Pensado para sistemas pequeños (condiciones de contorno, matrices de
 * transferencia): coste O(n³).
 *
 * @param {Complex[][]} A matriz n × n como array de filas
 * @param {Complex[]} b término independiente (longitud n)
 * @returns {Complex[]} solución x
 */
export function solveComplexDense(A, b) {
  const n = A.length;
  if (b.length !== n || A.some((row) => row.length !== n)) {
    throw new RangeError('solveComplexDense: A debe ser n × n y b de longitud n');
  }
  // Copia de trabajo (matriz ampliada) para no modificar los argumentos.
  const M = A.map((row, i) => [...row.map((z) => complex(z.re, z.im)), complex(b[i].re, b[i].im)]);
  for (let col = 0; col < n; col++) {
    // Pivoteo parcial: se sube la fila con el mayor |elemento| en esta columna.
    let best = col;
    for (let row = col + 1; row < n; row++) {
      if (abs(M[row][col]) > abs(M[best][col])) best = row;
    }
    if (abs(M[best][col]) === 0) {
      throw new Error('solveComplexDense: la matriz es singular');
    }
    [M[col], M[best]] = [M[best], M[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = div(M[row][col], M[col][col]);
      for (let j = col; j <= n; j++) {
        M[row][j] = sub(M[row][j], mul(factor, M[col][j]));
      }
    }
  }
  /** @type {Complex[]} */
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s = sub(s, mul(M[i][j], x[j]));
    x[i] = div(s, M[i][i]);
  }
  return x;
}
