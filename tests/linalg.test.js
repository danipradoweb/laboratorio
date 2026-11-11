// @ts-check
// Tests de src/core/linalg.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dot,
  norm,
  multiplySymTridiagonal,
  solveTridiagonal,
  eigenvaluesTridiagonal,
  eigTridiagonal,
  solveComplexDense,
} from '../src/core/linalg.js';
import * as C from '../src/core/complex.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/linalg.json', import.meta.url), 'utf8'));

/**
 * Laplaciano discreto 1D con extremos fijos: diagonal 2, fuera de la diagonal −1.
 * @param {number} n
 */
function laplacian(n) {
  return { diag: new Float64Array(n).fill(2), off: new Float64Array(n - 1).fill(-1) };
}

// --- Thomas ----------------------------------------------------------------------------------

// Principio: si se construye rhs = A·x con x conocido, resolver el sistema debe devolver x.
// Matriz diagonalmente dominante no simétrica (caso estable para Thomas).
test('solveTridiagonal recupera una solución conocida', () => {
  const n = 50;
  const lower = Float64Array.from({ length: n }, (_, i) => 0.3 + 0.01 * i);
  const upper = Float64Array.from({ length: n }, (_, i) => -0.5 + 0.02 * Math.sin(i));
  const diag = Float64Array.from({ length: n }, (_, i) => 2 + 0.1 * Math.cos(i));
  const xTrue = Float64Array.from({ length: n }, (_, i) => Math.sin(0.4 * i) + 0.01 * i * i);
  const rhs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    rhs[i] = diag[i] * xTrue[i];
    if (i > 0) rhs[i] += lower[i] * xTrue[i - 1];
    if (i < n - 1) rhs[i] += upper[i] * xTrue[i + 1];
  }
  const x = solveTridiagonal(lower, diag, upper, rhs);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(x[i] - xTrue[i]) < 1e-11, `i=${i}`);
});

// Principio: problema de contorno −u″ = 1 en (0, 1) con u(0) = u(1) = 0, cuya solución
// exacta es u(x) = x(1 − x)/2. Las diferencias finitas centradas son exactas para
// polinomios de grado 2, así que la solución discreta coincide con la exacta en los nodos.
test('solveTridiagonal: problema de Poisson 1D con solución exacta x(1−x)/2', () => {
  const n = 99;
  const h = 1 / (n + 1);
  const lower = new Float64Array(n).fill(-1);
  const upper = new Float64Array(n).fill(-1);
  const diag = new Float64Array(n).fill(2);
  const rhs = new Float64Array(n).fill(h * h);
  const u = solveTridiagonal(lower, diag, upper, rhs);
  for (let i = 0; i < n; i++) {
    const x = (i + 1) * h;
    assert.ok(Math.abs(u[i] - (x * (1 - x)) / 2) < 1e-12);
  }
});

test('solveTridiagonal: n = 1 y errores', () => {
  assert.deepEqual(Array.from(solveTridiagonal([0], [4], [0], [8])), [2]);
  assert.throws(() => solveTridiagonal([0, 1], [0, 1], [1, 0], [1, 1]), /pivote nulo/);
  assert.throws(() => solveTridiagonal([0], [1, 2], [0, 0], [1, 1]), /misma longitud/);
});

// --- Autovalores -----------------------------------------------------------------------------

// Principio: el laplaciano discreto con extremos fijos (cuerda con N masas, o partícula
// en una caja discretizada) tiene solución analítica exacta:
//   λ_k = 2 − 2·cos(kπ/(N+1)),  v_k[j] = √(2/(N+1))·sen(j·kπ/(N+1)),  k, j = 1…N.
test('autovalores del laplaciano discreto: 2 − 2cos(kπ/(N+1))', () => {
  for (const n of [1, 2, 5, 64, 200]) {
    const { diag, off } = laplacian(n);
    const values = eigenvaluesTridiagonal(diag, off);
    for (let k = 1; k <= n; k++) {
      const exact = 2 - 2 * Math.cos((k * Math.PI) / (n + 1));
      assert.ok(Math.abs(values[k - 1] - exact) < 1e-13, `N=${n}, k=${k}`);
    }
  }
});

test('autovectores del laplaciano discreto: senos, con el convenio de signo', () => {
  const n = 64;
  const { diag, off } = laplacian(n);
  const { vectors } = eigTridiagonal(diag, off);
  for (let k = 1; k <= n; k++) {
    for (let j = 1; j <= n; j++) {
      // El convenio de signo (Σ (n−i)·vᵢ > 0) elige el seno que empieza positivo.
      const exact = Math.sqrt(2 / (n + 1)) * Math.sin((j * k * Math.PI) / (n + 1));
      assert.ok(Math.abs(vectors[k - 1][j - 1] - exact) < 1e-10, `k=${k}, j=${j}`);
    }
  }
});

/**
 * Comprueba ortonormalidad y residuo de un conjunto de autopares.
 * @param {ArrayLike<number>} diag
 * @param {ArrayLike<number>} off
 * @param {{ values: Float64Array, vectors: Float64Array[] }} eig
 * @param {number} tol
 */
function checkEigenpairs(diag, off, eig, tol) {
  const m = eig.values.length;
  for (let a = 0; a < m; a++) {
    // Residuo: ‖T·v − λ·v‖ debe ser del orden del error de redondeo.
    const Tv = multiplySymTridiagonal(diag, off, eig.vectors[a]);
    const residual = norm(Tv.map((t, i) => t - eig.values[a] * eig.vectors[a][i]));
    assert.ok(residual < tol, `residuo del autopar ${a}: ${residual}`);
    for (let b = a; b < m; b++) {
      const expected = a === b ? 1 : 0;
      const got = dot(eig.vectors[a], eig.vectors[b]);
      assert.ok(Math.abs(got - expected) < tol, `<v${a}|v${b}> = ${got}`);
    }
  }
}

// Principio: los autovectores de una matriz simétrica forman una base ortonormal y
// cumplen T·v = λ·v.
test('ortonormalidad y residuo en el laplaciano', () => {
  const { diag, off } = laplacian(100);
  checkEigenpairs(diag, off, eigTridiagonal(diag, off), 1e-11);
});

// Principio: matriz de Wilkinson W21+, con parejas de autovalores casi degenerados
// (iguales en ~14 cifras). Es el caso difícil para la iteración inversa: sin
// reortogonalizar, los dos vectores de la pareja saldrían iguales.
// Valor esperado: scipy.linalg.eigh_tridiagonal (fixture).
test('matriz de Wilkinson: autovalores de referencia y vectores ortonormales', () => {
  const { diag, off, values: reference } = fixture.wilkinson21;
  const eig = eigTridiagonal(diag, off);
  for (let k = 0; k < reference.length; k++) {
    assert.ok(Math.abs(eig.values[k] - reference[k]) < 1e-12, `λ_${k}`);
  }
  // La pareja más alta es casi degenerada: comprobamos que el test lo es de verdad.
  assert.ok(reference[20] - reference[19] < 1e-12);
  checkEigenpairs(diag, off, eig, 1e-10);
});

// Valor esperado: scipy.linalg.eigh_tridiagonal sobre una matriz aleatoria (fixture).
// Además, invariantes exactos: Σλ = traza y Σλ² = norma de Frobenius al cuadrado.
test('matriz aleatoria: referencia de LAPACK, traza y norma de Frobenius', () => {
  const { diag, off, values: reference } = fixture.aleatoria40;
  const eig = eigTridiagonal(diag, off);
  let sum = 0;
  let sum2 = 0;
  for (let k = 0; k < reference.length; k++) {
    assert.ok(Math.abs(eig.values[k] - reference[k]) < 1e-12, `λ_${k}`);
    sum += eig.values[k];
    sum2 += eig.values[k] ** 2;
  }
  const trace = diag.reduce((/** @type {number} */ s, /** @type {number} */ d) => s + d, 0);
  const frob = dot(diag, diag) + 2 * dot(off, off);
  assert.ok(Math.abs(sum - trace) < 1e-11);
  assert.ok(Math.abs(sum2 - frob) < 1e-10);
  checkEigenpairs(diag, off, eig, 1e-10);
});

// Principio: oscilador armónico cuántico (ħ = m = ω = 1) discretizado con diferencias
// finitas, H = −½ d²/dx² + ½ x². Los niveles exactos del continuo son E_n = n + ½; la
// discretización introduce un error O(h²) = O(0,0025), de ahí la tolerancia de 0,01.
// Además se compara con LAPACK sobre la misma matriz (fixture), con tolerancia fina.
// También comprueba que se pueden pedir solo los estados más bajos (count).
test('oscilador armónico discretizado: E_n ≈ n + ½ pidiendo solo 8 estados', () => {
  const { n, xmin, xmax, values: reference } = fixture.oscilador400;
  const h = (xmax - xmin) / (n + 1);
  const diag = Float64Array.from({ length: n }, (_, i) => 1 / h ** 2 + 0.5 * (xmin + (i + 1) * h) ** 2);
  const off = new Float64Array(n - 1).fill(-0.5 / h ** 2);
  const eig = eigTridiagonal(diag, off, { count: 8 });
  assert.equal(eig.values.length, 8);
  assert.equal(eig.vectors.length, 8);
  for (let k = 0; k < 8; k++) {
    assert.ok(Math.abs(eig.values[k] - reference[k]) < 1e-9, `LAPACK, nivel ${k}`);
    assert.ok(Math.abs(eig.values[k] - (k + 0.5)) < 0.01, `E_${k} ≈ ${k + 0.5}`);
  }
  checkEigenpairs(diag, off, eig, 1e-9);
  // Paridad: el estado fundamental no tiene nodos; el estado k tiene k nodos.
  for (let k = 0; k < 8; k++) {
    let nodes = 0;
    const v = eig.vectors[k];
    for (let i = 1; i < n; i++) {
      if (Math.abs(v[i]) > 1e-8 && Math.abs(v[i - 1]) > 1e-8 && v[i] * v[i - 1] < 0) nodes++;
    }
    assert.equal(nodes, k, `el estado ${k} debe tener ${k} nodos`);
  }
});

// Principio: una matriz con un elemento nulo fuera de la diagonal se parte en dos bloques
// independientes y puede tener autovalores exactamente degenerados. Aquí, dos bloques
// 2×2 iguales [[2,1],[1,2]]: autovalores 1, 1, 3, 3 (exactos).
test('autovalores exactamente degenerados (matriz en bloques)', () => {
  const diag = [2, 2, 2, 2];
  const off = [1, 0, 1];
  const eig = eigTridiagonal(diag, off);
  const expected = [1, 1, 3, 3];
  for (let k = 0; k < 4; k++) assert.ok(Math.abs(eig.values[k] - expected[k]) < 1e-13);
  checkEigenpairs(diag, off, eig, 1e-11);
});

test('eigenvaluesTridiagonal valida sus argumentos', () => {
  assert.throws(() => eigenvaluesTridiagonal([1, 2, 3], [1]), /n − 1/);
  assert.throws(() => eigenvaluesTridiagonal([1, 2], [1], 5), /count/);
  assert.deepEqual(Array.from(eigenvaluesTridiagonal([7], [])), [7]);
});

// --- Sistema complejo denso ------------------------------------------------------------------

// Principio: si se construye b = A·x con x conocido, resolver el sistema debe devolver x.
// Matriz 5×5 compleja sin estructura especial.
test('solveComplexDense recupera una solución conocida', () => {
  const n = 5;
  /** @type {C.Complex[][]} */
  const A = [];
  /** @type {C.Complex[]} */
  const xTrue = [];
  for (let i = 0; i < n; i++) {
    xTrue.push(C.complex(Math.cos(i) + 0.5, Math.sin(2 * i) - 0.2));
    A.push([]);
    for (let j = 0; j < n; j++) {
      A[i].push(C.complex(Math.sin(1.3 * i + 0.7 * j) + (i === j ? 0.1 : 0), Math.cos(0.9 * i * j + 0.4)));
    }
  }
  const b = A.map((row) => row.reduce((s, a, j) => C.add(s, C.mul(a, xTrue[j])), C.ZERO));
  const x = solveComplexDense(A, b);
  for (let i = 0; i < n; i++) assert.ok(C.equals(x[i], xTrue[i], 1e-11), `x[${i}]`);
});

// Principio: caso con solución analítica. i·x = 1 → x = −i. Y un sistema que exige
// pivoteo (el primer pivote es 0): [[0, 1], [1, 0]]·[x, y] = [2i, 3] → x = 3, y = 2i.
test('solveComplexDense: casos analíticos, pivoteo y matriz singular', () => {
  const [x] = solveComplexDense([[C.I]], [C.ONE]);
  assert.ok(C.equals(x, C.complex(0, -1)));
  const sol = solveComplexDense(
    [
      [C.ZERO, C.ONE],
      [C.ONE, C.ZERO],
    ],
    [C.complex(0, 2), C.complex(3, 0)],
  );
  assert.ok(C.equals(sol[0], C.complex(3, 0)));
  assert.ok(C.equals(sol[1], C.complex(0, 2)));
  assert.throws(
    () =>
      solveComplexDense(
        [
          [C.ONE, C.ONE],
          [C.ONE, C.ONE],
        ],
        [C.ONE, C.ONE],
      ),
    /singular/,
  );
});

test('solveComplexDense no modifica sus argumentos', () => {
  const A = [
    [C.complex(2, 1), C.complex(0, 1)],
    [C.complex(1, 0), C.complex(3, -1)],
  ];
  const b = [C.complex(1, 0), C.complex(0, 1)];
  const copy = JSON.stringify([A, b]);
  solveComplexDense(A, b);
  assert.equal(JSON.stringify([A, b]), copy);
});
