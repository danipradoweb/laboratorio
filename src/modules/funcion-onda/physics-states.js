// @ts-check
// Estados propios de la ecuación de Schrödinger 1D y su superposición.
//
//   −(ħ²/2m)·φ″ + V(x)·φ = E·φ
//
// MÉTODO: diferencias finitas de tres puntos en una malla de nodos x_0 … x_{N−1}
// equiespaciados (Δx), con φ = 0 justo fuera de la malla (paredes infinitas en
// x_0 − Δx y x_{N−1} + Δx). El hamiltoniano es una matriz tridiagonal simétrica,
//   H_ii = 2a/Δx² + V(x_i),   H_{i,i±1} = −a/Δx²,   a = ħ²/2m,
// que se diagonaliza con src/core/linalg.js (bisección de Sturm e iteración inversa).
// Error de los niveles: O(Δx²). En el pozo infinito los niveles discretos son
// E_n = (2a/Δx²)·(1 − cos(nπΔx/L)), con L = (N + 1)·Δx, que tienden a n²π²a/L².
//
// EVOLUCIÓN: un estado propio solo gira de fase, φ_n·e^{−iE_n t/ħ}. Una superposición
// ψ = Σ c_n φ_n evoluciona como ψ(x, t) = Σ c_n φ_n(x)·e^{−iE_n t/ħ}: cada término gira a
// su ritmo, y lo que se ve en |ψ|² son las fases RELATIVAS entre términos. Con dos estados,
// |ψ|² y ⟨x⟩ oscilan con frecuencia angular (E₂ − E₁)/ħ.
//
// Referencias: Griffiths, Introduction to Quantum Mechanics (3.ª ed.), §2.2 (pozo
// infinito), §2.3 (oscilador armónico), §2.6 (pozo finito); Levine, Quantum Chemistry,
// caps. 2–4; Feynman Lectures vol. III cap. 7 (estados estacionarios).

import { eigTridiagonal } from '../../core/linalg.js';
import { HC_EV_NM } from '../../core/units.js';
import { HBAR_EV_FS, kineticCoefficient } from './physics.js';

/**
 * Estados propios más bajos de un potencial dado en una malla de nodos.
 * @param {ArrayLike<number>} x nodos equiespaciados (nm)
 * @param {ArrayLike<number>} potential V en los nodos (eV)
 * @param {{ count: number, mass?: number }} options
 * @returns {{ energies: Float64Array, states: Float64Array[], dx: number }}
 *   energies en eV, en orden creciente; states[n] normalizado a ∫φ²dx = 1, real, con el
 *   signo elegido para que empiece siendo positivo (primer lóbulo apreciable hacia arriba)
 */
export function eigenstates(x, potential, { count, mass = 1 }) {
  const n = x.length;
  const dx = x[1] - x[0];
  const a = kineticCoefficient(mass);
  const diag = new Float64Array(n);
  const off = new Float64Array(n - 1).fill(-a / (dx * dx));
  for (let i = 0; i < n; i++) diag[i] = (2 * a) / (dx * dx) + potential[i];
  const { values, vectors } = eigTridiagonal(diag, off, { count });
  const scale = 1 / Math.sqrt(dx);
  const states = vectors.map((v) => {
    const phi = v.map((c) => c * scale);
    // Signo reproducible: positivo en el primer punto donde |φ| supera el 10 % de su máximo.
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(phi[i]));
    let i = 0;
    while (i < n - 1 && Math.abs(phi[i]) < 0.1 * max) i++;
    if (phi[i] < 0) for (let j = 0; j < n; j++) phi[j] = -phi[j];
    return phi;
  });
  return { energies: values, states, dx };
}

/**
 * Niveles del pozo infinito de anchura L: E_n = n²π²ħ²/(2mL²) (Griffiths ec. 2.30).
 * @param {number} n 1, 2, 3…
 * @param {number} width L (nm)
 * @param {number} [mass]
 */
export function infiniteWellEnergy(n, width, mass = 1) {
  return (n * n * Math.PI * Math.PI * kineticCoefficient(mass)) / (width * width);
}

/**
 * Niveles del oscilador armónico: E_n = ħω(n + ½) (Griffiths ec. 2.62).
 * @param {number} n 0, 1, 2…
 * @param {number} quantum ħω (eV)
 */
export function harmonicEnergy(n, quantum) {
  return quantum * (n + 0.5);
}

/**
 * Superposición de estados propios en el instante t:
 *   ψ(x, t) = Σ_n c_n·φ_n(x)·e^{−iE_n t/ħ}
 * @param {Float64Array[]} states φ_n (reales)
 * @param {ArrayLike<number>} energies E_n (eV)
 * @param {{ re: number, im: number }[]} coefficients c_n (los que falten valen 0)
 * @param {number} t fs
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function superpose(states, energies, coefficients, t) {
  const n = states[0].length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  coefficients.forEach((c, m) => {
    if (!c || (c.re === 0 && c.im === 0)) return;
    const phase = (-energies[m] * t) / HBAR_EV_FS;
    const cr = c.re * Math.cos(phase) - c.im * Math.sin(phase);
    const ci = c.re * Math.sin(phase) + c.im * Math.cos(phase);
    const phi = states[m];
    for (let j = 0; j < n; j++) {
      re[j] += cr * phi[j];
      im[j] += ci * phi[j];
    }
  });
  return { re, im };
}

/**
 * Coeficientes de una superposición de dos estados con peso y fase relativa:
 *   ψ = √(1 − w)·φ_a + √w·e^{iθ}·φ_b
 * (los demás coeficientes, 0). El peso w = |c_b|² es la probabilidad de medir E_b.
 * @param {number} count número total de estados
 * @param {number} a índice del primer estado (0 = fundamental)
 * @param {number} b índice del segundo estado
 * @param {number} weight w ∈ [0, 1]
 * @param {number} relativePhase θ (radianes)
 * @returns {{ re: number, im: number }[]}
 */
export function twoStateCoefficients(count, a, b, weight, relativePhase) {
  const c = Array.from({ length: count }, () => ({ re: 0, im: 0 }));
  const w = Math.min(1, Math.max(0, weight));
  if (a === b) {
    c[a] = { re: 1, im: 0 };
    return c;
  }
  c[a] = { re: Math.sqrt(1 - w), im: 0 };
  c[b] = { re: Math.sqrt(w) * Math.cos(relativePhase), im: Math.sqrt(w) * Math.sin(relativePhase) };
  return c;
}

/**
 * Elemento de matriz de la posición, ⟨φ_a|x|φ_b⟩ = ∫φ_a·x·φ_b dx (estados reales).
 * @param {ArrayLike<number>} x
 * @param {ArrayLike<number>} phiA
 * @param {ArrayLike<number>} phiB
 * @param {number} dx
 */
export function positionMatrixElement(x, phiA, phiB, dx) {
  let s = 0;
  for (let j = 0; j < x.length; j++) s += phiA[j] * x[j] * phiB[j];
  return s * dx;
}

/**
 * ⟨x⟩(t) de una superposición de dos estados, ψ = c_a φ_a + c_b φ_b (normalizada):
 *   ⟨x⟩ = |c_a|²x_aa + |c_b|²x_bb + 2·Re(c_a*·c_b·x_ab·e^{−iωt}),   ω = (E_b − E_a)/ħ
 * Oscila con frecuencia angular ω alrededor de su media, con amplitud 2|c_a||c_b||x_ab|.
 * @param {{ xaa: number, xbb: number, xab: number }} elements
 * @param {{ re: number, im: number }} ca
 * @param {{ re: number, im: number }} cb
 * @param {number} omega fs⁻¹
 * @param {number} t fs
 */
export function twoStateMeanPosition({ xaa, xbb, xab }, ca, cb, omega, t) {
  const pa = ca.re * ca.re + ca.im * ca.im;
  const pb = cb.re * cb.re + cb.im * cb.im;
  // c_a*·c_b
  const pr = ca.re * cb.re + ca.im * cb.im;
  const pi = ca.re * cb.im - ca.im * cb.re;
  const cr = Math.cos(-omega * t);
  const ci = Math.sin(-omega * t);
  return pa * xaa + pb * xbb + 2 * xab * (pr * cr - pi * ci);
}

/**
 * Datos de la transición entre dos niveles: lo que conecta la superposición con la luz.
 * Una carga cuya ⟨x⟩ oscila a ω = ΔE/ħ es un dipolo oscilante, que absorbe y emite luz de
 * esa frecuencia: fotones de energía ΔE y longitud de onda λ = hc/ΔE.
 * @param {number} e1 eV
 * @param {number} e2 eV
 * @returns {{ deltaE: number, omega: number, period: number, frequencyTHz: number, wavelengthNm: number }}
 *   omega en rad/fs, period en fs, frequencyTHz = ΔE/h en THz, wavelengthNm = hc/ΔE
 */
export function transition(e1, e2) {
  const deltaE = Math.abs(e2 - e1);
  const omega = deltaE / HBAR_EV_FS;
  const period = (2 * Math.PI) / omega;
  return {
    deltaE,
    omega,
    period,
    frequencyTHz: 1e3 / period, // 1/fs = 10¹⁵ Hz = 10³ THz
    wavelengthNm: HC_EV_NM / deltaE,
  };
}

/**
 * Niveles ligados de un pozo finito de profundidad V₀ y anchura w (V = −V₀ dentro), por
 * las ecuaciones trascendentes de Griffiths §2.6 (con el origen de energías en el fondo
 * del pozo desplazado): pares, q·tan(qw/2) = κ; impares, −q·cot(qw/2) = κ; con
 * q = √(2m(E + V₀))/ħ y κ = √(−2mE)/ħ. Se resuelven por bisección en cada rama.
 * Sirve de referencia independiente para la diagonalización.
 * @param {number} depth V₀ (eV)
 * @param {number} width w (nm)
 * @param {number} [mass]
 * @returns {number[]} energías (eV, negativas), de menor a mayor
 */
export function finiteWellLevels(depth, width, mass = 1) {
  const a = kineticCoefficient(mass);
  const q0 = Math.sqrt(depth / a); // q cuando E = 0
  const half = width / 2;
  /** @param {number} q */
  const kappa = (q) => Math.sqrt(Math.max(0, q0 * q0 - q * q));
  /** @type {number[]} */
  const levels = [];
  // Ramas de z = q·w/2 entre m·π/2 y (m + 1)·π/2: pares para m par, impares para m impar.
  for (let m = 0; (m * Math.PI) / 2 < q0 * half; m++) {
    const even = m % 2 === 0;
    /** @param {number} q */
    const f = (q) => (even ? q * Math.tan(q * half) - kappa(q) : -q / Math.tan(q * half) - kappa(q));
    let lo = ((m * Math.PI) / 2) / half + 1e-12;
    let hi = Math.min((((m + 1) * Math.PI) / 2) / half - 1e-12, q0);
    if (f(lo) * f(hi) > 0) continue;
    for (let i = 0; i < 200; i++) {
      const mid = 0.5 * (lo + hi);
      if (f(lo) * f(mid) <= 0) hi = mid;
      else lo = mid;
    }
    const q = 0.5 * (lo + hi);
    levels.push(a * q * q - depth);
  }
  return levels;
}
