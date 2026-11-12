// @ts-check
// Carga un archivo JSON de datos (data/…) tanto en el navegador como en Node.
//
//   const tabla = await loadJSON(new URL('../../data/cie/illuminants.json', import.meta.url));
//
// La dirección se da SIEMPRE relativa al archivo que la pide, con `new URL(ruta,
// import.meta.url)`: así funciona igual en GitHub Pages (bajo /laboratorio/), en local y
// en los tests de Node, donde la dirección es un archivo del disco (file://).
//
// Cada archivo se descarga una sola vez: las llamadas repetidas reciben la misma promesa.

/** @type {Map<string, Promise<any>>} */
const cache = new Map();

/**
 * @param {URL} url dirección absoluta del archivo (http, https o file)
 * @returns {Promise<any>} el contenido ya interpretado
 */
export function loadJSON(url) {
  const key = url.href;
  let pending = cache.get(key);
  if (!pending) {
    pending = read(url);
    // Si falla (sin conexión), no se guarda el fallo: la próxima llamada lo reintenta.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/**
 * @param {URL} url
 * @returns {Promise<any>}
 */
async function read(url) {
  if (url.protocol === 'file:') {
    // Node (tests y herramientas): fetch no sabe leer archivos del disco.
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(url, 'utf8'));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url.pathname} (HTTP ${response.status})`);
  return response.json();
}
