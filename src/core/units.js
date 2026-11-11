// @ts-check
// Constantes físicas (CODATA 2018, unidades SI) y conversiones habituales.
//
// REGLA DEL PROYECTO: las constantes físicas se importan SIEMPRE de este archivo.
// Ningún otro archivo debe escribir a mano un valor como 6.626e-34.
//
// Fuente: CODATA 2018 (NIST). Los valores se comprueban en tests/units.test.js contra
// tests/fixtures/codata2018.json, generado con tools/codata.py a partir de SciPy.
// Desde la redefinición del SI de 2019, h, c, e y k_B son exactas por definición.

/** Constante de Planck, h (J·s). Exacta. */
export const H = 6.62607015e-34;

/** Constante de Planck reducida, ħ = h/2π (J·s). */
export const HBAR = H / (2 * Math.PI);

/** Velocidad de la luz en el vacío, c (m/s). Exacta. */
export const C = 299792458;

/** Carga elemental, e (C). Exacta. */
export const E_CHARGE = 1.602176634e-19;

/** Masa del electrón, mₑ (kg). */
export const M_E = 9.1093837015e-31;

/** Permitividad eléctrica del vacío, ε₀ (F/m). */
export const EPSILON_0 = 8.8541878128e-12;

/** Constante de Boltzmann, k_B (J/K). Exacta. */
export const K_B = 1.380649e-23;

/** Un electronvoltio en julios (J/eV). Numéricamente igual a la carga elemental. */
export const EV = E_CHARGE;

/** Un nanómetro en metros. */
export const NM = 1e-9;

/** Un ångström en metros. */
export const ANGSTROM = 1e-10;

/** Producto hc en eV·nm (≈ 1239,84). Energía de un fotón: E[eV] = HC_EV_NM / λ[nm]. */
export const HC_EV_NM = (H * C) / (EV * NM);

// --- Energía -----------------------------------------------------------------------

/** @param {number} eV energía en electronvoltios @returns {number} energía en julios */
export function eVToJoule(eV) {
  return eV * EV;
}

/** @param {number} joule energía en julios @returns {number} energía en electronvoltios */
export function jouleToEV(joule) {
  return joule / EV;
}

// --- Fotones: longitud de onda, energía y frecuencia ---------------------------------
// Todas valen para luz en el vacío: E = hc/λ = ħω, ω = 2πc/λ.

/** @param {number} nm longitud de onda en el vacío (nm) @returns {number} energía del fotón (eV) */
export function wavelengthNmToEV(nm) {
  return HC_EV_NM / nm;
}

/** @param {number} eV energía del fotón (eV) @returns {number} longitud de onda en el vacío (nm) */
export function eVToWavelengthNm(eV) {
  return HC_EV_NM / eV;
}

/** @param {number} nm longitud de onda en el vacío (nm) @returns {number} frecuencia angular ω (rad/s) */
export function wavelengthNmToAngularFrequency(nm) {
  return (2 * Math.PI * C) / (nm * NM);
}

/** @param {number} omega frecuencia angular ω (rad/s) @returns {number} longitud de onda en el vacío (nm) */
export function angularFrequencyToWavelengthNm(omega) {
  return (2 * Math.PI * C) / omega / NM;
}

/** @param {number} omega frecuencia angular ω (rad/s) @returns {number} energía ħω (eV) */
export function angularFrequencyToEV(omega) {
  return (HBAR * omega) / EV;
}

/** @param {number} eV energía (eV) @returns {number} frecuencia angular ω = E/ħ (rad/s) */
export function eVToAngularFrequency(eV) {
  return (eV * EV) / HBAR;
}

// --- Longitudes ------------------------------------------------------------------------

/** @param {number} angstrom longitud en ångström @returns {number} longitud en nanómetros */
export function angstromToNm(angstrom) {
  return angstrom / 10;
}

/** @param {number} nm longitud en nanómetros @returns {number} longitud en ångström */
export function nmToAngstrom(nm) {
  return nm * 10;
}
