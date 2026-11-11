# Backlog

Ideas para después de los encargos 00–04, ordenadas por bloque. Entre paréntesis, la asignatura de la que salen. Las que más valor dan para estudiar o para vídeos van marcadas con ★. Las sesiones de trabajo añaden aquí lo que surja y no entre en su encargo.

## Pendientes de los encargos actuales
- Doble rendija 2D con control de coherencia, si no entró en el encargo 03.

## Vista por objetos: "por qué veo lo que veo" ★
Entrada al laboratorio por objetos cotidianos en lugar de por fenómenos. Cada objeto muestra su espectro, el color calculado con el motor y el mecanismo, con enlace al módulo que lo explica. Clasificación de Kurt Nassau (*The Physics and Chemistry of Color: The Fifteen Causes of Color*).
- Emisión: incandescencia (cuerpo negro, ley de Planck, temperatura de color), lámpara de neón y de sodio, LED.
- Iones en un cristal: rubí frente a esmeralda (Cr³⁺ en entornos distintos, campo cristalino).
- Orbitales moleculares: clorofila, tintes.
- Bandas: silicio gris y opaco, diamante transparente, CdS amarillo, el gap frente al visible.
- Metales: oro, cobre y plata (transiciones entre bandas más electrones libres).
- Óptica: azul del cielo (Rayleigh), blanco de la leche y de las nubes (Mie), pompa de jabón y alas de mariposa (interferencia en capas finas), CD (difracción), arcoíris (dispersión).
- Transparencia frente a translucidez: vidrio en bloque frente a vidrio molido.
- Vidrio de ventana y ultravioleta: corte del vidrio sodocálcico (UVB bloqueado, UVA transmitido en parte), sílice fundida transparente al UVB.
- Pinturas y materiales compuestos con un modelo de dispersión más absorción (Kubelka-Munk).
- Cambio de color con el iluminante (D65 frente a A frente a LED blanco).

## Cuántica y química cuántica (Fundamentos de Cuántica, Química: Enlace y Estructura)
- ★ Orbitales del hidrógeno en 3D con coloreado de fase, isosuperficies, función radial y distribución radial enlazadas, orbitales complejos frente a reales, superposiciones que evolucionan en el tiempo.
- ★ Ion H₂⁺ y combinación lineal de orbitales atómicos: enlazante frente a antienlazante en función de la distancia internuclear, superficie de energía potencial, diagramas de OM de diatómicas.
- Partícula en anillo, disco y esfera; armónicos esféricos; rotor rígido.
- Oscilador armónico y anarmonicidad (Morse) → espectros vibracionales y rotacionales con ramas P y R.
- Método variacional en directo: ajustar una función de prueba y ver bajar la energía.
- Estadísticas de Boltzmann, Fermi-Dirac y Bose-Einstein frente a la temperatura.

## Estado sólido y nanoescala (Estado Sólido, Física en la Nanoescala)
- ★ De átomos a bandas: N pozos acoplados (enlace fuerte), los niveles se convierten en bandas al crecer N; Kronig-Penney.
- ★ Densidad de estados en 3D, 2D, 1D y 0D; puntos cuánticos: gap y color frente al tamaño (ecuación de Brus), excitones.
- Transporte balístico y cuantización de la conductancia.
- Superparamagnetismo: relajación de Néel frente al tamaño; Monte Carlo de Ising (enlaza con Nanociencia Computacional).
- Termoelectricidad.

## Espectroscopía y caracterización (Espectroscopía, Técnicas de Caracterización 1 y 2)
- ★ Momento dipolar de transición y reglas de selección visualizadas (por qué una transición está permitida o prohibida).
- Lambert-Beer y formas de línea (lorentziana, gaussiana, Voigt): anchura natural, Doppler, colisiones.
- IR frente a Raman: actividad según la simetría de la vibración.
- XPS: efecto fotoeléctrico, energía de enlace, desplazamiento químico.
- ★ STM: corriente túnel exponencial con la distancia (reutiliza el encargo 03).
- AFM: curva de fuerza con Lennard-Jones.
- Difracción de electrones en TEM y LEED (reutiliza el encargo 04).

## Síntesis y coloides (Síntesis y Preparación de Nanomateriales, Termodinámica)
- ★ DLS: movimiento browniano → función de autocorrelación → tamaño por Stokes-Einstein.
- ★ DLVO y potencial zeta: estabilidad coloidal frente a la fuerza iónica (enlaza con el método de Turkevich).
- Nucleación y crecimiento: modelo de LaMer, teoría clásica de nucleación, radio crítico.
- Gibbs-Thomson: descenso del punto de fusión con el tamaño.
- Isotermas de adsorción de Langmuir y BET (Ciencia de Superficies).

## Fotónica (Fotónica y Optoelectrónica, para el curso que viene)
- ★ Capas finas, espejos de Bragg y cristales fotónicos 1D con matrices de transferencia (reutiliza el encargo 02).
- Fabry-Perot y Michelson.
- Fibra óptica: reflexión total interna, apertura numérica, modos.
- Unión p-n y LED: diagrama de bandas bajo polarización.
- Láser: ecuaciones de balance, inversión de población.
- Velocidad de fase frente a velocidad de grupo en un medio dispersivo.

## Computación cuántica (Computación Cuántica)
- ★ Esfera de Bloch con puertas y trayectorias, medición y estadística de resultados.
- ★ Dos qubits: entrelazamiento, vectores de Bloch reducidos dentro de la esfera, estados mixtos, matriz densidad.
- Desigualdad CHSH simulada.
- Algoritmos de Deutsch-Jozsa y Grover con las amplitudes visibles paso a paso.
- Decoherencia de un qubit (T1, T2) (enlaza con el ensayo "Determinismo sin predicción").

## Cristalografía (Cristalografía y Simetría, Cristalografía Avanzada)
- ★ Operaciones de simetría puntual animadas en 3D y grupos puntuales de moléculas.
- Proyección estereográfica.
- Visualizador de grupos espaciales.

## Pendientes de la revisión del encargo 00
Observaciones del revisor independiente que no afectan a la corrección física ni a requisitos explícitos (lo que sí afectaba se corrigió; ver `PROGRESO.md`).
- `linalg.js`: reescalar la matriz por dentro para admitir elementos fuera de ~1e-140…1e150 (hoy está documentado como límite). Con todo el espectro en un mismo grupo casi degenerado, pedir todos los autovectores cuesta O(n³) (n = 1000: 1 s); si hiciera falta, cambiar a QL implícito para el caso "todos".
- `solveTridiagonal` no pivota (documentado): añadir una variante con pivoteo si aparece una matriz que no sea diagonalmente dominante.
- `complex.sqrt` desborda si |a| > ~9e307 (documentado).
- Rueda de fase: su uniformidad se comprueba en OKLab, el mismo espacio en que se construye. En CIELAB, L* varía entre 65,6 y 69,4 y el paso de color entre fases a 30° va de 16,8 a 26,3: razonable, pero no perfecto. Comparar con CAM16-UCS si algún día importa.
- Servicio de funcionamiento sin conexión completo: hoy la ficha y KaTeX se precargan al abrir un módulo, pero three.js solo se descarga al abrir la primera vista 3D y las fichas de otros módulos, al visitarlos.
- Duración de la transición por preset (ahora es por módulo, `transitionSeconds`).
- Oscilador: dibujar la masa y el muelle moviéndose junto a la gráfica de tiempo.

## Infraestructura
- Miniaturas de la portada en los dos temas (ahora solo se genera la del tema claro).
- Escala logarítmica en los ejes del trazador 2D y en los deslizadores (útil para espectros y para parámetros que abarcan varios órdenes de magnitud).
- Página de créditos (`docs/ARQUITECTURA.md` la menciona): fuentes de los datos de materiales y licencias de `vendor/` y de los mapas de color.
- Funcionamiento sin conexión real con un service worker (ahora funciona sin red solo lo que ya se ha cargado).
- Guardar en la URL el recorrido y el paso en curso, para enlazar a un paso concreto.
- Variante compleja del algoritmo de Thomas en `linalg.js` (la pedirá Crank-Nicolson en el encargo 03).
- Integración con la web personal (sección Laboratorio) cuando haya módulos terminados.
- Dominio propio: GitHub Pages lo admite sin mover nada.
- Ensayo interactivo "Determinismo sin predicción": autómata celular (regla 30), sistema caótico con trayectorias que divergen, "demonio" que pierde precisión. Usa el sistema de recorridos.
