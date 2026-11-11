"""Genera tests/fixtures/linalg.json: autovalores de referencia de matrices tridiagonales.

Uso:  .venv/bin/python tools/linalg_fixture.py

Referencia independiente: scipy.linalg.eigh_tridiagonal (LAPACK). Se usa en
tests/linalg.test.js para comprobar src/core/linalg.js. No lo edites a mano.
"""

import json
from pathlib import Path

import numpy as np
import scipy
from scipy.linalg import eigh_tridiagonal

cases = {}

# Matriz de Wilkinson W21+: diagonal |i − 10|, fuera de la diagonal 1. Sus autovalores
# más altos forman parejas casi degeneradas (coinciden en ~14 cifras): es la prueba
# clásica para algoritmos de autovalores tridiagonales.
d = np.abs(np.arange(21) - 10).astype(float)
e = np.ones(20)
cases["wilkinson21"] = {"diag": d.tolist(), "off": e.tolist(), "values": eigh_tridiagonal(d, e)[0].tolist()}

# Matriz tridiagonal aleatoria (semilla fija), sin estructura especial.
rng = np.random.default_rng(20261111)
d = rng.normal(size=40)
e = rng.normal(size=39)
cases["aleatoria40"] = {"diag": d.tolist(), "off": e.tolist(), "values": eigh_tridiagonal(d, e)[0].tolist()}

# Oscilador armónico cuántico discretizado: H = −½ d²/dx² + ½ x² en x ∈ [−10, 10],
# 400 puntos interiores (ħ = m = ω = 1). Autovalores cercanos a n + ½.
n = 400
x = np.linspace(-10, 10, n + 2)[1:-1]
h = x[1] - x[0]
d = 1.0 / h**2 + 0.5 * x**2
e = np.full(n - 1, -0.5 / h**2)
cases["oscilador400"] = {
    "n": n,
    "xmin": -10.0,
    "xmax": 10.0,
    "values": eigh_tridiagonal(d, e, select="i", select_range=(0, 7))[0].tolist(),
}

out = {
    "_fuente": f"scipy.linalg.eigh_tridiagonal, SciPy {scipy.__version__}, NumPy {np.__version__}",
    "_generado_por": "tools/linalg_fixture.py",
    **cases,
}
path = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "linalg.json"
path.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
print(f"Escrito {path}")
