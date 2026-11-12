// @ts-check
// Tests del motor espectro → color (src/color/cie.js y src/color/spectrum.js).
//
// Referencias, por orden de preferencia: valores publicados por la CIE (cromaticidades de
// los iluminantes y del lugar espectral), propiedades exactas (blanco, ida y vuelta) y,
// para espectros arbitrarios, una implementación independiente: colour-science
// (tests/fixtures/color.json, generado por tools/cie.py).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CIE_COUNT, CIE_END_NM, CIE_START_NM, buildCieData, loadCie, resampleToCieGrid } from '../src/color/cie.js';
import {
  brightestDisplayable,
  createColorEngine,
  decodeSrgb,
  deltaE,
  encodeSrgb,
  illuminantWhite,
  linearSrgbToXyz,
  loadColorEngine,
  monochromaticXYZ,
  normalizeLuminance,
  resampleSpectrum,
  spectrumToXYZ,
  srgbToCss,
  xyzToLab,
  xyzToLinearSrgb,
  xyzToSrgb,
  xyzToXy,
} from '../src/color/spectrum.js';

const cie = await loadCie();
const engine = createColorEngine(cie);
const fixture = JSON.parse(readFileSync(new URL('./fixtures/color.json', import.meta.url), 'utf8'));

/** Espectro plano (vale 1 en todo el intervalo CIE): el reflector o transmisor perfecto. */
const FLAT = { wavelengths: [CIE_START_NM, CIE_END_NM], values: [1, 1] };

/**
 * @param {ArrayLike<number>} actual
 * @param {ArrayLike<number>} expected
 * @param {number} tolerance absoluta
 * @param {string} [message]
 */
function assertClose(actual, expected, tolerance, message = '') {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= tolerance,
      `${message} componente ${i}: ${actual[i]} frente a ${expected[i]} (tolerancia ${tolerance})`,
    );
  }
}

// --- Datos CIE -------------------------------------------------------------------------------

// Las funciones de igualación están en la malla de 360 a 830 nm cada 1 nm. Dos valores
// de control de la tabla CIE 1931: el máximo de ȳ es 1 en 555 nm (así se definió la
// sensibilidad luminosa V(λ)) y x̄(600) = 1,0622 (tabla 1 de CIE 15:2004).
test('cie: malla común y valores de control de las funciones de igualación', () => {
  assert.equal(cie.wavelengths.length, CIE_COUNT);
  assert.equal(cie.wavelengths[0], 360);
  assert.equal(cie.wavelengths[CIE_COUNT - 1], 830);
  const i555 = 555 - CIE_START_NM;
  assert.equal(cie.ybar[i555], 1);
  assert.equal(Math.max(...cie.ybar), 1);
  assert.ok(Math.abs(cie.xbar[600 - CIE_START_NM] - 1.0622) < 1e-10);
});

// El paso de 5 nm a 1 nm es lineal y no extrapola: en los nodos originales devuelve el
// dato tal cual, entre dos nodos su media ponderada, y fuera de la tabla NaN.
test('cie: los iluminantes se interpolan linealmente y no se extrapolan', () => {
  const { values, range } = resampleToCieGrid({ start_nm: 400, step_nm: 5, values: [10, 20, 40] });
  assert.deepEqual(range, [400, 410]);
  assert.equal(values[400 - CIE_START_NM], 10);
  assert.equal(values[402 - CIE_START_NM], 14);
  assert.equal(values[405 - CIE_START_NM], 20);
  assert.equal(values[409 - CIE_START_NM], 36);
  assert.ok(Number.isNaN(values[399 - CIE_START_NM]));
  assert.ok(Number.isNaN(values[411 - CIE_START_NM]));
  // D65 y A están tabulados hasta 780 nm; E, en todo el intervalo.
  assert.deepEqual(cie.illuminants.D65.range, [360, 780]);
  assert.deepEqual(cie.illuminants.A.range, [360, 780]);
  assert.deepEqual(cie.illuminants.E.range, [360, 830]);
  // Por definición, las tablas CIE de D65 y A valen 100 en 560 nm.
  assert.ok(Math.abs(cie.illuminants.D65.values[560 - CIE_START_NM] - 100) < 1e-9);
  assert.ok(Math.abs(cie.illuminants.A.values[560 - CIE_START_NM] - 100) < 1e-3);
});

test('cie: buildCieData rechaza tablas con otra malla o sin algún iluminante', () => {
  const cmf = { start_nm: 380, step_nm: 5, xbar: [0, 1], ybar: [0, 1], zbar: [0, 1] };
  assert.throws(() => buildCieData(cmf, { illuminants: {} }), RangeError);
  const good = { start_nm: 360, step_nm: 1, xbar: new Array(CIE_COUNT).fill(0), ybar: new Array(CIE_COUNT).fill(0), zbar: new Array(CIE_COUNT).fill(0) };
  assert.throws(() => buildCieData(good, { illuminants: {} }), /falta el iluminante D65/);
});

// --- Cromaticidades de referencia ---------------------------------------------------------

// Cromaticidad del iluminante D65 para el observador de 2°: (x, y) = (0,3127; 0,3290)
// (CIE 15:2004, tabla T.3). Tolerancia 5·10⁻⁴, la del encargo: el valor publicado está
// redondeado a 4 decimales y se calcula con la tabla de 5 nm.
test('D65 tiene cromaticidad (0,3127; 0,3290)', () => {
  const [x, y] = xyzToXy(illuminantWhite(cie, 'D65'));
  assert.ok(Math.abs(x - 0.3127) < 5e-4, `x = ${x}`);
  assert.ok(Math.abs(y - 0.329) < 5e-4, `y = ${y}`);
});

// Iluminante A (CIE 15:2004, tabla T.3): (x, y) = (0,4476; 0,4074).
test('el iluminante A tiene cromaticidad (0,4476; 0,4074)', () => {
  const [x, y] = xyzToXy(illuminantWhite(cie, 'A'));
  assert.ok(Math.abs(x - 0.4476) < 5e-4, `x = ${x}`);
  assert.ok(Math.abs(y - 0.4074) < 5e-4, `y = ${y}`);
});

// El iluminante E (igual energía) cae en (1/3, 1/3) porque las tres funciones de
// igualación se normalizaron para tener la misma área. Las tablas cumplen esa igualdad
// con 4–5 cifras, de ahí la tolerancia.
test('el iluminante E tiene cromaticidad (1/3, 1/3)', () => {
  const [x, y] = xyzToXy(illuminantWhite(cie, 'E'));
  assert.ok(Math.abs(x - 1 / 3) < 1e-4, `x = ${x}`);
  assert.ok(Math.abs(y - 1 / 3) < 1e-4, `y = ${y}`);
});

// Lugar espectral: la luz monocromática de 700 nm está en (0,7347; 0,2653) (coordenadas
// de cromaticidad del observador CIE 1931; es el primario rojo del sistema CIE RGB).
test('la luz monocromática de 700 nm está en (0,7347; 0,2653)', () => {
  const [x, y] = xyzToXy(monochromaticXYZ(cie, 700));
  assert.ok(Math.abs(x - 0.7347) < 5e-4, `x = ${x}`);
  assert.ok(Math.abs(y - 0.2653) < 5e-4, `y = ${y}`);
  // Entre dos nanómetros se interpola linealmente.
  const a = monochromaticXYZ(cie, 520);
  const b = monochromaticXYZ(cie, 521);
  assertClose(monochromaticXYZ(cie, 520.25), [0, 1, 2].map((i) => 0.75 * a[i] + 0.25 * b[i]), 1e-15);
  assert.throws(() => monochromaticXYZ(cie, 300), RangeError);
});

// --- Blanco ------------------------------------------------------------------------------------

// Un objeto que lo refleja todo, iluminado con D65, tiene Y = 1 exactamente (por la
// normalización k = 1/Σ S·ȳ) y es el blanco de la pantalla: sRGB ≈ (1, 1, 1). No es
// exacto porque el blanco nominal de sRGB es (0,3127; 0,3290) redondeado y el D65
// integrado del espectro es (0,31272; 0,32903): diferencia de 2·10⁻⁴.
test('reflector perfecto bajo D65: Y = 1 y sRGB ≈ (1, 1, 1)', () => {
  const XYZ = spectrumToXYZ(cie, FLAT);
  assert.ok(Math.abs(XYZ[1] - 1) < 1e-14);
  const color = engine.colorOf(FLAT);
  assertClose(color.linear, [1, 1, 1], 1e-3, 'sRGB lineal');
  assertClose(color.rgb, [1, 1, 1], 1e-3, 'sRGB');
  assert.equal(color.inGamut, true);
  assert.equal(color.css, 'rgb(255, 255, 255)');
  // En CIELAB el blanco de referencia es L* = 100, a* = b* = 0.
  assertClose(color.lab, [100, 0, 0], 1e-10, 'Lab');
});

// Sin adaptación cromática, el blanco del iluminante A se ve anaranjado en una pantalla
// D65: más rojo que verde y más verde que azul. Y en CIELAB, referido a su propio
// blanco, sigue siendo neutro.
test('el blanco bajo el iluminante A sale anaranjado en pantalla y neutro en CIELAB', () => {
  const color = engine.colorOf(FLAT, { illuminant: 'A' });
  assert.ok(color.linear[0] > color.linear[1] && color.linear[1] > color.linear[2]);
  assertClose(color.lab, [100, 0, 0], 1e-10);
});

// Linealidad: XYZ es lineal en el espectro. Un filtro gris del 50 % da la mitad de XYZ y
// la misma cromaticidad; la suma de dos espectros da la suma de sus XYZ.
test('XYZ es lineal en el espectro', () => {
  const wavelengths = [380, 450, 550, 650, 780];
  const a = { wavelengths, values: [0.1, 0.8, 0.3, 0.6, 0.2] };
  const b = { wavelengths, values: [0.5, 0.1, 0.4, 0.2, 0.7] };
  const sum = { wavelengths, values: a.values.map((v, i) => v + b.values[i]) };
  const half = { wavelengths, values: a.values.map((v) => v / 2) };
  const A = spectrumToXYZ(cie, a);
  const B = spectrumToXYZ(cie, b);
  assertClose(spectrumToXYZ(cie, sum), [A[0] + B[0], A[1] + B[1], A[2] + B[2]], 1e-14);
  assertClose(spectrumToXYZ(cie, half), [A[0] / 2, A[1] / 2, A[2] / 2], 1e-14);
  assertClose(xyzToXy(spectrumToXYZ(cie, half)), xyzToXy(A), 1e-14);
});

// --- Matriz y gamma de sRGB -------------------------------------------------------------------

// Definición de sRGB (IEC 61966-2-1): los tres primarios tienen cromaticidades
// (0,64; 0,33), (0,30; 0,60) y (0,15; 0,06), y R = G = B = 1 es D65 con Y = 1. La matriz
// redondeada de la norma tiene Y = 0,2126; 0,7152; 0,0722 para los primarios.
test('matriz de sRGB: primarios, blanco y luminancias de la norma', () => {
  const primaries = [
    [0.64, 0.33],
    [0.3, 0.6],
    [0.15, 0.06],
  ];
  const luminances = [0.2126, 0.7152, 0.0722];
  for (let c = 0; c < 3; c++) {
    const rgb = /** @type {[number, number, number]} */ ([0, 0, 0]);
    rgb[c] = 1;
    const XYZ = linearSrgbToXyz(rgb);
    assertClose(xyzToXy(XYZ), primaries[c], 1e-12, `primario ${c}`);
    assert.ok(Math.abs(XYZ[1] - luminances[c]) < 5e-5, `Y del primario ${c} = ${XYZ[1]}`);
  }
  const white = linearSrgbToXyz([1, 1, 1]);
  assertClose(xyzToXy(white), [0.3127, 0.329], 1e-12, 'blanco');
  assert.ok(Math.abs(white[1] - 1) < 1e-12);
  // Ida y vuelta.
  assertClose(xyzToLinearSrgb(linearSrgbToXyz([0.2, 0.5, 0.9])), [0.2, 0.5, 0.9], 1e-13);
});

// Curva de transferencia de sRGB (IEC 61966-2-1): extremos fijos, tramo lineal de
// pendiente 12,92 cerca del negro, empalme e inversa. Las constantes de la norma están
// redondeadas (0,0031308; 12,92; 1,055), así que en el empalme los dos tramos difieren en
// 3·10⁻⁸: se comprueba que el salto no pasa de 10⁻⁷. Valor de control: el gris medio
// lineal 0,18 se codifica como 0,46135612950044164 (colour.models.eotf_inverse_sRGB de
// colour-science 0.4.7; ≈ 118/255).
test('gamma de sRGB: extremos, tramo lineal, continuidad e inversa', () => {
  assert.equal(encodeSrgb(0), 0);
  assert.ok(Math.abs(encodeSrgb(1) - 1) < 1e-15);
  assert.ok(Math.abs(encodeSrgb(0.001) - 0.01292) < 1e-15);
  assert.ok(Math.abs(encodeSrgb(0.0031308) - encodeSrgb(0.0031308 + 1e-12)) < 1e-7);
  assert.ok(Math.abs(encodeSrgb(0.18) - 0.46135612950044164) < 1e-12);
  for (const c of [0, 0.001, 0.0031308, 0.01, 0.18, 0.5, 1]) {
    assert.ok(Math.abs(decodeSrgb(encodeSrgb(c)) - c) < 1e-14, `ida y vuelta en ${c}`);
  }
});

// --- Fuera de gama ----------------------------------------------------------------------------

// Ninguna luz monocromática cabe en sRGB (el lugar espectral rodea por fuera el triángulo
// de los primarios): el motor debe avisar y recortar, nunca devolver valores fuera de
// [0, 1]. Un gris, en cambio, sí cabe.
test('aviso de fuera de gama y recorte a [0, 1]', () => {
  const laser = xyzToSrgb(normalizeLuminance(monochromaticXYZ(cie, 520), 0.5));
  assert.equal(laser.inGamut, false);
  assert.ok(laser.linear.some((c) => c < 0), 'un verde espectral necesita rojo o azul negativos');
  for (const c of laser.rgb) assert.ok(c >= 0 && c <= 1);
  const gray = xyzToSrgb(linearSrgbToXyz([0.3, 0.3, 0.3]));
  assert.equal(gray.inGamut, true);
  // Demasiado brillante también es fuera de gama.
  assert.equal(xyzToSrgb(linearSrgbToXyz([1.2, 0.5, 0.5])).inGamut, false);
  assert.equal(srgbToCss([1.2, 0.5, -0.1]), 'rgb(255, 128, 0)');
});

// --- CIELAB --------------------------------------------------------------------------------------

// Valores exactos de la definición de CIELAB: Y/Yn = 0,18 → L* = 116·0,18^(1/3) − 16;
// por debajo de (6/29)³ la fórmula es lineal: L* = 903,3·Y/Yn (exactamente (29/3)³).
test('CIELAB: claridad de un gris, tramo lineal y distancia', () => {
  const white = illuminantWhite(cie, 'D65');
  /** @param {number} s */
  const gray = (s) => /** @type {[number, number, number]} */ (white.map((v) => v * s));
  const mid = xyzToLab(gray(0.18), white);
  assertClose(mid, [116 * Math.cbrt(0.18) - 16, 0, 0], 1e-12);
  const dark = xyzToLab(gray(0.001), white);
  assertClose(dark, [(29 / 3) ** 3 * 0.001, 0, 0], 1e-12);
  assert.ok(Math.abs(deltaE([50, 10, -10], [53, 14, -10]) - 5) < 1e-14);
});

// --- Comparación con colour-science ------------------------------------------------------------

// Espectros arbitrarios (parches reales de la carta ColorChecker y dos sintéticos) bajo
// D65, A y E. La referencia integra de 380 a 780 nm cada 1 nm con interpolación lineal,
// lo mismo que hace el motor con un espectro tabulado en ese intervalo, y usa la matriz
// de sRGB derivada de los primarios. Las dos cuentas son independientes y deben coincidir
// salvo redondeo: tolerancia 10⁻⁹ en XYZ y sRGB, 10⁻⁷ en CIELAB (valores hasta 100).
for (const c of fixture.casos) {
  test(`colour-science: ${c.nombre} bajo ${c.iluminante}`, () => {
    const spectrum = { wavelengths: c.wavelength_nm, values: c.values };
    const color = engine.colorOf(spectrum, { illuminant: c.iluminante });
    assertClose(color.XYZ, c.XYZ, 1e-9, 'XYZ');
    assertClose(color.xy, c.xy, 1e-9, 'xy');
    assertClose(illuminantWhite(cie, c.iluminante, [380, 780]), c.blanco_XYZ, 1e-9, 'blanco');
    assertClose(color.linear, c.sRGB_lineal, 1e-9, 'sRGB lineal');
    assertClose(color.lab, c.Lab, 1e-7, 'Lab');
    const expectedInGamut = c.sRGB_lineal.every((/** @type {number} */ v) => v >= 0 && v <= 1);
    assert.equal(color.inGamut, expectedInGamut);
    // Con gamma: se comparan los canales que caben; los que no, quedan recortados.
    c.sRGB_lineal.forEach((/** @type {number} */ linear, /** @type {number} */ i) => {
      if (linear >= 0 && linear <= 1) assert.ok(Math.abs(color.rgb[i] - c.sRGB[i]) < 1e-9, `sRGB canal ${i}`);
      else assert.equal(color.rgb[i], linear < 0 ? 0 : 1);
    });
  });
}

// El fixture debe contener casos fuera de gama y casos dentro, para que el test anterior
// ejercite las dos ramas.
test('el fixture de colour-science cubre casos dentro y fuera de gama', () => {
  const inside = fixture.casos.filter((/** @type {any} */ c) => c.sRGB_lineal.every((/** @type {number} */ v) => v >= 0 && v <= 1));
  assert.ok(inside.length >= 5);
  assert.ok(fixture.casos.length - inside.length >= 2);
});

// --- Entradas no válidas -------------------------------------------------------------------------

// Un espectro que no cubre el visible (380–780 nm) no tiene color definido: el motor se
// niega a inventar los tramos que faltan.
test('un espectro que no cubre 380–780 nm se rechaza', () => {
  assert.throws(() => spectrumToXYZ(cie, { wavelengths: [400, 700], values: [1, 1] }), /debe cubrir/);
  assert.throws(() => spectrumToXYZ(cie, { wavelengths: [380, 780], values: [1, 1] }, { illuminant: /** @type {any} */ ('D50') }), /iluminante desconocido/);
  assert.throws(() => resampleSpectrum({ wavelengths: [380, 500, 500, 780], values: [1, 1, 1, 1] }, 380, 780), /crecientes/);
  assert.throws(() => resampleSpectrum({ wavelengths: [400, 700], values: [1, 1] }, 380, 780), RangeError);
});

// Luz emitida: el brillo lo fija quien llama (Y), y la cromaticidad no cambia con él. Una
// luz de espectro plano es el iluminante E.
test('color de una luz: cromaticidad independiente del brillo', () => {
  const dim = engine.colorOfLight(FLAT, { Y: 0.2 });
  const bright = engine.colorOfLight(FLAT, { Y: 0.8 });
  assertClose(dim.xy, bright.xy, 1e-14);
  assertClose(dim.xy, xyzToXy(illuminantWhite(cie, 'E')), 1e-14);
  assert.ok(Math.abs(dim.XYZ[1] - 0.2) < 1e-15);
});

// Brillo máximo en pantalla: el canal más alto queda en 1 exacto y la cromaticidad no
// cambia. Un espectro dispersado plano (dispersa igual todos los colores) se ve blanco, y
// multiplicar el espectro por una constante no cambia el color mostrado.
test('colorOfScattered: mayor brillo que cabe en pantalla, misma cromaticidad', () => {
  const XYZ = linearSrgbToXyz([0.1, 0.25, 0.05]);
  const bright = brightestDisplayable(XYZ);
  assertClose(xyzToLinearSrgb(bright), [0.4, 1, 0.2], 1e-13);
  assertClose(xyzToXy(bright), xyzToXy(XYZ), 1e-14);
  assert.deepEqual(brightestDisplayable([0, 0, 0]), [0, 0, 0]);
  const white = engine.colorOfScattered(FLAT);
  assert.ok(Math.abs(Math.max(...white.linear) - 1) < 1e-12 && Math.min(...white.linear) > 0.999);
  const wavelengths = [380, 500, 600, 780];
  const a = engine.colorOfScattered({ wavelengths, values: [1, 5, 2, 1] });
  const b = engine.colorOfScattered({ wavelengths, values: [1e-9, 5e-9, 2e-9, 1e-9] });
  assertClose(a.rgb, b.rgb, 1e-12);
});

// Colores espectrales para pintar la banda del visible: siempre dentro de [0, 1], con el
// rojo dominando en 650 nm, el verde en 530 nm y el azul en 450 nm.
test('wavelengthToSrgb: canal dominante en rojo, verde y azul', () => {
  const dominant = (/** @type {number} */ lambda) => {
    const rgb = engine.wavelengthToSrgb(lambda);
    for (const c of rgb) assert.ok(c >= 0 && c <= 1);
    return rgb.indexOf(Math.max(...rgb));
  };
  assert.equal(dominant(650), 0);
  assert.equal(dominant(530), 1);
  assert.equal(dominant(450), 2);
});

test('loadColorEngine entrega un motor que funciona', async () => {
  const loaded = await loadColorEngine();
  assert.equal(loaded.colorOf(FLAT).css, 'rgb(255, 255, 255)');
});
