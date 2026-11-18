# Arquitectura del laboratorio

## Qué es

Un laboratorio de simulaciones de física para un estudiante de 4º de Nanociencia y Nanotecnología (UDC). Tiene tres usos: estudiar conceptos difíciles de visualizar (cuántica, interacción luz-materia, plasmónica, cristalografía), grabar vídeos de divulgación (el autor graba la pantalla mientras explica con una tableta Wacom) y publicarse en su web personal. Se sirve desde GitHub Pages en `https://danipradoweb.github.io/laboratorio/`.

El usuario no es programador. Quien mantendrá y ampliará el código después de esta primera fase será otro modelo de IA de menor capacidad, trabajando sobre este mismo repositorio. Por eso la claridad de la estructura, la documentación y los tests valen más que cualquier optimización.

El usuario destaca en razonamiento verbal y tiene dificultad con la visión espacial. Las visualizaciones deben convertir problemas espaciales en relaciones: vistas enlazadas, donde cambiar algo en una representación cambia las demás a la vez.

## Principios no negociables

1. **La física es correcta y está comprobada.** Toda función física tiene tests contra resultados analíticos, límites conocidos o referencias independientes. Un módulo sin tests en verde no está terminado.
2. **Física separada de la presentación.** El código físico son funciones puras sin DOM, sin canvas y sin estado global. Se puede importar y testear en Node. La presentación solo llama a la física y dibuja.
3. **Honestidad sobre qué es representación y qué es físico.** Si algo no es observable (la fase global de ψ, por ejemplo), la interfaz y la ficha lo dicen. Ningún módulo presenta ψ como algo que vibra en el espacio físico.
4. **Sin servidor y sin proceso de compilación.** Archivos estáticos que GitHub Pages sirve tal cual. Funciona sin conexión una vez cargado.
5. **Ampliable por un modelo menos capaz.** Añadir un módulo nuevo debe consistir en copiar la plantilla de módulo, rellenar física, vista, ficha y presets, y registrarlo en un único sitio.

## Tecnología

- JavaScript moderno con módulos ES nativos, sin empaquetador. Cada archivo lleva `// @ts-check` y tipos en JSDoc. Se permite `typescript` como dependencia de desarrollo solo para `tsc --noEmit` (comprobación de tipos), nunca para compilar.
- Tests con el ejecutor nativo de Node (`node --test`), sin frameworks. Un solo comando ejecuta todos: `npm test`.
- Dependencias de ejecución vendorizadas en `vendor/` (copiadas al repositorio, nada de CDN): three.js para 3D, KaTeX para fórmulas y la fuente CMU Serif para el texto (ver «Tipografía»). Nada más salvo necesidad justificada en PROGRESO.md.
- Gráficas 2D con un trazador propio y sencillo sobre Canvas 2D (ejes, líneas, mapas de color, leyenda, exportable a PNG). Debe verse bien en el modo presentación.
- Herramientas de generación de datos y referencias en `tools/` (Python permitido: `numpy`, `scipy`, `miepython`, `colour-science`, etc.). Lo que generan se guarda en `data/` o `tests/fixtures/` y se versiona. La web nunca depende de Python.
- Idioma: interfaz, fichas y comentarios en español; identificadores en inglés.

## Estructura del repositorio

Los archivos marcados con (01), (02), (03) y (R1) llegaron con esos encargos; el resto existe desde el encargo 00.

```
index.html                 página única: barra superior, mapa de importación de vendor/
app.js                     arranque y enrutado por hash (#/ portada, #/<id> módulo)
.nojekyll                  imprescindible en GitHub Pages (carpetas que empiezan por "_")
package.json               scripts: test, test:unit, check, serve, vendor, miniaturas
src/
  core/                    sin DOM al importar; se prueba en Node
    complex.js             aritmética compleja
    fft.js                 FFT radix-2 1D y 2D
    linalg.js              tridiagonal, autovalores simétricos, sistema complejo denso
    units.js               constantes físicas (CODATA 2018) y conversiones
    interp.js              interpolación (lineal, spline cúbica natural)
    state.js               estado del módulo <-> URL, almacén con suscriptores
    presets.js             estados guardados y transiciones animadas
    tours.js               recorridos guiados (lógica de pasos)
    clock.js               reloj de animación: pausa y velocidad
    presentation.js        modo presentación y atajos de teclado
    theme.js               temas claro y oscuro
    markdown.js            conversor mínimo de Markdown (fichas, recorridos, glosario)
    load-json.js           (01) carga de archivos de data/ en el navegador y en Node
    simulations.js         (R1) formato con simulaciones: selección, pantallas, URL (puro)
    ficha-sections.js      (R1) qué trozo de la ficha va bajo cada gráfica (puro)
  ui/
    module-page.js         página de un módulo: conecta estado, URL, controles y vistas
    cover.js               portada con las tarjetas de los módulos
    controls.js            deslizadores, selectores, conmutadores (declarativos)
    preset-list.js         lista de presets
    tour-bar.js            barra de recorrido (texto, contador, flechas)
    clock-controls.js      botones de pausa y velocidad
    panels.js              paneles con título donde los módulos ponen sus vistas
    plot2d.js              trazador Canvas 2D (con eje vertical derecho opcional, y2)
    plot-math.js           marcas de ejes, formato y escalas (parte pura del trazador)
    view3d.js              envoltorio fino de three.js
    colormaps.js           mapas de color, coloreado de fase y rueda de fase
    colormap-data.js       tablas de los mapas de color (generado por tools/colormaps.py)
    ficha.js               panel de ficha con KaTeX
    format.js              números con coma decimal
    dom.js                 ayudante el() para crear elementos
    styles.css             todos los estilos; temas con variables CSS
    entry-page.js          (R1) página de entrada de un módulo con simulaciones
    screens.js             (R1) pantallas, tarjetas de gráfica, navegación, «ver juntas»
    info-line.js           (R1) líneas secundarias y bloque «Estado» con KaTeX
    plot-tex.js            (R1) rótulos con fórmulas sencillas para el lienzo (puro)
    glossary.js            (R1) ventana del glosario común
  color/                   (01) motor espectro -> color; guía de uso en LEEME.md
    cie.js                 funciones de igualación CIE 1931 2°, iluminantes
    spectrum.js            espectro -> XYZ -> sRGB, CIELAB, aviso de fuera de gama
  materials/               (01) biblioteca de materiales; guía de uso en LEEME.md
    library.js             carga y validación: n(λ), k(λ), metadatos
    dielectric.js          ε = (n + ik)², interpolación en λ, modelos de Drude y Lorentz
  modules/
    registry.js            REGISTRO: único sitio donde se da de alta un módulo
    types.js               tipos JSDoc del contrato de módulo
    _plantilla/            plantilla que funciona (#/_plantilla) + LEEME.md paso a paso
    _galeria/              banco de pruebas visual de los servicios (#/_galeria, oculto)
    <id>/
      module.js            descriptor: id, título, parámetros, presets, recorridos
      physics.js           física pura
      view.js              presentación
      ficha.md             ficha del módulo
      miniatura.png        miniatura para la portada (npm run miniaturas <id>)
      physics-<parte>.js   (02) opcional: un módulo grande reparte su física en varios
                           archivos puros (misma regla: sin DOM, con tests)
      view-<parte>.js      (02) opcional: una vista por archivo, montadas desde view.js
    luz-materia/           (02) cuatro vistas (parámetro `part`): physics.js (Lorentz),
                           physics-sheets.js (láminas), physics-fresnel.js (Fresnel)
    funcion-onda/          (03) cuatro vistas (parámetro `part`): physics.js (Schrödinger 1D,
                           paso partido, T(E)), physics-states.js (estados propios),
                           physics-string.js (cuerda clásica), physics-slits.js (doble
                           rendija 2D y coherencia); view-packet.js, view-states.js,
                           view-string.js, view-slits.js
data/                      (01) fuentes y licencias en data/README.md
  glosario.json            (R1) glosario común a todos los módulos (escrito a mano)
  cie/                     CMF y iluminantes (JSON)
  materials/               un JSON por material + index.json (generados)
    catalogo.json          lista de materiales y metadatos: lo único que se edita a mano
    originales/            copia exacta de los archivos de refractiveindex.info
  xray/                    (encargo 04) factores de forma atómicos (Cromer-Mann)
tests/
  <archivo>.test.js        un archivo de tests por cada archivo de core/ y por cada módulo
  modulos.test.js          contrato de todos los módulos registrados
  estructura.test.js       rutas relativas, .nojekyll, vendor/
  smoke.test.js            prueba de humo con navegador sin cabeza (capturas en capturas/)
  fixtures/                valores de referencia generados con tools/
tools/                     scripts de generación (no se sirven)
  serve.mjs                servidor local bajo /laboratorio/, como GitHub Pages
  vendor.mjs               copia three.js y KaTeX a vendor/
  miniaturas.mjs           genera las miniaturas de la portada
  comparar-fuentes.mjs     (R1) capturas para comparar la letra de controles y ejes
  codata.py, linalg_fixture.py, colormaps.py, oklab-fixture.mjs   datos y referencias
  cie.py                   (01) datos CIE y referencia del motor de color (colour-science)
  refractiveindex-yaml.mjs (01) importador del formato de refractiveindex.info
  materials.mjs            (01) genera data/materials/ a partir de catalogo.json
  materials_fixture.py     (01) referencia del importador (PyYAML)
  mie_fixture.py           (01) referencia de Mie (miepython y mpmath)
vendor/                    three.js, KaTeX, CMU Serif (R1) (copiados; ver vendor/README.md)
docs/                      arquitectura, encargos, temario, backlog
```

## Contrato de un módulo

Cada módulo exporta un descriptor declarativo:

```js
export default {
  id: 'plasmon',
  title: 'Plasmón y teoría de Mie',
  summary: 'Por qué el oro coloidal es rojo',
  params: [            // fuente única de verdad: controles, URL y presets salen de aquí
    { key: 'radius', label: 'Radio (nm)', type: 'range', min: 1, max: 150, step: 1, default: 10 },
    { key: 'material', label: 'Material', type: 'select', options: ['Au', 'Ag', 'Cu', 'Al'], default: 'Au' },
  ],
  presets: [ { id: 'oro-20nm', label: 'Oro 20 nm en agua', state: { radius: 10, material: 'Au', medium: 1.33 } } ],
  tours: [ /* recorridos: lista de { preset, texto } */ ],
  mount(container, ctx) { /* crea vistas, devuelve { update(state), destroy() } */ },
};
```

Un parámetro puede llevar `visible: (state) => boolean`: su control solo se muestra cuando devuelve true (sirve para módulos con varias vistas, donde cada una usa pocos parámetros); el parámetro sigue en el estado y en la URL.

`ctx` da acceso al tema, al modo presentación, a la biblioteca de materiales (`ctx.materials.load(id)`) y al motor de color (`ctx.color.load()`); estos dos descargan datos y devuelven promesas, así que el `mount` que los use es asíncrono. El núcleo genera los controles a partir de `params`, sincroniza el estado con la URL y llama a `update(state)` en cada cambio.

La definición exacta del contrato (campos opcionales `hidden`, `animated` y `thumbnail`, contenido de `ctx`) está en `src/modules/types.js`, y la guía para crear un módulo, en `src/modules/_plantilla/LEEME.md`. Un módulo se da de alta en `src/modules/registry.js` y en ningún otro sitio. `module.js` y `view.js` no pueden usar `document` fuera de sus funciones, porque los tests los importan en Node.

## Formato con página de entrada y simulaciones (en piloto, encargo R1)

Piloto en `funcion-onda`. Los demás módulos siguen con el formato anterior (una página con todas sus vistas) hasta que Daniel valide el piloto; el núcleo admite los dos: un módulo usa el nuevo si su descriptor declara `simulations` (`isPilot` en `src/core/simulations.js`). La plantilla (`_plantilla/` y su `LEEME.md`) se actualizará al extender el formato.

**Contrato** (`src/modules/types.js`). El descriptor añade `intro` (párrafo de la página de entrada), `simulationParam` (el parámetro select cuyas opciones son las simulaciones; su control se oculta) y `simulations`. Cada simulación declara `id` (valor de ese parámetro), `title`, `summary` (una frase), `initial` (su estado inicial), `graphs` y `combos`. Cada gráfica: `id` (único en el módulo; es el del apartado de la ficha y el de la URL), `title` (qué es, en palabras), `short` (nombre corto para pestañas y ubicación) y `summary`. Cada combinación sugerida: dos gráficas de la misma simulación, que se explican la una a la otra, con título y frase. Un preset puede declarar `graphs` (las que abre). `tests/modulos.test.js` comprueba todo esto, y que cada gráfica tenga su apartado en la ficha con sus tres partes y el mismo título.

**Página de entrada.** `#/<id>` sin nada más no carga ninguna simulación (`src/ui/entry-page.js`): título, párrafo, las simulaciones (frase, casillas con cada gráfica, «Ver las elegidas», «Ver todas»), combinaciones sugeridas, presets y recorridos. Todo son enlaces; al entrar en una simulación se aplica su estado inicial. Un recorrido empezado aquí abre la simulación de su primer paso.

**Pantallas** (`src/ui/screens.js`). Varias pantallas cortas en vez de una página larga. Cada gráfica es una tarjeta: título en palabras, línea secundaria con sus números y su significado, leyenda, la gráfica y su explicación. Una pantalla tiene como mucho dos gráficas (una en el móvil, ≤ 760 px): primero las combinaciones sugeridas que estén elegidas enteras, en su orden; luego el resto, en el orden de la simulación (`planScreens`). En escritorio, el alto de la gráfica se ajusta para que las de una pantalla se vean enteras sin desplazarse; la explicación empieza debajo. Arriba, siempre visible, la línea de ubicación (módulo › simulación › pantalla, con enlace a la página de entrada), pestañas, flechas ‹ › (y ← → del teclado cuando no hay un recorrido en marcha), «Ver juntas» (todas las elegidas en una pantalla, sin explicaciones, con un tamaño mínimo) y «Cambiar gráficas» (las mismas casillas de la página de entrada). En el móvil, los controles van en una barra plegable arriba, cerrada al entrar.

**Selección en la URL.** `#/funcion-onda?part=estados&…&ver=superposicion,coeficientes&pantalla=2`: además de todos los parámetros, `ver` (gráficas elegidas; ausente, todas) y `pantalla` (número desde 1, o `juntas`; ausente, la 1). Un enlace copiado abre la misma simulación, gráficas, pantalla y parámetros. `ver` y `pantalla` no pueden ser claves de parámetros.

**Vista del módulo.** `mount` recibe en `ctx.graph(id)` el hueco de cada gráfica de la simulación abierta (`body` con altura definida, `setInfo(trozos)` para la línea secundaria, `legend` para la leyenda HTML, `titleExtra`, `visible`) y en `ctx.setStatus(trozos)` el bloque «Estado» de la barra lateral, para lo que no es de ninguna gráfica. No hay línea de estado encima de las gráficas. Hay un solo reloj y un solo estado por simulación; las gráficas que no se ven no hace falta dibujarlas, y al cambiar de pantalla se llama a `update`. Los trozos de texto llevan fórmulas `$…$` (KaTeX, `src/ui/info-line.js`, que repinta cada línea como mucho cada 150 ms).

**Explicaciones desde la ficha.** Un solo texto en un solo sitio: bajo cada gráfica sale su apartado de `ficha.md` («Qué ves» abierto; «Cómo leerla», «Prueba esto» y «Más detalle» en desplegables). «Más detalle» reúne las ecuaciones y los límites del modelo marcados para esa gráfica (ver «Fichas»). El botón «Ficha» sigue mostrando la ficha entera.

**Glosario común** (`data/glosario.json`, `src/ui/glossary.js`). Términos técnicos del primer nivel, con definiciones de una o dos frases y sin ecuaciones. En cualquier texto Markdown se marcan con `[[término]]` o `[[texto|id]]` y se abren en una ventana pequeña al pulsarlos. `tests/glosario.test.js` comprueba que todo término marcado existe.

**Simulaciones en bucle.** Una simulación con tiempo final vuelve a empezar sola al llegar a él, tras quedarse 1,5 s en el último instante para que se vea el resultado; no hay avisos encima de las gráficas. Para detenerla está la pausa. Mismo criterio en los demás módulos animados al extender el formato.

**Modo presentación.** Sin cambios de diseño: muestra las gráficas de la pantalla actual (o todas, con «ver juntas») en el lienzo 16:9, sin navegación, explicaciones ni barra lateral. Las teclas 1–9 saltan a los presets y abren su simulación si es otra.

**Tipografía.** Ver la sección del mismo nombre.

## Servicios comunes

### Estado en la URL
`#/plasmon?radius=40&material=Ag&medium=1.33`. Copiar la dirección reproduce exactamente lo que se ve. Al cargar, los parámetros ausentes toman su valor por defecto y los inválidos se ignoran con un aviso en consola.

### Presets y transiciones
Un preset es un estado con nombre. Pasar de un preset a otro interpola los parámetros numéricos con una curva suave (por defecto 1,5 s, configurable) y cambia los discretos al final. En el modo presentación, las teclas 1–9 saltan a los presets del módulo.

### Recorridos guiados
Una secuencia de pasos `{ preset, texto }`, donde el texto es Markdown breve con KaTeX. Se avanza con flechas. En modo presentación el texto puede mostrarse u ocultarse (tecla T). La misma pieza sirve para estudiar, para guiones de vídeo y, en el futuro, para ensayos interactivos.

### Modo presentación (tecla P)
Oculta los controles y el texto auxiliar, fija el lienzo a 16:9 y escala la tipografía para 1080p. Atajos: 1–9 presets, espacio pausa o reanuda, `[` y `]` velocidad de la animación, T texto del recorrido, F pantalla completa, P o Esc para salir. Incluye un selector de tema claro u oscuro, porque el autor alterna con una pizarra blanca.

### Coloreado de funciones complejas
Mapa estándar: el tono codifica la fase (arg ψ, rueda de color cíclica y perceptualmente uniforme) y el brillo o la altura codifican |ψ|. Se usa igual en todos los módulos cuánticos, con leyenda de la rueda de fase siempre visible.

### Motor espectro → color
Dado un espectro (transmitancia, reflectancia o emisión sobre 380–780 nm) y un iluminante (D65 por defecto, también A y E), calcula XYZ con las funciones CIE 1931 2°, convierte a sRGB lineal, aplica la corrección gamma y recorta con aviso si queda fuera de gama. Se usa para el color de coloides, materiales y objetos.

### Biblioteca de materiales
Cada material es un JSON con `λ` (nm), `n`, `k`, fuente bibliográfica, licencia y metadatos: `familia` (metal, semiconductor, dieléctrico, ion en red, molécula, líquido…), `mecanismo` (texto breve del origen de su color o transparencia) y `modulos` (dónde se explica). Fuente principal: base de datos de refractiveindex.info (dominio público CC0), por ejemplo Johnson & Christy 1972 para Au, Ag y Cu. Las fuentes y licencias están en `data/README.md` (la página de créditos de la web está pendiente: `docs/BACKLOG.md`). Los nombres de los metadatos van en español porque son datos; las tablas son `wavelength_nm`, `n` y `k`.

## Tests

- Cada `physics.js` tiene su `tests/<id>.test.js` (y cada `physics-<parte>.js`, su `tests/<id>-<parte>.test.js`).
- Tipos de comprobación, por orden de preferencia: (1) solución analítica exacta; (2) límite conocido (Rayleigh, cuasiestático, clásico); (3) ley de conservación (norma, energía, R + T + A = 1); (4) comparación con una implementación independiente de referencia, generada con `tools/` y guardada en `tests/fixtures/`; (5) valor experimental bien establecido con tolerancia explícita.
- Cada test explica en un comentario qué principio físico comprueba y de dónde sale el valor esperado.
- `npm test` debe pasar entero antes de cada commit.
- Si hay un navegador sin cabeza disponible (por ejemplo Playwright), una prueba de humo carga cada módulo, comprueba que no hay errores en consola y guarda una captura. Si no está disponible, se omite sin bloquear.

## Fichas

Cada módulo tiene `ficha.md` con estas secciones, en este orden y con estos títulos (la prueba de humo los comprueba):
- **Qué estás viendo.** Una introducción corta (vistas, unidades, convenios de color comunes) y, después, **un apartado por cada vista** (por cada gráfica o panel), con un título `###` que la nombre como en pantalla, y estas tres partes, en negrita y en este orden. En el formato con simulaciones el título es exactamente el de la gráfica y lleva su identificador, `### Superposición de dos estados {#superposicion}`, sin decir dónde está (las posiciones ya no existen); en el formato anterior dice además dónde está:
  - **Qué ves.** Cada eje con su magnitud y sus unidades dichas en palabras («la posición x en nanómetros», no solo «x (nm)»), y cada curva, zona, línea y color: qué representa y de qué color es.
  - **Cómo leerla.** La idea física que enseña la vista, al nivel de primero de carrera y **sin ecuaciones**: qué relación hay que mirar y por qué sale así.
  - **Prueba esto.** Una o dos acciones concretas en los controles o en la gráfica, cada una con el resultado que se observa (números incluidos cuando los haya). **Cada acción se comprueba contra la pantalla** (a mano o con la prueba de humo) antes de escribirla.
- **Qué es físico y qué es representación.**
- **Ecuaciones.** Las que implementa el módulo, en KaTeX y con notación coherente con la bibliografía de la carrera. Es el único sitio de la ficha con ecuaciones desarrolladas. En el formato con simulaciones, una línea `<!-- gráficas: psi momentos -->` manda lo que sigue (hasta la próxima marca, `<!-- fin -->` o el próximo título) al desplegable «Más detalle» de esas gráficas; los comentarios no se ven en la ficha completa.
- **Límites del modelo.** Qué deja fuera y cuándo deja de valer. Con simulaciones, cada elemento de lista puede acabar en `<!-- gráficas: … -->` para salir en el «Más detalle» de esas gráficas.
- **Referencias.** Libro y sección concretos: Griffiths (Electrodynamics), Born & Wolf, Bohren & Huffman, Feynman Lectures, Kittel, Ashcroft-Mermin, Levine, Nielsen & Chuang, Gaponenko.

Ejemplos completos: `src/modules/_plantilla/ficha.md` (dos vistas) y `src/modules/funcion-onda/ficha.md` (cuatro vistas con varias gráficas cada una).

## Tipografía (encargo R1)

- **Texto para leer** (`--font-text`): CMU Serif (Computer Modern Unicode, en `vendor/cmu/`), la misma letra que las fórmulas de KaTeX. Se eligió en lugar de `KaTeX_Main` porque esta no tiene letras acentuadas ni ¿ ¡ (cada vocal acentuada saldría de otra fuente del sistema); `KaTeX_Main` queda de respaldo para ⟨ ⟩. Se usa en la página de entrada, títulos y líneas secundarias de las gráficas, explicaciones, glosario, ficha, bloque «Estado» y leyendas.
- **Controles y números de los ejes** (`--font-ui`, `--font-plot`): la letra de sistema, que a 12–13 px se lee mejor (comparación con capturas: `tools/comparar-fuentes.mjs`).
- **Fórmulas**: KaTeX en títulos, líneas secundarias, explicaciones, glosario y leyendas. Las leyendas pueden salir del lienzo a HTML (opción `htmlLegend` de `plot2d.js`); la exportación a PNG las sigue dibujando en el lienzo.
- **Rótulos dentro del lienzo** (ejes, líneas marcadas): un rótulo con trozos `$…$` se dibuja con las variables en cursiva, ⟨ ⟩ de verdad y superíndices y subíndices (`src/ui/plot-tex.js`, un TeX reducido; `tests/plot-tex.test.js` comprueba que los rótulos de los módulos no usan órdenes que no conoce). Sin `$…$`, como siempre. En las gráficas del formato con simulaciones los rótulos usan la letra del texto (`--font-plot-label`).

## Accesibilidad y rendimiento

- Objetivo: 60 fps en un portátil normal. Si una simulación no llega, se reduce la resolución de la malla de forma adaptativa antes que bajar los fps.
- Los cálculos pesados (espectros de Mie con muchos órdenes, barridos de parámetros) se cachean por estado o se mueven a un Web Worker.
- Contraste suficiente en ambos temas. Las paletas no dependen solo del rojo frente al verde.
