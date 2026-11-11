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
import { createFichaPanel, renderMarkdownInto } from './ficha.js';
import { createClock } from '../core/clock.js';
import { getTheme, onThemeChange, themeColors } from '../core/theme.js';
import { refreshPlots } from './plot2d.js';
import { createTransition, findActivePreset, presetState } from '../core/presets.js';
import { createTourRunner } from '../core/tours.js';

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
 * Crea la página de un módulo dentro de `root`.
 * @param {HTMLElement} root
 * @param {ModuleDescriptor} module
 * @param {Record<string, string>} query parámetros de la URL, como texto
 * @param {{ actions: HTMLElement, presentation: import('../core/presentation.js').Presentation }} shell
 *   actions: zona de botones de la barra superior; presentation: servicio de modo presentación
 */
export async function createModulePage(root, module, query, shell) {
  // --- Estado -------------------------------------------------------------------------
  const initial = stateFromQuery(module.params, query);
  initial.warnings.forEach((w) => console.warn(`[${module.id}] ${w}`));
  const store = createStore(module.params, initial.state);
  const clock = createClock();
  let destroyed = false;

  // --- Estructura ---------------------------------------------------------------------
  /** ¿Plegó la ficha el panel de controles por falta de sitio? (para restaurarlo) */
  let panelClosedByFicha = false;
  const controlsBox = el('div', { class: 'controls' });
  const presetsBox = el('div');
  const toursBox = el('div', { class: 'tour-list' });
  const clockBox = el('div');
  const sidePanel = el(
    'aside',
    { class: 'side-panel', 'aria-label': 'Controles' },
    el('section', { class: 'side-section' }, el('h2', { text: 'Parámetros' }), controlsBox),
    module.presets.length > 0 && el('section', { class: 'side-section' }, el('h2', { text: 'Presets' }), presetsBox),
    module.tours.length > 0 && el('section', { class: 'side-section' }, el('h2', { text: 'Recorridos' }), toursBox),
    module.animated && el('section', { class: 'side-section' }, el('h2', { text: 'Animación' }), clockBox),
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
  const stage = el('div', { class: 'stage' });
  const stageFrame = el('div', { class: 'stage-frame' }, stage);
  const page = el(
    'div',
    { class: 'module-page', dataset: { panel: 'open', module: module.id } },
    sidePanel,
    panelToggle,
    stageFrame,
  );
  root.replaceChildren(page);
  const ficha = createFichaPanel(page, module.id);

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
      duration: animate ? undefined : 0,
      onFrame: (state) => store.replace(state, 'transition'),
      onDone: () => {
        transition = null;
      },
    });
  }

  /** @param {import('../modules/types.js').Preset} preset */
  const goToPreset = (preset) => goToState(presetState(module.params, preset));
  const presetList = buildPresetList(presetsBox, module.presets, goToPreset);
  const markActivePreset = () =>
    presetList.setActive(findActivePreset(module.params, module.presets, store.get()));
  markActivePreset();

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
    const hash = buildHash(module.id, module.params, store.get());
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
    materials: null,
    color: null,
  };
  const instance = await module.mount(stage, ctx);
  instance.update(store.get());

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

  const unsubscribe = store.subscribe((_state, change) => {
    // Si el usuario toca algo durante una transición, manda el usuario.
    if (change.source !== 'transition' && transition?.running) {
      transition.cancel();
      transition = null;
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

  return {
    module,
    store,
    clock,
    /** Elementos que el modo presentación necesita manejar. */
    elements: { page, stageFrame },
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
    /**
     * La URL ha cambiado a mano dentro del mismo módulo: se aplica al estado.
     * @param {Record<string, string>} newQuery
     */
    applyQuery(newQuery) {
      const parsed = stateFromQuery(module.params, newQuery);
      parsed.warnings.forEach((w) => console.warn(`[${module.id}] ${w}`));
      store.replace(parsed.state, 'url');
      writeUrl();
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
      shell.actions.replaceChildren();
      page.remove();
    },
  };
}

/** @typedef {Awaited<ReturnType<typeof createModulePage>>} ModulePage */
