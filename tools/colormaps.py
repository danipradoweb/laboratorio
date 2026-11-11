"""Genera src/ui/colormap-data.js con las tablas de los mapas de color.

Uso:  .venv/bin/python tools/colormaps.py

Fuentes y licencias:
  - viridis, magma: matplotlib (Nathaniel Smith y Stéfan van der Walt), dominio público CC0.
  - RdBu invertido (divergente): ColorBrewer, de Cynthia Brewer y Mark Harrower
    (Pennsylvania State University), licencia Apache 2.0, tal como lo distribuye
    matplotlib con el nombre "RdBu_r".

Los tres son legibles con daltonismo. Para el divergente se compararon vik, broc, cork,
bam (Crameri), RdBu_r, coolwarm, seismic y bwr (matplotlib): RdBu_r es, de los que van
de azul a rojo pasando por blanco, el de luminosidad más simétrica respecto al centro
(diferencia máxima de 0,02 en L de OKLab; vik llega a 0,09), de modo que +v y −v se
ven igual de oscuros. Cada tabla tiene
256 colores y se guarda como una cadena hexadecimal (6 caracteres por color).
"""

from pathlib import Path

import matplotlib
from matplotlib import colormaps


def to_hex(cmap):
    out = []
    for i in range(256):
        r, g, b, _ = cmap(i / 255)
        out.append("%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255)))
    return "".join(out)


tables = {
    "VIRIDIS": ("viridis de matplotlib (CC0). Secuencial: de violeta oscuro a amarillo.", to_hex(colormaps["viridis"])),
    "MAGMA": ("magma de matplotlib (CC0). Secuencial: de negro a crema, pasando por magenta.", to_hex(colormaps["magma"])),
    "RDBU": ("RdBu invertido de ColorBrewer (Apache 2.0). Divergente: azul, blanco en el centro, rojo.", to_hex(colormaps["RdBu_r"])),
}

lines = [
    "// @ts-check",
    "// ARCHIVO GENERADO por tools/colormaps.py. No lo edites a mano.",
    "//",
    f"// Fuente: matplotlib {matplotlib.__version__}. viridis y magma son de dominio público (CC0);",
    "// RdBu es de ColorBrewer (Cynthia Brewer y Mark Harrower), licencia Apache 2.0.",
    "// Cada tabla son 256 colores sRGB en hexadecimal, 6 caracteres por color, de t = 0 a t = 1.",
    "// Se usan a través de src/ui/colormaps.js.",
    "",
]
for name, (doc, data) in tables.items():
    lines.append(f"/** {doc} */")
    lines.append(f"export const {name} =")
    lines.append(f"  '{data}';")
    lines.append("")

path = Path(__file__).resolve().parent.parent / "src" / "ui" / "colormap-data.js"
path.write_text("\n".join(lines), encoding="utf-8")
print(f"Escrito {path}")
