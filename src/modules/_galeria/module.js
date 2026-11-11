// @ts-check
// Galería de componentes: módulo oculto (no sale en la portada) que sirve de banco de
// pruebas visual de los servicios comunes: controles de todos los tipos, trazador 2D,
// visor 3D, mapas de color y rueda de fase. Se abre en  #/_galeria
//
// La prueba de humo lo carga para comprobar que ningún servicio da errores.

import { mount } from './view.js';

/** @type {import('../types.js').ModuleDescriptor} */
const descriptor = {
  id: '_galeria',
  title: 'Galería de componentes',
  summary: 'Banco de pruebas de los servicios comunes del laboratorio',
  hidden: true,
  params: [
    { key: 'k', label: 'Número de onda k', type: 'range', min: 0, max: 8, step: 0.1, default: 3 },
    { key: 'sigma', label: 'Anchura σ', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    {
      key: 'colormap',
      label: 'Mapa de color',
      type: 'select',
      options: [
        { value: 'viridis', label: 'Viridis (secuencial)' },
        { value: 'magma', label: 'Magma (secuencial)' },
        { value: 'divergente', label: 'Divergente' },
      ],
      default: 'divergente',
    },
    { key: 'markers', label: 'Marcadores y áreas', type: 'toggle', default: true },
  ],
  presets: [],
  tours: [],
  mount,
};

export default descriptor;
