# Galería de componentes

## Qué estás viendo

Un banco de pruebas de los servicios comunes del laboratorio. La función dibujada es un paquete de ondas gaussiano $\psi(x, y) = e^{-(x^2+y^2)/2\sigma^2}\, e^{ikx}$, elegido solo porque su módulo y su fase son conocidos.

## Qué es físico y qué es representación

Nada de esta página es una simulación física: es una función de prueba. El color codifica la fase $\arg\psi$ y el brillo o la altura codifican $|\psi|$, igual que en los módulos cuánticos.

## Ecuaciones

$$\psi(x, y) = \exp\!\left(-\frac{x^2 + y^2}{2\sigma^2}\right) e^{ikx}$$

## Límites del modelo

No hay modelo: no evoluciona en el tiempo ni resuelve ninguna ecuación.

## Referencias

- `docs/ARQUITECTURA.md`, sección "Servicios comunes".
