// @ts-check
// Ondas clásicas y función de onda, vista «rendijas»: doble rendija en 2D con control de
// coherencia entre los dos caminos.
//
//   ┌───────────────────────────────────────┬──────────────────────────────────────┐
//   │ (a) la densidad de probabilidad en el  │ (b) la pantalla: probabilidad que ha │
//   │     plano, vista desde arriba: el      │     llegado a cada punto, frente al  │
//   │     paquete llega por abajo, la pared  │     patrón de Fraunhofer y a la suma │
//   │     con las dos rendijas y la pantalla │     sin interferencia; posiciones    │
//   │     (línea de trazos) arriba           │     d·sen θ = mλ marcadas            │
//   └───────────────────────────────────────┴──────────────────────────────────────┘
//
// Vistas enlazadas: la coherencia γ cambia las dos gráficas al momento, sin repetir la
// simulación (la pantalla guarda por separado lo de cada rama y el término cruzado). Aquí
// no se calcula física: todo sale de physics-slits.js.

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { colormaps } from '../../ui/colormaps.js';
import { formatEs } from '../../ui/format.js';
import {
  EDGE_WIDTH,
  PACKET_Y0,
  SCREEN_Y,
  WALL_THICKNESS,
  WALL_Y,
  accumulateScreen,
  createScreen,
  createSlitExperiment,
  fraunhoferPattern,
  mirrorX,
  mixedDensity,
  screenPattern,
  step2D,
} from './physics-slits.js';
import { END_HOLD_SECONDS, formatSig } from './view-common.js';

/** Pasos como mucho por fotograma: cada uno son dos FFT de 256 × 256 (unos 15 ms). */
const MAX_STEPS_PER_FRAME = 3;
/* Lo simulado en la pantalla se dibuja desde que llega el centro del paquete (o al final):
 * antes solo han llegado las colas más rápidas y, normalizadas a su máximo, su forma engaña
 * (aparenta franjas aunque no haya coherencia). Es un criterio de tiempo y no de cantidad
 * porque con rendijas estrechas y λ larga llega muy poco en total (revisión independiente:
 * con un umbral del 0,5 % la curva no salía nunca). */

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @param {(text: string) => void} setStatus
 * @returns {import('./view-common.js').PartView}
 */
export function mountSlits(container, ctx, setStatus) {
  const grid = createPanelGrid(container, 'fo-grid-slits');
  const planePanel = addPanel(grid, 'El plano visto desde arriba', { area: 'plane' });
  const planePlot = createPlot(planePanel.body, {
    xLabel: 'x (nm), a lo largo de la pared',
    yLabel: 'y (nm), dirección de avance',
    equalAspect: true,
    exportName: 'funcion-onda-rendijas-plano',
  });
  const screenPanel = addPanel(grid, 'La pantalla', { area: 'screen' });
  const screenPlot = createPlot(screenPanel.body, {
    xLabel: 'posición x en la pantalla (nm)',
    yLabel: 'probabilidad por nm (relativa al máximo)',
    yRange: [0, 1.12],
    exportName: 'funcion-onda-rendijas-pantalla',
  });

  /** @type {ReturnType<typeof setup> | null} */
  let sim = null;
  /** @type {import('../types.js').State | null} */
  let lastState = null;
  let statusText = '';

  const physicsKey = (/** @type {import('../types.js').State} */ s) => JSON.stringify([s.slitWavelength, s.slitSeparation, s.slitWidth]);

  /** @param {import('../types.js').State} state */
  function setup(state) {
    const geometry = {
      wavelength: Number(state.slitWavelength),
      separation: Number(state.slitSeparation),
      slitWidth: Number(state.slitWidth),
    };
    const exp = createSlitExperiment(geometry);
    const n = exp.grid.n;
    const reach = exp.grid.half - EDGE_WIDTH;
    // Índices de la zona que se dibuja (dentro de las franjas absorbentes de los bordes).
    const shown = [];
    for (let j = 0; j < n; j++) if (Math.abs(exp.grid.x[j]) < reach) shown.push(j);
    return {
      key: physicsKey(state),
      geometry,
      exp,
      psi: exp.psi,
      t: 0,
      pending: 0,
      screen: createScreen(n),
      // Llegada del centro del paquete a la pantalla en línea recta.
      centerArrival: (SCREEN_Y - PACKET_Y0) / exp.speed,
      shown,
      reach,
    };
  }

  /** Tiempo de reloj que lleva parada en el último instante (ver END_HOLD_SECONDS). */
  let held = 0;

  function restart() {
    if (!lastState) return;
    sim = setup(lastState);
    held = 0;
  }

  /** @param {number} dtSim tiempo de simulación (fs) que toca avanzar */
  function advance(dtSim) {
    if (!sim) return;
    const s = sim;
    s.pending += dtSim;
    const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(s.pending / s.exp.dt));
    if (steps <= 0) return;
    // Si el ordenador no llega, no se acumula retraso: la simulación va más despacio.
    s.pending = Math.min(s.pending - steps * s.exp.dt, s.exp.dt);
    for (let i = 0; i < steps && s.t < s.exp.tMax; i++) {
      s.psi = step2D(s.exp.prop, s.psi);
      accumulateScreen(s.exp, s.screen, s.psi);
      s.t += s.exp.dt;
    }
  }

  /** @param {import('../types.js').State} state */
  function render(state) {
    if (!sim) return;
    const s = sim;
    const { grid: g } = s.exp;
    const gamma = Number(state.coherence);
    const colors = ctx.theme.colors();
    const { wavelength, separation, slitWidth } = s.geometry;

    // --- (a) el plano -------------------------------------------------------------------
    // Delante de la pared, la onda que llega (ψ₁ allí es la incidente: la rendija abierta no
    // cambia lo que aún no ha llegado). Dentro de la pared, cada rendija con su rama: ψ₁ en la
    // de x > 0 y ψ₂ en la de x < 0 (sumarlas ahí daría hasta cuatro veces la densidad real,
    // porque en la cara de entrada las dos ramas valen aún lo mismo que la onda incidente).
    // Detrás, la densidad con coherencia γ entre ramas.
    const psi2 = mirrorX(g, s.psi);
    const mixed = mixedDensity(s.psi, psi2, gamma);
    const front = WALL_Y - WALL_THICKNESS / 2;
    const back = WALL_Y + WALL_THICKNESS / 2;
    const m = s.shown.length;
    const values = new Float64Array(m * m);
    let vmax = 0;
    for (let a = 0; a < m; a++) {
      const iy = s.shown[a];
      const y = g.x[iy];
      for (let b = 0; b < m; b++) {
        const i = iy * g.n + s.shown[b];
        const branch = y < front || g.x[s.shown[b]] >= 0 ? s.psi : psi2;
        const rho = y >= back ? mixed[i] : branch.re[i] ** 2 + branch.im[i] ** 2;
        const v = Math.sqrt(Math.max(rho, 0));
        values[a * m + b] = v;
        if (v > vmax) vmax = v;
      }
    }
    /** @type {[number, number]} */
    const edges = [g.x[s.shown[0]] - g.dx / 2, g.x[s.shown[m - 1]] + g.dx / 2];
    // La pared: tres tramos opacos, con los huecos de las rendijas.
    const gaps = [
      [-separation / 2 - slitWidth / 2, -separation / 2 + slitWidth / 2],
      [separation / 2 - slitWidth / 2, separation / 2 + slitWidth / 2],
    ];
    const pieces = [
      [edges[0], gaps[0][0]],
      [gaps[0][1], gaps[1][0]],
      [gaps[1][1], edges[1]],
    ].filter(([lo, hi]) => hi > lo);
    planePlot.draw({
      heatmap: {
        nx: m,
        ny: m,
        values,
        xRange: edges,
        yRange: edges,
        colormap: colormaps.viridis,
        vmin: 0,
        vmax: vmax > 0 ? vmax : 1,
        label: '√ρ (nm⁻¹), raíz para ver la parte débil',
      },
      areas: pieces.map(([lo, hi], i) => ({
        x: [lo, hi],
        y: [WALL_Y + WALL_THICKNESS / 2, WALL_Y + WALL_THICKNESS / 2],
        y0: WALL_Y - WALL_THICKNESS / 2,
        color: colors.textSoft,
        opacity: 0.9,
        label: i === 0 ? 'pared opaca con dos rendijas' : undefined,
      })),
      hlines: [{ y: SCREEN_Y, dash: [6, 4], color: colors.text, label: 'pantalla' }],
      xRange: edges,
      yRange: edges,
    });
    planePanel.title.textContent =
      `El plano visto desde arriba en t = ${formatEs(s.t, 1)} fs · ` +
      (gamma >= 1 ? 'detrás de la pared, |ψ₁ + ψ₂|²' : gamma <= 0 ? 'detrás de la pared, |ψ₁|² + |ψ₂|² (sin interferencia)' : `detrás de la pared, coherencia γ = ${formatEs(gamma, 2)}`);

    // --- (b) la pantalla ----------------------------------------------------------------
    const xs = s.shown.map((j) => g.x[j]);
    const pattern = screenPattern(s.screen, gamma);
    const incoherent = screenPattern(s.screen, 0);
    let peak = 0;
    for (const j of s.shown) peak = Math.max(peak, pattern[j], incoherent[j]);
    const scale = peak > 0 ? 1 / peak : 0;
    const D = s.exp.distance;
    const thetas = xs.map((x) => Math.atan(x / D));
    // Fraunhofer, por unidad de ángulo; en la pantalla, por unidad de x: × dθ/dx = cos²θ/D.
    const fraun = thetas.map((th) => fraunhoferPattern(Math.sin(th), { ...s.geometry, coherence: gamma }) * Math.cos(th) ** 2);
    const fraunPeak = Math.max(...fraun);
    // Máximos de interferencia previstos: d·sen θ = mλ.
    /** @type {import('../../ui/plot2d.js').Marker[]} */
    const orders = [];
    for (let order = -6; order <= 6; order++) {
      const sinTheta = (order * wavelength) / separation;
      if (Math.abs(sinTheta) >= 1) continue;
      const xm = D * Math.tan(Math.asin(sinTheta));
      if (Math.abs(xm) < s.reach) orders.push({ x: xm, dash: [2, 3], color: colors.textSoft, label: order >= 0 ? `m = ${order}` : undefined });
    }
    const arrived = pattern.reduce((acc, v) => acc + v, 0) * g.dx;
    const enough = s.t >= s.centerArrival || s.t >= s.exp.tMax;
    const nothing = xs.map(() => NaN);
    screenPlot.draw({
      series: [
        { x: xs, y: fraun.map((v) => v / fraunPeak), color: 2, dash: [6, 4], label: `Fraunhofer con γ = ${formatEs(gamma, 2)} (misma escala de pico)` },
        { x: xs, y: enough ? s.shown.map((j) => incoherent[j] * scale) : nothing, color: colors.textSoft, dash: [3, 3], label: '|ψ₁|² + |ψ₂|²: sin interferencia' },
        { x: xs, y: enough ? s.shown.map((j) => pattern[j] * scale) : nothing, color: 0, width: 1.6, label: 'simulación: lo que ha llegado' },
      ],
      vlines: orders,
      xRange: [xs[0], xs[xs.length - 1]],
    });
    screenPanel.title.textContent =
      `La pantalla, a ${formatSig(D, 3)} nm de la pared · líneas de puntos: d·sen θ = mλ` +
      (enough ? '' : ` · la curva simulada sale cuando llegue el centro del paquete (t ≈ ${formatEs(s.centerArrival, 0)} fs)`);

    statusText =
      `t = ${formatEs(s.t, 1)} de ${formatEs(s.exp.tMax, 0)} fs` +
      (s.t >= s.exp.tMax ? ' (final: vuelve a empezar)' : '') +
      ` · λ = ${formatEs(wavelength, 2)} nm (electrón de ${formatEs(s.exp.energy, 2)} eV)` +
      ` · d = ${formatEs(separation, 2)} nm · w = ${formatEs(slitWidth, 3)} nm · primer máximo a θ = ${formatEs((Math.asin(Math.min(1, wavelength / separation)) * 180) / Math.PI, 1)}°` +
      ` · probabilidad que ha llegado a la pantalla: ${formatEs(Math.max(0, 100 * arrived), 1)} %`;
  }

  const offTick = ctx.clock.onTick((time, dt) => {
    if (!sim || !lastState) return;
    if (time === 0 && dt === 0) restart();
    else if (sim.t >= sim.exp.tMax) {
      // Final: se queda un momento con el patrón completo y vuelve a empezar sola.
      held += dt;
      if (held < END_HOLD_SECONDS) return;
      restart();
    } else advance(dt * Number(lastState.rate));
    render(lastState);
    setStatus(statusText);
  });

  return {
    update(state) {
      lastState = state;
      if (!sim || sim.key !== physicsKey(state)) restart();
      render(state);
      setStatus(statusText);
    },
    destroy() {
      offTick();
      planePlot.destroy();
      screenPlot.destroy();
      grid.remove();
    },
  };
}
