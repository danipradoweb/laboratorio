// @ts-check
// Ondas clásicas y función de onda: vista del módulo.
//
// Cuatro simulaciones, que se eligen con el parámetro `part` (formato con simulaciones del
// encargo R1: el núcleo pone las gráficas en pantallas, con su título y su explicación):
//
//   paquete   un paquete de ondas con la ecuación de Schrödinger            view-packet.js
//   estados   estados propios, superposición, fases y el puente con la luz   view-states.js
//   cuerda    la cuerda clásica sola                                         view-string.js
//   rendijas  doble rendija en 2D con control de coherencia                  view-slits.js
//
// Este archivo solo monta la simulación que toca. Cada una vive en su archivo, dibuja en los
// huecos que le da el núcleo (ctx.graph(id), con los id de module.js) y cumple
// { update(state), destroy() }.

import { mountPacket } from './view-packet.js';
import { mountStates } from './view-states.js';
import { mountString } from './view-string.js';
import { mountSlits } from './view-slits.js';

/**
 * @typedef {(ctx: import('./view-common.js').PartContext, color: import('../../color/spectrum.js').ColorEngine) => import('./view-common.js').PartView} PartFactory
 */

/** @type {Record<string, PartFactory>} */
const PARTS = {
  paquete: mountPacket,
  estados: mountStates,
  cuerda: mountString,
  rendijas: mountSlits,
};

/**
 * @param {HTMLElement} _container no se usa: las gráficas van en los huecos de ctx.graph
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {Promise<import('../types.js').ModuleInstance>}
 */
export async function mount(_container, ctx) {
  const color = await ctx.color.load();
  const { graph, setStatus } = ctx;
  if (!graph || !setStatus) throw new Error('funcion-onda usa el formato con simulaciones: falta ctx.graph');
  /** @type {import('./view-common.js').PartContext} */
  const partCtx = { ...ctx, graph, setStatus };

  /** @type {import('./view-common.js').PartView | null} */
  let current = null;
  let currentPart = '';

  return {
    update(state) {
      const part = String(state.part) in PARTS ? String(state.part) : 'paquete';
      if (part !== currentPart) {
        current?.destroy();
        setStatus([]);
        current = PARTS[part](partCtx, color);
        currentPart = part;
      }
      current?.update(state);
    },
    destroy() {
      current?.destroy();
    },
  };
}
