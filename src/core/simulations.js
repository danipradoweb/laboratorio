// @ts-check
// Simulaciones y gráficas de un módulo con el formato del encargo R1 (piloto en funcion-onda).
//
// Un módulo con este formato declara en su descriptor:
//   intro            párrafo de la página de entrada (#/<id> sin nada más)
//   simulationParam  el parámetro (un select) que dice qué simulación está abierta
//   simulations      cada una con su título, su frase, su estado inicial, sus gráficas y sus
//                    combinaciones sugeridas (ver src/modules/types.js)
//
// La pantalla que se ve sale de la URL:
//   #/funcion-onda                                    página de entrada
//   #/funcion-onda?part=paquete&…&ver=psi,momentos    simulación «paquete», dos gráficas
//   …&pantalla=2                                      segunda pantalla de la selección
//   …&pantalla=juntas                                 todas las elegidas en una pantalla
// `ver` ausente significa «todas las gráficas de la simulación»; `pantalla` ausente, la 1.
//
// Funciones puras, sin DOM: se prueban en Node (tests/simulations.test.js).

import { buildHash, normalizeState } from './state.js';

/**
 * @typedef {import('../modules/types.js').ModuleDescriptor} ModuleDescriptor
 * @typedef {import('../modules/types.js').SimulationSpec} SimulationSpec
 * @typedef {import('../modules/types.js').GraphSpec} GraphSpec
 * @typedef {import('./state.js').State} State
 */

/** Claves de la URL que no son parámetros: qué gráficas y qué pantalla se ven. */
export const VIEW_KEYS = /** @type {const} */ (['ver', 'pantalla']);

/** Valor de `pantalla` para ver todas las gráficas elegidas juntas. */
export const TOGETHER = 'juntas';

/**
 * ¿Usa el módulo el formato con página de entrada y simulaciones?
 * @param {ModuleDescriptor} module
 * @returns {boolean}
 */
export function isPilot(module) {
  return Array.isArray(module.simulations) && module.simulations.length > 0;
}

/**
 * Simulación abierta en un estado (la de su parámetro de simulación, o la primera).
 * @param {ModuleDescriptor} module
 * @param {State} state
 * @returns {SimulationSpec}
 */
export function simulationOf(module, state) {
  const sims = module.simulations ?? [];
  const key = module.simulationParam ?? '';
  return sims.find((s) => s.id === state[key]) ?? sims[0];
}

/**
 * Busca una simulación por su identificador.
 * @param {ModuleDescriptor} module
 * @param {string} id
 * @returns {SimulationSpec | undefined}
 */
export function simulationById(module, id) {
  return (module.simulations ?? []).find((s) => s.id === id);
}

/**
 * Estado con el que se entra en una simulación desde la página de entrada: los valores por
 * defecto, cambiados por el estado inicial que declara la simulación.
 * @param {ModuleDescriptor} module
 * @param {SimulationSpec} simulation
 * @returns {State}
 */
export function initialStateOf(module, simulation) {
  const key = module.simulationParam ?? '';
  return normalizeState(module.params, { ...simulation.initial, [key]: simulation.id }).state;
}

/**
 * Separa de la consulta de la URL las claves de vista (ver, pantalla) y la selección.
 * @param {Readonly<Record<string, string>>} query
 * @returns {{ params: Record<string, string>, graphs: string[] | null, screen: string | null }}
 *   graphs: identificadores pedidos en `ver` (null si no hay `ver`); screen: el texto de `pantalla`
 */
export function splitViewQuery(query) {
  /** @type {Record<string, string>} */
  const params = {};
  for (const [key, value] of Object.entries(query)) {
    if (!(/** @type {readonly string[]} */ (VIEW_KEYS)).includes(key)) params[key] = value;
  }
  const graphs = Object.hasOwn(query, 'ver')
    ? query.ver
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g !== '')
    : null;
  return { params, graphs, screen: Object.hasOwn(query, 'pantalla') ? query.pantalla : null };
}

/**
 * Selección válida de gráficas de una simulación, en el orden en que la simulación las
 * declara. Las desconocidas se descartan; si no queda ninguna (o no se pidió ninguna), son
 * todas.
 * @param {SimulationSpec} simulation
 * @param {readonly string[] | null} requested
 * @returns {{ graphs: string[], warnings: string[] }}
 */
export function normalizeSelection(simulation, requested) {
  const known = simulation.graphs.map((g) => g.id);
  if (!requested) return { graphs: known, warnings: [] };
  const warnings = requested.filter((g) => !known.includes(g)).map((g) => `URL: la simulación «${simulation.id}» no tiene la gráfica "${g}"; se ignora`);
  const graphs = known.filter((g) => requested.includes(g));
  return { graphs: graphs.length > 0 ? graphs : known, warnings };
}

/**
 * Reparte las gráficas elegidas en pantallas de como mucho `perScreen` gráficas. Primero
 * van, en su orden, las combinaciones sugeridas cuyas gráficas estén todas elegidas y
 * libres (una gráfica explica a la otra); después, las que quedan, en el orden de la
 * simulación.
 * @param {SimulationSpec} simulation
 * @param {readonly string[]} selection
 * @param {number} perScreen 2 en escritorio, 1 en el móvil
 * @returns {string[][]} identificadores de las gráficas de cada pantalla
 */
export function planScreens(simulation, selection, perScreen) {
  const free = new Set(selection);
  /** @type {string[][]} */
  const screens = [];
  if (perScreen >= 2) {
    for (const combo of simulation.combos) {
      if (combo.graphs.length <= perScreen && combo.graphs.every((g) => free.has(g))) {
        screens.push([...combo.graphs]);
        for (const g of combo.graphs) free.delete(g);
      }
    }
  }
  const rest = simulation.graphs.map((g) => g.id).filter((g) => free.has(g));
  for (let i = 0; i < rest.length; i += Math.max(1, perScreen)) screens.push(rest.slice(i, i + Math.max(1, perScreen)));
  return screens;
}

/**
 * Pantalla pedida en la URL, ajustada a las que hay: un índice desde 0, o TOGETHER.
 * @param {string | null} text
 * @param {number} count número de pantallas
 * @returns {number | typeof TOGETHER}
 */
export function parseScreen(text, count) {
  if (text === TOGETHER) return TOGETHER;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) return 0;
  return Math.min(n, Math.max(1, count)) - 1;
}

/**
 * Parte de la URL con la selección y la pantalla: '&ver=psi,momentos&pantalla=2'. No
 * escribe `ver` si están elegidas todas, ni `pantalla` si es la primera.
 * @param {SimulationSpec} simulation
 * @param {readonly string[]} selection
 * @param {number | typeof TOGETHER} screen
 * @returns {string}
 */
export function viewQuery(simulation, selection, screen) {
  const all = simulation.graphs.length === selection.length && simulation.graphs.every((g) => selection.includes(g.id));
  let text = all ? '' : `&ver=${selection.map(encodeURIComponent).join(',')}`;
  if (screen === TOGETHER) text += `&pantalla=${TOGETHER}`;
  else if (screen > 0) text += `&pantalla=${screen + 1}`;
  return text;
}

/**
 * Dirección completa de una simulación: estado, selección y pantalla.
 * @param {ModuleDescriptor} module
 * @param {State} state
 * @param {readonly string[]} selection
 * @param {number | typeof TOGETHER} [screen]
 * @returns {string}
 */
export function simulationHash(module, state, selection, screen = 0) {
  return buildHash(module.id, module.params, state) + viewQuery(simulationOf(module, state), selection, screen);
}

/**
 * Dirección para entrar en una simulación desde la página de entrada, con su estado inicial.
 * @param {ModuleDescriptor} module
 * @param {SimulationSpec} simulation
 * @param {readonly string[]} [graphs] gráficas elegidas (todas si falta)
 * @returns {string}
 */
export function entryLink(module, simulation, graphs) {
  const state = initialStateOf(module, simulation);
  return buildHash(module.id, module.params, state) + viewQuery(simulation, normalizeSelection(simulation, graphs ?? null).graphs, 0);
}

/**
 * Gráfica de una simulación por su identificador.
 * @param {SimulationSpec} simulation
 * @param {string} id
 * @returns {GraphSpec | undefined}
 */
export function graphById(simulation, id) {
  return simulation.graphs.find((g) => g.id === id);
}

/**
 * Nombre de una pantalla (pestaña y línea de ubicación): los nombres cortos de sus gráficas.
 * @param {SimulationSpec} simulation
 * @param {readonly string[]} graphs
 * @returns {string}
 */
export function screenName(simulation, graphs) {
  const names = graphs.map((id) => graphById(simulation, id)?.short ?? id);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
