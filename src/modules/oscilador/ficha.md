# Oscilador forzado y resonancia

## Qué estás viendo

Una masa sujeta a un muelle, con rozamiento, a la que una fuerza externa empuja de forma periódica. Hay cuatro vistas enlazadas: al cambiar la frecuencia de la fuerza o el amortiguamiento, cambian todas a la vez.

- **Evolución temporal.** La fuerza $F(t)$ y la posición $x(t)$, cada una dividida por su amplitud para poder comparar sus fases. El tiempo va en periodos de la fuerza (se muestran ocho). La banda sombreada mide el **desfase** $\delta$: lo que tarda la masa en llegar a su máximo después de que lo haga la fuerza. Con "Arrancar desde el reposo" se ve además el *transitorio*, calculado paso a paso, hasta que se confunde con el régimen estacionario (línea de trazos).
- **Amplitud** del régimen estacionario frente a la frecuencia de la fuerza.
- **Desfase** frente a la frecuencia.
- **Potencia media** que la fuerza entrega a la masa, que es la que disipa el rozamiento. La banda sombreada es su anchura a media altura y la curva de trazos, la aproximación lorentziana.

En las tres curvas, la línea vertical continua marca la frecuencia actual y la de puntos, la frecuencia propia $\omega_0$. Un clic sobre cualquiera de ellas cambia la frecuencia. El punto que recorre la evolución temporal es un cursor de tiempo: se detiene con la pausa.

## Qué es físico y qué es representación

- Posición, fuerza, amplitud, desfase y potencia son magnitudes medibles.
- En la evolución temporal, fuerza y posición están **normalizadas** (cada una dividida por su amplitud estacionaria): sirve para ver la fase, no para comparar tamaños. El tamaño real de la respuesta está en la gráfica de amplitud.
- Todo va en unidades adimensionales: $m = \omega_0 = F_0 = 1$. La amplitud se mide en unidades de la respuesta estática $F_0/m\omega_0^2$ (lo que se estiraría el muelle con una fuerza constante $F_0$) y la potencia, en $F_0^2/m\omega_0$.
- El desfase $\delta$ es un retraso: la respuesta va siempre *por detrás* de la fuerza, entre 0° y 180°.

## Ecuaciones

Ecuación del movimiento:

$$m\ddot x + m\gamma\dot x + m\omega_0^2 x = F_0\cos\omega t$$

Régimen estacionario, $x(t) = A\cos(\omega t - \delta)$, con

$$A = \frac{F_0/m}{\sqrt{(\omega_0^2 - \omega^2)^2 + \gamma^2\omega^2}}, \qquad \tan\delta = \frac{\gamma\omega}{\omega_0^2 - \omega^2}$$

Potencia media absorbida, máxima exactamente en $\omega = \omega_0$:

$$\langle P\rangle = \tfrac12 m\gamma\omega^2A^2 = \frac{F_0^2}{2m}\,\frac{\gamma\omega^2}{(\omega_0^2 - \omega^2)^2 + \gamma^2\omega^2}$$

Su anchura a media altura es $\gamma$ (exacto), y si $\gamma \ll \omega_0$ la curva es una lorentziana:

$$\langle P\rangle \approx \frac{F_0^2}{2m\gamma}\,\frac{(\gamma/2)^2}{(\omega - \omega_0)^2 + (\gamma/2)^2}$$

Tres detalles que conviene no confundir:

- El desfase vale exactamente 90° en $\omega = \omega_0$. Ahí son máximas la potencia y la velocidad.
- La **amplitud** es máxima un poco antes, en $\omega_r = \sqrt{\omega_0^2 - \gamma^2/2}$. Con poco rozamiento la diferencia no se aprecia; con $\gamma \ge \sqrt2\,\omega_0$ la amplitud ya no tiene máximo.
- El factor de calidad $Q = \omega_0/\gamma$ dice cuánto se amplifica la respuesta en resonancia respecto a la estática y cuántas oscilaciones dura el transitorio, que decae como $e^{-\gamma t/2}$.

Con notación compleja y el convenio $e^{-i\omega t}$, $x(t) = \mathrm{Re}\,[\chi(\omega)F_0e^{-i\omega t}]$ con

$$\chi(\omega) = \frac{1}{m(\omega_0^2 - \omega^2 - i\gamma\omega)}$$

cuyo módulo da la amplitud, cuyo argumento es $\delta$ y cuya parte imaginaria es proporcional a la potencia absorbida.

## Límites del modelo

- El muelle es lineal (fuerza proporcional al desplazamiento) y el rozamiento es proporcional a la velocidad. Con amplitudes grandes los osciladores reales dejan de ser lineales y la frecuencia de resonancia depende de la amplitud.
- La fuerza es sinusoidal y de amplitud constante, y no se ve afectada por el movimiento de la masa.
- Un solo grado de libertad: un sistema real tiene muchos modos, cada uno con su resonancia.
- El transitorio se integra con el método de Runge-Kutta de orden 4; su error es mucho menor que el grosor de la línea.

## Referencias

- Feynman, *Lectures on Physics*, vol. I, caps. 21 ("The Harmonic Oscillator"), 23 ("Resonance") y 24 ("Transients").
- Griffiths, *Introduction to Electrodynamics*, 4.ª ed., §9.4.3: el mismo oscilador como modelo del electrón ligado (dispersión y absorción de la luz).
- Bohren y Huffman, *Absorption and Scattering of Light by Small Particles*, §9.1: el modelo de Lorentz.
