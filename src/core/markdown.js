// @ts-check
// Conversor mínimo de Markdown a HTML para las fichas y los textos de los recorridos.
//
// Admite solo lo que usan las fichas:
//   # Título, ## Sección, ### Apartado
//   párrafos separados por una línea en blanco
//   listas con "- " o "* " y listas numeradas con "1. "
//   **negrita**, *cursiva*, `código` y [enlaces](https://…)
//   fórmulas en línea $…$ y en bloque $$…$$ (TeX, las dibuja KaTeX en src/ui/ficha.js)
//   bloques de código entre líneas ```
//
// No es un Markdown completo: no hay tablas, imágenes, citas ni listas anidadas. Si una
// ficha necesita algo más, se amplía aquí con su test.
//
// Función pura (texto → texto HTML), sin DOM: se prueba en Node.
//
// Las fórmulas salen como <span class="math math-inline" data-tex="…"> o como un
// elemento con class="math math-block" data-tex="…", con el TeX también como texto visible por
// si KaTeX no llega a cargarse. Dentro de una fórmula no se interpreta nada: los
// asteriscos y guiones bajos de TeX se respetan.

/**
 * Escapa los caracteres especiales de HTML.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML de una fórmula.
 * @param {string} tex
 * @param {'inline' | 'block' | 'block-in-text'} kind
 *   'block-in-text' es un $$…$$ escrito dentro de un párrafo: se muestra como bloque,
 *   pero con <span>, porque un <div> dentro de un <p> no es HTML válido.
 * @returns {string}
 */
function mathHtml(tex, kind) {
  const safe = escapeHtml(tex.trim());
  if (kind === 'block') return `<div class="math math-block" data-tex="${safe}">${safe}</div>`;
  const cls = kind === 'inline' ? 'math math-inline' : 'math math-block';
  return `<span class="${cls}" data-tex="${safe}">${safe}</span>`;
}

/**
 * Solo se permiten enlaces web, anclas y rutas relativas (nada de "javascript:").
 * @param {string} url
 * @returns {boolean}
 */
function isSafeUrl(url) {
  return /^(https?:\/\/|#|\.{0,2}\/|[\w-]+[/.])/.test(url) && !/^\s*javascript:/i.test(url);
}

/**
 * Convierte el formato dentro de una línea o párrafo: fórmulas, código, énfasis y enlaces.
 * @param {string} text
 * @returns {string}
 */
export function renderInline(text) {
  // 1) Se apartan las fórmulas y el código, para que nada de lo siguiente los toque.
  /** @type {string[]} */
  const stash = [];
  /** @param {string} html */
  const keep = (html) => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };
  let work = text
    .replace(/\\\$/g, () => keep('$')) // "\$" es un signo de dólar literal
    .replace(/\$\$([^$]+?)\$\$/g, (_m, tex) => keep(mathHtml(tex, 'block-in-text')))
    .replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_m, tex) => keep(mathHtml(tex, 'inline')))
    .replace(/`([^`\n]+)`/g, (_m, code) => keep(`<code>${escapeHtml(code)}</code>`));

  // 2) Se escapa el HTML del texto normal.
  work = escapeHtml(work);

  // 3) Enlaces y énfasis.
  work = work
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) =>
      isSafeUrl(url) ? `<a href="${url}">${label}</a>` : match,
    )
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\s](?:[^*\n]*?[^*\s])?)\*/g, '<em>$1</em>');

  // 4) Se devuelven a su sitio las fórmulas y el código.
  return work.replace(/\u0000(\d+)\u0000/g, (_m, i) => stash[Number(i)]);
}

/**
 * Convierte un documento Markdown en HTML.
 * @param {string} markdown
 * @returns {string}
 */
export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  let paragraph = [];
  /** @type {{ tag: 'ul' | 'ol', items: string[] } | null} */
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      out.push(`<${list.tag}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${list.tag}>`);
    }
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Bloque de código: se copia tal cual hasta la línea de cierre.
    if (trimmed.startsWith('```')) {
      flush();
      /** @type {string[]} */
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // Fórmula en bloque: $$ … $$ en una línea, o varias líneas entre dos líneas "$$".
    if (trimmed.startsWith('$$')) {
      const single = trimmed.match(/^\$\$(.+)\$\$$/);
      if (single) {
        flush();
        out.push(mathHtml(single[1], 'block'));
        continue;
      }
      if (trimmed === '$$') {
        flush();
        /** @type {string[]} */
        const tex = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '$$') tex.push(lines[i++]);
        out.push(mathHtml(tex.join('\n'), 'block'));
        continue;
      }
    }

    if (trimmed === '') {
      flush();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(/** @type {RegExpMatchArray} */ (bullet ?? numbered)[1]);
      continue;
    }

    // Línea de continuación: sigue el elemento de lista abierto o el párrafo.
    if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flush();
  return out.join('\n');
}
