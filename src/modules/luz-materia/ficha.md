# Luz y materia: del oscilador a la reflexión

Reflexión, refracción, absorción y el brillo de los metales salen de un solo mecanismo. El campo de la luz fuerza a oscilar a los electrones del material **a la frecuencia de la luz**; cada electrón que oscila radia una onda de esa misma frecuencia; y lo que «hace» el material es la suma de la onda incidente con todas esas ondas radiadas. La luz no rebota, ni se absorbe y se vuelve a emitir con retraso: es una oscilación forzada y coherente, como la del módulo [oscilador](#/oscilador).

## Qué estás viendo

El módulo tiene cuatro vistas (control **Vista**) que comparten el **material** y la **energía del fotón** $\hbar\omega$. La línea de arriba dice siempre qué material es, qué $n$ y $k$ tiene a esa frecuencia y de dónde salen los números.

**A · El material.**

- *Función dieléctrica*: $\varepsilon'$ (la parte de la respuesta que va en fase con el campo) y $\varepsilon''$ (la que va en cuadratura: absorción). La banda sombreada es el visible.
- *Índice de refracción*: $n$ (cuánto se acorta la longitud de onda) y $k$ (cuánto se atenúa la onda), con $n + ik = \sqrt{\varepsilon}$.
- *Reflectancia* en incidencia normal, y en el título el coeficiente de absorción.
- *Los osciladores*: cada oscilador del modelo, moviéndose empujado por el campo. La flecha naranja es la fuerza; el punto azul, la carga. A la derecha, las dos como flechas que giran: el ángulo entre ellas es el retraso $\delta$. Por debajo de su resonancia el oscilador sigue al campo ($\delta \approx 0$); en resonancia va en cuadratura ($\delta = 90°$: absorbe); por encima va en oposición ($\delta \approx 180°$).
- Un clic en cualquier gráfica fija la energía. El eje se puede poner en longitud de onda.

**B · Láminas de dipolos.** El material son láminas delgadas de osciladores, separadas una distancia $d$; la luz llega por la izquierda.

- *Las ondas por separado*: la incidente (naranja), la que radia cada lámina (verde fino) y la suma de las radiadas (verde grueso).
- *El campo total*: incidente más radiadas. Delante, la onda reflejada (trazos); dentro, una onda más corta, con una regla que mide $\lambda_0/n$; detrás, la transmitida.
- *Onda transmitida* y *onda reflejada*: cómo se construye cada una sumando, como flechas (fasores), lo que aporta cada lámina.
- Las láminas se pueden encender una a una, a mano o solas.

**C · Una superficie.** Luz que llega inclinada.

- *Reflexión y transmisión* frente al ángulo, para las dos polarizaciones, con el ángulo de Brewster y el crítico.
- *Mapa de las ondas*: el campo en el plano de incidencia. Arriba, la onda incidente y la reflejada, que interfieren; abajo, la refractada, o la onda evanescente en reflexión total.
- *Rayos y dipolos*: los tres rayos con su campo eléctrico (flechas en polarización p; puntos y aspas en s, donde el campo es perpendicular al dibujo), y en verde el diagrama de radiación de un dipolo del material. El punto rosa marca cuánto radia ese dipolo hacia donde sale el rayo reflejado.

**C · Polarizadores y gafas de sol.**

- *Banco de polarizadores*: luz no polarizada que cruza dos o tres polarizadores ideales; sobre cada tramo, la intensidad que queda.
- *Ley de Malus*: la intensidad final frente al ángulo del analizador.
- *Reflejo de luz no polarizada* en el material (el agua, por ejemplo): $R_s$, $R_p$ y el grado de polarización del reflejo.
- *Lo que llega al ojo*: el reflejo visto sin gafas, con gafas grises y con gafas polarizadas.

## Qué es físico y qué es representación

- **Físico**: $\varepsilon$, $n$, $k$ y $R$; el retraso $\delta$ de cada oscilador; las ondas de las láminas con sus amplitudes y fases; $R$, $T$ y la absorción; la longitud de onda dentro del material; los coeficientes de Fresnel, los ángulos de Brewster y crítico, la onda evanescente y su profundidad; la ley de Malus.
- **Representación**: el desplazamiento de las cargas está enormemente exagerado, y su amplitud se dibuja en escala comprimida (raíz cúbica), porque entre la resonancia y lejos de ella cambia en órdenes de magnitud. El número $|\chi|$ que hay al lado es el dato.
- La animación va muchísimo más despacio que la luz, y un periodo dura lo mismo en pantalla a cualquier frecuencia.
- **Las láminas son un modelo en una dimensión**: cada una es una capa continua de carga, no átomos sueltos. Un material real no está hecho de láminas, pero el resultado (ondas radiadas que se suman a la incidente) es el mismo.
- **El «vidrio» es un modelo**: tres osciladores de Lorentz cuyas frecuencias e intensidades salen de la fórmula de Sellmeier de la sílice fundida (Malitson, 1965). La anchura de cada resonancia, $\gamma = \omega_0/100$, es una elección del módulo: la fórmula no la da. El **metal de Drude** usa valores redondos de ejemplo ($\hbar\omega_p = 10$ eV, $\hbar\gamma = 0{,}1$ eV), no los de un metal concreto. El **agua** y el **oro** son constantes ópticas medidas.
- **El diagrama de radiación del dipolo** es el de un dipolo aislado. Sirve para ver por qué se anula $R_p$ en el ángulo de Brewster; el cálculo exacto son las condiciones de contorno de Maxwell en la superficie (los coeficientes de Fresnel). Al salir del material al aire no se dibuja, porque en el aire no hay dipolos.
- Los rayos no están a escala con la longitud de onda, y su grosor indica la potencia.
- En el mapa de las ondas se dibuja la componente perpendicular al dibujo ($E_y$ en polarización s, $H_y$ en p), que es la que no salta en la superficie.
- Los polarizadores son ideales: dejan pasar todo el campo paralelo a su eje y nada del perpendicular. Las muestras de brillo de las gafas son relativas al reflejo sin gafas.

## Ecuaciones

Convenio en todo el módulo: los campos varían como $e^{-i\omega t}$; absorber es $\varepsilon'' > 0$ y $k > 0$.

**Del oscilador a la función dieléctrica.** Un electrón ligado, con $m\ddot{x} + m\gamma\dot{x} + m\omega_0^2 x = -eE_0 e^{-i\omega t}$, oscila con $x = \dfrac{-eE_0/m}{\omega_0^2 - \omega^2 - i\gamma\omega}\,e^{-i\omega t}$. Con $N$ osciladores por unidad de volumen, $P = -Nex = \varepsilon_0\chi E$:

$$\varepsilon(\omega) = 1 + \chi(\omega) = 1 + \sum_j \frac{f_j\,\omega_p^2}{\omega_{0j}^2 - \omega^2 - i\gamma_j\omega}, \qquad \omega_p^2 = \frac{Ne^2}{\varepsilon_0 m}$$

Con $\omega_0 = 0$ es el modelo de Drude (electrones libres). De $\varepsilon$ sale lo demás:

$$n + ik = \sqrt{\varepsilon}, \qquad R = \left|\frac{n + ik - 1}{n + ik + 1}\right|^2, \qquad \alpha = \frac{4\pi k}{\lambda_0}$$

donde $\alpha$ es el coeficiente de absorción de la intensidad, $I(z) = I_0 e^{-\alpha z}$. La fórmula de Sellmeier, $n^2 - 1 = \sum_i B_i\lambda^2/(\lambda^2 - C_i^2)$, es este modelo sin amortiguamiento, con $\omega_{0i} = 2\pi c/C_i$ y $f_i\omega_p^2 = B_i\omega_{0i}^2$.

La causalidad liga las dos partes de $\varepsilon$ (Kramers-Kronig), y la absorción total solo cuenta electrones (regla de suma):

$$\varepsilon'(\omega) - 1 = \frac{2}{\pi}\,\mathrm{P}\!\!\int_0^\infty \frac{\omega'\,\varepsilon''(\omega')}{\omega'^2 - \omega^2}\,d\omega', \qquad \int_0^\infty \omega\,\varepsilon''(\omega)\,d\omega = \frac{\pi}{2}\,\omega_p^2\sum_j f_j$$

**Láminas de dipolos (deducción).** Una lámina en $z_j$ con polarización superficial $P_s$ (momento dipolar por unidad de área) es una lámina de corriente $K = \partial P_s/\partial t = -i\omega P_s$, y radia hacia cada lado una onda plana de amplitud $-\mu_0 c K/2$:

$$E_{\mathrm{rad},j}(z) = \frac{ik}{2\varepsilon_0}\,P_{s,j}\,e^{ik|z - z_j|}$$

El factor $i$ dice que la onda radiada va un cuarto de periodo desfasada respecto a las cargas. La lámina responde al campo total que hay en ella, $P_{s,j} = \eta\,\alpha(\omega)\,E(z_j)$, con $\eta$ osciladores por unidad de área de polarizabilidad $\alpha$. Si las láminas reparten un material de $N$ osciladores por unidad de volumen en capas separadas $d$, entonces $\eta = Nd$ y $N\alpha/\varepsilon_0 = \chi$, y todo depende de un número:

$$\kappa = \frac{k\,\eta\,\alpha}{2\varepsilon_0} = \pi\,\frac{d}{\lambda_0}\,\chi(\omega), \qquad E_{\mathrm{rad},j}(z) = i\kappa\,E_j\,e^{ik|z - z_j|}$$

El campo en cada lámina es el incidente más el radiado por todas, lo que da un sistema lineal de $N$ ecuaciones complejas:

$$E_i - i\kappa\sum_{j=1}^{N} e^{ik|z_i - z_j|}\,E_j = E_0\,e^{ikz_i}$$

El término $j = i$ es el campo que la lámina radia sobre sí misma: su frenado por radiación. Sin él no se conserva la energía. Una lámina sola da $r = i\kappa/(1 - i\kappa)$ y $t = 1/(1 - i\kappa)$. Con la solución,

$$r = i\kappa\sum_j E_j\,e^{ikz_j}, \qquad t = 1 + i\kappa\sum_j E_j\,e^{-ikz_j}$$

(detrás del material el campo es $t\,E_0 e^{ikz}$). Sin pérdidas, $|r|^2 + |t|^2 = 1$; con pérdidas, la lámina $j$ absorbe $2\,\mathrm{Im}\,\kappa\,|E_j|^2$.

**Campo local.** En un sólido de dipolos puntuales, el campo que actúa sobre cada uno incluye el de sus vecinos, $P/3\varepsilon_0$ (corrección de Lorentz, fórmula de Clausius-Mossotti). Aquí **no aparece**: cada lámina es continua y está polarizada en su propio plano, y una lámina así no crea más campo que su onda plana. El límite continuo es $\varepsilon = 1 + \chi$ exacto. Lo que sí aparece es el efecto de que las láminas sean discretas. La onda que viaja por un montón periódico cumple

$$\cos(qd) = \cos(kd) - \kappa\,\sin(kd) \quad\Longrightarrow\quad n_{\mathrm{ef}}^2 = \frac{q^2}{k^2} = \varepsilon + \frac{(kd)^2}{12}\,(\varepsilon - 1)^2 + \dots$$

y la referencia continua es una lámina de espesor $L = Nd$ con matriz de transferencia: $r = r_{12}(1 - e^{2i\beta})/(1 - r_{12}^2 e^{2i\beta})$, con $r_{12} = (1 - n)/(1 + n)$ y $\beta = 2\pi nL/\lambda_0$.

**Una superficie.** Con $\theta$ el ángulo de incidencia y $n_1\sin\theta = n_2\sin\theta_t$ (ley de Snell):

$$r_s = \frac{n_1\cos\theta - n_2\cos\theta_t}{n_1\cos\theta + n_2\cos\theta_t}, \qquad r_p = \frac{n_2\cos\theta - n_1\cos\theta_t}{n_2\cos\theta + n_1\cos\theta_t}$$

$$t_s = \frac{2n_1\cos\theta}{n_1\cos\theta + n_2\cos\theta_t}, \qquad t_p = \frac{2n_1\cos\theta}{n_2\cos\theta + n_1\cos\theta_t}$$

$$R = |r|^2, \qquad T = \frac{n_2\cos\theta_t}{n_1\cos\theta}\,|t|^2, \qquad R + T = 1$$

Convenio de signos de $r_p$: el de Born & Wolf y Hecht (en incidencia normal $r_p = -r_s$; con el de Griffiths, $r_p = r_s$). Las intensidades no dependen del convenio. Con $n_2$ complejo, $n_2\cos\theta_t = \sqrt{n_2^2 - n_1^2\sin^2\theta}$, con parte imaginaria positiva.

$$\tan\theta_B = \frac{n_2}{n_1}, \qquad \sin\theta_c = \frac{n_2}{n_1}\ (n_2 < n_1), \qquad \delta = \frac{\lambda_0}{2\pi\sqrt{n_1^2\sin^2\theta - n_2^2}}$$

$\delta$ es la profundidad a la que la amplitud de la onda evanescente cae a $1/e$. La imagen de los dipolos, en números: $r_p/r_s = -\cos(\theta + \theta_t)/\cos(\theta - \theta_t)$, que se anula cuando $\theta + \theta_t = 90°$.

**Polarizadores.** Ley de Malus, $I = I_0\cos^2\theta$. Tres polarizadores, el intermedio a un ángulo $\theta$ entre dos cruzados: $I = \tfrac{1}{8}I_0\sin^2 2\theta$. Reflejo de luz no polarizada: se refleja $(R_s + R_p)/2$, con grado de polarización $(R_s - R_p)/(R_s + R_p)$; un polarizador de eje vertical deja pasar $R_p/2$.

## Límites del modelo

- **Modelo de Lorentz**: osciladores clásicos, lineales e independientes. No hay bandas ni transiciones cuánticas (las frecuencias $\omega_{0j}$ y las intensidades $f_j$ se toman como datos), ni respuesta no lineal. Las alas de una línea lorentziana caen despacio: el «vidrio» del módulo tiene $k \approx 6 \cdot 10^{-4}$ en el visible, y un vidrio real es muchos órdenes de magnitud más transparente. El índice $n$ sí es el de la sílice.
- **Metal de Drude**: solo electrones libres. No explica el color del oro o del cobre, que viene de transiciones entre bandas; compara el metal de Drude con el oro medido.
- **Materiales medidos**: solo hay datos en un intervalo de frecuencias. Fuera de él se usa el extremo de la tabla y la línea de arriba lo avisa.
- **Láminas**: incidencia normal, láminas infinitas y continuas, sin corrección de campo local. Con las láminas muy separadas ($d$ comparable a $\lambda_0/n$) dejan de imitar un medio continuo y aparecen reflexiones de Bragg; la vista lo avisa.
- **Superficie**: plana, lisa e infinita, entre medios homogéneos e isótropos, con onda plana monocromática. «Desde dentro» se ignora la absorción del medio del que viene la luz. No hay capas finas ni rugosidad.
- **Gafas**: polarizador ideal y superficie horizontal perfecta; se compara con unas gafas grises que dejan pasar el 50 %. No se tiene en cuenta la luz que sale de dentro del agua.

## Referencias

- R. P. Feynman, R. B. Leighton y M. Sands, *The Feynman Lectures on Physics*, vol. I: §30-7 (el campo de una lámina de cargas oscilantes), cap. 31 (el origen del índice de refracción), cap. 32 (amortiguamiento por radiación) y cap. 33 (polarización). Vol. II, cap. 32 (índice de refracción de materiales densos y campo local).
- D. J. Griffiths, *Introduction to Electrodynamics*, 4.ª ed., cap. 9: §9.3 (reflexión y transmisión, ecuaciones de Fresnel) y §9.4 (absorción y dispersión).
- M. Born y E. Wolf, *Principles of Optics*: §1.5 (reflexión y refracción de una onda plana), §1.6 (medios estratificados, matriz característica), §2.3 (dispersión) y §2.4 (teorema de extinción de Ewald-Oseen).
- E. Hecht, *Optics*: cap. 3 (luz en la materia, dispersión), cap. 4 (reflexión, refracción, ecuaciones de Fresnel) y cap. 8 (polarización, ley de Malus).
- I. H. Malitson, «Interspecimen comparison of the refractive index of fused silica», *J. Opt. Soc. Am.* **55**, 1205 (1965). Datos del agua (Hale y Querry, 1973) y del oro (Johnson y Christy, 1972): ver `data/README.md`.
