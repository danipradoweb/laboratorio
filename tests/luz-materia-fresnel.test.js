// @ts-check
// Tests de la parte C del módulo «luz y materia» (src/modules/luz-materia/physics-fresnel.js):
// coeficientes de Fresnel con índice complejo, Brewster, ángulo crítico, onda evanescente,
// ley de Malus y gafas polarizadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brewsterAngle,
  brewsterGeometry,
  criticalAngle,
  fresnel,
  glareThroughGlasses,
  malus,
  minimumRp,
  penetrationDepth,
  planeWaves,
  polarizerChain,
  refractionAngle,
  transverseField,
  unpolarizedReflection,
} from '../src/modules/luz-materia/physics-fresnel.js';
import { normalReflectance } from '../src/modules/luz-materia/physics.js';
import { createOpticalConstants } from '../src/materials/dielectric.js';
import { loadMaterial } from '../src/materials/library.js';
import * as C from '../src/core/complex.js';

const DEG = Math.PI / 180;

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} tol tolerancia absoluta
 * @param {string} [msg]
 */
function near(actual, expected, tol, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} obtenido ${actual}, esperado ${expected}`);
}

/**
 * @param {C.Complex} actual
 * @param {C.Complex} expected
 * @param {number} tol
 * @param {string} [msg]
 */
function nearC(actual, expected, tol, msg = '') {
  assert.ok(C.abs(C.sub(actual, expected)) <= tol, `${msg} obtenido ${actual.re} + ${actual.im}i, esperado ${expected.re} + ${expected.im}i`);
}

/** Producto vectorial de dos vectores complejos. @param {C.Complex[]} a @param {C.Complex[]} b */
const cross = (a, b) => [
  C.sub(C.mul(a[1], b[2]), C.mul(a[2], b[1])),
  C.sub(C.mul(a[2], b[0]), C.mul(a[0], b[2])),
  C.sub(C.mul(a[0], b[1]), C.mul(a[1], b[0])),
];
/** Producto escalar sin conjugar. @param {C.Complex[]} a @param {C.Complex[]} b */
const dot = (a, b) => C.add(C.add(C.mul(a[0], b[0]), C.mul(a[1], b[1])), C.mul(a[2], b[2]));

/** Segundos medios de prueba: vidrio, agua, diamante, un absorbente y un metal. */
const MEDIA = [C.complex(1.5), C.complex(1.33), C.complex(2.42), C.complex(1.8, 0.6), C.complex(0.2, 3.4)];
const ANGLES = [0, 12, 30, 45, 56.31, 70, 85, 89.9];

// --- Las ecuaciones de Maxwell en la superficie ---------------------------------------------

// Principio: los coeficientes de Fresnel son la solución de las condiciones de contorno
// de Maxwell en z = 0. Se comprueban DIRECTAMENTE con los vectores de las tres ondas, sin
// usar las fórmulas de r y t: con Z₀·H = k × E (ley de Faraday para una onda plana) y
// D = n²·E, deben ser continuas las componentes tangenciales de E y de H y las normales de
// D y de B = μ₀H. Además cada onda debe ser transversal (k·E = 0) y cumplir k·k = n² (en
// unidades de k₀). Vale para medios transparentes, absorbentes y en reflexión total.
test('Fresnel: E y H tangenciales, D y B normales son continuos en la superficie', () => {
  /** @type {[number, C.Complex][]} */
  const cases = MEDIA.map((n2) => [1, n2]);
  cases.push([1.5, C.complex(1)], [1.33, C.complex(1)], [2.42, C.complex(1.33)], [1.5, C.complex(1.2, 0.3)]);
  for (const [n1, n2] of cases) {
    for (const theta of ANGLES) {
      const result = fresnel(n1, n2, theta);
      for (const polarization of /** @type {const} */ (['s', 'p'])) {
        const { incident, reflected, transmitted } = planeWaves(result, polarization);
        const label = `n₁ = ${n1}, n₂ = ${n2.re} + ${n2.im}i, θ = ${theta}°, ${polarization}:`;
        const eps1 = C.complex(n1 * n1);
        const eps2 = C.mul(n2, n2);
        // Ondas bien formadas.
        for (const [wave, eps] of /** @type {const} */ ([[incident, eps1], [reflected, eps1], [transmitted, eps2]])) {
          nearC(dot(wave.k, wave.k), eps, 1e-12, `${label} k·k = n²:`);
          nearC(dot(wave.k, wave.E), C.ZERO, 1e-12, `${label} k·E = 0:`);
        }
        const hI = cross(incident.k, incident.E);
        const hR = cross(reflected.k, reflected.E);
        const hT = cross(transmitted.k, transmitted.E);
        for (const axis of [0, 1]) {
          nearC(C.add(incident.E[axis], reflected.E[axis]), transmitted.E[axis], 1e-12, `${label} E tangencial (${axis}):`);
          nearC(C.add(hI[axis], hR[axis]), hT[axis], 1e-12, `${label} H tangencial (${axis}):`);
        }
        nearC(C.mul(eps1, C.add(incident.E[2], reflected.E[2])), C.mul(eps2, transmitted.E[2]), 1e-12, `${label} D normal:`);
        nearC(C.add(hI[2], hR[2]), hT[2], 1e-12, `${label} B normal:`);
      }
    }
  }
});

// --- Casos con valor conocido ------------------------------------------------------------------

// Principio (encargo): en incidencia normal no hay plano de incidencia que distinga s de
// p: R_s = R_p = ((n₁ − n₂)/(n₁ + n₂))². Valores exactos: aire-vidrio 4 %, aire-agua
// (n = 4/3) 1/49. Con el convenio de Born & Wolf, r_p = −r_s en θ = 0. Para un medio
// absorbente debe coincidir con la reflectancia normal de la parte A.
test('incidencia normal: R_s = R_p = ((n₁ − n₂)/(n₁ + n₂))²', () => {
  for (const [n1, n2] of [[1, 1.5], [1.5, 1], [1, 4 / 3], [1.33, 2.42]]) {
    const result = fresnel(n1, n2, 0);
    const expected = ((n1 - n2) / (n1 + n2)) ** 2;
    near(result.Rs, expected, 1e-15);
    near(result.Rp, expected, 1e-15);
    nearC(result.rs, C.complex((n1 - n2) / (n1 + n2)), 1e-15);
    nearC(result.rp, C.neg(result.rs), 1e-15);
  }
  near(fresnel(1, 1.5, 0).Rs, 0.04, 1e-15);
  near(fresnel(1, 4 / 3, 0).Rs, 1 / 49, 1e-15);
  for (const n2 of [C.complex(1.8, 0.6), C.complex(0.2, 3.4)]) {
    near(fresnel(1, n2, 0).Rs, normalReflectance(n2.re, n2.im), 1e-14);
  }
  // Sin superficie (n₁ = n₂) no hay reflexión a ningún ángulo. Tolerancia: cerca de la
  // incidencia rasante k_z2 = √(n₂² − k_x²) resta dos números casi iguales y r queda con un
  // redondeo de ~10⁻¹¹ (R ~ 10⁻²²).
  for (const theta of ANGLES) {
    const none = fresnel(1.4, 1.4, theta);
    near(none.Rs + none.Rp, 0, 1e-20);
    nearC(none.ts, C.ONE, 1e-10);
  }
});

// Principio (encargo): en el ángulo de Brewster, tan θ_B = n₂/n₁, la polarización p no se
// refleja: R_p = 0. Valores conocidos: aire-vidrio (1,5) 56,31°; aire-agua (1,33) 53,06°.
// En θ_B el rayo refractado y el reflejado forman 90°, y la s sí se refleja.
test('Brewster: R_p(θ_B) = 0 con θ_B = arctan(n₂/n₁)', () => {
  near(brewsterAngle(1, 1.5), 56.3099, 1e-4);
  near(brewsterAngle(1, 1.33), 53.0612, 1e-4);
  for (const [n1, n2] of [[1, 1.5], [1, 1.33], [1.5, 1], [1.33, 2.42], [1, 3.9]]) {
    const thetaB = brewsterAngle(n1, n2);
    const result = fresnel(n1, n2, thetaB);
    assert.ok(result.Rp < 1e-28, `R_p(θ_B) = ${result.Rp} con n₁ = ${n1}, n₂ = ${n2}`);
    assert.ok(result.Rs > 0.01, 'la polarización s sí se refleja');
    near(thetaB + refractionAngle(result), 90, 1e-10, 'θ_B + θ_t:');
    // Es el único cero: a un lado y a otro R_p > 0, y r_p cambia de signo.
    const below = fresnel(n1, n2, thetaB - 3);
    const above = fresnel(n1, n2, thetaB + 3);
    assert.ok(below.Rp > 1e-5 && above.Rp > 1e-5);
    assert.ok(below.rp.re * above.rp.re < 0, 'r_p cambia de signo en θ_B');
    // El mínimo numérico de R_p cae en el mismo ángulo.
    near(minimumRp(n1, n2).angle, thetaB, 1e-5);
  }
});

// Principio: la imagen de dipolos de Brewster, en números. r_p/r_s = −cos(θ + θ_t)/cos(θ − θ_t)
// (se deduce de las fórmulas de Fresnel en su forma con senos y tangentes), y cos(θ + θ_t)
// es, salvo signo, el seno del ángulo ψ entre el rayo reflejado y el eje de los dipolos p.
// En θ_B, ψ = 0: el reflejado cae sobre el eje y los dipolos no radian hacia allí.
test('Brewster con dipolos: r_p/r_s = −cos(θ + θ_t)/cos(θ − θ_t) y ψ = 0 en θ_B', () => {
  for (const [n1, n2] of [[1, 1.5], [1, 1.33], [1.5, 1]]) {
    for (const theta of [5, 20, 33, 39]) {
      const result = fresnel(n1, n2, theta);
      const geometry = brewsterGeometry(n1, n2, theta);
      near(geometry.refraction, refractionAngle(result), 1e-10);
      // Ley de Snell.
      near(n1 * Math.sin(theta * DEG), n2 * Math.sin(geometry.refraction * DEG), 1e-14);
      const ratio = result.rp.re / result.rs.re;
      const expected = -Math.cos((theta + geometry.refraction) * DEG) / Math.cos((theta - geometry.refraction) * DEG);
      near(ratio, expected, 1e-12, `n₁ = ${n1}, n₂ = ${n2}, θ = ${theta}°:`);
      near(Math.sqrt(geometry.pattern), Math.abs(Math.cos((theta + geometry.refraction) * DEG)), 1e-12);
    }
    const atBrewster = brewsterGeometry(n1, n2, brewsterAngle(n1, n2));
    near(atBrewster.axisToReflected, 0, 1e-10);
    near(atBrewster.pattern, 0, 1e-20);
  }
  assert.throws(() => brewsterGeometry(1.5, 1, 60), RangeError);
});

// --- Conservación de la energía --------------------------------------------------------------------------

// Principio (encargo): sin pérdidas, R + T = 1 con T = (n₂ cos θ_t)/(n₁ cos θ)·|t|² (el
// factor de índice y de cosenos es imprescindible: |r|² + |t|² NO vale 1). Se comprueba
// con la fórmula de T escrita aquí, para las dos polarizaciones y los dos sentidos.
test('sin pérdidas: R + T = 1 con el factor (n₂ cos θ_t)/(n₁ cos θ)', () => {
  for (const [n1, n2] of [[1, 1.5], [1, 1.33], [1.5, 1], [2.42, 1.33]]) {
    const limit = criticalAngle(n1, n2) ?? 90;
    for (const theta of [0, 10, 25, 38, 55, 75, 88].filter((a) => a < limit)) {
      const result = fresnel(n1, n2, theta);
      const thetaT = Math.asin((n1 * Math.sin(theta * DEG)) / n2);
      const factor = (n2 * Math.cos(thetaT)) / (n1 * Math.cos(theta * DEG));
      near(result.Rs + factor * C.abs2(result.ts), 1, 1e-13, `s, n₁ = ${n1}, n₂ = ${n2}, θ = ${theta}°:`);
      near(result.Rp + factor * C.abs2(result.tp), 1, 1e-13, `p, n₁ = ${n1}, n₂ = ${n2}, θ = ${theta}°:`);
      near(result.Ts, factor * C.abs2(result.ts), 1e-13);
      near(result.Tp, factor * C.abs2(result.tp), 1e-13);
      if (theta > 0) assert.ok(Math.abs(C.abs2(result.rs) + C.abs2(result.ts) - 1) > 1e-3, '|r|² + |t|² no es 1');
    }
  }
});

// Principio: con un segundo medio absorbente, la potencia que cruza la superficie (flujo
// de Poynting normal) es todo lo que no se refleja: R + T = 1 también. Se calcula el flujo
// con los vectores, S_z = ½·Re(E × H*)_z, de forma independiente de las fórmulas de T.
test('medio absorbente: lo que no se refleja cruza la superficie (flujo de Poynting)', () => {
  for (const n2 of [C.complex(1.8, 0.6), C.complex(0.2, 3.4), C.complex(1.46, 0.002), C.complex(3.9, 0.02)]) {
    for (const theta of [0, 20, 45, 70, 85]) {
      const result = fresnel(1, n2, theta);
      for (const polarization of /** @type {const} */ (['s', 'p'])) {
        const { incident, transmitted } = planeWaves(result, polarization);
        /** Flujo normal de una onda en z = 0. @param {import('../src/modules/luz-materia/physics-fresnel.js').PlaneWave} wave */
        const flux = (wave) => {
          const h = cross(wave.k, wave.E).map(C.conj);
          return C.sub(C.mul(wave.E[0], h[1]), C.mul(wave.E[1], h[0])).re; // (E × H*)_z
        };
        const transmittedFraction = flux(transmitted) / flux(incident);
        const R = polarization === 's' ? result.Rs : result.Rp;
        const T = polarization === 's' ? result.Ts : result.Tp;
        near(T, transmittedFraction, 1e-12, `T (${polarization}) con n₂ = ${n2.re} + ${n2.im}i, θ = ${theta}°:`);
        near(R + T, 1, 1e-12, `R + T (${polarization}) con n₂ = ${n2.re} + ${n2.im}i, θ = ${theta}°:`);
        assert.ok(T >= 0 && R <= 1);
      }
    }
  }
});

// --- Reflexión total interna ----------------------------------------------------------------------------------

// Principio (encargo): ángulo crítico, sen θ_c = n₂/n₁. Valores conocidos: vidrio (1,5) →
// aire 41,81°; agua (1,33) → aire 48,75°; diamante (2,42) → aire 24,41°. Justo por debajo
// se transmite algo; por encima R = 1 exactamente para las dos polarizaciones, no cruza
// energía (T = 0) y la onda del otro lado es evanescente, con profundidad de penetración
// λ₀/(2π·√(n₁² sen² θ − n₂²)).
test('ángulo crítico y reflexión total interna', () => {
  near(/** @type {number} */ (criticalAngle(1.5, 1)), 41.8103, 1e-4);
  near(/** @type {number} */ (criticalAngle(1.33, 1)), 48.7535, 1e-4);
  near(/** @type {number} */ (criticalAngle(2.42, 1)), 24.4075, 1e-4);
  assert.equal(criticalAngle(1, 1.5), null);
  for (const [n1, n2] of [[1.5, 1], [1.33, 1], [2.42, 1.33]]) {
    const thetaC = /** @type {number} */ (criticalAngle(n1, n2));
    const below = fresnel(n1, n2, thetaC - 0.5);
    assert.ok(!below.total && below.Ts > 0.01 && below.Rs < 1);
    assert.equal(penetrationDepth(below), Infinity);
    for (const theta of [thetaC + 0.01, thetaC + 5, 70, 89]) {
      const result = fresnel(n1, n2, theta);
      assert.ok(result.total);
      near(result.Rs, 1, 1e-14, `R_s en θ = ${theta}°:`);
      near(result.Rp, 1, 1e-14, `R_p en θ = ${theta}°:`);
      near(result.Ts, 0, 1e-14);
      near(result.Tp, 0, 1e-14);
      assert.equal(result.kz2.re, 0);
      near(refractionAngle(result), 90, 1e-12);
      near(penetrationDepth(result), 1 / (2 * Math.PI * Math.sqrt((n1 * Math.sin(theta * DEG)) ** 2 - n2 * n2)), 1e-12);
      // El campo evanescente no es nulo en la superficie: vale 1 + r_s = t_s (y tiende a
      // cero solo en incidencia rasante). Decae con la profundidad exactamente como e^{−z/δ}.
      const depth = penetrationDepth(result);
      const surface = C.abs(transverseField(result, 's', 0.3, 0));
      near(surface, C.abs(result.ts), 1e-12);
      assert.ok(surface > 0);
      near(C.abs(transverseField(result, 's', 0.3, depth)) / surface, Math.exp(-1), 1e-12);
      near(C.abs(transverseField(result, 's', 0.3, 3 * depth)) / surface, Math.exp(-3), 1e-12);
    }
  }
});

// Principio: en reflexión total |r| = 1 pero la fase cambia con el ángulo, distinta para s
// y p (es lo que aprovecha el rombo de Fresnel). Fórmula clásica del desfase relativo
// (Born & Wolf §1.5.4): tan(Δ/2) = cos θ·√(sen² θ − n²)/sen² θ, con n = n₂/n₁ y
// Δ = |arg r_s − arg r_p|. La fórmula está escrita con el convenio de signos de Born &
// Wolf para r_p, que es el de este módulo: sirve además para comprobar el convenio (con el
// de Griffiths saldría π − Δ).
test('reflexión total: desfase entre s y p', () => {
  const n1 = 1.5;
  for (const theta of [45, 50, 54.6, 70]) {
    const result = fresnel(n1, 1, theta);
    const n = 1 / n1;
    const sin = Math.sin(theta * DEG);
    const expected = 2 * Math.atan((Math.cos(theta * DEG) * Math.sqrt(sin * sin - n * n)) / (sin * sin));
    const delta = C.arg(C.div(result.rs, result.rp)); // arg r_s − arg r_p
    near(Math.abs(delta), expected, 1e-12, `θ = ${theta}°:`);
  }
});

// --- Reversibilidad: relaciones de Stokes ----------------------------------------------------------------

// Principio (encargo): por la reversibilidad temporal de la luz en medios sin pérdidas,
// los coeficientes al cruzar la superficie al revés (desde el medio 2, con el ángulo de
// refracción) cumplen r′ = −r y t·t′ = 1 − r² (relaciones de Stokes), para s y para p.
test('relaciones de Stokes: r′ = −r y t·t′ = 1 − r²', () => {
  for (const [n1, n2] of [[1, 1.5], [1, 1.33], [1.33, 2.42]]) {
    for (const theta of [0, 15, 40, 56.31, 75, 88]) {
      const forward = fresnel(n1, n2, theta);
      const back = fresnel(n2, n1, refractionAngle(forward));
      for (const [r, t, rBack, tBack] of [
        [forward.rs, forward.ts, back.rs, back.ts],
        [forward.rp, forward.tp, back.rp, back.tp],
      ]) {
        nearC(rBack, C.neg(r), 1e-12, `r′ = −r (n₁ = ${n1}, n₂ = ${n2}, θ = ${theta}°):`);
        nearC(C.mul(t, tBack), C.sub(C.ONE, C.mul(r, r)), 1e-12, `t·t′ = 1 − r² (θ = ${theta}°):`);
      }
    }
  }
});

// --- Medios absorbentes ------------------------------------------------------------------------------------------

// Principio: un metal no tiene ángulo de Brewster: R_p baja hasta un mínimo que no es cero
// (pseudo-Brewster) y vuelve a subir. Con las constantes medidas del oro en el rojo
// (650 nm, Johnson y Christy) el mínimo está a incidencia casi rasante y R sigue siendo
// alta. En incidencia rasante todo refleja: R → 1 para cualquier material.
test('medio absorbente: mínimo de R_p sin llegar a cero; a incidencia rasante R → 1', async () => {
  const gold = createOpticalConstants(await loadMaterial('Au'));
  const { n, k } = gold.nk(650);
  const index = C.complex(n, k);
  const minimum = minimumRp(1, index);
  assert.ok(minimum.Rp > 0.5, `oro en 650 nm: mínimo de R_p = ${minimum.Rp}`);
  assert.ok(minimum.angle > 60 && minimum.angle < 89, `ángulo del mínimo: ${minimum.angle}°`);
  assert.ok(minimum.Rp < fresnel(1, index, 0).Rp && minimum.Rp < fresnel(1, index, 89.9).Rp);
  assert.ok(fresnel(1, index, 45).Rs > fresnel(1, index, 45).Rp, 'R_s ≥ R_p');
  for (const n2 of MEDIA) {
    const grazing = fresnel(1, n2, 89.999);
    assert.ok(grazing.Rs > 0.999 && grazing.Rp > 0.99, `rasante con n₂ = ${n2.re} + ${n2.im}i: ${grazing.Rs}, ${grazing.Rp}`);
    // En 90° «exactos» (cos 90° sale 6·10⁻¹⁷ en coma flotante) no entra nada.
    const exact = fresnel(1, n2, 90);
    near(exact.Rs, 1, 1e-12);
    near(exact.Ts, 0, 1e-12);
  }
  // Un absorbente débil (el «vidrio» del modelo) casi tiene Brewster: R_p mínima ~ (k/…)².
  const weak = minimumRp(1, C.complex(1.46, 0.0006));
  near(weak.angle, brewsterAngle(1, 1.46), 1e-3);
  assert.ok(weak.Rp < 1e-7);
});

// --- El mapa de campo -------------------------------------------------------------------------------------------------

// Principio: el campo transversal (E_y en s, H_y en p) es continuo en z = 0 y, en cada
// medio, cumple la ecuación de Helmholtz ∇²F + (2π·n)²F = 0 (posiciones en λ₀). Derivadas
// numéricas centradas con h = 10⁻³: tolerancia 10⁻⁴ relativa.
test('el campo transversal es continuo en la superficie y cumple la ecuación de ondas', () => {
  const h = 1e-3;
  for (const [n1, n2, theta] of /** @type {[number, C.Complex, number][]} */ ([
    [1, C.complex(1.5), 40],
    [1.5, C.complex(1), 60],
    [1, C.complex(1.8, 0.6), 55],
  ])) {
    const result = fresnel(n1, n2, theta);
    for (const polarization of /** @type {const} */ (['s', 'p'])) {
      const f = (/** @type {number} */ x, /** @type {number} */ z) => transverseField(result, polarization, x, z);
      nearC(f(0.37, -1e-12), f(0.37, 0), 1e-10, 'continuidad:');
      for (const [x, z, eps] of /** @type {[number, number, C.Complex][]} */ ([
        [0.2, -0.7, C.complex(n1 * n1)],
        [1.1, 0.4, C.mul(n2, n2)],
      ])) {
        const laplacian = C.scale(
          C.sub(C.add(C.add(f(x + h, z), f(x - h, z)), C.add(f(x, z + h), f(x, z - h))), C.scale(f(x, z), 4)),
          1 / (h * h),
        );
        const expected = C.scale(C.mul(eps, f(x, z)), -((2 * Math.PI) ** 2));
        nearC(laplacian, expected, 1e-4 * C.abs(expected) + 1e-6, `Helmholtz (${polarization}) en z = ${z}:`);
      }
    }
  }
});

// --- Polarizadores ----------------------------------------------------------------------------------------------------

// Principio (encargo): ley de Malus, I = I₀·cos² θ. Valores exactos: 0° → todo; 45° → la
// mitad; 60° → un cuarto; 90° → nada.
test('ley de Malus', () => {
  near(malus(1, 0), 1, 1e-15);
  near(malus(1, 45), 0.5, 1e-15);
  near(malus(2, 60), 0.5, 1e-15);
  near(malus(1, 90), 0, 1e-30);
  // La cadena de polarizadores la reproduce: luz polarizada a 0° y analizador a θ.
  for (const theta of [0, 17, 45, 60, 90, 133]) {
    near(polarizerChain([theta], { input: 0 })[0], malus(1, theta), 1e-15);
    // Y con luz no polarizada: el primero deja la mitad; el segundo aplica Malus.
    const [first, second] = polarizerChain([20, 20 + theta]);
    near(first, 0.5, 1e-15);
    near(second, 0.5 * malus(1, theta), 1e-15);
  }
});

// Principio: polarizadores cruzados no dejan pasar nada; un tercero ENTRE los dos, a un
// ángulo θ del primero, deja pasar I = (I₀/2)·cos² θ·sen² θ = (I₀/8)·sen² 2θ: máximo I₀/8 a
// 45° (la «paradoja» de los tres polarizadores). Puesto delante o detrás de los dos
// cruzados no cambia nada. Con muchos polarizadores girando poco a poco, casi no se pierde luz.
test('polarizadores cruzados y paradoja de los tres polarizadores', () => {
  near(polarizerChain([0, 90])[1], 0, 1e-30);
  near(polarizerChain([35, 125])[1], 0, 1e-30);
  for (const theta of [0, 10, 30, 45, 60, 90]) {
    near(polarizerChain([0, theta, 90])[2], Math.sin(2 * theta * DEG) ** 2 / 8, 1e-15, `intermedio a ${theta}°:`);
  }
  near(polarizerChain([0, 45, 90])[2], 1 / 8, 1e-15);
  // El orden importa: el tercero detrás de los dos cruzados no deja pasar nada.
  near(polarizerChain([0, 90, 45])[2], 0, 1e-30);
  near(polarizerChain([45, 0, 90])[2], 0, 1e-30);
  // N pasos de 90°/N: I = ½·cos^{2N}(90°/N) → ½ cuando N crece.
  const steps = 90;
  const many = polarizerChain(Array.from({ length: steps + 1 }, (_, i) => (90 * i) / steps));
  near(many[steps], 0.5 * Math.cos(DEG) ** (2 * steps), 1e-12);
  assert.ok(many[steps] > 0.48);
});

// --- Gafas polarizadas ----------------------------------------------------------------------------------------------------

// Principio (encargo): luz no polarizada reflejada en agua. En el ángulo de Brewster
// (53,06° con n = 1,33) el reflejo queda totalmente polarizado s (horizontal): un
// polarizador de eje vertical lo elimina por completo, mientras que unas gafas grises de
// τ = 0,5 solo lo reducen a la mitad. En incidencia normal el reflejo no está polarizado y
// las dos gafas hacen lo mismo. Valores esperados: de las fórmulas de arriba, escritas aquí.
test('reflejo en el agua: grado de polarización y lo que pasa por las gafas', () => {
  const n = 1.33;
  const thetaB = brewsterAngle(1, n);
  const atBrewster = fresnel(1, n, thetaB);
  near(unpolarizedReflection(atBrewster).degree, 1, 1e-12);
  const glare = glareThroughGlasses(atBrewster);
  near(glare.polarized, 0, 1e-20);
  near(glare.passedFraction, 0, 1e-20);
  near(glare.neutral, 0.5 * glare.bare, 1e-15);
  // En Brewster, R_s = sen²(θ_B − θ_t) = cos²(2θ_B) (porque θ_t = 90° − θ_B); el reflejo
  // total es la mitad de eso.
  near(atBrewster.Rs, Math.cos(2 * thetaB * DEG) ** 2, 1e-12);
  near(glare.bare, atBrewster.Rs / 2, 1e-15);

  const normal = fresnel(1, n, 0);
  near(unpolarizedReflection(normal).degree, 0, 1e-14);
  near(unpolarizedReflection(normal).reflectance, ((n - 1) / (n + 1)) ** 2, 1e-15);
  near(glareThroughGlasses(normal).polarized, glareThroughGlasses(normal).neutral, 1e-15);
  near(glareThroughGlasses(normal).passedFraction, 0.5, 1e-14);

  // A cualquier ángulo: 0 ≤ P ≤ 1, el polarizador vertical nunca deja pasar más que las
  // gafas grises, y la cuenta coincide con un polarizador explícito (cadena de Jones con
  // el reflejo descompuesto en s horizontal y p vertical).
  for (const theta of [10, 30, 45, 60, 75, 85]) {
    const result = fresnel(1, n, theta);
    const { degree, reflectance } = unpolarizedReflection(result);
    assert.ok(degree >= 0 && degree <= 1);
    const g = glareThroughGlasses(result);
    assert.ok(g.polarized <= g.neutral + 1e-15);
    near(g.bare, reflectance, 1e-15);
    const vertical = 0.5 * result.Rs * polarizerChain([90], { input: 0 })[0] + 0.5 * result.Rp * polarizerChain([90], { input: 90 })[0];
    near(g.polarized, vertical, 1e-15, `θ = ${theta}°:`);
    near(g.passedFraction, (1 - degree) / 2, 1e-14);
  }
});
