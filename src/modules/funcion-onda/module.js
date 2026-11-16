// @ts-check
// Ondas clásicas y función de onda (encargo 03). Andamiaje provisional: los parámetros,
// presets y recorridos llegan en los pasos siguientes (ver PROGRESO.md).

import { mount } from './view.js';

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
    },
  ],
  presets: [],
  tours: [],
  mount,
};

export default descriptor;
