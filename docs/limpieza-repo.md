# Plan de archivo y limpieza del repositorio

**Objetivo:** reconvertir `bloodlotus-rgb/Roguelike` en un laboratorio técnico independiente de render, previo al juego definitivo en Godot.

## Resguardo
Rama de archivo inmutable por convenio: `archive/prototipo-threejs-2026-11-23`, basada en `main` antes de la limpieza. No borrarla, rebasarla ni utilizarla como rama de trabajo. El historial Git también conserva versiones.

## Inventario de decisión
| Grupo | Archivos | Acción |
| --- | --- | --- |
| Núcleo reutilizable | `src/core/rng.ts`, `plan.ts`, `jenga.ts` y pruebas | Conservar |
| Contratos reaprovechables | `voxels.ts`, `paths.ts`, `bodies.ts`, `geometry.ts`, `locations.ts`, `pieces.ts` | Referencia archivada; reincorporar algoritmos tras desacoplar |
| Generador/estado legado | `building.ts`, `dungeon.ts`, `world.ts` y tests específicos | Archivar |
| Juego anterior | `classes.ts`, `survival.ts`, `enemies.ts`, `traits.ts`, `dynasty.ts`, `inventory.ts` | Archivar; rediseño modular |
| Render/UI y sonido | `src/game`, `src/ui`, `src/audio`, `src/i18n`, `src/main.ts` | Retirar de la rama activa tras resguardo |
| Soporte de aplicación | `src/save`, `src/settings`, `public`, `index.html`, `wrangler.jsonc` | Retirar en limpieza técnica; revisar despliegue |
| Documentación antigua | `docs/concepto.md` y especialistas históricos | Conservar temporalmente rotulados como legado; no presentarlos como GDD vigente |
| Configuración | `package.json`, `tsconfig.json`, Vitest | Simplificar a simulación headless |

## Plan de PR
1. **Preparación documental:** actualizar PR #49, registrar GDD, decisiones, contratos, alcance y estado; sin borrar código.
2. **Extracción y limpieza:** rama aparte, conservar `rng/plan/jenga` y pruebas; retirar aplicación heredada de la rama activa; scripts `test`, `typecheck`, `build` coherentes. Referenciar archivo histórico.
3. **Jenga E0:** PR funcional posterior para extraer y validar el grafo (no mezclar con borrados).
4. **Ecología E1+:** después de aprobar E0 y sus pruebas.

## Validación y seguridad
- No hacer commit directo a main ni merge automático.
- Verificar que el snapshot de archivo conserva los archivos históricos.
- El PR de limpieza es **incompatible con el sitio PWA actual**: fusionarlo dejará `main` como laboratorio sin frontend. Antes de fusionar, pausar o cambiar el despliegue automático de Cloudflare.
- No afirmar que pasaron tests sin ejecutarlos efectivamente. Mantener un informe de tests pendientes si no hay entorno de ejecución disponible.
- Si un módulo borrado resulta valioso, recuperarlo desde la rama archivo mediante cherry-pick o reimplementación acotada.

## Estado de esta rama
La limpieza se propone como PR de **borrador**, dependiente del PR documental #49. Se retiraron los componentes heredados del árbol activo y se dejaron las pruebas del núcleo. **Bloqueantes antes de fusionar:** regeneración de `package-lock.json`, ejecución de `npm run check` y coordinación de despliegue Cloudflare. Ninguno de esos pasos debe declararse completado sin verificarlo.
