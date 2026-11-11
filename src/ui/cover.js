// @ts-check
// Portada: presentación del laboratorio y una tarjeta por módulo registrado.
//
// Las tarjetas salen de src/modules/registry.js: título, resumen y miniatura de cada
// descriptor. Los módulos con `hidden: true` no aparecen. La miniatura es el archivo
// `thumbnail` de la carpeta del módulo (se genera con `npm run miniaturas`); si un
// módulo no tiene, se muestra un recuadro con su inicial.

import { el } from './dom.js';

/** Web personal del autor (enlace de vuelta). */
const HOME_URL = 'https://danipradoweb.github.io/';

/**
 * @param {HTMLElement} root
 * @param {import('../modules/types.js').ModuleDescriptor[]} modules
 */
export function renderCover(root, modules) {
  const visible = modules.filter((m) => !m.hidden);
  const cards = visible.map((m) =>
    el(
      'a',
      { class: 'card', href: `#/${m.id}`, dataset: { module: m.id } },
      m.thumbnail
        ? el('img', {
            class: 'card-thumb',
            src: `src/modules/${m.id}/${m.thumbnail}`,
            alt: '',
            loading: 'lazy',
            width: 640,
            height: 360,
          })
        : el('div', { class: 'card-thumb card-thumb-empty', 'aria-hidden': 'true', text: m.title.charAt(0) }),
      el('div', { class: 'card-body' }, el('h2', { text: m.title }), el('p', { text: m.summary })),
    ),
  );
  root.replaceChildren(
    el(
      'div',
      { class: 'cover' },
      el('a', { class: 'cover-back', href: HOME_URL, text: '← danipradoweb.github.io' }),
      el('h1', { text: 'Laboratorio de física' }),
      el('p', {
        class: 'cover-intro',
        text: 'Simulaciones interactivas para ver lo que cuesta imaginar: cuántica, interacción luz-materia, plasmónica y cristalografía.',
      }),
      visible.length
        ? el('div', { class: 'card-grid' }, cards)
        : el('p', { class: 'notice', text: 'Todavía no hay módulos publicados.' }),
      el(
        'footer',
        { class: 'cover-footer' },
        el('span', { text: 'Daniel Prado Santalla · ' }),
        el('a', { href: HOME_URL, text: 'Web personal' }),
        el('span', { text: ' · ' }),
        el('a', { href: 'https://github.com/danipradoweb/laboratorio', text: 'Código en GitHub' }),
      ),
    ),
  );
}
