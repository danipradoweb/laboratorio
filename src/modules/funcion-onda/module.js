// @ts-check
// Ondas clásicas y función de onda (encargo 03).
//
// Qué comparte una onda clásica con la función de onda (ecuaciones lineales,
// superposición, interferencia de fases, modos propios al confinar) y en qué se diferencian
// (orden temporal y ψ compleja, dispersión, espacio en que vive, información de la fase).
//
// Cuatro vistas (parámetro `part`):
//   paquete   un paquete de ondas que evoluciona con la ecuación de Schrödinger, con su
//             espacio de momentos, la cuerda clásica que sale de la misma forma y los
//             valores esperados                                          view-packet.js
//   estados   estados propios sobre el potencial y superposición de dos de ellos; fase
//             global frente a relativa; el puente con la luz             view-states.js
//   cuerda    la cuerda clásica sola: pulsos, modos, extremos fijos o libres  view-string.js
//   rendijas  doble rendija en 2D con control de coherencia entre los dos caminos
//                                                                        view-slits.js
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
  (state.part === 'paquete' || state.part === 'estados') && types.includes(String(state.potential));

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
  animated: true,
  thumbnail: 'miniatura.png',
  params: [
    {
      key: 'part',
      label: 'Vista',
      type: 'select',
      options: [
        { value: 'paquete', label: 'Un paquete de ondas en movimiento' },
        { value: 'estados', label: 'Estados propios y superposición' },
        { value: 'cuerda', label: 'La cuerda clásica' },
        { value: 'rendijas', label: 'Doble rendija (2D) y coherencia' },
      ],
      default: 'paquete',
      help: 'Las dos primeras vistas comparten el potencial y la masa de la partícula.',
      // La simulación se elige en la página de entrada del módulo (formato con
      // simulaciones), no con un control.
      visible: () => false,
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
      step: 0.001,
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
      visible: (state) => (state.part === 'paquete' || state.part === 'estados') && !state.density,
    },
    {
      key: 'showIm',
      label: 'Mostrar Im ψ',
      type: 'toggle',
      default: false,
      visible: (state) => (state.part === 'paquete' || state.part === 'estados') && !state.density,
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
      help: 'Femtosegundos de simulación por segundo real (a velocidad 1×). En la doble rendija el ordenador puede no llegar al ritmo pedido: entonces va más despacio.',
      visible: inPart('paquete', 'rendijas'),
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
    // --- Doble rendija ---------------------------------------------------------------------
    {
      key: 'slitWavelength',
      label: 'Longitud de onda de de Broglie λ',
      type: 'range',
      min: 0.8,
      max: 1.6,
      step: 0.05,
      default: 1,
      unit: 'nm',
      help: 'λ = h/p del electrón que llega a las rendijas (1 nm ↔ 1,50 eV).',
      visible: inPart('rendijas'),
    },
    {
      key: 'slitSeparation',
      label: 'Distancia entre las rendijas d',
      type: 'range',
      min: 2,
      max: 6,
      step: 0.25,
      default: 4,
      unit: 'nm',
      help: 'Entre los centros de las dos rendijas.',
      visible: inPart('rendijas'),
    },
    {
      key: 'slitWidth',
      label: 'Anchura de cada rendija w',
      type: 'range',
      min: 0.5,
      max: 1.5,
      step: 0.125,
      default: 1,
      unit: 'nm',
      visible: inPart('rendijas'),
    },
    {
      key: 'coherence',
      label: 'Coherencia γ entre los dos caminos',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1,
      help: '1: nada guarda por qué rendija pasó la partícula. 0: otro sistema lo ha registrado del todo. Cambia el dibujo al momento, sin repetir la simulación.',
      visible: inPart('rendijas'),
    },
    ...drawnColumns,
  ],
  // --- Formato con página de entrada y simulaciones (encargo R1) ---------------------
  intro:
    'Una cuerda que vibra y la [[función de onda]] de un electrón obedecen ecuaciones parecidas: las dos son lineales, así que sus ondas se suman e [[interfieren|interferencia]], y al confinarlas solo sobreviven ciertos [[modos|modo]]. Pero no son lo mismo: la función de onda es compleja, sus ondas viajan a velocidades distintas según su longitud de onda y lo que se observa de ella es una probabilidad, no un desplazamiento. Este módulo las pone lado a lado para ver qué comparten y en qué se diferencian. Es la base de lo que viene después: átomos, enlaces, bandas de energía y puntos cuánticos.',
  simulationParam: 'part',
  simulations: [
    {
      id: 'paquete',
      title: 'Un paquete de ondas en movimiento',
      summary: 'Un electrón localizado avanza, se ensancha y choca con barreras, escalones o pozos; al lado, una cuerda clásica que sale con la misma forma.',
      initial: {},
      graphs: [
        { id: 'psi', title: 'Dónde está el electrón: la función de onda', short: 'ψ(x)', summary: 'La altura dice dónde es probable encontrarlo; el color, la fase de ψ. Detrás, el potencial que encuentra.' },
        { id: 'momentos', title: 'Cuánto del paquete hay en cada número de onda', short: 'espacio de momentos', summary: 'El mismo paquete escrito como suma de ondas planas, junto a la probabilidad de que cada una atraviese el potencial.' },
        { id: 'cuerda-comparada', title: 'Una cuerda clásica que sale con la misma forma', short: 'la cuerda clásica', summary: 'La cuerda conserva la forma del pulso; el paquete cuántico, no.' },
        { id: 'valores-esperados', title: 'Posición y momento medios, e incertidumbre', short: 'valores esperados', summary: 'Cómo se mueven ⟨x⟩ y ⟨p⟩ con el tiempo, comparados con una partícula clásica, y el producto de incertidumbres Δx·Δp.' },
      ],
      combos: [
        { id: 'barrera', title: 'Qué parte del paquete atraviesa la barrera', summary: 'Las componentes de momento que la curva de transmisión deja pasar son las que acaban al otro lado.', graphs: ['psi', 'momentos'] },
        { id: 'incertidumbre', title: 'La incertidumbre mientras el paquete se mueve', summary: 'Mientras el paquete avanza y se ensancha, las medias siguen a la partícula clásica y Δx·Δp crece.', graphs: ['psi', 'valores-esperados'] },
        { id: 'onda', title: 'Qué tiene de onda y qué no', summary: 'Con la misma forma inicial, la cuerda lleva el pulso intacto y el paquete se dispersa.', graphs: ['psi', 'cuerda-comparada'] },
      ],
    },
    {
      id: 'estados',
      title: 'Estados propios y superposición',
      summary: 'Los estados de energía definida de un pozo o de un oscilador, y lo que pasa al sumar dos: la probabilidad se balancea y aparece la frecuencia de la luz que se absorbe o se emite.',
      // Los valores del preset «Superposición 1 + 2 oscilando»: al entrar se ve algo que se mueve.
      initial: { potential: 'pozo-infinito', wellWidth: 0.8, n1: 1, n2: 2, weight: 0.5 },
      graphs: [
        { id: 'niveles', title: 'Niveles de energía y sus estados', short: 'niveles de energía', summary: 'El potencial, las energías permitidas y la forma de cada estado propio.' },
        { id: 'superposicion', title: 'Superposición de dos estados', short: 'ψ(x, t)', summary: 'La suma de los dos estados elegidos, que cambia de forma porque cada uno gira a su ritmo.' },
        { id: 'puente-luz', title: 'La carga oscila: el puente con la luz', short: 'puente con la luz', summary: 'La posición media oscila con la frecuencia del fotón que la transición absorbe o emite.' },
        { id: 'coeficientes', title: 'Los dos coeficientes en el plano complejo', short: 'coeficientes', summary: 'Cada coeficiente es una flecha que gira; lo que se observa es el ángulo entre ellas.' },
      ],
      combos: [
        { id: 'se-mueve', title: 'Por qué una superposición se mueve', summary: 'Las flechas giran a ritmos distintos: cuando cambia el ángulo entre ellas, cambia la forma de la probabilidad.', graphs: ['superposicion', 'coeficientes'] },
        { id: 'color', title: 'De dónde sale el color de una transición', summary: 'La separación entre dos niveles fija la frecuencia con que oscila la carga, y esa es la del fotón.', graphs: ['niveles', 'puente-luz'] },
      ],
    },
    {
      id: 'cuerda',
      title: 'La cuerda clásica',
      summary: 'Pulsos que viajan y se reflejan, modos estacionarios y la energía que va y viene, para compararlos con la partícula en una caja.',
      initial: {},
      graphs: [
        { id: 'cuerda', title: 'La cuerda que vibra', short: 'la cuerda', summary: 'El desplazamiento de una cuerda tensa: pulsos, modos o la suma de dos modos.' },
        { id: 'frecuencias', title: 'Frecuencias de la cuerda y de la partícula en una caja', short: 'frecuencias', summary: 'Las mismas formas con distinto reloj: la cuerda crece como n y la partícula como n².' },
        { id: 'energia-cuerda', title: 'La energía de la cuerda', short: 'energía', summary: 'La energía pasa del movimiento al estiramiento y vuelve, y la total no cambia.' },
      ],
      combos: [
        { id: 'reloj', title: 'Misma forma, distinto reloj', summary: 'Cada modo de la cuerda tiene la forma de un estado de la caja, pero su frecuencia crece de otra manera.', graphs: ['cuerda', 'frecuencias'] },
      ],
    },
    {
      id: 'rendijas',
      title: 'Doble rendija (2D) y coherencia',
      summary: 'Un electrón pasa por dos rendijas y las dos maneras de llegar a la pantalla interfieren, salvo que algo registre por dónde pasó.',
      initial: {},
      graphs: [
        { id: 'plano', title: 'El plano visto desde arriba', short: 'el plano', summary: 'La probabilidad de encontrar al electrón en cada punto mientras pasa por las rendijas.' },
        { id: 'pantalla', title: 'Lo que llega a la pantalla', short: 'la pantalla', summary: 'Cuánta probabilidad llega a cada punto, frente a la fórmula de libro y a la suma sin interferencia.' },
      ],
      combos: [
        { id: 'rendijas', title: 'El plano y la pantalla', summary: 'Los radios brillantes que salen de las rendijas son las franjas que se acumulan en la pantalla.', graphs: ['plano', 'pantalla'] },
      ],
    },
  ],
  presets: [
    { id: 'paquete-libre', label: 'Paquete libre que se ensancha', graphs: ['psi', 'cuerda-comparada', 'valores-esperados'], state: { part: 'paquete', potential: 'libre', x0: -30, sigma: 1, energy: 0.1, rate: 20 } },
    { id: 'tunel', label: 'Efecto túnel por debajo de la barrera', graphs: ['psi', 'momentos'], state: { part: 'paquete', potential: 'barrera', height: 0.3, width: 1, energy: 0.2, sigma: 3, x0: -25, rate: 30 } },
    { id: 'resonancia', label: 'Resonancia en una doble barrera', graphs: ['psi', 'momentos'], state: { part: 'paquete', potential: 'doble-barrera', height: 0.5, width: 0.3, separation: 3, energy: 0.113, sigma: 10, x0: -35, rate: 40 } },
    { id: 'escalon', label: 'Escalón por encima de su altura', graphs: ['psi', 'momentos'], state: { part: 'paquete', potential: 'escalon', height: 0.3, energy: 0.4, sigma: 3, x0: -25, rate: 30 } },
    { id: 'pozo-estados', label: 'Estados del pozo', graphs: ['niveles', 'superposicion'], state: { part: 'estados', potential: 'pozo-infinito', wellWidth: 1, n1: 2, n2: 3, weight: 0, showRe: true } },
    { id: 'superposicion', label: 'Superposición 1 + 2 oscilando', graphs: ['superposicion', 'coeficientes', 'niveles', 'puente-luz'], state: { part: 'estados', potential: 'pozo-infinito', wellWidth: 0.8, n1: 1, n2: 2, weight: 0.5 } },
    { id: 'coherente', label: 'Estado coherente en el oscilador armónico', graphs: ['psi', 'valores-esperados'], state: { part: 'paquete', potential: 'armonico', quantum: 0.1, x0: 4, sigma: 0.62, energy: 0, rate: 20 } },
    { id: 'opuestos', label: 'Misma |ψ|² con momentos opuestos', graphs: ['psi', 'momentos'], state: { part: 'paquete', potential: 'libre', twin: true, x0: 0, sigma: 2, energy: 0.05, rate: 20 } },
    { id: 'cuerda-modos', label: 'La cuerda: dos modos superpuestos', graphs: ['cuerda', 'energia-cuerda'], state: { part: 'cuerda', shape: 'dos-modos', mode: 1, mode2: 2 } },
  ],
  tours: [
    {
      id: 'onda',
      title: 'Qué tiene de onda la función de onda',
      steps: [
        {
          preset: 'cuerda-modos',
          text: 'Una cuerda tensa obedece una ecuación **lineal**: si dos formas son solución, su suma también lo es. Aquí la cuerda es la suma del modo 1 y el modo 2. Cada modo es una onda estacionaria, $\\sin(n\\pi x/L)$, que oscila a su frecuencia $\\omega_n = n\\pi c/L$; la forma total cambia porque los dos van a ritmos distintos. Al lado, la energía pasa del movimiento al estiramiento y vuelve, y la total no cambia.',
        },
        {
          preset: 'pozo-estados',
          text: 'La ecuación de Schrödinger también es lineal, y al confinar aparece lo mismo. En una caja de paredes infinitas de anchura $L$ los estados permitidos son **exactamente** $\\sin(n\\pi x/L)$: los modos de la cuerda. Aquí está $\\varphi_2$, con un nodo en el centro como el segundo modo. Lo que cambia es el reloj: la frecuencia de la cuerda crece como $n$ y la energía del estado como $n^2$ (gráfica de las frecuencias, en la simulación de la cuerda).',
        },
        {
          preset: 'superposicion',
          text: 'Como en la cuerda, los estados se pueden sumar. Con $\\varphi_1$ y $\\varphi_2$ a partes iguales, $|\\psi|^2$ deja de estar quieta: la probabilidad va de un lado a otro de la caja con periodo $h/(E_2 - E_1) = 2{,}35$ fs. Es **interferencia**: donde las fases de los dos términos coinciden, $|\\psi|^2$ crece; donde se oponen, se cancela. Las flechas de la gráfica de al lado son los dos coeficientes: giran a ritmos distintos, y lo que se ve depende del ángulo entre ellas.',
        },
        {
          preset: 'tunel',
          text: 'La interferencia de ondas explica lo que ninguna partícula clásica haría. Un paquete de energía media 0,2 eV llega a una barrera de 0,3 eV y 1 nm: una bola rebotaría siempre, pero la onda atraviesa en parte (el 13,7 %, dice al final la línea bajo el título de $\\psi$). Dentro de la barrera $\\psi$ no se corta de golpe: decae, y lo que queda al otro lado sigue viajando. En la gráfica de momentos, la curva verde es la transmisión de cada onda plana; el paquete es una suma de ellas.',
        },
        {
          preset: 'paquete-libre',
          text: 'Pero no todo es igual. La cuerda lleva un pulso sin deformarlo porque todas sus ondas viajan a la misma velocidad ($\\omega = ck$). Para una partícula libre $\\omega = \\hbar k^2/2m$: las componentes con más momento van más deprisa y el paquete **se ensancha solo**, sin que nada lo empuje. Con $\\sigma_0 = 1$ nm, a los 100 fs mide 5,9 nm y a los 200 fs, 11,6 nm ($\\Delta x$, en la línea bajo el título de los valores esperados). La cuerda clásica de la pantalla siguiente, que salió con la misma forma, sigue igual.',
        },
        {
          preset: 'opuestos',
          text: 'Y $\\psi$ no vibra en el espacio como la cuerda: es **compleja**, y su fase lleva información. En la gráfica de $\\psi$, arriba y abajo, dos paquetes con la misma $|\\psi|^2$ inicial; solo cambia el sentido en que gira la fase a lo largo de $x$ (los colores se suceden en orden contrario). Uno va a la derecha y el otro a la izquierda: $|\\psi|^2$ dice dónde está la partícula y la fase, hacia dónde va. (Con $N$ partículas, $\\psi$ ni siquiera vive en nuestro espacio, sino en uno de $3N$ dimensiones.)',
        },
      ],
    },
    {
      id: 'compleja',
      title: 'Por qué ψ es compleja',
      steps: [
        {
          preset: 'cuerda-modos',
          text: 'La ecuación de la cuerda es de **segundo orden** en el tiempo: para saber cómo seguirá hay que dar la forma y además la velocidad de cada punto. Por eso un modo puede ser real, $\\sin(kx)\\cos(\\omega t)$: sube, se aplana y baja, y cuando pasa por la posición plana no ha perdido nada, porque toda su energía está en el movimiento. Aquí hay dos modos superpuestos: la energía va y viene entre movimiento y estiramiento (gráfica de al lado), y lo que la cuerda no tiene en forma lo tiene en velocidad.',
        },
        {
          preset: 'pozo-estados',
          text: 'La ecuación de Schrödinger es de **primer orden** en el tiempo: $\\psi$ en un instante decide todo lo que sigue, sin una «velocidad» aparte. Una función real que solo oscilara, $\\varphi\\cos(Et/\\hbar)$, al pasar por cero lo habría olvidado todo. La solución es $\\psi = \\varphi\\,e^{-iEt/\\hbar}$: el módulo se queda quieto y lo que gira es la fase. Activa también «Mostrar Im ψ»: Re ψ e Im ψ se pasan el relevo como un coseno y un seno, y $|\\psi|^2$ no cambia nunca. Es un estado estacionario.',
        },
        {
          preset: 'superposicion',
          text: 'Con dos estados, cada coeficiente gira a su ritmo, $E_1/\\hbar$ y $E_2/\\hbar$ (las flechas). Lo observable es el ángulo entre ellos, la **fase relativa**: mueve «Fase relativa θ» y $|\\psi|^2$ cambia. Mueve ahora «Fase global φ»: los colores y las dos flechas giran juntos, pero $|\\psi|^2$, $\\langle x\\rangle$ y $\\langle p\\rangle$ no se inmutan. La fase global no se puede medir; la relativa es el ángulo azimutal de la esfera de Bloch de un sistema de dos niveles.',
        },
        {
          preset: 'opuestos',
          text: 'La fase lleva además el **momento**. Dos paquetes con la misma $|\\psi|^2$ inicial y la fase girando en sentidos opuestos a lo largo de $x$ tienen $\\langle k\\rangle = +1{,}15$ y $-1{,}15$ nm⁻¹, y se separan. Con una $\\psi$ real no habría manera de distinguirlos: su momento medio sería cero.',
        },
        {
          preset: 'coherente',
          text: 'En el oscilador armónico el paquete va y viene como una partícula clásica (la línea de puntos de $\\langle x\\rangle$): es el teorema de Ehrenfest. Mira la fase: cuando el paquete cruza el centro a toda velocidad, los colores se suceden deprisa a lo largo de $x$ (mucho momento); en los extremos casi no cambian (momento nulo). Este paquete no se ensancha: $\\Delta x\\,\\Delta p$ se queda en $\\hbar/2$.',
        },
      ],
    },
    {
      id: 'color',
      title: 'De dónde sale el color de una transición',
      steps: [
        {
          preset: 'pozo-estados',
          text: 'En esta descripción, un electrón en un estado propio no emite luz: su $|\\psi|^2$ está quieta y su posición media no se mueve, y una carga que no se mueve no radia. Aquí está $\\varphi_2$, un estado excitado: en la realidad acabaría bajando al fundamental por emisión espontánea, que solo se explica cuantizando también la luz. El estado fundamental sí es estable: un átomo puede quedarse en él indefinidamente.',
        },
        {
          preset: 'superposicion',
          text: 'En una superposición de dos estados la probabilidad se balancea: $\\langle x\\rangle$ oscila con frecuencia angular $(E_2 - E_1)/\\hbar$ (gráfica del puente con la luz, en la segunda pantalla). Una carga que oscila es una antena, un **dipolo**: radia luz de esa frecuencia y, al revés, la luz de esa frecuencia puede ponerla a oscilar. Aquí, un electrón en una caja de 0,8 nm: $E_2 - E_1 = 1{,}76$ eV, periodo 2,35 fs y un fotón de 703 nm, rojo.',
        },
        {
          preset: 'superposicion',
          text: 'El color depende del tamaño. Baja la anchura del pozo a 0,6 nm: las energías crecen como $1/L^2$, el salto pasa a 3,13 eV y el fotón a 396 nm, en el borde del violeta. Súbela a 1 nm: 1,13 eV y 1099 nm, infrarrojo. Es la idea de los puntos cuánticos: el mismo material emite otro color según su tamaño.',
        },
        {
          preset: 'superposicion',
          text: 'No todas las parejas sirven. Pon el segundo estado en 3: $|\\psi|^2$ sigue cambiando, pero $\\langle x\\rangle$ se queda quieto, porque $\\varphi_1$ y $\\varphi_3$ son simétricos respecto al centro y el dipolo $\\langle\\varphi_1|x|\\varphi_3\\rangle$ es nulo. Esa transición no emite ni absorbe luz como un dipolo: es una **regla de selección**.',
        },
        {
          preset: 'superposicion',
          text: 'Esta carga que oscila es el oscilador forzado del módulo del oscilador, y su radiación es la de las láminas de dipolos de «Luz y materia»: cerca de la frecuencia $(E_2 - E_1)/\\hbar$ el material responde mucho y absorbe. La mecánica cuántica da las frecuencias propias; la imagen del oscilador explica qué hace la luz con ellas.',
        },
      ],
    },
  ],
  mount,
};

export default descriptor;
