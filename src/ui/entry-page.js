// @ts-check
// Página de entrada de un módulo con el formato de simulaciones (encargo R1).
//
// Al abrir #/<id> desde la portada no se carga ninguna simulación: se ve de qué va el
// módulo, sus simulaciones (cada una con la lista de sus gráficas para elegir), las
// combinaciones sugeridas, los presets y los recorridos guiados. Todo lo que hay aquí son
// enlaces a una dirección (#/<id>?…&ver=…), así que se pueden copiar y abren exactamente
// la misma pantalla.

import { el } from './dom.js';
import { renderMarkdownInto } from './ficha.js';
import { entryLink, simulationById, simulationOf, viewQuery, normalizeSelection } from '../core/simulations.js';
import { buildHash } from '../core/state.js';
import { presetState } from '../core/presets.js';

/**
 * @typedef {import('../modules/types.js').ModuleDescriptor} ModuleDescriptor
 * @typedef {import('../modules/types.js').SimulationSpec} SimulationSpec
 */

/**
 * Lista de casillas con las gráficas de una simulación (página de entrada y «Cambiar
 * gráficas» dentro de la simulación).
 * @param {SimulationSpec} simulation
 * @param {readonly string[]} checked identificadores marcados al empezar
 * @param {() => void} [onChange]
 * @returns {{ element: HTMLElement, selected: () => string[] }}
 */
export function buildGraphChoice(simulation, checked, onChange) {
  const boxes = simulation.graphs.map((g) =>
    el('input', { type: 'checkbox', value: g.id, checked: checked.includes(g.id), onchange: () => onChange?.() }),
  );
  const element = el(
    'ul',
    { class: 'graph-choice', dataset: { simulation: simulation.id } },
    simulation.graphs.map((g, i) =>
      el(
        'li',
        {},
        el(
          'label',
          { dataset: { graph: g.id } },
          boxes[i],
          el('span', { class: 'graph-choice-text' }, el('strong', { text: g.title }), el('span', { text: g.summary })),
        ),
      ),
    ),
  );
  return { element, selected: () => boxes.filter((b) => b.checked).map((b) => b.value) };
}

/**
 * Dirección que abre un preset: su estado, su simulación y las gráficas que declara.
 * @param {ModuleDescriptor} module
 * @param {import('../modules/types.js').Preset} preset
 */
export function presetLink(module, preset) {
  const state = presetState(module.params, preset);
  const sim = simulationOf(module, state);
  return buildHash(module.id, module.params, state) + viewQuery(sim, normalizeSelection(sim, preset.graphs ?? null).graphs, 0);
}

/**
 * Crea la página de entrada dentro de `root`.
 * @param {HTMLElement} root
 * @param {ModuleDescriptor} module
 * @param {{ onTour: (tour: import('../modules/types.js').Tour) => void }} actions
 *   onTour: empezar un recorrido (abre la simulación de su primer paso)
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
export function createEntryPage(root, module, { onTour }) {
  const sims = module.simulations ?? [];
  const intro = el('div', { class: 'entry-intro prose' });
  renderMarkdownInto(intro, module.intro ?? '');

  const simCards = sims.map((sim) => {
    const button = el('button', { class: 'btn btn-primary', type: 'button', text: 'Ver las elegidas', disabled: true });
    const choice = buildGraphChoice(sim, [], () => {
      button.disabled = choice.selected().length === 0;
    });
    button.addEventListener('click', () => {
      const graphs = choice.selected();
      if (graphs.length > 0) location.hash = entryLink(module, sim, graphs);
    });
    return el(
      'article',
      { class: 'entry-sim', dataset: { simulation: sim.id } },
      el('h3', { text: sim.title }),
      el('p', { class: 'entry-sim-summary', text: sim.summary }),
      el('p', { class: 'entry-hint', text: 'Elige qué gráficas ver:' }),
      choice.element,
      el(
        'div',
        { class: 'entry-actions' },
        button,
        el('a', { class: 'btn entry-all', href: entryLink(module, sim), text: 'Ver todas' }),
      ),
    );
  });

  const combos = sims
    .filter((sim) => sim.combos.length > 0)
    .map((sim) =>
      el(
        'div',
        { class: 'entry-combo-group' },
        el('h3', { text: sim.title }),
        el(
          'ul',
          { class: 'entry-combos' },
          sim.combos.map((c) =>
            el(
              'li',
              { dataset: { combo: c.id } },
              el('a', { href: entryLink(module, sim, c.graphs), text: c.title }),
              el('span', { text: c.summary }),
            ),
          ),
        ),
      ),
    );

  const presets = module.presets.map((preset, i) =>
    el(
      'a',
      { class: 'preset', href: presetLink(module, preset), dataset: { preset: preset.id } },
      el('kbd', { text: String(i + 1) }),
      el('span', { text: preset.label }),
      el('span', { class: 'preset-sim', text: simulationById(module, String(presetState(module.params, preset)[module.simulationParam ?? '']))?.title ?? '' }),
    ),
  );

  const tours = module.tours.map((tour) =>
    el('button', {
      class: 'btn tour-start',
      type: 'button',
      text: tour.title,
      title: 'Empezar este recorrido guiado',
      dataset: { tour: tour.id },
      onclick: () => onTour(tour),
    }),
  );

  const element = el(
    'div',
    { class: 'entry-page', dataset: { module: module.id } },
    el(
      'div',
      { class: 'entry-inner' },
      el('header', { class: 'entry-header' }, el('h1', { text: module.title }), intro),
      el('section', { class: 'entry-section' }, el('h2', { text: 'Simulaciones' }), el('div', { class: 'entry-sims' }, simCards)),
      combos.length > 0 &&
        el(
          'section',
          { class: 'entry-section' },
          el('h2', { text: 'Combinaciones sugeridas' }),
          el('p', { class: 'entry-hint', text: 'Dos gráficas que se explican la una a la otra.' }),
          combos,
        ),
      presets.length > 0 &&
        el('section', { class: 'entry-section' }, el('h2', { text: 'Presets' }), el('div', { class: 'preset-list entry-presets' }, presets)),
      tours.length > 0 &&
        el('section', { class: 'entry-section' }, el('h2', { text: 'Recorridos guiados' }), el('div', { class: 'tour-list' }, tours)),
    ),
  );
  root.replaceChildren(element);
  return {
    element,
    destroy() {
      element.remove();
    },
  };
}
