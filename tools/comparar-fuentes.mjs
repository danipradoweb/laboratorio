// @ts-check
// Capturas para comparar la letra de los controles y de los números de los ejes (encargo R1,
// paso de tipografía): la letra de sistema (A, la de siempre) frente a CMU Serif (B, la del
// texto), en el móvil (390 × 844, controles abiertos), en un portátil (1366 × 650) y en el
// modo presentación (1920 × 1080). Guarda capturas/fuentes-<caso>-<A|B>.png.
//
// Uso:  node tools/comparar-fuentes.mjs   (necesita Playwright, como la prueba de humo)

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'capturas');
mkdirSync(shots, { recursive: true });
const playwright = createRequire(import.meta.url)('playwright');

const HASH = '#/funcion-onda?part=estados&potential=pozo-infinito&wellWidth=0.8&n1=1&n2=2&weight=0.5';
const VARIANTS = {
  A: '',
  B: ":root { --font-ui: 'CMU Serif', 'KaTeX_Main', serif; --font-plot: 'CMU Serif', 'KaTeX_Main', serif; }",
};
const CASES = [
  { name: 'movil', width: 390, height: 844, open: true, present: false, clip: { x: 0, y: 0, width: 390, height: 844 } },
  { name: 'portatil', width: 1366, height: 650, open: false, present: false, clip: { x: 0, y: 40, width: 900, height: 610 } },
  { name: 'presentacion', width: 1920, height: 1080, open: false, present: true, clip: { x: 0, y: 0, width: 1920, height: 1080 } },
];

const server = await startServer({ base: '/laboratorio/' });
const browser = await playwright.chromium.launch();
for (const c of CASES) {
  for (const [variant, css] of Object.entries(VARIANTS)) {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height } });
    await page.goto(server.url + HASH);
    await page.waitForSelector('html[data-ready="true"]');
    if (css) await page.addStyleTag({ content: css });
    if (c.open || c.width <= 760) await page.locator('.panel-toggle').click(); // en el móvil, plegados al entrar
    await page.locator('.clock-controls button').first().click(); // pausa: mismo instante
    if (!c.open && c.width <= 760) await page.locator('.panel-toggle').click();
    if (c.present) await page.keyboard.press('p');
    await page.waitForTimeout(900);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(shots, `fuentes-${c.name}-${variant}.png`), clip: c.clip });
    await page.close();
  }
}
await browser.close();
await server.close();
console.log('Capturas en capturas/fuentes-*.png');
