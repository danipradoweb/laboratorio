// @ts-check
// Tests de la física del módulo «plasmón» (src/modules/plasmon/physics.js).
//
// Referencias, por orden de preferencia: identidades y límites analíticos (Rayleigh,
// teorema óptico, conservación de la energía, electrostática), implementaciones
// independientes (miepython y mpmath, en tests/fixtures/mie.json, generado por
// tools/mie_fixture.py) y, al final, valores experimentales con datos reales de
// Johnson & Christy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  absorbance,
  clausiusMossotti,
  colloidSpectra,
  cuvetteTransmittance,
  depolarizationFactors,
  dipolarPolarizabilityFromMie,
  dipoleCrossSections,
  downwardStartOrder,
  drivenOscillation,
  ellipsoidPolarizability,
  findPeak,
  gansScatteringPattern,
  gansSpheroid,
  mie,
  mieCoefficients,
  mieSphere,
  mieTermCount,
  numberDensity,
  particleResponse,
  particleSpectrum,
  quasiStaticPolarizability,
  quasiStaticSphere,
  rayleighScatteringEfficiency,
  relativeIndex,
  sizeParameter,
  spheroidNearField,
  spheroidVolume,
  wavenumber,
} from '../src/modules/plasmon/physics.js';
import { loadMaterial } from '../src/materials/library.js';
import { createOpticalConstants, drudeEpsilon } from '../src/materials/dielectric.js';
import { loadColorEngine } from '../src/color/spectrum.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/mie.json', import.meta.url), 'utf8'));
const gold = createOpticalConstants(await loadMaterial('Au'));
const silver = createOpticalConstants(await loadMaterial('Ag'));
const alloy = createOpticalConstants(await loadMaterial('AuAg'));
const engine = await loadColorEngine();

/** Índice del agua en el visible (el valor por defecto del control «índice del medio»). */
const WATER = 1.33;

/**
 * Lista de valores equiespaciados, extremos incluidos.
 * @param {number} from
 * @param {number} to
 * @param {number} step
 */
function range(from, to, step) {
  const out = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) out.push(from + i * step);
  return out;
}

/**
 * Partícula con datos reales.
 * @param {{ epsilon: (l: number) => import('../src/core/complex.js').Complex }} optical
 * @param {number} diameter
 * @param {Partial<import('../src/modules/plasmon/physics.js').ParticleConfig>} [extra]
 * @returns {import('../src/modules/plasmon/physics.js').ParticleConfig}
 */
function particle(optical, diameter, extra = {}) {
  return { shape: 'sphere', diameter, aspectRatio: 1, mediumIndex: WATER, epsilon: (l) => optical.epsilon(l), ...extra };
}

/**
 * Longitud de onda del máximo de extinción en un intervalo (malla de 0,5 nm + parábola).
 * @param {import('../src/modules/plasmon/physics.js').ParticleConfig} config
 * @param {number} from
 * @param {number} to
 * @param {'cext' | 'cabs' | 'csca'} [key]
 */
function peakWavelength(config, from, to, key = 'cext') {
  const spectrum = particleSpectrum(config, range(from, to, 0.5));
  const peak = findPeak(spectrum.wavelengths, spectrum[key]);
  assert.ok(peak.interior, `el máximo cae en el borde del intervalo [${from}, ${to}] nm`);
  return peak.x;
}

/**
 * Integral de f en [a, b] por la regla de Simpson compuesta.
 * @param {(t: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n número par de subintervalos
 */
function simpson(f, a, b, n) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  return (sum * h) / 3;
}

// =============================================================================================
// 1. Teoría de Mie
// =============================================================================================

// Definiciones: x = 2π·n_m·a/λ; m = √ε/n_m (con ε = (n + ik)², m = (n + ik)/n_m).
test('parámetro de tamaño e índice relativo', () => {
  assert.ok(Math.abs(sizeParameter(10, 500, 1.33) - (2 * Math.PI * 1.33 * 10) / 500) < 1e-15);
  assert.ok(Math.abs(wavenumber(500, 1.33) - (2 * Math.PI * 1.33) / 500) < 1e-18);
  // n + ik = 0,5 + 2i ⇒ ε = 0,25 − 4 + 2i = −3,75 + 2i.
  const m = relativeIndex({ re: -3.75, im: 2 }, 1.25);
  assert.ok(Math.abs(m.re - 0.4) < 1e-14 && Math.abs(m.im - 1.6) < 1e-14);
  // Número de términos: n_max = x + 4x^(1/3) + 2 (truncado). x = 1 → 7; x = 8 → 18; x = 1000 → 1042.
  assert.equal(mieTermCount(1), 7);
  assert.equal(mieTermCount(8), 18);
  assert.equal(mieTermCount(1000), 1042);
});

// Comparación con implementaciones independientes en una malla de m reales y absorbentes
// y x de 0,01 a 100: miepython (serie de Mie con otro algoritmo: fracción continua de
// Lentz) y, donde miepython usa un desarrollo aproximado (|m|·x < 0,1), mpmath a 40
// cifras. Tolerancia relativa 10⁻⁶, la del encargo.
test(`Mie frente a miepython/mpmath: Q_ext, Q_sca, Q_abs, Q_back y g en ${fixture.casos.length} casos (10⁻⁶)`, () => {
  let withMpmath = 0;
  for (const c of fixture.casos) {
    const r = mie({ re: c.m[0], im: c.m[1] }, c.x);
    const label = `m = ${c.m[0]} + ${c.m[1]}i, x = ${c.x} (${c.referencia})`;
    for (const key of /** @type {const} */ (['qext', 'qsca', 'qback', 'g'])) {
      assert.ok(Math.abs(r[key] - c[key]) <= 1e-6 * Math.abs(c[key]), `${key} en ${label}: ${r[key]} frente a ${c[key]}`);
    }
    // Q_abs = Q_ext − Q_sca es una resta: se compara con 10⁻⁶ de Q_ext (cuando la esfera
    // casi no absorbe, Q_abs es mucho menor que Q_ext y su error relativo no significa nada).
    assert.ok(Math.abs(r.qabs - (c.qext - c.qsca)) <= 1e-6 * c.qext, `qabs en ${label}`);
    if (c.referencia === 'mpmath') withMpmath++;
  }
  assert.ok(withMpmath > 20, 'el fixture debe incluir casos de esfera pequeña calculados con mpmath');
  assert.ok(fixture.casos.some((/** @type {any} */ c) => c.x === 100 && c.m[1] === 0), 'falta x = 100 con m real');
});

// Amplitudes de dispersión S₁(θ) y S₂(θ) (complejas, con la normalización de Bohren &
// Huffman) frente a las mismas referencias. Tolerancia: 10⁻⁶ de |S(0°)|, la amplitud hacia
// delante (en los mínimos del diagrama la amplitud es casi nula y un error relativo a ella
// no tendría sentido).
test('Mie frente a miepython/mpmath: amplitudes S₁(θ) y S₂(θ)', () => {
  let compared = 0;
  for (const c of fixture.casos) {
    if (!c.s1) continue;
    const r = mie({ re: c.m[0], im: c.m[1] }, c.x, c.angles_deg);
    const forward = Math.hypot(c.s1[0][0], c.s1[0][1]);
    c.angles_deg.forEach((/** @type {number} */ angle, /** @type {number} */ i) => {
      for (const [mine, ref, name] of /** @type {const} */ ([[r.s1[i], c.s1[i], 'S1'], [r.s2[i], c.s2[i], 'S2']])) {
        const error = Math.hypot(mine.re - ref[0], mine.im - ref[1]);
        assert.ok(error <= 1e-6 * forward, `${name}(${angle}°) con m = ${c.m}, x = ${c.x}: error ${error / forward} de |S(0)|`);
        compared++;
      }
    });
  }
  assert.ok(compared > 1000);
});

// El margen fijo de BHMIE (+15) para arrancar la recurrencia descendente no basta con
// |mx| grande y sin absorción; con él, m = 4 y x = 100 dan Q_ext con un error de 6·10⁻⁴.
// El margen ∝ |mx|^(1/3) lo corrige: se comprueba que arrancar 2000 órdenes más arriba
// no cambia los coeficientes (caso duro: m = 4,5, x = 127, |mx| ≈ 570).
test('la recurrencia descendente de D_n arranca lo bastante alto', () => {
  assert.equal(downwardStartOrder(10, 0), 25);
  assert.equal(downwardStartOrder(120, 400), 400 + Math.floor(8 * Math.cbrt(400)) + 15);
  const m = { re: 4.541, im: 0 };
  const x = 126.84;
  const normal = mie(m, x);
  // Mismo cálculo con un índice un poco absorbente y luego sin absorber deben ser
  // continuos: la sensibilidad al arranque se manifestaría como un salto.
  const nearly = mie({ re: 4.541, im: 1e-13 }, x);
  for (const key of /** @type {const} */ (['qext', 'qsca', 'qback', 'g'])) {
    assert.ok(Math.abs(normal[key] - nearly[key]) <= 1e-9 * Math.abs(normal[key]), key);
  }
  // Unitaridad con m real: cada coeficiente cumple Re a_n = |a_n|² (no hay absorción).
  const { count, anRe, anIm, bnRe, bnIm } = mieCoefficients(m, x);
  for (let n = 1; n <= count; n++) {
    assert.ok(Math.abs(anRe[n] - (anRe[n] ** 2 + anIm[n] ** 2)) < 1e-10, `a_${n}`);
    assert.ok(Math.abs(bnRe[n] - (bnRe[n] ** 2 + bnIm[n] ** 2)) < 1e-10, `b_${n}`);
  }
});

// Límite de Rayleigh (x ≪ 1): Q_sca ≈ (8/3)·x⁴·|(m² − 1)/(m² + 2)|². La corrección
// siguiente es de orden x², así que el error relativo debe ser pequeño y dividirse por 4
// al reducir x a la mitad.
test('límite de Rayleigh: Q_sca → (8/3)·x⁴·|(m² − 1)/(m² + 2)|²', () => {
  for (const m of [{ re: 1.33, im: 0 }, { re: 1.5, im: 0.1 }, { re: 0.47, im: 1.56 }, { re: 2.5, im: 0 }]) {
    /** @param {number} x */
    const error = (x) => Math.abs(mie(m, x).qsca / rayleighScatteringEfficiency(m, x) - 1);
    assert.ok(error(0.01) < 1e-3, `m = ${m.re} + ${m.im}i: error ${error(0.01)} en x = 0,01`);
    const ratio = error(0.04) / error(0.02);
    assert.ok(ratio > 3.8 && ratio < 4.2, `el error no escala como x²: razón ${ratio}`);
  }
  // Valor exacto de la fórmula: m = 2 ⇒ (m² − 1)/(m² + 2) = 1/2; x = 0,1 ⇒ (8/3)·10⁻⁴/4.
  assert.ok(Math.abs(rayleighScatteringEfficiency({ re: 2, im: 0 }, 0.1) - (8 / 3) * 1e-4 * 0.25) < 1e-18);
});

// Conservación de la energía. Con m real no hay absorción: Q_abs = 0, es decir, la serie
// de Q_ext y la de Q_sca dan lo mismo (se calculan con fórmulas distintas). Con m
// absorbente, Q_abs > 0. Tolerancia 10⁻⁹·Q_ext: es una resta de dos sumas de hasta 120
// términos.
test('Q_abs = 0 para m real y Q_abs > 0 para m absorbente', () => {
  for (const mRe of [0.75, 1.05, 1.33, 1.5, 2, 4]) {
    for (const x of [0.01, 0.1, 0.5, 1, 3, 10, 30, 100]) {
      const r = mie({ re: mRe, im: 0 }, x);
      assert.ok(Math.abs(r.qabs) <= 1e-9 * r.qext, `m = ${mRe}, x = ${x}: Q_abs/Q_ext = ${r.qabs / r.qext}`);
    }
  }
  for (const m of [{ re: 1.33, im: 1e-5 }, { re: 1.5, im: 0.1 }, { re: 0.47, im: 1.56 }, { re: 0.04, im: 2.3 }]) {
    for (const x of [0.01, 0.1, 1, 10, 100]) assert.ok(mie(m, x).qabs > 0, `m = ${m.re} + ${m.im}i, x = ${x}`);
  }
});

// Q_ext = Q_sca + Q_abs «siempre», comprobado sin usar la definición Q_abs = Q_ext − Q_sca:
//   - Q_ext por el teorema óptico: (4/x²)·Re S(0°)  (la extinción es interferencia entre
//     la onda incidente y la dispersada hacia delante);
//   - Q_sca integrando la intensidad dispersada en todas las direcciones:
//     Q_sca = (1/x²)·∫₀^π (|S₁|² + |S₂|²)·sen θ dθ;
//   - g como el promedio de cos θ con ese mismo peso.
// Así se comprueba además la normalización de S₁ y S₂.
test('teorema óptico e integral angular: Q_ext, Q_sca y g salen también de S₁ y S₂', () => {
  const angles = range(0, 180, 0.25);
  for (const [m, x] of /** @type {[import('../src/core/complex.js').Complex, number][]} */ ([
    [{ re: 1.33, im: 0 }, 0.3],
    [{ re: 1.5, im: 0.1 }, 2.5],
    [{ re: 0.47, im: 1.56 }, 1.2],
    [{ re: 0.04, im: 2.3 }, 0.8],
    [{ re: 2, im: 0.01 }, 7.7],
  ])) {
    const r = mie(m, x, angles);
    assert.ok(Math.abs((4 / (x * x)) * r.s1[0].re - r.qext) <= 1e-12 * r.qext, 'teorema óptico');
    // Hacia delante y hacia atrás no hay plano de dispersión: S₁(0°) = S₂(0°), S₁(180°) = −S₂(180°).
    const last = angles.length - 1;
    assert.ok(Math.hypot(r.s1[0].re - r.s2[0].re, r.s1[0].im - r.s2[0].im) < 1e-12 * Math.hypot(r.s1[0].re, r.s1[0].im));
    assert.ok(Math.hypot(r.s1[last].re + r.s2[last].re, r.s1[last].im + r.s2[last].im) < 1e-9 * Math.hypot(r.s1[0].re, r.s1[0].im));
    assert.ok(Math.abs((4 / (x * x)) * (r.s1[last].re ** 2 + r.s1[last].im ** 2) - r.qback) <= 1e-9 * r.qback, 'Q_back');
    /** @param {number} i */
    const intensity = (i) => r.s1[i].re ** 2 + r.s1[i].im ** 2 + r.s2[i].re ** 2 + r.s2[i].im ** 2;
    const h = Math.PI / last;
    let total = 0;
    let weighted = 0;
    for (let i = 0; i <= last; i++) {
      const theta = i * h;
      const w = (i === 0 || i === last ? 1 : i % 2 === 1 ? 4 : 2) * (h / 3) * Math.sin(theta);
      total += w * intensity(i);
      weighted += w * intensity(i) * Math.cos(theta);
    }
    const qscaFromAngles = total / (x * x);
    assert.ok(Math.abs(qscaFromAngles - r.qsca) <= 1e-7 * r.qsca, `Q_sca angular ${qscaFromAngles} frente a ${r.qsca}`);
    assert.ok(Math.abs(weighted / total - r.g) <= 1e-7, `g angular ${weighted / total} frente a ${r.g}`);
    assert.ok(Math.abs(r.qext - (qscaFromAngles + r.qabs)) <= 1e-7 * r.qext);
  }
});

// Paradoja de la extinción: una esfera grande quita del haz el doble de la luz que
// intercepta (la mitad por lo que absorbe o desvía, la otra mitad por difracción en su
// borde): Q_ext → 2 cuando x ≫ 1. La aproximación es lenta (la corrección decae como
// x^(−2/3)): se exige 5 % en x = 100, 1 % en x = 5000 y acercamiento monótono. Se usa
// una esfera absorbente para que no haya la estructura de resonancias finas.
test('paradoja de la extinción: Q_ext → 2 para x ≫ 1', () => {
  const m = { re: 1.5, im: 0.1 };
  const q = [100, 1000, 5000].map((x) => mie(m, x).qext);
  assert.ok(Math.abs(q[0] - 2) < 0.1, `Q_ext(100) = ${q[0]}`);
  assert.ok(Math.abs(q[2] - 2) < 0.02, `Q_ext(5000) = ${q[2]}`);
  assert.ok(q[0] > q[1] && q[1] > q[2] && q[2] > 2, `no se acerca a 2 de forma monótona: ${q}`);
  // También para un metal y para una esfera transparente (promediando sus resonancias).
  assert.ok(Math.abs(mie({ re: 0.47, im: 1.56 }, 3000).qext - 2) < 0.02);
  const transparent = range(2000, 2010, 0.1).map((x) => mie({ re: 1.33, im: 0 }, x).qext);
  assert.ok(Math.abs(transparent.reduce((a, b) => a + b) / transparent.length - 2) < 0.02);
});

// Diagrama de dispersión: una esfera pequeña radia como un dipolo (|S₁|² no depende de θ,
// |S₂|² ∝ cos²θ, igual hacia delante que hacia atrás, g ≈ 0); al crecer, la dispersión se
// concentra hacia delante (g crece).
test('diagrama de dispersión: dipolar si x ≪ 1 y hacia delante al crecer el tamaño', () => {
  const small = mie({ re: 0.47, im: 1.56 }, 0.02, [0, 60, 90, 180]);
  /** @param {import('../src/core/complex.js').Complex} s */
  const abs2 = (s) => s.re * s.re + s.im * s.im;
  assert.ok(Math.abs(abs2(small.s1[1]) / abs2(small.s1[0]) - 1) < 1e-3);
  assert.ok(Math.abs(abs2(small.s2[1]) / abs2(small.s2[0]) - 0.25) < 1e-3, 'cos²60° = 1/4');
  assert.ok(abs2(small.s2[2]) / abs2(small.s2[0]) < 1e-6, 'sin dispersión a 90° en polarización paralela');
  assert.ok(Math.abs(abs2(small.s1[3]) / abs2(small.s1[0]) - 1) < 1e-3);
  assert.ok(Math.abs(small.g) < 1e-3);
  // Oro en agua a 550 nm con diámetros de 20, 80, 150 y 300 nm.
  const eps = gold.epsilon(550);
  const g = [20, 80, 150, 300].map((d) => mieSphere({ radius: d / 2, wavelength: 550, epsilon: eps, mediumIndex: WATER }).g);
  assert.ok(g[0] < 0.01 && g[0] < g[1] && g[1] < g[2] && g[2] < g[3] && g[3] > 0.5, `g = ${g}`);
});

test('mie rechaza entradas sin sentido', () => {
  assert.throws(() => mie({ re: 1.5, im: 0 }, 0), RangeError);
  assert.throws(() => mie({ re: 1.5, im: 0 }, -1), RangeError);
  assert.throws(() => mie({ re: NaN, im: 0 }, 1), RangeError);
});

// =============================================================================================
// 2. Aproximación cuasiestática
// =============================================================================================

// α = 4πa³(ε − ε_m)/(ε + 2ε_m), y las secciones del dipolo: C_abs = k·Im α,
// C_sca = k⁴|α|²/6π. Valores exactos con números sencillos: ε = 4, ε_m = 1 ⇒ β = 1/2.
test('polarizabilidad cuasiestática y secciones eficaces del dipolo', () => {
  const beta = clausiusMossotti({ re: 4, im: 0 }, 1);
  assert.deepEqual(beta, { re: 0.5, im: 0 });
  const alpha = quasiStaticPolarizability(2, { re: 4, im: 0 }, 1);
  assert.ok(Math.abs(alpha.re - 16 * Math.PI) < 1e-13 && alpha.im === 0);
  const sections = dipoleCrossSections({ re: 3, im: 4 }, 0.1);
  assert.ok(Math.abs(sections.cabs - 0.4) < 1e-16);
  assert.ok(Math.abs(sections.csca - (1e-4 * 25) / (6 * Math.PI)) < 1e-18);
  assert.ok(Math.abs(sections.cext - sections.cabs - sections.csca) < 1e-15);
  // Rayleigh: Q_sca del dipolo cuasiestático es (8/3)x⁴|β|² exactamente.
  const sphere = quasiStaticSphere({ radius: 5, wavelength: 600, epsilon: { re: -8, im: 1.5 }, mediumIndex: WATER });
  const m = relativeIndex({ re: -8, im: 1.5 }, WATER);
  assert.ok(Math.abs(sphere.qsca / rayleighScatteringEfficiency(m, sphere.x) - 1) < 1e-12);
});

// La polarizabilidad dipolar sacada del coeficiente a₁ de Mie, α = 6πi·a₁/k³, tiende a la
// cuasiestática cuando x → 0. Desarrollo de a₁ en potencias de x (B&H, ec. 5.4):
//   a₁ = −i(2x³/3)·β·[1 + (3/5)·x²·(m² − 2)/(m² + 2) + i(2/3)·x³·β + O(x⁴)],  β = (m² − 1)/(m² + 2)
// Así que (a) la diferencia relativa con la cuasiestática es (3/5)x²|(m² − 2)/(m² + 2)| al
// primer orden, y (b) añadiendo los dos términos de corrección el resto es de orden x⁴.
// El término en x² es el retardo (desplaza la resonancia); el término en x³ es la pérdida
// de energía por radiación.
test('la polarizabilidad dipolar de Mie tiende a la cuasiestática, con las correcciones de orden x² y x³', () => {
  const epsilon = gold.epsilon(520);
  const m2 = { re: epsilon.re / (WATER * WATER), im: epsilon.im / (WATER * WATER) };
  /** @param {import('../src/core/complex.js').Complex} a @param {import('../src/core/complex.js').Complex} b */
  const div = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  };
  const retardation = div({ re: m2.re - 2, im: m2.im }, { re: m2.re + 2, im: m2.im });
  const beta = clausiusMossotti(m2, 1);
  for (const radius of [0.25, 0.5, 1, 2, 5]) {
    const x = sizeParameter(radius, 520, WATER);
    const exact = mieSphere({ radius, wavelength: 520, epsilon, mediumIndex: WATER }).alpha;
    const qs = quasiStaticPolarizability(radius, epsilon, WATER * WATER);
    const difference = Math.hypot(exact.re - qs.re, exact.im - qs.im) / Math.hypot(qs.re, qs.im);
    const firstOrder = 0.6 * x * x * Math.hypot(retardation.re, retardation.im);
    assert.ok(Math.abs(difference / firstOrder - 1) < 0.02, `a = ${radius} nm: diferencia ${difference}, primer orden ${firstOrder}`);
    // Con las dos correcciones: factor = 1 + (3/5)x²·c + i(2/3)x³·β.
    const factor = {
      re: 1 + 0.6 * x * x * retardation.re - (2 / 3) * x ** 3 * beta.im,
      im: 0.6 * x * x * retardation.im + (2 / 3) * x ** 3 * beta.re,
    };
    const corrected = { re: qs.re * factor.re - qs.im * factor.im, im: qs.re * factor.im + qs.im * factor.re };
    const residual = Math.hypot(exact.re - corrected.re, exact.im - corrected.im) / Math.hypot(qs.re, qs.im);
    assert.ok(residual < 5 * x ** 4, `a = ${radius} nm: resto ${residual}, x⁴ = ${x ** 4}`);
  }
  const alpha = dipolarPolarizabilityFromMie({ re: 0.25, im: -2 }, 1);
  assert.ok(Math.abs(alpha.re - 12 * Math.PI) < 1e-13 && Math.abs(alpha.im - 1.5 * Math.PI) < 1e-13);
});

// Requisito del encargo: cuasiestática y Mie coinciden en un 2 % para Au de radio 5 nm
// en agua. Se comprueba en C_ext, C_abs y la posición del pico, de 400 a 800 nm.
// (x ≈ 0,1 en el pico; la corrección es de orden x².)
test('cuasiestática y Mie coinciden en un 2 % para Au de radio 5 nm en agua', () => {
  let worst = 0;
  for (const wavelength of range(400, 800, 2)) {
    const epsilon = gold.epsilon(wavelength);
    const exact = mieSphere({ radius: 5, wavelength, epsilon, mediumIndex: WATER });
    const qs = quasiStaticSphere({ radius: 5, wavelength, epsilon, mediumIndex: WATER });
    worst = Math.max(worst, Math.abs(qs.cext / exact.cext - 1), Math.abs(qs.cabs / exact.cabs - 1));
  }
  assert.ok(worst < 0.02, `desviación máxima ${(100 * worst).toFixed(2)} %`);
  // Y la partícula de 10 nm absorbe mucho más de lo que dispersa (C_sca/C_ext < 1 %).
  const peak = mieSphere({ radius: 5, wavelength: 520, epsilon: gold.epsilon(520), mediumIndex: WATER });
  assert.ok(peak.csca / peak.cext < 0.01);
});

// Condición de Fröhlich con un metal de Drude casi sin pérdidas, ε = 1 − ω_p²/(ω² + iγω):
// Re ε = −2ε_m ⇒ ω = ω_p/√(1 + 2ε_m). El pico cuasiestático de absorción debe caer ahí.
// Con γ = 10⁻³·ω_p el desplazamiento por las pérdidas es de orden (γ/ω)² ~ 10⁻⁵.
test('metal de Drude sin pérdidas: el pico cuasiestático cae en ω_p/√(1 + 2ε_m)', () => {
  for (const mediumIndex of [1, 1.33, 1.5]) {
    const epsilonMedium = mediumIndex * mediumIndex;
    const expected = 1 / Math.sqrt(1 + 2 * epsilonMedium); // en unidades de ω_p
    const omegas = range(expected - 0.02, expected + 0.02, 1e-5);
    // C_abs/k = Im α no depende de la conversión de ω a λ: se busca su máximo en ω.
    const response = omegas.map((omega) => quasiStaticPolarizability(1, drudeEpsilon({ omegaP: 1, gamma: 1e-3 }, omega), epsilonMedium).im);
    const peak = findPeak(omegas, response);
    assert.ok(peak.interior);
    assert.ok(Math.abs(peak.x / expected - 1) < 1e-4, `n_m = ${mediumIndex}: pico en ${peak.x} ω_p, esperado ${expected} ω_p`);
  }
});

// En el régimen cuasiestático la posición del pico NO depende del tamaño: α ∝ a³ multiplica
// todo el espectro por una constante. (En Mie sí se mueve: ver los tests con datos reales.)
test('cuasiestática: la forma del espectro de absorción no depende del tamaño', () => {
  for (const wavelength of [450, 520, 600]) {
    const epsilon = gold.epsilon(wavelength);
    const a = quasiStaticSphere({ radius: 3, wavelength, epsilon, mediumIndex: WATER });
    const b = quasiStaticSphere({ radius: 12, wavelength, epsilon, mediumIndex: WATER });
    assert.ok(Math.abs(b.cabs / a.cabs - 64) < 1e-10, 'C_abs ∝ volumen');
    assert.ok(Math.abs(b.csca / a.csca - 4096) < 1e-8, 'C_sca ∝ volumen²');
  }
});

// Oscilación forzada de la nube electrónica: δ = arg α. Con un metal de Drude poco
// amortiguado en vacío (resonancia en ω_p/√3): muy por debajo, la nube sigue a la fuerza
// (δ ≈ 0); en la resonancia va 90° por detrás y la amplitud es máxima; por encima se
// acerca a la oposición (δ → 180°). Igual que el oscilador del encargo 00.
test('desfase de la nube electrónica: 0 → 90° → 180° al cruzar la resonancia', () => {
  const resonance = 1 / Math.sqrt(3);
  /** @param {number} omega */
  const at = (omega) => drivenOscillation(quasiStaticPolarizability(1, drudeEpsilon({ omegaP: 1, gamma: 0.01 }, omega), 1));
  const degrees = (/** @type {number} */ omega) => (at(omega).phase * 180) / Math.PI;
  assert.ok(degrees(0.1) < 2, `muy por debajo: ${degrees(0.1)}°`);
  assert.ok(Math.abs(degrees(resonance) - 90) < 1, `en resonancia: ${degrees(resonance)}°`);
  assert.ok(degrees(0.75) > 175, `por encima: ${degrees(0.75)}°`);
  assert.ok(at(resonance).amplitude > 20 * at(0.1).amplitude && at(resonance).amplitude > 20 * at(0.75).amplitude);
  assert.deepEqual(drivenOscillation({ re: 0, im: 2 }), { amplitude: 2, phase: Math.PI / 2 });
});

// Justo en la condición de Fröhlich (Re ε = −2ε_m) la polarizabilidad vale
// α = 4πa³·(1 + 3i·ε_m/Im ε): un fondo en fase más un término resonante con 90° de
// retraso. Por eso tan δ = 3ε_m/Im ε: con pocas pérdidas δ → 90°, con muchas no llega.
// Con datos reales: la plata en su pico está cerca de 90° y el oro se queda bastante
// por debajo (absorbe más: transiciones interbanda).
test('desfase en la condición de Fröhlich: tan δ = 3ε_m/Im ε', () => {
  for (const [epsilonMedium, loss] of [[1, 0.1], [1.77, 0.3], [1.77, 2.6], [2.25, 8]]) {
    const alpha = quasiStaticPolarizability(1, { re: -2 * epsilonMedium, im: loss }, epsilonMedium);
    assert.ok(Math.abs(alpha.re - 4 * Math.PI) < 1e-12);
    assert.ok(Math.abs(alpha.im - (4 * Math.PI * 3 * epsilonMedium) / loss) < 1e-11);
    assert.ok(Math.abs(Math.tan(drivenOscillation(alpha).phase) - (3 * epsilonMedium) / loss) < 1e-9 * (1 + epsilonMedium / loss));
  }
  // Con datos reales y la polarizabilidad dipolar de Mie (la que usa la vista), evaluada en
  // el pico de extinción de Mie. Hay que usar el mismo modelo para el pico y para δ: en la
  // plata de 20 nm el retardo desplaza el pico 4 nm respecto a la condición cuasiestática,
  // y su resonancia es tan estrecha que en esos 4 nm el desfase cuasiestático cae de 88° a 41°.
  /** @param {typeof gold} optical @param {number} wavelength */
  const degrees = (optical, wavelength) =>
    (drivenOscillation(mieSphere({ radius: 10, wavelength, epsilon: optical.epsilon(wavelength), mediumIndex: WATER }).alpha).phase * 180) / Math.PI;
  const silverPeak = peakWavelength(particle(silver, 20), 330, 550);
  const goldPeak = peakWavelength(particle(gold, 20), 450, 650);
  assert.ok(degrees(silver, silverPeak) > 80 && degrees(silver, silverPeak) < 95, `Ag: δ = ${degrees(silver, silverPeak)}°`);
  assert.ok(degrees(gold, goldPeak) > 45 && degrees(gold, goldPeak) < 75, `Au: δ = ${degrees(gold, goldPeak)}°`);
  // Lejos de la resonancia, en el infrarrojo, la nube sigue a la fuerza casi en fase.
  assert.ok(degrees(gold, 900) < 10 && degrees(silver, 900) < 5);
  // Y el máximo de |α| cuasiestática de la plata cae donde Re ε = −2ε_m, con δ ≈ 88°.
  const wavelengths = range(370, 400, 0.05);
  const amplitudes = wavelengths.map((l) => drivenOscillation(quasiStaticPolarizability(10, silver.epsilon(l), WATER * WATER)).amplitude);
  const frohlich = findPeak(wavelengths, amplitudes).x;
  assert.ok(Math.abs(silver.epsilon(frohlich).re + 2 * WATER * WATER) < 0.02, `Re ε(${frohlich}) = ${silver.epsilon(frohlich).re}`);
  const atFrohlich = (drivenOscillation(quasiStaticPolarizability(10, silver.epsilon(frohlich), WATER * WATER)).phase * 180) / Math.PI;
  assert.ok(Math.abs(atFrohlich - 88) < 3, `δ cuasiestático en la condición de Fröhlich: ${atFrohlich}°`);
  assert.ok(silverPeak - frohlich > 2 && silverPeak - frohlich < 7, `el retardo desplaza el pico de Mie ${silverPeak - frohlich} nm al rojo`);
});

// =============================================================================================
// 3. Teoría de Gans
// =============================================================================================

// Los tres factores de despolarización de cualquier elipsoide suman 1 (B&H, ec. 5.34).
// OJO: las dos formas cerradas son algebraicamente equivalentes a L_⊥ = (1 − L_∥)/2, así
// que este test solo comprueba que el código las evalúa de forma coherente (incluida la
// rama en serie cerca de la esfera). La comprobación física independiente es el test
// siguiente, contra la definición integral.
test('Gans: los factores de despolarización suman 1', () => {
  for (const aspectRatio of [1, 1.0001, 1.01, 1.1, 1.5, 2, 3, 5, 10, 50]) {
    const { long, trans } = depolarizationFactors(aspectRatio);
    assert.ok(Math.abs(long + 2 * trans - 1) < 1e-12, `R = ${aspectRatio}: L_∥ + 2L_⊥ = ${long + 2 * trans}`);
    assert.ok(long > 0 && long <= 1 / 3 + 1e-15 && trans >= 1 / 3 - 1e-15 && trans < 0.5);
  }
  assert.throws(() => depolarizationFactors(0.5), RangeError);
});

// Definición integral (B&H, ec. 5.33), evaluada aquí por cuadratura:
//   L_i = (a·b²/2)·∫₀^∞ dq / ((a_i² + q)·√((q + a²)(q + b²)²))
// Con el cambio q = (t/(1 − t))² el intervalo pasa a [0, 1) y el integrando es suave en
// los dos extremos (decae como (1 − t)² en t → 1), como necesita la regla de Simpson. La
// esfera da 1/3 y un esferoide muy alargado tiende a L_∥ → 0, L_⊥ → 1/2.
test('Gans: los factores coinciden con su definición integral', () => {
  for (const aspectRatio of [1, 1.3, 2, 3.5, 6]) {
    const a = aspectRatio;
    const b = 1;
    /** @param {number} axis2 semieje al cuadrado del eje considerado */
    const integral = (axis2) =>
      ((a * b * b) / 2) *
      simpson(
        (t) => {
          if (t >= 1) return 0;
          const q = (t / (1 - t)) ** 2;
          return ((2 * t) / (1 - t) ** 3) / ((axis2 + q) * Math.sqrt(q + a * a) * (q + b * b));
        },
        0,
        1,
        20000,
      );
    const { long, trans } = depolarizationFactors(aspectRatio);
    assert.ok(Math.abs(long - integral(a * a)) < 1e-8, `L_∥ con R = ${aspectRatio}: ${long} frente a ${integral(a * a)}`);
    assert.ok(Math.abs(trans - integral(b * b)) < 1e-8, `L_⊥ con R = ${aspectRatio}`);
  }
  assert.ok(Math.abs(depolarizationFactors(1).long - 1 / 3) < 1e-15);
  assert.ok(Math.abs(depolarizationFactors(1).trans - 1 / 3) < 1e-15);
  const needle = depolarizationFactors(1000);
  assert.ok(needle.long < 1e-4 && Math.abs(needle.trans - 0.5) < 1e-4);
});

// Con L = 1/3 el elipsoide es la esfera: α = V·3(ε − ε_m)/(ε + 2ε_m) = 4πa³β, y la teoría
// de Gans con relación de aspecto 1 reproduce la esfera cuasiestática.
test('Gans con relación de aspecto 1 reproduce la esfera cuasiestática', () => {
  for (const wavelength of [420, 520, 650]) {
    const epsilon = gold.epsilon(wavelength);
    const sphere = quasiStaticSphere({ radius: 7, wavelength, epsilon, mediumIndex: WATER });
    const rod = gansSpheroid({ shortRadius: 7, aspectRatio: 1, wavelength, epsilon, mediumIndex: WATER });
    assert.ok(Math.abs(rod.cabs / sphere.cabs - 1) < 1e-12);
    assert.ok(Math.abs(rod.csca / sphere.csca - 1) < 1e-12);
    assert.ok(Math.abs(rod.cext / sphere.cext - 1) < 1e-12);
    assert.ok(Math.abs(rod.alphaLong.re / sphere.alpha.re - 1) < 1e-12 && Math.abs(rod.alphaTrans.im / sphere.alpha.im - 1) < 1e-12);
  }
  const alpha = ellipsoidPolarizability(spheroidVolume(2, 1), 1 / 3, { re: 4, im: 0 }, 1);
  assert.ok(Math.abs(alpha.re - 16 * Math.PI) < 1e-12);
  assert.ok(Math.abs(spheroidVolume(2, 3) - (4 / 3) * Math.PI * 6 * 4) < 1e-12);
});

// Resonancia de un elipsoide: Re ε = −ε_m(1 − L)/L. Con Drude sin pérdidas, el modo
// longitudinal de un esferoide resuena en ω = ω_p·√(L/(ε_m + L(1 − ε_m))), que con
// ε_m = 1 es ω_p·√L: al alargar la partícula, L_∥ baja y la resonancia se va al rojo.
test('Gans: la resonancia longitudinal de un metal de Drude cae en ω_p·√L_∥ (en vacío)', () => {
  for (const aspectRatio of [1, 2, 4]) {
    const L = depolarizationFactors(aspectRatio).long;
    const expected = Math.sqrt(L);
    const omegas = range(expected - 0.02, expected + 0.02, 1e-5);
    const response = omegas.map((omega) => ellipsoidPolarizability(1, L, drudeEpsilon({ omegaP: 1, gamma: 1e-3 }, omega), 1).im);
    const peak = findPeak(omegas, response);
    assert.ok(Math.abs(peak.x / expected - 1) < 1e-4, `R = ${aspectRatio}`);
  }
});

// Con datos reales (Au en agua): el pico longitudinal se desplaza al rojo de forma
// monótona al aumentar la relación de aspecto, mientras el transversal se queda cerca de
// 520 nm (se va ligeramente al azul).
test('Gans, Au en agua: el pico longitudinal se va al rojo de forma monótona con la relación de aspecto', () => {
  /** @type {number[]} */
  const peaks = [];
  for (const aspectRatio of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
    peaks.push(peakWavelength(particle(gold, 10, { shape: 'rod', aspectRatio }), 480, 1000));
  }
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] > peaks[i - 1] + 10, `picos: ${peaks.map((p) => p.toFixed(0))}`);
  assert.ok(peaks[0] > 515 && peaks[0] < 528, `con R = 1 es la esfera: ${peaks[0]}`);
  assert.ok(peaks[4] > 600 && peaks[4] < 750, `con R = 3 el pico está en el rojo: ${peaks[4]}`);
  // El modo transversal queda algo al azul de la esfera (≈ 506 nm): máximo local de la
  // extinción por debajo de 560 nm.
  const transverse = peakWavelength(particle(gold, 10, { shape: 'rod', aspectRatio: 3 }), 480, 560);
  assert.ok(transverse > 500 && transverse < 525, `pico transversal en ${transverse} nm`);
});

// Diagrama de dispersión de esferoides orientados al azar. Tres comprobaciones:
// (1) la esfera (α_∥ = α_⊥) da el dipolo: 1 y cos²θ;
// (2) contra una integración directa sobre orientaciones, hecha aquí sin usar la fórmula:
//     para cada eje n̂ se calcula el dipolo p = α_⊥·ê_i + Δ·(n̂·ê_i)·n̂ y la intensidad que
//     radia hacia la dirección de dispersión, |p|² − |p·r̂|², y se promedia sobre la esfera;
// (3) conservación: la integral del diagrama en todas las direcciones, para luz no
//     polarizada, es la sección eficaz de dispersión promediada de gansSpheroid:
//     ⟨C_sca⟩ = (k⁴/16π²)·∫ ½(I_⊥ + I_∥) dΩ.
test('Gans: diagrama de dispersión promediado sobre orientaciones', () => {
  const sphere = gansScatteringPattern({ re: 2, im: 1 }, { re: 2, im: 1 }, [0, 60, 90, 180]);
  assert.deepEqual(sphere.perpendicular, [5, 5, 5, 5]);
  assert.ok(Math.abs(sphere.parallel[1] - 5 * 0.25) < 1e-14 && Math.abs(sphere.parallel[2]) < 1e-30);
  assert.equal(sphere.B, 0);

  const wavelength = 672;
  const rod = gansSpheroid({ shortRadius: 5, aspectRatio: 3, wavelength, epsilon: gold.epsilon(wavelength), mediumIndex: WATER });
  const angles = [0, 35, 90, 140, 180];
  const pattern = gansScatteringPattern(rod.alphaLong, rod.alphaTrans, angles);
  const delta = { re: rod.alphaLong.re - rod.alphaTrans.re, im: rod.alphaLong.im - rod.alphaTrans.im };
  /**
   * Intensidad radiada hacia r̂ por el dipolo inducido, promediada sobre orientaciones
   * (regla del punto medio en cos ϑ y φ: uniforme sobre la esfera).
   * @param {number[]} ei polarización incidente
   * @param {number[]} r dirección de dispersión
   */
  const averaged = (ei, r) => {
    const N = 120;
    let sum = 0;
    for (let a = 0; a < N; a++) {
      const cosT = -1 + (2 * (a + 0.5)) / N;
      const sinT = Math.sqrt(1 - cosT * cosT);
      for (let b = 0; b < N; b++) {
        const phi = (2 * Math.PI * (b + 0.5)) / N;
        const n = [sinT * Math.cos(phi), sinT * Math.sin(phi), cosT];
        const nei = n[0] * ei[0] + n[1] * ei[1] + n[2] * ei[2];
        let p2 = 0;
        const pr = { re: 0, im: 0 };
        for (let c = 0; c < 3; c++) {
          const re = rod.alphaTrans.re * ei[c] + delta.re * nei * n[c];
          const im = rod.alphaTrans.im * ei[c] + delta.im * nei * n[c];
          p2 += re * re + im * im;
          pr.re += re * r[c];
          pr.im += im * r[c];
        }
        sum += p2 - (pr.re * pr.re + pr.im * pr.im);
      }
    }
    return sum / (N * N);
  };
  angles.forEach((angle, i) => {
    const theta = (angle * Math.PI) / 180;
    // Luz que viaja en +z; plano de dispersión xz; dirección de dispersión a un ángulo θ.
    const r = [Math.sin(theta), 0, Math.cos(theta)];
    const perpendicular = averaged([0, 1, 0], r);
    const parallel = averaged([1, 0, 0], r);
    assert.ok(Math.abs(perpendicular / pattern.perpendicular[i] - 1) < 1e-3, `⊥ a ${angle}°: ${perpendicular} frente a ${pattern.perpendicular[i]}`);
    assert.ok(Math.abs(parallel / pattern.parallel[i] - 1) < 1e-3, `∥ a ${angle}°: ${parallel} frente a ${pattern.parallel[i]}`);
  });
  // Despolarización: en el pico longitudinal α_∥ domina y I_∥(90°)/I_∥(0°) → 2B/(A + B) = 1/2.
  assert.ok(Math.abs(pattern.parallel[2] / pattern.parallel[0] - 0.5) < 0.02, `I∥(90°)/I∥(0°) = ${pattern.parallel[2] / pattern.parallel[0]}`);

  // Conservación: integral angular = ⟨C_sca⟩.
  const fine = range(0, 180, 0.5);
  const full = gansScatteringPattern(rod.alphaLong, rod.alphaTrans, fine);
  const h = Math.PI / (fine.length - 1);
  let integral = 0;
  fine.forEach((angle, i) => {
    const w = (i === 0 || i === fine.length - 1 ? 1 : i % 2 === 1 ? 4 : 2) * (h / 3);
    integral += w * 2 * Math.PI * Math.sin((angle * Math.PI) / 180) * 0.5 * (full.perpendicular[i] + full.parallel[i]);
  });
  const k = wavenumber(wavelength, WATER);
  assert.ok(Math.abs((k ** 4 * integral) / (16 * Math.PI ** 2) / rod.csca - 1) < 1e-9);
});

// =============================================================================================
// 4. Campo cercano
// =============================================================================================

// Esfera: fuera, el campo es el aplicado más el de un dipolo puntual,
// E/E₀ = ẑ + β(a/r)³(3 cos θ r̂ − ẑ); dentro es uniforme, E/E₀ = 3ε_m/(ε + 2ε_m)
// (Jackson §4.4; B&H §5.2). En el polo (sobre el eje, en la superficie) la intensidad es
// |1 + 2β|², y en el ecuador |1 − β|².
test('campo cercano de la esfera: campo aplicado + dipolo', () => {
  const epsilon = { re: -4.5, im: 2.2 };
  const epsilonMedium = 1.77;
  const beta = clausiusMossotti(epsilon, epsilonMedium);
  const sphere = { longRadius: 10, shortRadius: 10, epsilon, epsilonMedium };
  for (const [z, rho] of [[14, 0], [0, 12], [9, 13], [-20, 5], [3, 30]]) {
    const r = Math.hypot(z, rho);
    const cos = z / r;
    const sin = rho / r;
    const scale = (10 / r) ** 3;
    // Componentes z y ρ de β·scale·(3 cos θ r̂ − ẑ).
    const dz = 3 * cos * cos - 1;
    const drho = 3 * cos * sin;
    const field = spheroidNearField(sphere, z, rho);
    assert.equal(field.inside, false);
    assert.ok(Math.abs(field.ez.re - (1 + beta.re * scale * dz)) < 1e-12 && Math.abs(field.ez.im - beta.im * scale * dz) < 1e-12);
    assert.ok(Math.abs(field.erho.re - beta.re * scale * drho) < 1e-12 && Math.abs(field.erho.im - beta.im * scale * drho) < 1e-12);
  }
  const pole = spheroidNearField(sphere, 10 + 1e-9, 0);
  assert.ok(Math.abs(pole.intensity - ((1 + 2 * beta.re) ** 2 + (2 * beta.im) ** 2)) < 1e-6);
  const equator = spheroidNearField(sphere, 0, 10 + 1e-9);
  assert.ok(Math.abs(equator.intensity - ((1 - beta.re) ** 2 + beta.im ** 2)) < 1e-6);
  // Dentro: uniforme, 3ε_m/(ε + 2ε_m) = 1 − β.
  const inside = spheroidNearField(sphere, 3, 4);
  assert.equal(inside.inside, true);
  assert.ok(Math.abs(inside.ez.re - (1 - beta.re)) < 1e-13 && Math.abs(inside.ez.im + beta.im) < 1e-13);
  assert.deepEqual(inside.erho, { re: 0, im: 0 });
  assert.throws(() => spheroidNearField({ ...sphere, longRadius: 5 }, 0, 20), RangeError);
});

// Esferoide: condiciones de contorno de la electrostática en la superficie. La componente
// tangencial de E y la normal de D = εE son continuas al cruzarla. La normal a la
// superficie z²/a² + ρ²/b² = 1 es ∝ (z/a², ρ/b²).
test('campo cercano del esferoide: E tangencial y D normal continuos en la superficie', () => {
  const epsilon = { re: -12, im: 1.1 };
  const epsilonMedium = 2.25;
  for (const [a, b] of [[10, 10], [20, 10], [45, 10], [10.5, 10]]) {
    const spheroid = { longRadius: a, shortRadius: b, epsilon, epsilonMedium };
    for (const angle of [0.2, 0.7, 1.2, 1.5]) {
      const z = a * Math.cos(angle);
      const rho = b * Math.sin(angle);
      let nz = z / (a * a);
      let nrho = rho / (b * b);
      const norm = Math.hypot(nz, nrho);
      nz /= norm;
      nrho /= norm;
      const out = spheroidNearField(spheroid, z + 1e-7 * nz, rho + 1e-7 * nrho);
      const inn = spheroidNearField(spheroid, z - 1e-7 * nz, rho - 1e-7 * nrho);
      assert.ok(!out.inside && inn.inside);
      // Tangencial: t = (−n_ρ, n_z).
      const tOut = { re: -nrho * out.ez.re + nz * out.erho.re, im: -nrho * out.ez.im + nz * out.erho.im };
      const tIn = { re: -nrho * inn.ez.re, im: -nrho * inn.ez.im };
      assert.ok(Math.hypot(tOut.re - tIn.re, tOut.im - tIn.im) < 1e-6, `E tangencial, a/b = ${a / b}, ángulo ${angle}`);
      // Normal: ε_m·E_n(fuera) = ε·E_n(dentro).
      const nOut = { re: nz * out.ez.re + nrho * out.erho.re, im: nz * out.ez.im + nrho * out.erho.im };
      const nIn = { re: nz * inn.ez.re, im: nz * inn.ez.im };
      const dIn = { re: epsilon.re * nIn.re - epsilon.im * nIn.im, im: epsilon.re * nIn.im + epsilon.im * nIn.re };
      assert.ok(Math.hypot(epsilonMedium * nOut.re - dIn.re, epsilonMedium * nOut.im - dIn.im) < 1e-5 * Math.hypot(dIn.re, dIn.im), `D normal, a/b = ${a / b}, ángulo ${angle}`);
    }
    // Lejos de la partícula solo queda el campo aplicado.
    const far = spheroidNearField(spheroid, 400 * a, 300 * a);
    assert.ok(Math.abs(far.intensity - 1) < 1e-6);
    // El campo interior es E₀·ε_m/(ε_m + L_∥(ε − ε_m)): el mismo L_∥ de la teoría de Gans.
    const L = depolarizationFactors(a / b).long;
    const dRe = epsilonMedium + L * (epsilon.re - epsilonMedium);
    const dIm = L * epsilon.im;
    const inside = spheroidNearField(spheroid, 0, 0);
    assert.ok(Math.abs(inside.ez.re - (epsilonMedium * dRe) / (dRe * dRe + dIm * dIm)) < 1e-12);
    assert.ok(Math.abs(inside.ez.im + (epsilonMedium * dIm) / (dRe * dRe + dIm * dIm)) < 1e-12);
  }
});

// El campo exterior deriva de un potencial que cumple la ecuación de Laplace: fuera de la
// partícula no hay cargas (∇·E = 0) ni rotacional (∂E_z/∂ρ = ∂E_ρ/∂z). Se comprueba con
// diferencias finitas centradas. En cilíndricas, ∇·E = ∂E_z/∂z + (1/ρ)·∂(ρE_ρ)/∂ρ.
test('campo cercano del esferoide: sin divergencia ni rotacional fuera de la partícula', () => {
  const spheroid = { longRadius: 30, shortRadius: 10, epsilon: { re: -20, im: 1.5 }, epsilonMedium: 1.77 };
  const h = 1e-3;
  for (const [z, rho] of [[35, 4], [20, 15], [5, 14], [-28, 9], [50, 30]]) {
    /** @param {number} dz @param {number} drho */
    const at = (dz, drho) => spheroidNearField(spheroid, z + dz, rho + drho);
    for (const part of /** @type {const} */ (['re', 'im'])) {
      const dEzDz = (at(h, 0).ez[part] - at(-h, 0).ez[part]) / (2 * h);
      const dRhoErhoDrho = ((rho + h) * at(0, h).erho[part] - (rho - h) * at(0, -h).erho[part]) / (2 * h);
      const dEzDrho = (at(0, h).ez[part] - at(0, -h).ez[part]) / (2 * h);
      const dErhoDz = (at(h, 0).erho[part] - at(-h, 0).erho[part]) / (2 * h);
      const scale = Math.abs(dEzDz) + Math.abs(dEzDrho) + 1e-6;
      assert.ok(Math.abs(dEzDz + dRhoErhoDrho / rho) < 1e-5 * scale + 1e-8, `divergencia en (${z}, ${rho})`);
      assert.ok(Math.abs(dEzDrho - dErhoDz) < 1e-5 * scale + 1e-8, `rotacional en (${z}, ${rho})`);
    }
  }
});

// Efecto punta: en la resonancia longitudinal, un bastón concentra el campo en sus
// extremos mucho más que una esfera. Intensidad en el polo: |1 + K·(1 − L_∥)|²… se
// comprueba la consecuencia: bastón de oro (R = 3) en su pico frente a esfera en el suyo.
test('campo cercano: el bastón en resonancia concentra más campo en la punta que la esfera', () => {
  const epsilonMedium = WATER * WATER;
  const sphere = spheroidNearField({ longRadius: 10, shortRadius: 10, epsilon: gold.epsilon(521), epsilonMedium }, 10.001, 0);
  const rod = spheroidNearField({ longRadius: 30, shortRadius: 10, epsilon: gold.epsilon(672), epsilonMedium }, 30.001, 0);
  assert.ok(sphere.intensity > 5 && sphere.intensity < 100, `esfera: ${sphere.intensity}`);
  assert.ok(rod.intensity > 10 * sphere.intensity, `bastón: ${rod.intensity}, esfera: ${sphere.intensity}`);
});

// =============================================================================================
// 5. Datos reales: valores experimentales
// =============================================================================================

// Oro coloidal de 20 nm de diámetro en agua: máximo de extinción entre 515 y 528 nm
// (intervalo del encargo; los coloides de citrato de ese tamaño tienen su máximo en
// 520–524 nm). Datos ópticos: Johnson & Christy 1972.
test('experimental: Au de 20 nm en agua tiene el pico de extinción entre 515 y 528 nm', () => {
  const peak = peakWavelength(particle(gold, 20), 450, 650);
  assert.ok(peak >= 515 && peak <= 528, `pico en ${peak.toFixed(1)} nm`);
});

// Plata coloidal de 20 nm de diámetro en agua: máximo entre 385 y 410 nm (intervalo del
// encargo; los coloides comerciales de ese tamaño lo tienen hacia 390–400 nm).
test('experimental: Ag de 20 nm en agua tiene el pico de extinción entre 385 y 410 nm', () => {
  const peak = peakWavelength(particle(silver, 20), 330, 550);
  assert.ok(peak >= 385 && peak <= 410, `pico en ${peak.toFixed(1)} nm`);
});

// Al crecer la esfera de oro de 40 a 150 nm el pico se desplaza al rojo de forma
// monótona: es el efecto del retardo (la partícula ya no ve un campo uniforme) y de la
// pérdida por radiación, que solo da la teoría de Mie completa.
test('experimental: en Au el pico se va al rojo de forma monótona de 40 a 150 nm de diámetro', () => {
  const diameters = [40, 60, 80, 100, 120, 150];
  const peaks = diameters.map((d) => peakWavelength(particle(gold, d), 450, 900));
  for (let i = 1; i < peaks.length; i++) {
    assert.ok(peaks[i] > peaks[i - 1], `picos (nm): ${peaks.map((p) => p.toFixed(1))}`);
  }
  assert.ok(peaks[peaks.length - 1] - peaks[0] > 80, 'de 40 a 150 nm el desplazamiento supera los 80 nm');
  // En cambio, por debajo de 20 nm (régimen cuasiestático) el pico no se mueve ni 2 nm.
  // (Con la interpolación lineal de la tabla el pico queda además anclado al punto de
  // 520,9 nm de Johnson & Christy; con una spline se movería ≈ 1 nm de 5 a 20 nm. La
  // conclusión es la misma, pero el «casi cero» exacto es en parte un efecto de la tabla.)
  assert.ok(Math.abs(peakWavelength(particle(gold, 5), 450, 650) - peakWavelength(particle(gold, 20), 450, 650)) < 2);
});

// Al aumentar el índice del medio el pico se va al rojo de forma monótona: la condición
// de Fröhlich Re ε = −2·n_m² pide un Re ε más negativo, que en un metal está a mayor λ.
test('experimental: en Au de 20 nm el pico se va al rojo de forma monótona con el índice del medio', () => {
  const indices = [1, 1.2, 1.33, 1.5, 1.7, 2];
  const peaks = indices.map((mediumIndex) => peakWavelength(particle(gold, 20, { mediumIndex }), 450, 800));
  for (let i = 1; i < peaks.length; i++) {
    assert.ok(peaks[i] > peaks[i - 1], `picos (nm): ${peaks.map((p) => p.toFixed(1))}`);
  }
  // En el pico cuasiestático se cumple (aproximadamente, por las pérdidas) Re ε ≈ −2·n_m².
  const inWater = peaks[2];
  assert.ok(Math.abs(gold.epsilon(inWater).re + 2 * WATER * WATER) < 1, `Re ε(${inWater.toFixed(0)} nm) = ${gold.epsilon(inWater).re}`);
});

// =============================================================================================
// 6. Color del coloide
// =============================================================================================

// Ley de Beer-Lambert: T = exp(−N·C_ext·L). Valores exactos.
test('cubeta: T = exp(−N·C_ext·L), densidad de partículas y absorbancia', () => {
  assert.equal(cuvetteTransmittance(0, 1e-9, 1e7), 1);
  assert.ok(Math.abs(cuvetteTransmittance(350, 1e-9, 1e7) - Math.exp(-3.5)) < 1e-16);
  // Doblar el camino óptico eleva T al cuadrado.
  assert.ok(Math.abs(cuvetteTransmittance(350, 1e-9, 2e7) - Math.exp(-3.5) ** 2) < 1e-16);
  assert.ok(Math.abs(absorbance(0.01) - 2) < 1e-15);
  // Fracción de volumen 1 ppm con partículas de 1000 nm³ ⇒ 10⁻⁹ partículas por nm³.
  assert.ok(Math.abs(numberDensity(1e-6, 1000) - 1e-9) < 1e-24);
  const spectra = colloidSpectra({ cext: [100, 400], csca: [5, 50], volume: 1000 }, { volumeFraction: 1e-6, pathLength: 1e7 });
  assert.ok(Math.abs(spectra.transmittance[1] - Math.exp(-4)) < 1e-15);
  assert.deepEqual(Array.from(spectra.scattered), [0.1, 1]);
  assert.ok(Math.abs(spectra.peakAbsorbance - 4 / Math.LN10) < 1e-14);
});

/**
 * Colores de un coloide: transmitido (cubeta a contraluz, D65) y dispersado.
 * @param {import('../src/modules/plasmon/physics.js').ParticleConfig} config
 * @param {number} ppm fracción de volumen de metal, en partes por millón
 * @param {number} pathMm camino óptico en mm
 */
function colloidColors(config, ppm, pathMm) {
  const wavelengths = range(380, 780, 1);
  const spectrum = particleSpectrum(config, wavelengths);
  const { transmittance, scattered, peakAbsorbance } = colloidSpectra(spectrum, { volumeFraction: ppm * 1e-6, pathLength: pathMm * 1e6 });
  return {
    transmitted: engine.colorOf({ wavelengths, values: transmittance }),
    scattered: engine.colorOfScattered({ wavelengths, values: scattered }),
    peakAbsorbance,
  };
}

// Requisito del encargo: el color transmitido del oro coloidal de 20 nm tiene a* > 0 en
// CIELAB (tira a rojo), porque la extinción quita sobre todo el verde (pico en 520 nm).
// Con la concentración por defecto (2,5 ppm en volumen, 10 mm) la absorbancia en el pico
// es del orden de 1, como en un coloide de laboratorio.
test('color: el oro coloidal de 20 nm a contraluz tira a rojo (a* > 0)', () => {
  const colors = colloidColors(particle(gold, 20), 2.5, 10);
  assert.ok(colors.peakAbsorbance > 0.5 && colors.peakAbsorbance < 2, `A = ${colors.peakAbsorbance}`);
  assert.ok(colors.transmitted.lab[1] > 20, `a* = ${colors.transmitted.lab[1]}`);
  const [r, g, b] = colors.transmitted.linear;
  assert.ok(r > g && r > b, 'el canal rojo domina');
  // Más diluido, el mismo tono pero más pálido; sin partículas, blanco.
  const dilute = colloidColors(particle(gold, 20), 0.25, 10);
  assert.ok(dilute.transmitted.lab[1] > 0 && dilute.transmitted.lab[1] < colors.transmitted.lab[1]);
  assert.ok(dilute.transmitted.lab[0] > colors.transmitted.lab[0]);
});

// Plata coloidal de 20 nm: su pico está en el violeta (≈ 390 nm), así que a contraluz se
// ve amarilla (b* > 0 y a* pequeño): hecho experimental bien conocido.
test('color: la plata coloidal de 20 nm a contraluz es amarilla', () => {
  const colors = colloidColors(particle(silver, 20), 2.5, 10);
  assert.ok(colors.transmitted.lab[2] > 5, `b* = ${colors.transmitted.lab[2]}`);
  assert.ok(Math.abs(colors.transmitted.lab[1]) < colors.transmitted.lab[2]);
});

// Copa de Licurgo: vidrio (n ≈ 1,5) con partículas de aleación Au-Ag (≈ 30:70) de unos
// 70 nm. A contraluz se ve roja y con luz reflejada, verde. Con partículas de ese tamaño
// la dispersión ya pesa tanto como la absorción (albedo ≈ 0,5–0,7): lo que se dispersa
// (verde, el pico) es justo lo que falta en la luz transmitida (roja). No hay ningún
// parámetro ajustado: tamaño y composición son los de la literatura.
test('color: copa de Licurgo, roja a contraluz (a* > 0) y verdosa por dispersión (a* < 0)', () => {
  const config = particle(alloy, 70, { mediumIndex: 1.5 });
  const colors = colloidColors(config, 2.5, 10);
  assert.ok(colors.transmitted.lab[1] > 20, `transmitida: a* = ${colors.transmitted.lab[1]}`);
  assert.ok(colors.scattered.lab[1] < -20, `dispersada: a* = ${colors.scattered.lab[1]}`);
  const [r, g] = colors.scattered.linear;
  assert.ok(g > r, 'en la luz dispersada el verde supera al rojo');
  // La dispersión no es despreciable, a diferencia del oro de 20 nm.
  const peak = peakWavelength(config, 400, 700);
  const atPeak = particleResponse(config, peak);
  const small = particleResponse(particle(gold, 20), 521);
  assert.ok(atPeak.csca / atPeak.cext > 0.4, `albedo ${atPeak.csca / atPeak.cext}`);
  assert.ok(small.csca / small.cext < 0.02);
});

// =============================================================================================
// 7. Utilidades
// =============================================================================================

// findPeak: el vértice de una parábola muestreada se recupera exactamente, y un máximo en
// el borde se señala como «no interior».
test('findPeak: vértice exacto de una parábola y aviso si el máximo está en el borde', () => {
  const xs = [0, 1, 2.5, 3, 4.2];
  const ys = xs.map((x) => 7 - 2 * (x - 2.2) ** 2);
  const peak = findPeak(xs, ys);
  assert.ok(Math.abs(peak.x - 2.2) < 1e-12 && Math.abs(peak.y - 7) < 1e-12 && peak.interior);
  assert.equal(findPeak([1, 2, 3], [3, 2, 1]).interior, false);
  assert.equal(findPeak([1, 2, 3], [1, 2, 3]).x, 3);
});

// particleSpectrum elige el modelo por la forma: Mie para la esfera y Gans para el bastón;
// y la extinción es siempre absorción + dispersión.
test('particleSpectrum: Mie para la esfera, Gans para el bastón, y C_ext = C_abs + C_sca', () => {
  const wavelengths = [450, 520, 600, 700];
  const sphere = particleSpectrum(particle(gold, 60), wavelengths);
  const rod = particleSpectrum(particle(gold, 12, { shape: 'rod', aspectRatio: 2.5 }), wavelengths);
  wavelengths.forEach((wavelength, i) => {
    const epsilon = gold.epsilon(wavelength);
    const exact = mieSphere({ radius: 30, wavelength, epsilon, mediumIndex: WATER });
    assert.equal(sphere.cext[i], exact.cext);
    assert.equal(sphere.alphaRe[i], exact.alpha.re);
    const gans = gansSpheroid({ shortRadius: 6, aspectRatio: 2.5, wavelength, epsilon, mediumIndex: WATER });
    assert.equal(rod.cext[i], gans.cext);
    assert.equal(rod.alphaIm[i], gans.alphaLong.im);
    for (const s of [sphere, rod]) assert.ok(Math.abs(s.cext[i] - s.cabs[i] - s.csca[i]) <= 1e-12 * s.cext[i]);
  });
  assert.ok(Math.abs(sphere.volume - (4 / 3) * Math.PI * 30 ** 3) < 1e-9);
  assert.ok(Math.abs(rod.volume - (4 / 3) * Math.PI * 2.5 * 6 ** 3) < 1e-9);
});
