# La Estirpe (Tainted Ancestry) — instrucciones para Claude

Roguelike de supervivencia y exploración en tiempo real, para celular y navegador. Mazmorra persistente generada desde una semilla, muerte permanente y un linaje de herederos con rasgos. Proyecto aparte de Graphite (DnD-tools); no usa reglas de D&D.

## Forma de trabajo

- **Preguntar siempre todo lo que sea necesario** antes de asumir. Ante una ambigüedad de diseño, mecánicas o alcance, consultar al usuario; si se avanza con un supuesto, marcarlo explícitamente para que lo valide.
- No empezar la implementación de una etapa sin aprobación explícita del usuario.
- Idioma: la conversación y los documentos de diseño son en español (rioplatense). Código e identificadores internos en inglés.

## Diseño

El concepto vigente está en `docs/concepto.md`. Ante contradicciones mandan las decisiones del usuario. Lo marcado ahí como **[Propuesta]** todavía no está aprobado.

## Stack

- Vite + TypeScript, PWA.
- **Phaser 4** solo para la mazmorra (render, cámara, colisiones, entrada, escenas).
- **HTML/CSS** para la interfaz, encima del canvas.
- **Lógica en TypeScript puro** (`src/core/`), sin dependencias de Phaser ni del DOM, testeada con vitest.
- IndexedDB para guardar. Sin backend.

## Reglas técnicas

- **Determinismo**: toda la generación (niveles, loot, monstruos, rasgos, herederos) sale de un PRNG con semilla. Nunca `Math.random()` en la lógica del juego.
- **Guardado**: autoguardado continuo; no tiene que existir forma de volver a un estado anterior.
- Todo dato persistido lleva versión de esquema y migraciones.
- Interfaz y contenido en inglés y español: todos los textos son localizables, nada de texto fijo en el código.

## Contenido y derechos

- Todo el contenido es original. Se toman ideas de mecánicas de otros juegos (supervivencia, roguelikes, linajes), pero nunca sus nombres, personajes, arte, música ni su estilo visual reconocible.
- Arte provisorio hasta definir el arte final. Estilo objetivo: tinta y papel, vista cenital 3/4.

## Git

- `main` es siempre la versión estable.
- Cada etapa o módulo se trabaja en su propia rama y entra a `main` vía pull request. El usuario aprueba el merge (o pide explícitamente que Claude lo mergee).
- No commitear directo a `main` salvo pedido explícito del usuario.
- No incluir identificadores de modelo en commits, PRs ni código.
