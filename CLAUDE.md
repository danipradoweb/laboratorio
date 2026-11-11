# Laboratorio de física

Simulaciones interactivas para estudiar, grabar vídeos de divulgación y publicar en GitHub Pages. Lee `docs/ARQUITECTURA.md` antes de escribir código: es la fuente de verdad del diseño.

## Al empezar cada sesión
1. Lee `PROGRESO.md` para saber qué está hecho y en qué paso se quedó la sesión anterior.
2. Lee el encargo que te indiquen en `docs/encargos/`. No leas los demás encargos salvo que el tuyo los cite.
3. Si el trabajo ya estaba empezado, continúa desde el último paso registrado sin rehacer lo terminado.

## Protocolo de trabajo (obligatorio)
- Divide el encargo en pasos pequeños que terminen cada uno con algo comprobable.
- Al cerrar cada paso: `npm test` en verde, commit con mensaje descriptivo, push, y actualiza `PROGRESO.md` (hecho, siguiente paso, decisiones, problemas). La sesión puede cortarse en cualquier momento por límites de uso: lo que no esté subido se pierde.
- No des un paso por terminado sin evidencia: salida de los tests o captura.
- Al terminar un módulo, lanza un subagente revisor con contexto limpio que compruebe solo la física y el cumplimiento del encargo. Corrige únicamente lo que afecte a la corrección física o a requisitos explícitos; anota el resto en `docs/BACKLOG.md`. Una sola ronda de revisión.
- No amplíes el alcance. Las ideas que surjan van a `docs/BACKLOG.md`.

## Reglas
- Física en funciones puras sin DOM (`physics.js`), testeada en Node. La vista solo dibuja.
- Cada test comenta qué principio comprueba y de dónde sale el valor esperado. Nunca ajustes un valor esperado para que un test pase: si falla, el error está en el código o en la referencia, y se investiga.
- Sin compilación ni CDN. Dependencias de ejecución copiadas en `vendor/`.
- Interfaz, fichas y comentarios en español; identificadores en inglés.
- Constantes físicas solo desde `src/core/units.js`.

## Datos externos
Si necesitas datos (constantes ópticas, funciones CIE, factores de forma), obtenlos con paquetes de pip o npm o desde GitHub, guarda el script en `tools/` y el resultado en `data/`, y anota fuente y licencia. Si la red no te deja descargarlos, no los inventes ni los tecleés de memoria: deja el módulo funcionando con datos de prueba marcados como tales y escribe en `PROGRESO.md`, sección "Necesito de Daniel", exactamente qué archivo hay que subir y de dónde.

## Comandos
- `npm test` ejecuta todos los tests.
- `npm run check` comprueba tipos con `tsc --noEmit`.
- `npx serve .` (o `python3 -m http.server`) sirve la web en local.
