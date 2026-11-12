// @ts-check
// Luz y materia, vista «interfaz» (parte C): incidencia oblicua sobre una superficie.
//
//   ┌───────────────────────────────┬──────────────────────────────┐
//   │ R y T frente al ángulo, con   │ rayos y dipolos: incidente,  │
//   │ Brewster y el ángulo crítico  │ reflejado y refractado; los  │
//   ├───────────────────────────────┤ dipolos del material y su    │
//   │ mapa de las ondas (animado):  │ diagrama de radiación        │
//   │ incidente + reflejada arriba, │ (animado)                    │
//   │ transmitida o evanescente     │                              │
//   │ abajo                         │                              │
//   └───────────────────────────────┴──────────────────────────────┘
//
// El material y la energía del fotón son los de las otras vistas: de ellos sale el índice
// n + ik. La luz puede venir del aire («fuera») o de dentro del material («dentro», que es
// donde hay reflexión total). Aquí no se calcula física: todo sale de physics-fresnel.js.

import { addPanel, createPanelGrid } from '../../ui/panels.js';
import { createPlot } from '../../ui/plot2d.js';
import { colormaps } from '../../ui/colormaps.js';
import { formatEs } from '../../ui/format.js';
import {
  brewsterAngle,
  brewsterGeometry,
  criticalAngle,
  fresnel,
  minimumRp,
  penetrationDepth,
  refractionAngle,
  transverseField,
} from './physics-fresnel.js';
import { SECONDS_PER_PERIOD, createCanvasView, drawArrow, formatSig } from './view-common.js';

const DEG = Math.PI / 180;
/** Ángulos de las curvas (grados). */
const ANGLES = Float64Array.from({ length: 361 }, (_, i) => i / 4);
/** Mapa de las ondas: semiancho y semialto (en λ₀) y número de celdas. */
const MAP_HALF_WIDTH = 2.4;
const MAP_HALF_HEIGHT = 1.5;
const MAP_NX = 168;
const MAP_NY = 105;
/** Un medio cuenta como transparente (para Brewster y para los dipolos) si k/n es menor que esto. */
const TRANSPARENT_RATIO = 0.02;

/**
 * Los dos medios según el estado: de dónde viene la luz y adónde va.
 * @param {import('../types.js').State} state
 * @param {import('./view-common.js').PartContext} part
 */
export function mediaOf(state, { material, optics }) {
  const inside = state.side === 'dentro';
  const transparent = optics.k < TRANSPARENT_RATIO * optics.n;
  return inside
    ? {
        inside,
        transparent,
        n1: optics.n,
        n2: { re: 1, im: 0 },
        name1: material.name,
        name2: 'aire',
        // Una onda plana que viaja por un medio absorbente se atenúa antes de llegar: aquí se
        // toma solo la parte real del índice del medio de incidencia, y se avisa.
        warning: transparent ? '' : `⚠ el ${material.name} absorbe a esta frecuencia: la luz no llegaría desde dentro; se ignora su absorción`,
      }
    : { inside, transparent, n1: 1, n2: { re: optics.n, im: optics.k }, name1: 'aire', name2: material.name, warning: '' };
}

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {import('./view-common.js').PartView}
 */
export function mountInterface(container, ctx) {
  const grid = createPanelGrid(container, 'lm-grid-interface');

  /** Un clic en la gráfica fija el ángulo de incidencia. @param {number} x */
  const pickAngle = (x) => ctx.setState({ angle: Number(Math.min(89.5, Math.max(0, x)).toFixed(1)) });

  const curvesPanel = addPanel(grid, 'Reflexión y transmisión', { area: 'curvas' });
  const curvesPlot = createPlot(curvesPanel.body, {
    xLabel: 'ángulo de incidencia θ (grados)',
    yLabel: 'potencia (%)',
    xRange: [0, 90],
    yRange: [0, 100],
    xTicks: [0, 15, 30, 45, 60, 75, 90],
    exportName: 'luz-materia-fresnel',
    onPick: pickAngle,
  });
  const mapPanel = addPanel(grid, 'Mapa de las ondas', { area: 'mapa' });
  const mapPlot = createPlot(mapPanel.body, {
    xLabel: 'x (λ₀)',
    yLabel: 'altura (λ₀)',
    equalAspect: true,
    legend: false,
    exportName: 'luz-materia-mapa-ondas',
  });
  const raysPanel = addPanel(grid, 'Rayos y dipolos', { area: 'rayos' });
  const raysView = createCanvasView(
    raysPanel.body,
    'Rayos incidente, reflejado y refractado, con los dipolos del material y su diagrama de radiación',
    drawRays,
  );

  /** Lo que las animaciones necesitan del último estado. */
  /** @type {{ result: ReturnType<typeof fresnel>, pol: 's' | 'p', media: ReturnType<typeof mediaOf>, fieldRe: Float32Array, fieldIm: Float32Array, geometry: ReturnType<typeof brewsterGeometry> | null } | null} */
  let scene = null;
  const mapValues = new Float32Array(MAP_NX * MAP_NY);

  /**
   * @param {import('../types.js').State} state
   * @param {import('./view-common.js').PartContext} part
   */
  function update(state, part) {
    const colors = ctx.theme.colors();
    const media = mediaOf(state, part);
    const { n1, n2 } = media;
    const pol = state.pol === 's' ? 's' : 'p';
    const angle = Number(state.angle);
    const result = fresnel(n1, n2, angle);

    // (1) Curvas frente al ángulo.
    const Rs = new Float64Array(ANGLES.length);
    const Rp = new Float64Array(ANGLES.length);
    const Ts = new Float64Array(ANGLES.length);
    const Tp = new Float64Array(ANGLES.length);
    ANGLES.forEach((a, i) => {
      const f = fresnel(n1, n2, a);
      Rs[i] = 100 * f.Rs;
      Rp[i] = 100 * f.Rp;
      Ts[i] = 100 * f.Ts;
      Tp[i] = 100 * f.Tp;
    });
    /** @type {import('../../ui/plot2d.js').Marker[]} */
    const markers = [];
    const critical = n2.im === 0 ? criticalAngle(n1, n2.re) : null;
    let brewsterText;
    if (n2.im === 0 || media.transparent) {
      const brewster = brewsterAngle(n1, n2.re);
      markers.push({ x: brewster, color: colors.textSoft, dash: [5, 4], label: `Brewster ${formatEs(brewster, 1)}°` });
      brewsterText = `ángulo de Brewster ${formatEs(brewster, 1)}° (R_p = 0)`;
    } else {
      const minimum = minimumRp(n1, n2);
      markers.push({ x: minimum.angle, color: colors.textSoft, dash: [5, 4], label: `mínimo de R_p ${formatEs(minimum.angle, 1)}°` });
      brewsterText = `medio absorbente: R_p solo baja hasta el ${formatEs(100 * minimum.Rp, 1)} % (en ${formatEs(minimum.angle, 1)}°), sin anularse`;
    }
    if (critical !== null) markers.push({ x: critical, color: colors.textSoft, dash: [2, 4], label: `crítico ${formatEs(critical, 1)}°` });
    markers.push({ x: angle, label: `θ = ${formatEs(angle, 1)}°` });
    curvesPanel.title.textContent =
      `Reflexión y transmisión · del ${media.name1} (n = ${formatSig(n1)}) al ${media.name2} (n = ${formatSig(n2.re)}${n2.im > 0 ? ` + ${formatSig(n2.im)}i` : ''})` +
      ` · en θ = ${formatEs(angle, 1)}°: R_s = ${formatEs(100 * result.Rs, 1)} %, R_p = ${formatEs(100 * result.Rp, 1)} % · ${brewsterText}` +
      (critical !== null ? ` · ángulo crítico ${formatEs(critical, 1)}°` : '') +
      (media.warning ? ` · ${media.warning}` : '');
    curvesPlot.draw({
      series: [
        { x: ANGLES, y: Rs, color: 0, width: pol === 's' ? 1.5 : 1, label: 'R_s (campo ⊥ al plano de incidencia)' },
        { x: ANGLES, y: Rp, color: 1, width: pol === 'p' ? 1.5 : 1, label: 'R_p (campo en el plano de incidencia)' },
        { x: ANGLES, y: Ts, color: 0, dash: [5, 4], width: 0.8, label: 'T_s' },
        { x: ANGLES, y: Tp, color: 1, dash: [5, 4], width: 0.8, label: 'T_p' },
        { x: [angle], y: [100 * (pol === 's' ? result.Rs : result.Rp)], color: colors.text, points: true, line: false },
      ],
      vlines: markers,
    });

    // (2) Mapa de las ondas: campo transversal en una malla (convenio de plot2d: los
    // rangos son bordes y cada valor está en el centro de su celda). Arriba (y > 0), el
    // medio de incidencia; la profundidad es z = −y.
    const fieldRe = new Float32Array(MAP_NX * MAP_NY);
    const fieldIm = new Float32Array(MAP_NX * MAP_NY);
    for (let iy = 0; iy < MAP_NY; iy++) {
      const y = -MAP_HALF_HEIGHT + ((iy + 0.5) * 2 * MAP_HALF_HEIGHT) / MAP_NY;
      for (let ix = 0; ix < MAP_NX; ix++) {
        const x = -MAP_HALF_WIDTH + ((ix + 0.5) * 2 * MAP_HALF_WIDTH) / MAP_NX;
        const f = transverseField(result, pol, x, -y);
        fieldRe[iy * MAP_NX + ix] = f.re;
        fieldIm[iy * MAP_NX + ix] = f.im;
      }
    }
    const depth = penetrationDepth(result);
    mapPanel.title.textContent =
      `Mapa de las ondas (${pol === 's' ? 'campo eléctrico E_y' : 'campo magnético H_y'}, la componente perpendicular al dibujo)` +
      ` · arriba, ${media.name1}; abajo, ${media.name2}` +
      (result.total
        ? ` · reflexión total: abajo queda una onda evanescente que cae a 1/e en ${formatSig(depth)} λ₀`
        : depth < 20
          ? ` · abajo la onda se atenúa: cae a 1/e en ${formatSig(depth)} λ₀`
          : '');

    // (3) Rayos y dipolos.
    const showDipoles = !media.inside && media.transparent;
    const geometry = n2.im === 0 || media.transparent ? (result.kx <= n2.re ? brewsterGeometry(n1, n2.re, angle) : null) : null;
    const refraction = refractionAngle(result);
    let raysText = `Rayos y dipolos · polarización ${pol}`;
    if (result.total) raysText += ' · reflexión total: no hay rayo refractado';
    else if (depth < 1) raysText += ` · la onda que entra se absorbe en ${formatSig(depth)} λ₀: no hay rayo refractado que seguir`;
    else {
      raysText += ` · refractado a ${formatEs(refraction, 1)}° de la normal`;
      if (geometry) raysText += ` · reflejado y refractado forman ${formatEs(180 - angle - geometry.refraction, 1)}°`;
    }
    if (showDipoles && geometry && pol === 'p') {
      raysText += ` · el rayo reflejado está a ${formatEs(geometry.axisToReflected, 1)}° del eje de los dipolos: hacia allí radian sen² = ${formatEs(geometry.pattern, 3)} de su máximo`;
    } else if (showDipoles && pol === 's') {
      raysText += ' · los dipolos oscilan perpendiculares al dibujo y radian igual en todas las direcciones del plano';
    } else if (media.inside) {
      raysText += ' · del lado del aire no hay dipolos que dibujar';
    }
    raysPanel.title.textContent = raysText;

    scene = { result, pol, media, fieldRe, fieldIm, geometry: showDipoles ? geometry : null };
    renderFrame();
  }

  /** Dibuja el instante actual del mapa y de los rayos. */
  function renderFrame() {
    if (!scene) return;
    const colors = ctx.theme.colors();
    const angle = (2 * Math.PI * ctx.clock.time) / SECONDS_PER_PERIOD;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { fieldRe, fieldIm, result } = scene;
    for (let i = 0; i < mapValues.length; i++) mapValues[i] = fieldRe[i] * cos + fieldIm[i] * sin;
    /** @type {import('../../ui/plot2d.js').Series[]} */
    const overlays = [{ x: [-MAP_HALF_WIDTH, MAP_HALF_WIDTH], y: [0, 0], color: colors.text, width: 1.2 }];
    const depth = penetrationDepth(result);
    if (Number.isFinite(depth) && depth < MAP_HALF_HEIGHT) {
      overlays.push({ x: [-MAP_HALF_WIDTH, MAP_HALF_WIDTH], y: [-depth, -depth], color: colors.text, dash: [4, 4], width: 0.8 });
    }
    mapPlot.draw({
      heatmap: {
        nx: MAP_NX,
        ny: MAP_NY,
        values: mapValues,
        xRange: [-MAP_HALF_WIDTH, MAP_HALF_WIDTH],
        yRange: [-MAP_HALF_HEIGHT, MAP_HALF_HEIGHT],
        colormap: colormaps.divergente,
        vmin: -2,
        vmax: 2,
        label: 'campo / incidente',
      },
      series: overlays,
    });
    raysView.render();
  }

  /**
   * Rayos, campos y dipolos en el instante actual.
   * @param {CanvasRenderingContext2D} g
   * @param {number} width
   * @param {number} height
   * @param {number} fs
   * @param {string} family
   */
  function drawRays(g, width, height, fs, family) {
    const colors = ctx.theme.colors();
    g.fillStyle = colors.surface;
    g.fillRect(0, 0, width, height);
    if (!scene) return;
    const { result, pol, media, geometry } = scene;
    const time = (2 * Math.PI * ctx.clock.time) / SECONDS_PER_PERIOD;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const cx = width / 2;
    const cy = height * 0.5;
    const length = Math.max(40, Math.min(width * 0.46, height * 0.44) - fs);
    const incidentColor = colors.series[1];
    const reflectedColor = colors.series[3];
    const refractedColor = colors.series[0];
    const dipoleColor = colors.series[2];
    const head = fs * 0.8;

    // Los dos medios y la normal.
    g.fillStyle = colors.textSoft;
    g.globalAlpha = 0.13;
    g.fillRect(0, media.inside ? 0 : cy, width, media.inside ? cy : height - cy);
    g.globalAlpha = 1;
    g.strokeStyle = colors.text;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, cy);
    g.lineTo(width, cy);
    g.stroke();
    g.strokeStyle = colors.textSoft;
    g.lineWidth = 1;
    g.setLineDash([4, 5]);
    g.beginPath();
    g.moveTo(cx, cy - length);
    g.lineTo(cx, cy + length);
    g.stroke();
    g.setLineDash([]);
    g.font = `${fs * 0.85}px ${family}`;
    g.fillStyle = colors.textSoft;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillText(`${media.name1} · n = ${formatSig(media.n1)}`, fs * 0.6, fs * 0.5);
    g.textBaseline = 'bottom';
    g.fillText(`${media.name2} · n = ${formatSig(media.n2.re)}${media.n2.im > 0 ? ` + ${formatSig(media.n2.im)}i` : ''}`, fs * 0.6, height - fs * 0.5);

    const theta = result.theta * DEG;
    const thetaT = refractionAngle(result) * DEG;
    // Vectores unitarios en pantalla (x a la derecha, y hacia abajo = hacia dentro del medio 2).
    const incident = { x: Math.sin(theta), y: Math.cos(theta) };
    const reflected = { x: Math.sin(theta), y: -Math.cos(theta) };
    const refracted = { x: Math.sin(thetaT), y: Math.cos(thetaT) };
    const r = pol === 's' ? result.rs : result.rp;
    const t = pol === 's' ? result.ts : result.tp;
    const R = pol === 's' ? result.Rs : result.Rp;
    const T = pol === 's' ? result.Ts : result.Tp;

    /**
     * Un rayo con su campo eléctrico dibujado en tres puntos.
     * @param {{ x: number, y: number }} direction sentido de avance
     * @param {boolean} arriving ¿llega al origen (incidente) o sale de él?
     * @param {number} power fracción de potencia (grosor)
     * @param {{ re: number, im: number }} amplitude amplitud compleja del campo
     * @param {string} color
     * @param {string} label
     * @param {number} index índice del medio por el que viaja (para la fase)
     */
    function ray(direction, arriving, power, amplitude, color, label, index) {
      const sx = arriving ? cx - direction.x * length : cx;
      const sy = arriving ? cy - direction.y * length : cy;
      const ex = arriving ? cx : cx + direction.x * length;
      const ey = arriving ? cy : cy + direction.y * length;
      g.strokeStyle = color;
      g.fillStyle = color;
      g.globalAlpha = power < 1e-4 ? 0.25 : 1;
      g.lineWidth = Math.max(1, fs * (0.08 + 0.22 * Math.sqrt(power)));
      if (power < 1e-4) g.setLineDash([3, 5]);
      const mx = arriving ? (sx + ex) / 2 + direction.x * head : ex;
      const my = arriving ? (sy + ey) / 2 + direction.y * head : ey;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
      drawArrow(g, mx - direction.x * head, my - direction.y * head, mx, my, head);
      g.globalAlpha = 1;
      // Campo eléctrico en tres puntos del rayo: avanza como una onda.
      const magnitude = Math.hypot(amplitude.re, amplitude.im);
      const phase0 = Math.atan2(amplitude.im, amplitude.re);
      const perpendicular = { x: direction.y, y: -direction.x };
      for (const fraction of [0.3, 0.55, 0.8]) {
        const s = arriving ? fraction - 1 : fraction; // distancia al origen, en unidades de `length`
        const px = cx + direction.x * s * length;
        const py = cy + direction.y * s * length;
        // Fase: 2 longitudes de onda (del vacío) a lo largo del rayo dibujado.
        const value = magnitude * Math.cos(2 * Math.PI * 2 * index * s + phase0 - time);
        const size = fs * 1.5 * value;
        g.lineWidth = Math.max(1.5, fs * 0.14);
        if (pol === 'p') {
          if (Math.abs(size) > 1) drawArrow(g, px, py, px + perpendicular.x * size, py + perpendicular.y * size, head * 0.7);
        } else {
          // Campo perpendicular al dibujo: punto (hacia fuera) o aspa (hacia dentro).
          const radius = Math.abs(size) * 0.45 + 1;
          g.beginPath();
          g.arc(px, py, radius, 0, 2 * Math.PI);
          g.stroke();
          if (value >= 0) {
            g.beginPath();
            g.arc(px, py, Math.max(1, radius * 0.3), 0, 2 * Math.PI);
            g.fill();
          } else {
            g.beginPath();
            g.moveTo(px - radius * 0.7, py - radius * 0.7);
            g.lineTo(px + radius * 0.7, py + radius * 0.7);
            g.moveTo(px + radius * 0.7, py - radius * 0.7);
            g.lineTo(px - radius * 0.7, py + radius * 0.7);
            g.stroke();
          }
        }
      }
      // Rótulo en el extremo exterior.
      g.font = `${fs * 0.85}px ${family}`;
      g.textBaseline = 'middle';
      const lx = arriving ? sx : ex;
      const ly = arriving ? sy : ey;
      g.textAlign = lx > cx + 4 ? 'right' : 'left';
      const below = ly > cy;
      g.fillText(label, Math.min(width - fs * 0.5, Math.max(fs * 0.5, lx)), ly + (below ? fs * 0.9 : -fs * 0.9));
    }

    // Diagrama de radiación de un dipolo del material, centrado en el punto de incidencia.
    if (geometry) {
      const lobe = length * 0.42;
      // Eje de los dipolos p: perpendicular al rayo refractado, en el plano del dibujo.
      const axis = { x: Math.cos(thetaT), y: -Math.sin(thetaT) };
      g.beginPath();
      for (let i = 0; i <= 180; i++) {
        const phi = (2 * Math.PI * i) / 180;
        const dx = Math.cos(phi);
        const dy = Math.sin(phi);
        const along = dx * axis.x + dy * axis.y;
        const radius = lobe * (pol === 'p' ? 1 - along * along : 1); // sen² del ángulo con el eje
        if (i === 0) g.moveTo(cx + radius * dx, cy + radius * dy);
        else g.lineTo(cx + radius * dx, cy + radius * dy);
      }
      g.closePath();
      g.globalAlpha = 0.2;
      g.fillStyle = dipoleColor;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = dipoleColor;
      g.lineWidth = 1.2;
      g.stroke();
      if (pol === 'p') {
        // Eje del dipolo (línea de trazos) y el dipolo oscilando sobre él.
        g.setLineDash([5, 4]);
        g.beginPath();
        g.moveTo(cx - axis.x * lobe * 1.25, cy - axis.y * lobe * 1.25);
        g.lineTo(cx + axis.x * lobe * 1.25, cy + axis.y * lobe * 1.25);
        g.stroke();
        g.setLineDash([]);
        const swing = fs * 1.3 * Math.cos(Math.atan2(t.im, t.re) - time);
        g.lineWidth = Math.max(2.5, fs * 0.24);
        g.fillStyle = dipoleColor;
        if (Math.abs(swing) > 1) drawArrow(g, cx - axis.x * swing, cy - axis.y * swing, cx + axis.x * swing, cy + axis.y * swing, head);
        g.font = `${fs * 0.8}px ${family}`;
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('eje de los dipolos', cx + axis.x * lobe * 1.3 + fs * 0.3, cy + axis.y * lobe * 1.3);
      }
      // Cuánto radia el dipolo hacia donde tendría que salir el rayo reflejado.
      const towards = pol === 'p' ? geometry.pattern : 1;
      g.fillStyle = reflectedColor;
      g.beginPath();
      g.arc(cx + reflected.x * lobe * towards, cy + reflected.y * lobe * towards, fs * 0.32, 0, 2 * Math.PI);
      g.fill();
    }

    ray(incident, true, 1, { re: 1, im: 0 }, incidentColor, 'incidente', media.n1);
    ray(reflected, false, R, r, reflectedColor, `reflejado · R = ${formatEs(100 * R, 1)} %`, media.n1);
    // ¿Se apaga la onda nada más entrar? (metal, o material en una resonancia)
    const absorbedAtOnce = !result.total && penetrationDepth(result) < 1;
    if (!result.total && !absorbedAtOnce) {
      ray(refracted, false, T, t, refractedColor, `refractado · T = ${formatEs(100 * T, 1)} %`, result.kz2.re / Math.max(1e-6, Math.cos(thetaT)));
    } else if (absorbedAtOnce) {
      // No hay rayo que dibujar: lo que entra se absorbe en una fracción de longitud de onda.
      const depth = Math.min(length * 0.4, fs * 3);
      const gradient = g.createLinearGradient(0, cy, 0, cy + depth);
      gradient.addColorStop(0, refractedColor);
      gradient.addColorStop(1, 'transparent');
      g.globalAlpha = 0.5;
      g.fillStyle = gradient;
      g.fillRect(cx - length * 0.35, cy, length * 0.9, depth);
      g.globalAlpha = 1;
      g.fillStyle = refractedColor;
      g.font = `${fs * 0.85}px ${family}`;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(`entra el ${formatEs(100 * T, 1)} % y se absorbe en ${formatSig(penetrationDepth(result))} λ₀`, cx - length * 0.35, cy + depth + fs * 0.3);
    } else {
      // Onda evanescente: corre pegada a la superficie y se apaga con la profundidad.
      const depth = Math.min(length * 0.5, fs * 4);
      const gradient = g.createLinearGradient(0, cy, 0, cy + depth);
      gradient.addColorStop(0, refractedColor);
      gradient.addColorStop(1, 'transparent');
      g.globalAlpha = 0.5;
      g.fillStyle = gradient;
      g.fillRect(cx - length * 0.2, cy, length * 1.1, depth);
      g.globalAlpha = 1;
      g.fillStyle = refractedColor;
      g.strokeStyle = refractedColor;
      g.lineWidth = Math.max(1.5, fs * 0.14);
      drawArrow(g, cx + length * 0.2, cy + fs * 0.9, cx + length * 0.6, cy + fs * 0.9, head);
      g.font = `${fs * 0.85}px ${family}`;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText('onda evanescente (no se lleva energía)', cx - length * 0.2, cy + depth + fs * 0.3);
    }

    // Arcos de los ángulos con la normal.
    g.strokeStyle = colors.textSoft;
    g.fillStyle = colors.textSoft;
    g.lineWidth = 1;
    g.font = `${fs * 0.8}px ${family}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const arc = fs * 2.6;
    if (theta > 0.03) {
      g.beginPath();
      g.arc(cx, cy, arc, -Math.PI / 2 - theta, -Math.PI / 2 + theta);
      g.stroke();
      g.fillText('θ', cx - Math.sin(theta / 2) * (arc + fs * 0.7), cy - Math.cos(theta / 2) * (arc + fs * 0.7));
      g.fillText('θ', cx + Math.sin(theta / 2) * (arc + fs * 0.7), cy - Math.cos(theta / 2) * (arc + fs * 0.7));
    }
    if (!result.total && !absorbedAtOnce && thetaT > 0.03) {
      g.beginPath();
      g.arc(cx, cy, arc, Math.PI / 2 - thetaT, Math.PI / 2);
      g.stroke();
      g.fillText('θₜ', cx + Math.sin(thetaT / 2) * (arc + fs * 0.8), cy + Math.cos(thetaT / 2) * (arc + fs * 0.8));
    }
  }

  const offTick = ctx.clock.onTick(() => renderFrame());

  return {
    update,
    destroy() {
      offTick();
      scene = null;
      curvesPlot.destroy();
      mapPlot.destroy();
      raysView.destroy();
      grid.remove();
    },
  };
}
