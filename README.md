# La Estirpe — Estirpe Sim

Laboratorio en **TypeScript sin motor gráfico** para verificar que un edificio Jenga procedural pueda sostener fauna, horrores migratorios, corrupción independiente y persistencia de generaciones.

## Estado
**Transición del prototipo:** esta rama retiene únicamente `rng.ts`, `plan.ts`, `jenga.ts` y pruebas asociadas. La ecología y el grafo aún no están implementados. Los módulos retirados continúan íntegros en la rama [archivo del prototipo](https://github.com/bloodlotus-rgb/Roguelike/tree/archive/prototipo-threejs-2026-11-23).

**La limpieza técnica está verificada.** El lockfile está versionado y Codex reportó `npm run check` con 11 pruebas aprobadas. **Decisión del proyecto (23/11/2026):** la demo anterior deja de ser producto activo; `main` pasa a ser el laboratorio Estirpe Sim. El despliegue automático legado de Cloudflare no forma parte de este proyecto y puede fallar mientras siga conectado. Su retiro de Cloudflare debe gestionarse por separado.

## Entorno y comprobación
```bash
npm ci
npm run check
```
El flujo de desarrollo usa TypeScript y Vitest. Los resultados y el riesgo de despliegue están registrados en el [informe de limpieza](docs/limpieza-repo.md#verificación-del-pr-50).

## Especificaciones vigentes
- [GDD maestro](docs/GDD.md)
- [Decisiones](docs/decisiones.md)
- [Contrato espacial Jenga E0](docs/jenga-contrato.md)
- [Contrato ecológico](docs/ecologia-contrato.md)
- [Plan de limpieza](docs/limpieza-repo.md)
- [Especificación de Estirpe Sim](docs/estirpe-sim.md)
- [Hitos y encargo de Codex](docs/estirpe-sim-plan.md)

## Próximo trabajo
1. Retirar o desactivar por separado el despliegue automático legado de Cloudflare; no es necesario para el laboratorio.
2. Aprobar por separado E0: grafo físico derivado de `assembleZone` y conectores entre zonas.
3. Aprobar E1: recursos/fauna, sin render ni entidades individuales lejanas.

Todas las etapas se trabajan en ramas y PR independientes. `main` nunca se actualiza directamente.
