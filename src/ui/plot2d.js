// @ts-check
// Trazador 2D sencillo sobre Canvas.
//
//   const plot = createPlot(contenedor, { xLabel: 'ω/ω₀', yLabel: 'Amplitud' });
//   plot.draw({
//     series: [{ x, y, label: 'Respuesta' }],
//     vlines: [{ x: 1, label: 'ω actual' }],
//   });
//
// Es declarativo: cada llamada a draw() recibe TODO lo que hay que pintar y sustituye
// a lo anterior. El trazador se redibuja solo cuando cambia el tamaño del contenedor
// o el tema, así que la vista de un módulo solo tiene que llamar a draw() cuando
// cambian los datos.
//
// Qué sabe dibujar: series (líneas), áreas sombreadas bajo una curva, bandas
// verticales, marcadores verticales y horizontales, mapas de color 2D con barra de
// color, imágenes RGBA (para el coloreado de fase), leyenda y exportación a PNG.
//
// El contenedor debe tener una altura definida (por ejemplo, un .panel-body).
// El tamaño de la letra sale del font-size del contenedor: en modo presentación crece
// con él sin tocar nada aquí.

import { el } from './dom.js';
import { extent, formatTicks, linearScale, niceTicks, padRange } from './plot-math.js';
import { onThemeChange, themeColors } from '../core/theme.js';

/**
 * Color de un elemento: un número n usa el color n de la paleta de series del tema
 * (0, 1, 2…), y un texto se usa tal cual como color CSS.
 * @typedef {number | string} PlotColor
 */

/**
 * @typedef {object} Series
 * @property {ArrayLike<number>} x
 * @property {ArrayLike<number>} y los NaN cortan la línea
 * @property {string} [label] texto de la leyenda (sin label no sale en la leyenda)
 * @property {PlotColor} [color] por defecto, el siguiente de la paleta
 * @property {number[]} [dash] patrón de trazos, p. ej. [6, 4]
 * @property {number} [width] grosor relativo (1 = normal)
 * @property {boolean} [points] dibuja un punto en cada dato (para datos discretos)
 * @property {boolean} [line] une los datos con una línea (por defecto true)
 */

/**
 * Área sombreada entre la curva y(x) y la línea base y0 (número o curva).
 * @typedef {object} Area
 * @property {ArrayLike<number>} x
 * @property {ArrayLike<number>} y
 * @property {number | ArrayLike<number>} [y0] por defecto 0
 * @property {string} [label]
 * @property {PlotColor} [color]
 * @property {number} [opacity] entre 0 y 1 (por defecto 0,25)
 */

/**
 * Banda vertical sombreada entre x1 y x2, de arriba abajo.
 * @typedef {object} Band
 * @property {number} x1
 * @property {number} x2
 * @property {string} [label]
 * @property {PlotColor} [color]
 * @property {number} [opacity]
 */

/**
 * Marcador: línea vertical (vlines) u horizontal (hlines).
 * @typedef {object} Marker
 * @property {number} [x] posición (vlines)
 * @property {number} [y] posición (hlines)
 * @property {string} [label] texto junto a la línea
 * @property {PlotColor} [color] por defecto, el color de acento del tema
 * @property {number[]} [dash]
 */

/**
 * Mapa de color: valores escalares en una malla regular de nx × ny celdas, por filas
 * (índice iy·nx + ix); la fila iy = 0 es la de menor y (abajo).
 *
 * CONVENIO DE MALLA: xRange e yRange son los BORDES del rectángulo, y cada valor
 * corresponde al CENTRO de su celda:
 *   x = xRange[0] + (ix + ½)·Δx,   Δx = (xRange[1] − xRange[0]) / nx      (igual en y)
 * Si tus muestras están en nodos que incluyen los extremos (x₀, x₀ + h, …, x₁), pasa
 * como bordes [x₀ − h/2, x₁ + h/2]; si no, el dibujo queda desplazado media celda.
 * @typedef {object} Heatmap
 * @property {number} nx
 * @property {number} ny
 * @property {ArrayLike<number>} values
 * @property {[number, number]} xRange coordenadas de los bordes izquierdo y derecho
 * @property {[number, number]} yRange coordenadas de los bordes inferior y superior
 * @property {(t: number) => [number, number, number]} colormap de [0, 1] a RGB (0–255);
 *   ver src/ui/colormaps.js
 * @property {number} [vmin] valor que corresponde a t = 0 (por defecto, el mínimo)
 * @property {number} [vmax] valor que corresponde a t = 1 (por defecto, el máximo)
 * @property {boolean} [symmetric] centra la escala en 0 (para mapas divergentes)
 * @property {string} [label] título de la barra de color
 * @property {boolean} [colorbar] por defecto true
 */

/**
 * Imagen ya coloreada (por ejemplo, fase y módulo de una función compleja). Mismo
 * convenio de malla que Heatmap: rangos = bordes, valores = centros de celda.
 * @typedef {object} RgbaImage
 * @property {number} nx
 * @property {number} ny
 * @property {Uint8ClampedArray} rgba 4 bytes por punto, por filas; fila 0 abajo
 * @property {[number, number]} xRange
 * @property {[number, number]} yRange
 */

/**
 * @typedef {object} PlotData
 * @property {Series[]} [series]
 * @property {Area[]} [areas]
 * @property {Band[]} [bands]
 * @property {Marker[]} [vlines]
 * @property {Marker[]} [hlines]
 * @property {Heatmap} [heatmap]
 * @property {RgbaImage} [image]
 * @property {[number, number]} [xRange] sustituye al de las opciones en este dibujo
 * @property {[number, number]} [yRange]
 */

/**
 * @typedef {object} PlotOptions
 * @property {string} [xLabel]
 * @property {string} [yLabel]
 * @property {[number, number]} [xRange] intervalo fijo; si falta, se ajusta a los datos
 * @property {[number, number]} [yRange]
 * @property {boolean} [legend] leyenda en una fila encima de la gráfica (por defecto true)
 * @property {number[]} [xTicks] posiciones de las marcas del eje x (por defecto, automáticas)
 * @property {number[]} [yTicks] posiciones de las marcas del eje y (p. ej. [0, 45, 90, 135, 180])
 * @property {boolean} [exportButton] botón "PNG" al pasar el ratón (por defecto true)
 * @property {string} [exportName] nombre del archivo PNG, sin extensión
 * @property {boolean} [equalAspect] misma escala en x e y (útil en mapas espaciales)
 * @property {(x: number, y: number) => void} [onPick] se llama al hacer clic o arrastrar
 *   sobre la gráfica, con las coordenadas de datos del puntero (vistas enlazadas)
 */

/**
 * Marcas fijadas a mano: se quedan las que caen dentro del intervalo, y el "paso" (que
 * decide cuántos decimales se escriben) es la menor separación entre ellas.
 * @param {number[]} positions
 * @param {[number, number]} range
 * @returns {{ ticks: number[], step: number }}
 */
function fixedTicks(positions, range) {
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const ticks = positions.filter((v) => v >= lo && v <= hi).sort((a, b) => a - b);
  let step = hi - lo || 1;
  for (let i = 1; i < ticks.length; i++) step = Math.min(step, ticks[i] - ticks[i - 1]);
  return { ticks, step };
}

/** Trazadores vivos, para poder redibujarlos todos (refreshPlots). @type {Set<() => void>} */
const livePlots = new Set();

/**
 * Redibuja todas las gráficas. Lo llama el modo presentación al cambiar la tipografía.
 */
export function refreshPlots() {
  for (const render of [...livePlots]) render();
}

/**
 * Crea un trazador dentro de `container`.
 * @param {HTMLElement} container
 * @param {PlotOptions} [options]
 */
export function createPlot(container, options = {}) {
  const canvas = el('canvas', { class: 'plot-canvas', role: 'img' });
  const wrap = el('div', { class: 'plot' }, canvas);
  canvas.setAttribute(
    'aria-label',
    `Gráfica: ${options.yLabel ?? ''}${options.xLabel ? ` frente a ${options.xLabel}` : ''}`,
  );
  if (options.exportButton !== false) {
    wrap.append(
      el('button', {
        class: 'plot-export',
        type: 'button',
        text: 'PNG',
        title: 'Guardar esta gráfica como imagen PNG',
        onclick: () => downloadPNG(),
      }),
    );
  }
  container.append(wrap);
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  /** @type {PlotData} */
  let data = {};
  /** Geometría del último dibujo, para convertir píxeles en datos (onPick). */
  /** @type {{ x: ReturnType<typeof linearScale>, y: ReturnType<typeof linearScale>, left: number, right: number, top: number, bottom: number } | null} */
  let frame = null;
  /** Lienzo auxiliar para los mapas de color. @type {HTMLCanvasElement | null} */
  let offscreen = null;
  let destroyed = false;

  // --- Dibujo ---------------------------------------------------------------------------

  function render() {
    if (destroyed) return;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width < 40 || height < 40) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = themeColors();
    const style = getComputedStyle(wrap);
    const fs = parseFloat(style.fontSize) || 14;
    const family = style.fontFamily || 'sans-serif';
    const tickFont = `${fs * 0.85}px ${family}`;
    const labelFont = `${fs * 0.95}px ${family}`;
    /** @param {PlotColor | undefined} color @param {number} fallbackIndex */
    const resolve = (color, fallbackIndex) => {
      if (typeof color === 'string') return color;
      const index = color ?? fallbackIndex;
      return colors.series[index % colors.series.length];
    };

    g.fillStyle = colors.surface;
    g.fillRect(0, 0, width, height);

    const series = data.series ?? [];
    const areas = data.areas ?? [];
    const raster = data.heatmap ?? data.image;

    // Intervalos de los ejes: los fijados, o la extensión de los datos.
    let xRange = data.xRange ?? options.xRange;
    if (!xRange) {
      xRange = raster?.xRange ?? extent([...series.map((s) => s.x), ...areas.map((a) => a.x)]) ?? [0, 1];
      if (xRange[0] === xRange[1]) xRange = padRange(xRange, 0);
    }
    let yRange = data.yRange ?? options.yRange;
    if (!yRange) {
      if (raster) yRange = raster.yRange;
      else {
        const auto = extent([
          ...series.map((s) => s.y),
          ...areas.map((a) => a.y),
          ...areas.map((a) => (typeof a.y0 === 'number' || a.y0 === undefined ? [a.y0 ?? 0] : a.y0)),
        ]);
        yRange = auto ? padRange(auto, 0.06) : [0, 1];
      }
    }

    // Márgenes: dependen del ancho de los números del eje y y de las filas de la leyenda.
    const colorbar = data.heatmap && data.heatmap.colorbar !== false ? data.heatmap : null;
    const bottom = fs * 1.55 + (options.xLabel ? fs * 1.45 : 0);
    g.font = tickFont;
    /** @param {number} plotHeight */
    const computeYTicks = (plotHeight) => {
      const result = options.yTicks
        ? fixedTicks(options.yTicks, yRange)
        : niceTicks(yRange[0], yRange[1], Math.min(6, Math.max(2, plotHeight / (fs * 2.8))));
      const texts = formatTicks(result.ticks, result.step);
      return { ...result, texts, width: Math.max(0, ...texts.map((t) => g.measureText(t).width)) };
    };
    let yTicks = computeYTicks(height - fs * 0.7 - bottom);
    let left = yTicks.width + fs * 0.9 + (options.yLabel ? fs * 1.5 : 0);
    let right = fs * 0.9 + (colorbar ? fs * (colorbar.label ? 5.6 : 4.2) : 0);
    const legend = options.legend !== false ? layoutLegend(fs, resolve, width - left - right) : null;
    const top = fs * 0.7 + (legend ? legend.height : 0);
    if (legend && legend.rows > 0) {
      // Con la leyenda la gráfica es más baja: se recalculan las marcas del eje y.
      yTicks = computeYTicks(height - top - bottom);
      left = yTicks.width + fs * 0.9 + (options.yLabel ? fs * 1.5 : 0);
    }
    const yTickTexts = yTicks.texts;
    const yTickWidth = yTicks.width;
    const legendLeft = left;
    let plotW = width - left - right;
    let plotH = height - top - bottom;
    let plotTop = top;
    if (options.equalAspect) {
      // Misma escala en los dos ejes: se reduce el lado que sobra y se centra.
      const dataAspect = (xRange[1] - xRange[0]) / (yRange[1] - yRange[0]);
      if (plotW / plotH > dataAspect) {
        const w = plotH * dataAspect;
        left += (plotW - w) / 2;
        right += (plotW - w) / 2;
        plotW = w;
      } else {
        const h = plotW / dataAspect;
        plotTop += (plotH - h) / 2;
        plotH = h;
      }
    }
    if (plotW < 20 || plotH < 20) return;
    const plotLeft = left;
    const plotRight = left + plotW;
    const plotBottom = plotTop + plotH;
    const xScale = linearScale(xRange[0], xRange[1], plotLeft, plotRight);
    const yScale = linearScale(yRange[0], yRange[1], plotBottom, plotTop);
    frame = { x: xScale, y: yScale, left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom };
    const xTicks = options.xTicks
      ? fixedTicks(options.xTicks, xRange)
      : niceTicks(xRange[0], xRange[1], Math.min(10, Math.max(3, plotW / (fs * 4.5))));

    // Todo lo que representa datos se recorta al rectángulo de la gráfica.
    g.save();
    g.beginPath();
    g.rect(plotLeft, plotTop, plotW, plotH);
    g.clip();

    // Mapa de color o imagen.
    /** @type {[number, number] | null} */
    let valueRange = null;
    if (data.heatmap) valueRange = drawHeatmap(data.heatmap, xScale, yScale);
    else if (data.image) drawRaster(data.image, data.image.rgba, xScale, yScale);

    // Rejilla (no se pinta encima de un mapa de color).
    if (!raster) {
      g.strokeStyle = colors.grid;
      g.lineWidth = 1;
      g.beginPath();
      for (const t of xTicks.ticks) {
        const px = Math.round(xScale.toPixel(t)) + 0.5;
        g.moveTo(px, plotTop);
        g.lineTo(px, plotBottom);
      }
      for (const t of yTicks.ticks) {
        const py = Math.round(yScale.toPixel(t)) + 0.5;
        g.moveTo(plotLeft, py);
        g.lineTo(plotRight, py);
      }
      g.stroke();
    }

    // Bandas verticales.
    (data.bands ?? []).forEach((band, i) => {
      g.globalAlpha = band.opacity ?? 0.18;
      g.fillStyle = resolve(band.color, i + 2);
      const a = xScale.toPixel(band.x1);
      const b = xScale.toPixel(band.x2);
      g.fillRect(Math.min(a, b), plotTop, Math.abs(b - a), plotH);
      g.globalAlpha = 1;
    });

    // Áreas sombreadas.
    areas.forEach((area, i) => {
      const n = Math.min(area.x.length, area.y.length);
      if (n < 2) return;
      const base = area.y0 ?? 0;
      g.beginPath();
      for (let j = 0; j < n; j++) {
        const px = xScale.toPixel(area.x[j]);
        const py = yScale.toPixel(area.y[j]);
        if (j === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      for (let j = n - 1; j >= 0; j--) {
        g.lineTo(xScale.toPixel(area.x[j]), yScale.toPixel(typeof base === 'number' ? base : base[j]));
      }
      g.closePath();
      g.globalAlpha = area.opacity ?? 0.25;
      g.fillStyle = resolve(area.color, i);
      g.fill();
      g.globalAlpha = 1;
    });

    // Series.
    g.lineJoin = 'round';
    g.lineCap = 'round';
    series.forEach((s, i) => {
      const n = Math.min(s.x.length, s.y.length);
      g.strokeStyle = resolve(s.color, i);
      g.lineWidth = Math.max(1.5, fs * 0.14) * (s.width ?? 1);
      g.setLineDash((s.dash ?? []).map((d) => (d * fs) / 14));
      g.beginPath();
      let pen = false;
      for (let j = 0; j < n; j++) {
        const vx = s.x[j];
        const vy = s.y[j];
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
          pen = false; // un valor no finito corta la línea
          continue;
        }
        const px = xScale.toPixel(vx);
        const py = yScale.toPixel(vy);
        if (pen) g.lineTo(px, py);
        else g.moveTo(px, py);
        pen = true;
      }
      if (s.line !== false) g.stroke();
      if (s.points) {
        g.setLineDash([]);
        g.fillStyle = g.strokeStyle;
        for (let j = 0; j < n; j++) {
          if (!Number.isFinite(s.x[j]) || !Number.isFinite(s.y[j])) continue;
          g.beginPath();
          g.arc(xScale.toPixel(s.x[j]), yScale.toPixel(s.y[j]), fs * 0.3 * (s.width ?? 1), 0, 2 * Math.PI);
          g.fill();
        }
      }
    });
    g.setLineDash([]);

    // Marcadores.
    /** @type {{ text: string, x: number, y: number, align: CanvasTextAlign, color: string }[]} */
    const markerLabels = [];
    const markerWidth = Math.max(1.5, fs * 0.12);
    /** Cajas ya ocupadas por etiquetas de marcadores verticales. @type {{ row: number, x0: number, x1: number }[]} */
    const vlineLabelBoxes = [];
    for (const marker of data.vlines ?? []) {
      if (marker.x === undefined || !Number.isFinite(marker.x)) continue;
      const px = xScale.toPixel(marker.x);
      const color = resolve(marker.color ?? colors.accent, 0);
      g.strokeStyle = color;
      g.lineWidth = markerWidth;
      g.setLineDash((marker.dash ?? []).map((d) => (d * fs) / 14));
      g.beginPath();
      g.moveTo(px, plotTop);
      g.lineTo(px, plotBottom);
      g.stroke();
      if (marker.label) {
        // La etiqueta va a la derecha de la línea, o a la izquierda si no cabe. Si pisaría
        // la etiqueta de otro marcador cercano, baja a la fila siguiente.
        g.font = tickFont;
        const textWidth = g.measureText(marker.label).width;
        const fits = px + fs * 0.4 + textWidth < plotRight;
        const x0 = fits ? px + fs * 0.4 : px - fs * 0.4 - textWidth;
        let row = 0;
        while (vlineLabelBoxes.some((b) => b.row === row && x0 < b.x1 + fs * 0.3 && x0 + textWidth > b.x0 - fs * 0.3)) row++;
        vlineLabelBoxes.push({ row, x0, x1: x0 + textWidth });
        markerLabels.push({
          text: marker.label,
          x: px + (fits ? fs * 0.4 : -fs * 0.4),
          y: plotTop + fs * 1.1 + row * fs * 1.2,
          align: fits ? 'left' : 'right',
          color,
        });
      }
    }
    for (const marker of data.hlines ?? []) {
      if (marker.y === undefined || !Number.isFinite(marker.y)) continue;
      const py = yScale.toPixel(marker.y);
      const color = resolve(marker.color ?? colors.accent, 0);
      g.strokeStyle = color;
      g.lineWidth = markerWidth;
      g.setLineDash((marker.dash ?? []).map((d) => (d * fs) / 14));
      g.beginPath();
      g.moveTo(plotLeft, py);
      g.lineTo(plotRight, py);
      g.stroke();
      if (marker.label) {
        markerLabels.push({ text: marker.label, x: plotRight - fs * 0.4, y: py - fs * 0.4, align: 'right', color });
      }
    }
    g.setLineDash([]);
    g.font = tickFont;
    g.textBaseline = 'alphabetic';
    for (const label of markerLabels) {
      g.textAlign = label.align;
      // Halo del color del fondo para que el texto se lea sobre las curvas.
      g.lineWidth = fs * 0.3;
      g.strokeStyle = colors.surface;
      g.strokeText(label.text, label.x, label.y);
      g.fillStyle = label.color;
      g.fillText(label.text, label.x, label.y);
    }
    g.restore();

    // Marco y marcas de los ejes.
    g.strokeStyle = colors.border;
    g.lineWidth = 1;
    g.strokeRect(Math.round(plotLeft) + 0.5, Math.round(plotTop) + 0.5, Math.round(plotW), Math.round(plotH));
    g.fillStyle = colors.textSoft;
    g.font = tickFont;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const xTickTexts = formatTicks(xTicks.ticks, xTicks.step);
    xTicks.ticks.forEach((t, i) => {
      g.fillText(xTickTexts[i], xScale.toPixel(t), plotBottom + fs * 0.4);
    });
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    yTicks.ticks.forEach((t, i) => {
      g.fillText(yTickTexts[i], plotLeft - fs * 0.45, yScale.toPixel(t));
    });

    // Títulos de los ejes.
    g.fillStyle = colors.text;
    g.font = labelFont;
    if (options.xLabel) {
      // Justo debajo de las marcas (y no pegado al borde inferior), para que siga junto
      // a la gráfica cuando equalAspect la hace más baja que su contenedor.
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillText(options.xLabel, (plotLeft + plotRight) / 2, plotBottom + fs * 1.6);
    }
    if (options.yLabel) {
      g.save();
      g.translate(plotLeft - yTickWidth - fs * 1.1, (plotTop + plotBottom) / 2);
      g.rotate(-Math.PI / 2);
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(options.yLabel, 0, 0);
      g.restore();
    }

    if (colorbar && valueRange) drawColorbar(colorbar, valueRange, plotRight, plotTop, plotH, fs, tickFont, labelFont, colors);
    if (legend) drawLegend(legend, legendLeft, fs * 0.45, fs, tickFont, colors);
  }

  /**
   * Pinta una malla nx × ny de colores RGBA estirada sobre su rectángulo de datos.
   * @param {{ nx: number, ny: number, xRange: [number, number], yRange: [number, number] }} grid
   * @param {Uint8ClampedArray} rgba fila 0 abajo
   * @param {ReturnType<typeof linearScale>} xScale
   * @param {ReturnType<typeof linearScale>} yScale
   */
  function drawRaster(grid, rgba, xScale, yScale) {
    const { nx, ny } = grid;
    if (!offscreen) offscreen = document.createElement('canvas');
    if (offscreen.width !== nx || offscreen.height !== ny) {
      offscreen.width = nx;
      offscreen.height = ny;
    }
    const og = /** @type {CanvasRenderingContext2D} */ (offscreen.getContext('2d'));
    const image = og.createImageData(nx, ny);
    // En un canvas la fila 0 está arriba; en los datos, abajo: se copian las filas al revés.
    for (let iy = 0; iy < ny; iy++) {
      const source = (ny - 1 - iy) * nx * 4;
      image.data.set(rgba.subarray(source, source + nx * 4), iy * nx * 4);
    }
    og.putImageData(image, 0, 0);
    const x0 = xScale.toPixel(grid.xRange[0]);
    const x1 = xScale.toPixel(grid.xRange[1]);
    const y0 = yScale.toPixel(grid.yRange[1]);
    const y1 = yScale.toPixel(grid.yRange[0]);
    g.imageSmoothingEnabled = true;
    g.drawImage(offscreen, x0, y0, x1 - x0, y1 - y0);
  }

  /**
   * @param {Heatmap} map
   * @param {ReturnType<typeof linearScale>} xScale
   * @param {ReturnType<typeof linearScale>} yScale
   * @returns {[number, number]} intervalo de valores usado para el color
   */
  function drawHeatmap(map, xScale, yScale) {
    let vmin = map.vmin;
    let vmax = map.vmax;
    if (vmin === undefined || vmax === undefined) {
      const auto = extent([map.values]) ?? [0, 1];
      vmin ??= auto[0];
      vmax ??= auto[1];
    }
    if (map.symmetric) {
      vmax = Math.max(Math.abs(vmin), Math.abs(vmax));
      vmin = -vmax;
    }
    if (vmax === vmin) vmax = vmin + 1;
    const total = map.nx * map.ny;
    const rgba = new Uint8ClampedArray(total * 4);
    for (let i = 0; i < total; i++) {
      const t = Math.min(1, Math.max(0, (map.values[i] - vmin) / (vmax - vmin)));
      const [r, gr, b] = map.colormap(t);
      rgba[4 * i] = r;
      rgba[4 * i + 1] = gr;
      rgba[4 * i + 2] = b;
      rgba[4 * i + 3] = 255;
    }
    drawRaster(map, rgba, xScale, yScale);
    return [vmin, vmax];
  }

  /**
   * Barra de color a la derecha de la gráfica.
   * @param {Heatmap} map
   * @param {[number, number]} valueRange
   * @param {number} plotRight
   * @param {number} plotTop
   * @param {number} plotH
   * @param {number} fs
   * @param {string} tickFont
   * @param {string} labelFont
   * @param {import('../core/theme.js').ThemeColors} colors
   */
  function drawColorbar(map, valueRange, plotRight, plotTop, plotH, fs, tickFont, labelFont, colors) {
    const barX = plotRight + fs * 0.8;
    const barW = fs * 0.9;
    const rows = Math.max(2, Math.round(plotH));
    for (let i = 0; i < rows; i++) {
      const [r, gr, b] = map.colormap(1 - i / (rows - 1));
      g.fillStyle = `rgb(${r}, ${gr}, ${b})`;
      g.fillRect(barX, plotTop + (i * plotH) / rows, barW, plotH / rows + 1);
    }
    g.strokeStyle = colors.border;
    g.lineWidth = 1;
    g.strokeRect(Math.round(barX) + 0.5, Math.round(plotTop) + 0.5, Math.round(barW), Math.round(plotH));
    const scale = linearScale(valueRange[0], valueRange[1], plotTop + plotH, plotTop);
    const ticks = niceTicks(valueRange[0], valueRange[1], Math.min(7, Math.max(2, plotH / (fs * 3))));
    g.fillStyle = colors.textSoft;
    g.font = tickFont;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    let widest = 0;
    const texts = formatTicks(ticks.ticks, ticks.step);
    ticks.ticks.forEach((t, i) => {
      widest = Math.max(widest, g.measureText(texts[i]).width);
      g.fillText(texts[i], barX + barW + fs * 0.35, scale.toPixel(t));
    });
    if (map.label) {
      g.save();
      g.translate(barX + barW + fs * 0.6 + widest, plotTop + plotH / 2);
      g.rotate(-Math.PI / 2);
      g.fillStyle = colors.text;
      g.font = labelFont;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillText(map.label, 0, 0);
      g.restore();
    }
  }

  /**
   * @typedef {{ label: string, color: string, kind: 'line' | 'fill' | 'point', dash: number[], opacity: number, x: number, row: number }} LegendEntry
   */

  /**
   * Coloca la leyenda: una entrada por cada serie, área o banda que tenga `label`,
   * en fila y saltando de línea cuando no caben. La leyenda va ENCIMA de la gráfica
   * para no tapar nunca los datos.
   * @param {number} fs
   * @param {(color: PlotColor | undefined, fallbackIndex: number) => string} resolve
   * @param {number} available anchura disponible
   * @returns {{ entries: LegendEntry[], rows: number, height: number }}
   */
  function layoutLegend(fs, resolve, available) {
    /** @type {LegendEntry[]} */
    const entries = [];
    /** @param {Omit<LegendEntry, 'x' | 'row'>} entry */
    const push = (entry) => entries.push({ ...entry, x: 0, row: 0 });
    (data.series ?? []).forEach((s, i) => {
      if (s.label) push({ label: s.label, color: resolve(s.color, i), kind: s.line === false ? 'point' : 'line', dash: s.dash ?? [], opacity: 1 });
    });
    (data.areas ?? []).forEach((a, i) => {
      if (a.label) push({ label: a.label, color: resolve(a.color, i), kind: 'fill', dash: [], opacity: a.opacity ?? 0.25 });
    });
    (data.bands ?? []).forEach((b, i) => {
      if (b.label) push({ label: b.label, color: resolve(b.color, i + 2), kind: 'fill', dash: [], opacity: b.opacity ?? 0.18 });
    });
    if (entries.length === 0) return { entries, rows: 0, height: 0 };
    let x = 0;
    let row = 0;
    for (const entry of entries) {
      const w = fs * 1.8 + fs * 0.4 + g.measureText(entry.label).width + fs * 1.1;
      if (x > 0 && x + w > available) {
        x = 0;
        row++;
      }
      entry.x = x;
      entry.row = row;
      x += w;
    }
    return { entries, rows: row + 1, height: (row + 1) * fs * 1.3 + fs * 0.2 };
  }

  /**
   * @param {{ entries: LegendEntry[] }} legend
   * @param {number} originX
   * @param {number} originY
   * @param {number} fs
   * @param {string} tickFont
   * @param {import('../core/theme.js').ThemeColors} colors
   */
  function drawLegend(legend, originX, originY, fs, tickFont, colors) {
    const sample = fs * 1.8;
    g.font = tickFont;
    for (const entry of legend.entries) {
      const x = originX + entry.x;
      const cy = originY + fs * 1.3 * (entry.row + 0.5);
      if (entry.kind === 'line') {
        g.strokeStyle = entry.color;
        g.lineWidth = Math.max(1.5, fs * 0.14);
        g.setLineDash(entry.dash.map((d) => (d * fs) / 14));
        g.beginPath();
        g.moveTo(x, cy);
        g.lineTo(x + sample, cy);
        g.stroke();
        g.setLineDash([]);
      } else if (entry.kind === 'point') {
        g.fillStyle = entry.color;
        g.beginPath();
        g.arc(x + sample / 2, cy, fs * 0.3, 0, 2 * Math.PI);
        g.fill();
      } else {
        g.globalAlpha = Math.min(1, entry.opacity + 0.3);
        g.fillStyle = entry.color;
        g.fillRect(x, cy - fs * 0.35, sample, fs * 0.7);
        g.globalAlpha = 1;
      }
      g.fillStyle = colors.text;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(entry.label, x + sample + fs * 0.4, cy);
    }
  }

  // --- Interacción: clic o arrastre → coordenadas de datos ---------------------------------

  /** @param {PointerEvent} event */
  function pick(event) {
    if (!frame || !options.onPick) return;
    const rect = canvas.getBoundingClientRect();
    const px = Math.min(frame.right, Math.max(frame.left, event.clientX - rect.left));
    const py = Math.min(frame.bottom, Math.max(frame.top, event.clientY - rect.top));
    options.onPick(frame.x.toData(px), frame.y.toData(py));
  }
  if (options.onPick) {
    canvas.style.cursor = 'crosshair';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pick(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (canvas.hasPointerCapture(event.pointerId)) pick(event);
    });
  }

  // --- Exportación --------------------------------------------------------------------------

  /** @returns {string} la gráfica como URL de datos PNG */
  function toPNG() {
    render();
    return canvas.toDataURL('image/png');
  }

  function downloadPNG() {
    const link = el('a', { href: toPNG(), download: `${options.exportName ?? 'grafica'}.png` });
    link.click();
  }

  // --- Ciclo de vida --------------------------------------------------------------------------

  const observer = new ResizeObserver(render);
  observer.observe(wrap);
  const offTheme = onThemeChange(render);
  livePlots.add(render);

  return {
    /**
     * Dibuja los datos indicados (sustituyen a los anteriores).
     * @param {PlotData} newData
     */
    draw(newData) {
      data = newData;
      render();
    },
    toPNG,
    downloadPNG,
    /** Elemento canvas, por si una vista necesita medirlo. */
    canvas,
    /** Libera el trazador. Llamar desde destroy() de la vista. */
    destroy() {
      destroyed = true;
      observer.disconnect();
      offTheme();
      livePlots.delete(render);
      wrap.remove();
    },
  };
}

/** @typedef {ReturnType<typeof createPlot>} Plot */
