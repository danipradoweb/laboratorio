// @ts-check
// Luz y materia, vista «polarizadores» (parte C): ley de Malus y gafas de sol polarizadas.
//
//   ┌──────────────────────────────┬──────────────────────────────┐
//   │ banco de polarizadores:      │ intensidad que sale frente   │
//   │ fuente, polarizador, (uno    │ al ángulo del analizador     │
//   │ intermedio), analizador      │ (ley de Malus)               │
//   ├──────────────────────────────┼──────────────────────────────┤
//   │ reflejo de luz no polarizada │ lo que llega al ojo: sin     │
//   │ en el material: R_s, R_p y   │ gafas, con gafas grises y    │
//   │ grado de polarización        │ con gafas polarizadas        │
//   └──────────────────────────────┴──────────────────────────────┘
//
// La fila de arriba es un banco óptico ideal. La de abajo usa el material y la energía de
// las otras vistas (el reflejo en agua, por ejemplo) y el ángulo de incidencia.
// Aquí no se calcula física: todo sale de physics-fresnel.js.

import { el } from '../../ui/dom.js';
import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { formatEs } from '../../ui/format.js';
import { encodeSrgb } from '../../color/spectrum.js';
import { brewsterAngle, fresnel, glareThroughGlasses, polarizerChain, unpolarizedReflection } from './physics-fresnel.js';
import { createCanvasView, drawArrow, formatSig } from './view-common.js';

const DEG = Math.PI / 180;
/** Ángulos del analizador para la curva de Malus (grados). */
const ANALYZER_ANGLES = Float64Array.from({ length: 181 }, (_, i) => i);
/** Ángulos de incidencia para las curvas del reflejo (grados). */
const INCIDENCE_ANGLES = Float64Array.from({ length: 181 }, (_, i) => i / 2);
/** Transmisión de las gafas que solo atenúan, para comparar con el polarizador. */
const NEUTRAL_TRANSMISSION = 0.5;

/**
 * Gris de pantalla que corresponde a una intensidad relativa (0–1), con la curva de sRGB.
 * @param {number} intensity
 * @returns {string}
 */
function gray(intensity) {
  const level = Math.round(255 * encodeSrgb(Math.min(1, Math.max(0, intensity))));
  return `rgb(${level}, ${level}, ${level})`;
}

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {import('./view-common.js').PartView}
 */
export function mountPolarizers(container, ctx) {
  const grid = createPanelGrid(container, 'lm-grid-polarizers');

  const benchPanel = addPanel(grid, 'Banco de polarizadores');
  /** @type {{ axes: number[], names: string[], intensities: number[] }} */
  let bench = { axes: [], names: [], intensities: [] };
  const benchView = createCanvasView(
    benchPanel.body,
    'Luz no polarizada que atraviesa dos o tres polarizadores, con la intensidad después de cada uno',
    drawBench,
  );

  const malusPanel = addPanel(grid, 'Ley de Malus');
  const malusPlot = createPlot(malusPanel.body, {
    xLabel: 'ángulo del analizador respecto al primer polarizador (grados)',
    yLabel: 'intensidad que sale (% de la que entra)',
    xRange: [0, 180],
    yRange: [0, 52],
    xTicks: [0, 45, 90, 135, 180],
    exportName: 'luz-materia-malus',
    onPick: (x) => ctx.setState({ analyzer: Math.round(Math.min(180, Math.max(0, x))) }),
  });

  const glarePanel = addPanel(grid, 'Reflejo de luz no polarizada');
  const glarePlot = createPlot(glarePanel.body, {
    xLabel: 'ángulo de incidencia θ (grados)',
    yLabel: '%',
    xRange: [0, 90],
    yRange: [0, 100],
    xTicks: [0, 15, 30, 45, 60, 75, 90],
    exportName: 'luz-materia-reflejo',
    onPick: (x) => ctx.setState({ angle: Number(Math.min(89.5, Math.max(0, x)).toFixed(1)) }),
  });

  const glassesPanel = addPanel(grid, 'Lo que llega al ojo');
  glassesPanel.body.classList.add('lm-glasses');
  /** Una fila por tipo de gafas: muestra de brillo, nombre y número. */
  const rows = ['Sin gafas', 'Gafas grises (dejan pasar el 50 %)', 'Gafas polarizadas (eje vertical)'].map((name) => {
    const swatch = el('div', { class: 'lm-glasses-swatch' });
    const bar = el('div', { class: 'lm-glasses-bar' });
    const value = el('span', { class: 'lm-glasses-value' });
    const row = el(
      'div',
      { class: 'lm-glasses-row' },
      swatch,
      el('div', { class: 'lm-glasses-text' }, el('strong', { text: name }), value, el('div', { class: 'lm-glasses-track' }, bar)),
    );
    glassesPanel.body.append(row);
    return { swatch, bar, value };
  });
  const glassesNote = el('p', { class: 'lm-note' });
  glassesPanel.body.append(glassesNote);

  /**
   * @param {import('../types.js').State} state
   * @param {import('./view-common.js').PartContext} part
   */
  function update(state, { material, optics }) {
    const colors = ctx.theme.colors();

    // --- Banco de polarizadores ---------------------------------------------------------
    const analyzer = Number(state.analyzer);
    const middle = Number(state.middle);
    const third = Boolean(state.third);
    const axes = third ? [0, middle, analyzer] : [0, analyzer];
    const names = third ? ['polarizador', 'intermedio', 'analizador'] : ['polarizador', 'analizador'];
    const intensities = polarizerChain(axes);
    const out = intensities[intensities.length - 1];
    bench = { axes, names, intensities };
    benchPanel.title.textContent =
      `Banco de polarizadores · entra luz no polarizada · sale el ${formatEs(100 * out, 1)} %` +
      (third ? '' : Math.abs(analyzer - 90) < 0.5 ? ' · polarizadores cruzados: no pasa nada' : '');
    benchView.render();

    // --- Ley de Malus: la salida frente al ángulo del analizador -----------------------
    const curve = ANALYZER_ANGLES.map((a) => {
      const chain = polarizerChain(third ? [0, middle, a] : [0, a]);
      return 100 * chain[chain.length - 1];
    });
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const malusSeries = [];
    if (third) {
      malusSeries.push({
        x: ANALYZER_ANGLES,
        y: ANALYZER_ANGLES.map((a) => 100 * polarizerChain([0, a])[1]),
        color: colors.textSoft,
        dash: [5, 4],
        label: 'sin el intermedio: ½·cos²θ',
      });
    }
    malusSeries.push(
      { x: ANALYZER_ANGLES, y: curve, color: 0, width: 1.4, label: third ? `con el intermedio a ${formatEs(middle, 0)}°` : 'I = ½·I₀·cos²θ' },
      { x: [analyzer], y: [100 * out], color: colors.text, points: true, line: false },
    );
    malusPanel.title.textContent = third
      ? `Tres polarizadores · el intermedio, a ${formatEs(middle, 0)}°, gira la polarización: entre dos cruzados (90°) pasa el ${formatEs(100 * polarizerChain([0, middle, 90])[2], 1)} % en vez de nada`
      : `Ley de Malus · I = I₀·cos²θ tras el analizador (el primer polarizador ya dejó pasar solo la mitad) · a ${formatEs(analyzer, 0)}°: ${formatEs(100 * out, 1)} %`;
    malusPlot.draw({ series: malusSeries, vlines: [{ x: analyzer, label: `${formatEs(analyzer, 0)}°` }] });

    // --- Reflejo de luz no polarizada en el material ---------------------------------------
    const n2 = { re: optics.n, im: optics.k };
    const angle = Number(state.angle);
    const Rs = new Float64Array(INCIDENCE_ANGLES.length);
    const Rp = new Float64Array(INCIDENCE_ANGLES.length);
    const mean = new Float64Array(INCIDENCE_ANGLES.length);
    const degree = new Float64Array(INCIDENCE_ANGLES.length);
    INCIDENCE_ANGLES.forEach((a, i) => {
      const f = fresnel(1, n2, a);
      const u = unpolarizedReflection(f);
      Rs[i] = 100 * f.Rs;
      Rp[i] = 100 * f.Rp;
      mean[i] = 100 * u.reflectance;
      degree[i] = 100 * u.degree;
    });
    const now = fresnel(1, n2, angle);
    const reflection = unpolarizedReflection(now);
    const glare = glareThroughGlasses(now, NEUTRAL_TRANSMISSION);
    /** @type {import('../../ui/plot2d.js').Marker[]} */
    const markers = [{ x: angle, label: `θ = ${formatEs(angle, 1)}°` }];
    const transparent = optics.k < 0.02 * optics.n;
    if (transparent) {
      const brewster = brewsterAngle(1, optics.n);
      markers.unshift({ x: brewster, color: colors.textSoft, dash: [5, 4], label: `Brewster ${formatEs(brewster, 1)}°` });
    }
    glarePanel.title.textContent =
      `Reflejo de luz no polarizada en ${material.name} (n = ${formatSig(optics.n)}) · en θ = ${formatEs(angle, 1)}° se refleja el ${formatEs(100 * reflection.reflectance, 1)} %` +
      ` y sale polarizado al ${formatEs(100 * reflection.degree, 0)} % (en horizontal, paralelo a la superficie)`;
    glarePlot.draw({
      series: [
        { x: INCIDENCE_ANGLES, y: degree, color: 2, width: 1.4, label: 'grado de polarización del reflejo' },
        { x: INCIDENCE_ANGLES, y: Rs, color: 0, label: 'R_s (horizontal)' },
        { x: INCIDENCE_ANGLES, y: Rp, color: 1, label: 'R_p (vertical)' },
        { x: INCIDENCE_ANGLES, y: mean, color: colors.text, dash: [5, 4], label: 'reflejo total, (R_s + R_p)/2' },
      ],
      vlines: markers,
    });

    // --- Lo que llega al ojo ------------------------------------------------------------------
    // Brillo del reflejo con cada tipo de gafas, respecto al reflejo sin gafas (la barra) y
    // como fracción de la luz que incide en la superficie (el número).
    const values = [glare.bare, glare.neutral, glare.polarized];
    values.forEach((value, i) => {
      const relative = glare.bare > 0 ? value / glare.bare : 0;
      rows[i].swatch.style.background = gray(relative);
      rows[i].bar.style.width = `${Math.round(1000 * relative) / 10}%`;
      rows[i].value.textContent = `${formatEs(100 * value, 2)} % de la luz que incide · ${formatEs(100 * relative, 0)} % del reflejo`;
    });
    glassesPanel.title.textContent = `Lo que llega al ojo del reflejo · el polarizador de eje vertical deja pasar el ${formatEs(100 * glare.passedFraction, 0)} % del reflejo; las gafas grises, el ${formatEs(100 * NEUTRAL_TRANSMISSION, 0)} %`;
    glassesNote.textContent =
      'Las dos gafas oscurecen igual el resto de la escena (luz no polarizada: pasa la mitad). La diferencia está en el reflejo, que llega polarizado en horizontal: el polarizador vertical lo bloquea.';
  }

  /**
   * Banco óptico: la luz va de izquierda a derecha.
   * @param {CanvasRenderingContext2D} g
   * @param {number} width
   * @param {number} height
   * @param {number} fs
   * @param {string} family
   */
  function drawBench(g, width, height, fs, family) {
    const colors = ctx.theme.colors();
    g.fillStyle = colors.surface;
    g.fillRect(0, 0, width, height);
    const { axes, names, intensities } = bench;
    if (axes.length === 0) return;
    g.lineCap = 'round';
    const cy = height * 0.47;
    const left = fs * 2.2;
    const right = width - fs * 4.2;
    const count = axes.length;
    /** Posición x de cada polarizador. */
    const xs = axes.map((_, i) => left + ((i + 1) * (right - left)) / (count + 1));
    const radius = Math.min(height * 0.27, (right - left) / (count + 1) / 2.4);
    const beam = radius * 0.5;
    const beamColor = colors.series[1];

    // Tramos del haz: su opacidad es la intensidad (1 = la que entra).
    const stops = [left, ...xs, right];
    const levels = [1, ...intensities];
    for (let i = 0; i < stops.length - 1; i++) {
      g.globalAlpha = 0.12 + 0.75 * levels[i];
      g.fillStyle = beamColor;
      g.fillRect(stops[i], cy - beam / 2, stops[i + 1] - stops[i], beam);
      g.globalAlpha = 1;
      // Intensidad y dirección de la polarización en este tramo.
      const mx = (stops[i] + stops[i + 1]) / 2;
      g.fillStyle = colors.text;
      g.font = `${fs * 0.85}px ${family}`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(`${formatEs(100 * levels[i], 1)} %`, mx, cy - radius - fs * 0.35);
      g.strokeStyle = colors.text;
      g.fillStyle = colors.text;
      g.lineWidth = Math.max(1.5, fs * 0.14);
      const arrow = beam * 0.85;
      if (i === 0) {
        // No polarizada: el campo apunta en todas las direcciones.
        for (const a of [0, 45, 90, 135]) {
          const dx = Math.sin(a * DEG) * arrow;
          const dy = Math.cos(a * DEG) * arrow;
          g.beginPath();
          g.moveTo(mx - dx, cy + dy);
          g.lineTo(mx + dx, cy - dy);
          g.stroke();
        }
      } else if (levels[i] > 1e-4) {
        // Polarizada según el eje del polarizador que acaba de cruzar (ángulo desde la vertical).
        const a = axes[i - 1] * DEG;
        const size = arrow * Math.max(0.35, Math.sqrt(levels[i] / 0.5));
        const dx = Math.sin(a) * size;
        const dy = Math.cos(a) * size;
        drawArrow(g, mx - dx, cy + dy, mx + dx, cy - dy, fs * 0.6);
        drawArrow(g, mx + dx, cy - dy, mx - dx, cy + dy, fs * 0.6);
      }
    }

    // Polarizadores: un disco visto casi de frente, con su eje.
    xs.forEach((x, i) => {
      g.beginPath();
      g.ellipse(x, cy, radius * 0.55, radius, 0, 0, 2 * Math.PI);
      g.globalAlpha = 0.25;
      g.fillStyle = colors.textSoft;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = colors.text;
      g.lineWidth = 1.5;
      g.stroke();
      const a = axes[i] * DEG;
      g.strokeStyle = colors.accent;
      g.lineWidth = Math.max(2.5, fs * 0.22);
      g.beginPath();
      g.moveTo(x - Math.sin(a) * radius * 0.5, cy + Math.cos(a) * radius * 0.92);
      g.lineTo(x + Math.sin(a) * radius * 0.5, cy - Math.cos(a) * radius * 0.92);
      g.stroke();
      g.fillStyle = colors.text;
      g.font = `${fs * 0.85}px ${family}`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillText(names[i], x, cy + radius + fs * 0.4);
      g.fillStyle = colors.textSoft;
      g.fillText(`eje a ${formatEs(axes[i], 0)}°`, x, cy + radius + fs * 1.55);
    });

    // Fuente y pantalla.
    g.fillStyle = colors.textSoft;
    g.font = `${fs * 0.8}px ${family}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('luz no polarizada', fs * 0.4, cy + radius + fs * 0.4);
    const out = intensities[intensities.length - 1];
    const side = Math.min(radius * 1.5, fs * 3.4);
    g.fillStyle = gray(out);
    g.fillRect(right + fs * 0.3, cy - side / 2, side, side);
    g.strokeStyle = colors.text;
    g.lineWidth = 1;
    g.strokeRect(right + fs * 0.3, cy - side / 2, side, side);
    g.fillStyle = colors.textSoft;
    g.textAlign = 'center';
    g.fillText('pantalla', right + fs * 0.3 + side / 2, cy + radius + fs * 0.4);
  }

  return {
    update,
    destroy() {
      malusPlot.destroy();
      glarePlot.destroy();
      benchView.destroy();
      grid.remove();
    },
  };
}
