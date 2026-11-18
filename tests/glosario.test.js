// @ts-check
// Glosario común (data/glosario.json, encargo R1). No hay física: se comprueba que cada
// término tiene una definición corta y sin ecuaciones (primer nivel) y que todo término
// marcado en los textos de los módulos con simulaciones existe en el glosario.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { termId, termsIn } from '../src/core/markdown.js';
import { modules } from '../src/modules/registry.js';
import { isPilot } from '../src/core/simulations.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const glossary = JSON.parse(readFileSync(join(root, 'data/glosario.json'), 'utf8'));
/** @type {{ id: string, termino: string, definicion: string }[]} */
const terms = glossary.terminos;

test('glosario: identificadores únicos, que salen del término, y definiciones de una o dos frases sin ecuaciones', () => {
  const ids = terms.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'identificadores repetidos');
  for (const t of terms) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(t.termino.trim().length > 0 && t.definicion.trim().length > 20, `«${t.id}»: falta el término o la definición`);
    // El id es el término en minúsculas sin tildes (salvo nombres propios abreviados).
    if (t.id !== 'fraunhofer') assert.equal(termId(t.termino), t.id, `«${t.termino}»: el id debería ser ${termId(t.termino)}`);
    assert.ok(!t.definicion.includes('$'), `«${t.id}»: sin ecuaciones en el glosario`);
    const sentences = t.definicion.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).length;
    assert.ok(sentences <= 2, `«${t.id}»: ${sentences} frases (como mucho dos)`);
  }
});

test('glosario: todo término marcado en las fichas y párrafos de entrada de los módulos con simulaciones existe', () => {
  const ids = new Set(terms.map((t) => t.id));
  for (const m of modules.filter(isPilot)) {
    const texts = [readFileSync(join(root, 'src/modules', m.id, 'ficha.md'), 'utf8'), m.intro ?? ''];
    for (const text of texts) {
      for (const id of termsIn(text)) assert.ok(ids.has(id), `[${m.id}] el término "${id}" no está en data/glosario.json`);
    }
  }
});
