# vendor/

Dependencias de ejecución copiadas al repositorio (sin CDN). **No editar a mano**:
este contenido lo genera `npm run vendor` (`tools/vendor.mjs`) a partir de las versiones
exactas fijadas en `package.json`.

| Librería | Versión | Licencia | Archivos |
|---|---|---|---|
| three.js | 0.187.0 | MIT | `three/three.module.js`, `three/three.core.js`, `three/addons/controls/OrbitControls.js` |
| KaTeX | 0.19.1 | MIT | `katex/katex.mjs`, `katex/katex.min.css`, `katex/fonts/*.woff2` |

Se cargan desde el mapa de importación de `index.html` (`three`, `three/addons/`, `katex`).
