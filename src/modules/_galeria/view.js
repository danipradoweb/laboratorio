// @ts-check
// Vista de la galería de componentes. Cada panel ejercita un servicio común.

import { el } from '../../ui/dom.js';

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} _ctx
 * @returns {import('../types.js').ModuleInstance}
 */
export function mount(container, _ctx) {
  const readout = el('pre', { class: 'galeria-readout' });
  const grid = el(
    'div',
    { class: 'panel-grid galeria-grid' },
    el('section', { class: 'panel' }, el('h2', { class: 'panel-title', text: 'Estado' }), readout),
  );
  container.append(grid);

  return {
    update(state) {
      readout.textContent = JSON.stringify(state, null, 2);
    },
    destroy() {
      grid.remove();
    },
  };
}
