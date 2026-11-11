// @ts-check
// Tests de src/core/clock.js con un temporizador falso (sin navegador).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, SPEEDS } from '../src/core/clock.js';

/** Temporizador falso: guarda la función pedida y la ejecuta cuando el test quiere. */
function fakeTimer() {
  /** @type {((t: number) => void) | null} */
  let pending = null;
  let now = 0;
  return {
    requestFrame: (/** @type {(t: number) => void} */ cb) => {
      pending = cb;
      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
    /** Avanza el tiempo real `ms` milisegundos y ejecuta el fotograma pendiente. */
    advance(/** @type {number} */ ms) {
      now += ms;
      const cb = pending;
      pending = null;
      if (cb) cb(now);
    },
    hasPending: () => pending !== null,
  };
}

test('el tiempo avanza al ritmo real multiplicado por la velocidad', () => {
  const timer = fakeTimer();
  const clock = createClock(timer);
  /** @type {number[]} */
  const dts = [];
  clock.onTick((_t, dt) => dts.push(dt));
  timer.advance(16); // primer fotograma: fija la referencia, dt = 0
  timer.advance(50);
  timer.advance(50);
  assert.ok(Math.abs(clock.time - 0.1) < 1e-12);
  clock.setSpeed(2);
  timer.advance(50);
  assert.ok(Math.abs(clock.time - 0.2) < 1e-12);
  assert.deepEqual(dts.map((d) => Number(d.toFixed(6))), [0, 0.05, 0.05, 0.1]);
});

test('en pausa no se piden fotogramas y el tiempo no avanza', () => {
  const timer = fakeTimer();
  const clock = createClock(timer);
  clock.onTick(() => {});
  timer.advance(16);
  timer.advance(100);
  const t = clock.time;
  clock.pause();
  assert.equal(clock.playing, false);
  assert.equal(timer.hasPending(), false);
  timer.advance(5000);
  assert.equal(clock.time, t);
  // Al reanudar no se cuenta el tiempo que estuvo en pausa.
  clock.play();
  timer.advance(16);
  assert.equal(clock.time, t);
  timer.advance(100);
  assert.ok(Math.abs(clock.time - t - 0.1) < 1e-12);
});

test('un fotograma muy largo (pestaña en segundo plano) se recorta a 0,1 s', () => {
  const timer = fakeTimer();
  const clock = createClock(timer);
  clock.onTick(() => {});
  timer.advance(16);
  timer.advance(60000);
  assert.ok(Math.abs(clock.time - 0.1) < 1e-12);
});

test('faster y slower recorren la escala de velocidades sin salirse', () => {
  const clock = createClock(fakeTimer());
  assert.equal(clock.speed, 1);
  clock.faster();
  assert.equal(clock.speed, 2);
  for (let i = 0; i < 10; i++) clock.faster();
  assert.equal(clock.speed, SPEEDS[SPEEDS.length - 1]);
  for (let i = 0; i < 20; i++) clock.slower();
  assert.equal(clock.speed, SPEEDS[0]);
});

test('onChange avisa de pausa y velocidad; reset vuelve a t = 0', () => {
  const timer = fakeTimer();
  const clock = createClock(timer);
  let changes = 0;
  clock.onChange(() => changes++);
  /** @type {number[]} */
  const times = [];
  clock.onTick((t) => times.push(t));
  timer.advance(16);
  timer.advance(100);
  clock.toggle();
  clock.toggle();
  clock.faster();
  assert.equal(changes, 3);
  clock.reset();
  assert.equal(clock.time, 0);
  assert.equal(times[times.length - 1], 0);
});

test('sin suscriptores no se piden fotogramas; destroy lo para todo', () => {
  const timer = fakeTimer();
  const clock = createClock(timer);
  assert.equal(timer.hasPending(), false);
  const off = clock.onTick(() => {});
  assert.equal(timer.hasPending(), true);
  off();
  assert.equal(timer.hasPending(), false);
  clock.onTick(() => {});
  clock.destroy();
  assert.equal(timer.hasPending(), false);
});
