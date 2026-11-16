// @ts-check
// Cuerda clásica: ecuación de ondas 1D con diferencias finitas (salto de rana).
//
//   ∂²u/∂t² = c²·∂²u/∂x²
//
// u(x, t) es el desplazamiento transversal de la cuerda: algo que se mueve de verdad en
// el espacio. Es la onda clásica con la que se compara la función de onda.
//
// MALLA: N + 1 nodos x_i = i·Δx (i = 0…N), L = N·Δx. Paso de tiempo Δt = r·Δx/c, con
// r ≤ 1 el número de Courant (con r > 1 el esquema es inestable).
//
// ESQUEMA (salto de rana, segundo orden en x y en t):
//   u_i^{n+1} = 2u_i^n − u_i^{n−1} + r²·(u_{i+1}^n − 2u_i^n + u_{i−1}^n)
// Con r = 1 el esquema es EXACTO en los nodos para la ecuación de ondas 1D (reproduce
// la solución de d'Alembert u = f(x − ct) + g(x + ct)): por eso es el valor por defecto.
//
// EXTREMOS:
//   'fixed'  fijos, u = 0 (cuerda atada).
//   'free'   libres, ∂u/∂x = 0 (anillo sin rozamiento en una barra). Nodo fantasma u_{−1} = u_1.
//   'open'   abiertos: condición absorbente de Mur de primer orden, que deja salir una onda
//            sin reflejarla (exacta con r = 1). Simula una cuerda infinita.
//
// ENERGÍA (densidad lineal ρ = 1, tensión T = c²): la energía discreta que el salto de
// rana conserva EXACTAMENTE (salvo redondeo) es
//   E^{n+½} = Σ_i w_i·½·((u_i^{n+1} − u_i^n)/Δt)²·Δx
//           + Σ_i ½·c²·(u_{i+1}^{n+1} − u_i^{n+1})(u_{i+1}^n − u_i^n)/Δx² · Δx
// con w_i = 1 salvo en los extremos libres (w = ½, regla del trapecio). Es la energía
// cinética más la potencial con el producto «cruzado» entre dos instantes; tiende a la
// energía continua ½∫(u_t² + c²u_x²)dx cuando Δx → 0.
//
// Referencias: Feynman Lectures vol. I cap. 47 (ecuación de ondas); para el esquema y la
// energía discreta, cualquier texto de diferencias finitas (p. ej. Strikwerda, «Finite
// Difference Schemes and PDEs», cap. 8). La condición de Mur: G. Mur, IEEE Trans. EMC 23
// (1981) 377.

/** @typedef {'fixed' | 'free' | 'open'} Boundary */

/**
 * Estado de la cuerda. `u` es el desplazamiento en el instante actual y `uPrev` en el
 * anterior (t − Δt). Se modifica en el sitio con stepString.
 * @typedef {object} StringState
 * @property {number} length L
 * @property {number} cells N (número de intervalos; hay N + 1 nodos)
 * @property {number} speed c
 * @property {number} dx
 * @property {number} dt
 * @property {number} courant r = c·Δt/Δx
 * @property {Boundary} boundary extremo izquierdo y derecho iguales
 * @property {Float64Array} x posiciones de los nodos
 * @property {Float64Array} u
 * @property {Float64Array} uPrev
 * @property {number} time
 */

/**
 * Crea una cuerda en reposo (u = 0).
 * @param {{ length: number, cells: number, speed: number, boundary?: Boundary, courant?: number }} options
 * @returns {StringState}
 */
export function createString({ length, cells, speed, boundary = 'fixed', courant = 1 }) {
  if (!(length > 0) || !(speed > 0)) throw new RangeError('createString: L y c deben ser positivos');
  if (!Number.isInteger(cells) || cells < 2) throw new RangeError('createString: hacen falta al menos 2 intervalos');
  if (!(courant > 0 && courant <= 1)) throw new RangeError('createString: el número de Courant debe estar en (0, 1]');
  if (!['fixed', 'free', 'open'].includes(boundary)) throw new RangeError(`createString: extremo desconocido "${boundary}"`);
  const dx = length / cells;
  const x = new Float64Array(cells + 1);
  for (let i = 0; i <= cells; i++) x[i] = i * dx;
  return {
    length,
    cells,
    speed,
    dx,
    dt: (courant * dx) / speed,
    courant,
    boundary,
    x,
    u: new Float64Array(cells + 1),
    uPrev: new Float64Array(cells + 1),
    time: 0,
  };
}

/**
 * Pone la cuerda en el estado de una solución conocida U(x, t): u = U(x, 0) y
 * uPrev = U(x, −Δt). Así se arranca con la velocidad exacta (por ejemplo, un pulso que
 * viaja, U = f(x − ct), o un modo, U = sen(kx)·cos(ωt)).
 * En extremos fijos se fuerza u = 0 en los extremos.
 * @param {StringState} s
 * @param {(x: number, t: number) => number} solution
 */
export function setFromSolution(s, solution) {
  for (let i = 0; i <= s.cells; i++) {
    s.u[i] = solution(s.x[i], 0);
    s.uPrev[i] = solution(s.x[i], -s.dt);
  }
  if (s.boundary === 'fixed') {
    s.u[0] = s.u[s.cells] = 0;
    s.uPrev[0] = s.uPrev[s.cells] = 0;
  }
  s.time = 0;
}

/**
 * Forma inicial f(x) soltada en reposo (velocidad nula). Para que el arranque sea de
 * segundo orden se usa la solución de d'Alembert en un medio infinito,
 * u(x, −Δt) = ½[f(x − cΔt) + f(x + cΔt)], que es exacta con velocidad inicial nula.
 * @param {StringState} s
 * @param {(x: number) => number} shape
 */
export function setReleasedShape(s, shape) {
  const c = s.speed;
  setFromSolution(s, (x, t) => (t === 0 ? shape(x) : 0.5 * (shape(x - c * t) + shape(x + c * t))));
}

/**
 * Avanza la cuerda `steps` pasos de tiempo (salto de rana). Modifica `s`.
 * @param {StringState} s
 * @param {number} [steps]
 */
export function stepString(s, steps = 1) {
  const n = s.cells;
  const r2 = s.courant * s.courant;
  const mur = (s.courant - 1) / (s.courant + 1);
  /** @type {Float64Array} */
  let next = new Float64Array(n + 1);
  for (let step = 0; step < steps; step++) {
    const u = s.u;
    const up = s.uPrev;
    for (let i = 1; i < n; i++) {
      next[i] = 2 * u[i] - up[i] + r2 * (u[i + 1] - 2 * u[i] + u[i - 1]);
    }
    if (s.boundary === 'fixed') {
      next[0] = 0;
      next[n] = 0;
    } else if (s.boundary === 'free') {
      // Nodo fantasma u_{−1} = u_1 (derivada nula en el extremo).
      next[0] = 2 * u[0] - up[0] + 2 * r2 * (u[1] - u[0]);
      next[n] = 2 * u[n] - up[n] + 2 * r2 * (u[n - 1] - u[n]);
    } else {
      // Mur de primer orden: la onda que llega al extremo sale sin reflejarse.
      next[0] = u[1] + mur * (next[1] - u[0]);
      next[n] = u[n - 1] + mur * (next[n - 1] - u[n]);
    }
    s.uPrev = u;
    s.u = next;
    next = up; // se reutiliza el array que ya no hace falta
    s.time += s.dt;
  }
}

/**
 * Energía discreta que conserva el salto de rana entre el instante anterior y el actual
 * (ver la cabecera). Con extremos abiertos no se conserva: la energía sale de la cuerda.
 * @param {StringState} s
 * @returns {{ kinetic: number, potential: number, total: number }}
 */
export function stringEnergy(s) {
  const n = s.cells;
  const { u, uPrev, dx, dt } = s;
  const c2 = s.speed * s.speed;
  const endWeight = s.boundary === 'free' ? 0.5 : 1;
  let kinetic = 0;
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? endWeight : 1;
    const v = (u[i] - uPrev[i]) / dt;
    kinetic += 0.5 * w * v * v * dx;
  }
  let potential = 0;
  for (let i = 0; i < n; i++) {
    potential += (0.5 * c2 * (u[i + 1] - u[i]) * (uPrev[i + 1] - uPrev[i])) / dx;
  }
  return { kinetic, potential, total: kinetic + potential };
}

/**
 * Frecuencia angular del modo n de una cuerda de longitud L con los dos extremos fijos o
 * los dos libres: ω_n = nπc/L (k_n = nπ/L). Con extremos fijos n = 1, 2, 3…; con libres
 * también vale n = 0 (la cuerda entera desplazada, sin oscilar).
 * @param {number} n
 * @param {number} length
 * @param {number} speed
 */
export function modeFrequency(n, length, speed) {
  return (n * Math.PI * speed) / length;
}

/**
 * Forma del modo n: sen(nπx/L) con extremos fijos y cos(nπx/L) con extremos libres.
 * Con extremos fijos es la misma función que el estado n de una partícula en una caja
 * de paredes infinitas de anchura L (lo que cambia es cómo evoluciona en el tiempo).
 * @param {number} n
 * @param {number} x
 * @param {number} length
 * @param {'fixed' | 'free'} boundary
 */
export function modeShape(n, x, length, boundary) {
  const k = (n * Math.PI) / length;
  return boundary === 'free' ? Math.cos(k * x) : Math.sin(k * x);
}

/**
 * Proyección del desplazamiento actual y del anterior sobre los modos 1…count (extremos
 * fijos) o 0…count−1 (libres), por la regla del trapecio. Devuelve la amplitud modal q y
 * la energía de cada modo con la misma forma escalonada que conserva el salto de rana,
 *   E_n = ½·[((q^n − q^{n−1})/Δt)² + Ω_n²·q^n·q^{n−1}]·‖φ_n‖²,
 * donde Ω_n = (2c/Δx)·sen(k_nΔx/2) es la frecuencia del modo EN LA MALLA (tiende a
 * ω_n = nπc/L). Los modos discretos son ortogonales con esa regla del trapecio, así que
 * la suma de todas las energías modales es la energía de la cuerda (stringEnergy).
 * `omega` devuelve la frecuencia continua ω_n, la que se muestra.
 * @param {StringState} s
 * @param {number} count
 * @returns {{ n: number[], omega: number[], amplitude: number[], energy: number[] }}
 */
export function modalEnergies(s, count) {
  if (s.boundary === 'open') throw new RangeError('modalEnergies: con extremos abiertos no hay modos');
  const boundary = s.boundary;
  const first = boundary === 'free' ? 0 : 1;
  /** @type {number[]} */ const ns = [];
  /** @type {number[]} */ const omega = [];
  /** @type {number[]} */ const amplitude = [];
  /** @type {number[]} */ const energy = [];
  const { u, uPrev, dx, dt, cells, length } = s;
  for (let m = 0; m < count; m++) {
    const n = first + m;
    // Norma del modo: ∫sen² = ∫cos² = L/2 (L para el modo 0 de extremos libres).
    const norm = n === 0 ? length : length / 2;
    let q = 0;
    let qPrev = 0;
    for (let i = 0; i <= cells; i++) {
      const w = i === 0 || i === cells ? 0.5 : 1;
      const phi = modeShape(n, s.x[i], length, boundary);
      q += w * u[i] * phi * dx;
      qPrev += w * uPrev[i] * phi * dx;
    }
    q /= norm;
    qPrev /= norm;
    const w = modeFrequency(n, length, s.speed);
    const gridOmega = ((2 * s.speed) / dx) * Math.sin((w / s.speed) * dx * 0.5);
    const qDot = (q - qPrev) / dt;
    ns.push(n);
    omega.push(w);
    amplitude.push(q);
    energy.push(0.5 * (qDot * qDot + gridOmega * gridOmega * q * qPrev) * norm);
  }
  return { n: ns, omega, amplitude, energy };
}
