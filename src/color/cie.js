// @ts-check
// Datos colorimétricos de la CIE: funciones de igualación de color del observador patrón
// de 1931 (2°) e iluminantes D65, A y E.
//
//   const cie = await loadCie();
//   cie.xbar[cie.indexOf(555)];        // x̄(555 nm)
//   cie.illuminants.D65.values;        // potencia relativa de D65, nm a nm
//
// Los datos están en data/cie/ (generados por tools/cie.py a partir de colour-science).
// Aquí solo se colocan todos sobre la misma malla: de 360 a 830 nm, de 1 en 1 nm.
//
// Los iluminantes D65 y A están tabulados por la CIE cada 5 nm y hasta 780 nm. Se pasan
// a 1 nm por interpolación lineal (la que recomienda la CIE) y NO se extrapolan: fuera de
// su tabla valen NaN y `range` dice hasta dónde llegan. El motor de color integra solo
// donde hay datos (la zona de 780 a 830 nm aporta menos de una cienmilésima del total).

import { loadJSON } from '../core/load-json.js';

/** Primera longitud de onda de la malla común (nm). */
export const CIE_START_NM = 360;
/** Última longitud de onda de la malla común (nm). */
export const CIE_END_NM = 830;
/** Número de puntos de la malla común (uno por nanómetro). */
export const CIE_COUNT = CIE_END_NM - CIE_START_NM + 1;

/** Nombres de los iluminantes disponibles. */
export const ILLUMINANT_NAMES = /** @type {const} */ (['D65', 'A', 'E']);

/**
 * @typedef {'D65' | 'A' | 'E'} IlluminantName
 */

/**
 * Iluminante sobre la malla común.
 * @typedef {object} Illuminant
 * @property {string} description
 * @property {Float64Array} values potencia espectral relativa en cada nm de la malla
 *   común; NaN fuera del intervalo tabulado
 * @property {[number, number]} range intervalo tabulado (nm)
 */

/**
 * @typedef {object} CieData
 * @property {Float64Array} wavelengths 360, 361, …, 830 (nm)
 * @property {Float64Array} xbar x̄(λ)
 * @property {Float64Array} ybar ȳ(λ) (sensibilidad luminosa)
 * @property {Float64Array} zbar z̄(λ)
 * @property {Record<IlluminantName, Illuminant>} illuminants
 */

/**
 * Tabla tal como está en los archivos JSON: valores equiespaciados desde start_nm.
 * @typedef {{ start_nm: number, step_nm: number, values: number[], descripcion?: string }} RawTable
 */

/**
 * Pasa una tabla equiespaciada a la malla común por interpolación lineal, sin extrapolar.
 * @param {RawTable} table
 * @returns {{ values: Float64Array, range: [number, number] }}
 */
export function resampleToCieGrid(table) {
  const { start_nm: start, step_nm: step, values } = table;
  const end = start + step * (values.length - 1);
  const out = new Float64Array(CIE_COUNT).fill(NaN);
  for (let i = 0; i < CIE_COUNT; i++) {
    const lambda = CIE_START_NM + i;
    if (lambda < start || lambda > end) continue;
    const position = (lambda - start) / step;
    const j = Math.min(values.length - 2, Math.floor(position));
    const t = position - j;
    out[i] = values[j] + t * (values[j + 1] - values[j]);
  }
  return { values: out, range: [Math.max(start, CIE_START_NM), Math.min(end, CIE_END_NM)] };
}

/**
 * Construye los datos CIE a partir del contenido de los dos archivos JSON. Es una función
 * pura (los tests la usan igual que el navegador).
 * @param {{ start_nm: number, step_nm: number, xbar: number[], ybar: number[], zbar: number[] }} cmf
 * @param {{ illuminants: Record<string, RawTable> }} illuminantFile
 * @returns {CieData}
 */
export function buildCieData(cmf, illuminantFile) {
  if (cmf.start_nm !== CIE_START_NM || cmf.step_nm !== 1 || cmf.xbar.length !== CIE_COUNT) {
    throw new RangeError('cie: las funciones de igualación deben ir de 360 a 830 nm cada 1 nm');
  }
  const illuminants = /** @type {Record<IlluminantName, Illuminant>} */ ({});
  for (const name of ILLUMINANT_NAMES) {
    const table = illuminantFile.illuminants[name];
    if (!table) throw new RangeError(`cie: falta el iluminante ${name}`);
    illuminants[name] = { description: table.descripcion ?? name, ...resampleToCieGrid(table) };
  }
  return {
    wavelengths: Float64Array.from({ length: CIE_COUNT }, (_, i) => CIE_START_NM + i),
    xbar: Float64Array.from(cmf.xbar),
    ybar: Float64Array.from(cmf.ybar),
    zbar: Float64Array.from(cmf.zbar),
    illuminants,
  };
}

/** @type {Promise<CieData> | null} */
let cached = null;

/**
 * Carga los datos CIE (una sola vez; las llamadas siguientes reciben lo mismo).
 * @returns {Promise<CieData>}
 */
export function loadCie() {
  if (!cached) {
    cached = Promise.all([
      loadJSON(new URL('../../data/cie/cmf-cie1931-2deg.json', import.meta.url)),
      loadJSON(new URL('../../data/cie/illuminants.json', import.meta.url)),
    ]).then(([cmf, illuminantFile]) => buildCieData(cmf, illuminantFile));
    cached.catch(() => {
      cached = null; // un fallo de red no debe quedar guardado
    });
  }
  return cached;
}
