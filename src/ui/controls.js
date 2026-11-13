// @ts-check
// Genera los controles de un módulo a partir de su lista `params`.
//
// Es declarativo: el módulo no crea deslizadores a mano. Cada parámetro produce un
// control según su tipo:
//   range   deslizador + casilla numérica (para teclear un valor exacto)
//   select  lista desplegable
//   toggle  conmutador
// Un parámetro con `visible: (state) => boolean` solo enseña su control cuando la función
// devuelve true (por ejemplo, controles que solo tienen sentido en una de las vistas del
// módulo). El parámetro sigue existiendo en el estado y en la URL.
// Los controles escriben en el almacén de estado (store.set) y se actualizan solos
// cuando el estado cambia por otra vía (URL, preset, clic en una gráfica).

import { el } from './dom.js';
import { formatNumber } from '../core/state.js';

/**
 * @typedef {import('../core/state.js').Param} Param
 * @typedef {import('../core/state.js').Store} Store
 */

/** Contador para dar un id único a cada control (lo necesita <label for>). */
let nextId = 0;

/**
 * Crea los controles dentro de `container`.
 * @param {HTMLElement} container
 * @param {readonly Param[]} params
 * @param {Store} store
 * @returns {{ destroy: () => void }}
 */
export function buildControls(container, params, store) {
  /** Funciones que ponen cada control al día con el estado. @type {(() => void)[]} */
  const syncs = [];

  for (const param of params) {
    const id = `control-${param.key}-${nextId++}`;
    const row = el('div', { class: `control control-${param.type}`, dataset: { key: param.key } });
    if (param.help) row.title = param.help;
    const { visible } = param;
    if (visible) syncs.push(() => (row.hidden = !visible(store.get())));

    if (param.type === 'range') {
      const slider = el('input', {
        id,
        type: 'range',
        min: param.min,
        max: param.max,
        step: param.step,
      });
      const number = el('input', {
        type: 'number',
        class: 'control-number',
        min: param.min,
        max: param.max,
        step: param.step,
        'aria-label': param.label,
      });
      slider.addEventListener('input', () => store.set({ [param.key]: Number(slider.value) }));
      // "change" (y no "input"): solo se aplica al terminar de teclear.
      number.addEventListener('change', () => {
        const value = Number(number.value);
        if (number.value.trim() !== '' && Number.isFinite(value)) store.set({ [param.key]: value });
        sync();
      });
      const sync = () => {
        const value = /** @type {number} */ (store.get()[param.key]);
        slider.value = String(value);
        // No se pisa la casilla mientras el usuario escribe en ella.
        if (document.activeElement !== number) number.value = formatForDisplay(value, param.step);
      };
      syncs.push(sync);
      row.append(
        el('label', { for: id, class: 'control-label', text: param.label }),
        el(
          'div',
          { class: 'control-value' },
          number,
          param.unit ? el('span', { class: 'control-unit', text: param.unit }) : null,
        ),
        slider,
      );
    } else if (param.type === 'select') {
      const select = el(
        'select',
        { id },
        param.options.map((o) =>
          typeof o === 'string'
            ? el('option', { value: o, text: o })
            : el('option', { value: o.value, text: o.label }),
        ),
      );
      select.addEventListener('change', () => store.set({ [param.key]: select.value }));
      syncs.push(() => {
        select.value = String(store.get()[param.key]);
      });
      row.append(el('label', { for: id, class: 'control-label', text: param.label }), select);
    } else {
      const checkbox = el('input', { id, type: 'checkbox', class: 'switch', role: 'switch' });
      checkbox.addEventListener('change', () => store.set({ [param.key]: checkbox.checked }));
      syncs.push(() => {
        checkbox.checked = Boolean(store.get()[param.key]);
      });
      row.append(checkbox, el('label', { for: id, class: 'control-label', text: param.label }));
    }
    container.append(row);
  }

  const syncAll = () => syncs.forEach((sync) => sync());
  syncAll();
  const unsubscribe = store.subscribe(syncAll);

  return {
    destroy() {
      unsubscribe();
      container.replaceChildren();
    },
  };
}

/**
 * Escribe un valor con los decimales que tiene el paso del deslizador
 * (paso 0.01 → dos decimales), sin ceros sobrantes cuando el valor es más fino.
 * @param {number} value
 * @param {number} step
 * @returns {string}
 */
export function formatForDisplay(value, step) {
  const decimals = Math.min(8, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
  const rounded = Number(value.toFixed(decimals));
  // Durante una transición el valor puede caer entre dos pasos: se enseña redondeado.
  return Number.isFinite(rounded) ? rounded.toFixed(decimals) : formatNumber(value);
}
