// @ts-check
// Controles del reloj de animación: pausa, velocidad y reinicio.
// Solo se muestran en los módulos con `animated: true`.

import { el } from './dom.js';

/**
 * @param {HTMLElement} container
 * @param {import('../core/clock.js').Clock} clock
 * @returns {{ destroy: () => void }}
 */
export function buildClockControls(container, clock) {
  const playPause = el('button', { class: 'btn clock-play', type: 'button', title: 'Pausa o reanuda (barra espaciadora)', onclick: () => clock.toggle() });
  const slower = el('button', { class: 'btn', type: 'button', text: '−', title: 'Más lento (tecla [)', 'aria-label': 'Más lento', onclick: () => clock.slower() });
  const faster = el('button', { class: 'btn', type: 'button', text: '+', title: 'Más rápido (tecla ])', 'aria-label': 'Más rápido', onclick: () => clock.faster() });
  const speed = el('span', { class: 'clock-speed', title: 'Velocidad de la animación' });
  const reset = el('button', { class: 'btn', type: 'button', text: 'Reiniciar', title: 'Vuelve a t = 0', onclick: () => clock.reset() });
  const row = el('div', { class: 'clock-controls' }, playPause, slower, speed, faster, reset);
  container.append(row);

  function sync() {
    playPause.textContent = clock.playing ? 'Pausa' : 'Reanudar';
    speed.textContent = `×${String(clock.speed).replace('.', ',')}`;
  }
  sync();
  const off = clock.onChange(sync);

  return {
    destroy() {
      off();
      row.remove();
    },
  };
}
