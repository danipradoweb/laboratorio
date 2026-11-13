// @ts-check
// Luz y materia, parte C: incidencia oblicua sobre una superficie (Fresnel, Brewster,
// reflexión total) y polarizadores (Malus, gafas de sol).
//
// GEOMETRÍA. La superficie es el plano z = 0. La luz viene del medio 1 (z < 0, índice n₁
// real) y entra en el medio 2 (z > 0, índice n₂ = n + ik, que puede absorber). El plano de
// incidencia es el xz y θ es el ángulo con la normal:
//
//   k_i = k₀·(n₁ sen θ, 0,  n₁ cos θ)      incidente
//   k_r = k₀·(n₁ sen θ, 0, −n₁ cos θ)      reflejada
//   k_t = k₀·(n₁ sen θ, 0,  k_z2)          transmitida, con k_z2 = √(n₂² − n₁² sen² θ)
//
// La componente x es la misma en las tres ondas: eso ES la ley de Snell (las tres ondas
// tienen que ir acompasadas a lo largo de la superficie). k_z2 se toma con Im ≥ 0, para que
// la onda transmitida decaiga al alejarse; en reflexión total k_z2 es imaginario puro y la
// onda transmitida es evanescente.
//
// DOS POLARIZACIONES, con estos vectores unitarios para el campo eléctrico:
//   s (perpendicular al plano de incidencia):  ŝ = ŷ en las tres ondas
//   p (en el plano de incidencia):             p̂ = ŷ × k̂  (cada onda, el suyo)
//     p̂_i = (cos θ, 0, −sen θ),  p̂_r = (−cos θ, 0, −sen θ),  p̂_t = (cos θ_t, 0, −sen θ_t)
//
// COEFICIENTES DE FRESNEL (amplitudes del campo eléctrico reflejado y transmitido divididas
// por la del incidente; salen de exigir que E y H tangenciales sean continuos en z = 0):
//
//   r_s = (n₁ cos θ − n₂ cos θ_t)/(n₁ cos θ + n₂ cos θ_t)     t_s = 2 n₁ cos θ/(n₁ cos θ + n₂ cos θ_t)
//   r_p = (n₂ cos θ − n₁ cos θ_t)/(n₂ cos θ + n₁ cos θ_t)     t_p = 2 n₁ cos θ/(n₂ cos θ + n₁ cos θ_t)
//
// Es el convenio de Born & Wolf (§1.5.2) y de Hecht. Con él, en incidencia normal
// r_p = −r_s: no es que las dos polarizaciones se reflejen distinto (en θ = 0 no se
// distinguen), es que p̂_r apunta al revés que p̂_i. Griffiths (§9.3.3) usa el signo
// contrario para r_p. Las intensidades R = |r|² no dependen del convenio.
//
// CONVENIO temporal e^{−iωt}. Longitudes en longitudes de onda del vacío; vectores de onda
// en unidades de k₀ = 2π/λ₀.
//
// Referencias: Born & Wolf, Principles of Optics, §1.5; Griffiths, Introduction to
// Electrodynamics, 4.ª ed., §9.3 y §9.4; Hecht, Optics, cap. 4 y cap. 8; Feynman, Lectures
// on Physics, vol. I, cap. 33.

import { ONE, abs2, add, complex, div, mul, scale, sqrt, sub } from '../../core/complex.js';

/** @typedef {import('../../core/complex.js').Complex} Complex */

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

/**
 * Reflexión y refracción de una onda plana en una superficie.
 * @typedef {object} FresnelResult
 * @property {number} n1 índice del medio de incidencia
 * @property {Complex} n2 índice del segundo medio
 * @property {number} theta ángulo de incidencia (grados)
 * @property {number} kx componente de los vectores de onda a lo largo de la superficie, n₁·sen θ (en k₀)
 * @property {number} kz1 componente normal en el medio 1, n₁·cos θ (en k₀)
 * @property {Complex} kz2 componente normal en el medio 2, √(n₂² − n₁² sen² θ) (en k₀)
 * @property {Complex} cosT cos θ_t = k_z2/n₂ (complejo si el medio absorbe o hay reflexión total)
 * @property {Complex} sinT sen θ_t = n₁ sen θ/n₂
 * @property {Complex} rs
 * @property {Complex} rp
 * @property {Complex} ts
 * @property {Complex} tp
 * @property {number} Rs fracción de la potencia reflejada, polarización s
 * @property {number} Rp ídem, polarización p
 * @property {number} Ts fracción de la potencia que entra en el medio 2, polarización s
 * @property {number} Tp ídem, polarización p
 * @property {boolean} total ¿reflexión total? (n₂ real y θ por encima del ángulo crítico)
 */

/**
 * Coeficientes de Fresnel.
 *
 * Potencia: R = |r|². La que cruza la superficie es el flujo de energía normal a ella:
 *   T_s = Re(k_z2)·|t_s|²/k_z1,      T_p = Re(k_z2/n₂²)·|n₂|²·|t_p|²/k_z1
 * que para un medio transparente son las dos (n₂ cos θ_t)/(n₁ cos θ)·|t|²: el factor de
 * índice viene de que la intensidad es ∝ n·|E|², y el de cosenos, de que el haz
 * refractado tiene otra sección. Siempre R + T = 1 (lo que entra en un medio absorbente
 * acaba absorbido dentro).
 *
 * @param {number} n1 índice (real) del medio de incidencia
 * @param {Complex | number} n2 índice del segundo medio, n + ik
 * @param {number} thetaDeg ángulo de incidencia, en grados (0 a 90)
 * @returns {FresnelResult}
 */
export function fresnel(n1, n2, thetaDeg) {
  const index2 = typeof n2 === 'number' ? complex(n2) : n2;
  const theta = thetaDeg * DEG;
  const kx = n1 * Math.sin(theta);
  const kz1 = n1 * Math.cos(theta);
  const n2Squared = mul(index2, index2);
  // Raíz principal: parte real ≥ 0 y, con el radicando real negativo, +i·√|…|. En un medio
  // pasivo (Im n₂² ≥ 0) eso da siempre Im k_z2 ≥ 0: la onda decae hacia dentro.
  const kz2 = sqrt(sub(n2Squared, complex(kx * kx)));
  const a = complex(kz1);

  const rs = div(sub(a, kz2), add(a, kz2));
  const ts = div(scale(a, 2), add(a, kz2));
  // Forma equivalente de r_p y t_p, multiplicando arriba y abajo por n₁·n₂.
  const pNumerator = sub(scale(n2Squared, kz1), scale(kz2, n1 * n1));
  const pDenominator = add(scale(n2Squared, kz1), scale(kz2, n1 * n1));
  const rp = div(pNumerator, pDenominator);
  const tp = div(scale(index2, 2 * n1 * kz1), pDenominator);

  const Rs = abs2(rs);
  const Rp = abs2(rp);
  // En incidencia rasante (cos θ = 0) no entra potencia: se evita el 0/0.
  const Ts = kz1 > 0 ? (kz2.re * abs2(ts)) / kz1 : 0;
  const Tp = kz1 > 0 ? (div(kz2, n2Squared).re * abs2(index2) * abs2(tp)) / kz1 : 0;
  return {
    n1,
    n2: index2,
    theta: thetaDeg,
    kx,
    kz1,
    kz2,
    cosT: div(kz2, index2),
    sinT: div(complex(kx), index2),
    rs,
    rp,
    ts,
    tp,
    Rs,
    Rp,
    Ts,
    Tp,
    total: index2.im === 0 && kx > index2.re,
  };
}

/**
 * Ángulo de Brewster entre dos medios transparentes: tan θ_B = n₂/n₁. En él R_p = 0, y el
 * rayo refractado y el reflejado forman 90° (θ_B + θ_t = 90°).
 * @param {number} n1
 * @param {number} n2
 * @returns {number} grados
 */
export function brewsterAngle(n1, n2) {
  return Math.atan2(n2, n1) / DEG;
}

/**
 * Ángulo crítico: sen θ_c = n₂/n₁. Solo existe al pasar a un medio de menor índice.
 * Por encima de él toda la luz se refleja (reflexión total interna).
 * @param {number} n1
 * @param {number} n2
 * @returns {number | null} grados, o null si n₂ ≥ n₁
 */
export function criticalAngle(n1, n2) {
  return n2 < n1 ? Math.asin(n2 / n1) / DEG : null;
}

/**
 * Ángulo en el que R_p es mínima. En un medio transparente es el ángulo de Brewster y el
 * mínimo vale 0; en uno que absorbe, R_p no llega a anularse («pseudo-Brewster»).
 * Búsqueda en una malla de 0,5° afinada por sección áurea (R_p(θ) tiene un solo mínimo).
 * @param {number} n1
 * @param {Complex | number} n2
 * @returns {{ angle: number, Rp: number }} ángulo en grados y el valor mínimo de R_p
 */
export function minimumRp(n1, n2) {
  const f = (/** @type {number} */ angle) => fresnel(n1, n2, angle).Rp;
  let best = 0;
  for (let angle = 0.5; angle <= 90; angle += 0.5) if (f(angle) < f(best)) best = angle;
  let lo = Math.max(0, best - 0.5);
  let hi = Math.min(90, best + 0.5);
  const golden = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 80; i++) {
    const a = hi - golden * (hi - lo);
    const b = lo + golden * (hi - lo);
    if (f(a) < f(b)) hi = b;
    else lo = a;
  }
  const angle = (lo + hi) / 2;
  return { angle, Rp: f(angle) };
}

/**
 * Dirección en la que avanzan los frentes de onda en el medio 2, como ángulo con la
 * normal: tan θ = k_x/Re k_z2. En un medio transparente es el ángulo de refracción de
 * Snell; en reflexión total vale 90° (la onda evanescente corre a lo largo de la superficie).
 * @param {FresnelResult} result
 * @returns {number} grados
 */
export function refractionAngle(result) {
  return Math.atan2(result.kx, result.kz2.re) / DEG;
}

/**
 * Profundidad a la que la AMPLITUD del campo en el medio 2 cae a 1/e: 1/(k₀·Im k_z2), en
 * longitudes de onda del vacío. Infinita si la onda transmitida no se atenúa.
 * En reflexión total: λ₀ / (2π·√(n₁² sen² θ − n₂²)).
 * @param {FresnelResult} result
 * @returns {number}
 */
export function penetrationDepth(result) {
  return result.kz2.im > 0 ? 1 / (TWO_PI * result.kz2.im) : Infinity;
}

/**
 * Las tres ondas planas con sus vectores: vector de onda k (en k₀) y amplitud compleja
 * del campo eléctrico E (dividida por la del incidente). El campo magnético se obtiene de
 * Z₀·H = k × E. Sirve para dibujar los campos y para comprobar las condiciones de contorno.
 * @typedef {{ k: [Complex, Complex, Complex], E: [Complex, Complex, Complex] }} PlaneWave
 */

/**
 * @param {FresnelResult} result
 * @param {'s' | 'p'} polarization
 * @returns {{ incident: PlaneWave, reflected: PlaneWave, transmitted: PlaneWave }}
 */
export function planeWaves(result, polarization) {
  const { kx, kz1, kz2, n1, cosT, sinT } = result;
  const zero = complex(0);
  const cos = kz1 / n1;
  const sin = kx / n1;
  /** @type {[Complex, Complex, Complex]} */
  const ki = [complex(kx), zero, complex(kz1)];
  /** @type {[Complex, Complex, Complex]} */
  const kr = [complex(kx), zero, complex(-kz1)];
  /** @type {[Complex, Complex, Complex]} */
  const kt = [complex(kx), zero, kz2];
  if (polarization === 's') {
    return {
      incident: { k: ki, E: [zero, ONE, zero] },
      reflected: { k: kr, E: [zero, result.rs, zero] },
      transmitted: { k: kt, E: [zero, result.ts, zero] },
    };
  }
  return {
    incident: { k: ki, E: [complex(cos), zero, complex(-sin)] },
    reflected: { k: kr, E: [scale(result.rp, -cos), zero, scale(result.rp, -sin)] },
    transmitted: { k: kt, E: [mul(result.tp, cosT), zero, scale(mul(result.tp, sinT), -1)] },
  };
}

/**
 * Campo transversal en un punto (x, z), dividido por el del incidente: E_y en polarización
 * s, H_y en polarización p. Es la componente que es continua en la superficie, y la que
 * conviene para dibujar un mapa de las ondas:
 *   z < 0:  e^{i·2π(k_x·x + k_z1·z)} + r·e^{i·2π(k_x·x − k_z1·z)}       (incidente + reflejada)
 *   z ≥ 0:  (1 + r)·e^{i·2π(k_x·x + k_z2·z)}                             (transmitida)
 * El valor físico en el instante t es Re[F·e^{−iωt}] = re·cos ωt + im·sen ωt.
 * @param {FresnelResult} result
 * @param {'s' | 'p'} polarization
 * @param {number} x posición a lo largo de la superficie (en λ₀)
 * @param {number} z profundidad (en λ₀; negativa en el medio de incidencia)
 * @returns {Complex}
 */
export function transverseField(result, polarization, x, z) {
  const r = polarization === 's' ? result.rs : result.rp;
  const along = TWO_PI * result.kx * x;
  if (z < 0) {
    const down = along + TWO_PI * result.kz1 * z;
    const up = along - TWO_PI * result.kz1 * z;
    return {
      re: Math.cos(down) + r.re * Math.cos(up) - r.im * Math.sin(up),
      im: Math.sin(down) + r.re * Math.sin(up) + r.im * Math.cos(up),
    };
  }
  const tau = add(ONE, r);
  const decay = Math.exp(-TWO_PI * result.kz2.im * z);
  const phase = along + TWO_PI * result.kz2.re * z;
  return {
    re: decay * (tau.re * Math.cos(phase) - tau.im * Math.sin(phase)),
    im: decay * (tau.re * Math.sin(phase) + tau.im * Math.cos(phase)),
  };
}

/**
 * La imagen de Brewster con dipolos. En el medio 2 (transparente) los electrones oscilan
 * a lo largo del campo refractado. En polarización p ese eje es p̂_t, perpendicular al rayo
 * refractado y contenido en el plano de incidencia. Un dipolo no radia a lo largo de su
 * eje (su intensidad es ∝ sen² del ángulo con el eje), y la onda reflejada tendría que
 * salir en la dirección k̂_r. El ángulo entre k̂_r y el eje de los dipolos es
 *   ψ = |90° − (θ + θ_t)|
 * que se anula cuando θ + θ_t = 90°: el ángulo de Brewster. De hecho
 *   r_p / r_s = −cos(θ + θ_t)/cos(θ − θ_t)
 * y cos(θ + θ_t) = ±sen ψ es justo la proyección que le falta al dipolo p.
 * En polarización s el eje de los dipolos es perpendicular al plano de incidencia: todas
 * las direcciones de ese plano están a 90° del eje y no hay ángulo sin reflexión.
 * @param {number} n1
 * @param {number} n2 índice real del segundo medio
 * @param {number} thetaDeg ángulo de incidencia (grados), por debajo del crítico si lo hay
 * @returns {{ refraction: number, axisToReflected: number, pattern: number }}
 *   refraction = θ_t (grados); axisToReflected = ψ (grados); pattern = sen² ψ
 */
export function brewsterGeometry(n1, n2, thetaDeg) {
  const sinT = (n1 * Math.sin(thetaDeg * DEG)) / n2;
  if (sinT > 1) throw new RangeError('brewsterGeometry: por encima del ángulo crítico no hay rayo refractado');
  const refraction = Math.asin(sinT) / DEG;
  const axisToReflected = Math.abs(90 - (thetaDeg + refraction));
  return { refraction, axisToReflected, pattern: Math.sin(axisToReflected * DEG) ** 2 };
}

// --- Polarizadores -----------------------------------------------------------------------

/**
 * Ley de Malus: luz linealmente polarizada de intensidad I₀ que atraviesa un polarizador
 * ideal cuyo eje forma un ángulo θ con su polarización sale con I = I₀·cos² θ.
 * @param {number} intensity I₀
 * @param {number} angleDeg θ, en grados
 * @returns {number}
 */
export function malus(intensity, angleDeg) {
  return intensity * Math.cos(angleDeg * DEG) ** 2;
}

/**
 * Luz que atraviesa una serie de polarizadores ideales.
 *
 * Cada polarizador proyecta el campo eléctrico (un vector de dos componentes, el vector
 * de Jones) sobre su eje. La luz no polarizada se trata como la suma incoherente de dos
 * polarizaciones perpendiculares, cada una con la mitad de la intensidad.
 *
 * @param {number[]} axesDeg ángulo del eje de cada polarizador (grados), en el orden en que los cruza la luz
 * @param {{ input?: 'unpolarized' | number }} [options] luz de entrada: no polarizada (por
 *   defecto) o linealmente polarizada con ese ángulo (grados). Intensidad de entrada: 1.
 * @returns {number[]} intensidad después de cada polarizador (misma longitud que axesDeg)
 */
export function polarizerChain(axesDeg, { input = 'unpolarized' } = {}) {
  /** Estados de entrada: [Ex, Ey, peso]. @type {[number, number, number][]} */
  const states =
    input === 'unpolarized'
      ? [
          [1, 0, 0.5],
          [0, 1, 0.5],
        ]
      : [[Math.cos(input * DEG), Math.sin(input * DEG), 1]];
  const intensities = axesDeg.map(() => 0);
  for (const [x0, y0, weight] of states) {
    let ex = x0;
    let ey = y0;
    axesDeg.forEach((axis, i) => {
      const cos = Math.cos(axis * DEG);
      const sin = Math.sin(axis * DEG);
      const projection = ex * cos + ey * sin; // componente a lo largo del eje
      ex = projection * cos;
      ey = projection * sin;
      intensities[i] += weight * (ex * ex + ey * ey);
    });
  }
  return intensities;
}

/**
 * Luz no polarizada (la del cielo o el sol) reflejada en una superficie: la mitad de la
 * potencia va en cada polarización, así que se refleja (R_s + R_p)/2, y el reflejo queda
 * parcialmente polarizado con grado
 *   P = (R_s − R_p)/(R_s + R_p)
 * (0 = no polarizado, 1 = totalmente polarizado s, es decir, paralelo a la superficie).
 * @param {FresnelResult} result
 * @returns {{ reflectance: number, degree: number }}
 */
export function unpolarizedReflection(result) {
  const sum = result.Rs + result.Rp;
  return { reflectance: sum / 2, degree: sum > 0 ? (result.Rs - result.Rp) / sum : 0 };
}

/**
 * Cuánto reflejo llega al ojo con distintas gafas, como fracción de la luz (no polarizada)
 * que incide sobre la superficie. La superficie es horizontal (agua, carretera): la
 * polarización s del reflejo es horizontal y la p está en un plano vertical.
 *   sin gafas                       (R_s + R_p)/2
 *   gafas que solo atenúan (τ)      τ·(R_s + R_p)/2
 *   polarizador de eje vertical     R_p/2      (deja pasar la componente p y bloquea la s)
 * Un polarizador ideal deja pasar la mitad de la luz no polarizada del resto de la escena:
 * se compara con unas gafas grises de τ = 0,5, que oscurecen la escena lo mismo.
 * @param {FresnelResult} result
 * @param {number} [neutralTransmission] τ de las gafas que solo atenúan
 * @returns {{ bare: number, neutral: number, polarized: number, passedFraction: number }}
 *   passedFraction = fracción del reflejo que atraviesa el polarizador, R_p/(R_s + R_p)
 */
export function glareThroughGlasses(result, neutralTransmission = 0.5) {
  const sum = result.Rs + result.Rp;
  return {
    bare: sum / 2,
    neutral: (neutralTransmission * sum) / 2,
    polarized: result.Rp / 2,
    passedFraction: sum > 0 ? result.Rp / sum : 0,
  };
}
