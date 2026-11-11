// @ts-check
// REGISTRO DE MÓDULOS: el único sitio donde se da de alta un módulo.
//
// Para añadir un módulo nuevo (después de copiar src/modules/_plantilla/):
//   1. Añade una línea `import` con su descriptor.
//   2. Añádelo a la lista `modules`, en el orden en que debe salir en la portada.
//
// Los módulos con `hidden: true` no salen en la portada, pero se pueden abrir por su
// dirección (#/<id>) y la prueba de humo los carga igualmente.

import galeria from './_galeria/module.js';
import plantilla from './_plantilla/module.js';
import oscilador from './oscilador/module.js';

/** @type {import('./types.js').ModuleDescriptor[]} */
export const modules = [oscilador, galeria, plantilla];
