// @ts-check
// Portada: presentación del laboratorio y una tarjeta por módulo registrado.

import { el } from './dom.js';

/**
 * @param {HTMLElement} root
 * @param {import('../modules/types.js').ModuleDescriptor[]} modules
 */
export function renderCover(root, modules) {
  const visible = modules.filter((m) => !m.hidden);
  const cards = visible.map((m) =>
    el(
      'a',
      { class: 'card', href: `#/${m.id}` },
      el('div', { class: 'card-body' }, el('h2', { text: m.title }), el('p', { text: m.summary })),
    ),
  );
  root.replaceChildren(
    el(
      'div',
      { class: 'cover' },
      el('h1', { text: 'Laboratorio de física' }),
      el('p', {
        class: 'cover-intro',
        text: 'Simulaciones interactivas para ver lo que cuesta imaginar: cuántica, interacción luz-materia, plasmónica y cristalografía.',
      }),
      visible.length
        ? el('div', { class: 'card-grid' }, cards)
        : el('p', { class: 'notice', text: 'Todavía no hay módulos publicados.' }),
    ),
  );
}
