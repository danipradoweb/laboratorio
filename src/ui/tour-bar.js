// @ts-check
// Barra de recorrido guiado: el texto del paso actual, el contador y las flechas.
// Va debajo de las vistas del módulo. La lógica de pasos está en src/core/tours.js.

import { el } from './dom.js';

/**
 * @param {HTMLElement} container
 * @param {{ onPrevious: () => void, onNext: () => void, onClose: () => void }} handlers
 */
export function createTourBar(container, { onPrevious, onNext, onClose }) {
  const title = el('span', { class: 'tour-title' });
  const counter = el('span', { class: 'tour-counter' });
  const text = el('div', { class: 'tour-text' });
  const previous = el('button', { class: 'btn', type: 'button', text: '←', title: 'Paso anterior (flecha izquierda)', 'aria-label': 'Paso anterior', onclick: onPrevious });
  const next = el('button', { class: 'btn', type: 'button', text: '→', title: 'Paso siguiente (flecha derecha)', 'aria-label': 'Paso siguiente', onclick: onNext });
  const close = el('button', { class: 'btn', type: 'button', text: 'Terminar', title: 'Salir del recorrido', onclick: onClose });
  const element = el(
    'div',
    { class: 'tour-bar', hidden: true, role: 'region', 'aria-label': 'Recorrido guiado', 'aria-live': 'polite' },
    el('div', { class: 'tour-head' }, title, counter, el('div', { class: 'tour-nav' }, previous, next, close)),
    text,
  );
  container.append(element);

  return {
    element,
    /** Elemento donde va el texto del paso (lo rellena quien sepa pintar Markdown). */
    textElement: text,
    /**
     * Muestra un paso.
     * @param {{ title: string, index: number, total: number }} info
     */
    show({ title: tourTitle, index, total }) {
      element.hidden = false;
      title.textContent = tourTitle;
      counter.textContent = `Paso ${index + 1} de ${total}`;
      previous.disabled = index === 0;
      next.disabled = index === total - 1;
    },
    hide() {
      element.hidden = true;
    },
    destroy() {
      element.remove();
    },
  };
}
