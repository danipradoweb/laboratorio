// @ts-check
// Importador del formato YAML de la base de datos de refractiveindex.info
// (https://github.com/polyanskiy/refractiveindex.info-database, dominio público CC0 1.0).
//
// Son funciones puras (texto de entrada, objetos de salida) para poder probarlas en
// tests/materials.test.js. Quien descarga y escribe archivos es tools/materials.mjs.
//
// No es un lector general de YAML: entiende solo la forma que tienen los archivos de
// esa base de datos:
//
//   REFERENCES: |            texto en varias líneas (con algo de HTML)
//       P. B. Johnson and R. W. Christy. …
//   COMMENTS: |
//       Room temperature
//   DATA:
//     - type: tabulated nk   una fila por longitud de onda: λ(µm) n k
//       data: |
//           0.1879 1.28 1.188
//           …
//
// Tipos de datos admitidos:
//   tabulated nk   λ(µm), n, k
//   tabulated n    λ(µm), n          (k = 0)
//   formula 1      Sellmeier: n² − 1 = c₁ + Σ c₂ᵢ·λ² / (λ² − c₂ᵢ₊₁²), λ en µm (k = 0)
// Cualquier otro tipo (o varios bloques DATA en un mismo archivo) produce un error que
// dice qué falta: ampliar el importador es mejor que importar algo a medias.

/**
 * @typedef {object} DataBlock
 * @property {string} type por ejemplo 'tabulated nk' o 'formula 1'
 * @property {string} [data] filas de la tabla, una por línea
 * @property {string} [wavelength_range] 'mínimo máximo' en µm (fórmulas)
 * @property {string} [coefficients] coeficientes de la fórmula separados por espacios
 */

/**
 * @typedef {object} ParsedYaml
 * @property {string} references texto de REFERENCES tal cual (con HTML)
 * @property {string} comments texto de COMMENTS tal cual
 * @property {DataBlock[]} data
 */

/**
 * Sangría de una línea (número de espacios iniciales).
 * @param {string} line
 */
const indentOf = (line) => line.length - line.trimStart().length;

/**
 * Lee el texto de un archivo de la base de datos.
 * @param {string} text
 * @returns {ParsedYaml}
 */
export function parseRefractiveIndexYaml(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  /** @type {Record<string, string>} */
  const top = {};
  /** @type {DataBlock[]} */
  const data = [];
  let i = 0;

  /**
   * Lee un bloque de texto literal ("clave: |"): todas las líneas siguientes con más
   * sangría que la clave. Devuelve las líneas sin su sangría común.
   * @param {number} keyIndent
   * @returns {string}
   */
  function readBlock(keyIndent) {
    /** @type {string[]} */
    const block = [];
    while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > keyIndent)) {
      block.push(lines[i]);
      i++;
    }
    while (block.length > 0 && block[block.length - 1].trim() === '') block.pop();
    const common = Math.min(...block.filter((l) => l.trim() !== '').map(indentOf));
    return block.map((l) => l.slice(common)).join('\n');
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }
    const match = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!match) throw new SyntaxError(`línea ${i + 1}: no se entiende "${line}"`);
    const [, key, rest] = match;
    i++;
    if (key === 'DATA') {
      // Lista de bloques: cada uno empieza con "- type: …".
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0)) {
        const entry = lines[i];
        if (entry.trim() === '') {
          i++;
          continue;
        }
        const item = entry.match(/^(\s*)(-\s+)?([A-Za-z_]+):\s*(.*)$/);
        if (!item) throw new SyntaxError(`línea ${i + 1}: no se entiende "${entry}"`);
        const [, spaces, dash, itemKey, itemRest] = item;
        const keyIndent = spaces.length + (dash ? dash.length : 0);
        i++;
        if (dash) data.push({ type: '' });
        const block = data[data.length - 1];
        if (!block) throw new SyntaxError(`línea ${i}: se esperaba "- type: …" dentro de DATA`);
        const value = itemRest.trim() === '|' ? readBlock(keyIndent) : itemRest.trim();
        /** @type {Record<string, string>} */ (/** @type {unknown} */ (block))[itemKey] = value;
      }
    } else if (rest.trim() === '|') {
      top[key] = readBlock(0);
    } else if (rest.trim() === '') {
      // Sección con subclaves que no se usan (CONDITIONS, PROPERTIES…): se salta.
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0)) i++;
    } else {
      top[key] = rest.trim();
    }
  }
  if (data.length === 0) throw new SyntaxError('el archivo no tiene sección DATA');
  return { references: top.REFERENCES ?? '', comments: top.COMMENTS ?? '', data };
}

/**
 * Quita las etiquetas HTML y deja el texto en una línea.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Micrómetros → nanómetros sin ruido de redondeo binario (0,1879 µm → 187,9 nm exactos).
 * Los datos de la base tienen como mucho 10 cifras significativas.
 * @param {number} micrometers
 * @returns {number}
 */
export function micrometersToNm(micrometers) {
  return Number((micrometers * 1000).toPrecision(12));
}

/**
 * Fórmula 1 de refractiveindex.info (Sellmeier).
 * @param {number[]} c coeficientes [c₁, c₂, c₃, …]
 * @param {number} micrometers longitud de onda en µm
 * @returns {number} índice de refracción n
 */
export function sellmeierFormula1(c, micrometers) {
  const l2 = micrometers * micrometers;
  let n2 = 1 + c[0];
  for (let j = 1; j + 1 < c.length; j += 2) n2 += (c[j] * l2) / (l2 - c[j + 1] * c[j + 1]);
  return Math.sqrt(n2);
}

/**
 * Malla (nm) en la que se tabula un material dado por una fórmula: de `step` en `step`
 * hasta `fineUntil` y de `coarseStep` en `coarseStep` después, incluyendo siempre los
 * dos extremos del intervalo de validez.
 * @param {number} min nm
 * @param {number} max nm
 * @param {{ step?: number, fineUntil?: number, coarseStep?: number }} [grid]
 * @returns {number[]}
 */
export function formulaGrid(min, max, { step = 5, fineUntil = 1000, coarseStep = 50 } = {}) {
  const points = [min];
  let x = Math.ceil((min + 1e-9) / step) * step;
  while (x < Math.min(max, fineUntil)) {
    points.push(x);
    x += step;
  }
  x = Math.max(x, Math.ceil((fineUntil - 1e-9) / coarseStep) * coarseStep);
  while (x < max) {
    points.push(x);
    x += coarseStep;
  }
  points.push(max);
  return points;
}

/**
 * Convierte un archivo de la base de datos en tablas λ (nm), n, k ordenadas por λ.
 * @param {string} yamlText
 * @param {{ grid?: { step?: number, fineUntil?: number, coarseStep?: number } }} [options]
 *   grid: malla para tabular las fórmulas
 * @returns {{ type: string, wavelength_nm: number[], n: number[], k: number[], references: string, comments: string,
 *   formula?: { tipo: number, coeficientes: number[], intervalo_nm: [number, number] } }}
 */
export function importRefractiveIndexYaml(yamlText, { grid } = {}) {
  const parsed = parseRefractiveIndexYaml(yamlText);
  if (parsed.data.length !== 1) {
    throw new RangeError(
      `el archivo tiene ${parsed.data.length} bloques DATA (${parsed.data.map((d) => d.type).join(', ')}); el importador solo admite uno`,
    );
  }
  const block = parsed.data[0];
  const base = { type: block.type, references: stripHtml(parsed.references), comments: stripHtml(parsed.comments) };

  if (block.type === 'tabulated nk' || block.type === 'tabulated n') {
    const columns = block.type === 'tabulated nk' ? 3 : 2;
    const rows = (block.data ?? '')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line, index) => {
        const fields = line.trim().split(/\s+/).map(Number);
        if (fields.length !== columns || fields.some((v) => !Number.isFinite(v))) {
          throw new SyntaxError(`fila ${index + 1} de la tabla: se esperaban ${columns} números y hay "${line.trim()}"`);
        }
        return fields;
      });
    if (rows.length < 2) throw new RangeError('la tabla tiene menos de dos filas');
    rows.sort((a, b) => a[0] - b[0]);
    for (let r = 1; r < rows.length; r++) {
      if (rows[r][0] === rows[r - 1][0]) throw new RangeError(`longitud de onda repetida en la tabla: ${rows[r][0]} µm`);
    }
    return {
      ...base,
      wavelength_nm: rows.map((r) => micrometersToNm(r[0])),
      n: rows.map((r) => r[1]),
      k: rows.map((r) => (columns === 3 ? r[2] : 0)),
    };
  }

  if (block.type === 'formula 1') {
    const coefficients = (block.coefficients ?? '').trim().split(/\s+/).map(Number);
    const range = (block.wavelength_range ?? '').trim().split(/\s+/).map(Number);
    if (coefficients.length < 3 || coefficients.length % 2 !== 1 || coefficients.some((v) => !Number.isFinite(v))) {
      throw new SyntaxError(`fórmula 1: coeficientes no válidos "${block.coefficients}"`);
    }
    if (range.length !== 2 || !(range[0] < range[1])) throw new SyntaxError(`fórmula 1: wavelength_range no válido "${block.wavelength_range}"`);
    const min = micrometersToNm(range[0]);
    const max = micrometersToNm(range[1]);
    const wavelengths = formulaGrid(min, max, grid);
    return {
      ...base,
      wavelength_nm: wavelengths,
      n: wavelengths.map((nm) => sellmeierFormula1(coefficients, nm / 1000)),
      k: wavelengths.map(() => 0),
      formula: { tipo: 1, coeficientes: coefficients, intervalo_nm: [min, max] },
    };
  }

  throw new RangeError(
    `tipo de datos "${block.type}" no admitido por el importador (admite: tabulated nk, tabulated n, formula 1). ` +
      'Amplía tools/refractiveindex-yaml.mjs y añade su test.',
  );
}
