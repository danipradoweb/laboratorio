// @ts-check
// Tests del mapa de teclas del modo presentación (src/core/presentation.js).
// Comprueban la lista de atajos de docs/ARQUITECTURA.md, "Modo presentación (tecla P)".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToAction } from '../src/core/presentation.js';

const presenting = { presenting: true, tourActive: false };
const normal = { presenting: false, tourActive: false };

test('P entra y sale en cualquier modo; Esc solo sale', () => {
  assert.deepEqual(keyToAction({ key: 'p' }, normal), { type: 'toggle-presentation' });
  assert.deepEqual(keyToAction({ key: 'P' }, presenting), { type: 'toggle-presentation' });
  assert.deepEqual(keyToAction({ key: 'Escape' }, presenting), { type: 'exit-presentation' });
  assert.equal(keyToAction({ key: 'Escape' }, normal), null);
});

test('en presentación: 1–9 presets, espacio pausa, [ ] velocidad, T texto, F pantalla completa', () => {
  assert.deepEqual(keyToAction({ key: '1' }, presenting), { type: 'preset', index: 0 });
  assert.deepEqual(keyToAction({ key: '9' }, presenting), { type: 'preset', index: 8 });
  assert.equal(keyToAction({ key: '0' }, presenting), null);
  assert.deepEqual(keyToAction({ key: ' ' }, presenting), { type: 'toggle-play' });
  assert.deepEqual(keyToAction({ key: '[' }, presenting), { type: 'slower' });
  assert.deepEqual(keyToAction({ key: ']' }, presenting), { type: 'faster' });
  assert.deepEqual(keyToAction({ key: 't' }, presenting), { type: 'toggle-tour-text' });
  assert.deepEqual(keyToAction({ key: 'T' }, presenting), { type: 'toggle-tour-text' });
  assert.deepEqual(keyToAction({ key: 'f' }, presenting), { type: 'toggle-fullscreen' });
  assert.deepEqual(keyToAction({ key: 'c' }, presenting), { type: 'toggle-theme' });
});

test('fuera de presentación esas teclas no hacen nada', () => {
  for (const key of ['1', ' ', '[', ']', 't', 'f', 'c']) {
    assert.equal(keyToAction({ key }, normal), null, `tecla "${key}"`);
  }
});

test('las flechas (y RePág/AvPág) mueven el recorrido solo si hay uno en curso', () => {
  const tour = { presenting: false, tourActive: true };
  assert.deepEqual(keyToAction({ key: 'ArrowRight' }, tour), { type: 'tour-next' });
  assert.deepEqual(keyToAction({ key: 'ArrowLeft' }, tour), { type: 'tour-previous' });
  assert.deepEqual(keyToAction({ key: 'PageDown' }, tour), { type: 'tour-next' });
  assert.deepEqual(keyToAction({ key: 'PageUp' }, tour), { type: 'tour-previous' });
  assert.deepEqual(keyToAction({ key: 'ArrowRight' }, { presenting: true, tourActive: true }), { type: 'tour-next' });
  assert.equal(keyToAction({ key: 'ArrowRight' }, normal), null);
  assert.equal(keyToAction({ key: 'ArrowRight' }, presenting), null);
});

test('los atajos del navegador (Ctrl, Cmd, Alt) no se interceptan', () => {
  assert.equal(keyToAction({ key: 'p', ctrlKey: true }, normal), null); // imprimir
  assert.equal(keyToAction({ key: 'f', metaKey: true }, presenting), null); // buscar
  assert.equal(keyToAction({ key: 'ArrowLeft', altKey: true }, { presenting: true, tourActive: true }), null); // atrás
  assert.equal(keyToAction({ key: '1', ctrlKey: true }, presenting), null); // cambiar de pestaña
});

// En un teclado español los corchetes se escriben con AltGr, que llega como Ctrl+Alt.
// Además, las teclas físicas a la derecha de la P sirven sin AltGr.
test('corchetes en teclado español: AltGr y teclas físicas', () => {
  assert.deepEqual(keyToAction({ key: '[', ctrlKey: true, altKey: true }, presenting), { type: 'slower' });
  assert.deepEqual(keyToAction({ key: ']', ctrlKey: true, altKey: true }, presenting), { type: 'faster' });
  assert.deepEqual(keyToAction({ key: '`', code: 'BracketLeft' }, presenting), { type: 'slower' });
  assert.deepEqual(keyToAction({ key: '+', code: 'BracketRight' }, presenting), { type: 'faster' });
  assert.equal(keyToAction({ key: '+', code: 'BracketRight' }, normal), null);
});
