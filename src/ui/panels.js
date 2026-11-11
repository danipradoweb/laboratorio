// @ts-check
// Paneles: las cajas con título donde cada módulo coloca sus vistas.
//
//   const grid = createPanelGrid(container, 'oscilador-grid');
//   const tiempo = addPanel(grid, 'Evolución temporal');
//   const plot = createPlot(tiempo.body, { … });
//
// La colocación de los paneles (columnas, filas, áreas) se define en CSS con la clase
// que se pasa a createPanelGrid.

import { el } from './dom.js';

/**
 * Crea la rejilla de paneles dentro del contenedor del módulo.
 * @param {HTMLElement} container
 * @param {string} className clase CSS propia del módulo, con su grid-template
 * @returns {HTMLDivElement}
 */
export function createPanelGrid(container, className) {
  const grid = el('div', { class: `panel-grid ${className}` });
  container.append(grid);
  return grid;
}

/**
 * Añade un panel con título a la rejilla.
 * @param {HTMLElement} grid
 * @param {string} title
 * @param {{ area?: string }} [options] area: nombre de grid-area, si la rejilla usa áreas
 * @returns {{ element: HTMLElement, body: HTMLDivElement, title: HTMLHeadingElement }}
 */
export function addPanel(grid, title, { area } = {}) {
  const heading = el('h2', { class: 'panel-title', text: title });
  const body = el('div', { class: 'panel-body' });
  const element = el('section', { class: 'panel' }, heading, body);
  if (area) element.style.gridArea = area;
  grid.append(element);
  return { element, body, title: heading };
}
