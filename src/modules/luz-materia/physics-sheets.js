// @ts-check
// Luz y materia, parte B: láminas de dipolos. De dónde salen el índice de refracción, la
// onda reflejada y la transmitida.
//
// PROBLEMA (una dimensión, incidencia normal). Una onda plana E₀·e^{i(kz − ωt)}, polarizada
// en x, llega a N láminas delgadas paralelas, en z_j. Cada lámina es una capa de
// osciladores (dipolos) que el campo fuerza a oscilar; al oscilar, RADIA una onda plana
// hacia cada lado. No hay nada más: el campo en cualquier punto es
//
//   E(z) = E₀·e^{ikz} + Σ_j (onda radiada por la lámina j)
//
// CAMPO QUE RADIA UNA LÁMINA. Una lámina con polarización superficial P_s (momento dipolar
// por unidad de área) es una lámina de corriente K = ∂P_s/∂t = −iω·P_s, y una lámina de
// corriente radia hacia cada lado una onda plana E = −(μ₀c/2)·K, retardada (es el resultado
// de Feynman, vol. I, §30-7, para una lámina de cargas oscilantes). Con μ₀·c·ω = k/ε₀:
//
//   E_rad,j(z) = (i·k / 2ε₀) · P_s,j · e^{ik|z − z_j|}
//
// El factor i es toda la historia: la onda radiada va un cuarto de periodo DESFASADA
// respecto al movimiento de las cargas.
//
// RESPUESTA DE LA LÁMINA. P_s,j = η·α(ω)·E(z_j): densidad superficial de osciladores η,
// polarizabilidad de cada uno α(ω) (la del oscilador de Lorentz) y E(z_j) el campo TOTAL
// en la lámina. Si las láminas representan un material con N_v osciladores por unidad de
// volumen repartidos en capas separadas d, entonces η = N_v·d y N_v·α/ε₀ = χ(ω) = ε − 1,
// la susceptibilidad del modelo de Lorentz. Todo queda en un número sin dimensiones:
//
//   κ = k·η·α / (2ε₀) = (k·d/2)·χ(ω) = π·(d/λ₀)·χ(ω)        E_rad,j(z) = iκ·E_j·e^{ik|z − z_j|}
//
// SISTEMA AUTOCONSISTENTE. El campo en cada lámina es el incidente más el radiado por
// TODAS las láminas (E_j ≡ E(z_j)):
//
//   E_i − iκ·Σ_j e^{ik|z_i − z_j|}·E_j = E₀·e^{ik·z_i}          (N ecuaciones complejas)
//
// El término j = i es el campo que la lámina radia sobre sí misma (iκ·E_i): va en
// cuadratura con su polarización, así que no cambia su frecuencia propia; es el frenado
// por radiación del conjunto de dipolos de la lámina. No se puede quitar: sin él no se
// conserva la energía (con una sola lámina sin pérdidas saldría R + T = 1 + 2κ²). Dicho de
// otro modo: «el campo que fuerza a cada lámina es el incidente más el de las demás», con
// una lámina cuya respuesta ya incluye su propio frenado por radiación, κ/(1 − iκ).
//
// CAMPO LOCAL. En un sólido de dipolos puntuales el campo que actúa sobre cada dipolo no
// es el campo medio: hay que añadir el de los vecinos cercanos, P/(3ε₀) (corrección de
// Lorentz, que lleva a la fórmula de Clausius-Mossotti). AQUÍ ESA CORRECCIÓN NO APARECE:
// cada lámina es continua y está polarizada en su propio plano, y una lámina uniforme así
// no crea más campo que su onda plana (factor de despolarización nulo). Por eso el límite
// continuo es ε = 1 + N_v·α/ε₀ exactamente. Lo que sí aparece al separar las láminas es
// una corrección por ser discretas (ver blochIndex): n² = ε + (k·d)²·(ε − 1)²/12 + …
//
// UNIDADES: las posiciones van en longitudes de onda del vacío (z/λ₀), así que k·z = 2π·z.
// Los campos van divididos por E₀. CONVENIO: e^{−iωt}.
//
// Referencias: Feynman, Lectures on Physics, vol. I, §30-7 y cap. 31; Griffiths,
// Introduction to Electrodynamics, 4.ª ed., cap. 9 y §11.1; Born & Wolf, Principles of
// Optics, §1.6 (matriz característica de una capa) y §2.4 (teorema de extinción).

import { ONE, ZERO, abs2, add, complex, conj, div, exp, log, mul, scale, sqrt, sub } from '../../core/complex.js';
import { solveComplexDense } from '../../core/linalg.js';

/** @typedef {import('../../core/complex.js').Complex} Complex */

const TWO_PI = 2 * Math.PI;

/** e^{i·2π·x} con x real. @param {number} x @returns {Complex} */
function phase(x) {
  return { re: Math.cos(TWO_PI * x), im: Math.sin(TWO_PI * x) };
}

/**
 * Fuerza de una lámina: κ = π·(d/λ₀)·χ, con χ = ε − 1 la susceptibilidad del material que
 * las láminas representan.
 * @param {Complex} chi susceptibilidad χ(ω) = ε(ω) − 1
 * @param {number} spacing separación entre láminas, d/λ₀
 * @returns {Complex}
 */
export function sheetStrength(chi, spacing) {
  return scale(chi, Math.PI * spacing);
}

/**
 * Posiciones de las láminas, z_j/λ₀ = (j + ½)·d/λ₀: cada lámina está en el centro de la
 * rebanada de material que representa, de modo que N láminas ocupan el intervalo [0, N·d].
 * @param {number} count número de láminas
 * @param {number} spacing d/λ₀
 * @returns {Float64Array}
 */
export function sheetPositions(count, spacing) {
  return Float64Array.from({ length: count }, (_, j) => (j + 0.5) * spacing);
}

/**
 * Una lámina sola (solución analítica del sistema con N = 1):
 *   E₁ = E₀/(1 − iκ),   r = iκ/(1 − iκ),   t = 1/(1 − iκ) = 1 + r
 * @param {Complex} kappa
 * @returns {{ r: Complex, t: Complex }}
 */
export function singleSheet(kappa) {
  const denominator = sub(ONE, mul({ re: 0, im: 1 }, kappa)); // 1 − iκ
  const t = div(ONE, denominator);
  return { r: sub(t, ONE), t };
}

/**
 * Solución del problema de las láminas.
 * @typedef {object} SheetSolution
 * @property {Complex} kappa fuerza de cada lámina
 * @property {Float64Array} positions z_j/λ₀ de las láminas (activas)
 * @property {Complex[]} fields campo total en cada lámina, E_j/E₀
 * @property {Complex} r amplitud reflejada: delante de las láminas, E = e^{ikz} + r·e^{−ikz}
 * @property {Complex} t amplitud transmitida RESPECTO A LA ONDA INCIDENTE EN EL MISMO PUNTO:
 *   detrás de las láminas, E = t·e^{ikz}. Sin láminas, t = 1.
 * @property {number} R |r|²
 * @property {number} T |t|²
 * @property {Float64Array} absorbed fracción de la potencia incidente que absorbe cada lámina
 * @property {number} A absorción total, Σ absorbed
 */

/**
 * Deduce r, t y el balance de energía a partir del campo en cada lámina.
 * @param {Complex} kappa
 * @param {Float64Array} positions
 * @param {Complex[]} fields
 * @returns {SheetSolution}
 */
function assemble(kappa, positions, fields) {
  const iKappa = mul({ re: 0, im: 1 }, kappa);
  let backward = ZERO; // Σ E_j·e^{+ik·z_j}: lo que llega hacia atrás
  let forward = ZERO; // Σ E_j·e^{−ik·z_j}: lo que llega hacia delante, referido a e^{ikz}
  const absorbed = new Float64Array(fields.length);
  let total = 0;
  fields.forEach((field, j) => {
    backward = add(backward, mul(field, phase(positions[j])));
    forward = add(forward, mul(field, phase(-positions[j])));
    // Potencia que la lámina j quita al campo y no devuelve como radiación: 2·Im κ·|E_j|²
    // (en unidades de la potencia incidente). Con κ real (sin pérdidas) es cero.
    absorbed[j] = 2 * kappa.im * abs2(field);
    total += absorbed[j];
  });
  const r = mul(iKappa, backward);
  const t = add(ONE, mul(iKappa, forward));
  return { kappa, positions, fields, r, t, R: abs2(r), T: abs2(t), absorbed, A: total };
}

/**
 * Resuelve las láminas de forma autoconsistente: sistema lineal complejo N × N
 *   (δ_ij − iκ·e^{ik|z_i − z_j|})·E_j = e^{ik·z_i}.
 * Las posiciones pueden ser cualesquiera (no hace falta que estén equiespaciadas).
 * @param {Complex} kappa fuerza de cada lámina (sheetStrength)
 * @param {ArrayLike<number>} positions z_j/λ₀
 * @returns {SheetSolution}
 */
export function solveSheets(kappa, positions) {
  const zs = Float64Array.from(positions);
  const count = zs.length;
  if (count === 0) return assemble(kappa, zs, []);
  const iKappa = mul({ re: 0, im: 1 }, kappa);
  /** @type {Complex[][]} */
  const matrix = [];
  /** @type {Complex[]} */
  const rhs = [];
  for (let i = 0; i < count; i++) {
    /** @type {Complex[]} */
    const row = [];
    for (let j = 0; j < count; j++) {
      const coupling = mul(iKappa, phase(Math.abs(zs[i] - zs[j])));
      row.push(i === j ? sub(ONE, coupling) : scale(coupling, -1));
    }
    matrix.push(row);
    rhs.push(phase(zs[i]));
  }
  return assemble(kappa, zs, solveComplexDense(matrix, rhs));
}

/**
 * La misma solución por otro camino (coste N en vez de N³), para comprobar la anterior y
 * para montones de láminas muy grandes: se recorre el montón de atrás hacia delante.
 * Detrás de la última lámina solo hay onda hacia delante; al cruzar cada lámina hacia la
 * izquierda, el campo es continuo y las amplitudes de las ondas hacia delante (a) y hacia
 * atrás (b) cambian en lo que la lámina radia:
 *   E_j = a·e^{ik·z_j} + b·e^{−ik·z_j},   a ← a − iκ·E_j·e^{−ik·z_j},   b ← b + iκ·E_j·e^{ik·z_j}
 * Al llegar delante, a es la onda incidente: se divide todo por ella.
 * Las posiciones deben ser crecientes.
 * @param {Complex} kappa
 * @param {ArrayLike<number>} positions z_j/λ₀, crecientes
 * @returns {SheetSolution}
 */
export function solveSheetsMarching(kappa, positions) {
  const zs = Float64Array.from(positions);
  const iKappa = mul({ re: 0, im: 1 }, kappa);
  let a = ONE;
  let b = ZERO;
  /** @type {Complex[]} */
  const fields = new Array(zs.length);
  for (let j = zs.length - 1; j >= 0; j--) {
    const field = add(mul(a, phase(zs[j])), mul(b, phase(-zs[j])));
    fields[j] = field;
    a = sub(a, mul(mul(iKappa, field), phase(-zs[j])));
    b = add(b, mul(mul(iKappa, field), phase(zs[j])));
  }
  return assemble(kappa, zs, fields.map((field) => div(field, a)));
}

/**
 * Onda que radia una lámina, en los puntos zs: iκ·E_j·e^{ik|z − z_j|} (dividida por E₀).
 * El campo físico en el instante t es Re[F(z)·e^{−iωt}] = re·cos ωt + im·sen ωt.
 * @param {SheetSolution} solution
 * @param {number} index lámina
 * @param {ArrayLike<number>} zs posiciones z/λ₀
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function sheetWave(solution, index, zs) {
  const amplitude = mul(mul({ re: 0, im: 1 }, solution.kappa), solution.fields[index]);
  const zj = solution.positions[index];
  const re = new Float64Array(zs.length);
  const im = new Float64Array(zs.length);
  for (let i = 0; i < zs.length; i++) {
    const p = phase(Math.abs(zs[i] - zj));
    re[i] = amplitude.re * p.re - amplitude.im * p.im;
    im[i] = amplitude.re * p.im + amplitude.im * p.re;
  }
  return { re, im };
}

/**
 * Campos en los puntos zs: la onda incidente, la suma de las radiadas por todas las
 * láminas y el campo total (incidente + radiadas). Todo dividido por E₀.
 * @param {SheetSolution} solution
 * @param {ArrayLike<number>} zs posiciones z/λ₀
 */
export function fieldProfile(solution, zs) {
  const count = zs.length;
  const incident = { re: new Float64Array(count), im: new Float64Array(count) };
  const radiated = { re: new Float64Array(count), im: new Float64Array(count) };
  const total = { re: new Float64Array(count), im: new Float64Array(count) };
  for (let i = 0; i < count; i++) {
    const p = phase(zs[i]);
    incident.re[i] = p.re;
    incident.im[i] = p.im;
  }
  for (let j = 0; j < solution.fields.length; j++) {
    const wave = sheetWave(solution, j, zs);
    for (let i = 0; i < count; i++) {
      radiated.re[i] += wave.re[i];
      radiated.im[i] += wave.im[i];
    }
  }
  for (let i = 0; i < count; i++) {
    total.re[i] = incident.re[i] + radiated.re[i];
    total.im[i] = incident.im[i] + radiated.im[i];
  }
  return { incident, radiated, total };
}

/**
 * Cómo se construye la onda transmitida, lámina a lámina (diagrama de fasores). Detrás del
 * material, y dividido todo por la onda incidente en ese punto, el campo es
 *   t = 1 + Σ_j c_j,   c_j = iκ·E_j·e^{−ik·z_j}
 * Devuelve las sumas parciales: [1, 1 + c₀, 1 + c₀ + c₁, …, t] (N + 1 complejos).
 * En un material transparente cada c_j es casi perpendicular al fasor que ya había: la
 * suma GIRA (retraso de fase: índice n > 1) sin cambiar apenas de tamaño.
 * @param {SheetSolution} solution
 * @returns {Complex[]}
 */
export function transmissionPhasors(solution) {
  const iKappa = mul({ re: 0, im: 1 }, solution.kappa);
  /** @type {Complex[]} */
  const partial = [ONE];
  solution.fields.forEach((field, j) => {
    const contribution = mul(mul(iKappa, field), phase(-solution.positions[j]));
    partial.push(add(partial[j], contribution));
  });
  return partial;
}

/**
 * Lo mismo para la onda reflejada: r = Σ_j iκ·E_j·e^{+ik·z_j}. Devuelve [0, …, r].
 * @param {SheetSolution} solution
 * @returns {Complex[]}
 */
export function reflectionPhasors(solution) {
  const iKappa = mul({ re: 0, im: 1 }, solution.kappa);
  /** @type {Complex[]} */
  const partial = [ZERO];
  solution.fields.forEach((field, j) => {
    const contribution = mul(mul(iKappa, field), phase(solution.positions[j]));
    partial.push(add(partial[j], contribution));
  });
  return partial;
}

// --- Qué onda viaja por un montón periódico de láminas -------------------------------------

/**
 * Arco coseno complejo, acos(c) = −i·ln(c + i·√(1 − c²)), con la parte real en [0, π].
 * @param {Complex} c
 * @returns {Complex}
 */
function complexAcos(c) {
  const root = sqrt(sub(ONE, mul(c, c)));
  const w = add(c, mul({ re: 0, im: 1 }, root));
  const ln = log(w);
  return { re: ln.im, im: -ln.re };
}

/**
 * Elige, entre q y −q, la onda que avanza hacia +z: la que se atenúa (Im q > 0) o, si no
 * hay atenuación, la de Re q ≥ 0.
 * @param {Complex} qd
 * @returns {Complex}
 */
function forwardWave(qd) {
  const tiny = 1e-14;
  if (qd.im < -tiny || (Math.abs(qd.im) <= tiny && qd.re < 0)) return scale(qd, -1);
  return qd;
}

/**
 * Índice efectivo EXACTO de un montón infinito de láminas iguales separadas d. Una onda
 * que avanza por él multiplica el campo por e^{iqd} de una lámina a la siguiente, con
 *
 *   cos(q·d) = cos(k·d) − κ·sen(k·d)
 *
 * (condición de Bloch; es la de Kronig-Penney para la luz). n_ef = q/k. Para k·d ≪ 1:
 *   n_ef² = ε + (k·d)²·(ε − 1)²/12 + O((k·d)⁴)
 * de modo que n_ef → √ε al juntar las láminas: sin corrección de campo local (ver la
 * cabecera del archivo) y con una corrección de discretización de segundo orden.
 * Vale mientras Re(q)·d < π (por debajo de la primera reflexión de Bragg).
 * @param {Complex} kappa fuerza de cada lámina
 * @param {number} spacing d/λ₀
 * @returns {Complex} n_ef = n + ik
 */
export function blochIndex(kappa, spacing) {
  const kd = TWO_PI * spacing;
  const c = sub(complex(Math.cos(kd)), scale(kappa, Math.sin(kd)));
  return scale(forwardWave(complexAcos(c)), 1 / kd);
}

/**
 * Índice ajustado a partir del campo total en las láminas («medir λ dentro»).
 *
 * Dentro del montón el campo en las láminas es una suma de la onda que avanza y la que
 * vuelve del fondo, E_j = A·e^{iq·z_j} + B·e^{−iq·z_j}, y cualquier suma así cumple
 *   E_{j+1} + E_{j−1} = 2·cos(q·d)·E_j
 * Se ajusta cos(q·d) por mínimos cuadrados con todas las láminas interiores y se devuelve
 * n = q/k. La longitud de onda dentro del material es λ₀/Re n.
 * @param {Complex[]} fields campo total en láminas equiespaciadas (al menos 3)
 * @param {number} spacing d/λ₀
 * @returns {Complex} n ajustado
 */
export function fitIndex(fields, spacing) {
  if (fields.length < 3) throw new RangeError('fitIndex: hacen falta al menos tres láminas');
  let numerator = ZERO;
  let denominator = 0;
  for (let j = 1; j < fields.length - 1; j++) {
    numerator = add(numerator, mul(conj(fields[j]), add(fields[j + 1], fields[j - 1])));
    denominator += abs2(fields[j]);
  }
  const c = scale(numerator, 1 / (2 * denominator));
  return scale(forwardWave(complexAcos(c)), 1 / (TWO_PI * spacing));
}

// --- El medio continuo equivalente: matriz de transferencia -----------------------------------

/**
 * Matriz característica (de transferencia) de una capa homogénea de índice n y espesor L,
 * en incidencia normal (Born & Wolf, §1.6): relaciona (E, H·Z₀) en sus dos caras.
 *   M = [[cos β, −(i/n)·sen β], [−i·n·sen β, cos β]],   β = 2π·n·L/λ₀
 * La matriz de varias capas seguidas es el producto de las de cada una.
 * @param {Complex} n índice complejo de la capa
 * @param {number} thickness L/λ₀
 * @returns {[[Complex, Complex], [Complex, Complex]]}
 */
export function layerMatrix(n, thickness) {
  const beta = scale(n, TWO_PI * thickness);
  const plus = exp(mul({ re: 0, im: 1 }, beta)); // e^{iβ}
  const minus = exp(mul({ re: 0, im: -1 }, beta)); // e^{−iβ}
  const cos = scale(add(plus, minus), 0.5);
  const sin = mul(scale(sub(plus, minus), 0.5), { re: 0, im: -1 }); // (e^{iβ} − e^{−iβ})/(2i)
  const minusI = { re: 0, im: -1 };
  return [
    [cos, div(mul(minusI, sin), n)],
    [mul(mul(minusI, n), sin), cos],
  ];
}

/**
 * Reflexión y transmisión de una lámina continua de índice n y espesor L, con vacío a los
 * dos lados, en incidencia normal. Con M = layerMatrix:
 *   r = (m₁₁ + m₁₂ − m₂₁ − m₂₂)/S,   t_BW = 2/S,   S = m₁₁ + m₁₂ + m₂₁ + m₂₂
 * (Born & Wolf, §1.6). t_BW es el campo justo detrás de la lámina dividido por el campo
 * incidente en la cara de entrada; aquí se devuelve t con el mismo convenio que
 * SheetSolution (respecto a la onda incidente en el mismo punto): t = t_BW·e^{−ikL}.
 * @param {Complex} n índice complejo
 * @param {number} thickness L/λ₀
 * @returns {{ r: Complex, t: Complex, R: number, T: number }}
 */
export function slabCoefficients(n, thickness) {
  const [[m11, m12], [m21, m22]] = layerMatrix(n, thickness);
  const upper = add(m11, m12);
  const lower = add(m21, m22);
  const sum = add(upper, lower);
  const r = div(sub(upper, lower), sum);
  const t = mul(div(complex(2), sum), phase(-thickness));
  return { r, t, R: abs2(r), T: abs2(t) };
}
