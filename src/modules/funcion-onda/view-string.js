// @ts-check
// Ondas clásicas y función de onda, vista «cuerda»: la cuerda clásica sola.
//
//   ┌─────────────────────────────────────────────┬──────────────────────────┐
//   │ la cuerda: desplazamiento u(x, t)            │ frecuencias de los modos │
//   │ (y, con un modo, su envolvente y sus nodos)  │ de la cuerda (∝ n) y de  │
//   │                                              │ la caja cuántica (∝ n²)  │
//   ├─────────────────────────────────────────────┴──────────────────────────┤
//   │ energía de la cuerda frente al tiempo: cinética, potencial y total      │
//   └────────────────────────────────────────────────────────────────────────┘
//
// Unidades propias: posición en fracciones de la longitud (x/L) y tiempo en periodos del
// modo fundamental con extremos fijos, T₁ = 2L/c. La física está en physics-string.js.

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { formatEs } from '../../ui/format.js';
import { createString, modeFrequency, modeShape, setFromSolution, setReleasedShape, stepString, stringEnergy } from './physics-string.js';

/** Cuerda de longitud 1 con c = 1 y 800 intervalos (Courant 1: el esquema es exacto). */
const LENGTH = 1;
const SPEED = 1;
const CELLS = 800;
/** Segundos reales por periodo fundamental (a velocidad 1×). */
const SECONDS_PER_PERIOD = 4;
/** Periodos que abarca la gráfica de la energía. */
const ENERGY_WINDOW = 2;
const PERIOD = (2 * LENGTH) / SPEED;
/** Pulso gaussiano: centro y anchura (en x/L). */
const PULSE_CENTER = 0.3;
const PULSE_WIDTH = 0.04;

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @param {(text: string) => void} setStatus
 * @returns {import('./view-common.js').PartView}
 */
export function mountString(container, ctx, setStatus) {
  const grid = createPanelGrid(container, 'fo-grid-string');
  const stringPanel = addPanel(grid, 'La cuerda', { area: 'string' });
  const stringPlot = createPlot(stringPanel.body, {
    xLabel: 'posición a lo largo de la cuerda, x/L',
    yLabel: 'desplazamiento u (relativo)',
    xRange: [0, 1],
    yRange: [-1.35, 1.35],
    exportName: 'funcion-onda-cuerda',
  });
  const freqPanel = addPanel(grid, 'Misma forma, distinto reloj', { area: 'freq' });
  const freqPlot = createPlot(freqPanel.body, {
    xLabel: 'modo n',
    yLabel: 'frecuencia / la del modo 1',
    xRange: [0.5, 8.5],
    yRange: [0, 68],
    xTicks: [1, 2, 3, 4, 5, 6, 7, 8],
    exportName: 'funcion-onda-frecuencias',
    onPick: (x) => ctx.setState({ mode: Math.min(8, Math.max(1, Math.round(x))) }),
  });
  const energyPanel = addPanel(grid, 'Energía de la cuerda', { area: 'energy' });
  const energyPlot = createPlot(energyPanel.body, {
    xLabel: 'tiempo (periodos del modo fundamental, T₁ = 2L/c)',
    yLabel: 'energía / energía total',
    yRange: [-0.05, 1.15],
    exportName: 'funcion-onda-energia-cuerda',
  });

  const xs = Float64Array.from({ length: CELLS + 1 }, (_, i) => (i * LENGTH) / CELLS);

  /** @type {ReturnType<typeof setup> | null} */
  let sim = null;
  /** @type {import('../types.js').State | null} */
  let lastState = null;

  const physicsKey = (/** @type {import('../types.js').State} */ s) => JSON.stringify([s.boundary, s.shape, s.mode, s.mode2]);

  /** @param {import('../types.js').State} state */
  function setup(state) {
    const boundary = /** @type {'fixed' | 'free'} */ (state.boundary === 'free' ? 'free' : 'fixed');
    const shape = String(state.shape);
    const n = Math.round(Number(state.mode));
    const m = Math.round(Number(state.mode2));
    const s = createString({ length: LENGTH, cells: CELLS, speed: SPEED, boundary });
    const pulse = (/** @type {number} */ x) => Math.exp(-((x - PULSE_CENTER) ** 2) / (2 * PULSE_WIDTH * PULSE_WIDTH));
    if (shape === 'pulso') setReleasedShape(s, pulse);
    else if (shape === 'viajero') setFromSolution(s, (x, t) => pulse(x - SPEED * t));
    else if (shape === 'modo') {
      const w = modeFrequency(n, LENGTH, SPEED);
      setFromSolution(s, (x, t) => modeShape(n, x, LENGTH, boundary) * Math.cos(w * t));
    } else {
      const wn = modeFrequency(n, LENGTH, SPEED);
      const wm = modeFrequency(m, LENGTH, SPEED);
      setFromSolution(s, (x, t) => 0.6 * modeShape(n, x, LENGTH, boundary) * Math.cos(wn * t) + 0.6 * modeShape(m, x, LENGTH, boundary) * Math.cos(wm * t));
    }
    const e0 = stringEnergy(s).total;
    return { key: physicsKey(state), s, boundary, shape, n, m, e0, history: { t: /** @type {number[]} */ ([]), kin: /** @type {number[]} */ ([]), pot: /** @type {number[]} */ ([]), tot: /** @type {number[]} */ ([]) }, pending: 0 };
  }

  function record() {
    if (!sim) return;
    const e = stringEnergy(sim.s);
    const h = sim.history;
    h.t.push(sim.s.time / PERIOD);
    h.kin.push(e.kinetic / sim.e0);
    h.pot.push(e.potential / sim.e0);
    h.tot.push(e.total / sim.e0);
    // Solo se guarda la ventana que se dibuja.
    while (h.t.length > 2 && h.t[h.t.length - 1] - h.t[0] > ENERGY_WINDOW * 1.05) {
      h.t.shift();
      h.kin.shift();
      h.pot.shift();
      h.tot.shift();
    }
  }

  /** @param {import('../types.js').State} _state */
  function render(_state) {
    if (!sim) return;
    const sm = sim;
    const colors = ctx.theme.colors();
    const tPeriods = sm.s.time / PERIOD;

    // --- La cuerda ------------------------------------------------------------------------
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const series = [];
    /** @type {import('../../ui/plot2d.js').Marker[]} */
    const vlines = [];
    if (sm.shape === 'modo') {
      const env = Array.from(xs, (x) => Math.abs(modeShape(sm.n, x, LENGTH, sm.boundary)));
      series.push({ x: xs, y: env, color: 3, dash: [5, 4], label: `±envolvente del modo ${sm.n}: la misma función que el estado ${sm.n} de una caja cuántica` });
      series.push({ x: xs, y: env.map((v) => -v), color: 3, dash: [5, 4] });
      for (let j = 0; j <= sm.n; j++) {
        const xNode = sm.boundary === 'fixed' ? j / sm.n : (j + 0.5) / sm.n;
        if (xNode > 0 && xNode < 1) vlines.push({ x: xNode, dash: [2, 3], color: colors.textSoft });
      }
    } else if (sm.shape === 'dos-modos') {
      const wn = modeFrequency(sm.n, LENGTH, SPEED);
      const wm = modeFrequency(sm.m, LENGTH, SPEED);
      series.push({ x: xs, y: Array.from(xs, (x) => 0.6 * modeShape(sm.n, x, LENGTH, sm.boundary) * Math.cos(wn * sm.s.time)), color: 2, width: 0.8, dash: [4, 3], label: `modo ${sm.n}` });
      series.push({ x: xs, y: Array.from(xs, (x) => 0.6 * modeShape(sm.m, x, LENGTH, sm.boundary) * Math.cos(wm * sm.s.time)), color: 4, width: 0.8, dash: [4, 3], label: `modo ${sm.m}` });
    }
    series.push({ x: xs, y: sm.s.u, color: 0, width: 1.3, label: sm.shape === 'dos-modos' ? 'cuerda = suma de los dos modos' : 'cuerda u(x, t)' });
    stringPlot.draw({ series, vlines });
    const ends = sm.boundary === 'fixed' ? 'extremos fijos' : 'extremos libres';
    const what = {
      pulso: 'un pulso soltado en reposo se parte en dos que viajan sin deformarse',
      viajero: 'un pulso que viaja sin deformarse y se refleja en los extremos',
      modo: `modo ${sm.n}: onda estacionaria con ${sm.boundary === 'fixed' ? sm.n - 1 : sm.n} nodos en el interior`,
      'dos-modos': `superposición de los modos ${sm.n} y ${sm.m}: la forma cambia porque cada modo oscila a su frecuencia`,
    }[sm.shape] ?? '';
    stringPanel.title.textContent = `La cuerda (${ends}) · ${what}`;

    // --- Frecuencias ------------------------------------------------------------------------
    const ns = [1, 2, 3, 4, 5, 6, 7, 8];
    const marks = sm.shape === 'modo' ? [sm.n] : sm.shape === 'dos-modos' ? [sm.n, sm.m] : [];
    freqPlot.draw({
      series: [
        { x: ns, y: ns, color: 0, points: true, label: 'cuerda: ωₙ = nπc/L (∝ n)' },
        { x: ns, y: ns.map((n) => n * n), color: 1, points: true, label: 'partícula en una caja: Eₙ/ħ (∝ n²)' },
      ],
      vlines: marks.map((n) => ({ x: n, dash: [3, 3], label: `n = ${n}` })),
    });

    // --- Energía ------------------------------------------------------------------------------
    const h = sm.history;
    const t0 = Math.max(0, tPeriods - ENERGY_WINDOW);
    energyPlot.draw({
      series: [
        { x: h.t, y: h.kin, color: 0, label: 'cinética (movimiento)' },
        { x: h.t, y: h.pot, color: 1, label: 'potencial (estiramiento)' },
        { x: h.t, y: h.tot, color: colors.text, width: 1.4, label: 'total' },
      ],
      xRange: [t0, t0 + ENERGY_WINDOW],
    });
    const drift = Math.max(0, ...h.tot.map((v) => Math.abs(v - 1)));
    energyPanel.title.textContent = `Energía de la cuerda · la total se conserva (variación relativa ${drift < 1e-12 ? '< 10⁻¹²' : formatEs(drift, 12)})`;

    setStatus(`t = ${formatEs(tPeriods, 2)} periodos del modo fundamental (T₁ = 2L/c) · ${ends} · ω₁ = πc/L`);
  }

  const offTick = ctx.clock.onTick((time, dt) => {
    if (!sim || !lastState) return;
    if (time === 0 && dt === 0) {
      // Botón «Reiniciar» del reloj.
      sim = setup(lastState);
      record();
    }
    sim.pending += (dt * PERIOD) / SECONDS_PER_PERIOD;
    const steps = Math.min(400, Math.floor(sim.pending / sim.s.dt));
    if (steps > 0) {
      sim.pending -= steps * sim.s.dt;
      stepString(sim.s, steps);
      record();
    }
    render(lastState);
  });

  return {
    update(state) {
      lastState = state;
      if (!sim || sim.key !== physicsKey(state)) {
        sim = setup(state);
        record();
      }
      render(state);
    },
    destroy() {
      offTick();
      for (const p of [stringPlot, freqPlot, energyPlot]) p.destroy();
      grid.remove();
    },
  };
}
