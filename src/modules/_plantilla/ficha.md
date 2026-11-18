# Plantilla: ondas estacionarias

## Qué estás viendo

Una cuerda de longitud $L$, atada o suelta por los extremos, vibrando en uno de sus modos normales, y las frecuencias de todos los modos. Las dos vistas están enlazadas: el modo elegido es el mismo en las dos.

### La cuerda en el instante actual, a la izquierda

**Qué ves.** El eje horizontal es la posición a lo largo de la cuerda, $x/L$, en fracciones de su longitud (de 0 a 1, sin unidades). El eje vertical es el desplazamiento $y$ de cada punto de la cuerda, en unidades arbitrarias (su máximo es el control «Amplitud»). La curva azul es la forma de la cuerda en este instante; la zona azul clara sombreada, que se quita con «Mostrar la envolvente», es la región que barre al moverse. Las líneas verticales azules de trazos marcan los **nodos**, los puntos que no se mueven nunca (con extremos fijos, también los dos extremos).

**Cómo leerla.** En un modo normal todos los puntos de la cuerda oscilan con la misma frecuencia: suben y bajan a la vez (o a la contra, a los dos lados de un nodo), y la forma no viaja a lo largo de la cuerda, solo crece y decrece. Cuantos más nodos, más corto es cada arco y más deprisa oscila. Con los extremos libres, los extremos son los puntos que más se mueven.

**Prueba esto.** (1) Con el preset «Tercer armónico», hay dos nodos interiores, en $x/L$ = 1/3 y 2/3, y la cuerda no se mueve nunca en ellos. (2) Con «Extremos libres, n = 2», los extremos suben y bajan al máximo y los nodos pasan a $x/L$ = 1/4 y 3/4.

### Frecuencias de los modos, a la derecha

**Qué ves.** El eje horizontal es el número de modo $n$, de 1 a 6. El eje vertical es la frecuencia angular de cada modo dividida por la del modo fundamental con los extremos fijos, sin unidades. Cada punto azul es un modo; la línea vertical azul con la etiqueta «n = …» señala el modo elegido. Un clic en la gráfica elige el modo más cercano.

**Cómo leerla.** Las frecuencias crecen en proporción al número de modo: los puntos están en línea recta y cada modo vibra un número entero de veces más deprisa que el fundamental. Por eso una cuerda tensa da notas armónicas entre sí.

**Prueba esto.** (1) Haz clic sobre el punto de $n$ = 4: la línea vertical salta a 4, el control «Modo n» también, y la cuerda de la izquierda muestra tres nodos interiores, en $x/L$ = 1/4, 1/2 y 3/4. (2) Cambia «Extremos» a «Libres»: los puntos no se mueven, porque con los dos extremos libres las frecuencias son las mismas que con los dos fijos.

## Qué es físico y qué es representación

El desplazamiento $y(x, t)$ es una magnitud física: la cuerda de verdad está ahí. La amplitud está exagerada respecto a la longitud para que se vea; en una cuerda real es mucho menor que $L$, y solo entonces vale la ecuación de ondas lineal.

## Ecuaciones

Ecuación de ondas y condiciones de contorno de extremos fijos:

$$\frac{\partial^2 y}{\partial t^2} = c^2\,\frac{\partial^2 y}{\partial x^2}, \qquad y(0, t) = y(L, t) = 0$$

Modos normales y sus frecuencias:

$$y_n(x, t) = A\,\sin\!\left(\frac{n\pi x}{L}\right)\cos(\omega_n t), \qquad \omega_n = \frac{n\pi c}{L}$$

Con extremos libres, el seno se sustituye por un coseno.

## Límites del modelo

- Cuerda ideal: sin rigidez, sin rozamiento y con amplitud pequeña.
- Solo se muestra un modo cada vez; el movimiento general es una suma de modos.

## Referencias

- Feynman, *Lectures on Physics*, vol. I, cap. 49 ("Modes").
