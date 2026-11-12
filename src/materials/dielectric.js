// @ts-check
// Función dieléctrica de un material: a partir de datos tabulados o de un modelo.
//
//   const gold = createOpticalConstants(await loadMaterial('Au'));
//   gold.nk(532);        // { n, k } interpolados en 532 nm
//   gold.epsilon(532);   // ε = (n + ik)², un complejo { re, im }
//
// CONVENIO DE SIGNOS (el mismo en todo el laboratorio): los campos varían como e^{−iωt}.
// Con él, un material que absorbe tiene k > 0 e Im ε > 0, y la onda e^{i(n + ik)ωx/c} se
// atenúa al avanzar. Es el convenio de Bohren & Huffman, Jackson y Born & Wolf.
//
// Relación entre las dos descripciones:
//   ε = (n + ik)²      ⇒   Re ε = n² − k²,   Im ε = 2nk
// n dice cuánto se frena la fase; k, cuánto se atenúa la onda. Re ε < 0 (metales por
// debajo de su frecuencia de plasma) significa que k > n: la onda no se propaga.
//
// Todo son funciones puras.

import { createLinearInterpolator, createNaturalSpline } from '../core/interp.js';

/**
 * @typedef {import('../core/complex.js').Complex} Complex
 */

/**
 * Índice complejo → función dieléctrica: ε = (n + ik)².
 * @param {number} n
 * @param {number} k
 * @returns {Complex}
 */
export function nkToEpsilon(n, k) {
  return { re: n * n - k * k, im: 2 * n * k };
}

/**
 * Función dieléctrica → índice complejo: la raíz cuadrada de ε con n ≥ 0 (y k ≥ 0 si el
 * material absorbe, Im ε ≥ 0).
 *   n = √((|ε| + Re ε)/2),   k = √((|ε| − Re ε)/2)
 * @param {Complex} epsilon
 * @returns {{ n: number, k: number }}
 */
export function epsilonToNk(epsilon) {
  const modulus = Math.hypot(epsilon.re, epsilon.im);
  const n = Math.sqrt(Math.max(0, (modulus + epsilon.re) / 2));
  const k = Math.sqrt(Math.max(0, (modulus - epsilon.re) / 2));
  return { n, k: epsilon.im < 0 ? -k : k };
}

/**
 * Datos mínimos de un material tabulado (los JSON de data/materials/ los cumplen).
 * @typedef {object} TabulatedMaterial
 * @property {ArrayLike<number>} wavelength_nm longitudes de onda en el vacío, crecientes
 * @property {ArrayLike<number>} n
 * @property {ArrayLike<number>} k
 * @property {string} [id]
 */

/**
 * @typedef {object} OpticalConstants
 * @property {[number, number]} range intervalo tabulado (nm)
 * @property {(lambda: number) => boolean} covers ¿está λ dentro del intervalo tabulado?
 * @property {(lambda: number) => { n: number, k: number }} nk
 * @property {(lambda: number) => Complex} epsilon ε(λ) = (n + ik)²
 */

/**
 * Prepara un material tabulado para evaluarlo en cualquier longitud de onda.
 *
 * Se interpolan n y k (no ε) en función de λ. Por defecto la interpolación es lineal:
 * no inventa oscilaciones entre puntos, que es lo prudente con tablas experimentales
 * poco densas (Johnson & Christy tiene un punto cada 16–52 nm en el visible). Con
 * `interpolation: 'spline'` se usa una spline cúbica natural, adecuada para tablas
 * densas y suaves.
 *
 * FUERA DEL INTERVALO TABULADO se lanza un RangeError: no se extrapola en silencio.
 * Para saberlo antes de pedir un valor está covers(λ). Si de verdad se quiere prolongar
 * con el valor del extremo: `outOfRange: 'clamp'`.
 *
 * @param {TabulatedMaterial} material
 * @param {{ interpolation?: 'linear' | 'spline', outOfRange?: 'error' | 'clamp' }} [options]
 * @returns {OpticalConstants}
 */
export function createOpticalConstants(material, { interpolation = 'linear', outOfRange = 'error' } = {}) {
  const { wavelength_nm: wavelengths, n, k } = material;
  const create = interpolation === 'spline' ? createNaturalSpline : createLinearInterpolator;
  const nAt = create(wavelengths, n, { outOfRange });
  const kAt = create(wavelengths, k, { outOfRange });
  const first = wavelengths[0];
  const last = wavelengths[wavelengths.length - 1];
  const name = material.id ? ` de ${material.id}` : '';
  /** @param {number} lambda */
  const check = (lambda) => {
    if (outOfRange === 'error' && !(lambda >= first && lambda <= last)) {
      throw new RangeError(`λ = ${lambda} nm está fuera de los datos${name} (${first}–${last} nm)`);
    }
  };
  return {
    range: [first, last],
    covers: (lambda) => lambda >= first && lambda <= last,
    nk(lambda) {
      check(lambda);
      // La absorción no puede ser negativa: una spline podría bajar de cero entre puntos.
      return { n: nAt(lambda), k: Math.max(0, kAt(lambda)) };
    },
    epsilon(lambda) {
      const { n: nValue, k: kValue } = this.nk(lambda);
      return nkToEpsilon(nValue, kValue);
    },
  };
}

// --- Modelos paramétricos ----------------------------------------------------------------
// Frecuencias en cualquier unidad, siempre la misma para ω, ω_p, ω₀ y γ (rad/s o eV).

/**
 * Modelo de Drude: electrones libres con rozamiento (un oscilador sin muelle).
 *
 *   ε(ω) = ε∞ − ω_p² / (ω² + iγω)
 *
 * ω_p es la frecuencia de plasma (ω_p² = N·e²/(ε₀·m)), γ el ritmo de colisiones y ε∞ la
 * contribución constante de los electrones ligados. Con γ ≪ ω, Re ε cambia de signo en
 * ω = ω_p/√ε∞: por debajo el metal refleja; por encima, transmite.
 *
 * @param {{ epsInf?: number, omegaP: number, gamma: number }} model
 * @param {number} omega
 * @returns {Complex}
 */
export function drudeEpsilon({ epsInf = 1, omegaP, gamma }, omega) {
  // −ω_p²/(ω² + iγω) = −ω_p²·(ω² − iγω) / (ω⁴ + γ²ω²)
  const denominator = omega * omega * (omega * omega + gamma * gamma);
  const wp2 = omegaP * omegaP;
  return {
    re: epsInf - (wp2 * omega * omega) / denominator,
    im: (wp2 * gamma * omega) / denominator,
  };
}

/**
 * Oscilador de Lorentz: electrones ligados (el oscilador forzado del módulo «oscilador»).
 * @typedef {object} LorentzOscillator
 * @property {number} strength intensidad f del oscilador (adimensional)
 * @property {number} omega0 frecuencia propia
 * @property {number} gamma amortiguamiento
 */

/**
 * Modelo de Lorentz (suma de osciladores):
 *
 *   ε(ω) = ε∞ + Σ_j f_j·ω_p² / (ω₀j² − ω² − iγ_j·ω)
 *
 * Cada término es la respuesta de un oscilador armónico forzado y amortiguado: en fase
 * por debajo de su resonancia, en cuadratura (máxima absorción) en ω₀ y en oposición por
 * encima. Un oscilador con ω₀ = 0 es el término de Drude.
 *
 * @param {{ epsInf?: number, omegaP: number, oscillators: LorentzOscillator[] }} model
 * @param {number} omega
 * @returns {Complex}
 */
export function lorentzEpsilon({ epsInf = 1, omegaP, oscillators }, omega) {
  let re = epsInf;
  let im = 0;
  const wp2 = omegaP * omegaP;
  for (const { strength, omega0, gamma } of oscillators) {
    // 1/(a − ib) = (a + ib)/(a² + b²), con a = ω₀² − ω² y b = γω.
    const a = omega0 * omega0 - omega * omega;
    const b = gamma * omega;
    const denominator = a * a + b * b;
    re += (strength * wp2 * a) / denominator;
    im += (strength * wp2 * b) / denominator;
  }
  return { re, im };
}
