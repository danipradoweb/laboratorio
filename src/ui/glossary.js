// @ts-check
// Glosario común: al pulsar (ratón o dedo) un término marcado en un texto ([[término]] en el
// Markdown, ver src/core/markdown.js), se abre una ventana pequeña con su definición.
//
// Las definiciones están en data/glosario.json, compartido por todos los módulos. Se
// descargan la primera vez que hace falta. installGlossary() se llama una vez, al arrancar
// (app.js): un solo manejador para toda la página, así que funciona en la página de entrada,
// en las explicaciones de las gráficas y en la ficha completa.

import { el } from './dom.js';
import { loadJSON } from '../core/load-json.js';
import { renderMarkdownInto } from './ficha.js';

/**
 * @typedef {{ id: string, termino: string, definicion: string }} Term
 */

/** @returns {Promise<Map<string, Term>>} */
export async function loadGlossary() {
  const data = await loadJSON(new URL('../../data/glosario.json', import.meta.url));
  return new Map(/** @type {Term[]} */ (data.terminos).map((t) => [t.id, t]));
}

let installed = false;

/** Instala el manejador de los términos (una sola vez). */
export function installGlossary() {
  if (installed) return;
  installed = true;
  const title = el('strong', { class: 'term-popup-title' });
  const body = el('div', { class: 'term-popup-text' });
  const popup = el('div', { class: 'term-popup', role: 'dialog', hidden: true }, title, body);
  document.body.append(popup);
  /** @type {HTMLElement | null} */
  let owner = null;

  const close = () => {
    popup.hidden = true;
    owner?.setAttribute('aria-expanded', 'false');
    owner = null;
  };

  /** @param {HTMLElement} button */
  async function open(button) {
    const id = button.dataset.term ?? '';
    let term;
    try {
      term = (await loadGlossary()).get(id);
    } catch {
      term = undefined;
    }
    title.textContent = term?.termino ?? button.textContent ?? '';
    await renderMarkdownInto(body, term?.definicion ?? 'Este término todavía no está en el glosario.');
    popup.setAttribute('aria-label', `Glosario: ${title.textContent}`);
    popup.hidden = false;
    owner = button;
    button.setAttribute('aria-expanded', 'true');
    // Debajo del término (o encima, si no cabe), sin salirse de la ventana.
    const r = button.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    popup.style.width = `${width}px`;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
    popup.style.left = `${left + window.scrollX}px`;
    const below = r.bottom + 6;
    const height = popup.offsetHeight;
    const top = below + height > window.innerHeight - 8 && r.top - 6 - height > 8 ? r.top - 6 - height : below;
    popup.style.top = `${top + window.scrollY}px`;
  }

  document.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target.closest('.term') : null);
    if (target) {
      event.preventDefault();
      if (owner === target) close();
      else open(target);
      return;
    }
    if (!popup.hidden && !(event.target instanceof Node && popup.contains(event.target))) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popup.hidden) close();
  });
  window.addEventListener('hashchange', close);
}
