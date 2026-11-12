// @ts-check
// Plasmón, teoría de Mie y color: por qué una nanopartícula metálica tiene color.
//
// Unidades de la interfaz: longitudes en nanómetros (diámetro, longitud de onda en el
// vacío), camino óptico de la cubeta en milímetros y concentración como fracción de
// volumen de metal en partes por millón (1 ppm = 10⁻⁶): con ella, coloides de tamaños muy
// distintos tienen absorbancias comparables sin tener que cambiar el control.

import { LAMBDA_RANGE, MATERIAL_OPTIONS, mount } from './view.js';

/** @type {import('../types.js').ModuleDescriptor} */
const descriptor = {
  id: 'plasmon',
  title: 'Plasmón, teoría de Mie y color',
  summary: 'Por qué el oro coloidal es rojo y qué cambia con el material, el tamaño, el medio y la forma',
  animated: true,
  thumbnail: 'miniatura.png',
  params: [
    {
      key: 'material',
      label: 'Material',
      type: 'select',
      options: MATERIAL_OPTIONS,
      default: 'Au',
      help: 'Metal de la partícula. Sus constantes ópticas n(λ), k(λ) son medidas experimentales (ver la ficha).',
    },
    {
      key: 'shape',
      label: 'Forma',
      type: 'select',
      options: [
        { value: 'sphere', label: 'Esfera (teoría de Mie)' },
        { value: 'rod', label: 'Bastón (Gans, cuasiestática)' },
      ],
      default: 'sphere',
      help: 'La esfera se calcula con la teoría de Mie, exacta para cualquier tamaño. El bastón, con la teoría de Gans: un esferoide alargado mucho menor que la longitud de onda, orientado al azar.',
    },
    {
      key: 'diameter',
      label: 'Diámetro (ancho del bastón)',
      type: 'range',
      min: 2,
      max: 200,
      step: 1,
      default: 20,
      unit: 'nm',
      help: 'Diámetro de la esfera. En el bastón es el ancho; el largo es ancho × relación de aspecto.',
    },
    {
      key: 'aspect',
      label: 'Relación de aspecto (bastón)',
      type: 'range',
      min: 1,
      max: 5,
      step: 0.1,
      default: 3,
      help: 'Largo dividido por ancho. Solo actúa cuando la forma es «bastón». Con 1 es una esfera.',
    },
    {
      key: 'medium',
      label: 'Índice del medio',
      type: 'range',
      min: 1,
      max: 2,
      step: 0.01,
      default: 1.33,
      help: 'Índice de refracción del medio transparente que rodea a la partícula: 1 aire, 1,33 agua, 1,5 vidrio.',
    },
    {
      key: 'lambda',
      label: 'Longitud de onda λ',
      type: 'range',
      min: LAMBDA_RANGE[0],
      max: LAMBDA_RANGE[1],
      step: 1,
      default: 521,
      unit: 'nm',
      help: 'Longitud de onda de la luz en el vacío. También se cambia haciendo clic o arrastrando sobre el espectro.',
    },
    {
      key: 'conc',
      label: 'Concentración (ppm en volumen)',
      type: 'range',
      min: 0.1,
      max: 20,
      step: 0.1,
      default: 2.5,
      help: 'Fracción del volumen del coloide ocupada por el metal, en partes por millón. Solo afecta al color de la cubeta.',
    },
    {
      key: 'path',
      label: 'Camino óptico',
      type: 'range',
      min: 1,
      max: 50,
      step: 1,
      default: 10,
      unit: 'mm',
      help: 'Espesor de coloide que atraviesa la luz. Una cubeta de laboratorio mide 10 mm.',
    },
  ],
  presets: [
    { id: 'oro-20', label: 'Oro 20 nm en agua', state: { material: 'Au', diameter: 20, lambda: 521 } },
    { id: 'oro-80', label: 'Oro 80 nm', state: { material: 'Au', diameter: 80, lambda: 549 } },
    { id: 'oro-150', label: 'Oro 150 nm', state: { material: 'Au', diameter: 150, lambda: 640 } },
    { id: 'plata-20', label: 'Plata 20 nm', state: { material: 'Ag', diameter: 20, lambda: 387 } },
    { id: 'oro-20-vidrio', label: 'Oro 20 nm en un medio de índice 1,5', state: { material: 'Au', diameter: 20, medium: 1.5, lambda: 535 } },
    { id: 'baston-3', label: 'Nanobastón de oro, relación de aspecto 3', state: { material: 'Au', shape: 'rod', diameter: 10, aspect: 3, lambda: 672, conc: 1 } },
    { id: 'licurgo', label: 'Copa de Licurgo', state: { material: 'AuAg', diameter: 70, medium: 1.5, lambda: 503 } },
    { id: 'oro-20-lejos', label: 'Oro 20 nm, lejos de la resonancia', state: { material: 'Au', diameter: 20, lambda: 800 } },
  ],
  tours: [
    {
      id: 'oro-rojo',
      title: 'Por qué el oro coloidal es rojo',
      steps: [
        {
          preset: 'oro-20-lejos',
          text: 'La luz es un campo eléctrico que oscila y **empuja** a los electrones de conducción de la partícula. La nube electrónica oscila *siempre* a la frecuencia de la luz: es una **oscilación forzada**. Aquí, en el infrarrojo ($\\lambda = 800$ nm), la nube sigue a la fuerza casi en fase ($\\delta \\approx 1°$). Se mueve, y no poco (a la mitad de su amplitud máxima), pero una fuerza en fase con el desplazamiento devuelve en medio ciclo la energía que dio en el otro medio: no cede energía neta y apenas hay extinción.',
        },
        {
          preset: 'oro-20',
          text: 'Cerca de $\\lambda \\approx 520$ nm se cumple $\\mathrm{Re}\\,\\varepsilon(\\omega) = -2\\varepsilon_m$ (condición de Fröhlich): **resonancia de plasmón**. No es un fenómeno distinto de «inducir» la oscilación: es la misma oscilación forzada, en la zona del barrido donde la amplitud pasa por su máximo y la nube se retrasa respecto a la fuerza. La energía absorbida en cada ciclo es $\\propto |\\alpha|\\sin\\delta$: aquí es unas cien veces mayor que en 800 nm. Arrastra $\\lambda$ sobre el espectro y mira crecer la amplitud y girar el desfase, como en el oscilador forzado.',
        },
        {
          preset: 'oro-20',
          text: 'La partícula **no emite luz de otro color**. Hace dos cosas con la luz verde que capta: la disipa en calor (**absorción**, aquí el 99 %) o la reemite a la misma longitud de onda en otras direcciones (**dispersión**). A contraluz vemos lo que queda al quitar el verde: **rojo**.',
        },
        {
          preset: 'plata-20',
          text: 'Mismo mecanismo, otro metal. En la plata la condición se cumple en el violeta ($\\approx 390$ nm) y casi sin pérdidas: pico más estrecho y más alto, y el desfase en resonancia es el de libro, $\\delta \\approx 90°$ (en el oro se queda en unos $60°$ porque absorbe mucho más). Al quitar el violeta, la plata coloidal se ve **amarilla**.',
        },
        {
          preset: 'licurgo',
          text: 'Con partículas mayores la dispersión deja de ser despreciable. La **copa de Licurgo** (vidrio romano con partículas de oro y plata de unos 70 nm) dispersa el verde y deja pasar el rojo: verde con la luz por delante, **roja a contraluz**. Es el mismo espectro visto de dos maneras.',
        },
      ],
    },
    {
      id: 'tamano',
      title: 'Qué cambia con el tamaño y qué no',
      steps: [
        {
          preset: 'oro-20',
          text: 'Partícula **mucho menor que $\\lambda$** (régimen cuasiestático): toda ella ve el mismo campo en cada instante. La posición del pico la fija $\\mathrm{Re}\\,\\varepsilon(\\omega) = -2\\varepsilon_m$: depende del **material** y del **medio**, no del tamaño. Prueba a mover el diámetro entre 5 y 30 nm: el pico no se mueve; solo cambia la altura.',
        },
        {
          preset: 'oro-20-vidrio',
          text: 'Cambiar el **medio** sí mueve el pico: con $n = 1{,}5$ la condición pide un $\\mathrm{Re}\\,\\varepsilon$ más negativo, que en el oro está a mayor $\\lambda$. Por eso estas partículas sirven de sensores: el color delata el índice de lo que las rodea.',
        },
        {
          preset: 'oro-80',
          text: 'A 80 nm la partícula ya no es pequeña frente a $\\lambda$: el campo no es uniforme en su interior (**retardo**) y además radia con eficacia. El pico se va al rojo y se ensancha, y la **dispersión** (línea de trazos) ya es comparable a la absorción. La marca «sin retardo» señala dónde estaría el pico cuasiestático.',
        },
        {
          preset: 'oro-150',
          text: 'A 150 nm el pico dipolar está en el rojo y casi todo es dispersión. A menor $\\lambda$ asoma un hombro: el modo **cuadrupolar**. Lleva $\\lambda$ a 530 nm y mira el diagrama polar: dipolo y cuadrupolo interfieren y la luz se dispersa sobre todo **hacia delante**. Todo esto solo lo da la teoría de Mie completa.',
        },
        {
          preset: 'baston-3',
          text: 'La **forma** pesa más que el tamaño. Un bastón de solo $30 \\times 10$ nm tiene su pico en el rojo: a lo largo del eje largo el factor de despolarización $L$ es menor que $1/3$ y la resonancia pide $\\mathrm{Re}\\,\\varepsilon = -\\varepsilon_m (1-L)/L$. Queda otro pico pequeño hacia 505 nm: la oscilación a lo ancho.',
        },
      ],
    },
  ],
  mount,
};

export default descriptor;
