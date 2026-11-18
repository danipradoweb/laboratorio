// @ts-check
// Líneas de información con fórmulas: la línea secundaria de cada gráfica y el bloque
// «Estado» de la barra lateral (formato con simulaciones, encargo R1).
//
//   renderInfo(elemento, ['momento medio $\\langle p\\rangle/\\hbar = 1{,}15$ nm⁻¹', '…'])
//
// Cada trozo es texto con fórmulas $…$ (KaTeX); los trozos se separan con « · ». Las vistas
// animadas llaman en cada fotograma: para no rehacer KaTeX sesenta veces por segundo, cada
// elemento se repinta como mucho cada INFO_INTERVAL_MS (y nunca si el texto no cambia), y el
// HTML de cada trozo se guarda en una caché.

import { renderInline } from '../core/markdown.js';
import { loadKatex } from './ficha.js';

/** Intervalo mínimo entre repintados de una misma línea (ms). */
const INFO_INTERVAL_MS = 150;
/** Trozos ya convertidos a HTML (con KaTeX dibujado). */
const cache = new Map();
const CACHE_LIMIT = 4000;

/** @type {typeof import('katex').default | null} */
let katex = null;
loadKatexOnce();

/** Pide KaTeX una vez; hasta que llega, las fórmulas salen como texto TeX. */
function loadKatexOnce() {
  if (typeof document === 'undefined') return;
  loadKatex()
    .then((k) => {
      katex = k;
      cache.clear();
    })
    .catch(() => {});
}

/** Espera a que KaTeX esté cargado (para que la primera pintura ya tenga las fórmulas). */
export async function katexReady() {
  try {
    katex = await loadKatex();
  } catch {
    // sin KaTeX, las fórmulas se quedan como texto
  }
}

/**
 * HTML de un trozo: texto escapado con las fórmulas dibujadas por KaTeX.
 * @param {string} part
 * @returns {string}
 */
export function partHtml(part) {
  const hit = cache.get(part);
  if (hit !== undefined && (katex || !part.includes('$'))) return hit;
  let html = renderInline(part);
  if (katex) {
    const k = katex;
    html = html.replace(/<span class="math math-inline" data-tex="([^"]*)">[^<]*<\/span>/g, (_m, tex) =>
      k.renderToString(unescape(tex), { throwOnError: false, output: 'html' }),
    );
  }
  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(part, html);
  return html;
}

/** @param {string} text */
function unescape(text) {
  return text.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

/** Estado de repintado de cada elemento. @type {WeakMap<HTMLElement, { text: string, pending: string | null, timer: ReturnType<typeof setTimeout> | null, last: number }>} */
const lines = new WeakMap();

/**
 * Escribe una línea de información en un elemento (ver la cabecera del archivo).
 * @param {HTMLElement} element
 * @param {readonly string[]} parts
 */
export function renderInfo(element, parts) {
  const text = parts.filter((p) => p !== '').join('\u0001');
  let line = lines.get(element);
  if (!line) {
    line = { text: '\u0000', pending: null, timer: null, last: 0 };
    lines.set(element, line);
  }
  if (text === line.text) {
    line.pending = null;
    return;
  }
  const now = performance.now();
  if (now - line.last >= INFO_INTERVAL_MS && !line.timer) {
    paint(element, line, text);
    return;
  }
  line.pending = text;
  if (!line.timer) {
    const l = line;
    l.timer = setTimeout(() => {
      l.timer = null;
      if (l.pending !== null) paint(element, l, l.pending);
    }, Math.max(0, INFO_INTERVAL_MS - (now - line.last)));
  }
}

/**
 * @param {HTMLElement} element
 * @param {{ text: string, pending: string | null, last: number }} line
 * @param {string} text
 */
function paint(element, line, text) {
  line.text = text;
  line.pending = null;
  line.last = performance.now();
  element.innerHTML = text === '' ? '' : text.split('\u0001').map((p) => `<span class="info-part">${partHtml(p)}</span>`).join('<span class="info-sep"> · </span>');
}
