# Mochi Fable

Juego web 2.5D (beat 'em up de carril con profundidad) sobre Mochi, un ninja redondo
con una cinta ninja roja que apenas salta. Proyecto construido con el método ANVIL:
spec OpenSpec -> tests en rojo -> implementación en verde -> revisión -> run report.

## Convenciones
- Sin dependencias en runtime: Canvas 2D + WebAudio, módulos ES en `src/`.
- Toda la lógica de juego sin DOM vive en `src/core.js` y está cubierta por `node --test`.
- Todo el arte y la música son procedurales y originales (sin assets externos).
- `node tools/build.mjs` genera `dist/index.html`, un único fichero jugable sin servidor.
