// @ts-check
// Aritmética de números complejos.
//
// Un complejo es un objeto plano { re, im }. Todas las funciones son puras: devuelven
// un objeto nuevo y no modifican sus argumentos.
//
// Para vectores grandes (FFT, funciones de onda en una malla) NO se usan arrays de
// estos objetos, sino dos Float64Array separados (parte real e imaginaria): ver fft.js.

/**
 * @typedef {{ re: number, im: number }} Complex
 */

/**
 * Crea un complejo a partir de sus partes real e imaginaria.
 * @param {number} re
 * @param {number} [im]
 * @returns {Complex}
 */
export function complex(re, im = 0) {
  return { re, im };
}

/** Unidad imaginaria i. @type {Readonly<Complex>} */
export const I = Object.freeze({ re: 0, im: 1 });
/** @type {Readonly<Complex>} */
export const ZERO = Object.freeze({ re: 0, im: 0 });
/** @type {Readonly<Complex>} */
export const ONE = Object.freeze({ re: 1, im: 0 });

/**
 * Crea un complejo a partir de módulo y argumento: r·e^{iθ}.
 * @param {number} r módulo
 * @param {number} theta argumento en radianes
 * @returns {Complex}
 */
export function fromPolar(r, theta) {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
}

/** Suma a + b. @param {Complex} a @param {Complex} b @returns {Complex} */
export function add(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

/** Resta a − b. @param {Complex} a @param {Complex} b @returns {Complex} */
export function sub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

/** Producto a·b. @param {Complex} a @param {Complex} b @returns {Complex} */
export function mul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

/**
 * Cociente a/b. Usa el algoritmo de Smith, que evita desbordamientos cuando |b| es
 * muy grande o muy pequeño (no calcula |b|² directamente).
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function div(a, b) {
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return { re: (a.re + a.im * r) / d, im: (a.im - a.re * r) / d };
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return { re: (a.re * r + a.im) / d, im: (a.im * r - a.re) / d };
}

/** Producto por un real, s·a. @param {Complex} a @param {number} s @returns {Complex} */
export function scale(a, s) {
  return { re: a.re * s, im: a.im * s };
}

/** Opuesto, −a. @param {Complex} a @returns {Complex} */
export function neg(a) {
  return { re: -a.re, im: -a.im };
}

/** Conjugado, a*. @param {Complex} a @returns {Complex} */
export function conj(a) {
  return { re: a.re, im: -a.im };
}

/** Módulo |a|. @param {Complex} a @returns {number} */
export function abs(a) {
  return Math.hypot(a.re, a.im);
}

/** Módulo al cuadrado |a|² = a·a*. @param {Complex} a @returns {number} */
export function abs2(a) {
  return a.re * a.re + a.im * a.im;
}

/**
 * Argumento (fase) en radianes, en el intervalo (−π, π].
 * @param {Complex} a
 * @returns {number}
 */
export function arg(a) {
  // "+ 0" convierte un −0 en +0. Sin ello, atan2(−0, −1) = −π: un real negativo cuya
  // parte imaginaria es un cero negativo (lo produce, por ejemplo, conj) tendría fase −π
  // en vez de +π y se saldría del intervalo documentado.
  return Math.atan2(a.im + 0, a.re);
}

/**
 * Exponencial compleja: e^{a} = e^{Re a}·(cos Im a + i sen Im a).
 * @param {Complex} a
 * @returns {Complex}
 */
export function exp(a) {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
}

/**
 * Logaritmo principal: ln|a| + i·arg(a), con la parte imaginaria en (−π, π].
 * @param {Complex} a
 * @returns {Complex}
 */
export function log(a) {
  return { re: Math.log(abs(a)), im: arg(a) };
}

/**
 * Raíz cuadrada principal (parte real ≥ 0). El corte de rama está en el eje real
 * negativo: sqrt(−1 + 0i) = +i. Desborda (devuelve Infinity) si |a| supera ~9e307.
 * @param {Complex} a
 * @returns {Complex}
 */
export function sqrt(a) {
  const r = abs(a);
  if (r === 0) return { re: 0, im: 0 };
  // Fórmula estable: evita restar números casi iguales.
  const re = Math.sqrt((r + Math.abs(a.re)) / 2);
  const im = a.im / (2 * re);
  if (a.re >= 0) return { re, im };
  return { re: Math.abs(im), im: a.im >= 0 ? re : -re };
}

/**
 * Compara dos complejos con una tolerancia absoluta.
 * @param {Complex} a
 * @param {Complex} b
 * @param {number} [tol]
 * @returns {boolean}
 */
export function equals(a, b, tol = 1e-12) {
  return Math.abs(a.re - b.re) <= tol && Math.abs(a.im - b.im) <= tol;
}
