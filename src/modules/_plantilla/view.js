// @ts-check
// PLANTILLA · view.js — la presentación del módulo.
//
// REGLAS:
//   - Aquí NO se calcula física: se llama a physics.js y se dibuja el resultado.
//   - No se usa `document` fuera de las funciones (el archivo se importa también en
//     Node, en tests/modulos.test.js).
//   - No se crean controles: salen solos de `params` (module.js).
//   - No se llama a requestAnimationFrame: para animar, ctx.clock.onTick().
//   - Todo lo que se crea en mount() se libera en destroy().

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { angularFrequency, displacement, modeShape, nodePositions } from './physics.js';

// Constantes de la vista. En este ejemplo la cuerda mide L = 1 y las ondas viajan a
// c = 1 (unidades arbitrarias): no son parámetros que el usuario cambie.
const LENGTH = 1;
const SPEED = 1;
const SAMPLES = 300;

/**
 * Crea las vistas del módulo dentro de `container`.
 *
 * @param {HTMLElement} container zona de la página reservada al módulo
 * @param {import('../types.js').ModuleContext} ctx servicios del laboratorio:
 *   ctx.getState()      estado actual
 *   ctx.setState({…})   cambia parámetros desde la vista (clic en una gráfica)
 *   ctx.clock           reloj de animación (pausa y velocidad)
 *   ctx.theme           tema actual y sus colores
 *   ctx.presentation    ¿está activo el modo presentación?
 * @returns {import('../types.js').ModuleInstance}
 */
export function mount(container, ctx) {
  // 1) Rejilla de paneles. La clase 'plantilla-grid' fija columnas y filas en
  //    src/ui/styles.css (busca "plantilla-grid").
  const grid = createPanelGrid(container, 'plantilla-grid');

  // 2) Un panel con una gráfica. Las opciones de createPlot están documentadas en
  //    src/ui/plot2d.js (PlotOptions) y lo que se puede dibujar, en PlotData.
  const stringPanel = addPanel(grid, 'La cuerda en el instante actual');
  const stringPlot = createPlot(stringPanel.body, {
    xLabel: 'x / L',
    yLabel: 'y',
    yRange: [-1.1, 1.1], // fijo, para que la gráfica no "respire" al animar
    exportName: 'plantilla-cuerda',
  });

  // 3) Segundo panel: vista enlazada. Un clic en un modo lo selecciona (ctx.setState),
  //    y con ello se actualizan el control, la URL y la otra gráfica.
  const spectrumPanel = addPanel(grid, 'Frecuencias de los modos (clic: elige n)');
  const spectrumPlot = createPlot(spectrumPanel.body, {
    xLabel: 'modo n',
    yLabel: 'ωₙ·L / (π·c)',
    xRange: [0.5, 6.5],
    yRange: [0, 6.6],
    exportName: 'plantilla-frecuencias',
    onPick: (x) => ctx.setState({ n: Math.round(x) }),
  });

  const xs = Float64Array.from({ length: SAMPLES }, (_, i) => (LENGTH * i) / (SAMPLES - 1));
  const modes = [1, 2, 3, 4, 5, 6];

  /** Último estado recibido, para redibujar en cada fotograma de la animación. */
  /** @type {import('../types.js').State | null} */
  let lastState = null;

  /**
   * Dibuja todo para un estado y un instante.
   * @param {import('../types.js').State} state
   * @param {number} time
   */
  function render(state, time) {
    // El estado llega con el tipo de cada parámetro: número, texto o booleano.
    const p = {
      n: Math.round(Number(state.n)), // durante una transición n puede no ser entero
      amplitude: Number(state.amplitude),
      length: LENGTH,
      speed: SPEED,
      ends: /** @type {import('./physics.js').Ends} */ (state.ends),
    };

    const y = xs.map((x) => displacement(x, time, p));
    const top = xs.map((x) => p.amplitude * Math.abs(modeShape(x, p.n, LENGTH, p.ends)));
    stringPlot.draw({
      series: [{ x: xs, y, label: 'y(x, t)' }],
      // Área sombreada: la región que barre la cuerda (envolvente ±A·|f|).
      areas: state.envelope ? [{ x: xs, y: top, y0: top.map((v) => -v), opacity: 0.12, label: 'Envolvente' }] : [],
      // Marcadores verticales en los nodos.
      vlines: nodePositions(p.n, LENGTH, p.ends).map((x) => ({ x, dash: [3, 3] })),
    });

    spectrumPlot.draw({
      // Datos discretos (solo existen los modos enteros): puntos, sin línea que los una.
      series: [
        {
          x: modes,
          y: modes.map((n) => (angularFrequency(n, LENGTH, SPEED) * LENGTH) / (Math.PI * SPEED)),
          label: 'ωₙ',
          points: true,
          line: false,
        },
      ],
      vlines: [{ x: p.n, label: `n = ${p.n}` }],
    });
  }

  // 4) Animación: el reloj avisa en cada fotograma con el tiempo de simulación.
  //    Respeta sola la pausa (espacio) y la velocidad ([ y ]).
  const offTick = ctx.clock.onTick((time) => {
    if (lastState) render(lastState, time);
  });

  return {
    // update se llama al montar, cuando cambia cualquier parámetro, al cambiar el tema
    // y al entrar o salir del modo presentación. Debe redibujarlo todo.
    update(state) {
      lastState = state;
      render(state, ctx.clock.time);
    },
    // destroy libera todo lo creado en mount.
    destroy() {
      offTick();
      stringPlot.destroy();
      spectrumPlot.destroy();
      grid.remove();
    },
  };
}
