// @ts-check
// Luz y materia, vista «material» (parte A): del oscilador a la función dieléctrica.
//
//   ┌──────────────────────────────┬──────────────────────────────┐
//   │ ε′ y ε″ frente a ħω (o λ)    │ n y k frente a ħω (o λ)      │
//   ├──────────────────────────────┼──────────────────────────────┤
//   │ reflectancia R en incidencia │ los osciladores del material │
//   │ normal                       │ a la frecuencia elegida      │
//   └──────────────────────────────┴──────────────────────────────┘
//
// Las tres gráficas comparten el eje horizontal; un clic o un arrastre en cualquiera fija
// la energía del fotón, y con ella cambia el panel de los osciladores (amplitud y desfase
// de cada uno). Aquí no se calcula física: todo sale de physics.js.

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { formatEs } from '../../ui/format.js';
import { eVToWavelengthNm, wavelengthNmToEV } from '../../core/units.js';
import { VISIBLE_EV, opticalSpectrum, oscillatorResponses } from './physics.js';
import {
  ENERGY_RANGE,
  SECONDS_PER_PERIOD,
  createCanvasView,
  drawArrow,
  formatSig,
  formatWavelength,
} from './view-common.js';

/** Puntos de las curvas. */
const SAMPLES = 1201;
/** Las curvas de ε se recortan a ±este valor (en una resonancia ε″ puede valer 40). */
const EPSILON_LIMIT = 12;
/** Tope del eje de n y k. */
const INDEX_LIMIT = 6;

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {import('./view-common.js').PartView}
 */
export function mountMaterial(container, ctx) {
  const grid = createPanelGrid(container, 'lm-grid-material');

  /** ¿El eje horizontal va en longitud de onda? (lo fija el estado) */
  let lambdaAxis = false;
  /** Un clic en una gráfica fija la energía del fotón. @param {number} x */
  const pick = (x) => {
    const energy = lambdaAxis ? wavelengthNmToEV(Math.max(1, x)) : x;
    ctx.setState({ energy: Number(Math.min(ENERGY_RANGE[1], Math.max(ENERGY_RANGE[0], energy)).toFixed(2)) });
  };

  const epsilonPanel = addPanel(grid, 'Función dieléctrica');
  const epsilonPlot = createPlot(epsilonPanel.body, { yLabel: 'ε', exportName: 'luz-materia-epsilon', onPick: pick });
  const indexPanel = addPanel(grid, 'Índice de refracción');
  const indexPlot = createPlot(indexPanel.body, { yLabel: 'n, k', exportName: 'luz-materia-indice', onPick: pick });
  const reflectancePanel = addPanel(grid, 'Reflectancia');
  const reflectancePlot = createPlot(reflectancePanel.body, {
    yLabel: 'R (%)',
    yRange: [0, 100],
    exportName: 'luz-materia-reflectancia',
    onPick: pick,
  });
  const oscillatorPanel = addPanel(grid, 'Los osciladores');
  /** Lo que la animación necesita del último estado. */
  /** @type {{ rows: { name: string, detail: string, amplitude: number, phase: number }[], message: string }} */
  let scene = { rows: [], message: '' };
  const oscillatorView = createCanvasView(
    oscillatorPanel.body,
    'Cada oscilador del material moviéndose empujado por el campo, con su retraso',
    drawOscillators,
  );

  /** Curvas del material (no dependen de la energía elegida): se guardan entre llamadas. */
  /** @type {{ key: string, x: Float64Array, spectrum: ReturnType<typeof opticalSpectrum>, maxima: number[] } | null} */
  let cache = null;

  /**
   * @param {import('../types.js').State} state
   * @param {import('./view-common.js').PartContext} part
   */
  function update(state, { material, optics }) {
    const colors = ctx.theme.colors();
    lambdaAxis = state.axis === 'lambda';
    const window = lambdaAxis ? material.lambdaWindow : material.energyWindow;

    const key = [material.id, state.w0, state.wp, state.gamma, lambdaAxis].join('|');
    if (!cache || cache.key !== key) {
      // Malla uniforme en la variable del eje. En energía se evita ω = 0 exacto.
      const x = Float64Array.from({ length: SAMPLES }, (_, i) => window[0] + ((window[1] - window[0]) * i) / (SAMPLES - 1));
      const energies = x.map((v) => (lambdaAxis ? wavelengthNmToEV(v) : Math.max(v, 1e-3)));
      const spectrum = opticalSpectrum(material.epsilonAt, energies);
      // Mayor |χ_j| de cada oscilador en la ventana: referencia de la amplitud dibujada.
      const maxima = material.model ? material.model.oscillators.map(() => 0) : [];
      if (material.model) {
        for (const energy of energies) {
          oscillatorResponses(material.model, energy).forEach((r, j) => (maxima[j] = Math.max(maxima[j], r.magnitude)));
        }
      }
      cache = { key, x, spectrum, maxima };
    }
    const { x, spectrum, maxima } = cache;
    const xNow = lambdaAxis ? optics.wavelength : optics.energy;
    const xLabel = lambdaAxis ? 'longitud de onda en el vacío λ (nm)' : 'energía del fotón ħω (eV)';
    const visible = lambdaAxis ? [380, 780] : [...VISIBLE_EV];
    const bands = [{ x1: visible[0], x2: visible[1], color: colors.accent, opacity: 0.12, label: 'visible' }];
    const marker = {
      x: xNow,
      label: lambdaAxis ? `λ = ${formatWavelength(optics.wavelength)}` : `ħω = ${formatEs(optics.energy)} eV`,
    };
    /** @param {Float64Array} values @param {number} lo @param {number} hi */
    const clipped = (values, lo, hi) => values.map((v) => (Number.isNaN(v) ? NaN : Math.min(hi, Math.max(lo, v))));
    /** @param {Float64Array[]} arrays @param {number} lo @param {number} hi @returns {[number, number]} */
    const rangeOf = (arrays, lo, hi) => {
      let min = Infinity;
      let max = -Infinity;
      for (const values of arrays) {
        for (const v of values) {
          if (Number.isNaN(v)) continue;
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
      if (!(max > min)) return [lo, hi];
      const pad = 0.06 * (Math.min(hi, max) - Math.max(lo, min));
      return [Math.max(lo, min - pad), Math.min(hi, max + pad)];
    };
    const xRange = /** @type {[number, number]} */ ([window[0], window[1]]);

    // ε′ y ε″.
    const epsRange = rangeOf([spectrum.epsRe, spectrum.epsIm], -EPSILON_LIMIT, EPSILON_LIMIT);
    epsilonPanel.title.textContent =
      `Función dieléctrica · ε = ${formatSig(optics.epsilon.re)} ${optics.epsilon.im < 0 ? '−' : '+'} ${formatSig(Math.abs(optics.epsilon.im))}i` +
      (optics.epsilon.re < 0 ? ' · Re ε < 0: la onda no se propaga' : '');
    epsilonPlot.draw({
      xLabel,
      xRange,
      yRange: [Math.min(epsRange[0], -0.5), Math.max(epsRange[1], 1.5)],
      bands,
      series: [
        { x, y: clipped(spectrum.epsRe, -EPSILON_LIMIT, EPSILON_LIMIT), color: 0, label: 'ε′ (en fase con el campo)' },
        { x, y: clipped(spectrum.epsIm, -EPSILON_LIMIT, EPSILON_LIMIT), color: 1, label: 'ε″ (absorción)' },
      ],
      hlines: [{ y: 0, color: colors.textSoft, dash: [2, 3] }, { y: 1, color: colors.textSoft, dash: [5, 4], label: 'vacío: ε = 1' }],
      vlines: [marker],
    });

    // n y k.
    const nkRange = rangeOf([spectrum.n, spectrum.k], 0, INDEX_LIMIT);
    indexPanel.title.textContent =
      `Índice de refracción · n = ${formatSig(optics.n)} · k = ${formatSig(optics.k)}` +
      (optics.k > 1e-12
        ? ` · la intensidad cae a 1/e en ${formatLength(1 / optics.absorption)}`
        : ' · sin absorción');
    indexPlot.draw({
      xLabel,
      xRange,
      yRange: [0, Math.max(nkRange[1], 2)],
      bands,
      series: [
        { x, y: clipped(spectrum.n, 0, INDEX_LIMIT), color: 0, label: 'n (frena la fase)' },
        { x, y: clipped(spectrum.k, 0, INDEX_LIMIT), color: 1, label: 'k (atenúa la onda)' },
      ],
      hlines: [{ y: 1, color: colors.textSoft, dash: [5, 4], label: 'vacío: n = 1' }],
      vlines: [marker],
    });

    // Reflectancia en incidencia normal.
    reflectancePanel.title.textContent =
      `Reflectancia en incidencia normal · R = ${formatEs(100 * optics.reflectance, 1)} %` +
      ` · coeficiente de absorción α = 4πk/λ = ${formatSig(optics.absorption * 1000)} µm⁻¹`;
    reflectancePlot.draw({
      xLabel,
      xRange,
      bands,
      series: [{ x, y: spectrum.reflectance.map((v) => 100 * v), color: 2, label: 'R = |(n + ik − 1)/(n + ik + 1)|²' }],
      vlines: [marker],
    });

    // Los osciladores a esta frecuencia.
    if (material.model) {
      const responses = oscillatorResponses(material.model, optics.energy);
      scene = {
        message: '',
        rows: responses.map((r, j) => {
          const degrees = (r.phase * 180) / Math.PI;
          const where =
            r.omega0 === 0
              ? 'sin muelle (ω₀ = 0)'
              : `ħω₀ = ${formatSig(r.omega0)} eV (${formatWavelength(eVToWavelengthNm(r.omega0))})`;
          return {
            name: `${capitalize(material.oscillatorNames[j] ?? 'oscilador')} · ${where}`,
            detail: `retraso δ = ${formatEs(degrees, 0)}° · ${phaseMeaning(degrees)} · |χ| = ${formatSig(r.magnitude)}`,
            // Escala comprimida (raíz cúbica): la amplitud real cambia en varios órdenes
            // de magnitud entre la resonancia y lejos de ella.
            amplitude: maxima[j] > 0 ? Math.cbrt(Math.min(1, r.magnitude / maxima[j])) : 0,
            phase: r.phase,
          };
        }),
      };
      oscillatorPanel.title.textContent = 'Los osciladores del material a esta frecuencia (oscilación forzada)';
    } else {
      scene = {
        rows: [],
        message:
          `Las curvas del ${material.name} son medidas, no un modelo: aquí no hay una lista de osciladores. ` +
          'Elige el vidrio, el metal de Drude o el material editable para verlos moverse.',
      };
      oscillatorPanel.title.textContent = 'Los osciladores';
    }
    oscillatorView.render();
  }

  /**
   * Dibuja cada oscilador en el instante actual: arriba, el campo que empuja (el mismo
   * para todos); en cada fila, la carga desplazada y sus dos fasores.
   * @param {CanvasRenderingContext2D} g
   * @param {number} width
   * @param {number} height
   * @param {number} fs
   * @param {string} family
   */
  function drawOscillators(g, width, height, fs, family) {
    const colors = ctx.theme.colors();
    const forceColor = colors.series[1];
    const chargeColor = colors.series[0];
    g.fillStyle = colors.surface;
    g.fillRect(0, 0, width, height);
    g.lineCap = 'round';
    g.textBaseline = 'middle';

    if (scene.rows.length === 0) {
      g.fillStyle = colors.textSoft;
      g.font = `${fs * 0.95}px ${family}`;
      g.textAlign = 'center';
      wrapText(g, scene.message, width / 2, height / 2, width * 0.8, fs * 1.4);
      return;
    }

    const angle = (2 * Math.PI * ctx.clock.time) / SECONDS_PER_PERIOD;
    const force = Math.cos(angle);
    const head = fs * 0.7;
    const left = fs * 1.2;
    // Columna de la derecha: fasores. El resto: la pista por la que se mueve la carga.
    const phasorRadius = Math.min(fs * 2.6, height / (scene.rows.length + 1) / 2 - fs * 0.5);
    const phasorX = width - phasorRadius - fs * 1.2;
    const trackLeft = left;
    const trackRight = phasorX - phasorRadius - fs * 1.6;
    const trackCenter = (trackLeft + trackRight) / 2;
    const reach = Math.max(10, (trackRight - trackLeft) / 2 - fs);
    const rowHeight = (height - fs * 0.5) / (scene.rows.length + 1);

    // Fila 0: el campo eléctrico de la luz (la fuerza sobre los electrones), igual para todos.
    const fieldY = rowHeight * 0.55;
    g.font = `${fs * 0.85}px ${family}`;
    g.textAlign = 'left';
    g.fillStyle = forceColor;
    g.strokeStyle = forceColor;
    g.fillText('Fuerza del campo de la luz sobre los electrones (la misma para todos)', left, fieldY - fs * 1.05);
    g.lineWidth = Math.max(2, fs * 0.2);
    drawArrow(g, trackCenter, fieldY + fs * 0.25, trackCenter + force * reach, fieldY + fs * 0.25, head);

    scene.rows.forEach((row, index) => {
      const y = rowHeight * (index + 1.55);
      const displacement = row.amplitude * Math.cos(angle - row.phase);
      // Rótulos.
      g.textAlign = 'left';
      g.font = `600 ${fs * 0.85}px ${family}`;
      g.fillStyle = colors.text;
      g.fillText(row.name, left, y - fs * 1.75);
      g.font = `${fs * 0.82}px ${family}`;
      g.fillStyle = colors.textSoft;
      g.fillText(row.detail, left, y - fs * 0.65);
      // Pista, posición de equilibrio (el ion) y la carga.
      const trackY = y + fs * 0.75;
      g.strokeStyle = colors.grid;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(trackCenter - reach, trackY);
      g.lineTo(trackCenter + reach, trackY);
      g.moveTo(trackCenter, trackY - fs * 0.45);
      g.lineTo(trackCenter, trackY + fs * 0.45);
      g.stroke();
      g.strokeStyle = chargeColor;
      g.fillStyle = chargeColor;
      g.lineWidth = Math.max(2, fs * 0.2);
      g.beginPath();
      g.moveTo(trackCenter, trackY);
      g.lineTo(trackCenter + displacement * reach, trackY);
      g.stroke();
      g.beginPath();
      g.arc(trackCenter + displacement * reach, trackY, fs * 0.42, 0, 2 * Math.PI);
      g.fill();
      // Fasores: la fuerza (radio completo) y el desplazamiento, δ por detrás.
      const py = y - fs * 0.2;
      g.strokeStyle = colors.grid;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(phasorX, py, phasorRadius, 0, 2 * Math.PI);
      g.stroke();
      g.lineWidth = Math.max(1.5, fs * 0.16);
      g.strokeStyle = forceColor;
      g.fillStyle = forceColor;
      drawArrow(g, phasorX, py, phasorX + phasorRadius * Math.cos(angle), py - phasorRadius * Math.sin(angle), head * 0.8);
      const r = phasorRadius * Math.max(0.12, row.amplitude);
      g.strokeStyle = chargeColor;
      g.fillStyle = chargeColor;
      drawArrow(g, phasorX, py, phasorX + r * Math.cos(angle - row.phase), py - r * Math.sin(angle - row.phase), head * 0.8);
    });
  }

  const offTick = ctx.clock.onTick(() => oscillatorView.render());

  return {
    update,
    destroy() {
      offTick();
      epsilonPlot.destroy();
      indexPlot.destroy();
      reflectancePlot.destroy();
      oscillatorView.destroy();
      grid.remove();
    },
  };
}

/**
 * Qué significa un desfase, en dos palabras.
 * @param {number} degrees
 * @returns {string}
 */
function phaseMeaning(degrees) {
  if (degrees < 20) return 'sigue al campo: suma a n';
  if (degrees < 70) return 'se retrasa: suma a n y absorbe';
  if (degrees <= 110) return 'en cuadratura: absorbe';
  if (degrees <= 160) return 'casi en oposición: resta y absorbe';
  return 'en oposición al campo: resta a ε';
}

/** @param {string} text */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Longitud con la unidad que mejor se lee (entra en nm).
 * @param {number} nm
 * @returns {string}
 */
function formatLength(nm) {
  if (nm < 1000) return `${formatSig(nm)} nm`;
  if (nm < 1e6) return `${formatSig(nm / 1e3)} µm`;
  if (nm < 1e9) return `${formatSig(nm / 1e6)} mm`;
  if (nm < 1e12) return `${formatSig(nm / 1e9)} m`;
  return `${formatSig(nm / 1e12)} km`;
}

/**
 * Texto centrado en varias líneas.
 * @param {CanvasRenderingContext2D} g
 * @param {string} text
 * @param {number} x
 * @param {number} y centro vertical del bloque
 * @param {number} maxWidth
 * @param {number} lineHeight
 */
export function wrapText(g, text, x, y, maxWidth, lineHeight) {
  /** @type {string[]} */
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && g.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1) / 2) * lineHeight));
}
