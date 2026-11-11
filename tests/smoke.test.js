// @ts-check
// Prueba de humo: abre la web en un navegador sin cabeza, servida desde la subruta
// /laboratorio/ (como en GitHub Pages), y comprueba que carga sin errores.
// Guarda capturas en capturas/ (no se versionan).
//
// Si Playwright no está instalado, o si SKIP_SMOKE=1, se omite sin fallar.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tools/serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'capturas');

/** @type {any} */
let playwright = null;
if (!process.env.SKIP_SMOKE) {
  try {
    // require (y no import) porque respeta NODE_PATH, donde suele estar Playwright global.
    playwright = createRequire(import.meta.url)('playwright');
  } catch {
    playwright = null;
  }
}
const skip = playwright ? false : 'Playwright no disponible o SKIP_SMOKE=1';

/** @type {any} */
let browser;
/** @type {{ url: string, close: () => Promise<void> }} */
let server;

before(async () => {
  if (skip) return;
  mkdirSync(shots, { recursive: true });
  server = await startServer({ base: '/laboratorio/' });
  browser = await playwright.chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

/**
 * Abre una página y recoge todo lo que cuenta como error: excepciones, mensajes de
 * error en consola, peticiones fallidas y respuestas HTTP >= 400.
 * @param {string} hash por ejemplo '#/oscilador'
 * @param {{ width?: number, height?: number, theme?: 'light' | 'dark' }} [options]
 */
export async function openPage(hash, { width = 1280, height = 800, theme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((/** @type {string} */ t) => {
    localStorage.setItem('laboratorio:tema', t);
  }, theme);
  const page = await context.newPage();
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (/** @type {Error} */ e) => errors.push(`excepción: ${e.message}`));
  page.on('console', (/** @type {any} */ m) => {
    if (m.type() === 'error') errors.push(`consola: ${m.text()}`);
  });
  page.on('requestfailed', (/** @type {any} */ r) => errors.push(`petición fallida: ${r.url()}`));
  page.on('response', (/** @type {any} */ r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.goto(server.url + hash);
  await page.waitForSelector('html[data-ready="true"]');
  return { page, errors, close: () => context.close() };
}

test('la portada carga desde la subruta /laboratorio/ sin errores', { skip }, async () => {
  const { page, errors, close } = await openPage('');
  assert.equal(await page.title(), 'Laboratorio de física');
  await page.screenshot({ path: join(shots, 'portada.png') });
  await close();
  assert.deepEqual(errors, []);
});
