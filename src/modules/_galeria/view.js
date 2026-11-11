// @ts-check
// Vista de la galería de componentes. Cada panel ejercita un servicio común.

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { createView3D } from '../../ui/view3d.js';
import { colorizeComplex, createPhaseWheel, getColormap, phaseColor, themeBackground } from '../../ui/colormaps.js';
import { gaussianPacket, sampleGrid } from './physics.js';

/** Semianchura de la región dibujada y resolución de las mallas. */
const HALF = 4;
const GRID = 96;
const SAMPLES = 400;

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {Promise<import('../types.js').ModuleInstance>}
 */
export async function mount(container, ctx) {
  const grid = createPanelGrid(container, 'galeria-grid');

  // 1) Series, áreas, bandas y marcadores. Un clic fija σ = |x| (vistas enlazadas).
  const linePanel = addPanel(grid, 'Trazador 2D: series, áreas y marcadores (clic: fija σ)');
  const linePlot = createPlot(linePanel.body, {
    xLabel: 'x',
    yLabel: 'ψ(x, 0)',
    yRange: [-1.15, 1.15],
    exportName: 'galeria-series',
    onPick: (x) => ctx.setState({ sigma: Math.abs(x) }),
  });

  // 2) Mapa de color con barra de color.
  const mapPanel = addPanel(grid, 'Trazador 2D: mapa de color de Re ψ');
  const mapPlot = createPlot(mapPanel.body, {
    xLabel: 'x',
    yLabel: 'y',
    equalAspect: true,
    exportName: 'galeria-mapa',
  });

  // 3) Coloreado de fase: tono = arg ψ, brillo = |ψ|, con la rueda de fase como leyenda.
  const phasePanel = addPanel(grid, 'Coloreado de fase de ψ(x, y)');
  phasePanel.body.classList.add('galeria-fase');
  const phasePlotBox = el('div', { class: 'galeria-fase-plot' });
  phasePanel.body.append(phasePlotBox);
  const phasePlot = createPlot(phasePlotBox, { xLabel: 'x', yLabel: 'y', equalAspect: true, exportName: 'galeria-fase' });
  const wheel = createPhaseWheel(phasePanel.body);

  // 4) Visor 3D: la altura es |ψ| y el tono la fase. createView3D es asíncrona (carga three.js).
  const view3dPanel = addPanel(grid, 'Visor 3D: altura |ψ|, tono arg ψ (arrastra para girar)', { area: 'tres-d' });
  const view3d = await createView3D(view3dPanel.body, { axisLabels: { z: '|ψ|' }, axisLength: 1.2 });
  const surface = view3d?.addSurface({ nx: GRID, ny: GRID, xRange: [-1, 1], yRange: [-1, 1] });
  const heights = new Float32Array(GRID * GRID);
  const surfaceColors = new Uint8ClampedArray(GRID * GRID * 3);

  // 5) Estado actual, como texto.
  const statePanel = addPanel(grid, 'Estado');
  const readout = el('pre', { class: 'galeria-readout' });
  statePanel.body.append(readout);

  const xs = Float64Array.from({ length: SAMPLES }, (_, i) => -HALF + (2 * HALF * i) / (SAMPLES - 1));

  /** Último estado recibido, para redibujar en cada fotograma de la animación. */
  /** @type {import('../types.js').State | null} */
  let lastState = null;
  // Reloj de animación: con "Girar la fase global", ψ se multiplica por e^(−it).
  const offTick = ctx.clock.onTick(() => {
    if (lastState?.rotar) render(lastState);
  });

  /** @param {import('../types.js').State} state */
  function render(state) {
      const p = { sigma: Number(state.sigma), k: Number(state.k) };
      // Fase global: giro de ángulo −t (solo si está activado).
      const theta = state.rotar ? -ctx.clock.time : 0;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const re = xs.map((x) => {
        const z = gaussianPacket(x, 0, p);
        return z.re * cos - z.im * sin;
      });
      const im = xs.map((x) => {
        const z = gaussianPacket(x, 0, p);
        return z.re * sin + z.im * cos;
      });
      const envelope = xs.map((x) => Math.exp(-(x * x) / (2 * p.sigma * p.sigma)));
      const markers = Boolean(state.markers);
      linePlot.draw({
        series: [
          { x: xs, y: re, label: 'Re ψ' },
          { x: xs, y: im, label: 'Im ψ' },
          { x: xs, y: envelope, label: '|ψ|', color: 2, dash: [6, 4] },
        ],
        areas: markers ? [{ x: xs, y: envelope, y0: envelope.map((v) => -v), color: 2, opacity: 0.12, label: 'Envolvente ±|ψ|' }] : [],
        bands: markers ? [{ x1: -p.sigma, x2: p.sigma, color: 4, label: '|x| < σ' }] : [],
        vlines: markers ? [{ x: p.sigma, label: `σ = ${p.sigma.toFixed(2)}` }] : [],
        hlines: markers ? [{ y: Math.exp(-0.5), label: 'e^(−1/2)', dash: [3, 3] }] : [],
      });

      const field = sampleGrid(p, GRID, GRID, HALF);
      for (let i = 0; i < field.re.length; i++) {
        const a = field.re[i];
        const b = field.im[i];
        field.re[i] = a * cos - b * sin;
        field.im[i] = a * sin + b * cos;
      }
      mapPlot.draw({
        heatmap: {
          nx: GRID,
          ny: GRID,
          values: field.re,
          xRange: [-HALF, HALF],
          yRange: [-HALF, HALF],
          colormap: getColormap(String(state.colormap)),
          symmetric: true,
          label: 'Re ψ',
        },
      });

      const background = themeBackground();
      phasePlot.draw({
        image: {
          nx: GRID,
          ny: GRID,
          rgba: colorizeComplex(field.re, field.im, { maxAbs: 1, background }),
          xRange: [-HALF, HALF],
          yRange: [-HALF, HALF],
        },
      });

      for (let i = 0; i < GRID * GRID; i++) {
        heights[i] = Math.hypot(field.re[i], field.im[i]);
        // En 3D el módulo ya se ve en la altura: se deja un brillo mínimo para que la
        // parte plana de la superficie no desaparezca contra el fondo.
        const [r, g, b] = phaseColor(Math.atan2(field.im[i], field.re[i]), 0.35 + 0.65 * heights[i], background);
        surfaceColors[3 * i] = r;
        surfaceColors[3 * i + 1] = g;
        surfaceColors[3 * i + 2] = b;
      }
      surface?.update(heights, surfaceColors);

      readout.textContent = JSON.stringify(state, null, 2);
  }

  return {
    update(state) {
      lastState = state;
      render(state);
    },
    destroy() {
      offTick();
      linePlot.destroy();
      mapPlot.destroy();
      phasePlot.destroy();
      wheel.destroy();
      view3d?.destroy();
      grid.remove();
    },
  };
}
