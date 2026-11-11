// @ts-check
// Formato de números para la interfaz, en español (coma decimal).

/**
 * Escribe un número con un número fijo de decimales y coma decimal: 2.5 → "2,50".
 * @param {number} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatEs(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimals).replace('.', ',').replace('-', '−');
}
