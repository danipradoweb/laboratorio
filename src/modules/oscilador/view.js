// @ts-check
// Vistas enlazadas del oscilador forzado amortiguado.
//
//   ┌──────────────────────────┬──────────────────────┐
//   │ (a) evolución temporal   │ (b) amplitud frente a ω │
//   ├──────────────────────────┼──────────────────────┤
//   │ (c) potencia frente a ω  │ (b) desfase frente a ω  │
//   └──────────────────────────┴──────────────────────┘
//
// Las tres gráficas en función de ω comparten un marcador en la frecuencia actual, y un
// clic en cualquiera de ellas la cambia. Aquí no se calcula física: todo sale de
// physics.js.

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { formatEs } from '../../ui/format.js';
import {
  averagePower,
  drivingForce,
  halfPowerFrequencies,
  lorentzianPower,
  simulate,
  steadyPosition,
  steadyState,
} from './physics.js';

// Unidades adimensionales de la interfaz: m = ω₀ = F₀ = 1 (ver module.js).
const UNITS = { m: 1, omega0: 1, F0: 1 };

/** Periodos de la fuerza que se muestran en la evolución temporal. */
const PERIODS = 8;
/** Periodo (contado desde 0) en el que se marca el desfase: cerca del final, donde el
 *  transitorio ya suele haber decaído. */
const PHASE_MARK_PERIOD = 6;
/** Pasos de integración por cada periodo (el más corto de los dos: el de la fuerza o el
 *  propio). Con 60, el error de RK4 es muy inferior al grosor de la línea. */
const STEPS_PER_PERIOD = 60;
/** Segundos reales que tarda el cursor en recorrer un periodo de la fuerza (a ×1). */
const SECONDS_PER_PERIOD = 1.5;
/** Extremo superior del eje de frecuencias (el máximo del parámetro omega). */
const OMEGA_MAX = 3;
const OMEGA_SAMPLES = 600;
/** Muestras adicionales alrededor de ω₀, donde las curvas tienen un pico estrecho si el
 *  amortiguamiento es pequeño. */
const PEAK_SAMPLES = 240;

/**
 * Frecuencias en las que se evalúan las curvas: una malla uniforme en [0, OMEGA_MAX] más
 * una malla fina en ω₀ ± 6γ. Sin el refuerzo, con γ = 0,02 la malla uniforme (paso 0,005)
 * dibujaría el pico un 2–3 % más bajo de lo que es.
 * @param {number} omega0
 * @param {number} gamma
 * @returns {Float64Array} frecuencias ordenadas
 */
function frequencyGrid(omega0, gamma) {
  /** @type {number[]} */
  const values = [];
  for (let i = 0; i < OMEGA_SAMPLES; i++) values.push((OMEGA_MAX * i) / (OMEGA_SAMPLES - 1));
  const lo = Math.max(0, omega0 - 6 * gamma);
  const hi = Math.min(OMEGA_MAX, omega0 + 6 * gamma);
  for (let i = 0; i < PEAK_SAMPLES; i++) values.push(lo + ((hi - lo) * i) / (PEAK_SAMPLES - 1));
  return Float64Array.from(values).sort();
}

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {import('../types.js').ModuleInstance}
 */
export function mount(container, ctx) {
  const grid = createPanelGrid(container, 'oscilador-grid');

  // Un clic (o arrastrar) sobre una gráfica en función de ω fija la frecuencia.
  /** @param {number} omega */
  const pickOmega = (omega) => ctx.setState({ omega: Math.round(omega * 100) / 100 });

  const timePanel = addPanel(grid, 'Evolución temporal');
  const timePlot = createPlot(timePanel.body, {
    xLabel: 'tiempo (periodos de la fuerza)',
    yLabel: 'valor / amplitud',
    xRange: [0, PERIODS],
    xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    exportName: 'oscilador-tiempo',
  });

  const amplitudePanel = addPanel(grid, 'Amplitud');
  const amplitudePlot = createPlot(amplitudePanel.body, {
    xLabel: 'ω / ω₀',
    yLabel: 'A  (× F₀/mω₀²)',
    xRange: [0, OMEGA_MAX],
    exportName: 'oscilador-amplitud',
    onPick: pickOmega,
  });

  const powerPanel = addPanel(grid, 'Potencia media absorbida');
  const powerPlot = createPlot(powerPanel.body, {
    xLabel: 'ω / ω₀',
    yLabel: '⟨P⟩  (× F₀²/mω₀)',
    xRange: [0, OMEGA_MAX],
    exportName: 'oscilador-potencia',
    onPick: pickOmega,
  });

  const phasePanel = addPanel(grid, 'Desfase');
  const phasePlot = createPlot(phasePanel.body, {
    xLabel: 'ω / ω₀',
    yLabel: 'δ (grados)',
    xRange: [0, OMEGA_MAX],
    yRange: [0, 180],
    yTicks: [0, 45, 90, 135, 180],
    exportName: 'oscilador-desfase',
    onPick: pickOmega,
  });

  /** Datos de la evolución temporal del último estado (se reutilizan en cada fotograma). */
  /** @type {{ periods: Float64Array, force: Float64Array, steady: Float64Array, driven: Float64Array | null, yMax: number, phase: number } | null} */
  let timeData = null;

  /**
   * Curvas en función de ω y cálculo de la evolución temporal. Se llama cuando cambia
   * el estado (no en cada fotograma).
   * @param {import('../types.js').State} state
   */
  function renderState(state) {
    const p = { ...UNITS, omega: Number(state.omega), gamma: Number(state.gamma) };
    const { amplitude, phase } = steadyState(p);
    const degrees = (phase * 180) / Math.PI;
    const power = averagePower(p);
    const omegas = frequencyGrid(p.omega0, p.gamma);

    // Línea de trazos fina en ω₀, común a las tres gráficas.
    const naturalLine = { x: 1, color: ctx.theme.colors().textSoft, dash: [2, 4], label: 'ω₀' };
    const currentLine = { x: p.omega, label: `ω = ${formatEs(p.omega)} ω₀` };

    // (b) Amplitud.
    const amplitudes = omegas.map((omega) => steadyState({ ...p, omega }).amplitude);
    amplitudePanel.title.textContent = `Amplitud · A = ${formatEs(amplitude)} veces la respuesta estática`;
    amplitudePlot.draw({
      yRange: [0, 1.1 * Math.max(...amplitudes, amplitude)],
      series: [
        { x: omegas, y: amplitudes, color: 0 },
        { x: [p.omega], y: [amplitude], color: 0, points: true, line: false },
      ],
      vlines: [naturalLine, currentLine],
    });

    // (b) Desfase.
    phasePanel.title.textContent = `Desfase · δ = ${formatEs(degrees, 0)}°`;
    phasePlot.draw({
      series: [
        { x: omegas, y: omegas.map((omega) => (steadyState({ ...p, omega }).phase * 180) / Math.PI), color: 0 },
        { x: [p.omega], y: [degrees], color: 0, points: true, line: false },
      ],
      vlines: [naturalLine, currentLine],
      hlines: [{ y: 90, label: '90°', dash: [3, 3], color: ctx.theme.colors().textSoft }],
    });

    // (c) Potencia, con su anchura a media altura (= γ) y la aproximación lorentziana.
    const powers = omegas.map((omega) => averagePower({ ...p, omega }));
    const half = halfPowerFrequencies(p);
    const peak = averagePower({ ...p, omega: p.omega0 });
    powerPanel.title.textContent = `Potencia media absorbida · ${formatEs((100 * power) / peak, 0)} % del máximo`;
    powerPlot.draw({
      yRange: [0, 1.1 * peak],
      series: [
        { x: omegas, y: powers, color: 2, label: 'Potencia' },
        { x: omegas, y: omegas.map((omega) => lorentzianPower({ ...p, omega })), color: 3, dash: [5, 4], width: 0.8, label: 'Lorentziana' },
        { x: [p.omega], y: [power], color: 2, points: true, line: false },
      ],
      bands: [{ x1: half.lower, x2: half.upper, color: 2, label: `Anchura a media altura = γ = ${formatEs(p.gamma)} ω₀` }],
      vlines: [naturalLine, currentLine],
    });

    // (a) Evolución temporal: fuerza, régimen estacionario y, si se pide, el movimiento
    // desde el reposo integrado con RK4.
    const period = (2 * Math.PI) / p.omega;
    const naturalPeriod = (2 * Math.PI) / p.omega0;
    const total = PERIODS * period;
    const steps = Math.ceil((total / Math.min(period, naturalPeriod)) * STEPS_PER_PERIOD);
    const dt = total / steps;
    const periods = new Float64Array(steps + 1);
    const force = new Float64Array(steps + 1);
    const steady = new Float64Array(steps + 1);
    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      periods[i] = t / period;
      // Cada magnitud dividida por su amplitud, para comparar fases.
      force[i] = drivingForce(p, t) / p.F0;
      steady[i] = steadyPosition(p, t) / amplitude;
    }
    /** @type {Float64Array | null} */
    let driven = null;
    let yMax = 1;
    if (state.transient) {
      // Posición dividida por la amplitud estacionaria, para compararla con la fuerza.
      driven = simulate(p, { dt, steps }).x.map((x) => x / amplitude);
      for (const v of driven) yMax = Math.max(yMax, Math.abs(v));
    }
    timeData = { periods, force, steady, driven, yMax, phase };
    timePanel.title.textContent = `Evolución temporal · en régimen estacionario la respuesta va ${formatEs(degrees, 0)}° por detrás`;
    renderTime();
  }

  /** Dibuja la evolución temporal con el cursor en el instante actual del reloj. */
  function renderTime() {
    if (!timeData) return;
    const { periods, force, steady, driven, yMax, phase } = timeData;
    const last = periods.length - 1;
    // El cursor recorre la ventana y vuelve a empezar.
    const cursor = (ctx.clock.time / SECONDS_PER_PERIOD) % PERIODS;
    const index = Math.min(last, Math.round((cursor / PERIODS) * last));
    const response = driven ?? steady;
    const lag = phase / (2 * Math.PI); // desfase en fracción de periodo

    timePlot.draw({
      yRange: [-1.15 * yMax, 1.15 * yMax],
      series: [
        { x: periods, y: force, color: 1, label: 'Fuerza F/F₀' },
        driven
          ? { x: periods, y: driven, color: 0, label: 'Posición x/A desde el reposo' }
          : { x: periods, y: steady, color: 0, label: 'Posición x/A' },
        ...(driven ? [{ x: periods, y: steady, color: 0, dash: [5, 4], width: 0.7, label: 'Régimen estacionario' }] : []),
        { x: [periods[index]], y: [force[index]], color: 1, points: true, line: false },
        { x: [periods[index]], y: [response[index]], color: 0, points: true, line: false },
      ],
      // Del máximo de la fuerza al máximo de la respuesta estacionaria: el desfase.
      bands: [{ x1: PHASE_MARK_PERIOD, x2: PHASE_MARK_PERIOD + lag, color: 4, opacity: 0.35, label: 'Desfase δ (estacionario)' }],
      vlines: [{ x: periods[index], color: ctx.theme.colors().textSoft, dash: [2, 3] }],
    });
  }

  const offTick = ctx.clock.onTick(renderTime);

  return {
    update(state) {
      renderState(state);
    },
    destroy() {
      offTick();
      timePlot.destroy();
      amplitudePlot.destroy();
      powerPlot.destroy();
      phasePlot.destroy();
      grid.remove();
    },
  };
}
