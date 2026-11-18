// @ts-check
// Rótulos de las gráficas con fórmulas sencillas, para el lienzo (encargo R1).
//
// Los rótulos de los ejes, de las líneas marcadas y de la leyenda dibujada en el lienzo
// pueden llevar trozos $…$ con un TeX muy reducido:
//
//   'posición $x$ (nm)'      →  posición x (nm), con la x en cursiva
//   '$\langle x\rangle$ (nm)' →  ⟨x⟩ (nm), con ⟨ ⟩ de verdad
//   '$|\varphi(k)|^2$ (nm)'  →  |φ(k)|² con el 2 como superíndice de verdad
//
// Lo admitido: letras (cursiva), cifras y signos (redonda; el guion pasa a signo menos),
// ^ y _ con un carácter o con {…}, {…} para agrupar, \mathrm{…} y \text{…} (redonda),
// espacios \, \; \  y las órdenes de COMMANDS. Una orden desconocida se escribe tal cual
// (y unknownCommands la encuentra, para los tests). Fuera de los $…$, texto normal.
//
// En la leyenda HTML y en los títulos lo dibuja KaTeX; aquí solo se convierte a trozos de
// texto con su estilo, que plot2d.js mide y dibuja uno tras otro. Función pura: se prueba en
// Node (tests/plot-tex.test.js).

/**
 * Trozo de texto con un solo estilo.
 * @typedef {object} TextRun
 * @property {string} text
 * @property {boolean} italic cursiva matemática (variables)
 * @property {number} level 0 normal, 1 superíndice, -1 subíndice (2, -2… anidados)
 */

/** Órdenes admitidas: carácter y si va en cursiva (las letras griegas minúsculas, sí). */
const COMMANDS = /** @type {Record<string, [string, boolean]>} */ ({
  alpha: ['α', true], beta: ['β', true], gamma: ['γ', true], delta: ['δ', true], epsilon: ['ϵ', true],
  varepsilon: ['ε', true], theta: ['θ', true], kappa: ['κ', true], lambda: ['λ', true], mu: ['μ', true],
  nu: ['ν', true], pi: ['π', true], rho: ['ρ', true], sigma: ['σ', true], tau: ['τ', true], phi: ['ϕ', true],
  varphi: ['φ', true], chi: ['χ', true], psi: ['ψ', true], omega: ['ω', true],
  Gamma: ['Γ', false], Delta: ['Δ', false], Theta: ['Θ', false], Lambda: ['Λ', false], Pi: ['Π', false],
  Sigma: ['Σ', false], Phi: ['Φ', false], Psi: ['Ψ', false], Omega: ['Ω', false],
  hbar: ['ℏ', false], langle: ['⟨', false], rangle: ['⟩', false], cdot: ['⋅', false], times: ['×', false],
  pm: ['±', false], infty: ['∞', false], circ: ['°', false], partial: ['∂', false], approx: ['≈', false],
  le: ['≤', false], ge: ['≥', false], to: ['→', false], sqrt: ['√', false], propto: ['∝', false],
  ell: ['ℓ', true], vert: ['|', false],
  ',': [' ', false], ';': [' ', false], ' ': [' ', false], '!': ['', false],
});

/** Signos que en TeX se escriben de otra manera. */
const SYMBOLS = /** @type {Record<string, string>} */ ({ '-': '−', '*': '∗', "'": '′' });

/**
 * Convierte un rótulo en trozos de texto con estilo.
 * @param {string} label
 * @returns {TextRun[]}
 */
export function texRuns(label) {
  /** @type {TextRun[]} */
  const runs = [];
  /** @param {string} text @param {boolean} italic @param {number} level */
  const push = (text, italic, level) => {
    if (text === '') return;
    const last = runs[runs.length - 1];
    if (last && last.italic === italic && last.level === level) last.text += text;
    else runs.push({ text, italic, level });
  };
  const parts = label.split('$');
  parts.forEach((part, i) => {
    if (i % 2 === 0) push(part, false, 0);
    else parseMath(part, 0, false, push);
  });
  return runs;
}

/**
 * @param {string} tex
 * @param {number} level
 * @param {boolean} upright dentro de \mathrm o \text
 * @param {(text: string, italic: boolean, level: number) => void} push
 */
function parseMath(tex, level, upright, push) {
  let i = 0;
  /** Lee un argumento: {…} o un solo carácter (o una orden). */
  const readArg = () => {
    while (tex[i] === ' ') i++;
    if (tex[i] === '{') {
      let depth = 0;
      const start = i + 1;
      for (; i < tex.length; i++) {
        if (tex[i] === '{') depth++;
        else if (tex[i] === '}' && --depth === 0) break;
      }
      const arg = tex.slice(start, i);
      i++;
      return arg;
    }
    if (tex[i] === '\\') {
      const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      const cmd = m ? m[0] : '\\';
      i += cmd.length;
      return cmd;
    }
    return tex[i++] ?? '';
  };
  while (i < tex.length) {
    const c = tex[i];
    if (c === '^' || c === '_') {
      i++;
      parseMath(readArg(), level + (c === '^' ? 1 : -1), upright, push);
    } else if (c === '{') {
      parseMath(readArg(), level, upright, push);
    } else if (c === '\\') {
      const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      const name = m ? m[1] : '';
      i += name.length + 1;
      if (name === 'mathrm' || name === 'text' || name === 'mathrm ') parseMath(readArg(), level, true, push);
      else if (name === 'left' || name === 'right' || name === 'big' || name === 'Big') continue;
      else if (COMMANDS[name]) push(COMMANDS[name][0], COMMANDS[name][1] && !upright, level);
      else push(`\\${name}`, false, level);
    } else if (c === ' ') {
      // En TeX los espacios no cuentan (salvo en \text{…}).
      if (upright) push(' ', false, level);
      i++;
    } else {
      push(SYMBOLS[c] ?? c, /[a-zA-Z]/.test(c) && !upright, level);
      i++;
    }
  }
}

/**
 * Órdenes que texRuns no conoce (deberían ser ninguna en los rótulos de los módulos).
 * @param {string} label
 * @returns {string[]}
 */
export function unknownCommands(label) {
  return texRuns(label)
    .flatMap((r) => r.text.match(/\\[a-zA-Z]+|\\./g) ?? []);
}

/**
 * Texto llano de un rótulo (para el lector de pantalla y para medir sin estilo).
 * @param {string} label
 * @returns {string}
 */
export function plainLabel(label) {
  return texRuns(label)
    .map((r) => r.text)
    .join('');
}
