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
  thumbnail: 'miniatura.png',
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
    // --- Vista B: láminas de dipolos ---------------------------------------------------
    {
      key: 'spacing',
      label: 'Separación entre láminas d/λ₀',
      type: 'range',
      min: 0.01,
      max: 0.25,
      step: 0.005,
      default: 0.05,
      help: 'Distancia entre láminas, en longitudes de onda del vacío. La cantidad de material por unidad de volumen no cambia: al juntarlas, cada lámina es más débil y el conjunto se parece más a un medio continuo.',
      visible: inPart('laminas'),
    },
    {
      key: 'count',
      label: 'Número de láminas',
      type: 'range',
      min: 1,
      max: 80,
      step: 1,
      default: 40,
      help: 'Láminas que forman el material. Su espesor es el número de láminas por la separación.',
      visible: inPart('laminas'),
    },
    {
      key: 'active',
      label: 'Láminas encendidas',
      type: 'range',
      min: 0,
      max: 80,
      step: 1,
      default: 80,
      help: 'Cuántas láminas responden a la luz, empezando por la primera. Enciéndelas una a una para ver cómo se van construyendo la onda de dentro, la reflejada y la extinción de la incidente. Si pides más de las que hay, se encienden todas.',
      visible: (state) => state.part === 'laminas' && !state.auto,
    },
    {
      key: 'auto',
      label: 'Encenderlas una a una (automático)',
      type: 'toggle',
      default: false,
      help: 'Las láminas se encienden solas, una detrás de otra, y vuelven a empezar.',
      visible: inPart('laminas'),
    },
    {
      key: 'radiated',
      label: 'Ondas radiadas que se dibujan',
      type: 'select',
      options: [
        { value: 'todas', label: 'La de cada lámina' },
        { value: 'una', label: 'La de una sola lámina' },
        { value: 'ninguna', label: 'Solo su suma' },
      ],
      default: 'una',
      help: 'Cada lámina radia una onda plana hacia los dos lados. Se puede ver la de cada una, la de una sola o solo la suma de todas.',
      visible: inPart('laminas'),
    },
    {
      key: 'sheet',
      label: 'Lámina resaltada',
      type: 'range',
      min: 1,
      max: 80,
      step: 1,
      default: 1,
      help: 'Qué lámina se dibuja cuando se elige ver la onda de una sola.',
      visible: (state) => state.part === 'laminas' && state.radiated === 'una',
    },
    // --- Vistas C: una superficie, y polarizadores -------------------------------------
    {
      key: 'angle',
      label: 'Ángulo de incidencia θ',
      type: 'range',
      min: 0,
      max: 89.5,
      step: 0.1,
      default: 45,
      unit: '°',
      help: 'Ángulo entre el rayo que llega y la perpendicular a la superficie. También se cambia con un clic sobre las gráficas frente al ángulo.',
      visible: inPart('interfaz', 'polarizadores'),
    },
    {
      key: 'pol',
      label: 'Polarización de la luz',
      type: 'select',
      options: [
        { value: 'p', label: 'p: campo en el plano de incidencia' },
        { value: 's', label: 's: campo perpendicular a ese plano' },
      ],
      default: 'p',
      help: 'Dirección del campo eléctrico. El plano de incidencia (el del dibujo) contiene el rayo y la perpendicular a la superficie.',
      visible: inPart('interfaz'),
    },
    {
      key: 'side',
      label: 'La luz viene',
      type: 'select',
      options: [
        { value: 'fuera', label: 'del aire y entra en el material' },
        { value: 'dentro', label: 'de dentro del material y sale al aire' },
      ],
      default: 'fuera',
      help: 'Al salir de un material transparente al aire hay un ángulo crítico: por encima de él toda la luz se refleja (reflexión total interna).',
      visible: inPart('interfaz'),
    },
    {
      key: 'analyzer',
      label: 'Ángulo del analizador',
      type: 'range',
      min: 0,
      max: 180,
      step: 1,
      default: 30,
      unit: '°',
      help: 'Ángulo entre el eje del último polarizador y el del primero. Con 90° están cruzados.',
      visible: inPart('polarizadores'),
    },
    {
      key: 'third',
      label: 'Polarizador intermedio',
      type: 'toggle',
      default: false,
      help: 'Mete un tercer polarizador entre los otros dos.',
      visible: inPart('polarizadores'),
    },
    {
      key: 'middle',
      label: 'Ángulo del intermedio',
      type: 'range',
      min: 0,
      max: 180,
      step: 1,
      default: 45,
      unit: '°',
      help: 'Ángulo del eje del polarizador intermedio respecto al del primero.',
      visible: (state) => state.part === 'polarizadores' && Boolean(state.third),
    },
  ],
  presets: [
    { id: 'vidrio-visible', label: 'Vidrio en el visible', state: { part: 'material', material: 'vidrio', energy: 2.25 } },
    { id: 'vidrio-uv', label: 'Vidrio en una resonancia ultravioleta', state: { part: 'material', material: 'vidrio', energy: 10.67 } },
    { id: 'metal-debajo', label: 'Metal por debajo de ω_p', state: { part: 'material', material: 'metal', energy: 2.25 } },
    { id: 'metal-encima', label: 'Metal por encima de ω_p', state: { part: 'material', material: 'metal', energy: 15 } },
    { id: 'laminas', label: 'Láminas encendiéndose una a una', state: { part: 'laminas', material: 'vidrio', count: 24, auto: true, radiated: 'todas' } },
    { id: 'espejo', label: 'Un espejo: láminas de metal', state: { part: 'laminas', material: 'metal', spacing: 0.02, count: 30, radiated: 'ninguna' } },
    { id: 'brewster', label: 'Brewster en vidrio', state: { part: 'interfaz', material: 'vidrio', angle: 55.6, pol: 'p' } },
    { id: 'reflexion-total', label: 'Reflexión total interna', state: { part: 'interfaz', material: 'vidrio', side: 'dentro', angle: 50, pol: 's' } },
    { id: 'gafas', label: 'Reflejo en agua con gafas polarizadas', state: { part: 'polarizadores', material: 'agua', angle: 53.1, analyzer: 90 } },
  ],
  tours: [
    {
      id: 'no-rebota',
      title: 'Por qué la luz no rebota',
      steps: [
        {
          preset: 'vidrio-visible',
          text: 'La luz es un campo eléctrico que oscila y **empuja** a los electrones del material. Cada electrón, sujeto a su átomo como por un muelle, oscila **a la frecuencia de la luz**, no a la suya: es una oscilación forzada. En el vidrio las frecuencias propias están en el ultravioleta ($\\hbar\\omega_0 \\approx 11$ y $18$ eV), muy por encima del visible: los electrones siguen al campo casi en fase ($\\delta \\approx 0°$) y no le quitan energía.',
        },
        {
          preset: 'laminas',
          text: 'Un electrón que oscila **radia**. Aquí el vidrio son láminas de electrones que se encienden una a una. Cada lámina radia una onda plana hacia delante y otra hacia atrás (líneas verdes finas), a la misma frecuencia que la luz. No hay nada más: el campo en cualquier punto es la onda incidente **más** las ondas radiadas.',
        },
        {
          preset: 'laminas',
          text: 'Delante del material solo llegan las ondas radiadas hacia atrás: su suma **es** la onda reflejada (línea de trazos de la gráfica de abajo). Nada ha rebotado en la superficie: son los electrones de todo el material radiando a la vez. En el diagrama de abajo a la derecha se ve por qué el vidrio refleja poco: las contribuciones de las láminas van girando y casi se cancelan.',
        },
        {
          preset: 'laminas',
          text: 'Dentro y detrás, la onda incidente **sigue ahí**, intacta y a velocidad $c$ (curva naranja). Lo que cambia es la suma: las ondas radiadas hacia delante contienen una copia de la incidente con el signo cambiado, que la cancela (teorema de extinción de Ewald-Oseen), y además una onda nueva de longitud de onda más corta, $\\lambda_0/n$. Esa onda nueva es «la luz dentro del vidrio».',
        },
        {
          preset: 'espejo',
          text: 'Un metal son electrones **libres**, sin muelle: oscilan en oposición al campo ($\\delta \\approx 180°$) y con mucha amplitud. Lo que radian hacia delante cancela la onda incidente en una fracción de longitud de onda, sin onda nueva que la sustituya ($\\mathrm{Re}\\,\\varepsilon < 0$). Casi toda la energía (el 98 %) sale radiada hacia atrás. Eso es un espejo, y tampoco aquí rebota nada.',
        },
        {
          preset: 'vidrio-uv',
          text: 'Tampoco hay «absorción y reemisión con retraso». Si la luz está en resonancia con los electrones (aquí, ultravioleta de 116 nm), estos oscilan en cuadratura con el campo ($\\delta \\approx 90°$) y el campo trabaja sobre ellos en cada ciclo: esa energía se queda en el material. El mismo vidrio que es transparente en el visible es opaco aquí: la intensidad cae a $1/e$ en 2 nm.',
        },
      ],
    },
    {
      id: 'indice',
      title: 'De dónde sale el índice de refracción',
      steps: [
        {
          preset: 'vidrio-visible',
          text: 'El índice de refracción no es un dato «de fábrica» del material: sale de cómo responden sus osciladores. La función dieléctrica suma esas respuestas, $\\varepsilon = 1 + \\sum_j f_j\\,\\omega_p^2/(\\omega_{0j}^2 - \\omega^2 - i\\gamma_j\\omega)$, y $n + ik = \\sqrt{\\varepsilon}$. En el visible, por debajo de las resonancias ultravioletas, cada término es casi real y positivo: $\\varepsilon\' > 1$, $n \\approx 1{,}46$ y $k \\approx 0$.',
        },
        {
          preset: 'laminas',
          text: '¿Y por qué eso «frena» la luz? Mira el diagrama de arriba a la derecha. Detrás del material el campo es la onda incidente (naranja) más lo que radia cada lámina. La onda que radia una lámina va **un cuarto de periodo desfasada** respecto al movimiento de sus cargas: cada lámina añade un fasor pequeño casi perpendicular al que ya había. La suma no crece: **gira**. Ese giro es un retraso de fase.',
        },
        {
          preset: 'laminas',
          text: 'El retraso crece con el espesor atravesado: vale $(n - 1)\\,2\\pi L/\\lambda_0$. Una onda cuya fase se retrasa en proporción al camino es, sencillamente, una onda de longitud de onda más corta: en la gráfica del campo total, la regla azul mide $\\lambda_0/n$ dentro del material. Nadie ha frenado a la onda incidente; lo que avanza más despacio es la **suma**.',
        },
        {
          preset: 'vidrio-visible',
          text: 'Al subir la frecuencia hacia la resonancia ultravioleta los electrones responden más y $n$ crece: **dispersión normal**. Por eso un prisma desvía más el azul que el rojo. Arrastra la energía sobre las gráficas a lo largo de la banda visible: $n$ pasa de 1,454 (rojo) a 1,472 (violeta).',
        },
        {
          preset: 'vidrio-uv',
          text: 'En la resonancia la respuesta es enorme y va en cuadratura: $\\varepsilon\'\'$ y $k$ se disparan (absorción) y, dentro de la línea, $n$ **baja** al aumentar $\\omega$ (dispersión anómala). Índice y absorción no son independientes: por causalidad (relaciones de Kramers-Kronig), el índice en el visible queda fijado por la absorción en el ultravioleta y el infrarrojo.',
        },
        {
          preset: 'metal-debajo',
          text: 'Electrones libres: no hay muelle ($\\omega_0 = 0$) y la respuesta va siempre en oposición, $\\varepsilon \\approx 1 - \\omega_p^2/\\omega^2$. Por debajo de la frecuencia de plasma, $\\mathrm{Re}\\,\\varepsilon < 0$: $n \\approx 0$ y $k$ grande. No hay onda que viaje por dentro; el metal refleja ($R \\approx 98\\,\\%$ en todo el visible, y por eso es de color «plata»).',
        },
        {
          preset: 'metal-encima',
          text: 'Por encima de $\\omega_p$ los electrones libres ya casi no responden: $0 < \\varepsilon < 1$ y $n < 1$. El metal se vuelve transparente (al ultravioleta lejano), y la fase de la onda **adelanta** en lugar de retrasarse: la velocidad de fase supera $c$. No se viola nada: ninguna señal viaja a la velocidad de fase.',
        },
      ],
    },
    {
      id: 'gafas',
      title: 'Por qué funcionan las gafas polarizadas',
      steps: [
        {
          preset: 'brewster',
          text: 'Luz que llega inclinada al vidrio, con el campo eléctrico en el plano del dibujo (polarización **p**). Dentro, los electrones oscilan a lo largo del campo de la onda refractada, es decir, perpendiculares al rayo refractado. Y un dipolo que oscila no radia a lo largo de su propio eje: su radiación es $\\propto \\sin^2$ del ángulo con el eje (figura verde).',
        },
        {
          preset: 'brewster',
          text: 'La onda reflejada tendría que salir justo a lo largo de ese eje, porque en este ángulo el rayo reflejado y el refractado forman $90°$. Los dipolos no radian hacia allí: **no hay reflexión**, $R_p = 0$. Es el ángulo de Brewster, $\\tan\\theta_B = n$. Mueve el ángulo: en cuanto el rayo reflejado se separa del eje, el reflejo reaparece.',
        },
        {
          preset: 'brewster',
          text: 'Cambia ahora la polarización a **s** (campo perpendicular al dibujo). Los dipolos oscilan perpendiculares al dibujo, y todas las direcciones del plano están a $90°$ de su eje: radian igual hacia todas, y el reflejo no desaparece a ningún ángulo. En las curvas, $R_s$ crece siempre; solo $R_p$ pasa por cero.',
        },
        {
          preset: 'gafas',
          text: 'La luz del sol no está polarizada: lleva la mitad de su energía en cada polarización. Al reflejarse en el agua cerca de $53°$ (su ángulo de Brewster), la mitad p no se refleja, y el reflejo sale **polarizado en horizontal**, paralelo a la superficie. La curva verde de abajo es el grado de polarización del reflejo: es alto en un intervalo ancho de ángulos.',
        },
        {
          preset: 'gafas',
          text: 'Unas gafas polarizadas son un polarizador de eje **vertical**: bloquean el reflejo, que es horizontal, y dejan pasar la mitad del resto de la escena. Unas gafas grises lo atenúan todo por igual, reflejo incluido. Mueve el ángulo: lejos de Brewster el polarizador deja pasar parte del reflejo (el 28 % a $30°$, el 18 % a $70°$), siempre menos que el 50 % de las grises.',
        },
        {
          preset: 'gafas',
          text: 'Arriba, la ley de Malus: un segundo polarizador girado un ángulo $\\theta$ respecto al primero deja pasar $\\cos^2\\theta$ (por eso, al inclinar la cabeza, el reflejo vuelve). Con los ejes cruzados no pasa nada. Y sin embargo, activa el **polarizador intermedio** a $45°$: pasa un 12,5 %. Un polarizador no «cuela» la luz: proyecta el campo sobre su eje, y así lo gira.',
        },
      ],
    },
  ],
  mount,
};

export default descriptor;
