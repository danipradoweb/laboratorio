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
import { buildHash, defaultState, optionValues } from '../src/core/state.js';
import { entryLink, isPilot } from '../src/core/simulations.js';

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
      if (isPilot(m)) {
        // Formato con simulaciones: #/<id> es la página de entrada y no carga ninguna.
        assert.equal(new URL(page.url()).hash, `#/${m.id}`);
        assert.equal(await page.locator('.entry-page h1').textContent(), m.title);
        assert.equal(await page.locator('canvas').count(), 0);
      } else {
        // La dirección se completa con todos los parámetros.
        assert.equal(new URL(page.url()).hash, buildHash(m.id, m.params, defaultState(m.params)));
      }
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

// Luz y materia: criterio de terminado del encargo 02 (las tres partes funcionando con
// vistas enlazadas, presets, recorridos y modo presentación). Guarda una captura de cada
// preset y comprueba en cada uno lo que debe verse.
test('luz y materia: cuatro vistas enlazadas, controles por vista y presets', { skip }, async () => {
  const { page, errors, close } = await openPage('#/luz-materia?material=metal&energy=5', { width: 1440, height: 900 });
  const status = async () => String(await page.locator('.lm-status').textContent());
  const title = async (/** @type {number} */ i) => String(await page.locator('.lm-part .panel-title').nth(i).textContent());
  /** Espera a que la URL contenga todos los trozos. @param {string[]} parts */
  const hashHas = (parts) => page.waitForFunction((/** @type {string[]} */ ps) => ps.every((x) => location.hash.includes(x)), parts);

  // La URL reproduce el estado: metal de Drude por debajo de ω_p (10 eV): Re ε < 0.
  assert.match(await status(), /^Metal de Drude · ħω = 5,00 eV/);
  assert.equal(await page.locator('.lm-part .panel-title').count(), 4);
  assert.equal(await page.locator('.lm-part canvas').count(), 4);
  assert.match(await title(0), /Re ε < 0: la onda no se propaga/);

  // Los controles que no son de esta vista están ocultos; los del material editable solo
  // aparecen al elegirlo.
  assert.equal(await page.locator('[data-key="axis"]').isVisible(), true);
  for (const key of ['spacing', 'count', 'angle', 'pol', 'analyzer', 'w0']) {
    assert.equal(await page.locator(`[data-key="${key}"]`).isVisible(), false, `el control ${key} debería estar oculto`);
  }
  await page.locator('[data-key="material"] select').selectOption('editable');
  await page.waitForFunction(() => location.hash.includes('material=editable'));
  assert.equal(await page.locator('[data-key="w0"]').isVisible(), true);
  await page.locator('[data-key="material"] select').selectOption('metal');
  await page.waitForFunction(() => location.hash.includes('material=metal'));

  // Vistas enlazadas: un clic en la gráfica de ε lleva la energía por encima de ω_p, y el
  // metal deja de reflejar (cambian el control, la URL, la línea de estado y los paneles).
  const epsilon = page.locator('.lm-part .panel').nth(0).locator('canvas');
  const box = await epsilon.boundingBox();
  await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5);
  await page.waitForFunction(() => !location.hash.includes('energy=5&'));
  const energy = Number(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('energy'));
  assert.ok(energy > 14 && energy <= 20, `ħω = ${energy} eV`);
  assert.equal(Number(await page.locator('[data-key="energy"] input[type="range"]').inputValue()), energy);
  await page.waitForFunction(() => !/Re ε < 0/.test(document.querySelector('.lm-part .panel-title')?.textContent ?? ''));
  const reflectance = Number((await title(2)).match(/R = (\d+),/)?.[1]);
  assert.ok(reflectance < 10, `por encima de ω_p el metal casi no refleja: R = ${reflectance} %`);

  // El eje se puede poner en longitud de onda.
  await page.locator('[data-key="axis"] select').selectOption('lambda');
  await page.waitForFunction(() => location.hash.includes('axis=lambda'));
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(shots, 'luz-materia-eje-lambda.png') });

  // Cada preset, con su captura y lo que debe verse en él.
  for (const [id, expected] of /** @type {[string, string[]][]} */ ([
    ['vidrio-visible', ['part=material&material=vidrio&energy=2.25&axis=energia']],
    ['vidrio-uv', ['part=material&material=vidrio&energy=10.67']],
    ['metal-debajo', ['part=material&material=metal&energy=2.25']],
    ['metal-encima', ['part=material&material=metal&energy=15&']],
    ['laminas', ['part=laminas&material=vidrio&energy=2.25', 'count=24&active=80&auto=1&radiated=todas']],
    ['espejo', ['part=laminas&material=metal&energy=2.25', 'spacing=0.02&count=30', 'auto=0&radiated=ninguna']],
    ['brewster', ['part=interfaz&material=vidrio', 'angle=55.6&pol=p&side=fuera']],
    ['reflexion-total', ['part=interfaz&material=vidrio', 'angle=50&pol=s&side=dentro']],
    ['gafas', ['part=polarizadores&material=agua', 'angle=53.1', 'analyzer=90']],
  ])) {
    await page.locator(`.preset[data-preset="${id}"]`).click();
    await hashHas(expected);
    assert.equal(await page.locator(`.preset[data-preset="${id}"]`).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(shots, `luz-materia-preset-${id}.png`) });
    if (id === 'vidrio-visible') {
      // El vidrio en el verde: n = 1,46 (sílice), casi sin absorción, R = 3,5 %.
      assert.match(await status(), /^Vidrio · ħω = 2,25 eV \(λ = 551 nm en el vacío, verde\) · n = 1,46 · /);
      assert.match(await title(2), /R = 3,5 %/);
    } else if (id === 'vidrio-uv') {
      assert.match(await status(), /ultravioleta/);
      assert.match(await title(1), /k = 4,5\d/);
    } else if (id === 'metal-debajo') {
      assert.match(await title(0), /Re ε < 0/);
      assert.match(await title(2), /R = 98,0 %/);
    } else if (id === 'metal-encima') {
      assert.match(await title(2), /R = 2,1 %/);
    } else if (id === 'laminas') {
      assert.equal(await page.locator('.lm-grid-sheets canvas').count(), 4);
      assert.match(await title(0), /de 24 láminas encendidas \(encendido automático\)/);
      // Encendido automático: el número de láminas encendidas cambia solo.
      const before = await title(0);
      await page.waitForFunction((/** @type {string} */ t) => document.querySelector('.lm-part .panel-title')?.textContent !== t, before);
      for (const key of ['spacing', 'count', 'auto', 'radiated']) assert.equal(await page.locator(`[data-key="${key}"]`).isVisible(), true);
      assert.equal(await page.locator('[data-key="active"]').isVisible(), false, 'en automático no se elige el número a mano');
      assert.equal(await page.locator('[data-key="axis"]').isVisible(), false);
    } else if (id === 'espejo') {
      // Láminas de metal: casi todo reflejado y sin onda dentro. La conservación de la
      // energía se ve en pantalla: R + T + absorbido = 100 %.
      const text = await title(1);
      const [r, t, a] = [/R = ([\d,]+) %/, /T = ([\d,]+) %/, /absorbido ([\d,]+) %/].map((re) => Number(text.match(re)?.[1].replace(',', '.')));
      assert.ok(r > 97 && r < 99, `R = ${r} %`);
      assert.ok(Math.abs(r + t + a - 100) <= 0.15, `R + T + A = ${r + t + a}`);
      assert.match(text, /dentro no viaja una onda/);
      assert.match(await title(2), /extinción/);
    } else if (id === 'brewster') {
      assert.equal(await page.locator('.lm-grid-interface canvas').count(), 3);
      assert.match(await title(0), /R_p = 0,0 % · ángulo de Brewster 55,6°/);
      assert.match(await title(2), /reflejado y refractado forman 90,0°/);
      assert.match(await title(2), /a 0,0° del eje de los dipolos/);
    } else if (id === 'reflexion-total') {
      assert.match(await title(0), /R_s = 100,0 %, R_p = 100,0 %/);
      assert.match(await title(0), /ángulo crítico 43,2°/);
      assert.match(await title(1), /onda evanescente cuya amplitud cae a 1\/e en 0,318 λ₀/);
      assert.match(await title(2), /reflexión total: no hay rayo refractado/);
    } else if (id === 'gafas') {
      // Agua en su ángulo de Brewster: reflejo polarizado del todo, que el polarizador
      // vertical elimina; y polarizadores cruzados en el banco.
      assert.match(await status(), /^Agua · .* n = 1,33 /);
      assert.match(await title(0), /polarizadores cruzados: no pasa nada/);
      assert.match(await title(2), /sale polarizado al 100 %/);
      assert.match(await title(3), /deja pasar el 0 % del reflejo; las gafas grises, el 50 %/);
    }
  }

  // La paradoja de los tres polarizadores: con el intermedio a 45° entre dos cruzados pasa 1/8.
  await page.locator('[data-key="third"] input').check();
  await page.waitForFunction(() => /sale el 12,5 %/.test(document.querySelector('.lm-part .panel-title')?.textContent ?? ''));
  assert.equal(await page.locator('[data-key="middle"]').isVisible(), true);
  // Un clic en la curva del reflejo cambia el ángulo de incidencia: lejos de Brewster el
  // polarizador ya deja pasar parte del reflejo.
  const glare = page.locator('.lm-part .panel').nth(2).locator('canvas');
  const glareBox = await glare.boundingBox();
  await page.mouse.click(glareBox.x + glareBox.width * 0.3, glareBox.y + glareBox.height * 0.6);
  await page.waitForFunction(() => !location.hash.includes('angle=53.1'));
  const passed = Number((await title(3)).match(/deja pasar el (\d+) % del reflejo/)?.[1]);
  assert.ok(passed > 5 && passed < 50, `lejos de Brewster pasa parte del reflejo: ${passed} %`);
  await page.screenshot({ path: join(shots, 'luz-materia-tres-polarizadores.png') });

  // Las ondas de las láminas están animadas y la pausa las detiene.
  await page.locator('.preset[data-preset="espejo"]').click();
  await hashHas(['part=laminas&material=metal', 'count=30']);
  const waves = page.locator('.lm-grid-sheets canvas').first();
  const frame = () => waves.evaluate((/** @type {HTMLCanvasElement} */ c) => c.toDataURL());
  const a = await frame();
  await page.waitForTimeout(300);
  assert.notEqual(await frame(), a, 'las ondas no se mueven');
  await page.locator('.clock-play').click();
  const b = await frame();
  await page.waitForTimeout(300);
  assert.equal(await frame(), b, 'en pausa las ondas no deben moverse');
  await page.locator('.clock-play').click();

  // Modo presentación: la tecla 7 salta a Brewster.
  await page.keyboard.press('p');
  await page.keyboard.press('7');
  await hashHas(['part=interfaz', 'angle=55.6']);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, 'luz-materia-presentacion.png') });
  await close();
  assert.deepEqual(errors, []);
});

// Los tres recorridos de luz y materia, en modo presentación: cada paso lleva a su preset
// (cambiando de vista cuando toca) y pinta su texto con fórmulas sin errores de KaTeX.
for (const [tourId, steps] of /** @type {const} */ ([
  ['no-rebota', ['part=material&material=vidrio&energy=2.25', 'part=laminas&material=vidrio', 'part=laminas&material=vidrio', 'part=laminas&material=vidrio', 'part=laminas&material=metal', 'part=material&material=vidrio&energy=10.67']],
  ['indice', ['part=material&material=vidrio&energy=2.25', 'part=laminas', 'part=laminas', 'part=material&material=vidrio&energy=2.25', 'energy=10.67', 'part=material&material=metal&energy=2.25', 'part=material&material=metal&energy=15&']],
  ['gafas', ['part=interfaz', 'part=interfaz', 'part=interfaz', 'part=polarizadores&material=agua', 'part=polarizadores', 'part=polarizadores']],
])) {
  test(`luz y materia: recorrido «${tourId}» en modo presentación`, { skip }, async () => {
    const { page, errors, close } = await openPage('#/luz-materia', { width: 1920, height: 1080 });
    await page.locator(`.tour-start[data-tour="${tourId}"]`).click();
    await page.keyboard.press('p');
    for (let step = 0; step < steps.length; step++) {
      assert.match(await page.locator('.tour-counter').textContent(), new RegExp(`Paso ${step + 1} de ${steps.length}`));
      await page.waitForFunction((/** @type {string} */ e) => location.hash.includes(e), steps[step]);
      const text = modules.find((m) => m.id === 'luz-materia')?.tours.find((t) => t.id === tourId)?.steps[step].text ?? '';
      if (text.includes('$')) await page.waitForSelector('.tour-text .katex');
      assert.ok(String(await page.locator('.tour-text').textContent()).trim().length > 40, 'el paso no tiene texto');
      assert.equal(await page.locator('.tour-text .katex-error').count(), 0);
      await page.waitForTimeout(1700); // fin de la transición entre presets
      await page.screenshot({ path: join(shots, `luz-materia-recorrido-${tourId}-${step + 1}.png`) });
      await page.keyboard.press('ArrowRight');
    }
    await close();
    assert.deepEqual(errors, []);
  });
}

/**
 * Ayudantes de las pruebas de funcion-onda (formato con simulaciones): textos de las líneas
 * secundarias de las gráficas y del bloque «Estado», sin los espacios de anchura cero ni los
 * espacios duros que mete KaTeX (así «$E_2$» se lee «E2» y «$1\ \mathrm{nm}$», «1 nm»).
 * @param {any} page
 */
function foHelpers(page) {
  const clean = (/** @type {string} */ t) => t.replace(/[​ ]/g, (c) => (c === ' ' ? ' ' : '')).replace(/\s+/g, ' ').trim();
  /** @param {string} id */
  const info = async (id) => clean(String(await page.locator(`.graph-card[data-graph="${id}"] .graph-info`).textContent()));
  const status = async () => clean(String(await page.locator('.side-status').textContent()));
  /** @param {string[]} parts */
  const hashHas = (parts) => page.waitForFunction((/** @type {string[]} */ ps) => ps.every((x) => location.hash.includes(x)), parts);
  /**
   * Espera a que la línea secundaria de una gráfica (o el bloque «Estado», con id = '') diga algo.
   * @param {RegExp} re
   * @param {string} [id]
   */
  const waitText = (re, id = '') =>
    page.waitForFunction(
      (/** @type {[string, string]} */ [source, graph]) => {
        const node = graph ? document.querySelector(`.graph-card[data-graph="${graph}"] .graph-info`) : document.querySelector('.side-status');
        const text = (node?.textContent ?? '').replace(/​/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ');
        return new RegExp(source).test(text);
      },
      [re.source, id],
      { timeout: 20000 },
    );
  /** Identificadores de las gráficas de la pantalla actual, en orden. */
  const shown = async () => page.evaluate(() => [...document.querySelectorAll('.screen .graph-card')].map((c) => /** @type {HTMLElement} */ (c).dataset.graph));
  return { clean, info, status, hashHas, waitText, shown };
}

test('función de onda: pantallas, vistas enlazadas, fase global, presets y lo que cuenta la ficha', { skip }, async () => {
  const { page, errors, close } = await openPage(
    '#/funcion-onda?part=paquete&potential=barrera&height=0.3&width=1&energy=0.2&sigma=3&x0=-25&rate=50',
    { width: 1440, height: 900 },
  );
  const { info, hashHas, waitText, shown } = foHelpers(page);

  // «Ver todas» del paquete: primera pantalla, la combinación «Qué parte del paquete atraviesa
  // la barrera»; las otras dos combinaciones también llevan ψ, que ya está en la primera, así
  // que la cuerda y los valores esperados van juntos en la segunda.
  assert.deepEqual(await shown(), ['psi', 'momentos']);
  assert.equal(await page.locator('.sim-tab').count(), 2);
  assert.match(String(await page.locator('.sim-crumbs').textContent()), /Ondas clásicas y función de onda\s*›\s*Un paquete de ondas en movimiento\s*›\s*ψ\(x\) y espacio de momentos/);
  // Efecto túnel: la línea de ψ compara lo simulado con las ondas planas, y al final (lo
  // absorbido por el borde derecho cuenta como transmitido) coinciden: 13,7 %.
  assert.match(await info('psi'), /esperado con ondas planas: 13,7 %/);
  await waitText(/al otro lado del potencial: 13,7 %/, 'psi');

  // Escalón con el paquete llegando por la derecha (desde encima del escalón): la energía de
  // T(E) es la cinética más V₀. Valor esperado: 98,0 % (revisión independiente, con una
  // integración de la ecuación de Schrödinger estacionaria en scipy).
  await page.goto(page.url().split('#')[0] + '#/funcion-onda?part=paquete&potential=escalon&height=0.3&energy=0.4&sigma=3&x0=25&leftward=1&rate=50');
  await waitText(/esperado con ondas planas: 98,0 %/, 'psi');
  await page.goto(page.url().split('#')[0] + '#/funcion-onda?part=paquete&potential=barrera&height=0.3&width=1&energy=0.2&sigma=3&x0=-25&rate=50');
  await waitText(/esperado con ondas planas: 13,7 %/, 'psi');

  // Vista enlazada: un clic en los k negativos de la gráfica de momentos manda el paquete
  // a la izquierda con E = ħ²k²/2m.
  const mom = page.locator('.graph-card[data-graph="momentos"] canvas.plot-canvas');
  const box = await mom.boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.6);
  await hashHas(['leftward=1']);
  // El paquete está a la izquierda de la barrera y se aleja de ella: no hay transmisión que comparar.
  await page.waitForFunction(() => !/otro lado/.test(document.querySelector('.graph-card[data-graph="psi"] .graph-info')?.textContent ?? ''));

  // Ver juntas, con ψ, momentos y valores esperados: todas en una pantalla, sin explicaciones.
  await page.locator('.sim-change').click();
  // (Están las cuatro elegidas: se quita la cuerda.)
  await page.locator('.sim-chooser label[data-graph="cuerda-comparada"] input').uncheck();
  await page.locator('.sim-chooser .btn-primary').click();
  await page.locator('.sim-together').click();
  await hashHas(['&ver=psi,momentos,valores-esperados&pantalla=juntas']);
  assert.deepEqual(await shown(), ['psi', 'momentos', 'valores-esperados']);
  // Fase global: con el reloj parado, girar ψ no cambia ⟨x⟩, Δx, Δx·Δp ni ⟨p⟩.
  await page.locator('.clock-controls button').first().click();
  await page.waitForTimeout(400);
  const before = [await info('momentos'), await info('valores-esperados')];
  await page.locator('[data-key="globalPhase"] input[type="range"]').fill('120');
  await hashHas(['globalPhase=120']);
  await page.waitForTimeout(400);
  assert.deepEqual([await info('momentos'), await info('valores-esperados')], before);
  await page.locator('.clock-controls button').first().click();
  await page.screenshot({ path: join(shots, 'funcion-onda-juntas.png') });

  // Los presets: URL, gráficas que abren, captura y lo que debe verse.
  for (const [id, expected, graphs] of /** @type {[string, string[], string[]][]} */ ([
    ['paquete-libre', ['part=paquete&potential=libre', 'x0=-30&sigma=1&energy=0.1'], ['psi', 'valores-esperados']],
    ['tunel', ['potential=barrera&height=0.3&width=1', 'energy=0.2'], ['psi', 'momentos']],
    ['resonancia', ['potential=doble-barrera&height=0.5&width=0.3&separation=3', 'energy=0.113&leftward=0'], ['psi', 'momentos']],
    ['escalon', ['potential=escalon&height=0.3', 'energy=0.4'], ['psi', 'momentos']],
    ['pozo-estados', ['part=estados&potential=pozo-infinito', 'wellWidth=1', 'n1=2&n2=3&weight=0'], ['niveles', 'superposicion']],
    ['superposicion', ['part=estados&potential=pozo-infinito', 'wellWidth=0.8', 'n1=1&n2=2&weight=0.5'], ['superposicion', 'coeficientes']],
    ['coherente', ['part=paquete&potential=armonico', 'quantum=0.1', 'x0=4&sigma=0.62&energy=0&'], ['psi', 'valores-esperados']],
    ['opuestos', ['potential=libre', 'x0=0&sigma=2&energy=0.05&leftward=0&twin=1'], ['psi', 'momentos']],
    ['cuerda-modos', ['part=cuerda', 'shape=dos-modos&mode=1&mode2=2'], ['cuerda', 'energia-cuerda']],
  ])) {
    // La barra lateral solo enseña los presets de la simulación abierta; los demás se abren
    // desde la página de entrada.
    const button = page.locator(`.side-panel .preset[data-preset="${id}"]`);
    if (await button.isVisible()) await button.click();
    else {
      await page.evaluate(() => (location.hash = '#/funcion-onda'));
      await page.locator(`.entry-page .preset[data-preset="${id}"]`).click();
    }
    await hashHas(expected);
    await page.waitForTimeout(1800); // fin de la transición
    assert.deepEqual(await shown(), graphs, `gráficas en pantalla con el preset ${id}`);
    await page.screenshot({ path: join(shots, `funcion-onda-preset-${id}.png`) });
    if (id === 'tunel') assert.match(await info('psi'), /esperado con ondas planas: 13,7 %/);
    else if (id === 'resonancia') assert.match(await info('psi'), /esperado con ondas planas: 73,0 %/);
    else if (id === 'escalon') assert.match(await info('psi'), /esperado con ondas planas: 86,7 %/);
    else if (id === 'pozo-estados') {
      assert.match(await info('superposicion'), /un solo estado propio, φ2: solo gira su fase y ∣ψ∣2 no cambia/);
    } else if (id === 'superposicion') {
      // Segunda pantalla con la flecha del teclado: niveles y el puente con la luz.
      await page.keyboard.press('ArrowRight');
      await hashHas(['pantalla=2']);
      assert.deepEqual(await shown(), ['niveles', 'puente-luz']);
      // Pozo de 0,8 nm: ΔE = 1,76 eV, periodo 2,35 fs, fotón de 703 nm (rojo).
      await waitText(/periodo h\/∣E2−E1∣=2,35 fs/, 'puente-luz');
      assert.match(await info('puente-luz'), /fotón de 1,76 eV: λ=703,4 nm, visible/);
      assert.equal(await page.locator('.fo-swatch').isVisible(), true);
      // Prueba esto: el segundo estado en 3 → ⟨x⟩ quieto (regla de selección).
      await page.locator('[data-key="n2"] input[type="range"]').fill('3');
      await hashHas(['n2=3']);
      await waitText(/⟨x⟩ no oscila: ⟨φ1∣x∣φ3⟩=0/, 'puente-luz');
      await page.locator('[data-key="n2"] input[type="range"]').fill('2');
      // Prueba esto: pozo de 0,6 nm → fotón de 396 nm, en el borde del violeta.
      await page.locator('[data-key="wellWidth"] input[type="range"]').fill('0.6');
      await hashHas(['wellWidth=0.6', 'n2=2']);
      await waitText(/λ=395,7 nm/, 'puente-luz');
      // Vista enlazada: un clic en el diagrama de niveles elige el segundo estado.
      const levels = page.locator('.graph-card[data-graph="niveles"] canvas.plot-canvas');
      const lb = await levels.boundingBox();
      await page.mouse.click(lb.x + lb.width * 0.5, lb.y + lb.height * 0.3);
      await page.waitForFunction(() => !location.hash.includes('n2=2&'));
      // De vuelta a la primera pantalla (flecha izquierda). Fase global: las flechas giran
      // juntas y el ángulo entre ellas no cambia (reloj parado).
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => !location.hash.includes('pantalla='));
      await page.locator('.clock-controls button').first().click();
      await page.waitForTimeout(400);
      const angle = await info('coeficientes');
      await page.locator('[data-key="globalPhase"] input[type="range"]').fill('200');
      await hashHas(['globalPhase=200']);
      await page.waitForTimeout(400);
      assert.equal(await info('coeficientes'), angle);
      await page.locator('[data-key="relPhase"] input[type="range"]').fill('90');
      await hashHas(['relPhase=90']);
      await page.waitForTimeout(400);
      assert.notEqual(await info('coeficientes'), angle, 'la fase relativa sí cambia el ángulo entre los coeficientes');
      await page.locator('.clock-controls button').first().click();
    } else if (id === 'coherente') {
      await waitText(/Δp\/ℏ=0,500/, 'valores-esperados');
    } else if (id === 'opuestos') {
      assert.equal(await page.locator('.graph-card[data-graph="psi"] .fo-stack-item:not([hidden])').count(), 2);
      assert.match(await info('momentos'), /⟨p⟩\/ℏ=1,15 nm−1/);
    } else if (id === 'cuerda-modos') {
      assert.match(await info('cuerda'), /superposición de los modos 1 y 2/);
      await waitText(/variación relativa <10−12/, 'energia-cuerda');
      for (const key of ['potential', 'mass', 'x0', 'part']) assert.equal(await page.locator(`[data-key="${key}"]`).isVisible(), false);
      assert.equal(await page.locator('[data-key="d0"]').isVisible(), false);
    }
  }

  // Modo presentación con la tecla 7 (estado coherente): abre su simulación (desde la cuerda)
  // con las gráficas que declara el preset.
  await page.keyboard.press('p');
  await page.keyboard.press('7');
  await hashHas(['part=paquete', 'potential=armonico', 'ver=psi,valores-esperados']);
  await page.waitForTimeout(1800);
  assert.deepEqual(await shown(), ['psi', 'valores-esperados']);
  assert.equal(await page.locator('.sim-nav').isVisible(), false);
  assert.equal(await page.locator('.graph-explain').first().isVisible(), false);
  await page.screenshot({ path: join(shots, 'funcion-onda-presentacion.png') });
  // 5: los estados del pozo (otra simulación).
  await page.keyboard.press('5');
  await hashHas(['part=estados', 'ver=niveles,superposicion']);
  await page.waitForTimeout(1800);
  assert.deepEqual(await shown(), ['niveles', 'superposicion']);
  await page.keyboard.press('Escape');

  await close();
  assert.deepEqual(errors, []);
});

// URL y estado (encargo R1): un enlace copiado de una pantalla abre la misma simulación, las
// mismas gráficas, la misma pantalla y los mismos parámetros; y al cambiar un parámetro y pasar
// a otra pantalla, la gráfica que aparece ya muestra el estado nuevo.
test('función de onda: el enlace copiado restaura la pantalla, y otra pantalla muestra el estado actual', { skip }, async () => {
  const fo = /** @type {import('../src/modules/types.js').ModuleDescriptor} */ (modules.find((m) => m.id === 'funcion-onda'));
  const estados = /** @type {import('../src/modules/types.js').SimulationSpec} */ (fo.simulations?.find((s) => s.id === 'estados'));
  const { page, errors, close } = await openPage(entryLink(fo, estados), { width: 1366, height: 650 });
  const { info, hashHas, waitText, shown } = foHelpers(page);
  assert.deepEqual(await shown(), ['superposicion', 'coeficientes']);
  // Cambiar un parámetro en la primera pantalla y pasar a la segunda con su pestaña: el puente
  // con la luz ya dice el fotón del pozo de 0,6 nm (395,7 nm; ver la prueba de los presets).
  await page.locator('[data-key="wellWidth"] input[type="range"]').fill('0.6');
  await hashHas(['wellWidth=0.6']);
  await page.locator('.sim-tab[data-screen="2"]').click();
  await hashHas(['pantalla=2']);
  await waitText(/λ=395,7 nm/, 'puente-luz');
  assert.equal(await page.locator('.sim-tab[data-screen="2"]').getAttribute('aria-selected'), 'true');
  // El enlace: «Copiar enlace» escribe la URL completa; se abre en otra pestaña.
  await page.waitForTimeout(400);
  const link = new URL(page.url()).hash;
  assert.match(link, /part=estados.*wellWidth=0\.6.*&pantalla=2$/);
  const other = await openPage(link, { width: 1366, height: 650 });
  const h2 = foHelpers(other.page);
  assert.deepEqual(await h2.shown(), ['niveles', 'puente-luz']);
  assert.equal(await other.page.locator('[data-key="wellWidth"] input[type="range"]').inputValue(), '0.6');
  await h2.waitText(/λ=395,7 nm/, 'puente-luz');
  assert.equal(new URL(other.page.url()).hash, link);
  await other.close();
  assert.deepEqual(other.errors, []);
  // «Cambiar gráficas» con una sola: una pantalla, sin pestañas de más ni «ver juntas».
  await page.locator('.sim-change').click();
  for (const g of ['niveles', 'superposicion', 'puente-luz']) await page.locator(`.sim-chooser label[data-graph="${g}"] input`).uncheck();
  await page.locator('.sim-chooser label[data-graph="coeficientes"] input').check();
  await page.locator('.sim-chooser .btn-primary').click();
  await hashHas(['&ver=coeficientes']);
  assert.deepEqual(await shown(), ['coeficientes']);
  assert.equal(await page.locator('.sim-together').isVisible(), false);
  assert.match(await info('coeficientes'), /ángulo entre ellos/);
  // Con peso 0 solo queda un estado: no hay ángulo entre coeficientes (revisión independiente).
  await page.locator('[data-key="weight"] input[type="range"]').fill('0');
  await waitText(/un solo coeficiente/, 'coeficientes');
  await close();
  assert.deepEqual(errors, []);
});

// Explicaciones (encargo R1): debajo de cada gráfica, su apartado de la ficha: «Qué ves»
// abierto y «Cómo leerla», «Prueba esto» y «Más detalle» (ecuaciones y límites que le tocan)
// en desplegables, con las fórmulas dibujadas. Los términos del glosario abren su definición.
test('función de onda: explicación bajo cada gráfica y glosario', { skip }, async () => {
  const fo = /** @type {import('../src/modules/types.js').ModuleDescriptor} */ (modules.find((m) => m.id === 'funcion-onda'));
  const { page, errors, close } = await openPage('#/funcion-onda', { width: 1366, height: 650 });
  // En la página de entrada, el párrafo ya tiene términos del glosario.
  const term = page.locator('.entry-intro .term').first();
  await term.click();
  await page.waitForSelector('.term-popup:not([hidden])');
  assert.equal(await page.locator('.term-popup-title').textContent(), 'función de onda');
  assert.ok(String(await page.locator('.term-popup-text').textContent()).length > 40);
  await page.screenshot({ path: join(shots, 'funcion-onda-glosario.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.term-popup').isVisible(), false);
  for (const sim of fo.simulations ?? []) {
    await page.evaluate((/** @type {string} */ h) => (location.hash = `${h}&pantalla=juntas`), entryLink(fo, sim));
    await page.waitForSelector('html[data-ready="true"][data-route="funcion-onda"]');
    await page.waitForSelector('.screen .graph-card');
    for (const g of sim.graphs) {
      const explain = page.locator(`.graph-card[data-graph="${g.id}"] .graph-explain`);
      assert.ok(String(await explain.locator('.explain-see').textContent()).length > 80, `${g.id}: falta «Qué ves»`);
      const folds = await explain.locator('details summary').allTextContents();
      assert.deepEqual(folds.slice(0, 2), ['Cómo leerla', 'Prueba esto'], `${g.id}: desplegables`);
      assert.equal(folds[2], 'Más detalle', `${g.id}: falta «Más detalle» (ecuaciones y límites)`);
      assert.equal(await explain.locator('details[open]').count(), 0, `${g.id}: los desplegables empiezan cerrados`);
    }
    assert.equal(await page.locator('.graph-explain .katex-error').count(), 0, `${sim.id}: KaTeX no entiende alguna fórmula`);
  }
  // Una pantalla normal con la explicación desplegada y un término del glosario.
  await page.evaluate((/** @type {string} */ h) => (location.hash = h), entryLink(fo, /** @type {any} */ (fo.simulations?.[1])));
  await page.waitForSelector('.screen .graph-card[data-graph="superposicion"] .graph-explain details');
  const card = page.locator('.graph-card[data-graph="superposicion"]');
  await card.locator('details summary', { hasText: 'Cómo leerla' }).click();
  await card.locator('details summary', { hasText: 'Más detalle' }).click();
  assert.ok((await card.locator('details[open] .katex').count()) > 0, 'las ecuaciones de «Más detalle» no se dibujan');
  await card.locator('.graph-explain .term').first().click();
  await page.waitForSelector('.term-popup:not([hidden])');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(shots, 'funcion-onda-explicacion.png'), fullPage: false });
  await page.mouse.click(5, 300);
  assert.equal(await page.locator('.term-popup').isVisible(), false);
  await close();
  assert.deepEqual(errors, []);
});

// Móvil (390 × 844): una gráfica por pantalla con su explicación debajo, la gráfica antes que
// los controles, y los controles en una barra plegable arriba, cerrada al entrar.
test('función de onda: en el móvil, una gráfica por pantalla y los controles plegados', { skip }, async () => {
  const fo = /** @type {import('../src/modules/types.js').ModuleDescriptor} */ (modules.find((m) => m.id === 'funcion-onda'));
  const paquete = /** @type {import('../src/modules/types.js').SimulationSpec} */ (fo.simulations?.find((s) => s.id === 'paquete'));
  const { page, errors, close } = await openPage(entryLink(fo, paquete), { width: 390, height: 844 });
  const { shown } = foHelpers(page);
  assert.deepEqual(await shown(), ['psi']);
  assert.equal(await page.locator('.sim-tab').count(), 4);
  assert.equal(await page.locator('.module-page').getAttribute('data-panel'), 'closed');
  assert.equal(await page.locator('.side-panel').isVisible(), false);
  const graph = await page.locator('.graph-card[data-graph="psi"] .graph-body').boundingBox();
  assert.ok(graph.y < 844 && graph.y + graph.height > 0, 'la gráfica se ve al entrar');
  assert.ok(graph.width > 300 && graph.height > 260, `gráfica de ${graph.width} × ${graph.height}`);
  await page.locator('.sim-tab[data-screen="3"]').click();
  assert.deepEqual(await shown(), ['cuerda-comparada']);
  await page.locator('.panel-toggle').click();
  assert.equal(await page.locator('.side-panel').isVisible(), true);
  await page.screenshot({ path: join(shots, 'funcion-onda-movil-controles.png') });
  await close();
  assert.deepEqual(errors, []);
});

/**
 * Cuenta, en un lienzo, los píxeles cercanos a cada color de la lista (variables CSS del
 * tema, como '--series-1'). Sirve para saber si una gráfica ha dibujado de verdad sus
 * curvas: un lienzo que solo tiene el fondo da cero en todas.
 * @param {any} page
 * @param {any} canvas localizador del lienzo
 * @param {string[]} cssVars
 * @returns {Promise<number[]>}
 */
async function colorPixels(page, canvas, cssVars) {
  return canvas.evaluate((/** @type {HTMLCanvasElement} */ c, /** @type {string[]} */ vars) => {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return vars.map(() => 0);
    const rgb = vars.map((v) => {
      probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      probe.fillRect(0, 0, 1, 1);
      return Array.from(probe.getImageData(0, 0, 1, 1).data.slice(0, 3));
    });
    const ctx = c.getContext('2d');
    if (!ctx || c.width === 0 || c.height === 0) return vars.map(() => 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const counts = vars.map(() => 0);
    for (let i = 0; i < data.length; i += 4) {
      rgb.forEach((col, j) => {
        if (Math.abs(data[i] - col[0]) + Math.abs(data[i + 1] - col[1]) + Math.abs(data[i + 2] - col[2]) < 30) counts[j]++;
      });
    }
    return counts;
  }, cssVars);
}

// Regresión: en la web publicada, el panel «Valores esperados» del oscilador armónico salía
// solo con el título. Con la ventana de un portátil (1366 × 768 menos la barra del
// navegador ≈ 1366 × 650) cada una de las dos gráficas apiladas medía unos 90 px, la leyenda
// y los ejes se comían el área de datos y plot2d no dibujaba nada. La prueba mira los
// píxeles: deben aparecer ⟨x⟩ (serie 1), ⟨p⟩/ħ (serie 2), Δx·Δp/ħ (serie 5) y la línea ħ/2
// (color de acento), en varios tamaños de ventana y en el modo presentación.
for (const [width, height, presentation] of /** @type {[number, number, boolean][]} */ ([
  [1366, 650, false],
  [1280, 600, false],
  [1280, 800, false],
  [1920, 1080, true],
])) {
  test(`función de onda: el panel de valores esperados dibuja sus curvas (${width} × ${height}${presentation ? ', presentación' : ''})`, { skip }, async () => {
    const { page, errors, close } = await openPage(
      '#/funcion-onda?part=paquete&potential=armonico&quantum=0.1&x0=4&sigma=0.62&energy=0&rate=20&ver=psi,valores-esperados',
      { width, height },
    );
    if (presentation) await page.keyboard.press('p');
    await page.waitForTimeout(1500); // que la historia tenga unos cuantos fs
    const panel = page.locator('.screen .graph-card[data-graph="valores-esperados"]');
    const canvases = panel.locator('canvas.plot-canvas');
    assert.equal(await canvases.count(), 2);
    const [x, k] = await colorPixels(page, canvases.nth(0), ['--series-1', '--series-2']);
    const [u, line] = await colorPixels(page, canvases.nth(1), ['--series-5', '--accent']);
    await page.screenshot({ path: join(shots, `funcion-onda-valores-esperados-${width}x${height}.png`) });
    await close();
    // Umbral: una curva de 1,5 px de grosor y unas decenas de px de largo da cientos de
    // píxeles; 20 deja margen para el suavizado sin aceptar un lienzo vacío.
    assert.ok(x > 20, `no se ve la curva de ⟨x⟩ (${x} px)`);
    assert.ok(k > 20, `no se ve la curva de ⟨p⟩/ħ (${k} px)`);
    assert.ok(u > 20, `no se ve la curva de Δx·Δp/ħ (${u} px)`);
    assert.ok(line > 20, `no se ve la línea ħ/2 (${line} px)`);
    assert.deepEqual(errors, []);
  });
}

// Al llegar al tiempo final la simulación vuelve a empezar sola, sin aviso encima de las
// gráficas (encargo R1: Daniel prefiere el bucle; para detenerla está la pausa). El oscilador
// armónico se simula dos periodos: 2·h/ħω = 82,7 fs con ħω = 0,1 eV; a 50 fs por segundo
// (el máximo) llega al final en menos de dos segundos, espera 1,5 s en el último instante y
// empieza otra vez.
test('función de onda: al llegar al tiempo final la simulación vuelve a empezar sola', { skip }, async () => {
  const { page, errors, close } = await openPage(
    '#/funcion-onda?part=paquete&potential=armonico&quantum=0.1&x0=4&sigma=0.62&energy=0&rate=50',
    { width: 1366, height: 650 },
  );
  const { status, waitText } = foHelpers(page);
  await waitText(/tiempo t=8\d,\d de 83 fs \(final: vuelve a empezar\)/);
  assert.equal(await page.locator('.fo-end').count(), 0, 'no debe quedar ningún aviso de fin');
  // Sin tocar nada, vuelve a t pequeño y sigue avanzando.
  await waitText(/tiempo t=[0-9],\d de 83 fs/);
  await waitText(/tiempo t=[1-9]\d,\d de 83 fs/);
  // Con la pausa se queda quieta (se espera al último repintado del bloque «Estado», que se
  // repinta como mucho cada 150 ms).
  await page.locator('.clock-controls button').first().click();
  await page.waitForTimeout(400);
  const at = (await status()).match(/t=([\d,]+)/)?.[1];
  await page.waitForTimeout(800);
  assert.equal((await status()).match(/t=([\d,]+)/)?.[1], at);
  await close();
  assert.deepEqual(errors, []);
});

// Doble rendija: se entra desde la página de entrada, la pantalla dibuja sus curvas, la
// coherencia cambia el dibujo sin repetir la simulación y al final sale el aviso de fin.
// λ = 1 nm y d = 4 nm: primer máximo en sen θ = λ/d = 0,25, θ = 14,5°.
test('función de onda: doble rendija con control de coherencia', { skip }, async () => {
  const { page, errors, close } = await openPage('#/funcion-onda', { width: 1440, height: 900 });
  await page.locator('.entry-sim[data-simulation="rendijas"] .entry-all').click();
  await page.waitForFunction(() => location.hash.includes('part=rendijas') && location.hash.includes('slitSeparation=4'));
  const { info, status, waitText, shown } = foHelpers(page);
  await page.locator('[data-key="rate"] input[type="range"]').fill('50');
  assert.deepEqual(await shown(), ['plano', 'pantalla']);
  for (const key of ['slitWavelength', 'slitSeparation', 'slitWidth', 'coherence', 'rate']) assert.equal(await page.locator(`[data-key="${key}"]`).isVisible(), true, key);
  for (const key of ['potential', 'height', 'mass', 'x0', 'showRe', 'globalPhase']) assert.equal(await page.locator(`[data-key="${key}"]`).isVisible(), false, key);
  await waitText(/primer máximo a θ=14,5∘/, 'pantalla');
  assert.match(await info('plano'), /∣ψ1\+ψ2∣2/);
  await waitText(/\(final: vuelve a empezar\)/);
  // En pausa, para que no vuelva a empezar sola mientras se mira la pantalla.
  await page.locator('.clock-controls button').first().click();
  await page.screenshot({ path: join(shots, 'funcion-onda-rendijas.png') });
  // La pantalla dibuja la simulación (serie 1), la suma sin interferencia y Fraunhofer (serie 3).
  const screen = page.locator('.graph-card[data-graph="pantalla"] canvas.plot-canvas');
  const [sim, fraun] = await colorPixels(page, screen, ['--series-1', '--series-3']);
  assert.ok(sim > 50 && fraun > 50, `curvas de la pantalla: ${sim}, ${fraun} px`);
  // Sin coherencia: el dibujo cambia al momento y la simulación no vuelve a empezar.
  const at = (await status()).match(/t=([\d,]+)/)?.[1];
  await page.locator('[data-key="coherence"] input[type="range"]').fill('0');
  await waitText(/sin interferencia/, 'plano');
  assert.equal((await status()).match(/t=([\d,]+)/)?.[1], at);
  await page.screenshot({ path: join(shots, 'funcion-onda-rendijas-sin-coherencia.png') });
  // Cambiar d sí repite la simulación: vuelve a t = 0.
  await page.locator('[data-key="slitSeparation"] input[type="range"]').fill('2');
  await waitText(/primer máximo a θ=30,0∘/, 'pantalla');
  assert.match(await status(), /tiempo t=0,0 de/);
  await page.locator('.clock-controls button').first().click();
  // Tema oscuro y modo presentación.
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.keyboard.press('p');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(shots, 'funcion-onda-rendijas-presentacion-dark.png') });
  await page.keyboard.press('Escape');
  await close();
  assert.deepEqual(errors, []);
});

for (const [tourId, steps] of /** @type {const} */ ([
  ['onda', ['part=cuerda', 'part=estados&potential=pozo-infinito', 'wellWidth=0.8', 'potential=barrera', 'potential=libre', 'twin=1']],
  ['compleja', ['part=cuerda', 'part=estados', 'wellWidth=0.8', 'twin=1', 'potential=armonico']],
  ['color', ['part=estados', 'wellWidth=0.8', 'wellWidth=0.8', 'wellWidth=0.8', 'wellWidth=0.8']],
])) {
  test(`función de onda: recorrido «${tourId}» en modo presentación`, { skip }, async () => {
    // El recorrido se empieza en la página de entrada: abre la simulación de su primer paso.
    const { page, errors, close } = await openPage('#/funcion-onda', { width: 1920, height: 1080 });
    await page.locator(`.tour-start[data-tour="${tourId}"]`).click();
    await page.waitForFunction(() => /Paso 1 de/.test(document.querySelector('.tour-counter')?.textContent ?? ''));
    await page.keyboard.press('p');
    for (let step = 0; step < steps.length; step++) {
      assert.match(await page.locator('.tour-counter').textContent(), new RegExp(`Paso ${step + 1} de ${steps.length}`));
      await page.waitForFunction((/** @type {string} */ e) => location.hash.includes(e), steps[step]);
      const text = modules.find((m) => m.id === 'funcion-onda')?.tours.find((t) => t.id === tourId)?.steps[step].text ?? '';
      if (text.includes('$')) await page.waitForSelector('.tour-text .katex');
      assert.ok(String(await page.locator('.tour-text').textContent()).trim().length > 40, 'el paso no tiene texto');
      assert.equal(await page.locator('.tour-text .katex-error').count(), 0);
      await page.waitForTimeout(1700);
      await page.screenshot({ path: join(shots, `funcion-onda-recorrido-${tourId}-${step + 1}.png`) });
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
  for (const id of ['_galeria', '_plantilla', 'plasmon', 'luz-materia', 'oscilador', '_galeria']) {
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

// Página de entrada (encargo R1): de qué va el módulo, sus simulaciones con las gráficas
// para elegir, combinaciones, presets y recorridos. Cada enlace abre su simulación con su
// estado inicial, y «Ver las elegidas» lleva las gráficas marcadas a la URL.
test('función de onda: página de entrada, «ver todas», combinaciones y «ver las elegidas»', { skip }, async () => {
  const fo = /** @type {import('../src/modules/types.js').ModuleDescriptor} */ (modules.find((m) => m.id === 'funcion-onda'));
  const { page, errors, close } = await openPage('#/funcion-onda', { width: 1366, height: 650 });
  const sims = fo.simulations ?? [];
  assert.equal(await page.locator('.entry-sim').count(), sims.length);
  for (const sim of sims) {
    const card = page.locator(`.entry-sim[data-simulation="${sim.id}"]`);
    assert.equal(await card.locator('h3').textContent(), sim.title);
    assert.equal(await card.locator('.graph-choice input').count(), sim.graphs.length);
    assert.equal(await card.locator('.entry-all').getAttribute('href'), entryLink(fo, sim));
    for (const combo of sim.combos) {
      assert.equal(await page.locator(`.entry-combos li[data-combo="${combo.id}"] a`).getAttribute('href'), entryLink(fo, sim, combo.graphs));
    }
  }
  assert.equal(await page.locator('.entry-presets .preset').count(), fo.presets.length);
  assert.equal(await page.locator('.entry-page .tour-start').count(), fo.tours.length);
  await page.screenshot({ path: join(shots, 'funcion-onda-entrada.png') });

  // «Ver las elegidas»: desactivado sin nada marcado; con dos gráficas de «estados», la URL
  // las lleva y el estado es el inicial de la simulación (la superposición 1 + 2).
  const estados = page.locator('.entry-sim[data-simulation="estados"]');
  assert.equal(await estados.locator('.btn-primary').isDisabled(), true);
  await estados.locator('label[data-graph="coeficientes"] input').check();
  await estados.locator('label[data-graph="superposicion"] input').check();
  await estados.locator('.btn-primary').click();
  await page.waitForFunction(() => location.hash.includes('part=estados') && location.hash.endsWith('&ver=superposicion,coeficientes'));
  assert.match(new URL(page.url()).hash, /potential=pozo-infinito.*wellWidth=0\.8.*n1=1&n2=2&weight=0\.5/);

  // Cada «ver todas» y cada combinación cargan sin errores.
  for (const sim of sims) {
    for (const href of [entryLink(fo, sim), ...sim.combos.map((c) => entryLink(fo, sim, c.graphs))]) {
      await page.evaluate((/** @type {string} */ h) => (location.hash = h), href);
      await page.waitForSelector('html[data-ready="true"][data-route="funcion-onda"]');
      await page.waitForSelector('.side-panel');
      await page.waitForTimeout(250);
    }
  }
  // La barra lateral solo enseña los presets de la simulación abierta (rendijas: ninguno).
  assert.equal(await page.locator('.side-panel .preset:not([hidden])').count(), 0);
  await close();
  assert.deepEqual(errors, []);
});

// Maqueta: en ningún módulo (migrado o no) se superponen los paneles, a los cuatro tamaños
// de referencia del encargo R1 (pantalla 1080p, portátil con la barra del navegador,
// tableta vertical y móvil). Antes, a 900 px o menos, funcion-onda apilaba sus paneles en la
// misma celda de la rejilla y en el móvil solo se veía el último; las pruebas de humo no lo
// detectaban porque solo buscaban errores. Se recorren todas las vistas (parámetro `part`).
const LAYOUT_SIZES = /** @type {const} */ ([
  [1920, 1080],
  [1366, 650],
  [820, 1180],
  [390, 844],
]);

/**
 * Cajas (en coordenadas de la página) de los paneles y tarjetas de gráfica visibles, y de
 * los lienzos de las gráficas.
 * @param {any} page
 * @returns {Promise<{ panels: { name: string, x: number, y: number, w: number, h: number }[], plots: { name: string, w: number, h: number }[] }>}
 */
export async function layoutBoxes(page) {
  return page.evaluate(() => {
    /** @param {Element} e */
    const visible = (e) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    /** @param {Element} e */
    const box = (e) => {
      const b = e.getBoundingClientRect();
      return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height };
    };
    /** @param {Element} e */
    const nameOf = (e) => {
      const card = e.closest('.panel, .graph-card');
      return String(card?.getAttribute('data-graph') ?? card?.querySelector('.panel-title, .graph-title')?.textContent ?? '?').slice(0, 40);
    };
    const panels = [...document.querySelectorAll('.panel, .graph-card')].filter(visible).map((e) => ({ name: nameOf(e), ...box(e) }));
    const plots = [...document.querySelectorAll('.panel canvas.plot-canvas, .graph-card canvas.plot-canvas')]
      .filter(visible)
      .map((c) => ({ name: nameOf(c), w: box(c).w, h: box(c).h }));
    return { panels, plots };
  });
}

/**
 * Parejas de paneles que se superponen (más de 2 px en cada dirección).
 * @param {{ name: string, x: number, y: number, w: number, h: number }[]} panels
 */
export function overlappingPairs(panels) {
  /** @type {string[]} */
  const pairs = [];
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const a = panels[i];
      const b = panels[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 2 && iy > 2) pairs.push(`«${a.name}» y «${b.name}»`);
    }
  }
  return pairs;
}

/** Tamaño mínimo (px) de cada gráfica del formato con simulaciones, a cualquier tamaño de ventana. */
const MIN_GRAPH = { width: 250, height: 200 };

for (const m of modules) {
  /** Direcciones que se recorren: en los módulos con simulaciones, «ver todas» de cada una,
   *  «ver juntas» y cada combinación sugerida; en los demás, cada vista del parámetro `part`. */
  /** @type {string[]} */
  let views;
  if (isPilot(m)) {
    views = (m.simulations ?? []).flatMap((sim) => [
      entryLink(m, sim),
      `${entryLink(m, sim)}&pantalla=juntas`,
      ...sim.combos.map((c) => entryLink(m, sim, c.graphs)),
    ]);
  } else {
    const partParam = m.params.find((p) => p.key === 'part' && p.type === 'select');
    views = partParam && partParam.type === 'select' ? optionValues(partParam).map((v) => `#/${m.id}?part=${v}`) : [`#/${m.id}`];
  }
  for (const [width, height] of LAYOUT_SIZES) {
    test(`[${m.id}] ningún panel se superpone a otro (${width} × ${height})`, { skip }, async () => {
      const { page, errors, close } = await openPage(isPilot(m) ? `#/${m.id}` : views[0], { width, height });
      if (isPilot(m)) await page.screenshot({ path: join(shots, `${m.id}-entrada-${width}x${height}.png`), fullPage: true });
      for (const [v, view] of views.entries()) {
        await page.evaluate((/** @type {string} */ hash) => (location.hash = hash), view);
        await page.waitForSelector('html[data-ready="true"]');
        await page.waitForTimeout(350);
        // En el formato con simulaciones, cada pantalla de la selección (pestañas).
        const tabs = isPilot(m) ? Math.max(1, await page.locator('.sim-tab').count()) : 1;
        for (let t = 0; t < tabs; t++) {
          if (isPilot(m) && !view.endsWith('juntas') && t > 0) {
            await page.locator(`.sim-tab[data-screen="${t + 1}"]`).click();
            await page.waitForTimeout(250);
          }
          const where = `${view.slice(view.indexOf('?part=') + 1, view.indexOf('?part=') + 20)}${view.includes('&ver=') ? ' (combinación)' : ''}${view.endsWith('juntas') ? ' (juntas)' : ''}, pantalla ${t + 1}`;
          const { panels, plots } = await layoutBoxes(page);
          assert.ok(panels.length > 0, `${where}: no hay paneles`);
          assert.deepEqual(overlappingPairs(panels), [], `${where}: paneles superpuestos`);
          for (const plot of plots) assert.ok(plot.w > 0 && plot.h > 0, `${where}: la gráfica «${plot.name}» no tiene tamaño`);
          if (isPilot(m)) {
            const bodies = await page.evaluate(() =>
              [...document.querySelectorAll('.screen .graph-card')].map((c) => {
                const b = /** @type {HTMLElement} */ (c.querySelector('.graph-body')).getBoundingClientRect();
                return { name: /** @type {HTMLElement} */ (c).dataset.graph, w: b.width, h: b.height };
              }),
            );
            for (const b of bodies) {
              assert.ok(b.w >= MIN_GRAPH.width && b.h >= MIN_GRAPH.height, `${where}: la gráfica «${b.name}» mide ${Math.round(b.w)} × ${Math.round(b.h)} px`);
            }
            if (t === 0 && v % 3 !== 2) await page.screenshot({ path: join(shots, `${m.id}-${v}-${width}x${height}.png`) });
          }
        }
      }
      await close();
      assert.deepEqual(errors, []);
    });
  }
}

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
