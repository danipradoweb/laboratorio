# Encargo 03. Ondas clásicas y función de onda

Objetivo: que se vea qué comparte una onda clásica con la función de onda y en qué se diferencian, sin presentar nunca ψ como algo que vibra en el espacio físico. Lo que comparten es la estructura matemática: ecuaciones lineales, superposición, interferencia de fases y modos propios al confinar (los modos de una cuerda de longitud L y los estados de una partícula en una caja de longitud L son la misma función). Las diferencias:
- **Orden temporal.** La ecuación de ondas clásica es de segundo orden en el tiempo y la de Schrödinger de primero; de ahí que ψ sea compleja.
- **Dispersión.** $\omega = ck$ para la luz en el vacío frente a $\omega = \hbar k^2/2m$ para una partícula libre: el paquete cuántico se ensancha solo.
- **Espacio en que vive.** Con N partículas ψ vive en un espacio de 3N dimensiones. Se menciona en la ficha.
- **Información de la fase.** $|\psi|^2$ da la posición; la fase da el momento. Dos paquetes con el mismo $|\psi|^2$ y fases que giran en sentidos opuestos van en direcciones opuestas.

Unidades por defecto: nm, fs, eV y masa del electrón (masa configurable).

## Pasos sugeridos

1. **Cuerda clásica.** Ecuación de ondas 1D con diferencias finitas (salto de rana), extremos fijos o libres. Pulsos que no se deforman, ondas estacionarias, superposición de modos. Tests: frecuencias de los modos $n\pi c/L$; conservación de la energía; un pulso gaussiano en medio infinito conserva su forma.
2. **Schrödinger 1D dependiente del tiempo.** Método de paso partido de Fourier (Strang), con la FFT del núcleo y potencial absorbente complejo opcional en los bordes. Potenciales: libre, escalón, barrera rectangular, doble barrera, pozo finito, pozo "infinito" (paredes muy altas), armónico y un potencial dibujado a mano por el usuario.
3. **Estados propios.** Hamiltoniano en diferencias finitas (tridiagonal) diagonalizado con `linalg.js`. Niveles dibujados sobre el potencial. Superposición de estados propios elegidos con amplitudes y fases relativas ajustables, evolucionando en el tiempo.
4. **Vistas enlazadas.**
   - (a) ψ(x) con coloreado de fase (tono = arg ψ, altura o brillo = |ψ|) y conmutadores para Re ψ, Im ψ y |ψ|²; el potencial dibujado detrás.
   - (b) Espacio de momentos $|\phi(k)|^2$, con el mismo coloreado si se quiere.
   - (c) Panel lateral con la cuerda clásica partiendo de la misma forma inicial: el pulso clásico no se dispersa y el cuántico sí.
   - (d) Valores esperados $\langle x \rangle$ y $\langle p \rangle$ frente al tiempo, y el producto $\Delta x\,\Delta p$ con la línea $\hbar/2$.
5. **Fase global frente a fase relativa.** Un control que multiplica todo ψ por $e^{i\varphi}$ (los colores giran y nada observable cambia: $|\psi|^2$, $\langle x \rangle$ y $\langle p \rangle$ se quedan quietos) y otro que cambia solo la fase relativa entre dos estados propios (cambia $|\psi|^2$). Es la misma φ de la esfera de Bloch; dilo en la ficha.
6. **El puente con la luz.** Superposición de los dos primeros estados de un pozo: $\langle x \rangle(t)$ oscila con frecuencia angular $(E_2 - E_1)/\hbar$. Esa carga oscilante es el dipolo que absorbe y emite luz de esa frecuencia, y conecta con el oscilador forzado del encargo 00 y con el encargo 02. Muéstralo con la frecuencia de la transición y la longitud de onda del fotón correspondiente.
7. **Doble rendija en 2D** (solo si queda margen; si no, al backlog). Paso partido 2D en una malla de 256×256 con una pantalla que acumula $|\psi|^2$. Comparación con el patrón de Fraunhofer. Un control de coherencia entre las dos ramas: con coherencia completa se ve $|\psi_1 + \psi_2|^2$; sin ella, $|\psi_1|^2 + |\psi_2|^2$; e intermedios. La ficha explica que perder la coherencia equivale a que la información del camino quede registrada en otro sistema (decoherencia), sin hablar de "colapso por mirar".
8. **Tests.**
   - Conservación de la norma (error < 10⁻⁹ en 1000 pasos sin potencial absorbente).
   - Anchura del paquete gaussiano libre: $\sigma(t) = \sigma_0\sqrt{1 + (\hbar t/2m\sigma_0^2)^2}$.
   - Transmisión por una barrera rectangular igual a la analítica $T(E)$ promediada sobre la distribución de momentos del paquete, con un 1 % de tolerancia.
   - Pozo infinito: $E_n = n^2\pi^2\hbar^2/2mL^2$ con un 0,1 % de error con malla fina. Oscilador armónico: $E_n = \hbar\omega(n + \tfrac{1}{2})$ con un 0,1 %.
   - Ehrenfest: en el oscilador armónico $\langle x \rangle(t)$ sigue la trayectoria clásica.
   - Un estado propio tiene $|\psi|^2$ estacionario.
   - $\Delta x\,\Delta p = \hbar/2$ para la gaussiana inicial y $\ge \hbar/2$ siempre.
   - Frecuencia de $\langle x \rangle(t)$ en la superposición igual a $(E_2 - E_1)/h$.
9. **Presets**: paquete libre ensanchándose; efecto túnel por debajo de la barrera; resonancia en doble barrera; escalón por encima de su altura (reflexión cuántica); estados del pozo; superposición 1+2 oscilando; coherente en el oscilador armónico; misma |ψ|² con momentos opuestos.
10. **Recorridos**: "qué tiene de onda la función de onda", "por qué ψ es compleja", "de dónde sale el color de una transición".
11. **Ficha** con referencias: Griffiths (Introduction to Quantum Mechanics) cap. 1–2, Levine cap. 1–4, Feynman Lectures vol. III cap. 1–3 y 7.

## Criterio de terminado
Tests en verde, vistas enlazadas, presets, recorridos, modo presentación y ficha. La doble rendija es opcional.
