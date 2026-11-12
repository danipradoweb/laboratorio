// @ts-check
// Luz y materia: vista del módulo.
//
// El módulo tiene cuatro vistas, que se eligen con el parámetro `part` y comparten el
// material y la energía del fotón:
//
//   material        (parte A)  ε, n, k y R del material, y sus osciladores    view-material.js
//   laminas         (parte B)  láminas de dipolos: de dónde sale el índice    view-sheets.js
//   interfaz        (parte C)  Fresnel, Brewster y reflexión total            view-interface.js
//   polarizadores   (parte C)  ley de Malus y gafas polarizadas               view-polarizers.js
//
// Este archivo solo carga los datos, mantiene la línea de estado de arriba (qué material
// es y qué n y k tiene a esta frecuencia: lo que enlaza las cuatro vistas) y monta la
// vista que toca. Cada vista vive en su archivo y cumple { update(state, part), destroy() }.

import { el } from '../../ui/dom.js';
import { formatEs } from '../../ui/format.js';
import { mountMaterial } from './view-material.js';
import { mountSheets } from './view-sheets.js';
import { mountInterface } from './view-interface.js';
import { mountPolarizers } from './view-polarizers.js';
import { formatSig, formatWavelength, loadMaterialData, opticsAt, resolveMaterial, spectralRegion } from './view-common.js';

export { ENERGY_RANGE, MATERIAL_OPTIONS } from './view-common.js';

/**
 * Las cuatro vistas, por valor del parámetro `part`.
 * @type {Record<string, (container: HTMLElement, ctx: import('../types.js').ModuleContext) => import('./view-common.js').PartView>}
 */
const PARTS = {
  material: mountMaterial,
  laminas: mountSheets,
  interfaz: mountInterface,
  polarizadores: mountPolarizers,
};

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {Promise<import('../types.js').ModuleInstance>}
 */
export async function mount(container, ctx) {
  const data = await loadMaterialData(ctx);

  const status = el('p', { class: 'lm-status', role: 'status' });
  const partBox = el('div', { class: 'lm-part' });
  const root = el('div', { class: 'lm-root' }, status, partBox);
  container.append(root);

  /** @type {import('./view-common.js').PartView | null} */
  let current = null;
  let currentPart = '';

  return {
    update(state) {
      const part = String(state.part) in PARTS ? String(state.part) : 'material';
      if (part !== currentPart) {
        current?.destroy();
        current = PARTS[part](partBox, ctx);
        currentPart = part;
        root.dataset.part = part;
      }
      const material = resolveMaterial(state, data);
      const optics = opticsAt(material, Number(state.energy));

      // Línea de estado: el material y sus constantes ópticas a esta frecuencia.
      const name = material.name.charAt(0).toUpperCase() + material.name.slice(1);
      status.textContent =
        `${name} · ħω = ${formatEs(optics.energy)} eV (λ = ${formatWavelength(optics.wavelength)} en el vacío, ${spectralRegion(optics.wavelength)})` +
        ` · n = ${formatSig(optics.n)} · k = ${formatSig(optics.k)} · ${material.source}` +
        (optics.clamped
          ? ` · ⚠ no hay datos en ${formatEs(optics.requested)} eV: se usa el extremo de la tabla`
          : '');
      status.dataset.warning = String(optics.clamped);

      current?.update(state, { material, optics });
    },
    destroy() {
      current?.destroy();
      root.remove();
    },
  };
}
