// @ts-check
// Arranque del laboratorio y enrutado por hash.
//
//   #/                       portada
//   #/<id>?clave=valor&…     módulo <id> en el estado indicado
//
// Los módulos se dan de alta en src/modules/registry.js (único sitio).

import { modules } from './src/modules/registry.js';
import { parseHash } from './src/core/state.js';
import { getTheme, toggleTheme, onThemeChange } from './src/core/theme.js';
import { el } from './src/ui/dom.js';
import { renderCover } from './src/ui/cover.js';
import { createModulePage } from './src/ui/module-page.js';
import { createPresentation } from './src/core/presentation.js';

const root = /** @type {HTMLElement} */ (document.getElementById('app'));
const titleBox = /** @type {HTMLElement} */ (document.getElementById('topbar-title'));
const actionsBox = /** @type {HTMLElement} */ (document.getElementById('topbar-actions'));

// --- Barra superior: zona de acciones de la página + botón de tema (siempre visible) ---
const pageActions = el('div', { class: 'page-actions' });
const themeButton = el('button', {
  class: 'btn',
  type: 'button',
  title: 'Cambiar entre tema claro y oscuro',
  onclick: toggleTheme,
});
function labelThemeButton() {
  themeButton.textContent = getTheme() === 'dark' ? 'Tema claro' : 'Tema oscuro';
}
labelThemeButton();
onThemeChange(labelThemeButton);
actionsBox.append(pageActions, themeButton);

// --- Enrutado ---------------------------------------------------------------------------
/** @type {import('./src/ui/module-page.js').ModulePage | null} */
let current = null;
/** Número de la navegación en curso: si llega otra mientras un módulo carga, la vieja se descarta. */
let navigation = 0;

// Modo presentación (tecla P): un único servicio que actúa sobre el módulo abierto.
const presentation = createPresentation({ getPage: () => current });

async function route() {
  const ticket = ++navigation;
  const { moduleId, query } = parseHash(location.hash);
  document.documentElement.dataset.ready = 'false';

  // Misma página de módulo: solo ha cambiado el estado en la URL.
  if (current && current.module.id === moduleId) {
    current.applyQuery(query);
    document.documentElement.dataset.ready = 'true';
    return;
  }

  presentation.reset();
  current?.destroy();
  current = null;
  const module = modules.find((m) => m.id === moduleId);

  if (moduleId === null) {
    document.title = 'Laboratorio de física';
    titleBox.textContent = '';
    renderCover(root, modules);
  } else if (!module) {
    document.title = 'Laboratorio de física';
    titleBox.textContent = '';
    root.replaceChildren(
      el(
        'div',
        { class: 'cover' },
        el('h1', { text: 'Módulo no encontrado' }),
        el('p', { class: 'notice', text: `No existe ningún módulo llamado «${moduleId}».` }),
        el('p', {}, el('a', { href: '#/', text: 'Volver a la portada' })),
      ),
    );
  } else {
    document.title = `${module.title} · Laboratorio de física`;
    titleBox.textContent = module.title;
    const page = await createModulePage(root, module, query, { actions: pageActions, presentation });
    if (ticket !== navigation) {
      page.destroy(); // el usuario ya se ha ido a otra página
      return;
    }
    current = page;
  }
  document.documentElement.dataset.route = moduleId ?? '';
  document.documentElement.dataset.ready = 'true';
}

window.addEventListener('hashchange', route);
route();
