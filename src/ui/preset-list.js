// @ts-check
// Lista de presets de un módulo: un botón por preset, numerado del 1 al 9 (las mismas
// teclas que saltan a cada preset en el modo presentación).

import { el } from './dom.js';

/**
 * @param {HTMLElement} container
 * @param {readonly import('../modules/types.js').Preset[]} presets
 * @param {(preset: import('../modules/types.js').Preset) => void} onSelect
 * @returns {{ setActive: (id: string | null) => void, destroy: () => void }}
 */
export function buildPresetList(container, presets, onSelect) {
  const buttons = presets.map((preset, i) =>
    el(
      'button',
      {
        class: 'preset',
        type: 'button',
        dataset: { preset: preset.id },
        'aria-pressed': 'false',
        onclick: () => onSelect(preset),
      },
      el('kbd', { text: String(i + 1) }),
      el('span', { text: preset.label }),
    ),
  );
  const list = el('div', { class: 'preset-list' }, buttons);
  container.append(list);
  return {
    /** Marca el preset que coincide con el estado actual (o ninguno). */
    setActive(id) {
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.preset === id));
      }
    },
    destroy() {
      list.remove();
    },
  };
}
