// @ts-check
// Tests de src/ui/plot-tex.js: rótulos con fórmulas sencillas para el lienzo (encargo R1:
// «variables en cursiva, ⟨ ⟩ de verdad y subíndices y superíndices legibles»). No hay física.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainLabel, texRuns, unknownCommands } from '../src/ui/plot-tex.js';

test('texto sin $…$: un solo trozo en redonda, tal cual (los módulos sin migrar no cambian)', () => {
  assert.deepEqual(texRuns('Amplitud (relativa)'), [{ text: 'Amplitud (relativa)', italic: false, level: 0 }]);
});

test('variables en cursiva, unidades en redonda, ⟨ ⟩ de verdad', () => {
  assert.deepEqual(texRuns('posición $x$ (nm)'), [
    { text: 'posición ', italic: false, level: 0 },
    { text: 'x', italic: true, level: 0 },
    { text: ' (nm)', italic: false, level: 0 },
  ]);
  assert.equal(plainLabel('$\\langle x\\rangle$ (nm)'), '⟨x⟩ (nm)');
  assert.deepEqual(texRuns('$\\langle x\\rangle$')[1], { text: 'x', italic: true, level: 0 });
});

test('superíndices y subíndices, con llaves o con un carácter; el guion es un signo menos', () => {
  assert.deepEqual(texRuns('$|\\psi|^2$'), [
    { text: '|', italic: false, level: 0 },
    { text: 'ψ', italic: true, level: 0 },
    { text: '|', italic: false, level: 0 },
    { text: '2', italic: false, level: 1 },
  ]);
  assert.deepEqual(texRuns('$\\mathrm{nm}^{-1}$'), [
    { text: 'nm', italic: false, level: 0 },
    { text: '−1', italic: false, level: 1 },
  ]);
  assert.deepEqual(texRuns('$E_{n}$').map((r) => [r.text, r.level]), [['E', 0], ['n', -1]]);
  assert.equal(plainLabel('$c_1 e^{-iE_1t/\\hbar}$'), 'c1e−iE1t/ℏ');
});

test('griegas: minúsculas en cursiva, mayúsculas en redonda; \\text en redonda con sus espacios', () => {
  assert.deepEqual(texRuns('$\\Delta x\\,\\Delta p/\\hbar$').map((r) => [r.text, r.italic]), [
    ['Δ', false], ['x', true], [' Δ', false], ['p', true], ['/ℏ', false],
  ]);
  assert.equal(plainLabel('$T_1 = 2L/c$'), 'T1=2L/c');
  assert.equal(texRuns('$\\text{a b}$')[0].text, 'a b');
});

test('órdenes desconocidas: se escriben tal cual y unknownCommands las encuentra', () => {
  assert.deepEqual(unknownCommands('$\\frac{a}{b}$'), ['\\frac']);
  assert.deepEqual(unknownCommands('$\\psi$ y $\\varphi_2$'), []);
});

// Los rótulos de las gráficas de funcion-onda (cadenas con $…$ entre comillas simples en sus
// vistas) solo usan órdenes que el lienzo sabe dibujar.
test('funcion-onda: los rótulos con fórmulas de sus vistas no usan órdenes desconocidas', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../src/modules/funcion-onda/', import.meta.url);
  let checked = 0;
  for (const file of readdirSync(dir).filter((f) => /^view.*\.js$/.test(f))) {
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const m of source.matchAll(/'([^'\n]*\$[^'\n]*)'/g)) {
      const label = m[1].replace(/\\\\/g, '\\');
      assert.deepEqual(unknownCommands(label), [], `${file}: ${label}`);
      checked++;
    }
  }
  assert.ok(checked > 15, `solo se han encontrado ${checked} rótulos`);
});
