# Estirpe Sim — Plan de implementación y primer encargo de Codex

**Estado:** preparado para planificación. **No comenzar a implementar hasta que el usuario apruebe explícitamente el Hito 1.**

## Propósito

Validar la geografía y la conectividad ecológica de `src/core/jenga.ts` sin render ni Godot; el diseño integral se encuentra en `docs/estirpe-sim.md`.

## Hito 1 — Grafo del Jenga

### Trabajo permitido después de aprobación
1. Leer `CLAUDE.md`, `AGENTS.md`, `docs/edificio.md`, `docs/estirpe-sim.md`, `src/core/plan.ts`, `jenga.ts`, `building.ts`, `rng.ts` y tests existentes.
2. Proponer interfaces de nodos, aristas y reglas de tránsito; preservar tipos deterministas e identificadores estables.
3. Derivar relaciones del resultado `assembleZone` usando aberturas emparejadas, túneles y conectores verticales.
4. Incorporar en el plan/generador **conexiones ecológicas entre zonas** (por ejemplo fisuras o conductos) como datos físicos, sin convertir puertas cerradas en muros impenetrables para toda especie. Definir capacidades de cada ruta: caminar, reptar, trepar, volar, nadar, colarse y romper.
5. Verificar que haya una ruta físicamente realizable desde superficie a Origen para el jugador y rutas de migración válidas desde el Origen a regiones superiores para al menos especies compatibles.
6. Agregar tests Vitest con múltiples semillas, bloqueos, rutas alternativas, separación de competencias por movilidad y determinismo.
7. Exponer un informe textual o JSON de conectividad y complejidad del grafo; sin visualización obligatoria.

### Fuera de alcance
- Poblaciones, reproducción, depredación, corrupción, IA, combate, NPC individuales, guardado de dinastías, reescritura de Three.js/Godot, nuevos assets.
- Alterar el gameplay actual o guardar partidas sin aprobación.
- Inventar caminos como atajo para salvar pruebas que fallen: deben ser decisiones de generación explícitas.

### Aceptación
- Para una misma semilla, iguales nodos/aristas y rutas.
- Conexiones bidireccionales o dirigidas correctamente según tipo de acceso.
- Ninguna ruta atraviesa un obstáculo incompatible.
- Al cerrar una puerta común, especies compatibles con otras conexiones conservan rutas alternativas cuando existan.
- La conectividad exigida se verifica sobre múltiples semillas, incluida la máxima zona del plan.
- No se rompe la batería de tests actual.
- Se documentan tamaño del grafo, tiempo de construcción y costos de ruta.

## Hitos posteriores — PR independientes

**Hito 2 — Ambiente y fauna:** nutrientes, agua abstracta, biomas, capacidad de carga, crecimiento, muerte, depredación y equilibrio.

**Hito 3 — Origen y migración:** horror nacido exclusivamente en Origen, cohortes con IDs y movimientos por grafo; distribución territorial según poder.

**Hito 4 — Corrupción:** propagación independiente de población, influencia ambiental y control familiar.

**Hito 5 — Intervenciones:** caza, purificación, abrir/cerrar accesos, campamentos, diques, generaciones.

**Hito 6 — Balance:** CLI, escenarios, 100+ semillas, métricas de rendimiento y conservación.

## Prompt sugerido para Codex

> Trabajá sobre `bloodlotus-rgb/Roguelike`. Leé `AGENTS.md`, `CLAUDE.md`, `docs/estirpe-sim.md` y `docs/estirpe-sim-plan.md`. Tu tarea es **planificar el Hito 1 del grafo ecológico Jenga** y señalar interfaces, pruebas, riesgos y cambios necesarios en la generación entre zonas. Presentá la propuesta antes de implementar: el proyecto exige aprobación explícita por etapa. No toques `main`; cualquier implementación autorizada debe ir a una rama separada y PR. Mantené la lógica en TypeScript puro y determinista, sin render.

## Protocolo de entrega

- Rama por hito y PR para revisión humana.
- Reporte en español de cambios, decisiones, pruebas realmente ejecutadas, estadísticas de rendimiento y riesgos.
- Sin merge sin aprobación del usuario.
