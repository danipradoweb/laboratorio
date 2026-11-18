// @ts-check
// Tests de src/core/ficha-sections.js: qué trozo de la ficha va debajo de cada gráfica
// (encargo R1, «un solo texto en un solo sitio»). No hay física aquí: se comprueba que el
// reparto sigue las marcas que documenta la cabecera del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { graphTexts } from '../src/core/ficha-sections.js';

const FICHA = `# Módulo

## Qué estás viendo

Introducción común.

### La función de onda {#psi}

**Qué ves.** Ejes y colores.
Sigue la misma parte.

**Cómo leerla.** La idea, sin ecuaciones.

**Prueba esto.** (1) Una acción. (2) Otra.

### Una sin marca

**Qué ves.** No es de ninguna gráfica.

## Qué es físico y qué es representación

- Nada.

## Ecuaciones

Común a todas.

<!-- gráficas: psi momentos -->
Paquete gaussiano:

$$\\psi = e^{ikx}$$

<!-- fin -->
Otra vez común.

<!-- graficas: momentos -->
Solo de momentos.

## Límites del modelo

- Para todas.
- Malla finita. <!-- gráficas: psi -->
- Paso de tiempo. <!-- gráficas: psi, momentos -->

## Referencias

- Libro.
`;

test('cada apartado ### con {#id} da sus tres partes, sin las etiquetas en negrita', () => {
  const t = graphTexts(FICHA).get('psi');
  assert.ok(t);
  assert.equal(t.title, 'La función de onda');
  assert.equal(t.see, 'Ejes y colores.\nSigue la misma parte.');
  assert.equal(t.read, 'La idea, sin ecuaciones.');
  assert.equal(t.tryThis, '(1) Una acción. (2) Otra.');
});

test('«Más detalle»: las marcas de Ecuaciones y Límites reparten los trozos por gráfica', () => {
  const texts = graphTexts(FICHA);
  const psi = texts.get('psi');
  const mom = texts.get('momentos');
  assert.ok(psi && mom);
  // Marca en su línea: vale hasta <!-- fin -->, la siguiente marca o el siguiente título.
  assert.equal(psi.equations, 'Paquete gaussiano:\n\n$$\\psi = e^{ikx}$$');
  assert.equal(mom.equations, 'Paquete gaussiano:\n\n$$\\psi = e^{ikx}$$\n\nSolo de momentos.');
  // Marca al final de un elemento de lista: vale solo para él.
  assert.equal(psi.limits, '- Malla finita.\n- Paso de tiempo.');
  assert.equal(mom.limits, '- Paso de tiempo.');
  // Lo que no lleva marca no va a ninguna gráfica, y un apartado sin {#id} no cuenta.
  assert.ok(!psi.equations.includes('común'));
  assert.equal([...texts.keys()].sort().join(','), 'momentos,psi');
});

test('la ficha de funcion-onda se lee sin trozos vacíos en las gráficas que tienen apartado', () => {
  const ficha = readFileSync(new URL('../src/modules/funcion-onda/ficha.md', import.meta.url), 'utf8');
  for (const [id, t] of graphTexts(ficha)) {
    if (!t.title) continue; // solo citada en Ecuaciones o Límites
    assert.ok(t.see && t.read && t.tryThis, `apartado {#${id}}: falta alguna de las tres partes`);
  }
});
