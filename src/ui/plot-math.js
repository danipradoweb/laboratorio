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
 * Decimales que pide el paso entre marcas: paso 0,5 → 1 decimal; paso 20 → 0.
 * @param {number} step
 * @returns {number}
 */
function decimalsForStep(step) {
  return Math.max(0, -Math.floor(Math.log10(Math.abs(step)) + 1e-9));
}

/**
 * Escribe un valor con `extra` decimales más de los que pide el paso. Devuelve el texto
 * y el número que ese texto representa (para comprobar que no se ha perdido nada).
 * @param {number} value
 * @param {number} step
 * @param {number} extra
 * @returns {{ text: string, shown: number }}
 */
function writeTick(value, step, extra) {
  if (value === 0) return { text: '0', shown: 0 };
  const magnitude = Math.max(Math.abs(value), Math.abs(step));
  if (magnitude >= 1e5 || magnitude < 1e-3) {
    // Notación mantisa·10ⁿ.
    const exponent = Math.floor(Math.log10(Math.abs(value)) + 1e-12);
    const power = Math.pow(10, exponent);
    const decimals = Math.min(15, decimalsForStep(step / power) + extra);
    const mantissa = (value / power).toFixed(decimals);
    return {
      text: `${mantissa.replace('.', ',').replace('-', '−')}·10${superscript(exponent)}`,
      shown: Number(mantissa) * power,
    };
  }
  const fixed = value.toFixed(Math.min(15, decimalsForStep(step) + extra));
  return { text: fixed.replace('.', ',').replace('-', '−'), shown: Number(fixed) };
}

/**
 * Textos de las marcas de un eje, con coma decimal (español). Los valores muy grandes
 * o muy pequeños se escriben como mantisa·10ⁿ.
 *
 * Garantía: el rótulo nunca enseña un número distinto del valor de la marca. Se empieza
 * con los decimales que pide el paso y se añaden los necesarios hasta que TODAS las
 * marcas se leen exactas (por ejemplo, marcas cada 0,25 necesitan dos decimales aunque
 * su paso "pida" uno). Todas las marcas de un eje llevan los mismos decimales.
 *
 * @param {readonly number[]} ticks valores de las marcas
 * @param {number} step separación entre marcas
 * @returns {string[]}
 */
export function formatTicks(ticks, step) {
  const tolerance = Math.abs(step) * 1e-6;
  for (let extra = 0; extra <= 12; extra++) {
    const written = ticks.map((value) => writeTick(value, step, extra));
    if (extra === 12 || written.every((w, i) => Math.abs(w.shown - ticks[i]) <= tolerance)) {
      return written.map((w) => w.text);
    }
  }
  return ticks.map(String); // inalcanzable: el bucle siempre devuelve
}

/**
 * Texto de una sola marca (ver formatTicks).
 * @param {number} value
 * @param {number} step separación entre marcas
 * @returns {string}
 */
export function formatTick(value, step) {
  return formatTicks([value], step)[0];
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
