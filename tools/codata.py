"""Genera tests/fixtures/codata2018.json con las constantes CODATA 2018.

Uso:  .venv/bin/python tools/codata.py

Fuente: tablas CODATA 2018 de NIST tal como las distribuye SciPy en
scipy.constants._codata (tabla `_physical_constants_2018`). Las constantes
fundamentales de NIST son de dominio público; SciPy tiene licencia BSD-3.

El fixture es la referencia independiente contra la que se comprueba
src/core/units.js (tests/units.test.js). No lo edites a mano.
"""

import json
from pathlib import Path

import scipy
from scipy.constants import _codata

NAMES = {
    # clave del fixture: nombre exacto en la tabla CODATA
    "h": "Planck constant",
    "hbar": "reduced Planck constant",
    "c": "speed of light in vacuum",
    "e": "elementary charge",
    "m_e": "electron mass",
    "epsilon_0": "vacuum electric permittivity",
    "k_B": "Boltzmann constant",
    # Magnitudes derivadas, usadas como comprobación cruzada de las anteriores:
    "alpha": "fine-structure constant",
    "rydberg_eV": "Rydberg constant times hc in eV",
    "bohr_radius": "Bohr radius",
    "eV_in_J": "electron volt-joule relationship",
    "hartree_eV": "Hartree energy in eV",
}

table = _codata._physical_constants_2018
out = {
    "_fuente": f"CODATA 2018 (NIST) vía scipy.constants._codata, SciPy {scipy.__version__}",
    "_licencia": "Datos de NIST en dominio público; SciPy BSD-3-Clause",
    "_generado_por": "tools/codata.py",
}
for key, name in NAMES.items():
    value, unit, uncertainty = table[name]
    out[key] = {"nombre": name, "valor": value, "unidad": unit, "incertidumbre": uncertainty}

path = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "codata2018.json"
path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Escrito {path}")
