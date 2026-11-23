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
El PR de limpieza #50 incluye el commit documental del PR #49. El árbol activo conserva los tres módulos del núcleo y sus pruebas. Se regeneró `package-lock.json` desde el manifiesto del laboratorio y el archivo histórico del prototipo apunta a `8624d94`, el mismo snapshot de `main` al momento de la verificación.

## Verificación del PR #50

Con Node.js 24.22.3 y npm 11.19.1 se ejecutaron `npm install` para regenerar el lockfile, `npm ci` para comprobar la instalación limpia y `npm run check` para verificar los tipos y correr Vitest. Pasaron las 11 pruebas de los tres módulos.

- `rng` cubre secuencias reproducibles, derivación de flujos y límites de enteros.
- `plan` cubre el determinismo, la estructura de 100 plantas y las llaves y nombres de zona.
- `jenga` cubre el determinismo, la conectividad y reciprocidad de aberturas, la ubicación de la salida y la zona más ancha.

Las pruebas coinciden con las del prototipo archivado. Con TypeScript 5.9.3, destino ES2022 y comentarios omitidos, los tres módulos emiten JavaScript idéntico al del archivo. La única diferencia del núcleo es que `plan.ts` declara localmente el tipo de llave que antes importaba del inventario legado.

**Riesgo de despliegue.** El script de build ahora verifica tipos y el árbol activo carece de los assets de la PWA. Antes del merge hay que pausar o reorientar el despliegue automático de Cloudflare. npm también reportó que el postinstall de `esbuild@0.25.12` no figura en su lista de permisos. La instalación limpia, la comprobación de tipos y las pruebas finalizaron correctamente en el entorno verificado.

**Candidatos para rescatar del archivo.** `locations.ts` detecta y valida conectores en plantillas y `pieces.ts` conserva el catálogo de piezas. `paths.ts`, `bodies.ts` y `voxels.ts` aportan algoritmos de superficies transitables, colisión y altura, pero sus dependencias del generador legado requieren desacople. `geometry.ts` también depende del mapa legado y sirve como referencia para colisión y visibilidad en 2D.
