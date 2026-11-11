// @ts-check
// Tests de src/core/markdown.js (conversor mínimo de Markdown para fichas y recorridos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, renderInline, escapeHtml } from '../src/core/markdown.js';

test('títulos de nivel 1 a 3', () => {
  assert.equal(renderMarkdown('# Título'), '<h1>Título</h1>');
  assert.equal(renderMarkdown('## Sección'), '<h2>Sección</h2>');
  assert.equal(renderMarkdown('### Apartado'), '<h3>Apartado</h3>');
});

test('párrafos: se separan con una línea en blanco y las líneas seguidas se unen', () => {
  assert.equal(
    renderMarkdown('Primera línea\nsegunda línea.\n\nOtro párrafo.'),
    '<p>Primera línea segunda línea.</p>\n<p>Otro párrafo.</p>',
  );
});

test('listas con viñetas y numeradas, con líneas de continuación', () => {
  assert.equal(renderMarkdown('- uno\n- dos\n  sigue\n* tres'), '<ul><li>uno</li><li>dos sigue</li><li>tres</li></ul>');
  assert.equal(renderMarkdown('1. primero\n2. segundo'), '<ol><li>primero</li><li>segundo</li></ol>');
  assert.equal(
    renderMarkdown('Texto\n- a\n- b\n\nMás texto'),
    '<p>Texto</p>\n<ul><li>a</li><li>b</li></ul>\n<p>Más texto</p>',
  );
});

test('énfasis, código y enlaces', () => {
  assert.equal(renderInline('**negrita** y *cursiva*'), '<strong>negrita</strong> y <em>cursiva</em>');
  assert.equal(renderInline('usa `npm test` siempre'), 'usa <code>npm test</code> siempre');
  assert.equal(
    renderInline('ver [Feynman](https://www.feynmanlectures.caltech.edu/I_23.html)'),
    'ver <a href="https://www.feynmanlectures.caltech.edu/I_23.html">Feynman</a>',
  );
  // Un asterisco suelto (un producto, por ejemplo) no abre cursiva.
  assert.equal(renderInline('2 * 3 = 6'), '2 * 3 = 6');
});

test('el HTML del texto se escapa; los enlaces peligrosos no se convierten', () => {
  assert.equal(renderInline('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
  assert.equal(renderMarkdown('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(renderInline('[x](javascript:alert(1))'), '[x](javascript:alert(1))');
  assert.equal(escapeHtml('"<&>"'), '&quot;&lt;&amp;&gt;&quot;');
});

test('fórmulas en línea: el TeX queda intacto en data-tex', () => {
  assert.equal(
    renderInline('la energía $E = \\hbar\\omega$ del fotón'),
    'la energía <span class="math math-inline" data-tex="E = \\hbar\\omega">E = \\hbar\\omega</span> del fotón',
  );
});

// Dentro de una fórmula, los guiones bajos y asteriscos son de TeX, no énfasis.
test('dentro de una fórmula no se interpreta Markdown', () => {
  const html = renderInline('si $a_i * b_j * c^*$ y *también* $x_1$');
  assert.ok(html.includes('data-tex="a_i * b_j * c^*"'));
  assert.ok(html.includes('data-tex="x_1"'));
  assert.ok(html.includes('<em>también</em>'));
  assert.equal((html.match(/<em>/g) ?? []).length, 1);
  // Los signos < y & de una fórmula se escapan para el atributo y se conservan.
  assert.ok(renderInline('$a < b$').includes('data-tex="a &lt; b"'));
});

test('fórmulas en bloque: en una línea, en varias y dentro de un párrafo', () => {
  assert.equal(
    renderMarkdown('$$m\\ddot x = F$$'),
    '<div class="math math-block" data-tex="m\\ddot x = F">m\\ddot x = F</div>',
  );
  assert.equal(
    renderMarkdown('Antes\n\n$$\nA = \\frac{F_0}{m}\n$$\n\nDespués'),
    '<p>Antes</p>\n<div class="math math-block" data-tex="A = \\frac{F_0}{m}">A = \\frac{F_0}{m}</div>\n<p>Después</p>',
  );
  // Un $$…$$ dentro de un párrafo se muestra como bloque, pero con <span>: un <div>
  // dentro de un <p> no es HTML válido.
  assert.equal(
    renderMarkdown('La fase es constante: $$\\psi = 1$$'),
    '<p>La fase es constante: <span class="math math-block" data-tex="\\psi = 1">\\psi = 1</span></p>',
  );
});

test('el signo de dólar: precios y escape con barra', () => {
  // "$ 5 y $ 6" no es una fórmula (hay espacio tras el primer $).
  assert.equal(renderInline('cuesta $ 5 o $ 6'), 'cuesta $ 5 o $ 6');
  assert.equal(renderInline('cuesta \\$5'), 'cuesta $5');
});

test('bloques de código: sin interpretar nada dentro', () => {
  assert.equal(
    renderMarkdown('```\nconst a = b < c; // *no* cursiva\n```'),
    '<pre><code>const a = b &lt; c; // *no* cursiva</code></pre>',
  );
});

test('una ficha completa conserva el orden de sus secciones', () => {
  const html = renderMarkdown('# Módulo\n\n## Qué estás viendo\n\nTexto.\n\n## Ecuaciones\n\n$$E = mc^2$$\n\n- uno\n- dos');
  const order = ['<h1>Módulo</h1>', '<h2>Qué estás viendo</h2>', '<p>Texto.</p>', '<h2>Ecuaciones</h2>', 'math-block', '<ul>'];
  let position = -1;
  for (const piece of order) {
    const index = html.indexOf(piece);
    assert.ok(index > position, `falta o está fuera de orden: ${piece}`);
    position = index;
  }
});
