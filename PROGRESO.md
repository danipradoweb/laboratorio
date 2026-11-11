# Progreso

Registro vivo del estado del laboratorio. Cada sesión lo lee al empezar y lo actualiza al cerrar cada paso.

## Estado general

| Encargo | Estado |
|---|---|
| 00 Base y servicios comunes | en curso |
| 01 Plasmón, Mie y color | pendiente |
| 02 Luz y materia | pendiente |
| 03 Ondas clásicas y función de onda | pendiente |
| 04 Cristales y Bragg | pendiente |

## Sesión en curso
- Encargo: 00 Base y servicios comunes
- Último paso terminado: 8 (modo presentación)
- Siguiente paso: 9 (`src/core/markdown.js` y `src/ui/ficha.js`: fichas con KaTeX)

### Plan del encargo 00 (pasos y estado)

| # | Paso | Estado |
|---|---|---|
| 1 | Andamiaje: `package.json`, `tsconfig.json`, `.nojekyll`, `index.html`, `app.js`, `vendor/`, `tools/serve.mjs`, tests de estructura y humo mínimo | hecho |
| 2a | `units.js` | hecho |
| 2b | `complex.js` | hecho |
| 2c | `fft.js` | hecho |
| 2d | `linalg.js` | hecho |
| 2e | `interp.js` | hecho |
| 3 | `state.js` (estado ↔ URL) | hecho |
| 4 | Interfaz: `theme.js`, `controls.js`, estilos, shell y enrutado en `app.js`, `registry.js`, módulo oculto `_galeria` | hecho |
| 5a | `plot2d.js` | hecho |
| 5b | `view3d.js` | hecho |
| 6 | `colormaps.js` (rueda de fase, secuenciales, divergente) | hecho |
| 7 | `presets.js`, `tours.js`, `clock.js` | hecho |
| 8 | `presentation.js` | hecho |
| 9 | `markdown.js`, `ficha.js` | pendiente |
| 10 | Portada | pendiente |
| 11 | Plantilla `_plantilla/` | pendiente |
| 12a | Oscilador: física y tests | pendiente |
| 12b | Oscilador: vistas | pendiente |
| 12c | Oscilador: presets, recorrido, ficha | pendiente |
| 13 | Prueba de humo completa | pendiente |
| 14 | Revisión con subagente, árbol de `ARQUITECTURA.md` al día, cierre | pendiente |

## Versiones fijadas

| Paquete | Versión | Uso |
|---|---|---|
| three | 0.187.0 | ejecución (copiado en `vendor/three/`) |
| katex | 0.19.1 | ejecución (copiado en `vendor/katex/`) |
| typescript | 7.0.2 | solo `npm run check` (`tsc --noEmit`) |
| @types/three | 0.187.0 | solo tipos |
| @types/node | 22.20.5 | solo tipos |
| culori | 4.0.2 | solo `tools/oklab-fixture.mjs` (referencia de OKLab para tests) |

Entorno de la sesión: Node 22.23, Python 3.13, Playwright + Chromium disponibles.

## Decisiones tomadas
(fecha, decisión, motivo)

- 2026-11-11. **Vendorizado reproducible con `npm run vendor`** (`tools/vendor.mjs`): three y KaTeX son devDependencies con versión exacta y el script copia a `vendor/` solo lo necesario. Motivo: actualizar una librería es cambiar un número y ejecutar un comando; nada se copia a mano.
- 2026-11-11. **Mapa de importación en `index.html`** (`three`, `three/addons/`, `katex` → `./vendor/...`). Motivo: es nativo del navegador, no requiere compilar y evita parchear los addons de three, que importan `'three'` por nombre.
- 2026-11-11. **three sin minificar**: la versión 0.187 ya no publica `three.module.min.js`; se copian `three.module.js` + `three.core.js` (≈2,1 MB, se cargarán en diferido solo al abrir una vista 3D).
- 2026-11-11. **`npm test` usa `node --test "tests/*.test.js"`** (en Node 22 no vale pasar la carpeta). Incluye la prueba de humo, que se omite sola si no hay Playwright; `npm run test:unit` la salta siempre.
- 2026-11-11. **CODATA 2018 desde SciPy**: `tools/codata.py` vuelca la tabla `_physical_constants_2018` de SciPy 1.18.1 a `tests/fixtures/codata2018.json`; `tests/units.test.js` compara contra ese fixture (no contra valores tecleados). Entorno Python en `.venv/` (no versionado), dependencias en `tools/requirements.txt`.
- 2026-11-11. **`tools/serve.mjs`** sirve el repositorio bajo `/laboratorio/` (`npm run serve`) para reproducir GitHub Pages en local. Lo usa la prueba de humo.
- 2026-11-11. **Archivos añadidos a la estructura de la arquitectura** (el árbol de `docs/ARQUITECTURA.md` se pondrá al día en el paso 14): `src/modules/registry.js` (registro único), `src/modules/types.js` (tipos JSDoc del contrato de módulo), `src/core/clock.js` (reloj de animación con pausa y velocidad; se adelantó al paso 4 porque forma parte del `ctx` que recibe cada módulo), `src/ui/module-page.js` (página de módulo: estado, URL, controles, montaje), `src/ui/cover.js` (portada), `src/ui/dom.js` (ayudante `el()` para crear elementos), `src/ui/styles.css`. `app.js` queda solo con el arranque y el enrutado.
- 2026-11-11. **Regla "sin DOM al importar"**: `module.js` y `view.js` solo usan `document` dentro de funciones, para que `tests/modulos.test.js` pueda importar en Node todos los descriptores y validar el contrato (params, presets, recorridos, ficha, archivos).
- 2026-11-11. **La URL se escribe con retardo de 200 ms** tras el último cambio (`history.replaceState`), porque los navegadores limitan la frecuencia de esas llamadas; "Copiar enlace" la escribe al instante antes de copiar.
- 2026-11-11. **`update(state)` se agrupa por fotograma**: varios cambios de estado en el mismo fotograma producen una sola llamada a la vista.
- 2026-11-11. **`store.set` recorta los números fuera de rango** (interacción), mientras que la URL los ignora con aviso (como pide la arquitectura).
- 2026-11-11. **Módulo oculto `_galeria`** (`hidden: true`, `#/_galeria`): banco de pruebas visual de los servicios comunes; lo usa la prueba de humo.
- 2026-11-11. **Trazador 2D en dos archivos**: `src/ui/plot-math.js` (marcas 1-2-5, formato con coma decimal, escalas; puro y testeado en Node) y `src/ui/plot2d.js` (dibujo en canvas). `src/ui/panels.js` crea los paneles con título donde los módulos colocan sus vistas.
- 2026-11-11. **La leyenda de las gráficas va en una fila encima del área de datos**, no dentro: dentro tapaba curvas y etiquetas de marcadores, y así no hay que elegir esquina en cada gráfica.
- 2026-11-11. **Tamaño de letra de las gráficas = `font-size` del contenedor**: el modo presentación solo tendrá que cambiar ese tamaño y llamar a `refreshPlots()`.
- 2026-11-11. **Rueda de fase en OKLCH con L = 0,72 y C = 0,12** (fase 0 = rojo, tono 30°). Son, con margen, los mayores valores que caben en sRGB para todos los tonos tanto al fundir a negro como a blanco (calculado con culori). Colores algo apagados a cambio de uniformidad perceptual. El fundido al fondo es lineal en OKLab: negro en tema oscuro, blanco en tema claro.
- 2026-11-11. **Mapa divergente = RdBu invertido de ColorBrewer** (vía matplotlib, Apache 2.0), no `vik`: al medirlo, `vik` tiene una asimetría de luminosidad de hasta 0,09 (L de OKLab) entre +v y −v; RdBu_r, 0,02. El test falló con `vik` y se investigó en vez de relajar el umbral. Secuenciales: viridis y magma (matplotlib, CC0). Tablas generadas con `tools/colormaps.py` en `src/ui/colormap-data.js`.
- 2026-11-11. **`culori` 4.0.2 como devDependency** solo para `tools/oklab-fixture.mjs`, que genera el fixture con el que se comprueban las matrices OKLab de `colormaps.js`.
- 2026-11-11. **`update(state)` se vuelve a llamar al cambiar el tema**, para que las vistas coloreadas según el fondo se rehagan sin código propio en cada módulo.
- 2026-11-11. **Transiciones**: `createTransition` interpola con la curva 3t²−2t³ durante 1,5 s (configurable) y entrega exactamente el estado de destino en el último fotograma; los parámetros discretos cambian al final. Si el usuario toca un control, edita la URL o hace clic en una vista durante una transición, esta se cancela (manda el usuario).
- 2026-11-11. **Un preset fija sus claves y deja el resto en su valor por defecto** (no en el valor actual), para que un preset reproduzca siempre el mismo estado.
- 2026-11-11. **Piezas de interfaz en archivos pequeños**: `src/ui/preset-list.js`, `src/ui/tour-bar.js`, `src/ui/clock-controls.js`; `module-page.js` solo las conecta. Los controles de animación solo aparecen si el descriptor tiene `animated: true`.
- 2026-11-11. **Modo presentación solo con CSS + un atributo**: `data-presentation="true"` en `<html>`; el lienzo es `min(100vw, 177,78vh)` de ancho y 16:9, y el tamaño de letra raíz es 1/96 de ese ancho (20 px a 1080p), de modo que toda la interfaz en `rem` y las gráficas escalan juntas.
- 2026-11-11. **Atajos añadidos a los de la arquitectura**: `C` cambia el tema (además del selector flotante), `RePág`/`AvPág` mueven el recorrido (es lo que envían los mandos de presentación) y las flechas del recorrido funcionan también fuera del modo presentación. En teclados españoles los corchetes valen con AltGr y también con las dos teclas físicas a la derecha de la P.
- 2026-11-11. **`ctx.theme` y `ctx.presentation`** añadidos al contexto de los módulos, como describe la arquitectura.

## Problemas abiertos

- (resuelto 2026-11-11) El push a GitHub dio 403 al cerrar el paso 1 por falta de permiso de escritura; desde el paso 2a funciona.

## Necesito de Daniel
(archivos que subir, decisiones que tomar; vacío si no hay nada)
