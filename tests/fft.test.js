// @ts-check
// Tests de src/core/fft.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fft, ifft, fft2d, ifft2d, fftfreq, fftshift, isPowerOfTwo } from '../src/core/fft.js';

/**
 * Generador pseudoaleatorio determinista (mulberry32), para que los tests sean repetibles.
 * @param {number} seed
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

/**
 * DFT ingenua O(N²), escrita directamente desde la definición. Es la referencia
 * independiente: no comparte código con fft.js.
 * @param {ArrayLike<number>} re
 * @param {ArrayLike<number>} im
 * @param {number} sign −1 directa, +1 inversa (sin normalizar)
 */
function naiveDft(re, im, sign) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      const phi = (sign * 2 * Math.PI * k * j) / n;
      outRe[k] += re[j] * Math.cos(phi) - im[j] * Math.sin(phi);
      outIm[k] += re[j] * Math.sin(phi) + im[j] * Math.cos(phi);
    }
  }
  return { re: outRe, im: outIm };
}

/**
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @param {number} tol
 * @param {string} [msg]
 */
function closeArrays(a, b, tol, msg = '') {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.ok(Math.abs(a[i] - b[i]) <= tol, `${msg} índice ${i}: ${a[i]} frente a ${b[i]}`);
  }
}

/** @param {number} n @param {number} seed */
function randomSignal(n, seed) {
  const r = rng(seed);
  return {
    re: Float64Array.from({ length: n }, r),
    im: Float64Array.from({ length: n }, r),
  };
}

// Principio: la FFT es solo una forma rápida de calcular la DFT; debe dar lo mismo que
// la suma de la definición. Valor esperado: DFT ingenua escrita en este archivo.
test('fft coincide con la DFT ingenua (N = 1 … 64)', () => {
  for (const n of [1, 2, 4, 8, 16, 32, 64]) {
    const x = randomSignal(n, 100 + n);
    const fast = fft(x.re, x.im);
    const slow = naiveDft(x.re, x.im, -1);
    closeArrays(fast.re, slow.re, 1e-12, `N=${n} re`);
    closeArrays(fast.im, slow.im, 1e-12, `N=${n} im`);
  }
});

// Principio: la inversa lleva el factor 1/N y el signo opuesto en la exponencial.
test('ifft coincide con la DFT inversa ingenua', () => {
  for (const n of [2, 8, 32]) {
    const x = randomSignal(n, 200 + n);
    const fast = ifft(x.re, x.im);
    const slow = naiveDft(x.re, x.im, +1);
    closeArrays(fast.re, slow.re.map((v) => v / n), 1e-13);
    closeArrays(fast.im, slow.im.map((v) => v / n), 1e-13);
  }
});

// Principio: ifft(fft(x)) = x (la transformada es invertible).
test('ida y vuelta 1D', () => {
  for (const n of [1, 2, 16, 1024]) {
    const x = randomSignal(n, 300 + n);
    const X = fft(x.re, x.im);
    const back = ifft(X.re, X.im);
    closeArrays(back.re, x.re, 1e-12);
    closeArrays(back.im, x.im, 1e-12);
  }
});

// Principio: teorema de Parseval. Con el convenio de este archivo, Σ|x|² = (1/N)·Σ|X|².
test('teorema de Parseval', () => {
  for (const n of [8, 256]) {
    const x = randomSignal(n, 400 + n);
    const X = fft(x.re, x.im);
    let ex = 0;
    let eX = 0;
    for (let i = 0; i < n; i++) {
      ex += x.re[i] ** 2 + x.im[i] ** 2;
      eX += X.re[i] ** 2 + X.im[i] ** 2;
    }
    assert.ok(Math.abs(ex - eX / n) < 1e-11 * ex);
  }
});

// Principio: pares de Fourier elementales, con resultado exacto conocido:
//  - una delta en n=0 se transforma en una constante (todas las frecuencias por igual);
//  - una constante se transforma en una delta en k=0 de altura N;
//  - una exponencial e^{2πi·m·n/N} se transforma en una delta en k=m de altura N.
test('pares elementales: delta, constante y exponencial pura', () => {
  const n = 16;
  const delta = new Float64Array(n);
  delta[0] = 1;
  const D = fft(delta);
  closeArrays(D.re, new Float64Array(n).fill(1), 1e-15);
  closeArrays(D.im, new Float64Array(n), 1e-15);

  const K = fft(new Float64Array(n).fill(1));
  const expectedK = new Float64Array(n);
  expectedK[0] = n;
  closeArrays(K.re, expectedK, 1e-13);
  closeArrays(K.im, new Float64Array(n), 1e-13);

  const m = 3;
  const re = Float64Array.from({ length: n }, (_, j) => Math.cos((2 * Math.PI * m * j) / n));
  const im = Float64Array.from({ length: n }, (_, j) => Math.sin((2 * Math.PI * m * j) / n));
  const E = fft(re, im);
  const expectedE = new Float64Array(n);
  expectedE[m] = n;
  closeArrays(E.re, expectedE, 1e-12);
  closeArrays(E.im, new Float64Array(n), 1e-12);
});

// Principio: teorema del desplazamiento. Desplazar la señal s muestras multiplica X[k]
// por la fase e^{−2πi·k·s/N}; el módulo |X[k]| no cambia.
test('teorema del desplazamiento', () => {
  const n = 32;
  const s = 5;
  const x = randomSignal(n, 77);
  const shifted = {
    re: Float64Array.from({ length: n }, (_, j) => x.re[(j - s + n) % n]),
    im: Float64Array.from({ length: n }, (_, j) => x.im[(j - s + n) % n]),
  };
  const X = fft(x.re, x.im);
  const S = fft(shifted.re, shifted.im);
  for (let k = 0; k < n; k++) {
    const phi = (-2 * Math.PI * k * s) / n;
    const re = X.re[k] * Math.cos(phi) - X.im[k] * Math.sin(phi);
    const im = X.re[k] * Math.sin(phi) + X.im[k] * Math.cos(phi);
    assert.ok(Math.abs(S.re[k] - re) < 1e-12 && Math.abs(S.im[k] - im) < 1e-12);
  }
});

// Principio: la transformada 2D es la DFT aplicada a cada eje. Valor esperado: suma
// doble ingenua, escrita desde la definición, en una malla no cuadrada (8 × 4).
test('fft2d coincide con la DFT 2D ingenua (malla 8 × 4)', () => {
  const nx = 8;
  const ny = 4;
  const x = randomSignal(nx * ny, 555);
  const fast = fft2d(x.re, x.im, nx, ny);
  for (let ky = 0; ky < ny; ky++) {
    for (let kx = 0; kx < nx; kx++) {
      let sr = 0;
      let si = 0;
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          const phi = -2 * Math.PI * ((kx * ix) / nx + (ky * iy) / ny);
          const j = iy * nx + ix;
          sr += x.re[j] * Math.cos(phi) - x.im[j] * Math.sin(phi);
          si += x.re[j] * Math.sin(phi) + x.im[j] * Math.cos(phi);
        }
      }
      const k = ky * nx + kx;
      assert.ok(Math.abs(fast.re[k] - sr) < 1e-12, `re en (${kx}, ${ky})`);
      assert.ok(Math.abs(fast.im[k] - si) < 1e-12, `im en (${kx}, ${ky})`);
    }
  }
});

// Principio: ida y vuelta y Parseval en 2D, Σ|x|² = (1/(nx·ny))·Σ|X|².
test('ida y vuelta y Parseval en 2D', () => {
  const nx = 16;
  const ny = 32;
  const x = randomSignal(nx * ny, 999);
  const X = fft2d(x.re, x.im, nx, ny);
  const back = ifft2d(X.re, X.im, nx, ny);
  closeArrays(back.re, x.re, 1e-12);
  closeArrays(back.im, x.im, 1e-12);
  let ex = 0;
  let eX = 0;
  for (let i = 0; i < nx * ny; i++) {
    ex += x.re[i] ** 2 + x.im[i] ** 2;
    eX += X.re[i] ** 2 + X.im[i] ** 2;
  }
  assert.ok(Math.abs(ex - eX / (nx * ny)) < 1e-11 * ex);
});

// Principio: una onda plana 2D e^{2πi(a·ix/nx + b·iy/ny)} tiene un único pico en
// (kx, ky) = (a, b). Comprueba que los ejes x e y no están intercambiados.
test('fft2d: una onda plana da un único pico en (kx, ky)', () => {
  const nx = 8;
  const ny = 16;
  const a = 2;
  const b = 5;
  const re = new Float64Array(nx * ny);
  const im = new Float64Array(nx * ny);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const phi = 2 * Math.PI * ((a * ix) / nx + (b * iy) / ny);
      re[iy * nx + ix] = Math.cos(phi);
      im[iy * nx + ix] = Math.sin(phi);
    }
  }
  const X = fft2d(re, im, nx, ny);
  const expected = new Float64Array(nx * ny);
  expected[b * nx + a] = nx * ny;
  closeArrays(X.re, expected, 1e-10);
  closeArrays(X.im, new Float64Array(nx * ny), 1e-10);
});

// Valores esperados: definición de numpy.fft.fftfreq y numpy.fft.fftshift.
test('fftfreq y fftshift', () => {
  assert.deepEqual(Array.from(fftfreq(8)), [0, 0.125, 0.25, 0.375, -0.5, -0.375, -0.25, -0.125]);
  assert.deepEqual(Array.from(fftfreq(4, 0.5)), [0, 0.5, -1, -0.5]);
  assert.deepEqual(Array.from(fftshift(fftfreq(4))), [-0.5, -0.25, 0, 0.25]);
  assert.deepEqual(fftshift([0, 1, 2, 3, 4, 5]), [3, 4, 5, 0, 1, 2]);
});

test('longitudes que no son potencia de 2 lanzan un error claro', () => {
  assert.equal(isPowerOfTwo(64), true);
  assert.equal(isPowerOfTwo(48), false);
  assert.equal(isPowerOfTwo(0), false);
  assert.throws(() => fft(new Float64Array(6)), /potencia de 2/);
  assert.throws(() => fft2d(new Float64Array(12), new Float64Array(12), 4, 3), /potencia de 2/);
  assert.throws(() => fft(new Float64Array(4), new Float64Array(8)), /misma longitud/);
});

// La entrada no se modifica (funciones puras).
test('fft no modifica la entrada', () => {
  const re = Float64Array.from([1, 2, 3, 4]);
  const im = Float64Array.from([0, 1, 0, 1]);
  fft(re, im);
  assert.deepEqual(Array.from(re), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(im), [0, 1, 0, 1]);
});
