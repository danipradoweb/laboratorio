// @ts-check
// Luz y materia: lo que comparten las cuatro vistas del módulo.
//
//   - Los materiales del selector: tres modelos de osciladores (vidrio, metal de Drude y
//     un oscilador editable) y dos materiales medidos de la biblioteca (agua y oro).
//   - Un lienzo propio que se ajusta a su contenedor (para lo que el trazador no dibuja).
//   - Ayudantes de dibujo y de texto.
//
// Aquí no hay física: las fórmulas están en physics.js, physics-sheets.js y
// physics-fresnel.js.

import { el } from '../../ui/dom.js';
import { formatEs } from '../../ui/format.js';
import { createOpticalConstants } from '../../materials/dielectric.js';
import { eVToWavelengthNm, wavelengthNmToEV } from '../../core/units.js';
import {
  DRUDE_EXAMPLE,
  GLASS_RELATIVE_DAMPING,
  drudeModel,
  modelEpsilon,
  opticalFunctions,
  sellmeierToLorentz,
  singleOscillatorModel,
} from './physics.js';

/**
 * @typedef {import('../../core/complex.js').Complex} Complex
 * @typedef {import('../types.js').State} State
 * @typedef {import('./physics.js').LorentzModel} LorentzModel
 */

/** Opciones del selector de material. */
export const MATERIAL_OPTIONS = [
  { value: 'vidrio', label: 'Vidrio (sílice): tres osciladores' },
  { value: 'metal', label: 'Metal de Drude: electrones libres' },
  { value: 'editable', label: 'Material editable: un oscilador' },
  { value: 'agua', label: 'Agua (datos medidos)' },
  { value: 'oro', label: 'Oro (datos medidos)' },
];

/** Intervalo del control de energía del fotón (eV). */
export const ENERGY_RANGE = /** @type {const} */ ([0.05, 24]);

/** Segundos reales que dura un periodo de la luz en las animaciones (a velocidad ×1). */
export const SECONDS_PER_PERIOD = 2.4;

/**
 * Ventana que se dibuja de cada material: en energía (eV) y en longitud de onda (nm).
 * Los materiales medidos solo tienen datos en parte del intervalo del control.
 * @type {Record<string, { energy: [number, number], lambda: [number, number] }>}
 */
const WINDOWS = {
  vidrio: { energy: [0, 24], lambda: [50, 1500] },
  metal: { energy: [0, 20], lambda: [60, 1500] },
  editable: { energy: [0, 24], lambda: [50, 1500] },
  agua: { energy: [0, 6.5], lambda: [200, 1500] },
  oro: { energy: [0, 7], lambda: [190, 1500] },
};

/**
 * Material ya preparado para evaluarlo.
 * @typedef {object} ResolvedMaterial
 * @property {string} id valor del selector
 * @property {string} name nombre para los textos, en minúscula
 * @property {'modelo' | 'tabla'} kind modelo de osciladores o tabla medida
 * @property {LorentzModel | null} model el modelo de Lorentz (null en los materiales medidos)
 * @property {string[]} oscillatorNames nombre de cada oscilador del modelo
 * @property {(energy: number) => Complex | null} epsilonAt ε(ħω); null fuera de los datos
 * @property {[number, number]} dataRange energías (eV) entre las que hay datos
 * @property {[number, number]} energyWindow ventana que se dibuja, en eV
 * @property {[number, number]} lambdaWindow ventana que se dibuja, en nm
 * @property {string} source de dónde salen los números (una frase)
 */

/**
 * Datos que el módulo descarga una vez al montarse.
 * @typedef {object} MaterialData
 * @property {number[]} silicaSellmeier coeficientes de Sellmeier de la sílice (Malitson)
 * @property {import('../../materials/dielectric.js').OpticalConstants} water
 * @property {import('../../materials/dielectric.js').OpticalConstants} gold
 */

/**
 * Descarga de la biblioteca lo que necesita el módulo.
 * @param {import('../types.js').ModuleContext} ctx
 * @returns {Promise<MaterialData>}
 */
export async function loadMaterialData(ctx) {
  const [silica, water, gold] = await Promise.all([
    ctx.materials.load('SiO2'),
    ctx.materials.load('H2O'),
    ctx.materials.load('Au'),
  ]);
  // La sílice de la biblioteca es una fórmula de Sellmeier: sus coeficientes son, tal
  // cual, las resonancias de un modelo de Lorentz (ver sellmeierToLorentz).
  const formula = /** @type {any} */ (silica).formula_original;
  if (!formula || !Array.isArray(formula.coeficientes)) {
    throw new Error('luz-materia: data/materials/SiO2.json no trae los coeficientes de Sellmeier');
  }
  return {
    silicaSellmeier: formula.coeficientes,
    water: createOpticalConstants(water),
    gold: createOpticalConstants(gold),
  };
}

/**
 * Material que corresponde al estado.
 * @param {State} state
 * @param {MaterialData} data
 * @returns {ResolvedMaterial}
 */
export function resolveMaterial(state, data) {
  const id = String(state.material);
  const windows = WINDOWS[id] ?? WINDOWS.vidrio;
  /** @param {string} name @param {LorentzModel} model @param {string[]} oscillatorNames @param {string} source */
  const fromModel = (name, model, oscillatorNames, source) => ({
    id,
    name,
    kind: /** @type {const} */ ('modelo'),
    model,
    oscillatorNames,
    epsilonAt: (/** @type {number} */ energy) => modelEpsilon(model, energy),
    dataRange: /** @type {[number, number]} */ ([0, Infinity]),
    energyWindow: windows.energy,
    lambdaWindow: windows.lambda,
    source,
  });
  /** @param {string} name @param {import('../../materials/dielectric.js').OpticalConstants} optical @param {string} source */
  const fromTable = (name, optical, source) => ({
    id,
    name,
    kind: /** @type {const} */ ('tabla'),
    model: null,
    oscillatorNames: [],
    epsilonAt: (/** @type {number} */ energy) => {
      const lambda = eVToWavelengthNm(energy);
      return energy > 0 && optical.covers(lambda) ? optical.epsilon(lambda) : null;
    },
    dataRange: /** @type {[number, number]} */ ([wavelengthNmToEV(optical.range[1]), wavelengthNmToEV(optical.range[0])]),
    energyWindow: windows.energy,
    lambdaWindow: windows.lambda,
    source,
  });

  if (id === 'metal') {
    return fromModel(
      'metal de Drude',
      drudeModel(),
      ['electrones libres'],
      `modelo de Drude con ħω_p = ${formatEs(DRUDE_EXAMPLE.omegaP, 0)} eV y ħγ = ${formatEs(DRUDE_EXAMPLE.gamma, 1)} eV (valores de ejemplo)`,
    );
  }
  if (id === 'editable') {
    const omega0 = Number(state.w0);
    return fromModel(
      'material editable',
      singleOscillatorModel({ omega0, omegaP: Number(state.wp), gamma: Number(state.gamma) }),
      [omega0 === 0 ? 'electrones libres' : 'oscilador'],
      'un oscilador de Lorentz con los valores de los controles',
    );
  }
  if (id === 'agua') return fromTable('agua', data.water, 'constantes ópticas medidas (Hale y Querry, 1973)');
  if (id === 'oro') return fromTable('oro', data.gold, 'constantes ópticas medidas (Johnson y Christy, 1972)');
  return fromModel(
    'vidrio',
    sellmeierToLorentz(data.silicaSellmeier, GLASS_RELATIVE_DAMPING),
    ['ultravioleta lejano', 'ultravioleta', 'infrarrojo'],
    'resonancias de la fórmula de Sellmeier de la sílice fundida (Malitson, 1965), con una anchura añadida γ = ω₀/40',
  );
}

/**
 * Constantes ópticas del material en la energía del estado. Si el material es una tabla y
 * la energía cae fuera de sus datos, se usa el extremo más cercano y `clamped` lo dice
 * (la interfaz lo avisa: nunca se extrapola en silencio).
 * @param {ResolvedMaterial} material
 * @param {number} energy ħω (eV)
 * @returns {import('./physics.js').OpticalFunctions & { energy: number, requested: number, clamped: boolean }}
 */
export function opticsAt(material, energy) {
  // Un pelo hacia dentro del intervalo, para no caer fuera por redondeo al convertir a λ.
  const lo = material.dataRange[0] * (1 + 1e-9);
  const hi = material.dataRange[1] * (1 - 1e-9);
  const used = Math.min(hi, Math.max(lo, energy));
  const epsilon = material.epsilonAt(used);
  if (!epsilon) throw new Error(`luz-materia: sin datos de ${material.name} en ${used} eV`);
  return { ...opticalFunctions(epsilon, used), energy: used, requested: energy, clamped: used !== energy };
}

/**
 * Nombre de la región del espectro de una longitud de onda en el vacío.
 * @param {number} lambda nm
 * @returns {string}
 */
export function spectralRegion(lambda) {
  if (lambda < 380) return 'ultravioleta';
  if (lambda < 450) return 'violeta';
  if (lambda < 495) return 'azul';
  if (lambda < 570) return 'verde';
  if (lambda < 590) return 'amarillo';
  if (lambda < 620) return 'naranja';
  if (lambda <= 780) return 'rojo';
  return 'infrarrojo';
}

/**
 * Longitud de onda con una unidad legible: nm hasta 2000 nm; µm por encima.
 * @param {number} lambda nm
 * @returns {string}
 */
export function formatWavelength(lambda) {
  if (lambda >= 2000) return `${formatEs(lambda / 1000, lambda >= 20000 ? 0 : 1)} µm`;
  return `${formatEs(lambda, lambda < 100 ? 1 : 0)} nm`;
}

/**
 * Número con tres cifras significativas y coma decimal (0,00213 → «0,00213»; 1,4603 → «1,46»).
 * Por debajo de 10⁻⁴ usa notación científica: 3,2·10⁻⁹.
 * @param {number} value
 * @returns {string}
 */
export function formatSig(value) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude < 1e-4 || magnitude >= 1e6) {
    let exponent = Math.floor(Math.log10(magnitude));
    let mantissa = value / 10 ** exponent;
    if (Math.abs(mantissa) >= 9.95) {
      mantissa /= 10;
      exponent += 1;
    }
    const superscript = String(exponent).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
    return `${formatEs(mantissa, 1)}·10${superscript}`;
  }
  const decimals = Math.max(0, 2 - Math.floor(Math.log10(magnitude)));
  return formatEs(value, Math.min(decimals, 6));
}

/**
 * Complejo como texto: «2,13 + 0,006i».
 * @param {Complex} z
 * @returns {string}
 */
export function formatComplex(z) {
  return `${formatSig(z.re)} ${z.im < 0 ? '−' : '+'} ${formatSig(Math.abs(z.im))}i`;
}

/**
 * Lienzo propio (para lo que el trazador no sabe dibujar): se ajusta al contenedor y a la
 * densidad de píxeles, y llama a `draw` con el contexto ya escalado a píxeles CSS.
 * @param {HTMLElement} container
 * @param {string} label descripción para lectores de pantalla
 * @param {(g: CanvasRenderingContext2D, width: number, height: number, fontSize: number, family: string) => void} draw
 */
export function createCanvasView(container, label, draw) {
  const canvas = el('canvas', { class: 'lm-canvas', role: 'img', 'aria-label': label });
  const wrap = el('div', { class: 'lm-canvas-wrap' }, canvas);
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
    canvas,
    render,
    destroy() {
      observer.disconnect();
      wrap.remove();
    },
  };
}

/**
 * Flecha con punta, de (x0, y0) a (x1, y1). Usa el trazo y el relleno actuales.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} head tamaño de la punta (px)
 */
export function drawArrow(g, x0, y0, x1, y1, head) {
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
 * Lo que cada vista parcial recibe en `update`, además del estado.
 * @typedef {object} PartContext
 * @property {ResolvedMaterial} material
 * @property {ReturnType<typeof opticsAt>} optics constantes ópticas en la energía actual
 */

/**
 * Una de las cuatro vistas del módulo.
 * @typedef {object} PartView
 * @property {(state: State, part: PartContext) => void} update
 * @property {() => void} destroy
 */
