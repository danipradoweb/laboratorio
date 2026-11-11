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
- Último paso terminado: 5a (plot2d.js: trazador Canvas 2D)
- Siguiente paso: 5b (`src/ui/view3d.js`: envoltorio de three.js)

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
| 5b | `view3d.js` | pendiente |
| 6 | `colormaps.js` (rueda de fase, secuenciales, divergente) | pendiente |
| 7 | `presets.js`, `tours.js`, `clock.js` | pendiente |
| 8 | `presentation.js` | pendiente |
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

## Problemas abiertos

- (resuelto 2026-11-11) El push a GitHub dio 403 al cerrar el paso 1 por falta de permiso de escritura; desde el paso 2a funciona.

## Necesito de Daniel
(archivos que subir, decisiones que tomar; vacío si no hay nada)
