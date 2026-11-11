// @ts-check
// Copia a vendor/ las dependencias de ejecución (three.js y KaTeX) desde node_modules.
//
// Uso:  npm install && npm run vendor
//
// La web NUNCA carga nada de node_modules ni de un CDN: solo lo que hay en vendor/,
// que se versiona en git. Para actualizar una librería: cambia la versión exacta en
// package.json, ejecuta `npm install && npm run vendor`, pasa `npm test` y anota la
// versión nueva en PROGRESO.md.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const vendor = join(root, 'vendor');

/** @param {string} name */
function version(name) {
  return JSON.parse(readFileSync(join(nm, name, 'package.json'), 'utf8')).version;
}

/**
 * @param {string} from ruta relativa a node_modules
 * @param {string} to ruta relativa a vendor
 */
function copy(from, to) {
  mkdirSync(dirname(join(vendor, to)), { recursive: true });
  cpSync(join(nm, from), join(vendor, to));
}

rmSync(join(vendor, 'three'), { recursive: true, force: true });
rmSync(join(vendor, 'katex'), { recursive: true, force: true });

// --- three.js: núcleo + control orbital -------------------------------------------
copy('three/build/three.module.js', 'three/three.module.js');
copy('three/build/three.core.js', 'three/three.core.js');
copy('three/examples/jsm/controls/OrbitControls.js', 'three/addons/controls/OrbitControls.js');
copy('three/LICENSE', 'three/LICENSE');

// --- KaTeX: módulo ES, hoja de estilos y fuentes woff2 ----------------------------
// La hoja de estilos cita woff2, woff y ttf; los navegadores actuales solo piden woff2,
// así que no copiamos los otros dos formatos.
copy('katex/dist/katex.mjs', 'katex/katex.mjs');
copy('katex/dist/katex.min.css', 'katex/katex.min.css');
copy('katex/LICENSE', 'katex/LICENSE');
for (const f of readdirSync(join(nm, 'katex/dist/fonts'))) {
  if (f.endsWith('.woff2')) copy(`katex/dist/fonts/${f}`, `katex/fonts/${f}`);
}

const readme = `# vendor/

Dependencias de ejecución copiadas al repositorio (sin CDN). **No editar a mano**:
este contenido lo genera \`npm run vendor\` (\`tools/vendor.mjs\`) a partir de las versiones
exactas fijadas en \`package.json\`.

| Librería | Versión | Licencia | Archivos |
|---|---|---|---|
| three.js | ${version('three')} | MIT | \`three/three.module.js\`, \`three/three.core.js\`, \`three/addons/controls/OrbitControls.js\` |
| KaTeX | ${version('katex')} | MIT | \`katex/katex.mjs\`, \`katex/katex.min.css\`, \`katex/fonts/*.woff2\` |

Se cargan desde el mapa de importación de \`index.html\` (\`three\`, \`three/addons/\`, \`katex\`).
`;
writeFileSync(join(vendor, 'README.md'), readme);
console.log(`vendor/ actualizado: three ${version('three')}, katex ${version('katex')}`);
