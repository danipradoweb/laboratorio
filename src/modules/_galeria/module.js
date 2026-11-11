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
    {
      key: 'rotar',
      label: 'Girar la fase global',
      type: 'toggle',
      default: false,
      help: 'Multiplica ψ por e^(−it). Sirve para probar el reloj de animación: pausa y velocidad.',
    },
  ],
  presets: [
    { id: 'estrecho', label: 'Paquete estrecho y rápido', state: { k: 6, sigma: 0.5 } },
    { id: 'ancho', label: 'Paquete ancho y lento', state: { k: 1.5, sigma: 1.8, colormap: 'viridis' } },
    { id: 'sin-onda', label: 'Sin oscilación (k = 0)', state: { k: 0, sigma: 1, markers: false } },
  ],
  tours: [
    {
      id: 'servicios',
      title: 'Qué se prueba aquí',
      steps: [
        {
          preset: 'estrecho',
          text: 'Un paquete **estrecho** en el espacio: $\\sigma = 0{,}5$. La transición entre presets interpola los parámetros numéricos.',
        },
        {
          preset: 'ancho',
          text: 'Un paquete *ancho*. Los parámetros discretos, como el mapa de color, cambian al final de la transición.',
        },
        {
          preset: 'sin-onda',
          text: 'Con $k = 0$ no hay oscilación y la fase es constante: $$\\psi(x, y) = e^{-(x^2+y^2)/2\\sigma^2}$$',
        },
      ],
    },
  ],
  animated: true,
  mount,
};

export default descriptor;
