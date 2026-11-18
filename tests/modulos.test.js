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
import { isPilot, VIEW_KEYS } from '../src/core/simulations.js';
import { graphTexts } from '../src/core/ficha-sections.js';

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
    if (m.transitionSeconds !== undefined) {
      assert.ok(
        Number.isFinite(m.transitionSeconds) && m.transitionSeconds >= 0,
        'transitionSeconds debe ser un número de segundos ≥ 0',
      );
    }
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
      if (p.visible !== undefined) {
        assert.equal(typeof p.visible, 'function', `"${p.key}": visible debe ser una función (state) => boolean`);
        assert.equal(typeof p.visible(defaultState(m.params)), 'boolean', `"${p.key}": visible debe devolver true o false`);
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
    // Un módulo grande puede repartir su física en varios archivos physics-<parte>.js:
    // todos cumplen la misma regla.
    const files = readdirSync(dir).filter((name) => /^physics(-[a-z0-9-]+)?\.js$/.test(name));
    for (const file of files) {
      // Se miran solo las líneas de código: los comentarios pueden nombrar lo prohibido.
      const source = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s\/\/ .*$/gm, '');
      for (const forbidden of ['document', 'window', 'canvas', 'requestAnimationFrame', 'getContext']) {
        assert.ok(!source.includes(forbidden), `${file} no puede usar "${forbidden}"`);
      }
      // Mantisas de las constantes CODATA más comunes: deben importarse de units.js.
      for (const digits of ['6.626', '1.054', '1.602', '9.109', '8.854', '1.380', '299792458', '2.998']) {
        assert.ok(
          !source.includes(digits),
          `${file} contiene "${digits}": importa la constante de src/core/units.js`,
        );
      }
    }
  });
}

// Formato con página de entrada y simulaciones (encargo R1, en piloto). Durante la
// transición el núcleo admite los dos formatos: estos tests solo miran los módulos que
// declaran `simulations`. Un módulo migrado sin párrafo de entrada, o con una gráfica sin
// título, nombre corto, frase o apartado en la ficha, hace fallar el test.
for (const m of modules.filter(isPilot)) {
  const ficha = readFileSync(join(modulesDir, m.id, 'ficha.md'), 'utf8');
  const texts = graphTexts(ficha);
  const sims = m.simulations ?? [];

  test(`[${m.id}] formato nuevo: párrafo de entrada y parámetro de simulación`, () => {
    assert.ok((m.intro ?? '').trim().length > 80, 'falta intro: el párrafo de la página de entrada (de qué va el módulo y por qué importa)');
    const param = m.params.find((p) => p.key === m.simulationParam);
    assert.ok(param && param.type === 'select', `simulationParam "${m.simulationParam}" debe ser la clave de un parámetro select`);
    assert.deepEqual(
      sims.map((s) => s.id),
      param.type === 'select' ? optionValues(param) : [],
      'cada opción del parámetro de simulación es una simulación, y en el mismo orden',
    );
    for (const key of VIEW_KEYS) assert.ok(!m.params.some((p) => p.key === key), `"${key}" está reservado para la URL (qué gráficas y qué pantalla se ven)`);
  });

  for (const sim of sims) {
    test(`[${m.id}] simulación «${sim.id}»: textos, estado inicial, gráficas y combinaciones`, () => {
      assert.ok(sim.title.trim().length > 0, 'falta title');
      assert.ok(sim.summary.trim().length > 20, 'falta summary: una frase de qué simula');
      const { warnings } = normalizeState(m.params, sim.initial);
      assert.deepEqual(warnings, [], `estado inicial: ${warnings.join('; ')}`);
      assert.ok(!(m.simulationParam && Object.hasOwn(sim.initial, m.simulationParam) && sim.initial[m.simulationParam] !== sim.id), 'el estado inicial abre otra simulación');
      assert.ok(sim.graphs.length > 0, 'una simulación sin gráficas');
      for (const g of sim.graphs) {
        assert.match(g.id, /^[a-z0-9-]+$/, `id de gráfica no válido: "${g.id}"`);
        assert.ok(g.title.trim().length > 0, `gráfica "${g.id}": falta title (qué es, en palabras)`);
        assert.ok(g.short.trim().length > 0, `gráfica "${g.id}": falta short (nombre de la pestaña)`);
        assert.ok(g.summary.trim().length > 20, `gráfica "${g.id}": falta summary (una frase de qué muestra)`);
        const t = texts.get(g.id);
        assert.ok(t && t.title, `gráfica "${g.id}": falta su apartado en ficha.md («### Título {#${g.id}}» en «Qué estás viendo»)`);
        assert.equal(t.title, g.title, `gráfica "${g.id}": el título de su apartado en la ficha debe ser el de la pantalla`);
        assert.ok(t.see && t.read && t.tryThis, `gráfica "${g.id}": su apartado de la ficha debe tener «Qué ves», «Cómo leerla» y «Prueba esto»`);
      }
      const ids = sim.graphs.map((g) => g.id);
      for (const c of sim.combos) {
        assert.ok(c.title.trim().length > 0 && c.summary.trim().length > 20, `combinación "${c.id}": faltan título o frase`);
        assert.ok(c.graphs.length >= 2 && c.graphs.length <= 2, `combinación "${c.id}": dos gráficas (las que caben en una pantalla)`);
        for (const g of c.graphs) assert.ok(ids.includes(g), `combinación "${c.id}": la gráfica "${g}" no es de esta simulación`);
      }
    });
  }

  test(`[${m.id}] identificadores de gráfica únicos en el módulo, y presets que abren gráficas de su simulación`, () => {
    const all = sims.flatMap((s) => s.graphs.map((g) => g.id));
    assert.equal(new Set(all).size, all.length, `gráficas con el mismo id: ${all}`);
    for (const id of texts.keys()) assert.ok(all.includes(id), `ficha.md cita la gráfica "${id}" ({#${id}} o <!-- gráficas: … -->), que no existe`);
    for (const preset of m.presets) {
      if (!preset.graphs) continue;
      const simId = preset.state[m.simulationParam ?? ''] ?? defaultState(m.params)[m.simulationParam ?? ''];
      const sim = sims.find((s) => s.id === simId);
      assert.ok(sim, `preset "${preset.id}": no abre ninguna simulación`);
      for (const g of preset.graphs) assert.ok(sim.graphs.some((x) => x.id === g), `preset "${preset.id}": la gráfica "${g}" no es de la simulación «${simId}»`);
    }
  });
}

