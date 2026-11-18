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
 * @property {string[]} [graphs] (formato con simulaciones) gráficas que abre; si falta, todas
 *   las de su simulación
 */

// --- Formato con página de entrada y simulaciones (encargo R1, en piloto) ----------------
// Un módulo con este formato declara `intro`, `simulationParam` y `simulations`. El núcleo
// le da una página de entrada (#/<id>), reparte las gráficas elegidas en pantallas cortas,
// pone bajo cada gráfica su explicación (sacada de ficha.md) y escribe en la URL la
// selección. Ver src/core/simulations.js y docs/ARQUITECTURA.md, «Formato en piloto».

/**
 * Una gráfica de una simulación.
 * @typedef {object} GraphSpec
 * @property {string} id identificador único en el módulo; es también el del apartado de la
 *   ficha que la explica («### Título {#id}» en ficha.md) y el que va en la URL (`ver`)
 * @property {string} title qué es la gráfica, en palabras («Superposición de dos estados»)
 * @property {string} short nombre corto para las pestañas y la línea de ubicación
 *   («ψ(x)», «espacio de momentos»)
 * @property {string} summary una frase: qué muestra (página de entrada y «Cambiar gráficas»)
 */

/**
 * Combinación sugerida de gráficas: una explica a la otra.
 * @typedef {object} ComboSpec
 * @property {string} id
 * @property {string} title lo que se entiende al verlas juntas («Por qué una superposición se mueve»)
 * @property {string} summary una frase
 * @property {string[]} graphs identificadores de gráficas de la misma simulación (dos, como mucho)
 */

/**
 * Una simulación del módulo. Las gráficas de simulaciones distintas no comparten estado:
 * solo se eligen gráficas de una misma simulación.
 * @typedef {object} SimulationSpec
 * @property {string} id valor del parámetro `simulationParam` que la abre
 * @property {string} title
 * @property {string} summary una frase: qué simula
 * @property {Record<string, number | string | boolean>} initial estado inicial propio, que se
 *   aplica al entrar desde la página de entrada (las claves que falten, por defecto)
 * @property {GraphSpec[]} graphs
 * @property {ComboSpec[]} combos
 */

/**
 * Hueco del núcleo donde una vista dibuja una gráfica (formato con simulaciones).
 * @typedef {object} GraphSlot
 * @property {HTMLElement} body contenedor con altura definida: aquí van createPlot y lo demás
 * @property {(parts: InfoPart[]) => void} setInfo línea secundaria bajo el título: los valores
 *   numéricos de la gráfica con su significado
 * @property {HTMLElement} legend caja para la leyenda en HTML (opción `htmlLegend` de createPlot)
 * @property {HTMLElement} titleExtra caja junto al título para un detalle propio (una muestra de color)
 * @property {boolean} visible si la gráfica está en la pantalla: las que no se ven no hace falta dibujarlas
 */

/**
 * Trozo de la línea secundaria de una gráfica: un texto con fórmulas $…$ (KaTeX), por
 * ejemplo 'momento medio $\langle p\rangle/\hbar = 1{,}15$ nm⁻¹'. Los trozos se separan con « · ».
 * @typedef {string} InfoPart
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
 * @property {(id: string) => GraphSlot} [graph] (formato con simulaciones) hueco de la gráfica
 *   `id` de la simulación abierta
 * @property {(parts: InfoPart[]) => void} [setStatus] (formato con simulaciones) bloque «Estado»
 *   de la barra lateral, para los números que no son de ninguna gráfica
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
 * @property {string} [intro] (formato con simulaciones) párrafo de la página de entrada: de qué
 *   va el módulo y por qué importa (Markdown con fórmulas)
 * @property {string} [simulationParam] (formato con simulaciones) clave del parámetro select
 *   cuyas opciones son las simulaciones
 * @property {SimulationSpec[]} [simulations] (formato con simulaciones) las simulaciones
 */

export {};
