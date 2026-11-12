"""Genera los datos colorimétricos de data/cie/ y las referencias del motor de color.

Uso:  .venv/bin/python tools/cie.py

Escribe:
  data/cie/cmf-cie1931-2deg.json   funciones de igualación CIE 1931 2° (360–830 nm, 1 nm)
  data/cie/illuminants.json        iluminantes CIE D65, A y E tal como están tabulados
  tests/fixtures/color.json        casos espectro → XYZ → sRGB → CIELAB calculados con
                                   colour-science (referencia independiente del motor
                                   de src/color/)

Fuente: paquete `colour-science` (https://www.colour-science.org), licencia BSD-3-Clause,
que distribuye las tablas publicadas por la CIE (CIE 15:2004 y CVRL). Las tablas se
guardan sin transformar: el paso a 1 nm de los iluminantes lo hace src/color/cie.js por
interpolación lineal (la que recomienda la CIE para D65).

No edites a mano los archivos generados.
"""

import json
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")
import colour  # noqa: E402
from colour.algebra import LinearInterpolator  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SOURCE = f"colour-science {colour.__version__} (BSD-3-Clause); tablas de la CIE"
GENERATED = "tools/cie.py"


def write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Escrito {path.relative_to(ROOT)}")


def numbers(values) -> list:
    """Lista de números de Python con todos sus dígitos (sin redondear)."""
    return [float(v) for v in values]


# --- Funciones de igualación CIE 1931 2° ----------------------------------------------
cmfs = colour.MSDS_CMFS["CIE 1931 2 Degree Standard Observer"]
assert (cmfs.shape.start, cmfs.shape.end, cmfs.shape.interval) == (360, 830, 1)
write(
    ROOT / "data/cie/cmf-cie1931-2deg.json",
    {
        "_descripcion": "Funciones de igualación de color del observador patrón CIE 1931 de 2°",
        "_fuente": SOURCE,
        "_conjunto": "colour.MSDS_CMFS['CIE 1931 2 Degree Standard Observer']",
        "_generado_por": GENERATED,
        "start_nm": 360,
        "step_nm": 1,
        "xbar": numbers(cmfs.values[:, 0]),
        "ybar": numbers(cmfs.values[:, 1]),
        "zbar": numbers(cmfs.values[:, 2]),
    },
)

# --- Iluminantes -----------------------------------------------------------------------
illuminants = {}
for name, description in [
    ("D65", "Luz de día media, temperatura de color correlacionada ≈ 6504 K"),
    ("A", "Lámpara de incandescencia (radiador de Planck a ≈ 2856 K)"),
    ("E", "Espectro de igual energía (constante)"),
]:
    sd = colour.SDS_ILLUMINANTS[name]
    illuminants[name] = {
        "descripcion": description,
        "start_nm": float(sd.shape.start),
        "step_nm": float(sd.shape.interval),
        "values": numbers(sd.values),
    }
write(
    ROOT / "data/cie/illuminants.json",
    {
        "_descripcion": "Distribución espectral relativa de potencia de los iluminantes CIE",
        "_fuente": SOURCE,
        "_conjunto": "colour.SDS_ILLUMINANTS",
        "_generado_por": GENERATED,
        "illuminants": illuminants,
    },
)

# --- Casos de referencia para el motor de color ----------------------------------------
# Espectros de reflectancia reales (carta ColorChecker medida por Ohta, 380–780 nm cada
# 5 nm, incluida en colour-science) y dos espectros sintéticos. Todo se calcula con las
# funciones de colour-science, no con fórmulas escritas aquí.
SHAPE = colour.SpectralShape(380, 780, 1)
# colour-science usa por defecto la matriz de sRGB redondeada a 4 decimales de la norma
# IEC 61966-2-1. Aquí se le pide la matriz derivada de las cromaticidades de los
# primarios y del blanco, que es la definición de la que parte src/color/spectrum.js.
colour.RGB_COLOURSPACES["sRGB"].use_derived_transformation_matrices(True)


def reference_case(name: str, wavelengths, values, illuminant_name: str) -> dict:
    sd = colour.SpectralDistribution(dict(zip(wavelengths, values)), name=name)
    sd.interpolator = LinearInterpolator  # la misma interpolación que el motor
    illuminant = colour.SDS_ILLUMINANTS[illuminant_name]
    xyz = colour.sd_to_XYZ(sd, cmfs, illuminant, method="Integration", shape=SHAPE) / 100
    white = colour.sd_to_XYZ(colour.sd_ones(SHAPE), cmfs, illuminant, method="Integration", shape=SHAPE) / 100
    linear = colour.XYZ_to_sRGB(xyz, apply_cctf_encoding=False)
    encoded = colour.XYZ_to_sRGB(xyz, apply_cctf_encoding=True)
    lab = colour.XYZ_to_Lab(xyz, colour.XYZ_to_xy(white))
    return {
        "nombre": name,
        "iluminante": illuminant_name,
        "wavelength_nm": numbers(wavelengths),
        "values": numbers(values),
        "XYZ": numbers(xyz),
        "xy": numbers(colour.XYZ_to_xy(xyz)),
        "blanco_XYZ": numbers(white),
        "sRGB_lineal": numbers(linear),
        "sRGB": numbers(encoded),
        "Lab": numbers(lab),
    }


cases = []
checker = colour.SDS_COLOURCHECKERS["ColorChecker N Ohta"]
for patch in ["dark skin", "blue", "green", "red", "yellow", "cyan", "white 9.5 (.05 D)", "neutral 5 (.70 D)"]:
    sd = checker[patch]
    for illuminant_name in ["D65", "A", "E"] if patch in ("red", "cyan") else ["D65"]:
        cases.append(reference_case(f"ColorChecker: {patch}", sd.wavelengths, sd.values, illuminant_name))

grid = np.arange(380.0, 781.0, 10.0)
# Filtro de banda gaussiano centrado en 530 nm (verde saturado) y rampa lineal (rojizo).
cases.append(reference_case("sintético: banda gaussiana 530 nm", grid, np.exp(-0.5 * ((grid - 530) / 20) ** 2), "D65"))
cases.append(reference_case("sintético: rampa lineal 0→1", grid, (grid - 380) / 400, "D65"))

write(
    ROOT / "tests/fixtures/color.json",
    {
        "_descripcion": "Casos espectro → XYZ → sRGB → CIELAB (Y del reflector perfecto = 1)",
        "_fuente": SOURCE + "; sd_to_XYZ(method='Integration', 380–780 nm, 1 nm), "
        "XYZ_to_sRGB con matrices derivadas, XYZ_to_Lab con el blanco del iluminante",
        "_generado_por": GENERATED,
        "casos": cases,
    },
)
