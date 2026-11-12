# Plasmón, teoría de Mie y color

Una partícula metálica de unas decenas de nanómetros iluminada con luz blanca. El módulo calcula cuánta luz de cada color quita del haz y enseña por qué: sus electrones de conducción oscilan empujados por la luz, y cerca de cierta frecuencia lo hacen con la amplitud y el retraso que más energía le quitan al haz.

## Qué estás viendo

- **Línea superior.** Qué modelo se está usando (teoría de Mie para la esfera, teoría de Gans para el bastón) y el parámetro de tamaño $x = 2\pi n_m a/\lambda$. Si el modelo sale de su validez, avisa.
- **Espectros.** Sección eficaz de **extinción** (negro), **absorción** (la parte que se convierte en calor) y **dispersión** (trazos: la parte que se reemite, a la misma $\lambda$, en otras direcciones). Siempre extinción = absorción + dispersión. Bajo la curva de extinción, cada franja lleva el color de su longitud de onda. Un clic o un arrastre fija $\lambda$. La línea «sin retardo» marca dónde estaría el pico si la partícula fuese diminuta.
- **Color del coloide.** A la izquierda, una cubeta a contraluz: el color de lo que queda tras la extinción, $T(\lambda) = e^{-N C_{ext} L}$. A la derecha, el tono de la luz dispersada, la que se ve mirando de lado. Los dos bajo luz de día (iluminante D65).
- **Nube electrónica.** La partícula (iones fijos, del color del metal) y su nube de electrones de conducción (azul, borde de trazos), que se desplaza en bloque. Arriba, la fuerza que la luz ejerce sobre los electrones; abajo, el desplazamiento de la nube. A la derecha, las dos como flechas que giran (fasores): el ángulo entre ellas es el desfase $\delta$.
- **Campo cercano.** Mapa de $|E|^2/|E_0|^2$ alrededor de la partícula, en escala logarítmica, con el campo incidente en horizontal. La escala de color es la misma para toda la partícula: al mover $\lambda$ hacia la resonancia se ve crecer el campo en las puntas.
- **Diagrama de dispersión.** Cuánta luz se dispersa en cada dirección, para las dos polarizaciones: $|S_1|^2$ (perpendicular al plano de dispersión) y $|S_2|^2$ (paralela). La luz llega por la izquierda.

Tres ideas que conviene comprobar moviendo los controles:

1. La nube oscila **siempre** a la frecuencia de la luz: es una oscilación forzada, como la del módulo [oscilador](#/oscilador). «Resonar» no es algo distinto de «ser inducida»: es la zona del barrido donde la amplitud pasa por su máximo y el desfase gira (hasta cerca de 90° si el metal absorbe poco, como la plata). Lo que la partícula absorbe en cada ciclo es $\propto |\alpha|\sin\delta$: una nube que se mueve en fase con la fuerza ($\delta \approx 0$, en el infrarrojo) casi no absorbe aunque se mueva.
2. La partícula **no emite otro color**. Absorbe (calor) o dispersa (misma $\lambda$). El color a contraluz es lo que queda.
3. Mientras la partícula es mucho menor que $\lambda$, el pico **no depende del tamaño**: lo fijan el material y el medio. El corrimiento al rojo de las partículas grandes viene del retardo, y la **forma** pesa más que el tamaño.

## Qué es físico y qué es representación

- **Físico**: las secciones eficaces, la posición de los picos, el reparto entre absorción y dispersión, el desfase $\delta$, el realce del campo y el diagrama angular. Salen de las ecuaciones de Maxwell con las constantes ópticas medidas del metal.
- **Representación**: el desplazamiento de la nube está **enormemente exagerado**. En realidad es muchísimo menor que el tamaño de un átomo; lo que aquí se dibuja es su amplitud *relativa* (100 % = la mayor del espectro de esa partícula) y su fase. La nube tampoco es una esfera rígida con borde: es una imagen del modo dipolar.
- La animación va mucho más despacio que la luz (una oscilación real dura unos $2 \cdot 10^{-15}$ s). Solo se respeta que el periodo crece con $\lambda$.
- El color «de lado» informa solo del **tono**: el brillo está normalizado. Cuánta luz se dispersa lo dice el porcentaje que hay debajo (en oro de 20 nm, menos del 1 %).
- Los colores en pantalla son sRGB sin adaptación cromática. Cuando el color real es más saturado de lo que la pantalla puede mostrar, se recorta y se avisa.
- La concentración se da como fracción de volumen de metal (ppm). Así, coloides de tamaños distintos con el mismo control tienen la misma cantidad de metal.

## Ecuaciones

Convenio $e^{-i\omega t}$: absorber es $\mathrm{Im}\,\varepsilon > 0$. El medio tiene índice real $n_m$ y $\varepsilon_m = n_m^2$; $k = 2\pi n_m/\lambda$.

**Esfera pequeña (cuasiestática).** Polarizabilidad y secciones eficaces del dipolo inducido:

$$\alpha = 4\pi a^3\,\frac{\varepsilon - \varepsilon_m}{\varepsilon + 2\varepsilon_m}, \qquad C_{abs} = k\,\mathrm{Im}\,\alpha, \qquad C_{sca} = \frac{k^4}{6\pi}\,|\alpha|^2$$

El denominador casi se anula cuando $\mathrm{Re}\,\varepsilon(\omega) = -2\varepsilon_m$ (condición de Fröhlich). Para un metal de Drude sin pérdidas eso ocurre en $\omega = \omega_p/\sqrt{1 + 2\varepsilon_m}$. La amplitud de la nube es $\propto |\alpha|$ y su retraso respecto a la fuerza es $\delta = \arg \alpha$. Justo en la condición de Fröhlich:

$$\alpha = 4\pi a^3\left(1 + \frac{3 i\,\varepsilon_m}{\mathrm{Im}\,\varepsilon}\right), \qquad \tan\delta = \frac{3\varepsilon_m}{\mathrm{Im}\,\varepsilon}$$

El «1» es una respuesta de fondo en fase con la fuerza; el otro término es el resonante, con 90° de retraso. Con pocas pérdidas (plata) domina el resonante y $\delta \approx 90°$, como en el oscilador forzado; en el oro, que absorbe más, $\delta$ se queda en unos 60°. Por lo mismo, en el oro de 20 nm no coinciden exactamente la condición de Fröhlich (≈ 515 nm), el máximo de extinción (521 nm) y el máximo de amplitud (≈ 539 nm); en la plata los tres caen a pocos nanómetros.

**Esfera de cualquier tamaño (Mie).** Con $m = (n + ik)/n_m$ y $x = ka$:

$$Q_{ext} = \frac{2}{x^2}\sum_{n=1}^{n_{max}} (2n+1)\,\mathrm{Re}(a_n + b_n), \qquad Q_{sca} = \frac{2}{x^2}\sum_{n=1}^{n_{max}} (2n+1)\left(|a_n|^2 + |b_n|^2\right)$$

$$a_n = \frac{\left[D_n(mx)/m + n/x\right]\psi_n(x) - \psi_{n-1}(x)}{\left[D_n(mx)/m + n/x\right]\xi_n(x) - \xi_{n-1}(x)}, \qquad b_n = \frac{\left[m D_n(mx) + n/x\right]\psi_n(x) - \psi_{n-1}(x)}{\left[m D_n(mx) + n/x\right]\xi_n(x) - \xi_{n-1}(x)}$$

$Q = C/\pi a^2$, $Q_{abs} = Q_{ext} - Q_{sca}$ y $n_{max} = x + 4x^{1/3} + 2$. $a_1$ es el dipolo eléctrico, $a_2$ el cuadrupolo. La nube electrónica de la esfera usa la polarizabilidad dipolar exacta, $\alpha = 6\pi i\,a_1/k^3$, que para $x \to 0$ es la cuasiestática.

**Bastón (Gans).** Esferoide alargado de volumen $V$, pequeño frente a $\lambda$, con factor de despolarización $L_j$ en cada eje ($L_\parallel + 2L_\perp = 1$; la esfera tiene $L = 1/3$):

$$\alpha_j = V\,\frac{\varepsilon - \varepsilon_m}{\varepsilon_m + L_j(\varepsilon - \varepsilon_m)}, \qquad \langle C_{abs} \rangle = \frac{k}{3}\,\mathrm{Im}\left(\alpha_\parallel + 2\alpha_\perp\right)$$

Cada eje resuena cuando $\mathrm{Re}\,\varepsilon = -\varepsilon_m (1 - L_j)/L_j$. La dispersión promediada es $\langle C_{sca} \rangle = \frac{k^4}{18\pi}\left(|\alpha_\parallel|^2 + 2|\alpha_\perp|^2\right)$.

**Campo cercano de la esfera** (aproximación dipolar), con $\beta = (\varepsilon - \varepsilon_m)/(\varepsilon + 2\varepsilon_m)$:

$$\frac{\mathbf{E}}{E_0} = \hat{\mathbf{z}} + \beta\left(\frac{a}{r}\right)^3\left(3\cos\theta\,\hat{\mathbf{r}} - \hat{\mathbf{z}}\right)$$

**Cubeta.** $T(\lambda) = e^{-N C_{ext}(\lambda) L}$, con $N$ partículas por unidad de volumen y $L$ el camino óptico.

## Límites del modelo

- Las constantes ópticas son las del **metal macizo**. Por debajo de unos 10 nm los electrones chocan con la superficie y el pico real es más ancho y más bajo que el calculado; por debajo de unos 2 nm aparecen efectos cuánticos. El módulo no incluye ninguna de las dos cosas.
- Las tablas de Johnson & Christy tienen un punto cada 16–52 nm en el visible y se interpolan linealmente: la posición de un pico puede quedar «atraída» unos nanómetros hacia un punto de la tabla.
- El medio es transparente y sin dispersión (un solo número, $n_m$).
- **Bastón**: la teoría de Gans es cuasiestática (sin retardo) y trata el bastón como un esferoide. Vale si el largo es mucho menor que $\lambda$; los bastones reales, con extremos planos o semiesféricos, tienen el pico algo desplazado.
- **Campo cercano**: es la solución electrostática. En la esfera equivale al término dipolar sin retardo, y deja de ser fiable cuando $x \gtrsim 0{,}3$ (la línea superior lo avisa). En el bastón se dibuja el caso del campo paralelo al eje largo.
- **Diagrama de dispersión del bastón**: el promedio sobre orientaciones de un dipolo anisótropo, coherente con el espectro. Por eso, a 90° la luz polarizada en el plano no se anula como en la esfera: los bastones inclinados giran la polarización.
- **Nube electrónica y campo cercano del bastón**: muestran, en cambio, un solo bastón alineado con el campo (su modo longitudinal), no el promedio.
- **Coloide**: partículas idénticas, independientes y con dispersión simple (ley de Beer-Lambert). El color «de lado» sale de la dispersión total $C_{sca}(\lambda)$, no de la de un ángulo concreto, y no descuenta que esa luz se atenúa al salir de la cubeta. Un coloide real tiene una distribución de tamaños; si las partículas se agregan, el espectro cambia por completo (acoplamiento entre plasmones), y eso no está aquí.
- **Copa de Licurgo**: el preset usa partículas de aleación Au-Ag (30 % Au, 70 % Ag) de 70 nm en vidrio de índice 1,5. El vidrio real contiene además otras partículas y la proporción es aproximada.

## Referencias

- C. F. Bohren y D. R. Huffman, *Absorption and Scattering of Light by Small Particles* (Wiley, 1983): cap. 4 (teoría de Mie), cap. 5 (partículas pequeñas frente a la longitud de onda: esfera y elipsoide), cap. 12 (modos de superficie en partículas pequeñas) y apéndice A (programa BHMIE).
- S. V. Gaponenko, *Introduction to Nanophotonics* (Cambridge University Press, 2010): capítulo de nanoplasmónica (nanopartículas metálicas).
- U. Kreibig y M. Vollmer, *Optical Properties of Metal Clusters* (Springer, 1995): cap. 2.
- R. Gans, *Ann. Phys.* **342**, 881 (1912): partículas elipsoidales.
- Constantes ópticas: P. B. Johnson y R. W. Christy, *Phys. Rev. B* **6**, 4370 (1972) para Au, Ag y Cu; A. D. Rakić, *Appl. Opt.* **34**, 4755 (1995) para Al; D. Rioux et al., *Adv. Opt. Mater.* **2**, 176 (2014) para la aleación Au-Ag. Tomadas de la base de datos de [refractiveindex.info](https://refractiveindex.info) (dominio público).
- Módulo relacionado: [oscilador forzado y resonancia](#/oscilador).
