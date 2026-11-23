# AGENTS.md — La Estirpe

Este documento complementa `CLAUDE.md`. Leé ambos antes de trabajar. Las decisiones explícitas del usuario prevalecen sobre los borradores; si hay contradicción, exponela, no la resuelvas silenciosamente.

## Proyecto y objetivo inmediato

**La Estirpe (Tainted Ancestry)**: roguelike gótico de exploración y supervivencia, mazmorra persistente generada por semilla, linajes, muerte permanente y horrores nacidos en un Origen profundo.

**Prioridad actual:** validar con **Estirpe Sim**, un simulador ecológico sin render, si el Jenga permite una mazmorra viva, conectada y conquistable. **Esta rama solo agrega documentación e instrucciones; no constituye autorización para implementar.**

La versión jugable actual usa TypeScript, Vite, Three.js y un modo clásico Phaser. Godot se evalúa como futuro motor definitivo; no reescribas la versión actual en esta etapa.

## Normas obligatorias

1. No implementar una etapa nueva sin aprobación explícita del usuario. Proponer un plan y el alcance de cada PR antes de comenzar.
2. Trabajar en rama independiente y presentar PR. **No commitear ni mergear directamente a `main`**; el usuario revisa y aprueba el merge.
3. Conversación, informes y documentación de diseño en español rioplatense; identificadores de código en inglés. Texto del juego localizable en español e inglés.
4. Respetar el determinismo: usar `Rng.derive` de `src/core/rng.ts`, nunca `Math.random()` en simulación.
5. Mantener lógica de dominio desacoplada de Three.js, Phaser, DOM, navegador y futuro Godot. La simulación debe ejecutarse por línea de comandos y mediante tests.
6. Preservar las pruebas y los guardados. Cualquier dato persistente nuevo debe llevar versión y contemplar migraciones.
7. No introducir contenido audiovisual de terceros sin verificar licencias y condiciones de uso.
8. No incluir identificadores de modelos de IA en commits, PRs ni archivos del producto.
9. **No tratar como aprobadas las decisiones marcadas `[Propuesta]`**, ni las ideas recientes sobre genealogía, clases modulares, archivo de técnicas y arcón familiar.

## Documentación de referencia

- `CLAUDE.md`: reglas generales del repositorio.
- `docs/concepto.md`: visión y decisiones históricas; algunas fueron reemplazadas en documentos recientes.
- `docs/edificio.md`: edificio finito con 5 áreas, 25 zonas, 100 pisos y generador Jenga.
- `docs/niveles.md`: geografía vertical, agua y persistencia.
- `docs/combate.md`: clases y enemigos actuales.
- `docs/supervivencia.md`: recursos, campamentos, mochila, obras y mansión.
- `docs/linaje.md`, `docs/rasgos.md`: familia y rasgos.
- `docs/estirpe-sim.md`: requisitos propuestos para la simulación sin render.
- `docs/estirpe-sim-plan.md`: hitos y pruebas del primer módulo.

## Código de base

- `src/core/plan.ts`: estratos, áreas, zonas y profundidad.
- `src/core/jenga.ts`: armado Ed3a de las piezas de una zona; **todavía no produce toda la geometría voxel jugable final**.
- `src/core/building.ts`: espacio y sectores de la versión en ejecución.
- `src/core/rng.ts`: PRNG determinista.
- `src/core/dynasty.ts`: linajes y generaciones.
- `src/core/world.ts`: simulación jugable actual.
- `src/game/`: capa de render, no incorporar allí lógica ecológica.
- Tests con Vitest; comandos del repositorio: `npm test`, `npm run typecheck`, `npm run build`.

## Contratos del primer hito futuro

**Grafo ecológico, únicamente después de aprobar su implementación.** Extraer nodos y aristas de piezas y aperturas del Jenga; representar conexiones entre zonas, tipos de tránsito y obstáculos; probar conectividad desde el Origen hasta la superficie, y ruta viable del jugador hacia el fondo.

El simulador **no** puede inventar conexiones a mitad de una ejecución. Las puertas cerradas del jugador no pueden aislar mágicamente la biología: rutas alternativas (fisuras, pozos, conductos) deben existir en los datos generados y ser verificables. No implementar aún poblaciones, reproducción, IA, combate o efectos visuales.

## Entrega esperada en cada PR

- Alcance aprobado y decisiones todavía abiertas.
- Resumen de archivos e interfaces modificados.
- Pruebas ejecutadas y resultados reales; no declarar como ejecutadas las que no se corrieron.
- Garantías de determinismo, compatibilidad, persistencia y rendimiento.
- Riesgos observados y cuestiones que requieren aprobación del usuario.
