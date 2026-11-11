# Encargo 01. Plasmón, teoría de Mie y color

Objetivo: entender por qué una nanopartícula metálica tiene color, qué es exactamente la resonancia de plasmón y qué cambia con el material, el tamaño, el medio y la forma. Construye además dos servicios comunes que usarán otros módulos: el motor espectro → color y la biblioteca de materiales.

Ideas que el módulo debe hacer visibles, porque son justo las confusiones del usuario:
- La nube electrónica oscila siempre a la frecuencia de la luz (oscilación forzada). La resonancia es el máximo de amplitud cuando esa frecuencia coincide con la propia. "Inducir" y "resonar" no son alternativas.
- La partícula no emite luz de otra longitud de onda: reemite a la misma frecuencia (dispersión) y disipa en calor (absorción). El color del coloide visto a contraluz es lo que queda tras quitar la extinción.
- En el régimen cuasiestático (partícula mucho menor que λ) la posición del pico apenas depende del tamaño: depende del material y del medio (condición de Fröhlich, $\varepsilon(\omega) = -2\varepsilon_m$). El desplazamiento al rojo con el tamaño aparece por el retardo y los modos multipolares, que solo da la teoría de Mie completa. La forma pesa más que el tamaño.

## Pasos sugeridos

1. **Datos CIE.** Con `colour-science` (pip) genera en `data/cie/` las funciones de igualación CIE 1931 2° (360–830 nm) y los iluminantes D65, A y E. Script en `tools/`.
2. **Motor de color** (`src/color/`). Espectro → XYZ → sRGB lineal → sRGB con gamma; aviso si queda fuera de gama; también CIELAB para comparar colores. Tests: cromaticidad de D65 $(x, y) = (0{,}3127;\ 0{,}3290)$ con tolerancia 5·10⁻⁴; iluminante E en $(1/3, 1/3)$; luz monocromática de 700 nm cerca de $(0{,}7347;\ 0{,}2653)$; reflector perfecto bajo D65 da sRGB ≈ (1, 1, 1). Genera también con `colour-science` unos cuantos casos de referencia de espectro arbitrario → sRGB y compáralos.
3. **Biblioteca de materiales** (`src/materials/`, `data/materials/`). Importador del formato YAML de la base de datos de refractiveindex.info (repositorio `polyanskiy/refractiveindex.info-database` en GitHub; comprueba su licencia y anótala). Materiales iniciales: Au, Ag y Cu (Johnson & Christy 1972), Al (Rakić 1995), agua, sílice fundida (Malitson), y también TiO₂ y Si para usos posteriores. Cada JSON con metadatos de familia, mecanismo y fuente. `dielectric.js`: $\varepsilon = (n + ik)^2$ e interpolación en λ; modelos de Drude y Lorentz paramétricos. Tests: consistencia $n,k \leftrightarrow \varepsilon$; el importador conserva los datos; la interpolación no sale del rango sin aviso.
4. **Mie** (`physics.js`). Algoritmo BHMIE de Bohren & Huffman (apéndice A): índice complejo relativo $m$, parámetro de tamaño $x = 2\pi n_m a/\lambda$, derivada logarítmica con recurrencia descendente, número de términos $n_{max} = x + 4x^{1/3} + 2$. Salidas: $Q_{ext}$, $Q_{sca}$, $Q_{abs}$, $Q_{back}$, $g$, $S_1(\theta)$, $S_2(\theta)$ y las secciones eficaces. Además, aparte: aproximación cuasiestática dipolar, $\alpha = 4\pi a^3 \frac{\varepsilon - \varepsilon_m}{\varepsilon + 2\varepsilon_m}$, y teoría de Gans para esferoides prolatos (nanobastones) con factores de despolarización y promedio de orientaciones.
   Tests:
   - Comparación con `miepython` (fixtures generadas en `tools/`) en una malla de $m$ reales y absorbentes y $x$ entre 0,01 y 100. Tolerancia relativa 10⁻⁶.
   - Límite de Rayleigh: $Q_{sca} \approx \frac{8}{3}x^4\left|\frac{m^2-1}{m^2+2}\right|^2$ para $x \ll 1$.
   - $Q_{abs} = 0$ para $m$ real; $Q_{ext} = Q_{sca} + Q_{abs}$ siempre.
   - Paradoja de la extinción: $Q_{ext} \to 2$ para $x \gg 1$.
   - Cuasiestática y Mie coinciden en un 2 % para Au de radio 5 nm en agua.
   - Con un metal de Drude sin pérdidas apreciables, el pico cuasiestático cae en $\omega_p/\sqrt{1 + 2\varepsilon_m}$.
   - Gans: factores de despolarización que suman 1; la esfera ($L = 1/3$) reproduce la cuasiestática; el pico longitudinal se desplaza al rojo de forma monótona con la relación de aspecto.
   - Con datos reales (valores experimentales bien establecidos): Au de diámetro 20 nm en agua, pico de extinción entre 515 y 528 nm; Ag de diámetro 20 nm en agua, entre 385 y 410 nm (si un test experimental falla con los datos de Johnson & Christy, no lo ajustes: documenta en PROGRESO.md el valor obtenido, la fuente del valor esperado y la discrepancia, y sigue); para Au, el pico se desplaza al rojo de forma monótona al pasar de 40 a 150 nm de diámetro y al aumentar el índice del medio.
5. **Color del coloide.** Transmitancia de una cubeta $T(\lambda) = \exp(-N C_{ext}(\lambda) L)$ con concentración y camino óptico ajustables; color transmitido bajo D65. Color de la luz dispersada lateralmente a partir de $C_{sca}(\lambda)$: debe reproducir el efecto de la copa de Licurgo, roja a contraluz y verdosa por reflexión difusa, con partículas de Au-Ag de tamaño intermedio. Test: el color transmitido del Au de 20 nm tiene $a^* > 0$ en CIELAB (tirando a rojo).
6. **Vistas enlazadas.**
   - (a) Espectros de extinción, absorción y dispersión con la banda del visible coloreada debajo y un marcador en la λ actual.
   - (b) Muestras de color: cubeta a contraluz y luz dispersada.
   - (c) La partícula con su nube electrónica desplazándose y oscilando a la λ actual, con la amplitud y el desfase sacados de $\alpha(\omega)$ y la fuerza incidente dibujada al lado. Al barrer λ se ve crecer la amplitud y girar el desfase al pasar por la resonancia, como en el oscilador del encargo 00 (enlázalo desde la ficha).
   - (d) Mapa del campo cercano $|E|^2/|E_0|^2$ alrededor de la partícula en la aproximación dipolar, a la λ actual.
   - (e) Diagrama polar de la dispersión $|S_1|^2$ y $|S_2|^2$, que pasa de dipolar a dominado hacia delante al crecer el tamaño.
   Controles: material, diámetro, índice del medio, λ, forma (esfera o bastón con relación de aspecto; el bastón usa Gans y la interfaz avisa de que es cuasiestático), concentración y camino óptico.
7. **Presets**: oro 20 nm en agua; oro 80 nm; oro 150 nm; plata 20 nm; oro 20 nm en un medio de índice 1,5; nanobastón de oro de relación de aspecto 3; copa de Licurgo.
8. **Recorridos**: "por qué el oro coloidal es rojo" y "qué cambia con el tamaño y qué no".
9. **Ficha** completa, con referencias a Bohren & Huffman (cap. 4–5 y 12), Gaponenko (cap. de plasmónica) y Kreibig & Vollmer si procede.

## Criterio de terminado
Tests en verde (incluidas las comparaciones con `miepython` y los valores experimentales), las cinco vistas enlazadas, presets, recorridos, modo presentación y ficha. Motor de color y biblioteca de materiales documentados para reutilizarlos.
