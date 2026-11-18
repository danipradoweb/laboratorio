// @ts-check
// Trozos de una ficha que explican cada gráfica (formato con simulaciones, encargo R1).
//
// Un solo texto en un solo sitio: la explicación que sale debajo de cada gráfica es la de
// ficha.md, que sigue mostrándose entera con el botón «Ficha». Para unir cada trozo a su
// gráfica, la ficha usa dos marcas:
//
//   ### La función de onda ψ(x) {#psi}
//     En «Qué estás viendo»: el apartado de la gráfica `psi`. Dentro, tres partes que
//     empiezan por **Qué ves.**, **Cómo leerla.** y **Prueba esto.**
//
//   <!-- gráficas: psi momentos -->
//     En «Ecuaciones» y «Límites del modelo»: lo que sigue (hasta la próxima marca, hasta
//     `<!-- fin -->` o hasta el próximo título) va al desplegable «Más detalle» de esas
//     gráficas. Al final de un elemento de lista, la marca vale solo para ese elemento.
//
// Los comentarios <!-- … --> no se ven en la ficha completa (src/core/markdown.js los quita).
// Función pura, sin DOM: se prueba en Node (tests/ficha-sections.test.js).

/**
 * @typedef {object} GraphText
 * @property {string} title título del apartado, sin la marca {#id}
 * @property {string} see «Qué ves» (Markdown, sin la etiqueta)
 * @property {string} read «Cómo leerla»
 * @property {string} tryThis «Prueba esto»
 * @property {string} equations trozos de «Ecuaciones» marcados para la gráfica (Markdown)
 * @property {string} limits trozos de «Límites del modelo» marcados para la gráfica (Markdown)
 */

/** Marca de identificador al final de un título: «### Título {#id}». */
export const HEADING_ID = /\s*\{#([a-z0-9-]+)\}\s*$/;
/** Marca de gráficas: «<!-- gráficas: a b -->» (con o sin tilde). */
const GRAPHS_MARK = /<!--\s*gr[aá]ficas:\s*([a-z0-9\s,-]+?)\s*-->/;
const END_MARK = /^<!--\s*fin\s*-->$/;

const PARTS = /** @type {const} */ ([
  ['see', 'Qué ves.'],
  ['read', 'Cómo leerla.'],
  ['tryThis', 'Prueba esto.'],
]);

/** @returns {GraphText} */
const emptyText = () => ({ title: '', see: '', read: '', tryThis: '', equations: '', limits: '' });

/**
 * Lee una ficha y devuelve, por identificador de gráfica, sus trozos de texto.
 * @param {string} markdown
 * @returns {Map<string, GraphText>}
 */
export function graphTexts(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  /** @type {Map<string, GraphText>} */
  const texts = new Map();
  /** @param {string} id */
  const textOf = (id) => {
    let t = texts.get(id);
    if (!t) {
      t = emptyText();
      texts.set(id, t);
    }
    return t;
  };

  let section = '';
  /** Apartado ### abierto en «Qué estás viendo». @type {{ id: string, lines: string[] } | null} */
  let open = null;
  /** Gráficas a las que va lo que se lee en «Ecuaciones» o «Límites». @type {string[]} */
  let targets = [];

  const closeOpen = () => {
    if (open) splitParts(textOf(open.id), open.lines);
    open = null;
  };
  /** @param {string[]} ids @param {string} line */
  const addDetail = (ids, line) => {
    const key = section === 'Ecuaciones' ? 'equations' : 'limits';
    for (const id of ids) {
      const t = textOf(id);
      t[key] += `${line}\n`;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeOpen();
      targets = [];
      if (heading[1].length <= 2) section = heading[2].trim();
      else if (section === 'Qué estás viendo') {
        const id = heading[2].match(HEADING_ID);
        if (id) {
          open = { id: id[1], lines: [] };
          textOf(id[1]).title = heading[2].replace(HEADING_ID, '').trim();
        }
      }
      continue;
    }
    if (open) {
      open.lines.push(line);
      continue;
    }
    if (section !== 'Ecuaciones' && section !== 'Límites del modelo') continue;
    if (END_MARK.test(trimmed)) {
      targets = [];
      continue;
    }
    const mark = trimmed.match(GRAPHS_MARK);
    if (mark && trimmed.startsWith('<!--')) {
      // Marca en su propia línea: vale para lo que sigue.
      targets = idsOf(mark[1]);
      continue;
    }
    if (mark && /^\s*[-*]\s+/.test(line)) {
      // Marca al final de un elemento de lista: vale solo para él.
      addDetail(idsOf(mark[1]), line.replace(GRAPHS_MARK, '').trimEnd());
      continue;
    }
    if (targets.length > 0) addDetail(targets, line);
  }
  closeOpen();
  for (const t of texts.values()) {
    t.equations = t.equations.trim();
    t.limits = t.limits.trim();
  }
  return texts;
}

/** @param {string} list */
function idsOf(list) {
  return list
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * Reparte las líneas de un apartado en sus tres partes (por la etiqueta en negrita con que
 * empieza cada una).
 * @param {GraphText} text
 * @param {string[]} lines
 */
function splitParts(text, lines) {
  /** @type {'see' | 'read' | 'tryThis' | null} */
  let current = null;
  /** @type {Record<string, string[]>} */
  const acc = { see: [], read: [], tryThis: [] };
  for (const line of lines) {
    const trimmed = line.trim();
    const part = PARTS.find(([, label]) => trimmed.startsWith(`**${label}**`));
    if (part) {
      current = part[0];
      acc[current].push(trimmed.slice(part[1].length + 4).trim());
      continue;
    }
    if (current) acc[current].push(line);
  }
  text.see = acc.see.join('\n').trim();
  text.read = acc.read.join('\n').trim();
  text.tryThis = acc.tryThis.join('\n').trim();
}
