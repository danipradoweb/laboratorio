// @ts-check
// Tests de src/core/units.js: constantes CODATA 2018 y conversiones.
// Referencia independiente: tests/fixtures/codata2018.json (tools/codata.py, SciPy).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as U from '../src/core/units.js';

const codata = JSON.parse(
  readFileSync(new URL('./fixtures/codata2018.json', import.meta.url), 'utf8'),
);

/**
 * Comprueba que dos números coinciden con una tolerancia relativa.
 * @param {number} actual
 * @param {number} expected
 * @param {number} rel
 * @param {string} [msg]
 */
function close(actual, expected, rel, msg = '') {
  const err = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(err <= rel, `${msg} obtenido ${actual}, esperado ${expected} (error relativo ${err})`);
}

// Principio: los valores tecleados en units.js son los de CODATA 2018.
// Valor esperado: tabla CODATA 2018 de NIST (fixture). Tolerancia 1e-15: deben ser el
// mismo número en coma flotante, salvo redondeo en ħ = h/2π.
test('las constantes coinciden con CODATA 2018', () => {
  close(U.H, codata.h.valor, 1e-15, 'h');
  close(U.HBAR, codata.hbar.valor, 1e-15, 'ħ');
  close(U.C, codata.c.valor, 1e-15, 'c');
  close(U.E_CHARGE, codata.e.valor, 1e-15, 'e');
  close(U.M_E, codata.m_e.valor, 1e-15, 'mₑ');
  close(U.EPSILON_0, codata.epsilon_0.valor, 1e-15, 'ε₀');
  close(U.K_B, codata.k_B.valor, 1e-15, 'k_B');
  close(U.EV, codata.eV_in_J.valor, 1e-15, 'eV en J');
});

// Principio: la constante de estructura fina α = e²/(4πε₀ħc) es adimensional y combina
// e, ε₀, ħ y c; si una de ellas estuviera mal tecleada, α no saldría.
// Valor esperado: α de CODATA 2018 (fixture). Tolerancia 1e-9: ε₀ se publica con 11
// cifras significativas (incertidumbre relativa 1,5e-10).
test('comprobación cruzada: constante de estructura fina', () => {
  const alpha = U.E_CHARGE ** 2 / (4 * Math.PI * U.EPSILON_0 * U.HBAR * U.C);
  close(alpha, codata.alpha.valor, 1e-9, 'α');
});

// Principio: energía de Rydberg, Ry = mₑe⁴/(8ε₀²h²) (energía de ionización del hidrógeno
// con núcleo de masa infinita). Comprueba mₑ junto con e, ε₀ y h.
// Valor esperado: "Rydberg constant times hc in eV" de CODATA 2018 (≈ 13,6057 eV).
test('comprobación cruzada: energía de Rydberg', () => {
  const rydbergJ = (U.M_E * U.E_CHARGE ** 4) / (8 * U.EPSILON_0 ** 2 * U.H ** 2);
  close(U.jouleToEV(rydbergJ), codata.rydberg_eV.valor, 1e-9, 'Ry');
});

// Principio: radio de Bohr, a₀ = 4πε₀ħ²/(mₑe²).
// Valor esperado: "Bohr radius" de CODATA 2018 (≈ 0,529 Å).
test('comprobación cruzada: radio de Bohr', () => {
  const a0 = (4 * Math.PI * U.EPSILON_0 * U.HBAR ** 2) / (U.M_E * U.E_CHARGE ** 2);
  close(a0, codata.bohr_radius.valor, 1e-9, 'a₀');
  close(a0 / U.ANGSTROM, 0.529177, 1e-6, 'a₀ en Å');
});

// Principio: E = hc/λ. Valor esperado: hc = 1239,841984… eV·nm, calculado aquí con las
// constantes exactas del fixture (no con units.js).
test('fotones: nm ↔ eV', () => {
  const hc = (codata.h.valor * codata.c.valor) / codata.e.valor / 1e-9;
  close(hc, 1239.841984, 1e-9, 'hc del fixture');
  close(U.HC_EV_NM, hc, 1e-15, 'HC_EV_NM');
  close(U.wavelengthNmToEV(hc), 1, 1e-15, 'fotón de 1 eV');
  close(U.eVToWavelengthNm(1), hc, 1e-15);
  // Láser verde de 532 nm: E = 1239,841984/532 eV.
  close(U.wavelengthNmToEV(532), 1239.841984 / 532, 1e-9);
  for (const nm of [200, 380, 532, 780, 1550]) {
    close(U.eVToWavelengthNm(U.wavelengthNmToEV(nm)), nm, 1e-14, 'ida y vuelta');
  }
});

// Principio: ω = 2πc/λ y E = ħω deben dar la misma energía que E = hc/λ.
test('fotones: frecuencia angular coherente con la energía', () => {
  for (const nm of [300, 532, 1000]) {
    const omega = U.wavelengthNmToAngularFrequency(nm);
    close(U.angularFrequencyToEV(omega), U.wavelengthNmToEV(nm), 1e-14);
    close(U.angularFrequencyToWavelengthNm(omega), nm, 1e-14);
    close(U.eVToAngularFrequency(U.angularFrequencyToEV(omega)), omega, 1e-14);
  }
  // ω de la luz de 500 nm: 2π·299792458/500e-9 rad/s (definición).
  close(U.wavelengthNmToAngularFrequency(500), (2 * Math.PI * 299792458) / 500e-9, 1e-15);
});

// Principio: definiciones 1 eV = e·(1 V) julios, 1 Å = 0,1 nm = 1e-10 m.
test('eV ↔ J y Å ↔ nm', () => {
  close(U.eVToJoule(1), codata.e.valor, 1e-15);
  close(U.jouleToEV(U.eVToJoule(2.5)), 2.5, 1e-15);
  assert.equal(U.angstromToNm(1.54), 0.154);
  close(U.nmToAngstrom(0.154), 1.54, 1e-15);
  assert.equal(U.ANGSTROM, 1e-10);
  assert.equal(U.NM, 1e-9);
});

// Principio: a temperatura ambiente k_B·T ≈ 25 meV (regla práctica de estado sólido).
// Valor esperado: 1,380649e-23 · 300 / 1,602176634e-19 eV = 25,852 meV.
test('k_B·T a 300 K ≈ 25,85 meV', () => {
  close(U.jouleToEV(U.K_B * 300) * 1000, 25.852, 1e-4);
});
