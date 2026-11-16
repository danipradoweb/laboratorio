// @ts-check
// Ondas clásicas y función de onda: vista provisional (andamiaje).

import { el } from '../../ui/dom.js';

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} _ctx
 * @returns {import('../types.js').ModuleInstance}
 */
export function mount(container, _ctx) {
  const box = el('p', { text: 'Módulo en construcción.' });
  container.append(box);
  return {
    update() {},
    destroy() {
      box.remove();
    },
  };
}
