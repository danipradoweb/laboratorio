// @ts-check
// Tests de src/core/state.js: estado de un módulo ↔ URL.
// No hay física: se comprueba el contrato descrito en docs/ARQUITECTURA.md
// ("Estado en la URL").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState,
  validateValue,
  parseValue,
  normalizeState,
  parseHash,
  stateFromQuery,
  serializeState,
  buildHash,
  formatNumber,
  statesEqual,
  createStore,
} from '../src/core/state.js';

/** @type {import('../src/core/state.js').Param[]} */
const params = [
  { key: 'radius', label: 'Radio (nm)', type: 'range', min: 1, max: 150, step: 1, default: 10 },
  { key: 'medium', label: 'Índice del medio', type: 'range', min: 1, max: 2, step: 0.01, default: 1.33 },
  { key: 'material', label: 'Material', type: 'select', options: ['Au', 'Ag', 'Cu'], default: 'Au' },
  {
    key: 'shape',
    label: 'Forma',
    type: 'select',
    options: [
      { value: 'esfera', label: 'Esfera' },
      { value: 'núcleo corteza', label: 'Núcleo y corteza' },
    ],
    default: 'esfera',
  },
  { key: 'log', label: 'Escala logarítmica', type: 'toggle', default: false },
];

test('defaultState toma el valor por defecto de cada parámetro', () => {
  assert.deepEqual(defaultState(params), {
    radius: 10,
    medium: 1.33,
    material: 'Au',
    shape: 'esfera',
    log: false,
  });
  assert.ok(Object.isFrozen(defaultState(params)));
});

test('parseHash separa módulo y parámetros', () => {
  assert.deepEqual(parseHash(''), { moduleId: null, query: {} });
  assert.deepEqual(parseHash('#'), { moduleId: null, query: {} });
  assert.deepEqual(parseHash('#/'), { moduleId: null, query: {} });
  assert.deepEqual(parseHash('#/plasmon'), { moduleId: 'plasmon', query: {} });
  assert.deepEqual(parseHash('#/plasmon?radius=40&material=Ag&medium=1.33'), {
    moduleId: 'plasmon',
    query: { radius: '40', material: 'Ag', medium: '1.33' },
  });
  assert.deepEqual(parseHash('#/_plantilla?a=1'), { moduleId: '_plantilla', query: { a: '1' } });
});

// "Copiar la dirección reproduce exactamente lo que se ve": serializar y volver a leer
// devuelve el mismo estado, para todos los tipos de parámetro.
test('ida y vuelta: estado → URL → estado', () => {
  const { state } = normalizeState(params, {
    radius: 40,
    medium: 1.5,
    material: 'Ag',
    shape: 'núcleo corteza',
    log: true,
  });
  const hash = buildHash('plasmon', params, state);
  assert.equal(
    hash,
    '#/plasmon?radius=40&medium=1.5&material=Ag&shape=n%C3%BAcleo%20corteza&log=1',
  );
  const parsed = parseHash(hash);
  assert.equal(parsed.moduleId, 'plasmon');
  const back = stateFromQuery(params, parsed.query);
  assert.deepEqual(back.warnings, []);
  assert.deepEqual(back.state, state);
  assert.ok(statesEqual(back.state, state));
});

// La URL lleva siempre todos los parámetros, también los que valen su valor por defecto.
test('serializeState escribe todos los parámetros en el orden de params', () => {
  assert.equal(
    serializeState(params, defaultState(params)),
    'radius=10&medium=1.33&material=Au&shape=esfera&log=0',
  );
});

test('los parámetros ausentes toman su valor por defecto, sin avisos', () => {
  const { state, warnings } = stateFromQuery(params, { radius: '75' });
  assert.equal(state.radius, 75);
  assert.equal(state.medium, 1.33);
  assert.equal(state.material, 'Au');
  assert.equal(state.log, false);
  assert.deepEqual(warnings, []);
});

test('los valores inválidos se ignoran con un aviso', () => {
  const { state, warnings } = stateFromQuery(params, {
    radius: '9999', // fuera de rango
    medium: 'abc', // no es un número
    material: 'Pt', // opción inexistente
    log: 'quizá', // no es booleano
    extra: '1', // clave desconocida
  });
  assert.deepEqual(state, defaultState(params));
  assert.equal(warnings.length, 5);
  assert.match(warnings[0], /radius.*fuera del rango \[1, 150\]/);
  assert.match(warnings[1], /medium.*número/);
  assert.match(warnings[2], /material.*opción válida/);
  assert.match(warnings[3], /log/);
  assert.match(warnings[4], /desconocido "extra"/);
});

test('parseValue: casos límite de números y booleanos', () => {
  const radius = params[0];
  const log = params[4];
  assert.deepEqual(parseValue(radius, '1'), { ok: true, value: 1 }); // extremo inferior incluido
  assert.deepEqual(parseValue(radius, '150'), { ok: true, value: 150 }); // extremo superior incluido
  assert.deepEqual(parseValue(radius, '1e1'), { ok: true, value: 10 });
  assert.equal(parseValue(radius, '').ok, false); // Number('') sería 0
  assert.equal(parseValue(radius, ' ').ok, false);
  assert.equal(parseValue(radius, 'Infinity').ok, false);
  assert.equal(parseValue(radius, '0.999').ok, false);
  assert.deepEqual(parseValue(log, 'true'), { ok: true, value: true });
  assert.deepEqual(parseValue(log, '0'), { ok: true, value: false });
});

test('validateValue exige el tipo de JavaScript correcto', () => {
  assert.equal(validateValue(params[0], '40').ok, false); // texto donde va un número
  assert.equal(validateValue(params[2], 3).ok, false);
  assert.equal(validateValue(params[4], 1).ok, false);
  assert.equal(validateValue(params[3], 'núcleo corteza').ok, true); // opción { value, label }
});

// Los errores de redondeo de la coma flotante no deben ensuciar la URL.
test('formatNumber evita colas de redondeo', () => {
  assert.equal(formatNumber(0.1 + 0.2), '0.3');
  assert.equal(formatNumber(1.33), '1.33');
  assert.equal(formatNumber(40), '40');
  assert.equal(formatNumber(-2.5e-7), '-2.5e-7');
  assert.equal(formatNumber(1 / 3), '0.333333333333');
  // 12 cifras significativas bastan para reproducir lo que se ve: error relativo < 1e-11.
  const x = 123.456789012345;
  assert.ok(Math.abs(Number(formatNumber(x)) - x) / x < 1e-11);
});

test('normalizeState completa presets parciales y avisa de claves erróneas', () => {
  const { state, warnings } = normalizeState(params, { radius: 20, materal: 'Ag', medium: 5 });
  assert.equal(state.radius, 20);
  assert.equal(state.material, 'Au');
  assert.equal(state.medium, 1.33);
  assert.equal(warnings.length, 2);
});

test('createStore: set valida, recorta rangos y avisa a los suscriptores', () => {
  const store = createStore(params);
  /** @type {{ keys: string[], source: string }[]} */
  const changes = [];
  const unsubscribe = store.subscribe((_state, change) => changes.push(change));

  assert.deepEqual(store.set({ radius: 50 }), []);
  assert.equal(store.get().radius, 50);
  assert.deepEqual(changes, [{ keys: ['radius'], source: 'control' }]);

  // Mismo valor: no hay cambio ni aviso a los suscriptores.
  store.set({ radius: 50 });
  assert.equal(changes.length, 1);

  // Interacción fuera de rango: se recorta al límite.
  store.set({ radius: 1e6, medium: -3 }, 'view');
  assert.equal(store.get().radius, 150);
  assert.equal(store.get().medium, 1);
  assert.deepEqual(changes[1], { keys: ['radius', 'medium'], source: 'view' });

  // Valores de tipo incorrecto o claves desconocidas: se ignoran con aviso.
  const warnings = store.set({ material: 'Pt', nada: 1, log: 'sí' });
  assert.equal(warnings.length, 3);
  assert.equal(store.get().material, 'Au');
  assert.equal(changes.length, 2);

  // El estado es inmutable: cada cambio crea un objeto nuevo y congelado.
  const before = store.get();
  store.set({ log: true });
  assert.notEqual(store.get(), before);
  assert.equal(before.log, false);
  assert.ok(Object.isFrozen(store.get()));

  unsubscribe();
  store.set({ radius: 2 });
  assert.equal(changes.length, 3);
});

test('createStore: replace sustituye el estado completo', () => {
  const store = createStore(params);
  /** @type {string[][]} */
  const seen = [];
  store.subscribe((_s, change) => seen.push([change.source, ...change.keys]));
  const { state } = stateFromQuery(params, { radius: '99', material: 'Cu' });
  store.replace(state);
  assert.deepEqual(store.get(), state);
  assert.deepEqual(seen, [['url', 'radius', 'material']]);
  store.replace(state); // sin cambios: no avisa
  assert.equal(seen.length, 1);
});
