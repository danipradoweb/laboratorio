// @ts-check
// Oscilador armónico forzado y amortiguado: qué significa resonancia.
//
// La interfaz trabaja en unidades adimensionales: m = 1, ω₀ = 1, F₀ = 1. Así solo
// quedan dos parámetros que cambian la forma de las curvas, ω/ω₀ y γ/ω₀:
//   tiempo en unidades de 1/ω₀;  amplitud en unidades de la respuesta estática
//   F₀/(mω₀²);  potencia en unidades de F₀²/(mω₀).
// La física (physics.js) admite cualquier sistema de unidades coherente.

import { mount } from './view.js';

/** @type {import('../types.js').ModuleDescriptor} */
const descriptor = {
  id: 'oscilador',
  title: 'Oscilador forzado y resonancia',
  summary: 'Por qué un sistema responde mucho más a una frecuencia que a las demás',
  animated: true,
  thumbnail: 'miniatura.png',
  params: [
    {
      key: 'omega',
      label: 'Frecuencia ω/ω₀',
      type: 'range',
      min: 0.05,
      max: 3,
      step: 0.01,
      default: 0.8,
      help: 'Frecuencia con la que empuja la fuerza, en unidades de la frecuencia propia ω₀.',
    },
    {
      key: 'gamma',
      label: 'Amortiguamiento γ/ω₀',
      type: 'range',
      min: 0.02,
      max: 2,
      step: 0.01,
      default: 0.2,
      help: 'Rozamiento. El factor de calidad es Q = ω₀/γ.',
    },
    {
      key: 'transient',
      label: 'Arrancar desde el reposo',
      type: 'toggle',
      default: true,
      help: 'Muestra el transitorio: el movimiento desde x = 0, v = 0 hasta que se establece el régimen estacionario.',
    },
  ],
  presets: [
    { id: 'por-debajo', label: 'Muy por debajo: en fase', state: { omega: 0.2, gamma: 0.2 } },
    { id: 'resonancia', label: 'En resonancia: desfase de 90°', state: { omega: 1, gamma: 0.2 } },
    { id: 'por-encima', label: 'Muy por encima: en oposición', state: { omega: 3, gamma: 0.2 } },
    { id: 'poco-amortiguado', label: 'Amortiguamiento pequeño', state: { omega: 1, gamma: 0.05 } },
    { id: 'muy-amortiguado', label: 'Amortiguamiento grande', state: { omega: 1, gamma: 1.5 } },
  ],
  tours: [
    {
      id: 'resonancia',
      title: 'Qué significa resonancia',
      steps: [
        {
          preset: 'por-debajo',
          text: 'Si la fuerza empuja **despacio** ($\\omega \\ll \\omega_0$), la masa la sigue casi en fase y se desplaza lo mismo que con una fuerza constante: $A \\approx F_0/m\\omega_0^2$. Manda el muelle.',
        },
        {
          preset: 'resonancia',
          text: 'En $\\omega = \\omega_0$ la posición va **90° por detrás** de la fuerza. Entonces la fuerza empuja siempre en el sentido en que la masa ya se mueve y le entrega energía en todo momento: la potencia absorbida es máxima.',
        },
        {
          preset: 'por-encima',
          text: 'Si la fuerza empuja **muy deprisa** ($\\omega \\gg \\omega_0$), la masa no tiene tiempo de responder: se mueve poco y en oposición a la fuerza. Manda la inercia: cuanto mayor es $\\omega$, más se acerca la amplitud a $F_0/m\\omega^2$.',
        },
        {
          preset: 'poco-amortiguado',
          text: 'Con **poco rozamiento** el pico es alto y estrecho: en resonancia la amplitud es $Q = \\omega_0/\\gamma$ veces la estática, y la anchura de la curva de potencia es $\\gamma$. El transitorio dura más, porque decae como $e^{-\\gamma t/2}$.',
        },
        {
          preset: 'muy-amortiguado',
          text: 'Con **mucho rozamiento** la resonancia se desdibuja: la curva de potencia es ancha y baja, y la amplitud ya no tiene máximo (ocurre si $\\gamma \\ge \\sqrt{2}\\,\\omega_0$). Aun así, el desfase sigue valiendo 90° exactamente en $\\omega_0$.',
        },
      ],
    },
  ],
  mount,
};

export default descriptor;
