// @ts-check
// Tests de la ecuación de Schrödinger 1D dependiente del tiempo
// (src/modules/funcion-onda/physics.js). Cada test dice qué principio comprueba y de dónde
// sale el valor esperado. Unidades: nm, fs, eV, masas del electrón.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HBAR_EV_FS,
  absorbingPotential,
  applyGlobalPhase,
  barrierTransmission,
  createGrid,
  createPropagator,
  evolve,
  expectationValues,
  freeGaussianWidth,
  gaussianPacket,
  kineticCoefficient,
  meanEnergy,
  momentumWave,
  normOf,
  piecewiseTransmission,
  potentialAt,
  potentialOnGrid,
  potentialSegments,
  probabilityDensity,
  probabilityRightOf,
  segmentsOf,
  waveNumberFromEnergy,
} from '../src/modules/funcion-onda/physics.js';

const codata = JSON.parse(readFileSync(new URL('./fixtures/codata2018.json', import.meta.url), 'utf8'));

test('constantes del módulo: ħ²/2mₑ = Ry·a₀² y ħ en eV·fs', () => {
  // Principio: la energía de Rydberg es Ry = ħ²/(2mₑa₀²), así que ħ²/2mₑ = Ry·a₀². Ry y a₀
  // salen del fixture CODATA 2018 (SciPy), independiente de cómo calcula el módulo.
  const expected = codata.rydberg_eV.valor * (codata.bohr_radius.valor * 1e9) ** 2; // eV·nm²
  assert.ok(Math.abs(kineticCoefficient(1) / expected - 1) < 1e-9, `${kineticCoefficient(1)} frente a ${expected}`);
  // Una masa doble divide el coeficiente por 2.
  assert.ok(Math.abs(kineticCoefficient(2) / kineticCoefficient(1) - 0.5) < 1e-15);
  // ħ = h/2π en eV·s, con h y e del fixture (exactas desde 2019): 0,658 211 9… eV·fs.
  const hbarEvFs = (codata.h.valor / (2 * Math.PI) / codata.e.valor) * 1e15;
  assert.ok(Math.abs(HBAR_EV_FS / hbarEvFs - 1) < 1e-14);
});

test('la norma se conserva (error < 10⁻⁹ en 1000 pasos sin potencial absorbente)', () => {
  // Principio: la evolución de Schrödinger es unitaria. El paso partido es un producto de
  // fases (en x y en k), unitario por construcción: solo queda el redondeo. Requisito del
  // encargo: error < 10⁻⁹ en 1000 pasos. Se prueba con una barrera y con un pozo armónico.
  const grid = createGrid(1024, -40, 40);
  const psi0 = gaussianPacket(grid, { x0: -10, sigma: 1.5, k0: 4 });
  for (const spec of /** @type {import('../src/modules/funcion-onda/physics.js').PotentialSpec[]} */ ([
    { type: 'barrera', center: 0, height: 0.8, width: 0.6 },
    { type: 'armonico', center: 0, quantum: 0.2 },
  ])) {
    const prop = createPropagator(grid, potentialOnGrid(grid, spec), { dt: 0.05 });
    const psi = evolve(prop, psi0, 1000);
    const drift = Math.abs(normOf(grid, psi) - normOf(grid, psi0));
    assert.ok(drift < 1e-9, `${spec.type}: deriva de la norma ${drift}`);
  }
});

test('el potencial absorbente se lleva lo que llega al borde (y solo eso)', () => {
  // Principio: −iW(x) con W ≥ 0 hace decrecer la norma: d‖ψ‖²/dt = −(2/ħ)∫W|ψ|². Un paquete
  // lejos de los bordes no lo nota; uno que sale de la región simulada desaparece.
  const grid = createGrid(1024, -50, 50);
  const W = absorbingPotential(grid, { width: 10, strength: 2 });
  const prop = createPropagator(grid, new Float64Array(grid.n), { dt: 0.1, absorber: W });
  const psi0 = gaussianPacket(grid, { x0: 0, sigma: 2, k0: 5 });
  // Al principio el paquete está a más de 20σ de la franja: la norma no cambia (< 10⁻¹²).
  assert.ok(Math.abs(normOf(grid, evolve(prop, psi0, 20)) - 1) < 1e-12);
  // v = ħk/m ≈ 0,58 nm/fs: en 200 fs ha recorrido 116 nm y ha entrado en la franja.
  const late = evolve(prop, psi0, 2000);
  assert.ok(normOf(grid, late) < 1e-3, `queda ${normOf(grid, late)}`);
});

test('paquete gaussiano libre: σ(t) = σ₀√(1 + (ħt/2mσ₀²)²), ⟨x⟩ = x₀ + ħk₀t/m y ⟨k⟩ constante', () => {
  // Principio: solución exacta del paquete gaussiano libre (Griffiths, problema 2.21). La
  // cinética del método es la exacta, ħ²k²/2m, así que con V = 0 el paso partido no comete
  // error de discretización temporal: la anchura debe coincidir a redondeo (si el paquete
  // no toca los bordes de la malla periódica: con m = 0,2 mₑ, en t = 40 fs el paquete está en
  // x ≈ 40 nm con σ ≈ 12 nm, a más de 12σ de los dos bordes).
  for (const mass of [1, 0.2]) {
    const grid = createGrid(4096, -100, 200);
    const sigma0 = 1;
    const k0 = 3;
    const psi0 = gaussianPacket(grid, { x0: -30, sigma: sigma0, k0 });
    const prop = createPropagator(grid, new Float64Array(grid.n), { dt: 0.25, mass });
    let psi = psi0;
    for (let step = 1; step <= 4; step++) {
      psi = evolve(prop, psi, 40);
      const t = step * 40 * 0.25;
      const ev = expectationValues(grid, psi);
      const expectedSigma = freeGaussianWidth(sigma0, t, mass);
      const v = (2 * kineticCoefficient(mass) * k0) / HBAR_EV_FS; // ħk/m en nm/fs
      assert.ok(Math.abs(ev.sigmaX / expectedSigma - 1) < 1e-9, `m=${mass} t=${t}: σ ${ev.sigmaX} frente a ${expectedSigma}`);
      assert.ok(Math.abs(ev.x - (-30 + v * t)) < 1e-8, `m=${mass} t=${t}: ⟨x⟩ ${ev.x}`);
      assert.ok(Math.abs(ev.k - k0) < 1e-10);
      assert.ok(Math.abs(ev.sigmaK - 1 / (2 * sigma0)) < 1e-10, 'Δk de un paquete libre no cambia');
    }
  }
});

test('tiempo de ensanchamiento τ = 2mσ₀²/ħ: 17,3 fs para un electrón con σ₀ = 1 nm, el doble con masa doble', () => {
  // Principio: de σ(t) = σ₀√(1 + (t/τ)²) con τ = 2mσ₀²/ħ = ħσ₀²/(ħ²/2m), la anchura vale
  // σ₀√2 en t = τ. Valor esperado de τ con los datos del fixture CODATA (ħ = h/2πe en eV·s
  // y ħ²/2mₑ = Ry·a₀²): 0,6582 eV·fs / 0,0381 eV·nm² · (1 nm)² = 17,28 fs.
  const hbar = (codata.h.valor / (2 * Math.PI) / codata.e.valor) * 1e15;
  const tau = hbar / (codata.rydberg_eV.valor * (codata.bohr_radius.valor * 1e9) ** 2);
  assert.ok(Math.abs(tau - 17.28) < 0.01, `τ = ${tau}`);
  assert.ok(Math.abs(freeGaussianWidth(1, tau, 1) / Math.SQRT2 - 1) < 1e-9);
  assert.ok(Math.abs(freeGaussianWidth(1, 2 * tau, 2) / Math.SQRT2 - 1) < 1e-9);
  assert.ok(Math.abs(freeGaussianWidth(2, 4 * tau, 1) / (2 * Math.SQRT2) - 1) < 1e-9); // σ₀ = 2: τ es 4 veces mayor
});

test('espacio de momentos: Parseval y transformada analítica de la gaussiana', () => {
  // Principio: la transformada de Fourier de la gaussiana es otra gaussiana,
  // |φ(k)|² = √(2/π)·σ·exp(−2σ²(k − k₀)²) (Griffiths, problema 2.22), y ∫|φ|²dk = ∫|ψ|²dx.
  const grid = createGrid(1024, -30, 30);
  const sigma = 1.3;
  const k0 = -2.5;
  const psi = gaussianPacket(grid, { x0: 4, sigma, k0 });
  const mom = momentumWave(grid, psi);
  let total = 0;
  let worst = 0;
  for (let j = 0; j < grid.n; j++) {
    total += mom.density[j] * grid.dk;
    const expected = Math.sqrt(2 / Math.PI) * sigma * Math.exp(-2 * sigma * sigma * (mom.k[j] - k0) ** 2);
    worst = Math.max(worst, Math.abs(mom.density[j] - expected));
  }
  assert.ok(Math.abs(total - normOf(grid, psi)) < 1e-12);
  assert.ok(worst < 1e-10, `error máximo ${worst}`);
  // Los k salen ordenados de negativo a positivo.
  for (let j = 1; j < grid.n; j++) assert.ok(mom.k[j] > mom.k[j - 1]);
});

test('incertidumbre: Δx·Δp = ħ/2 para la gaussiana inicial y ≥ ħ/2 siempre', () => {
  // Principio: principio de incertidumbre de Heisenberg, Δx·Δp ≥ ħ/2, con igualdad para la
  // gaussiana sin fase cuadrática (Griffiths §3.5). Δx·Δp/ħ = Δx·Δk.
  const grid = createGrid(2048, -60, 60);
  const psi0 = gaussianPacket(grid, { x0: -15, sigma: 1.2, k0: 4 });
  assert.ok(Math.abs(expectationValues(grid, psi0).uncertainty - 0.5) < 1e-10);
  for (const spec of /** @type {import('../src/modules/funcion-onda/physics.js').PotentialSpec[]} */ ([
    { type: 'libre' },
    { type: 'barrera', center: 0, height: 0.6, width: 0.8 },
    { type: 'pozo-finito', center: 0, height: 0.5, width: 4 },
    { type: 'armonico', center: 0, quantum: 0.15 },
  ])) {
    const prop = createPropagator(grid, potentialOnGrid(grid, spec), { dt: 0.1 });
    let psi = psi0;
    for (let i = 0; i < 30; i++) {
      psi = evolve(prop, psi, 10);
      const u = expectationValues(grid, psi).uncertainty;
      assert.ok(u >= 0.5 - 1e-9, `${spec.type}: Δx·Δk = ${u}`);
    }
  }
});

test('Ehrenfest: en el oscilador armónico ⟨x⟩(t) sigue la trayectoria clásica', () => {
  // Principio: teorema de Ehrenfest. Con V cuadrático, d⟨x⟩/dt = ⟨p⟩/m y d⟨p⟩/dt = −mω²⟨x⟩
  // son exactamente las ecuaciones clásicas: ⟨x⟩ = x₀cos ωt + (ħk₀/mω)·sen ωt, para
  // cualquier forma del paquete. El paso partido tiene error O(Δt²): con Δt = 0,02 fs y
  // ħω = 0,2 eV (ω = 0,30 fs⁻¹, ωΔt = 0,006) la desviación es del orden de 10⁻⁵ de la amplitud.
  const grid = createGrid(1024, -40, 40);
  const quantum = 0.2;
  const omega = quantum / HBAR_EV_FS;
  const x0 = 3;
  const k0 = 1.5;
  const psi0 = gaussianPacket(grid, { x0, sigma: 0.7, k0 }); // no es el estado coherente: da igual
  const prop = createPropagator(grid, potentialOnGrid(grid, { type: 'armonico', center: 0, quantum }), { dt: 0.02 });
  const vx = (2 * kineticCoefficient(1) * k0) / HBAR_EV_FS; // ħk₀/m
  const amplitude = Math.hypot(x0, vx / omega);
  let psi = psi0;
  let worst = 0;
  for (let i = 1; i <= 40; i++) {
    psi = evolve(prop, psi, 50);
    const t = i * 50 * 0.02;
    const classical = x0 * Math.cos(omega * t) + (vx / omega) * Math.sin(omega * t);
    worst = Math.max(worst, Math.abs(expectationValues(grid, psi).x - classical) / amplitude);
  }
  assert.ok(worst < 1e-4, `desviación máxima relativa ${worst}`);
});

test('transmisión por una barrera: el paquete coincide con T(E) promediada sobre sus momentos (1 %)', () => {
  // Principio: un paquete es una superposición de ondas planas, y cada una se transmite con
  // la probabilidad estacionaria T(E) (Griffiths §2.6). La probabilidad de que el paquete
  // acabe al otro lado es ∫|φ(k)|²·T(ħ²k²/2m)dk. Requisito del encargo: 1 % de tolerancia.
  // Malla con Δx = 0,05 nm y caras de la barrera sobre los nodos: la barrera muestreada
  // ocupa exactamente a/Δx celdas. Δt = 0,0125 fs: con una barrera de bordes abruptos el
  // error de partición (T y V no conmutan) es grande si Δt no es pequeño; con E = 0,5 eV,
  // V₀ = 1 eV y a = 0,5 nm la diferencia con la analítica es +1,1 % con Δt = 0,1 fs, −0,24 %
  // con 0,025 fs y −0,09 % con 0,0125 fs (comprobado al escribir el test).
  const cases = [
    { energy: 0.5, height: 1, width: 0.5 }, // túnel, E < V₀
    { energy: 0.3, height: 0.5, width: 1 }, // túnel, barrera más ancha
    { energy: 0.9, height: 0.6, width: 1.5 }, // por encima de la barrera
  ];
  for (const c of cases) {
    const grid = createGrid(2048, -51.2, 51.2);
    const k0 = waveNumberFromEnergy(c.energy);
    const sigma = 3;
    const psi0 = gaussianPacket(grid, { x0: -20, sigma, k0 });
    const spec = /** @type {const} */ ({ type: 'barrera', center: 0, height: c.height, width: c.width });
    const dt = 0.0125;
    const prop = createPropagator(grid, potentialOnGrid(grid, spec), { dt });
    // Tiempo para que el centro del paquete recorra 40 nm: las dos partes quedan a ±20 nm,
    // a más de 5σ de la barrera y de los bordes de la malla periódica.
    const v = (2 * kineticCoefficient(1) * k0) / HBAR_EV_FS;
    const steps = Math.round(40 / v / dt);
    const psi = evolve(prop, psi0, steps);
    const simulated = probabilityRightOf(grid, psi, c.width / 2);
    // Promedio analítico sobre la distribución de momentos inicial.
    const mom = momentumWave(grid, psi0);
    let num = 0;
    let den = 0;
    for (let j = 0; j < grid.n; j++) {
      den += mom.density[j];
      if (mom.k[j] > 0) num += mom.density[j] * barrierTransmission(kineticCoefficient(1) * mom.k[j] ** 2, c.height, c.width);
    }
    const expected = num / den;
    assert.ok(Math.abs(simulated / expected - 1) < 0.01, `E=${c.energy}: simulado ${simulated}, analítico ${expected}`);
  }
});

test('matriz de transferencia: barrera = fórmula analítica, escalón, R + T = 1 y resonancia T = 1', () => {
  // Principio: (1) la matriz de transferencia y la fórmula cerrada de la barrera
  // rectangular (Griffiths, problema 2.33) resuelven el mismo problema; (2) escalón por
  // encima de su altura: T = 4q₁q₂/(q₁ + q₂)² (Griffiths, problema 2.34); (3) conservación
  // de la probabilidad, R + T = 1; (4) en una doble barrera simétrica la transmisión vale
  // exactamente 1 en las resonancias (las reflexiones de las dos barreras se cancelan).
  for (const [E, V, a] of [[0.2, 1, 0.5], [0.5, 1, 0.5], [0.99, 1, 0.7], [1.0, 1, 0.7], [1.3, 1, 0.7], [3, 0.4, 2]]) {
    const tm = piecewiseTransmission(E, segmentsOf({ type: 'barrera', center: 3, height: V, width: a }));
    const exact = barrierTransmission(E, V, a);
    assert.ok(Math.abs(tm.T - exact) < 1e-10 * Math.max(exact, 1e-3), `E=${E}: ${tm.T} frente a ${exact}`);
    assert.ok(Math.abs(tm.R + tm.T - 1) < 1e-12);
  }
  // Barrera gruesa: T muy pequeño pero sin desbordamientos.
  const thick = piecewiseTransmission(0.1, segmentsOf({ type: 'barrera', center: 0, height: 2, width: 6 }));
  const thickExact = barrierTransmission(0.1, 2, 6);
  assert.ok(thickExact < 1e-30 && Math.abs(thick.T / thickExact - 1) < 1e-8);
  // Escalón.
  for (const [E, V] of [[0.5, 0.3], [2, 1], [1, -0.5]]) {
    const q1 = Math.sqrt(E);
    const q2 = Math.sqrt(E - V);
    const tm = piecewiseTransmission(E, segmentsOf({ type: 'escalon', center: -2, height: V }));
    assert.ok(Math.abs(tm.T - (4 * q1 * q2) / (q1 + q2) ** 2) < 1e-12);
    assert.ok(Math.abs(tm.R + tm.T - 1) < 1e-12);
  }
  // Escalón por debajo de su altura: reflexión total.
  assert.ok(Math.abs(piecewiseTransmission(0.2, segmentsOf({ type: 'escalon', center: 0, height: 0.3 })).R - 1) < 1e-12);
  // Doble barrera: se busca el máximo de T(E) entre 0 y V₀ y debe valer 1.
  const db = segmentsOf({ type: 'doble-barrera', center: 0, height: 0.5, width: 0.4, separation: 3 });
  let best = { E: 0, T: 0 };
  for (let E = 0.001; E < 0.5; E += 0.0005) {
    const T = piecewiseTransmission(E, db).T;
    if (T > best.T) best = { E, T };
  }
  // Afinado por sección áurea alrededor del mejor punto de la malla.
  let lo = best.E - 0.0005;
  let hi = best.E + 0.0005;
  for (let i = 0; i < 80; i++) {
    const m1 = lo + (hi - lo) * 0.382;
    const m2 = lo + (hi - lo) * 0.618;
    if (piecewiseTransmission(m1, db).T > piecewiseTransmission(m2, db).T) hi = m2;
    else lo = m1;
  }
  const peak = piecewiseTransmission((lo + hi) / 2, db);
  assert.ok(Math.abs(peak.T - 1) < 1e-8, `máximo de T en la doble barrera: ${peak.T}`);
  // Y R + T = 1 en un potencial dibujado arbitrario.
  const drawn = segmentsOf({ type: 'dibujado', center: 1, width: 4, columns: [0.2, 0.5, -0.3, 0.9, 0.1] });
  for (const E of [0.05, 0.4, 1.2]) {
    const r = piecewiseTransmission(E, drawn);
    assert.ok(Math.abs(r.R + r.T - 1) < 1e-11, `dibujado E=${E}: R + T = ${r.R + r.T}`);
  }
});

test('potenciales: formas, valores y coherencia entre la malla y los tramos', () => {
  // Principio: definiciones de cada potencial (ver PotentialSpec). El armónico
  // ½mω²x² vale ħω/2 en el punto de retroceso clásico del estado fundamental, x = √(ħ/mω).
  const a = kineticCoefficient(1);
  const quantum = 0.3;
  const xTurn = Math.sqrt((2 * a) / quantum); // √(ħ/mω) = √(2·(ħ²/2m)/ħω)
  assert.ok(Math.abs(potentialAt({ type: 'armonico', center: 0, quantum }, xTurn) - quantum / 2) < 1e-14);
  assert.equal(potentialAt({ type: 'barrera', center: 0, height: 1, width: 2 }, 0.5), 1);
  assert.equal(potentialAt({ type: 'barrera', center: 0, height: 1, width: 2 }, 1.5), 0);
  assert.equal(potentialAt({ type: 'pozo-finito', center: 0, height: 0.4, width: 2 }, 0), -0.4);
  assert.equal(potentialAt({ type: 'escalon', center: 1, height: 0.7 }, 1), 0.7);
  assert.equal(potentialAt({ type: 'dibujado', center: 0, width: 4, columns: [1, 2, 3, 4] }, -1.5), 1);
  assert.equal(potentialAt({ type: 'dibujado', center: 0, width: 4, columns: [1, 2, 3, 4] }, 1.5), 4);
  assert.equal(potentialAt({ type: 'doble-barrera', center: 0, height: 0.5, width: 0.4, separation: 3 }, 1.6), 0.5);
  assert.equal(potentialAt({ type: 'doble-barrera', center: 0, height: 0.5, width: 0.4, separation: 3 }, 0), 0);
  assert.equal(potentialSegments({ type: 'armonico' }), null);
  assert.throws(() => potentialSegments(/** @type {any} */ ({ type: 'otro' })), RangeError);
});

test('fase global: e^{iφ}ψ tiene la misma |ψ|², ⟨x⟩, ⟨p⟩ y la misma evolución observable', () => {
  // Principio: la fase global no es observable (Griffiths §1.4; Feynman III cap. 3): todas
  // las probabilidades dependen de |ψ|² y de fases RELATIVAS. Valor esperado: igualdad a
  // redondeo, también tras evolucionar.
  const grid = createGrid(512, -20, 20);
  const psi = gaussianPacket(grid, { x0: -3, sigma: 1, k0: 2 });
  const rotated = applyGlobalPhase(psi, 2.1);
  const d1 = probabilityDensity(psi);
  const d2 = probabilityDensity(rotated);
  for (let j = 0; j < grid.n; j++) assert.ok(Math.abs(d1[j] - d2[j]) < 1e-15);
  const e1 = expectationValues(grid, psi);
  const e2 = expectationValues(grid, rotated);
  assert.ok(Math.abs(e1.x - e2.x) < 1e-13 && Math.abs(e1.k - e2.k) < 1e-13);
  const prop = createPropagator(grid, potentialOnGrid(grid, { type: 'barrera', center: 0, height: 0.5, width: 1 }), { dt: 0.1 });
  const a = probabilityDensity(evolve(prop, psi, 100));
  const b = probabilityDensity(evolve(prop, rotated, 100));
  for (let j = 0; j < grid.n; j++) assert.ok(Math.abs(a[j] - b[j]) < 1e-13);
  // En cambio, la fase sí cambia ψ: Re ψ no es la misma.
  assert.ok(Math.abs(psi.re[grid.n / 2 - 40] - rotated.re[grid.n / 2 - 40]) > 1e-3);
});

test('energía media: ⟨T⟩ = (ħ²/2m)(k₀² + 1/4σ²) para la gaussiana y ⟨H⟩ constante al evolucionar', () => {
  // Principio: (1) ⟨T⟩ del paquete gaussiano, ħ²⟨k²⟩/2m con ⟨k²⟩ = k₀² + Δk² y Δk = 1/2σ
  // (Griffiths, problema 2.22); (2) conservación de la energía: H no depende del tiempo y
  // ⟨H⟩ es constante. El paso partido conserva exactamente un hamiltoniano modificado que
  // difiere de H en O(Δt²): ⟨H⟩ oscila un poco sin derivar.
  const grid = createGrid(2048, -60, 60);
  const sigma = 1.5;
  const k0 = 3.2;
  const psi0 = gaussianPacket(grid, { x0: -15, sigma, k0 });
  const zero = new Float64Array(grid.n);
  const e0 = meanEnergy(grid, psi0, zero);
  assert.ok(Math.abs(e0.kinetic / (kineticCoefficient(1) * (k0 * k0 + 1 / (4 * sigma * sigma))) - 1) < 1e-10);
  const V = potentialOnGrid(grid, { type: 'barrera', center: 0, height: 0.5, width: 1 });
  const start = meanEnergy(grid, psi0, V).total;
  const prop = createPropagator(grid, V, { dt: 0.01 });
  let psi = psi0;
  let worst = 0;
  for (let i = 0; i < 20; i++) {
    psi = evolve(prop, psi, 200);
    worst = Math.max(worst, Math.abs(meanEnergy(grid, psi, V).total / start - 1));
  }
  assert.ok(worst < 1e-3, `variación relativa de ⟨H⟩: ${worst}`);
});

test('potencial en la malla: promedio por celda que conserva ∫V dx y da la transmisión correcta con una malla no alineada', () => {
  // Principio: (1) el promedio exacto en cada celda conserva el área de la barrera,
  // Σ V_j·Δx = V₀·a, esté donde esté respecto a los nodos; (2) con él, la transmisión del
  // paquete coincide con la analítica (1 %) aunque la anchura no sea un número entero de
  // celdas (0,6 nm con Δx = 0,078 nm, la malla de la vista). Con el valor en el nodo daría
  // un 46,6 % frente al 41,0 % analítico (comprobado al escribir el test).
  const grid = createGrid(2048, -80, 80);
  for (const [center, width] of [[0, 0.6], [0.013, 0.37], [-1.21, 1.9]]) {
    const V = potentialOnGrid(grid, { type: 'barrera', center, height: 0.7, width });
    const area = V.reduce((acc, v) => acc + v, 0) * grid.dx;
    assert.ok(Math.abs(area - 0.7 * width) < 1e-12, `área ${area} frente a ${0.7 * width}`);
  }
  const energy = 0.2;
  const height = 0.3;
  const width = 0.6;
  const k0 = waveNumberFromEnergy(energy);
  const psi0 = gaussianPacket(grid, { x0: -20, sigma: 3, k0 });
  const dt = 0.02;
  const prop = createPropagator(grid, potentialOnGrid(grid, { type: 'barrera', center: 0, height, width }), { dt });
  const v = (2 * kineticCoefficient(1) * k0) / HBAR_EV_FS;
  const psi = evolve(prop, psi0, Math.round(40 / v / dt));
  const mom = momentumWave(grid, psi0);
  let num = 0;
  let den = 0;
  for (let j = 0; j < grid.n; j++) {
    den += mom.density[j];
    if (mom.k[j] > 0) num += mom.density[j] * barrierTransmission(kineticCoefficient(1) * mom.k[j] ** 2, height, width);
  }
  const simulated = probabilityRightOf(grid, psi, width / 2);
  assert.ok(Math.abs(simulated / (num / den) - 1) < 0.01, `simulado ${simulated}, analítico ${num / den}`);
});

test('potencial absorbente: lo absorbido por cada borde más lo que queda suma la norma inicial', () => {
  // Principio: conservación de la probabilidad con contabilidad de lo absorbido. Cada medio
  // paso multiplica ψ por un factor f con |f| ≤ 1 y la cinética es unitaria, así que
  // norma(t) + Σ|ψ|²(1 − |f|²)Δx acumulado = norma(0) salvo redondeo. Un paquete
  // que va a la derecha debe salir casi todo por el borde derecho.
  const grid = createGrid(1024, -50, 50);
  const W = absorbingPotential(grid, { width: 10, strength: 2 });
  const V = potentialOnGrid(grid, { type: 'barrera', center: 0, height: 0.3, width: 1 });
  const prop = createPropagator(grid, V, { dt: 0.02, absorber: W });
  const psi0 = gaussianPacket(grid, { x0: -15, sigma: 2, k0: waveNumberFromEnergy(0.2) });
  const losses = { left: 0, right: 0 };
  let psi = psi0;
  for (let i = 0; i < 25; i++) {
    psi = evolve(prop, psi, 1000, losses);
    const balance = normOf(grid, psi) + losses.left + losses.right - 1;
    // Cota de redondeo: hasta 25 000 pasos con dos FFT cada uno (~10⁻¹⁵ por paso) → 10⁻¹⁰.
    // (Se escribió primero 10⁻¹² y el redondeo acumulado la superó en el paso 18 000.)
    assert.ok(Math.abs(balance) < 1e-10, `balance ${balance} en el bloque ${i}`);
  }
  // Al final no queda casi nada: lo transmitido salió por la derecha y lo reflejado por la izquierda.
  assert.ok(normOf(grid, psi) < 1e-3, `queda ${normOf(grid, psi)}`);
  assert.ok(losses.right > 0.05 && losses.left > 0.5, `izquierda ${losses.left}, derecha ${losses.right}`);
});
