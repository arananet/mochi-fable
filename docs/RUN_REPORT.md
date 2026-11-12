# Run report: add-mochi-fable-game

Método ANVIL aplicado a mano: spec OpenSpec -> tests en rojo -> implementación -> verificación.
Nota: el repositorio `anvil-factory` no pudo adjuntarse a la sesión (permiso denegado), así que
no se ejecutó su tooling; se siguió su flujo (spec, TDD, evidencia) sin sus agentes ni plantillas.

## Evidencia
| Paso | Resultado |
| --- | --- |
| Spec | `openspec/changes/add-mochi-fable-game/` (8 requisitos) |
| Rojo | `tests/core.test.mjs` fallaba antes de existir `src/core.js` |
| Verde | `npm test`: 8/8 |
| Build | `dist/index.html`, ~100 KB, un solo fichero |
| Navegador (Chromium headless, 1280x720) | Título, 3 actos y jefe renderizan sin errores de consola |
| Partida completa | Un bot que usa las mismas entradas que el teclado supera las 6 arenas y el jefe en ~200 s y llega a la pantalla de fin |
| Táctil (perfil iPhone 13 apaisado) | Arranca con un toque y muestra palanca y botones |

## Defecto encontrado y corregido durante la verificación
- Los lanzadores podían quedarse fuera de la pantalla bloqueada, donde ni atacaban ni eran alcanzables,
  y la oleada no terminaba. Ahora los enemigos quedan acotados a la arena visible.

## No verificado
- El audio no se ha escuchado (el entorno de pruebas no tiene salida de sonido); solo se comprobó que
  no lanza errores.
- Rendimiento en móviles reales y Safari/Firefox: no probado.
- El equilibrio de dificultad solo se ha medido con el bot, no con jugadores.

## Iteración 2: más entretenido, sangriento y adictivo
- Añadido: sangre y desmembramientos con manchas persistentes, rangos de combo con multiplicador, Furia,
  malabares aéreos, rebote contra el borde y "bolos", ninja-bomba, 8 mejoras a elegir y Reto sin fin con récords.
- `npm test`: 9/9. El bot vuelve a completar la historia (~200 s) eligiendo mejoras, y en Reto sin fin
  llega a la oleada 8 en 150 s; sin errores de consola en ambos.
- No verificado: la pantalla de derrota del Reto sin fin (el bot no llegó a morir) y el guardado de récords.
