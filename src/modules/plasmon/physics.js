// @ts-check
// Física del módulo «plasmón»: cómo una partícula metálica pequeña extingue, absorbe y
// dispersa la luz.
//
// Tres modelos, de más exacto a más sencillo:
//   1. Teoría de Mie (esfera de cualquier tamaño): mie(), algoritmo BHMIE de Bohren &
//      Huffman, apéndice A.
//   2. Aproximación cuasiestática dipolar (esfera mucho menor que λ):
//      quasiStaticSphere().
//   3. Teoría de Gans (esferoide prolato mucho menor que λ, modelo de un nanobastón,
//      promediado sobre orientaciones): gansSpheroid().
// Y además: el campo cercano de un esferoide en un campo uniforme (spheroidNearField),
// la transmitancia de una cubeta (cuvetteTransmittance) y utilidades de espectros.
//
// CONVENIOS
//   - Dependencia temporal e^{−iωt} (Bohren & Huffman). Absorber es Im m > 0, Im ε > 0.
//   - Longitudes en nanómetros; secciones eficaces en nm²; polarizabilidades en nm³.
//   - λ es siempre la longitud de onda EN EL VACÍO. El medio es transparente, de índice
//     real n_m (ε_m = n_m²); dentro de él la onda tiene número de onda k = 2π·n_m/λ.
//   - m = (n + ik)/n_m es el índice de la partícula relativo al medio.
//   - x = k·a = 2π·n_m·a/λ es el parámetro de tamaño (a = radio).
//   - Q = C/(π·a²): eficiencia = sección eficaz dividida por el área geométrica.
//
// Todo son funciones puras: números de entrada, números de salida.

/**
 * @typedef {import('../../core/complex.js').Complex} Complex
 */

// --- Números complejos (operaciones mínimas, locales) ------------------------------------

/** @param {Complex} a @param {Complex} b @returns {Complex} */
function cmul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

/** @param {Complex} a @param {Complex} b @returns {Complex} */
function cdiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

// --- Geometría y parámetros adimensionales -------------------------------------------------

/**
 * Número de onda en el medio, k = 2π·n_m/λ (nm⁻¹).
 * @param {number} wavelength longitud de onda en el vacío (nm)
 * @param {number} mediumIndex índice de refracción del medio, n_m
 * @returns {number}
 */
export function wavenumber(wavelength, mediumIndex) {
  return (2 * Math.PI * mediumIndex) / wavelength;
}

/**
 * Parámetro de tamaño x = 2π·n_m·a/λ: el radio medido en longitudes de onda (del medio)
 * entre 2π. x ≪ 1: la partícula «ve» un campo uniforme (régimen cuasiestático).
 * @param {number} radius radio a (nm)
 * @param {number} wavelength λ en el vacío (nm)
 * @param {number} mediumIndex n_m
 * @returns {number}
 */
export function sizeParameter(radius, wavelength, mediumIndex) {
  return wavenumber(wavelength, mediumIndex) * radius;
}

/**
 * Índice relativo m = √ε / n_m a partir de la función dieléctrica de la partícula.
 * @param {Complex} epsilon ε de la partícula
 * @param {number} mediumIndex n_m
 * @returns {Complex}
 */
export function relativeIndex(epsilon, mediumIndex) {
  const modulus = Math.hypot(epsilon.re, epsilon.im);
  const n = Math.sqrt(Math.max(0, (modulus + epsilon.re) / 2));
  const k = Math.sqrt(Math.max(0, (modulus - epsilon.re) / 2));
  return { re: n / mediumIndex, im: (epsilon.im < 0 ? -k : k) / mediumIndex };
}

// --- 1. Teoría de Mie (BHMIE) ---------------------------------------------------------------

/**
 * Número de términos de las series de Mie: n_max = x + 4·x^(1/3) + 2 (criterio de
 * Bohren & Huffman, apéndice A, tomado de Wiscombe). Los términos con n > x decaen muy
 * deprisa; los sumandos 4·x^(1/3) + 2 son el margen.
 * @param {number} x parámetro de tamaño
 * @returns {number} entero ≥ 2
 */
export function mieTermCount(x) {
  return Math.floor(x + 4 * Math.cbrt(x) + 2);
}

/**
 * Orden desde el que arranca la recurrencia descendente de D_n(mx) (con D = 0).
 *
 * BHMIE usa máx(n_max, |mx|) + 15. Ese margen fijo NO basta cuando |mx| es grande y la
 * esfera no absorbe: la recurrencia solo «olvida» el valor inicial mientras n > |mx|, y
 * la zona de transición alrededor de n = |mx| tiene una anchura ∝ |mx|^(1/3). Con m = 4
 * y x = 100 el error de Q_ext llega a 6·10⁻⁴, y con |mx| ≈ 600 el de Q_back supera el
 * 50 %. Aquí se añade un margen de 8·|mx|^(1/3), con el que el resultado ya no cambia
 * (comprobado frente a un arranque 3000 órdenes más arriba, para |mx| hasta 1000).
 * @param {number} count número de términos de la serie, n_max
 * @param {number} absMx |m·x|
 * @returns {number}
 */
export function downwardStartOrder(count, absMx) {
  return Math.floor(Math.max(count, absMx) + 8 * Math.cbrt(absMx)) + 15;
}

/**
 * Coeficientes de Mie a_n y b_n de una esfera homogénea (Bohren & Huffman, ec. 4.88):
 *
 *   a_n = [(D_n(mx)/m + n/x)·ψ_n(x) − ψ_{n−1}(x)] / [(D_n(mx)/m + n/x)·ξ_n(x) − ξ_{n−1}(x)]
 *   b_n = [(m·D_n(mx) + n/x)·ψ_n(x) − ψ_{n−1}(x)] / [(m·D_n(mx) + n/x)·ξ_n(x) − ξ_{n−1}(x)]
 *
 * a_n son los multipolos eléctricos (n = 1 dipolo, n = 2 cuadrupolo…) y b_n los
 * magnéticos. ψ_n y ξ_n = ψ_n − iχ_n son las funciones de Riccati-Bessel, que se calculan
 * por recurrencia ascendente. D_n(mx) = ψ_n′(mx)/ψ_n(mx) es la derivada logarítmica, que
 * se calcula por recurrencia DESCENDENTE desde un orden alto (la ascendente es inestable
 * cuando la esfera absorbe):  D_{n−1} = n/(mx) − 1/(D_n + n/(mx)).
 *
 * @param {Complex} m índice relativo (Im m ≥ 0)
 * @param {number} x parámetro de tamaño (> 0)
 * @returns {{ count: number, anRe: Float64Array, anIm: Float64Array, bnRe: Float64Array, bnIm: Float64Array }}
 *   coeficientes de n = 1 a count (el índice 0 de cada tabla no se usa)
 */
export function mieCoefficients(m, x) {
  if (!(x > 0) || !Number.isFinite(x)) throw new RangeError(`mie: el parámetro de tamaño debe ser positivo (x = ${x})`);
  if (!Number.isFinite(m.re) || !Number.isFinite(m.im)) throw new RangeError('mie: índice relativo no numérico');
  const count = mieTermCount(x);
  const mx = { re: m.re * x, im: m.im * x };
  const start = downwardStartOrder(count, Math.hypot(mx.re, mx.im));

  // Derivada logarítmica D_n(mx), n = start … 1, empezando en D_start = 0.
  const dRe = new Float64Array(start + 1);
  const dIm = new Float64Array(start + 1);
  for (let n = start; n >= 1; n--) {
    const nOverMx = cdiv({ re: n, im: 0 }, mx);
    const inverse = cdiv({ re: 1, im: 0 }, { re: dRe[n] + nOverMx.re, im: dIm[n] + nOverMx.im });
    dRe[n - 1] = nOverMx.re - inverse.re;
    dIm[n - 1] = nOverMx.im - inverse.im;
  }

  const anRe = new Float64Array(count + 1);
  const anIm = new Float64Array(count + 1);
  const bnRe = new Float64Array(count + 1);
  const bnIm = new Float64Array(count + 1);
  // Recurrencia ascendente de ψ y χ (ξ = ψ − iχ), con los valores de orden −1 y 0.
  let psiPrev2 = Math.cos(x); // ψ_{−1}
  let psiPrev = Math.sin(x); // ψ_0
  let chiPrev2 = -Math.sin(x); // χ_{−1}
  let chiPrev = Math.cos(x); // χ_0
  for (let n = 1; n <= count; n++) {
    const psi = ((2 * n - 1) / x) * psiPrev - psiPrev2;
    const chi = ((2 * n - 1) / x) * chiPrev - chiPrev2;
    const d = { re: dRe[n], im: dIm[n] };
    const xi = { re: psi, im: -chi };
    const xiPrev = { re: psiPrev, im: -chiPrev };

    const forA = cdiv(d, m);
    forA.re += n / x;
    const aNum = { re: forA.re * psi - psiPrev, im: forA.im * psi };
    const aXi = cmul(forA, xi);
    const a = cdiv(aNum, { re: aXi.re - xiPrev.re, im: aXi.im - xiPrev.im });

    const forB = cmul(m, d);
    forB.re += n / x;
    const bNum = { re: forB.re * psi - psiPrev, im: forB.im * psi };
    const bXi = cmul(forB, xi);
    const b = cdiv(bNum, { re: bXi.re - xiPrev.re, im: bXi.im - xiPrev.im });

    anRe[n] = a.re;
    anIm[n] = a.im;
    bnRe[n] = b.re;
    bnIm[n] = b.im;
    psiPrev2 = psiPrev;
    psiPrev = psi;
    chiPrev2 = chiPrev;
    chiPrev = chi;
  }
  return { count, anRe, anIm, bnRe, bnIm };
}

/**
 * @typedef {object} MieResult
 * @property {number} x parámetro de tamaño
 * @property {number} qext eficiencia de extinción
 * @property {number} qsca eficiencia de dispersión
 * @property {number} qabs eficiencia de absorción, Q_ext − Q_sca
 * @property {number} qback eficiencia de retrodispersión (sección radar / área)
 * @property {number} g parámetro de asimetría ⟨cos θ⟩: 0 simétrico, → 1 todo hacia delante
 * @property {Complex[]} s1 amplitud S₁(θ) en cada ángulo pedido (polarización
 *   perpendicular al plano de dispersión)
 * @property {Complex[]} s2 amplitud S₂(θ) (polarización paralela al plano de dispersión)
 * @property {Complex} a1 coeficiente del dipolo eléctrico (para la polarizabilidad)
 */

/**
 * Teoría de Mie para una esfera homogénea (BHMIE). A partir de los coeficientes:
 *
 *   Q_ext = (2/x²)·Σ (2n+1)·Re(a_n + b_n)
 *   Q_sca = (2/x²)·Σ (2n+1)·(|a_n|² + |b_n|²)
 *   Q_abs = Q_ext − Q_sca                      (la energía que no se dispersa, se disipa)
 *   Q_back = (1/x²)·|Σ (2n+1)·(−1)ⁿ·(a_n − b_n)|²
 *   g·Q_sca = (4/x²)·Σ [ n(n+2)/(n+1)·Re(a_n·a*_{n+1} + b_n·b*_{n+1})
 *                        + (2n+1)/(n(n+1))·Re(a_n·b*_n) ]
 *   S₁(θ) = Σ (2n+1)/(n(n+1))·(a_n·π_n + b_n·τ_n)
 *   S₂(θ) = Σ (2n+1)/(n(n+1))·(a_n·τ_n + b_n·π_n)
 *
 * con π_n(cos θ) y τ_n(cos θ) las funciones angulares (recurrencia de B&H, ec. 4.47).
 * La intensidad dispersada es ∝ |S₁|² (luz polarizada perpendicular al plano de
 * dispersión) y ∝ |S₂|² (paralela). Teorema óptico: Q_ext = (4/x²)·Re S(0°).
 *
 * @param {Complex} m índice relativo de la esfera, (n + ik)/n_m
 * @param {number} x parámetro de tamaño, 2π·n_m·a/λ
 * @param {ArrayLike<number>} [anglesDeg] ángulos de dispersión θ en grados (0 = hacia delante)
 * @returns {MieResult}
 */
export function mie(m, x, anglesDeg = []) {
  const { count, anRe, anIm, bnRe, bnIm } = mieCoefficients(m, x);
  let ext = 0;
  let sca = 0;
  let asym = 0;
  let backRe = 0;
  let backIm = 0;
  for (let n = 1; n <= count; n++) {
    const weight = 2 * n + 1;
    ext += weight * (anRe[n] + bnRe[n]);
    sca += weight * (anRe[n] * anRe[n] + anIm[n] * anIm[n] + bnRe[n] * bnRe[n] + bnIm[n] * bnIm[n]);
    const sign = n % 2 === 0 ? 1 : -1;
    backRe += sign * weight * (anRe[n] - bnRe[n]);
    backIm += sign * weight * (anIm[n] - bnIm[n]);
    asym += (weight / (n * (n + 1))) * (anRe[n] * bnRe[n] + anIm[n] * bnIm[n]);
    if (n < count) {
      asym +=
        ((n * (n + 2)) / (n + 1)) *
        (anRe[n] * anRe[n + 1] + anIm[n] * anIm[n + 1] + bnRe[n] * bnRe[n + 1] + bnIm[n] * bnIm[n + 1]);
    }
  }
  const x2 = x * x;
  const qext = (2 / x2) * ext;
  const qsca = (2 / x2) * sca;

  /** @type {Complex[]} */
  const s1 = [];
  /** @type {Complex[]} */
  const s2 = [];
  for (let j = 0; j < anglesDeg.length; j++) {
    const mu = Math.cos((anglesDeg[j] * Math.PI) / 180);
    let piPrev = 0; // π_0
    let pi = 1; // π_1
    const a = { re: 0, im: 0 };
    const b = { re: 0, im: 0 };
    for (let n = 1; n <= count; n++) {
      const tau = n * mu * pi - (n + 1) * piPrev;
      const factor = (2 * n + 1) / (n * (n + 1));
      a.re += factor * (anRe[n] * pi + bnRe[n] * tau);
      a.im += factor * (anIm[n] * pi + bnIm[n] * tau);
      b.re += factor * (anRe[n] * tau + bnRe[n] * pi);
      b.im += factor * (anIm[n] * tau + bnIm[n] * pi);
      const piNext = ((2 * n + 1) / n) * mu * pi - ((n + 1) / n) * piPrev;
      piPrev = pi;
      pi = piNext;
    }
    s1.push(a);
    s2.push(b);
  }

  return {
    x,
    qext,
    qsca,
    qabs: qext - qsca,
    qback: (backRe * backRe + backIm * backIm) / x2,
    g: sca > 0 ? (2 * asym) / sca : 0,
    s1,
    s2,
    a1: { re: anRe[1], im: anIm[1] },
  };
}

/**
 * @typedef {object} CrossSections
 * @property {number} cext sección eficaz de extinción (nm²): lo que la partícula quita
 *   del haz, C_abs + C_sca
 * @property {number} cabs sección eficaz de absorción (nm²): lo que convierte en calor
 * @property {number} csca sección eficaz de dispersión (nm²): lo que reemite, a la misma
 *   frecuencia, en otras direcciones
 */

/**
 * Esfera con la teoría de Mie, en magnitudes con dimensiones.
 * @param {object} p
 * @param {number} p.radius radio (nm)
 * @param {number} p.wavelength λ en el vacío (nm)
 * @param {Complex} p.epsilon función dieléctrica de la partícula en esa λ
 * @param {number} p.mediumIndex índice del medio, n_m
 * @param {ArrayLike<number>} [p.anglesDeg]
 * @returns {MieResult & CrossSections & { cback: number, alpha: Complex }}
 *   alpha: polarizabilidad dipolar efectiva (nm³), ver dipolarPolarizabilityFromMie
 */
export function mieSphere({ radius, wavelength, epsilon, mediumIndex, anglesDeg }) {
  const x = sizeParameter(radius, wavelength, mediumIndex);
  const result = mie(relativeIndex(epsilon, mediumIndex), x, anglesDeg);
  const area = Math.PI * radius * radius;
  return {
    ...result,
    cext: result.qext * area,
    csca: result.qsca * area,
    cabs: result.qabs * area,
    cback: result.qback * area,
    alpha: dipolarPolarizabilityFromMie(result.a1, wavenumber(wavelength, mediumIndex)),
  };
}

/**
 * Polarizabilidad dipolar efectiva de una esfera a partir del coeficiente a₁ de Mie:
 *
 *   α = (6πi/k³)·a₁
 *
 * Es la polarizabilidad del dipolo puntual que dispersa igual que el término dipolar
 * eléctrico de la esfera. Para x → 0 tiende a la cuasiestática 4πa³(ε − ε_m)/(ε + 2ε_m);
 * para esferas mayores incluye el retardo y la pérdida de energía por radiación.
 * @param {Complex} a1 coeficiente de Mie del dipolo eléctrico
 * @param {number} k número de onda en el medio (nm⁻¹)
 * @returns {Complex} α (nm³)
 */
export function dipolarPolarizabilityFromMie(a1, k) {
  const factor = (6 * Math.PI) / (k * k * k);
  // i·(re + i·im) = −im + i·re
  return { re: -factor * a1.im, im: factor * a1.re };
}

// --- 2. Aproximación cuasiestática dipolar --------------------------------------------------

/**
 * Factor de Clausius-Mossotti β = (ε − ε_m)/(ε + 2ε_m). Su denominador se anula (casi)
 * cuando Re ε = −2ε_m: es la condición de Fröhlich, la resonancia de plasmón dipolar de
 * una esfera pequeña. Depende del material y del medio, NO del tamaño.
 * @param {Complex} epsilon ε de la partícula
 * @param {number} epsilonMedium ε_m = n_m² (real)
 * @returns {Complex}
 */
export function clausiusMossotti(epsilon, epsilonMedium) {
  return cdiv({ re: epsilon.re - epsilonMedium, im: epsilon.im }, { re: epsilon.re + 2 * epsilonMedium, im: epsilon.im });
}

/**
 * Polarizabilidad cuasiestática de una esfera: α = 4π·a³·(ε − ε_m)/(ε + 2ε_m).
 * El momento dipolar inducido es p = ε₀·ε_m·α·E₀. Con e^{−iωt}, arg α es el retraso de
 * la oscilación de la nube electrónica respecto a la fuerza que la empuja.
 * @param {number} radius radio (nm)
 * @param {Complex} epsilon
 * @param {number} epsilonMedium
 * @returns {Complex} α (nm³)
 */
export function quasiStaticPolarizability(radius, epsilon, epsilonMedium) {
  const beta = clausiusMossotti(epsilon, epsilonMedium);
  const volume4pi = 4 * Math.PI * radius * radius * radius;
  return { re: volume4pi * beta.re, im: volume4pi * beta.im };
}

/**
 * Secciones eficaces de un dipolo puntual de polarizabilidad α (Bohren & Huffman §5.2):
 *
 *   C_abs = k·Im α            (∝ volumen)
 *   C_sca = k⁴·|α|²/(6π)      (∝ volumen²: dispersión de Rayleigh)
 *   C_ext = C_abs + C_sca
 *
 * @param {Complex} alpha polarizabilidad (nm³)
 * @param {number} k número de onda en el medio (nm⁻¹)
 * @returns {CrossSections}
 */
export function dipoleCrossSections(alpha, k) {
  const cabs = k * alpha.im;
  const csca = (k ** 4 * (alpha.re * alpha.re + alpha.im * alpha.im)) / (6 * Math.PI);
  return { cext: cabs + csca, cabs, csca };
}

/**
 * Esfera en la aproximación cuasiestática dipolar. Vale cuando x ≪ 1: toda la partícula
 * ve el mismo campo en cada instante y responde como un único dipolo.
 * @param {object} p
 * @param {number} p.radius radio (nm)
 * @param {number} p.wavelength λ en el vacío (nm)
 * @param {Complex} p.epsilon
 * @param {number} p.mediumIndex
 * @returns {CrossSections & { alpha: Complex, qext: number, qsca: number, qabs: number, x: number }}
 */
export function quasiStaticSphere({ radius, wavelength, epsilon, mediumIndex }) {
  const k = wavenumber(wavelength, mediumIndex);
  const alpha = quasiStaticPolarizability(radius, epsilon, mediumIndex * mediumIndex);
  const sections = dipoleCrossSections(alpha, k);
  const area = Math.PI * radius * radius;
  return { ...sections, alpha, qext: sections.cext / area, qsca: sections.csca / area, qabs: sections.cabs / area, x: k * radius };
}

/**
 * Límite de Rayleigh de la eficiencia de dispersión: Q_sca = (8/3)·x⁴·|(m² − 1)/(m² + 2)|².
 * @param {Complex} m índice relativo
 * @param {number} x parámetro de tamaño
 * @returns {number}
 */
export function rayleighScatteringEfficiency(m, x) {
  const beta = clausiusMossotti(cmul(m, m), 1);
  return (8 / 3) * x ** 4 * (beta.re * beta.re + beta.im * beta.im);
}

// --- 3. Teoría de Gans: esferoide prolato (nanobastón) ---------------------------------------

/**
 * Serie G(t) = Σ_{j≥0} t^{2j}/(2j+3) = [atanh(t)/t − 1]/t², para 0 ≤ t < 1.
 * Cerca de t = 0 la forma cerrada resta dos números casi iguales: ahí se suma la serie.
 * @param {number} t
 * @returns {number}
 */
function seriesG(t) {
  if (t < 0.2) {
    let sum = 0;
    let power = 1;
    for (let j = 0; j < 14; j++) {
      sum += power / (2 * j + 3);
      power *= t * t;
    }
    return sum;
  }
  return (Math.atanh(t) / t - 1) / (t * t);
}

/**
 * Factores de despolarización de un esferoide prolato (un balón de rugby) de relación de
 * aspecto R = largo/ancho ≥ 1, con excentricidad e = √(1 − 1/R²) (B&H, ec. 5.33):
 *
 *   L_∥ = (1 − e²)/e² · [ (1/2e)·ln((1 + e)/(1 − e)) − 1 ]            (eje largo)
 *   L_⊥ = 1/(2e²) − (1 − e²)/(4e³)·ln((1 + e)/(1 − e))               (cada eje corto)
 *
 * Cumplen L_∥ + 2·L_⊥ = 1. La esfera (R = 1) tiene L = 1/3 en los tres ejes; al alargar
 * la partícula, L_∥ baja hacia 0: cuesta menos polarizarla a lo largo.
 * Las dos fórmulas se evalúan por separado (la suma igual a 1 es una comprobación, no
 * una definición).
 * @param {number} aspectRatio R ≥ 1
 * @returns {{ long: number, trans: number, eccentricity: number }}
 */
export function depolarizationFactors(aspectRatio) {
  if (!(aspectRatio >= 1)) throw new RangeError(`Gans: la relación de aspecto debe ser ≥ 1 (es ${aspectRatio})`);
  const e2 = 1 - 1 / (aspectRatio * aspectRatio);
  const e = Math.sqrt(e2);
  const long = (1 - e2) * seriesG(e);
  let trans;
  if (e < 0.2) {
    // L_⊥ = Σ_{j≥0} e^{2j}/((2j+1)(2j+3))
    trans = 0;
    let power = 1;
    for (let j = 0; j < 14; j++) {
      trans += power / ((2 * j + 1) * (2 * j + 3));
      power *= e2;
    }
  } else {
    trans = 1 / (2 * e2) - ((1 - e2) / (2 * e2)) * (Math.atanh(e) / e);
  }
  return { long, trans, eccentricity: e };
}

/**
 * Polarizabilidad de un elipsoide pequeño a lo largo de un eje con factor de
 * despolarización L (B&H, ec. 5.32):
 *
 *   α = V·(ε − ε_m) / (ε_m + L·(ε − ε_m))
 *
 * Resuena cuando Re ε = −ε_m·(1 − L)/L. Con L = 1/3 es la esfera (Re ε = −2ε_m); con L
 * menor hace falta un ε más negativo, es decir, una λ más larga: el pico se va al rojo.
 * @param {number} volume V (nm³)
 * @param {number} L factor de despolarización
 * @param {Complex} epsilon
 * @param {number} epsilonMedium
 * @returns {Complex} α (nm³)
 */
export function ellipsoidPolarizability(volume, L, epsilon, epsilonMedium) {
  const difference = { re: epsilon.re - epsilonMedium, im: epsilon.im };
  const ratio = cdiv(difference, { re: epsilonMedium + L * difference.re, im: L * difference.im });
  return { re: volume * ratio.re, im: volume * ratio.im };
}

/**
 * Volumen de un esferoide prolato de semieje corto b y relación de aspecto R:
 * V = (4π/3)·(R·b)·b².
 * @param {number} shortRadius b (nm)
 * @param {number} aspectRatio R
 * @returns {number} nm³
 */
export function spheroidVolume(shortRadius, aspectRatio) {
  return (4 / 3) * Math.PI * aspectRatio * shortRadius ** 3;
}

/**
 * Teoría de Gans: esferoide prolato mucho menor que λ, orientado al azar (como en un
 * coloide). Cada partícula tiene un modo longitudinal (campo a lo largo del eje largo) y
 * dos transversales; el promedio sobre orientaciones da un tercio de cada eje:
 *
 *   ⟨C_abs⟩ = (k/3)·Im(α_∥ + 2α_⊥)
 *   ⟨C_sca⟩ = k⁴/(18π)·(|α_∥|² + 2|α_⊥|²)
 *
 * ES CUASIESTÁTICA: no incluye retardo. Deja de valer cuando el largo del bastón no es
 * mucho menor que la longitud de onda en el medio.
 * @param {object} p
 * @param {number} p.shortRadius semieje corto b (nm): la mitad del ancho
 * @param {number} p.aspectRatio R = largo/ancho ≥ 1
 * @param {number} p.wavelength λ en el vacío (nm)
 * @param {Complex} p.epsilon
 * @param {number} p.mediumIndex
 * @returns {CrossSections & { alphaLong: Complex, alphaTrans: Complex, factors: { long: number, trans: number }, volume: number }}
 */
export function gansSpheroid({ shortRadius, aspectRatio, wavelength, epsilon, mediumIndex }) {
  const k = wavenumber(wavelength, mediumIndex);
  const epsilonMedium = mediumIndex * mediumIndex;
  const factors = depolarizationFactors(aspectRatio);
  const volume = spheroidVolume(shortRadius, aspectRatio);
  const alphaLong = ellipsoidPolarizability(volume, factors.long, epsilon, epsilonMedium);
  const alphaTrans = ellipsoidPolarizability(volume, factors.trans, epsilon, epsilonMedium);
  const cabs = (k / 3) * (alphaLong.im + 2 * alphaTrans.im);
  const csca =
    (k ** 4 / (18 * Math.PI)) *
    (alphaLong.re ** 2 + alphaLong.im ** 2 + 2 * (alphaTrans.re ** 2 + alphaTrans.im ** 2));
  return { cext: cabs + csca, cabs, csca, alphaLong, alphaTrans, factors, volume };
}

// --- Campo cercano (electrostática) --------------------------------------------------------

/**
 * Campo eléctrico cerca de un esferoide prolato pequeño en un campo uniforme E₀ paralelo
 * a su eje largo (eje z). Es la solución electrostática exacta (B&H §5.3), válida cuando
 * la partícula es mucho menor que λ. Con a = b es la esfera, y el campo exterior es el
 * de un dipolo puntual: E/E₀ = ẑ + β·(a/r)³·(3·cos θ·r̂ − ẑ).
 *
 * Fuera, el potencial es Φ = −E₀·z·[1 − K·L(ξ)], con
 *   K = (ε − ε_m)/(ε_m + L(0)·(ε − ε_m)),
 *   L(ξ) = (a·b²/2)·∫_ξ^∞ dq / ((q + a²)^{3/2}·(q + b²)),
 * y ξ ≥ 0 la coordenada elipsoidal del punto: z²/(a² + ξ) + ρ²/(b² + ξ) = 1 (ξ = 0 es la
 * superficie). L(0) es el factor de despolarización L_∥. Dentro, el campo es uniforme:
 * E = E₀·ε_m/(ε_m + L_∥·(ε − ε_m)).
 *
 * @param {object} p
 * @param {number} p.longRadius semieje a lo largo del campo, a (cualquier unidad de longitud)
 * @param {number} p.shortRadius semieje perpendicular, b ≤ a (misma unidad)
 * @param {Complex} p.epsilon
 * @param {number} p.epsilonMedium
 * @param {number} z coordenada a lo largo del campo (misma unidad)
 * @param {number} rho distancia al eje
 * @returns {{ ez: Complex, erho: Complex, intensity: number, inside: boolean }}
 *   componentes de E/E₀ e intensidad |E|²/|E₀|²
 */
export function spheroidNearField({ longRadius: a, shortRadius: b, epsilon, epsilonMedium }, z, rho) {
  if (!(a >= b && b > 0)) throw new RangeError('campo cercano: hace falta a ≥ b > 0 (campo a lo largo del eje largo)');
  const f2 = a * a - b * b;
  const f = Math.sqrt(f2);
  /** L(ξ) en función de u = √(a² + ξ). @param {number} u */
  const depolarization = (u) => ((a * b * b) / (u * u * u)) * seriesG(f / u);
  const difference = { re: epsilon.re - epsilonMedium, im: epsilon.im };
  const L0 = depolarization(a);
  const K = cdiv(difference, { re: epsilonMedium + L0 * difference.re, im: L0 * difference.im });

  // Coordenada elipsoidal ξ: raíz mayor de ξ² + B·ξ + C = 0.
  const B = a * a + b * b - z * z - rho * rho;
  const C = a * a * b * b - z * z * b * b - rho * rho * a * a;
  if (C >= 0) {
    // Dentro (o en la superficie): campo uniforme E₀·(1 − K·L₀).
    const ez = { re: 1 - K.re * L0, im: -K.im * L0 };
    return { ez, erho: { re: 0, im: 0 }, intensity: ez.re * ez.re + ez.im * ez.im, inside: true };
  }
  const xi = (-B + Math.sqrt(B * B - 4 * C)) / 2;
  const u2 = a * a + xi;
  const v2 = b * b + xi;
  const u = Math.sqrt(u2);
  const L = depolarization(u);
  // E/E₀ = (1 − K·L)·ẑ + z·K·(−L′(ξ))·∇ξ, con −L′ = (a·b²/2)/(u³·v²) y
  // ∇ξ = (2z/u², 2ρ/v²) / (z²/u⁴ + ρ²/v⁴).
  const minusLPrime = (a * b * b) / (2 * u2 * u * v2);
  const S = (z * z) / (u2 * u2) + (rho * rho) / (v2 * v2);
  const gz = (z * minusLPrime * 2 * z) / (u2 * S);
  const grho = (z * minusLPrime * 2 * rho) / (v2 * S);
  const ez = { re: 1 - K.re * L + K.re * gz, im: -K.im * L + K.im * gz };
  const erho = { re: K.re * grho, im: K.im * grho };
  return { ez, erho, intensity: ez.re ** 2 + ez.im ** 2 + erho.re ** 2 + erho.im ** 2, inside: false };
}

// --- Coloide: cubeta y luz dispersada --------------------------------------------------------

/**
 * Transmitancia de una cubeta con N partículas por unidad de volumen y camino óptico L
 * (ley de Beer-Lambert, partículas independientes y dispersión simple):
 *
 *   T = exp(−N·C_ext·L)
 *
 * Lo que sale por el otro lado es la luz que NO ha sido ni absorbida ni dispersada.
 * @param {number} cext sección eficaz de extinción (nm²)
 * @param {number} numberDensity N (partículas por nm³)
 * @param {number} pathLength L (nm)
 * @returns {number} entre 0 y 1
 */
export function cuvetteTransmittance(cext, numberDensity, pathLength) {
  return Math.exp(-numberDensity * cext * pathLength);
}

/**
 * Partículas por unidad de volumen a partir de la fracción de volumen ocupada por el
 * metal: N = f/V. Con f fija, un coloide de partículas más pequeñas tiene más partículas.
 * @param {number} volumeFraction f (adimensional; 1 ppm = 10⁻⁶)
 * @param {number} particleVolume V (nm³)
 * @returns {number} N (nm⁻³)
 */
export function numberDensity(volumeFraction, particleVolume) {
  return volumeFraction / particleVolume;
}

/**
 * Absorbancia (densidad óptica) que mide un espectrofotómetro: A = −log₁₀ T.
 * @param {number} transmittance
 * @returns {number}
 */
export function absorbance(transmittance) {
  return -Math.log10(transmittance);
}

/**
 * Lo que se ve de un coloide: la luz que atraviesa la cubeta y la que sale dispersada.
 *   - transmittance: T(λ) = exp(−N·C_ext(λ)·L), el espectro de la cubeta a contraluz.
 *   - scattered: C_sca(λ) dividido por su máximo; multiplicado por el espectro de la
 *     lámpara es (salvo un factor) el espectro de la luz que se ve mirando de lado, en la
 *     aproximación de dispersión simple (cada fotón se dispersa como mucho una vez y no
 *     se atenúa al salir).
 * @param {{ cext: ArrayLike<number>, csca: ArrayLike<number>, volume: number }} spectrum
 *   espectros de la partícula (nm²) y su volumen (nm³), como los da particleSpectrum
 * @param {{ volumeFraction: number, pathLength: number }} sample fracción de volumen de
 *   metal (adimensional) y camino óptico (nm)
 * @returns {{ transmittance: Float64Array, scattered: Float64Array, numberDensity: number, peakAbsorbance: number }}
 */
export function colloidSpectra(spectrum, { volumeFraction, pathLength }) {
  const density = numberDensity(volumeFraction, spectrum.volume);
  const count = spectrum.cext.length;
  const transmittance = new Float64Array(count);
  const scattered = new Float64Array(count);
  let maxSca = 0;
  let maxExt = 0;
  for (let i = 0; i < count; i++) {
    transmittance[i] = cuvetteTransmittance(spectrum.cext[i], density, pathLength);
    maxSca = Math.max(maxSca, spectrum.csca[i]);
    maxExt = Math.max(maxExt, spectrum.cext[i]);
  }
  for (let i = 0; i < count; i++) scattered[i] = maxSca > 0 ? spectrum.csca[i] / maxSca : 0;
  return { transmittance, scattered, numberDensity: density, peakAbsorbance: (density * maxExt * pathLength) / Math.LN10 };
}

// --- Espectros ---------------------------------------------------------------------------------

/**
 * @typedef {object} ParticleConfig
 * @property {'sphere' | 'rod'} shape esfera (Mie) o bastón (esferoide prolato, Gans)
 * @property {number} diameter diámetro de la esfera, o ancho del bastón (nm)
 * @property {number} aspectRatio largo/ancho del bastón (se ignora en la esfera)
 * @property {number} mediumIndex índice del medio
 * @property {(wavelength: number) => Complex} epsilon función dieléctrica del material
 */

/**
 * Secciones eficaces y polarizabilidad de una partícula en una longitud de onda, con el
 * modelo que corresponde a su forma: Mie para la esfera, Gans para el bastón.
 * `alpha` es la polarizabilidad que gobierna la oscilación de la nube electrónica: la
 * dipolar de Mie en la esfera y la longitudinal en el bastón.
 * @param {ParticleConfig} particle
 * @param {number} wavelength λ en el vacío (nm)
 * @returns {CrossSections & { alpha: Complex, volume: number }}
 */
export function particleResponse(particle, wavelength) {
  const epsilon = particle.epsilon(wavelength);
  const radius = particle.diameter / 2;
  if (particle.shape === 'rod') {
    const rod = gansSpheroid({ shortRadius: radius, aspectRatio: particle.aspectRatio, wavelength, epsilon, mediumIndex: particle.mediumIndex });
    return { cext: rod.cext, cabs: rod.cabs, csca: rod.csca, alpha: rod.alphaLong, volume: rod.volume };
  }
  const sphere = mieSphere({ radius, wavelength, epsilon, mediumIndex: particle.mediumIndex });
  return { cext: sphere.cext, cabs: sphere.cabs, csca: sphere.csca, alpha: sphere.alpha, volume: spheroidVolume(radius, 1) };
}

/**
 * Espectros de extinción, absorción y dispersión de una partícula.
 * @param {ParticleConfig} particle
 * @param {ArrayLike<number>} wavelengths λ en el vacío (nm)
 * @returns {{ wavelengths: Float64Array, cext: Float64Array, cabs: Float64Array, csca: Float64Array,
 *   alphaRe: Float64Array, alphaIm: Float64Array, volume: number }}
 */
export function particleSpectrum(particle, wavelengths) {
  const count = wavelengths.length;
  const out = {
    wavelengths: Float64Array.from(wavelengths),
    cext: new Float64Array(count),
    cabs: new Float64Array(count),
    csca: new Float64Array(count),
    alphaRe: new Float64Array(count),
    alphaIm: new Float64Array(count),
    volume: 0,
  };
  for (let i = 0; i < count; i++) {
    const r = particleResponse(particle, wavelengths[i]);
    out.cext[i] = r.cext;
    out.cabs[i] = r.cabs;
    out.csca[i] = r.csca;
    out.alphaRe[i] = r.alpha.re;
    out.alphaIm[i] = r.alpha.im;
    out.volume = r.volume;
  }
  return out;
}

/**
 * Posición del máximo de una curva muestreada. Toma la muestra mayor y afina con la
 * parábola que pasa por ella y sus dos vecinas (si el máximo está en un extremo de la
 * tabla, devuelve ese extremo: la curva no tiene pico dentro del intervalo).
 * @param {ArrayLike<number>} xs abscisas crecientes
 * @param {ArrayLike<number>} ys
 * @returns {{ x: number, y: number, index: number, interior: boolean }}
 */
export function findPeak(xs, ys) {
  let index = 0;
  for (let i = 1; i < ys.length; i++) if (ys[i] > ys[index]) index = i;
  if (index === 0 || index === ys.length - 1) return { x: xs[index], y: ys[index], index, interior: false };
  // Parábola por (x₀, y₀), (x₁, y₁), (x₂, y₂) con diferencias divididas.
  const x0 = xs[index - 1];
  const x1 = xs[index];
  const x2 = xs[index + 1];
  const d01 = (ys[index] - ys[index - 1]) / (x1 - x0);
  const d12 = (ys[index + 1] - ys[index]) / (x2 - x1);
  const curvature = (d12 - d01) / (x2 - x0);
  if (!(curvature < 0)) return { x: x1, y: ys[index], index, interior: true };
  const x = (x0 + x1) / 2 - d01 / (2 * curvature);
  const y = ys[index - 1] + d01 * (x - x0) + curvature * (x - x0) * (x - x1);
  return { x, y, index, interior: true };
}

/**
 * Amplitud y desfase de la oscilación forzada de la nube electrónica, a partir de la
 * polarizabilidad α(ω). El momento dipolar es p(t) = Re[ε₀·ε_m·α·E₀·e^{−iωt}]
 * = ε₀·ε_m·|α|·E₀·cos(ωt − δ), con δ = arg α. Como el oscilador forzado del módulo
 * «oscilador»: δ ≈ 0 muy por debajo de la resonancia (la nube sigue a la fuerza), 90° en
 * la resonancia y hacia 180° por encima.
 * @param {Complex} alpha
 * @returns {{ amplitude: number, phase: number }} |α| (nm³) y δ en radianes, en [0, π]
 *   para una partícula pasiva (Im α ≥ 0)
 */
export function drivenOscillation(alpha) {
  return { amplitude: Math.hypot(alpha.re, alpha.im), phase: Math.atan2(alpha.im, alpha.re) };
}
