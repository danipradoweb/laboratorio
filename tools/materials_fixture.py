"""Genera tests/fixtures/materials.json: referencia independiente del importador de materiales.

Uso:  .venv/bin/python tools/materials_fixture.py     (después de `node tools/materials.mjs`)

Lee los archivos originales de la base de datos de refractiveindex.info copiados en
data/materials/originales/ con PyYAML (un lector de YAML completo, distinto del lector
mínimo escrito en JavaScript en tools/refractiveindex-yaml.mjs) y guarda lo que el
importador debería obtener: λ en nm, n y k. tests/materials.test.js compara los JSON de
data/materials/ con este archivo.

Para los materiales dados por una fórmula de dispersión se guarda el índice calculado con
numpy en una malla propia de longitudes de onda.

No edites a mano el archivo generado.
"""

import json
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parent.parent
catalog = json.loads((ROOT / "data/materials/catalogo.json").read_text(encoding="utf-8"))

materials = {}
for entry in catalog["materiales"]:
    doc = yaml.safe_load((ROOT / "data/materials/originales" / f"{entry['id']}.yml").read_text(encoding="utf-8"))
    assert len(doc["DATA"]) == 1, entry["id"]
    block = doc["DATA"][0]
    kind = block["type"]
    if kind in ("tabulated nk", "tabulated n"):
        table = np.array([[float(v) for v in line.split()] for line in block["data"].strip().splitlines()])
        table = table[np.argsort(table[:, 0])]
        materials[entry["id"]] = {
            "tipo": kind,
            "filas": int(table.shape[0]),
            # µm → nm, redondeado a 9 decimales para quitar el ruido binario del producto
            "wavelength_nm": [round(float(v) * 1000, 9) for v in table[:, 0]],
            "n": [float(v) for v in table[:, 1]],
            "k": [float(v) for v in table[:, 2]] if kind == "tabulated nk" else [0.0] * table.shape[0],
        }
    elif kind == "formula 1":
        c = [float(v) for v in str(block["coefficients"]).split()]
        lo, hi = (float(v) for v in str(block["wavelength_range"]).split())
        um = np.linspace(lo, hi, 41)
        n2 = 1 + c[0] + sum(c[j] * um**2 / (um**2 - c[j + 1] ** 2) for j in range(1, len(c) - 1, 2))
        materials[entry["id"]] = {
            "tipo": kind,
            "intervalo_nm": [round(lo * 1000, 9), round(hi * 1000, 9)],
            "coeficientes": c,
            "wavelength_nm": [float(v) * 1000 for v in um],
            "n": [float(v) for v in np.sqrt(n2)],
        }
    else:
        raise SystemExit(f"{entry['id']}: tipo de datos no previsto: {kind}")

out = {
    "_descripcion": "Datos de los materiales leídos con PyYAML de data/materials/originales/ (referencia del importador)",
    "_fuente": f"PyYAML {yaml.__version__}, numpy {np.__version__}; base de datos de refractiveindex.info, commit {catalog['_commit']}",
    "_generado_por": "tools/materials_fixture.py",
    "materiales": materials,
}
path = ROOT / "tests/fixtures/materials.json"
path.write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Escrito {path.relative_to(ROOT)} ({len(materials)} materiales)")
