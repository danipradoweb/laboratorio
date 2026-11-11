// @ts-check
// PLANTILLA · physics.js — la física del módulo.
//
// REGLAS (las comprueba tests/modulos.test.js):
//   - Solo funciones puras: reciben números y devuelven números. Nada de `document`,
//     `window`, canvas ni variables globales. Así se pueden probar en Node.
//   - Las constantes físicas se importan de src/core/units.js; no se teclean aquí.
//   - Cada función dice en su comentario qué calcula, con qué fórmula y en qué unidades.
//   - Cada función tiene al menos un test en tests/<id>.test.js.
//
// Ejemplo de esta plantilla: ondas estacionarias en una cuerda de longitud L.
//
//   y(x, t) = A · f(nπx/L) · cos(ω_n t),     ω_n = nπc/L
//
// con f = sen si los extremos están fijos (y = 0 en x = 0 y x = L) y f = cos si están
// libres (pendiente nula en los extremos). c es la velocidad de las ondas en la cuerda.

/**
 * @typedef {'fijos' | 'libres'} Ends condición en los dos extremos de la cuerda
 */

/**
 * Frecuencia angular del modo n: ω_n = nπc/L.
 * @param {number} n número de modo (1 = fundamental)
 * @param {number} length longitud L de la cuerda
 * @param {number} speed velocidad c de las ondas
 * @returns {number} ω_n, en radianes por unidad de tiempo
 */
export function angularFrequency(n, length, speed) {
  return (n * Math.PI * speed) / length;
}

/**
 * Forma espacial del modo n, sin amplitud: sen(nπx/L) o cos(nπx/L).
 * @param {number} x posición, entre 0 y L
 * @param {number} n número de modo
 * @param {number} length longitud L
 * @param {Ends} ends
 * @returns {number} valor entre −1 y 1
 */
export function modeShape(x, n, length, ends) {
  const phase = (n * Math.PI * x) / length;
  return ends === 'fijos' ? Math.sin(phase) : Math.cos(phase);
}

/**
 * Desplazamiento de la cuerda: y(x, t) = A · f(nπx/L) · cos(ω_n t).
 * @param {number} x posición
 * @param {number} t tiempo
 * @param {{ n: number, amplitude: number, length: number, speed: number, ends: Ends }} p
 * @returns {number}
 */
export function displacement(x, t, { n, amplitude, length, speed, ends }) {
  return amplitude * modeShape(x, n, length, ends) * Math.cos(angularFrequency(n, length, speed) * t);
}

/**
 * Posiciones de los nodos (puntos que no se mueven nunca), de menor a mayor.
 *   extremos fijos:  x = m·L/n,          m = 0, 1, …, n      (n + 1 nodos, con los extremos)
 *   extremos libres: x = (m + ½)·L/n,    m = 0, 1, …, n − 1  (n nodos)
 * @param {number} n número de modo
 * @param {number} length longitud L
 * @param {Ends} ends
 * @returns {number[]}
 */
export function nodePositions(n, length, ends) {
  /** @type {number[]} */
  const nodes = [];
  if (ends === 'fijos') {
    for (let m = 0; m <= n; m++) nodes.push((m * length) / n);
  } else {
    for (let m = 0; m < n; m++) nodes.push(((m + 0.5) * length) / n);
  }
  return nodes;
}
