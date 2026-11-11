// @ts-check
// Recorridos guiados: una secuencia de pasos { preset, text }.
//
// Cada paso lleva el módulo a un preset (con transición) y muestra un texto breve.
// La misma pieza sirve para estudiar, como guion de un vídeo y, en el futuro, para
// ensayos interactivos.
//
// Este archivo solo lleva la cuenta de en qué paso se está (sin DOM, probado en Node).
// La barra con el texto y las flechas la dibuja src/ui/tour-bar.js.

/**
 * @typedef {import('../modules/types.js').Tour} Tour
 * @typedef {import('../modules/types.js').TourStep} TourStep
 */

/**
 * Crea el controlador de un recorrido. Empieza en el primer paso (y avisa de él).
 * @param {Tour} tour
 * @param {(step: TourStep, index: number) => void} onStep se llama cada vez que cambia el paso
 */
export function createTourRunner(tour, onStep) {
  if (tour.steps.length === 0) throw new RangeError(`El recorrido "${tour.id}" no tiene pasos`);
  let index = 0;

  /** @param {number} target */
  function goTo(target) {
    const clamped = Math.min(tour.steps.length - 1, Math.max(0, Math.trunc(target)));
    if (clamped === index) return false;
    index = clamped;
    onStep(tour.steps[index], index);
    return true;
  }

  onStep(tour.steps[0], 0);

  return {
    tour,
    /** Índice del paso actual, empezando en 0. */
    get index() {
      return index;
    },
    /** Número de pasos. */
    get total() {
      return tour.steps.length;
    },
    get step() {
      return tour.steps[index];
    },
    get isFirst() {
      return index === 0;
    },
    get isLast() {
      return index === tour.steps.length - 1;
    },
    /** Avanza un paso. Devuelve false si ya estaba en el último. */
    next: () => goTo(index + 1),
    /** Retrocede un paso. Devuelve false si ya estaba en el primero. */
    previous: () => goTo(index - 1),
    /** Salta al paso indicado (se recorta al intervalo válido). */
    goTo,
  };
}

/** @typedef {ReturnType<typeof createTourRunner>} TourRunner */
