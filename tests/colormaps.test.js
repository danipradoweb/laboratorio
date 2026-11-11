// @ts-check
// Tests de src/ui/colormaps.js: conversión OKLab, rueda de fase y mapas escalares.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  oklchToSrgb,
  srgbToOklab,
  linearToGamma,
  gammaToLinear,
  phaseColor,
  colorizeComplex,
  colormaps,
  getColormap,
  PHASE_LIGHTNESS,
  PHASE_CHROMA,
  PHASE_HUE_ZERO,
} from '../src/ui/colormaps.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/oklab.json', import.meta.url), 'utf8'));

// Principio: las matrices de OKLab tecleadas en colormaps.js son las de la definición.
// Valor esperado: la librería culori, implementación independiente (fixture generado
// con tools/oklab-fixture.mjs). Incluye colores fuera de gama, sin recortar.
test('OKLCH → sRGB coincide con culori', () => {
  for (const { L, C, h, rgb } of fixture.oklchToSrgb) {
    const got = oklchToSrgb(L, C, h);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(got[i] - rgb[i]) < 1e-6, `L=${L} C=${C} h=${h}: ${got} frente a ${rgb}`);
    }
  }
});

test('sRGB → OKLab coincide con culori', () => {
  for (const { rgb, lab } of fixture.srgbToOklab) {
    const got = srgbToOklab(rgb[0], rgb[1], rgb[2]);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(got[i] - lab[i]) < 1e-6, `rgb=${rgb}: ${got} frente a ${lab}`);
    }
  }
});

// Principio: las dos conversiones son inversas, y la corrección gamma también.
test('ida y vuelta OKLab ↔ sRGB y gamma', () => {
  for (const c of [0, 0.001, 0.0031308, 0.02, 0.2, 0.5, 1]) {
    assert.ok(Math.abs(gammaToLinear(linearToGamma(c)) - c) < 1e-12);
  }
  for (const h of [0, 77, 200, 311]) {
    const [r, g, b] = oklchToSrgb(0.6, 0.08, h);
    const [L, a, bb] = srgbToOklab(r, g, b);
    assert.ok(Math.abs(L - 0.6) < 1e-6);
    assert.ok(Math.abs(Math.hypot(a, bb) - 0.08) < 1e-6);
  }
});

// Principio: la fase es periódica; el color no puede tener un salto entre −π y +π.
test('rueda de fase: es cíclica', () => {
  assert.deepEqual(phaseColor(Math.PI), phaseColor(-Math.PI));
  assert.deepEqual(phaseColor(0.7), phaseColor(0.7 + 2 * Math.PI));
  assert.deepEqual(phaseColor(0.7), phaseColor(0.7 - 4 * Math.PI));
});

// Principio: "perceptualmente uniforme" significa que todas las fases tienen la misma
// luminosidad y el mismo croma en OKLab, y que pasos iguales de fase dan pasos iguales
// de color. Se mide sobre el color realmente emitido (bytes sRGB), así que la
// tolerancia es la de redondear a 8 bits.
test('rueda de fase: luminosidad y croma constantes, pasos de color uniformes', () => {
  const steps = 360;
  /** @type {[number, number, number][]} */
  const labs = [];
  for (let i = 0; i < steps; i++) {
    const [r, g, b] = phaseColor((2 * Math.PI * i) / steps);
    labs.push(srgbToOklab(r / 255, g / 255, b / 255));
  }
  for (const [L, a, b] of labs) {
    assert.ok(Math.abs(L - PHASE_LIGHTNESS) < 0.004, `L = ${L}`);
    assert.ok(Math.abs(Math.hypot(a, b) - PHASE_CHROMA) < 0.006, `C = ${Math.hypot(a, b)}`);
  }
  // Distancia de color entre fases separadas 30°: debe ser la cuerda 2·C·sen(15°) siempre.
  const expected = 2 * PHASE_CHROMA * Math.sin(Math.PI / 12);
  for (let i = 0; i < steps; i += 10) {
    const p = labs[i];
    const q = labs[(i + 30) % steps];
    const distance = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    assert.ok(Math.abs(distance - expected) < 0.008, `ΔE = ${distance}, esperado ${expected}`);
  }
});

// Principio: si un color no cabe en sRGB hay que recortarlo, y el recorte rompería la
// uniformidad. Se comprueba que la rueda entera cabe sin recortar, con cualquier módulo
// y con los dos fondos.
test('rueda de fase: todos los colores caben en sRGB sin recortar', () => {
  for (let deg = 0; deg < 360; deg += 2) {
    for (let m = 0; m <= 1.0001; m += 0.05) {
      const dark = oklchToSrgb(PHASE_LIGHTNESS * m, PHASE_CHROMA * m, deg);
      const light = oklchToSrgb(1 - m * (1 - PHASE_LIGHTNESS), PHASE_CHROMA * m, deg);
      for (const c of [...dark, ...light]) {
        assert.ok(c >= -1e-9 && c <= 1 + 1e-9, `fuera de gama en tono ${deg}, módulo ${m}: ${c}`);
      }
    }
  }
});

// Convenio documentado: fase 0 → tono OKLCH de PHASE_HUE_ZERO (rojo); la fase crece en
// el mismo sentido que el tono. Y |ψ| = 0 es el fondo: negro u blanco.
test('rueda de fase: convenio de tono y fundido al fondo', () => {
  const [r, g, b] = phaseColor(0);
  const [, a, bb] = srgbToOklab(r / 255, g / 255, b / 255);
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  assert.ok(Math.abs(hue - PHASE_HUE_ZERO) < 2, `tono de la fase 0: ${hue}`);
  assert.ok(r > g && r > b, 'la fase 0 es rojiza');
  const [r2, g2, b2] = phaseColor(Math.PI);
  assert.ok(r2 < g2 && r2 < b2, 'la fase π es cian (poco rojo)');

  assert.deepEqual(phaseColor(1.23, 0, 'dark'), [0, 0, 0]);
  assert.deepEqual(phaseColor(1.23, 0, 'light'), [255, 255, 255]);
  // El brillo crece con el módulo sobre fondo oscuro y decrece sobre fondo claro.
  let previousDark = -1;
  let previousLight = 2;
  for (let m = 0; m <= 1.0001; m += 0.1) {
    const d = phaseColor(2, m, 'dark');
    const l = phaseColor(2, m, 'light');
    const Ld = srgbToOklab(d[0] / 255, d[1] / 255, d[2] / 255)[0];
    const Ll = srgbToOklab(l[0] / 255, l[1] / 255, l[2] / 255)[0];
    assert.ok(Ld > previousDark && Ll < previousLight);
    previousDark = Ld;
    previousLight = Ll;
  }
  // Módulos fuera de [0, 1] se recortan.
  assert.deepEqual(phaseColor(2, 5), phaseColor(2, 1));
});

test('colorizeComplex: fase por punto y normalización por el máximo', () => {
  const re = [1, 0, -2, 0];
  const im = [0, 1, 0, 0];
  const rgba = colorizeComplex(re, im, { background: 'dark' });
  assert.equal(rgba.length, 16);
  assert.deepEqual([...rgba.slice(0, 3)], phaseColor(0, 0.5));
  assert.deepEqual([...rgba.slice(4, 7)], phaseColor(Math.PI / 2, 0.5));
  assert.deepEqual([...rgba.slice(8, 11)], phaseColor(Math.PI, 1));
  assert.deepEqual([...rgba.slice(12, 16)], [0, 0, 0, 255]);
  const fixed = colorizeComplex(re, im, { maxAbs: 4 });
  assert.deepEqual([...fixed.slice(8, 11)], phaseColor(Math.PI, 0.5));
});

// Principio: en un mapa secuencial la luminosidad crece de forma monótona con t (un
// valor mayor nunca se ve más oscuro), y lo hace a ritmo casi constante.
test('mapas secuenciales: luminosidad monótona creciente', () => {
  for (const name of /** @type {const} */ (['viridis', 'magma'])) {
    let previous = -1;
    for (let i = 0; i <= 100; i++) {
      const [r, g, b] = colormaps[name](i / 100);
      const L = srgbToOklab(r / 255, g / 255, b / 255)[0];
      assert.ok(L > previous - 1e-3, `${name}: la luminosidad baja en t = ${i / 100}`);
      previous = L;
    }
    const first = colormaps[name](0);
    const last = colormaps[name](1);
    const L0 = srgbToOklab(first[0] / 255, first[1] / 255, first[2] / 255)[0];
    const L1 = srgbToOklab(last[0] / 255, last[1] / 255, last[2] / 255)[0];
    assert.ok(L1 - L0 > 0.5, `${name}: recorre poca luminosidad`);
  }
});

// Principio: en un mapa divergente el centro es neutro y lo más claro, la luminosidad
// baja de forma monótona hacia los dos extremos, y lo hace por igual a ambos lados:
// un valor +v y su opuesto −v deben verse igual de oscuros, o el ojo creería que uno
// es "mayor". Tolerancia de simetría: 0,05 en L de OKLab (5 % de la escala de
// luminosidad). Con este criterio se eligió RdBu frente a otros mapas azul-rojo
// (ver tools/colormaps.py). Los extremos son azul y rojo, distinguibles con
// daltonismo rojo-verde.
test('mapa divergente: centro claro y neutro, luminosidad simétrica y monótona', () => {
  const map = colormaps.divergente;
  /** @param {number} t */
  const lab = (t) => {
    const [r, g, b] = map(t);
    return srgbToOklab(r / 255, g / 255, b / 255);
  };
  const center = lab(0.5);
  assert.ok(center[0] > 0.9, `centro poco claro: L = ${center[0]}`);
  assert.ok(Math.hypot(center[1], center[2]) < 0.03, 'el centro debe ser casi neutro');
  let previousLo = center[0];
  let previousHi = center[0];
  for (let i = 1; i <= 50; i++) {
    const lo = lab(0.5 - i / 100);
    const hi = lab(0.5 + i / 100);
    assert.ok(Math.abs(lo[0] - hi[0]) < 0.05, `luminosidad asimétrica a distancia ${i / 100} del centro`);
    assert.ok(lo[0] < previousLo + 2e-3 && hi[0] < previousHi + 2e-3, `no monótono a distancia ${i / 100}`);
    previousLo = lo[0];
    previousHi = hi[0];
  }
  const [r0, , b0] = map(0);
  const [r1, , b1] = map(1);
  assert.ok(b0 > r0, 't = 0 es azul');
  assert.ok(r1 > b1, 't = 1 es rojo');
});

test('los mapas recortan t a [0, 1] y getColormap valida el nombre', () => {
  assert.deepEqual(colormaps.viridis(-3), colormaps.viridis(0));
  assert.deepEqual(colormaps.viridis(7), colormaps.viridis(1));
  assert.deepEqual(colormaps.viridis(NaN), colormaps.viridis(0));
  assert.equal(getColormap('magma'), colormaps.magma);
  assert.throws(() => getColormap('arcoiris'), /desconocido/);
  // Extremos conocidos de viridis (tabla de matplotlib): #440154 y #fde725.
  assert.deepEqual(colormaps.viridis(0), [0x44, 0x01, 0x54]);
  assert.deepEqual(colormaps.viridis(1), [0xfd, 0xe7, 0x25]);
});
