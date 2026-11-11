// @ts-check
// Contrato de los módulos: recorre TODOS los módulos de src/modules/registry.js y
// comprueba que cumplen lo que el núcleo espera de ellos (docs/ARQUITECTURA.md,
// "Contrato de un módulo"). No hay física aquí.
//
// Si acabas de crear un módulo y este test falla, el mensaje dice qué falta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules } from '../src/modules/registry.js';
import { defaultState, normalizeState, validateValue, optionValues } from '../src/core/state.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = join(root, 'src/modules');

/** Secciones obligatorias de ficha.md (docs/ARQUITECTURA.md, "Fichas"). */
const FICHA_SECTIONS = [
  'Qué estás viendo',
  'Qué es físico y qué es representación',
  'Ecuaciones',
  'Límites del modelo',
  'Referencias',
];

test('los identificadores de módulo son únicos y válidos', () => {
  const ids = modules.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, `hay ids repetidos en registry.js: ${ids}`);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9_-]+$/, `id "${id}": solo minúsculas, cifras, "-" y "_"`);
  }
});

// Toda carpeta de src/modules/ debe estar dada de alta: un módulo olvidado en el
// registro no aparecería en la web ni pasaría por estos tests.
test('todas las carpetas de src/modules/ están en registry.js', () => {
  const folders = readdirSync(modulesDir).filter((name) => statSync(join(modulesDir, name)).isDirectory());
  const ids = new Set(modules.map((m) => m.id));
  for (const folder of folders) {
    assert.ok(ids.has(folder), `la carpeta src/modules/${folder}/ no está registrada en registry.js`);
  }
});

for (const m of modules) {
  const dir = join(modulesDir, m.id);

  test(`[${m.id}] carpeta y archivos del módulo`, () => {
    assert.ok(existsSync(dir), `no existe src/modules/${m.id}/ (el id debe coincidir con la carpeta)`);
    for (const file of ['module.js', 'physics.js', 'view.js', 'ficha.md']) {
      assert.ok(existsSync(join(dir, file)), `falta src/modules/${m.id}/${file}`);
    }
    assert.ok(
      existsSync(join(root, 'tests', `${m.id}.test.js`)),
      `falta tests/${m.id}.test.js: toda physics.js necesita sus tests`,
    );
    if (m.thumbnail) {
      assert.ok(existsSync(join(dir, m.thumbnail)), `falta la miniatura src/modules/${m.id}/${m.thumbnail}`);
    }
  });

  test(`[${m.id}] descriptor: textos y función mount`, () => {
    assert.ok(m.title.trim().length > 0, 'falta title');
    assert.ok(m.summary.trim().length > 0, 'falta summary');
    assert.equal(typeof m.mount, 'function', 'mount debe ser una función');
    assert.ok(Array.isArray(m.presets), 'presets debe ser una lista (puede estar vacía)');
    assert.ok(Array.isArray(m.tours), 'tours debe ser una lista (puede estar vacía)');
  });

  test(`[${m.id}] params bien formados`, () => {
    const keys = m.params.map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length, `claves de params repetidas: ${keys}`);
    for (const p of m.params) {
      assert.match(p.key, /^[a-zA-Z][a-zA-Z0-9_]*$/, `clave de parámetro no válida: "${p.key}"`);
      assert.ok(p.label && p.label.trim().length > 0, `"${p.key}": falta label`);
      if (p.type === 'range') {
        assert.ok(p.min < p.max, `"${p.key}": min debe ser menor que max`);
        assert.ok(p.step > 0, `"${p.key}": step debe ser positivo`);
      } else if (p.type === 'select') {
        const values = optionValues(p);
        assert.ok(values.length > 0, `"${p.key}": options está vacío`);
        assert.equal(new Set(values).size, values.length, `"${p.key}": opciones repetidas`);
      } else {
        assert.equal(p.type, 'toggle', `"${/** @type {any} */ (p).key}": tipo desconocido`);
      }
      const check = validateValue(p, p.default);
      assert.ok(check.ok, `valor por defecto inválido: ${check.ok ? '' : check.reason}`);
    }
    assert.ok(Object.keys(defaultState(m.params)).length === m.params.length);
  });

  test(`[${m.id}] presets válidos según params`, () => {
    const ids = m.presets.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `ids de preset repetidos: ${ids}`);
    assert.ok(m.presets.length <= 9, 'como mucho 9 presets (teclas 1–9 del modo presentación)');
    for (const preset of m.presets) {
      assert.match(preset.id, /^[a-z0-9-]+$/, `id de preset no válido: "${preset.id}"`);
      assert.ok(preset.label.trim().length > 0, `preset "${preset.id}": falta label`);
      const { warnings } = normalizeState(m.params, preset.state);
      assert.deepEqual(warnings, [], `preset "${preset.id}": ${warnings.join('; ')}`);
    }
  });

  test(`[${m.id}] recorridos que citan presets existentes`, () => {
    const presetIds = new Set(m.presets.map((p) => p.id));
    const tourIds = m.tours.map((t) => t.id);
    assert.equal(new Set(tourIds).size, tourIds.length, `ids de recorrido repetidos: ${tourIds}`);
    for (const tour of m.tours) {
      assert.ok(tour.title.trim().length > 0, `recorrido "${tour.id}": falta title`);
      assert.ok(tour.steps.length > 0, `recorrido "${tour.id}": no tiene pasos`);
      tour.steps.forEach((step, i) => {
        assert.ok(
          presetIds.has(step.preset),
          `recorrido "${tour.id}", paso ${i + 1}: el preset "${step.preset}" no existe`,
        );
        assert.ok(step.text.trim().length > 0, `recorrido "${tour.id}", paso ${i + 1}: falta text`);
      });
    }
  });

  test(`[${m.id}] ficha.md con las cinco secciones`, () => {
    const ficha = readFileSync(join(dir, 'ficha.md'), 'utf8');
    assert.match(ficha, /^# .+/m, 'ficha.md debe empezar con un título "# …"');
    let position = -1;
    for (const section of FICHA_SECTIONS) {
      const index = ficha.indexOf(`## ${section}`);
      assert.ok(index >= 0, `ficha.md: falta la sección "## ${section}"`);
      assert.ok(index > position, `ficha.md: la sección "## ${section}" está fuera de orden`);
      position = index;
    }
  });

  // Regla de arquitectura: la física no toca el DOM y las constantes salen de units.js.
  test(`[${m.id}] physics.js es puro (sin DOM) y no teclea constantes físicas`, () => {
    const source = readFileSync(join(dir, 'physics.js'), 'utf8');
    for (const forbidden of ['document.', 'window.', 'canvas', 'requestAnimationFrame']) {
      assert.ok(!source.includes(forbidden), `physics.js no puede usar "${forbidden}"`);
    }
    // Mantisas de las constantes CODATA más comunes: deben importarse de units.js.
    for (const digits of ['6.626', '1.054', '1.602', '9.109', '8.854', '1.380', '299792458', '2.998']) {
      assert.ok(
        !source.includes(digits),
        `physics.js contiene "${digits}": importa la constante de src/core/units.js`,
      );
    }
  });
}
