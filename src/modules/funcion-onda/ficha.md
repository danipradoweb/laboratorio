# Ondas clásicas y función de onda

## Qué estás viendo

El módulo tiene tres vistas (control «Vista»). En las dos cuánticas, la función de onda $\psi$ se dibuja siempre igual: un **relleno de color** cuya altura es $|\psi|$ (o $|\psi|^2$, con el conmutador «Dibujar |ψ|²») y cuyo **tono es la fase** de $\psi$, según la rueda de colores que hay junto a la gráfica (rojo, fase 0; amarillo verdoso, π/2; azul verdoso, ±π; violeta, −π/2). La línea de arriba de las vistas resume el instante actual.

Unidades: posiciones en nanómetros (nm), tiempos en femtosegundos (fs, 10⁻¹⁵ s), energías en electronvoltios (eV) y masas en masas del electrón ($m_e$).

### Vista «Un paquete de ondas en movimiento» · ψ(x), arriba a la izquierda

**Qué ves.** El eje horizontal es la posición $x$ en nanómetros. El eje izquierdo es la amplitud de la función de onda, $\psi$, en unidades de uno partido por la raíz de un nanómetro (con «Dibujar |ψ|²», la densidad de probabilidad $|\psi|^2$ en probabilidad por nanómetro). El eje derecho es energía, en electronvoltios, y solo se refiere a dos cosas: la línea gris con la zona sombreada debajo, que es el potencial $V(x)$, y la línea azul de trazos horizontal, que es la energía media del paquete $\langle E\rangle$. La línea vertical de puntos marca la posición media $\langle x\rangle$. Con «Mostrar Re ψ» y «Mostrar Im ψ» aparecen la parte real (azul) y la imaginaria (naranja). Con «Comparar con el mismo paquete con k₀ opuesto» aparece debajo una segunda gráfica igual, para un paquete que solo difiere en el signo de su número de onda.

**Cómo leerla.** La altura del relleno dice dónde es probable encontrar la partícula; el color, la fase. Lo físico es $|\psi|^2$: la fase, por sí sola, no se ve en ninguna medida de posición, pero la forma en que cambia de un punto a otro sí importa, porque lleva el momento. Si los colores se suceden rápidamente a lo largo de $x$, el paquete tiene mucho momento; el orden en que se suceden dice hacia dónde va. Nada de esto vibra en el espacio: $\psi$ es una herramienta para calcular probabilidades, y sus partes real e imaginaria cambian con una elección arbitraria (la fase global). Donde el potencial está por encima de la energía del paquete, una partícula clásica no podría estar; la onda entra un poco, decayendo.

**Prueba esto.** (1) Elige el preset «Efecto túnel por debajo de la barrera»: el paquete, de energía media 0,2 eV, llega a una barrera de 0,3 eV; dentro de ella el relleno no se corta de golpe, y al final una parte sigue al otro lado. La línea de estado acaba en «al otro lado del potencial: 13,7 % (esperado con ondas planas: 13,7 %)». (2) Pausa el reloj, activa «Mostrar Re ψ» y mueve «Fase global φ»: los colores y la curva azul cambian, pero la altura del relleno y los títulos de las gráficas de momentos y de valores esperados (⟨p⟩/ħ, Δk, ⟨x⟩, Δx) se quedan exactamente igual.

### Vista «Un paquete» · Espacio de momentos, arriba a la derecha

**Qué ves.** El eje horizontal es el número de onda $k$, en uno partido por nanómetro; es el momento dividido por la constante de Planck reducida, $p/\hbar$. Valores positivos, movimiento hacia la derecha; negativos, hacia la izquierda. El eje izquierdo es la densidad de probabilidad en momentos, $|\varphi(k)|^2$, en nanómetros, dibujada con el mismo relleno de color de fase. La curva verde, con el eje derecho (de 0 a 1), es la probabilidad de que una onda plana de ese número de onda atraviese el potencial; solo aparece con potenciales hechos de escalones (escalón, barreras, pozos y el dibujado). La línea vertical de puntos marca el momento medio $\langle k\rangle$. Con el paquete gemelo, su distribución aparece en gris de trazos.

**Cómo leerla.** La misma $\psi$ se puede escribir como suma de ondas planas, cada una con un momento definido; esta gráfica dice cuánto pesa cada una. Un paquete estrecho en posición es ancho aquí, y al revés (eso es el principio de incertidumbre). Mientras el paquete es libre esta gráfica no cambia, aunque el paquete se ensanche en $x$: ninguna onda plana cambia de momento. Al chocar con un potencial aparece un segundo bulto en los $k$ de signo contrario: es la parte reflejada. Comparar el bulto con la curva verde enseña qué componentes pasarán y cuáles rebotarán.

**Prueba esto.** (1) En «Escalón por encima de su altura», cuando el paquete llega al escalón aparece un bulto pequeño en los $k$ negativos aunque el paquete tiene energía de sobra para subir: es la reflexión cuántica (al final, un 13 % ha rebotado). (2) Haz clic en la zona de $k$ negativos: el paquete vuelve a empezar con la energía $\hbar^2k^2/2m$ de ese punto y el conmutador «Hacia la izquierda» activado.

### Vista «Un paquete» · La cuerda clásica, abajo a la izquierda

**Qué ves.** El eje horizontal es la posición en nanómetros, la misma que en la gráfica de $\psi$. El eje vertical es el desplazamiento de una cuerda, relativo a su valor máximo al empezar. La curva azul es una cuerda clásica que arrancó con la misma forma que la parte real de $\psi$ y viaja a la velocidad de grupo del paquete (el título dice cuánto vale, en nanómetros por femtosegundo). Las líneas rosas de trazos son la envolvente del paquete cuántico, $\pm|\psi|$, con la misma escala que la cuerda al empezar. La cuerda no siente el potencial.

**Cómo leerla.** En la cuerda todas las ondas viajan a la misma velocidad (frecuencia proporcional al número de onda), así que el pulso conserva su forma para siempre. En la partícula la frecuencia crece con el cuadrado del número de onda: las componentes rápidas se adelantan y las lentas se quedan atrás, y el paquete se ensancha y baja aunque nada lo empuje. Aquí, además, la cuerda sí es algo que se mueve en el espacio; el paquete cuántico, no.

**Prueba esto.** Elige «Paquete libre que se ensancha»: a los 100 fs la envolvente rosa mide unas seis veces la anchura inicial y es mucho más baja, mientras la cuerda azul sigue con altura 1. Sube después la masa a 3 $m_e$: el ensanchamiento es claramente más lento (el tiempo característico crece con la masa).

### Vista «Un paquete» · Valores esperados, abajo a la derecha

**Qué ves.** Dos gráficas con el tiempo en femtosegundos en el eje horizontal. En la de arriba, la curva azul es la posición media $\langle x\rangle$ (eje izquierdo, en nanómetros) y la naranja el momento medio dividido por $\hbar$, $\langle k\rangle$ (eje derecho, en uno partido por nanómetro). Con el potencial libre o el armónico, una línea gris de puntos da la trayectoria de una partícula clásica que sale del mismo sitio con la misma velocidad. En la de abajo, la curva amarilla es el producto de las incertidumbres $\Delta x\,\Delta p$ dividido por $\hbar$, y la línea azul de trazos marca su mínimo posible, 1/2. La línea vertical gris es el instante actual. Cuando más de un 1 % del paquete ha salido por los bordes de la región simulada, las curvas se paran (los valores serían los de la parte que queda dentro).

**Cómo leerla.** Las medias se mueven como una partícula clásica cuando la fuerza no cambia a lo largo del paquete (libre y armónico): es el teorema de Ehrenfest. El producto de incertidumbres nunca baja de 1/2; vale justo eso al principio, porque el paquete inicial es gaussiano, y crece cuando el paquete se ensancha o se parte en dos.

**Prueba esto.** (1) Con «Estado coherente en el oscilador armónico», la curva azul va y viene encima de la línea de puntos clásica, con periodo de 41 fs, y el título de esta gráfica muestra $\Delta x\cdot\Delta p/\hbar = 0{,}500$ todo el rato. (2) Con «Paquete libre que se ensancha», $\langle k\rangle$ se queda constante mientras $\Delta x\cdot\Delta p/\hbar$ crece (unos 2,0 a los 67 fs y 3,8 a los 130 fs).

### Vista «Estados propios y superposición» · Niveles de energía, arriba a la izquierda

**Qué ves.** El eje horizontal es la posición en nanómetros; el vertical, energía en electronvoltios. La línea gris es el potencial (en el pozo infinito, dos paredes verticales). Cada línea horizontal es la energía de un estado propio, y sobre ella está dibujada la forma de ese estado, $\varphi_n$, con una escala vertical arbitraria. El primer estado elegido va en azul y el segundo en naranja; los demás, en gris.

**Cómo leerla.** Al confinar una onda solo sobreviven ciertas formas: las que encajan entre las paredes. En el pozo infinito son exactamente los modos de una cuerda atada, $\sin(n\pi x/L)$; cada una tiene una energía fija y un nodo más que la anterior. En el oscilador armónico los niveles están igualmente espaciados; en el pozo infinito se separan cada vez más. Con potenciales abiertos (barreras, escalón, dibujado) los estados se calculan dentro de una caja de 20 nm, y lo dice el título; en el pozo finito, los niveles por encima de 0 eV son estados de esa caja, no estados ligados del pozo.

**Prueba esto.** (1) Haz clic sobre un nivel: pasa a ser el segundo estado de la superposición (se ve en el control «Segundo estado» y en las demás gráficas). (2) En «Superposición 1 + 2 oscilando», cambia la anchura del pozo de 0,8 a 0,6 nm: todos los niveles suben, las energías crecen como uno partido por el cuadrado de la anchura.

### Vista «Estados» · ψ(x, t), arriba a la derecha

**Qué ves.** El eje horizontal es la posición en nanómetros; el vertical, $\psi$ en uno partido por la raíz de un nanómetro (o $|\psi|^2$ en uno partido por nanómetro). Es la superposición de los dos estados elegidos, con el relleno de color de fase y, si se activan, sus partes real e imaginaria. El título escribe la superposición: los pesos de cada estado y la fase relativa.

**Cómo leerla.** Un estado propio solo, sin mezclar, no cambia de forma: lo único que se mueve es su fase, que gira igual en todos los puntos. Por eso se llama estacionario. Con dos estados, cada uno gira a su ritmo (proporcional a su energía), y donde sus fases coinciden se refuerzan y donde se oponen se cancelan: la probabilidad se mueve de un lado a otro. Es la interferencia de siempre, pero en el tiempo.

**Prueba esto.** (1) Con «Estados del pozo» (un solo estado, el segundo), activa «Mostrar Im ψ»: las curvas real e imaginaria se pasan el relevo como un coseno y un seno, y el relleno no cambia de altura. (2) En «Superposición 1 + 2 oscilando», sube y baja «Peso del segundo estado»: con 0 la forma se congela; con 0,5 la probabilidad se balancea entre las dos mitades del pozo.

### Vista «Estados» · El puente con la luz, abajo a la izquierda

**Qué ves.** El eje horizontal es el tiempo en femtosegundos (tres periodos de la oscilación); el vertical, la posición media de la partícula $\langle x\rangle$ en nanómetros. La línea de trazos es el valor medio alrededor del cual oscila, y la línea gris vertical, el instante actual. El título da el periodo de la oscilación, su amplitud, la energía del fotón asociado y su longitud de onda, con una muestra de su color si cae en el visible.

**Cómo leerla.** En la superposición, la carga se balancea con frecuencia igual a la diferencia de energías dividida por $\hbar$. Una carga que oscila es una pequeña antena, un dipolo: emite luz de esa frecuencia y la luz de esa frecuencia la puede poner a oscilar (absorción). Es el oscilador forzado del primer módulo y la lámina de dipolos de «Luz y materia». Un estado propio solo no oscila y no radia. Y hay parejas de estados que tampoco: si los dos son simétricos respecto al centro, la posición media no se mueve aunque la forma cambie, y la transición no emite luz como dipolo (regla de selección).

**Prueba esto.** (1) En «Superposición 1 + 2 oscilando» el título dice periodo 2,35 fs y fotón de 1,76 eV con λ = 703,4 nm, visible, con su muestra roja; baja la anchura del pozo a 0,6 nm y pasa a λ = 395,7 nm, en el borde del violeta. (2) Pon «Segundo estado» en 3: la curva se queda plana y el título dice que ⟨x⟩ no oscila porque el elemento de matriz de la posición entre los estados 1 y 3 es cero.

### Vista «Estados» · Los coeficientes en el plano complejo, abajo a la derecha

**Qué ves.** Un plano con la parte real del número complejo en horizontal y la imaginaria en vertical, sin unidades, con el círculo de radio 1. Cada flecha es el coeficiente de un estado en este instante, ya multiplicado por su factor de giro: azul el primero y naranja el segundo. Su longitud es la raíz del peso del estado. El título da el ángulo entre las dos flechas.

**Cómo leerla.** Cada coeficiente gira con una velocidad angular igual a su energía dividida por $\hbar$. Cuánto vale cada velocidad depende de dónde se ponga el cero de energías, algo arbitrario; lo que no depende es la diferencia entre ellas, que es justo lo que se observa. Igual con la fase: girar las dos flechas a la vez (fase global) no cambia nada medible; cambiar el ángulo entre ellas (fase relativa) sí. Esa fase relativa es el ángulo azimutal de la esfera de Bloch de un sistema de dos niveles; la fase global ni siquiera aparece en ella.

**Prueba esto.** Pausa el reloj. Mueve «Fase global φ»: las dos flechas giran juntas y el ángulo del título no cambia (tampoco $|\psi|^2$). Mueve «Fase relativa θ»: cambia el ángulo, y cambian la forma de $|\psi|^2$ y la posición de la curva del puente con la luz.

### Vista «La cuerda clásica» · La cuerda, arriba a la izquierda

**Qué ves.** El eje horizontal es la posición a lo largo de la cuerda, como fracción de su longitud $L$; el vertical, el desplazamiento de la cuerda, en unidades arbitrarias. La curva azul es la cuerda. Con un modo, las líneas rosas de trazos son su envolvente y las verticales grises sus nodos; con dos modos, cada modo por separado aparece en trazos finos verde y amarillo.

**Cómo leerla.** La ecuación de la cuerda es lineal: cualquier suma de soluciones es solución. Un pulso viaja sin deformarse y al llegar a un extremo se refleja: invertido si el extremo está atado, derecho si está libre. Un modo es una onda estacionaria que sube y baja entera sin moverse de sitio; dos modos superpuestos cambian de forma porque oscilan a frecuencias distintas. La forma de cada modo con extremos atados es la misma función que el estado del mismo número de una partícula en una caja.

**Prueba esto.** (1) Con «Pulso que viaja» y extremos fijos, el pulso vuelve boca abajo; cambia a extremos libres y vuelve boca arriba. (2) Con «Pulso soltado en reposo», el pulso se parte en dos de la mitad de altura que se separan en sentidos contrarios.

### Vista «La cuerda» · Misma forma, distinto reloj, arriba a la derecha

**Qué ves.** El eje horizontal es el número del modo, $n$; el vertical, la frecuencia de cada modo dividida por la del primero. Los puntos azules son la cuerda; los naranjas, una partícula en una caja de la misma anchura. Las líneas verticales marcan los modos elegidos.

**Cómo leerla.** Las formas son las mismas, pero la cuerda tiene frecuencias $1, 2, 3\dots$ veces la fundamental y la partícula $1, 4, 9\dots$: la frecuencia de la cuerda crece con el número de onda y la de la partícula con su cuadrado. Por eso un pulso de cuerda se recompone periódicamente igual y un paquete cuántico se deforma.

**Prueba esto.** Con la forma «Un modo», haz clic sobre el modo 3 de esta gráfica: la cuerda pasa al modo 3, con dos nodos en el interior, y la línea vertical marca n = 3, donde la partícula tendría una frecuencia 9 veces la fundamental y la cuerda solo 3.

### Vista «La cuerda» · Energía de la cuerda, abajo

**Qué ves.** El eje horizontal es el tiempo, en periodos del modo fundamental con extremos fijos; el vertical, la energía dividida por la energía total. Azul, la cinética (la del movimiento); naranja, la potencial (la del estiramiento); negro (blanco en el tema oscuro), la total.

**Cómo leerla.** La energía va y viene entre movimiento y estiramiento, pero la suma no cambia: la cuerda no tiene rozamiento. El título lo comprueba numéricamente. Para la cuerda, saber la forma en un instante no basta para predecir el futuro: hay que saber también la velocidad. Esa es la diferencia con la ecuación de Schrödinger, de primer orden en el tiempo.

**Prueba esto.** Con «Pulso que viaja», mira el instante en que el pulso toca el extremo: con extremos fijos la cuerda queda momentáneamente plana y toda la energía es cinética (azul en 1); con extremos libres el desplazamiento se duplica, la cuerda se para un instante y toda la energía es potencial (naranja en 1).

## Qué es físico y qué es representación

- **Físico**: $|\psi|^2$ (densidad de probabilidad), los valores esperados, las incertidumbres, las energías de los niveles, las probabilidades de transmisión y reflexión, y la frecuencia de oscilación de $\langle x\rangle$. También el desplazamiento de la cuerda, que es una magnitud que se mueve de verdad en el espacio.
- **Representación**: el color de fase y las partes real e imaginaria de $\psi$. Multiplicar $\psi$ por $e^{i\varphi}$ cambia todos los colores y nada observable (control «Fase global φ»). Las **diferencias** de fase entre puntos o entre estados sí tienen consecuencias: el gradiente de fase es el momento y la fase relativa entre dos estados decide la forma de $|\psi|^2$.
- **ψ no es una onda en el espacio físico.** Para una partícula vive en una dimensión, como aquí; para $N$ partículas es una función de $3N$ coordenadas, $\psi(\mathbf{r}_1, \dots, \mathbf{r}_N, t)$, y no se puede dibujar como algo que vibre en nuestro espacio. La cuerda, en cambio, sí.
- La cuerda de la vista del paquete viaja a la velocidad de grupo del paquete para comparar formas; su velocidad no sale de ninguna relación física con el electrón.
- Las alturas de las funciones $\varphi_n$ en el diagrama de niveles tienen una escala arbitraria: solo su forma y su nivel tienen sentido.

## Ecuaciones

Ecuación de ondas de la cuerda (segundo orden en el tiempo) y de Schrödinger (primero):

$$\frac{\partial^2 u}{\partial t^2} = c^2\,\frac{\partial^2 u}{\partial x^2}, \qquad i\hbar\,\frac{\partial \psi}{\partial t} = -\frac{\hbar^2}{2m}\frac{\partial^2 \psi}{\partial x^2} + V(x)\,\psi$$

Dispersión de las ondas planas $e^{i(kx - \omega t)}$: $\omega = ck$ para la cuerda y $\omega = \hbar k^2/2m$ para la partícula libre. Paquete gaussiano inicial y su anchura libre (Griffiths, problema 2.21):

$$\psi(x, 0) = (2\pi\sigma_0^2)^{-1/4}\,e^{-(x - x_0)^2/4\sigma_0^2}\,e^{ik_0 x}, \qquad \sigma(t) = \sigma_0\sqrt{1 + \left(\frac{\hbar t}{2m\sigma_0^2}\right)^2}$$

Momentos, valores esperados e incertidumbre:

$$\varphi(k) = \frac{1}{\sqrt{2\pi}}\int \psi(x)\,e^{-ikx}\,dx, \qquad \langle p\rangle = \hbar\langle k\rangle, \qquad \Delta x\,\Delta p \ge \frac{\hbar}{2}$$

Método numérico (paso partido de Strang, con $T(k) = \hbar^2k^2/2m$ aplicado en el espacio de momentos con la FFT):

$$\psi(t + \Delta t) \approx e^{-iV\Delta t/2\hbar}\,\mathcal{F}^{-1}\!\left[e^{-iT(k)\Delta t/\hbar}\,\mathcal{F}\!\left[e^{-iV\Delta t/2\hbar}\,\psi(t)\right]\right]$$

Con bordes absorbentes se añade $-iW(x)$ al potencial cerca de los bordes ($W \ge 0$). Transmisión de una barrera de altura $V_0$ y anchura $a$ con $E < V_0$ (Griffiths, problema 2.33), y la de cualquier potencial a escalones por matriz de transferencia (continuidad de $\psi$ y $\psi'$ en cada salto):

$$T = \left[1 + \frac{V_0^2\,\sinh^2(\kappa a)}{4E(V_0 - E)}\right]^{-1}, \qquad \kappa = \frac{\sqrt{2m(V_0 - E)}}{\hbar}$$

Estados propios, del hamiltoniano en diferencias finitas (matriz tridiagonal), y referencias exactas:

$$E_n^{\text{pozo}} = \frac{n^2\pi^2\hbar^2}{2mL^2}, \qquad E_n^{\text{armónico}} = \hbar\omega\left(n + \tfrac{1}{2}\right)$$

Superposición de dos estados y su dipolo (con $\varphi_n$ reales):

$$\psi = c_1\varphi_1 e^{-iE_1t/\hbar} + c_2\varphi_2 e^{-iE_2t/\hbar}, \qquad \langle x\rangle(t) = |c_1|^2x_{11} + |c_2|^2x_{22} + 2\,\mathrm{Re}\!\left(c_1^*c_2\,x_{12}\,e^{-i\omega_{21}t}\right)$$

con $\omega_{21} = (E_2 - E_1)/\hbar$ y $x_{12} = \int\varphi_1\,x\,\varphi_2\,dx$. El fotón asociado tiene energía $E_2 - E_1$ y longitud de onda $\lambda = hc/(E_2 - E_1)$. En el pozo infinito, $|x_{12}| = 16L/9\pi^2$; con estados de la misma paridad en un potencial simétrico, $x_{12} = 0$.

Cuerda: modos $\sin(n\pi x/L)$ (extremos fijos) o $\cos(n\pi x/L)$ (libres) con $\omega_n = n\pi c/L$; esquema de salto de rana con número de Courant $c\Delta t/\Delta x = 1$, que en una dimensión es exacto en los nodos.

## Límites del modelo

- Una sola partícula en una dimensión, sin espín, no relativista. El entrelazamiento y el espacio de $3N$ dimensiones solo se mencionan.
- La región simulada del paquete es finita: de −80 a 80 nm, con 2048 puntos (Δx = 0,078 nm, números de onda hasta 40 nm⁻¹). Sin bordes absorbentes es periódica (lo que sale por un lado entra por el otro). Con ellos, lo que entra en las franjas de los bordes desaparece; la línea de estado cuenta lo que ha salido por cada lado.
- El potencial de cada punto de la malla es el promedio del potencial en su celda: los bordes de una barrera quedan suavizados en 0,08 nm.
- El pozo «infinito» de la vista del paquete tiene paredes de 15 eV, y el armónico se recorta a 20 eV, lejos de donde está la partícula: el método necesita pasos de tiempo tanto más cortos cuanto más alto es el potencial. En la vista de estados el pozo infinito sí tiene paredes infinitas.
- El paso partido tiene un error que crece con el cuadrado del paso de tiempo (aquí, como mucho 0,02 fs), mayor con potenciales de bordes abruptos; en las comprobaciones, la transmisión simulada coincide con la de ondas planas a menos del 1 %.
- Los estados de la vista de estados se calculan en una caja de 1000 puntos: los niveles altos de un pozo finito o de los potenciales abiertos dependen de esa caja.
- La cuerda es ideal: sin rigidez, sin rozamiento y con desplazamientos pequeños.
- La conexión con la luz es la aproximación dipolar: no se calcula la emisión, solo la frecuencia y el dipolo oscilante. La vida de la superposición (emisión espontánea) no está incluida: la oscilación sigue para siempre.

## Referencias

- D. J. Griffiths y D. F. Schroeter, *Introduction to Quantum Mechanics*, 3.ª ed., caps. 1 y 2 (función de onda e interpretación estadística, estados estacionarios, pozo infinito, oscilador armónico, partícula libre y paquetes, pozo finito, escalón y barrera); §3.5 para la incertidumbre.
- I. N. Levine, *Quantum Chemistry*, caps. 1–4 (ecuación de Schrödinger, partícula en una caja, oscilador armónico).
- R. P. Feynman, *The Feynman Lectures on Physics*, vol. III, caps. 1–3 (comportamiento cuántico, amplitudes de probabilidad, interferencia) y cap. 7 (dependencia temporal de las amplitudes, estados estacionarios).
- Ecuación de ondas y modos de una cuerda: Feynman, vol. I, caps. 47–49.
- Método de paso partido: M. D. Feit, J. A. Fleck y A. Steiger, *J. Comput. Phys.* 47, 412 (1982).
