// @ts-check
// Modo presentación: para grabar vídeos o explicar en clase.
//
// Al entrar (tecla P o botón "Presentación") se ocultan la barra superior, los
// controles y el texto auxiliar; las vistas del módulo ocupan un lienzo de proporción
// 16:9 centrado en la pantalla y la tipografía crece para que se lea en un vídeo 1080p.
//
// ATAJOS (docs/ARQUITECTURA.md, "Modo presentación"):
//   P            entra o sale            Esc     sale
//   1 … 9        salta al preset n       espacio pausa o reanuda la animación
//   [  y  ]      animación más lenta / más rápida
//   T            muestra u oculta el texto del recorrido
//   F            pantalla completa       C       tema claro / oscuro
//   ← →          paso anterior / siguiente del recorrido (también fuera de este modo,
//                y con RePág / AvPág, que es lo que envían los mandos de presentación)
//
// La parte que decide qué hace cada tecla (keyToAction) es una función pura y se
// prueba en Node. El resto maneja el DOM.

import { el } from '../ui/dom.js';
import { getTheme, toggleTheme, onThemeChange } from './theme.js';

/**
 * @typedef {{ type: 'toggle-presentation' } | { type: 'exit-presentation' }
 *   | { type: 'preset', index: number } | { type: 'toggle-play' }
 *   | { type: 'slower' } | { type: 'faster' } | { type: 'toggle-tour-text' }
 *   | { type: 'toggle-fullscreen' } | { type: 'toggle-theme' }
 *   | { type: 'tour-next' } | { type: 'tour-previous' }} KeyAction
 */

/**
 * Traduce una pulsación de tecla en una acción (o null si la tecla no hace nada).
 *
 * @param {{ key: string, code?: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }} event
 * @param {{ presenting: boolean, tourActive: boolean }} context
 * @returns {KeyAction | null}
 */
export function keyToAction(event, { presenting, tourActive }) {
  // Combinaciones del navegador o del sistema (Ctrl+P, Cmd+F…): no son nuestras.
  // Ojo: en los teclados españoles los corchetes se escriben con AltGr, que el
  // navegador comunica como Ctrl+Alt a la vez; esa combinación sí se acepta.
  if (event.metaKey) return null;
  if (event.ctrlKey && !event.altKey) return null;
  if (event.altKey && !event.ctrlKey) return null;
  const altGr = Boolean(event.ctrlKey && event.altKey);

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (key === 'p' && !altGr) return { type: 'toggle-presentation' };
  if (tourActive && !altGr) {
    if (key === 'ArrowRight' || key === 'PageDown') return { type: 'tour-next' };
    if (key === 'ArrowLeft' || key === 'PageUp') return { type: 'tour-previous' };
  }
  if (!presenting) return null;

  if (key === 'Escape') return { type: 'exit-presentation' };
  if (key === '[') return { type: 'slower' };
  if (key === ']') return { type: 'faster' };
  if (!altGr) {
    // Las dos teclas a la derecha de la P (corchetes en un teclado inglés) también
    // valen sin AltGr en un teclado español, donde escriben ` y +.
    if (event.code === 'BracketLeft') return { type: 'slower' };
    if (event.code === 'BracketRight') return { type: 'faster' };
    if (/^[1-9]$/.test(key)) return { type: 'preset', index: Number(key) - 1 };
    if (key === ' ') return { type: 'toggle-play' };
    if (key === 't') return { type: 'toggle-tour-text' };
    if (key === 'f') return { type: 'toggle-fullscreen' };
    if (key === 'c') return { type: 'toggle-theme' };
  }
  return null;
}

/**
 * Lo que el modo presentación necesita de la página de módulo abierta.
 * @typedef {object} PresentablePage
 * @property {import('./clock.js').Clock} clock
 * @property {(index: number) => void} goToPresetIndex
 * @property {import('./tours.js').TourRunner | null} tour
 */

/**
 * Crea el servicio de modo presentación (uno para toda la aplicación).
 * @param {{ getPage: () => PresentablePage | null }} options
 *   getPage devuelve la página de módulo abierta, o null si se está en la portada
 */
export function createPresentation({ getPage }) {
  const root = document.documentElement;
  /** @type {Set<(active: boolean) => void>} */
  const listeners = new Set();

  // Barra flotante discreta: selector de tema y salida. Aparece al mover el ratón.
  const themeButton = el('button', { class: 'btn', type: 'button', title: 'Cambiar de tema (tecla C)', onclick: toggleTheme });
  const labelTheme = () => {
    themeButton.textContent = getTheme() === 'dark' ? 'Tema claro' : 'Tema oscuro';
  };
  labelTheme();
  onThemeChange(labelTheme);
  const toolbar = el(
    'div',
    { class: 'presentation-toolbar', hidden: true },
    themeButton,
    el('button', { class: 'btn', type: 'button', text: 'Salir (P)', onclick: () => exit() }),
  );
  // Aviso breve (pausa, velocidad) en una esquina.
  const toast = el('div', { class: 'presentation-toast', role: 'status', hidden: true });
  document.body.append(toolbar, toast);

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toolbarTimer;
  function showToolbar() {
    if (!isActive()) return;
    toolbar.dataset.visible = 'true';
    clearTimeout(toolbarTimer);
    toolbarTimer = setTimeout(() => delete toolbar.dataset.visible, 2500);
  }

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toastTimer;
  /** @param {string} text */
  function showToast(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 1200);
  }

  function isActive() {
    return root.dataset.presentation === 'true';
  }

  function notify() {
    for (const listener of [...listeners]) listener(isActive());
  }

  function enter() {
    if (isActive() || !getPage()) return;
    root.dataset.presentation = 'true';
    toolbar.hidden = false;
    showToolbar();
    notify();
  }

  function exit() {
    if (!isActive()) return;
    delete root.dataset.presentation;
    delete root.dataset.tourText;
    toolbar.hidden = true;
    toast.hidden = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    notify();
  }

  /** @param {KeyAction} action */
  function run(action) {
    const page = getPage();
    if (!page) return;
    switch (action.type) {
      case 'toggle-presentation':
        if (isActive()) exit();
        else enter();
        break;
      case 'exit-presentation':
        exit();
        break;
      case 'preset':
        page.goToPresetIndex(action.index);
        break;
      case 'toggle-play':
        page.clock.toggle();
        showToast(page.clock.playing ? 'Reanudado' : 'Pausa');
        break;
      case 'slower':
      case 'faster':
        if (action.type === 'slower') page.clock.slower();
        else page.clock.faster();
        showToast(`Velocidad ×${String(page.clock.speed).replace('.', ',')}`);
        break;
      case 'toggle-tour-text':
        if (root.dataset.tourText === 'hidden') delete root.dataset.tourText;
        else root.dataset.tourText = 'hidden';
        break;
      case 'toggle-fullscreen':
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else root.requestFullscreen?.().catch(() => {});
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'tour-next':
        page.tour?.next();
        break;
      case 'tour-previous':
        page.tour?.previous();
        break;
    }
  }

  window.addEventListener('keydown', (event) => {
    // Mientras se escribe en un control, las teclas son del control (salvo Esc).
    const target = /** @type {HTMLElement | null} */ (event.target);
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        (target.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes(/** @type {HTMLInputElement} */ (target).type)));
    if (typing && event.key !== 'Escape') return;
    const page = getPage();
    if (!page) return;
    const action = keyToAction(event, { presenting: isActive(), tourActive: page.tour !== null });
    if (!action) return;
    event.preventDefault();
    run(action);
  });
  window.addEventListener('pointermove', showToolbar);

  return {
    isActive,
    enter,
    exit,
    /** Sale del modo sin más (al cambiar de página). */
    reset: exit,
    /**
     * Se suscribe a la entrada y salida del modo. Devuelve la función para darse de baja.
     * @param {(active: boolean) => void} listener
     * @returns {() => void}
     */
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** @typedef {ReturnType<typeof createPresentation>} Presentation */
