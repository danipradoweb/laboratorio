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
import { createClock } from '../core/clock.js';
import { onThemeChange } from '../core/theme.js';

/**
 * @typedef {import('../modules/types.js').ModuleDescriptor} ModuleDescriptor
 * @typedef {import('../modules/types.js').ModuleContext} ModuleContext
 */

/** Espera (ms) tras el último cambio antes de escribir la URL. Los navegadores limitan
 *  cuántas veces por segundo se puede llamar a history.replaceState. */
const URL_SYNC_DELAY_MS = 200;

/**
 * Crea la página de un módulo dentro de `root`.
 * @param {HTMLElement} root
 * @param {ModuleDescriptor} module
 * @param {Record<string, string>} query parámetros de la URL, como texto
 * @param {{ actions: HTMLElement }} shell actions: zona de botones de la barra superior
 */
export async function createModulePage(root, module, query, shell) {
  // --- Estado -------------------------------------------------------------------------
  const initial = stateFromQuery(module.params, query);
  initial.warnings.forEach((w) => console.warn(`[${module.id}] ${w}`));
  const store = createStore(module.params, initial.state);
  const clock = createClock();
  let destroyed = false;

  // --- Estructura ---------------------------------------------------------------------
  const controlsBox = el('div', { class: 'controls' });
  const sidePanel = el(
    'aside',
    { class: 'side-panel', 'aria-label': 'Controles' },
    el('section', { class: 'side-section' }, el('h2', { text: 'Parámetros' }), controlsBox),
  );
  const panelToggle = el('button', {
    class: 'panel-toggle',
    type: 'button',
    title: 'Ocultar o mostrar el panel de controles',
    'aria-label': 'Ocultar o mostrar el panel de controles',
    onclick: () => {
      page.dataset.panel = page.dataset.panel === 'closed' ? 'open' : 'closed';
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

  const controls = buildControls(controlsBox, module.params, store);

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
  shell.actions.replaceChildren(copyButton);

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

  const unsubscribe = store.subscribe(() => {
    scheduleUpdate();
    writeUrlSoon();
  });
  // Al cambiar el tema se vuelve a llamar a update: las vistas que eligen colores
  // según el fondo (coloreado de fase) se rehacen sin que el módulo tenga que escuchar.
  const offTheme = onThemeChange(scheduleUpdate);

  return {
    module,
    store,
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
      unsubscribe();
      offTheme();
      clock.destroy();
      controls.destroy();
      instance.destroy();
      shell.actions.replaceChildren();
      page.remove();
    },
  };
}

/** @typedef {Awaited<ReturnType<typeof createModulePage>>} ModulePage */
