// @ts-check
// Pantallas de una simulación (formato con simulaciones, encargo R1).
//
//   ┌ línea de ubicación: Módulo › Simulación › pantalla ───────────────────────────┐
//   │ pestañas de las pantallas   ‹ ›   [Ver juntas]   [Cambiar gráficas]           │
//   ├──────────────────────────────────────────────────────────────────────────────┤
//   │  ┌ tarjeta de gráfica ─────────┐   ┌ tarjeta de gráfica ─────────┐           │
//   │  │ título en palabras           │   │                             │           │
//   │  │ línea secundaria (números)   │   │                             │           │
//   │  │ leyenda                      │   │                             │           │
//   │  │ ┌ gráfica ────────────────┐ │   │                             │           │
//   │  │ └─────────────────────────┘ │   │                             │           │
//   │  │ explicación (de la ficha)    │   │                             │           │
//   │  └──────────────────────────────┘   └─────────────────────────────┘           │
//   └──────────────────────────────────────────────────────────────────────────────┘
//
// Cada pantalla enseña como mucho dos gráficas de la selección (una en el móvil); las
// gráficas de la pantalla caben enteras en la ventana y la explicación empieza debajo.
// «Ver juntas» pone todas las elegidas en una sola pantalla, sin explicaciones.
//
// La vista del módulo dibuja en los huecos (`slot(id)`), que son siempre los mismos
// aunque la tarjeta cambie de pantalla; las que no se ven no hace falta dibujarlas
// (`slot.visible`). Este archivo no sabe nada de física ni del estado del módulo.

import { el } from './dom.js';
import { buildGraphChoice } from './entry-page.js';
import { renderInfo } from './info-line.js';
import { TOGETHER, planScreens, screenName } from '../core/simulations.js';

/**
 * @typedef {import('../modules/types.js').SimulationSpec} SimulationSpec
 * @typedef {import('../modules/types.js').GraphSlot} GraphSlot
 */

/** Anchura (px) por debajo de la cual hay una gráfica por pantalla (móvil). */
const MOBILE_QUERY = '(max-width: 760px)';
/** Altura mínima de una gráfica (px): por debajo, los ejes no dejan sitio a los datos. */
const MIN_GRAPH_HEIGHT = 260;
/** Altura de una gráfica en el móvil, como fracción de la altura de la ventana. */
const MOBILE_GRAPH_FRACTION = 0.58;

/**
 * @param {HTMLElement} frame contenedor (el escenario de la página del módulo)
 * @param {object} options
 * @param {import('../modules/types.js').ModuleDescriptor} options.module
 * @param {(selection: string[], screen: number | typeof TOGETHER) => void} options.onChange
 *   la selección o la pantalla han cambiado (para escribir la URL)
 * @param {() => void} options.onShow han cambiado las gráficas que se ven (para dibujarlas)
 * @param {(card: { id: string, explain: HTMLElement }) => void} [options.onCard]
 *   se ha creado la tarjeta de una gráfica (para poner su explicación)
 */
export function createScreens(frame, { module, onChange, onShow, onCard }) {
  const mobile = window.matchMedia(MOBILE_QUERY);

  // --- Barra de navegación ------------------------------------------------------------
  const crumbSim = el('span', { class: 'crumb-sim' });
  const crumbScreen = el('span', { class: 'crumb-screen' });
  const crumbs = el(
    'p',
    { class: 'sim-crumbs' },
    el('a', { href: `#/${module.id}`, text: module.title, title: 'Volver a la página de entrada del módulo' }),
    el('span', { class: 'crumb-sep', 'aria-hidden': 'true', text: '›' }),
    crumbSim,
    el('span', { class: 'crumb-sep', 'aria-hidden': 'true', text: '›' }),
    crumbScreen,
  );
  const tabs = el('div', { class: 'sim-tabs', role: 'tablist', 'aria-label': 'Pantallas' });
  const prevButton = el('button', { class: 'btn sim-arrow', type: 'button', text: '‹', title: 'Pantalla anterior (flecha izquierda)', 'aria-label': 'Pantalla anterior', onclick: () => step(-1) });
  const nextButton = el('button', { class: 'btn sim-arrow', type: 'button', text: '›', title: 'Pantalla siguiente (flecha derecha)', 'aria-label': 'Pantalla siguiente', onclick: () => step(1) });
  const togetherButton = el('button', {
    class: 'btn sim-together',
    type: 'button',
    text: 'Ver juntas',
    title: 'Todas las gráficas elegidas en una sola pantalla, sin explicaciones, para compararlas',
    'aria-pressed': 'false',
    onclick: () => go(screen === TOGETHER ? 0 : TOGETHER),
  });
  const changeButton = el('button', {
    class: 'btn sim-change',
    type: 'button',
    text: 'Cambiar gráficas',
    title: 'Elegir qué gráficas de esta simulación se ven',
    onclick: () => openChooser(),
  });
  const nav = el(
    'nav',
    { class: 'sim-nav', 'aria-label': 'Pantallas de la simulación' },
    crumbs,
    el('div', { class: 'sim-nav-row' }, tabs, el('div', { class: 'sim-nav-tools' }, prevButton, nextButton, togetherButton, changeButton)),
  );

  // --- Zona de las pantallas ----------------------------------------------------------
  const screenEl = el('div', { class: 'screen' });
  const area = el('div', { class: 'screen-area' }, screenEl);
  /** Tarjetas que no están en la pantalla actual: se guardan aquí, fuera de la vista. */
  const holder = el('div', { class: 'screen-holder', hidden: true });
  const chooserBox = el('div', { class: 'sim-chooser', hidden: true, role: 'dialog', 'aria-label': 'Cambiar gráficas' });
  frame.append(nav, area, holder, chooserBox);

  /** @type {SimulationSpec | null} */
  let simulation = null;
  /** @type {string[]} */
  let selection = [];
  /** @type {number | typeof TOGETHER} */
  let screen = 0;
  /** @type {string[][]} */
  let plan = [];
  /** @type {Map<string, { card: HTMLElement, slot: GraphSlot, body: HTMLElement, head: HTMLElement }>} */
  const cards = new Map();

  /**
   * Crea la tarjeta (y el hueco) de una gráfica.
   * @param {import('../modules/types.js').GraphSpec} graph
   */
  function makeCard(graph) {
    const info = el('p', { class: 'graph-info' });
    const titleExtra = el('span', { class: 'graph-title-extra' });
    const legend = el('div', { class: 'graph-legend' });
    const body = el('div', { class: 'graph-body' });
    const explain = el('div', { class: 'graph-explain' });
    const head = el('header', { class: 'graph-head' }, el('h2', { class: 'graph-title' }, el('span', { text: graph.title }), titleExtra), info, legend);
    const card = el('section', { class: 'graph-card', dataset: { graph: graph.id }, 'aria-label': graph.title }, head, body, explain);
    holder.append(card);
    /** @type {GraphSlot} */
    const slot = {
      body,
      legend,
      titleExtra,
      setInfo: (parts) => {
        renderInfo(info, parts);
        // Si la línea secundaria cambia de altura (una línea más), se rehace el reparto para
        // que las gráficas sigan cabiendo enteras en la ventana.
        if (!headCheck) headCheck = requestAnimationFrame(checkHeads);
      },
      get visible() {
        return card.parentElement === screenEl;
      },
    };
    cards.set(graph.id, { card, slot, body, head });
    onCard?.({ id: graph.id, explain });
  }

  /** Altura de las cabeceras con la que se calculó el alto de las gráficas. */
  let sizedHeads = -1;
  /** @type {number} */
  let headCheck = 0;
  function checkHeads() {
    headCheck = 0;
    const shown = [...screenEl.children];
    const heads = Math.max(0, ...shown.map((c) => cards.get(/** @type {HTMLElement} */ (c).dataset.graph ?? '')?.head.offsetHeight ?? 0));
    if (Math.abs(heads - sizedHeads) > 1) sizeGraphs();
  }

  /** Coloca en la pantalla las tarjetas que tocan y actualiza la navegación. */
  function layout() {
    if (!simulation) return;
    const sim = simulation;
    plan = planScreens(sim, selection, mobile.matches ? 1 : 2);
    if (typeof screen === 'number') screen = Math.min(screen, plan.length - 1);
    const shown = screen === TOGETHER ? selection : (plan[screen] ?? []);
    for (const [id, { card }] of cards) if (!shown.includes(id)) holder.append(card);
    // En el orden de la pantalla (las combinaciones, en su orden; ver juntas, el de la simulación).
    for (const id of shown) {
      const entry = cards.get(id);
      if (entry) screenEl.append(entry.card);
    }
    screenEl.dataset.count = String(shown.length);
    area.dataset.mode = screen === TOGETHER ? 'together' : 'screens';
    togetherButton.setAttribute('aria-pressed', String(screen === TOGETHER));
    togetherButton.hidden = selection.length < 2;
    crumbSim.textContent = sim.title;
    crumbScreen.textContent = screen === TOGETHER ? 'todas juntas' : screenName(sim, plan[screen] ?? []);

    tabs.replaceChildren(
      ...plan.map((graphs, i) =>
        el('button', {
          class: 'sim-tab',
          type: 'button',
          role: 'tab',
          text: screenName(sim, graphs),
          'aria-selected': String(screen === i),
          dataset: { screen: String(i + 1) },
          onclick: () => go(i),
        }),
      ),
    );
    prevButton.disabled = screen === TOGETHER || screen <= 0;
    nextButton.disabled = screen === TOGETHER || screen >= plan.length - 1;
    area.scrollTop = 0;
    sizeGraphs();
    onShow();
  }

  /**
   * Alto de cada gráfica: en escritorio, el que deja la ventana para que las gráficas de la
   * pantalla se vean enteras sin desplazarse (la explicación empieza debajo); en el móvil, una
   * fracción de la ventana; juntas, el reparto en filas, con un mínimo.
   */
  function sizeGraphs() {
    const shown = [...screenEl.children];
    if (shown.length === 0) return;
    const style = getComputedStyle(area);
    // Hasta casi el borde inferior de la ventana: la explicación asoma justo debajo.
    const available = area.clientHeight - parseFloat(style.paddingTop) - 14;
    let height;
    if (mobile.matches) height = Math.max(MIN_GRAPH_HEIGHT, window.innerHeight * MOBILE_GRAPH_FRACTION);
    else {
      // Filas que hacen falta con las columnas que caben (lo decide el CSS: auto-fit).
      const tops = new Set(shown.map((c) => Math.round(/** @type {HTMLElement} */ (c).offsetTop)));
      const rows = screen === TOGETHER ? Math.max(1, tops.size) : 1;
      const gap = parseFloat(getComputedStyle(screenEl).rowGap) || 0;
      const heads = Math.max(...shown.map((c) => cards.get(/** @type {HTMLElement} */ (c).dataset.graph ?? '')?.head.offsetHeight ?? 0));
      sizedHeads = heads;
      const cardPad = 24;
      height = Math.max(MIN_GRAPH_HEIGHT, (available - gap * (rows - 1)) / rows - heads - cardPad);
    }
    // (Las cabeceras de una misma fila miden lo mismo: lo hace la subrejilla del CSS.)
    for (const c of shown) {
      const entry = cards.get(/** @type {HTMLElement} */ (c).dataset.graph ?? '');
      if (entry && Math.abs(entry.body.offsetHeight - height) > 1) entry.body.style.height = `${Math.round(height)}px`;
    }
  }

  /**
   * Va a una pantalla (índice desde 0) o a «ver juntas».
   * @param {number | typeof TOGETHER} target
   */
  function go(target) {
    screen = target === TOGETHER ? TOGETHER : Math.max(0, Math.min(plan.length - 1, target));
    layout();
    onChange(selection, screen);
  }

  /** @param {number} delta */
  function step(delta) {
    if (screen === TOGETHER) return;
    const target = screen + delta;
    if (target >= 0 && target < plan.length) go(target);
  }

  /** «Cambiar gráficas»: la misma lista de casillas de la página de entrada. */
  function openChooser() {
    if (!simulation) return;
    const sim = simulation;
    const apply = el('button', { class: 'btn btn-primary', type: 'button', text: 'Ver las elegidas' });
    const choice = buildGraphChoice(sim, selection, () => {
      apply.disabled = choice.selected().length === 0;
    });
    const close = () => {
      chooserBox.hidden = true;
      chooserBox.replaceChildren();
      changeButton.focus();
    };
    apply.addEventListener('click', () => {
      const graphs = choice.selected();
      close();
      if (graphs.length > 0) setSelection(graphs, 0);
    });
    chooserBox.replaceChildren(
      el('h2', { text: `Gráficas de «${sim.title}»` }),
      choice.element,
      el('div', { class: 'entry-actions' }, apply, el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: close })),
    );
    chooserBox.hidden = false;
    chooserBox.querySelector('input')?.focus();
  }

  /**
   * Cambia la selección (y vuelve a la pantalla indicada).
   * @param {string[]} graphs
   * @param {number | typeof TOGETHER} target
   */
  function setSelection(graphs, target) {
    selection = graphs;
    screen = target;
    layout();
    onChange(selection, screen);
  }

  const onMedia = () => layout();
  mobile.addEventListener('change', onMedia);
  const observer = new ResizeObserver(() => sizeGraphs());
  observer.observe(area);

  return {
    /** Barra de navegación (el modo presentación la oculta). */
    nav,
    /**
     * Abre una simulación: crea las tarjetas de sus gráficas.
     * @param {SimulationSpec} sim
     * @param {string[]} graphs
     * @param {number | typeof TOGETHER} target
     */
    setSimulation(sim, graphs, target) {
      for (const { card } of cards.values()) card.remove();
      cards.clear();
      simulation = sim;
      for (const g of sim.graphs) makeCard(g);
      selection = graphs;
      screen = target;
      layout();
    },
    /** Cambia la selección sin avisar (la ha cambiado la URL o un preset). */
    setSelection(/** @type {string[]} */ graphs, /** @type {number | typeof TOGETHER} */ target) {
      selection = graphs;
      screen = target;
      layout();
    },
    /**
     * Hueco de una gráfica de la simulación abierta.
     * @param {string} id
     * @returns {GraphSlot}
     */
    slot(id) {
      const entry = cards.get(id);
      if (!entry) throw new Error(`La simulación abierta no tiene la gráfica "${id}"`);
      return entry.slot;
    },
    next: () => step(1),
    previous: () => step(-1),
    get screen() {
      return screen;
    },
    get selection() {
      return selection;
    },
    destroy() {
      cancelAnimationFrame(headCheck);
      mobile.removeEventListener('change', onMedia);
      observer.disconnect();
      nav.remove();
      area.remove();
      holder.remove();
      chooserBox.remove();
    },
  };
}
