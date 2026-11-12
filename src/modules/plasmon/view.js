// @ts-check
// Vistas enlazadas del módulo «plasmón».
//
//   ┌───────────────────────────────────────────────────────────────┐
//   │ modelo en uso y su validez (una línea)                         │
//   ├─────────────────────────────────────────┬─────────────────────┤
//   │ (a) espectros de extinción, absorción   │ (b) color: cubeta a │
//   │     y dispersión                        │     contraluz y luz │
//   │                                         │     dispersada      │
//   ├───────────────────┬─────────────────────┼─────────────────────┤
//   │ (c) nube          │ (d) campo cercano   │ (e) diagrama polar  │
//   │     electrónica   │     |E|²/|E₀|²      │     de dispersión   │
//   └───────────────────┴─────────────────────┴─────────────────────┘
//
// La longitud de onda actual (parámetro `lambda`) enlaza todas las vistas: un clic o un
// arrastre sobre el espectro la cambia, y con ella la animación de la nube, el mapa de
// campo y el diagrama polar. Aquí no se calcula física: todo sale de physics.js, de la
// biblioteca de materiales y del motor de color.

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { colormaps } from '../../ui/colormaps.js';
import { formatEs } from '../../ui/format.js';
import { createOpticalConstants } from '../../materials/dielectric.js';
import {
  colloidSpectra,
  drivenOscillation,
  findPeak,
  mieSphere,
  particleResponse,
  particleSpectrum,
  quasiStaticSphere,
  sizeParameter,
  spheroidNearField,
} from './physics.js';

/** Materiales que ofrece el selector (identificadores de data/materials/). */
export const MATERIAL_OPTIONS = [
  { value: 'Au', label: 'Oro (Au)' },
  { value: 'Ag', label: 'Plata (Ag)' },
  { value: 'Cu', label: 'Cobre (Cu)' },
  { value: 'Al', label: 'Aluminio (Al)' },
  { value: 'AuAg', label: 'Aleación Au-Ag (30:70)' },
];

/** Intervalo de longitudes de onda de los espectros (nm). Es también el del control λ. */
export const LAMBDA_RANGE = /** @type {const} */ ([300, 1000]);
/** Paso de la malla de los espectros (nm). */
const LAMBDA_STEP = 2;
/** Límites del espectro visible que se colorea bajo la curva de extinción (nm). */
const VISIBLE = /** @type {const} */ ([380, 780]);
/** Anchura de cada franja de color bajo la curva (nm). */
const VISIBLE_SLICE = 4;
/** Segundos reales que dura un periodo de la luz en la animación, para λ = 550 nm (a ×1). */
const SECONDS_PER_PERIOD = 2.4;
/** Columnas del mapa de campo cercano (las filas salen de la proporción de la ventana). */
const FIELD_COLUMNS = 132;
/** Ángulos (grados) en los que se evalúa el diagrama de dispersión. */
const POLAR_ANGLES = Array.from({ length: 91 }, (_, i) => 2 * i);
/** Por encima de este parámetro de tamaño el mapa de campo (cuasiestático) es solo orientativo. */
const QUASISTATIC_LIMIT = 0.3;

/** Color con el que se pinta el metal en la vista de la nube electrónica. */
const METAL_TINT = /** @type {Record<string, string>} */ ({
  Au: '#d9a738',
  Ag: '#b8bec7',
  Cu: '#c9793f',
  Al: '#a9b4be',
  AuAg: '#cdbd7c',
});

/** Malla de longitudes de onda de los espectros. */
const WAVELENGTHS = Float64Array.from(
  { length: Math.round((LAMBDA_RANGE[1] - LAMBDA_RANGE[0]) / LAMBDA_STEP) + 1 },
  (_, i) => LAMBDA_RANGE[0] + i * LAMBDA_STEP,
);

/**
 * Número en notación científica con exponente en superíndice: 5,97·10¹¹.
 * @param {number} value
 * @returns {string}
 */
function formatScientific(value) {
  if (!Number.isFinite(value) || value === 0) return '0';
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = value / 10 ** exponent;
  if (Math.abs(mantissa) >= 9.95) {
    mantissa /= 10;
    exponent += 1;
  }
  const superscript = String(exponent).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  return `${formatEs(mantissa, 1)}·10${superscript}`;
}

/**
 * Lienzo propio (para lo que el trazador no sabe dibujar): se ajusta al contenedor y a la
 * densidad de píxeles, y llama a `draw` con el contexto ya escalado a píxeles CSS.
 * @param {HTMLElement} container
 * @param {string} label descripción para lectores de pantalla
 * @param {(g: CanvasRenderingContext2D, width: number, height: number, fontSize: number, family: string) => void} draw
 */
function createCanvasView(container, label, draw) {
  const canvas = el('canvas', { class: 'plasmon-canvas', role: 'img', 'aria-label': label });
  const wrap = el('div', { class: 'plasmon-canvas-wrap' }, canvas);
  container.append(wrap);
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  function render() {
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width < 40 || height < 40) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const style = getComputedStyle(wrap);
    draw(g, width, height, parseFloat(style.fontSize) || 14, style.fontFamily || 'sans-serif');
  }
  const observer = new ResizeObserver(render);
  observer.observe(wrap);
  return {
    render,
    destroy() {
      observer.disconnect();
      wrap.remove();
    },
  };
}

/**
 * Flecha horizontal o inclinada con punta, de (x0, y0) a (x1, y1).
 * @param {CanvasRenderingContext2D} g
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} head tamaño de la punta (px)
 */
function drawArrow(g, x0, y0, x1, y1, head) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  if (length < head * 0.6) return; // demasiado corta para llevar punta
  const angle = Math.atan2(y1 - y0, x1 - x0);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45));
  g.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45));
  g.closePath();
  g.fill();
}

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {Promise<import('../types.js').ModuleInstance>}
 */
export async function mount(container, ctx) {
  // Datos: el motor de color y las constantes ópticas de todos los materiales del selector.
  const [engine, ...materials] = await Promise.all([
    ctx.color.load(),
    ...MATERIAL_OPTIONS.map((option) => ctx.materials.load(option.value)),
  ]);
  /** @type {Record<string, import('../../materials/dielectric.js').OpticalConstants>} */
  const optical = {};
  /** @type {Record<string, string>} */
  const materialNames = {};
  materials.forEach((material) => {
    optical[material.id] = createOpticalConstants(material);
    materialNames[material.id] = material.nombre;
  });

  const grid = createPanelGrid(container, 'plasmon-grid');

  // Línea de modelo: dice qué teoría se está usando y avisa cuando sale de su validez.
  const modelLine = el('p', { class: 'plasmon-model', role: 'status' });
  grid.append(modelLine);

  /** Un clic (o arrastre) en el espectro fija la longitud de onda. @param {number} lambda */
  const pickLambda = (lambda) => ctx.setState({ lambda: Math.round(Math.min(LAMBDA_RANGE[1], Math.max(LAMBDA_RANGE[0], lambda))) });

  // (a) Espectros.
  const spectrumPanel = addPanel(grid, 'Espectros', { area: 'espectro' });
  const spectrumPlot = createPlot(spectrumPanel.body, {
    xLabel: 'longitud de onda en el vacío λ (nm)',
    yLabel: 'sección eficaz (nm²)',
    xRange: [LAMBDA_RANGE[0], LAMBDA_RANGE[1]],
    exportName: 'plasmon-espectros',
    onPick: pickLambda,
  });

  // (b) Muestras de color.
  const colorPanel = addPanel(grid, 'Color del coloide (iluminante D65)', { area: 'color' });
  const cuvette = el('div', { class: 'plasmon-cuvette' });
  const glow = el('div', { class: 'plasmon-glow' });
  const transmittedCaption = el('span', { class: 'plasmon-swatch-detail' });
  const scatteredCaption = el('span', { class: 'plasmon-swatch-detail' });
  const colorNote = el('p', { class: 'plasmon-note' });
  colorPanel.body.classList.add('plasmon-color');
  colorPanel.body.append(
    el(
      'div',
      { class: 'plasmon-swatches' },
      el(
        'figure',
        { class: 'plasmon-swatch' },
        el('div', { class: 'plasmon-lightbox', title: 'Cubeta vista a contraluz, sobre una pantalla blanca' }, cuvette),
        el('figcaption', {}, el('strong', { text: 'A contraluz' }), el('span', { text: 'lo que queda tras la extinción' }), transmittedCaption),
      ),
      el(
        'figure',
        { class: 'plasmon-swatch' },
        el('div', { class: 'plasmon-darkbox', title: 'Luz dispersada, vista de lado sobre fondo negro (solo el tono: brillo normalizado)' }, glow),
        el('figcaption', {}, el('strong', { text: 'De lado' }), el('span', { text: 'luz dispersada (solo el tono)' }), scatteredCaption),
      ),
    ),
    colorNote,
  );

  // (c) Nube electrónica (lienzo propio, animado).
  const cloudPanel = addPanel(grid, 'Nube electrónica', { area: 'nube' });
  /** Lo que la animación necesita del último estado. */
  let cloud = { amplitude: 0, phase: 0, lambda: 550, aspect: 1, tint: METAL_TINT.Au };
  const cloudView = createCanvasView(
    cloudPanel.body,
    'Partícula con su nube electrónica oscilando, la fuerza que la empuja y el diagrama de fasores',
    drawCloud,
  );

  // (d) Campo cercano.
  const fieldPanel = addPanel(grid, 'Campo cercano', { area: 'campo' });
  const fieldPlot = createPlot(fieldPanel.body, {
    xLabel: 'nm   (campo incidente E₀ en horizontal ↔)',
    yLabel: 'nm',
    equalAspect: true,
    legend: false,
    exportName: 'plasmon-campo',
  });

  // (e) Diagrama polar de dispersión.
  const polarPanel = addPanel(grid, 'Diagrama de dispersión', { area: 'polar' });
  const polarPlot = createPlot(polarPanel.body, {
    xLabel: 'luz incidente →  (hacia delante, a la derecha)',
    xRange: [-1.12, 1.12],
    yRange: [-1.12, 1.12],
    xTicks: [-1, -0.5, 0, 0.5, 1],
    yTicks: [-1, -0.5, 0, 0.5, 1],
    equalAspect: true,
    exportName: 'plasmon-polar',
  });

  // --- Cálculo con caché ----------------------------------------------------------------
  // El espectro solo depende de la partícula y del medio, no de λ ni de la cubeta: mover
  // λ (lo más frecuente, al arrastrar sobre la gráfica) no lo recalcula.
  /** @type {{ key: string, spectrum: ReturnType<typeof particleSpectrum>, peak: ReturnType<typeof findPeak>, quasiStaticPeak: number | null, maxAlpha: number, maxPoleIntensity: number } | null} */
  let cache = null;

  /**
   * Máximo de una curva: lo localiza en la malla de los espectros (2 nm) y lo afina
   * evaluando la función en una malla de 0,25 nm alrededor.
   * @param {ArrayLike<number>} coarse valores en WAVELENGTHS
   * @param {(wavelength: number) => number} evaluate
   * @returns {ReturnType<typeof findPeak>}
   */
  function refinedPeak(coarse, evaluate) {
    const rough = findPeak(WAVELENGTHS, coarse);
    if (!rough.interior) return rough;
    const xs = Array.from({ length: 25 }, (_, i) => WAVELENGTHS[rough.index] - 3 + 0.25 * i);
    const fine = findPeak(xs, xs.map(evaluate));
    return { ...fine, index: rough.index, interior: true };
  }

  /**
   * @param {import('../types.js').State} state
   * @returns {import('./physics.js').ParticleConfig}
   */
  function particleOf(state) {
    const material = optical[String(state.material)];
    return {
      shape: state.shape === 'rod' ? 'rod' : 'sphere',
      diameter: Number(state.diameter),
      aspectRatio: Number(state.aspect),
      mediumIndex: Number(state.medium),
      epsilon: (wavelength) => material.epsilon(wavelength),
    };
  }

  /**
   * Semiejes del esferoide con el que se dibuja el campo cercano y la nube: la esfera
   * tiene los dos iguales.
   * @param {import('./physics.js').ParticleConfig} particle
   */
  function semiAxes(particle) {
    const short = particle.diameter / 2;
    return { long: particle.shape === 'rod' ? short * particle.aspectRatio : short, short };
  }

  /**
   * @param {import('../types.js').State} state
   * @param {import('./physics.js').ParticleConfig} particle
   */
  function spectrumOf(state, particle) {
    const key = [state.material, particle.shape, particle.diameter, particle.shape === 'rod' ? particle.aspectRatio : 1, particle.mediumIndex].join('|');
    if (cache && cache.key === key) return cache;
    const spectrum = particleSpectrum(particle, WAVELENGTHS);
    const { long, short } = semiAxes(particle);
    const epsilonMedium = particle.mediumIndex ** 2;
    let maxAlpha = 0;
    let maxPoleIntensity = 1;
    /** Extinción cuasiestática de la esfera, para marcar dónde estaría el pico sin retardo. */
    const quasiStatic = new Float64Array(WAVELENGTHS.length);
    for (let i = 0; i < WAVELENGTHS.length; i++) {
      maxAlpha = Math.max(maxAlpha, Math.hypot(spectrum.alphaRe[i], spectrum.alphaIm[i]));
      const epsilon = particle.epsilon(WAVELENGTHS[i]);
      // Intensidad justo fuera de la punta (sobre el eje del campo), donde es máxima.
      const pole = spheroidNearField({ longRadius: long, shortRadius: short, epsilon, epsilonMedium }, long * (1 + 1e-9), 0);
      maxPoleIntensity = Math.max(maxPoleIntensity, pole.intensity);
      if (particle.shape === 'sphere') {
        quasiStatic[i] = quasiStaticSphere({ radius: short, wavelength: WAVELENGTHS[i], epsilon, mediumIndex: particle.mediumIndex }).cext;
      }
    }
    const peak = refinedPeak(spectrum.cext, (wavelength) => particleResponse(particle, wavelength).cext);
    const qsPeak =
      particle.shape === 'sphere'
        ? refinedPeak(quasiStatic, (wavelength) =>
            quasiStaticSphere({ radius: short, wavelength, epsilon: particle.epsilon(wavelength), mediumIndex: particle.mediumIndex }).cext,
          )
        : null;
    cache = { key, spectrum, peak, quasiStaticPeak: qsPeak && qsPeak.interior ? qsPeak.x : null, maxAlpha, maxPoleIntensity };
    return cache;
  }

  // --- Dibujo de cada vista ---------------------------------------------------------------

  /** @param {import('../types.js').State} state */
  function renderState(state) {
    const colors = ctx.theme.colors();
    const particle = particleOf(state);
    const lambda = Number(state.lambda);
    const isRod = particle.shape === 'rod';
    const { long, short } = semiAxes(particle);
    const { spectrum, peak, quasiStaticPeak, maxAlpha, maxPoleIntensity } = spectrumOf(state, particle);
    const now = particleResponse(particle, lambda);
    const epsilon = particle.epsilon(lambda);
    const x = sizeParameter(long, lambda, particle.mediumIndex);
    const name = materialNames[String(state.material)];

    // Línea de modelo y validez.
    if (isRod) {
      const length = 2 * long;
      const tooBig = x > QUASISTATIC_LIMIT;
      modelLine.textContent =
        `Bastón de ${name.toLowerCase()} de ${formatEs(length, 0)} × ${formatEs(particle.diameter, 0)} nm · teoría de Gans (aproximación cuasiestática, promedio de orientaciones): ` +
        (tooBig
          ? `⚠ el bastón ya no es mucho menor que la longitud de onda (x = ${formatEs(x)}); el resultado es solo orientativo.`
          : `vale porque el bastón es mucho menor que la longitud de onda (x = ${formatEs(x)}).`);
      modelLine.dataset.warning = String(tooBig);
    } else {
      modelLine.textContent =
        `Esfera de ${name.toLowerCase()} de ${formatEs(particle.diameter, 0)} nm · teoría de Mie (exacta para una esfera) · parámetro de tamaño x = 2π·n·a/λ = ${formatEs(x)}` +
        (x > QUASISTATIC_LIMIT ? ' · el mapa de campo cercano usa la aproximación dipolar cuasiestática: aquí es solo orientativo.' : '');
      modelLine.dataset.warning = 'false';
    }

    // (a) Espectros: extinción = absorción + dispersión, con el visible coloreado debajo.
    // Las partículas grandes tienen secciones eficaces de decenas de miles de nm²: se
    // dibujan en miles de nm² para que los números del eje sigan siendo cortos.
    const unit = Math.max(peak.y, now.cext) >= 2e4 ? 1000 : 1;
    /** @param {Float64Array} values */
    const scaled = (values) => (unit === 1 ? values : values.map((v) => v / unit));
    /** @type {import('../../ui/plot2d.js').Area[]} */
    const slices = [];
    for (let start = VISIBLE[0]; start < VISIBLE[1]; start += VISIBLE_SLICE) {
      const i0 = Math.round((start - LAMBDA_RANGE[0]) / LAMBDA_STEP);
      const i1 = Math.round((start + VISIBLE_SLICE - LAMBDA_RANGE[0]) / LAMBDA_STEP);
      const [r, g, b] = engine.wavelengthToSrgb(start + VISIBLE_SLICE / 2, 1.6);
      slices.push({
        x: spectrum.wavelengths.subarray(i0, i1 + 1),
        y: scaled(spectrum.cext.subarray(i0, i1 + 1)),
        color: `rgb(${Math.round(255 * r)}, ${Math.round(255 * g)}, ${Math.round(255 * b)})`,
        opacity: 0.6,
      });
    }
    /** @type {import('../../ui/plot2d.js').Marker[]} */
    const markers = [];
    if (peak.interior) markers.push({ x: peak.x, color: colors.textSoft, dash: [5, 4], label: `pico: ${formatEs(peak.x, 0)} nm` });
    if (quasiStaticPeak !== null && peak.interior && Math.abs(quasiStaticPeak - peak.x) > 4) {
      markers.push({ x: quasiStaticPeak, color: colors.textSoft, dash: [2, 4], label: `sin retardo: ${formatEs(quasiStaticPeak, 0)} nm` });
    }
    markers.push({ x: lambda, label: `λ = ${formatEs(lambda, 0)} nm` });
    spectrumPanel.title.textContent =
      'Espectros · ' +
      (peak.interior ? `pico de extinción en ${formatEs(peak.x, 0)} nm` : 'sin pico de extinción en este intervalo') +
      ` · en λ = ${formatEs(lambda, 0)} nm: ${formatEs((100 * now.cabs) / now.cext, 0)} % absorción, ${formatEs((100 * now.csca) / now.cext, 0)} % dispersión`;
    spectrumPlot.draw({
      yRange: [0, (1.1 * Math.max(peak.y, now.cext)) / unit],
      yLabel: unit === 1 ? 'sección eficaz (nm²)' : 'sección eficaz (miles de nm²)',
      areas: slices,
      series: [
        { x: spectrum.wavelengths, y: scaled(spectrum.cext), color: colors.text, width: 1.2, label: 'Extinción' },
        { x: spectrum.wavelengths, y: scaled(spectrum.cabs), color: 1, label: 'Absorción (calor)' },
        { x: spectrum.wavelengths, y: scaled(spectrum.csca), color: 0, dash: [6, 4], label: 'Dispersión (misma λ)' },
        { x: [lambda], y: [now.cext / unit], color: colors.text, points: true, line: false },
      ],
      vlines: markers,
    });

    // (b) Color: cubeta a contraluz (lo que queda) y luz dispersada (lo que sale de lado).
    const sample = colloidSpectra(spectrum, {
      volumeFraction: Number(state.conc) * 1e-6,
      pathLength: Number(state.path) * 1e6, // mm → nm
    });
    const visibleSpectrum = { wavelengths: spectrum.wavelengths };
    const transmitted = engine.colorOf({ ...visibleSpectrum, values: sample.transmittance });
    const scattered = engine.colorOfScattered({ ...visibleSpectrum, values: sample.scattered });
    cuvette.style.background = transmitted.css;
    glow.style.background = `radial-gradient(closest-side, ${scattered.css} 35%, transparent 100%)`;
    transmittedCaption.textContent = `transmite el ${formatEs(100 * transmitted.XYZ[1], 0)} % de la luz`;
    const albedo = peak.y > 0 ? spectrum.csca[peak.index] / spectrum.cext[peak.index] : 0;
    scatteredCaption.textContent = `${formatEs(100 * albedo, albedo < 0.1 ? 1 : 0)} % de la extinción en el máximo`;
    colorNote.textContent =
      `Absorbancia máxima ${formatEs(sample.peakAbsorbance)} · ${formatScientific(sample.numberDensity * 1e21)} partículas/mL` +
      (transmitted.inGamut && scattered.inGamut ? '' : ' · color más saturado de lo que la pantalla puede mostrar (recortado)');

    // (c) Nube electrónica: amplitud y desfase de la oscilación forzada, de α(ω).
    const oscillation = drivenOscillation(now.alpha);
    const relativeAmplitude = maxAlpha > 0 ? oscillation.amplitude / maxAlpha : 0;
    const degrees = (oscillation.phase * 180) / Math.PI;
    cloud = { amplitude: relativeAmplitude, phase: oscillation.phase, lambda, aspect: long / short, tint: METAL_TINT[String(state.material)] ?? METAL_TINT.Au };
    cloudPanel.title.textContent = `Nube electrónica · amplitud ${formatEs(100 * relativeAmplitude, 0)} % del máximo · desfase δ = ${formatEs(degrees, 0)}°`;
    cloudView.render();

    // (d) Campo cercano en un plano que contiene al eje del campo (aproximación
    // electrostática). Convenio de plot2d: los rangos son bordes; cada valor, un centro de celda.
    const halfWidth = long + 2 * short;
    const halfHeight = Math.max(2.4 * short, 0.85 * halfWidth);
    const nx = FIELD_COLUMNS;
    const ny = Math.max(24, Math.round((nx * halfHeight) / halfWidth));
    const spheroid = { longRadius: long, shortRadius: short, epsilon, epsilonMedium: particle.mediumIndex ** 2 };
    const values = new Float32Array(nx * ny);
    for (let iy = 0; iy < ny; iy++) {
      const rho = Math.abs(-halfHeight + ((iy + 0.5) * 2 * halfHeight) / ny);
      for (let ix = 0; ix < nx; ix++) {
        const z = -halfWidth + ((ix + 0.5) * 2 * halfWidth) / nx;
        values[iy * nx + ix] = Math.log10(Math.max(1e-3, spheroidNearField(spheroid, z, rho).intensity));
      }
    }
    const poleNow = spheroidNearField(spheroid, long * (1 + 1e-9), 0).intensity;
    const outline = Array.from({ length: 121 }, (_, i) => (2 * Math.PI * i) / 120);
    const poleText = poleNow >= 1e4 ? formatScientific(poleNow) : formatEs(poleNow, poleNow < 10 ? 1 : 0);
    fieldPanel.title.textContent = `Campo cercano · |E|²/|E₀|² = ${poleText} en las puntas`;
    fieldPlot.draw({
      heatmap: {
        nx,
        ny,
        values,
        xRange: [-halfWidth, halfWidth],
        yRange: [-halfHeight, halfHeight],
        colormap: colormaps.magma,
        vmin: -1,
        // Escala fija para toda la partícula (no cambia al mover λ): hasta el máximo que
        // alcanza la punta en todo el espectro. Así se ve crecer el campo al acercarse a
        // la resonancia.
        vmax: Math.max(1, Math.ceil(2 * Math.log10(maxPoleIntensity)) / 2),
        label: 'log₁₀(|E|²/|E₀|²)',
      },
      series: [{ x: outline.map((t) => long * Math.cos(t)), y: outline.map((t) => short * Math.sin(t)), color: '#8fe3ff', width: 0.8 }],
    });

    // (e) Diagrama polar: |S₁|² y |S₂|² normalizados al valor hacia delante. La esfera usa
    // Mie; el bastón (cuasiestático) radia como un dipolo: |S₁|² constante, |S₂|² ∝ cos²θ.
    /** @type {number[]} */
    let s1;
    /** @type {number[]} */
    let s2;
    let asymmetry = 0;
    if (isRod) {
      s1 = POLAR_ANGLES.map(() => 1);
      s2 = POLAR_ANGLES.map((angle) => Math.cos((angle * Math.PI) / 180) ** 2);
    } else {
      const result = mieSphere({ radius: short, wavelength: lambda, epsilon, mediumIndex: particle.mediumIndex, anglesDeg: POLAR_ANGLES });
      s1 = result.s1.map((s) => s.re * s.re + s.im * s.im);
      s2 = result.s2.map((s) => s.re * s.re + s.im * s.im);
      asymmetry = result.g;
    }
    const top = Math.max(...s1, ...s2);
    /** Curva cerrada r(θ) en coordenadas cartesianas (θ de 0° a 360°, simétrica). @param {number[]} r */
    const closed = (r) => {
      const xs = [];
      const ys = [];
      for (let i = 0; i < 2 * POLAR_ANGLES.length - 1; i++) {
        const j = i < POLAR_ANGLES.length ? i : 2 * POLAR_ANGLES.length - 2 - i;
        const theta = ((i < POLAR_ANGLES.length ? POLAR_ANGLES[j] : 360 - POLAR_ANGLES[j]) * Math.PI) / 180;
        xs.push((r[j] / top) * Math.cos(theta));
        ys.push((r[j] / top) * Math.sin(theta));
      }
      return { x: xs, y: ys };
    };
    polarPanel.title.textContent = isRod
      ? 'Dispersión angular · dipolo: igual hacia atrás que hacia delante'
      : `Dispersión angular · atrás/delante = ${formatEs((100 * s1[s1.length - 1]) / s1[0], 0)} % · g = ${formatEs(asymmetry)}`;
    polarPlot.draw({
      series: [
        { ...closed(s1), color: 0, label: '|S₁|²: polarización ⊥ al plano' },
        { ...closed(s2), color: 1, label: '|S₂|²: polarización ∥ al plano' },
      ],
    });
  }

  /**
   * Dibuja la partícula con su nube electrónica en el instante actual del reloj.
   * @param {CanvasRenderingContext2D} g
   * @param {number} width
   * @param {number} height
   * @param {number} fs tamaño de letra (px)
   * @param {string} family
   */
  function drawCloud(g, width, height, fs, family) {
    const colors = ctx.theme.colors();
    const forceColor = colors.series[1];
    const cloudColor = colors.series[0];
    g.fillStyle = colors.surface;
    g.fillRect(0, 0, width, height);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Fase de la luz: un periodo dura más cuanto mayor es λ (la frecuencia baja).
    const period = (SECONDS_PER_PERIOD * cloud.lambda) / 550;
    const angle = (2 * Math.PI * ctx.clock.time) / period;
    const force = Math.cos(angle); // fuerza sobre los electrones, −eE(t), normalizada
    const displacement = cloud.amplitude * Math.cos(angle - cloud.phase);

    // Reparto: partícula a la izquierda (o arriba, si el panel es estrecho) y fasores al lado.
    const wide = width >= 22 * fs;
    const particleBox = wide ? { x: 0, y: 0, w: width * 0.58, h: height } : { x: 0, y: 0, w: width, h: height * 0.56 };
    const phasorBox = wide
      ? { x: width * 0.58, y: 0, w: width * 0.42, h: height }
      : { x: 0, y: height * 0.56, w: width, h: height * 0.44 };

    // --- Partícula --------------------------------------------------------------------
    const cx = particleBox.x + particleBox.w / 2;
    const cy = particleBox.y + particleBox.h / 2;
    // Semiejes en píxeles: caben las flechas y sus rótulos por encima y por debajo.
    const rx = Math.min(particleBox.w * 0.3, Math.max(8, particleBox.h * 0.5 - fs * 4.2) * 0.8 * cloud.aspect);
    const ry = rx / cloud.aspect;
    const reach = 0.3 * Math.min(rx, 2 * ry); // desplazamiento máximo dibujado (MUY exagerado)
    const dx = displacement * reach;
    const arrowLength = Math.min(particleBox.w * 0.3, rx * 1.1 + fs);
    const head = fs * 0.75;

    // Iones (fijos).
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    g.fillStyle = cloud.tint;
    g.fill();
    g.lineWidth = Math.max(1.5, fs * 0.12);
    g.strokeStyle = colors.text;
    g.stroke();
    // Nube de electrones de conducción (se desplaza en bloque).
    g.beginPath();
    g.ellipse(cx + dx, cy, rx, ry, 0, 0, 2 * Math.PI);
    g.globalAlpha = 0.34;
    g.fillStyle = cloudColor;
    g.fill();
    g.globalAlpha = 1;
    g.setLineDash([fs * 0.35, fs * 0.3]);
    g.strokeStyle = cloudColor;
    g.stroke();
    g.setLineDash([]);
    // Carga que asoma en cada extremo: − donde sobresale la nube, + donde quedan iones al descubierto.
    g.font = `bold ${fs * 1.15}px ${family}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const strength = Math.min(1, Math.abs(displacement) * 1.6);
    if (strength > 0.04) {
      const side = Math.sign(dx);
      g.globalAlpha = strength;
      for (const offset of [-0.45, 0, 0.45]) {
        const yy = cy + offset * ry;
        const edge = rx * Math.sqrt(Math.max(0, 1 - offset * offset));
        g.fillStyle = cloudColor;
        g.fillText('−', cx + side * (edge + fs * 0.75) + dx, yy);
        g.fillStyle = forceColor;
        g.fillText('+', cx - side * (edge + fs * 0.75), yy);
      }
      g.globalAlpha = 1;
    }

    // Flechas: fuerza (arriba) y desplazamiento de la nube (abajo), a la misma escala relativa.
    g.lineWidth = Math.max(2, fs * 0.2);
    g.font = `${fs * 0.85}px ${family}`;
    g.textBaseline = 'alphabetic';
    const forceY = Math.max(particleBox.y + fs * 2, cy - ry - fs * 1.5);
    g.strokeStyle = forceColor;
    g.fillStyle = forceColor;
    drawArrow(g, cx, forceY, cx + force * arrowLength, forceY, head);
    g.fillText('fuerza sobre los electrones', cx, forceY - fs * 0.8);
    const cloudY = Math.min(particleBox.y + particleBox.h - fs * 2, cy + ry + fs * 1.5);
    g.strokeStyle = cloudColor;
    g.fillStyle = cloudColor;
    drawArrow(g, cx, cloudY, cx + displacement * arrowLength, cloudY, head);
    g.textBaseline = 'top';
    g.fillText('desplazamiento de la nube', cx, cloudY + fs * 0.7);

    // --- Fasores ----------------------------------------------------------------------
    // Cada flecha gira una vuelta por periodo; su proyección horizontal es el valor en
    // este instante. La de la nube va δ por detrás de la de la fuerza.
    const px = phasorBox.x + phasorBox.w / 2;
    const py = phasorBox.y + phasorBox.h / 2 - fs * 0.9;
    const radius = Math.max(10, Math.min(phasorBox.w * 0.36, phasorBox.h * 0.5 - fs * 1.9));
    g.lineWidth = 1;
    g.strokeStyle = colors.grid;
    g.beginPath();
    g.arc(px, py, radius, 0, 2 * Math.PI);
    g.moveTo(px - radius * 1.12, py);
    g.lineTo(px + radius * 1.12, py);
    g.stroke();
    // Arco del desfase, de la flecha de la nube a la de la fuerza (el eje y del lienzo
    // apunta hacia abajo: un ángulo positivo se dibuja con signo menos).
    if (cloud.phase > 0.03) {
      g.strokeStyle = colors.textSoft;
      g.lineWidth = Math.max(1.5, fs * 0.12);
      g.beginPath();
      g.arc(px, py, radius * 0.32, -angle, -(angle - cloud.phase), false);
      g.stroke();
    }
    g.lineWidth = Math.max(2, fs * 0.2);
    g.strokeStyle = forceColor;
    g.fillStyle = forceColor;
    drawArrow(g, px, py, px + radius * Math.cos(angle), py - radius * Math.sin(angle), head);
    const cloudRadius = radius * Math.max(0.04, cloud.amplitude);
    g.strokeStyle = cloudColor;
    g.fillStyle = cloudColor;
    drawArrow(g, px, py, px + cloudRadius * Math.cos(angle - cloud.phase), py - cloudRadius * Math.sin(angle - cloud.phase), head);
    g.fillStyle = colors.text;
    g.font = `${fs * 0.85}px ${family}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(`retraso δ = ${formatEs((cloud.phase * 180) / Math.PI, 0)}°`, px, py + radius + fs * 0.7);
  }

  const offTick = ctx.clock.onTick(() => cloudView.render());

  return {
    update(state) {
      renderState(state);
    },
    destroy() {
      offTick();
      spectrumPlot.destroy();
      fieldPlot.destroy();
      polarPlot.destroy();
      cloudView.destroy();
      grid.remove();
    },
  };
}
