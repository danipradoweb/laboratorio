// @ts-check
// Transformada rápida de Fourier (FFT) radix-2, en 1D y 2D.
//
// CONVENIO (el mismo que numpy.fft):
//   directa:  X[k] = Σ_{n=0}^{N−1} x[n]·e^{−2πi·k·n/N}
//   inversa:  x[n] = (1/N)·Σ_{k=0}^{N−1} X[k]·e^{+2πi·k·n/N}
// Con este convenio, el teorema de Parseval es  Σ|x[n]|² = (1/N)·Σ|X[k]|².
//
// Los datos complejos se pasan como dos Float64Array de la misma longitud (parte real
// e imaginaria). La longitud debe ser una potencia de 2. Las funciones devuelven
// arrays nuevos y no modifican la entrada.
//
// En 2D la malla se guarda por filas: el elemento (ix, iy) está en el índice
// iy·nx + ix, con nx columnas y ny filas.

/**
 * @typedef {{ re: Float64Array, im: Float64Array }} ComplexArray
 */

/**
 * ¿Es n una potencia de 2 (1, 2, 4, 8…)?
 * @param {number} n
 * @returns {boolean}
 */
export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/**
 * FFT in situ sobre un tramo de los arrays (algoritmo iterativo de Cooley-Tukey).
 * Función interna: no normaliza. Recorre los elementos offset, offset+stride, …
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {number} n número de elementos del tramo (potencia de 2)
 * @param {number} offset índice del primer elemento
 * @param {number} stride separación entre elementos consecutivos
 * @param {number} sign −1 para la directa, +1 para la inversa
 */
function transformInPlace(re, im, n, offset, stride, sign) {
  // 1) Reordenación por inversión de bits.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const a = offset + i * stride;
      const b = offset + j * stride;
      const tr = re[a];
      re[a] = re[b];
      re[b] = tr;
      const ti = im[a];
      im[a] = im[b];
      im[b] = ti;
    }
  }
  // 2) Mariposas: se combinan bloques de tamaño 2, 4, 8, …, n.
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (sign * 2 * Math.PI) / size;
    for (let k = 0; k < half; k++) {
      // Factor de giro e^{sign·2πi·k/size}, calculado directamente para no acumular error.
      const wr = Math.cos(theta * k);
      const wi = Math.sin(theta * k);
      for (let start = 0; start < n; start += size) {
        const a = offset + (start + k) * stride;
        const b = offset + (start + k + half) * stride;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/**
 * @param {ArrayLike<number>} re
 * @param {ArrayLike<number>} im
 * @param {number} expected
 */
function checkInput(re, im, expected) {
  if (re.length !== im.length) {
    throw new RangeError(`fft: re (${re.length}) e im (${im.length}) deben tener la misma longitud`);
  }
  if (re.length !== expected) {
    throw new RangeError(`fft: se esperaban ${expected} elementos y hay ${re.length}`);
  }
}

/**
 * @param {number} n
 * @param {string} name
 */
function checkPowerOfTwo(n, name) {
  if (!isPowerOfTwo(n)) {
    throw new RangeError(`fft: ${name} = ${n} debe ser una potencia de 2`);
  }
}

/**
 * FFT directa 1D.
 * @param {ArrayLike<number>} re parte real de la señal
 * @param {ArrayLike<number>} [im] parte imaginaria (ceros si se omite)
 * @returns {ComplexArray} X[k], k = 0…N−1
 */
export function fft(re, im) {
  const n = re.length;
  checkPowerOfTwo(n, 'N');
  const outRe = Float64Array.from(re);
  const outIm = im ? Float64Array.from(im) : new Float64Array(n);
  checkInput(outRe, outIm, n);
  transformInPlace(outRe, outIm, n, 0, 1, -1);
  return { re: outRe, im: outIm };
}

/**
 * FFT inversa 1D (incluye el factor 1/N).
 * @param {ArrayLike<number>} re
 * @param {ArrayLike<number>} im
 * @returns {ComplexArray} x[n], n = 0…N−1
 */
export function ifft(re, im) {
  const n = re.length;
  checkPowerOfTwo(n, 'N');
  const outRe = Float64Array.from(re);
  const outIm = Float64Array.from(im);
  checkInput(outRe, outIm, n);
  transformInPlace(outRe, outIm, n, 0, 1, +1);
  for (let i = 0; i < n; i++) {
    outRe[i] /= n;
    outIm[i] /= n;
  }
  return { re: outRe, im: outIm };
}

/**
 * @param {ArrayLike<number>} re
 * @param {ArrayLike<number>} im
 * @param {number} nx
 * @param {number} ny
 * @param {number} sign
 * @returns {ComplexArray}
 */
function transform2d(re, im, nx, ny, sign) {
  checkPowerOfTwo(nx, 'nx');
  checkPowerOfTwo(ny, 'ny');
  const outRe = Float64Array.from(re);
  const outIm = Float64Array.from(im);
  checkInput(outRe, outIm, nx * ny);
  // La transformada 2D es separable: primero cada fila, después cada columna.
  for (let iy = 0; iy < ny; iy++) transformInPlace(outRe, outIm, nx, iy * nx, 1, sign);
  for (let ix = 0; ix < nx; ix++) transformInPlace(outRe, outIm, ny, ix, nx, sign);
  if (sign > 0) {
    const total = nx * ny;
    for (let i = 0; i < total; i++) {
      outRe[i] /= total;
      outIm[i] /= total;
    }
  }
  return { re: outRe, im: outIm };
}

/**
 * FFT directa 2D: X[kx, ky] = Σ x[nx, ny]·e^{−2πi(kx·nx/Nx + ky·ny/Ny)}.
 * @param {ArrayLike<number>} re malla por filas (índice iy·nx + ix)
 * @param {ArrayLike<number>} im
 * @param {number} nx número de columnas (potencia de 2)
 * @param {number} ny número de filas (potencia de 2)
 * @returns {ComplexArray}
 */
export function fft2d(re, im, nx, ny) {
  return transform2d(re, im, nx, ny, -1);
}

/**
 * FFT inversa 2D (incluye el factor 1/(nx·ny)).
 * @param {ArrayLike<number>} re
 * @param {ArrayLike<number>} im
 * @param {number} nx
 * @param {number} ny
 * @returns {ComplexArray}
 */
export function ifft2d(re, im, nx, ny) {
  return transform2d(re, im, nx, ny, +1);
}

/**
 * Frecuencias de cada índice de la FFT, en ciclos por unidad de x (como numpy.fft.fftfreq):
 * [0, 1, …, N/2−1, −N/2, …, −1] / (N·dx).
 * Para obtener el número de onda angular k, multiplica por 2π.
 * @param {number} n número de puntos
 * @param {number} [dx] separación entre muestras
 * @returns {Float64Array}
 */
export function fftfreq(n, dx = 1) {
  const out = new Float64Array(n);
  const half = Math.floor((n + 1) / 2); // primeros índices: frecuencias ≥ 0
  for (let i = 0; i < n; i++) {
    out[i] = (i < half ? i : i - n) / (n * dx);
  }
  return out;
}

/**
 * Reordena un array para que la frecuencia cero quede en el centro
 * (como numpy.fft.fftshift). Útil para dibujar espectros.
 * @template {Float64Array | number[]} T
 * @param {T} values
 * @returns {T}
 */
export function fftshift(values) {
  const n = values.length;
  const shift = Math.floor(n / 2);
  const out = /** @type {T} */ (values.slice());
  for (let i = 0; i < n; i++) out[(i + shift) % n] = values[i];
  return out;
}
