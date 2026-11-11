// @ts-check
// Visor 3D: envoltorio fino de three.js.
//
//   const view = await createView3D(contenedor, { axisLabels: { x: 'x', y: 'y', z: '|ψ|' } });
//   const surface = view.addSurface({ nx: 64, ny: 64, xRange: [-1, 1], yRange: [-1, 1] });
//   surface.update(alturas, coloresRGB);
//
// Qué resuelve para que los módulos no tengan que hacerlo:
//   - carga three.js en diferido (solo cuando un módulo abre una vista 3D);
//   - cámara orbital (arrastrar gira, rueda acerca) con el eje z hacia arriba;
//   - ejes con etiquetas, del color del tema;
//   - redibuja solo cuando hace falta (al mover la cámara, cambiar el tamaño o el tema,
//     o cuando la vista llama a requestRender());
//   - libera la memoria de la GPU en destroy().
//
// createView3D es asíncrona: mount() del módulo debe ser `async` y esperarla con await.
// Para todo lo demás (mallas, líneas, puntos) se usa three.js directamente a través de
// view.THREE y view.scene.

import { el } from './dom.js';
import { onThemeChange, themeColors } from '../core/theme.js';

/**
 * @typedef {object} View3DOptions
 * @property {{ x?: string, y?: string, z?: string }} [axisLabels] por defecto x, y, z
 * @property {number} [axisLength] longitud de los ejes (por defecto 1)
 * @property {[number, number, number]} [cameraPosition] posición inicial de la cámara
 * @property {string} [exportName] nombre del archivo PNG, sin extensión
 */

/**
 * Crea un visor 3D dentro de `container` (que debe tener una altura definida).
 * @param {HTMLElement} container
 * @param {View3DOptions} [options]
 */
export async function createView3D(container, options = {}) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  const axisLength = options.axisLength ?? 1;
  const wrap = el('div', { class: 'view3d' });
  container.append(wrap);

  /** @type {import('three').WebGLRenderer} */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    // Sin WebGL (equipo muy antiguo o aceleración desactivada): se avisa y no se rompe nada.
    wrap.append(el('p', { class: 'notice', text: 'Esta vista necesita WebGL, que no está disponible en este navegador.' }));
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Vista 3D; arrastra para girar');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01 * axisLength, 100 * axisLength);
  camera.up.set(0, 0, 1); // convenio de física: z hacia arriba
  const [cx, cy, cz] = options.cameraPosition ?? [2.1 * axisLength, -2.6 * axisLength, 1.7 * axisLength];
  camera.position.set(cx, cy, cz);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0.25 * axisLength);
  controls.update();

  // Luz suave: da volumen a las superficies sin alterar demasiado sus colores.
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(1, -1.5, 3);
  scene.add(sun);

  let destroyed = false;
  let renderPending = false;

  /** Pide un redibujado. Varias llamadas en el mismo fotograma producen un solo dibujo. */
  function requestRender() {
    if (renderPending || destroyed) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      if (!destroyed) renderer.render(scene, camera);
    });
  }
  controls.addEventListener('change', requestRender);

  // --- Ejes con etiquetas -----------------------------------------------------------------
  const axes = new THREE.Group();
  scene.add(axes);

  /**
   * Etiqueta de texto como "sprite" (siempre mira a la cámara).
   * @param {string} text
   * @param {string} color
   */
  function makeLabel(text, color) {
    const size = 64;
    const canvas = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const font = `${size}px ${getComputedStyle(wrap).fontFamily || 'sans-serif'}`;
    g.font = font;
    canvas.width = Math.ceil(g.measureText(text).width) + 16;
    canvas.height = Math.ceil(size * 1.4);
    g.font = font; // cambiar el tamaño del canvas borra su estado
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.fillText(text, 8, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // sizeAttenuation: false → la etiqueta mide lo mismo en pantalla esté cerca o lejos.
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false, sizeAttenuation: false }),
    );
    const height = 0.042;
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
    return sprite;
  }

  /** @param {import('three').Object3D} object */
  function disposeObject(object) {
    object.traverse((/** @type {any} */ node) => {
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
    });
  }

  function buildAxes() {
    disposeObject(axes);
    axes.clear();
    const colors = themeColors();
    scene.background = new THREE.Color(colors.surface);
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(colors.textSoft) });
    const labels = { x: 'x', y: 'y', z: 'z', ...options.axisLabels };
    /** @type {[keyof typeof labels, [number, number, number]][]} */
    const directions = [
      ['x', [1, 0, 0]],
      ['y', [0, 1, 0]],
      ['z', [0, 0, 1]],
    ];
    for (const [name, [dx, dy, dz]] of directions) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(dx * axisLength, dy * axisLength, dz * axisLength),
      ]);
      axes.add(new THREE.Line(geometry, material.clone()));
      const label = makeLabel(labels[name], colors.text);
      label.position.set(dx * axisLength * 1.1, dy * axisLength * 1.1, dz * axisLength * 1.1);
      axes.add(label);
    }
    material.dispose();
    requestRender();
  }
  buildAxes();
  const offTheme = onThemeChange(buildAxes);

  // --- Tamaño ---------------------------------------------------------------------------------
  function resize() {
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width < 10 || height < 10) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Dibujo inmediato (y no requestRender) para que no se vea un fotograma en blanco.
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(wrap);
  resize();

  // --- Superficies z(x, y) ------------------------------------------------------------------

  /**
   * Añade una superficie z(x, y) sobre una malla regular, con un color por vértice.
   * La malla va por filas (índice iy·nx + ix), igual que en fft.js y plot2d.js.
   * CONVENIO: aquí cada valor es un VÉRTICE, y xRange/yRange son las coordenadas del
   * primer y del último vértice (extremos incluidos). Ojo: en los mapas de plot2d.js los
   * rangos son bordes de celda; ver el comentario de Heatmap allí.
   * @param {{ nx: number, ny: number, xRange: [number, number], yRange: [number, number] }} grid
   */
  function addSurface({ nx, ny, xRange, yRange }) {
    const positions = new Float32Array(nx * ny * 3);
    const colors = new Float32Array(nx * ny * 3);
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = 3 * (iy * nx + ix);
        positions[i] = xRange[0] + ((xRange[1] - xRange[0]) * ix) / (nx - 1);
        positions[i + 1] = yRange[0] + ((yRange[1] - yRange[0]) * iy) / (ny - 1);
      }
    }
    /** @type {number[]} */
    const index = [];
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const a = iy * nx + ix;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        index.push(a, b, d, a, d, c);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(index);
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    const scratch = new THREE.Color();

    return {
      mesh,
      /**
       * Actualiza alturas y colores.
       * @param {ArrayLike<number>} heights z de cada punto (nx·ny valores)
       * @param {ArrayLike<number>} rgb color de cada punto: 3 valores 0–255 por punto (sRGB)
       */
      update(heights, rgb) {
        for (let i = 0; i < nx * ny; i++) {
          positions[3 * i + 2] = heights[i];
          // three.js trabaja en color lineal: se convierte desde sRGB.
          scratch.setRGB(rgb[3 * i] / 255, rgb[3 * i + 1] / 255, rgb[3 * i + 2] / 255, THREE.SRGBColorSpace);
          colors[3 * i] = scratch.r;
          colors[3 * i + 1] = scratch.g;
          colors[3 * i + 2] = scratch.b;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.computeVertexNormals();
        requestRender();
      },
    };
  }

  return {
    /** Espacio de nombres de three.js, para crear objetos propios. */
    THREE,
    scene,
    camera,
    controls,
    requestRender,
    addSurface,
    /** @returns {string} la vista como URL de datos PNG */
    toPNG() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    /** Libera el visor. Llamar desde destroy() de la vista. */
    destroy() {
      destroyed = true;
      observer.disconnect();
      offTheme();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      wrap.remove();
    },
  };
}

/** @typedef {NonNullable<Awaited<ReturnType<typeof createView3D>>>} View3D */
