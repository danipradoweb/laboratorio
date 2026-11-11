# Plantilla: ondas estacionarias

## Qué estás viendo

A la izquierda, una cuerda de longitud $L$ vibrando en su modo normal $n$: la línea es la forma de la cuerda en este instante y la zona sombreada, la región que barre al moverse. Las líneas verticales de puntos marcan los **nodos**, los puntos que no se mueven nunca. A la derecha, la frecuencia de cada modo; la línea vertical señala el modo elegido.

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
