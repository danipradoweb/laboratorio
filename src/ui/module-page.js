// @ts-check
// Página de un módulo: monta el panel lateral (controles) y la vista, crea el estado
// a partir de la URL y mantiene todo sincronizado.
//
//   URL ──► estado (store) ──► controles
//              │   ▲                │
//              ▼   └────────────────┘
//        vista del módulo (update)
//
// El módulo solo aporta su descriptor (params, presets, tours, mount). Todo lo demás
// lo hace este archivo, igual para todos los módulos.

import { el } from './dom.js';
import { buildControls } from './controls.js';
import { buildHash, createStore, stateFromQuery } from '../core/state.js';
import { buildPresetList } from './preset-list.js';
import { createTourBar } from './tour-bar.js';
import { buildClockControls } from './clock-controls.js';
import { createFichaPanel, loadFichaText, renderMarkdownInto } from './ficha.js';
import { graphTexts } from '../core/ficha-sections.js';
import { createClock } from '../core/clock.js';
import { getTheme, onThemeChange, themeColors } from '../core/theme.js';
import { refreshPlots } from './plot2d.js';
import { createTransition, findActivePreset, presetState } from '../core/presets.js';
import { createTourRunner } from '../core/tours.js';
import { loadColorEngine } from '../color/spectrum.js';
import { loadMaterial, loadMaterialIndex } from '../materials/library.js';
import { createEntryPage, presetLink } from './entry-page.js';
import { isPilot, normalizeSelection, simulationHash, simulationOf, splitViewQuery, parseScreen } from '../core/simulations.js';
import { createScreens } from './screens.js';
import { katexReady, renderInfo } from './info-line.js';

/**
 * @typedef {import('../modules/types.js').ModuleDescriptor} ModuleDescriptor
 * @typedef {import('../modules/types.js').ModuleContext} ModuleContext
 */

/** Espera (ms) tras el último cambio antes de escribir la URL. Los navegadores limitan
 *  cuántas veces por segundo se puede llamar a history.replaceState. */
const URL_SYNC_DELAY_MS = 200;

/** Anchura de ventana (px) a partir de la cual caben a la vez el panel de controles,
 *  las vistas y la ficha. */
const FICHA_AND_PANEL_MIN_WIDTH = 1500;

/**
 * Recorrido pedido desde la página de entrada, que empieza en cuanto se crea la página de
 * su simulación (la de su primer paso).
 * @type {{ moduleId: string, tourId: string } | null}
 */
let pendingTour = null;

/**
 * Crea la página de un módulo dentro de `root`.
 * @param {HTMLElement} root
 * @param {ModuleDescriptor} module
 * @param {Record<string, string>} query parámetros de la URL, como texto
 * @param {{ actions: HTMLElement, presentation: import('../core/presentation.js').Presentation }} shell
 *   actions: zona de botones de la barra superior; presentation: servicio de modo presentación
 */
export async function createModulePage(root, module, query, shell) {
  // Formato con simulaciones (encargo R1): #/<id> sin nada más es la página de entrada.
  const pilot = isPilot(module);
  if (pilot && Object.keys(query).length === 0) return createEntry(root, module, shell);

  // --- Estado -------------------------------------------------------------------------
  const view = splitViewQuery(query);
  const initial = stateFromQuery(module.params, view.params);
  initial.warnings.forEach((w) => console.warn(`[${module.id}] ${w}`));
  const store = createStore(module.params, initial.state);
  const clock = createClock();
  let destroyed = false;

  // Simulación abierta, gráficas elegidas y pantalla (solo en el formato con simulaciones).
  let simulation = pilot ? simulationOf(module, store.get()) : null;
  const firstSelection = simulation ? normalizeSelection(simulation, view.graphs) : { graphs: [], warnings: [] };
  firstSelection.warnings.forEach((w) => console.warn(`[${module.id}] ${w}`));
  /** @type {string[]} */
  let selection = firstSelection.graphs;
  /** @type {number | 'juntas'} */
  let screen = parseScreen(view.screen, Number.POSITIVE_INFINITY);
  /** Gráficas que abre el preset en curso al cambiar de simulación (o null: todas). @type {string[] | null} */
  let pendingSelection = null;

  // --- Estructura ---------------------------------------------------------------------
  /** ¿Plegó la ficha el panel de controles por falta de sitio? (para restaurarlo) */
  let panelClosedByFicha = false;
  const controlsBox = el('div', { class: 'controls' });
  const presetsBox = el('div');
  const toursBox = el('div', { class: 'tour-list' });
  const clockBox = el('div');
  const statusBox = el('div', { class: 'side-status', role: 'status' });
  // En el formato con simulaciones los recorridos se empiezan desde la página de entrada, y
  // los números que no son de ninguna gráfica van al bloque «Estado».
  const sidePanel = el(
    'aside',
    { class: 'side-panel', 'aria-label': 'Controles' },
    el('section', { class: 'side-section' }, el('h2', { text: 'Parámetros' }), controlsBox),
    module.presets.length > 0 && el('section', { class: 'side-section side-presets' }, el('h2', { text: 'Presets' }), presetsBox),
    !pilot && module.tours.length > 0 && el('section', { class: 'side-section' }, el('h2', { text: 'Recorridos' }), toursBox),
    module.animated && el('section', { class: 'side-section' }, el('h2', { text: 'Animación' }), clockBox),
    pilot && el('section', { class: 'side-section' }, el('h2', { text: 'Estado' }), statusBox),
  );
  const panelToggle = el('button', {
    class: 'panel-toggle',
    type: 'button',
    title: 'Ocultar o mostrar el panel de controles',
    'aria-label': 'Ocultar o mostrar el panel de controles',
    onclick: () => {
      page.dataset.panel = page.dataset.panel === 'closed' ? 'open' : 'closed';
      panelClosedByFicha = false; // lo ha decidido el usuario: no se toca más
    },
  });
  // En el formato con simulaciones, la vista no pone nada en `stage` (oculto): dibuja en los
  // huecos de las tarjetas de gráfica, que reparte en pantallas src/ui/screens.js.
  const stage = el('div', { class: 'stage', hidden: pilot });
  const stageFrame = el('div', { class: pilot ? 'stage-frame sim-frame' : 'stage-frame' }, stage);
  // En el móvil, los controles de una simulación empiezan plegados: primero, la gráfica.
  const startClosed = pilot && window.matchMedia('(max-width: 760px)').matches;
  const page = el(
    'div',
    { class: 'module-page', dataset: { panel: startClosed ? 'closed' : 'open', module: module.id, format: pilot ? 'simulaciones' : 'clasico' } },
    sidePanel,
    panelToggle,
    stageFrame,
  );
  root.replaceChildren(page);
  const ficha = createFichaPanel(page, module.id);
  /** La vista ya está montada (antes no hay nada que redibujar). */
  let started = false;
  // Explicación de cada gráfica: los apartados de la ficha (un solo texto en un solo sitio).
  /** @type {Map<string, import('../core/ficha-sections.js').GraphText>} */
  let texts = new Map();
  if (pilot) {
    try {
      texts = graphTexts(await loadFichaText(module.id));
    } catch (error) {
      console.warn(`[${module.id}] No se pudo cargar ficha.md: las gráficas salen sin explicación`, error);
    }
  }
  const screens = simulation
    ? createScreens(stageFrame, {
        module,
        onChange: (graphs, newScreen) => {
          selection = graphs;
          screen = newScreen;
          writeUrlSoon();
        },
        onShow: () => {
          if (started) scheduleUpdate();
        },
        onCard: ({ id, explain }) => {
          const text = texts.get(id);
          if (text) fillExplanation(explain, text);
        },
      })
    : null;
  if (screens && simulation) {
    // KaTeX, antes de la primera pintura de títulos y líneas secundarias.
    await katexReady();
    screens.setSimulation(simulation, selection, screen);
    screen = screens.screen;
  }

  const controls = buildControls(controlsBox, module.params, store);
  const clockControls = module.animated ? buildClockControls(clockBox, clock) : null;

  // --- Presets y transiciones ---------------------------------------------------------
  /** @type {ReturnType<typeof createTransition> | null} */
  let transition = null;

  /**
   * Lleva el módulo a un estado, con transición animada (o de golpe si animate es false).
   * @param {import('../core/state.js').State} target
   * @param {boolean} [animate]
   */
  function goToState(target, animate = true) {
    transition?.cancel();
    transition = createTransition({
      params: module.params,
      from: store.get(),
      to: target,
      // Duración: la del descriptor (transitionSeconds) o 1,5 s por defecto.
      duration: animate ? module.transitionSeconds : 0,
      onFrame: (state) => store.replace(state, 'transition'),
      onDone: () => {
        transition = null;
      },
    });
  }

  /** @param {import('../modules/types.js').Preset} preset */
  const goToPreset = (preset) => {
    const target = presetState(module.params, preset);
    if (simulation) {
      // Un preset de otra simulación la abre (con las gráficas que declare, o todas); uno de
      // la misma, si declara gráficas, las pone en pantalla.
      const targetSim = simulationOf(module, target);
      if (targetSim.id !== simulation.id) pendingSelection = preset.graphs ?? null;
      else if (preset.graphs) setSelection(normalizeSelection(simulation, preset.graphs).graphs, 0);
    }
    goToState(target);
  };
  const presetList = buildPresetList(presetsBox, module.presets, goToPreset);
  const markActivePreset = () =>
    presetList.setActive(findActivePreset(module.params, module.presets, store.get()));
  markActivePreset();
  /** En el formato con simulaciones, la barra lateral solo enseña los presets de la abierta
   *  (con su número de siempre, el de la tecla del modo presentación). */
  const filterPresets = () => {
    if (!simulation) return;
    const sim = simulation;
    presetList.setVisible((preset) => simulationOf(module, presetState(module.params, preset)).id === sim.id);
  };
  filterPresets();

  // --- Recorridos guiados -------------------------------------------------------------
  /** @type {import('../core/tours.js').TourRunner | null} */
  let tourRunner = null;
  const tourBar = createTourBar(stageFrame, {
    onPrevious: () => tourRunner?.previous(),
    onNext: () => tourRunner?.next(),
    onClose: () => stopTour(),
  });

  /** @param {import('../modules/types.js').Tour} tour */
  function startTour(tour) {
    tourRunner = createTourRunner(tour, (step, index) => {
      tourBar.show({ title: tour.title, index, total: tour.steps.length });
      renderMarkdownInto(tourBar.textElement, step.text);
      const preset = module.presets.find((p) => p.id === step.preset);
      if (preset) goToPreset(preset);
    });
    page.dataset.tour = tour.id;
  }

  function stopTour() {
    tourRunner = null;
    tourBar.hide();
    delete page.dataset.tour;
  }

  for (const tour of module.tours) {
    toursBox.append(
      el('button', {
        class: 'btn tour-start',
        type: 'button',
        text: tour.title,
        title: 'Empezar este recorrido guiado',
        dataset: { tour: tour.id },
        onclick: () => startTour(tour),
      }),
    );
  }

  // --- Barra superior -----------------------------------------------------------------
  const copyButton = el('button', {
    class: 'btn',
    type: 'button',
    text: 'Copiar enlace',
    title: 'Copia la dirección que reproduce exactamente lo que se ve',
    onclick: async () => {
      writeUrl();
      try {
        await navigator.clipboard.writeText(location.href);
        copyButton.textContent = 'Enlace copiado';
      } catch {
        copyButton.textContent = 'Copia la barra de direcciones';
      }
      setTimeout(() => (copyButton.textContent = 'Copiar enlace'), 1800);
    },
  });
  const presentButton = el('button', {
    class: 'btn',
    type: 'button',
    text: 'Presentación',
    title: 'Modo presentación (tecla P)',
    onclick: () => shell.presentation.enter(),
  });
  const fichaButton = el('button', {
    class: 'btn',
    type: 'button',
    text: 'Ficha',
    title: 'Qué estás viendo, ecuaciones, límites del modelo y referencias',
    'aria-pressed': 'false',
    onclick: () => {
      const open = ficha.toggle();
      fichaButton.setAttribute('aria-pressed', String(open));
      page.dataset.ficha = open ? 'open' : 'closed';
      // En ventanas que no son muy anchas no caben a la vez controles, vistas y ficha:
      // al abrir la ficha se pliega el panel de controles, y al cerrarla se restaura.
      if (open && page.dataset.panel === 'open' && window.innerWidth < FICHA_AND_PANEL_MIN_WIDTH) {
        page.dataset.panel = 'closed';
        panelClosedByFicha = true;
      } else if (!open && panelClosedByFicha) {
        page.dataset.panel = 'open';
        panelClosedByFicha = false;
      }
    },
  });
  shell.actions.replaceChildren(fichaButton, presentButton, copyButton);

  // --- URL ----------------------------------------------------------------------------
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let urlTimer;
  function writeUrl() {
    clearTimeout(urlTimer);
    if (destroyed) return;
    const hash = simulation
      ? simulationHash(module, store.get(), selection, screen)
      : buildHash(module.id, module.params, store.get());
    if (hash === location.hash) return;
    try {
      // replaceState no añade entradas al historial ni dispara "hashchange".
      history.replaceState(null, '', hash);
    } catch {
      // Algunos navegadores limitan la frecuencia: se reintentará en el siguiente cambio.
    }
  }
  function writeUrlSoon() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeUrl, URL_SYNC_DELAY_MS);
  }
  writeUrl(); // la dirección queda completa desde el principio

  // --- Vista del módulo ---------------------------------------------------------------
  /** @type {ModuleContext} */
  const ctx = {
    getState: () => store.get(),
    setState: (patch) => {
      store.set(patch, 'view').forEach((w) => console.warn(`[${module.id}] ${w}`));
    },
    clock,
    theme: { name: getTheme, colors: themeColors },
    presentation: { isActive: () => shell.presentation.isActive() },
    // Servicios de datos: no descargan nada hasta que el módulo los pide.
    materials: { load: loadMaterial, list: loadMaterialIndex },
    color: { load: loadColorEngine },
  };
  if (pilot) {
    ctx.setStatus = (parts) => renderInfo(statusBox, parts);
  }
  if (screens) ctx.graph = (id) => screens.slot(id);
  const instance = await module.mount(stage, ctx);
  instance.update(store.get());
  started = true;


  // Con el módulo ya en pantalla, y en un rato libre, se descargan la ficha y KaTeX:
  // desde ese momento el módulo funciona entero aunque se pierda la conexión.
  const idle = window.requestIdleCallback ?? ((/** @type {() => void} */ cb) => setTimeout(cb, 300));
  idle(() => {
    if (!destroyed) ficha.preload();
  });

  // Varios cambios dentro del mismo fotograma producen una sola llamada a update.
  let updatePending = false;
  function scheduleUpdate() {
    if (updatePending) return;
    updatePending = true;
    requestAnimationFrame(() => {
      updatePending = false;
      if (!destroyed) instance.update(store.get());
    });
  }

  /**
   * Cambia las gráficas elegidas y la pantalla (formato con simulaciones).
   * @param {string[]} graphs
   * @param {number | 'juntas'} newScreen
   */
  function setSelection(graphs, newScreen) {
    selection = graphs;
    screen = newScreen;
    screens?.setSelection(graphs, newScreen);
    if (screens) screen = screens.screen;
    writeUrlSoon();
  }

  const unsubscribe = store.subscribe((state, change) => {
    // Si el usuario toca algo durante una transición, manda el usuario.
    if (change.source !== 'transition' && transition?.running) {
      transition.cancel();
      transition = null;
    }
    if (simulation && simulationOf(module, state).id !== simulation.id) {
      // Otra simulación (un preset, un recorrido, la URL): sus gráficas, desde la pantalla 1.
      simulation = simulationOf(module, state);
      selection = normalizeSelection(simulation, pendingSelection).graphs;
      screen = 0;
      // Las tarjetas nuevas, antes de que la vista monte la simulación (en el próximo update).
      screens?.setSimulation(simulation, selection, screen);
      writeUrlSoon();
      pendingSelection = null;
      filterPresets();
    }
    scheduleUpdate();
    writeUrlSoon();
    markActivePreset();
  });
  // Al cambiar el tema se vuelve a llamar a update: las vistas que eligen colores
  // según el fondo (coloreado de fase) se rehacen sin que el módulo tenga que escuchar.
  const offTheme = onThemeChange(scheduleUpdate);
  // Lo mismo al entrar o salir del modo presentación; además cambia la tipografía,
  // así que las gráficas se redibujan cuando el nuevo tamaño ya está aplicado.
  const offPresentation = shell.presentation.onChange(() => {
    scheduleUpdate();
    requestAnimationFrame(refreshPlots);
  });

  // Recorrido pedido desde la página de entrada (con todo lo anterior ya preparado).
  if (pendingTour && pendingTour.moduleId === module.id) {
    const tour = module.tours.find((t) => t.id === pendingTour?.tourId);
    pendingTour = null;
    if (tour) startTour(tour);
  }

  return {
    module,
    store,
    clock,
    /** Elementos que el modo presentación necesita manejar. */
    elements: { page, stageFrame },
    presentable: true,
    /**
     * Salta al preset número `index` (empezando en 0), si existe.
     * @param {number} index
     */
    goToPresetIndex(index) {
      const preset = module.presets[index];
      if (preset) goToPreset(preset);
    },
    /** Recorrido en curso (null si no hay ninguno). */
    get tour() {
      return tourRunner;
    },
    stopTour,
    /** Pantalla siguiente y anterior (formato con simulaciones; flechas del teclado). */
    nextScreen() {
      screens?.next();
    },
    previousScreen() {
      screens?.previous();
    },
    /**
     * La URL ha cambiado a mano dentro del mismo módulo: se aplica al estado.
     * @param {Record<string, string>} newQuery
     */
    applyQuery(newQuery) {
      const split = splitViewQuery(newQuery);
      const parsed = stateFromQuery(module.params, split.params);
      parsed.warnings.forEach((w) => console.warn(`[${module.id}] ${w}`));
      if (simulation) {
        const sim = simulationOf(module, parsed.state);
        pendingSelection = split.graphs;
        if (sim.id === simulation.id) {
          setSelection(normalizeSelection(sim, split.graphs).graphs, parseScreen(split.screen, Number.POSITIVE_INFINITY));
          pendingSelection = null;
        }
      }
      store.replace(parsed.state, 'url');
      writeUrl();
    },
    /**
     * ¿Puede esta página mostrar esa URL sin rehacerse? En el formato con simulaciones, una
     * URL sin nada es la página de entrada, que es otra página.
     * @param {Record<string, string>} newQuery
     */
    canApply(newQuery) {
      return !pilot || Object.keys(newQuery).length > 0;
    },
    destroy() {
      destroyed = true;
      clearTimeout(urlTimer);
      transition?.cancel();
      unsubscribe();
      offTheme();
      offPresentation();
      clock.destroy();
      controls.destroy();
      clockControls?.destroy();
      presetList.destroy();
      tourBar.destroy();
      ficha.destroy();
      instance.destroy();
      screens?.destroy();
      shell.actions.replaceChildren();
      page.remove();
    },
  };
}

/**
 * Pone bajo una gráfica su explicación: «Qué ves» abierto; «Cómo leerla», «Prueba esto» y
 * «Más detalle» (las ecuaciones y los límites del modelo que le tocan) en desplegables.
 * @param {HTMLElement} box
 * @param {import('../core/ficha-sections.js').GraphText} text
 */
function fillExplanation(box, text) {
  /** @param {string} markdown */
  const prose = (markdown) => {
    const div = el('div', { class: 'prose' });
    renderMarkdownInto(div, markdown);
    return div;
  };
  /** @param {string} label @param {...Node} content */
  const fold = (label, ...content) => el('details', { class: 'explain-fold' }, el('summary', { text: label }), ...content);
  const detail = [
    text.equations && el('h4', { text: 'Ecuaciones' }),
    text.equations && prose(text.equations),
    text.limits && el('h4', { text: 'Límites del modelo' }),
    text.limits && prose(text.limits),
  ].filter((n) => n instanceof Node);
  box.replaceChildren(
    el('section', { class: 'explain-see' }, el('h3', { text: 'Qué ves' }), prose(text.see)),
    fold('Cómo leerla', prose(text.read)),
    fold('Prueba esto', prose(text.tryThis)),
    ...(detail.length > 0 ? [fold('Más detalle', ...detail)] : []),
  );
}

/**
 * Página de entrada de un módulo con simulaciones, con la misma forma que la de un módulo
 * para app.js y el modo presentación (que aquí no se puede activar: no hay gráficas).
 * @param {HTMLElement} root
 * @param {ModuleDescriptor} module
 * @param {{ actions: HTMLElement, presentation: import('../core/presentation.js').Presentation }} shell
 */
function createEntry(root, module, shell) {
  const entry = createEntryPage(root, module, {
    onTour: (tour) => {
      const first = module.presets.find((p) => p.id === tour.steps[0]?.preset);
      if (!first) return;
      pendingTour = { moduleId: module.id, tourId: tour.id };
      location.hash = presetLink(module, first);
    },
  });
  const ficha = createFichaPanel(entry.element, module.id);
  const fichaButton = el('button', {
    class: 'btn',
    type: 'button',
    text: 'Ficha',
    title: 'La ficha completa: qué estás viendo, ecuaciones, límites del modelo y referencias',
    'aria-pressed': 'false',
    onclick: () => {
      const open = ficha.toggle();
      fichaButton.setAttribute('aria-pressed', String(open));
      entry.element.dataset.ficha = open ? 'open' : 'closed';
    },
  });
  shell.actions.replaceChildren(fichaButton);
  const clock = createClock();
  clock.pause();
  return {
    module,
    store: null,
    clock,
    elements: { page: entry.element, stageFrame: entry.element },
    /** La página de entrada no se presenta: no hay gráficas. */
    presentable: false,
    goToPresetIndex: (/** @type {number} */ index) => {
      const preset = module.presets[index];
      if (preset) location.hash = presetLink(module, preset);
    },
    tour: null,
    stopTour() {},
    nextScreen() {},
    previousScreen() {},
    applyQuery() {},
    canApply: (/** @type {Record<string, string>} */ q) => Object.keys(q).length === 0,
    destroy() {
      clock.destroy();
      ficha.destroy();
      entry.destroy();
      shell.actions.replaceChildren();
    },
  };
}

/** @typedef {Awaited<ReturnType<typeof createModulePage>>} ModulePage */
