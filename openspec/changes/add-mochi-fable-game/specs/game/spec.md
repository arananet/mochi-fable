# Spec delta: game

## ADDED Requirements

### Requirement: Héroe redondo que casi no salta
El jugador controla a Mochi, un ninja gordo con un lazo rojo en la cabeza. Su salto SHALL
alcanzar menos de un tercio de la altura del salto de un ninja enemigo.

#### Scenario: Saltito
- WHEN el jugador pulsa saltar
- THEN Mochi se eleva menos de 30 unidades y al caer levanta polvo y sacude la pantalla

#### Scenario: Los enemigos sí saltan
- WHEN aparece una oleada
- THEN los ninjas entran dando un salto al menos 3 veces más alto que el de Mochi

### Requirement: Vista 2.5D con carril en profundidad
El mundo SHALL tener eje horizontal, eje de profundidad acotado al carril y altura.

#### Scenario: Límite del carril
- WHEN un cuerpo intenta salir del carril en profundidad
- THEN su posición queda acotada a `[LANE.zMin, LANE.zMax]`

### Requirement: Combate contra ninjas
Mochi SHALL tener combo de 3 golpes (el tercero es un barrigazo que derriba), planchazo aéreo,
rodar con invulnerabilidad y un especial con medidor. Los golpes solo conectan hacia donde mira
y dentro de la tolerancia de profundidad.

#### Scenario: Golpe de frente
- WHEN un enemigo está delante, dentro del alcance y en la misma profundidad
- THEN el golpe conecta

#### Scenario: Golpe de espaldas
- WHEN el enemigo está detrás
- THEN el golpe no conecta

### Requirement: Oleadas y jefe
El nivel SHALL bloquear la cámara en arenas, lanzar oleadas en orden y terminar con un jefe.

#### Scenario: Progresión
- WHEN no quedan enemigos vivos en una arena
- THEN se lanza la siguiente oleada, o se libera la cámara si era la última

### Requirement: Parallax, luz y ciclo de día
El escenario SHALL tener al menos 8 capas de parallax y una paleta que interpola de tarde a
ocaso a noche según el avance, con rayos de luz, farolillos, luciérnagas y viñeteado.

### Requirement: Música
El juego SHALL incluir música y efectos procedurales (WebAudio) que arrancan tras la primera
interacción y se pueden silenciar.

### Requirement: Secretos
El juego SHALL incluir 8 easter eggs, entre ellos códigos de teclado detectados sobre el flujo
de teclas.

#### Scenario: Código Konami
- WHEN se teclea ↑↑↓↓←→←→BA aunque haya teclas previas
- THEN se activa "Mochi Gigante"

### Requirement: Jugable en navegador
El juego SHALL funcionar en un navegador moderno sin instalación, con teclado y con controles
táctiles, y existir como único fichero HTML autocontenido.
