// @ts-check
// Estado de un módulo y su sincronización con la URL.
//
// La lista `params` del descriptor de un módulo es la ÚNICA fuente de verdad: de ella
// salen los controles, el estado inicial, la validación y la forma de la URL.
//
//   #/plasmon?radius=40&material=Ag&medium=1.33
//
// Reglas:
//   - En la URL se escriben SIEMPRE todos los parámetros, para que un enlace copiado
//     siga reproduciendo lo mismo aunque algún día cambien los valores por defecto.
//   - Al leer la URL, los parámetros ausentes toman su valor por defecto y los
//     inválidos (tipo incorrecto, fuera de rango, opción inexistente, clave
//     desconocida) se ignoran con un aviso.
//
// Este archivo no toca el DOM ni `location`: son funciones puras que se prueban en
// Node. Quien lee y escribe la barra de direcciones es app.js.

/**
 * Parámetro numérico continuo (deslizador).
 * @typedef {object} RangeParam
 * @property {string} key identificador (aparece en la URL)
 * @property {string} label texto del control, en español
 * @property {'range'} type
 * @property {number} min
 * @property {number} max
 * @property {number} step paso del deslizador
 * @property {number} default
 * @property {string} [unit] unidad, se muestra junto al valor
 * @property {string} [help] explicación breve (aparece como ayuda del control)
 * @property {(state: Readonly<Record<string, number | string | boolean>>) => boolean} [visible] si se da, el control
 *   solo se muestra cuando devuelve true (el parámetro sigue en el estado y en la URL)
 */

/**
 * Parámetro discreto (lista desplegable). Cada opción es un texto, o un objeto
 * { value, label } si el texto visible debe ser distinto del valor de la URL.
 * @typedef {object} SelectParam
 * @property {string} key
 * @property {string} label
 * @property {'select'} type
 * @property {(string | { value: string, label: string })[]} options
 * @property {string} default
 * @property {string} [help]
 * @property {(state: Readonly<Record<string, number | string | boolean>>) => boolean} [visible] si se da, el control
 *   solo se muestra cuando devuelve true (el parámetro sigue en el estado y en la URL)
 */

/**
 * Parámetro booleano (conmutador).
 * @typedef {object} ToggleParam
 * @property {string} key
 * @property {string} label
 * @property {'toggle'} type
 * @property {boolean} default
 * @property {string} [help]
 * @property {(state: Readonly<Record<string, number | string | boolean>>) => boolean} [visible] si se da, el control
 *   solo se muestra cuando devuelve true (el parámetro sigue en el estado y en la URL)
 */

/**
 * @typedef {RangeParam | SelectParam | ToggleParam} Param
 * @typedef {number | string | boolean} ParamValue
 * @typedef {Readonly<Record<string, ParamValue>>} State
 * @typedef {{ ok: true, value: ParamValue } | { ok: false, reason: string }} Validation
 */

/**
 * Valores admitidos por un parámetro de tipo select.
 * @param {SelectParam} param
 * @returns {string[]}
 */
export function optionValues(param) {
  return param.options.map((o) => (typeof o === 'string' ? o : o.value));
}

/**
 * Estado inicial: cada parámetro con su valor por defecto.
 * @param {readonly Param[]} params
 * @returns {State}
 */
export function defaultState(params) {
  /** @type {Record<string, ParamValue>} */
  const state = {};
  for (const p of params) state[p.key] = p.default;
  return Object.freeze(state);
}

/**
 * Comprueba que un valor (ya con su tipo de JavaScript) es válido para un parámetro.
 * @param {Param} param
 * @param {unknown} value
 * @returns {Validation}
 */
export function validateValue(param, value) {
  switch (param.type) {
    case 'range':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, reason: `"${param.key}" debe ser un número` };
      }
      if (value < param.min || value > param.max) {
        return {
          ok: false,
          reason: `"${param.key}" = ${value} está fuera del rango [${param.min}, ${param.max}]`,
        };
      }
      return { ok: true, value };
    case 'select':
      if (typeof value !== 'string' || !optionValues(param).includes(value)) {
        return { ok: false, reason: `"${param.key}" = ${String(value)} no es una opción válida` };
      }
      return { ok: true, value };
    case 'toggle':
      if (typeof value !== 'boolean') {
        return { ok: false, reason: `"${param.key}" debe ser verdadero o falso` };
      }
      return { ok: true, value };
    default:
      return { ok: false, reason: `tipo de parámetro desconocido en "${/** @type {any} */ (param).key}"` };
  }
}

/**
 * Convierte el texto de la URL en un valor del tipo del parámetro y lo valida.
 * @param {Param} param
 * @param {string} text
 * @returns {Validation}
 */
export function parseValue(param, text) {
  switch (param.type) {
    case 'range': {
      // Number('') es 0 y Number(' ') es 0: se rechazan explícitamente.
      const value = text.trim() === '' ? NaN : Number(text);
      return validateValue(param, value);
    }
    case 'toggle':
      if (text === '1' || text === 'true') return { ok: true, value: true };
      if (text === '0' || text === 'false') return { ok: true, value: false };
      return { ok: false, reason: `"${param.key}" = ${text} debe ser 1 o 0` };
    default:
      return validateValue(param, text);
  }
}

/**
 * Escribe un número con como mucho 12 cifras significativas, para que 0.1 + 0.2 salga
 * "0.3" y no "0.30000000000000004".
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return String(Number(value.toPrecision(12)));
}

/**
 * Convierte un valor del estado en el texto que va a la URL.
 * @param {ParamValue} value
 * @returns {string}
 */
function valueToText(value) {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return value;
}

/**
 * Completa y valida un estado parcial (por ejemplo, el de un preset): las claves que
 * faltan toman el valor por defecto; las inválidas o desconocidas se ignoran con aviso.
 * @param {readonly Param[]} params
 * @param {Readonly<Record<string, unknown>>} partial
 * @returns {{ state: State, warnings: string[] }}
 */
export function normalizeState(params, partial) {
  /** @type {Record<string, ParamValue>} */
  const state = {};
  /** @type {string[]} */
  const warnings = [];
  for (const p of params) {
    state[p.key] = p.default;
    if (Object.hasOwn(partial, p.key)) {
      const result = validateValue(p, partial[p.key]);
      if (result.ok) state[p.key] = result.value;
      else warnings.push(`${result.reason}; se usa el valor por defecto`);
    }
  }
  const known = new Set(params.map((p) => p.key));
  for (const key of Object.keys(partial)) {
    if (!known.has(key)) warnings.push(`parámetro desconocido "${key}"; se ignora`);
  }
  return { state: Object.freeze(state), warnings };
}

/**
 * Separa el hash de la URL en identificador de módulo y parámetros (todavía como texto).
 *   ''  '#'  '#/'                → portada: { moduleId: null, query: {} }
 *   '#/plasmon?radius=40&m=Ag'   → { moduleId: 'plasmon', query: { radius: '40', m: 'Ag' } }
 * @param {string} hash
 * @returns {{ moduleId: string | null, query: Record<string, string> }}
 */
export function parseHash(hash) {
  let text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (text.startsWith('/')) text = text.slice(1);
  const q = text.indexOf('?');
  const path = q >= 0 ? text.slice(0, q) : text;
  const queryText = q >= 0 ? text.slice(q + 1) : '';
  /** @type {Record<string, string>} */
  const query = {};
  // URLSearchParams descodifica %XX. Si una clave se repite, vale la última.
  for (const [key, value] of new URLSearchParams(queryText)) query[key] = value;
  let moduleId = null;
  if (path !== '') {
    try {
      moduleId = decodeURIComponent(path);
    } catch {
      moduleId = path;
    }
  }
  return { moduleId, query };
}

/**
 * Construye el estado a partir de los parámetros de la URL.
 * @param {readonly Param[]} params
 * @param {Readonly<Record<string, string>>} query
 * @returns {{ state: State, warnings: string[] }}
 */
export function stateFromQuery(params, query) {
  /** @type {Record<string, ParamValue>} */
  const state = {};
  /** @type {string[]} */
  const warnings = [];
  for (const p of params) {
    state[p.key] = p.default;
    if (Object.hasOwn(query, p.key)) {
      const result = parseValue(p, query[p.key]);
      if (result.ok) state[p.key] = result.value;
      else warnings.push(`URL: ${result.reason}; se usa el valor por defecto`);
    }
  }
  const known = new Set(params.map((p) => p.key));
  for (const key of Object.keys(query)) {
    if (!known.has(key)) warnings.push(`URL: parámetro desconocido "${key}"; se ignora`);
  }
  return { state: Object.freeze(state), warnings };
}

/**
 * Escribe el estado como cadena de consulta, con todos los parámetros y en el orden
 * de `params`:  'radius=40&material=Ag'.
 * @param {readonly Param[]} params
 * @param {State} state
 * @returns {string}
 */
export function serializeState(params, state) {
  return params
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(valueToText(state[p.key]))}`)
    .join('&');
}

/**
 * Hash completo de un módulo en un estado:  '#/plasmon?radius=40&material=Ag'.
 * @param {string} moduleId
 * @param {readonly Param[]} params
 * @param {State} state
 * @returns {string}
 */
export function buildHash(moduleId, params, state) {
  const query = serializeState(params, state);
  return `#/${encodeURIComponent(moduleId)}${query ? `?${query}` : ''}`;
}

/**
 * ¿Tienen dos estados los mismos valores?
 * @param {State} a
 * @param {State} b
 * @returns {boolean}
 */
export function statesEqual(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/**
 * Quién ha provocado un cambio de estado. Sirve, por ejemplo, para que una transición
 * animada se cancele si el usuario toca un control.
 * @typedef {'control' | 'view' | 'url' | 'preset' | 'transition'} ChangeSource
 * @typedef {(state: State, change: { keys: string[], source: ChangeSource }) => void} StateListener
 */

/**
 * Almacén del estado de un módulo: guarda el estado actual, lo valida al cambiarlo y
 * avisa a quien se haya suscrito.
 *
 * `set` está pensado para la interacción (controles, clics en una vista, transiciones):
 * los números fuera de rango se recortan al límite más cercano en vez de rechazarse.
 * Para la URL, que debe ignorar los valores inválidos, usa `stateFromQuery` + `replace`.
 *
 * @param {readonly Param[]} params
 * @param {State} [initial] estado inicial ya validado (por defecto, los valores por defecto)
 */
export function createStore(params, initial) {
  /** @type {State} */
  let state = initial ?? defaultState(params);
  /** @type {Set<StateListener>} */
  const listeners = new Set();
  const byKey = new Map(params.map((p) => [p.key, p]));

  /**
   * @param {State} next
   * @param {ChangeSource} source
   */
  function commit(next, source) {
    const keys = Object.keys(next).filter((k) => next[k] !== state[k]);
    if (keys.length === 0) return;
    state = next;
    for (const listener of [...listeners]) listener(state, { keys, source });
  }

  return {
    /** @returns {State} estado actual (objeto congelado: no se puede modificar) */
    get() {
      return state;
    },

    /**
     * Cambia uno o varios parámetros.
     * @param {Readonly<Record<string, unknown>>} patch
     * @param {ChangeSource} [source]
     * @returns {string[]} avisos (vacío si todo era válido)
     */
    set(patch, source = 'control') {
      /** @type {Record<string, ParamValue>} */
      const next = { ...state };
      /** @type {string[]} */
      const warnings = [];
      for (const [key, raw] of Object.entries(patch)) {
        const param = byKey.get(key);
        if (!param) {
          warnings.push(`parámetro desconocido "${key}"; se ignora`);
          continue;
        }
        let value = raw;
        if (param.type === 'range' && typeof value === 'number' && Number.isFinite(value)) {
          value = Math.min(param.max, Math.max(param.min, value));
        }
        const result = validateValue(param, value);
        if (result.ok) next[key] = result.value;
        else warnings.push(`${result.reason}; se ignora`);
      }
      commit(Object.freeze(next), source);
      return warnings;
    },

    /**
     * Sustituye el estado completo por otro ya validado (de `stateFromQuery` o
     * `normalizeState`).
     * @param {State} next
     * @param {ChangeSource} [source]
     */
    replace(next, source = 'url') {
      commit(next, source);
    },

    /**
     * Se suscribe a los cambios. Devuelve la función para darse de baja.
     * @param {StateListener} listener
     * @returns {() => void}
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** @typedef {ReturnType<typeof createStore>} Store */
