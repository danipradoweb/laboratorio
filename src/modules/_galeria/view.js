// @ts-check
// Vista de la galería de componentes. Cada panel ejercita un servicio común.

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { createView3D } from '../../ui/view3d.js';
import { gaussianPacket, sampleGrid } from './physics.js';

/** Semianchura de la región dibujada y resolución de las mallas. */
const HALF = 4;
const GRID = 96;
const SAMPLES = 400;

/**
 * Mapa de grises provisional (los mapas de color de verdad llegan con colormaps.js).
 * @param {number} t
 * @returns {[number, number, number]}
 */
function gray(t) {
  const v = Math.round(255 * t);
  return [v, v, v];
}

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

  // 3) Visor 3D: la altura es |ψ|. createView3D es asíncrona (carga three.js).
  const view3dPanel = addPanel(grid, 'Visor 3D: superficie |ψ(x, y)| (arrastra para girar)');
  const view3d = await createView3D(view3dPanel.body, { axisLabels: { z: '|ψ|' }, axisLength: 1.2 });
  const surface = view3d?.addSurface({ nx: GRID, ny: GRID, xRange: [-1, 1], yRange: [-1, 1] });
  const heights = new Float32Array(GRID * GRID);
  const surfaceColors = new Uint8ClampedArray(GRID * GRID * 3);

  // 4) Estado actual, como texto.
  const statePanel = addPanel(grid, 'Estado');
  const readout = el('pre', { class: 'galeria-readout' });
  statePanel.body.append(readout);

  const xs = Float64Array.from({ length: SAMPLES }, (_, i) => -HALF + (2 * HALF * i) / (SAMPLES - 1));

  return {
    update(state) {
      const p = { sigma: Number(state.sigma), k: Number(state.k) };
      const re = xs.map((x) => gaussianPacket(x, 0, p).re);
      const im = xs.map((x) => gaussianPacket(x, 0, p).im);
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
      mapPlot.draw({
        heatmap: {
          nx: GRID,
          ny: GRID,
          values: field.re,
          xRange: [-HALF, HALF],
          yRange: [-HALF, HALF],
          colormap: gray,
          symmetric: true,
          label: 'Re ψ',
        },
      });

      for (let i = 0; i < GRID * GRID; i++) {
        heights[i] = Math.hypot(field.re[i], field.im[i]);
        const [r, g, b] = gray(0.25 + 0.75 * heights[i]);
        surfaceColors[3 * i] = r;
        surfaceColors[3 * i + 1] = g;
        surfaceColors[3 * i + 2] = b;
      }
      surface?.update(heights, surfaceColors);

      readout.textContent = JSON.stringify(state, null, 2);
    },
    destroy() {
      linePlot.destroy();
      mapPlot.destroy();
      view3d?.destroy();
      grid.remove();
    },
  };
}
