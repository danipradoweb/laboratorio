# Progreso

Registro vivo del estado del laboratorio. Cada sesión lo lee al empezar y lo actualiza al cerrar cada paso.

## Estado general

| Encargo | Estado |
|---|---|
| 00 Base y servicios comunes | **terminado** (2026-11-11), revisado |
| 01 Plasmón, Mie y color | **terminado** (2026-11-12), revisado. Rama `claude/bold-goldberg-s51hqd`, sin fusionar en `main` |
| 02 Luz y materia | pendiente |
| 03 Ondas clásicas y función de onda | pendiente |
| 04 Cristales y Bragg | pendiente |

## Sesión en curso
- Encargo: 01 Plasmón, Mie y color (terminado). El siguiente es `docs/encargos/02-luz-materia.md`.
- Último paso terminado: 10b (revisión independiente, correcciones y cierre). Encargo 01 terminado
- Siguiente paso: encargo 02 (`docs/encargos/02-luz-materia.md`), en una sesión nueva

### Cómo queda el encargo 01

- `npm test`: 315 tests en verde (284 unitarios y de contrato + 31 de humo con navegador sin cabeza). `npm run check`: limpio.
- Módulo nuevo `plasmon` (visible en la portada, `#/plasmon`): cinco vistas enlazadas, ocho presets, dos recorridos, ficha y miniatura.
- Servicios nuevos para los módulos siguientes: motor de color (`ctx.color.load()`, guía en `src/color/LEEME.md`) y biblioteca de materiales (`ctx.materials.load(id)`, guía en `src/materials/LEEME.md`). Fuentes y licencias de los datos: `data/README.md`.
- Para regenerar datos y referencias: `python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt`; después `tools/cie.py`, `node tools/materials.mjs`, `tools/materials_fixture.py`, `tools/mie_fixture.py`.
- No hizo falta ningún dato de prueba: la red permitió descargar todo (PyPI y la base de datos de refractiveindex.info en GitHub).
- La rama `claude/bold-goldberg-s51hqd` **no está fusionada en `main`**: GitHub Pages no mostrará el módulo hasta que se fusione (ver "Necesito de Daniel").

### Revisión independiente del encargo 01 (paso 10b)

Un subagente con contexto limpio revisó solo la física y el cumplimiento del encargo, con scripts propios (mpmath, scipy, colour-science, Monte Carlo de orientaciones; no los tests del proyecto) y sin modificar el repositorio. Una ronda. (Un primer intento se cortó por el límite de uso sin entregar nada; se relanzó.)

- **Sin errores** en fórmulas, factores, unidades ni convenios de signo. Comprobado por el revisor: Mie frente a su propio mpmath en 130 casos (≤ 10⁻⁹), normalización de Bohren & Huffman de Q_back, g, S₁ y S₂, convenio e^{−iωt} de los materiales a la fase dibujada, α = 6πi·a₁/k³, promedio de Gans en absorción y dispersión (Monte Carlo: 1,000 ± 0,001), factores de despolarización (2·10⁻¹⁵), campo cercano del esferoide (10⁻⁸), unidades de la cubeta, cadena de color frente a colour-science (10⁻¹⁵ en XYZ) y los 9 JSON frente a sus originales. Ningún requisito del encargo incumplido; ningún test con valor esperado o tolerancia ajustados.
- **Corregido** (cada punto comprobado antes por mi cuenta):
  1. Diagrama polar del bastón: dibujaba un dipolo alineado con el campo (|S₂|² = cos²θ, nulo a 90°) mientras el espectro es un promedio de orientaciones. Ahora dibuja el promedio de un dipolo anisótropo (`gansScatteringPattern`: I_⊥ = A + B, I_∥ = (A − B)cos²θ + 2B), con test contra una integración directa sobre orientaciones y contra ⟨C_sca⟩. En el pico longitudinal, I_∥(90°)/I_⊥ = 50 %.
  2. Recorrido 1, paso 1: decía que a 800 nm la nube «se mueve poco»; la interfaz muestra el 47 % de la amplitud máxima. Lo que es 100 veces menor es Im α = |α| sen δ, lo que se absorbe. Reescrito: en fase, la fuerza no cede energía neta.
  3. Recorrido 1, paso 2 y ficha: «el punto donde la amplitud es máxima» y «una amplitud enorme». En el oro de 20 nm no coinciden la condición de Fröhlich (514,5 nm), el máximo de extinción (521 nm) y el máximo de |α| (539 nm), y |α| solo se duplica. Reescrito, y explicado en la ficha.
  4. Recorrido 2, último paso: el pico transversal del bastón está en 506 nm, no «cerca de 520».
  5. Ficha: la tabla de Johnson & Christy tiene un punto cada 16–52 nm en el visible, no cada 15–40. La ficha dice ahora que la nube y el campo cercano del bastón son los de un bastón alineado, y cómo se calcula el color «de lado».
  6. Amplitud relativa de la nube: el máximo de |α| se tomaba de la malla de 2 nm y en la plata podía salir «102 %». Ahora se afina como el pico.
  7. Comentario de un test: decía que las dos fórmulas de los factores de despolarización eran independientes; son algebraicamente equivalentes (la comprobación independiente es la integral, que ya existía).
  8. Metadato: el agua declaraba `modulos: ["plasmon"]` sin que el módulo la cargue.
- **Anotado en `docs/BACKLOG.md`** (sección "Pendientes de la revisión del encargo 01"): anclaje del pico del oro al punto de 520,9 nm de la tabla por la interpolación lineal, color «de lado» con dispersión total, precisión de Mie con x ≈ 10⁻³, coeficiente de extinción molar, test de cableado, referencia de la copa de Licurgo.
- **No verificado** (ni por mí ni por el revisor): capítulos, secciones y números de ecuación de Bohren & Huffman citados en la ficha, el código y los tests; el capítulo de Gaponenko; Kreibig & Vollmer cap. 2; «CIE 15:2004, tabla T.3» y «Jackson §4.4» en comentarios de tests. Los artículos de las constantes ópticas salen de la propia base de datos.

### Plan del encargo 01 (pasos y estado)

| # | Paso | Estado |
|---|---|---|
| 1 | Datos CIE: `tools/cie.py` → `data/cie/` | hecho |
| 2 | Motor de color: `src/color/cie.js`, `src/color/spectrum.js`, `tests/color.test.js` | hecho |
| 3 | Biblioteca de materiales: importador YAML, `data/materials/`, `src/materials/` y tests | hecho |
| 4a | Mie (BHMIE) en `src/modules/plasmon/physics.js` + comparación con `miepython` | hecho |
| 4b | Cuasiestática, Gans, campo cercano y tests con datos reales | hecho |
| 5 | Color del coloide (transmitido y dispersado) | hecho |
| 6 | Vistas enlazadas (a)–(e) y controles | hecho |
| 7–8 | Presets y recorridos | hecho |
| 9 | Ficha y miniatura | hecho |
| 9b | Prueba de humo propia del módulo (URL, vistas enlazadas, presets, recorridos, presentación) | hecho |
| 10a | Documentación para reutilizar los servicios: `src/color/LEEME.md`, `src/materials/LEEME.md`, `data/README.md`; árbol de `ARQUITECTURA.md` y `BACKLOG.md` al día | hecho |
| 10b | Revisión con subagente (una ronda), correcciones y cierre | hecho |

### Evidencia por paso (encargo 01)

- Pasos 1–2: `tests/color.test.js`, 33 tests en verde. D65 en (0,3127; 0,3290), A en (0,4476; 0,4074), E en (1/3; 1/3), 700 nm en (0,7347; 0,2653), reflector perfecto bajo D65 → sRGB (1, 1, 1) con 10⁻³; 14 casos de `colour-science` (parches reales de ColorChecker bajo D65, A y E, y dos espectros sintéticos) coinciden a 10⁻⁹ en XYZ y sRGB lineal y a 10⁻⁷ en CIELAB.

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
- La rama `claude/nifty-pascal-etf0j1` del encargo 00 ya está fusionada en `main` (pull request #1).

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
| colour-science (pip) | 0.4.7 | solo `tools/cie.py` (datos CIE y referencia del motor de color) |
| miepython (pip) | 3.3.1 | solo `tools/` (referencia de Mie) |
| PyYAML (pip) | 6.0.3 | solo `tools/` (referencia del importador de materiales) |
| mpmath (pip) | 1.4.x | solo `tools/mie_fixture.py` (Mie de alta precisión para esferas pequeñas) |

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

- Paso 3: `tests/materials.test.js`, 37 tests en verde. Los 9 JSON coinciden fila a fila con los originales leídos con PyYAML; n, k ↔ ε en todas las filas; sílice n_d = 1,4585; agua n(589 nm) = 1,333; Drude y Lorentz contra límites analíticos y contra `complexResponse` del oscilador.

- Pasos 4–5: `tests/plasmon.test.js` (38 tests tras la revisión). Mie frente a `miepython`/`mpmath` en 196 casos (m reales y absorbentes, x de 0,01 a 100): peor error relativo 5·10⁻¹¹ en Q_ext, 2·10⁻¹⁰ en Q_back y 6·10⁻⁸ en g (tolerancia 10⁻⁶); amplitudes S₁, S₂ a 10⁻¹⁰ de |S(0°)|. Rayleigh, Q_abs = 0 con m real, teorema óptico e integral angular, Q_ext → 2. Cuasiestática frente a Mie en Au de radio 5 nm: desviación máxima 1,93 % (400–800 nm). Drude: pico en ω_p/√(1 + 2ε_m). Gans: factores que suman 1 y coinciden con su integral, esfera recuperada, corrimiento monótono. Campo cercano: condiciones de contorno, divergencia y rotacional nulos.
- **Valores con datos reales (Johnson & Christy), sin ajustar nada**: Au de 20 nm en agua, pico en **521,1 nm** (intervalo pedido 515–528); Ag de 20 nm en agua, **386,9 nm** (385–410); Au de 40 → 150 nm: 524 → 536 → 549 → 570 → 591 → 640 nm; Au de 20 nm con n_m de 1 a 2: 506 → 588 nm; bastón de Au con relación de aspecto 1 → 5: 521 → 868 nm (672 nm con 3). Color: Au de 20 nm a contraluz, L*a*b* = (70, +49, +21); copa de Licurgo (Au-Ag 30:70 de 70 nm en n = 1,5): a contraluz a* = +53 (roja), dispersada a* = −61 (verde).
- Pasos 6–9: `npm test` 311 en verde (la prueba de humo general ya carga el módulo en los dos temas, en pantalla estrecha y con su ficha, sin errores de consola). Capturas revisadas a ojo: tema claro, tema oscuro con el bastón, y modo presentación a 1920 × 1080 con oro de 150 nm.

- Paso 9b: `npm test` 314 en verde. `tests/smoke.test.js` añade tres pruebas del módulo: estado desde la URL (plata de 20 nm: pico en 385–389 nm y δ cerca de 90°), clic en el espectro que cambia λ en control, URL y vistas, los ocho presets con sus capturas (`capturas/plasmon-preset-*.png`) y lo que debe verse en cada uno (cubeta de oro rojiza; Licurgo roja a contraluz y verde dispersada; bastón con aviso de Gans), disposición compacta, camino óptico que oscurece la cubeta, animación y pausa, tecla 7 en modo presentación y los dos recorridos paso a paso.

### Decisiones del encargo 01

- 2026-11-11. **Base de datos de materiales**: `polyanskiy/refractiveindex.info-database`, commit `e6d15e3` (fijado en `data/materials/catalogo.json`). **Licencia comprobada: CC0 1.0 Universal** (archivo `LICENSE` del repositorio y cabecera de cada archivo de datos). Los archivos originales se copian sin tocar en `data/materials/originales/`, de modo que los JSON se pueden regenerar sin red.
- 2026-11-11. **Materiales y fuentes elegidas** (9): Au, Ag y Cu de Johnson & Christy 1972; Al de Rakić 1995; agua de Hale & Querry 1973 (trae n y k, y cubre de 200 nm a 200 µm); sílice fundida de Malitson 1965 (fórmula de Sellmeier, tabulada cada 5 nm hasta 1000 nm y cada 50 nm hasta 6700 nm); TiO₂ de Siefke et al. 2016 (película delgada, n y k desde 120 nm: incluye el borde de absorción ultravioleta); Si de Schinke et al. 2015 (250–1450 nm: incluye el borde de la banda prohibida en 1100 nm, que Aspnes & Studna no alcanza). **Añadido: aleación Au-Ag 30:70** (Rioux et al. 2014, modelo analítico ajustado a elipsometría), necesaria para el preset de la copa de Licurgo.
- 2026-11-11. **Importador en `tools/refractiveindex-yaml.mjs`** (funciones puras, probadas en `tests/materials.test.js`) y generador en `tools/materials.mjs`. El importador no es un lector general de YAML: entiende la forma de esos archivos y tres tipos de datos (`tabulated nk`, `tabulated n`, `formula 1`); con cualquier otro falla con un mensaje que dice qué ampliar. Referencia independiente: los mismos originales leídos con PyYAML (`tools/materials_fixture.py`).
- 2026-11-11. **Metadatos en español en los JSON** (`nombre`, `familia`, `mecanismo`, `modulos`, `fuente`, `licencia`), como los nombra `docs/ARQUITECTURA.md`: son datos, no identificadores de código. Las tablas son `wavelength_nm`, `n`, `k`.
- 2026-11-11. **Interpolación lineal de n y k por defecto** (spline opcional): con tablas experimentales poco densas (Johnson & Christy: un punto cada 16–52 nm en el visible) una spline puede inventar oscilaciones. Fuera del intervalo tabulado, `RangeError` (o `outOfRange: 'clamp'` si se pide).
- 2026-11-11. **`ctx.materials` y `ctx.color`** dejan de ser `null`: son servicios perezosos (`ctx.materials.load(id)`, `ctx.materials.list()`, `ctx.color.load()`) que devuelven promesas; no se descarga nada hasta que un módulo lo pide.

- 2026-11-11. **Datos CIE sin transformar**: `data/cie/` guarda las tablas tal como las distribuye `colour-science` (funciones de igualación cada 1 nm de 360 a 830 nm; D65 y A cada 5 nm de 300 a 780 nm; E constante). `src/color/cie.js` pasa los iluminantes a 1 nm por interpolación lineal y **no extrapola**: D65 y A acaban en 780 nm y el motor integra solo donde hay datos (lo que queda fuera aporta menos de 10⁻⁵).
- 2026-11-11. **`src/core/load-json.js`**: carga de archivos de `data/` que funciona igual en el navegador (`fetch`) y en Node (`fs`), siempre con rutas relativas al archivo que las pide (`new URL(ruta, import.meta.url)`). Una sola descarga por archivo.
- 2026-11-11. **Matriz de sRGB deducida de los primarios y del blanco** (definición de IEC 61966-2-1), no la matriz redondeada a 4 decimales. La referencia de `colour-science` se genera con la misma convención (`use_derived_transformation_matrices`), y así la comparación llega a 10⁻⁹.
- 2026-11-11. **Sin adaptación cromática**: el color se muestra como lo vería un ojo adaptado a D65 (el blanco de la pantalla). Un blanco bajo el iluminante A sale anaranjado. Está dicho en la cabecera de `spectrum.js`.
- 2026-11-11. **Fuera de gama**: recorte canal a canal y `inGamut = false`, con un margen de 10⁻³ (el D65 integrado difiere 2·10⁻⁴ del blanco nominal de sRGB; sin margen, el propio blanco saldría «fuera de gama»).
- 2026-11-11. **Dos tests de color fallaron al escribirlos, por el test y no por el código**: (1) pedía 10⁻¹² al sRGB del blanco, cuando el encargo dice «≈ (1, 1, 1)» y la diferencia real es 2·10⁻⁴ por el redondeo del blanco nominal; (2) pedía continuidad a 10⁻⁹ en el empalme de la curva gamma, pero las constantes redondeadas de la norma dejan un salto de 3·10⁻⁸. Un tercero destapó un fallo real: `resampleSpectrum` aceptaba longitudes de onda repetidas; ahora las rechaza.

- 2026-11-12. **Mie: el margen fijo de BHMIE para arrancar la recurrencia descendente no basta.** El programa original arranca D_n en máx(n_max, |mx|) + 15. Con |mx| grande y sin absorción eso da errores serios (6·10⁻⁴ en Q_ext con m = 4, x = 100; más del 50 % en Q_back con |mx| ≈ 600). Se detectó al comparar con `miepython` y se confirmó aumentando el margen. Ahora el arranque es máx(n_max, |mx|) + 8·|mx|^(1/3) + 15 (`downwardStartOrder`), porque la zona de transición tiene anchura ∝ |mx|^(1/3). El número de términos de la serie sigue siendo n_max = x + 4x^(1/3) + 2, como pide el encargo.
- 2026-11-12. **Dos referencias para Mie.** `miepython` no suma la serie cuando |m|·x < 0,1: usa un desarrollo truncado con error de hasta 2·10⁻⁶ en Q_back y g (mayor que la tolerancia). En esos 33 casos la referencia es `mpmath` a 40 cifras (`tools/mie_fixture.py`), que da la razón a la implementación propia a 10⁻¹⁰. El script comprueba además que las dos referencias coinciden entre sí donde ambas suman la serie. `miepython` usa el convenio e^{+iωt}: el fixture guarda m y S ya conjugados al convenio del laboratorio (e^{−iωt}).
- 2026-11-12. **Tests de plasmón que fallaron al escribirlos, todos por el test**: (1) tolerancia de 10⁻¹⁸ en una resta con redondeo de 10⁻¹⁷; (2) cota arbitraria para «Mie tiende a la cuasiestática»: la diferencia es exactamente la corrección (3/5)x²(m² − 2)/(m² + 2) de Bohren & Huffman (ec. 5.4), y ahora el test comprueba esa fórmula y que el resto es O(x⁴); (3) la cuadratura de Simpson del test de los factores de despolarización tenía una singularidad de raíz en el extremo (se cambió el cambio de variable); (4) el desfase de la plata en resonancia se evaluaba con la α cuasiestática en el pico de Mie: el retardo separa ambos 4 nm y la resonancia de la plata es tan estrecha que eso cambia δ de 88° a 41°. No se cambió ningún valor esperado de la física.
- 2026-11-12. **Nube electrónica de la esfera con la polarizabilidad dipolar de Mie**, α = 6πi·a₁/k³ (tiende a la cuasiestática para x → 0 e incluye retardo y amortiguamiento por radiación), para que la amplitud y el desfase sean coherentes con el espectro también en esferas grandes. En el bastón se usa la α longitudinal de Gans.
- 2026-11-12. **El desfase del oro en su pico es ≈ 60°, no 90°**: en la condición de Fröhlich α = 4πa³(1 + 3iε_m/Im ε), un fondo en fase más el término resonante; con las pérdidas del oro (interbanda) el fondo pesa. La plata sí da ≈ 90°. Los recorridos y la ficha lo dicen así (la primera redacción decía «un cuarto de periodo» para el oro: era falso).
- 2026-11-12. **En el pico dipolar de una esfera grande el diagrama sigue siendo casi dipolar** (oro de 150 nm en 640 nm: atrás/delante = 92 %). La dispersión hacia delante aparece donde interfiere el cuadrupolo (530 nm: g = 0,25). El recorrido pide mover λ para verlo.
- 2026-11-12. **Campo cercano del bastón: solución electrostática exacta del esferoide** con el campo a lo largo del eje largo (potencial en coordenadas elipsoidales, B&H §5.3), no un dipolo puntual, que cerca de un bastón sería falso. Con a = b es la esfera y coincide con la fórmula dipolar del encargo. La escala de color del mapa es fija para cada partícula (hasta el máximo de todo el espectro), para que al mover λ se vea crecer el campo.
- 2026-11-12. **Concentración como fracción de volumen de metal (ppm)** en lugar de número de partículas: con el mismo valor del control, coloides de 20 y de 150 nm tienen absorbancias comparables, y no hacen falta densidades de los metales. N (partículas/mL) se muestra calculado. El bastón se define por su ancho (el control «diámetro») y su relación de aspecto.
- 2026-11-12. **Color de la luz dispersada: solo el tono**, llevado al mayor brillo que cabe en pantalla (`colorOfScattered`). La cantidad se da aparte, como porcentaje de la extinción en el máximo. Normalizar al máximo de C_sca daba un negro engañoso cuando el pico cae fuera del visible (plata).
- 2026-11-12. **Añadido a `plot2d.js`**: `yLabel` en los datos de `draw()` (sustituye al de las opciones en ese dibujo). El espectro pasa a «miles de nm²» cuando las secciones eficaces superan 2·10⁴ nm², para que el eje no mezcle 80000 con 1,0·10⁵.
- 2026-11-12. **Línea de modelo** encima de las vistas: dice qué teoría se usa (Mie o Gans), el parámetro de tamaño x y avisa cuando el bastón deja de ser pequeño frente a λ o cuando el mapa de campo (cuasiestático) es solo orientativo (x > 0,3).
- 2026-11-12. **Ocho presets**: los siete del encargo más «oro 20 nm, lejos de la resonancia» (λ = 800 nm), que necesita el primer paso del recorrido «por qué el oro coloidal es rojo».

- 2026-11-12. **Disposición compacta del plasmón**: cuando el hueco de las vistas mide menos de 64 tamaños de letra (ventana pequeña, o ficha abierta en un portátil), la rejilla pasa de tres columnas a dos con desplazamiento vertical. Lo decide `view.js` con un `ResizeObserver` y lo aplica una regla de `styles.css`; el modo presentación nunca la activa.

## Problemas abiertos

- (resuelto 2026-11-11) El push a GitHub dio 403 al cerrar el paso 1 por falta de permiso de escritura; desde el paso 2a funciona.

## Necesito de Daniel
(archivos que subir, decisiones que tomar; vacío si no hay nada)

- **Fusionar la rama `claude/bold-goldberg-s51hqd` en `main`** (pull request o directamente) para que GitHub Pages publique el módulo de plasmón.
- **Cotejar las referencias bibliográficas con los libros delante** (citadas de memoria, sin verificar): en `src/modules/plasmon/ficha.md`, Bohren & Huffman cap. 4, 5 y 12 y apéndice A; Gaponenko, capítulo de nanoplasmónica (falta el número de capítulo); Kreibig & Vollmer cap. 2; Gans 1912. También los números de ecuación de Bohren & Huffman citados en comentarios de `src/modules/plasmon/physics.js` y `tests/plasmon.test.js` (4.47, 4.53, 4.88, 5.4, 5.32–5.34). Y decidir si se cita una referencia para la copa de Licurgo (ver `docs/BACKLOG.md`). Siguen pendientes las del encargo 00 (`src/modules/oscilador/ficha.md` y `src/modules/_plantilla/ficha.md`).
- **Leer los textos de `mecanismo`** de `data/materials/catalogo.json` (por qué cada material tiene su color): son frases de física escritas para la biblioteca, con umbrales de transiciones interbanda y bandas prohibidas dados como valores aproximados de manual.
- Opcional: probar el modo presentación del plasmón en el equipo de grabación (tecla P; teclas 1–8 para los presets) y decir si el tamaño de letra y la velocidad de la animación de la nube son los que quieres.
