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

// Convenio de mallas: por filas (índice iy·nx + ix) y con cada valor en el CENTRO de su
// celda, igual que los mapas de plot2d.js. Con nx = 5 y half = 2 las celdas miden 0,8 y
// sus centros están en x = −1,6; −0,8; 0; 0,8; 1,6. Con ny = 3: y = −4/3; 0; 4/3.
test('sampleGrid: malla por filas con valores en el centro de cada celda', () => {
  const p = { sigma: 1, k: 3 };
  const nx = 5;
  const ny = 3;
  const { re, im } = sampleGrid(p, nx, ny, 2);
  const z = gaussianPacket(0.8, -4 / 3, p); // ix = 3, iy = 0
  assert.ok(Math.abs(re[0 * nx + 3] - z.re) < 1e-15);
  assert.ok(Math.abs(im[0 * nx + 3] - z.im) < 1e-15);
  const center = gaussianPacket(0, 0, p); // ix = 2, iy = 1: el centro del cuadrado
  assert.ok(Math.abs(re[1 * nx + 2] - center.re) < 1e-15);
  // Simetría: la celda de la esquina opuesta está en (−x, −y), donde |ψ| vale lo mismo.
  const a = Math.hypot(re[0], im[0]);
  const b = Math.hypot(re[nx * ny - 1], im[nx * ny - 1]);
  assert.ok(Math.abs(a - b) < 1e-15);
});
