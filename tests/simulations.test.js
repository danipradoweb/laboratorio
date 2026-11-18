// @ts-check
// Tests de src/core/simulations.js: selección de gráficas, reparto en pantallas y URL del
// formato con simulaciones (encargo R1). No hay física: se comprueban las reglas del
// encargo («como mucho dos gráficas por pantalla, siguiendo el orden de las combinaciones
// sugeridas», «la selección va en la URL»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOGETHER,
  entryLink,
  initialStateOf,
  normalizeSelection,
  parseScreen,
  planScreens,
  screenName,
  simulationHash,
  simulationOf,
  splitViewQuery,
} from '../src/core/simulations.js';
import { parseHash } from '../src/core/state.js';
import { modules } from '../src/modules/registry.js';

/** @type {import('../src/modules/types.js').SimulationSpec} */
const SIM = {
  id: 'a',
  title: 'A',
  summary: 'Simulación de prueba con cuatro gráficas.',
  initial: { x: 2 },
  graphs: ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id, title: id, short: `corto ${id}`, summary: 'una gráfica de prueba' })),
  combos: [
    { id: 'c1', title: 'C1', summary: 'g1 con g3', graphs: ['g1', 'g3'] },
    { id: 'c2', title: 'C2', summary: 'g1 con g2', graphs: ['g1', 'g2'] },
  ],
};

/** @type {import('../src/modules/types.js').ModuleDescriptor} */
const MODULE = {
  id: 'prueba',
  title: 'Prueba',
  summary: 'Módulo de prueba',
  params: [
    { key: 'sim', label: 'Simulación', type: 'select', options: ['a', 'b'], default: 'b' },
    { key: 'x', label: 'x', type: 'range', min: 0, max: 5, step: 1, default: 1 },
  ],
  presets: [],
  tours: [],
  mount: () => ({ update() {}, destroy() {} }),
  simulationParam: 'sim',
  simulations: [SIM, { ...SIM, id: 'b', initial: {}, combos: [] }],
};

test('pantallas: primero las combinaciones sugeridas completas, en su orden; luego el resto de dos en dos', () => {
  // c1 (g1, g3) se lleva g1, así que c2 (g1, g2) ya no está libre: g2 y g4 van juntas.
  assert.deepEqual(planScreens(SIM, ['g1', 'g2', 'g3', 'g4'], 2), [['g1', 'g3'], ['g2', 'g4']]);
  // Sin g3, la primera combinación completa es c2.
  assert.deepEqual(planScreens(SIM, ['g1', 'g2', 'g4'], 2), [['g1', 'g2'], ['g4']]);
  // Sin combinaciones completas: en el orden de la simulación.
  assert.deepEqual(planScreens(SIM, ['g4', 'g2'], 2), [['g2', 'g4']]);
  // En el móvil, una gráfica por pantalla, en el orden de la simulación.
  assert.deepEqual(planScreens(SIM, ['g3', 'g1'], 1), [['g1'], ['g3']]);
});

test('selección: se descartan las gráficas desconocidas (con aviso) y sin ninguna válida son todas', () => {
  assert.deepEqual(normalizeSelection(SIM, ['g3', 'g1']), { graphs: ['g1', 'g3'], warnings: [] });
  assert.deepEqual(normalizeSelection(SIM, null).graphs, ['g1', 'g2', 'g3', 'g4']);
  const r = normalizeSelection(SIM, ['nada']);
  assert.deepEqual(r.graphs, ['g1', 'g2', 'g3', 'g4']);
  assert.equal(r.warnings.length, 1);
});

test('URL: ver y pantalla se separan de los parámetros; la pantalla se ajusta a las que hay', () => {
  assert.deepEqual(splitViewQuery({ x: '2', ver: 'g1,g2', pantalla: '2' }), { params: { x: '2' }, graphs: ['g1', 'g2'], screen: '2' });
  assert.deepEqual(splitViewQuery({ x: '2' }), { params: { x: '2' }, graphs: null, screen: null });
  assert.equal(parseScreen('2', 3), 1);
  assert.equal(parseScreen('9', 3), 2);
  assert.equal(parseScreen('cero', 3), 0);
  assert.equal(parseScreen(null, 3), 0);
  assert.equal(parseScreen(TOGETHER, 3), TOGETHER);
});

test('URL: un enlace copiado reproduce simulación, gráficas y pantalla (ida y vuelta)', () => {
  const state = initialStateOf(MODULE, SIM);
  assert.equal(state.sim, 'a');
  assert.equal(state.x, 2, 'el estado inicial de la simulación se aplica al entrar');
  const hash = simulationHash(MODULE, state, ['g2', 'g4'], 1);
  assert.equal(hash, '#/prueba?sim=a&x=2&ver=g2,g4&pantalla=2');
  const { query } = parseHash(hash);
  const back = splitViewQuery(query);
  assert.deepEqual(back.graphs, ['g2', 'g4']);
  assert.equal(parseScreen(back.screen, 1), 0, 'si hay menos pantallas, la última que hay');
  // Con todas las gráficas no se escribe `ver`, y la primera pantalla no se escribe.
  assert.equal(simulationHash(MODULE, state, ['g1', 'g2', 'g3', 'g4'], 0), '#/prueba?sim=a&x=2');
  assert.equal(simulationHash(MODULE, state, ['g1'], TOGETHER), '#/prueba?sim=a&x=2&ver=g1&pantalla=juntas');
  assert.equal(entryLink(MODULE, SIM, ['g3']), '#/prueba?sim=a&x=2&ver=g3');
  assert.equal(simulationOf(MODULE, { sim: 'b', x: 1 }).id, 'b');
});

test('nombre de una pantalla: los nombres cortos de sus gráficas', () => {
  assert.equal(screenName(SIM, ['g1']), 'corto g1');
  assert.equal(screenName(SIM, ['g1', 'g3']), 'corto g1 y corto g3');
});

test('funcion-onda: la simulación «estados» entra con la superposición 1 + 2 (encargo R1)', () => {
  const fo = modules.find((m) => m.id === 'funcion-onda');
  assert.ok(fo?.simulations);
  const estados = fo.simulations.find((s) => s.id === 'estados');
  assert.ok(estados);
  const preset = fo.presets.find((p) => p.id === 'superposicion');
  assert.ok(preset);
  const state = initialStateOf(fo, estados);
  for (const [key, value] of Object.entries(preset.state)) assert.equal(state[key], value, key);
  // Pantallas de «ver todas» en escritorio: las dos combinaciones sugeridas.
  assert.deepEqual(planScreens(estados, estados.graphs.map((g) => g.id), 2), [
    ['superposicion', 'coeficientes'],
    ['niveles', 'puente-luz'],
  ]);
});
