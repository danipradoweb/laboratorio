# Progreso

Registro vivo del estado del laboratorio. Cada sesión lo lee al empezar y lo actualiza al cerrar cada paso.

## Estado general

| Encargo | Estado |
|---|---|
| 00 Base y servicios comunes | **terminado** (2026-11-11), revisado |
| 01 Plasmón, Mie y color | pendiente |
| 02 Luz y materia | pendiente |
| 03 Ondas clásicas y función de onda | pendiente |
| 04 Cristales y Bragg | pendiente |

## Sesión en curso
- Encargo: 00 Base y servicios comunes (terminado). El siguiente es `docs/encargos/01-plasmon-mie.md`.
- Último paso terminado: 14 (revisión independiente, correcciones y cierre). Encargo 00 terminado
- Siguiente paso: encargo 01 (`docs/encargos/01-plasmon-mie.md`), en una sesión nueva

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
| 9 | `markdown.js`, `ficha.js` | hecho |
| 10 | Portada | hecho |
| 11 | Plantilla `_plantilla/` | hecho |
| 12a | Oscilador: física y tests | hecho |
| 12b | Oscilador: vistas | hecho |
| 12c | Oscilador: presets, recorrido, ficha | hecho |
| 13 | Prueba de humo completa | hecho |
| 14 | Revisión con subagente, árbol de `ARQUITECTURA.md` al día, cierre | hecho |

### Cómo queda el encargo 00

- `npm test`: 193 tests en verde (169 unitarios y de contrato de módulos + 24 de humo con navegador sin cabeza). `npm run check`: limpio.
- Módulos registrados: `oscilador` (visible en la portada), `_galeria` y `_plantilla` (ocultos, se abren por su dirección).
- Para un módulo nuevo: `src/modules/_plantilla/LEEME.md`.
- Comandos además de los de `CLAUDE.md`: `npm run serve` (web en `http://127.0.0.1:8080/laboratorio/`), `npm run test:unit` (sin navegador), `npm run miniaturas [id]`, `npm run vendor`.
- Para regenerar datos y referencias: `python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt`, y después los scripts de `tools/`.
- La rama de trabajo es `claude/nifty-pascal-etf0j1`. **No está fusionada en `main`**: GitHub Pages no mostrará nada hasta que se fusione (ver "Necesito de Daniel").

### Revisión independiente (paso 14)

Un subagente con contexto limpio revisó solo la física y el cumplimiento del encargo, con scripts propios (no los tests del proyecto). Una ronda.

- **Sin errores** en la física del oscilador (régimen estacionario, convenio de signos, potencia, media potencia, máximo de amplitud, solución analítica en los tres regímenes, RK4), en `units`, `fft`, `interp`, `colormaps` ni en la plantilla. Ningún test con valor esperado o tolerancia ajustados para pasar.
- **Corregido** (cada punto con su test):
  1. Rótulos de ejes que podían mostrar un número distinto del valor de la marca (marcas cada 0,25 → «0,3»; intervalos muy estrechos → rótulos repetidos). Ahora `formatTicks` añade decimales hasta que todas las marcas se leen exactas.
  2. `eigTridiagonal` devolvía `NaN` con la matriz nula.
  3. `arg` y `log` de un real negativo con parte imaginaria −0 daban −π en vez de +π.
  4. Ficha del oscilador: «Im χ proporcional a la potencia» → ⟨P⟩ = ½·ω·F₀²·Im χ; «Q oscilaciones dura el transitorio» → cae un factor e cada Q/π oscilaciones.
  5. Vista del oscilador: con γ = 0,02 la curva dibujada quedaba un 2–3 % por debajo del pico real (malla uniforme); ahora hay una malla fina en ω₀ ± 6γ. Los títulos y la leyenda dicen que el desfase marcado es el del régimen estacionario.
  6. Convenio de mallas de los mapas de color (bordes frente a centros de celda): fijado y documentado en `plot2d.js`; la galería lo cumple.
  7. Requisito a medias: duración de la transición configurable → campo opcional `transitionSeconds` en el descriptor.
  8. Requisito a medias: «funciona sin conexión una vez cargado» → la ficha y KaTeX se precargan en un rato libre al abrir el módulo.
  9. `LEEME.md` de la plantilla: el ejemplo del registro omitía módulos existentes.
  10. Tests: cota del transitorio derivada de las condiciones iniciales en lugar de una constante sin justificar; comentarios de principio que faltaban; una comprobación tautológica sustituida.
- **Anotado en `docs/BACKLOG.md`** (sección "Pendientes de la revisión del encargo 00"): límites de escala y coste de `linalg.js`, uniformidad de la rueda de fase medida en otro espacio de color, funcionamiento sin conexión completo, duración de transición por preset.
- **No verificado**: las referencias bibliográficas de las fichas (Feynman I, caps. 21, 23, 24 y 49; Griffiths 4.ª ed. §9.4.3; Bohren y Huffman §9.1) no se han cotejado con los libros delante. Conviene que Daniel las compruebe.

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
- 2026-11-11. **Convenio de mallas**: en los mapas de `plot2d.js` los rangos son los bordes del rectángulo y cada valor está en el centro de su celda; en `view3d.addSurface` cada valor es un vértice y los rangos son el primer y el último vértice. Documentado en ambos archivos.
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
- 2026-11-11. **Markdown mínimo propio** (`src/core/markdown.js`, puro y con tests): títulos, párrafos, listas, negrita, cursiva (solo con asteriscos, para no chocar con los guiones bajos de TeX), código, enlaces y fórmulas `$…$` / `$$…$$`. Sin tablas, imágenes ni listas anidadas. Las fórmulas se apartan antes de interpretar nada, así que el TeX llega intacto a KaTeX.
- 2026-11-11. **La ficha se busca por convenio** en `src/modules/<id>/ficha.md` (no hace falta declararla en el descriptor) y se descarga al abrir el panel. KaTeX y su hoja de estilos se cargan en diferido la primera vez que hay una fórmula; si fallara, las fórmulas quedan como texto TeX.
- 2026-11-11. **Abrir la ficha pliega el panel de controles** en ventanas de menos de 1500 px (no caben controles, vistas y ficha a la vez) y lo restaura al cerrarla.
- 2026-11-11. **Miniaturas**: el descriptor declara `thumbnail: 'miniatura.png'` y `npm run miniaturas` (`tools/miniaturas.mjs`, Playwright) genera una captura de 640 × 360 del módulo en modo presentación y tema claro. Un módulo sin miniatura muestra un recuadro con su inicial. `tests/modulos.test.js` comprueba que el archivo declarado existe.
- 2026-11-11. **La plantilla es un módulo que funciona** (`#/_plantilla`, oculto: ondas estacionarias en una cuerda) y está registrada, de modo que el test de contrato y la prueba de humo la ejercitan y no puede quedarse obsoleta. `LEEME.md` da los ocho pasos para crear un módulo y una tabla de errores frecuentes.
- 2026-11-11. **`tests/modulos.test.js` vigila la física pura**: en `physics.js` no puede aparecer (fuera de comentarios) `document`, `window`, `canvas`… ni las mantisas de las constantes CODATA más comunes.
- 2026-11-11. **Series con puntos** en el trazador (`points: true`, `line: false`) para datos discretos.
- 2026-11-11. **Oscilador en unidades adimensionales en la interfaz** (m = ω₀ = F₀ = 1; parámetros ω/ω₀ y γ/ω₀). `physics.js` admite cualquier sistema coherente y expone `complexResponse` con el convenio e^{−iωt} (el mismo en que k > 0 significa absorción), pensando en el modelo de Lorentz del encargo 02.
- 2026-11-11. **La anchura a media altura de la potencia es exactamente γ para cualquier amortiguamiento**, no solo en el límite pequeño que pide el encargo (ω± = √(ω₀² + γ²/4) ± γ/2). El test lo mide por bisección para γ/ω₀ entre 7e-4 y 3,3; lo que sí es una aproximación de γ ≪ ω₀ es la forma lorentziana, y también se comprueba (error ∝ γ/ω₀).
- 2026-11-11. **Energía con γ = 0**: RK4 no conserva la energía exactamente; se comprueba contra la deriva teórica (factor 1 − θ⁶/72 + θ⁸/576 por paso, θ = ω₀·dt) con tolerancia 1e-10, además de acotar la pérdida.
- 2026-11-11. **Tres tests del oscilador fallaron al escribirlos y se investigaron**: los tres por cómo medía el test, no por la física. (1) Orden de RK4: el error en un instante aislado cambia de signo con pasos gruesos; se mide el error máximo de la trayectoria (razón 16,0). (2) Máximo de amplitud: el barrido de 1e-4 no resolvía un pico estrecho a 1e-7; se afina con búsqueda ternaria (1e-12). (3) Comparación relativa de un valor que es exactamente 0; se usa tolerancia absoluta referida a la amplitud. No se cambió ningún valor esperado.
- 2026-11-11. **Vistas del oscilador en rejilla 2 × 2**: tiempo y potencia a la izquierda, amplitud y desfase a la derecha (las dos últimas comparten el eje ω). Las tres gráficas en función de ω llevan un marcador en la ω actual y una línea de trazos en ω₀, y un clic o arrastre en cualquiera fija ω. Los títulos de los paneles muestran los valores numéricos (A, δ, % de la potencia máxima).
- 2026-11-11. **En la evolución temporal, fuerza y posición van normalizadas** (F/F₀ y x/A, con A la amplitud estacionaria) para comparar fases; el tamaño real de la respuesta está en la gráfica de amplitud. La ficha lo dice. El eje de tiempo va en periodos de la fuerza (8 periodos) y el desfase se marca en el periodo 6 con una banda.
- 2026-11-11. **Paso de integración de la vista**: 60 pasos de RK4 por cada periodo (el más corto entre el de la fuerza y el propio), suficiente para que el error sea muy inferior al grosor de la línea incluso con ω = 0,05 ω₀.
- 2026-11-11. **Añadidos al trazador**: marcas fijas (`xTicks`, `yTicks`), apilado de etiquetas de marcadores verticales que se pisarían y `src/ui/format.js` (`formatEs`, números con coma decimal).
- 2026-11-11. **Recorrido «Qué significa resonancia»** (5 pasos, uno por preset): manda el muelle / 90° y máxima potencia / manda la inercia / poco rozamiento (Q, anchura γ) / mucho rozamiento (sin máximo de amplitud si γ ≥ √2·ω₀).
- 2026-11-11. **Prueba de humo completa** (`tests/smoke.test.js`, dentro de `npm test`; se omite sola si no hay Playwright o con `SKIP_SMOKE=1`): portada y tarjetas; cada módulo en los dos temas, en pantalla estrecha y con su ficha; URL ↔ controles; clic en gráficas; PNG; presets con transición y cancelación; recorridos; reloj; modo presentación a 1920 × 1080 y en 4:3; navegación entre páginas. Cualquier error de consola, excepción o petición fallida hace fallar el test. Capturas en `capturas/` (no versionadas).
- 2026-11-11. **La prueba de pantalla estrecha encontró un fallo real**: la barra superior no cabía en 390 px y desbordaba la página; ahora salta de línea y omite el título del módulo.

## Problemas abiertos

- (resuelto 2026-11-11) El push a GitHub dio 403 al cerrar el paso 1 por falta de permiso de escritura; desde el paso 2a funciona.

## Necesito de Daniel
(archivos que subir, decisiones que tomar; vacío si no hay nada)

- **Fusionar la rama `claude/nifty-pascal-etf0j1` en `main`** (con un pull request o directamente) para que GitHub Pages publique el laboratorio, y comprobar en Ajustes → Pages que se sirve desde `main`, carpeta raíz.
- **Cotejar las referencias bibliográficas** de `src/modules/oscilador/ficha.md` y `src/modules/_plantilla/ficha.md` con los libros (capítulos y secciones citados de memoria).
- Opcional: probar el modo presentación en el equipo de grabación (tecla P, después F para pantalla completa) y decir si el tamaño de letra a 1080p es el que quieres.
