# Encargo 02. Luz y materia: del oscilador a la reflexión, la refracción y la polarización

Objetivo: que se vea que reflexión, refracción, absorción y el color de los metales salen de un único mecanismo. El campo de la onda fuerza a oscilar a los electrones ligados, cada electrón oscilante radia una ondita a la misma frecuencia, y lo que hace un material es la suma (interferencia) de la onda incidente con todas esas onditas. La luz no "rebota" ni se absorbe y reemite con retraso: es una oscilación forzada y coherente.

Reutiliza el oscilador del encargo 00, `units.js`, el trazador y la biblioteca de materiales del encargo 01.

## Partes y pasos sugeridos

### A. Del oscilador a la función dieléctrica
1. **Modelo de Lorentz/Drude**: $\varepsilon(\omega) = 1 + \sum_j \frac{f_j\,\omega_p^2}{\omega_{0j}^2 - \omega^2 - i\gamma_j\omega}$, con $n$, $k$, reflectividad en incidencia normal y coeficiente de absorción. Ajustes predefinidos: "vidrio" (resonancias en el UV y en el IR, por lo que en el visible $n > 1$ con dispersión normal y $k \approx 0$), "metal de Drude" ($\omega_0 = 0$: $R \approx 1$ por debajo de $\omega_p$ y transparencia por encima) y un material arbitrario editable.
2. Vistas: $\varepsilon'$ y $\varepsilon''$, $n$ y $k$ frente a ω (o λ, conmutable) con la banda visible marcada; $R(\omega)$; y, enlazado, el oscilador individual a la frecuencia seleccionada (amplitud y desfase).
3. Tests: las relaciones de Kramers-Kronig, comprobadas numéricamente (obtener $\varepsilon'$ a partir de $\varepsilon''$ con tolerancia razonable); $\varepsilon \to 1$ cuando $\omega \to \infty$; regla de suma $\int_0^\infty \omega\,\varepsilon''(\omega)\,d\omega = \frac{\pi}{2}\omega_p^2 \sum f_j$; Drude con γ pequeño da $R > 0{,}9$ por debajo de $\omega_p$ y cae por encima.

### B. Láminas de dipolos: de dónde sale el índice de refracción (el núcleo del módulo)
Incidencia normal, problema unidimensional. El material son $N$ láminas delgadas paralelas separadas una distancia $d$; cada lámina es una capa de osciladores de Lorentz con densidad superficial dada. Una lámina con polarización superficial oscilante radia ondas planas hacia ambos lados (Feynman Lectures vol. I, §30-7 y cap. 31; Griffiths para la radiación de una lámina de corriente). Resuelve de forma autoconsistente: el campo que fuerza a cada lámina es el incidente más el radiado por todas las demás (sistema lineal complejo $N \times N$). Documenta en la ficha el convenio de signos y la deducción.
1. Vistas animadas en el tiempo ($e^{-i\omega t}$):
   - Onda incidente, ondas radiadas por cada lámina (conmutable: todas, una sola o ninguna) y campo total.
   - Dentro del material: la suma de la incidente y las radiadas hacia delante produce una onda de longitud de onda más corta. Marca $\lambda/n$ para que se vea.
   - Delante del material: la onda reflejada sale de la suma de las radiaciones hacia atrás.
   - Detrás: la onda transmitida.
   - Un deslizador de "número de láminas activas" que permita encenderlas una a una, para ver cómo se va construyendo la extinción de la onda incidente (teorema de extinción de Ewald-Oseen).
2. Tests:
   - Una lámina sola: reflexión y transmisión analíticas.
   - Convergencia al continuo: con densidad volumétrica fija y $d \to 0$, la solución discreta tiende a la de una lámina continua de espesor $Nd$ con el $\varepsilon$ de Lorentz equivalente, calculada con matriz de transferencia. Documenta qué corrección de campo local aparece y por qué.
   - Sin pérdidas: $R + T = 1$.
   - Lámina gruesa y absorbente: $R$ tiende al valor de Fresnel $\left|\frac{n-1}{n+1}\right|^2$.
   - La longitud de onda dentro, ajustada a partir del campo total, vale $\lambda_0/n$.

### C. Incidencia oblicua, Fresnel, Brewster y polarización
1. Coeficientes de Fresnel $r_s$, $r_p$, $t_s$, $t_p$ para medios dieléctricos y absorbentes ($n$ complejo, tomado de la biblioteca de materiales o del modelo de Lorentz). $R$ y $T$ frente al ángulo, con el ángulo de Brewster y el ángulo crítico marcados.
2. Vista geométrica: rayos incidente, reflejado y refractado; dentro del medio, los dipolos oscilando en la dirección del campo refractado para s y para p, con su diagrama de radiación ($\propto \sin^2$ del ángulo con el eje del dipolo). En el ángulo de Brewster el rayo reflejado cae sobre el eje de los dipolos p (refractado y reflejado forman 90°) y por eso p no se refleja. Esa es la imagen que tiene que quedar clara.
3. Reflexión total interna con la onda evanescente visible en el segundo medio.
4. Polarizadores: ley de Malus, polarizadores cruzados, la paradoja de los tres polarizadores. Gafas de sol polarizadas: luz no polarizada reflejada en agua ($n = 1{,}33$) en función del ángulo, grado de polarización del reflejo, y fracción del reflejo que atraviesa un polarizador de eje vertical frente a unas gafas que solo atenúan.
5. Tests: $R_p(\theta_B) = 0$ con $\theta_B = \arctan(n_2/n_1)$; en incidencia normal $R_s = R_p = \left(\frac{n_1-n_2}{n_1+n_2}\right)^2$; conservación $R + T = 1$ con los factores de coseno e índice correctos en medios sin pérdidas; ángulo crítico; relaciones de Stokes $r' = -r$ y $tt' = 1 - r^2$; ley de Malus.

### D. Presets, recorridos y ficha
- Presets: vidrio en el visible; vidrio en una resonancia UV; metal por debajo y por encima de $\omega_p$; láminas encendiéndose una a una; Brewster en vidrio; reflejo en agua con gafas polarizadas; reflexión total interna.
- Recorridos: "por qué la luz no rebota" (láminas), "de dónde sale el índice de refracción", "por qué funcionan las gafas polarizadas".
- Ficha con referencias: Feynman Lectures vol. I cap. 30–33, Griffiths cap. 9, Born & Wolf cap. 1–2, Hecht si procede.

## Criterio de terminado
Tests en verde, las tres partes funcionando con vistas enlazadas, presets, recorridos, modo presentación y ficha.
