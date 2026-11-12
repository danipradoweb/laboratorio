# Biblioteca de materiales

Constantes ópticas n(λ) y k(λ) de materiales reales, con su fuente bibliográfica, su licencia y una explicación breve de por qué tienen el color que tienen.

## Uso desde un módulo

`mount` debe ser asíncrona: cada material se descarga la primera vez que se pide.

```js
import { createOpticalConstants } from '../../materials/dielectric.js';

export async function mount(container, ctx) {
  const oro = await ctx.materials.load('Au');
  oro.nombre;               // 'Oro'
  oro.familia;              // 'metal'
  oro.mecanismo;            // por qué es amarillo, en una frase
  oro.fuente.referencia;    // 'P. B. Johnson and R. W. Christy. …'

  const optica = createOpticalConstants(oro);
  optica.range;             // [187.9, 1937]  intervalo tabulado, en nm
  optica.covers(532);       // true
  optica.nk(532);           // { n, k }
  optica.epsilon(532);      // ε = (n + ik)², complejo { re, im }

  const todos = await ctx.materials.list();   // resumen de todos, sin descargar las tablas
  …
}
```

## Reglas

- λ es siempre la longitud de onda **en el vacío**, en nm.
- Convenio e^{−iωt}: absorber es k > 0 e Im ε > 0.
- **Fuera del intervalo tabulado se lanza un error** (`RangeError`). Comprueba antes con `covers(λ)` o limita el control de λ al intervalo común de los materiales que ofrezcas. Solo si de verdad quieres prolongar con el valor del extremo: `createOpticalConstants(material, { outOfRange: 'clamp' })`.
- La interpolación es lineal en n y k. Con tablas densas y suaves puedes pedir `{ interpolation: 'spline' }`.
- Modelos paramétricos, para cuando no hay datos o se quiere entender el mecanismo: `drudeEpsilon` (electrones libres) y `lorentzEpsilon` (electrones ligados), en `dielectric.js`.

## Materiales disponibles

| id | Material | Fuente | Intervalo (nm) |
|---|---|---|---|
| `Au` | Oro | Johnson & Christy 1972 | 188–1937 |
| `Ag` | Plata | Johnson & Christy 1972 | 188–1937 |
| `Cu` | Cobre | Johnson & Christy 1972 | 188–1937 |
| `Al` | Aluminio | Rakić 1995 | 0,12–200000 |
| `AuAg` | Aleación oro-plata 30:70 | Rioux et al. 2014 (modelo ajustado) | 270–1200 |
| `H2O` | Agua | Hale & Querry 1973 | 200–200000 |
| `SiO2` | Sílice fundida | Malitson 1965 (fórmula de Sellmeier, k = 0) | 210–6700 |
| `TiO2` | Dióxido de titanio, película delgada | Siefke et al. 2016 | 120–125000 |
| `Si` | Silicio cristalino | Schinke et al. 2015 | 250–1450 |

La lista al día, con las referencias completas, está en `data/materials/index.json`.

## Añadir un material

1. Busca el material en [refractiveindex.info](https://refractiveindex.info) y anota la ruta de su archivo en la base de datos (por ejemplo `main/Pt/nk/Rakic-LD.yml`; se ve en el enlace «Data [Full database record]» de la página).
2. Añade una entrada a `data/materials/catalogo.json` (es el único archivo de esa carpeta que se edita a mano) con `id`, `nombre`, `formula`, `archivo`, `pagina`, `familia`, `mecanismo` y `modulos`. Escribe `mecanismo` con cuidado: es física que leerá el usuario.
3. Ejecuta `node tools/materials.mjs` (descarga el original a `data/materials/originales/` y genera el JSON y el índice) y después `.venv/bin/python tools/materials_fixture.py` (pone al día la referencia de los tests).
4. `npm test`. Si el importador dice que no admite el tipo de datos del archivo (admite `tabulated nk`, `tabulated n` y `formula 1`), amplía `tools/refractiveindex-yaml.mjs` y añade su test en `tests/materials.test.js`.
5. Añade la fila a la tabla de este archivo y a `data/README.md`.

## Archivos

- `library.js`: carga y valida los JSON (`loadMaterial`, `loadMaterialIndex`, `validateMaterial`).
- `dielectric.js`: `nkToEpsilon`, `epsilonToNk`, `createOpticalConstants`, `drudeEpsilon`, `lorentzEpsilon`.
- Datos: `data/materials/` (ver `data/README.md` para fuentes y licencia).
- Tests: `tests/materials.test.js`.
