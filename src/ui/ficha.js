// @ts-check
// Fichas: texto en Markdown con fórmulas dibujadas por KaTeX.
//
//   renderMarkdownInto(elemento, texto)   pinta un texto Markdown (fichas, recorridos)
//   createFichaPanel(contenedor, id)      panel lateral con la ficha de un módulo
//
// KaTeX (librería y hoja de estilos, en vendor/) y la ficha se cargan en diferido: no
// retrasan la primera pintura del módulo, pero se piden en cuanto el navegador tiene un
// rato libre (preload), para que todo funcione sin conexión una vez cargada la página. Si no llegara a cargarse, las fórmulas se quedan como texto
// TeX legible en lugar de romper la página.

import { el } from './dom.js';
import { renderMarkdown } from '../core/markdown.js';

/** @type {Promise<typeof import('katex').default> | null} */
let katexPromise = null;

/** Carga KaTeX una sola vez (módulo y hoja de estilos). */
export function loadKatex() {
  if (!katexPromise) {
    // Ruta relativa al documento (index.html), como todas las de la web.
    const stylesheet = el('link', { rel: 'stylesheet', href: 'vendor/katex/katex.min.css' });
    // Con la hoja de estilos ya cargada se piden las fuentes más usadas, para que las
    // fórmulas se vean bien aunque después se pierda la conexión.
    stylesheet.addEventListener('load', () => {
      for (const font of ['1em KaTeX_Main', 'italic 1em KaTeX_Math', '1em KaTeX_Size1', '1em KaTeX_Size2']) {
        document.fonts?.load(font).catch(() => {});
      }
    });
    document.head.append(stylesheet);
    katexPromise = import('katex').then((module) => module.default);
  }
  return katexPromise;
}

/**
 * Convierte `markdown` en HTML dentro de `element` y dibuja sus fórmulas.
 * @param {HTMLElement} element
 * @param {string} markdown
 * @returns {Promise<void>} se resuelve cuando las fórmulas ya están dibujadas
 */
export async function renderMarkdownInto(element, markdown) {
  // renderMarkdown escapa todo el HTML del texto, así que asignarlo a innerHTML es seguro.
  element.innerHTML = renderMarkdown(markdown);
  const formulas = /** @type {HTMLElement[]} */ ([...element.querySelectorAll('.math')]);
  if (formulas.length === 0) return;
  try {
    const katex = await loadKatex();
    for (const node of formulas) {
      if (!node.isConnected && !element.contains(node)) continue; // el texto cambió mientras cargaba
      katex.render(node.dataset.tex ?? '', node, {
        displayMode: node.classList.contains('math-block'),
        throwOnError: false,
      });
    }
  } catch (error) {
    console.warn('No se pudo cargar KaTeX; las fórmulas se muestran como texto.', error);
  }
}

/**
 * Panel con la ficha de un módulo (src/modules/<id>/ficha.md). El archivo se descarga
 * la primera vez que se abre el panel.
 * @param {HTMLElement} container
 * @param {string} moduleId
 */
export function createFichaPanel(container, moduleId) {
  const body = el('div', { class: 'ficha-body prose' });
  const element = el(
    'aside',
    { class: 'ficha-panel', hidden: true, 'aria-label': 'Ficha del módulo' },
    body,
  );
  container.append(element);
  let loaded = false;

  async function load() {
    if (loaded) return;
    loaded = true;
    body.replaceChildren(el('p', { class: 'notice', text: 'Cargando la ficha…' }));
    try {
      const response = await fetch(`src/modules/${moduleId}/ficha.md`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await renderMarkdownInto(body, await response.text());
      element.dataset.loaded = 'true';
    } catch (error) {
      loaded = false; // se reintentará al volver a abrir
      body.replaceChildren(el('p', { class: 'notice', text: 'No se ha podido cargar la ficha de este módulo.' }));
      console.warn(`[${moduleId}] No se pudo cargar ficha.md`, error);
    }
  }

  return {
    element,
    /** ¿Está abierto? */
    get isOpen() {
      return !element.hidden;
    },
    /**
     * Descarga y prepara la ficha sin abrir el panel. Se llama en un rato libre tras
     * cargar el módulo: así la ficha y las fórmulas siguen disponibles aunque después se
     * pierda la conexión ("funciona sin conexión una vez cargado").
     */
    preload() {
      load();
      loadKatex().catch(() => {});
    },
    /** Abre o cierra el panel. Devuelve true si queda abierto. */
    toggle() {
      element.hidden = !element.hidden;
      if (!element.hidden) load();
      return !element.hidden;
    },
    destroy() {
      element.remove();
    },
  };
}
