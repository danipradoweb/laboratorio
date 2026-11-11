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
  assert.equal(new URL(page.url()).hash, '#/_galeria?k=5&sigma=1&colormap=magma&markers=1&rotar=0');

  // Mover controles actualiza la URL.
  await page.locator('[data-key="colormap"] select').selectOption('viridis');
  await page.locator('[data-key="markers"] input').uncheck();
  await page.locator('[data-key="k"] .control-number').fill('2.5');
  await page.locator('[data-key="k"] .control-number').press('Enter');
  await page.waitForFunction(() => location.hash === '#/_galeria?k=2.5&sigma=1&colormap=viridis&markers=0&rotar=0');
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

// Trazador 2D: un clic en la gráfica cambia el estado (vistas enlazadas) y el botón PNG
// descarga una imagen.
test('plot2d: clic en la gráfica y exportación a PNG', { skip }, async () => {
  const { page, errors, close } = await openPage('#/_galeria');
  const canvas = page.locator('.galeria-grid .panel').first().locator('canvas');
  const box = await canvas.boundingBox();
  // Clic a tres cuartos del ancho: x > 0, así que σ cambia a un valor distinto de 1.
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.waitForFunction(() => !location.hash.includes('sigma=1&'));
  const sigma = Number(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('sigma'));
  assert.ok(sigma > 1 && sigma <= 2, `σ = ${sigma}`);

  const downloadPromise = page.waitForEvent('download');
  await canvas.hover();
  await page.locator('.galeria-grid .panel').first().locator('.plot-export').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'galeria-series.png');
  await close();
  assert.deepEqual(errors, []);
});

// Presets con transición animada, recorrido guiado y reloj, sobre la galería.
test('presets con transición, recorrido guiado y reloj de animación', { skip }, async () => {
  const { page, errors, close } = await openPage('#/_galeria');
  const k = page.locator('[data-key="k"] input[type="range"]');

  // Clic en un preset: los valores cambian poco a poco (transición de 1,5 s) y acaban
  // exactamente en el preset; la URL y el botón activo se actualizan.
  await page.locator('.preset[data-preset="estrecho"]').click();
  await page.waitForTimeout(500);
  const midway = Number(await k.inputValue());
  assert.ok(midway > 3 && midway < 6, `a mitad de transición k = ${midway}`);
  await page.waitForFunction(() => location.hash.includes('k=6&sigma=0.5&'));
  assert.equal(await page.locator('.preset[data-preset="estrecho"]').getAttribute('aria-pressed'), 'true');

  // Tocar un control durante una transición la cancela: manda el usuario.
  await page.locator('.preset[data-preset="ancho"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-key="k"] .control-number').fill('4');
  await page.locator('[data-key="k"] .control-number').press('Enter');
  await page.waitForTimeout(1700);
  assert.equal(await k.inputValue(), '4');
  assert.equal(await page.locator('.preset[aria-pressed="true"]').count(), 0);

  // Recorrido: empieza en el primer paso y avanza con las flechas de la barra.
  await page.locator('.tour-start[data-tour="servicios"]').click();
  assert.match(await page.locator('.tour-counter').textContent(), /Paso 1 de 3/);
  await page.waitForFunction(() => location.hash.includes('k=6&sigma=0.5&'));
  await page.locator('.tour-nav button[aria-label="Paso siguiente"]').click();
  assert.match(await page.locator('.tour-counter').textContent(), /Paso 2 de 3/);
  // El parámetro discreto (mapa de color) cambia al final de la transición.
  await page.waitForFunction(() => location.hash.includes('k=1.5&sigma=1.8&colormap=viridis'));
  await page.screenshot({ path: join(shots, '_galeria-recorrido.png') });
  await page.locator('.tour-nav button', { hasText: 'Terminar' }).click();
  assert.equal(await page.locator('.tour-bar').isVisible(), false);

  // Reloj: con la fase girando, la gráfica cambia sola; en pausa, se queda quieta.
  await page.locator('[data-key="rotar"] input').check();
  const canvas = page.locator('.galeria-grid .panel').first().locator('canvas');
  const frame = () => canvas.evaluate((/** @type {HTMLCanvasElement} */ c) => c.toDataURL());
  const a = await frame();
  await page.waitForTimeout(300);
  assert.notEqual(await frame(), a, 'la animación no avanza');
  await page.locator('.clock-play').click();
  assert.equal(await page.locator('.clock-play').textContent(), 'Reanudar');
  const b = await frame();
  await page.waitForTimeout(300);
  assert.equal(await frame(), b, 'en pausa la gráfica no debe cambiar');
  await close();
  assert.deepEqual(errors, []);
});

// Modo presentación: lienzo 16:9, controles ocultos y atajos de teclado. Se guardan
// capturas a 1920 × 1080 en los dos temas para revisarlas a ojo.
for (const theme of /** @type {const} */ (['light', 'dark'])) {
  test(`modo presentación a 1920 × 1080 (tema ${theme})`, { skip }, async () => {
    const { page, errors, close } = await openPage('#/_galeria', { width: 1920, height: 1080, theme });
    await page.keyboard.press('p');
    await page.waitForSelector('html[data-presentation="true"]');
    assert.equal(await page.locator('.topbar').isVisible(), false);
    assert.equal(await page.locator('.side-panel').isVisible(), false);
    const frame = await page.locator('.stage-frame').boundingBox();
    assert.ok(Math.abs(frame.width / frame.height - 16 / 9) < 0.01, 'el lienzo no es 16:9');
    assert.ok(Math.abs(frame.width - 1920) < 1 && Math.abs(frame.height - 1080) < 1);

    // 1–9: salta a un preset.
    await page.keyboard.press('2');
    await page.waitForFunction(() => location.hash.includes('k=1.5&sigma=1.8&colormap=viridis'));
    // Espacio: pausa. Corchetes: velocidad.
    await page.keyboard.press(' ');
    assert.equal(await page.locator('.presentation-toast').textContent(), 'Pausa');
    await page.keyboard.press(']');
    assert.equal(await page.locator('.presentation-toast').textContent(), 'Velocidad ×2');
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    assert.equal(await page.locator('.presentation-toast').textContent(), 'Velocidad ×0,5');
    // C: cambia el tema.
    await page.keyboard.press('c');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme === 'light' ? 'dark' : 'light');
    await page.keyboard.press('c');
    await page.waitForTimeout(1300);
    await page.screenshot({ path: join(shots, `presentacion-${theme}.png`) });

    // Recorrido dentro del modo presentación: flechas y tecla T.
    await page.keyboard.press('p');
    await page.locator('.tour-start').first().click();
    await page.keyboard.press('p');
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('.tour-counter').textContent(), /Paso 2 de 3/);
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('.tour-counter').textContent(), /Paso 3 de 3/);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(shots, `presentacion-recorrido-${theme}.png`) });
    await page.keyboard.press('t');
    assert.equal(await page.locator('.tour-bar').isVisible(), false);
    await page.keyboard.press('t');
    assert.equal(await page.locator('.tour-bar').isVisible(), true);

    // Esc sale y todo vuelve a su sitio.
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.presentation), undefined);
    assert.equal(await page.locator('.topbar').isVisible(), true);
    await close();
    assert.deepEqual(errors, []);
  });
}

// En una ventana que no es 16:9, el lienzo se ajusta al lado que limita y queda centrado.
test('modo presentación: lienzo 16:9 centrado en una ventana 4:3', { skip }, async () => {
  const { page, errors, close } = await openPage('#/_galeria', { width: 1024, height: 768 });
  await page.locator('.page-actions button', { hasText: 'Presentación' }).click();
  await page.waitForSelector('html[data-presentation="true"]');
  const frame = await page.locator('.stage-frame').boundingBox();
  assert.ok(Math.abs(frame.width - 1024) < 1);
  assert.ok(Math.abs(frame.height - 576) < 1);
  assert.ok(Math.abs(frame.y - (768 - 576) / 2) < 1);
  await close();
  assert.deepEqual(errors, []);
});

// Fichas: cada módulo abre su ficha, con sus cinco secciones y las fórmulas dibujadas
// por KaTeX (sin peticiones fallidas: las fuentes deben estar en vendor/).
for (const m of modules) {
  test(`[${m.id}] la ficha se abre y KaTeX dibuja las fórmulas`, { skip }, async () => {
    const { page, errors, close } = await openPage(`#/${m.id}`);
    await page.locator('.page-actions button', { hasText: 'Ficha' }).click();
    await page.waitForSelector('.ficha-panel[data-loaded="true"]');
    const headings = await page.locator('.ficha-panel h2').allTextContents();
    assert.deepEqual(headings, [
      'Qué estás viendo',
      'Qué es físico y qué es representación',
      'Ecuaciones',
      'Límites del modelo',
      'Referencias',
    ]);
    const formulas = await page.locator('.ficha-panel .math').count();
    assert.ok(formulas > 0, 'la ficha no tiene fórmulas');
    assert.equal(await page.locator('.ficha-panel .math .katex').count(), formulas, 'hay fórmulas sin dibujar');
    assert.equal(await page.locator('.ficha-panel .katex-error').count(), 0, 'KaTeX no entiende alguna fórmula');
    await page.waitForTimeout(300); // carga de las fuentes
    await page.screenshot({ path: join(shots, `${m.id}-ficha.png`) });
    // Se cierra con el mismo botón.
    await page.locator('.page-actions button', { hasText: 'Ficha' }).click();
    assert.equal(await page.locator('.ficha-panel').isVisible(), false);
    await close();
    assert.deepEqual(errors, []);
  });
}

// El texto de los recorridos también es Markdown con fórmulas.
test('el texto del recorrido se pinta como Markdown con KaTeX', { skip }, async () => {
  const { page, errors, close } = await openPage('#/_galeria');
  await page.locator('.tour-start').first().click();
  await page.waitForSelector('.tour-text .katex');
  assert.equal(await page.locator('.tour-text strong').textContent(), 'estrecho');
  assert.equal(await page.locator('.tour-text .katex-error').count(), 0);
  await close();
  assert.deepEqual(errors, []);
});
