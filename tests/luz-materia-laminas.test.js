// @ts-check
// Tests de la parte B del módulo «luz y materia» (src/modules/luz-materia/physics-sheets.js):
// láminas de dipolos que radian. De la suma de la onda incidente con las ondas radiadas
// deben salir el índice de refracción, la onda reflejada y la transmitida.
//
// Unidades: posiciones en longitudes de onda del vacío (k·z = 2π·z); campos divididos por E₀.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blochIndex,
  fieldProfile,
  fitIndex,
  layerMatrix,
  reflectionPhasors,
  sheetPositions,
  sheetStrength,
  sheetWave,
  singleSheet,
  slabCoefficients,
  solveSheets,
  solveSheetsMarching,
  transmissionPhasors,
} from '../src/modules/luz-materia/physics-sheets.js';
import { GLASS_RELATIVE_DAMPING, modelEpsilon, normalReflectance, sellmeierToLorentz } from '../src/modules/luz-materia/physics.js';
import { epsilonToNk } from '../src/materials/dielectric.js';
import { loadMaterial } from '../src/materials/library.js';
import { solveComplexDense } from '../src/core/linalg.js';
import * as C from '../src/core/complex.js';

const TWO_PI = 2 * Math.PI;
/** e^{i·2π·x} */
const phase = (/** @type {number} */ x) => C.fromPolar(1, TWO_PI * x);
/** Índice complejo √(1 + χ) con n ≥ 0. @param {C.Complex} chi */
const indexOf = (chi) => {
  const { n, k } = epsilonToNk(C.add(C.ONE, chi));
  return C.complex(n, k);
};

/**
 * @param {C.Complex} actual
 * @param {C.Complex} expected
 * @param {number} tol tolerancia absoluta
 * @param {string} [msg]
 */
function closeC(actual, expected, tol, msg = '') {
  const distance = C.abs(C.sub(actual, expected));
  assert.ok(distance <= tol, `${msg} obtenido ${actual.re} + ${actual.im}i, esperado ${expected.re} + ${expected.im}i (distancia ${distance})`);
}

/** Susceptibilidades de prueba: transparente, absorbente, metal (Re ε < 0) y diluida. */
const CHI = {
  glass: C.complex(1.13, 0),
  lossy: C.complex(1.25, 0.5),
  metal: C.complex(-5, 0.4),
  dilute: C.complex(0.01, 0),
};

// --- Una lámina sola ---------------------------------------------------------------------

// Principio: con una sola lámina el sistema es una ecuación, E₁ = e^{ikz₁} + iκE₁, y todo
// es analítico: E₁ = e^{ikz₁}/(1 − iκ), r = iκ·e^{2ikz₁}/(1 − iκ), t = 1/(1 − iκ) = 1 + r·e^{−2ikz₁}.
// Valor esperado: esas fórmulas escritas aquí de forma independiente del código.
test('una lámina sola: reflexión y transmisión analíticas', () => {
  for (const kappa of [C.complex(0.3, 0), C.complex(-2, 0), C.complex(0.4, 0.25), C.complex(0, 1.5)]) {
    for (const z of [0, 0.17, 2.6]) {
      const solution = solveSheets(kappa, [z]);
      const denominator = C.sub(C.ONE, C.mul(C.I, kappa));
      closeC(solution.fields[0], C.div(phase(z), denominator), 1e-14);
      closeC(solution.t, C.div(C.ONE, denominator), 1e-14);
      closeC(solution.r, C.div(C.mul(C.mul(C.I, kappa), phase(2 * z)), denominator), 1e-14);
    }
    const analytic = singleSheet(kappa);
    closeC(analytic.t, solveSheets(kappa, [0]).t, 1e-14);
    closeC(analytic.r, solveSheets(kappa, [0]).r, 1e-14);
    // La lámina radia lo mismo hacia los dos lados: t = 1 + r (con la lámina en z = 0).
    closeC(analytic.t, C.add(C.ONE, analytic.r), 1e-15);
  }
});

// Principio (ecuaciones de Maxwell): el campo total cumple la ecuación de ondas con las
// láminas como fuente, E″ + k²E = −k²·P/ε₀ con P = Σ P_s,j·δ(z − z_j). Entre láminas, por
// tanto, E″ = −k²E; y en cada lámina E es continuo y su derivada salta
//   E′(z_j⁺) − E′(z_j⁻) = −k²·P_s,j/ε₀ = −2k·κ·E_j.
// Se comprueba con derivadas numéricas laterales (segundo orden, h = 10⁻⁵) sobre el campo
// que devuelve fieldProfile. Tolerancia 10⁻⁶ relativa a k·|E|, coherente con h.
test('el campo total cumple la ecuación de ondas con las láminas como fuente', () => {
  const kappa = C.complex(0.35, 0.12);
  const positions = [0.1, 0.23, 0.31, 0.6, 0.95];
  const solution = solveSheets(kappa, positions);
  const h = 1e-5;
  /** Campo total en z. @param {number} z */
  const fieldAt = (z) => {
    const { total } = fieldProfile(solution, [z]);
    return C.complex(total.re[0], total.im[0]);
  };
  positions.forEach((zj, j) => {
    const center = fieldAt(zj);
    closeC(center, solution.fields[j], 1e-12, 'el campo en la lámina es el de la solución:');
    // Derivadas laterales de segundo orden: (∓3E₀ ± 4E₁ ∓ E₂)/(2h).
    const right = C.scale(C.add(C.add(C.scale(center, -3), C.scale(fieldAt(zj + h), 4)), C.scale(fieldAt(zj + 2 * h), -1)), 1 / (2 * h));
    const left = C.scale(C.add(C.add(C.scale(center, 3), C.scale(fieldAt(zj - h), -4)), fieldAt(zj - 2 * h)), 1 / (2 * h));
    const expected = C.scale(C.mul(kappa, solution.fields[j]), -2 * TWO_PI);
    closeC(C.sub(right, left), expected, 1e-6 * TWO_PI, `salto de E′ en la lámina ${j}:`);
  });
  // Entre láminas, E″ = −k²E.
  for (const z of [-0.4, 0.17, 0.45, 0.8, 1.3]) {
    const d = 1e-3;
    const second = C.scale(C.add(C.add(fieldAt(z + d), fieldAt(z - d)), C.scale(fieldAt(z), -2)), 1 / (d * d));
    closeC(second, C.scale(fieldAt(z), -(TWO_PI ** 2)), 2e-4 * TWO_PI ** 2, `ecuación de ondas en z = ${z}:`);
  }
});

// --- El sistema autoconsistente ----------------------------------------------------------------

// Principio: la solución cumple su propia definición, E_i = e^{ikz_i} + iκ·Σ_j e^{ik|z_i − z_j|}·E_j
// (se sustituye y se mira el residuo), y un método independiente (recorrer el montón de
// atrás hacia delante sumando lo que radia cada lámina, coste N) da lo mismo.
test('el sistema N × N se cumple y coincide con el método de recorrido', () => {
  const cases = [
    { kappa: C.complex(0.2, 0), positions: sheetPositions(30, 0.04) },
    { kappa: C.complex(0.5, 0.3), positions: sheetPositions(25, 0.1) },
    { kappa: C.complex(-1.4, 0.05), positions: sheetPositions(40, 0.02) },
    { kappa: C.complex(0.3, 0.02), positions: Float64Array.from([0, 0.05, 0.31, 0.32, 0.9, 1.7, 1.75]) },
  ];
  for (const { kappa, positions } of cases) {
    const solution = solveSheets(kappa, positions);
    const iKappa = C.mul(C.I, kappa);
    solution.fields.forEach((field, i) => {
      let sum = phase(positions[i]);
      solution.fields.forEach((other, j) => {
        sum = C.add(sum, C.mul(C.mul(iKappa, other), phase(Math.abs(positions[i] - positions[j]))));
      });
      closeC(field, sum, 1e-11, `residuo en la lámina ${i}:`);
    });
    const marching = solveSheetsMarching(kappa, positions);
    closeC(marching.r, solution.r, 1e-11);
    closeC(marching.t, solution.t, 1e-11);
    marching.fields.forEach((field, j) => closeC(field, solution.fields[j], 1e-11));
  }
  // Sin láminas no hay nada que radie: pasa la onda incidente intacta.
  const empty = solveSheets(C.complex(0.3, 0), []);
  assert.deepEqual([empty.R, empty.T, empty.A], [0, 1, 0]);
});

// --- Conservación de la energía ------------------------------------------------------------------

// Principio: sin pérdidas (χ real ⇒ κ real) las láminas no pueden quedarse energía:
// R + T = 1, para cualquier número de láminas, separación y fuerza (también con Re ε < 0,
// donde casi todo se refleja). Tolerancia 10⁻¹¹ (redondeo de la eliminación de Gauss).
test('sin pérdidas: R + T = 1', () => {
  for (const chi of [CHI.glass, CHI.dilute, C.complex(-5, 0), C.complex(8, 0)]) {
    for (const [count, spacing] of [[1, 0.05], [7, 0.13], [40, 0.05], [80, 0.02], [33, 0.25]]) {
      const solution = solveSheets(sheetStrength(chi, spacing), sheetPositions(count, spacing));
      assert.ok(Math.abs(solution.R + solution.T - 1) < 1e-11, `χ = ${chi.re}, N = ${count}, d = ${spacing}: R + T = ${solution.R + solution.T}`);
      assert.equal(solution.A, 0);
    }
  }
});

// Principio: con pérdidas, lo que falta en R + T es exactamente lo que absorben las
// láminas, y cada una absorbe 2·Im κ·|E_j|² ≥ 0 (trabajo del campo sobre un oscilador
// cuya respuesta tiene parte en cuadratura). R + T + A = 1.
test('con pérdidas: R + T + A = 1 y cada lámina absorbe una cantidad positiva', () => {
  for (const chi of [CHI.lossy, CHI.metal, C.complex(0.5, 3)]) {
    for (const [count, spacing] of [[1, 0.05], [12, 0.11], [60, 0.03]]) {
      const solution = solveSheets(sheetStrength(chi, spacing), sheetPositions(count, spacing));
      assert.ok(Math.abs(solution.R + solution.T + solution.A - 1) < 1e-11, `R + T + A = ${solution.R + solution.T + solution.A}`);
      assert.ok(solution.A > 0 && solution.absorbed.every((a) => a > 0));
      assert.ok(Math.abs(solution.absorbed.reduce((s, a) => s + a, 0) - solution.A) < 1e-14);
    }
  }
});

// --- El medio continuo de referencia (matriz de transferencia) ---------------------------------------

// Principio: la reflexión y la transmisión de una lámina continua salen de las condiciones
// de contorno de Maxwell en sus dos caras (E y H tangenciales continuos). Se plantean aquí
// directamente como un sistema 4 × 4 para (r, a, b, t), con el campo dentro a·e^{inkz} + b·e^{−inkz},
// y se comparan con la matriz de transferencia y con la fórmula de Airy (suma de las
// reflexiones múltiples): r = r₁₂(1 − e^{2iβ})/(1 − r₁₂²e^{2iβ}), t = (1 − r₁₂²)e^{iβ}/(1 − r₁₂²e^{2iβ}).
test('lámina continua: matriz de transferencia = condiciones de contorno = fórmula de Airy', () => {
  for (const n of [C.complex(1.5, 0), C.complex(1.46, 0.002), C.complex(1.6, 0.4), C.complex(0.3, 2.2)]) {
    for (const thickness of [0.05, 0.37, 1.3]) {
      const { r, t } = slabCoefficients(n, thickness);
      // Condiciones de contorno en z = 0 y z = L (L en longitudes de onda; H ∝ n·(a − b)).
      const eL = C.exp(C.mul(C.I, C.scale(n, TWO_PI * thickness)));
      const eLinv = C.div(C.ONE, eL);
      const out = phase(thickness);
      const m1 = C.complex(-1);
      const [rB, , , tB] = solveComplexDense(
        [
          [m1, C.ONE, C.ONE, C.ZERO], // 1 + r = a + b
          [C.ONE, n, C.neg(n), C.ZERO], // 1 − r = n(a − b)
          [C.ZERO, eL, eLinv, C.neg(out)], // a·e^{inkL} + b·e^{−inkL} = t·e^{ikL}
          [C.ZERO, C.mul(n, eL), C.neg(C.mul(n, eLinv)), C.neg(out)], // n(a·e^{inkL} − b·e^{−inkL}) = t·e^{ikL}
        ],
        [C.ONE, C.ONE, C.ZERO, C.ZERO],
      );
      closeC(r, rB, 1e-12, `r con n = ${n.re} + ${n.im}i, L = ${thickness}:`);
      closeC(t, tB, 1e-12, `t con n = ${n.re} + ${n.im}i, L = ${thickness}:`);
      // Fórmula de Airy.
      const r12 = C.div(C.sub(C.ONE, n), C.add(C.ONE, n));
      const e2 = C.mul(eL, eL);
      const denominator = C.sub(C.ONE, C.mul(C.mul(r12, r12), e2));
      closeC(r, C.div(C.mul(r12, C.sub(C.ONE, e2)), denominator), 1e-12);
      const tAiry = C.mul(C.div(C.mul(C.sub(C.ONE, C.mul(r12, r12)), eL), denominator), phase(-thickness));
      closeC(t, tAiry, 1e-12);
    }
  }
  // La matriz de una capa tiene determinante 1 (Born & Wolf §1.6).
  const [[a, b], [c, d]] = layerMatrix(C.complex(1.7, 0.3), 0.41);
  closeC(C.sub(C.mul(a, d), C.mul(b, c)), C.ONE, 1e-13);
});

// Resultados clásicos de las capas finas (sin pérdidas): una lámina de espesor óptico
// λ/2 no refleja nada (las dos caras se cancelan), y una de λ/4 refleja el máximo,
// R = ((1 − n²)/(1 + n²))².
test('lámina continua: media onda no refleja; cuarto de onda refleja el máximo', () => {
  const n = 1.5;
  assert.ok(slabCoefficients(C.complex(n), 0.5 / n).R < 1e-28);
  const quarter = slabCoefficients(C.complex(n), 0.25 / n).R;
  assert.ok(Math.abs(quarter - ((1 - n * n) / (1 + n * n)) ** 2) < 1e-14);
  for (const thickness of [0.1, 0.2, 0.3, 0.45]) assert.ok(slabCoefficients(C.complex(n), thickness / n).R <= quarter + 1e-14);
});

// --- Convergencia al continuo ---------------------------------------------------------------------------

// Principio (el resultado central del módulo): con la densidad de osciladores por unidad
// de volumen fija (χ fija) y las láminas cada vez más juntas, la solución discreta tiende
// a la de una lámina continua de espesor L = N·d con ε = 1 + χ (el ε de Lorentz, SIN
// corrección de campo local), calculada con la matriz de transferencia. La lámina j está
// en el centro de su rebanada, así que el error es de segundo orden: al dividir d por 2,
// el error se divide por 4 (se admite entre 3,5 y 4,5).
test('d → 0 con densidad fija: converge a la lámina continua con ε = 1 + χ, con error ∝ d²', () => {
  const thickness = 1.3;
  for (const [name, chi] of Object.entries(CHI)) {
    const slab = slabCoefficients(indexOf(chi), thickness);
    /** @type {number[]} */
    const errors = [];
    for (const count of [26, 52, 104, 208]) {
      const spacing = thickness / count;
      const solution = solveSheets(sheetStrength(chi, spacing), sheetPositions(count, spacing));
      errors.push(C.abs(C.sub(solution.r, slab.r)) + C.abs(C.sub(solution.t, slab.t)));
    }
    for (let i = 1; i < errors.length; i++) {
      const ratio = errors[i - 1] / errors[i];
      assert.ok(ratio > 3.5 && ratio < 4.5, `${name}: al dividir d por 2 el error pasa de ${errors[i - 1]} a ${errors[i]} (razón ${ratio})`);
    }
    assert.ok(errors[3] < 2e-3, `${name}: error con d = λ₀/160: ${errors[3]}`);
  }
});

// Principio: qué corrección de campo local aparece. El índice exacto de un montón
// periódico de láminas (condición de Bloch, cos qd = cos kd − κ·sen kd) cumple
//   n_ef² = ε + (k·d)²·χ²/12 + O((k·d)⁴)
// (desarrollo en serie hecho a mano; ver la ficha). Se comprueba el coeficiente 1/12 y
// que el límite d → 0 es ε = 1 + χ y NO el de Clausius-Mossotti, ε_CM = 1 + χ/(1 − χ/3),
// que es lo que daría la corrección de Lorentz P/3ε₀ de un sólido de dipolos puntuales.
test('índice de Bloch: n² → ε con corrección (kd)²χ²/12; no hay corrección de Lorentz', () => {
  for (const chi of [CHI.glass, CHI.lossy, CHI.metal]) {
    const epsilon = C.add(C.ONE, chi);
    for (const spacing of [0.02, 0.01, 0.005]) {
      const n = blochIndex(sheetStrength(chi, spacing), spacing);
      const kd = TWO_PI * spacing;
      const excess = C.sub(C.mul(n, n), epsilon);
      const predicted = C.scale(C.mul(chi, chi), (kd * kd) / 12);
      // El siguiente término es O((kd)⁴): relativo a `predicted`, del orden de (kd)²·|ε|.
      closeC(excess, predicted, C.abs(predicted) * kd * kd * 2 * (1 + C.abs(epsilon)), `d = ${spacing}:`);
    }
    const fine = blochIndex(sheetStrength(chi, 1e-3), 1e-3);
    const clausiusMossotti = C.add(C.ONE, C.div(chi, C.sub(C.ONE, C.scale(chi, 1 / 3))));
    const toLorentz = C.abs(C.sub(C.mul(fine, fine), epsilon));
    const toClausius = C.abs(C.sub(C.mul(fine, fine), clausiusMossotti));
    assert.ok(toLorentz < 1e-3 * toClausius, `distancia a ε = 1 + χ: ${toLorentz}; a Clausius-Mossotti: ${toClausius}`);
  }
});

// --- La onda dentro del material ---------------------------------------------------------------------------

// Principio (lo que pide el encargo): la longitud de onda dentro, ajustada a partir del
// campo total, vale λ₀/n. Se toma el vidrio del módulo en el verde (ħω = 2,25 eV, χ del
// modelo de Lorentz), una lámina de 3 λ₀ de espesor, y se ajusta el índice con el campo
// total en las láminas. Tres comprobaciones:
//   (1) el ajuste coincide con el índice de Bloch (exacto para láminas discretas) a 10⁻⁹;
//   (2) se desvía de n = √ε justo lo que predice la corrección de discretización,
//       Δn = (k·d)²·χ²/(24·n), que con d = λ₀/50 es ~6·10⁻⁴;
//   (3) por tanto λ_dentro = λ₀/n con un error menor del 0,1 %.
test('la longitud de onda dentro del material es λ₀/n (vidrio en el verde)', async () => {
  const silica = /** @type {any} */ (await loadMaterial('SiO2'));
  const glass = sellmeierToLorentz(silica.formula_original.coeficientes, GLASS_RELATIVE_DAMPING);
  const epsilon = modelEpsilon(glass, 2.25);
  const chi = C.sub(epsilon, C.ONE);
  const n = indexOf(chi);
  assert.ok(Math.abs(n.re - 1.46) < 0.005, `n del vidrio en 2,25 eV: ${n.re}`);

  const spacing = 0.02;
  const kappa = sheetStrength(chi, spacing);
  const solution = solveSheets(kappa, sheetPositions(150, spacing));
  const fitted = fitIndex(solution.fields, spacing);
  closeC(fitted, blochIndex(kappa, spacing), 1e-9, '(1) ajuste frente a Bloch:');
  const kd = TWO_PI * spacing;
  const predicted = C.div(C.scale(C.mul(chi, chi), (kd * kd) / 24), n);
  closeC(C.sub(fitted, n), predicted, 0.05 * C.abs(predicted), '(2) corrección de discretización:');
  const insideWavelength = 1 / fitted.re; // en unidades de λ₀
  assert.ok(Math.abs(insideWavelength * n.re - 1) < 1e-3, `(3) λ_dentro·n/λ₀ = ${insideWavelength * n.re}`);
});

// Mismo principio medido de otra manera, sin el ajuste: en un material absorbente y grueso
// no vuelve onda desde el fondo, y cerca de la entrada el campo pasa de una lámina a la
// siguiente multiplicado por e^{iqd}. La fase que avanza por lámina da Re n (velocidad de
// fase c/n) y lo que mengua da Im n. Debe coincidir con √ε salvo la corrección O((kd)²).
test('material absorbente: fase y atenuación por lámina dan n + ik', () => {
  const chi = CHI.lossy;
  const n = indexOf(chi);
  const spacing = 0.01;
  const solution = solveSheetsMarching(sheetStrength(chi, spacing), sheetPositions(1500, spacing));
  for (const j of [5, 40, 200]) {
    const ratio = C.div(solution.fields[j + 1], solution.fields[j]);
    const q = C.scale(C.complex(C.arg(ratio), -Math.log(C.abs(ratio))), 1 / (TWO_PI * spacing));
    closeC(q, n, 2e-3, `lámina ${j}:`);
    closeC(q, blochIndex(sheetStrength(chi, spacing), spacing), 1e-9);
  }
});

// --- Lámina gruesa y absorbente: Fresnel --------------------------------------------------------------------------

// Principio: si la onda se extingue antes de llegar al fondo, solo cuenta la primera
// superficie, y R debe tender al valor de Fresnel |(n − 1)/(n + 1)|² con n = √ε. Espesor
// de 12 λ₀ con k = 0,165: la onda que vuelve del fondo llega atenuada e^{−4π·k·12} ~ 10⁻¹¹.
// La convergencia en d es de segundo orden (razón 4 al dividir d por 2), y el error que
// queda es del tamaño de la corrección de discretización de ε, (k·d)²·|χ|²/12.
test('lámina gruesa y absorbente: R tiende a |(n − 1)/(n + 1)|²', () => {
  for (const chi of [CHI.lossy, C.complex(2.5, 1.2), CHI.metal]) {
    const { n, k } = epsilonToNk(C.add(C.ONE, chi));
    const fresnel = normalReflectance(n, k);
    /** @type {number[]} */
    const errors = [];
    for (const spacing of [0.04, 0.02, 0.01, 0.005]) {
      const solution = solveSheetsMarching(sheetStrength(chi, spacing), sheetPositions(Math.round(12 / spacing), spacing));
      assert.ok(solution.T < 1e-9, 'no se transmite nada');
      errors.push(Math.abs(solution.R - fresnel));
    }
    for (let i = 1; i < errors.length; i++) {
      const ratio = errors[i - 1] / errors[i];
      assert.ok(ratio > 3.5 && ratio < 4.5, `χ = ${chi.re} + ${chi.im}i: razón de errores ${ratio} (${errors})`);
    }
    // Tamaño del error: el de la corrección de discretización de ε, (k·d)²·|χ|²/12.
    const scale = ((TWO_PI * 0.005) ** 2 * C.abs2(chi)) / 12;
    assert.ok(errors[3] < scale, `R − R_Fresnel = ${errors[3]} con d = λ₀/200 (escala ${scale})`);
  }
  // Con el solucionador N × N (el del encargo) y un montón más corto se ve lo mismo.
  const chi = C.complex(2.5, 1.2);
  const { n, k } = epsilonToNk(C.add(C.ONE, chi));
  const dense = solveSheets(sheetStrength(chi, 0.01), sheetPositions(300, 0.01));
  const denseScale = ((TWO_PI * 0.01) ** 2 * C.abs2(chi)) / 12;
  assert.ok(Math.abs(dense.R - normalReflectance(n, k)) < denseScale, `R = ${dense.R}, Fresnel = ${normalReflectance(n, k)}`);
  // Y difiere del montón de 12 λ₀ solo en lo que vuelve del fondo de uno de 3 λ₀, que llega
  // a la entrada atenuado e^{−4π·k·L} (ida y vuelta en amplitud).
  const deep = solveSheetsMarching(sheetStrength(chi, 0.01), sheetPositions(1200, 0.01));
  assert.ok(Math.abs(dense.R - deep.R) < 4 * Math.exp(-4 * Math.PI * k * 3), `R(3 λ₀) − R(12 λ₀) = ${dense.R - deep.R}`);
});

// --- Teorema de extinción y construcción de las ondas -----------------------------------------------------------------

// Principio (Ewald-Oseen): dentro del material la onda incidente sigue ahí, viajando a c;
// lo que la «apaga» es la suma de las ondas radiadas, que contiene una copia de la
// incidente con el signo cambiado. En un material absorbente y grueso, al fondo no queda
// campo: la suma de las radiadas debe valer exactamente −(onda incidente), punto a punto.
test('teorema de extinción: las ondas radiadas cancelan a la incidente', () => {
  const spacing = 0.02;
  const solution = solveSheetsMarching(sheetStrength(CHI.lossy, spacing), sheetPositions(700, spacing));
  const zs = [12.3, 12.71, 13.5, 13.95]; // muy adentro (14 λ₀ de espesor)
  const profile = fieldProfile(solution, zs);
  zs.forEach((_, i) => {
    assert.ok(Math.hypot(profile.incident.re[i], profile.incident.im[i]) > 0.999, 'la incidente no se ha atenuado');
    assert.ok(Math.hypot(profile.total.re[i], profile.total.im[i]) < 1e-5, 'el campo total es nulo');
    assert.ok(Math.hypot(profile.radiated.re[i] + profile.incident.re[i], profile.radiated.im[i] + profile.incident.im[i]) < 1e-5);
  });
  // Detrás del material: t = 1 + Σ c_j ≈ 0, es decir, Σ c_j = −1. Lo que queda es la onda
  // atenuada por 14 λ₀ de material, |t| = |t de la lámina continua| ~ e^{−2π·k·L} ≈ 5·10⁻⁷.
  const partial = transmissionPhasors(solution);
  const slab = slabCoefficients(indexOf(CHI.lossy), 14);
  const residual = C.abs(partial[partial.length - 1]);
  assert.ok(residual < 1e-6 && Math.abs(residual / Math.sqrt(slab.T) - 1) < 0.05, `|t| = ${residual}, continuo ${Math.sqrt(slab.T)}`);
  assert.ok(C.abs(C.sub(C.sub(partial[partial.length - 1], partial[0]), C.complex(-1))) < 1e-6, 'Σ c_j = −1');
});

// Principio (Feynman I, cap. 31): en un material diluido y transparente cada lámina añade
// al campo de detrás un fasor pequeño PERPENDICULAR al de la onda incidente (factor i de
// la radiación de una lámina): la suma gira un ángulo (n − 1)·k·L sin cambiar de tamaño.
// Ese giro es el retraso de fase que llamamos índice de refracción. Con χ = 0,01:
// n − 1 = χ/2 y el error de la aproximación es de orden χ².
test('material diluido: cada lámina añade un fasor en cuadratura y la fase gira (n − 1)·k·L', () => {
  const spacing = 0.05;
  const count = 40;
  const kappa = sheetStrength(CHI.dilute, spacing);
  const solution = solveSheets(kappa, sheetPositions(count, spacing));
  const partial = transmissionPhasors(solution);
  assert.equal(partial.length, count + 1);
  closeC(partial[0], C.ONE, 0);
  closeC(partial[count], solution.t, 1e-13);
  // Primera contribución: casi i·κ (imaginaria pura: perpendicular al fasor 1).
  const first = C.sub(partial[1], partial[0]);
  assert.ok(Math.abs(first.re) < 0.05 * Math.abs(first.im), `c₀ = ${first.re} + ${first.im}i`);
  // Giro total: (n − 1)·k·L = (χ/2)·2π·N·d.
  const expected = (CHI.dilute.re / 2) * TWO_PI * count * spacing;
  assert.ok(Math.abs(C.arg(solution.t) - expected) < 2e-2 * expected, `fase de t: ${C.arg(solution.t)}, esperada ${expected}`);
  assert.ok(Math.abs(solution.T - 1) < 1e-3);
  // La reflejada se construye igual, con las radiaciones hacia atrás.
  const back = reflectionPhasors(solution);
  closeC(back[0], C.ZERO, 0);
  closeC(back[count], solution.r, 1e-13);
});

// Principio: fuera del material el campo es lo que dicen r y t: delante, incidente más
// reflejada, e^{ikz} + r·e^{−ikz}; detrás, t·e^{ikz}. Y la onda de cada lámina es simétrica.
test('delante hay incidente + reflejada; detrás, la transmitida', () => {
  const spacing = 0.05;
  const solution = solveSheets(sheetStrength(CHI.lossy, spacing), sheetPositions(30, spacing));
  const zs = [-2.2, -0.61, -0.01, 1.51, 2.4, 7.77];
  const profile = fieldProfile(solution, zs);
  zs.forEach((z, i) => {
    const total = C.complex(profile.total.re[i], profile.total.im[i]);
    const expected = z < 0 ? C.add(phase(z), C.mul(solution.r, phase(-z))) : C.mul(solution.t, phase(z));
    closeC(total, expected, 1e-12, `z = ${z}:`);
  });
  const wave = sheetWave(solution, 4, [solution.positions[4] - 0.3, solution.positions[4] + 0.3]);
  assert.ok(Math.abs(wave.re[0] - wave.re[1]) < 1e-14 && Math.abs(wave.im[0] - wave.im[1]) < 1e-14);
  assert.throws(() => fitIndex(solution.fields.slice(0, 2), spacing), RangeError);
});
