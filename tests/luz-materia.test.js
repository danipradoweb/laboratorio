// @ts-check
// Tests de la parte A del módulo «luz y materia» (src/modules/luz-materia/physics.js):
// del oscilador forzado a la función dieléctrica (modelo de Lorentz y de Drude).
//
// Las partes B y C tienen sus tests en luz-materia-laminas.test.js y
// luz-materia-fresnel.test.js.
//
// Unidades: todas las frecuencias son energías de fotón ħω en eV.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRUDE_EXAMPLE,
  GLASS_RELATIVE_DAMPING,
  VISIBLE_EV,
  absorptionCoefficient,
  drudeModel,
  kramersKronigReal,
  modelEpsilon,
  normalReflectance,
  opticalFunctions,
  opticalSpectrum,
  oscillatorResponses,
  sellmeierToLorentz,
  singleOscillatorModel,
} from '../src/modules/luz-materia/physics.js';
import { loadMaterial } from '../src/materials/library.js';
import { epsilonToNk } from '../src/materials/dielectric.js';
import { wavelengthNmToEV } from '../src/core/units.js';
import * as C from '../src/core/complex.js';

/** Sílice fundida de la biblioteca: tabla generada con la fórmula de Sellmeier de Malitson. */
const silica = /** @type {any} */ (await loadMaterial('SiO2'));
/** @type {number[]} */
const SELLMEIER = silica.formula_original.coeficientes;

/** Los tres materiales modelo de la interfaz. */
const glass = sellmeierToLorentz(SELLMEIER, GLASS_RELATIVE_DAMPING);
const metal = drudeModel();
const single = singleOscillatorModel({ omega0: 4, omegaP: 6, gamma: 0.5 });

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} rel tolerancia relativa
 * @param {string} [msg]
 */
function close(actual, expected, rel, msg = '') {
  const scale = Math.max(Math.abs(expected), 1e-300);
  assert.ok(Math.abs(actual - expected) / scale <= rel, `${msg} obtenido ${actual}, esperado ${expected}`);
}

/**
 * Integral de f en [a, b] con la regla de Simpson compuesta (n subintervalos, n par).
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n
 */
function simpson(f, a, b, n) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  return (sum * h) / 3;
}

// --- Sellmeier es Lorentz sin amortiguamiento ---------------------------------------------

// Principio: cada término B·λ²/(λ² − C²) de la fórmula de Sellmeier es un oscilador de
// Lorentz con γ = 0, ω₀ = 2πc/C e intensidad f·ω_p² = B·ω₀². Referencia independiente: la
// tabla n(λ) de data/materials/SiO2.json, que generó tools/materials.mjs evaluando la
// fórmula de Malitson directamente en longitudes de onda. Las dos cuentas solo comparten
// los coeficientes; deben coincidir salvo redondeo (10⁻¹²).
test('Sellmeier → Lorentz reproduce la tabla de la sílice fundida', () => {
  const model = sellmeierToLorentz(SELLMEIER);
  assert.equal(model.oscillators.length, 3);
  for (let i = 0; i < silica.wavelength_nm.length; i++) {
    const epsilon = modelEpsilon(model, wavelengthNmToEV(silica.wavelength_nm[i]));
    assert.equal(epsilon.im, 0, 'sin amortiguamiento no hay absorción');
    close(Math.sqrt(epsilon.re), silica.n[i], 1e-12, `λ = ${silica.wavelength_nm[i]} nm:`);
  }
});

// Valor experimental bien establecido: el índice de la sílice fundida en la línea d del
// helio (587,56 nm) es n_d = 1,4585 (Malitson 1965; es el valor de catálogo del vidrio
// de sílice). Tolerancia: la última cifra dada.
test('sílice: n_d = 1,4585 en 587,56 nm', () => {
  const epsilon = modelEpsilon(sellmeierToLorentz(SELLMEIER), wavelengthNmToEV(587.56));
  assert.ok(Math.abs(Math.sqrt(epsilon.re) - 1.4585) < 5e-5, `n_d = ${Math.sqrt(epsilon.re)}`);
});

// Principio: las intensidades de oscilador se definen como fracciones, Σ f_j = 1, y
// ω_p² = Σ B_j·ω₀j² (identidad algebraica de la conversión). Las resonancias de la sílice
// quedan donde dice la fórmula: dos en el ultravioleta (C = 68,4 y 116,2 nm) y una en el
// infrarrojo (C = 9,896 µm).
test('Sellmeier → Lorentz: intensidades que suman 1 y resonancias en el UV y en el IR', () => {
  const model = sellmeierToLorentz(SELLMEIER);
  close(model.oscillators.reduce((s, o) => s + o.strength, 0), 1, 1e-14);
  let sum = 0;
  for (let i = 1; i < SELLMEIER.length; i += 2) {
    const omega0 = wavelengthNmToEV(1000 * SELLMEIER[i + 1]);
    sum += SELLMEIER[i] * omega0 ** 2;
    close(model.oscillators[(i - 1) / 2].omega0, omega0, 1e-14);
  }
  close(model.omegaP ** 2, sum, 1e-14);
  const [uv1, uv2, ir] = model.oscillators.map((o) => o.omega0);
  assert.ok(uv1 > VISIBLE_EV[1] && uv2 > VISIBLE_EV[1], 'dos resonancias por encima del visible');
  assert.ok(ir < VISIBLE_EV[0], 'una resonancia por debajo del visible');
  assert.throws(() => sellmeierToLorentz([0, 1]), RangeError);
});

// --- El vidrio en el visible ---------------------------------------------------------------

// Principio (lo que pide el encargo): con las resonancias en el UV y en el IR, en el
// visible los osciladores del UV responden en fase (ω < ω₀) y suman a Re ε, así que
// n > 1; n crece con ω (dispersión normal: nos acercamos a la resonancia UV) y k ≈ 0.
// La cota de k es la del modelo con γ = ω₀/100 (k ~ 6·10⁻⁴; en general k ≈ ε″/2n con
// ε″ ≈ Σ f·ω_p²·γω/(ω₀² − ω²)², que con estas resonancias da k ≈ 0,06·γ/ω₀): es mucho
// mayor que la de un vidrio real porque las alas de una lorentziana caen despacio (ver
// la ficha), pero es más de 1000 veces menor que n.
test('vidrio en el visible: n > 1, dispersión normal y k ≈ 0', () => {
  let previous = 0;
  for (let energy = VISIBLE_EV[0]; energy <= VISIBLE_EV[1]; energy += 0.05) {
    const { n, k } = epsilonToNk(modelEpsilon(glass, energy));
    assert.ok(n > 1.4 && n < 1.5, `n = ${n} en ${energy} eV`);
    assert.ok(n > previous, `n debe crecer con ω (dispersión normal) en ${energy} eV`);
    assert.ok(k > 0 && k < 0.1 * GLASS_RELATIVE_DAMPING, `k = ${k} en ${energy} eV`);
    previous = n;
  }
  // El amortiguamiento añadido apenas cambia n en el visible respecto a Sellmeier puro
  // (la corrección es de orden (γω/(ω₀² − ω²))² ~ 10⁻⁵).
  const pure = sellmeierToLorentz(SELLMEIER);
  const a = epsilonToNk(modelEpsilon(glass, 2.25)).n;
  const b = epsilonToNk(modelEpsilon(pure, 2.25)).n;
  assert.ok(Math.abs(a - b) < 1e-4, `n con y sin amortiguamiento: ${a} y ${b}`);
});

// Principio: en una resonancia el oscilador va en cuadratura (δ = 90° exactos en ω = ω₀,
// porque tan δ = γω/(ω₀² − ω²)), la absorción ε″ es máxima cerca de ω₀ y el índice BAJA
// al aumentar ω (dispersión anómala) dentro de la línea.
test('vidrio en su resonancia UV: cuadratura, absorción máxima y dispersión anómala', () => {
  const resonance = glass.oscillators[1]; // la de 116 nm (≈ 10,7 eV)
  const responses = oscillatorResponses(glass, resonance.omega0);
  close(responses[1].phase, Math.PI / 2, 1e-12, 'desfase en resonancia:');
  // Los otros dos: el de mayor ω₀ sigue casi en fase; el del IR, casi en oposición.
  assert.ok(responses[0].phase < 0.2, `oscilador de 68 nm: δ = ${responses[0].phase}`);
  assert.ok(responses[2].phase > Math.PI - 0.01, `oscilador del IR: δ = ${responses[2].phase}`);
  // ε″ tiene un máximo local a menos de γ de ω₀.
  const im = (/** @type {number} */ e) => modelEpsilon(glass, e).im;
  const w0 = resonance.omega0;
  assert.ok(im(w0) > im(w0 - resonance.gamma) && im(w0) > im(w0 + resonance.gamma));
  assert.ok(im(w0) > 10, `ε″(ω₀) = ${im(w0)}: absorción fuerte`);
  // Dispersión anómala: n decrece entre ω₀ − γ/4 y ω₀ + γ/4.
  const n = (/** @type {number} */ e) => epsilonToNk(modelEpsilon(glass, e)).n;
  assert.ok(n(w0 + resonance.gamma / 4) < n(w0 - resonance.gamma / 4));
});

// --- Límites de ε ------------------------------------------------------------------------

// Principio: a frecuencia muy alta los electrones no tienen tiempo de responder y todos se
// comportan como libres: ε → 1 − ω_p²·Σf/ω² → 1. Se comprueba el límite y también el
// coeficiente del término 1/ω² (desarrollo de la fórmula de Lorentz para ω ≫ ω₀, γ).
test('ε → 1 cuando ω → ∞, como 1 − ω_p²·Σf/ω²', () => {
  for (const model of [glass, metal, single]) {
    const total = model.omegaP ** 2 * model.oscillators.reduce((s, o) => s + o.strength, 0);
    for (const omega of [1e3, 1e4, 1e5]) {
      const epsilon = modelEpsilon(model, omega);
      assert.ok(Math.abs(epsilon.re - 1) < (1.01 * total) / omega ** 2);
      close(1 - epsilon.re, total / omega ** 2, 1e-3, `ω = ${omega}:`);
      assert.ok(epsilon.im >= 0 && epsilon.im < 1e-5);
    }
  }
  assert.ok(Math.abs(modelEpsilon(glass, 1e8).re - 1) < 1e-12);
});

// Principio: a frecuencia nula cada oscilador ligado se estira como un muelle estático:
// ε(0) = 1 + Σ f_j·ω_p²/ω₀j². Para la sílice eso es 1 + ΣB_i (Sellmeier con λ → ∞).
test('límite estático: ε(0) = 1 + Σ f·ω_p²/ω₀²', () => {
  const sumB = SELLMEIER[1] + SELLMEIER[3] + SELLMEIER[5];
  const epsilon = modelEpsilon(glass, 0);
  close(epsilon.re, 1 + sumB, 1e-13);
  assert.equal(epsilon.im, 0);
  close(modelEpsilon(single, 0).re, 1 + 36 / 16, 1e-14);
});

// --- Causalidad: Kramers-Kronig ------------------------------------------------------------

// Principio: causalidad ⇒ ε′(ω) − 1 = (2/π)·P∫ ω′ε″(ω′)/(ω′² − ω²) dω′. Se reconstruye ε′
// solo a partir de ε″ (integral numérica) y se compara con la ε′ de la fórmula de
// Lorentz. Tolerancia: 2·10⁻⁴ absoluta, que cubre el error de la cuadratura (malla de
// 0,002 eV frente a líneas de anchura ≥ 0,1 eV) y lo que queda fuera de la malla (por
// encima de 600 eV, del orden de ω_p²γ/ω_max³ ~ 10⁻⁷).
test('Kramers-Kronig: ε′ reconstruida a partir de ε″ (un oscilador y metal de Drude)', () => {
  const step = 0.002;
  const count = 300001; // hasta 600 eV
  for (const [name, model] of /** @type {const} */ ([['un oscilador', single], ['Drude', metal]])) {
    const epsIm = new Float64Array(count);
    for (let m = 1; m < count; m++) epsIm[m] = modelEpsilon(model, m * step).im;
    // En ω = 0 un conductor tiene ε″ → ∞, pero el integrando ω′ε″ es finito. Se evalúa ε′
    // en nodos pares, para los que la regla de Maclaurin solo usa nodos impares.
    for (const energy of [0.5, 2, 3.6, 4, 4.4, 8, 10, 12, 30]) {
      const index = Math.round(energy / step);
      assert.equal(index % 2, 0);
      const reconstructed = 1 + kramersKronigReal(step, epsIm, index);
      const exact = modelEpsilon(model, index * step).re;
      assert.ok(
        Math.abs(reconstructed - exact) < 2e-4 * Math.max(1, Math.abs(exact)),
        `${name}, ħω = ${energy} eV: KK da ${reconstructed}, la fórmula ${exact}`,
      );
    }
  }
});

// Mismo principio con el «vidrio» (tres resonancias, una de ellas muy estrecha en el
// infrarrojo: γ = 0,0013 eV, que obliga a una malla de 0,0001 eV). Aquí se ve lo que
// dice Kramers-Kronig: el índice en el visible (donde ε″ ≈ 0) sale de integrar la
// absorción del ultravioleta y del infrarrojo.
test('Kramers-Kronig: el índice del vidrio en el visible sale de su absorción en el UV y el IR', () => {
  const step = 0.0001;
  const count = 6000001; // hasta 600 eV
  const epsIm = new Float64Array(count);
  for (let m = 1; m < count; m++) epsIm[m] = modelEpsilon(glass, m * step).im;
  for (const energy of [0.05, 0.5, 1.8, 2.25, 3.1, 8, 10.6, 14, 25]) {
    const index = Math.round(energy / step);
    const reconstructed = 1 + kramersKronigReal(step, epsIm, index);
    const exact = modelEpsilon(glass, index * step).re;
    assert.ok(
      Math.abs(reconstructed - exact) < 2e-4 * Math.max(1, Math.abs(exact)),
      `ħω = ${energy} eV: KK da ${reconstructed}, la fórmula ${exact}`,
    );
  }
});

// --- Regla de suma ---------------------------------------------------------------------------

// Principio (regla de suma f): ∫₀^∞ ω·ε″(ω) dω = (π/2)·ω_p²·Σ f_j, independiente de ω₀ y
// de γ: la absorción total solo cuenta electrones. Integral numérica con el cambio
// ω = s·tan θ, que lleva [0, ∞) a [0, π/2) con un integrando acotado (ω·ε″ ∝ 1/ω² en el
// infinito). Tolerancia 10⁻⁶ relativa (Simpson con 2²¹ subintervalos).
test('regla de suma: ∫ ω·ε″ dω = (π/2)·ω_p²·Σf', () => {
  for (const [name, model, scale] of /** @type {const} */ ([
    ['vidrio', glass, 1],
    ['Drude', metal, 1],
    ['un oscilador', single, 4],
    ['un oscilador muy amortiguado', singleOscillatorModel({ omega0: 3, omegaP: 5, gamma: 4 }), 3],
  ])) {
    const integrand = (/** @type {number} */ theta) => {
      // En θ = 0 se toma el límite ω → 0 de ω·ε″: vale 0 en un aislante, pero en un
      // conductor (ω₀ = 0) es ω_p²/γ, finito y no nulo.
      if (theta === 0) return 1e-9 * modelEpsilon(model, 1e-9).im * scale;
      const cos = Math.cos(theta);
      // En θ = π/2 el integrando tiende a ω_p²·Σ f_j·γ_j / s.
      if (cos < 1e-9) return model.oscillators.reduce((s, o) => s + o.strength * o.gamma, 0) * model.omegaP ** 2 / scale;
      const omega = scale * Math.tan(theta);
      return (omega * modelEpsilon(model, omega).im * scale) / (cos * cos);
    };
    const integral = simpson(integrand, 0, Math.PI / 2, 2 ** 21);
    const expected = (Math.PI / 2) * model.omegaP ** 2 * model.oscillators.reduce((s, o) => s + o.strength, 0);
    close(integral, expected, 1e-6, `${name}:`);
  }
});

// --- Metal de Drude ----------------------------------------------------------------------------

// Principio: con γ ≪ ω_p, Re ε = 1 − ω_p²/(ω² + γ²) es negativa por debajo de ω_p: la onda
// no se propaga y el metal refleja (R > 0,9, como pide el encargo). Por encima, ε es real
// y positiva: n = √(1 − ω_p²/ω²) y R = ((1 − n)/(1 + n))² (fórmula sin pérdidas; valor
// esperado calculado con ella, tolerancia del 2 % por el γ finito).
test('Drude: R > 0,9 por debajo de ω_p y transparencia por encima', () => {
  const { omegaP, gamma } = DRUDE_EXAMPLE;
  assert.ok(gamma / omegaP <= 0.01);
  for (const fraction of [0.05, 0.2, 0.5, 0.8, 0.9, 0.95]) {
    const { reflectance, epsilon } = opticalFunctions(modelEpsilon(metal, fraction * omegaP), fraction * omegaP);
    assert.ok(epsilon.re < 0, `Re ε < 0 en ω = ${fraction}·ω_p`);
    assert.ok(reflectance > 0.9, `R = ${reflectance} en ω = ${fraction}·ω_p`);
  }
  let previous = 1;
  for (const fraction of [1.02, 1.05, 1.2, 1.5, 2]) {
    const { reflectance, n, k } = opticalFunctions(modelEpsilon(metal, fraction * omegaP), fraction * omegaP);
    const nIdeal = Math.sqrt(1 - 1 / fraction ** 2);
    close(reflectance, ((1 - nIdeal) / (1 + nIdeal)) ** 2, 0.02, `R en ω = ${fraction}·ω_p:`);
    assert.ok(reflectance < previous, 'R cae al subir la frecuencia');
    // Por encima de ω_p: n < 1 y una absorción residual pequeña, k = ε″/(2n) con
    // ε″ ≈ ω_p²γ/ω³ (desarrollo para γ ≪ ω; error relativo γ²/ω² ~ 10⁻⁴).
    const omega = fraction * omegaP;
    assert.ok(n < 1 && n > 0);
    close(k, (omegaP ** 2 * gamma) / (2 * n * omega ** 3), 1e-3, `k en ω = ${fraction}·ω_p:`);
    previous = reflectance;
  }
  assert.ok(previous < 0.01, `R(2ω_p) = ${previous}`);
  // Re ε cambia de signo en √(ω_p² − γ²) (cero exacto de la fórmula).
  assert.ok(Math.abs(modelEpsilon(metal, Math.sqrt(omegaP ** 2 - gamma ** 2)).re) < 1e-12);
});

// Principio: un electrón libre no tiene muelle: por encima de γ va en oposición al campo
// (δ → 180°) a todas las frecuencias, y por eso apantalla el campo en vez de reforzarlo.
// tan δ = γω/(−ω²) ⇒ δ = π − arctan(γ/ω) (exacto).
test('Drude: el electrón libre oscila en oposición al campo', () => {
  for (const energy of [0.5, 2, 9, 15]) {
    const [response] = oscillatorResponses(metal, energy);
    close(response.phase, Math.PI - Math.atan(DRUDE_EXAMPLE.gamma / energy), 1e-12);
    assert.ok(response.chi.re < 0);
  }
});

// --- De ε a n, k, R y α ----------------------------------------------------------------------

// Valores exactos: vidrio de n = 1,5 → R = (0,5/2,5)² = 4 %; agua de n = 4/3 → (1/7)² ≈ 2 %;
// n = 1 no refleja; k → ∞ refleja todo.
test('reflectancia en incidencia normal: valores exactos', () => {
  close(normalReflectance(1.5, 0), 0.04, 1e-15);
  close(normalReflectance(4 / 3, 0), 1 / 49, 1e-14);
  assert.equal(normalReflectance(1, 0), 0);
  assert.ok(normalReflectance(1, 1e6) > 1 - 1e-5);
  // Simetría n ↔ 1/n: da igual entrar que salir (R es la misma desde los dos lados).
  close(normalReflectance(1 / 1.5, 0), 0.04, 1e-14);
});

// Principio (ley de Beer-Lambert): la onda e^{i(n + ik)·2πz/λ} tiene una intensidad
// |E|² = e^{−4πkz/λ} = e^{−αz}. Se comprueba α contra la caída de |E|² calculada con la
// exponencial compleja.
test('coeficiente de absorción: α = 4πk/λ es la caída de la intensidad', () => {
  const n = 1.7;
  const k = 0.3;
  const wavelength = 500;
  const alpha = absorptionCoefficient(k, wavelength);
  for (const z of [10, 100, 400]) {
    const phase = C.scale(C.mul(C.I, C.complex(n, k)), (2 * Math.PI * z) / wavelength);
    close(C.abs2(C.exp(phase)), Math.exp(-alpha * z), 1e-12);
  }
});

// Coherencia interna: n y k son la raíz de ε (n² − k² = ε′, 2nk = ε″), la longitud de
// onda es hc/(ħω), y la suma de las respuestas de los osciladores es χ = ε − 1.
test('opticalFunctions y oscillatorResponses son coherentes con ε', () => {
  for (const model of [glass, metal, single]) {
    for (const energy of [0.3, 2.25, 4, 10.7, 18]) {
      const epsilon = modelEpsilon(model, energy);
      const f = opticalFunctions(epsilon, energy);
      close(f.n * f.n - f.k * f.k, epsilon.re, 1e-11);
      close(2 * f.n * f.k, epsilon.im, 1e-11);
      close(f.wavelength, 1239.841984 / energy, 1e-8);
      close(f.absorption, (4 * Math.PI * f.k) / f.wavelength, 1e-14);
      const chi = oscillatorResponses(model, energy).reduce((s, r) => C.add(s, r.chi), C.ZERO);
      close(1 + chi.re, epsilon.re, 1e-11);
      close(chi.im, epsilon.im, 1e-11);
      for (const r of oscillatorResponses(model, energy)) {
        assert.ok(r.phase >= 0 && r.phase <= Math.PI);
        close(Math.hypot(r.chi.re, r.chi.im), r.magnitude, 1e-12);
      }
    }
  }
});

// Las curvas para la vista: mismas cuentas en una malla, y NaN donde no hay datos (un
// material tabulado fuera de su intervalo) para que el trazador corte la línea.
test('opticalSpectrum: curvas en una malla y huecos donde no hay datos', () => {
  const energies = [1, 2, 3, 4];
  const spectrum = opticalSpectrum((energy) => (energy === 3 ? null : modelEpsilon(single, energy)), energies);
  for (const [i, energy] of energies.entries()) {
    if (energy === 3) {
      assert.ok(Number.isNaN(spectrum.n[i]) && Number.isNaN(spectrum.epsRe[i]) && Number.isNaN(spectrum.reflectance[i]));
      continue;
    }
    const f = opticalFunctions(modelEpsilon(single, energy), energy);
    assert.equal(spectrum.epsRe[i], f.epsilon.re);
    assert.equal(spectrum.epsIm[i], f.epsilon.im);
    assert.equal(spectrum.n[i], f.n);
    assert.equal(spectrum.k[i], f.k);
    assert.equal(spectrum.reflectance[i], f.reflectance);
  }
});
