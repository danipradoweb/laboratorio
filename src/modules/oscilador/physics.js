// @ts-check
// Oscilador armónico forzado y amortiguado.
//
//   m·ẍ + m·γ·ẋ + m·ω₀²·x = F₀·cos(ωt)
//
//   m    masa                               γ   coeficiente de amortiguamiento (1/tiempo)
//   ω₀   frecuencia angular propia          F₀  amplitud de la fuerza
//   ω    frecuencia angular de la fuerza
//
// Las funciones aceptan cualquier sistema de unidades coherente (SI, o adimensional con
// m = ω₀ = F₀ = 1, que es el que usa la vista).
//
// CONVENIOS:
//   - Régimen estacionario:  x(t) = A·cos(ωt − δ), con amplitud A ≥ 0 y desfase
//     δ ∈ [0, π]: la respuesta va RETRASADA un ángulo δ respecto a la fuerza.
//   - Respuesta compleja:    F(t) = Re[F₀·e^{−iωt}],  x(t) = Re[χ(ω)·F₀·e^{−iωt}],
//     con  χ(ω) = 1 / (m·(ω₀² − ω² − iγω)).  Con este convenio temporal (e^{−iωt}, el
//     habitual en óptica y en Griffiths), |χ|·F₀ = A, arg χ = +δ e Im χ ≥ 0 para ω ≥ 0
//     (absorción). Es el mismo convenio en el que ε = (n + ik)² tiene k > 0 al absorber,
//     pensado para reutilizar este módulo en el modelo de Lorentz (encargo 02).
//
// Referencias: Feynman, Lectures on Physics, vol. I, caps. 23 (Resonance) y 24
// (Transients); Griffiths, Introduction to Electrodynamics, 4.ª ed., §9.4.3.

/**
 * @typedef {object} OscillatorParams
 * @property {number} m masa
 * @property {number} gamma amortiguamiento γ (≥ 0)
 * @property {number} omega0 frecuencia angular propia ω₀
 * @property {number} F0 amplitud de la fuerza
 * @property {number} omega frecuencia angular de la fuerza ω (≥ 0)
 */

/**
 * Amplitud y desfase del régimen estacionario, x(t) = A·cos(ωt − δ):
 *   A = (F₀/m) / √((ω₀² − ω²)² + γ²ω²),      tan δ = γω / (ω₀² − ω²),  δ ∈ [0, π].
 * @param {OscillatorParams} p
 * @returns {{ amplitude: number, phase: number }} phase = δ en radianes
 */
export function steadyState({ m, gamma, omega0, F0, omega }) {
  const elastic = omega0 * omega0 - omega * omega; // ω₀² − ω²
  const damping = gamma * omega; // γω
  return {
    amplitude: F0 / m / Math.hypot(elastic, damping),
    // atan2 elige el cuadrante correcto: δ pasa de 0 (ω ≪ ω₀) a π (ω ≫ ω₀).
    phase: Math.atan2(damping, elastic),
  };
}

/**
 * Fuerza externa en el instante t: F(t) = F₀·cos(ωt).
 * @param {{ F0: number, omega: number }} p
 * @param {number} t
 * @returns {number}
 */
export function drivingForce({ F0, omega }, t) {
  return F0 * Math.cos(omega * t);
}

/**
 * Posición en el régimen estacionario en el instante t.
 * @param {OscillatorParams} p
 * @param {number} t
 * @returns {number}
 */
export function steadyPosition(p, t) {
  const { amplitude, phase } = steadyState(p);
  return amplitude * Math.cos(p.omega * t - phase);
}

/**
 * Respuesta compleja χ(ω) = 1 / (m·(ω₀² − ω² − iγω)), con el convenio e^{−iωt}.
 * @param {OscillatorParams} p (F0 no interviene)
 * @returns {import('../../core/complex.js').Complex}
 */
export function complexResponse({ m, gamma, omega0, omega }) {
  const elastic = omega0 * omega0 - omega * omega;
  const damping = gamma * omega;
  const denominator = m * (elastic * elastic + damping * damping);
  // 1/(a − ib) = (a + ib)/(a² + b²)
  return { re: elastic / denominator, im: damping / denominator };
}

/**
 * Potencia media que la fuerza entrega al oscilador en el régimen estacionario (igual
 * a la que disipa el rozamiento):
 *   ⟨P⟩ = ½·m·γ·ω²·A² = (F₀²/2m) · γω² / ((ω₀² − ω²)² + γ²ω²).
 * Es máxima exactamente en ω = ω₀, donde vale F₀²/(2mγ).
 * @param {OscillatorParams} p
 * @returns {number}
 */
export function averagePower(p) {
  const { amplitude } = steadyState(p);
  return 0.5 * p.m * p.gamma * p.omega * p.omega * amplitude * amplitude;
}

/**
 * Frecuencias en las que la potencia media cae a la mitad de su máximo:
 *   ω± = √(ω₀² + γ²/4) ± γ/2.
 * Su diferencia es EXACTAMENTE γ para cualquier amortiguamiento (anchura a media altura
 * de la curva de potencia). Sale de imponer |ω₀² − ω²| = γω.
 * @param {{ gamma: number, omega0: number }} p
 * @returns {{ lower: number, upper: number }}
 */
export function halfPowerFrequencies({ gamma, omega0 }) {
  const center = Math.sqrt(omega0 * omega0 + (gamma * gamma) / 4);
  return { lower: center - gamma / 2, upper: center + gamma / 2 };
}

/**
 * Aproximación lorentziana de la potencia cerca de la resonancia, válida si γ ≪ ω₀:
 *   ⟨P⟩ ≈ P_máx · (γ/2)² / ((ω − ω₀)² + (γ/2)²),     P_máx = F₀²/(2mγ).
 * @param {OscillatorParams} p
 * @returns {number}
 */
export function lorentzianPower({ m, gamma, omega0, F0, omega }) {
  const half = gamma / 2;
  const peak = (F0 * F0) / (2 * m * gamma);
  return (peak * half * half) / ((omega - omega0) ** 2 + half * half);
}

/**
 * Frecuencia en la que la AMPLITUD es máxima: ω_r = √(ω₀² − γ²/2).
 * Es algo menor que ω₀ (donde son máximas la potencia y la amplitud de la velocidad, y
 * el desfase es exactamente 90°). Si γ ≥ √2·ω₀ la amplitud no tiene máximo: decrece
 * desde ω = 0, y se devuelve 0.
 * @param {{ gamma: number, omega0: number }} p
 * @returns {number}
 */
export function amplitudeResonanceFrequency({ gamma, omega0 }) {
  const squared = omega0 * omega0 - (gamma * gamma) / 2;
  return squared > 0 ? Math.sqrt(squared) : 0;
}

/**
 * Factor de calidad Q = ω₀/γ: número de radianes de oscilación libre en los que la
 * energía cae en un factor e (si γ ≪ ω₀). Es también, exactamente y para cualquier γ, la
 * amplificación en ω₀ respecto a la respuesta estática: A(ω₀)/A(0) = Q.
 * @param {{ gamma: number, omega0: number }} p
 * @returns {number}
 */
export function qualityFactor({ gamma, omega0 }) {
  return omega0 / gamma;
}

/**
 * Energía mecánica: E = ½·m·v² + ½·m·ω₀²·x².
 * @param {number} x posición
 * @param {number} v velocidad
 * @param {{ m: number, omega0: number }} p
 * @returns {number}
 */
export function energy(x, v, { m, omega0 }) {
  return 0.5 * m * v * v + 0.5 * m * omega0 * omega0 * x * x;
}

// --- Evolución temporal -------------------------------------------------------------------

/**
 * Un paso del método de Runge-Kutta de orden 4 para el sistema dy/dt = f(t, y).
 * Error local O(dt⁵); error acumulado O(dt⁴).
 * @param {(t: number, y: number[]) => number[]} f derivada
 * @param {number} t instante actual
 * @param {number[]} y estado actual
 * @param {number} dt paso de tiempo
 * @returns {number[]} estado en t + dt
 */
export function rk4Step(f, t, y, dt) {
  const k1 = f(t, y);
  const k2 = f(t + dt / 2, y.map((v, i) => v + (dt / 2) * k1[i]));
  const k3 = f(t + dt / 2, y.map((v, i) => v + (dt / 2) * k2[i]));
  const k4 = f(t + dt, y.map((v, i) => v + dt * k3[i]));
  return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Derivada del estado [x, v] del oscilador: ẋ = v,  v̇ = (F₀/m)·cos(ωt) − γ·v − ω₀²·x.
 * @param {OscillatorParams} p
 * @returns {(t: number, y: number[]) => number[]}
 */
export function derivative({ m, gamma, omega0, F0, omega }) {
  return (t, [x, v]) => [v, drivingForce({ F0, omega }, t) / m - gamma * v - omega0 * omega0 * x];
}

/**
 * Integra el movimiento con RK4 desde t = 0.
 * @param {OscillatorParams} p
 * @param {{ x0?: number, v0?: number, dt: number, steps: number }} options
 *   x0, v0: condiciones iniciales (reposo por defecto); dt: paso; steps: número de pasos
 * @returns {{ t: Float64Array, x: Float64Array, v: Float64Array }} steps + 1 muestras
 */
export function simulate(p, { x0 = 0, v0 = 0, dt, steps }) {
  const t = new Float64Array(steps + 1);
  const x = new Float64Array(steps + 1);
  const v = new Float64Array(steps + 1);
  const f = derivative(p);
  let state = [x0, v0];
  x[0] = x0;
  v[0] = v0;
  for (let i = 1; i <= steps; i++) {
    state = rk4Step(f, (i - 1) * dt, state, dt);
    t[i] = i * dt;
    x[i] = state[0];
    v[i] = state[1];
  }
  return { t, x, v };
}

/**
 * Solución analítica completa (transitorio + estacionario) con condiciones iniciales
 * x(0) = x0, ẋ(0) = v0:
 *
 *   x(t) = A·cos(ωt − δ) + e^{−γt/2}·[C·c(t) + D·s(t)]
 *
 * donde c y s son las dos soluciones de la ecuación sin fuerza, con c(0) = 1, s′(0) = 1:
 *   subamortiguado (γ < 2ω₀):  c = cos(ω_d t),  s = sen(ω_d t)/ω_d,   ω_d = √(ω₀² − γ²/4)
 *   crítico        (γ = 2ω₀):  c = 1,           s = t
 *   sobreamortiguado:          c = cosh(κt),    s = senh(κt)/κ,       κ = √(γ²/4 − ω₀²)
 * y las constantes salen de las condiciones iniciales:
 *   C = x0 − A·cos δ,     D = v0 − A·ω·sen δ + (γ/2)·C.
 *
 * Sirve de referencia exacta para comprobar la integración numérica.
 * @param {OscillatorParams} p
 * @param {{ x0?: number, v0?: number }} [initial]
 * @returns {(t: number) => number} posición en función del tiempo
 */
export function exactSolution(p, { x0 = 0, v0 = 0 } = {}) {
  const { amplitude, phase } = steadyState(p);
  const half = p.gamma / 2;
  const discriminant = p.omega0 * p.omega0 - half * half; // ω_d² (o −κ²)
  const rate = Math.sqrt(Math.abs(discriminant));
  const C = x0 - amplitude * Math.cos(phase);
  const D = v0 - amplitude * p.omega * Math.sin(phase) + half * C;
  // Cerca del amortiguamiento crítico, sen(ω_d t)/ω_d → t: se usa el límite.
  const nearCritical = rate * rate < 1e-12 * p.omega0 * p.omega0;
  return (t) => {
    let c = 1;
    let s = t;
    if (!nearCritical && discriminant > 0) {
      c = Math.cos(rate * t);
      s = Math.sin(rate * t) / rate;
    } else if (!nearCritical) {
      c = Math.cosh(rate * t);
      s = Math.sinh(rate * t) / rate;
    }
    return amplitude * Math.cos(p.omega * t - phase) + Math.exp(-half * t) * (C * c + D * s);
  };
}
