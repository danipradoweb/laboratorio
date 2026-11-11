// @ts-check
// PLANTILLA · tests de la física (src/modules/_plantilla/physics.js).
//
// REGLAS:
//   - Cada test lleva un comentario que dice QUÉ PRINCIPIO comprueba y DE DÓNDE SALE el
//     valor esperado (solución analítica, límite conocido, ley de conservación,
//     referencia independiente o valor experimental).
//   - Si un test falla, el error está en el código o en la referencia: se investiga.
//     Nunca se cambia el valor esperado para que el test pase.
//   - Orden de preferencia de las comprobaciones: ver docs/ARQUITECTURA.md, "Tests".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angularFrequency, modeShape, displacement, nodePositions } from '../src/modules/_plantilla/physics.js';

const base = { n: 3, amplitude: 0.7, length: 2, speed: 1.5, ends: /** @type {const} */ ('fijos') };

// Principio: la onda estacionaria es solución de la ecuación de ondas,
//   ∂²y/∂t² = c² · ∂²y/∂x².
// Se comprueba con derivadas numéricas (diferencias centradas, error O(h²)) en varios
// puntos y para las dos condiciones de contorno. Tolerancia: 1e-5 relativa, coherente
// con h = 1e-3.
test('y(x, t) cumple la ecuación de ondas', () => {
  const h = 1e-3;
  for (const ends of /** @type {const} */ (['fijos', 'libres'])) {
    const p = { ...base, ends };
    for (const [x, t] of [[0.3, 0.2], [1.1, 0.9], [1.7, 2.4]]) {
      const ytt = (displacement(x, t + h, p) - 2 * displacement(x, t, p) + displacement(x, t - h, p)) / h ** 2;
      const yxx = (displacement(x + h, t, p) - 2 * displacement(x, t, p) + displacement(x - h, t, p)) / h ** 2;
      const scale = Math.abs(ytt) + Math.abs(p.speed ** 2 * yxx) + 1e-12;
      assert.ok(Math.abs(ytt - p.speed ** 2 * yxx) / scale < 1e-5, `${ends}, x=${x}, t=${t}`);
    }
  }
});

// Principio: condiciones de contorno. Extremos fijos: y = 0 en x = 0 y x = L, en todo
// instante. Extremos libres: pendiente ∂y/∂x = 0 en los extremos.
test('condiciones de contorno en los extremos', () => {
  for (const t of [0, 0.37, 1.9]) {
    assert.ok(Math.abs(displacement(0, t, base)) < 1e-14);
    assert.ok(Math.abs(displacement(base.length, t, base)) < 1e-14);
    const free = { ...base, ends: /** @type {const} */ ('libres') };
    const h = 1e-5;
    // Derivadas laterales exactas a orden h: en un extremo libre la pendiente es nula.
    const slopeLeft = (displacement(h, t, free) - displacement(0, t, free)) / h;
    const slopeRight = (displacement(free.length, t, free) - displacement(free.length - h, t, free)) / h;
    assert.ok(Math.abs(slopeLeft) < 1e-3 && Math.abs(slopeRight) < 1e-3);
  }
});

// Principio: frecuencias propias de una cuerda, ω_n = nπc/L: son múltiplos enteros de
// la fundamental (armónicos). Valor esperado: fórmula analítica; con L = 2 y c = 1,5,
// ω_1 = π·1,5/2.
test('las frecuencias propias son múltiplos de la fundamental', () => {
  const w1 = angularFrequency(1, 2, 1.5);
  assert.ok(Math.abs(w1 - (Math.PI * 1.5) / 2) < 1e-15);
  for (let n = 1; n <= 6; n++) {
    assert.ok(Math.abs(angularFrequency(n, 2, 1.5) - n * w1) < 1e-12);
  }
});

// Principio: en un nodo la cuerda no se mueve nunca. El modo n tiene n + 1 nodos con
// extremos fijos (contando los extremos) y n con extremos libres.
test('nodos: número correcto y desplazamiento nulo en todo instante', () => {
  for (let n = 1; n <= 5; n++) {
    const fixed = nodePositions(n, 2, 'fijos');
    const free = nodePositions(n, 2, 'libres');
    assert.equal(fixed.length, n + 1);
    assert.equal(free.length, n);
    for (const x of fixed) assert.ok(Math.abs(modeShape(x, n, 2, 'fijos')) < 1e-12);
    for (const x of free) assert.ok(Math.abs(modeShape(x, n, 2, 'libres')) < 1e-12);
  }
});

// Principio: la amplitud máxima del movimiento es A (en un vientre y en t = 0).
test('la amplitud en un vientre es A', () => {
  const p = { ...base, n: 1 };
  assert.ok(Math.abs(displacement(p.length / 2, 0, p) - p.amplitude) < 1e-15);
  // Medio periodo después, el vientre está en −A.
  const halfPeriod = Math.PI / angularFrequency(1, p.length, p.speed);
  assert.ok(Math.abs(displacement(p.length / 2, halfPeriod, p) + p.amplitude) < 1e-14);
});
