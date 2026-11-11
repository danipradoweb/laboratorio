// @ts-check
// Tests de la física del oscilador forzado amortiguado (src/modules/oscilador/physics.js).
//
//   m·ẍ + m·γ·ẋ + m·ω₀²·x = F₀·cos(ωt)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  steadyState,
  steadyPosition,
  complexResponse,
  averagePower,
  halfPowerFrequencies,
  lorentzianPower,
  amplitudeResonanceFrequency,
  qualityFactor,
  energy,
  rk4Step,
  simulate,
  exactSolution,
} from '../src/modules/oscilador/physics.js';
import * as C from '../src/core/complex.js';

/** Parámetros de prueba en unidades arbitrarias, todos distintos de 1 a propósito. */
const base = { m: 2, gamma: 0.3, omega0: 1.5, F0: 4, omega: 1.1 };

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

// --- Régimen estacionario ------------------------------------------------------------------

// Principio: x(t) = A·cos(ωt − δ) debe cumplir la ecuación del movimiento. Las derivadas
// de un coseno son exactas (ẋ = −Aω·sen, ẍ = −Aω²·cos), así que el residuo
// m·ẍ + mγ·ẋ + mω₀²·x − F₀·cos(ωt) debe anularse salvo redondeo. Es una comprobación
// independiente de la fórmula de A y δ: no las vuelve a calcular, las sustituye.
test('el régimen estacionario cumple la ecuación del movimiento', () => {
  for (const omega of [0.05, 0.7, 1.5, 1.6, 4, 20]) {
    for (const gamma of [0.01, 0.3, 3, 10]) {
      const p = { ...base, omega, gamma };
      const { amplitude: A, phase: d } = steadyState(p);
      assert.ok(A > 0 && d >= 0 && d <= Math.PI);
      for (const t of [0, 0.37, 2.2, 9.1]) {
        const arg = omega * t - d;
        const x = A * Math.cos(arg);
        const v = -A * omega * Math.sin(arg);
        const a = -A * omega * omega * Math.cos(arg);
        const residual = p.m * a + p.m * gamma * v + p.m * p.omega0 ** 2 * x - p.F0 * Math.cos(omega * t);
        assert.ok(Math.abs(residual) < 1e-11 * p.F0, `ω=${omega}, γ=${gamma}, t=${t}: residuo ${residual}`);
        assert.ok(Math.abs(steadyPosition(p, t) - x) < 1e-13 * A);
      }
    }
  }
});

// Principio: tres límites con significado físico claro.
//   ω → 0:   manda el muelle. Respuesta estática de la ley de Hooke, x = F/k con
//            k = m·ω₀²; la masa sigue a la fuerza en fase (δ → 0).
//   ω = ω₀:  los términos de inercia y de muelle se cancelan y solo queda el rozamiento:
//            mγ·ẋ = F, es decir A = F₀/(mγω₀) y δ = π/2 EXACTO.
//   ω → ∞:   manda la inercia. Partícula libre: m·ẍ = F, A = F₀/(mω²), en oposición (δ → π).
test('límites: estático (en fase), resonancia (90°) e inercial (en oposición)', () => {
  const low = steadyState({ ...base, omega: 1e-6 });
  close(low.amplitude, base.F0 / (base.m * base.omega0 ** 2), 1e-9, 'A estática');
  assert.ok(low.phase < 1e-6);

  const res = steadyState({ ...base, omega: base.omega0 });
  assert.equal(res.phase, Math.PI / 2);
  close(res.amplitude, base.F0 / (base.m * base.gamma * base.omega0), 1e-14, 'A en ω₀');

  const high = steadyState({ ...base, omega: 1e4 });
  close(high.amplitude, base.F0 / (base.m * 1e8), 1e-6, 'A inercial');
  assert.ok(Math.PI - high.phase < 1e-4);
});

// Principio: el desfase crece de forma monótona de 0 a π al aumentar ω, y vale menos de
// 90° por debajo de ω₀ y más por encima.
test('el desfase crece de 0 a π y cruza 90° en ω₀', () => {
  let previous = -1;
  for (let omega = 0.01; omega < 6; omega += 0.01) {
    const { phase } = steadyState({ ...base, omega });
    assert.ok(phase > previous);
    assert.equal(phase < Math.PI / 2, omega < base.omega0);
    previous = phase;
  }
});

// Principio: la amplitud es máxima en ω_r = √(ω₀² − γ²/2), algo por debajo de ω₀, y allí
// vale A_máx = F₀/(mγ·√(ω₀² − γ²/4)) (resultado analítico de anular dA/dω). El máximo se
// busca aquí numéricamente, barriendo ω, sin usar la fórmula.
test('máximo de amplitud en √(ω₀² − γ²/2), no en ω₀', () => {
  for (const gamma of [0.05, 0.3, 1, 1.9]) {
    const p = { ...base, gamma };
    // Barrido grueso para localizar el máximo y búsqueda ternaria para afinarlo (la
    // amplitud tiene un único máximo, así que la búsqueda ternaria converge a él).
    let bestOmega = 0;
    let best = 0;
    for (let omega = 0; omega <= 3; omega += 1e-3) {
      const { amplitude } = steadyState({ ...p, omega });
      if (amplitude > best) {
        best = amplitude;
        bestOmega = omega;
      }
    }
    let lo = Math.max(0, bestOmega - 2e-3);
    let hi = bestOmega + 2e-3;
    for (let i = 0; i < 200; i++) {
      const a = lo + (hi - lo) / 3;
      const b = hi - (hi - lo) / 3;
      if (steadyState({ ...p, omega: a }).amplitude < steadyState({ ...p, omega: b }).amplitude) lo = a;
      else hi = b;
    }
    bestOmega = (lo + hi) / 2;
    best = steadyState({ ...p, omega: bestOmega }).amplitude;
    const expected = Math.sqrt(p.omega0 ** 2 - gamma ** 2 / 2);
    // Cerca de un máximo la función es plana: la posición solo se resuelve hasta ~√ε.
    assert.ok(Math.abs(bestOmega - expected) < 1e-6, `γ=${gamma}: máximo en ${bestOmega}, esperado ${expected}`);
    close(amplitudeResonanceFrequency(p), expected, 1e-14);
    close(best, p.F0 / (p.m * gamma * Math.sqrt(p.omega0 ** 2 - gamma ** 2 / 4)), 1e-12, 'A máxima');
    assert.ok(expected < p.omega0);
  }
  // Con γ ≥ √2·ω₀ no hay máximo: la amplitud decrece desde ω = 0.
  const heavy = { ...base, gamma: 1.5 * base.omega0 };
  assert.equal(amplitudeResonanceFrequency(heavy), 0);
  let previous = Infinity;
  for (let omega = 0; omega <= 5; omega += 0.01) {
    const { amplitude } = steadyState({ ...heavy, omega });
    assert.ok(amplitude <= previous);
    previous = amplitude;
  }
});

// Principio: con el convenio e^{−iωt}, x(t) = Re[χ·F₀·e^{−iωt}] debe coincidir con
// A·cos(ωt − δ). Por tanto |χ|·F₀ = A y arg χ = +δ, e Im χ > 0 (absorción).
test('respuesta compleja: |χ|·F₀ = A, arg χ = δ, Im χ > 0', () => {
  for (const omega of [0.2, 1.5, 3.3]) {
    const p = { ...base, omega };
    const chi = complexResponse(p);
    const { amplitude, phase } = steadyState(p);
    close(C.abs(chi) * p.F0, amplitude, 1e-13);
    close(C.arg(chi), phase, 1e-13);
    assert.ok(chi.im > 0);
    // Definición directa: χ·m·(ω₀² − ω² − iγω) = 1.
    const one = C.mul(chi, C.complex(p.m * (p.omega0 ** 2 - omega ** 2), -p.m * p.gamma * omega));
    assert.ok(C.equals(one, C.ONE, 1e-13));
    for (const t of [0, 0.8, 3]) {
      const x = C.mul(C.scale(chi, p.F0), C.exp(C.complex(0, -omega * t))).re;
      // Tolerancia absoluta referida a la amplitud: x puede valer exactamente 0.
      assert.ok(Math.abs(x - steadyPosition(p, t)) < 1e-13 * amplitude, `ω=${omega}, t=${t}`);
    }
  }
});

// --- Potencia ---------------------------------------------------------------------------------

// Principio: balance de energía en el régimen estacionario. La potencia media que entrega
// la fuerza, ⟨F·ẋ⟩ = ½·ω·F₀²·Im χ, es igual a la que disipa el rozamiento,
// ⟨mγ·ẋ²⟩ = ½·mγω²A². Además se comprueba promediando F·ẋ numéricamente sobre un periodo.
test('potencia: lo que entrega la fuerza es lo que disipa el rozamiento', () => {
  for (const omega of [0.4, 1.5, 2.7]) {
    const p = { ...base, omega };
    const { amplitude: A, phase: d } = steadyState(p);
    const fromForce = 0.5 * omega * p.F0 ** 2 * complexResponse(p).im;
    close(averagePower(p), fromForce, 1e-13, 'trabajo de la fuerza');
    // Promedio numérico de F(t)·ẋ(t) en un periodo (regla del rectángulo, exacta para
    // funciones periódicas trigonométricas con suficientes puntos).
    const N = 1000;
    const T = (2 * Math.PI) / omega;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const t = (i * T) / N;
      sum += p.F0 * Math.cos(omega * t) * (-A * omega * Math.sin(omega * t - d));
    }
    close(sum / N, averagePower(p), 1e-12, 'promedio numérico');
  }
});

// Principio: la potencia es máxima exactamente en ω = ω₀ (no en ω_r), con valor
// F₀²/(2mγ): allí la velocidad está en fase con la fuerza.
test('la potencia es máxima en ω₀ y vale F₀²/(2mγ)', () => {
  const peak = averagePower({ ...base, omega: base.omega0 });
  close(peak, base.F0 ** 2 / (2 * base.m * base.gamma), 1e-14);
  for (const omega of [0.5, 1.4, 1.49, 1.51, 1.6, 4]) {
    assert.ok(averagePower({ ...base, omega }) < peak);
  }
});

/**
 * Anchura a media altura de ⟨P⟩(ω), medida numéricamente por bisección a cada lado del
 * máximo (sin usar halfPowerFrequencies).
 * @param {typeof base} p
 */
function measuredWidth(p) {
  const half = averagePower({ ...p, omega: p.omega0 }) / 2;
  /** @param {number} a @param {number} b */
  const root = (a, b) => {
    let lo = a;
    let hi = b;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const sameSide = averagePower({ ...p, omega: mid }) > half === averagePower({ ...p, omega: lo }) > half;
      if (sameSide) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return { lower: root(1e-9, p.omega0), upper: root(p.omega0, 1e3 * p.omega0) };
}

// Principio: la anchura a media altura de la curva de potencia es γ. El encargo lo pide
// "en el límite de amortiguamiento pequeño"; en realidad, para ⟨P⟩ en función de ω el
// resultado es EXACTO con cualquier γ: la mitad del máximo se alcanza cuando
// |ω₀² − ω²| = γω, cuyas soluciones ω± = √(ω₀² + γ²/4) ± γ/2 distan exactamente γ.
// Se mide la anchura numéricamente (bisección) y se compara con γ.
test('anchura a media altura de la potencia = γ', () => {
  for (const gamma of [0.001, 0.01, 0.1, 0.5, 2, 5]) {
    const p = { ...base, gamma };
    const { lower, upper } = measuredWidth(p);
    close(upper - lower, gamma, 1e-9, `γ=${gamma}:`);
    const exact = halfPowerFrequencies(p);
    close(lower, exact.lower, 1e-9);
    close(upper, exact.upper, 1e-9);
    close(averagePower({ ...p, omega: exact.lower }), averagePower({ ...p, omega: p.omega0 }) / 2, 1e-12);
  }
});

// Principio: con γ ≪ ω₀ la curva de potencia tiende a una lorentziana centrada en ω₀ y
// de anchura γ. El error relativo de la aproximación, dentro de ±3γ del centro, es de
// orden γ/ω₀: al dividir γ entre 10, el error se divide aproximadamente entre 10.
test('con amortiguamiento pequeño la potencia tiende a una lorentziana', () => {
  /** @type {number[]} */
  const errors = [];
  for (const gamma of [0.1, 0.01, 0.001]) {
    const p = { ...base, gamma };
    let worst = 0;
    for (let k = -30; k <= 30; k++) {
      const omega = p.omega0 + (k / 10) * gamma;
      const exact = averagePower({ ...p, omega });
      worst = Math.max(worst, Math.abs(lorentzianPower({ ...p, omega }) - exact) / exact);
    }
    errors.push(worst);
  }
  assert.ok(errors[2] < 0.01, `error con γ/ω₀ ≈ 7e-4: ${errors[2]}`);
  for (let i = 1; i < errors.length; i++) {
    const ratio = errors[i - 1] / errors[i];
    assert.ok(ratio > 7 && ratio < 13, `razón de errores ${ratio}, esperada ≈ 10`);
  }
  // En el centro la aproximación es exacta.
  close(lorentzianPower({ ...base, omega: base.omega0 }), averagePower({ ...base, omega: base.omega0 }), 1e-14);
});

test('factor de calidad Q = ω₀/γ = amplificación en resonancia', () => {
  close(qualityFactor(base), base.omega0 / base.gamma, 1e-15);
  // A(ω₀)/A(0) = [F₀/(mγω₀)] / [F₀/(mω₀²)] = ω₀/γ.
  const ratio = steadyState({ ...base, omega: base.omega0 }).amplitude / steadyState({ ...base, omega: 0 }).amplitude;
  close(ratio, qualityFactor(base), 1e-13);
});

// --- Solución analítica completa ----------------------------------------------------------------

// Principio: la solución general es estacionario + transitorio. Debe cumplir las
// condiciones iniciales y la ecuación del movimiento en los tres regímenes de
// amortiguamiento. La ecuación se comprueba con derivadas numéricas centradas (h = 1e-4,
// error O(h²) ~ 1e-8).
test('solución analítica: condiciones iniciales y ecuación del movimiento', () => {
  const cases = [
    { ...base, gamma: 0.3 }, // subamortiguado
    { ...base, gamma: 2 * base.omega0 }, // crítico
    { ...base, gamma: 5 }, // sobreamortiguado
    { ...base, gamma: 0.3, F0: 0 }, // sin fuerza: oscilación libre amortiguada
  ];
  const h = 1e-4;
  for (const p of cases) {
    const x0 = 0.7;
    const v0 = -1.3;
    const x = exactSolution(p, { x0, v0 });
    close(x(0), x0, 1e-13, 'x(0)');
    const v = (x(h) - x(-h)) / (2 * h);
    assert.ok(Math.abs(v - v0) < 1e-6, `ẋ(0) = ${v}`);
    for (const t of [0.5, 2, 7.3]) {
      const vel = (x(t + h) - x(t - h)) / (2 * h);
      const acc = (x(t + h) - 2 * x(t) + x(t - h)) / (h * h);
      const residual = p.m * acc + p.m * p.gamma * vel + p.m * p.omega0 ** 2 * x(t) - p.F0 * Math.cos(p.omega * t);
      assert.ok(Math.abs(residual) < 1e-5, `γ=${p.gamma}, t=${t}: residuo ${residual}`);
    }
  }
});

// Principio: la solución es continua al cruzar el amortiguamiento crítico (γ = 2ω₀): un
// poco por debajo (senos) y un poco por encima (senos hiperbólicos) deben dar casi lo mismo.
test('solución analítica: continua a través del amortiguamiento crítico', () => {
  const critical = 2 * base.omega0;
  const at = exactSolution({ ...base, gamma: critical });
  const below = exactSolution({ ...base, gamma: critical - 1e-7 });
  const above = exactSolution({ ...base, gamma: critical + 1e-7 });
  for (const t of [0.3, 1, 4, 10]) {
    assert.ok(Math.abs(below(t) - at(t)) < 1e-6);
    assert.ok(Math.abs(above(t) - at(t)) < 1e-6);
  }
});

// Principio: el transitorio decae como e^{−γt/2}; pasado un tiempo largo solo queda el
// régimen estacionario, sean cuales sean las condiciones iniciales.
test('el transitorio decae como e^{−γt/2}', () => {
  const x = exactSolution(base, { x0: 3, v0: -2 });
  for (const t of [10, 40, 100]) {
    const difference = Math.abs(x(t) - steadyPosition(base, t));
    assert.ok(difference < 6 * Math.exp((-base.gamma * t) / 2), `t=${t}: diferencia ${difference}`);
  }
  assert.ok(Math.abs(x(200) - steadyPosition(base, 200)) < 1e-12);
});

// --- Integración numérica (RK4) -----------------------------------------------------------------

// Principio: RK4 es de orden 4: al dividir el paso entre 2, el error acumulado se divide
// entre 2⁴ = 16. Referencia: la solución analítica completa, partiendo del reposo.
// Se mide el error MÁXIMO a lo largo de toda la trayectoria y no el de un instante: en
// un instante concreto el error puede pasar por cero y la razón no significaría nada.
test('RK4 converge a la solución analítica con orden 4', () => {
  const tEnd = 20;
  const exact = exactSolution(base);
  /** @type {number[]} */
  const errors = [];
  for (const steps of [200, 400, 800, 1600]) {
    const run = simulate(base, { dt: tEnd / steps, steps });
    let worst = 0;
    for (let i = 0; i <= steps; i++) worst = Math.max(worst, Math.abs(run.x[i] - exact(run.t[i])));
    errors.push(worst);
  }
  assert.ok(errors[3] < 1e-7, `error con el paso más fino: ${errors[3]}`);
  for (let i = 1; i < errors.length; i++) {
    const ratio = errors[i - 1] / errors[i];
    assert.ok(ratio > 15 && ratio < 17, `razón de errores ${ratio}, esperada ≈ 16`);
  }
});

// Principio: partiendo del reposo, la integración numérica acaba en el régimen
// estacionario analítico (amplitud A y desfase δ). Tras t = 40/γ el transitorio se ha
// reducido en e^{−20} ≈ 2e-9.
test('RK4 desde el reposo llega al régimen estacionario analítico', () => {
  for (const omega of [0.4, 1.5, 3]) {
    const p = { ...base, omega };
    const tEnd = 40 / p.gamma + (2 * Math.PI) / omega;
    const steps = 40000;
    const run = simulate(p, { dt: tEnd / steps, steps });
    const { amplitude } = steadyState(p);
    // Se compara toda la última oscilación, no un solo instante.
    const lastPeriod = Math.ceil((2 * Math.PI) / omega / (tEnd / steps));
    let worst = 0;
    let peak = 0;
    for (let i = steps - lastPeriod; i <= steps; i++) {
      worst = Math.max(worst, Math.abs(run.x[i] - steadyPosition(p, run.t[i])));
      peak = Math.max(peak, Math.abs(run.x[i]));
    }
    assert.ok(worst < 1e-6 * amplitude, `ω=${omega}: diferencia ${worst}`);
    close(peak, amplitude, 1e-4, `amplitud medida con ω=${omega}:`);
  }
});

// Principio: conservación de la energía con γ = 0 y sin fuerza. RK4 no la conserva
// exactamente, pero se sabe cuánto la pierde: para el oscilador armónico, un paso de RK4
// multiplica la energía por 1 − θ⁶/72 + θ⁸/576, con θ = ω₀·dt (sale de desarrollar e^{iθ}
// hasta orden 4 y tomar el módulo al cuadrado). Se comprueban dos cosas: que la energía
// sigue exactamente esa ley y que la pérdida es despreciable con el paso que usa la vista.
test('energía con γ = 0 y F₀ = 0: se conserva salvo la deriva conocida de RK4', () => {
  const p = { ...base, gamma: 0, F0: 0 };
  const period = (2 * Math.PI) / p.omega0;
  for (const stepsPerPeriod of [50, 200]) {
    const dt = period / stepsPerPeriod;
    const steps = stepsPerPeriod * 100; // 100 periodos
    const run = simulate(p, { x0: 0.8, v0: 0.5, dt, steps });
    const e0 = energy(run.x[0], run.v[0], p);
    const e1 = energy(run.x[steps], run.v[steps], p);
    const theta = p.omega0 * dt;
    const predicted = (1 - theta ** 6 / 72 + theta ** 8 / 576) ** steps;
    close(e1 / e0, predicted, 1e-10, `${stepsPerPeriod} pasos por periodo:`);
    assert.ok(Math.abs(e1 / e0 - 1) < (stepsPerPeriod === 50 ? 1e-3 : 1e-6));
    // La amplitud tampoco cambia: tras 100 periodos exactos vuelve al punto de partida.
    assert.ok(Math.abs(run.x[steps] - run.x[0]) < 1e-2);
  }
});

// Principio: balance de energía con rozamiento y sin fuerza: dE/dt = −m·γ·v². La energía
// perdida entre 0 y T debe ser la integral de la potencia disipada (regla del trapecio
// sobre la salida de RK4).
test('con rozamiento, la energía perdida es la disipada: ΔE = −∫ mγv² dt', () => {
  const p = { ...base, F0: 0 };
  const steps = 20000;
  const dt = 30 / steps;
  const run = simulate(p, { x0: 1, v0: 0, dt, steps });
  let dissipated = 0;
  for (let i = 1; i <= steps; i++) {
    dissipated += 0.5 * dt * p.m * p.gamma * (run.v[i] ** 2 + run.v[i - 1] ** 2);
  }
  const lost = energy(run.x[0], run.v[0], p) - energy(run.x[steps], run.v[steps], p);
  close(dissipated, lost, 1e-6);
  assert.ok(lost > 0);
});

// Principio: rk4Step es genérico. Caso con solución exacta conocida: dy/dt = −y, con
// y(0) = 1, da y(dt) = e^{−dt}; un paso de RK4 es el desarrollo de Taylor hasta orden 4.
test('rk4Step: un paso sobre dy/dt = −y es el polinomio de Taylor de orden 4', () => {
  const dt = 0.1;
  const [y] = rk4Step((_t, [v]) => [-v], 0, [1], dt);
  close(y, 1 - dt + dt ** 2 / 2 - dt ** 3 / 6 + dt ** 4 / 24, 1e-15);
  assert.ok(Math.abs(y - Math.exp(-dt)) < dt ** 5 / 100);
});
