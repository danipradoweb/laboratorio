// @ts-check
// Mapas de color y coloreado de funciones complejas.
//
// 1) FUNCIONES COMPLEJAS (el mismo criterio en todos los módulos cuánticos):
//      tono   = fase, arg ψ          (rueda de color cíclica)
//      brillo = módulo, |ψ|          (|ψ| = 0 se funde con el fondo)
//    La rueda se construye en el espacio OKLCH con luminosidad y croma constantes, de
//    modo que todas las fases se ven igual de luminosas e igual de saturadas: ningún
//    valor de la fase "destaca" por un artefacto del color. Los colores salen algo
//    apagados a cambio; es el precio de que la rueda sea perceptualmente uniforme.
//
//      fase 0 → rojo     π/2 → verde amarillento     ±π → cian     −π/2 → violeta
//
// 2) MAPAS ESCALARES, de t ∈ [0, 1] a color:
//      viridis, magma   secuenciales (para magnitudes ≥ 0: intensidades, densidades)
//      divergente       para magnitudes con signo, con el cero en el centro (blanco)
//
// Los colores se devuelven como [r, g, b] con valores enteros 0–255 (sRGB).
// Leyendas reutilizables: createPhaseWheel() aquí; la barra de color de los mapas
// escalares la dibuja plot2d.js junto al mapa.

import { MAGMA, RDBU, VIRIDIS } from './colormap-data.js';
import { getTheme, onThemeChange, themeColors } from '../core/theme.js';
import { el } from './dom.js';

/** @typedef {[number, number, number]} RGB */
/** @typedef {'dark' | 'light'} Background */

// --- OKLab ↔ sRGB --------------------------------------------------------------------------
// OKLab (Björn Ottosson, 2020) es un espacio de color perceptualmente uniforme: L es la
// luminosidad percibida y (a, b) el color. OKLCH es lo mismo en polares: croma C y
// tono h. Las matrices son las de la definición; tests/colormaps.test.js las comprueba
// contra una implementación independiente (culori).

/**
 * OKLab → sRGB lineal (sin corrección gamma, sin recortar).
 * @param {number} L luminosidad, 0 (negro) a 1 (blanco)
 * @param {number} a eje verde-rojo
 * @param {number} b eje azul-amarillo
 * @returns {RGB} componentes lineales; fuera de [0, 1] si el color no cabe en sRGB
 */
export function oklabToLinearSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Corrección gamma de sRGB: de componente lineal a componente codificada.
 * @param {number} c
 * @returns {number}
 */
export function linearToGamma(c) {
  const sign = c < 0 ? -1 : 1;
  const v = Math.abs(c);
  return sign * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}

/**
 * Inversa de la corrección gamma de sRGB.
 * @param {number} c
 * @returns {number}
 */
export function gammaToLinear(c) {
  const sign = c < 0 ? -1 : 1;
  const v = Math.abs(c);
  return sign * (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
}

/**
 * OKLCH → sRGB con gamma, en [0, 1] y sin recortar (para comprobar si cabe en gama).
 * @param {number} L luminosidad
 * @param {number} C croma (0 = gris)
 * @param {number} hueDegrees tono en grados
 * @returns {RGB}
 */
export function oklchToSrgb(L, C, hueDegrees) {
  const h = (hueDegrees * Math.PI) / 180;
  const [r, g, b] = oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
  return [linearToGamma(r), linearToGamma(g), linearToGamma(b)];
}

/**
 * sRGB con gamma (componentes en [0, 1]) → OKLab [L, a, b].
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {[number, number, number]}
 */
export function srgbToOklab(r, g, b) {
  const lr = gammaToLinear(r);
  const lg = gammaToLinear(g);
  const lb = gammaToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** @param {number} c componente en [0, 1] @returns {number} entero 0–255 */
function toByte(c) {
  return Math.round(255 * Math.min(1, Math.max(0, c)));
}

// --- Rueda de fase ---------------------------------------------------------------------------

/** Luminosidad OKLab de la rueda de fase. */
export const PHASE_LIGHTNESS = 0.72;
/** Croma OKLCH de la rueda. Es (con margen) el mayor que cabe en sRGB para todos los
 *  tonos con esa luminosidad, tanto al fundir a negro como a blanco. */
export const PHASE_CHROMA = 0.12;
/** Tono OKLCH (grados) de la fase 0: rojo. */
export const PHASE_HUE_ZERO = 30;

/**
 * Color de un número complejo: el tono es la fase y el brillo el módulo.
 *
 * El fundido hacia el fondo es lineal en OKLab, o sea, uniforme para el ojo:
 * magnitude = 0,5 se ve "a medio camino" entre el fondo y el color pleno.
 *
 * @param {number} phase fase en radianes (cualquier valor; es periódica)
 * @param {number} [magnitude] módulo normalizado, de 0 (fondo) a 1 (color pleno)
 * @param {Background} [background] 'dark': |ψ| = 0 es negro; 'light': es blanco
 * @returns {RGB} enteros 0–255
 */
export function phaseColor(phase, magnitude = 1, background = 'dark') {
  const m = Math.min(1, Math.max(0, magnitude));
  const h = phase + (PHASE_HUE_ZERO * Math.PI) / 180;
  const L = background === 'dark' ? PHASE_LIGHTNESS * m : 1 - m * (1 - PHASE_LIGHTNESS);
  const C = PHASE_CHROMA * m;
  const [r, g, b] = oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
  return [toByte(linearToGamma(r)), toByte(linearToGamma(g)), toByte(linearToGamma(b))];
}

/**
 * Fondo que corresponde al tema actual ('dark' o 'light'), para pasarlo a phaseColor.
 * @returns {Background}
 */
export function themeBackground() {
  return getTheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Colorea una malla de valores complejos (para plot2d: `image: { nx, ny, rgba, … }`).
 * @param {ArrayLike<number>} re partes reales
 * @param {ArrayLike<number>} im partes imaginarias
 * @param {{ maxAbs?: number, background?: Background }} [options]
 *   maxAbs: módulo que corresponde al color pleno (por defecto, el máximo de la malla)
 * @returns {Uint8ClampedArray} 4 bytes RGBA por punto
 */
export function colorizeComplex(re, im, { maxAbs, background = 'dark' } = {}) {
  const n = re.length;
  let scale = maxAbs;
  if (scale === undefined) {
    scale = 0;
    for (let i = 0; i < n; i++) scale = Math.max(scale, Math.hypot(re[i], im[i]));
  }
  if (!(scale > 0)) scale = 1;
  const rgba = new Uint8ClampedArray(4 * n);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = phaseColor(Math.atan2(im[i], re[i]), Math.hypot(re[i], im[i]) / scale, background);
    rgba[4 * i] = r;
    rgba[4 * i + 1] = g;
    rgba[4 * i + 2] = b;
    rgba[4 * i + 3] = 255;
  }
  return rgba;
}

// --- Mapas escalares -------------------------------------------------------------------------

/**
 * Convierte una tabla hexadecimal de 256 colores en una función t ∈ [0, 1] → RGB,
 * interpolando linealmente entre colores vecinos.
 * @param {string} hex
 * @returns {(t: number) => RGB}
 */
function fromTable(hex) {
  const count = hex.length / 6;
  const table = new Uint8Array(count * 3);
  for (let i = 0; i < count * 3; i++) table[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return (t) => {
    const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (count - 1);
    const i = Math.min(count - 2, Math.floor(x));
    const f = x - i;
    return [
      Math.round(table[3 * i] + f * (table[3 * i + 3] - table[3 * i])),
      Math.round(table[3 * i + 1] + f * (table[3 * i + 4] - table[3 * i + 1])),
      Math.round(table[3 * i + 2] + f * (table[3 * i + 5] - table[3 * i + 2])),
    ];
  };
}

/**
 * Mapas escalares disponibles.
 * @type {{ viridis: (t: number) => RGB, magma: (t: number) => RGB, divergente: (t: number) => RGB }}
 */
export const colormaps = {
  /** Secuencial, de violeta oscuro a amarillo. Opción por defecto para magnitudes ≥ 0. */
  viridis: fromTable(VIRIDIS),
  /** Secuencial, de negro a crema. Bueno sobre fondo oscuro (intensidades, emisión). */
  magma: fromTable(MAGMA),
  /** Divergente: azul (t = 0), blanco (t = 0,5), rojo (t = 1). Para magnitudes con signo;
   *  úsalo con `symmetric: true` en plot2d para que el blanco caiga en el cero.
   *  Su luminosidad es simétrica respecto al centro: +v y −v se ven igual de oscuros. */
  divergente: fromTable(RDBU),
};

/** @typedef {keyof typeof colormaps} ColormapName */

/**
 * Mapa de color por nombre (por ejemplo, el valor de un parámetro de tipo select).
 * @param {string} name
 * @returns {(t: number) => RGB}
 */
export function getColormap(name) {
  if (!Object.hasOwn(colormaps, name)) {
    throw new RangeError(`Mapa de color desconocido: "${name}". Disponibles: ${Object.keys(colormaps).join(', ')}`);
  }
  return colormaps[/** @type {ColormapName} */ (name)];
}

// --- Leyenda: rueda de fase --------------------------------------------------------------------

/**
 * Crea la leyenda de la rueda de fase: un disco donde el ángulo es arg ψ y la distancia
 * al centro es |ψ| (centro = 0), con las fases 0, π/2, ±π y −π/2 rotuladas.
 * Se redibuja sola al cambiar el tema. Debe estar siempre visible junto a cualquier
 * vista coloreada por fase.
 *
 * @param {HTMLElement} container
 * @param {{ label?: string }} [options] label: texto bajo la rueda (por defecto, el criterio)
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
export function createPhaseWheel(container, { label = 'tono: fase arg ψ · brillo: |ψ|' } = {}) {
  const canvas = el('canvas', { class: 'phase-wheel-canvas', role: 'img', 'aria-label': 'Leyenda: rueda de fase' });
  const element = el(
    'figure',
    { class: 'phase-wheel' },
    canvas,
    el('figcaption', { text: label }),
  );
  container.append(element);

  function render() {
    const size = canvas.clientWidth || 120;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const colors = themeColors();
    const background = themeBackground();
    const fs = (parseFloat(getComputedStyle(element).fontSize) || 12) * dpr;
    const margin = fs * 1.9; // sitio para los rótulos
    const radius = px / 2 - margin;
    const image = g.createImageData(px, px);
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x + 0.5 - px / 2;
        const dy = px / 2 - (y + 0.5); // y hacia arriba, como en el plano complejo
        const r = Math.hypot(dx, dy) / radius;
        if (r > 1) continue;
        const [cr, cg, cb] = phaseColor(Math.atan2(dy, dx), r, background);
        const i = 4 * (y * px + x);
        image.data[i] = cr;
        image.data[i + 1] = cg;
        image.data[i + 2] = cb;
        // Borde suavizado de un píxel.
        image.data[i + 3] = Math.round(255 * Math.min(1, (1 - r) * radius));
      }
    }
    g.putImageData(image, 0, 0);
    g.fillStyle = colors.text;
    g.font = `${fs}px ${getComputedStyle(element).fontFamily || 'sans-serif'}`;
    g.textBaseline = 'middle';
    const c = px / 2;
    const d = radius + fs * 0.35;
    g.textAlign = 'left';
    g.fillText('0', c + d, c);
    g.textAlign = 'right';
    g.fillText('±π', c - d, c);
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('π/2', c, c - d + fs * 0.1);
    g.textBaseline = 'top';
    g.fillText('−π/2', c, c + d - fs * 0.1);
  }

  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  const offTheme = onThemeChange(render);
  render();

  return {
    element,
    destroy() {
      observer.disconnect();
      offTheme();
      element.remove();
    },
  };
}
