// @ts-check
// Motor espectro → color: de un espectro al color que se ve en la pantalla.
//
//   const engine = await loadColorEngine();
//   const color = engine.colorOf({ wavelengths, values });   // transmitancia, bajo D65
//   color.css;        // 'rgb(201, 62, 71)', listo para pintar
//   color.inGamut;    // false si la pantalla no puede mostrar ese color (se recortó)
//   color.lab;        // [L*, a*, b*], para comparar colores
//
// La cadena, paso a paso (cada paso es una función exportada y probada por separado):
//
//   espectro ──► XYZ ──► sRGB lineal ──► sRGB con gamma ──► recorte a [0, 1]
//                 └────► CIELAB (L*, a*, b*)
//
// 1. XYZ (CIE 1931, observador de 2°). Para un espectro de transmitancia o reflectancia
//    τ(λ) iluminado por S(λ):
//        X = k·Σ τ(λ)·S(λ)·x̄(λ),   k = 1 / Σ S(λ)·ȳ(λ)      (ídem Y con ȳ, Z con z̄)
//    con sumas de 1 en 1 nm. Con esta k, un objeto que lo deja pasar todo (τ = 1) tiene
//    Y = 1. Y es la luminancia relativa: Y = 0,2 significa "refleja o transmite el 20 %
//    de la luz, tal como la pondera el ojo".
// 2. sRGB lineal: una matriz 3 × 3 fijada por los tres primarios y el blanco (D65) de la
//    norma IEC 61966-2-1.
// 3. Gamma: la curva de transferencia de sRGB (tramo lineal + potencia 1/2,4).
// 4. Si algún canal queda fuera de [0, 1], el color no cabe en la pantalla: se recorta
//    canal a canal y se avisa con inGamut = false.
//
// NO se hace adaptación cromática: el resultado es el color tal como lo vería un ojo
// adaptado a D65 (el blanco de la pantalla). Por eso un papel blanco bajo el iluminante A
// sale anaranjado, igual que una bombilla vista junto a una ventana.
//
// Todo este archivo son funciones puras; solo loadColorEngine() lee datos.

import { CIE_END_NM, CIE_START_NM, loadCie } from './cie.js';

/**
 * @typedef {import('./cie.js').CieData} CieData
 * @typedef {import('./cie.js').IlluminantName} IlluminantName
 * @typedef {[number, number, number]} Triplet
 */

/**
 * Espectro: valores en una lista creciente de longitudes de onda (nm). Entre dos puntos
 * se interpola linealmente.
 * @typedef {object} Spectrum
 * @property {ArrayLike<number>} wavelengths nm, estrictamente crecientes
 * @property {ArrayLike<number>} values
 */

/** El espectro debe cubrir al menos este intervalo (nm): fuera de él el ojo casi no ve. */
export const REQUIRED_RANGE_NM = /** @type {const} */ ([380, 780]);

/** Margen con el que un canal de sRGB se considera dentro de [0, 1]. Absorbe el redondeo
 *  del blanco: el D65 integrado del espectro difiere en ~2·10⁻⁴ del blanco nominal. */
export const GAMUT_TOLERANCE = 1e-3;

// --- 1. Espectro → XYZ ------------------------------------------------------------------

/**
 * Evalúa un espectro en longitudes de onda enteras consecutivas (interpolación lineal).
 * @param {Spectrum} spectrum
 * @param {number} start primera longitud de onda (nm, entera)
 * @param {number} end última longitud de onda (nm, entera)
 * @returns {Float64Array} valores en start, start + 1, …, end
 */
export function resampleSpectrum(spectrum, start, end) {
  const { wavelengths: xs, values: ys } = spectrum;
  const n = xs.length;
  if (n < 2 || ys.length !== n) throw new RangeError('espectro: hacen falta al menos dos puntos, y tantos valores como longitudes de onda');
  for (let i = 1; i < n; i++) {
    if (!(xs[i] > xs[i - 1])) throw new RangeError('espectro: las longitudes de onda deben ser estrictamente crecientes');
  }
  if (start < xs[0] || end > xs[n - 1]) {
    throw new RangeError(`espectro: se pide [${start}, ${end}] nm pero solo cubre [${xs[0]}, ${xs[n - 1]}] nm`);
  }
  const out = new Float64Array(end - start + 1);
  let j = 0;
  for (let i = 0; i < out.length; i++) {
    const lambda = start + i;
    while (j < n - 2 && xs[j + 1] < lambda) j++;
    const t = (lambda - xs[j]) / (xs[j + 1] - xs[j]);
    out[i] = ys[j] + t * (ys[j + 1] - ys[j]);
  }
  return out;
}

/**
 * Intervalo (nm enteros) en el que se integra: donde hay a la vez espectro, funciones de
 * igualación e iluminante.
 * @param {Spectrum} spectrum
 * @param {[number, number]} [illuminantRange]
 * @returns {[number, number]}
 */
function integrationRange(spectrum, illuminantRange = [CIE_START_NM, CIE_END_NM]) {
  const first = spectrum.wavelengths[0];
  const last = spectrum.wavelengths[spectrum.wavelengths.length - 1];
  if (!(first <= REQUIRED_RANGE_NM[0] && last >= REQUIRED_RANGE_NM[1])) {
    throw new RangeError(
      `espectro: debe cubrir al menos de ${REQUIRED_RANGE_NM[0]} a ${REQUIRED_RANGE_NM[1]} nm (cubre de ${first} a ${last} nm)`,
    );
  }
  return [Math.max(Math.ceil(first), illuminantRange[0], CIE_START_NM), Math.min(Math.floor(last), illuminantRange[1], CIE_END_NM)];
}

/**
 * XYZ de un espectro.
 *
 * kind = 'factor' (por defecto): el espectro es una transmitancia o una reflectancia
 *   (entre 0 y 1) y se ilumina con `illuminant`. Un espectro igual a 1 da Y = 1.
 * kind = 'emission': el espectro es la propia luz (potencia por nm, unidades
 *   arbitrarias). No interviene ningún iluminante y la escala de XYZ es la del espectro:
 *   usa normalizeLuminance() para fijar el brillo.
 *
 * @param {CieData} cie
 * @param {Spectrum} spectrum
 * @param {{ illuminant?: IlluminantName, kind?: 'factor' | 'emission' }} [options]
 * @returns {Triplet} [X, Y, Z]
 */
export function spectrumToXYZ(cie, spectrum, { illuminant = 'D65', kind = 'factor' } = {}) {
  const source = kind === 'factor' ? cie.illuminants[illuminant] : null;
  if (kind === 'factor' && !source) throw new RangeError(`iluminante desconocido: ${illuminant}`);
  const [start, end] = integrationRange(spectrum, source?.range);
  const values = resampleSpectrum(spectrum, start, end);
  let X = 0;
  let Y = 0;
  let Z = 0;
  let norm = 0;
  for (let i = 0; i < values.length; i++) {
    const c = start - CIE_START_NM + i; // índice en la malla CIE
    const power = source ? source.values[c] : 1;
    const weight = values[i] * power;
    X += weight * cie.xbar[c];
    Y += weight * cie.ybar[c];
    Z += weight * cie.zbar[c];
    norm += power * cie.ybar[c];
  }
  return source ? [X / norm, Y / norm, Z / norm] : [X, Y, Z];
}

/**
 * XYZ del blanco de un iluminante: lo que da un objeto que lo refleja o transmite todo.
 * Es el blanco de referencia de CIELAB. Y = 1 por construcción.
 * @param {CieData} cie
 * @param {IlluminantName} [illuminant]
 * @param {[number, number]} [range] intervalo del espectro con el que se va a comparar
 *   (por defecto, todo el que cubre el iluminante)
 * @returns {Triplet}
 */
export function illuminantWhite(cie, illuminant = 'D65', range = [CIE_START_NM, CIE_END_NM]) {
  return spectrumToXYZ(cie, { wavelengths: range, values: [1, 1] }, { illuminant });
}

/**
 * XYZ de una luz monocromática de longitud de onda λ (potencia unidad): son,
 * directamente, las funciones de igualación en λ.
 * @param {CieData} cie
 * @param {number} lambda nm, entre 360 y 830
 * @returns {Triplet}
 */
export function monochromaticXYZ(cie, lambda) {
  if (!(lambda >= CIE_START_NM && lambda <= CIE_END_NM)) {
    throw new RangeError(`λ = ${lambda} nm está fuera de las tablas CIE (${CIE_START_NM}–${CIE_END_NM} nm)`);
  }
  const position = lambda - CIE_START_NM;
  const i = Math.min(cie.xbar.length - 2, Math.floor(position));
  const t = position - i;
  /** @param {Float64Array} table */
  const at = (table) => table[i] + t * (table[i + 1] - table[i]);
  return [at(cie.xbar), at(cie.ybar), at(cie.zbar)];
}

/**
 * Coordenadas de cromaticidad (x, y): el color sin el brillo.
 * @param {Triplet} XYZ
 * @returns {[number, number]}
 */
export function xyzToXy([X, Y, Z]) {
  const sum = X + Y + Z;
  return [X / sum, Y / sum];
}

/**
 * Cambia el brillo de un color sin cambiar su cromaticidad: escala XYZ para que Y valga
 * lo pedido.
 * @param {Triplet} XYZ
 * @param {number} [Y]
 * @returns {Triplet}
 */
export function normalizeLuminance([X, Y0, Z], Y = 1) {
  const s = Y / Y0;
  return [X * s, Y, Z * s];
}

// --- 2. XYZ ↔ sRGB lineal ------------------------------------------------------------------

/** Cromaticidades (x, y) de los primarios rojo, verde y azul de sRGB (IEC 61966-2-1). */
export const SRGB_PRIMARIES_XY = /** @type {const} */ ([
  [0.64, 0.33],
  [0.3, 0.6],
  [0.15, 0.06],
]);
/** Cromaticidad (x, y) del blanco de sRGB: D65 nominal. */
export const SRGB_WHITE_XY = /** @type {const} */ ([0.3127, 0.329]);

/**
 * Inversa de una matriz 3 × 3 (por adjuntos).
 * @param {number[][]} m
 * @returns {number[][]}
 */
function invert3([[a, b, c], [d, e, f], [g, h, i]]) {
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

/**
 * @param {number[][]} m
 * @param {readonly number[]} v
 * @returns {Triplet}
 */
function apply3(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/**
 * Matriz sRGB lineal → XYZ, deducida de la definición: cada columna es el XYZ de un
 * primario, con la escala que hace que R = G = B = 1 dé el blanco D65 con Y = 1.
 * @returns {number[][]}
 */
function buildSrgbToXyz() {
  // XYZ de cada primario con Y = 1: (x/y, 1, (1 − x − y)/y).
  const columns = SRGB_PRIMARIES_XY.map(([x, y]) => [x / y, 1, (1 - x - y) / y]);
  const primaries = [0, 1, 2].map((row) => columns.map((column) => column[row]));
  const [wx, wy] = SRGB_WHITE_XY;
  const white = [wx / wy, 1, (1 - wx - wy) / wy];
  const scale = apply3(invert3(primaries), white);
  return primaries.map((row) => row.map((value, j) => value * scale[j]));
}

const SRGB_TO_XYZ = buildSrgbToXyz();
const XYZ_TO_SRGB = invert3(SRGB_TO_XYZ);

/**
 * XYZ (con Y = 1 para el blanco) → sRGB lineal. Puede dar valores fuera de [0, 1].
 * @param {Triplet} XYZ
 * @returns {Triplet}
 */
export function xyzToLinearSrgb(XYZ) {
  return apply3(XYZ_TO_SRGB, XYZ);
}

/**
 * sRGB lineal → XYZ.
 * @param {Triplet} rgb
 * @returns {Triplet}
 */
export function linearSrgbToXyz(rgb) {
  return apply3(SRGB_TO_XYZ, rgb);
}

// --- 3. Gamma ---------------------------------------------------------------------------------

/**
 * Curva de transferencia de sRGB: de intensidad lineal (0–1) al valor que se envía a la
 * pantalla (0–1).
 * @param {number} c
 * @returns {number}
 */
export function encodeSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/**
 * Inversa de encodeSrgb.
 * @param {number} v
 * @returns {number}
 */
export function decodeSrgb(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

// --- 4. Color en pantalla -----------------------------------------------------------------

/**
 * XYZ → color de pantalla.
 * @param {Triplet} XYZ con Y = 1 para el blanco
 * @returns {{ rgb: Triplet, linear: Triplet, inGamut: boolean }}
 *   rgb: sRGB con gamma, recortado a [0, 1];  linear: sRGB lineal SIN recortar;
 *   inGamut: false si hubo que recortar (el color real es más saturado o más brillante
 *   de lo que la pantalla puede mostrar)
 */
export function xyzToSrgb(XYZ) {
  const linear = xyzToLinearSrgb(XYZ);
  const inGamut = linear.every((c) => c >= -GAMUT_TOLERANCE && c <= 1 + GAMUT_TOLERANCE);
  const rgb = /** @type {Triplet} */ (linear.map((c) => encodeSrgb(Math.min(1, Math.max(0, c)))));
  return { rgb, linear, inGamut };
}

/**
 * Color sRGB (0–1) como texto CSS.
 * @param {Triplet} rgb
 * @returns {string}
 */
export function srgbToCss([r, g, b]) {
  /** @param {number} v */
  const byte = (v) => Math.round(255 * Math.min(1, Math.max(0, v)));
  return `rgb(${byte(r)}, ${byte(g)}, ${byte(b)})`;
}

// --- CIELAB --------------------------------------------------------------------------------

/**
 * XYZ → CIELAB (L*, a*, b*), el espacio en el que las distancias se parecen a las
 * diferencias de color que percibimos.
 *   L*: claridad, de 0 (negro) a 100 (blanco).
 *   a*: de verde (negativo) a rojo (positivo).
 *   b*: de azul (negativo) a amarillo (positivo).
 * @param {Triplet} XYZ
 * @param {Triplet} white XYZ del blanco de referencia (ver illuminantWhite)
 * @returns {Triplet}
 */
export function xyzToLab(XYZ, white) {
  const delta = 6 / 29;
  /** @param {number} t */
  const f = (t) => (t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29);
  const fx = f(XYZ[0] / white[0]);
  const fy = f(XYZ[1] / white[1]);
  const fz = f(XYZ[2] / white[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Diferencia de color ΔE*ab (CIE 1976): distancia euclídea en CIELAB. Por debajo de ≈ 1
 * dos colores no se distinguen; alrededor de 2–3 la diferencia se nota al compararlos.
 * @param {Triplet} lab1
 * @param {Triplet} lab2
 * @returns {number}
 */
export function deltaE(lab1, lab2) {
  return Math.hypot(lab1[0] - lab2[0], lab1[1] - lab2[1], lab1[2] - lab2[2]);
}

// --- Fachada ---------------------------------------------------------------------------------

/**
 * Color completo de un espectro.
 * @typedef {object} SpectrumColor
 * @property {Triplet} XYZ
 * @property {[number, number]} xy cromaticidad
 * @property {Triplet} rgb sRGB con gamma, recortado a [0, 1]
 * @property {Triplet} linear sRGB lineal sin recortar
 * @property {boolean} inGamut false si el color no cabe en sRGB y se recortó
 * @property {Triplet} lab CIELAB respecto al blanco del iluminante
 * @property {string} css 'rgb(r, g, b)'
 */

/**
 * Crea el motor de color sobre unos datos CIE ya cargados.
 * @param {CieData} cie
 */
export function createColorEngine(cie) {
  return {
    cie,
    /**
     * Color de un espectro de transmitancia o reflectancia bajo un iluminante.
     * @param {Spectrum} spectrum
     * @param {{ illuminant?: IlluminantName }} [options]
     * @returns {SpectrumColor}
     */
    colorOf(spectrum, { illuminant = 'D65' } = {}) {
      const XYZ = spectrumToXYZ(cie, spectrum, { illuminant });
      const first = Math.ceil(spectrum.wavelengths[0]);
      const last = Math.floor(spectrum.wavelengths[spectrum.wavelengths.length - 1]);
      const white = illuminantWhite(cie, illuminant, [first, last]);
      const screen = xyzToSrgb(XYZ);
      return { XYZ, xy: xyzToXy(XYZ), ...screen, lab: xyzToLab(XYZ, white), css: srgbToCss(screen.rgb) };
    },
    /**
     * Color de una luz (espectro de emisión), llevado a la luminancia Y indicada.
     * @param {Spectrum} spectrum
     * @param {{ Y?: number }} [options] Y: luminancia relativa con la que se muestra (0–1)
     * @returns {{ XYZ: Triplet, xy: [number, number], rgb: Triplet, linear: Triplet, inGamut: boolean, css: string }}
     */
    colorOfLight(spectrum, { Y = 1 } = {}) {
      const XYZ = normalizeLuminance(spectrumToXYZ(cie, spectrum, { kind: 'emission' }), Y);
      const screen = xyzToSrgb(XYZ);
      return { XYZ, xy: xyzToXy(XYZ), ...screen, css: srgbToCss(screen.rgb) };
    },
    /**
     * Color aproximado de una luz monocromática (para pintar el espectro visible). Casi
     * ningún color espectral cabe en sRGB: se muestra el más parecido, recortado.
     * @param {number} lambda nm
     * @param {number} [gain] factor de brillo antes de recortar
     * @returns {Triplet} sRGB con gamma (0–1)
     */
    wavelengthToSrgb(lambda, gain = 1) {
      const linear = xyzToLinearSrgb(monochromaticXYZ(cie, lambda));
      return /** @type {Triplet} */ (linear.map((c) => encodeSrgb(Math.min(1, Math.max(0, c * gain)))));
    },
  };
}

/** @typedef {ReturnType<typeof createColorEngine>} ColorEngine */

/**
 * Carga los datos CIE y devuelve el motor de color listo para usar.
 * @returns {Promise<ColorEngine>}
 */
export async function loadColorEngine() {
  return createColorEngine(await loadCie());
}
