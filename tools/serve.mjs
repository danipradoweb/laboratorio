// @ts-check
// Servidor estático mínimo para desarrollo y para la prueba de humo.
//
// Uso:  node tools/serve.mjs [--base /laboratorio/] [--port 8080]
//
// Con --base sirve el repositorio bajo esa subruta, igual que GitHub Pages
// (https://danipradoweb.github.io/laboratorio/). Sirve para comprobar que todas las
// rutas de la web son relativas: si alguna fuese absoluta ("/src/..."), aquí daría 404.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Arranca el servidor.
 * @param {{ base?: string, port?: number, root?: string }} [options]
 *   base: subruta bajo la que se sirve (por defecto '/'); port: 0 = puerto libre cualquiera.
 * @returns {Promise<{ url: string, port: number, close: () => Promise<void> }>}
 */
export async function startServer({ base = '/', port = 0, root = ROOT } = {}) {
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';

  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      if (path === '/' && base !== '/') {
        res.writeHead(302, { Location: base });
        res.end();
        return;
      }
      if (!path.startsWith(base)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404: ${path} está fuera de la subruta ${base}`);
        return;
      }
      let file = normalize(join(root, path.slice(base.length)));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(file).catch(() => null);
      if (info?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file).catch(() => null);
      if (body === null) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404: ${path}`);
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  const realPort = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${realPort}${base}`,
    port: realPort,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

// Ejecución directa desde la línea de órdenes.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  /** @param {string} name @param {string} fallback */
  const arg = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const { url } = await startServer({
    base: arg('--base', '/'),
    port: Number(arg('--port', '8080')),
  });
  console.log(`Laboratorio servido en ${url}  (Ctrl+C para parar)`);
}
