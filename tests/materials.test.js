// @ts-check
// Tests de la biblioteca de materiales: el importador del formato de refractiveindex.info
// (tools/refractiveindex-yaml.mjs), los datos de data/materials/, src/materials/library.js
// y src/materials/dielectric.js.
//
// Referencias: los archivos originales de la base de datos leídos con PyYAML
// (tests/fixtures/materials.json, generado por tools/materials_fixture.py), identidades
// exactas entre (n, k) y ε, y límites analíticos de los modelos de Drude y Lorentz.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formulaGrid,
  importRefractiveIndexYaml,
  micrometersToNm,
  parseRefractiveIndexYaml,
  sellmeierFormula1,
  stripHtml,
} from '../tools/refractiveindex-yaml.mjs';
import { loadMaterial, loadMaterialIndex, validateMaterial } from '../src/materials/library.js';
import { createOpticalConstants, drudeEpsilon, epsilonToNk, lorentzEpsilon, nkToEpsilon } from '../src/materials/dielectric.js';
import { complexResponse } from '../src/modules/oscilador/physics.js';

/** @param {string} path relativo a la raíz del repositorio */
const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const catalog = JSON.parse(readText('data/materials/catalogo.json'));
const reference = JSON.parse(readText('tests/fixtures/materials.json')).materiales;
/** @type {string[]} */
const ids = catalog.materiales.map((/** @type {{ id: string }} */ m) => m.id);

// --- Lector del formato ---------------------------------------------------------------------

const SAMPLE = `# comentario inicial
REFERENCES: |
    A. Autor and B. Otra.
    Título del artículo.
    <a href="https://doi.org/10.0000/x"><i>Rev. Inventada</i> <b>1</b>, 2-3 (1999)</a>
COMMENTS: |
    Room temperature
DATA:
  - type: tabulated nk
    data: |
        0.5 1.5 0.01
        0.4 1.6 0.02
        0.6 1.4 1.0E-3
CONDITIONS:
    temperature: 293
`;

// El lector separa las secciones, conserva el texto de las tablas tal cual y salta las
// secciones que no usa. Es un test de formato, no de física.
test('importador: lee las secciones de un archivo de refractiveindex.info', () => {
  const parsed = parseRefractiveIndexYaml(SAMPLE);
  assert.equal(parsed.data.length, 1);
  assert.equal(parsed.data[0].type, 'tabulated nk');
  assert.equal(parsed.data[0].data, '0.5 1.5 0.01\n0.4 1.6 0.02\n0.6 1.4 1.0E-3');
  assert.equal(parsed.comments, 'Room temperature');
  assert.equal(stripHtml(parsed.references), 'A. Autor and B. Otra. Título del artículo. Rev. Inventada 1, 2-3 (1999)');
});

// Los datos se conservan: mismas filas, mismos números, ordenados por longitud de onda,
// y la longitud de onda pasa de µm a nm sin ruido de redondeo (0,5 µm = 500 nm exactos).
test('importador: conserva los números, ordena por λ y pasa de µm a nm', () => {
  const imported = importRefractiveIndexYaml(SAMPLE);
  assert.deepEqual(imported.wavelength_nm, [400, 500, 600]);
  assert.deepEqual(imported.n, [1.6, 1.5, 1.4]);
  assert.deepEqual(imported.k, [0.02, 0.01, 0.001]);
  assert.equal(micrometersToNm(0.1879), 187.9);
  assert.equal(micrometersToNm(0.120181141), 120.181141);
  assert.equal(micrometersToNm(1.2399e-4), 0.12399);
});

test('importador: tabla solo de n, y errores claros con lo que no entiende', () => {
  const onlyN = importRefractiveIndexYaml('DATA:\n  - type: tabulated n\n    data: |\n        0.4 1.5\n        0.7 1.4\n');
  assert.deepEqual(onlyN.k, [0, 0]);
  assert.throws(() => importRefractiveIndexYaml('DATA:\n  - type: formula 2\n    coefficients: 0 1 2\n'), /no admitido/);
  assert.throws(() => importRefractiveIndexYaml('DATA:\n  - type: tabulated nk\n    data: |\n        0.4 1.5\n        0.7 1.4 0\n'), /fila 1/);
  assert.throws(() => importRefractiveIndexYaml('DATA:\n  - type: tabulated n\n    data: |\n        0.4 1.5\n        0.4 1.4\n'), /repetida/);
  assert.throws(
    () => importRefractiveIndexYaml('DATA:\n  - type: formula 1\n    coefficients: 0 1 0.1\n  - type: tabulated k\n    data: |\n        0.4 1\n'),
    /solo admite uno/,
  );
  assert.throws(() => parseRefractiveIndexYaml('REFERENCES: |\n    nada\n'), /DATA/);
});

// Fórmula 1 (Sellmeier) con un solo término: n² = 1 + B·λ²/(λ² − C²). Con B = 3 y C = 0
// es n = 2 a cualquier λ; con C = 0,1 µm y λ = 0,2 µm, n² = 1 + 3·0,04/0,03 = 5.
test('fórmula de Sellmeier: valores exactos de un término', () => {
  assert.equal(sellmeierFormula1([0, 3, 0], 0.5), 2);
  assert.ok(Math.abs(sellmeierFormula1([0, 3, 0.1], 0.2) - Math.sqrt(5)) < 1e-15);
  // La malla de tabulación incluye los extremos y es estrictamente creciente.
  const grid = formulaGrid(210, 6700);
  assert.equal(grid[0], 210);
  assert.equal(grid[grid.length - 1], 6700);
  for (let i = 1; i < grid.length; i++) assert.ok(grid[i] > grid[i - 1]);
  assert.ok(grid.includes(500) && grid.includes(1000) && grid.includes(2000));
});

// --- Los datos de la biblioteca ------------------------------------------------------------

// Cada JSON de data/materials/ coincide con lo que PyYAML (un lector independiente) saca
// del archivo original: mismo número de filas y los mismos números. La longitud de onda
// se compara a 10⁻⁹ nm (la referencia redondea el producto µm × 1000); n y k, exactos.
for (const id of ids) {
  test(`[${id}] el JSON conserva los datos del archivo original (referencia: PyYAML)`, async () => {
    const material = await loadMaterial(id);
    const ref = reference[id];
    assert.equal(material.tipo_de_datos, ref.tipo);
    if (ref.tipo === 'formula 1') {
      // Material dado por una fórmula: la referencia la evalúa con numpy en su propia malla.
      const formula = /** @type {any} */ (material).formula_original;
      assert.deepEqual(formula.coeficientes, ref.coeficientes);
      assert.deepEqual(formula.intervalo_nm, ref.intervalo_nm);
      assert.deepEqual(material.intervalo_nm, ref.intervalo_nm);
      ref.wavelength_nm.forEach((/** @type {number} */ nm, /** @type {number} */ i) => {
        assert.ok(Math.abs(sellmeierFormula1(formula.coeficientes, nm / 1000) - ref.n[i]) < 1e-12, `n(${nm} nm)`);
      });
      // Y la tabla guardada es la fórmula evaluada en la malla del JSON, con k = 0.
      material.wavelength_nm.forEach((nm, i) => {
        assert.equal(material.n[i], sellmeierFormula1(formula.coeficientes, nm / 1000));
        assert.equal(material.k[i], 0);
      });
      return;
    }
    assert.equal(material.wavelength_nm.length, ref.filas);
    assert.equal(ref.wavelength_nm.length, ref.filas);
    for (let i = 0; i < ref.filas; i++) {
      assert.ok(Math.abs(material.wavelength_nm[i] - ref.wavelength_nm[i]) < 1e-9, `λ de la fila ${i}`);
      assert.equal(material.n[i], ref.n[i], `n de la fila ${i}`);
      assert.equal(material.k[i], ref.k[i], `k de la fila ${i}`);
    }
  });

  // El JSON versionado es exactamente lo que el importador produce hoy a partir del
  // original versionado (si alguien edita uno de los dos a mano, este test lo detecta).
  test(`[${id}] el JSON está al día con data/materials/originales/${id}.yml`, async () => {
    const material = await loadMaterial(id);
    const imported = importRefractiveIndexYaml(readText(`data/materials/originales/${id}.yml`));
    assert.deepEqual(material.wavelength_nm, imported.wavelength_nm);
    assert.deepEqual(material.n, imported.n);
    assert.deepEqual(material.k, imported.k);
    assert.equal(material.fuente.referencia, imported.references);
    assert.deepEqual(material.intervalo_nm, [imported.wavelength_nm[0], imported.wavelength_nm[imported.wavelength_nm.length - 1]]);
  });
}

// Metadatos: todo material declara familia, mecanismo, módulos, fuente y licencia
// (docs/ARQUITECTURA.md, "Biblioteca de materiales"), y el resumen index.json dice lo
// mismo que cada archivo.
test('todos los materiales tienen metadatos completos y el índice es coherente', async () => {
  const index = await loadMaterialIndex();
  assert.deepEqual(index.map((m) => m.id), ids);
  for (const summary of index) {
    const material = await loadMaterial(summary.id);
    assert.ok(catalog._familias.includes(material.familia), `${material.id}: familia "${material.familia}" no está en el catálogo`);
    assert.ok(material.mecanismo.length > 40, `${material.id}: mecanismo demasiado breve`);
    assert.match(material.licencia, /CC0/);
    assert.match(material.fuente.url, /^https:\/\/refractiveindex\.info\/\?shelf=/);
    assert.equal(material.fuente.commit, catalog._commit);
    assert.equal(summary.nombre, material.nombre);
    assert.equal(summary.familia, material.familia);
    assert.equal(summary.puntos, material.wavelength_nm.length);
    assert.deepEqual(summary.intervalo_nm, material.intervalo_nm);
    assert.equal(summary.referencia, material.fuente.referencia);
  }
  // Los materiales que pide el encargo 01.
  for (const id of ['Au', 'Ag', 'Cu', 'Al', 'H2O', 'SiO2', 'TiO2', 'Si']) assert.ok(ids.includes(id), `falta ${id}`);
  const references = Object.fromEntries(index.map((m) => [m.id, m.referencia]));
  for (const id of ['Au', 'Ag', 'Cu']) assert.match(references[id], /Johnson and R\. W\. Christy.*1972/);
  assert.match(references.Al, /Rakić.*1995/);
  assert.match(references.SiO2, /Malitson/);
});

test('validateMaterial rechaza tablas incoherentes', () => {
  const good = { id: 'X', nombre: 'x', familia: 'metal', mecanismo: 'm', licencia: 'CC0', modulos: [], fuente: { referencia: 'r' }, wavelength_nm: [400, 500], n: [1, 1], k: [0, 0] };
  assert.equal(validateMaterial(good), good);
  assert.throws(() => validateMaterial({ ...good, wavelength_nm: [500, 400] }), /creciente/);
  assert.throws(() => validateMaterial({ ...good, k: [0, -0.1] }), /k negativo/);
  assert.throws(() => validateMaterial({ ...good, n: [1] }), /misma longitud/);
  assert.throws(() => validateMaterial({ ...good, mecanismo: ' ' }), /mecanismo/);
  assert.throws(() => validateMaterial({ ...good, fuente: {} }), /referencia/);
  assert.throws(() => validateMaterial(null), /falta id/);
});

test('loadMaterial rechaza identificadores que no son nombres de archivo simples', async () => {
  await assert.rejects(loadMaterial('../catalogo'), /no válido/);
  await assert.rejects(loadMaterial('NoExiste'));
});

// --- Valores físicos de control --------------------------------------------------------------

// Sílice fundida: índice en la línea d del helio (587,56 nm), n_d = 1,4585 (Malitson
// 1965; es el valor que dan los catálogos de vidrio óptico). La tabla del JSON,
// interpolada linealmente, lo reproduce a 10⁻⁴.
test('sílice fundida: n_d = 1,4585 en 587,56 nm', async () => {
  const silica = createOpticalConstants(await loadMaterial('SiO2'));
  assert.ok(Math.abs(silica.nk(587.56).n - 1.4585) < 1e-4, `n_d = ${silica.nk(587.56).n}`);
  assert.equal(silica.nk(587.56).k, 0);
});

// La tabla de la sílice (fórmula muestreada cada 5 nm hasta 1000 nm) interpolada
// linealmente no se aparta de la fórmula más de 10⁻⁴ en el visible e infrarrojo cercano.
// Cota: h²/8·|n″| con h = 5 nm y |n″| < 3·10⁻⁵ nm⁻² por encima de 250 nm.
test('sílice fundida: la tabla interpolada reproduce la fórmula de Sellmeier', async () => {
  const material = await loadMaterial('SiO2');
  const silica = createOpticalConstants(material);
  const coefficients = /** @type {any} */ (material).formula_original.coeficientes;
  let worst = 0;
  for (let nm = 250; nm <= 1000; nm += 0.7) {
    worst = Math.max(worst, Math.abs(silica.nk(nm).n - sellmeierFormula1(coefficients, nm / 1000)));
  }
  assert.ok(worst < 1e-4, `error máximo ${worst}`);
});

// Agua: n = 1,333 en la línea D del sodio (589 nm) a temperatura ambiente, valor de
// manual. La tabla de Hale & Querry da n con 3 decimales cada 25 nm: tolerancia 2·10⁻³.
// Y es transparente: k < 10⁻⁷ en todo el visible.
test('agua: n ≈ 1,333 en 589 nm y absorción despreciable en el visible', async () => {
  const water = createOpticalConstants(await loadMaterial('H2O'));
  assert.ok(Math.abs(water.nk(589).n - 1.333) < 2e-3, `n = ${water.nk(589).n}`);
  for (let nm = 400; nm <= 700; nm += 10) assert.ok(water.nk(nm).k < 1e-7);
});

// Metales nobles en el rojo (700 nm): Re ε < 0 (por debajo de la frecuencia de plasma la
// onda no se propaga: el metal refleja) e Im ε > 0 (absorbe). La plata es, de los tres,
// la de menor Im ε: es el metal con menos pérdidas en el visible (hecho bien establecido;
// por eso sus resonancias de plasmón son las más estrechas).
test('metales nobles a 700 nm: Re ε < 0, Im ε > 0 y la plata es la de menos pérdidas', async () => {
  /** @type {Record<string, import('../src/core/complex.js').Complex>} */
  const eps = {};
  for (const id of ['Au', 'Ag', 'Cu']) {
    eps[id] = createOpticalConstants(await loadMaterial(id)).epsilon(700);
    assert.ok(eps[id].re < -10, `${id}: Re ε = ${eps[id].re}`);
    assert.ok(eps[id].im > 0, `${id}: Im ε = ${eps[id].im}`);
  }
  assert.ok(eps.Ag.im < eps.Au.im && eps.Ag.im < eps.Cu.im);
});

// --- n, k ↔ ε -----------------------------------------------------------------------------------

// Identidades exactas: ε = (n + ik)² ⇒ Re ε = n² − k², Im ε = 2nk, |ε| = n² + k²; y la
// vuelta devuelve el mismo par. Se comprueba en todas las filas de todos los materiales.
test('consistencia n, k ↔ ε en todas las filas de todos los materiales', async () => {
  for (const id of ids) {
    const material = await loadMaterial(id);
    for (let i = 0; i < material.n.length; i++) {
      const n = material.n[i];
      const k = material.k[i];
      const eps = nkToEpsilon(n, k);
      assert.ok(Math.abs(eps.re - (n * n - k * k)) <= 1e-15 * (n * n + k * k));
      assert.ok(Math.abs(eps.im - 2 * n * k) <= 1e-15 * (n * n + k * k));
      assert.ok(Math.abs(Math.hypot(eps.re, eps.im) - (n * n + k * k)) <= 1e-12 * (n * n + k * k));
      const back = epsilonToNk(eps);
      // La vuelta pierde precisión relativa en el menor de los dos cuando k ≪ n (resta de
      // números casi iguales): tolerancia absoluta referida al mayor.
      const scale = Math.max(n, k);
      assert.ok(Math.abs(back.n - n) < 1e-9 * scale, `${id} fila ${i}: n ${back.n} frente a ${n}`);
      assert.ok(Math.abs(back.k - k) < 1e-7 * scale, `${id} fila ${i}: k ${back.k} frente a ${k}`);
    }
  }
});

// Casos exactos: n = 2, k = 0 → ε = 4; n = 0, k = 3 → ε = −9 (metal ideal); n = k = 1 →
// ε = 2i. Y el convenio de signos: Im ε < 0 (ganancia) da k < 0.
test('nkToEpsilon y epsilonToNk: casos exactos y convenio de signos', () => {
  assert.deepEqual(nkToEpsilon(2, 0), { re: 4, im: 0 });
  assert.deepEqual(nkToEpsilon(0, 3), { re: -9, im: 0 });
  assert.deepEqual(nkToEpsilon(1, 1), { re: 0, im: 2 });
  assert.deepEqual(epsilonToNk({ re: 4, im: 0 }), { n: 2, k: 0 });
  assert.deepEqual(epsilonToNk({ re: -9, im: 0 }), { n: 0, k: 3 });
  const lossy = epsilonToNk({ re: 0, im: 2 });
  assert.ok(Math.abs(lossy.n - 1) < 1e-15 && Math.abs(lossy.k - 1) < 1e-15);
  assert.ok(epsilonToNk({ re: 0, im: -2 }).k < 0);
});

// --- Interpolación ---------------------------------------------------------------------------------

// En los nodos se devuelve el dato; entre dos nodos, un valor entre los dos vecinos
// (interpolación lineal); y fuera del intervalo tabulado NO se extrapola sin aviso:
// RangeError, salvo que se pida expresamente prolongar con el extremo.
test('interpolación en λ: exacta en los nodos, acotada entre nodos y con aviso fuera de rango', async () => {
  const material = await loadMaterial('Au');
  const gold = createOpticalConstants(material);
  assert.deepEqual(gold.range, [187.9, 1937]);
  material.wavelength_nm.forEach((nm, i) => {
    assert.equal(gold.nk(nm).n, material.n[i]);
    assert.equal(gold.nk(nm).k, material.k[i]);
  });
  // Entre 520,9 nm (n = 0,62; k = 2,081) y 548,6 nm (n = 0,43; k = 2,455).
  const mid = gold.nk(530);
  assert.ok(mid.n < 0.62 && mid.n > 0.43 && mid.k > 2.081 && mid.k < 2.455);
  const t = (530 - 520.9) / (548.6 - 520.9);
  assert.ok(Math.abs(mid.n - (0.62 + t * (0.43 - 0.62))) < 1e-14);
  // ε se calcula con los n y k interpolados.
  assert.deepEqual(gold.epsilon(530), nkToEpsilon(mid.n, mid.k));

  assert.equal(gold.covers(530), true);
  assert.equal(gold.covers(150), false);
  assert.equal(gold.covers(2000), false);
  assert.throws(() => gold.nk(150), /fuera de los datos de Au \(187\.9–1937 nm\)/);
  assert.throws(() => gold.epsilon(2000), RangeError);
  assert.throws(() => gold.nk(NaN), RangeError);
  const clamped = createOpticalConstants(material, { outOfRange: 'clamp' });
  assert.equal(clamped.nk(150).n, material.n[0]);
  assert.equal(clamped.nk(5000).k, material.k[material.k.length - 1]);
});

// La spline pasa por los mismos nodos y, en una tabla densa y suave (aleación Au-Ag, un
// punto por nm), coincide con la lineal mucho mejor que el 1 %.
test('interpolación con spline: pasa por los nodos y coincide con la lineal en tablas densas', async () => {
  const material = await loadMaterial('AuAg');
  const linear = createOpticalConstants(material);
  const spline = createOpticalConstants(material, { interpolation: 'spline' });
  assert.ok(Math.abs(spline.nk(500).n - material.n[material.wavelength_nm.indexOf(500)]) < 1e-12);
  for (let nm = 300.5; nm < 1000; nm += 37) {
    assert.ok(Math.abs(spline.nk(nm).n - linear.nk(nm).n) < 1e-4);
    assert.ok(Math.abs(spline.nk(nm).k - linear.nk(nm).k) < 1e-4);
  }
});

// --- Modelo de Drude --------------------------------------------------------------------------------

// Sin pérdidas (γ = 0): ε = ε∞ − ω_p²/ω², real, que se anula exactamente en ω_p/√ε∞.
test('Drude sin pérdidas: ε = ε∞ − ω_p²/ω² y cero en ω_p/√ε∞', () => {
  const model = { epsInf: 4, omegaP: 9, gamma: 0 };
  assert.deepEqual(drudeEpsilon(model, 3), { re: 4 - 9, im: 0 });
  const zero = drudeEpsilon(model, 9 / 2);
  assert.ok(Math.abs(zero.re) < 1e-14 && zero.im === 0);
  // ε∞ = 1 por defecto.
  assert.equal(drudeEpsilon({ omegaP: 2, gamma: 0 }, 1).re, 1 - 4);
});

// Con pérdidas: valor exacto. ω_p = 10, γ = 1, ω = 2: ε = 1 − 100/(4 + 2i)
// = 1 − 100(4 − 2i)/20 = −19 + 10i. Im ε > 0 siempre (el material absorbe, no amplifica)
// y a frecuencias altas ε → ε∞.
test('Drude con pérdidas: valor exacto, Im ε > 0 y límite de alta frecuencia', () => {
  const eps = drudeEpsilon({ omegaP: 10, gamma: 1 }, 2);
  assert.ok(Math.abs(eps.re + 19) < 1e-13 && Math.abs(eps.im - 10) < 1e-13);
  for (const omega of [0.01, 0.5, 3, 10, 50]) {
    assert.ok(drudeEpsilon({ epsInf: 2, omegaP: 10, gamma: 0.3 }, omega).im > 0);
  }
  const high = drudeEpsilon({ epsInf: 2, omegaP: 10, gamma: 0.3 }, 1e6);
  assert.ok(Math.abs(high.re - 2) < 1e-9 && high.im < 1e-15);
});

// --- Modelo de Lorentz --------------------------------------------------------------------------------

// Un oscilador de Lorentz es el oscilador forzado del encargo 00: su término vale
// f·ω_p²·m·χ(ω), con χ(ω) = 1/(m(ω₀² − ω² − iγω)) la respuesta compleja ya comprobada
// en tests/oscilador.test.js. Mismo convenio e^{−iωt}.
test('Lorentz: cada término es la respuesta del oscilador forzado', () => {
  const model = { epsInf: 2.5, omegaP: 3, oscillators: [{ strength: 0.7, omega0: 4, gamma: 0.5 }] };
  for (const omega of [0.5, 3.9, 4, 4.1, 9]) {
    const chi = complexResponse({ m: 1, omega0: 4, gamma: 0.5, omega, F0: 1 });
    const eps = lorentzEpsilon(model, omega);
    assert.ok(Math.abs(eps.re - (2.5 + 0.7 * 9 * chi.re)) < 1e-13);
    assert.ok(Math.abs(eps.im - 0.7 * 9 * chi.im) < 1e-13);
  }
});

// Límites analíticos: estático ε(0) = ε∞ + Σ f·ω_p²/ω₀²; en ω = ω₀ el término resonante
// es imaginario puro, i·f·ω_p²/(γω₀) (máxima absorción); y un oscilador con ω₀ = 0 es
// exactamente el modelo de Drude.
test('Lorentz: límite estático, resonancia y caso ω₀ = 0 (Drude)', () => {
  const model = {
    epsInf: 1.5,
    omegaP: 2,
    oscillators: [
      { strength: 1, omega0: 4, gamma: 0.2 },
      { strength: 0.5, omega0: 10, gamma: 1 },
    ],
  };
  const statics = lorentzEpsilon(model, 0);
  assert.ok(Math.abs(statics.re - (1.5 + 4 / 16 + 0.5 * 4 / 100)) < 1e-14);
  assert.equal(statics.im, 0);
  const single = { epsInf: 1, omegaP: 2, oscillators: [{ strength: 1, omega0: 4, gamma: 0.2 }] };
  const resonant = lorentzEpsilon(single, 4);
  assert.ok(Math.abs(resonant.re - 1) < 1e-14);
  assert.ok(Math.abs(resonant.im - 4 / (0.2 * 4)) < 1e-13);
  const free = lorentzEpsilon({ epsInf: 3, omegaP: 7, oscillators: [{ strength: 1, omega0: 0, gamma: 0.4 }] }, 2.2);
  const drude = drudeEpsilon({ epsInf: 3, omegaP: 7, gamma: 0.4 }, 2.2);
  assert.ok(Math.abs(free.re - drude.re) < 1e-13 && Math.abs(free.im - drude.im) < 1e-13);
});
