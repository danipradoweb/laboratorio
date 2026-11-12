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
  // Enlace de vuelta a la web personal.
  assert.equal(await page.locator('.cover-back').getAttribute('href'), 'https://danipradoweb.github.io/');
  // Una tarjeta por módulo visible, con título y resumen; los ocultos no salen.
  const visible = modules.filter((m) => !m.hidden);
  assert.equal(await page.locator('.card').count(), visible.length);
  for (const m of visible) {
    const card = page.locator(`.card[data-module="${m.id}"]`);
    assert.equal(await card.getAttribute('href'), `#/${m.id}`);
    assert.equal(await card.locator('h2').textContent(), m.title);
    assert.equal(await card.locator('p').textContent(), m.summary);
  }
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.screenshot({ path: join(shots, 'portada-dark.png') });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
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

// Oscilador: criterio de terminado del encargo 00 (estado en URL, vistas enlazadas,
// presets con transición, modo presentación). Guarda capturas de cada preset.
test('oscilador: URL, vistas enlazadas, presets y presentación', { skip }, async () => {
  const { page, errors, close } = await openPage('#/oscilador?omega=1&gamma=0.1&transient=0', { width: 1440, height: 900 });
  // La URL reproduce el estado: en resonancia el desfase es de 90° y A = ω₀/γ = 10.
  assert.match(await page.locator('.oscilador-grid .panel-title').nth(3).textContent(), /δ = 90°/);
  assert.match(await page.locator('.oscilador-grid .panel-title').nth(1).textContent(), /A = 10,00/);
  assert.match(await page.locator('.oscilador-grid .panel-title').nth(2).textContent(), /100 % del máximo/);

  // Vistas enlazadas: un clic en la gráfica de amplitud cambia ω en todas partes.
  const amplitude = page.locator('.oscilador-grid .panel').nth(1).locator('canvas');
  const box = await amplitude.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5);
  await page.waitForFunction(() => !location.hash.includes('omega=1&'));
  const omega = Number(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('omega'));
  assert.ok(omega > 2 && omega <= 3, `ω = ${omega}`);
  assert.equal(Number(await page.locator('[data-key="omega"] input[type="range"]').inputValue()), omega);
  const delta = Number((await page.locator('.oscilador-grid .panel-title').nth(3).textContent()).match(/δ = (\d+)°/)[1]);
  assert.ok(delta > 170, `por encima de la resonancia el desfase se acerca a 180°: ${delta}`);

  // Cada preset, con su captura.
  for (const [id, expected] of [
    ['por-debajo', 'omega=0.2&gamma=0.2'],
    ['resonancia', 'omega=1&gamma=0.2'],
    ['por-encima', 'omega=3&gamma=0.2'],
    ['poco-amortiguado', 'omega=1&gamma=0.05'],
    ['muy-amortiguado', 'omega=1&gamma=1.5'],
  ]) {
    await page.locator(`.preset[data-preset="${id}"]`).click();
    await page.waitForFunction((/** @type {string} */ e) => location.hash.includes(e), expected);
    assert.equal(await page.locator(`.preset[data-preset="${id}"]`).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: join(shots, `oscilador-preset-${id}.png`) });
  }

  // Modo presentación con el preset 2 (resonancia).
  await page.keyboard.press('p');
  await page.keyboard.press('2');
  await page.waitForFunction(() => location.hash.includes('omega=1&gamma=0.2'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, 'oscilador-presentacion.png') });
  await close();
  assert.deepEqual(errors, []);
});

// Recorrido del oscilador: cinco pasos, cada uno lleva a su preset y pinta su texto con
// fórmulas. Se recorre en modo presentación con las flechas y se guarda cada paso.
test('oscilador: recorrido «Qué significa resonancia» en modo presentación', { skip }, async () => {
  const { page, errors, close } = await openPage('#/oscilador', { width: 1920, height: 1080 });
  await page.locator('.tour-start[data-tour="resonancia"]').click();
  await page.keyboard.press('p');
  const expected = ['omega=0.2&gamma=0.2', 'omega=1&gamma=0.2', 'omega=3&gamma=0.2', 'omega=1&gamma=0.05', 'omega=1&gamma=1.5'];
  for (let step = 0; step < expected.length; step++) {
    assert.match(await page.locator('.tour-counter').textContent(), new RegExp(`Paso ${step + 1} de 5`));
    await page.waitForFunction((/** @type {string} */ e) => location.hash.includes(e), expected[step]);
    await page.waitForSelector('.tour-text .katex');
    assert.equal(await page.locator('.tour-text .katex-error').count(), 0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(shots, `oscilador-recorrido-${step + 1}.png`) });
    await page.keyboard.press('ArrowRight');
  }
  // En el último paso la flecha derecha no hace nada.
  assert.match(await page.locator('.tour-counter').textContent(), /Paso 5 de 5/);
  await close();
  assert.deepEqual(errors, []);
});

// Plasmón: criterio de terminado del encargo 01 (cinco vistas enlazadas, presets,
// recorridos y modo presentación). Guarda una captura de cada preset.
test('plasmón: URL, cinco vistas enlazadas, colores y presets', { skip }, async () => {
  const { page, errors, close } = await openPage('#/plasmon?material=Ag&diameter=20&lambda=387', { width: 1440, height: 900 });
  const titles = page.locator('.plasmon-grid .panel-title');
  const title = async (/** @type {number} */ i) => String(await titles.nth(i).textContent());
  // Cinco paneles; cuatro lienzos (tres gráficas del trazador y la nube electrónica).
  assert.equal(await titles.count(), 5);
  assert.equal(await page.locator('.plasmon-grid canvas').count(), 4);
  // La URL reproduce el estado: plata de 20 nm, con el pico de extinción cerca de 387 nm
  // y la nube electrónica casi en cuadratura con la fuerza.
  assert.match(await title(0), /pico de extinción en 38[5-9] nm/);
  const delta = Number((await title(2)).match(/δ = (\d+)°/)?.[1]);
  assert.ok(delta > 75 && delta < 100, `δ = ${delta}° en la resonancia de la plata`);
  assert.match(String(await page.locator('.plasmon-model').textContent()), /Esfera de plata de 20 nm · teoría de Mie/);

  // Vistas enlazadas: un clic en el espectro cambia λ en el control, en la URL y en las
  // demás vistas (lejos de la resonancia, la nube sigue a la fuerza casi en fase).
  const spectrum = page.locator('.plasmon-grid .panel').nth(0).locator('canvas');
  const box = await spectrum.boundingBox();
  await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5);
  await page.waitForFunction(() => !location.hash.includes('lambda=387&'));
  const lambda = Number(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('lambda'));
  assert.ok(lambda > 800 && lambda <= 1000, `λ = ${lambda}`);
  assert.equal(Number(await page.locator('[data-key="lambda"] input[type="range"]').inputValue()), lambda);
  await page.waitForFunction(() => /δ = [0-5]°/.test(document.querySelectorAll('.plasmon-grid .panel-title')[2].textContent ?? ''));
  assert.match(await title(0), new RegExp(`en λ = ${lambda} nm`));

  /** Color de fondo de un elemento como [r, g, b]. @param {string} selector */
  const rgbOf = async (selector) => {
    const text = await page.locator(selector).evaluate((/** @type {HTMLElement} */ e) => e.style.background);
    const match = text.match(/rgb\((\d+), (\d+), (\d+)\)/);
    assert.ok(match, `sin color en ${selector}: "${text}"`);
    return match.slice(1, 4).map(Number);
  };

  // Cada preset, con su captura y lo que debe verse en él.
  for (const [id, expected] of [
    ['oro-20', 'material=Au&shape=sphere&diameter=20&aspect=3&medium=1.33&lambda=521'],
    ['oro-80', 'material=Au&shape=sphere&diameter=80&aspect=3&medium=1.33&lambda=549'],
    ['oro-150', 'material=Au&shape=sphere&diameter=150&aspect=3&medium=1.33&lambda=640'],
    ['plata-20', 'material=Ag&shape=sphere&diameter=20&aspect=3&medium=1.33&lambda=387'],
    ['oro-20-vidrio', 'material=Au&shape=sphere&diameter=20&aspect=3&medium=1.5&lambda=535'],
    ['baston-3', 'material=Au&shape=rod&diameter=10&aspect=3&medium=1.33&lambda=672&conc=1'],
    ['licurgo', 'material=AuAg&shape=sphere&diameter=70&aspect=3&medium=1.5&lambda=503'],
    ['oro-20-lejos', 'material=Au&shape=sphere&diameter=20&aspect=3&medium=1.33&lambda=800'],
  ]) {
    await page.locator(`.preset[data-preset="${id}"]`).click();
    await page.waitForFunction((/** @type {string} */ e) => location.hash.includes(e), expected);
    assert.equal(await page.locator(`.preset[data-preset="${id}"]`).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(shots, `plasmon-preset-${id}.png`) });
    if (id === 'oro-20') {
      // Oro coloidal: pico en el verde y cubeta rojiza a contraluz.
      assert.match(await title(0), /pico de extinción en 52[0-3] nm/);
      const [r, g, b] = await rgbOf('.plasmon-cuvette');
      assert.ok(r > g && r > b, `cubeta de oro de 20 nm: rgb(${r}, ${g}, ${b})`);
    } else if (id === 'oro-150') {
      // El pico se ha ido al rojo y casi toda la extinción es dispersión.
      assert.match(await title(0), /pico de extinción en 6[34]\d nm/);
      assert.match(await title(0), /9\d % dispersión/);
      assert.match(String(await page.locator('.plasmon-model').textContent()), /solo orientativo/);
    } else if (id === 'baston-3') {
      assert.match(String(await page.locator('.plasmon-model').textContent()), /teoría de Gans \(aproximación cuasiestática/);
      assert.match(await title(0), /pico de extinción en 67\d nm/);
      // El diagrama del bastón es un promedio de orientaciones: a 90° la polarización
      // paralela no se anula (en el pico longitudinal vale la mitad que la perpendicular).
      assert.match(await title(4), /promedio de orientaciones · a 90°: ∥\/⊥ = (4[89]|5[0-2]) %/);
    } else if (id === 'licurgo') {
      // Roja a contraluz, verde por dispersión.
      const cuvette = await rgbOf('.plasmon-cuvette');
      assert.ok(cuvette[0] > cuvette[1] && cuvette[0] > cuvette[2], `Licurgo a contraluz: rgb(${cuvette})`);
      const glow = await rgbOf('.plasmon-glow');
      assert.ok(glow[1] > glow[0], `Licurgo dispersada: rgb(${glow})`);
    }
  }

  // En una ventana más estrecha (1100 px, con los controles abiertos) tres columnas no
  // caben: la rejilla pasa a dos columnas, y vuelve a tres al ensanchar la ventana.
  assert.equal(await page.locator('.plasmon-grid').getAttribute('data-layout'), 'full');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForSelector('.plasmon-grid[data-layout="compact"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(shots, 'plasmon-compacto.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector('.plasmon-grid[data-layout="full"]');

  // Concentración y camino óptico solo cambian el color de la cubeta: más camino, más oscura.
  await page.locator('.preset[data-preset="oro-20"]').click();
  await page.waitForFunction(() => location.hash.includes('diameter=20&aspect=3&medium=1.33&lambda=521'));
  const before = await rgbOf('.plasmon-cuvette');
  await page.locator('[data-key="path"] .control-number').fill('50');
  await page.locator('[data-key="path"] .control-number').press('Enter');
  await page.waitForFunction(() => location.hash.includes('path=50'));
  await page.waitForTimeout(100);
  const after = await rgbOf('.plasmon-cuvette');
  assert.ok(after[1] < before[1] && after[2] < before[2], `con 50 mm debe pasar menos verde y azul: ${before} → ${after}`);

  // La nube electrónica está animada y la pausa la detiene.
  const cloud = page.locator('.plasmon-canvas');
  const frame = () => cloud.evaluate((/** @type {HTMLCanvasElement} */ c) => c.toDataURL());
  const a = await frame();
  await page.waitForTimeout(300);
  assert.notEqual(await frame(), a, 'la nube electrónica no se mueve');
  await page.locator('.clock-play').click();
  const b = await frame();
  await page.waitForTimeout(300);
  assert.equal(await frame(), b, 'en pausa la nube no debe moverse');

  // Modo presentación: la tecla 7 salta a la copa de Licurgo.
  await page.keyboard.press('p');
  await page.keyboard.press('7');
  await page.waitForFunction(() => location.hash.includes('material=AuAg'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, 'plasmon-presentacion.png') });
  await close();
  assert.deepEqual(errors, []);
});

// Los dos recorridos del plasmón, en modo presentación: cada paso lleva a su preset y
// pinta su texto con fórmulas sin errores de KaTeX.
for (const [tourId, steps] of /** @type {const} */ ([
  ['oro-rojo', ['lambda=800', 'lambda=521', 'lambda=521', 'material=Ag', 'material=AuAg']],
  ['tamano', ['diameter=20&aspect=3&medium=1.33', 'medium=1.5', 'diameter=80', 'diameter=150', 'shape=rod']],
])) {
  test(`plasmón: recorrido «${tourId}» en modo presentación`, { skip }, async () => {
    const { page, errors, close } = await openPage('#/plasmon', { width: 1920, height: 1080 });
    await page.locator(`.tour-start[data-tour="${tourId}"]`).click();
    await page.keyboard.press('p');
    for (let step = 0; step < steps.length; step++) {
      assert.match(await page.locator('.tour-counter').textContent(), new RegExp(`Paso ${step + 1} de ${steps.length}`));
      await page.waitForFunction((/** @type {string} */ e) => location.hash.includes(e), steps[step]);
      // Los pasos cuyo texto lleva fórmulas deben pintarlas con KaTeX, sin errores.
      const text = modules.find((m) => m.id === 'plasmon')?.tours.find((t) => t.id === tourId)?.steps[step].text ?? '';
      if (text.includes('$')) await page.waitForSelector('.tour-text .katex');
      assert.ok(String(await page.locator('.tour-text').textContent()).trim().length > 40, 'el paso no tiene texto');
      assert.equal(await page.locator('.tour-text .katex-error').count(), 0);
      await page.waitForTimeout(1700); // fin de la transición entre presets
      await page.screenshot({ path: join(shots, `plasmon-recorrido-${tourId}-${step + 1}.png`) });
      await page.keyboard.press('ArrowRight');
    }
    await close();
    assert.deepEqual(errors, []);
  });
}

// Navegación: de la portada a un módulo por su tarjeta, vuelta a la portada, y de un
// módulo a otro. Cada cambio destruye el módulo anterior (gráficas, WebGL, reloj): no
// debe quedar ningún error ni ningún resto en pantalla.
test('navegación entre portada y módulos sin errores ni restos', { skip }, async () => {
  const { page, errors, close } = await openPage('');
  await page.locator('.card[data-module="oscilador"]').click();
  await page.waitForSelector('html[data-ready="true"][data-route="oscilador"]');
  assert.equal(await page.locator('.oscilador-grid canvas').count(), 4);
  await page.locator('.brand').click();
  await page.waitForSelector('.cover');
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.locator('.page-actions button').count(), 0);
  for (const id of ['_galeria', '_plantilla', 'plasmon', 'oscilador', '_galeria']) {
    await page.evaluate((/** @type {string} */ hash) => (location.hash = hash), `#/${id}`);
    await page.waitForSelector(`html[data-ready="true"][data-route="${id}"]`);
    assert.equal(await page.locator('.module-page').count(), 1);
    assert.equal(await page.locator('.module-page').getAttribute('data-module'), id);
  }
  // El botón "atrás" del navegador vuelve al módulo anterior.
  await page.goBack();
  await page.waitForSelector('html[data-ready="true"][data-route="oscilador"]');
  await close();
  assert.deepEqual(errors, []);
});

// Pantalla estrecha (móvil): todo se apila en una columna, sin errores y sin que la
// página se desborde hacia los lados.
for (const m of modules) {
  test(`[${m.id}] carga en una pantalla estrecha (390 px)`, { skip }, async () => {
    const { page, errors, close } = await openPage(`#/${m.id}`, { width: 390, height: 800 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `la página se desborda ${overflow} px a lo ancho`);
    await page.screenshot({ path: join(shots, `${m.id}-movil.png`), fullPage: true });
    await close();
    assert.deepEqual(errors, []);
  });
}
