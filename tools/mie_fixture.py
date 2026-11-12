"""Genera tests/fixtures/mie.json: referencia independiente de la teoría de Mie.

Uso:  .venv/bin/python tools/mie_fixture.py

Calcula con `miepython` (https://github.com/scottprahl/miepython, licencia MIT) las
eficiencias Q_ext, Q_sca, Q_back, el parámetro de asimetría g y las amplitudes S1(θ),
S2(θ) de una esfera, en una malla de índices relativos m (reales y absorbentes) y
parámetros de tamaño x entre 0,01 y 100. tests/plasmon.test.js compara con estos valores
la implementación propia (BHMIE) de src/modules/plasmon/physics.js.

CONVENIOS. El laboratorio usa e^{−iωt} (Bohren & Huffman): absorber es Im m > 0.
miepython usa e^{+iωt}: absorber es Im m < 0 y sus amplitudes son las conjugadas. Aquí
se le pasa conj(m) y se guardan conj(S1), conj(S2), de modo que el fixture está entero en
el convenio del laboratorio. La normalización 'wiscombe' de miepython es la de Bohren &
Huffman: Re S(0°) = x²·Q_ext/4.

DOS REFERENCIAS. Cuando |m|·x < 0,1, miepython no suma la serie de Mie: usa un
desarrollo en potencias de x truncado (`_small_sphere_py`), con un error relativo de
hasta ~2·10⁻⁶ en Q_back y g, mayor que la tolerancia de los tests (10⁻⁶). En esos casos
la referencia se calcula aquí con `mpmath` (BSD) a 40 cifras, con las funciones de Bessel
exactas y las fórmulas de Bohren & Huffman (ec. 4.53, 4.61, 4.62, 4.74). Cada caso lleva
el campo "referencia" con el nombre de la que se usó. En varios casos con |m|·x ≥ 0,1 se
comprueba además que mpmath y miepython coinciden (si no, el script se detiene).

No edites a mano el archivo generado.
"""

import json
from pathlib import Path

import miepython
import mpmath as mp
import numpy as np

mp.mp.dps = 40

ROOT = Path(__file__).resolve().parent.parent

# Índices relativos m = n + ik (convenio del laboratorio).
M_REAL = [0.75, 1.05, 1.33, 1.5, 2.0, 4.0]
M_ABSORBING = [
    1.33 + 1e-5j,  # agua casi transparente
    1.5 + 0.1j,
    1.5 + 1.0j,
    2.5 + 2.5j,
    0.47 + 1.56j,  # como el oro en agua cerca de 520 nm
    0.04 + 2.3j,  # como la plata en agua cerca de 500 nm: casi sin pérdidas
    0.2 + 3.5j,
    1.0 + 6.0j,  # metal muy reflectante (como el aluminio)
]
X_VALUES = [0.01, 0.03, 0.05, 0.1, 0.3, 0.5213, 1.0, 2.5, 3.0, 7.7, 10.0, 30.0, 55.5, 100.0]
# Ángulos (grados) para las amplitudes; solo en algunos casos, para no engordar el archivo.
ANGLES = [0, 1, 10, 30, 45, 60, 90, 120, 135, 150, 170, 179, 180]
X_WITH_ANGLES = [0.01, 0.1, 1.0, 3.0, 10.0, 55.5]


def cplx(z) -> list:
    return [float(np.real(z)), float(np.imag(z))]


def mie_mpmath(m, x, angles_deg, nmax=None):
    """Mie de alta precisión en el convenio e^{-iwt} (Bohren & Huffman)."""
    m = mp.mpc(str(complex(m).real), str(complex(m).imag))
    x = mp.mpf(str(x))
    if nmax is None:
        nmax = int(x + 4 * x ** (mp.mpf(1) / 3) + 2) + 12
    half = mp.mpf(1) / 2

    def psi(n, z):  # Riccati-Bessel: z·j_n(z)
        return z * mp.sqrt(mp.pi / (2 * z)) * mp.besselj(n + half, z)

    def chi(n, z):  # −z·y_n(z)
        return -z * mp.sqrt(mp.pi / (2 * z)) * mp.bessely(n + half, z)

    def xi(n, z):
        return psi(n, z) - 1j * chi(n, z)

    def dpsi(n, z):  # ψ_n' = ψ_{n−1} − n·ψ_n/z
        return psi(n - 1, z) - n * psi(n, z) / z

    def dxi(n, z):
        return xi(n - 1, z) - n * xi(n, z) / z

    mx = m * x
    a, b = [None], [None]
    for n in range(1, nmax + 1):
        a.append((m * psi(n, mx) * dpsi(n, x) - psi(n, x) * dpsi(n, mx)) / (m * psi(n, mx) * dxi(n, x) - xi(n, x) * dpsi(n, mx)))
        b.append((psi(n, mx) * dpsi(n, x) - m * psi(n, x) * dpsi(n, mx)) / (psi(n, mx) * dxi(n, x) - m * xi(n, x) * dpsi(n, mx)))
    orders = range(1, nmax + 1)
    qext = 2 / x**2 * sum((2 * n + 1) * mp.re(a[n] + b[n]) for n in orders)
    qsca = 2 / x**2 * sum((2 * n + 1) * (abs(a[n]) ** 2 + abs(b[n]) ** 2) for n in orders)
    qback = abs(sum((2 * n + 1) * (-1) ** n * (a[n] - b[n]) for n in orders)) ** 2 / x**2
    g = (
        4
        / (x**2 * qsca)
        * (
            sum(mp.mpf(n * (n + 2)) / (n + 1) * mp.re(a[n] * mp.conj(a[n + 1]) + b[n] * mp.conj(b[n + 1])) for n in range(1, nmax))
            + sum(mp.mpf(2 * n + 1) / (n * (n + 1)) * mp.re(a[n] * mp.conj(b[n])) for n in orders)
        )
    )
    s1, s2 = [], []
    for angle in angles_deg:
        mu = mp.cos(mp.radians(angle))
        pi_prev, pi_n = mp.mpf(0), mp.mpf(1)
        t1, t2 = mp.mpc(0), mp.mpc(0)
        for n in orders:
            tau = n * mu * pi_n - (n + 1) * pi_prev
            factor = mp.mpf(2 * n + 1) / (n * (n + 1))
            t1 += factor * (a[n] * pi_n + b[n] * tau)
            t2 += factor * (a[n] * tau + b[n] * pi_n)
            pi_prev, pi_n = pi_n, (mp.mpf(2 * n + 1) / n) * mu * pi_n - (mp.mpf(n + 1) / n) * pi_prev
        s1.append(complex(t1))
        s2.append(complex(t2))
    return float(qext), float(qsca), float(qback), float(g), s1, s2


def mie_miepython(m, x, angles_deg):
    m_py = np.conj(complex(m))
    qext, qsca, qback, g = miepython.efficiencies_mx(m_py, x)
    s1, s2 = [], []
    if angles_deg:
        mu = np.cos(np.radians(angles_deg))
        c1, c2 = miepython.S1_S2(m_py, x, mu, norm="wiscombe")
        s1, s2 = [complex(np.conj(v)) for v in c1], [complex(np.conj(v)) for v in c2]
    return float(qext), float(qsca), float(qback), float(g), s1, s2


# Comprobación cruzada de las dos referencias donde ambas suman la serie completa.
# Tolerancia 1e-7 y no más fina: miepython corta la serie en n_max = x + 4·x^(1/3) + 2
# (el criterio de Wiscombe, el mismo del laboratorio) y mpmath suma 12 términos más; lo
# que queda fuera llega a 1e-9 relativo en Q_back (medido en m = 2,5 + 2,5i, x = 7,7).
for m, x in [(1.5, 0.3), (1.33, 3.0), (1.5 + 0.1j, 1.0), (0.47 + 1.56j, 2.5), (0.04 + 2.3j, 0.5213), (4.0, 10.0), (2.5 + 2.5j, 7.7)]:
    high = mie_mpmath(m, x, [0, 45, 180])
    ref = mie_miepython(m, x, [0, 45, 180])
    for h, r in zip(high[:4], ref[:4]):
        assert abs(h - r) <= 1e-7 * abs(h), f"mpmath y miepython discrepan en m={m}, x={x}: {h} frente a {r}"
    for hs, rs in zip(high[4] + high[5], ref[4] + ref[5]):
        assert abs(hs - rs) <= 1e-7 * abs(high[4][0]), f"amplitudes discrepan en m={m}, x={x}"
print("mpmath y miepython coinciden a 1e-7 en los casos de control")

cases = []
for m in M_REAL + M_ABSORBING:
    for x in X_VALUES:
        angles = ANGLES if x in X_WITH_ANGLES else []
        small = abs(complex(m)) * x < 0.1  # rama aproximada de miepython
        qext, qsca, qback, g, s1, s2 = (mie_mpmath if small else mie_miepython)(m, x, angles)
        case = {
            "m": cplx(m),
            "x": x,
            "referencia": "mpmath" if small else "miepython",
            "qext": qext,
            "qsca": qsca,
            "qback": qback,
            "g": g,
        }
        if angles:
            case["angles_deg"] = angles
            case["s1"] = [cplx(v) for v in s1]
            case["s2"] = [cplx(v) for v in s2]
        cases.append(case)

out = {
    "_descripcion": "Eficiencias y amplitudes de Mie de una esfera; convenio e^{-iwt} (Im m > 0 absorbe), amplitudes de Bohren & Huffman",
    "_fuente": f"miepython {miepython.__version__} (MIT): efficiencies_mx y S1_S2(norm='wiscombe'), con m y S conjugados; "
    f"mpmath {mp.__version__} (BSD) a 40 cifras en los casos con |m|·x < 0,1",
    "_generado_por": "tools/mie_fixture.py",
    "casos": cases,
}
path = ROOT / "tests/fixtures/mie.json"
path.write_text(json.dumps(out) + "\n", encoding="utf-8")
print(f"Escrito {path.relative_to(ROOT)} ({len(cases)} casos, {sum(c['referencia'] == 'mpmath' for c in cases)} con mpmath)")
