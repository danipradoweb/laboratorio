// @ts-check
// Ondas clásicas y función de onda (encargo 03).
//
// Qué comparte una onda clásica con la función de onda (ecuaciones lineales,
// superposición, interferencia de fases, modos propios al confinar) y en qué se diferencian
// (orden temporal y ψ compleja, dispersión, espacio en que vive, información de la fase).
//
// Tres vistas (parámetro `part`):
//   paquete   un paquete de ondas que evoluciona con la ecuación de Schrödinger, con su
//             espacio de momentos, la cuerda clásica que sale de la misma forma y los
//             valores esperados                                          view-packet.js
//   estados   estados propios sobre el potencial y superposición de dos de ellos; fase
//             global frente a relativa; el puente con la luz             view-states.js
//   cuerda    la cuerda clásica sola: pulsos, modos, extremos fijos o libres  view-string.js
//
// Unidades: posiciones en nm, tiempos en fs, energías en eV, masas en masas del electrón.
// La cuerda clásica de la vista «cuerda» usa unidades propias (x/L y periodos).

import { mount } from './view.js';
import { DRAW_COLUMNS, DRAW_RANGE } from './view-common.js';

/** @typedef {import('../types.js').State} State */

/** @param {...string} parts */
const inPart = (...parts) => (/** @type {State} */ state) => parts.includes(String(state.part));
/** @param {...string} types */
const withPotential = (...types) => (/** @type {State} */ state) =>
  state.part !== 'cuerda' && types.includes(String(state.potential));

/** Columnas del potencial dibujado: parámetros ocultos d0…d15 que se cambian dibujando. */
const drawnColumns = Array.from({ length: DRAW_COLUMNS }, (_, j) => ({
  key: `d${j}`,
  label: `Potencial dibujado, columna ${j + 1}`,
  type: /** @type {const} */ ('range'),
  min: DRAW_RANGE[0],
  max: DRAW_RANGE[1],
  step: 0.01,
  default: 0,
  unit: 'eV',
  visible: () => false,
}));

/** @type {import('../types.js').ModuleDescriptor} */
const descriptor = {
  id: 'funcion-onda',
  title: 'Ondas clásicas y función de onda',
  summary: 'Qué comparte una cuerda que vibra con la función de onda, y en qué se diferencian',
  hidden: true,
  animated: true,
  params: [
    {
      key: 'part',
      label: 'Vista',
      type: 'select',
      options: [
        { value: 'paquete', label: 'Un paquete de ondas en movimiento' },
        { value: 'estados', label: 'Estados propios y superposición' },
        { value: 'cuerda', label: 'La cuerda clásica' },
      ],
      default: 'paquete',
      help: 'Las dos primeras vistas comparten el potencial y la masa de la partícula.',
    },
    // --- Potencial y partícula (paquete y estados) ------------------------------------
    {
      key: 'potential',
      label: 'Potencial V(x)',
      type: 'select',
      options: [
        { value: 'libre', label: 'Libre (V = 0)' },
        { value: 'escalon', label: 'Escalón' },
        { value: 'barrera', label: 'Barrera rectangular' },
        { value: 'doble-barrera', label: 'Doble barrera' },
        { value: 'pozo-finito', label: 'Pozo finito' },
        { value: 'pozo-infinito', label: 'Pozo «infinito»' },
        { value: 'armonico', label: 'Oscilador armónico' },
        { value: 'dibujado', label: 'Dibujado a mano' },
      ],
      default: 'barrera',
      help: 'Energía potencial de la partícula según dónde esté. Con «Dibujado a mano», arrastra sobre la gráfica de ψ para dar forma al potencial.',
      visible: inPart('paquete', 'estados'),
    },
    {
      key: 'height',
      label: 'Altura V₀ (profundidad, en el pozo finito)',
      type: 'range',
      min: 0,
      max: 3,
      step: 0.01,
      default: 1,
      unit: 'eV',
      visible: withPotential('escalon', 'barrera', 'doble-barrera', 'pozo-finito'),
    },
    {
      key: 'width',
      label: 'Anchura de la barrera',
      type: 'range',
      min: 0.1,
      max: 3,
      step: 0.05,
      default: 0.5,
      unit: 'nm',
      visible: withPotential('barrera', 'doble-barrera'),
    },
    {
      key: 'separation',
      label: 'Separación entre las barreras',
      type: 'range',
      min: 0.5,
      max: 10,
      step: 0.05,
      default: 2,
      unit: 'nm',
      help: 'Distancia entre las caras interiores de las dos barreras.',
      visible: withPotential('doble-barrera'),
    },
    {
      key: 'wellWidth',
      label: 'Anchura del pozo',
      type: 'range',
      min: 0.3,
      max: 30,
      step: 0.05,
      default: 1,
      unit: 'nm',
      visible: withPotential('pozo-finito', 'pozo-infinito'),
    },
    {
      key: 'quantum',
      label: 'Cuanto del oscilador ħω',
      type: 'range',
      min: 0.02,
      max: 1,
      step: 0.01,
      default: 0.1,
      unit: 'eV',
      help: 'Separación entre niveles del oscilador armónico. ω es la frecuencia con que oscilaría una partícula clásica en ese potencial.',
      visible: withPotential('armonico'),
    },
    {
      key: 'mass',
      label: 'Masa de la partícula',
      type: 'range',
      min: 0.05,
      max: 3,
      step: 0.01,
      default: 1,
      unit: 'mₑ',
      help: 'En masas del electrón. En un semiconductor el electrón se mueve como si tuviera una «masa efectiva» menor (0,067 mₑ en GaAs).',
      visible: inPart('paquete', 'estados'),
    },
    // --- Paquete -------------------------------------------------------------------------
    {
      key: 'x0',
      label: 'Posición inicial x₀',
      type: 'range',
      min: -60,
      max: 60,
      step: 0.1,
      default: -20,
      unit: 'nm',
      help: 'Centro del paquete al empezar. También se cambia con un clic sobre la gráfica de ψ.',
      visible: inPart('paquete'),
    },
    {
      key: 'sigma',
      label: 'Anchura inicial σ₀',
      type: 'range',
      min: 0.2,
      max: 10,
      step: 0.05,
      default: 2,
      unit: 'nm',
      help: 'Desviación típica de |ψ|² al empezar. Un paquete estrecho en x es ancho en momentos, y se ensancha antes.',
      visible: inPart('paquete'),
    },
    {
      key: 'energy',
      label: 'Energía cinética media ħ²k₀²/2m',
      type: 'range',
      min: 0,
      max: 3,
      step: 0.005,
      default: 0.5,
      unit: 'eV',
      help: 'Fija el número de onda medio k₀ (el momento p = ħk₀). También se cambia con un clic sobre la gráfica de momentos.',
      visible: inPart('paquete'),
    },
    {
      key: 'leftward',
      label: 'Hacia la izquierda',
      type: 'toggle',
      default: false,
      help: 'Cambia el signo de k₀: misma |ψ|², fase que gira al revés, movimiento al revés.',
      visible: inPart('paquete'),
    },
    {
      key: 'twin',
      label: 'Comparar con el mismo paquete con k₀ opuesto',
      type: 'toggle',
      default: false,
      help: 'Añade debajo un segundo paquete con la misma |ψ|² inicial y el número de onda cambiado de signo.',
      visible: inPart('paquete'),
    },
    {
      key: 'absorber',
      label: 'Bordes absorbentes',
      type: 'toggle',
      default: true,
      help: 'Un potencial imaginario cerca de los bordes se traga lo que llega (simula un espacio abierto). Sin él, la malla es periódica: lo que sale por un lado entra por el otro.',
      visible: inPart('paquete'),
    },
    {
      key: 'density',
      label: 'Dibujar |ψ|² (en lugar de |ψ|)',
      type: 'toggle',
      default: false,
      help: 'La altura del relleno de color pasa a ser |ψ|², la densidad de probabilidad.',
      visible: inPart('paquete', 'estados'),
    },
    {
      key: 'showRe',
      label: 'Mostrar Re ψ',
      type: 'toggle',
      default: false,
      visible: (state) => state.part !== 'cuerda' && !state.density,
    },
    {
      key: 'showIm',
      label: 'Mostrar Im ψ',
      type: 'toggle',
      default: false,
      visible: (state) => state.part !== 'cuerda' && !state.density,
    },
    {
      key: 'rate',
      label: 'Ritmo de la simulación',
      type: 'range',
      min: 1,
      max: 50,
      step: 1,
      default: 10,
      unit: 'fs/s',
      help: 'Femtosegundos de simulación por segundo real (a velocidad 1×).',
      visible: inPart('paquete'),
    },
    // --- Estados -------------------------------------------------------------------------
    {
      key: 'n1',
      label: 'Primer estado',
      type: 'range',
      min: 1,
      max: 8,
      step: 1,
      default: 1,
      help: '1 = estado fundamental. También se elige con un clic sobre un nivel.',
      visible: inPart('estados'),
    },
    {
      key: 'n2',
      label: 'Segundo estado',
      type: 'range',
      min: 1,
      max: 8,
      step: 1,
      default: 2,
      visible: inPart('estados'),
    },
    {
      key: 'weight',
      label: 'Peso del segundo estado |c₂|²',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      help: 'Probabilidad de medir la energía del segundo estado. Con 0 queda solo el primero (un estado estacionario).',
      visible: inPart('estados'),
    },
    {
      key: 'relPhase',
      label: 'Fase relativa θ (entre los dos estados)',
      type: 'range',
      min: -180,
      max: 180,
      step: 1,
      default: 0,
      unit: '°',
      help: 'ψ = c₁φ₁ + c₂e^{iθ}φ₂. Cambia |ψ|²: es observable.',
      visible: inPart('estados'),
    },
    {
      key: 'globalPhase',
      label: 'Fase global φ (multiplica todo ψ)',
      type: 'range',
      min: 0,
      max: 360,
      step: 1,
      default: 0,
      unit: '°',
      help: 'e^{iφ}ψ: giran los colores y Re ψ, Im ψ, pero nada observable cambia (|ψ|², ⟨x⟩, ⟨p⟩).',
      visible: inPart('paquete', 'estados'),
    },
    // --- Cuerda --------------------------------------------------------------------------
    {
      key: 'boundary',
      label: 'Extremos de la cuerda',
      type: 'select',
      options: [
        { value: 'fixed', label: 'Fijos (atados)' },
        { value: 'free', label: 'Libres (anillas en una barra)' },
      ],
      default: 'fixed',
      visible: inPart('cuerda'),
    },
    {
      key: 'shape',
      label: 'Forma inicial',
      type: 'select',
      options: [
        { value: 'pulso', label: 'Pulso soltado en reposo' },
        { value: 'viajero', label: 'Pulso que viaja' },
        { value: 'modo', label: 'Un modo' },
        { value: 'dos-modos', label: 'Superposición de dos modos' },
      ],
      default: 'viajero',
      visible: inPart('cuerda'),
    },
    {
      key: 'mode',
      label: 'Modo n',
      type: 'range',
      min: 1,
      max: 8,
      step: 1,
      default: 1,
      visible: (state) => state.part === 'cuerda' && (state.shape === 'modo' || state.shape === 'dos-modos'),
    },
    {
      key: 'mode2',
      label: 'Segundo modo m',
      type: 'range',
      min: 1,
      max: 8,
      step: 1,
      default: 2,
      visible: (state) => state.part === 'cuerda' && state.shape === 'dos-modos',
    },
    ...drawnColumns,
  ],
  presets: [],
  tours: [],
  mount,
};

export default descriptor;
