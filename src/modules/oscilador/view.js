// @ts-check
// Vista del oscilador forzado (versión provisional del paso 12a: solo valores numéricos;
// las gráficas enlazadas llegan en el paso 12b).

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { averagePower, qualityFactor, steadyState } from './physics.js';

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} _ctx
 * @returns {import('../types.js').ModuleInstance}
 */
export function mount(container, _ctx) {
  const grid = createPanelGrid(container, 'oscilador-grid');
  const panel = addPanel(grid, 'Régimen estacionario');
  const readout = el('pre');
  panel.body.append(readout);
  return {
    update(state) {
      const p = { m: 1, omega0: 1, F0: 1, omega: Number(state.omega), gamma: Number(state.gamma) };
      const { amplitude, phase } = steadyState(p);
      readout.textContent = [
        `A = ${amplitude.toFixed(3)} F₀/(mω₀²)`,
        `δ = ${((phase * 180) / Math.PI).toFixed(1)}°`,
        `⟨P⟩ = ${averagePower(p).toFixed(3)} F₀²/(mω₀)`,
        `Q = ${qualityFactor(p).toFixed(1)}`,
      ].join('\n');
    },
    destroy() {
      grid.remove();
    },
  };
}
