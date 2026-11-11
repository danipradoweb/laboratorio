// @ts-check
// Tests de src/core/complex.js. Todos comprueban identidades algebraicas exactas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/core/complex.js';

/**
 * @param {C.Complex} actual
 * @param {C.Complex} expected
 * @param {number} [tol]
 */
function closeC(actual, expected, tol = 1e-12) {
  assert.ok(
    C.equals(actual, expected, tol),
    `obtenido ${actual.re}+${actual.im}i, esperado ${expected.re}+${expected.im}i`,
  );
}

// Muestras variadas, en los cuatro cuadrantes y sobre los ejes.
const samples = [
  C.complex(1, 2),
  C.complex(-3, 0.5),
  C.complex(0.25, -4),
  C.complex(-2, -2),
  C.complex(5, 0),
  C.complex(0, -1.5),
  C.complex(1e-3, 7),
];

// Identidad de Euler: e^{iπ} = −1 (definición de la exponencial compleja).
test('identidad de Euler', () => {
  closeC(C.exp(C.complex(0, Math.PI)), C.complex(-1, 0));
  closeC(C.exp(C.complex(0, Math.PI / 2)), C.I);
  closeC(C.exp(C.ZERO), C.ONE);
});

// i² = −1 por definición.
test('i² = −1', () => {
  closeC(C.mul(C.I, C.I), C.complex(-1, 0));
});

// Propiedades de cuerpo: conmutativa, asociativa, distributiva, opuesto e inverso.
test('propiedades algebraicas de suma y producto', () => {
  for (const a of samples) {
    closeC(C.add(a, C.neg(a)), C.ZERO);
    closeC(C.sub(a, a), C.ZERO);
    closeC(C.div(a, a), C.ONE);
    closeC(C.scale(a, 2), C.add(a, a));
    for (const b of samples) {
      closeC(C.mul(a, b), C.mul(b, a));
      closeC(C.div(C.mul(a, b), b), a, 1e-11);
      for (const c of samples) {
        closeC(C.mul(a, C.add(b, c)), C.add(C.mul(a, b), C.mul(a, c)), 1e-10);
        closeC(C.mul(C.mul(a, b), c), C.mul(a, C.mul(b, c)), 1e-9);
      }
    }
  }
});

// El módulo es multiplicativo, |ab| = |a||b|, y a·a* = |a|².
test('módulo y conjugado', () => {
  for (const a of samples) {
    closeC(C.mul(a, C.conj(a)), C.complex(C.abs2(a), 0));
    assert.ok(Math.abs(C.abs(a) ** 2 - C.abs2(a)) < 1e-12);
    for (const b of samples) {
      assert.ok(Math.abs(C.abs(C.mul(a, b)) - C.abs(a) * C.abs(b)) < 1e-11);
      closeC(C.conj(C.mul(a, b)), C.mul(C.conj(a), C.conj(b)));
    }
  }
  // Terna pitagórica: |3 + 4i| = 5.
  assert.equal(C.abs(C.complex(3, 4)), 5);
});

// Forma polar: a = |a|·e^{i·arg a}; al multiplicar, los argumentos se suman.
test('forma polar: ida y vuelta, y suma de argumentos', () => {
  for (const a of samples) {
    closeC(C.fromPolar(C.abs(a), C.arg(a)), a);
  }
  const p = C.mul(C.fromPolar(2, 0.3), C.fromPolar(3, 0.5));
  assert.ok(Math.abs(C.abs(p) - 6) < 1e-12);
  assert.ok(Math.abs(C.arg(p) - 0.8) < 1e-12);
  // arg está en (−π, π]: el eje real negativo tiene fase +π.
  assert.equal(C.arg(C.complex(-1, 0)), Math.PI);
});

// e^{a+b} = e^a·e^b, y log es la inversa de exp en la rama principal.
test('exponencial y logaritmo', () => {
  for (const a of samples) {
    closeC(C.exp(C.log(a)), a, 1e-11);
    for (const b of samples) {
      const lhs = C.exp(C.scale(C.add(a, b), 0.1));
      const rhs = C.mul(C.exp(C.scale(a, 0.1)), C.exp(C.scale(b, 0.1)));
      closeC(lhs, rhs, 1e-11);
    }
  }
  // ln(−1) = iπ en la rama principal.
  closeC(C.log(C.complex(-1, 0)), C.complex(0, Math.PI));
});

// (√a)² = a, con la raíz principal (parte real ≥ 0).
test('raíz cuadrada principal', () => {
  for (const a of samples) {
    const s = C.sqrt(a);
    closeC(C.mul(s, s), a, 1e-11);
    assert.ok(s.re >= 0, 'la raíz principal tiene parte real no negativa');
  }
  closeC(C.sqrt(C.complex(-1, 0)), C.I);
  closeC(C.sqrt(C.complex(-4, 0)), C.complex(0, 2));
  closeC(C.sqrt(C.complex(0, 2)), C.complex(1, 1)); // (1+i)² = 2i
  closeC(C.sqrt(C.ZERO), C.ZERO);
});

// La división no debe desbordar con números enormes (algoritmo de Smith):
// (1e300 + 1e300 i)/(1e300 + 1e300 i) = 1, aunque |b|² = 2e600 no cabe en un double.
test('la división es estable con valores extremos', () => {
  const big = C.complex(1e300, 1e300);
  closeC(C.div(big, big), C.ONE);
  closeC(C.div(C.ONE, C.I), C.complex(0, -1)); // 1/i = −i
});

// Las funciones son puras: no modifican sus argumentos.
test('las operaciones no modifican los argumentos', () => {
  const a = C.complex(1, 2);
  const b = C.complex(3, 4);
  C.add(a, b); C.mul(a, b); C.div(a, b); C.conj(a); C.exp(a); C.sqrt(a);
  assert.deepEqual(a, { re: 1, im: 2 });
  assert.deepEqual(b, { re: 3, im: 4 });
});
