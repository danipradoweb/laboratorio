// @ts-check
// Luz y materia, parte A: del oscilador forzado a la función dieléctrica.
//
// Un material es una colección de osciladores (electrones ligados a sus átomos, o libres
// en un metal). El campo eléctrico de la luz los fuerza a oscilar A SU FRECUENCIA, ω, y la
// polarización que resulta, P = ε₀·χ·E, da la función dieléctrica (modelo de Lorentz):
//
//   ε(ω) = 1 + χ(ω) = 1 + Σ_j  f_j·ω_p² / (ω₀j² − ω² − iγ_j·ω)
//
//   ω₀j  frecuencia propia del oscilador j        γ_j  su amortiguamiento
//   f_j  su intensidad (fracción de electrones)   ω_p  frecuencia de plasma, ω_p² = N·e²/(ε₀·m)
//
// Cada término es la respuesta χ(ω) del oscilador forzado del módulo «oscilador»: en fase
// con el campo por debajo de su resonancia, en cuadratura en ω₀ (máxima absorción) y en
// oposición por encima. Un oscilador con ω₀ = 0 es un electrón libre (modelo de Drude).
//
// CONVENIO: los campos varían como e^{−iωt}; absorber es Im ε > 0 y k > 0.
// UNIDADES: todas las frecuencias (ω, ω₀, ω_p, γ) van como energías de fotón ħω en eV.
// La longitud de onda en el vacío es λ = hc/(ħω) (conversiones en src/core/units.js).
//
// De ε salen el índice complejo n + ik = √ε, la reflectancia en incidencia normal y el
// coeficiente de absorción. Las partes B (láminas de dipolos) y C (Fresnel) están en
// physics-sheets.js y physics-fresnel.js.
//
// Referencias: Feynman, Lectures on Physics, vol. I, cap. 31 y vol. II, cap. 32;
// Griffiths, Introduction to Electrodynamics, 4.ª ed., §9.4.

import { epsilonToNk, lorentzEpsilon } from '../../materials/dielectric.js';
import { steadyState } from '../oscilador/physics.js';
import { eVToWavelengthNm, wavelengthNmToEV } from '../../core/units.js';

/**
 * @typedef {import('../../core/complex.js').Complex} Complex
 * @typedef {import('../../materials/dielectric.js').LorentzOscillator} LorentzOscillator
 */

/**
 * Modelo de Lorentz: ε(ω) = ε∞ + Σ_j f_j·ω_p²/(ω₀j² − ω² − iγ_j·ω). Frecuencias en eV.
 * @typedef {object} LorentzModel
 * @property {number} epsInf contribución constante (1 = vacío)
 * @property {number} omegaP ħω_p (eV)
 * @property {LorentzOscillator[]} oscillators cada uno con strength (f), omega0 y gamma (eV)
 */

/** Límites del espectro visible como energías de fotón (eV): 780 nm y 380 nm. */
export const VISIBLE_EV = /** @type {const} */ ([wavelengthNmToEV(780), wavelengthNmToEV(380)]);

/**
 * Anchura que se da a cada resonancia del «vidrio», como fracción de su frecuencia propia
 * (γ_j = ω₀j/100). ES UNA ELECCIÓN DEL MODELO, no un dato: la fórmula de Sellmeier de la
 * que salen las resonancias no tiene amortiguamiento. Sirve para que la absorción en cada
 * resonancia sea finita y se pueda dibujar. Efecto secundario: las alas de una lorentziana
 * caen despacio y dejan en el visible k ≈ 6·10⁻⁴, muchísimo más que un vidrio real.
 */
export const GLASS_RELATIVE_DAMPING = 1 / 100;

/**
 * Metal de Drude de ejemplo: ħω_p = 10 eV y ħγ = 0,1 eV. Son valores redondos elegidos
 * para la demostración (del orden de los de un metal real, cuya frecuencia de plasma cae
 * en el ultravioleta), no los de un metal concreto.
 */
export const DRUDE_EXAMPLE = /** @type {const} */ ({ omegaP: 10, gamma: 0.1 });

/**
 * Convierte una fórmula de Sellmeier en un modelo de Lorentz sin amortiguamiento.
 *
 * La fórmula (tipo 1 de refractiveindex.info, con λ y C_i en micrómetros) es
 *   n² − 1 = c₀ + Σ_i B_i·λ² / (λ² − C_i²)
 * y, como λ = 2πc/ω, cada término vale B_i·ω₀i²/(ω₀i² − ω²) con ω₀i = 2πc/C_i: es
 * exactamente un oscilador de Lorentz con γ = 0 e intensidad f_i·ω_p² = B_i·ω₀i². Sellmeier
 * es, pues, el modelo de Lorentz lejos de las resonancias. Se define ω_p² = Σ_i B_i·ω₀i²
 * para que las intensidades f_i sumen 1.
 *
 * @param {ArrayLike<number>} coefficients [c₀, B₁, C₁, B₂, C₂, …], C_i en micrómetros
 * @param {number} [relativeDamping] γ_i/ω₀i que se asigna a cada resonancia (0 = Sellmeier puro)
 * @returns {LorentzModel}
 */
export function sellmeierToLorentz(coefficients, relativeDamping = 0) {
  if (coefficients.length < 3 || coefficients.length % 2 !== 1) {
    throw new RangeError('sellmeierToLorentz: se esperan los coeficientes [c0, B1, C1, B2, C2, …]');
  }
  /** @type {{ weight: number, omega0: number }[]} */
  const terms = [];
  for (let i = 1; i < coefficients.length; i += 2) {
    const omega0 = wavelengthNmToEV(1000 * coefficients[i + 1]); // C_i (µm) → ħω₀ (eV)
    terms.push({ weight: coefficients[i] * omega0 * omega0, omega0 });
  }
  const omegaP2 = terms.reduce((sum, term) => sum + term.weight, 0);
  return {
    epsInf: 1 + coefficients[0],
    omegaP: Math.sqrt(omegaP2),
    oscillators: terms.map(({ weight, omega0 }) => ({
      strength: weight / omegaP2,
      omega0,
      gamma: relativeDamping * omega0,
    })),
  };
}

/**
 * Metal de Drude: un único «oscilador» sin muelle (ω₀ = 0).
 * @param {{ omegaP: number, gamma: number }} [parameters] en eV
 * @returns {LorentzModel}
 */
export function drudeModel({ omegaP, gamma } = DRUDE_EXAMPLE) {
  return { epsInf: 1, omegaP, oscillators: [{ strength: 1, omega0: 0, gamma }] };
}

/**
 * Material con un único oscilador de Lorentz (el «material editable» de la interfaz).
 * @param {{ omega0: number, omegaP: number, gamma: number }} parameters en eV
 * @returns {LorentzModel}
 */
export function singleOscillatorModel({ omega0, omegaP, gamma }) {
  return { epsInf: 1, omegaP, oscillators: [{ strength: 1, omega0, gamma }] };
}

/**
 * Función dieléctrica del modelo en una energía de fotón.
 * @param {LorentzModel} model
 * @param {number} energy ħω (eV)
 * @returns {Complex}
 */
export function modelEpsilon(model, energy) {
  return lorentzEpsilon(model, energy);
}

/**
 * Reflectancia en incidencia normal desde el vacío de un medio de índice n + ik:
 *   R = |(n + ik − 1)/(n + ik + 1)|² = ((n − 1)² + k²) / ((n + 1)² + k²)
 * @param {number} n
 * @param {number} k
 * @returns {number}
 */
export function normalReflectance(n, k) {
  return ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k);
}

/**
 * Coeficiente de absorción de la INTENSIDAD: I(z) = I₀·e^{−αz}, con α = 2kω/c = 4πk/λ.
 * (La amplitud del campo decae con α/2.)
 * @param {number} k coeficiente de extinción
 * @param {number} wavelength longitud de onda en el vacío (en la unidad que se quiera)
 * @returns {number} α en la unidad inversa de `wavelength`
 */
export function absorptionCoefficient(k, wavelength) {
  return (4 * Math.PI * k) / wavelength;
}

/**
 * Todo lo que se deduce de ε en una energía de fotón.
 * @typedef {object} OpticalFunctions
 * @property {Complex} epsilon
 * @property {number} n índice de refracción
 * @property {number} k coeficiente de extinción
 * @property {number} reflectance R en incidencia normal desde el vacío
 * @property {number} wavelength longitud de onda en el vacío (nm)
 * @property {number} absorption coeficiente de absorción α (1/nm)
 */

/**
 * @param {Complex} epsilon
 * @param {number} energy ħω (eV)
 * @returns {OpticalFunctions}
 */
export function opticalFunctions(epsilon, energy) {
  const { n, k } = epsilonToNk(epsilon);
  const wavelength = eVToWavelengthNm(energy);
  return {
    epsilon,
    n,
    k,
    reflectance: normalReflectance(n, k),
    wavelength,
    absorption: absorptionCoefficient(k, wavelength),
  };
}

/**
 * Curvas de ε, n, k y R en una malla de energías. `epsilonAt` puede devolver null donde
 * no hay datos (material tabulado fuera de su intervalo): ahí las curvas valen NaN y el
 * trazador corta la línea.
 * @param {(energy: number) => Complex | null} epsilonAt
 * @param {ArrayLike<number>} energies ħω (eV)
 */
export function opticalSpectrum(epsilonAt, energies) {
  const count = energies.length;
  const result = {
    energies: Float64Array.from(energies),
    epsRe: new Float64Array(count),
    epsIm: new Float64Array(count),
    n: new Float64Array(count),
    k: new Float64Array(count),
    reflectance: new Float64Array(count),
  };
  for (let i = 0; i < count; i++) {
    const epsilon = epsilonAt(energies[i]);
    if (!epsilon) {
      result.epsRe[i] = result.epsIm[i] = result.n[i] = result.k[i] = result.reflectance[i] = NaN;
      continue;
    }
    const { n, k } = epsilonToNk(epsilon);
    result.epsRe[i] = epsilon.re;
    result.epsIm[i] = epsilon.im;
    result.n[i] = n;
    result.k[i] = k;
    result.reflectance[i] = normalReflectance(n, k);
  }
  return result;
}

/**
 * Cómo responde cada oscilador del modelo a un campo de frecuencia ω.
 *
 * El desplazamiento del electrón es x(t) = A·cos(ωt − δ) cuando la fuerza es F₀·cos(ωt)
 * (régimen estacionario del oscilador forzado). La contribución del oscilador a la
 * susceptibilidad es χ_j = |χ_j|·e^{iδ}, con |χ_j| = f_j·ω_p²/√((ω₀j² − ω²)² + γ_j²ω²):
 *   δ ≈ 0     la polarización sigue al campo: suma a Re ε (n > 1), no absorbe
 *   δ = 90°   resonancia: toda la respuesta es absorción (Im ε)
 *   δ ≈ 180°  oposición: Re χ < 0 (así hace Re ε < 0 un metal por debajo de ω_p)
 *
 * @param {LorentzModel} model
 * @param {number} energy ħω (eV)
 * @returns {{ omega0: number, gamma: number, strength: number, chi: Complex, magnitude: number, phase: number }[]}
 *   phase = δ en radianes, entre 0 y π
 */
export function oscillatorResponses(model, energy) {
  return model.oscillators.map(({ strength, omega0, gamma }) => {
    // El oscilador del módulo «oscilador» con m = 1 y F₀ = f·ω_p²: su amplitud es |χ_j|.
    const { amplitude, phase } = steadyState({
      m: 1,
      gamma,
      omega0,
      F0: strength * model.omegaP * model.omegaP,
      omega: energy,
    });
    return {
      omega0,
      gamma,
      strength,
      chi: { re: amplitude * Math.cos(phase), im: amplitude * Math.sin(phase) },
      magnitude: amplitude,
      phase,
    };
  });
}

/**
 * Relación de Kramers-Kronig: la parte real de ε a partir de su parte imaginaria.
 *
 *   ε′(ω) − ε∞ = (2/π) · P∫₀^∞ ω′·ε″(ω′) / (ω′² − ω²) dω′
 *
 * Es consecuencia de la causalidad (el material no responde antes de que llegue el
 * campo): la absorción en TODAS las frecuencias fija el índice en cada una.
 *
 * La integral en valor principal se calcula con la regla de Maclaurin: ε″ se da en una
 * malla uniforme ω_m = m·step (m = 0, 1, 2…) y, para evaluar en el nodo `index`, se suman
 * solo los nodos de la otra paridad (paso 2·step), de modo que nunca se pisa el polo
 * ω′ = ω y los errores a uno y otro lado se compensan. La malla debe llegar mucho más
 * allá de la última resonancia: lo que queda por encima del último nodo no se suma.
 *
 * @param {number} step separación de la malla de frecuencias
 * @param {ArrayLike<number>} epsIm ε″ en ω_m = m·step
 * @param {number} index nodo en el que se evalúa ε′
 * @returns {number} ε′(ω_index) − ε∞
 */
export function kramersKronigReal(step, epsIm, index) {
  const omega = index * step;
  let sum = 0;
  for (let m = (index + 1) % 2; m < epsIm.length; m += 2) {
    const other = m * step;
    sum += (other * epsIm[m]) / (other * other - omega * omega);
  }
  return (2 / Math.PI) * sum * 2 * step;
}
