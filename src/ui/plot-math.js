// @ts-check
// Cálculos del trazador 2D que no dependen del DOM: marcas de los ejes, formato de
// números, extensión de los datos y cambio de escala. Están separados de plot2d.js
// para poder probarlos en Node (tests/plot-math.test.js).

/**
 * Paso "redondo" (1, 2 o 5 por una potencia de 10) para cubrir `span` con unas
 * `target` divisiones.
 * @param {number} span longitud del intervalo (> 0)
 * @param {number} target número de divisiones deseado
 * @returns {number}
 */
export function niceStep(span, target) {
  const raw = span / Math.max(1, target);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power; // entre 1 y 10
  let nice = 10;
  if (fraction <= 1.5) nice = 1;
  else if (fraction <= 3.5) nice = 2;
  else if (fraction <= 7.5) nice = 5;
  return nice * power;
}

/**
 * Marcas de un eje: múltiplos de un paso redondo dentro de [min, max].
 * @param {number} min
 * @param {number} max
 * @param {number} [target] número aproximado de marcas
 * @returns {{ ticks: number[], step: number }}
 */
export function niceTicks(min, max, target = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) {
    return { ticks: Number.isFinite(min) ? [min] : [], step: 1 };
  }
  const step = niceStep(max - min, target);
  const eps = step * 1e-9;
  const first = Math.ceil((min - eps) / step);
  const last = Math.floor((max + eps) / step);
  /** @type {number[]} */
  const ticks = [];
  for (let i = first; i <= last; i++) {
    // i·step (y no una suma acumulada) para no arrastrar error de redondeo;
    // toPrecision limpia colas como 0.30000000000000004.
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return { ticks, step };
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * @param {number} n entero
 * @returns {string} n escrito con cifras en superíndice
 */
function superscript(n) {
  const digits = String(Math.abs(n))
    .split('')
    .map((d) => SUPERSCRIPTS[Number(d)])
    .join('');
  return (n < 0 ? '⁻' : '') + digits;
}

/**
 * Texto de una marca de eje, con coma decimal (español) y los decimales justos para
 * distinguir marcas separadas por `step`. Los valores muy grandes o muy pequeños se
 * escriben como mantisa·10ⁿ.
 * @param {number} value
 * @param {number} step separación entre marcas
 * @returns {string}
 */
export function formatTick(value, step) {
  if (value === 0) return '0';
  const magnitude = Math.max(Math.abs(value), Math.abs(step));
  if (magnitude >= 1e5 || magnitude < 1e-3) {
    const exponent = Math.floor(Math.log10(Math.abs(value)) + 1e-12);
    const mantissa = value / Math.pow(10, exponent);
    const stepMantissa = step / Math.pow(10, exponent);
    const decimals = Math.min(6, Math.max(0, -Math.floor(Math.log10(Math.abs(stepMantissa)) + 1e-9)));
    const text = mantissa.toFixed(decimals).replace('.', ',').replace('-', '−');
    return `${text}·10${superscript(exponent)}`;
  }
  const decimals = Math.min(8, Math.max(0, -Math.floor(Math.log10(Math.abs(step)) + 1e-9)));
  return value.toFixed(decimals).replace('.', ',').replace('-', '−');
}

/**
 * Mínimo y máximo de varias listas de números, ignorando NaN e infinitos.
 * @param {(ArrayLike<number> | undefined)[]} arrays
 * @returns {[number, number] | null} null si no hay ningún valor finito
 */
export function extent(arrays) {
  let min = Infinity;
  let max = -Infinity;
  for (const array of arrays) {
    if (!array) continue;
    for (let i = 0; i < array.length; i++) {
      const v = array[i];
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  return min <= max ? [min, max] : null;
}

/**
 * Ensancha un intervalo una fracción de su longitud por cada lado. Si el intervalo
 * tiene longitud cero (datos constantes), le da una anchura razonable.
 * @param {[number, number]} range
 * @param {number} fraction
 * @returns {[number, number]}
 */
export function padRange([min, max], fraction) {
  if (max === min) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * fraction;
  return [min - pad, max + pad];
}

/**
 * Escala lineal entre coordenadas de datos y píxeles.
 * @param {number} d0 dato que cae en el píxel p0
 * @param {number} d1 dato que cae en el píxel p1
 * @param {number} p0
 * @param {number} p1
 */
export function linearScale(d0, d1, p0, p1) {
  const slope = (p1 - p0) / (d1 - d0);
  return {
    /** @param {number} d @returns {number} */
    toPixel: (d) => p0 + (d - d0) * slope,
    /** @param {number} p @returns {number} */
    toData: (p) => d0 + (p - p0) / slope,
  };
}
