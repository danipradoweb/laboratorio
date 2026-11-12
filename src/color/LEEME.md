# Motor espectro → color

Convierte un espectro (transmitancia, reflectancia o luz emitida) en el color que se ve en pantalla. Lo usa el módulo `plasmon` y lo usarán los de luz y materia.

## Uso desde un módulo

`mount` debe ser asíncrona, porque las tablas de la CIE se descargan la primera vez.

```js
export async function mount(container, ctx) {
  const color = await ctx.color.load();

  // Un filtro, una disolución, un vidrio: espectro de transmitancia (0–1) bajo luz de día.
  const c = color.colorOf({ wavelengths: [380, 500, 600, 780], values: [0.9, 0.2, 0.7, 0.9] });
  caja.style.background = c.css;      // 'rgb(…)'
  if (!c.inGamut) aviso.textContent = 'color recortado a la gama de la pantalla';
  c.lab;                               // [L*, a*, b*]: a* > 0 tira a rojo, b* > 0 a amarillo
  c.XYZ[1];                            // fracción de la luz que pasa, ponderada por el ojo
  …
}
```

| Qué quieres | Función |
|---|---|
| Color de una transmitancia o reflectancia bajo un iluminante (`'D65'` por defecto, `'A'`, `'E'`) | `color.colorOf(espectro, { illuminant })` |
| Tono de una luz dispersada o reflejada cuya intensidad no importa (se muestra al mayor brillo posible) | `color.colorOfScattered(espectro)` |
| Color de una luz emitida, con la luminancia que tú fijes | `color.colorOfLight(espectro, { Y })` |
| Color aproximado de una longitud de onda (para pintar el arcoíris) | `color.wavelengthToSrgb(nm)` |
| Diferencia entre dos colores | `deltaE(lab1, lab2)` de `spectrum.js` |

Fuera de un módulo (tests, herramientas): `import { loadColorEngine } from 'src/color/spectrum.js'`.

## Reglas

- Un **espectro** es `{ wavelengths, values }`: longitudes de onda en nm, estrictamente crecientes, y un valor por cada una. Entre puntos se interpola linealmente.
- Debe cubrir **al menos de 380 a 780 nm**. Si no, el motor lanza un error en vez de inventar el tramo que falta.
- Se integra de 1 en 1 nm con el observador CIE 1931 de 2°. Un espectro igual a 1 da Y = 1.
- **No hay adaptación cromática**: el color es el que vería un ojo adaptado a D65. Un blanco bajo el iluminante A sale anaranjado.
- Si el color no cabe en sRGB se recorta canal a canal y `inGamut` vale `false`. Hay que decírselo al usuario.

## Archivos

- `cie.js`: carga `data/cie/` y lo coloca todo en una malla de 360 a 830 nm cada 1 nm. Los iluminantes D65 y A están tabulados hasta 780 nm y no se extrapolan.
- `spectrum.js`: la cadena espectro → XYZ → sRGB lineal → gamma, CIELAB y la fachada `createColorEngine`. Todo funciones puras, cada paso exportado.
- Datos: `data/cie/` (generados por `tools/cie.py` con `colour-science`; ver `data/README.md`).
- Tests: `tests/color.test.js` (cromaticidades publicadas por la CIE y comparación con `colour-science`).
