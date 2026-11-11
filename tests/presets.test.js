// @ts-check
// Tests de src/core/presets.js y src/core/tours.js (sin navegador).
// Comprueban el contrato de docs/ARQUITECTURA.md, "Presets y transiciones" y
// "Recorridos guiados".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  easeInOut,
  presetState,
  interpolateState,
  findActivePreset,
  createTransition,
  DEFAULT_TRANSITION_SECONDS,
} from '../src/core/presets.js';
import { createTourRunner } from '../src/core/tours.js';
import { defaultState } from '../src/core/state.js';

/** @type {import('../src/core/state.js').Param[]} */
const params = [
  { key: 'omega', label: 'ω', type: 'range', min: 0, max: 3, step: 0.01, default: 1 },
  { key: 'gamma', label: 'γ', type: 'range', min: 0, max: 2, step: 0.01, default: 0.2 },
  { key: 'mode', label: 'Modo', type: 'select', options: ['a', 'b'], default: 'a' },
  { key: 'show', label: 'Mostrar', type: 'toggle', default: false },
];

/** @type {import('../src/modules/types.js').Preset[]} */
const presets = [
  { id: 'bajo', label: 'Por debajo', state: { omega: 0.2 } },
  { id: 'alto', label: 'Por encima', state: { omega: 3, gamma: 0.5, mode: 'b', show: true } },
];

/** Temporizador falso, como en clock.test.js. */
function fakeTimer() {
  /** @type {((t: number) => void) | null} */
  let pending = null;
  let now = 1000;
  return {
    requestFrame: (/** @type {(t: number) => void} */ cb) => {
      pending = cb;
      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
    advance(/** @type {number} */ ms) {
      now += ms;
      const cb = pending;
      pending = null;
      if (cb) cb(now);
    },
    hasPending: () => pending !== null,
  };
}

test('easeInOut: de 0 a 1, simétrica y con arranque y frenada suaves', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(easeInOut(-1), 0);
  assert.equal(easeInOut(2), 1);
  for (let t = 0; t <= 1; t += 0.05) {
    assert.ok(Math.abs(easeInOut(t) + easeInOut(1 - t) - 1) < 1e-12);
  }
  // Velocidad casi nula en los extremos: el primer 1 % del tiempo recorre < 0,1 %.
  assert.ok(easeInOut(0.01) < 0.001);
});

test('presetState completa con los valores por defecto', () => {
  assert.deepEqual(presetState(params, presets[0]), { omega: 0.2, gamma: 0.2, mode: 'a', show: false });
});

test('interpolateState: numéricos suaves, discretos al final', () => {
  const from = defaultState(params);
  const to = presetState(params, presets[1]);
  const mid = interpolateState(params, from, to, 0.5);
  assert.equal(mid.omega, 2); // punto medio entre 1 y 3
  assert.ok(Math.abs(Number(mid.gamma) - 0.35) < 1e-12);
  assert.equal(mid.mode, 'a'); // todavía no ha cambiado
  assert.equal(mid.show, false);
  const late = interpolateState(params, from, to, 0.999);
  assert.equal(late.mode, 'a');
  assert.deepEqual(interpolateState(params, from, to, 0), from);
  // En t = 1 se devuelve exactamente el estado de llegada (mismo objeto).
  assert.equal(interpolateState(params, from, to, 1), to);
  assert.equal(interpolateState(params, from, to, 1.7), to);
});

test('findActivePreset reconoce el preset que coincide con el estado', () => {
  assert.equal(findActivePreset(params, presets, presetState(params, presets[1])), 'alto');
  assert.equal(findActivePreset(params, presets, defaultState(params)), null);
  const almost = { ...presetState(params, presets[0]), omega: 0.2 + 1e-13 };
  assert.equal(findActivePreset(params, presets, almost), 'bajo');
});

test('la transición dura 1,5 s por defecto y termina exactamente en el destino', () => {
  assert.equal(DEFAULT_TRANSITION_SECONDS, 1.5);
  const timer = fakeTimer();
  const from = defaultState(params);
  const to = presetState(params, presets[1]);
  /** @type {import('../src/core/state.js').State[]} */
  const frames = [];
  let done = 0;
  const transition = createTransition({ params, from, to, onFrame: (s) => frames.push(s), onDone: () => done++, ...timer });
  timer.advance(16); // primer fotograma: fija el instante inicial
  assert.deepEqual(frames[0], from);
  timer.advance(750); // mitad de 1,5 s
  assert.equal(frames[frames.length - 1].omega, 2);
  assert.equal(frames[frames.length - 1].mode, 'a');
  assert.equal(done, 0);
  timer.advance(749);
  assert.equal(transition.running, true);
  timer.advance(2);
  assert.equal(frames[frames.length - 1], to);
  assert.equal(done, 1);
  assert.equal(transition.running, false);
  assert.equal(timer.hasPending(), false);
  // Los valores numéricos avanzan de forma monótona hacia el destino.
  for (let i = 1; i < frames.length; i++) {
    assert.ok(Number(frames[i].omega) >= Number(frames[i - 1].omega));
  }
});

test('la duración es configurable; 0 salta directamente al final', () => {
  const timer = fakeTimer();
  const from = defaultState(params);
  const to = presetState(params, presets[0]);
  /** @type {import('../src/core/state.js').State[]} */
  const frames = [];
  let done = 0;
  createTransition({ params, from, to, duration: 0, onFrame: (s) => frames.push(s), onDone: () => done++, ...timer });
  assert.deepEqual(frames, [to]);
  assert.equal(done, 1);
  assert.equal(timer.hasPending(), false);

  frames.length = 0;
  createTransition({ params, from, to, duration: 0.2, onFrame: (s) => frames.push(s), ...timer });
  timer.advance(16);
  timer.advance(201);
  assert.equal(frames[frames.length - 1], to);
});

test('cancelar detiene la transición sin llamar a onDone', () => {
  const timer = fakeTimer();
  const from = defaultState(params);
  const to = presetState(params, presets[1]);
  let frames = 0;
  let done = 0;
  const transition = createTransition({ params, from, to, onFrame: () => frames++, onDone: () => done++, ...timer });
  timer.advance(16);
  timer.advance(300);
  const seen = frames;
  transition.cancel();
  assert.equal(transition.running, false);
  assert.equal(timer.hasPending(), false);
  timer.advance(5000);
  assert.equal(frames, seen);
  assert.equal(done, 0);
  transition.cancel(); // cancelar dos veces no hace nada
});

test('recorrido: empieza en el primer paso y avanza y retrocede sin salirse', () => {
  /** @type {import('../src/modules/types.js').Tour} */
  const tour = {
    id: 'demo',
    title: 'Demo',
    steps: [
      { preset: 'bajo', text: 'uno' },
      { preset: 'alto', text: 'dos' },
      { preset: 'bajo', text: 'tres' },
    ],
  };
  /** @type {[string, number][]} */
  const seen = [];
  const runner = createTourRunner(tour, (step, index) => seen.push([step.text, index]));
  assert.deepEqual(seen, [['uno', 0]]);
  assert.equal(runner.total, 3);
  assert.equal(runner.isFirst, true);
  assert.equal(runner.previous(), false); // ya está en el primero
  assert.equal(runner.next(), true);
  assert.equal(runner.next(), true);
  assert.equal(runner.isLast, true);
  assert.equal(runner.next(), false); // ya está en el último
  assert.equal(runner.previous(), true);
  assert.equal(runner.step.text, 'dos');
  runner.goTo(99);
  assert.equal(runner.index, 2);
  runner.goTo(-5);
  assert.equal(runner.index, 0);
  assert.deepEqual(seen.map((s) => s[0]), ['uno', 'dos', 'tres', 'dos', 'tres', 'uno']);
  assert.throws(() => createTourRunner({ id: 'vacío', title: '', steps: [] }, () => {}), /no tiene pasos/);
});
