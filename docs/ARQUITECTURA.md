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
- Dependencias de ejecución vendorizadas en `vendor/` (copiadas al repositorio, nada de CDN): three.js para 3D y KaTeX para fórmulas en las fichas. Nada más salvo necesidad justificada en PROGRESO.md.
- Gráficas 2D con un trazador propio y sencillo sobre Canvas 2D (ejes, líneas, mapas de color, leyenda, exportable a PNG). Debe verse bien en el modo presentación.
- Herramientas de generación de datos y referencias en `tools/` (Python permitido: `numpy`, `scipy`, `miepython`, `colour-science`, etc.). Lo que generan se guarda en `data/` o `tests/fixtures/` y se versiona. La web nunca depende de Python.
- Idioma: interfaz, fichas y comentarios en español; identificadores en inglés.

## Estructura del repositorio

```
index.html                 portada: lista de módulos con miniatura y descripción
app.js                     arranque, enrutado por hash, registro de módulos
src/
  core/
    complex.js             aritmética compleja
    fft.js                 FFT radix-2 1D y 2D
    linalg.js              tridiagonal, autovalores simétricos, utilidades
    units.js               constantes físicas (CODATA 2018) y conversiones
    interp.js              interpolación (lineal, spline cúbica)
    state.js               estado del módulo <-> URL
    presets.js             estados guardados y transiciones animadas
    tours.js               recorridos guiados
    presentation.js        modo presentación
    theme.js               temas claro y oscuro
  ui/
    controls.js            deslizadores, selectores, conmutadores (declarativos)
    plot2d.js              trazador Canvas 2D
    view3d.js              envoltorio fino de three.js
    colormaps.js           mapas de color y coloreado de fase complejo
    ficha.js               panel de ficha con KaTeX
  color/
    cie.js                 funciones de igualación CIE 1931 2°, iluminantes
    spectrum.js            espectro -> XYZ -> sRGB
  materials/
    library.js             biblioteca de materiales: n(λ), k(λ), metadatos
    dielectric.js          ε = (n + ik)², modelos de Drude y Lorentz
  modules/
    _plantilla/            plantilla para módulos nuevos
    <id>/
      module.js            descriptor: id, título, parámetros, presets, vistas
      physics.js           física pura
      view.js              presentación
      ficha.md             ficha del módulo
data/
  cie/                     CMF y iluminantes (JSON)
  materials/               un JSON por material
  xray/                    factores de forma atómicos (Cromer-Mann)
tests/
  *.test.js
  fixtures/                valores de referencia generados con tools/
tools/                     scripts de generación (no se sirven)
vendor/                    three.js, KaTeX
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

`ctx` da acceso al tema, al modo presentación, a la biblioteca de materiales y al motor de color. El núcleo genera los controles a partir de `params`, sincroniza el estado con la URL y llama a `update(state)` en cada cambio.

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
Cada material es un JSON con `λ` (nm), `n`, `k`, fuente bibliográfica, licencia y metadatos: `familia` (metal, semiconductor, dieléctrico, ion en red, molécula, líquido…), `mecanismo` (texto breve del origen de su color o transparencia) y `modulos` (dónde se explica). Fuente principal: base de datos de refractiveindex.info (dominio público CC0), por ejemplo Johnson & Christy 1972 para Au, Ag y Cu. Las fuentes se citan en una página de créditos.

## Tests

- Cada `physics.js` tiene su `tests/<id>.test.js`.
- Tipos de comprobación, por orden de preferencia: (1) solución analítica exacta; (2) límite conocido (Rayleigh, cuasiestático, clásico); (3) ley de conservación (norma, energía, R + T + A = 1); (4) comparación con una implementación independiente de referencia, generada con `tools/` y guardada en `tests/fixtures/`; (5) valor experimental bien establecido con tolerancia explícita.
- Cada test explica en un comentario qué principio físico comprueba y de dónde sale el valor esperado.
- `npm test` debe pasar entero antes de cada commit.
- Si hay un navegador sin cabeza disponible (por ejemplo Playwright), una prueba de humo carga cada módulo, comprueba que no hay errores en consola y guarda una captura. Si no está disponible, se omite sin bloquear.

## Fichas

Cada módulo tiene `ficha.md` con estas secciones, breves:
- **Qué estás viendo.** Qué representa cada vista y cada color.
- **Qué es físico y qué es representación.**
- **Ecuaciones.** Las que implementa el módulo, en KaTeX y con notación coherente con la bibliografía de la carrera.
- **Límites del modelo.** Qué deja fuera y cuándo deja de valer.
- **Referencias.** Libro y sección concretos: Griffiths (Electrodynamics), Born & Wolf, Bohren & Huffman, Feynman Lectures, Kittel, Ashcroft-Mermin, Levine, Nielsen & Chuang, Gaponenko.

Las fichas no son un libro de texto. Explican lo que se ve en pantalla.

## Accesibilidad y rendimiento

- Objetivo: 60 fps en un portátil normal. Si una simulación no llega, se reduce la resolución de la malla de forma adaptativa antes que bajar los fps.
- Los cálculos pesados (espectros de Mie con muchos órdenes, barridos de parámetros) se cachean por estado o se mueven a un Web Worker.
- Contraste suficiente en ambos temas. Las paletas no dependen solo del rojo frente al verde.
