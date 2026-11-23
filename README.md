# La Estirpe — Estirpe Sim

Laboratorio en **TypeScript sin motor gráfico** para verificar que un edificio Jenga procedural pueda sostener fauna, horrores migratorios, corrupción independiente y persistencia de generaciones.

## Estado
**Transición del prototipo:** esta rama retiene únicamente `rng.ts`, `plan.ts`, `jenga.ts` y pruebas asociadas. La ecología y el grafo aún no están implementados. Los módulos retirados continúan íntegros en la rama [archivo del prototipo](https://github.com/bloodlotus-rgb/Roguelike/tree/archive/prototipo-threejs-2026-11-23).

**La limpieza se presenta como PR de borrador.** Falta regenerar `package-lock.json` con `npm install` y ejecutar `npm run check` en un entorno con dependencias. No fusionar hasta que se complete la verificación y se resuelva el despliegue automático de Cloudflare, que todavía depende de la antigua aplicación web.

## Entorno y comprobación
```bash
npm install
npm run check
```
Una vez completada la verificación, incorporar el nuevo `package-lock.json` al PR. No se requiere Three.js, Phaser, navegador ni Godot.

## Especificaciones vigentes
- [GDD maestro](docs/GDD.md)
- [Decisiones](docs/decisiones.md)
- [Contrato espacial Jenga E0](docs/jenga-contrato.md)
- [Contrato ecológico](docs/ecologia-contrato.md)
- [Plan de limpieza](docs/limpieza-repo.md)
- [Especificación de Estirpe Sim](docs/estirpe-sim.md)
- [Hitos y encargo de Codex](docs/estirpe-sim-plan.md)

## Próximo trabajo
1. Completar y comprobar esta limpieza.
2. Aprobar por separado E0: grafo físico derivado de `assembleZone` y conectores entre zonas.
3. Aprobar E1: recursos/fauna, sin render ni entidades individuales lejanas.

Todas las etapas se trabajan en ramas y PR independientes. `main` nunca se actualiza directamente.
