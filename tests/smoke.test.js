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
import { modules } from '../src/modules/registry.js';
import { buildHash, defaultState } from '../src/core/state.js';

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
  assert.equal(await page.locator('.cover h1').textContent(), 'Laboratorio de física');
  await page.screenshot({ path: join(shots, 'portada.png') });
  await close();
  assert.deepEqual(errors, []);
});

test('un módulo inexistente muestra un aviso, sin errores', { skip }, async () => {
  const { page, errors, close } = await openPage('#/no-existe');
  assert.match(await page.locator('.cover').textContent(), /no-existe/);
  await close();
  assert.deepEqual(errors, []);
});

// Todos los módulos registrados (también los ocultos) deben cargar sin errores en los
// dos temas. Se guarda una captura de cada uno.
for (const m of modules) {
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    test(`[${m.id}] carga sin errores (tema ${theme})`, { skip }, async () => {
      const { page, errors, close } = await openPage(`#/${m.id}`, { theme });
      assert.equal(await page.locator('#topbar-title').textContent(), m.title);
      // La dirección se completa con todos los parámetros.
      assert.equal(new URL(page.url()).hash, buildHash(m.id, m.params, defaultState(m.params)));
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(shots, `${m.id}-${theme}.png`) });
      await close();
      assert.deepEqual(errors, []);
    });
  }
}

// Estado ↔ URL ↔ controles, sobre la galería (tiene un control de cada tipo).
test('controles, estado y URL están sincronizados', { skip }, async () => {
  const { page, errors, close } = await openPage('#/_galeria?k=5&sigma=99&colormap=magma&otro=1');
  // k = 5 es válido; sigma = 99 está fuera de rango (se ignora); "otro" no existe.
  assert.equal(await page.locator('[data-key="k"] input[type="range"]').inputValue(), '5');
  assert.equal(await page.locator('[data-key="sigma"] input[type="range"]').inputValue(), '1');
  assert.equal(await page.locator('[data-key="colormap"] select').inputValue(), 'magma');
  assert.equal(new URL(page.url()).hash, '#/_galeria?k=5&sigma=1&colormap=magma&markers=1');

  // Mover controles actualiza la URL.
  await page.locator('[data-key="colormap"] select').selectOption('viridis');
  await page.locator('[data-key="markers"] input').uncheck();
  await page.locator('[data-key="k"] .control-number').fill('2.5');
  await page.locator('[data-key="k"] .control-number').press('Enter');
  await page.waitForFunction(() => location.hash === '#/_galeria?k=2.5&sigma=1&colormap=viridis&markers=0');
  assert.equal(await page.locator('[data-key="k"] input[type="range"]').inputValue(), '2.5');

  // Editar la URL a mano actualiza los controles, sin recargar la página.
  await page.evaluate(() => {
    location.hash = '#/_galeria?k=7&sigma=0.5&colormap=divergente&markers=1';
  });
  await page.waitForFunction(
    () => /** @type {HTMLInputElement} */ (document.querySelector('[data-key="k"] input[type="range"]')).value === '7',
  );
  assert.equal(await page.locator('[data-key="sigma"] .control-number').inputValue(), '0.50');
  assert.equal(await page.locator('[data-key="markers"] input').isChecked(), true);

  // El panel lateral se pliega.
  await page.locator('.panel-toggle').click();
  assert.equal(await page.locator('.module-page').getAttribute('data-panel'), 'closed');
  assert.equal(await page.locator('.side-panel').isVisible(), false);
  await close();
  assert.deepEqual(errors, []);
});
