// @ts-check
// Ondas clásicas y función de onda: piezas comunes a las vistas.
//
// Aquí no se calcula física: se traduce el estado de la interfaz a la descripción del
// potencial que entiende physics.js, y se preparan imágenes para dibujar ψ con su fase.

import { phaseColor, themeBackground } from '../../ui/colormaps.js';
import { formatEs } from '../../ui/format.js';

/** Columnas del potencial dibujado a mano y sus alturas admitidas (eV). */
export const DRAW_COLUMNS = 16;
/** @type {[number, number]} */
export const DRAW_RANGE = [-1, 3];
/** Anchura total de la zona dibujable (nm), centrada en x = 0. */
export const DRAW_WIDTH = 20;

/** Potenciales en los que la partícula queda confinada (no hay transmisión). */
export const BOUND_POTENTIALS = ['pozo-infinito', 'armonico'];

/**
 * @typedef {object} PartView
 * @property {(state: import('../types.js').State) => void} update
 * @property {() => void} destroy
 */

/**
 * Segundos (de reloj, a velocidad 1×) que una simulación con tiempo final se queda en su
 * último instante antes de volver a empezar sola. Daniel prefiere el bucle a un aviso de
 * fin (encargo R1); la breve espera deja ver el resultado (lo que ha pasado la barrera, el
 * patrón de la pantalla) antes de que se borre. Para detenerla está la pausa.
 */
export const END_HOLD_SECONDS = 1.5;

/**
 * Descripción del potencial (physics.js) a partir del estado de la interfaz.
 * @param {import('../types.js').State} state
 * @param {{ wall?: number }} [options] wall: altura de las paredes del pozo «infinito»
 * @returns {import('./physics.js').PotentialSpec}
 */
export function potentialSpecFromState(state, { wall } = {}) {
  const type = /** @type {import('./physics.js').PotentialSpec['type']} */ (String(state.potential));
  const isWell = type === 'pozo-finito' || type === 'pozo-infinito';
  /** @type {import('./physics.js').PotentialSpec} */
  const spec = {
    type,
    center: 0,
    height: Number(state.height),
    width: isWell ? Number(state.wellWidth) : type === 'dibujado' ? DRAW_WIDTH : Number(state.width),
    separation: Number(state.separation),
    quantum: Number(state.quantum),
    mass: Number(state.mass),
    columns: Array.from({ length: DRAW_COLUMNS }, (_, j) => Number(state[`d${j}`] ?? 0)),
  };
  if (wall !== undefined) spec.wall = wall;
  return spec;
}

/**
 * Imagen RGBA para plot2d con el coloreado de fase de una función compleja: en cada x, una
 * columna del color de arg ψ que sube desde 0 hasta la altura h(x) (|ψ| o |ψ|²); encima,
 * transparente. Es el «relleno de color» de las gráficas de ψ.
 * @param {ArrayLike<number>} re
 * @param {ArrayLike<number>} im
 * @param {{ xRange: [number, number], yRange: [number, number], squared?: boolean, rows?: number }} options
 *   xRange: bordes de la primera y la última columna (las muestras están en los centros);
 *   yRange: intervalo vertical de la gráfica; squared: altura |ψ|² en vez de |ψ|
 * @returns {import('../../ui/plot2d.js').RgbaImage}
 */
export function phaseFillImage(re, im, { xRange, yRange, squared = false, rows = 220 }) {
  const nx = re.length;
  const ny = rows;
  const rgba = new Uint8ClampedArray(4 * nx * ny);
  const background = themeBackground();
  const dy = (yRange[1] - yRange[0]) / ny;
  for (let ix = 0; ix < nx; ix++) {
    const mag2 = re[ix] * re[ix] + im[ix] * im[ix];
    const h = squared ? mag2 : Math.sqrt(mag2);
    if (!(h > 0)) continue;
    const [r, g, b] = phaseColor(Math.atan2(im[ix], re[ix]), 1, background);
    for (let iy = 0; iy < ny; iy++) {
      const y0 = yRange[0] + iy * dy;
      const y1 = y0 + dy;
      // Fracción de la celda que queda entre 0 y h (borde suave de un píxel).
      const lo = Math.max(y0, 0);
      const hi = Math.min(y1, h);
      const cover = hi > lo ? (hi - lo) / dy : 0;
      if (cover <= 0) continue;
      const i = 4 * (iy * nx + ix);
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = Math.round(255 * Math.min(1, cover));
    }
  }
  return { nx, ny, rgba, xRange, yRange };
}

/**
 * Índices de las muestras de una malla que caen dentro de [x0, x1], tomando como mucho
 * `maxSamples` (submuestreo uniforme), para dibujar solo lo visible.
 * @param {ArrayLike<number>} x
 * @param {number} x0
 * @param {number} x1
 * @param {number} maxSamples
 * @returns {number[]}
 */
export function visibleIndices(x, x0, x1, maxSamples) {
  /** @type {number[]} */
  const inside = [];
  for (let j = 0; j < x.length; j++) if (x[j] >= x0 && x[j] <= x1) inside.push(j);
  if (inside.length <= maxSamples) return inside;
  const stride = inside.length / maxSamples;
  return Array.from({ length: maxSamples }, (_, i) => inside[Math.floor(i * stride)]);
}

/**
 * Número con unas cifras significativas y coma decimal.
 * @param {number} value
 * @param {number} [digits]
 */
export function formatSig(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, digits - 1 - magnitude);
  return formatEs(value, Math.min(decimals, 6));
}

/**
 * Región del espectro de una longitud de onda en el vacío.
 * @param {number} nm
 */
export function spectralRegion(nm) {
  if (nm < 10) return 'rayos X';
  if (nm < 380) return 'ultravioleta';
  if (nm <= 750) return 'visible';
  if (nm < 1e6) return 'infrarrojo';
  return 'microondas';
}
