# vendor/

Dependencias de ejecución copiadas al repositorio (sin CDN). **No editar a mano**:
este contenido lo genera `npm run vendor` (`tools/vendor.mjs`) a partir de las versiones
exactas fijadas en `package.json`.

| Librería | Versión | Licencia | Archivos |
|---|---|---|---|
| three.js | 0.187.0 | MIT | `three/three.module.js`, `three/three.core.js`, `three/addons/controls/OrbitControls.js` |
| KaTeX | 0.19.1 | MIT | `katex/katex.mjs`, `katex/katex.min.css`, `katex/fonts/*.woff2` |
| CMU Serif (paquete npm `computer-modern`) | 0.1.3 | SIL Open Font License 1.1 (fuentes Computer Modern Unicode, A. Panov) | `cmu/cmu-serif-500-roman.woff2`, `cmu/cmu-serif-500-italic.woff2`, `cmu/cmu-serif-700-roman.woff2`, `cmu/OFL.txt` |

Se cargan desde el mapa de importación de `index.html` (`three`, `three/addons/`, `katex`). La fuente CMU Serif, desde `src/ui/styles.css` (`@font-face`).
