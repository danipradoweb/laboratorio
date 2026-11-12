// @ts-check
// Luz y materia: del oscilador a la reflexión, la refracción y la polarización.
//
// Un solo mecanismo: el campo de la luz fuerza a oscilar a los electrones del material,
// cada electrón radia a la misma frecuencia, y lo que hace el material es la suma de la
// onda incidente con todas esas ondas radiadas.
//
// El módulo tiene cuatro vistas (parámetro `part`) que comparten material y frecuencia.
// Los controles que solo sirven en una vista se ocultan en las demás (campo `visible`).
//
// Unidades de la interfaz: energía del fotón ħω en eV (la longitud de onda en el vacío
// sale de λ = hc/ħω), distancias entre láminas en longitudes de onda del vacío y ángulos
// en grados.

import { ENERGY_RANGE, MATERIAL_OPTIONS, mount } from './view.js';

/** @typedef {import('../types.js').State} State */

/** @param {...string} parts */
const inPart = (...parts) => (/** @type {State} */ state) => parts.includes(String(state.part));
/** El material editable solo se edita si está elegido (y la vista usa el material). */
const editable = (/** @type {State} */ state) => state.material === 'editable';

/** @type {import('../types.js').ModuleDescriptor} */
const descriptor = {
  id: 'luz-materia',
  title: 'Luz y materia: del oscilador a la reflexión',
  summary: 'Reflexión, refracción, absorción y polarización salen de electrones que oscilan forzados por la luz',
  animated: true,
  params: [
    {
      key: 'part',
      label: 'Vista',
      type: 'select',
      options: [
        { value: 'material', label: 'A · El material: de osciladores a ε, n y k' },
        { value: 'laminas', label: 'B · Láminas de dipolos: de dónde sale n' },
        { value: 'interfaz', label: 'C · Una superficie: Fresnel y Brewster' },
        { value: 'polarizadores', label: 'C · Polarizadores y gafas de sol' },
      ],
      default: 'material',
      help: 'Las cuatro vistas comparten el material y la energía del fotón.',
    },
    {
      key: 'material',
      label: 'Material',
      type: 'select',
      options: MATERIAL_OPTIONS,
      default: 'vidrio',
      help: 'Tres modelos de osciladores (vidrio, metal de Drude y un oscilador que puedes editar) y dos materiales con constantes ópticas medidas.',
    },
    {
      key: 'energy',
      label: 'Energía del fotón ħω',
      type: 'range',
      min: ENERGY_RANGE[0],
      max: ENERGY_RANGE[1],
      step: 0.01,
      default: 2.25,
      unit: 'eV',
      help: 'Frecuencia de la luz, como energía de sus fotones. El visible va de 1,6 eV (rojo) a 3,3 eV (violeta). También se cambia con un clic sobre las gráficas del material.',
    },
    {
      key: 'axis',
      label: 'Eje horizontal',
      type: 'select',
      options: [
        { value: 'energia', label: 'Energía del fotón (eV)' },
        { value: 'lambda', label: 'Longitud de onda (nm)' },
      ],
      default: 'energia',
      help: 'Las mismas curvas, frente a la energía del fotón o frente a la longitud de onda en el vacío.',
      visible: inPart('material'),
    },
    {
      key: 'w0',
      label: 'Resonancia ħω₀ (editable)',
      type: 'range',
      min: 0,
      max: 20,
      step: 0.1,
      default: 4,
      unit: 'eV',
      help: 'Frecuencia propia del oscilador. Con 0 no hay muelle: electrones libres (modelo de Drude).',
      visible: editable,
    },
    {
      key: 'wp',
      label: 'Frecuencia de plasma ħω_p (editable)',
      type: 'range',
      min: 0.5,
      max: 20,
      step: 0.1,
      default: 6,
      unit: 'eV',
      help: 'Mide cuántos electrones hay por unidad de volumen: ω_p² = N·e²/(ε₀·m).',
      visible: editable,
    },
    {
      key: 'gamma',
      label: 'Amortiguamiento ħγ (editable)',
      type: 'range',
      min: 0.01,
      max: 5,
      step: 0.01,
      default: 0.5,
      unit: 'eV',
      help: 'Rozamiento del oscilador: anchura de la línea de absorción.',
      visible: editable,
    },
  ],
  presets: [],
  tours: [],
  mount,
};

export default descriptor;
