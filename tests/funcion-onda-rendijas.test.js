// @ts-check
// Tests de la doble rendija 2D (src/modules/funcion-onda/physics-slits.js).
//
// Geometría de referencia: λ = 1 nm (electrón de 1,50 eV), rendijas de w = 1 nm con los
// centros a d = 4 nm, pantalla a D = 10 nm de la pared. Las simulaciones largas se hacen una
// sola vez y las comparten varios tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrid2D,
  createPropagator2D,
  createSlitExperiment,
  fraunhoferPattern,
  gaussianPacket2D,
  mirrorX,
  mixedDensity,
  moments2D,
  norm2D,
  runSlitExperiment,
  screenPattern,
  step2D,
  SCREEN_Y,
  WALL_Y,
  WALL_THICKNESS,
  EDGE_WIDTH,
} from '../src/modules/funcion-onda/physics-slits.js';
import { freeGaussianWidth } from '../src/modules/funcion-onda/physics.js';

const GEOMETRY = { wavelength: 1, separation: 4, slitWidth: 1 };
const branch = createSlitExperiment(GEOMETRY);
const branchRun = runSlitExperiment(branch);
const x = branch.grid.x;
const D = SCREEN_Y - WALL_Y;
/** Zona útil de la pantalla: fuera, la franja absorbente del borde. */
const reach = branch.grid.half - EDGE_WIDTH;

/**
 * Máximos locales de una curva en |x| < limit, con interpolación parabólica entre los tres
 * puntos de la malla que rodean cada uno (la malla tiene Δx = 0,125 nm).
 * @param {ArrayLike<number>} f
 * @param {number} limit
 */
function maxima(f, limit) {
  const out = [];
  for (let i = 1; i < f.length - 1; i++) {
    if (Math.abs(x[i]) >= limit) continue;
    if (f[i] > f[i - 1] && f[i] >= f[i + 1]) {
      const denom = f[i - 1] - 2 * f[i] + f[i + 1];
      const shift = denom !== 0 ? (0.5 * (f[i - 1] - f[i + 1])) / denom : 0;
      out.push(x[i] + shift * branch.grid.dx);
    }
  }
  return out;
}

test('2D: la norma se conserva sin absorción (< 10⁻⁹ en 100 pasos)', () => {
  // Principio: el paso partido es producto de fases (unitario); sin −iW la norma no cambia
  // salvo redondeo. Mismo criterio que el test 1D del encargo 03.
  const grid = createGrid2D();
  const prop = createPropagator2D(grid, null, { dt: 0.1 });
  let psi = gaussianPacket2D(grid, { k0: 3, y0: 0, sigmaX: 1.5, sigmaY: 1 });
  assert.ok(Math.abs(norm2D(grid, psi) - 1) < 1e-12);
  for (let s = 0; s < 100; s++) psi = step2D(prop, psi);
  assert.ok(Math.abs(norm2D(grid, psi) - 1) < 1e-9);
});

test('2D: el paquete gaussiano libre se ensancha en x y en y como σ(t) = σ₀√(1 + (ħt/2mσ₀²)²)', () => {
  // Principio: en 2D la cinética es separable, así que cada dirección se ensancha como el
  // paquete 1D libre (Griffiths, problema 2.21). Referencia: freeGaussianWidth, ya comprobada
  // en tests/funcion-onda.test.js. El paso partido sin potencial es exacto en la malla;
  // tolerancia 10⁻⁶ para los momentos discretos de una gaussiana bien resuelta.
  const grid = createGrid2D();
  const prop = createPropagator2D(grid, null, { dt: 0.1 });
  const sx = 1;
  const sy = 0.7;
  let psi = gaussianPacket2D(grid, { k0: 0, y0: 0, sigmaX: sx, sigmaY: sy });
  for (let s = 0; s < 100; s++) psi = step2D(prop, psi);
  const m = moments2D(grid, psi);
  assert.ok(Math.abs(m.sigmaX / freeGaussianWidth(sx, 10) - 1) < 1e-6, `σx = ${m.sigmaX}`);
  assert.ok(Math.abs(m.sigmaY / freeGaussianWidth(sy, 10) - 1) < 1e-6, `σy = ${m.sigmaY}`);
});

test('el espejo en x es exacto en la malla simétrica: aplicado dos veces deja ψ igual', () => {
  // Principio: la malla tiene x[n − j] = −x[j]; reflejar es solo reordenar índices.
  const grid = createGrid2D();
  const psi = gaussianPacket2D(grid, { k0: 2, y0: 1, sigmaX: 1, sigmaY: 2 });
  const back = mirrorX(grid, mirrorX(grid, psi));
  assert.deepEqual(back.re, psi.re);
  // Un paquete centrado en x = 0 es simétrico: su espejo es él mismo.
  const mirrored = mirrorX(grid, psi);
  let diff = 0;
  for (let i = 0; i < psi.re.length; i++) diff = Math.max(diff, Math.abs(mirrored.re[i] - psi.re[i]));
  assert.ok(diff < 1e-12);
});

test('coherencia: con γ = 1 la densidad es |ψ₁ + ψ₂|² y con γ = 0 es |ψ₁|² + |ψ₂|²', () => {
  // Principio: ρ = |ψ₁|² + |ψ₂|² + 2γ·Re(ψ₁*ψ₂) es la densidad reducida de ψ₁|e₁⟩ + ψ₂|e₂⟩
  // con ⟨e₁|e₂⟩ = γ. Valores esperados: el álgebra de los dos casos extremos.
  const psi1 = { re: Float64Array.from([0.3, -0.2, 1]), im: Float64Array.from([0.1, 0.5, 0]) };
  const psi2 = { re: Float64Array.from([-0.3, 0.4, 0.2]), im: Float64Array.from([0.2, 0.1, -1]) };
  const coherent = mixedDensity(psi1, psi2, 1);
  const incoherent = mixedDensity(psi1, psi2, 0);
  for (let i = 0; i < 3; i++) {
    const sumRe = psi1.re[i] + psi2.re[i];
    const sumIm = psi1.im[i] + psi2.im[i];
    assert.ok(Math.abs(coherent[i] - (sumRe ** 2 + sumIm ** 2)) < 1e-15);
    assert.ok(Math.abs(incoherent[i] - (psi1.re[i] ** 2 + psi1.im[i] ** 2 + psi2.re[i] ** 2 + psi2.im[i] ** 2)) < 1e-15);
  }
});

test('Fraunhofer: máximos de interferencia en d·sen θ = mλ, ceros en (m + ½)λ y envolvente nula en w·sen θ = λ', () => {
  // Principio: I(θ) = sinc²(πw sen θ/λ)·[1 + γ cos(2πd sen θ/λ)]/(1 + γ) (Born & Wolf §8.5).
  // Valores esperados: los de la fórmula.
  const g = GEOMETRY;
  assert.equal(fraunhoferPattern(0, g), 1);
  assert.ok(fraunhoferPattern(0.5 / 4, g) < 1e-15); // d sen θ = λ/2: franja oscura
  assert.ok(fraunhoferPattern(1.5 / 4, g) < 1e-15);
  assert.ok(Math.abs(fraunhoferPattern(1, { ...g, separation: 3 })) < 1e-30); // w sen θ = λ
  // Sin coherencia queda solo la envolvente de una rendija: sin franjas.
  const s = 0.5 / 4;
  const u = Math.PI * s;
  assert.ok(Math.abs(fraunhoferPattern(s, { ...g, coherence: 0 }) - (Math.sin(u) / u) ** 2) < 1e-15);
});

test('pantalla: los máximos de interferencia cumplen d·sen θ = mλ (m = 0, ±1, ±2, ±3)', () => {
  // Principio: Young. La interferencia está en el término cruzado; dividido por la media
  // geométrica de las dos ramas, J₁₂/(2√(J₁J₂)) = cos Δφ, queda sin la envolvente de cada
  // rendija (que, multiplicada, desplaza hacia el centro los máximos del patrón total).
  // Sus máximos están donde la diferencia de caminos desde las dos rendijas es mλ.
  // Valor esperado: d·sen θ = mλ, con θ medido desde el punto medio entre las rendijas.
  // Tolerancia 0,04 (en órdenes), fijada antes de ejecutar el test. La pantalla está a
  // D = 10 nm, no en el infinito: con fuentes puntuales en el centro de la pared la condición
  // exacta r₂ − r₁ = mλ da d·sen θ/λ = 1,017, 2,022 y 3,011 (cálculo geométrico aparte); el
  // resto del margen, para la interpolación entre puntos de la malla y la anchura espectral.
  // Lo simulado queda algo por dentro (0,992, 1,983 y 2,987), con el signo contrario a esa
  // corrección: en campo cercano el plano desde el que radian las rendijas cuenta (un cuarto
  // de nm en D mueve el orden un 2 %) y dentro de una pared de 1 nm no está fijado. Historia
  // (PROGRESO.md): con la primera pared, de 1,5 nm, la desviación llegaba a −0,04 en m = 3 al
  // hacerla opaca (20 eV); con una de 0,5 nm coincidía con la geometría a 0,006 pero dejaba
  // pasar un 4 % (la malla no resuelve la absorción); la de 1 nm cumple las dos cosas.
  // Al escribir el test había también una comprobación «fina» que se quitó porque no
  // distinguía la λ nominal de la efectiva.
  const { j1, j2, j12 } = branchRun.screen;
  const cosPhase = Float64Array.from(j12, (v, i) => v / (2 * Math.sqrt(Math.max(j1[i] * j2[i], 1e-300))));
  const found = maxima(cosPhase, reach).sort((a, b) => a - b);
  const orders = found.map((xm) => (GEOMETRY.separation * Math.sin(Math.atan(xm / D))) / GEOMETRY.wavelength);
  assert.equal(found.length, 7, `máximos en x = ${found.map((v) => v.toFixed(2)).join(', ')}`);
  orders.forEach((order, i) => {
    const m = i - 3;
    assert.ok(Math.abs(order - m) < 0.04, `m = ${m}: d·sen θ/λ = ${order.toFixed(4)}`);
  });
});

test('pantalla: con coherencia hay franjas de contraste casi total; al perderla desaparecen', () => {
  // Principio: con γ = 1 las dos ramas interfieren; cerca del centro llegan con la misma
  // intensidad y una diferencia de caminos (λ/2 en la primera franja oscura) muy por debajo
  // de la longitud de coherencia del paquete (λ·k₀/Δk ≈ 15λ), así que la visibilidad
  // V = (I_máx − I_mín)/(I_máx + I_mín) debe ser casi 1 (umbral 0,95). Con γ = 0 queda
  // |ψ₁|² + |ψ₂|², la suma de dos patrones de una rendija, que es suave: un solo máximo en
  // toda la pantalla. Con γ intermedio, la visibilidad es γ cuando las dos ramas llegan con
  // la misma intensidad (Born & Wolf §10.4: la visibilidad mide el grado de coherencia);
  // tolerancia 0,05 porque entre el centro y la primera franja oscura (x ≈ 1,3 nm) la
  // envolvente de una rendija cambia un poco.
  const center = x.findIndex((v) => Math.abs(v) < 1e-9);
  const coherent = screenPattern(branchRun.screen, 1);
  // Primera franja oscura del caso coherente: el mínimo entre el centro y el primer máximo
  // (d·sen θ = λ/2 da x ≈ 1,3 nm; el primer máximo está en x ≈ 2,6 nm).
  let iMin = center;
  for (let i = center; x[i] < 2.4; i++) if (coherent[i] < coherent[iMin]) iMin = i;
  const visibility = (/** @type {number} */ gamma) => {
    const p = screenPattern(branchRun.screen, gamma);
    return (p[center] - p[iMin]) / (p[center] + p[iMin]);
  };
  const v1 = visibility(1);
  assert.ok(v1 > 0.95, `V(γ = 1) = ${v1}`);
  assert.ok(Math.abs(visibility(0.5) - 0.5) < 0.05, `V(γ = 0,5) = ${visibility(0.5)}`);
  assert.equal(maxima(coherent, reach).length, 7);
  // Con γ = 0,5 siguen las franjas centrales (m = 0 y ±1, en |x| < 4 nm). Las de m = ±3, que
  // ya con γ = 1 tienen poco contraste (anchura espectral del paquete), dejan de ser máximos.
  assert.equal(maxima(screenPattern(branchRun.screen, 0.5), 4).length, 3);
  assert.equal(maxima(screenPattern(branchRun.screen, 0), reach).length, 1, 'sin coherencia no debe haber franjas');
});

test('pared opaca: con rendijas estrechas, una sola rendija da un patrón sin franjas y la pared no deja pasar nada apreciable', () => {
  // Principio: una rendija de anchura w < λ no tiene ceros en su patrón (el primero estaría
  // en w·sen θ = λ, fuera del semiplano): un solo máximo (Born & Wolf §8.5). Si la pared deja
  // pasar onda, esa onda interfiere con la de la rendija y salen rizos: franjas falsas aunque
  // γ = 0 (lo encontró la revisión independiente con la pared de 5 eV). Esquina más
  // desfavorable de los controles: λ = 0,8 nm, w = 0,5 nm. Umbral de la fuga: con la pared
  // cerrada debe llegar menos de 10⁻³ de lo que deja una rendija (amplitud < 3 %).
  const narrow = { wavelength: 0.8, separation: 4, slitWidth: 0.5 };
  const one = runSlitExperiment(createSlitExperiment(narrow)).screen;
  const closed = runSlitExperiment(createSlitExperiment({ ...narrow, open: 'none' }), { mirror: false }).screen;
  const total = (/** @type {ArrayLike<number>} */ f) => {
    let acc = 0;
    for (let i = 0; i < f.length; i++) if (Math.abs(x[i]) < reach) acc += f[i];
    return acc;
  };
  assert.ok(total(closed.j1) / total(one.j1) < 1e-3, `fuga relativa ${total(closed.j1) / total(one.j1)}`);
  assert.equal(maxima(one.j1, reach).length, 1, 'una rendija estrecha no debe dar franjas');
  assert.equal(maxima(screenPattern(one, 0), reach).length, 1, 'sin coherencia no debe haber franjas');
});

test('superposición: con las dos rendijas abiertas, la pantalla es la de ψ₁ + ψ₂ (< 5 %)', () => {
  // Principio: Feynman, vol. III §1-6 y §3-2: la amplitud de llegar con las dos rendijas
  // abiertas es la suma de las amplitudes con cada una abierta por separado. No es exacto
  // (la onda que pasa por una rendija toca los bordes de la otra), pero la corrección es
  // pequeña cuando las rendijas están separadas varias longitudes de onda; tolerancia
  // fijada de antemano: 5 % de diferencia relativa integrada sobre la pantalla.
  const both = createSlitExperiment({ ...GEOMETRY, open: 'both' });
  const run = runSlitExperiment(both, { mirror: false });
  const direct = run.screen.j1; // una sola onda, la de las dos rendijas abiertas
  const sum = screenPattern(branchRun.screen, 1);
  let diff = 0;
  let total = 0;
  for (let i = 0; i < sum.length; i++) {
    if (Math.abs(x[i]) >= reach) continue;
    diff += Math.abs(direct[i] - sum[i]);
    total += Math.abs(sum[i]);
  }
  assert.ok(diff / total < 0.05, `diferencia relativa ${(diff / total).toFixed(4)}`);
});

test('la simulación dura lo bastante: tras el tiempo final llega a la pantalla < 1 % más', () => {
  // Principio: el tiempo final (createSlitExperiment) es el que tarda el final del paquete en
  // llegar a la pantalla por el camino más inclinado que esta recoge. Comprobación: lo que la
  // cruza en 10 fs más es menos del 1 % de lo acumulado.
  let psi = branchRun.psi;
  const extra = runSlitExperiment({ ...branch, psi, tMax: 10 });
  const after = screenPattern(extra.screen, 1).reduce((s, v) => s + v, 0);
  const before = screenPattern(branchRun.screen, 1).reduce((s, v) => s + v, 0);
  assert.ok(after / before < 0.01, `${after / before}`);
  psi = extra.psi;
  assert.ok(norm2D(branch.grid, psi) < 0.05);
});
