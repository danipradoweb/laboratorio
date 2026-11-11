// @ts-check
// Presets (estados con nombre) y transiciones animadas entre estados.
//
// Pasar de un estado a otro interpola los parámetros numéricos con una curva suave y
// cambia los discretos (listas, conmutadores) al final. Así se ve CÓMO cambia la
// física entre un preset y otro, en vez de un salto.
//
// Sin DOM: el temporizador se puede inyectar, y por eso se prueba en Node.

import { normalizeState } from './state.js';

/**
 * @typedef {import('./state.js').Param} Param
 * @typedef {import('./state.js').State} State
 * @typedef {import('../modules/types.js').Preset} Preset
 */

/** Duración por defecto de una transición, en segundos. */
export const DEFAULT_TRANSITION_SECONDS = 1.5;

/**
 * Curva suave de 0 a 1 con velocidad nula en los extremos (3t² − 2t³).
 * @param {number} t progreso lineal, de 0 a 1
 * @returns {number}
 */
export function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Estado completo de un preset: sus valores, y el valor por defecto en lo que no fije.
 * @param {readonly Param[]} params
 * @param {Preset} preset
 * @returns {State}
 */
export function presetState(params, preset) {
  return normalizeState(params, preset.state).state;
}

/**
 * Estado intermedio de una transición.
 * @param {readonly Param[]} params
 * @param {State} from estado de partida
 * @param {State} to estado de llegada
 * @param {number} t progreso lineal, de 0 a 1 (la curva suave se aplica aquí dentro)
 * @returns {State}
 */
export function interpolateState(params, from, to, t) {
  if (t >= 1) return to;
  const eased = easeInOut(t);
  /** @type {Record<string, number | string | boolean>} */
  const state = {};
  for (const p of params) {
    const a = from[p.key];
    const b = to[p.key];
    if (p.type === 'range' && typeof a === 'number' && typeof b === 'number') {
      state[p.key] = a + (b - a) * eased;
    } else {
      state[p.key] = a; // los discretos cambian al final (t = 1)
    }
  }
  return Object.freeze(state);
}

/**
 * Identificador del preset que coincide con el estado actual, o null si ninguno.
 * Los números se comparan con una tolerancia relativa pequeña.
 * @param {readonly Param[]} params
 * @param {readonly Preset[]} presets
 * @param {State} state
 * @returns {string | null}
 */
export function findActivePreset(params, presets, state) {
  for (const preset of presets) {
    const target = presetState(params, preset);
    const same = params.every((p) => {
      const a = state[p.key];
      const b = target[p.key];
      if (typeof a === 'number' && typeof b === 'number') {
        return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
      }
      return a === b;
    });
    if (same) return preset.id;
  }
  return null;
}

/**
 * Anima una transición entre dos estados.
 *
 * @param {object} options
 * @param {readonly Param[]} options.params
 * @param {State} options.from
 * @param {State} options.to
 * @param {(state: State) => void} options.onFrame se llama en cada fotograma con el estado intermedio
 * @param {() => void} [options.onDone] se llama una vez, tras el último fotograma (estado = to)
 * @param {number} [options.duration] segundos; 0 salta directamente al final
 * @param {(callback: (timestampMs: number) => void) => number} [options.requestFrame]
 * @param {(handle: number) => void} [options.cancelFrame]
 * @returns {{ cancel: () => void, readonly running: boolean }}
 *   cancel() detiene la transición donde esté, sin llamar a onDone
 */
export function createTransition({
  params,
  from,
  to,
  onFrame,
  onDone,
  duration = DEFAULT_TRANSITION_SECONDS,
  requestFrame = (cb) => requestAnimationFrame(cb),
  cancelFrame = (h) => cancelAnimationFrame(h),
}) {
  let running = true;
  /** @type {number | null} */
  let handle = null;
  /** @type {number | null} */
  let start = null;

  function finish() {
    running = false;
    handle = null;
    onFrame(to);
    onDone?.();
  }

  /** @param {number} timestampMs */
  function frame(timestampMs) {
    if (!running) return;
    if (start === null) start = timestampMs;
    const t = (timestampMs - start) / (duration * 1000);
    if (t >= 1) {
      finish();
      return;
    }
    onFrame(interpolateState(params, from, to, t));
    handle = requestFrame(frame);
  }

  if (!(duration > 0)) finish();
  else handle = requestFrame(frame);

  return {
    cancel() {
      if (!running) return;
      running = false;
      if (handle !== null) cancelFrame(handle);
      handle = null;
    },
    get running() {
      return running;
    },
  };
}
