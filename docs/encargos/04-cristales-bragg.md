# Encargo 04. Cristales, red recíproca y difracción

Objetivo: entender qué es un plano cristalino, por qué una familia de planos "refleja" solo a ciertos ángulos, qué es la red recíproca y cómo se lee un difractograma de polvo. Es el módulo donde más pesa la dificultad espacial del usuario: cada concepto debe tener vistas enlazadas (cristal real ↔ red recíproca ↔ patrón de difracción), de modo que lo espacial se entienda como relación.

Idea central que debe quedar visible: cada plano de átomos actúa como un espejo muy débil (refleja especularmente por la misma razón que un espejo; ver encargo 02) y las reflexiones de planos sucesivos se suman en fase solo cuando $2d\sin\theta = n\lambda$. Con luz visible λ es mucho mayor que $2d$ y solo existe el orden $n = 0$: la reflexión ordinaria es Bragg de orden cero.

## Pasos sugeridos

1. **Redes en 3D.** Cúbica simple, centrada en el cuerpo, centrada en las caras, diamante, NaCl, hexagonal compacta, y redes 2D para los esquemas. Celda unidad y celda primitiva conmutables. Base atómica con colores por elemento.
2. **Planos de Miller.** Al elegir $(hkl)$ se dibuja la familia de planos dentro de varias celdas y se muestra $d_{hkl}$. Enlazado: el vector $\mathbf{G}_{hkl}$ en la vista de red recíproca, perpendicular a esos planos y de módulo $2\pi/d_{hkl}$ (o $1/d$; indica el convenio). Cálculo general con el tensor métrico, para no limitarse a redes cúbicas.
3. **Construcción de Bragg en 2D.** Haz incidente sobre una familia de planos, caminos de dos rayos con la diferencia de camino resaltada, y un **diagrama de fasores** que suma las contribuciones de planos sucesivos: los fasores se alinean en el ángulo de Bragg y se enrollan sobre sí mismos fuera de él. Deslizadores de θ y λ, con λ ampliable hasta el visible para ver desaparecer todos los órdenes salvo el especular.
4. **Esfera de Ewald.** Sección 2D y vista 3D: esfera de radio $1/\lambda$ y nodos de la red recíproca; los nodos que tocan la esfera dan haces difractados. Rotación del cristal. Comparación entre rayos X (Cu Kα, 1,5406 Å) y electrones de un TEM a 200 kV (longitud de onda relativista de unos 2,51 pm), donde la esfera es casi plana y aparece un patrón de puntos.
5. **Difractograma de polvo.** Factor de estructura con factores de forma atómicos de Cromer-Mann (datos de las Tablas Internacionales, obtenidos de un paquete como `xraydb` o `periodictable`, con su script en `tools/`), multiplicidades y factor de Lorentz-polarización. Picos con anchura ajustable (Scherrer opcional, que enlaza con el tamaño de cristalito en nanomateriales). Al pasar el cursor por un pico se resaltan los planos correspondientes en la vista 3D.
6. **Tests.**
   - Si (diamante, $a = 5{,}431$ Å) con Cu Kα: picos en $2\theta = 28{,}44°$ (111), $47{,}30°$ (220) y $56{,}12°$ (311), con ±0,05°; (200) extinguido.
   - Reglas de extinción: FCC (hkl todos pares o todos impares), BCC ($h + k + l$ par), diamante (las de FCC más la condición del motivo).
   - En NaCl, (111) débil frente a (200) intenso, por el contraste entre los factores de forma de Na y Cl.
   - Longitud de onda relativista de electrones a 200 kV ≈ 2,508 pm.
   - $d_{hkl}$ por el tensor métrico coincide con la fórmula cúbica en redes cúbicas.
   - $\mathbf{G}_{hkl}$ es perpendicular a los planos (hkl).
7. **Presets**: planos (100), (110) y (111) en FCC; Bragg en el ángulo justo y fuera de él; luz visible sin difracción; Ewald con rayos X y con electrones; difractogramas de Si, NaCl y Au.
8. **Recorridos**: "qué es un plano cristalino", "por qué solo a ciertos ángulos", "de los planos al difractograma".
9. **Ficha** con referencias: Kittel cap. 1–2, Ashcroft-Mermin cap. 4–6, Cullity si procede.

## Criterio de terminado
Tests en verde, vistas enlazadas (en particular planos ↔ $\mathbf{G}_{hkl}$ ↔ pico), presets, recorridos, modo presentación y ficha.
