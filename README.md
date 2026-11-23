# La Estirpe — Estirpe Sim

Laboratorio en **TypeScript sin motor gráfico** para verificar que un edificio Jenga procedural pueda sostener fauna, horrores migratorios, corrupción independiente y persistencia de generaciones.

## Estado
El laboratorio genera el edificio completo de Jenga y permite consultar rutas entre la entrada de la mansión y el Origen. El informe de E0 describe las interfaces, las restricciones de movimiento, la integración de `building3b` y las mediciones. [Informe técnico de Jenga E0](docs/jenga-e0.md)

## Entorno y comprobación

Con Node.js 24, ejecutá:

```bash
npm ci
npm run check
npm run --silent jenga:report -- estirpe mansion
```

El diagnóstico escribe una línea JSON por semilla. Los módulos retirados siguen en la [rama de archivo del prototipo](https://github.com/bloodlotus-rgb/Roguelike/tree/archive/prototipo-threejs-2026-11-23).

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
2. Revisar las reservas geométricas y las hipótesis de movilidad documentadas en E0.
3. Aprobar E1: recursos/fauna, sin render ni entidades individuales lejanas.

Todas las etapas se trabajan en ramas y PR independientes. `main` nunca se actualiza directamente.
