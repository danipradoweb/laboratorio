// @ts-check
// Luz y materia, vista «láminas» (parte B): de dónde salen el índice de refracción, la
// onda reflejada y la transmitida.
//
//   ┌─────────────────────────────────────────────┬────────────────────────┐
//   │ las ondas por separado (animado):           │ cómo se construye la   │
//   │ incidente, radiadas por las láminas, suma   │ onda transmitida       │
//   ├─────────────────────────────────────────────┼────────────────────────┤
//   │ el campo total (animado): reflejada delante,│ cómo se construye la   │
//   │ onda más corta dentro, transmitida detrás   │ onda reflejada         │
//   └─────────────────────────────────────────────┴────────────────────────┘
//
// El material son láminas de osciladores; su fuerza sale del material y de la energía
// elegidos (χ = ε − 1). La luz llega por la izquierda. Las posiciones van en longitudes de
// onda del vacío. Aquí no se calcula física: todo sale de physics-sheets.js.

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { formatEs } from '../../ui/format.js';
import { normalReflectance } from './physics.js';
import {
  blochIndex,
  fieldProfile,
  fitIndex,
  reflectionPhasors,
  sheetPositions,
  sheetStrength,
  sheetWave,
  slabCoefficients,
  solveSheets,
  transmissionPhasors,
} from './physics-sheets.js';
import { SECONDS_PER_PERIOD, formatSig } from './view-common.js';

/** Puntos de las curvas a lo largo de z. */
const SAMPLES = 900;
/** Espacio vacío que se dibuja delante y detrás del material (en λ₀). */
const MARGIN = 1.5;
/** En modo automático: segundos entre el encendido de una lámina y la siguiente, y pausa
 *  con todas encendidas antes de volver a empezar. */
const AUTO_STEP_SECONDS = 0.45;
const AUTO_HOLD_SECONDS = 4;

/**
 * Un color del tema con transparencia (para las ondas de cada lámina).
 * @param {string} color
 * @param {number} alpha entre 0 y 1
 */
const translucent = (color, alpha) => `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {import('./view-common.js').PartView}
 */
export function mountSheets(container, ctx) {
  const grid = createPanelGrid(container, 'lm-grid-sheets');

  const wavesPanel = addPanel(grid, 'Las ondas por separado', { area: 'ondas' });
  const wavesPlot = createPlot(wavesPanel.body, {
    xLabel: 'posición z (en longitudes de onda del vacío, λ₀) · la luz llega por la izquierda →',
    yLabel: 'campo / E₀',
    yRange: [-2.3, 2.3],
    exportName: 'luz-materia-ondas',
  });
  const totalPanel = addPanel(grid, 'El campo total', { area: 'total' });
  const totalPlot = createPlot(totalPanel.body, {
    xLabel: 'posición z (λ₀)',
    yLabel: 'campo / E₀',
    yRange: [-2.3, 2.3],
    exportName: 'luz-materia-campo-total',
  });
  const transmittedPanel = addPanel(grid, 'Onda transmitida', { area: 'transmitida' });
  const transmittedPlot = createPlot(transmittedPanel.body, {
    xLabel: 'parte en fase con la incidente',
    yLabel: 'en cuadratura',
    xRange: [-1.25, 1.25],
    yRange: [-1.25, 1.25],
    xTicks: [-1, 0, 1],
    yTicks: [-1, 0, 1],
    equalAspect: true,
    exportName: 'luz-materia-fasores-transmitida',
  });
  const reflectedPanel = addPanel(grid, 'Onda reflejada', { area: 'reflejada' });
  const reflectedPlot = createPlot(reflectedPanel.body, {
    xLabel: 'parte real',
    yLabel: 'parte imaginaria',
    xRange: [-1.25, 1.25],
    yRange: [-1.25, 1.25],
    xTicks: [-1, 0, 1],
    yTicks: [-1, 0, 1],
    equalAspect: true,
    exportName: 'luz-materia-fasores-reflejada',
  });

  /** Lo que depende del estado pero no del número de láminas encendidas. */
  /** @type {{ key: string, kappa: import('../../core/complex.js').Complex, spacing: number, count: number, zs: Float64Array, index: import('../../core/complex.js').Complex, auto: boolean, manualActive: number, radiated: string, sheet: number, solutions: Map<number, ReturnType<typeof prepare>> } | null} */
  let setup = null;
  /** Solución que se está dibujando. @type {ReturnType<typeof prepare> | null} */
  let shown = null;
  /** Número de láminas encendidas en el último dibujo estático. */
  let shownActive = -1;

  /**
   * Resuelve el problema con `active` láminas encendidas y prepara todo lo que no cambia
   * de un fotograma a otro.
   * @param {NonNullable<typeof setup>} s
   * @param {number} active
   */
  function prepare(s, active) {
    const solution = solveSheets(s.kappa, sheetPositions(active, s.spacing));
    const profile = fieldProfile(solution, s.zs);
    const waves = s.radiated === 'todas' ? solution.fields.map((_, j) => sheetWave(solution, j, s.zs)) : [];
    const highlighted = Math.min(Math.max(1, s.sheet), Math.max(1, active)) - 1;
    const one = s.radiated === 'una' && active > 0 ? sheetWave(solution, highlighted, s.zs) : null;
    const envelope = s.zs.map((_, i) => Math.hypot(profile.total.re[i], profile.total.im[i]));
    return { solution, profile, waves, one, highlighted, envelope, active };
  }

  /**
   * @param {import('../types.js').State} state
   * @param {import('./view-common.js').PartContext} part
   */
  function update(state, { optics }) {
    const spacing = Number(state.spacing);
    const count = Math.max(1, Math.round(Number(state.count)));
    const chi = { re: optics.epsilon.re - 1, im: optics.epsilon.im };
    const kappa = sheetStrength(chi, spacing);
    const thickness = count * spacing;
    const key = [chi.re, chi.im, spacing, count, state.radiated, Math.round(Number(state.sheet))].join('|');
    if (!setup || setup.key !== key) {
      const from = -MARGIN;
      const to = thickness + MARGIN;
      setup = {
        key,
        kappa,
        spacing,
        count,
        zs: Float64Array.from({ length: SAMPLES }, (_, i) => from + ((to - from) * i) / (SAMPLES - 1)),
        index: { re: optics.n, im: optics.k },
        auto: false,
        manualActive: count,
        radiated: String(state.radiated),
        sheet: Math.round(Number(state.sheet)),
        solutions: new Map(),
      };
    }
    setup.auto = Boolean(state.auto);
    setup.manualActive = Math.min(count, Math.max(0, Math.round(Number(state.active))));
    shownActive = -1; // fuerza a redibujar los paneles estáticos
    renderFrame();
  }

  /** Láminas encendidas en este instante. */
  function activeNow() {
    if (!setup) return 0;
    if (!setup.auto) return setup.manualActive;
    const cycle = (setup.count + 1) * AUTO_STEP_SECONDS + AUTO_HOLD_SECONDS;
    const t = ctx.clock.time % cycle;
    return Math.min(setup.count, Math.floor(t / AUTO_STEP_SECONDS));
  }

  /** Dibuja el instante actual (y, si ha cambiado el número de láminas, los paneles estáticos). */
  function renderFrame() {
    if (!setup) return;
    const s = setup;
    const colors = ctx.theme.colors();
    const active = activeNow();
    let prepared = s.solutions.get(active);
    if (!prepared) {
      prepared = prepare(s, active);
      s.solutions.set(active, prepared);
    }
    shown = prepared;
    const { solution, profile, waves, one, highlighted, envelope } = prepared;
    const angle = (2 * Math.PI * ctx.clock.time) / SECONDS_PER_PERIOD;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    /** Campo real en este instante: Re[F·e^{−iωt}]. @param {{ re: Float64Array, im: Float64Array }} f */
    const now = (f) => f.re.map((re, i) => re * cos + f.im[i] * sin);

    const thickness = s.count * s.spacing;
    const xRange = /** @type {[number, number]} */ ([-MARGIN, thickness + MARGIN]);
    const slab = [{ x1: 0, x2: thickness, color: colors.textSoft, opacity: 0.1, label: 'material' }];
    // Las láminas: una raya por cada una (encendidas, más marcadas).
    const sheetLines = Array.from(sheetPositions(s.count, s.spacing), (z, j) => ({
      x: z,
      color: j < active ? colors.textSoft : colors.grid,
      dash: j < active ? undefined : [2, 4],
    }));

    // (1) Las ondas por separado.
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const pieces = [];
    waves.forEach((wave, j) => pieces.push({ x: s.zs, y: now(wave), color: translucent(colors.series[2], 0.3), width: 0.6, label: j === 0 ? 'radiada por cada lámina' : undefined }));
    if (one) pieces.push({ x: s.zs, y: now(one), color: colors.series[3], width: 1, label: `radiada por la lámina ${highlighted + 1}` });
    pieces.push({ x: s.zs, y: now(profile.incident), color: 1, label: 'incidente (sigue ahí, a velocidad c)' });
    if (active > 0) pieces.push({ x: s.zs, y: now(profile.radiated), color: 2, width: 1.3, label: 'suma de las radiadas' });
    wavesPlot.draw({
      xRange,
      bands: slab,
      vlines: one ? [...sheetLines, { x: solution.positions[highlighted], color: colors.series[3] }] : sheetLines,
      series: pieces,
    });

    // (2) El campo total, con la reflejada delante y las longitudes de onda marcadas.
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const totalSeries = [];
    const front = s.zs.filter((z) => z <= 0);
    if (active > 0) {
      // Delante solo viajan hacia atrás las radiadas: su suma es la onda reflejada.
      const reflected = front.map((z) => {
        const phase = -2 * Math.PI * z;
        return (solution.r.re * Math.cos(phase) - solution.r.im * Math.sin(phase)) * cos + (solution.r.re * Math.sin(phase) + solution.r.im * Math.cos(phase)) * sin;
      });
      totalSeries.push({ x: front, y: reflected, color: 3, dash: [5, 4], label: '← reflejada (suma de lo radiado hacia atrás)' });
    }
    totalSeries.push(
      { x: s.zs, y: envelope, color: colors.textSoft, dash: [2, 3], width: 0.7, label: 'amplitud' },
      { x: s.zs, y: envelope.map((v) => -v), color: colors.textSoft, dash: [2, 3], width: 0.7 },
      { x: s.zs, y: now(profile.total), color: 0, width: 1.4, label: 'campo total = incidente + radiadas' },
    );
    if (active > 0) {
      // Detrás del material el campo total ES la onda transmitida: se resalta ese tramo.
      const from = s.zs.findIndex((z) => z >= thickness);
      if (from >= 0) {
        totalSeries.push({
          x: s.zs.subarray(from),
          y: now(profile.total).subarray(from),
          color: 4,
          dash: [7, 4],
          width: 1.4,
          label: 'transmitida → (incidente + lo radiado hacia delante)',
        });
      }
    }
    // Regla de una longitud de onda fuera y, si dentro hay una onda que viaja, otra dentro.
    totalSeries.push({ x: [-1.25, -0.25], y: [2, 2], color: colors.text, points: true, label: 'fuera: λ₀' });
    const inside = active >= 3 ? fitIndex(solution.fields, s.spacing) : null;
    const insideLength = inside && inside.re > 0.05 ? 1 / inside.re : Infinity;
    const occupied = active * s.spacing;
    if (inside && inside.re > 2 * inside.im && insideLength <= occupied) {
      const start = Math.max(0, (occupied - insideLength) / 2);
      totalSeries.push({
        x: [start, start + insideLength],
        y: [2, 2],
        color: colors.accent,
        points: true,
        label: `dentro: λ₀/n = ${formatEs(insideLength, 3)} λ₀`,
      });
    }
    totalPlot.draw({ xRange, bands: slab, vlines: sheetLines, series: totalSeries });

    // Lo que no depende del tiempo solo se rehace si cambia el número de láminas encendidas.
    if (active === shownActive) return;
    shownActive = active;

    wavesPanel.title.textContent =
      `Las ondas por separado · ${active} de ${s.count} láminas encendidas${s.auto ? ' (encendido automático)' : ''}` +
      ` · separación d = ${formatEs(s.spacing, 3)} λ₀ · fuerza de cada lámina κ = π(d/λ₀)(ε − 1) = ${formatSig(s.kappa.re)} ${s.kappa.im < 0 ? '−' : '+'} ${formatSig(Math.abs(s.kappa.im))}i`;

    const bloch = blochIndex(s.kappa, s.spacing);
    const tooSparse = 2 * Math.PI * s.spacing * Math.hypot(bloch.re, bloch.im) > 1;
    let insideText;
    if (!inside) insideText = 'hacen falta al menos 3 láminas para medir la onda de dentro';
    else if (inside.re > 2 * inside.im) {
      insideText = `dentro, λ = λ₀/${formatEs(inside.re, 3)} (medido en el campo); medio continuo: n = ${formatEs(s.index.re, 3)}`;
    } else {
      insideText = `dentro no viaja una onda: la amplitud del campo cae a 1/e en ${formatSig(1 / (2 * Math.PI * Math.max(inside.im, 1e-9)))} λ₀ (Re ε < 0 o absorción fuerte)`;
    }
    totalPanel.title.textContent =
      `El campo total · R = ${formatEs(100 * solution.R, 1)} % · T = ${formatEs(100 * solution.T, 1)} % · absorbido ${formatEs(100 * Math.max(0, solution.A), 1)} % · ${insideText}` +
      (tooSparse ? ' · ⚠ láminas demasiado separadas para imitar un medio continuo' : '');

    // (3) Fasores de la transmitida: 1 (la incidente) más lo que añade cada lámina.
    const circle = Array.from({ length: 121 }, (_, i) => (2 * Math.PI * i) / 120);
    const unit = { x: circle.map(Math.cos), y: circle.map(Math.sin), color: colors.grid, width: 0.8 };
    const forward = transmissionPhasors(solution);
    const t = solution.t;
    // Retraso de fase acumulado: se suman los giros de una suma parcial a la siguiente, para
    // no perder las vueltas completas (el fasor puede dar más de una vuelta).
    let delay = 0;
    for (let j = 1; j < forward.length; j++) {
      const a = forward[j - 1];
      const b = forward[j];
      delay += Math.atan2(a.re * b.im - a.im * b.re, a.re * b.re + a.im * b.im);
    }
    const degrees = (delay * 180) / Math.PI;
    transmittedPanel.title.textContent =
      `Onda transmitida = incidente + lo radiado hacia delante · |t| = ${formatEs(Math.hypot(t.re, t.im), 3)}` +
      // Con la onda extinguida (|t| ≈ 0) la fase de lo que queda no significa nada.
      (Math.hypot(t.re, t.im) < 0.02
        ? ' · lo radiado hacia delante cancela a la incidente (extinción)'
        : ` · ${degrees >= 0 ? 'retraso' : 'adelanto'} de fase ${formatEs(Math.abs(degrees), 0)}° respecto a la incidente`);
    transmittedPlot.draw({
      series: [
        unit,
        { x: [0, 1], y: [0, 0], color: 1, width: 1.4, label: 'incidente' },
        { x: forward.map((z) => z.re), y: forward.map((z) => z.im), color: 2, points: forward.length <= 41, label: '+ cada lámina' },
        { x: [0, t.re], y: [0, t.im], color: 0, width: 1.6, label: 'transmitida' },
        { x: [t.re], y: [t.im], color: 0, points: true, line: false },
      ],
    });

    // (4) Fasores de la reflejada: solo lo radiado hacia atrás.
    const backward = reflectionPhasors(solution);
    const continuous = active > 0 ? slabCoefficients(s.index, active * s.spacing) : null;
    reflectedPanel.title.textContent =
      `Onda reflejada = lo radiado hacia atrás · |r| = ${formatEs(Math.hypot(solution.r.re, solution.r.im), 3)}` +
      (continuous
        ? ` · lámina continua del mismo espesor: R = ${formatEs(100 * continuous.R, 1)} % · una sola superficie (Fresnel): ${formatEs(100 * normalReflectance(s.index.re, s.index.im), 1)} %`
        : '');
    reflectedPlot.draw({
      series: [
        unit,
        { x: backward.map((z) => z.re), y: backward.map((z) => z.im), color: 2, points: backward.length <= 41, label: 'cada lámina' },
        { x: [0, solution.r.re], y: [0, solution.r.im], color: 3, width: 1.6, label: 'reflejada' },
        { x: [solution.r.re], y: [solution.r.im], color: 3, points: true, line: false },
      ],
    });
  }

  const offTick = ctx.clock.onTick(() => renderFrame());

  return {
    update,
    destroy() {
      offTick();
      shown = null;
      wavesPlot.destroy();
      totalPlot.destroy();
      transmittedPlot.destroy();
      reflectedPlot.destroy();
      grid.remove();
    },
  };
}
