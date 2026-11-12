# Datos del laboratorio: fuentes y licencias

Todo lo que hay en esta carpeta lo generan scripts de `tools/` a partir de fuentes externas. No se edita a mano, salvo `materials/catalogo.json`.

## `cie/`: colorimetría

| Archivo | Contenido | Fuente |
|---|---|---|
| `cmf-cie1931-2deg.json` | Funciones de igualación de color del observador patrón CIE 1931 de 2°, de 360 a 830 nm cada 1 nm | Tablas de la CIE distribuidas por `colour-science` 0.4.7 (licencia BSD-3-Clause) |
| `illuminants.json` | Iluminantes CIE D65 y A (300–780 nm cada 5 nm) y E | Ídem |

Generados por `tools/cie.py`.

## `materials/`: constantes ópticas

Fuente: base de datos de [refractiveindex.info](https://refractiveindex.info) (M. N. Polyanskiy), repositorio `polyanskiy/refractiveindex.info-database`, commit `e6d15e364f70de1cad8a96a20f75689f2fba8b21`. **Licencia: CC0 1.0 Universal (dominio público).** Aunque la licencia no lo exige, se cita el trabajo original de cada material:

| Archivo | Material | Referencia original |
|---|---|---|
| `Au.json`, `Ag.json`, `Cu.json` | Oro, plata, cobre | P. B. Johnson y R. W. Christy, *Phys. Rev. B* **6**, 4370 (1972) |
| `Al.json` | Aluminio | A. D. Rakić, *Appl. Opt.* **34**, 4755 (1995) |
| `AuAg.json` | Aleación Au-Ag 30:70 | D. Rioux et al., *Adv. Opt. Mater.* **2**, 176 (2014) |
| `H2O.json` | Agua | G. M. Hale y M. R. Querry, *Appl. Opt.* **12**, 555 (1973) |
| `SiO2.json` | Sílice fundida | I. H. Malitson, *J. Opt. Soc. Am.* **55**, 1205 (1965) |
| `TiO2.json` | TiO₂, película delgada | T. Siefke et al., *Adv. Opt. Mater.* **4**, 1780 (2016) |
| `Si.json` | Silicio cristalino | C. Schinke et al., *AIP Advances* **5**, 067168 (2015) |

- `materials/originales/`: copia exacta de cada archivo de la base de datos.
- `materials/catalogo.json`: qué materiales hay y sus metadatos (familia, mecanismo, módulos). Se edita a mano.
- `materials/index.json` y `materials/<id>.json`: generados por `tools/materials.mjs`.

Cómo añadir un material: `src/materials/LEEME.md`.
