// @ts-check
// Ayudante mínimo para crear elementos del DOM sin escribir HTML como texto.
//
//   el('button', { class: 'btn', title: 'Copiar', onclick: copiar }, 'Copiar enlace')
//
// Las claves que empiezan por "on" se registran como manejadores de eventos; `class`
// y `text` son atajos; `dataset` y `style` aceptan objetos; el resto se asignan como
// atributos HTML.

/**
 * @typedef {string | Node | null | undefined | false} Child
 */

/**
 * Crea un elemento HTML.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any>} [props]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/**
 * Vacía un elemento.
 * @param {Element} node
 */
export function clear(node) {
  node.replaceChildren();
}
