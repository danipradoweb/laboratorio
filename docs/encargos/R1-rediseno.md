# Encargo R1: organización de los módulos, explicaciones junto a las gráficas y tipografía (piloto en funcion-onda)

Cerrado el 18 nov 2026 con Daniel, a partir de capturas de `main` en 2eb34ac (incluye el mantenimiento del 18 nov, pull request #5) a 1920×1080, 1366×768, 1366×650 y 390×844. Se ejecuta con Opus en una sesión nueva desde `main`, siguiendo el protocolo de `CLAUDE.md`.

## Objetivo
Que en todo momento quede claro qué se está viendo y que el módulo sea fácil de recorrer, claramente distinto de lo que hay ahora. Que un estudiante de 4º de Nanociencia entienda cada gráfica sin ayuda externa y que alguien de bachillerato o primero de carrera pueda seguir al menos el primer nivel. Sin quitar rigor ni cambiar la física.

Piloto en **funcion-onda**, el módulo más complejo (cuatro simulaciones, trece gráficas). Los demás módulos no se tocan hasta que Daniel valide el piloto; entonces se extiende a todos con el mismo formato.

## Qué falla ahora (observado en las capturas)
- Al entrar, todas las gráficas de una vista aparecen a la vez en una rejilla que llena la pantalla. A 1366×650 (portátil con la barra del navegador) se aprietan: el plano complejo de la vista de estados queda en unos 90 px.
- **En 900 px de ancho o menos, funcion-onda superpone sus paneles** en las cuatro vistas (medido a 390 y 820): en móvil solo se ve el último. Causa probable, sin comprobar: la regla `@media (max-width: 900px)` de `styles.css` quita `grid-template-areas`, pero cada panel conserva su `grid-area` con nombre y todos caen en la misma celda. Las pruebas de humo no lo detectan porque solo buscan errores.
- En móvil, controles, presets y recorridos ocupan unos 1850 px antes de la primera gráfica.
- El selector «Vista» cambia a otro conjunto de gráficas sin explicar qué hay en cada uno, y **conserva el estado de la vista anterior**: al pasar a estados con la barrera por defecto salen dos niveles casi degenerados, un periodo de 97 932 fs y λ = 29 359 151 nm. Es correcto, pero no es lo que nadie espera ver al entrar.
- Los títulos dan números sin decir qué es la gráfica (por ejemplo `ψ = 0,71·φ1 + 0,71·e^(i·0°)·φ2 … t = 77118,09 fs`). La línea de estado de arriba amontona más números.
- Fórmulas en texto plano (`c1·e^(−iE1t/ħ)`). Con la fuente actual, ⟨x⟩ y ⟨p⟩ se ven como (x) y (p).
- Al llegar al tiempo final aparece el aviso «Simulación terminada» encima de las gráficas. Daniel prefiere que la animación vuelva a empezar sola.

## Qué hay que construir

### 1. Página de entrada del módulo
Al abrir `#/funcion-onda` desde la portada no se carga ninguna simulación. Todos los módulos tendrán esta página cuando se extienda el formato, aunque tengan pocas gráficas: la organización debe ser la misma en todos. Contiene:
- el título y un párrafo de qué va el módulo y por qué importa;
- las **simulaciones** del módulo (las cuatro vistas actuales: paquete, estados, cuerda, doble rendija), cada una con una frase de qué simula, la lista de sus gráficas (cada una con su título en palabras, una frase de qué muestra y una casilla para elegirla), un botón «Ver las elegidas» y un enlace «Ver todas»;
- **combinaciones sugeridas**, cada una con su enlace directo y una frase de qué se entiende al verlas juntas. Propuesta de partida (la sesión puede ajustarla con la ficha, manteniendo el criterio de que una gráfica explique a la otra):
  - Paquete: «Qué parte del paquete atraviesa la barrera» (ψ(x) y espacio de momentos); «La incertidumbre mientras el paquete se mueve» (ψ(x) y valores esperados); «Qué tiene de onda y qué no» (ψ(x) y la cuerda clásica).
  - Estados: «Por qué una superposición se mueve» (ψ(x, t) y coeficientes en el plano complejo); «De dónde sale el color de una transición» (niveles y puente con la luz).
  - Cuerda: «Misma forma, distinto reloj» (la cuerda y las frecuencias).
  - Doble rendija: el plano y la pantalla.
- los presets y los recorridos guiados del módulo.

Solo se eligen gráficas de una misma simulación, porque las de simulaciones distintas no comparten estado. Cada simulación declara su **estado inicial** propio, que se aplica al entrar desde la página de entrada (estados: los valores del preset «Superposición 1 + 2 oscilando»; paquete: los actuales por defecto; cuerda y doble rendija: sus valores por defecto). La selección va en la URL (simulación y gráficas, además de los parámetros), de modo que un enlace copiado abre exactamente la misma pantalla.

### 2. Pantallas de la simulación
Varias pantallas cortas en lugar de una página larga: Daniel se pierde en las páginas largas.
- **Escritorio**: cada pantalla muestra como mucho dos gráficas de la selección, con márgenes generosos entre ellas, y la explicación de cada una debajo. Si la selección tiene más, se reparte en pantallas sucesivas, siguiendo el orden de las combinaciones sugeridas. Criterio: a 1366×650 las gráficas de una pantalla se ven enteras sin desplazarse; la explicación empieza debajo.
- **Navegación**: arriba, una línea de ubicación siempre visible («Ondas clásicas y función de onda › Un paquete de ondas › ψ(x) y espacio de momentos») con enlace a la página de entrada, y pestañas con el nombre de cada pantalla, además de flechas anterior/siguiente (también con el teclado si no chocan con los atajos del modo presentación). Un botón «Cambiar gráficas» abre la misma lista de casillas de la página de entrada sin salir de la simulación.
- **Ver juntas**: un botón muestra todas las gráficas elegidas en una sola pantalla, sin explicaciones, para compararlas. También con márgenes y un tamaño mínimo por gráfica.
- **Móvil** (390×844): una gráfica por pantalla con su explicación debajo (aquí sí se desplaza), la gráfica antes que los controles, y los controles en una barra plegable arriba, cerrada al entrar.
- **Controles**: barra lateral fija en escritorio con los controles de esa simulación, sus presets y la animación. La línea de estado de arriba desaparece: cada número pasa a la línea secundaria de la gráfica a la que pertenece, y lo que no pertenezca a ninguna va a un bloque «Estado» en la barra lateral.
- Hay un solo reloj y un solo estado por simulación: al cambiar de pantalla, la gráfica que aparece muestra el estado actual. No hace falta redibujar las gráficas que no están a la vista.
- Un preset de otra simulación abre esa simulación (con su combinación declarada o «ver todas»). El modo presentación sigue funcionando como ahora: las teclas 1–9 saltan a los presets, abriendo su simulación si es otra. Su diseño no cambia.

### 3. Explicación de cada gráfica
La fuente sigue siendo `ficha.md`, que en funcion-onda ya tiene un apartado por gráfica con «Qué ves», «Cómo leerla» y «Prueba esto». Debajo de cada gráfica se muestran «Qué ves» abierto, «Cómo leerla» y «Prueba esto» como desplegables, y un desplegable «Más detalle» con las ecuaciones y los límites del modelo que le correspondan. Un solo texto en un solo sitio: cada apartado `###` de la ficha recibe un identificador estable que lo une a su gráfica, y el botón «Ficha» sigue mostrando la ficha completa.
- Los encabezados de la ficha dejan de decir la posición («arriba a la izquierda»), que ya no existe.
- Cada «Prueba esto» se vuelve a comprobar contra la pantalla nueva y se corrige si ya no coincide.
- **Glosario** común (un archivo de datos compartido por todos los módulos) para los términos técnicos del primer nivel: los términos marcados en los textos se abren en una ventana pequeña al pulsarlos (ratón o dedo). Definiciones de una o dos frases, sin ecuaciones. La sesión elige los términos de funcion-onda.

### 4. Títulos
El título dice qué es la gráfica en palabras («Superposición de dos estados», «Cuánto del paquete hay en cada número de onda»). El valor numérico va en una línea secundaria con su significado.

### 5. Tipografía y fórmulas
- **Fuente del texto**: la de KaTeX (`KaTeX_Main`, ya en `vendor/katex/fonts`), para que texto y fórmulas compartan letra; Times New Roman no está en Android ni en Linux. Se aplica a la página de entrada, títulos, explicaciones y glosario. Para controles y números de los ejes, la sesión compara con capturas la fuente nueva y la actual a tamaño pequeño (12–13 px), en móvil y en el modo presentación, y se queda con la que se lea mejor; lo anota en `PROGRESO.md` con las capturas.
- **KaTeX** en títulos, líneas secundarias, explicaciones, glosario y leyendas. Las leyendas salen del lienzo a HTML encima de la gráfica (en `plot2d.js`, opcional por gráfica, para no romper los demás módulos), lo que además deja más área de datos. La exportación a PNG y las miniaturas siguen dibujando la leyenda en el lienzo.
- **Rótulos de ejes y anotaciones dentro del lienzo**: Unicode bien compuesto, con las variables en cursiva, ⟨ ⟩ de verdad (U+27E8, U+27E9) en una fuente que las distinga de los paréntesis, y subíndices y superíndices legibles. Si en las capturas se ve pobre, se para y se consulta a Daniel antes de seguir.

### 6. Correcciones incluidas (funcion-onda)
1. Paneles superpuestos a 900 px o menos (la maqueta nueva los sustituye, pero el test lo cubre en todos los módulos; ver Tests).
2. Quitar el aviso de fin: la animación vuelve a empezar sola al llegar al tiempo final; para detenerla está la pausa. Retirar `createEndNotice` de las dos vistas que lo usan y cambiar la prueba de humo que comprueba el aviso por una que compruebe el bucle. Mismo criterio en los demás módulos animados al extender el formato.
3. Plano complejo de la vista de estados: tamaño mínimo y etiquetas que no se pisen, comprobado en capturas a 1366×650 y 390×844.
4. Estado inicial propio de cada simulación (punto 1).
5. ⟨ ⟩ legibles en todo el módulo (punto 5).

## Contrato y documentación
- Contrato de módulo (`types.js`), formato nuevo: el módulo declara su párrafo de entrada; cada simulación, su título, su frase, su estado inicial, sus gráficas (identificador, título en palabras, frase) y sus combinaciones sugeridas; cada preset puede declarar qué gráficas abre. Durante la transición el núcleo admite los dos formatos y los módulos sin migrar siguen como ahora.
- `docs/ARQUITECTURA.md`: página de entrada, simulaciones, pantallas, selección en la URL, «ver juntas», explicaciones desde la ficha, glosario, simulaciones en bucle y tipografía, marcado como formato en piloto. `_plantilla/` y su `LEEME.md` se actualizan al extender, no en este encargo.

## Tests y comprobación
- Contrato: un módulo migrado sin párrafo de entrada, o con una gráfica sin título, frase o apartado en la ficha, hace fallar el test.
- Humo con navegador, a 1920×1080, 1366×650, 820×1180 y 390×844: la página de entrada, cada simulación con «ver todas», cada combinación sugerida y «ver juntas» cargan sin errores; ningún panel se solapa con otro (en **todos** los módulos, migrados o no); cada gráfica supera un tamaño mínimo; capturas guardadas en `capturas/`.
- URL: abrir el enlace copiado de una pantalla restaura la misma simulación, gráficas, pantalla y parámetros.
- Estado: cambiar un parámetro y pasar a otra pantalla muestra en ella el estado actual.
- La animación vuelve a empezar al llegar al final sin intervención.
- El modo presentación sigue pasando sus pruebas; las teclas 1–9 abren la simulación de cada preset.
- Revisión independiente (una ronda): corrección física de los textos nuevos o cambiados y del glosario, que cada «Prueba esto» haga lo que dice en la pantalla nueva y que se cumple lo pedido en este encargo.

## Validación con Daniel
Una sola pregunta: ¿sé en todo momento qué estoy viendo y llego fácilmente a lo que quiero ver? Una ronda de correcciones como máximo; lo que no impida entender ni navegar va a `docs/BACKLOG.md`. Después se extiende a oscilador, plasmón y luz y materia, y el encargo 04 se construye ya con este formato.

## Pasos sugeridos
1. Correcciones independientes de la maqueta: test de solapes en todos los módulos, bucle en lugar del aviso, estado inicial por simulación.
2. Contrato nuevo y página de entrada.
3. Pantallas, navegación, selección en la URL y «ver juntas».
4. Explicaciones desde la ficha y glosario.
5. Tipografía: fuente, KaTeX en títulos y leyendas, Unicode en ejes, con capturas comparativas.
6. ARQUITECTURA, revisión independiente y cierre en `PROGRESO.md`.

## Fuera de alcance
- Cambios en la física de los módulos.
- Migrar los demás módulos (después de validar).
- Rediseño del modo presentación.
- Módulos introductorios nuevos (backlog).
