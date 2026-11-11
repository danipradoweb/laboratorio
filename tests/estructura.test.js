// @ts-check
// Comprueba la estructura estática del repositorio que GitHub Pages necesita.
// No es un test de física: protege contra errores que solo se verían al publicar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Lista recursiva de archivos de una carpeta.
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// GitHub Pages pasa el sitio por Jekyll salvo que exista .nojekyll, y Jekyll descarta
// las carpetas que empiezan por "_" (como src/modules/_plantilla).
test('existe .nojekyll en la raíz', () => {
  assert.ok(existsSync(join(root, '.nojekyll')));
});

// La web se sirve desde https://danipradoweb.github.io/laboratorio/. Una ruta que
// empiece por "/" apuntaría a la raíz del dominio y daría 404.
test('index.html, app.js y src/ no usan rutas absolutas', () => {
  const files = [join(root, 'index.html'), join(root, 'app.js'), ...walk(join(root, 'src'))].filter(
    (f) => ['.html', '.js', '.css'].includes(extname(f)),
  );
  const patterns = [
    /(?:href|src)\s*=\s*["']\/(?!\/)/, // href="/..." o src="/..."
    /(?:from|import)\s*\(?\s*["']\/(?!\/)/, // import ... from '/...'  o  import('/...')
    /url\(\s*["']?\/(?!\/)/, // url(/...) en CSS
    /fetch\(\s*["'`]\/(?!\/)/, // fetch('/...')
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      assert.ok(!pattern.test(text), `Ruta absoluta en ${file} (patrón ${pattern})`);
    }
  }
});

// El mapa de importación de index.html debe apuntar a archivos que existen en vendor/.
test('el mapa de importación apunta a archivos existentes de vendor/', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(match, 'index.html no tiene mapa de importación');
  const { imports } = JSON.parse(match[1]);
  for (const [name, target] of Object.entries(imports)) {
    assert.ok(String(target).startsWith('./'), `"${name}" debe ser una ruta relativa`);
    assert.ok(existsSync(join(root, String(target))), `No existe ${target} (import "${name}")`);
  }
  assert.ok(existsSync(join(root, 'vendor/three/addons/controls/OrbitControls.js')));
  assert.ok(existsSync(join(root, 'vendor/katex/katex.min.css')));
  assert.ok(existsSync(join(root, 'vendor/katex/fonts/KaTeX_Main-Regular.woff2')));
});

// Las versiones vendorizadas deben coincidir con las fijadas en package.json
// (si no, alguien actualizó package.json sin ejecutar `npm run vendor`).
test('vendor/README.md refleja las versiones de package.json', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const readme = readFileSync(join(root, 'vendor/README.md'), 'utf8');
  assert.ok(readme.includes(`| three.js | ${pkg.devDependencies.three} |`));
  assert.ok(readme.includes(`| KaTeX | ${pkg.devDependencies.katex} |`));
});
