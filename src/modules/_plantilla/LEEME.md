# Cómo crear un módulo nuevo

Esta carpeta es un módulo pequeño que funciona (ábrelo en `#/_plantilla`) y que sirve de punto de partida. Sigue los pasos en orden. Cada paso termina con algo que puedes comprobar.

Antes de empezar, lee `docs/ARQUITECTURA.md` (secciones "Principios no negociables" y "Contrato de un módulo").

## 1. Copia la plantilla

Elige un identificador corto en minúsculas, sin espacios ni tildes (ejemplo: `tunel`). Será el nombre de la carpeta y aparecerá en la URL (`#/tunel`).

```
cp -r src/modules/_plantilla src/modules/tunel
cp tests/_plantilla.test.js tests/tunel.test.js
rm src/modules/tunel/LEEME.md
```

## 2. Regístralo (único sitio)

En `src/modules/registry.js` haz dos cosas, sin borrar nada de lo que ya hay:

1. Añade una línea `import` junto a las demás:

```js
import tunel from './tunel/module.js';
```

2. Añade `tunel` a la lista `modules`, dejando los que ya están. Por ejemplo, si la lista era `[oscilador, galeria, plantilla]`:

```js
export const modules = [oscilador, tunel, galeria, plantilla];
```

El orden de la lista es el orden de las tarjetas en la portada. No quites ningún módulo de la lista: `tests/modulos.test.js` falla si una carpeta de `src/modules/` no está registrada.

## 3. Rellena el descriptor: `module.js`

- Cambia `id` (igual que la carpeta), `title` y `summary`.
- Borra la línea `hidden: true` para que salga en la portada.
- Deja `animated: true` solo si el módulo tiene animación.
- `transitionSeconds` es opcional: duración de la transición entre presets (por defecto 1,5 s).
- Escribe `params`: un parámetro por cada cosa que el usuario pueda cambiar. De aquí salen los controles y la URL; no se crean controles a mano en ningún otro sitio.
- Deja `presets: []` y `tours: []` vacíos por ahora.

Comprueba: `npm test` (el test `tests/modulos.test.js` valida el descriptor y te dice qué falta).

## 4. Escribe la física: `physics.js` y `tests/<id>.test.js`

Primero la física, antes que cualquier dibujo.

- Funciones puras: números de entrada, números de salida. Sin `document`, sin canvas.
- Constantes físicas: `import { HBAR, M_E } from '../../core/units.js'`. Nunca tecleadas.
- Matemáticas ya disponibles en `src/core/`: `complex.js`, `fft.js`, `linalg.js` (tridiagonal, autovalores), `interp.js`.
- En el archivo de tests, cambia el `import` para que apunte a tu módulo y escribe un test por función. Cada test lleva un comentario con el principio físico que comprueba y de dónde sale el valor esperado. Orden de preferencia: solución analítica exacta, límite conocido, ley de conservación, referencia independiente generada con `tools/`, valor experimental.
- Si un test falla, investiga el código o la referencia. No cambies el valor esperado para que pase.

Comprueba: `npm test` en verde.

## 5. Dibuja: `view.js`

- `mount(container, ctx)` crea los paneles y las gráficas y devuelve `{ update, destroy }`.
- `update(state)` recibe el estado completo y lo redibuja todo llamando a `physics.js`.
- Mapas de color: lee el convenio de malla en `src/ui/plot2d.js` (comentario de `Heatmap`): los rangos son los bordes y cada valor está en el centro de su celda.
- Gráficas 2D: `createPlot` de `src/ui/plot2d.js` (series con línea o con puntos, áreas, bandas, marcadores, mapas de color, imágenes). Los rótulos de los ejes son texto plano: usa caracteres Unicode (`ω₀`, `ψ`, `²`), no TeX.
- 3D: `createView3D` de `src/ui/view3d.js`. Es asíncrona: `mount` debe ser `async` y usar `await`. Mira `src/modules/_galeria/view.js`.
- Funciones complejas: `colorizeComplex` y `createPhaseWheel` de `src/ui/colormaps.js`. La rueda de fase debe estar siempre visible junto a cualquier vista coloreada por fase.
- Vistas enlazadas: la opción `onPick` de una gráfica llama a `ctx.setState({ … })`; el resto se actualiza solo.
- Materiales reales (n, k, ε de oro, plata, agua, sílice…): `await ctx.materials.load('Au')`. Lee `src/materials/LEEME.md`.
- Color de un espectro (qué color tiene una disolución, un filtro, una lámina): `await ctx.color.load()`. Lee `src/color/LEEME.md`.
- Los dos servicios anteriores descargan datos, así que `mount` debe ser `async`. Ejemplo completo: `src/modules/plasmon/view.js`.
- Colocación de los paneles: añade al final de `src/ui/styles.css` una regla para tu rejilla, copiando la de `.plantilla-grid`.

Comprueba: `npm run serve`, abre `http://127.0.0.1:8080/laboratorio/#/<id>` y mueve los controles. Mira la consola del navegador: no debe haber errores.

## 6. Presets y recorrido

- `presets`: estados con nombre (máximo 9). Solo las claves que cambian respecto a los valores por defecto.
- `tours`: lista de pasos `{ preset, text }`. El texto es Markdown breve; las fórmulas van entre `$…$` y en JavaScript las barras invertidas se escriben dobles (`'$\\omega_0$'`).

Comprueba: `npm test` (valida que cada preset usa claves y valores válidos y que cada paso cita un preset que existe).

## 7. Escribe la ficha: `ficha.md`

Cinco secciones, con estos títulos exactos y en este orden: `## Qué estás viendo`, `## Qué es físico y qué es representación`, `## Ecuaciones`, `## Límites del modelo`, `## Referencias`. Breve: la ficha explica lo que se ve en pantalla, no es un libro de texto. Si algo no es observable (la fase global de ψ, por ejemplo), dilo.

Markdown admitido: títulos, párrafos, listas, `**negrita**`, `*cursiva*`, `` `código` ``, enlaces y fórmulas `$…$` y `$$…$$`. No hay tablas ni imágenes.

## 8. Miniatura y comprobación final

1. En `module.js`, descomenta `thumbnail: 'miniatura.png'` y ejecuta `npm run miniaturas <id>`.
2. `npm test` y `npm run check` en verde. La prueba de humo abre tu módulo en los dos temas, abre la ficha y falla si hay cualquier error en la consola.
3. Prueba a mano: copiar el enlace y abrirlo en otra pestaña reproduce lo mismo; los presets hacen la transición; la tecla P entra en modo presentación y las teclas 1–9 saltan a los presets.
4. Actualiza `PROGRESO.md`.

## Errores frecuentes

| Síntoma | Causa |
|---|---|
| `la carpeta src/modules/x/ no está registrada` | Falta el paso 2. |
| `physics.js no puede usar "document."` | Has puesto dibujo en la física: muévelo a `view.js`. |
| `physics.js contiene "6.626"` | Constante tecleada: impórtala de `src/core/units.js`. |
| La web no carga y la consola dice `Cannot use 'document'` al importar | Hay código con `document` fuera de una función en `module.js` o `view.js`. |
| La gráfica no se ve | Su contenedor no tiene altura: usa `addPanel(...)` y dibuja en `panel.body`. |
| Una fórmula del recorrido sale mal | Falta doblar las barras invertidas en el texto JavaScript. |
| 404 al publicar en GitHub Pages | Hay una ruta que empieza por `/`: todas deben ser relativas. |
