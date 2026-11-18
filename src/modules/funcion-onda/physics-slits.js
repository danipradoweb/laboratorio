// @ts-check
// Función de onda: doble rendija en 2D con control de coherencia.
//
// Un paquete de ondas que avanza hacia +y llega a una pared opaca con dos rendijas. Detrás,
// una pantalla (la recta y = y_pantalla) cuenta la probabilidad que la atraviesa.
//
// ECUACIÓN Y MÉTODO: la ecuación de Schrödinger en 2D,
//   iħ·∂ψ/∂t = −(ħ²/2m)·(∂²ψ/∂x² + ∂²ψ/∂y²) + V·ψ,
// con el mismo paso partido de Fourier (Strang) que physics.js, ahora con la FFT 2D, y las
// mismas unidades: nm, fs, eV y masas del electrón. Malla de 256 × 256 puntos.
//
// LA PARED es un potencial absorbente −iW(x, y): una franja de 1,5 nm de grosor donde W sube
// y baja con forma de cos² (sin saltos, para que refleje poco), con huecos en las rendijas
// (en las celdas del borde de una rendija, W se reduce en la fracción de celda abierta).
// Lo que entra en la pared se apaga: es una lámina negra. Los bordes de la malla llevan
// otra franja absorbente, como en physics.js, para simular un espacio abierto.
//
// LAS DOS RAMAS (Feynman, vol. III §1-6 y §3-2): ψ₁ es la onda que llega con solo la
// rendija 1 abierta (la de x > 0) y ψ₂ la que llega con solo la rendija 2. Como el paquete
// y las rendijas son simétricos respecto a x = 0, ψ₂(x, y) = ψ₁(−x, y): basta simular ψ₁.
// Con las dos abiertas, detrás de la pared la onda es ψ₁ + ψ₂ (lo comprueba un test frente
// a la simulación con las dos rendijas abiertas a la vez).
//
// COHERENCIA: si otro sistema queda en el estado |e₁⟩ cuando la partícula pasa por la
// rendija 1 y en |e₂⟩ cuando pasa por la 2, el estado conjunto es ψ₁|e₁⟩ + ψ₂|e₂⟩ y lo que
// se ve en la pantalla (sin mirar ese sistema) es
//   ρ = |ψ₁|² + |ψ₂|² + 2·γ·Re(ψ₁*·ψ₂),      γ = ⟨e₁|e₂⟩ (aquí real, entre 0 y 1).
// γ = 1: el otro sistema no guarda información del camino y las franjas se ven enteras;
// γ = 0: la guarda entera y quedan |ψ₁|² + |ψ₂|², sin franjas. La visibilidad de las
// franjas, donde las dos ramas llegan con la misma intensidad, es γ. Es la decoherencia:
// nadie tiene que «mirar».
//
// LA PANTALLA integra en el tiempo la corriente de probabilidad que la cruza,
//   j_y = (ħ/m)·Im[ψ₁*∂ψ₁ + ψ₂*∂ψ₂ + γ(ψ₁*∂ψ₂ + ψ₂*∂ψ₁)]   (∂ = ∂/∂y),
// que es la probabilidad por unidad de longitud de que la partícula llegue a cada punto:
// lo que contaría un detector. (Integrar |ψ|² en lugar de j_y daría más peso a los
// ángulos grandes, donde la partícula cruza la recta más despacio.)
//
// MÁXIMOS: desde el punto medio entre las rendijas, a un ángulo θ, la diferencia de
// caminos es d·sen θ y las franjas brillantes cumplen d·sen θ = mλ (λ = 2π/k₀, la longitud
// de onda de de Broglie). Para dos fuentes puntuales a distancia R la fórmula es exacta
// hasta segundo orden en d/R; el error relativo es del orden de (d/R)²/8.
//
// Referencias: Feynman Lectures vol. III caps. 1 y 3; Born & Wolf, Principles of Optics,
// §7.3 (Young), §8.5 (Fraunhofer, rendija) y §10.4 (coherencia parcial, visibilidad);
// Nielsen y Chuang, Quantum Computation and Quantum Information, §2.4 (matriz densidad
// reducida). Paso partido: Feit, Fleck y Steiger, J. Comput. Phys. 47 (1982) 412.

import { fft2d, ifft2d, fftfreq } from '../../core/fft.js';
import { HBAR_EV_FS, kineticCoefficient } from './physics.js';

/**
 * @typedef {{ re: Float64Array, im: Float64Array }} Wave2D
 *   valores por filas: índice iy·n + ix (x varía más deprisa)
 */

/**
 * @typedef {object} SlitGeometry
 * @property {number} wavelength longitud de onda de de Broglie del paquete (nm)
 * @property {number} separation distancia d entre los centros de las rendijas (nm)
 * @property {number} slitWidth anchura w de cada rendija (nm)
 * @property {number} [mass] masa en mₑ (por defecto 1)
 */

/** Malla: 256 × 256 puntos en [−16, 16) nm × [−16, 16) nm (Δx = 0,125 nm). */
export const SLIT_GRID_POINTS = 256;
export const SLIT_GRID_HALF = 16;
/** Pared: centro, grosor y altura de W (eV). */
export const WALL_Y = -3;
export const WALL_THICKNESS = 1.5;
export const WALL_STRENGTH = 5;
/** Pantalla: la recta y = SCREEN_Y (a 10 nm de la pared). */
export const SCREEN_Y = 7;
/** Franja absorbente de los bordes de la malla: anchura (nm) y altura (eV). */
export const EDGE_WIDTH = 3.5;
export const EDGE_STRENGTH = 3;
/** Paquete inicial: centro en y, anchuras σ en x y en y (nm). */
export const PACKET_Y0 = -8.5;
export const PACKET_SIGMA_X = 3;
export const PACKET_SIGMA_Y = 1.2;

/**
 * Malla cuadrada periódica de n × n puntos en [−half, half)². Las coordenadas son
 * simétricas: x[n − j] = −x[j], lo que permite reflejar ψ respecto a x = 0 sin interpolar.
 * @param {number} [n]
 * @param {number} [half]
 */
export function createGrid2D(n = SLIT_GRID_POINTS, half = SLIT_GRID_HALF) {
  const dx = (2 * half) / n;
  const x = Float64Array.from({ length: n }, (_, j) => -half + j * dx);
  const k = fftfreq(n, dx).map((f) => 2 * Math.PI * f);
  return { n, half, dx, x, k };
}

/** @typedef {ReturnType<typeof createGrid2D>} Grid2D */

/**
 * Potencial absorbente W(x, y) ≥ 0 (eV): la pared con sus rendijas abiertas y las franjas
 * de los bordes de la malla.
 * @param {Grid2D} grid
 * @param {SlitGeometry & { open?: 'both' | 'right' | 'left' | 'none' }} geometry
 *   open: qué rendijas están abiertas (right = la de x > 0, la «rendija 1»)
 * @returns {Float64Array}
 */
export function absorberMap(grid, { separation, slitWidth, open = 'right' }) {
  const { n, x, half } = grid;
  const W = new Float64Array(n * n);
  /** @type {number[]} */
  const centers = [];
  if (open === 'right' || open === 'both') centers.push(separation / 2);
  if (open === 'left' || open === 'both') centers.push(-separation / 2);
  // Fracción de cada celda [x − Δx/2, x + Δx/2] que cae dentro de una rendija: así la
  // anchura abierta es exactamente w aunque los bordes no coincidan con los puntos de la
  // malla (el mismo criterio que el promedio por celda de potentialOnGrid en physics.js).
  const openFraction = Float64Array.from(x, (xi) => {
    let open = 0;
    for (const c of centers) {
      const lo = Math.max(xi - grid.dx / 2, c - slitWidth / 2);
      const hi = Math.min(xi + grid.dx / 2, c + slitWidth / 2);
      if (hi > lo) open += (hi - lo) / grid.dx;
    }
    return Math.min(1, open);
  });
  const inner = half - EDGE_WIDTH;
  const edge = (/** @type {number} */ s) => {
    const d = Math.abs(s) > inner ? Math.abs(s) - inner : 0;
    return EDGE_STRENGTH * (d / EDGE_WIDTH) ** 2;
  };
  for (let iy = 0; iy < n; iy++) {
    const y = x[iy];
    const u = (y - WALL_Y) / WALL_THICKNESS;
    const wallProfile = Math.abs(u) < 0.5 ? WALL_STRENGTH * Math.cos(Math.PI * u) ** 2 : 0;
    for (let ix = 0; ix < n; ix++) {
      W[iy * n + ix] = (1 - openFraction[ix]) * wallProfile + edge(x[ix]) + edge(y);
    }
  }
  return W;
}

/**
 * Número de onda k₀ = 2π/λ (nm⁻¹) y energía ħ²k₀²/2m (eV) del paquete.
 * @param {number} wavelength nm
 * @param {number} [mass]
 */
export function packetWave(wavelength, mass = 1) {
  const k0 = (2 * Math.PI) / wavelength;
  return { k0, energy: kineticCoefficient(mass) * k0 * k0, speed: (2 * kineticCoefficient(mass) * k0) / HBAR_EV_FS };
}

/**
 * Paquete gaussiano normalizado que avanza hacia +y:
 *   ψ = N·exp(−x²/4σx² − (y − y₀)²/4σy² + i·k₀·y).
 * @param {Grid2D} grid
 * @param {{ k0: number, y0?: number, sigmaX?: number, sigmaY?: number }} options
 * @returns {Wave2D}
 */
export function gaussianPacket2D(grid, { k0, y0 = PACKET_Y0, sigmaX = PACKET_SIGMA_X, sigmaY = PACKET_SIGMA_Y }) {
  const { n, x, dx } = grid;
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  let norm = 0;
  for (let iy = 0; iy < n; iy++) {
    const y = x[iy];
    const gy = Math.exp(-((y - y0) ** 2) / (4 * sigmaY * sigmaY));
    for (let ix = 0; ix < n; ix++) {
      const amp = gy * Math.exp(-(x[ix] ** 2) / (4 * sigmaX * sigmaX));
      const i = iy * n + ix;
      re[i] = amp * Math.cos(k0 * y);
      im[i] = amp * Math.sin(k0 * y);
      norm += amp * amp;
    }
  }
  const scale = 1 / Math.sqrt(norm * dx * dx);
  for (let i = 0; i < n * n; i++) {
    re[i] *= scale;
    im[i] *= scale;
  }
  return { re, im };
}

/**
 * Propagador de paso partido 2D: medio paso de potencial (−iW), paso entero de cinética
 * ħ²(kx² + ky²)/2m en el espacio de momentos, medio paso de potencial.
 * @param {Grid2D} grid
 * @param {ArrayLike<number> | null} absorber W (eV) en la malla, o null (sin absorción)
 * @param {{ dt: number, mass?: number }} options dt en fs
 */
export function createPropagator2D(grid, absorber, { dt, mass = 1 }) {
  const { n, k } = grid;
  const a = kineticCoefficient(mass);
  const half = new Float64Array(n * n).fill(1);
  if (absorber) for (let i = 0; i < n * n; i++) half[i] = Math.exp((-absorber[i] * dt) / (2 * HBAR_EV_FS));
  const kinRe = new Float64Array(n * n);
  const kinIm = new Float64Array(n * n);
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const phase = (-a * (k[ix] * k[ix] + k[iy] * k[iy]) * dt) / HBAR_EV_FS;
      kinRe[iy * n + ix] = Math.cos(phase);
      kinIm[iy * n + ix] = Math.sin(phase);
    }
  }
  return { grid, dt, mass, half, kinRe, kinIm };
}

/** @typedef {ReturnType<typeof createPropagator2D>} Propagator2D */

/**
 * Avanza ψ un paso de tiempo. Devuelve una onda nueva.
 * @param {Propagator2D} prop
 * @param {Wave2D} psi
 * @returns {Wave2D}
 */
export function step2D(prop, psi) {
  const { n } = prop.grid;
  const total = n * n;
  const re = Float64Array.from(psi.re);
  const im = Float64Array.from(psi.im);
  for (let i = 0; i < total; i++) {
    re[i] *= prop.half[i];
    im[i] *= prop.half[i];
  }
  const f = fft2d(re, im, n, n);
  for (let i = 0; i < total; i++) {
    const r = f.re[i] * prop.kinRe[i] - f.im[i] * prop.kinIm[i];
    f.im[i] = f.re[i] * prop.kinIm[i] + f.im[i] * prop.kinRe[i];
    f.re[i] = r;
  }
  const b = ifft2d(f.re, f.im, n, n);
  for (let i = 0; i < total; i++) {
    b.re[i] *= prop.half[i];
    b.im[i] *= prop.half[i];
  }
  return b;
}

/**
 * ∫|ψ|² dx dy.
 * @param {Grid2D} grid
 * @param {Wave2D} psi
 */
export function norm2D(grid, psi) {
  let s = 0;
  for (let i = 0; i < psi.re.length; i++) s += psi.re[i] * psi.re[i] + psi.im[i] * psi.im[i];
  return s * grid.dx * grid.dx;
}

/**
 * Valores medios y anchuras de |ψ|² en x y en y.
 * @param {Grid2D} grid
 * @param {Wave2D} psi
 */
export function moments2D(grid, psi) {
  const { n, x } = grid;
  let p = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const d = psi.re[i] * psi.re[i] + psi.im[i] * psi.im[i];
      p += d;
      sx += d * x[ix];
      sy += d * x[iy];
      sxx += d * x[ix] * x[ix];
      syy += d * x[iy] * x[iy];
    }
  }
  const mx = sx / p;
  const my = sy / p;
  return { x: mx, y: my, sigmaX: Math.sqrt(sxx / p - mx * mx), sigmaY: Math.sqrt(syy / p - my * my) };
}

/**
 * La rama de la otra rendija: ψ₂(x, y) = ψ₁(−x, y). En la malla simétrica, el índice ix
 * pasa a (n − ix) mod n.
 * @param {Grid2D} grid
 * @param {Wave2D} psi
 * @returns {Wave2D}
 */
export function mirrorX(grid, psi) {
  const { n } = grid;
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let iy = 0; iy < n; iy++) {
    const row = iy * n;
    for (let ix = 0; ix < n; ix++) {
      const src = row + ((n - ix) % n);
      re[row + ix] = psi.re[src];
      im[row + ix] = psi.im[src];
    }
  }
  return { re, im };
}

/**
 * Densidad de probabilidad con coherencia γ entre las ramas:
 *   ρ = |ψ₁|² + |ψ₂|² + 2γ·Re(ψ₁*ψ₂).
 * @param {Wave2D} psi1
 * @param {Wave2D} psi2
 * @param {number} coherence γ entre 0 y 1
 * @returns {Float64Array}
 */
export function mixedDensity(psi1, psi2, coherence) {
  const out = new Float64Array(psi1.re.length);
  for (let i = 0; i < out.length; i++) {
    const a = psi1.re[i] * psi1.re[i] + psi1.im[i] * psi1.im[i];
    const b = psi2.re[i] * psi2.re[i] + psi2.im[i] * psi2.im[i];
    const cross = psi1.re[i] * psi2.re[i] + psi1.im[i] * psi2.im[i];
    out[i] = a + b + 2 * coherence * cross;
  }
  return out;
}

/**
 * Corrientes de probabilidad j_y (nm⁻¹·fs⁻¹) a lo largo de la fila iy, separadas en sus tres
 * partes: la de cada rama y la cruzada (la que multiplica γ):
 *   j₁ = (ħ/m)·Im(ψ₁*∂ψ₁),   j₂ = (ħ/m)·Im(ψ₂*∂ψ₂),   j₁₂ = (ħ/m)·Im(ψ₁*∂ψ₂ + ψ₂*∂ψ₁),
 * con ∂ψ/∂y por diferencias centradas.
 * @param {Grid2D} grid
 * @param {Wave2D} psi1
 * @param {Wave2D} psi2
 * @param {number} iy fila de la pantalla
 * @param {number} [mass]
 */
export function screenCurrents(grid, psi1, psi2, iy, mass = 1) {
  const { n, dx } = grid;
  const hOverM = (2 * kineticCoefficient(mass)) / HBAR_EV_FS; // ħ/m en nm²/fs
  const j1 = new Float64Array(n);
  const j2 = new Float64Array(n);
  const j12 = new Float64Array(n);
  const up = (iy + 1) * n;
  const down = (iy - 1) * n;
  const row = iy * n;
  for (let ix = 0; ix < n; ix++) {
    const d1re = (psi1.re[up + ix] - psi1.re[down + ix]) / (2 * dx);
    const d1im = (psi1.im[up + ix] - psi1.im[down + ix]) / (2 * dx);
    const d2re = (psi2.re[up + ix] - psi2.re[down + ix]) / (2 * dx);
    const d2im = (psi2.im[up + ix] - psi2.im[down + ix]) / (2 * dx);
    const a1re = psi1.re[row + ix];
    const a1im = psi1.im[row + ix];
    const a2re = psi2.re[row + ix];
    const a2im = psi2.im[row + ix];
    // Im(conj(a)·d) = a.re·d.im − a.im·d.re
    j1[ix] = hOverM * (a1re * d1im - a1im * d1re);
    j2[ix] = hOverM * (a2re * d2im - a2im * d2re);
    j12[ix] = hOverM * (a1re * d2im - a1im * d2re + a2re * d1im - a2im * d1re);
  }
  return { j1, j2, j12 };
}

/**
 * Patrón de la pantalla para una coherencia γ a partir de lo acumulado de cada parte:
 * P(x) = J₁ + J₂ + γ·J₁₂.
 * @param {{ j1: ArrayLike<number>, j2: ArrayLike<number>, j12: ArrayLike<number> }} acc
 * @param {number} coherence
 * @returns {Float64Array}
 */
export function screenPattern(acc, coherence) {
  return Float64Array.from(acc.j1, (v, i) => v + acc.j2[i] + coherence * acc.j12[i]);
}

/**
 * Patrón de Fraunhofer de dos rendijas de anchura w a distancia d, por unidad de ángulo y
 * normalizado a 1 en θ = 0 (Born & Wolf §8.5):
 *   I(θ) = sinc²(π·w·sen θ/λ) · [1 + γ·cos(2π·d·sen θ/λ)] / (1 + γ),   sinc u = sen u / u.
 * @param {number} sinTheta
 * @param {SlitGeometry & { coherence?: number }} geometry
 */
export function fraunhoferPattern(sinTheta, { wavelength, separation, slitWidth, coherence = 1 }) {
  const u = (Math.PI * slitWidth * sinTheta) / wavelength;
  const sinc = u === 0 ? 1 : Math.sin(u) / u;
  return (sinc * sinc * (1 + coherence * Math.cos((2 * Math.PI * separation * sinTheta) / wavelength))) / (1 + coherence);
}

/**
 * Número de onda medio, pesado con el flujo (|φ(k)|²·|k|), de la parte de ψ que está más
 * allá de y = yMin: el de la onda que ha pasado por las rendijas. No es exactamente k₀: la
 * pantalla cuenta flujo, que pesa más las componentes rápidas, y la pared absorbe algo más
 * las lentas, que pasan más tiempo junto a los bordes de las rendijas.
 * @param {Grid2D} grid
 * @param {Wave2D} psi
 * @param {number} yMin
 */
export function transmittedWaveNumber(grid, psi, yMin) {
  const { n, x, k } = grid;
  const re = Float64Array.from(psi.re);
  const im = Float64Array.from(psi.im);
  for (let iy = 0; iy < n; iy++) {
    if (x[iy] >= yMin) continue;
    re.fill(0, iy * n, (iy + 1) * n);
    im.fill(0, iy * n, (iy + 1) * n);
  }
  const f = fft2d(re, im, n, n);
  let weight = 0;
  let sum = 0;
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const kk = Math.hypot(k[ix], k[iy]);
      const p = (f.re[i] * f.re[i] + f.im[i] * f.im[i]) * kk;
      weight += p;
      sum += p * kk;
    }
  }
  return sum / weight;
}

/**
 * Prepara una simulación de la doble rendija: malla, propagador de la rama ψ₁ (solo la
 * rendija de x > 0 abierta, u otra combinación con `open`), paquete inicial, fila de la
 * pantalla y tiempo final.
 * @param {SlitGeometry & { open?: 'both' | 'right' | 'left', dt?: number }} geometry
 */
export function createSlitExperiment(geometry) {
  const mass = geometry.mass ?? 1;
  const grid = createGrid2D();
  const { k0, energy, speed } = packetWave(geometry.wavelength, mass);
  // Δt: fase cinética por paso ≲ 0,25 rad a la energía del paquete, y como mucho 0,1 fs.
  const dt = geometry.dt ?? Math.min(0.1, (0.25 * HBAR_EV_FS) / energy);
  const W = absorberMap(grid, { ...geometry, open: geometry.open ?? 'right' });
  const prop = createPropagator2D(grid, W, { dt, mass });
  const psi = gaussianPacket2D(grid, { k0 });
  const screenRow = Math.round((SCREEN_Y + grid.half) / grid.dx);
  // Tiempo final: el final del paquete (y₀ − 4σy) llega a la pantalla por el camino más
  // inclinado que la pantalla recoge (hasta el borde absorbente).
  const reachX = grid.half - EDGE_WIDTH;
  const distance = SCREEN_Y - WALL_Y;
  const slant = Math.hypot(reachX, distance) / distance;
  const tMax = ((WALL_Y - (PACKET_Y0 - 4 * PACKET_SIGMA_Y)) + distance * slant) / speed;
  return { grid, prop, psi, k0, energy, speed, dt, screenRow, screenY: grid.x[screenRow], distance, tMax, W, mass };
}

/** @typedef {ReturnType<typeof createSlitExperiment>} SlitExperiment */

/**
 * Acumulador de la pantalla: suma en el tiempo las tres partes de la corriente.
 * @param {number} n
 */
export function createScreen(n) {
  return { j1: new Float64Array(n), j2: new Float64Array(n), j12: new Float64Array(n) };
}

/**
 * Añade a la pantalla lo que la cruza durante dt con la onda actual ψ₁ (ψ₂ es su espejo).
 * @param {SlitExperiment} exp
 * @param {ReturnType<typeof createScreen>} screen
 * @param {Wave2D} psi1
 * @param {Wave2D} [psi2] por defecto, el espejo de ψ₁
 */
export function accumulateScreen(exp, screen, psi1, psi2 = mirrorX(exp.grid, psi1)) {
  const c = screenCurrents(exp.grid, psi1, psi2, exp.screenRow, exp.mass);
  for (let i = 0; i < screen.j1.length; i++) {
    screen.j1[i] += c.j1[i] * exp.dt;
    screen.j2[i] += c.j2[i] * exp.dt;
    screen.j12[i] += c.j12[i] * exp.dt;
  }
}

/**
 * Corre la simulación entera (para los tests): devuelve la pantalla acumulada y ψ₁ final.
 * @param {SlitExperiment} exp
 * @param {{ mirror?: boolean }} [options] mirror: false con `open: 'both'` (una sola onda,
 *   que se acumula como ψ₁ con ψ₂ = 0)
 */
export function runSlitExperiment(exp, { mirror = true } = {}) {
  const screen = createScreen(exp.grid.n);
  const zero = { re: new Float64Array(exp.grid.n * exp.grid.n), im: new Float64Array(exp.grid.n * exp.grid.n) };
  let psi = exp.psi;
  const steps = Math.ceil(exp.tMax / exp.dt);
  for (let s = 0; s < steps; s++) {
    psi = step2D(exp.prop, psi);
    accumulateScreen(exp, screen, psi, mirror ? undefined : zero);
  }
  return { screen, psi, steps };
}
