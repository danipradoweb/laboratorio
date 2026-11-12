// @ts-check
// Tipos del contrato de un módulo (solo documentación y comprobación con `npm run check`;
// este archivo no contiene código que se ejecute).
//
// Un módulo es una carpeta src/modules/<id>/ con:
//   module.js   descriptor (este contrato)
//   physics.js  física pura, sin DOM, con tests en tests/<id>.test.js
//   view.js     presentación: crea las vistas y las actualiza
//   ficha.md    ficha del módulo
// y una entrada en src/modules/registry.js. Ver src/modules/_plantilla/LEEME.md.

/**
 * @typedef {import('../core/state.js').Param} Param
 * @typedef {import('../core/state.js').State} State
 * @typedef {import('../core/state.js').ChangeSource} ChangeSource
 */

/**
 * Estado con nombre. Las claves de `state` deben existir en `params`; las que falten
 * toman su valor por defecto.
 * @typedef {object} Preset
 * @property {string} id identificador corto, sin espacios
 * @property {string} label texto del botón
 * @property {Record<string, number | string | boolean>} state
 */

/**
 * Paso de un recorrido guiado: salta a un preset y muestra un texto.
 * @typedef {object} TourStep
 * @property {string} preset id de un preset del módulo
 * @property {string} text Markdown breve; admite fórmulas $…$ y $$…$$
 */

/**
 * Recorrido guiado.
 * @typedef {object} Tour
 * @property {string} id
 * @property {string} title
 * @property {TourStep[]} steps
 */

/**
 * Lo que el laboratorio ofrece a la vista de un módulo.
 * @typedef {object} ModuleContext
 * @property {() => State} getState estado actual
 * @property {(patch: Record<string, number | string | boolean>) => void} setState
 *   cambia parámetros desde una vista (por ejemplo, al hacer clic en una gráfica);
 *   los controles, la URL y las demás vistas se actualizan solos
 * @property {import('../core/clock.js').Clock} clock reloj de animación (pausa y velocidad)
 * @property {{ name: () => 'light' | 'dark', colors: () => import('../core/theme.js').ThemeColors }} theme
 *   tema actual y sus colores (para dibujar en canvas con los colores del tema)
 * @property {{ isActive: () => boolean }} presentation modo presentación
 * @property {MaterialsService} materials biblioteca de materiales (src/materials/)
 * @property {ColorService} color motor espectro → color (src/color/)
 */

/**
 * Biblioteca de materiales. Los datos se descargan la primera vez que se piden, así que
 * las dos funciones devuelven promesas: úsalas con `await` dentro de un `mount` asíncrono.
 *   const oro = await ctx.materials.load('Au');
 * Para evaluar n, k o ε en una longitud de onda: createOpticalConstants(oro), de
 * src/materials/dielectric.js.
 * @typedef {object} MaterialsService
 * @property {(id: string) => Promise<import('../materials/library.js').Material>} load
 * @property {() => Promise<import('../materials/library.js').MaterialSummary[]>} list
 */

/**
 * Motor espectro → color. Carga las tablas CIE la primera vez:
 *   const color = await ctx.color.load();
 *   color.colorOf({ wavelengths, values }).css;   // color de una transmitancia bajo D65
 * @typedef {object} ColorService
 * @property {() => Promise<import('../color/spectrum.js').ColorEngine>} load
 */

/**
 * Lo que devuelve `mount`.
 * @typedef {object} ModuleInstance
 * @property {(state: State) => void} update se llama al montar, en cada cambio de estado,
 *   al cambiar el tema y al entrar o salir del modo presentación; debe redibujar todas las vistas con ese estado
 * @property {() => void} destroy libera gráficas, temporizadores y suscripciones
 */

/**
 * Descriptor de un módulo.
 * @typedef {object} ModuleDescriptor
 * @property {string} id igual que el nombre de la carpeta; aparece en la URL
 * @property {string} title
 * @property {string} summary una línea, para la tarjeta de la portada
 * @property {Param[]} params fuente única de verdad: controles, URL y presets salen de aquí
 * @property {Preset[]} presets
 * @property {Tour[]} tours
 * @property {(container: HTMLElement, ctx: ModuleContext) => ModuleInstance | Promise<ModuleInstance>} mount
 * @property {boolean} [hidden] si es true, no aparece en la portada (plantilla, galería)
 * @property {boolean} [animated] si es true, se muestran los controles de pausa y velocidad
 * @property {string} [thumbnail] nombre del archivo de miniatura dentro de la carpeta del módulo
 * @property {number} [transitionSeconds] duración de la transición entre presets, en segundos
 *   (por defecto 1,5; 0 = cambio instantáneo)
 */

export {};
