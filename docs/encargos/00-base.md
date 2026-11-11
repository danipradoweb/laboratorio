# Encargo 00. Base y servicios comunes

Objetivo: dejar montado el esqueleto completo que describe `docs/ARQUITECTURA.md`, con un módulo de demostración pequeño que use todos los servicios. Todo lo que se construya después se apoya en esto, así que la prioridad es que sea sólido, claro y fácil de ampliar, no que sea vistoso.

Empieza proponiendo un plan por pasos (modo plan) y espera aprobación.

## Pasos sugeridos

1. **Andamiaje.** `package.json` (scripts `test` y `check`), `.nojekyll` en la raíz (imprescindible: sin él GitHub Pages ignora las carpetas que empiezan por `_`, como `_plantilla`), `index.html`, `app.js`, estructura de carpetas, `vendor/` con three.js y KaTeX (versión fijada, anotada en PROGRESO.md). Comprueba que la web carga servida desde una subruta (`/laboratorio/`): todas las rutas deben ser relativas.
2. **Núcleo matemático con tests.**
   - `complex.js`: operaciones básicas, exp, polar. Tests de identidades.
   - `fft.js`: FFT radix-2 1D y 2D, directa e inversa. Tests: igualdad con la DFT ingenua en tamaños pequeños, ida y vuelta, teorema de Parseval.
   - `linalg.js`: resolución tridiagonal (Thomas), autovalores y autovectores de matriz tridiagonal simétrica (bisección de Sturm + iteración inversa, o QL implícito), sistema lineal complejo denso pequeño. Tests: autovalores del laplaciano discreto, $2-2\cos(k\pi/(N+1))$, y ortonormalidad de los autovectores.
   - `interp.js`: lineal y spline cúbica natural. Tests: reproduce exactamente funciones lineales; error de orden correcto en una función suave.
   - `units.js`: constantes CODATA 2018 ($h$, $\hbar$, $c$, $e$, $m_e$, $\varepsilon_0$, $k_B$) y conversiones habituales (eV ↔ J, nm ↔ eV para fotones, Å). Test contra los valores CODATA.
3. **Estado y URL.** `state.js` genera el estado a partir de `params`, lo sincroniza con el hash, valida tipos y rangos. Tests en Node de serializar y deserializar.
4. **Controles e interfaz.** `controls.js` genera los controles desde `params`. Diseño limpio y sobrio, panel de controles lateral plegable, vista principal amplia. Temas claro y oscuro (`theme.js`).
5. **Trazador 2D** (`plot2d.js`): ejes con marcas legibles, varias series, áreas sombreadas, marcadores verticales, mapas de color 2D, leyenda, exportar a PNG. **Visor 3D** (`view3d.js`): envoltorio fino de three.js con cámara orbital, etiquetas de ejes y redimensionado.
6. **Coloreado de fase** (`colormaps.js`): rueda de tono cíclica perceptualmente uniforme para arg ψ y brillo para |ψ|, con leyenda reutilizable. Mapas secuenciales y divergentes.
7. **Presets, transiciones y recorridos** (`presets.js`, `tours.js`), como describe la arquitectura.
8. **Modo presentación** (`presentation.js`) con todos los atajos de la arquitectura. Debe verse impecable a 1920×1080 en ambos temas.
9. **Fichas** (`ficha.js`): panel que renderiza `ficha.md` con KaTeX. Un parser de Markdown mínimo propio basta (títulos, párrafos, listas, énfasis, fórmulas en línea y en bloque).
10. **Portada** (`index.html`): título, una línea de presentación, tarjetas de módulos (título, resumen, miniatura). Enlace de vuelta a `https://danipradoweb.github.io/`.
11. **Plantilla** (`src/modules/_plantilla/`) con comentarios que expliquen cómo crear un módulo nuevo paso a paso, pensados para un modelo menos capaz que tú.
12. **Módulo de demostración: oscilador forzado amortiguado** (`src/modules/oscilador/`). Es pequeño pero real, y el encargo 02 lo reutilizará.
    - Física: $m\ddot x + m\gamma\dot x + m\omega_0^2 x = F_0\cos\omega t$. Amplitud y desfase estacionarios analíticos; integración temporal RK4 para ver el transitorio.
    - Vistas enlazadas: (a) evolución temporal de la fuerza y la respuesta, con el desfase visible; (b) amplitud y fase frente a $\omega$ con un marcador en la $\omega$ actual; (c) potencia media absorbida frente a $\omega$ (lorentziana).
    - Presets: muy por debajo de resonancia (en fase), en resonancia (desfase de 90°, amplitud máxima), muy por encima (en oposición), amortiguamiento grande y pequeño.
    - Un recorrido de 4–5 pasos: "qué significa resonancia".
    - Tests: amplitud y fase analíticas; la integración RK4 converge al régimen estacionario analítico; anchura a media altura de la potencia igual a $\gamma$ en el límite de amortiguamiento pequeño; conservación de energía con $\gamma = 0$ y sin fuerza.
    - Ficha completa.
13. **Prueba de humo** con navegador sin cabeza si está disponible (ver arquitectura).

## Criterio de terminado
- `npm test` y `npm run check` en verde.
- El módulo de demostración funciona con estado en URL, presets con transición, recorrido, modo presentación y ficha.
- La plantilla está documentada y un módulo nuevo se registra en un único sitio.
- PROGRESO.md actualizado y revisión con subagente hecha.
