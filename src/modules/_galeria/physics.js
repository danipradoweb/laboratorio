// @ts-check
// Función de prueba de la galería de componentes: un paquete de ondas gaussiano 2D.
//
//   ψ(x, y) = exp(−(x² + y²)/(2σ²)) · exp(i·k·x)
//
// No pretende simular nada: es una función compleja sencilla, con módulo y fase
// conocidos, para comprobar a simple vista las gráficas, los mapas de color y el
// visor 3D. Longitudes en unidades arbitrarias.

/**
 * Valor del paquete gaussiano en un punto.
 * @param {number} x
 * @param {number} y
 * @param {{ sigma: number, k: number }} p sigma: anchura; k: número de onda a lo largo de x
 * @returns {{ re: number, im: number }}
 */
export function gaussianPacket(x, y, { sigma, k }) {
  const envelope = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
  return { re: envelope * Math.cos(k * x), im: envelope * Math.sin(k * x) };
}

/**
 * Muestrea el paquete en una malla regular de nx × ny celdas que cubre el cuadrado
 * [−half, half]². Cada valor se toma en el CENTRO de su celda, que es el convenio de
 * los mapas de plot2d.js:
 *   x = −half + (ix + ½)·(2·half/nx),    y = −half + (iy + ½)·(2·half/ny)
 * El punto (ix, iy) queda en el índice iy·nx + ix (por filas).
 * @param {{ sigma: number, k: number }} p
 * @param {number} nx
 * @param {number} ny
 * @param {number} half semianchura del cuadrado
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function sampleGrid(p, nx, ny, half) {
  const re = new Float64Array(nx * ny);
  const im = new Float64Array(nx * ny);
  for (let iy = 0; iy < ny; iy++) {
    const y = -half + ((iy + 0.5) * 2 * half) / ny;
    for (let ix = 0; ix < nx; ix++) {
      const x = -half + ((ix + 0.5) * 2 * half) / nx;
      const z = gaussianPacket(x, y, p);
      re[iy * nx + ix] = z.re;
      im[iy * nx + ix] = z.im;
    }
  }
  return { re, im };
}
