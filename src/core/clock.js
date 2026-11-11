// @ts-check
// Reloj de animación de un módulo: tiempo de simulación con pausa y velocidad.
//
// Las vistas animadas no llaman a requestAnimationFrame por su cuenta: se suscriben
// con clock.onTick((t, dt) => …). Así la pausa (barra espaciadora) y la velocidad
// (teclas [ y ]) funcionan igual en todos los módulos.
//
//   t   tiempo de simulación acumulado, en segundos (avanza a `speed` segundos por segundo real)
//   dt  incremento de t desde el fotograma anterior
//
// No depende del DOM: el temporizador (requestAnimationFrame) se puede inyectar, y por
// eso se prueba en Node con un temporizador falso.

/** Velocidades disponibles, de más lenta a más rápida. */
export const SPEEDS = [0.125, 0.25, 0.5, 1, 2, 4, 8];

/** Mayor salto de tiempo real admitido entre fotogramas (s). Evita saltos enormes al
 *  volver de otra pestaña, donde el navegador detiene la animación. */
const MAX_FRAME_SECONDS = 0.1;

/**
 * @typedef {(time: number, dt: number) => void} TickListener
 * @typedef {ReturnType<typeof createClock>} Clock
 */

/**
 * @param {object} [options]
 * @param {(callback: (timestampMs: number) => void) => number} [options.requestFrame]
 * @param {(handle: number) => void} [options.cancelFrame]
 */
export function createClock({
  requestFrame = (cb) => requestAnimationFrame(cb),
  cancelFrame = (h) => cancelAnimationFrame(h),
} = {}) {
  let time = 0;
  let playing = true;
  let speed = 1;
  /** @type {number | null} */
  let handle = null;
  /** @type {number | null} */
  let lastTimestamp = null;
  /** @type {Set<TickListener>} */
  const tickListeners = new Set();
  /** @type {Set<() => void>} */
  const changeListeners = new Set();

  /** @param {number} timestampMs */
  function frame(timestampMs) {
    handle = null;
    const realDt =
      lastTimestamp === null ? 0 : Math.min((timestampMs - lastTimestamp) / 1000, MAX_FRAME_SECONDS);
    lastTimestamp = timestampMs;
    const dt = realDt * speed;
    time += dt;
    for (const listener of [...tickListeners]) listener(time, dt);
    schedule();
  }

  // Solo se piden fotogramas si el reloj corre y alguien escucha.
  function schedule() {
    if (handle === null && playing && tickListeners.size > 0) handle = requestFrame(frame);
  }

  function stop() {
    if (handle !== null) cancelFrame(handle);
    handle = null;
    lastTimestamp = null;
  }

  function notifyChange() {
    for (const listener of [...changeListeners]) listener();
  }

  return {
    /** Tiempo de simulación (s). */
    get time() {
      return time;
    },
    /** ¿Está corriendo? */
    get playing() {
      return playing;
    },
    /** Factor de velocidad (1 = tiempo real). */
    get speed() {
      return speed;
    },

    play() {
      if (playing) return;
      playing = true;
      schedule();
      notifyChange();
    },

    pause() {
      if (!playing) return;
      playing = false;
      stop();
      notifyChange();
    },

    /** Alterna entre pausa y reproducción. */
    toggle() {
      if (playing) this.pause();
      else this.play();
    },

    /** Pasa a la siguiente velocidad de SPEEDS (si la hay). */
    faster() {
      const next = SPEEDS.find((s) => s > speed);
      if (next !== undefined) this.setSpeed(next);
    },

    /** Pasa a la velocidad anterior de SPEEDS (si la hay). */
    slower() {
      const previous = [...SPEEDS].reverse().find((s) => s < speed);
      if (previous !== undefined) this.setSpeed(previous);
    },

    /** @param {number} value factor de velocidad, > 0 */
    setSpeed(value) {
      if (!(value > 0) || value === speed) return;
      speed = value;
      notifyChange();
    },

    /** Vuelve a t = 0 y avisa a las vistas con un tick de dt = 0. */
    reset() {
      time = 0;
      for (const listener of [...tickListeners]) listener(time, 0);
    },

    /**
     * Se suscribe a los fotogramas. Devuelve la función para darse de baja.
     * @param {TickListener} listener
     * @returns {() => void}
     */
    onTick(listener) {
      tickListeners.add(listener);
      schedule();
      return () => {
        tickListeners.delete(listener);
        if (tickListeners.size === 0) stop();
      };
    },

    /**
     * Se suscribe a los cambios de pausa o velocidad (para actualizar botones).
     * @param {() => void} listener
     * @returns {() => void}
     */
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },

    /** Detiene el reloj y suelta todas las suscripciones. */
    destroy() {
      stop();
      tickListeners.clear();
      changeListeners.clear();
    },
  };
}
