// @ts-check
// Tests de los estados propios y la superposición
// (src/modules/funcion-onda/physics-states.js). Unidades: nm, fs, eV, masas del electrón.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HBAR_EV_FS,
  createGrid,
  createPropagator,
  evolve,
  expectationValues,
  kineticCoefficient,
  potentialOnGrid,
  probabilityDensity,
} from '../src/modules/funcion-onda/physics.js';
import {
  eigenstates,
  finiteWellLevels,
  harmonicEnergy,
  infiniteWellEnergy,
  positionMatrixElement,
  superpose,
  transition,
  twoStateCoefficients,
  twoStateMeanPosition,
} from '../src/modules/funcion-onda/physics-states.js';

const codata = JSON.parse(readFileSync(new URL('./fixtures/codata2018.json', import.meta.url), 'utf8'));

/**
 * Nodos interiores de una caja [0, L] con paredes infinitas en 0 y L: x_i = (i + 1)·L/(N + 1).
 * @param {number} count N
 * @param {number} width L
 */
function boxNodes(count, width) {
  return Float64Array.from({ length: count }, (_, i) => ((i + 1) * width) / (count + 1));
}

test('pozo infinito: E_n = n²π²ħ²/2mL² con error < 0,1 % (malla fina)', () => {
  // Principio: niveles del pozo infinito (Griffiths ec. 2.30). Requisito del encargo: 0,1 %.
  // Error esperado de las diferencias finitas: (nπΔx/L)²/12 → con N = 2000 y n ≤ 6,
  // 7·10⁻⁵ como mucho.
  for (const [width, mass] of [[1, 1], [2.5, 1], [1, 0.067]]) {
    const x = boxNodes(2000, width);
    const { energies } = eigenstates(x, new Float64Array(x.length), { count: 6, mass });
    for (let n = 1; n <= 6; n++) {
      const exact = infiniteWellEnergy(n, width, mass);
      assert.ok(Math.abs(energies[n - 1] / exact - 1) < 1e-3, `L=${width} m=${mass} n=${n}: ${energies[n - 1]} frente a ${exact}`);
    }
    // Más preciso: la fórmula discreta conocida, E_n = (2a/Δx²)(1 − cos(nπΔx/L)).
    const dx = x[1] - x[0];
    const a = kineticCoefficient(mass);
    for (let n = 1; n <= 6; n++) {
      const discrete = ((2 * a) / (dx * dx)) * (1 - Math.cos((n * Math.PI * dx) / width));
      assert.ok(Math.abs(energies[n - 1] / discrete - 1) < 1e-10);
    }
  }
  // Valor de referencia: electrón en una caja de 1 nm, E₁ = π²·Ry·a₀²/(1 nm)² = 0,376 eV.
  const e1 = Math.PI ** 2 * codata.rydberg_eV.valor * (codata.bohr_radius.valor * 1e9) ** 2;
  assert.ok(Math.abs(infiniteWellEnergy(1, 1) / e1 - 1) < 1e-9);
  assert.ok(Math.abs(e1 - 0.376) < 0.001);
});

test('oscilador armónico: E_n = ħω(n + ½) con error < 0,1 %', () => {
  // Principio: niveles del oscilador armónico (Griffiths ec. 2.62). Caja de ±12 longitudes
  // del oscilador √(ħ/mω), de modo que las paredes no se notan en los niveles bajos.
  for (const quantum of [0.1, 0.5]) {
    const length = Math.sqrt((2 * kineticCoefficient(1)) / quantum); // √(ħ/mω)
    const x = Float64Array.from({ length: 2000 }, (_, i) => -12 * length + ((i + 0.5) * 24 * length) / 2000);
    const V = potentialOnGrid({ x, n: x.length, xMin: 0, xMax: 0, dx: 0, k: new Float64Array(0), dk: 0 }, { type: 'armonico', center: 0, quantum });
    const { energies } = eigenstates(x, V, { count: 8 });
    for (let n = 0; n < 8; n++) {
      const exact = harmonicEnergy(n, quantum);
      assert.ok(Math.abs(energies[n] / exact - 1) < 1e-3, `ħω=${quantum} n=${n}: ${energies[n]} frente a ${exact}`);
    }
  }
});

test('pozo finito: los niveles coinciden con las ecuaciones trascendentes (0,1 %)', () => {
  // Principio: estados ligados del pozo finito (Griffiths §2.6), resueltos aparte por
  // bisección de las ecuaciones q·tan(qw/2) = κ y −q·cot(qw/2) = κ.
  const depth = 1;
  const width = 2;
  const levels = finiteWellLevels(depth, width);
  // Número de estados ligados: ⌈z₀/(π/2)⌉ con z₀ = (w/2)·√(2mV₀)/ħ (Griffiths ec. 2.155).
  const z0 = (width / 2) * Math.sqrt(depth / kineticCoefficient(1));
  assert.equal(levels.length, Math.ceil(z0 / (Math.PI / 2)));
  const x = Float64Array.from({ length: 3000 }, (_, i) => -10 + ((i + 0.5) * 20) / 3000);
  const V = x.map((xi) => (Math.abs(xi) < width / 2 ? -depth : 0));
  const { energies } = eigenstates(x, V, { count: levels.length });
  levels.forEach((E, n) => {
    assert.ok(Math.abs(energies[n] - E) < 1e-3 * depth, `n=${n}: ${energies[n]} frente a ${E}`);
  });
});

test('los estados propios son ortonormales', () => {
  // Principio: autovectores de una matriz simétrica (hamiltoniano hermítico) son
  // ortogonales; aquí se normalizan a ∫φ²dx = 1.
  const x = boxNodes(800, 3);
  const V = x.map((xi) => 0.3 * Math.sin(2 * xi) + (xi > 2 ? 0.5 : 0));
  const { states, dx } = eigenstates(x, V, { count: 6 });
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 6; b++) {
      let s = 0;
      for (let j = 0; j < x.length; j++) s += states[a][j] * states[b][j];
      assert.ok(Math.abs(s * dx - (a === b ? 1 : 0)) < 1e-10, `⟨${a}|${b}⟩ = ${s * dx}`);
    }
  }
});

test('un estado propio tiene |ψ|² estacionario', () => {
  // Principio: un estado estacionario solo gira de fase, φ·e^{−iEt/ħ}: |ψ|² no cambia
  // (Griffiths §2.1). (1) Con la evolución por superposición es exacto (redondeo). (2) Con
  // el paso partido usando la MISMA cinética de diferencias finitas, el único error es el de
  // la partición, O(Δt²): la desviación de |ψ|² es pequeña y se divide por 4 al dividir Δt
  // por 2. Potencial armónico, cuyos estados bajos son nulos lejos de los bordes (así la
  // malla periódica del paso partido y la caja de los estados propios no se distinguen).
  const grid = createGrid(1024, -15, 15);
  const spec = /** @type {const} */ ({ type: 'armonico', center: 0, quantum: 0.2 });
  const V = potentialOnGrid(grid, spec);
  const { energies, states } = eigenstates(grid.x, V, { count: 3 });
  const n = 2;
  const rho0 = probabilityDensity({ re: states[n], im: new Float64Array(grid.n) });
  const peak = Math.max(...rho0);
  // (1) Superposición con un solo término.
  const coefs = [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }];
  for (const t of [0.7, 13, 250]) {
    const rho = probabilityDensity(superpose(states, energies, coefs, t));
    for (let j = 0; j < grid.n; j++) assert.ok(Math.abs(rho[j] - rho0[j]) < 1e-14 * peak);
  }
  // (2) Paso partido con cinética de diferencias finitas, 50 fs.
  /** @param {number} dt */
  const deviation = (dt) => {
    const prop = createPropagator(grid, V, { dt, kinetic: 'fd' });
    /** @type {import('../src/modules/funcion-onda/physics.js').Wave} */
    let psi = { re: Float64Array.from(states[n]), im: new Float64Array(grid.n) };
    let worst = 0;
    const stepsPerSample = Math.round(5 / dt);
    for (let s = 0; s < 10; s++) {
      psi = evolve(prop, psi, stepsPerSample);
      const rho = probabilityDensity(psi);
      for (let j = 0; j < grid.n; j++) worst = Math.max(worst, Math.abs(rho[j] - rho0[j]) / peak);
    }
    return worst;
  };
  const d1 = deviation(0.05);
  const d2 = deviation(0.025);
  assert.ok(d1 < 1e-3, `desviación con Δt = 0,05 fs: ${d1}`);
  assert.ok(d1 / d2 > 3.5 && d1 / d2 < 4.5, `razón ${d1 / d2}`);
});

test('superposición 1 + 2 del pozo infinito: ⟨x⟩ oscila con frecuencia (E₂ − E₁)/h y amplitud 16L/9π²', () => {
  // Principio: con ψ = (φ₁ + φ₂)/√2, ⟨x⟩(t) = L/2 − (16L/9π²)·cos(ωt), ω = (E₂ − E₁)/ħ
  // (Griffiths, problema 2.5, con E₂ − E₁ = 3π²ħ²/2mL²). Se comprueba de dos maneras:
  // con la expresión analítica de dos estados y simulando con el paso partido (paredes de
  // 10³ eV, frecuencia medida por los cruces de ⟨x⟩ con su media). El paso partido solo es
  // preciso si V_máx·Δt/ħ ≲ 1: con paredes de 10⁵ eV y el mismo Δt (76 rad por paso) la
  // frecuencia sale un 2 % baja; con 10³ eV (0,76 rad), a 10⁻⁴ (comprobado al escribirlo).
  const L = 1;
  const x = boxNodes(1500, L);
  const { energies, states, dx } = eigenstates(x, new Float64Array(x.length), { count: 2 });
  const tr = transition(energies[0], energies[1]);
  const exactOmega = (3 * Math.PI ** 2 * kineticCoefficient(1)) / (L * L) / HBAR_EV_FS;
  assert.ok(Math.abs(tr.omega / exactOmega - 1) < 1e-3);
  const xab = positionMatrixElement(x, states[0], states[1], dx);
  assert.ok(Math.abs(Math.abs(xab) - (16 * L) / (9 * Math.PI ** 2)) < 1e-4, `|x₁₂| = ${Math.abs(xab)}`);
  const xaa = positionMatrixElement(x, states[0], states[0], dx);
  const xbb = positionMatrixElement(x, states[1], states[1], dx);
  assert.ok(Math.abs(xaa - L / 2) < 1e-10 && Math.abs(xbb - L / 2) < 1e-10);
  const c = twoStateCoefficients(2, 0, 1, 0.5, 0);
  // La fórmula de dos estados coincide con ⟨x⟩ de la ψ superpuesta.
  for (const t of [0, 0.4, 1.9, 7.3]) {
    const psi = superpose(states, energies, c, t);
    let sx = 0;
    let s0 = 0;
    for (let j = 0; j < x.length; j++) {
      const p = psi.re[j] ** 2 + psi.im[j] ** 2;
      s0 += p;
      sx += p * x[j];
    }
    const formula = twoStateMeanPosition({ xaa, xbb, xab }, c[0], c[1], tr.omega, t);
    assert.ok(Math.abs(sx / s0 - formula) < 1e-12);
  }
  // Simulación con el paso partido en un pozo de paredes muy altas, en una malla periódica.
  const grid = createGrid(1024, -0.5, 1.5);
  const V = potentialOnGrid(grid, { type: 'pozo-infinito', center: 0.5, width: L, wall: 1e3 });
  const sim = eigenstates(grid.x, V, { count: 2 });
  const simTr = transition(sim.energies[0], sim.energies[1]);
  let psi = superpose(sim.states, sim.energies, twoStateCoefficients(2, 0, 1, 0.5, 0), 0);
  const dt = 0.0005;
  const prop = createPropagator(grid, V, { dt });
  /** @type {number[]} */ const times = [];
  /** @type {number[]} */ const xs = [];
  const total = 3 * simTr.period;
  for (let t = 0; t <= total; t += 20 * dt) {
    times.push(t);
    xs.push(expectationValues(grid, psi).x);
    psi = evolve(prop, psi, 20);
  }
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  /** @type {number[]} */ const crossings = [];
  for (let i = 1; i < xs.length; i++) {
    if ((xs[i - 1] - mean) * (xs[i] - mean) < 0) {
      const f = (mean - xs[i - 1]) / (xs[i] - xs[i - 1]);
      crossings.push(times[i - 1] + f * (times[i] - times[i - 1]));
    }
  }
  const halfPeriod = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
  const measuredFrequency = 1 / (2 * halfPeriod); // ciclos/fs
  const expectedFrequency = 1 / simTr.period; // (E₂ − E₁)/h de esos mismos niveles
  assert.ok(Math.abs(measuredFrequency / expectedFrequency - 1) < 2e-3, `${measuredFrequency} frente a ${expectedFrequency}`);
});

test('transición: λ = hc/ΔE y periodo h/ΔE', () => {
  // Principio: E = hν = hc/λ para el fotón. Con h, c y e del fixture CODATA (exactas),
  // ΔE = 2 eV da λ = 619,92 nm y ν = 483,6 THz (periodo 2,068 fs).
  const tr = transition(1.2, 3.2);
  const h = codata.h.valor / codata.e.valor; // eV·s
  const lambda = (h * codata.c.valor) / 2 / 1e-9;
  assert.ok(Math.abs(tr.wavelengthNm / lambda - 1) < 1e-12);
  assert.ok(Math.abs(tr.wavelengthNm - 619.92) < 0.01);
  assert.ok(Math.abs(tr.frequencyTHz - 2 / h / 1e12) < 1e-6);
  assert.ok(Math.abs(tr.period * 1e-15 - h / 2) < 1e-27);
});

test('coeficientes de dos estados: normalizados, con el peso y la fase pedidos', () => {
  // Principio: |c_a|² + |c_b|² = 1; el peso es la probabilidad de medir E_b y la fase
  // relativa es arg(c_b/c_a).
  const c = twoStateCoefficients(5, 1, 3, 0.3, 1.1);
  assert.ok(Math.abs(c[1].re ** 2 + c[3].re ** 2 + c[3].im ** 2 - 1) < 1e-15);
  assert.ok(Math.abs(c[3].re ** 2 + c[3].im ** 2 - 0.3) < 1e-15);
  assert.ok(Math.abs(Math.atan2(c[3].im, c[3].re) - 1.1) < 1e-15);
  assert.deepEqual(c[0], { re: 0, im: 0 });
  // Mismo estado dos veces: el estado puro.
  assert.deepEqual(twoStateCoefficients(3, 2, 2, 0.5, 1)[2], { re: 1, im: 0 });
});
