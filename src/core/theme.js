// @ts-check
// Temas claro y oscuro.
//
// El tema es el atributo data-theme de <html> ('light' o 'dark'). Todos los colores
// de la interfaz son variables CSS definidas en src/ui/styles.css para cada tema.
// Lo que se dibuja en un canvas (gráficas, 3D) no puede usar variables CSS
// directamente: para eso está themeColors(), que las lee y las devuelve como texto.
//
// La elección se guarda en localStorage. Un pequeño script en index.html aplica el
// tema guardado antes del primer pintado para que la página no parpadee.

/** @typedef {'light' | 'dark'} ThemeName */

/** Clave de localStorage (la misma que usa el script de index.html). */
export const THEME_STORAGE_KEY = 'laboratorio:tema';

/** @type {Set<(theme: ThemeName) => void>} */
const listeners = new Set();

/**
 * Tema actual.
 * @returns {ThemeName}
 */
export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * Cambia el tema, lo guarda y avisa a los suscriptores (las gráficas se redibujan).
 * @param {ThemeName} theme
 */
export function setTheme(theme) {
  if (theme === getTheme()) return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento local (modo privado estricto): el tema vale solo para esta visita.
  }
  for (const listener of [...listeners]) listener(theme);
}

/** Alterna entre claro y oscuro. */
export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Se suscribe a los cambios de tema. Devuelve la función para darse de baja.
 * @param {(theme: ThemeName) => void} listener
 * @returns {() => void}
 */
export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Colores del tema actual, para dibujar en canvas.
 * @typedef {object} ThemeColors
 * @property {string} bg fondo de la página
 * @property {string} surface fondo de paneles y gráficas
 * @property {string} text texto principal
 * @property {string} textSoft texto secundario (marcas de ejes)
 * @property {string} border bordes y ejes
 * @property {string} grid rejilla de las gráficas
 * @property {string} accent color de acento (marcadores)
 * @property {string[]} series colores de las series, en orden; aptos para daltónicos
 */

/**
 * Lee los colores del tema actual desde las variables CSS.
 * @returns {ThemeColors}
 */
export function themeColors() {
  const style = getComputedStyle(document.documentElement);
  /** @param {string} name */
  const v = (name) => style.getPropertyValue(name).trim();
  return {
    bg: v('--bg'),
    surface: v('--surface'),
    text: v('--text'),
    textSoft: v('--text-soft'),
    border: v('--border'),
    grid: v('--grid'),
    accent: v('--accent'),
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--series-${i}`)),
  };
}
