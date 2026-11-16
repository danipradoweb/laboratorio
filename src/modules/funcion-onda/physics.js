// @ts-check
// Función de onda: ecuación de Schrödinger 1D dependiente del tiempo.
//
//   iħ·∂ψ/∂t = −(ħ²/2m)·∂²ψ/∂x² + V(x)·ψ
//
// UNIDADES de todo el módulo: posiciones en nm, tiempos en fs, energías en eV, números de
// onda k en nm⁻¹ y masas en masas del electrón. En estas unidades
//   ħ = 0,6582 eV·fs      y      ħ²/2mₑ = 0,0381 eV·nm²,
// que aquí se calculan a partir de las constantes de src/core/units.js (no se teclean).
// El momento se da como p = ħk: la vista muestra k (nm⁻¹), que es p/ħ.
//
// MÉTODO (paso partido de Fourier, simétrico o de Strang): en cada paso Δt
//   ψ ← e^{−iVΔt/2ħ} · F⁻¹[ e^{−iT(k)Δt/ħ} · F[ e^{−iVΔt/2ħ} · ψ ] ]
// con T(k) = ħ²k²/2m la energía cinética, que es diagonal en el espacio de momentos (F es
// la FFT). Cada factor es una fase: el método conserva la norma exactamente (salvo
// redondeo) y su error es O(Δt²) por la no conmutación de T y V. La malla es periódica:
// lo que sale por un borde entra por el otro, salvo que se active el potencial absorbente.
//
// POTENCIAL ABSORBENTE (opcional): se añade −i·W(x) cerca de los bordes, con W ≥ 0 y
// creciendo como el cuadrado de la distancia al interior. El factor e^{−WΔt/2ħ} va
// apagando lo que llega a los bordes: simula un espacio abierto. Con él la norma ya no se
// conserva (lo que se absorbe «ha salido» de la región simulada).
//
// CINÉTICA EN DIFERENCIAS FINITAS (opción kinetic: 'fd'): T(k) = (ħ²/m·Δx²)(1 − cos kΔx),
// que es la que corresponde al laplaciano de tres puntos. Con ella el propagador evoluciona
// con el mismo hamiltoniano tridiagonal que diagonaliza physics-states.js; se usa para
// comprobar que un estado propio es estacionario.
//
// Referencias: Griffiths, Introduction to Quantum Mechanics (3.ª ed.), caps. 1 y 2 (ψ,
// valores esperados, paquete gaussiano libre, escalón, barrera, pozos); Levine, Quantum
// Chemistry, caps. 1–4; Feynman Lectures vol. III caps. 1–3 y 7. El método de paso partido:
// M. D. Feit, J. A. Fleck y A. Steiger, J. Comput. Phys. 47 (1982) 412.

import { EV, HBAR, M_E, NM } from '../../core/units.js';
import { fft, ifft, fftfreq } from '../../core/fft.js';

/** ħ en eV·fs (≈ 0,6582). */
export const HBAR_EV_FS = (HBAR / EV) * 1e15;

/**
 * ħ²/2m en eV·nm² para una masa dada en masas del electrón (≈ 0,0381 eV·nm² para mₑ).
 * @param {number} [mass] masa en unidades de mₑ
 */
export function kineticCoefficient(mass = 1) {
  return (HBAR * HBAR) / (2 * mass * M_E) / EV / (NM * NM);
}

/**
 * @typedef {{ re: Float64Array, im: Float64Array }} Wave
 */

/**
 * Malla periódica de n puntos (potencia de 2) en [xMin, xMax): x_j = xMin + j·Δx.
 * `k` son los números de onda de la FFT en su orden natural (0, Δk, …, −Δk).
 * @param {number} n
 * @param {number} xMin
 * @param {number} xMax
 */
export function createGrid(n, xMin, xMax) {
  const dx = (xMax - xMin) / n;
  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) x[j] = xMin + j * dx;
  const k = fftfreq(n, dx).map((f) => 2 * Math.PI * f);
  return { n, xMin, xMax, dx, x, k: Float64Array.from(k), dk: (2 * Math.PI) / (n * dx) };
}

/** @typedef {ReturnType<typeof createGrid>} Grid */

/**
 * Paquete gaussiano normalizado de anchura σ (desviación típica de |ψ|²), centrado en x₀
 * y con número de onda medio k₀:
 *   ψ(x) = (2πσ²)^{−1/4} · exp(−(x − x₀)²/4σ² + i·k₀·x)
 * Cumple Δx = σ, Δk = 1/(2σ), Δx·Δp = ħ/2 (el mínimo que permite la incertidumbre).
 * @param {Grid} grid
 * @param {{ x0: number, sigma: number, k0: number }} packet
 * @returns {Wave}
 */
export function gaussianPacket(grid, { x0, sigma, k0 }) {
  const re = new Float64Array(grid.n);
  const im = new Float64Array(grid.n);
  const amp = Math.pow(2 * Math.PI * sigma * sigma, -0.25);
  for (let j = 0; j < grid.n; j++) {
    const x = grid.x[j];
    const envelope = amp * Math.exp(-((x - x0) ** 2) / (4 * sigma * sigma));
    re[j] = envelope * Math.cos(k0 * x);
    im[j] = envelope * Math.sin(k0 * x);
  }
  return { re, im };
}

/**
 * Anchura de un paquete gaussiano libre con el tiempo (Griffiths, problema 2.21):
 *   σ(t) = σ₀·√(1 + (ħt/2mσ₀²)²)
 * @param {number} sigma0 nm
 * @param {number} t fs
 * @param {number} [mass] en mₑ
 */
export function freeGaussianWidth(sigma0, t, mass = 1) {
  const tau = (2 * sigma0 * sigma0 * HBAR_EV_FS) / (2 * kineticCoefficient(mass)); // 2mσ₀²/ħ en fs
  return sigma0 * Math.sqrt(1 + (t / tau) ** 2);
}

/**
 * Número de onda de una partícula libre de energía cinética E: k = √(2mE)/ħ.
 * @param {number} energy eV
 * @param {number} [mass]
 */
export function waveNumberFromEnergy(energy, mass = 1) {
  return Math.sqrt(Math.max(0, energy) / kineticCoefficient(mass));
}

/**
 * Energía media de un paquete gaussiano libre: ⟨T⟩ = (ħ²/2m)(k₀² + 1/4σ²).
 * @param {number} k0
 * @param {number} sigma
 * @param {number} [mass]
 */
export function gaussianMeanEnergy(k0, sigma, mass = 1) {
  return kineticCoefficient(mass) * (k0 * k0 + 1 / (4 * sigma * sigma));
}

// --- Potenciales ------------------------------------------------------------------------

/**
 * Descripción de un potencial. Posiciones en nm, energías en eV.
 *   'libre'          V = 0
 *   'escalon'        V = height para x ≥ center
 *   'barrera'        V = height en una franja de anchura `width` centrada en `center`
 *   'doble-barrera'  dos barreras de anchura `width` y altura `height` separadas `separation`
 *                    (distancia entre sus caras interiores), centradas en `center`
 *   'pozo-finito'    V = −height en una franja de anchura `width` (0 fuera)
 *   'pozo-infinito'  V = 0 dentro de una franja de anchura `width`, `wall` fuera (paredes muy altas)
 *   'armonico'       V = ½mω²(x − center)², con ħω = `quantum` (eV)
 *   'dibujado'       columnas de anchura `width`/columns.length y alturas `columns` (eV),
 *                    centradas en `center`; V = 0 fuera
 * @typedef {object} PotentialSpec
 * @property {'libre' | 'escalon' | 'barrera' | 'doble-barrera' | 'pozo-finito' | 'pozo-infinito' | 'armonico' | 'dibujado'} type
 * @property {number} [center]
 * @property {number} [height]
 * @property {number} [width]
 * @property {number} [separation]
 * @property {number} [quantum] ħω del oscilador armónico (eV)
 * @property {number} [wall] altura de las paredes del pozo «infinito» (eV)
 * @property {number[]} [columns] alturas de las columnas del potencial dibujado (eV)
 * @property {number} [mass] masa (mₑ), solo para el armónico
 */

/** Altura por defecto de las paredes del pozo «infinito» (eV). */
export const DEFAULT_WALL = 1000;

/**
 * Potenciales constantes a trozos: fronteras x_1 < … < x_M y valores V_0 … V_M (V_0 a la
 * izquierda de x_1, V_M a la derecha de x_M). Devuelve null para el armónico (no lo es).
 * @param {PotentialSpec} spec
 * @returns {{ edges: number[], values: number[] } | null}
 */
export function potentialSegments(spec) {
  const c = spec.center ?? 0;
  const h = spec.height ?? 0;
  const w = spec.width ?? 1;
  switch (spec.type) {
    case 'libre':
      return { edges: [], values: [0] };
    case 'escalon':
      return { edges: [c], values: [0, h] };
    case 'barrera':
      return { edges: [c - w / 2, c + w / 2], values: [0, h, 0] };
    case 'doble-barrera': {
      const s = spec.separation ?? 1;
      return {
        edges: [c - s / 2 - w, c - s / 2, c + s / 2, c + s / 2 + w],
        values: [0, h, 0, h, 0],
      };
    }
    case 'pozo-finito':
      return { edges: [c - w / 2, c + w / 2], values: [0, -h, 0] };
    case 'pozo-infinito': {
      const wall = spec.wall ?? DEFAULT_WALL;
      return { edges: [c - w / 2, c + w / 2], values: [wall, 0, wall] };
    }
    case 'dibujado': {
      const cols = spec.columns ?? [];
      if (cols.length === 0) return { edges: [], values: [0] };
      const colWidth = w / cols.length;
      const edges = [];
      for (let j = 0; j <= cols.length; j++) edges.push(c - w / 2 + j * colWidth);
      return { edges, values: [0, ...cols, 0] };
    }
    case 'armonico':
      return null;
    default:
      throw new RangeError(`Potencial desconocido: "${/** @type {any} */ (spec).type}"`);
  }
}

/**
 * Como potentialSegments, pero falla si el potencial no es constante a trozos (armónico).
 * @param {PotentialSpec} spec
 * @returns {{ edges: number[], values: number[] }}
 */
export function segmentsOf(spec) {
  const seg = potentialSegments(spec);
  if (!seg) throw new RangeError(`El potencial "${spec.type}" no es constante a trozos`);
  return seg;
}

/**
 * Valor del potencial en x (eV).
 * @param {PotentialSpec} spec
 * @param {number} x
 */
export function potentialAt(spec, x) {
  if (spec.type === 'armonico') {
    const q = spec.quantum ?? 0.1;
    const d = x - (spec.center ?? 0);
    // ½mω²d² = (ħω)²·d² / (4·ħ²/2m)
    return (q * q * d * d) / (4 * kineticCoefficient(spec.mass ?? 1));
  }
  const seg = segmentsOf(spec);
  let i = 0;
  while (i < seg.edges.length && x >= seg.edges[i]) i++;
  return seg.values[i];
}

/**
 * Potencial muestreado en la malla.
 * @param {Grid} grid
 * @param {PotentialSpec} spec
 */
export function potentialOnGrid(grid, spec) {
  return grid.x.map((x) => potentialAt(spec, x));
}

/**
 * Potencial absorbente W(x) ≥ 0 (eV) en dos franjas de anchura `width` junto a los bordes
 * de la malla: W = strength·(d/width)², con d lo que se ha entrado en la franja.
 * @param {Grid} grid
 * @param {{ width: number, strength: number }} options
 */
export function absorbingPotential(grid, { width, strength }) {
  const w = new Float64Array(grid.n);
  const left = grid.xMin + width;
  const right = grid.xMax - grid.dx - width;
  for (let j = 0; j < grid.n; j++) {
    const x = grid.x[j];
    const d = x < left ? left - x : x > right ? x - right : 0;
    w[j] = strength * (d / width) ** 2;
  }
  return w;
}

// --- Propagador -------------------------------------------------------------------------

/**
 * Prepara el propagador de paso partido para una malla, un potencial y un paso Δt.
 * @param {Grid} grid
 * @param {ArrayLike<number>} potential V en la malla (eV)
 * @param {{ dt: number, mass?: number, absorber?: ArrayLike<number> | null, kinetic?: 'exact' | 'fd' }} options
 *   dt en fs; absorber: W(x) en eV (potencial −iW), o null
 */
export function createPropagator(grid, potential, { dt, mass = 1, absorber = null, kinetic = 'exact' }) {
  const n = grid.n;
  const a = kineticCoefficient(mass);
  // Medio paso de potencial: e^{−i·V·Δt/2ħ}·e^{−W·Δt/2ħ}.
  const halfRe = new Float64Array(n);
  const halfIm = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const phase = (-potential[j] * dt) / (2 * HBAR_EV_FS);
    const damp = absorber ? Math.exp((-absorber[j] * dt) / (2 * HBAR_EV_FS)) : 1;
    halfRe[j] = damp * Math.cos(phase);
    halfIm[j] = damp * Math.sin(phase);
  }
  // Paso completo de cinética en el espacio de momentos.
  const kinRe = new Float64Array(n);
  const kinIm = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const k = grid.k[j];
    const T = kinetic === 'fd' ? ((2 * a) / (grid.dx * grid.dx)) * (1 - Math.cos(k * grid.dx)) : a * k * k;
    const phase = (-T * dt) / HBAR_EV_FS;
    kinRe[j] = Math.cos(phase);
    kinIm[j] = Math.sin(phase);
  }
  return { grid, dt, mass, halfRe, halfIm, kinRe, kinIm };
}

/** @typedef {ReturnType<typeof createPropagator>} Propagator */

/**
 * Multiplica en el sitio a por el factor complejo (fr, fi) punto a punto.
 * @param {Float64Array} re @param {Float64Array} im @param {Float64Array} fr @param {Float64Array} fi
 */
function multiplyInPlace(re, im, fr, fi) {
  for (let j = 0; j < re.length; j++) {
    const r = re[j] * fr[j] - im[j] * fi[j];
    im[j] = re[j] * fi[j] + im[j] * fr[j];
    re[j] = r;
  }
}

/**
 * Avanza ψ `steps` pasos de tiempo. Devuelve una onda nueva (no modifica la entrada).
 * @param {Propagator} prop
 * @param {Wave} psi
 * @param {number} [steps]
 * @returns {Wave}
 */
export function evolve(prop, psi, steps = 1) {
  /** @type {Float64Array} */
  let re = Float64Array.from(psi.re);
  /** @type {Float64Array} */
  let im = Float64Array.from(psi.im);
  for (let s = 0; s < steps; s++) {
    multiplyInPlace(re, im, prop.halfRe, prop.halfIm);
    const f = fft(re, im);
    multiplyInPlace(f.re, f.im, prop.kinRe, prop.kinIm);
    const b = ifft(f.re, f.im);
    re = b.re;
    im = b.im;
    multiplyInPlace(re, im, prop.halfRe, prop.halfIm);
  }
  return { re, im };
}

// --- Observables ------------------------------------------------------------------------

/**
 * Multiplica ψ por una fase global e^{iφ}. No cambia nada observable.
 * @param {Wave} psi
 * @param {number} phi radianes
 * @returns {Wave}
 */
export function applyGlobalPhase(psi, phi) {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const re = new Float64Array(psi.re.length);
  const im = new Float64Array(psi.re.length);
  for (let j = 0; j < re.length; j++) {
    re[j] = c * psi.re[j] - s * psi.im[j];
    im[j] = s * psi.re[j] + c * psi.im[j];
  }
  return { re, im };
}

/**
 * Densidad de probabilidad |ψ|² (nm⁻¹).
 * @param {Wave} psi
 */
export function probabilityDensity(psi) {
  return psi.re.map((r, j) => r * r + psi.im[j] * psi.im[j]);
}

/**
 * Norma ∫|ψ|²dx (regla de los rectángulos, exacta para funciones de banda limitada en la
 * malla periódica).
 * @param {Grid} grid
 * @param {Wave} psi
 */
export function normOf(grid, psi) {
  let s = 0;
  for (let j = 0; j < grid.n; j++) s += psi.re[j] * psi.re[j] + psi.im[j] * psi.im[j];
  return s * grid.dx;
}

/**
 * Función de onda en el espacio de momentos, φ(k) = (2π)^{−1/2}∫ψ(x)e^{−ikx}dx, ordenada
 * de k negativo a positivo. ∫|φ|²dk = ∫|ψ|²dx (Parseval).
 * @param {Grid} grid
 * @param {Wave} psi
 * @returns {{ k: Float64Array, re: Float64Array, im: Float64Array, density: Float64Array }}
 */
export function momentumWave(grid, psi) {
  const n = grid.n;
  const f = fft(psi.re, psi.im);
  const scale = grid.dx / Math.sqrt(2 * Math.PI);
  const k = new Float64Array(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const density = new Float64Array(n);
  const half = n / 2;
  for (let m = 0; m < n; m++) {
    const j = (m + half) % n; // fftshift: primero los k negativos
    const kj = grid.k[j];
    // e^{−ik·xMin}: la malla no empieza en x = 0.
    const c = Math.cos(-kj * grid.xMin);
    const s = Math.sin(-kj * grid.xMin);
    const fr = f.re[j] * c - f.im[j] * s;
    const fi = f.re[j] * s + f.im[j] * c;
    k[m] = kj;
    re[m] = scale * fr;
    im[m] = scale * fi;
    density[m] = re[m] * re[m] + im[m] * im[m];
  }
  return { k, re, im, density };
}

/**
 * Valores esperados. Las medias se dividen por la norma (por si el potencial absorbente
 * se ha llevado parte de ψ). ⟨k⟩ y Δk salen del espacio de momentos; ⟨p⟩ = ħ⟨k⟩.
 * @param {Grid} grid
 * @param {Wave} psi
 * @returns {{ norm: number, x: number, sigmaX: number, k: number, sigmaK: number, uncertainty: number }}
 *   uncertainty = Δx·Δk = Δx·Δp/ħ (≥ ½)
 */
export function expectationValues(grid, psi) {
  let n0 = 0;
  let sx = 0;
  let sx2 = 0;
  for (let j = 0; j < grid.n; j++) {
    const p = psi.re[j] * psi.re[j] + psi.im[j] * psi.im[j];
    n0 += p;
    sx += p * grid.x[j];
    sx2 += p * grid.x[j] * grid.x[j];
  }
  const x = sx / n0;
  const sigmaX = Math.sqrt(Math.max(0, sx2 / n0 - x * x));
  const mom = momentumWave(grid, psi);
  let m0 = 0;
  let sk = 0;
  let sk2 = 0;
  for (let j = 0; j < grid.n; j++) {
    m0 += mom.density[j];
    sk += mom.density[j] * mom.k[j];
    sk2 += mom.density[j] * mom.k[j] * mom.k[j];
  }
  const k = sk / m0;
  const sigmaK = Math.sqrt(Math.max(0, sk2 / m0 - k * k));
  return { norm: n0 * grid.dx, x, sigmaX, k, sigmaK, uncertainty: sigmaX * sigmaK };
}

/**
 * Probabilidad de encontrar la partícula a la derecha de xCut: ∫_{x > xCut}|ψ|²dx.
 * @param {Grid} grid
 * @param {Wave} psi
 * @param {number} xCut
 */
export function probabilityRightOf(grid, psi, xCut) {
  let s = 0;
  for (let j = 0; j < grid.n; j++) {
    if (grid.x[j] > xCut) s += psi.re[j] * psi.re[j] + psi.im[j] * psi.im[j];
  }
  return s * grid.dx;
}

// --- Transmisión estacionaria (ondas planas) --------------------------------------------

/**
 * Transmisión de una barrera rectangular de altura V₀ y anchura a para una partícula de
 * energía E (Griffiths, problema 2.33):
 *   E < V₀:  T = [1 + V₀²·senh²(κa) / (4E(V₀ − E))]⁻¹,  κ = √(2m(V₀ − E))/ħ
 *   E > V₀:  T = [1 + V₀²·sen²(qa) / (4E(E − V₀))]⁻¹,   q = √(2m(E − V₀))/ħ
 * @param {number} energy eV (> 0)
 * @param {number} height V₀ (eV)
 * @param {number} width a (nm)
 * @param {number} [mass]
 */
export function barrierTransmission(energy, height, width, mass = 1) {
  const a = kineticCoefficient(mass);
  const E = energy;
  const V = height;
  if (Math.abs(E - V) < 1e-12 * Math.max(1, V)) {
    // Límite E → V₀: T = [1 + mV₀a²/2ħ²]⁻¹ = [1 + V₀a²/(4·ħ²/2m)]⁻¹
    return 1 / (1 + (V * width * width) / (4 * a));
  }
  if (E < V) {
    const kappa = Math.sqrt((V - E) / a);
    const sh = Math.sinh(kappa * width);
    return 1 / (1 + (V * V * sh * sh) / (4 * E * (V - E)));
  }
  const q = Math.sqrt((E - V) / a);
  const sn = Math.sin(q * width);
  return 1 / (1 + (V * V * sn * sn) / (4 * E * (E - V)));
}

/**
 * Transmisión y reflexión de una onda plana que llega por la izquierda a un potencial
 * constante a trozos (matriz de transferencia). En cada tramo ψ = a·e^{iq(x−x_ref)} +
 * b·e^{−iq(x−x_ref)}, con q = √(2m(E − V))/ħ (imaginario si E < V) y x_ref el borde
 * izquierdo del tramo; ψ y ψ′ son continuas en cada frontera. Se parte de la onda
 * transmitida (a = 1, b = 0) en el último tramo y se recorre hacia la izquierda.
 *   T = (q_der/q_izq)·|a_der|²/|a_izq|²,   R = |b_izq/a_izq|²
 * @param {number} energy eV
 * @param {{ edges: number[], values: number[] }} segments ver potentialSegments
 * @param {number} [mass]
 * @returns {{ T: number, R: number }}
 */
export function piecewiseTransmission(energy, segments, mass = 1) {
  const coef = kineticCoefficient(mass);
  const { edges, values } = segments;
  const m = values.length;
  if (energy <= values[0]) return { T: 0, R: 1 };
  // q de cada tramo como número complejo [re, im]; si E = V exactamente se desplaza E un
  // poco para que la base e^{±iqx} no degenere.
  /** @type {[number, number][]} */
  const q = values.map((v) => {
    let d = (energy - v) / coef;
    if (Math.abs(d) < 1e-12) d = 1e-12;
    return d > 0 ? [Math.sqrt(d), 0] : [0, Math.sqrt(-d)];
  });
  /** @param {[number, number]} z @param {number} s exp(s·i·z) */
  const expi = (z, s) => {
    const mag = Math.exp(-s * z[1]);
    return [mag * Math.cos(s * z[0]), mag * Math.sin(s * z[0])];
  };
  /** @param {number[]} u @param {number[]} v */
  const mul = (u, v) => [u[0] * v[0] - u[1] * v[1], u[0] * v[1] + u[1] * v[0]];
  /** @param {number[]} u @param {number[]} v */
  const div = (u, v) => {
    const d = v[0] * v[0] + v[1] * v[1];
    return [(u[0] * v[0] + u[1] * v[1]) / d, (u[1] * v[0] - u[0] * v[1]) / d];
  };
  // Último tramo: onda transmitida pura, con referencia en su borde izquierdo.
  let A = [1, 0];
  let B = [0, 0];
  for (let i = m - 1; i >= 1; i--) {
    const xb = edges[i - 1];
    // Valor y derivada/q en la frontera vistos desde el tramo i (referencia: su borde izquierdo = xb).
    const f = [A[0] + B[0], A[1] + B[1]];
    const g = mul(q[i], [A[0] - B[0], A[1] - B[1]]); // ψ′/i
    // Tramo i − 1, con referencia en su borde izquierdo (edges[i−2], o xb si es el primero).
    const ref = i - 2 >= 0 ? edges[i - 2] : xb;
    const L = xb - ref;
    const gq = div(g, q[i - 1]);
    // a·e^{iqL} = ½(f + g/q),  b·e^{−iqL} = ½(f − g/q)
    const aE = [(f[0] + gq[0]) / 2, (f[1] + gq[1]) / 2];
    const bE = [(f[0] - gq[0]) / 2, (f[1] - gq[1]) / 2];
    A = mul(aE, expi(q[i - 1], -L));
    B = mul(bE, expi(q[i - 1], L));
  }
  const aa = A[0] * A[0] + A[1] * A[1];
  const bb = B[0] * B[0] + B[1] * B[1];
  const qLeft = q[0][0];
  const qRight = q[m - 1][1] === 0 ? q[m - 1][0] : 0;
  return { T: (qRight / qLeft) / aa, R: bb / aa };
}
