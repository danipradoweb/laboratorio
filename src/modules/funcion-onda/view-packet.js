// @ts-check
// Ondas clásicas y función de onda, vista «paquete»: un paquete de ondas que evoluciona
// con la ecuación de Schrödinger, junto a la cuerda clásica que sale de la misma forma.
//
//   ┌──────────────────────────────────────────┬───────────────────────────┐
//   │ (a) ψ(x): relleno del color de su fase,   │ (b) espacio de momentos:  │
//   │     altura |ψ| (o |ψ|²); V(x) detrás,     │     |φ(k)|² con su fase y │
//   │     con su escala de energía a la derecha │     T(E) de ondas planas  │
//   ├──────────────────────────────────────────┼───────────────────────────┤
//   │ (c) la cuerda clásica con la misma forma  │ (d) ⟨x⟩ y ⟨k⟩ = ⟨p⟩/ħ     │
//   │     inicial, y la envolvente |ψ| encima   │     frente a t; Δx·Δp/ħ   │
//   └──────────────────────────────────────────┴───────────────────────────┘
//
// Vistas enlazadas: todas muestran el mismo instante; un clic en (a) coloca el paquete
// (o dibuja el potencial), y un clic en (b) elige su número de onda. Aquí no se calcula
// física: todo sale de physics.js y physics-string.js.

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { createPhaseWheel } from '../../ui/colormaps.js';
import { formatEs } from '../../ui/format.js';
import {
  HBAR_EV_FS,
  absorbingPotential,
  applyGlobalPhase,
  createGrid,
  createPropagator,
  evolve,
  expectationValues,
  gaussianPacket,
  kineticCoefficient,
  meanEnergy,
  momentumWave,
  normOf,
  piecewiseTransmission,
  potentialOnGrid,
  potentialSegments,
  waveNumberFromEnergy,
} from './physics.js';
import { createString, setFromSolution, setReleasedShape, stepString } from './physics-string.js';
import {
  BOUND_POTENTIALS,
  DRAW_COLUMNS,
  DRAW_RANGE,
  DRAW_WIDTH,
  formatSig,
  phaseFillImage,
  potentialSpecFromState,
  visibleIndices,
} from './view-common.js';

/** Malla de la simulación: 2048 puntos en [−80, 80) nm (Δx = 0,078 nm, k_máx = 40 nm⁻¹). */
const DOMAIN = /** @type {[number, number]} */ ([-80, 80]);
const POINTS = 2048;
/** Zona interior que se dibuja con los potenciales abiertos (fuera quedan los absorbentes). */
const INTERIOR = 65;
/** Potencial absorbente: franjas de 15 nm junto a los bordes, hasta 1 eV. */
const ABSORBER = { width: 15, strength: 1 };
/** Paredes del pozo «infinito» y recorte del potencial (eV). El paso partido necesita
 *  V_máx·Δt/ħ ≲ 0,5 (ver PROGRESO.md); por eso el pozo «infinito» tiene paredes de 15 eV,
 *  muy altas frente a las energías del paquete (hasta 3 eV), y el armónico se recorta a
 *  20 eV, muy lejos de donde está la partícula. */
const WALL = 15;
const V_CLIP = 20;
/** Paso de tiempo máximo (fs) y pasos como mucho por fotograma. */
const MAX_DT = 0.02;
const MAX_STEPS_PER_FRAME = 90;
/** Segundos reales que se mantiene el final antes de volver a empezar. */
const HOLD_SECONDS = 1.5;
/** Puntos de la cuerda clásica (Courant 1: exacta). */
const STRING_CELLS = 4096;

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @param {(text: string) => void} setStatus escribe la línea de estado de encima de las vistas
 * @returns {import('./view-common.js').PartView}
 */
export function mountPacket(container, ctx, setStatus) {
  const grid = createPanelGrid(container, 'fo-grid-packet');

  // (a) ψ(x) y el potencial, con la rueda de fase al lado.
  const psiPanel = addPanel(grid, 'ψ(x)', { area: 'psi' });
  const psiPlots = el('div', { class: 'fo-stack' });
  const mainBox = el('div', { class: 'fo-stack-item' });
  const twinBox = el('div', { class: 'fo-stack-item', hidden: true });
  psiPlots.append(mainBox, twinBox);
  const psiBody = el('div', { class: 'fo-with-wheel' }, psiPlots);
  psiPanel.body.append(psiBody);
  const wheel = createPhaseWheel(psiBody, { label: 'tono: fase de ψ · altura: |ψ| (o |ψ|²)' });

  /** Clic en ψ: dibuja el potencial (si es el dibujado) o coloca el paquete. */
  const pickPsi = (/** @type {number} */ x, /** @type {number} */ _y, /** @type {number} */ energy) => {
    const state = ctx.getState();
    if (state.potential === 'dibujado' && Math.abs(x) < DRAW_WIDTH / 2) {
      const column = Math.min(DRAW_COLUMNS - 1, Math.floor(((x + DRAW_WIDTH / 2) / DRAW_WIDTH) * DRAW_COLUMNS));
      const value = Math.min(DRAW_RANGE[1], Math.max(DRAW_RANGE[0], Math.round(energy * 100) / 100));
      ctx.setState({ [`d${column}`]: value });
    } else {
      ctx.setState({ x0: Math.round(x * 10) / 10 });
    }
  };
  const mainPlot = createPlot(mainBox, { xLabel: 'posición x (nm)', exportName: 'funcion-onda-psi', onPick: pickPsi });
  const twinPlot = createPlot(twinBox, { xLabel: 'posición x (nm)', exportName: 'funcion-onda-psi-opuesto' });

  // (b) Espacio de momentos.
  const momPanel = addPanel(grid, 'Espacio de momentos', { area: 'momentum' });
  const momPlot = createPlot(momPanel.body, {
    xLabel: 'número de onda k = p/ħ (nm⁻¹)',
    yLabel: '|φ(k)|² (nm)',
    exportName: 'funcion-onda-momentos',
    onPick: (k) => {
      const mass = Number(ctx.getState().mass);
      const energy = Math.min(3, kineticCoefficient(mass) * k * k);
      ctx.setState({ energy: Math.round(energy * 200) / 200, leftward: k < 0 });
    },
  });

  // (c) La cuerda clásica.
  const stringPanel = addPanel(grid, 'La cuerda clásica', { area: 'string' });
  const stringPlot = createPlot(stringPanel.body, {
    xLabel: 'posición x (nm)',
    yLabel: 'desplazamiento (relativo)',
    yRange: [-1.25, 1.25],
    exportName: 'funcion-onda-cuerda-comparada',
  });

  // (d) Valores esperados e incertidumbre.
  const expPanel = addPanel(grid, 'Valores esperados', { area: 'expect' });
  const expStack = el('div', { class: 'fo-stack' });
  const meanBox = el('div', { class: 'fo-stack-item fo-stack-tall' });
  const uncBox = el('div', { class: 'fo-stack-item' });
  expStack.append(meanBox, uncBox);
  expPanel.body.append(expStack);
  const meanPlot = createPlot(meanBox, { xLabel: 'tiempo t (fs)', yLabel: '⟨x⟩ (nm)', exportName: 'funcion-onda-valores-esperados' });
  const uncPlot = createPlot(uncBox, { xLabel: 'tiempo t (fs)', yLabel: 'Δx·Δp / ħ', exportName: 'funcion-onda-incertidumbre' });

  const simGrid = createGrid(POINTS, DOMAIN[0], DOMAIN[1]);

  /** @type {ReturnType<typeof setup> | null} */
  let sim = null;
  /** @type {import('../types.js').State | null} */
  let lastState = null;
  let holdUntil = -1;

  /** Clave de lo que define la simulación (lo demás solo cambia el dibujo). */
  const physicsKey = (/** @type {import('../types.js').State} */ s) =>
    JSON.stringify([
      s.potential, s.height, s.width, s.separation, s.wellWidth, s.quantum, s.mass,
      s.x0, s.sigma, s.energy, s.leftward, s.twin, s.absorber,
      ...Array.from({ length: DRAW_COLUMNS }, (_, j) => s[`d${j}`]),
    ]);

  /**
   * Prepara la simulación para un estado: potencial, paquete inicial, propagador, cuerda.
   * @param {import('../types.js').State} state
   */
  function setup(state) {
    const mass = Number(state.mass);
    const a = kineticCoefficient(mass);
    const spec = potentialSpecFromState(state, { wall: WALL });
    const potentialType = String(state.potential);
    const bound = BOUND_POTENTIALS.includes(potentialType);
    const rawV = potentialOnGrid(simGrid, spec);
    const V = rawV.map((v) => Math.max(-V_CLIP, Math.min(V_CLIP, v)));
    let maxV = 0;
    for (const v of V) maxV = Math.max(maxV, Math.abs(v));
    const dt = Math.min(MAX_DT, maxV > 0 ? (0.5 * HBAR_EV_FS) / maxV : MAX_DT);
    const absorber = state.absorber ? absorbingPotential(simGrid, ABSORBER) : null;
    const prop = createPropagator(simGrid, V, { dt, mass, absorber });

    const sigma = Number(state.sigma);
    const x0 = Number(state.x0);
    const k0 = waveNumberFromEnergy(Number(state.energy), mass) * (state.leftward ? -1 : 1);
    const psi0 = gaussianPacket(simGrid, { x0, sigma, k0 });
    const twin0 = state.twin ? gaussianPacket(simGrid, { x0, sigma, k0: -k0 }) : null;
    let peak = 0;
    for (let j = 0; j < simGrid.n; j++) peak = Math.max(peak, Math.hypot(psi0.re[j], psi0.im[j]));
    const mom0 = momentumWave(simGrid, psi0);
    let momPeak = 0;
    for (const d of mom0.density) momPeak = Math.max(momPeak, d);

    // Velocidad de grupo ħk₀/m y ritmo de ensanchamiento ħΔk/m (nm/fs).
    const vGroup = (2 * a * Math.abs(k0)) / HBAR_EV_FS;
    const vSpread = (2 * a) / (2 * sigma) / HBAR_EV_FS;

    // Hasta cuándo se simula antes de volver a empezar.
    let tMax;
    if (potentialType === 'armonico') tMax = 2 * ((2 * Math.PI * HBAR_EV_FS) / Number(state.quantum));
    else if (bound) tMax = 150;
    else tMax = (INTERIOR - 8 + Math.abs(x0)) / Math.max(vGroup, vSpread);
    tMax = Math.min(400, Math.max(20, tMax));

    // Zona que se dibuja.
    /** @type {[number, number]} */
    let xView = [-INTERIOR, INTERIOR];
    if (potentialType === 'armonico' || potentialType === 'pozo-infinito') {
      const e = meanEnergy(simGrid, psi0, V, mass).total;
      let reach = Math.abs(x0) + 3 * sigma;
      if (potentialType === 'armonico') {
        const turning = Math.sqrt((4 * a * Math.max(e, 0)) / Number(state.quantum) ** 2);
        reach = Math.max(reach, 1.3 * turning, 3 * Math.sqrt((2 * a) / Number(state.quantum)));
      } else reach = Math.max(reach, 0.75 * Number(state.wellWidth));
      xView = [-reach, reach];
    }

    // Energías que abarca el eje derecho.
    const e0 = meanEnergy(simGrid, psi0, V, mass).total;
    let vTop = 0;
    let vBottom = 0;
    for (let j = 0; j < simGrid.n; j++) {
      if (simGrid.x[j] < xView[0] || simGrid.x[j] > xView[1]) continue;
      vTop = Math.max(vTop, V[j]);
      vBottom = Math.min(vBottom, V[j]);
    }
    const eTop = Math.max(0.2, 1.6 * Math.max(e0, 0), potentialType === 'pozo-infinito' ? 2 * e0 : Math.min(vTop, 3) * 1.15);
    /** @type {[number, number]} */
    const energyRange = [Math.min(vBottom * 1.1, potentialType === 'dibujado' ? DRAW_RANGE[0] : 0), potentialType === 'dibujado' ? Math.max(eTop, DRAW_RANGE[1]) : eTop];

    // Transmisión esperada: promedio de T(E) de ondas planas sobre |φ(k)|² inicial.
    const segments = bound ? null : potentialSegments(spec);
    /** @type {{ k: Float64Array, T: Float64Array } | null} */
    let tCurve = null;
    let expectedT = NaN;
    /** @type {[number, number]} */
    let barrierEdges = [0, 0];
    if (segments && segments.edges.length > 0 && k0 !== 0) {
      barrierEdges = [segments.edges[0], segments.edges[segments.edges.length - 1]];
      let num = 0;
      let den = 0;
      for (let j = 0; j < simGrid.n; j++) {
        const k = mom0.k[j];
        if (Math.sign(k) !== Math.sign(k0)) continue;
        den += mom0.density[j];
        num += mom0.density[j] * piecewiseTransmission(a * k * k, segments, mass).T;
      }
      expectedT = den > 0 ? num / den : NaN;
    }
    // Mayor |⟨k⟩| que puede alcanzar: k₀, o en el armónico la amplitud de la oscilación
    // clásica en momentos, √(k₀² + (mω·x₀/ħ)²) con mω/ħ = ħω/(2·ħ²/2m).
    const kAmp =
      potentialType === 'armonico'
        ? Math.hypot(k0, (x0 * Number(state.quantum)) / (2 * a))
        : Math.abs(k0);
    // Ventana de k que se dibuja: el paquete inicial y su reflejo.
    const kHalf = Math.max(1, kAmp + 5 / (2 * sigma));
    if (segments && segments.edges.length > 0) {
      const ks = Float64Array.from({ length: 401 }, (_, i) => -kHalf + (2 * kHalf * i) / 400);
      const T = ks.map((k) => (k === 0 ? 0 : piecewiseTransmission(a * k * k, segments, mass).T));
      tCurve = { k: ks, T };
    }

    // Cuerda clásica: misma forma inicial que Re ψ (normalizada a 1), que viaja a la
    // velocidad de grupo del paquete; con k₀ = 0 se suelta en reposo.
    const c = Math.max(vGroup, vSpread);
    const string = createString({ length: DOMAIN[1] - DOMAIN[0], cells: STRING_CELLS, speed: c, boundary: 'open' });
    const shape = (/** @type {number} */ x) => Math.exp(-((x - x0) ** 2) / (4 * sigma * sigma)) * Math.cos(k0 * x);
    const offset = DOMAIN[0];
    const dir = Math.sign(k0);
    if (dir === 0) setReleasedShape(string, (x) => shape(x + offset));
    else setFromSolution(string, (x, t) => shape(x + offset - dir * c * t));
    const stringX = string.x.map((x) => x + offset);

    return {
      key: physicsKey(state),
      mass,
      V,
      prop,
      dt,
      psi: psi0,
      twin: twin0,
      t: 0,
      tMax,
      peak,
      momPeak,
      k0,
      x0,
      sigma,
      vGroup,
      xView,
      energyRange,
      tCurve,
      kHalf,
      kAmp,
      expectedT,
      barrierEdges,
      string,
      stringX,
      c,
      potentialType,
      quantum: Number(state.quantum),
      history: { t: /** @type {number[]} */ ([]), x: /** @type {number[]} */ ([]), k: /** @type {number[]} */ ([]), u: /** @type {number[]} */ ([]), xTwin: /** @type {number[]} */ ([]), kTwin: /** @type {number[]} */ ([]) },
      pendingTime: 0,
    };
  }

  /** Guarda los valores esperados del instante actual en la historia. */
  function record() {
    if (!sim) return;
    const ev = expectationValues(simGrid, sim.psi);
    sim.history.t.push(sim.t);
    sim.history.x.push(ev.x);
    sim.history.k.push(ev.k);
    sim.history.u.push(ev.uncertainty);
    if (sim.twin) {
      const tw = expectationValues(simGrid, sim.twin);
      sim.history.xTwin.push(tw.x);
      sim.history.kTwin.push(tw.k);
    }
  }

  /**
   * Avanza la simulación un tiempo de simulación (fs).
   * @param {number} dtSim
   */
  function advance(dtSim) {
    if (!sim) return;
    sim.pendingTime += dtSim;
    const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(sim.pendingTime / sim.dt));
    if (steps <= 0) return;
    sim.pendingTime = Math.min(sim.pendingTime - steps * sim.dt, sim.dt);
    sim.psi = evolve(sim.prop, sim.psi, steps);
    if (sim.twin) sim.twin = evolve(sim.prop, sim.twin, steps);
    sim.t += steps * sim.dt;
    while (sim.string.time < sim.t - sim.string.dt / 2) stepString(sim.string);
    record();
  }

  /**
   * Dibuja todo.
   * @param {import('../types.js').State} state
   */
  function render(state) {
    if (!sim) return;
    const s = sim;
    const phi = (Number(state.globalPhase) * Math.PI) / 180;
    const squared = Boolean(state.density);
    const showRe = !squared && Boolean(state.showRe);
    const showIm = !squared && Boolean(state.showIm);
    const colors = ctx.theme.colors();

    // --- (a) ψ(x) ---------------------------------------------------------------------
    const idx = visibleIndices(simGrid.x, s.xView[0], s.xView[1], 900);
    const xs = idx.map((j) => simGrid.x[j]);
    const step = xs.length > 1 ? xs[1] - xs[0] : simGrid.dx;
    /** @type {[number, number]} */
    const xEdges = [xs[0] - step / 2, xs[xs.length - 1] + step / 2];
    const yTop = 1.15 * (squared ? s.peak * s.peak : s.peak);
    /** @type {[number, number]} */
    const yRange = showRe || showIm ? [-yTop, yTop] : [0, yTop];
    const potentialX = xs;
    const potentialY = idx.map((j) => s.V[j]);
    const ev = expectationValues(simGrid, s.psi);
    const energy = meanEnergy(simGrid, s.psi, s.V, s.mass);
    const yLabel = squared ? '|ψ|² (nm⁻¹)' : 'ψ (1/√nm)';
    const y2 = { range: s.energyRange, label: 'energía (eV)' };

    /**
     * @param {import('./physics.js').Wave} wave
     * @param {ReturnType<typeof createPlot>} plot
     * @param {string} name
     */
    const drawPsi = (wave, plot, name) => {
      const shown = applyGlobalPhase(wave, phi);
      const re = Float64Array.from(idx, (j) => shown.re[j]);
      const im = Float64Array.from(idx, (j) => shown.im[j]);
      const evw = expectationValues(simGrid, wave);
      /** @type {import('../../ui/plot2d.js').Series[]} */
      const series = [
        { x: potentialX, y: potentialY, axis: 'y2', color: colors.textSoft, width: 1.2, label: 'potencial V(x) (eje derecho)' },
      ];
      if (showRe) series.push({ x: xs, y: re, color: 0, label: 'Re ψ' });
      if (showIm) series.push({ x: xs, y: im, color: 1, label: 'Im ψ' });
      plot.draw({
        image: phaseFillImage(re, im, { xRange: xEdges, yRange, squared }),
        series,
        areas: [{ x: potentialX, y: potentialY, y0: s.energyRange[0], axis: 'y2', color: colors.textSoft, opacity: 0.12 }],
        hlines: [{ y: energy.total, axis: 'y2', dash: [6, 4], label: `⟨E⟩ = ${formatEs(energy.total, 3)} eV` }],
        vlines: [{ x: evw.x, dash: [2, 3], label: `⟨x⟩ ${name}` }],
        xRange: xEdges,
        yRange,
        yLabel,
        y2,
      });
    };
    drawPsi(s.psi, mainPlot, '');
    twinBox.hidden = !s.twin;
    if (s.twin) drawPsi(s.twin, twinPlot, '(k₀ opuesto)');
    psiPanel.title.textContent =
      `ψ(x) en t = ${formatEs(s.t, 1)} fs · relleno: altura ${squared ? '|ψ|²' : '|ψ|'}, color = fase` +
      (s.twin ? ' · debajo, el mismo paquete con k₀ cambiado de signo' : '');

    // --- (b) momentos -----------------------------------------------------------------
    const mom = momentumWave(simGrid, applyGlobalPhase(s.psi, phi));
    const kIdx = visibleIndices(mom.k, -s.kHalf, s.kHalf, 700);
    const ks = kIdx.map((j) => mom.k[j]);
    const kStep = ks.length > 1 ? ks[1] - ks[0] : simGrid.dk;
    /** @type {[number, number]} */
    const kEdges = [ks[0] - kStep / 2, ks[ks.length - 1] + kStep / 2];
    /** @type {[number, number]} */
    const momRange = [0, 1.15 * s.momPeak];
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const momSeries = [];
    if (s.tCurve) momSeries.push({ x: s.tCurve.k, y: s.tCurve.T, axis: 'y2', color: 2, label: 'T(E) de una onda plana con ese k (eje derecho)' });
    if (s.twin) {
      const tw = momentumWave(simGrid, s.twin);
      momSeries.push({ x: ks, y: kIdx.map((j) => tw.density[j]), color: colors.textSoft, dash: [5, 4], label: '|φ|² del paquete con k₀ opuesto' });
    }
    momPlot.draw({
      image: phaseFillImage(Float64Array.from(kIdx, (j) => mom.re[j]), Float64Array.from(kIdx, (j) => mom.im[j]), { xRange: kEdges, yRange: momRange, squared: true }),
      series: momSeries,
      vlines: [{ x: ev.k, dash: [2, 3], label: '⟨k⟩' }],
      xRange: kEdges,
      yRange: momRange,
      y2: s.tCurve ? { range: [0, 1.05], label: 'transmisión T' } : undefined,
    });
    momPanel.title.textContent = `Espacio de momentos · ⟨p⟩/ħ = ${formatEs(ev.k, 2)} nm⁻¹ · Δk = ${formatEs(ev.sigmaK, 3)} nm⁻¹`;

    // --- (c) cuerda -------------------------------------------------------------------
    const sIdx = visibleIndices(s.stringX, s.xView[0], s.xView[1], 1200);
    const envelope = idx.map((j) => Math.hypot(s.psi.re[j], s.psi.im[j]) / s.peak);
    stringPlot.draw({
      series: [
        { x: sIdx.map((i) => s.stringX[i]), y: sIdx.map((i) => s.string.u[i]), color: 0, label: 'cuerda: desplazamiento u(x, t)' },
        { x: xs, y: envelope, color: 3, dash: [5, 4], label: '±|ψ(x, t)| del paquete cuántico (misma escala al empezar)' },
        { x: xs, y: envelope.map((v) => -v), color: 3, dash: [5, 4] },
      ],
      xRange: xEdges,
    });
    stringPanel.title.textContent = `La cuerda clásica con la misma forma inicial · c = ${formatSig(s.c, 3)} nm/fs (la velocidad de grupo del paquete), sin potencial`;

    // --- (d) valores esperados --------------------------------------------------------
    const h = s.history;
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const meanSeries = [
      { x: h.t, y: h.x, color: 0, label: '⟨x⟩ (eje izquierdo)' },
      { x: h.t, y: h.k, color: 1, axis: 'y2', label: '⟨p⟩/ħ = ⟨k⟩ (eje derecho)' },
    ];
    if (s.twin) {
      meanSeries.push({ x: h.t, y: h.xTwin, color: 0, dash: [5, 4], label: 'k₀ opuesto' });
      meanSeries.push({ x: h.t, y: h.kTwin, color: 1, dash: [5, 4], axis: 'y2' });
    }
    // Trayectoria clásica (Ehrenfest) donde se conoce en forma cerrada.
    if (s.potentialType === 'libre' || s.potentialType === 'armonico') {
      const ts = Array.from({ length: 121 }, (_, i) => (s.tMax * i) / 120);
      const v0 = (2 * kineticCoefficient(s.mass) * s.k0) / HBAR_EV_FS;
      const omega = s.quantum / HBAR_EV_FS;
      const xc = ts.map((t) => (s.potentialType === 'libre' ? s.x0 + v0 * t : s.x0 * Math.cos(omega * t) + (v0 / omega) * Math.sin(omega * t)));
      meanSeries.push({ x: ts, y: xc, color: colors.textSoft, dash: [2, 3], label: 'partícula clásica' });
    }
    const kSpan = Math.max(s.kAmp, 1 / (2 * s.sigma), ...h.k.map(Math.abs)) * 1.15;
    const xSpan = [Math.min(s.xView[0], ...h.x), Math.max(s.xView[1], ...h.x)];
    meanPlot.draw({
      series: meanSeries,
      vlines: [{ x: s.t, color: colors.textSoft }],
      xRange: [0, s.tMax],
      yRange: /** @type {[number, number]} */ (xSpan),
      y2: { range: [-kSpan, kSpan], label: '⟨k⟩ (nm⁻¹)' },
    });
    const uMax = Math.max(1, ...h.u) * 1.1;
    uncPlot.draw({
      series: [{ x: h.t, y: h.u, color: 4, label: 'Δx·Δp / ħ' }],
      hlines: [{ y: 0.5, dash: [6, 4], label: 'ħ/2: el mínimo' }],
      vlines: [{ x: s.t, color: colors.textSoft }],
      xRange: [0, s.tMax],
      yRange: [0, uMax],
    });
    expPanel.title.textContent = `Valores esperados · ⟨x⟩ = ${formatEs(ev.x, 1)} nm · Δx = ${formatEs(ev.sigmaX, 2)} nm · Δx·Δp/ħ = ${formatEs(ev.uncertainty, 3)}`;

    // --- Línea de estado --------------------------------------------------------------
    const norm = normOf(simGrid, s.psi);
    let transmitted = '';
    if (Number.isFinite(s.expectedT)) {
      let beyond = 0;
      for (let j = 0; j < simGrid.n; j++) {
        const x = simGrid.x[j];
        if (s.k0 > 0 ? x > s.barrierEdges[1] : x < s.barrierEdges[0]) beyond += s.psi.re[j] ** 2 + s.psi.im[j] ** 2;
      }
      transmitted = ` · al otro lado del potencial: ${formatEs(100 * beyond * simGrid.dx, 1)} % (esperado con ondas planas: ${formatEs(100 * s.expectedT, 1)} %)`;
    }
    statusText =
      `t = ${formatEs(s.t, 1)} de ${formatEs(s.tMax, 0)} fs · probabilidad total ${formatEs(norm, 3)}` +
      ` · ⟨E⟩ = ${formatEs(energy.total, 3)} eV (cinética ${formatEs(energy.kinetic, 3)})` +
      transmitted;
  }

  let statusText = '';

  const offTick = ctx.clock.onTick((time, dt) => {
    if (!sim || !lastState) return;
    if (time === 0 && dt === 0) {
      // Botón «Reiniciar» del reloj: vuelta a t = 0.
      holdUntil = -1;
      sim = setup(lastState);
      record();
    } else if (holdUntil >= 0) {
      if (time < holdUntil) return;
      holdUntil = -1;
      sim = setup(lastState);
      record();
    } else {
      advance(dt * Number(lastState.rate));
      if (sim.t >= sim.tMax) holdUntil = time + HOLD_SECONDS * ctx.clock.speed;
    }
    render(lastState);
    setStatus(statusText);
  });

  return {
    update(state) {
      lastState = state;
      if (!sim || sim.key !== physicsKey(state)) {
        sim = setup(state);
        holdUntil = -1;
        record();
      }
      render(state);
      setStatus(statusText);
    },
    destroy() {
      offTick();
      wheel.destroy();
      for (const p of [mainPlot, twinPlot, momPlot, stringPlot, meanPlot, uncPlot]) p.destroy();
      grid.remove();
    },
  };
}
