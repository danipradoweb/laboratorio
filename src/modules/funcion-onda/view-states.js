// @ts-check
// Ondas clásicas y función de onda, vista «estados»: estados propios de un potencial y la
// superposición de dos de ellos.
//
//   ┌──────────────────────────────────────┬──────────────────────────────────┐
//   │ niveles: V(x), las energías E_n y    │ ψ(x, t) de la superposición:     │
//   │ cada φ_n dibujada en su nivel        │ relleno del color de su fase     │
//   │ (clic en un nivel: segundo estado)   │                                  │
//   ├──────────────────────────────────────┼──────────────────────────────────┤
//   │ el puente con la luz: ⟨x⟩(t) oscila  │ los dos coeficientes como flechas│
//   │ a (E₂ − E₁)/ħ; fotón de esa energía  │ en el plano complejo             │
//   └──────────────────────────────────────┴──────────────────────────────────┘
//
// Los estados salen de diagonalizar el hamiltoniano tridiagonal (physics-states.js) en una
// caja que contiene el potencial; la evolución es exacta: cada término gira a su ritmo.

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { createPhaseWheel } from '../../ui/colormaps.js';
import { formatEs } from '../../ui/format.js';
import { HBAR_EV_FS, applyGlobalPhase, kineticCoefficient, potentialAt } from './physics.js';
import {
  eigenstates,
  positionMatrixElement,
  superpose,
  transition,
  twoStateCoefficients,
  twoStateMeanPosition,
} from './physics-states.js';
import { DRAW_COLUMNS, DRAW_RANGE, DRAW_WIDTH, formatSig, phaseFillImage, potentialSpecFromState, spectralRegion } from './view-common.js';

/** Número de estados que se calculan y se pueden elegir. */
const COUNT = 8;
/** Nodos de la malla de la caja. */
const NODES = 1000;
/** Segundos reales por periodo de la oscilación (a velocidad 1×). */
const SECONDS_PER_PERIOD = 4;

/**
 * Caja (intervalo con paredes infinitas) donde se calculan los estados de cada potencial.
 * @param {import('./physics.js').PotentialSpec} spec
 * @returns {[number, number]}
 */
function boxFor(spec) {
  const a = kineticCoefficient(spec.mass ?? 1);
  const w = spec.width ?? 1;
  switch (spec.type) {
    case 'pozo-infinito':
      return [-w / 2, w / 2];
    case 'pozo-finito': {
      // Ocho longitudes de decaimiento √(ħ²/2mV₀) fuera del pozo, como poco 2 nm.
      const decay = Math.sqrt(a / Math.max(spec.height ?? 0.01, 0.01));
      const margin = Math.max(2, 8 * decay);
      return [-w / 2 - margin, w / 2 + margin];
    }
    case 'armonico': {
      // ±9 longitudes del oscilador √(ħ/mω): el estado 8 llega hasta √17 ≈ 4,1.
      const length = Math.sqrt((2 * a) / (spec.quantum ?? 0.1));
      return [-9 * length, 9 * length];
    }
    default:
      return [-DRAW_WIDTH / 2, DRAW_WIDTH / 2];
  }
}

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @param {(text: string) => void} setStatus
 * @param {import('../../color/spectrum.js').ColorEngine} color
 * @returns {import('./view-common.js').PartView}
 */
export function mountStates(container, ctx, setStatus, color) {
  const grid = createPanelGrid(container, 'fo-grid-states');

  const levelsPanel = addPanel(grid, 'Niveles de energía', { area: 'levels' });
  const levelsPlot = createPlot(levelsPanel.body, {
    xLabel: 'posición x (nm)',
    yLabel: 'energía (eV)',
    exportName: 'funcion-onda-niveles',
    onPick: (x, energy) => {
      const state = ctx.getState();
      if (state.potential === 'dibujado' && Math.abs(x) < DRAW_WIDTH / 2 && pickDraws) {
        const column = Math.min(DRAW_COLUMNS - 1, Math.floor(((x + DRAW_WIDTH / 2) / DRAW_WIDTH) * DRAW_COLUMNS));
        const value = Math.min(DRAW_RANGE[1], Math.max(DRAW_RANGE[0], Math.round(energy * 100) / 100));
        ctx.setState({ [`d${column}`]: value });
        return;
      }
      if (!sim) return;
      // El nivel más cercano a la energía del clic pasa a ser el segundo estado.
      let best = 0;
      for (let n = 1; n < COUNT; n++) {
        if (Math.abs(sim.energies[n] - energy) < Math.abs(sim.energies[best] - energy)) best = n;
      }
      ctx.setState({ n2: best + 1 });
    },
  });
  /** Con el potencial dibujado, un clic por debajo del nivel 1 dibuja; por encima elige nivel. */
  let pickDraws = false;

  const psiPanel = addPanel(grid, 'ψ(x, t)', { area: 'psi' });
  const psiBox = el('div', { class: 'fo-stack' });
  const psiItem = el('div', { class: 'fo-stack-item' });
  psiBox.append(psiItem);
  const psiBody = el('div', { class: 'fo-with-wheel' }, psiBox);
  psiPanel.body.append(psiBody);
  const psiPlot = createPlot(psiItem, { xLabel: 'posición x (nm)', exportName: 'funcion-onda-superposicion' });
  const wheel = createPhaseWheel(psiBody, { label: 'tono: fase de ψ · altura: |ψ| (o |ψ|²)' });

  const bridgePanel = addPanel(grid, 'El puente con la luz', { area: 'bridge' });
  const swatch = el('span', { class: 'fo-swatch', 'aria-hidden': 'true' });
  const bridgeTitle = el('span');
  bridgePanel.title.replaceChildren(bridgeTitle, swatch);
  const bridgePlot = createPlot(bridgePanel.body, { xLabel: 'tiempo t (fs)', yLabel: '⟨x⟩ (nm)', exportName: 'funcion-onda-dipolo' });

  const phasorPanel = addPanel(grid, 'Los coeficientes en el plano complejo', { area: 'phasors' });
  const phasorPlot = createPlot(phasorPanel.body, {
    xLabel: 'parte real',
    yLabel: 'parte imaginaria',
    xRange: [-1.15, 1.15],
    yRange: [-1.15, 1.15],
    xTicks: [-1, 0, 1],
    yTicks: [-1, 0, 1],
    equalAspect: true,
    exportName: 'funcion-onda-coeficientes',
  });

  /** @type {ReturnType<typeof setup> | null} */
  let sim = null;
  /** @type {import('../types.js').State | null} */
  let lastState = null;
  /** Tiempo de simulación (fs). */
  let t = 0;

  const physicsKey = (/** @type {import('../types.js').State} */ s) =>
    JSON.stringify([
      s.potential, s.height, s.width, s.separation, s.wellWidth, s.quantum, s.mass,
      ...Array.from({ length: DRAW_COLUMNS }, (_, j) => s[`d${j}`]),
    ]);

  /** @param {import('../types.js').State} state */
  function setup(state) {
    const mass = Number(state.mass);
    const spec = potentialSpecFromState(state);
    const [x0, x1] = boxFor(spec);
    const x = Float64Array.from({ length: NODES }, (_, i) => x0 + ((i + 1) * (x1 - x0)) / (NODES + 1));
    const V = spec.type === 'pozo-infinito' ? new Float64Array(NODES) : x.map((xi) => potentialAt(spec, xi));
    const { energies, states, dx } = eigenstates(x, V, { count: COUNT, mass });
    // Elementos de matriz de la posición entre todos los pares (para ⟨x⟩(t)).
    const xm = states.map((a) => states.map((b) => positionMatrixElement(x, a, b, dx)));
    let peak = 0;
    for (const phi of states) for (const v of phi) peak = Math.max(peak, Math.abs(v));
    return { key: physicsKey(state), x, V, energies, states, dx, xm, box: /** @type {[number, number]} */ ([x0, x1]), peak, spec };
  }

  /** @param {import('../types.js').State} state */
  function render(state) {
    if (!sim) return;
    const s = sim;
    const colors = ctx.theme.colors();
    const a = Math.min(COUNT, Math.max(1, Math.round(Number(state.n1)))) - 1;
    const b = Math.min(COUNT, Math.max(1, Math.round(Number(state.n2)))) - 1;
    const weight = Number(state.weight);
    const theta = (Number(state.relPhase) * Math.PI) / 180;
    const phi = (Number(state.globalPhase) * Math.PI) / 180;
    const coefs = twoStateCoefficients(COUNT, a, b, weight, theta);
    const squared = Boolean(state.density);
    const showRe = !squared && Boolean(state.showRe);
    const showIm = !squared && Boolean(state.showIm);
    const box = s.box;
    const span = box[1] - box[0];
    /** @type {[number, number]} */
    const xRange = s.spec.type === 'pozo-infinito' ? [box[0] - 0.08 * span, box[1] + 0.08 * span] : box;

    // --- Niveles --------------------------------------------------------------------------
    const eMin = Math.min(...s.V, s.energies[0]);
    // Se dibujan los niveles hasta dos por encima del más alto elegido (como poco, cuatro):
    // en el pozo infinito las energías crecen como n² y los bajos quedarían aplastados.
    const shownLevels = Math.min(COUNT, Math.max(4, Math.max(a, b) + 3));
    const eMax = s.energies[shownLevels - 1];
    const spacing = Math.max(1e-6, Math.min(...Array.from({ length: shownLevels - 1 }, (_, n) => s.energies[n + 1] - s.energies[n])));
    const amplitude = (0.42 * spacing) / s.peak;
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const levelSeries = [];
    const vx = s.spec.type === 'pozo-infinito' ? [box[0], box[0], box[1], box[1]] : Array.from(s.x);
    const top = eMax + 1.2 * spacing;
    const vy = s.spec.type === 'pozo-infinito' ? [top * 2, 0, 0, top * 2] : Array.from(s.V);
    levelSeries.push({ x: vx, y: vy, color: colors.textSoft, width: 1.4, label: 'potencial V(x)' });
    for (let n = 0; n < shownLevels; n++) {
      const selected = (n === a || n === b) && !(n === b && weight === 0) && !(n === a && weight === 1 && a !== b);
      const c = n === a ? 0 : n === b ? 1 : colors.textSoft;
      levelSeries.push({ x: [box[0], box[1]], y: [s.energies[n], s.energies[n]], color: selected ? c : colors.grid, width: selected ? 1.2 : 0.8, dash: selected ? [] : [3, 3] });
      levelSeries.push({
        x: s.x,
        y: s.states[n].map((v) => s.energies[n] + amplitude * v),
        color: selected ? c : colors.textSoft,
        width: selected ? 1.3 : 0.7,
        label: n === a ? `φ${a + 1} (primer estado)` : n === b && a !== b ? `φ${b + 1} (segundo estado)` : undefined,
      });
    }
    pickDraws = false;
    if (state.potential === 'dibujado') pickDraws = true;
    levelsPlot.draw({
      series: levelSeries,
      xRange,
      yRange: [Math.min(eMin, s.spec.type === 'dibujado' ? DRAW_RANGE[0] : eMin) - 0.3 * spacing, top],
    });
    levelsPanel.title.textContent =
      `Niveles de energía y estados propios φₙ (cada uno dibujado a la altura de su energía)` +
      (['libre', 'escalon', 'barrera', 'doble-barrera', 'dibujado'].includes(s.spec.type) ? ` · en una caja de ${formatEs(span, 0)} nm` : '') +
      ` · clic en un nivel: segundo estado`;

    // --- ψ(x, t) ----------------------------------------------------------------------------
    const psi = applyGlobalPhase(superpose(s.states, s.energies, coefs, t), phi);
    const ca = coefs[a];
    const cb = coefs[b];
    const maxAbs = Math.hypot(ca.re, ca.im) * Math.max(...s.states[a].map(Math.abs)) + (a !== b ? Math.hypot(cb.re, cb.im) * Math.max(...s.states[b].map(Math.abs)) : 0);
    const yTop = 1.1 * (squared ? maxAbs * maxAbs : maxAbs);
    /** @type {[number, number]} */
    const yRange = showRe || showIm ? [-yTop, yTop] : [0, yTop];
    const step = s.x[1] - s.x[0];
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const psiSeries = [];
    if (showRe) psiSeries.push({ x: s.x, y: psi.re, color: 0, label: 'Re ψ' });
    if (showIm) psiSeries.push({ x: s.x, y: psi.im, color: 1, label: 'Im ψ' });
    psiPlot.draw({
      image: phaseFillImage(psi.re, psi.im, { xRange: [s.x[0] - step / 2, s.x[NODES - 1] + step / 2], yRange, squared }),
      series: psiSeries,
      vlines: s.spec.type === 'pozo-infinito' ? [{ x: box[0], color: colors.textSoft }, { x: box[1], color: colors.textSoft }] : [],
      xRange,
      yRange,
      yLabel: squared ? '|ψ|² (nm⁻¹)' : 'ψ (1/√nm)',
    });
    const pa = ca.re * ca.re + ca.im * ca.im;
    const pb = a === b ? 0 : cb.re * cb.re + cb.im * cb.im;
    psiPanel.title.textContent =
      a === b || pb === 0 || pa === 0
        ? `ψ(x, t) = un solo estado propio, φ${pb === 0 || a === b ? a + 1 : b + 1}: solo gira su fase, |ψ|² no cambia · t = ${formatEs(t, 2)} fs`
        : `ψ = ${formatEs(Math.sqrt(pa), 2)}·φ${a + 1} + ${formatEs(Math.sqrt(pb), 2)}·e^(i·${Math.round((theta * 180) / Math.PI)}°)·φ${b + 1}, cada término girando a su ritmo · t = ${formatEs(t, 2)} fs`;

    // --- Puente con la luz --------------------------------------------------------------------
    const tr = transition(s.energies[a], s.energies[b]);
    const period = a === b || pa === 0 || pb === 0 ? NaN : tr.period;
    const elements = { xaa: s.xm[a][a], xbb: s.xm[b][b], xab: s.xm[a][b] };
    const omega = s.energies[b] >= s.energies[a] ? tr.omega : -tr.omega;
    const window = Number.isFinite(period) ? 3 * period : 10;
    const ts = Array.from({ length: 301 }, (_, i) => (window * i) / 300);
    const xMean = ts.map((tt) => (a === b ? s.xm[a][a] : twoStateMeanPosition(elements, ca, cb, omega, tt)));
    const amplitudeX = a === b ? 0 : 2 * Math.sqrt(pa * pb) * Math.abs(elements.xab);
    const xMid = a === b ? s.xm[a][a] : pa * elements.xaa + pb * elements.xbb;
    const ySpan = Math.max(0.05 * span, 1.3 * amplitudeX);
    bridgePlot.draw({
      series: [{ x: ts, y: xMean, color: 0, label: '⟨x⟩(t): la carga oscila como un dipolo' }],
      vlines: [{ x: t % window, color: colors.textSoft }],
      hlines: [{ y: xMid, dash: [4, 4], color: colors.textSoft }],
      xRange: [0, window],
      yRange: [xMid - ySpan, xMid + ySpan],
    });
    if (Number.isFinite(period) && amplitudeX < 1e-6 * span) {
      // ⟨φa|x|φb⟩ = 0: los dos estados tienen la misma paridad (potencial simétrico).
      bridgeTitle.textContent =
        `El puente con la luz · ⟨x⟩ no oscila: ⟨φ${a + 1}|x|φ${b + 1}⟩ = 0 (los dos estados tienen la misma simetría)` +
        ` · |ψ|² cambia, pero sin dipolo oscilante esta transición no emite ni absorbe luz (regla de selección)`;
      swatch.hidden = true;
    } else if (Number.isFinite(period)) {
      const lambda = tr.wavelengthNm;
      const region = spectralRegion(lambda);
      bridgeTitle.textContent =
        `El puente con la luz · ⟨x⟩ oscila con periodo h/(E${b + 1} − E${a + 1}) = ${formatSig(period, 3)} fs` +
        ` (amplitud ${formatSig(amplitudeX, 2)} nm) · fotón de ${formatSig(tr.deltaE, 3)} eV: λ = ${formatSig(lambda, 4)} nm, ${region}`;
      if (region === 'visible') {
        // Tono de la línea espectral llevado al mayor brillo que cabe en pantalla.
        const rgb = color.wavelengthToSrgb(lambda, 1);
        const max = Math.max(...rgb, 1e-6);
        swatch.style.background = `rgb(${rgb.map((c) => Math.round((255 * c) / max)).join(', ')})`;
        swatch.hidden = false;
      } else swatch.hidden = true;
    } else {
      bridgeTitle.textContent = 'El puente con la luz · con un solo estado ⟨x⟩ no oscila: ni absorbe ni emite';
      swatch.hidden = true;
    }

    // --- Coeficientes ---------------------------------------------------------------------------
    /**
     * Flecha desde el origen hasta z, con punta.
     * @param {{ re: number, im: number }} z
     */
    const arrow = (z) => {
      const len = Math.hypot(z.re, z.im);
      if (len < 1e-9) return { x: [0, 0], y: [0, 0] };
      const ux = z.re / len;
      const uy = z.im / len;
      const head = Math.min(0.12, 0.4 * len);
      const bx = z.re - head * ux;
      const by = z.im - head * uy;
      return {
        x: [0, z.re, NaN, bx - 0.5 * head * uy, z.re, bx + 0.5 * head * uy],
        y: [0, z.im, NaN, by + 0.5 * head * ux, z.im, by - 0.5 * head * ux],
      };
    };
    /** @param {{ re: number, im: number }} c @param {number} energy */
    const rotate = (c, energy) => {
      const ang = (-energy * t) / HBAR_EV_FS + phi;
      return { re: c.re * Math.cos(ang) - c.im * Math.sin(ang), im: c.re * Math.sin(ang) + c.im * Math.cos(ang) };
    };
    const za = rotate(ca, s.energies[a]);
    const zb = rotate(cb, s.energies[b]);
    const circle = Array.from({ length: 121 }, (_, i) => (2 * Math.PI * i) / 120);
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const phasorSeries = [{ x: circle.map(Math.cos), y: circle.map(Math.sin), color: colors.grid, width: 0.8 }];
    phasorSeries.push({ ...arrow(za), color: 0, width: 1.6, label: `c${a + 1}·e^(−iE${a + 1}t/ħ)` });
    if (a !== b) phasorSeries.push({ ...arrow(zb), color: 1, width: 1.6, label: `c${b + 1}·e^(−iE${b + 1}t/ħ)` });
    phasorPlot.draw({ series: phasorSeries });
    const relative = a === b ? 0 : Math.atan2(za.re * zb.im - za.im * zb.re, za.re * zb.re + za.im * zb.im);
    phasorPanel.title.textContent =
      a === b
        ? 'El coeficiente en el plano complejo: gira, y nada observable cambia'
        : `Los coeficientes en el plano complejo · ángulo entre ellos ${Math.round((relative * 180) / Math.PI)}° (esto es lo observable)`;

    setStatus(
      `E${a + 1} = ${formatSig(s.energies[a], 4)} eV` +
        (a !== b ? ` · E${b + 1} = ${formatSig(s.energies[b], 4)} eV · probabilidades ${formatEs(pa, 2)} y ${formatEs(pb, 2)}` : '') +
        ` · t = ${formatEs(t, 2)} fs · masa ${formatEs(Number(state.mass), 2)} mₑ`,
    );
  }

  const offTick = ctx.clock.onTick((time, dt) => {
    if (!sim || !lastState) return;
    if (time === 0 && dt === 0) t = 0; // botón «Reiniciar» del reloj
    const a = Math.round(Number(lastState.n1)) - 1;
    const b = Math.round(Number(lastState.n2)) - 1;
    // Ritmo: un periodo de la oscilación (o de giro de la fase, con un solo estado) cada
    // SECONDS_PER_PERIOD segundos reales.
    const energyScale = a !== b ? Math.abs(sim.energies[b] - sim.energies[a]) : Math.abs(sim.energies[a]);
    const period = energyScale > 1e-9 ? (2 * Math.PI * HBAR_EV_FS) / energyScale : 10;
    t += (dt * period) / SECONDS_PER_PERIOD;
    render(lastState);
  });

  return {
    update(state) {
      lastState = state;
      if (!sim || sim.key !== physicsKey(state)) sim = setup(state);
      render(state);
    },
    destroy() {
      offTick();
      wheel.destroy();
      for (const p of [levelsPlot, psiPlot, bridgePlot, phasorPlot]) p.destroy();
      grid.remove();
    },
  };
}
