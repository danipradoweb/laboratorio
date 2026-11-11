// @ts-check
// Arranque del laboratorio. (Versión mínima del paso 1: solo comprueba que la web
// carga desde una subruta; el enrutado y el registro de módulos llegan en el paso 4.)

const app = document.getElementById('app');
if (app) {
  const intro = document.createElement('p');
  intro.className = 'cover-intro';
  intro.textContent = 'Simulaciones interactivas de física. En construcción.';
  app.append(intro);
  document.documentElement.dataset.ready = 'true';
}
