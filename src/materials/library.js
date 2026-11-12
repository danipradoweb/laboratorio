// @ts-check
// Biblioteca de materiales: constantes ópticas n(λ), k(λ) con su fuente y sus metadatos.
//
//   const gold = await loadMaterial('Au');
//   gold.nombre;                 // 'Oro'
//   gold.familia;                // 'metal'
//   gold.mecanismo;              // por qué tiene el color que tiene, en una frase
//   gold.fuente.referencia;      // 'P. B. Johnson and R. W. Christy. …'
//   const optical = createOpticalConstants(gold);    // ver dielectric.js
//   optical.epsilon(532);        // ε en 532 nm
//
//   const todos = await loadMaterialIndex();   // resumen de todos, sin descargar las tablas
//
// Los datos están en data/materials/<id>.json. Los genera tools/materials.mjs a partir de
// la base de datos de refractiveindex.info (dominio público, CC0 1.0); los nombres de los
// campos de metadatos están en español porque son datos, no código. Para añadir un
// material: una entrada en data/materials/catalogo.json y ejecutar la herramienta (ver
// src/materials/LEEME.md).

import { loadJSON } from '../core/load-json.js';

/**
 * Material tal como está en data/materials/<id>.json.
 * @typedef {object} Material
 * @property {string} id identificador (nombre del archivo)
 * @property {string} nombre
 * @property {string} formula fórmula química
 * @property {string} familia 'metal', 'semiconductor', 'dieléctrico', 'líquido'…
 * @property {string} mecanismo origen de su color o de su transparencia, en una frase
 * @property {string[]} modulos identificadores de los módulos donde se explica
 * @property {{ referencia: string, comentarios: string, base_de_datos: string, archivo: string, commit: string, url: string }} fuente
 * @property {string} licencia
 * @property {string} tipo_de_datos 'tabulated nk', 'formula 1'…
 * @property {[number, number]} intervalo_nm primera y última longitud de onda tabuladas
 * @property {number[]} wavelength_nm longitudes de onda en el vacío (nm), crecientes
 * @property {number[]} n índice de refracción
 * @property {number[]} k coeficiente de extinción (≥ 0)
 */

/**
 * Entrada del resumen data/materials/index.json.
 * @typedef {object} MaterialSummary
 * @property {string} id
 * @property {string} nombre
 * @property {string} formula
 * @property {string} familia
 * @property {string} mecanismo
 * @property {string[]} modulos
 * @property {[number, number]} intervalo_nm
 * @property {number} puntos
 * @property {string} referencia
 * @property {string} url
 * @property {string} licencia
 */

/**
 * Comprueba que un objeto tiene la forma de un material y que sus tablas son coherentes.
 * Lanza un error que dice qué falla (un JSON a medias no debe llegar a la física).
 * @param {any} material
 * @returns {Material}
 */
export function validateMaterial(material) {
  const id = material?.id ?? '(sin id)';
  /** @param {boolean} condition @param {string} message */
  const need = (condition, message) => {
    if (!condition) throw new RangeError(`material ${id}: ${message}`);
  };
  need(typeof material?.id === 'string' && material.id.length > 0, 'falta id');
  for (const key of ['nombre', 'familia', 'mecanismo', 'licencia']) {
    need(typeof material[key] === 'string' && material[key].trim().length > 0, `falta "${key}"`);
  }
  need(Array.isArray(material.modulos), 'falta la lista "modulos"');
  need(typeof material.fuente?.referencia === 'string' && material.fuente.referencia.length > 0, 'falta fuente.referencia');
  const { wavelength_nm: w, n, k } = material;
  need(Array.isArray(w) && Array.isArray(n) && Array.isArray(k), 'faltan las tablas wavelength_nm, n, k');
  need(w.length >= 2 && n.length === w.length && k.length === w.length, 'las tablas deben tener la misma longitud (≥ 2)');
  for (let i = 0; i < w.length; i++) {
    need(Number.isFinite(w[i]) && Number.isFinite(n[i]) && Number.isFinite(k[i]), `valor no numérico en la fila ${i}`);
    need(i === 0 || w[i] > w[i - 1], `wavelength_nm no es creciente en la fila ${i}`);
    need(w[i] > 0, `longitud de onda no positiva en la fila ${i}`);
    need(k[i] >= 0, `k negativo en la fila ${i} (con el convenio e^{−iωt}, absorber es k > 0)`);
  }
  return material;
}

/**
 * Carga un material por su identificador (una sola descarga por material).
 * @param {string} id por ejemplo 'Au'
 * @returns {Promise<Material>}
 */
export async function loadMaterial(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new RangeError(`identificador de material no válido: "${id}"`);
  return validateMaterial(await loadJSON(new URL(`../../data/materials/${id}.json`, import.meta.url)));
}

/**
 * Resumen de todos los materiales de la biblioteca (para listas, selectores y créditos).
 * @returns {Promise<MaterialSummary[]>}
 */
export async function loadMaterialIndex() {
  const index = await loadJSON(new URL('../../data/materials/index.json', import.meta.url));
  return index.materiales;
}
