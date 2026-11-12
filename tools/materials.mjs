// @ts-check
// Genera la biblioteca de materiales de data/materials/ a partir de la base de datos de
// refractiveindex.info (dominio público, CC0 1.0).
//
// Uso:  node tools/materials.mjs              usa las copias de data/materials/originales/
//                                             y descarga solo las que falten
//       node tools/materials.mjs --descargar  vuelve a descargar todos los originales
//
// Para añadir un material: añade una entrada a data/materials/catalogo.json (el único
// archivo que se edita a mano) y ejecuta este script. Escribe:
//   data/materials/originales/<id>.yml   copia exacta del archivo de la base de datos
//   data/materials/<id>.json             λ (nm), n, k, fuente, licencia y metadatos
//   data/materials/index.json            resumen de todos (para listas y créditos)
// Después ejecuta tools/materials_fixture.py para poner al día la referencia de los tests.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { importRefractiveIndexYaml } from './refractiveindex-yaml.mjs';

const dir = new URL('../data/materials/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('catalogo.json', dir), 'utf8'));
const forceDownload = process.argv.includes('--descargar');
const rawBase = `https://raw.githubusercontent.com/polyanskiy/refractiveindex.info-database/${catalog._commit}/database/data/`;

mkdirSync(new URL('originales/', dir), { recursive: true });

/**
 * JSON con sangría, pero con cada lista de números en una sola línea (las tablas de
 * 1000 puntos no ocupan 1000 líneas).
 * @param {unknown} value
 * @returns {string}
 */
function stringify(value) {
  return JSON.stringify(value, null, 1).replace(/\[\s*(-?[\d.eE+-]+(?:,\s*-?[\d.eE+-]+)*)\s*\]/g, (_match, list) => `[${list.replace(/\s+/g, ' ')}]`) + '\n';
}

/** Resumen de cada material, para index.json. @type {object[]} */
const index = [];

for (const entry of catalog.materiales) {
  const original = new URL(`originales/${entry.id}.yml`, dir);
  if (forceDownload || !existsSync(original)) {
    const response = await fetch(rawBase + entry.archivo);
    if (!response.ok) throw new Error(`No se pudo descargar ${entry.archivo} (HTTP ${response.status})`);
    writeFileSync(original, await response.text());
    console.log(`Descargado ${entry.archivo}`);
  }
  const imported = importRefractiveIndexYaml(readFileSync(original, 'utf8'));
  const range = [imported.wavelength_nm[0], imported.wavelength_nm[imported.wavelength_nm.length - 1]];
  const material = {
    id: entry.id,
    nombre: entry.nombre,
    formula: entry.formula,
    familia: entry.familia,
    mecanismo: entry.mecanismo,
    modulos: entry.modulos,
    fuente: {
      referencia: imported.references,
      comentarios: imported.comments,
      base_de_datos: 'refractiveindex.info',
      archivo: `database/data/${entry.archivo}`,
      commit: catalog._commit,
      url: `https://refractiveindex.info/?${entry.pagina}`,
    },
    licencia: catalog._licencia,
    tipo_de_datos: imported.type,
    ...(imported.formula ? { formula_original: imported.formula } : {}),
    _generado_por: 'tools/materials.mjs (no editar a mano)',
    intervalo_nm: range,
    wavelength_nm: imported.wavelength_nm,
    n: imported.n,
    k: imported.k,
  };
  writeFileSync(new URL(`${entry.id}.json`, dir), stringify(material));
  index.push({
    id: entry.id,
    nombre: entry.nombre,
    formula: entry.formula,
    familia: entry.familia,
    mecanismo: entry.mecanismo,
    modulos: entry.modulos,
    intervalo_nm: range,
    puntos: imported.wavelength_nm.length,
    referencia: imported.references,
    url: material.fuente.url,
    licencia: catalog._licencia,
  });
  console.log(`${entry.id}: ${imported.type}, ${imported.wavelength_nm.length} puntos, ${range[0]}–${range[1]} nm`);
}

writeFileSync(
  new URL('index.json', dir),
  stringify({
    _descripcion: 'Resumen de la biblioteca de materiales (generado por tools/materials.mjs; no editar a mano)',
    _base_de_datos: catalog._base_de_datos,
    _commit: catalog._commit,
    _licencia: catalog._licencia,
    materiales: index,
  }),
);
console.log(`Escrito data/materials/index.json (${index.length} materiales)`);
