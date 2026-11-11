// @ts-check
// PLANTILLA · module.js — el descriptor del módulo.
//
// Es DECLARATIVO: aquí no hay lógica. El núcleo del laboratorio lee este objeto y
// genera los controles, sincroniza el estado con la URL, pinta la lista de presets y
// los recorridos, y llama a mount() para crear las vistas.
//
// Cómo crear un módulo nuevo a partir de esta plantilla: lee LEEME.md (en esta carpeta).

import { mount } from './view.js';

/** @type {import('../types.js').ModuleDescriptor} */
const descriptor = {
  // Igual que el nombre de la carpeta. Aparece en la URL: #/<id>. Solo minúsculas,
  // cifras y guiones.
  id: '_plantilla',

  title: 'Plantilla: ondas estacionarias',

  // Una línea para la tarjeta de la portada.
  summary: 'Módulo de ejemplo para copiar: modos de una cuerda',

  // true = no sale en la portada. BORRA esta línea en un módulo real.
  hidden: true,

  // true = el módulo usa el reloj (ctx.clock): se muestran pausa y velocidad.
  // Bórrala si tu módulo no tiene animación.
  animated: true,

  // Miniatura para la portada. Descomenta cuando el módulo esté terminado y ejecuta
  // `npm run miniaturas <id>` para generarla.
  // thumbnail: 'miniatura.png',

  // PARÁMETROS: la única fuente de verdad. De aquí salen los controles, la URL y la
  // validación de los presets. Tres tipos: 'range', 'select' y 'toggle'.
  params: [
    {
      key: 'n', // nombre en la URL y en el estado: state.n
      label: 'Modo n', // texto del control, en español
      type: 'range',
      min: 1,
      max: 6,
      step: 1,
      default: 1,
      help: 'Número de medias longitudes de onda que caben en la cuerda.',
    },
    {
      key: 'amplitude',
      label: 'Amplitud',
      type: 'range',
      min: 0.1,
      max: 1,
      step: 0.05,
      default: 0.8,
      // unit: 'cm',  // unidad opcional, se muestra junto al valor
    },
    {
      key: 'ends',
      label: 'Extremos',
      type: 'select',
      // Cada opción es un texto, o { value, label } si el texto visible es distinto.
      options: [
        { value: 'fijos', label: 'Fijos' },
        { value: 'libres', label: 'Libres' },
      ],
      default: 'fijos',
    },
    { key: 'envelope', label: 'Mostrar la envolvente', type: 'toggle', default: true },
  ],

  // PRESETS: estados con nombre. Solo hace falta dar las claves que cambian respecto a
  // los valores por defecto. Máximo 9 (teclas 1–9 en modo presentación).
  presets: [
    { id: 'fundamental', label: 'Modo fundamental', state: { n: 1 } },
    { id: 'tercer-armonico', label: 'Tercer armónico', state: { n: 3 } },
    { id: 'extremos-libres', label: 'Extremos libres, n = 2', state: { n: 2, ends: 'libres' } },
  ],

  // RECORRIDOS: cada paso salta a un preset y muestra un texto (Markdown breve, con
  // fórmulas entre $…$). En el código JavaScript las barras invertidas de TeX se
  // escriben dobles: '\\omega'.
  tours: [
    {
      id: 'modos',
      title: 'Qué es un modo normal',
      steps: [
        {
          preset: 'fundamental',
          text: 'En el **modo fundamental** toda la cuerda sube y baja a la vez, con frecuencia $\\omega_1 = \\pi c/L$.',
        },
        {
          preset: 'tercer-armonico',
          text: 'En el tercer armónico hay dos **nodos** interiores que no se mueven nunca, y la frecuencia es el triple: $\\omega_3 = 3\\omega_1$.',
        },
        {
          preset: 'extremos-libres',
          text: 'Con los extremos libres, los extremos son vientres (máximo movimiento) en lugar de nodos.',
        },
      ],
    },
  ],

  mount,
};

export default descriptor;
