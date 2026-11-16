// @ts-check
// Tests de la cuerda clásica (src/modules/funcion-onda/physics-string.js).
// Cada test dice qué principio comprueba y de dónde sale el valor esperado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createString,
  modalEnergies,
  modeFrequency,
  modeShape,
  setFromSolution,
  setReleasedShape,
  stepString,
  stringEnergy,
} from '../src/modules/funcion-onda/physics-string.js';

/** Pulso gaussiano de anchura w centrado en x0. */
const gaussian = (/** @type {number} */ x0, /** @type {number} */ w) => (/** @type {number} */ x) =>
  Math.exp(-((x - x0) ** 2) / (2 * w * w));

/** Máximo de |a_i − b_i|. */
function maxDiff(/** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>} */ b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

/**
 * Frecuencia de un modo medida en la simulación. Para un modo propio de la malla, el
 * salto de rana da exactamente u^{n+1} + u^{n−1} = 2·cos(ω_d·Δt)·u^n en cada nodo, así
 * que ω_d se lee sin ajustar nada (en el vientre, donde u no es pequeño).
 */
function measuredModeFrequency(/** @type {number} */ n, /** @type {'fixed' | 'free'} */ boundary, /** @type {number} */ cells, /** @type {number} */ courant) {
  const L = 2;
  const c = 3;
  const s = createString({ length: L, cells, speed: c, boundary, courant });
  const w = modeFrequency(n, L, c);
  setFromSolution(s, (x, t) => modeShape(n, x, L, boundary) * Math.cos(w * t + 0.3));
  // Nodo con |u| máximo.
  let best = 0;
  for (let i = 0; i <= cells; i++) if (Math.abs(s.u[i]) > Math.abs(s.u[best])) best = i;
  const before = s.uPrev[best];
  const now = s.u[best];
  stepString(s);
  const after = s.u[best];
  return Math.acos((after + before) / (2 * now)) / s.dt;
}

test('modos: con r = 1 la frecuencia del modo n es exactamente nπc/L (extremos fijos y libres)', () => {
  // Principio: modos propios de la cuerda, ω_n = nπc/L (Feynman I cap. 49). Con número
  // de Courant 1 el salto de rana es exacto en los nodos (relación de dispersión discreta
  // sen(ωΔt/2) = r·sen(kΔx/2) → ω = ck), así que la frecuencia medida coincide a redondeo.
  for (const boundary of /** @type {const} */ (['fixed', 'free'])) {
    for (const n of [1, 2, 5]) {
      const measured = measuredModeFrequency(n, boundary, 200, 1);
      const expected = modeFrequency(n, 2, 3);
      assert.ok(Math.abs(measured / expected - 1) < 1e-9, `${boundary} n=${n}: ${measured} frente a ${expected}`);
    }
  }
});

test('modos: con r < 1 la frecuencia converge a nπc/L con error ∝ Δx²', () => {
  // Principio: el esquema es de segundo orden. De la dispersión discreta,
  // ω_d/ω − 1 ≈ −(kΔx)²(1 − r²)/24: al dividir Δx por 2 el error se divide por 4.
  for (const boundary of /** @type {const} */ (['fixed', 'free'])) {
    const n = 3;
    const expected = modeFrequency(n, 2, 3);
    const e1 = Math.abs(measuredModeFrequency(n, boundary, 100, 0.5) / expected - 1);
    const e2 = Math.abs(measuredModeFrequency(n, boundary, 200, 0.5) / expected - 1);
    const kdx = (n * Math.PI) / 100; // k·Δx con 100 intervalos
    const predicted = (kdx * kdx * (1 - 0.25)) / 24;
    assert.ok(Math.abs(e1 / predicted - 1) < 0.01, `${boundary}: error ${e1}, previsto ${predicted}`);
    assert.ok(Math.abs(e1 / e2 - 4) < 0.02, `${boundary}: razón ${e1 / e2}`);
  }
});

test('la energía discreta se conserva (extremos fijos y libres, r = 1 y r = 0,7)', () => {
  // Principio: la ecuación de ondas sin rozamiento conserva la energía. El salto de rana
  // conserva exactamente la energía discreta definida en physics-string.js (cinética más
  // potencial con el producto cruzado entre dos instantes); solo queda el redondeo.
  for (const boundary of /** @type {const} */ (['fixed', 'free'])) {
    for (const courant of [1, 0.7]) {
      const s = createString({ length: 1, cells: 400, speed: 1, boundary, courant });
      const shape = (/** @type {number} */ x) => gaussian(0.3, 0.04)(x) + 0.5 * Math.sin(3 * Math.PI * x);
      setReleasedShape(s, shape);
      const e0 = stringEnergy(s).total;
      let worst = 0;
      for (let k = 0; k < 50; k++) {
        stepString(s, 100);
        worst = Math.max(worst, Math.abs(stringEnergy(s).total / e0 - 1));
      }
      assert.ok(worst < 1e-12, `${boundary}, r=${courant}: deriva relativa ${worst}`);
    }
  }
});

test('la energía discreta tiende a la continua ½∫(u_t² + c²u_x²)dx', () => {
  // Principio: la definición discreta es consistente. Para el modo n con extremos fijos,
  // u = A·sen(kx)·cos(ωt), la energía continua es ¼·A²·ω²·L (constante). Error O(Δx²).
  const L = 1;
  const c = 1;
  const n = 2;
  const A = 0.7;
  const w = modeFrequency(n, L, c);
  const exact = 0.25 * A * A * w * w * L;
  /** @param {number} cells */
  const error = (cells) => {
    const s = createString({ length: L, cells, speed: c, courant: 0.5 });
    setFromSolution(s, (x, t) => A * Math.sin(n * Math.PI * x) * Math.cos(w * t));
    return Math.abs(stringEnergy(s).total / exact - 1);
  };
  const e1 = error(200);
  const e2 = error(400);
  assert.ok(e1 < 1e-3, `error ${e1}`);
  assert.ok(e1 / e2 > 3.5 && e1 / e2 < 4.5, `razón ${e1 / e2}`);
});

test('un pulso gaussiano en un medio infinito viaja sin deformarse', () => {
  // Principio: la ecuación de ondas sin dispersión (ω = ck) transporta cualquier forma
  // sin cambiarla: u(x, t) = f(x − ct) (d'Alembert). Medio infinito = extremos abiertos.
  // Con r = 1 el esquema es exacto; con r = 0,9 la dispersión numérica deja un error
  // pequeño que baja como Δx². El pulso arranca en x = 3 para que su cola en el extremo
  // izquierdo (e^{−50} ≈ 2·10⁻²²) sea despreciable: la referencia f(x − ct) supone que no
  // entra nada desde fuera, y el extremo abierto no deja entrar nada.
  const L = 10;
  const c = 2;
  const f = gaussian(3, 0.3);
  /** @param {number} cells @param {number} courant */
  const run = (cells, courant) => {
    const s = createString({ length: L, cells, speed: c, boundary: 'open', courant });
    setFromSolution(s, (x, t) => f(x - c * t));
    const steps = Math.round(4 / c / s.dt); // recorre 4 unidades: el pulso sigue dentro
    stepString(s, steps);
    const expected = Array.from(s.x, (x) => f(x - c * s.time));
    return maxDiff(s.u, expected);
  };
  assert.ok(run(1000, 1) < 1e-12, `r = 1: ${run(1000, 1)}`);
  const e1 = run(1000, 0.9);
  const e2 = run(2000, 0.9);
  assert.ok(e1 < 2e-3, `r = 0,9: ${e1}`);
  assert.ok(e1 / e2 > 3.5 && e1 / e2 < 4.5, `razón ${e1 / e2}`);
});

test('un pulso soltado en reposo se parte en dos mitades que se separan a velocidad c', () => {
  // Principio: d'Alembert con velocidad inicial nula, u = ½[f(x − ct) + f(x + ct)].
  const c = 1;
  const f = gaussian(5, 0.4);
  const s = createString({ length: 10, cells: 1000, speed: c, boundary: 'open' });
  setReleasedShape(s, f);
  stepString(s, 250);
  const t = s.time;
  const expected = Array.from(s.x, (x) => 0.5 * (f(x - c * t) + f(x + c * t)));
  assert.ok(maxDiff(s.u, expected) < 1e-12);
});

test('reflexión: el extremo fijo invierte el pulso y el libre no', () => {
  // Principio: método de las imágenes. Con el extremo fijo en x = L la solución es
  // f(x − ct) − f(2L − x − ct); con el extremo libre, f(x − ct) + f(2L − x − ct).
  // Con r = 1 el esquema la reproduce exactamente en los nodos.
  const L = 10;
  const c = 1;
  const f = gaussian(6, 0.4);
  for (const [boundary, sign] of /** @type {const} */ ([['fixed', -1], ['free', 1]])) {
    const s = createString({ length: L, cells: 1000, speed: c, boundary });
    setFromSolution(s, (x, t) => f(x - c * t));
    stepString(s, 700); // t = 7: el pulso ha llegado a x = L y ha vuelto hasta x ≈ 7
    const t = s.time;
    const expected = Array.from(s.x, (x) => f(x - c * t) + sign * f(2 * L - x - c * t));
    assert.ok(maxDiff(s.u, expected) < 1e-12, `${boundary}: ${maxDiff(s.u, expected)}`);
    // Comprobación cualitativa: el máximo |u| está en x ≈ 3 (= 2L − 6 − 7) con el signo esperado.
    let best = 0;
    for (let i = 0; i < s.u.length; i++) if (Math.abs(s.u[i]) > Math.abs(s.u[best])) best = i;
    assert.ok(Math.abs(s.x[best] - 7) < 0.02 && Math.sign(s.u[best]) === sign);
  }
});

test('el extremo abierto deja salir el pulso sin reflejarlo', () => {
  // Principio: la condición de Mur de primer orden es exacta en 1D con r = 1: una onda
  // que llega al extremo sale entera. Tras salir, la energía que queda es de redondeo.
  const s = createString({ length: 10, cells: 1000, speed: 1, boundary: 'open' });
  setFromSolution(s, (x, t) => gaussian(7, 0.3)(x - t));
  const e0 = stringEnergy(s).total;
  stepString(s, 600); // el pulso sale por x = 10
  assert.ok(stringEnergy(s).total / e0 < 1e-20, `queda ${stringEnergy(s).total / e0}`);
});

test('energías modales: un modo puro tiene toda la energía en su modo, y la suma es la total', () => {
  // Principio: los modos son ortogonales (∫sen(nπx/L)sen(mπx/L)dx = (L/2)δ_nm) y la
  // energía se reparte entre ellos sin términos cruzados. Valores esperados: 0 en los
  // demás modos (a redondeo y discretización) y la suma igual a la energía de la cuerda.
  for (const boundary of /** @type {const} */ (['fixed', 'free'])) {
    const L = 1;
    const s = createString({ length: L, cells: 800, speed: 1, boundary });
    const w2 = modeFrequency(2, L, 1);
    const w3 = modeFrequency(3, L, 1);
    setFromSolution(
      s,
      (x, t) => modeShape(2, x, L, boundary) * Math.cos(w2 * t) + 0.5 * modeShape(3, x, L, boundary) * Math.cos(w3 * t + 1),
    );
    const modes = modalEnergies(s, 8);
    const total = stringEnergy(s).total;
    const sum = modes.energy.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum / total - 1) < 1e-10, `${boundary}: suma ${sum}, total ${total}`);
    const i2 = modes.n.indexOf(2);
    const i3 = modes.n.indexOf(3);
    // Energía de cada modo, ¼A²ω²L: el modo 3 tiene A = ½ y ω 1,5 veces mayor → razón 0,5625.
    assert.ok(Math.abs(modes.energy[i3] / modes.energy[i2] - 0.5625) < 1e-3);
    for (let m = 0; m < modes.n.length; m++) {
      if (m !== i2 && m !== i3) assert.ok(modes.energy[m] / total < 1e-6, `${boundary}: modo ${modes.n[m]}`);
    }
  }
});

test('parámetros inválidos dan error', () => {
  assert.throws(() => createString({ length: 1, cells: 10, speed: 1, courant: 1.2 }), RangeError);
  assert.throws(() => createString({ length: -1, cells: 10, speed: 1 }), RangeError);
  assert.throws(() => createString({ length: 1, cells: 1, speed: 1 }), RangeError);
  assert.throws(() => modalEnergies(createString({ length: 1, cells: 10, speed: 1, boundary: 'open' }), 3), RangeError);
});
