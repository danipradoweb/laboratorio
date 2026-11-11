// @ts-check
// Genera tests/fixtures/oklab.json: conversiones de color de referencia calculadas con
// la librería culori (MIT), una implementación independiente de OKLab/OKLCH.
//
// Uso:  node tools/oklab-fixture.mjs
//
// tests/colormaps.test.js compara src/ui/colormaps.js con este fixture. No lo edites a mano.

import { writeFileSync, readFileSync } from 'node:fs';
// @ts-expect-error culori no publica tipos de TypeScript
import { converter } from 'culori';

const toRgb = converter('rgb'); // sRGB con gamma, sin recortar
const toOklab = converter('oklab');

/** @type {{ L: number, C: number, h: number, rgb: number[] }[]} */
const oklchToSrgb = [];
for (const L of [0.2, 0.5, 0.72, 0.9]) {
  for (const C of [0, 0.05, 0.12, 0.2]) {
    for (let h = 0; h < 360; h += 30) {
      const c = toRgb({ mode: 'oklch', l: L, c: C, h });
      oklchToSrgb.push({ L, C, h, rgb: [c.r, c.g, c.b] });
    }
  }
}

/** @type {{ rgb: number[], lab: number[] }[]} */
const srgbToOklab = [];
for (const rgb of [
  [0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [0, 1, 1], [1, 0, 1], [0.5, 0.5, 0.5], [0.2, 0.4, 0.8], [0.9, 0.3, 0.1],
]) {
  const lab = toOklab({ mode: 'rgb', r: rgb[0], g: rgb[1], b: rgb[2] });
  srgbToOklab.push({ rgb, lab: [lab.l, lab.a ?? 0, lab.b ?? 0] });
}

const version = JSON.parse(readFileSync(new URL('../node_modules/culori/package.json', import.meta.url), 'utf8')).version;
const out = {
  _fuente: `culori ${version} (MIT), conversiones OKLCH → sRGB y sRGB → OKLab`,
  _generado_por: 'tools/oklab-fixture.mjs',
  _nota: 'rgb en [0, 1] con corrección gamma, sin recortar (puede salirse de [0, 1] fuera de gama)',
  oklchToSrgb,
  srgbToOklab,
};
writeFileSync(new URL('../tests/fixtures/oklab.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`Escrito tests/fixtures/oklab.json (${oklchToSrgb.length + srgbToOklab.length} casos)`);
