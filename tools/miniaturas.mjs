// @ts-check
// Genera la miniatura de cada módulo visible para las tarjetas de la portada.
//
// Uso:  npm run miniaturas            (todos los módulos con `thumbnail`)
//       npm run miniaturas oscilador  (solo ese módulo)
//
// Abre cada módulo en un navegador sin cabeza (Playwright), entra en modo presentación
// y guarda una captura de 640 × 360 en src/modules/<id>/<thumbnail>. Hay que volver a
// ejecutarlo cuando cambie el aspecto de un módulo.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { modules } from '../src/modules/registry.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv[2];

/** @type {any} */
let playwright;
try {
  playwright = createRequire(import.meta.url)('playwright');
} catch {
  console.error('Hace falta Playwright para generar miniaturas (npm install -g playwright).');
  process.exit(1);
}

const targets = modules.filter((m) => m.thumbnail && !m.hidden && (!only || m.id === only));
if (targets.length === 0) {
  console.log('No hay módulos visibles con `thumbnail` en su descriptor.');
  process.exit(0);
}

const server = await startServer({ base: '/laboratorio/' });
const browser = await playwright.chromium.launch();
try {
  for (const m of targets) {
    // Ventana de 1280 × 720 con factor de escala 0,5: la captura mide 640 × 360.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 0.5 });
    await context.addInitScript(() => localStorage.setItem('laboratorio:tema', 'light'));
    const page = await context.newPage();
    await page.goto(`${server.url}#/${m.id}`);
    await page.waitForSelector('html[data-ready="true"]');
    await page.keyboard.press('p');
    await page.waitForSelector('html[data-presentation="true"]');
    await page.waitForTimeout(1200);
    const file = join(root, 'src/modules', m.id, String(m.thumbnail));
    await page.locator('.stage-frame').screenshot({ path: file });
    await context.close();
    console.log(`Miniatura escrita: src/modules/${m.id}/${m.thumbnail}`);
  }
} finally {
  await browser.close();
  await server.close();
}
