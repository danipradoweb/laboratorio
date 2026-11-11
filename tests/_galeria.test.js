// @ts-check
// Tests de la función de prueba de la galería (src/modules/_galeria/physics.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gaussianPacket, sampleGrid } from '../src/modules/_galeria/physics.js';

// Por construcción, |ψ|² = exp(−r²/σ²) y arg ψ = k·x (módulo 2π).
test('módulo y fase del paquete gaussiano', () => {
  const p = { sigma: 1.5, k: 2 };
  for (const [x, y] of [[0, 0], [0.5, -1], [-1.2, 0.7], [2, 2]]) {
    const z = gaussianPacket(x, y, p);
    const expected = Math.exp(-(x * x + y * y) / p.sigma ** 2);
    assert.ok(Math.abs(z.re ** 2 + z.im ** 2 - expected) < 1e-14);
    const phase = Math.atan2(z.im, z.re);
    assert.ok(Math.abs(Math.sin(phase - p.k * x)) < 1e-12);
    assert.ok(Math.cos(phase - p.k * x) > 0);
  }
});

// La malla va por filas: el índice iy·nx + ix corresponde a (x_ix, y_iy).
test('sampleGrid ordena la malla por filas', () => {
  const p = { sigma: 1, k: 3 };
  const nx = 5;
  const ny = 3;
  const { re, im } = sampleGrid(p, nx, ny, 2);
  const z = gaussianPacket(1, -2, p); // ix = 3 (x = 1), iy = 0 (y = −2)
  assert.ok(Math.abs(re[0 * nx + 3] - z.re) < 1e-15);
  assert.ok(Math.abs(im[0 * nx + 3] - z.im) < 1e-15);
  const center = gaussianPacket(0, 0, p); // ix = 2, iy = 1
  assert.equal(re[1 * nx + 2], center.re);
});
