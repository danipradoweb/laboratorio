// @ts-check
// Ondas clásicas y función de onda: vista del módulo.
//
// Tres vistas, que se eligen con el parámetro `part`:
//
//   paquete   un paquete de ondas con la ecuación de Schrödinger            view-packet.js
//   estados   estados propios, superposición, fases y el puente con la luz   view-states.js
//   cuerda    la cuerda clásica sola                                         view-string.js
//
// Este archivo solo mantiene la línea de estado de arriba y monta la vista que toca. Cada
// vista vive en su archivo y cumple { update(state), destroy() }.

import { el } from '../../ui/dom.js';
import { mountPacket } from './view-packet.js';
import { mountStates } from './view-states.js';
import { mountString } from './view-string.js';

/**
 * @typedef {(container: HTMLElement, ctx: import('../types.js').ModuleContext, setStatus: (text: string) => void,
 *   color: import('../../color/spectrum.js').ColorEngine) => import('./view-common.js').PartView} PartFactory
 */

/** @type {Record<string, PartFactory>} */
const PARTS = {
  paquete: mountPacket,
  estados: mountStates,
  cuerda: mountString,
};

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {Promise<import('../types.js').ModuleInstance>}
 */
export async function mount(container, ctx) {
  const color = await ctx.color.load();
  const status = el('p', { class: 'fo-status', role: 'status' });
  const partBox = el('div', { class: 'fo-part' });
  const root = el('div', { class: 'fo-root' }, status, partBox);
  container.append(root);

  /** @type {import('./view-common.js').PartView | null} */
  let current = null;
  let currentPart = '';
  const setStatus = (/** @type {string} */ text) => {
    if (status.textContent !== text) status.textContent = text;
  };

  return {
    update(state) {
      const part = String(state.part) in PARTS ? String(state.part) : 'paquete';
      if (part !== currentPart) {
        current?.destroy();
        setStatus('');
        current = PARTS[part](partBox, ctx, setStatus, color);
        currentPart = part;
        root.dataset.part = part;
      }
      current?.update(state);
    },
    destroy() {
      current?.destroy();
      root.remove();
    },
  };
}
