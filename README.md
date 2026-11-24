# La Estirpe — Estirpe Sim

Laboratorio en **TypeScript sin motor gráfico** para verificar que un edificio Jenga procedural pueda sostener fauna, horrores migratorios, corrupción independiente y persistencia de generaciones.

## Estado
El laboratorio genera el edificio completo de Jenga, con grafo físico E0 y reservas de macropiezas E0-M ya integrados en `main`. Permite consultar rutas entre la entrada de la mansión y el Origen, así como modos de locomoción, restricciones de puertas, corredores, galerías multinivel y atrios vacíos. [Informe técnico E0](docs/jenga-e0.md) · [Informe E0-M](docs/jenga-e0-m.md). El CI de E0-M validó 37 pruebas y 100 semillas completas; no equivale a geometría vóxel final ni a equilibrio ecológico.

E1-A deriva hábitats de las superficies transitables y lleva cuentas separadas de agua, materia y energía por hora ecológica. [Modelo y diagnóstico E1-A](docs/ecologia-e1-a.md)

E1-B0 optimiza el transporte horario y los cambios de compuerta. [Equivalencia con E1-A y mediciones de carga](docs/ecologia-e1-b0.md)

El escenario E1-B1 simula colonias fúngicas y detritívoros inmóviles con aportes profundos trazables. [Contrato E1-B1](docs/ecologia-e1-b1.md) · [Viabilidad anual y causas de extinción](docs/ecologia-e1-b1-viabilidad.md)

E1-B2 registra el movimiento por cortes de propágulos e individuos, la extinción local y la recolonización. [Reglas, pruebas y mediciones E1-B2](docs/ecologia-e1-b2.md)

## Entorno y comprobación

Con Node.js 24, ejecutá:

```bash
npm ci
npm run check
npm run --silent jenga:report -- estirpe mansion
npm run --silent ecology:report -- --ticks 240 estirpe mansion zz
npm run --silent ecology:trophic -- --ticks 240 --scenario periodic estirpe mansion
```

El diagnóstico escribe una línea JSON por semilla. Los módulos retirados siguen en la [rama de archivo del prototipo](https://github.com/bloodlotus-rgb/Roguelike/tree/archive/prototipo-threejs-2026-11-23).

## Especificaciones vigentes
- [GDD maestro](docs/GDD.md)
- [Decisiones](docs/decisiones.md)
- [Contrato espacial Jenga E0](docs/jenga-contrato.md)
- [Informe Jenga E0](docs/jenga-e0.md)
- [Macropiezas E0-M](docs/jenga-e0-m.md)
- [Contrato ecológico](docs/ecologia-contrato.md)
- [Plan de limpieza](docs/limpieza-repo.md)
- [Especificación de Estirpe Sim](docs/estirpe-sim.md)
- [Hitos y encargo de Codex](docs/estirpe-sim-plan.md)

## Próximo trabajo
1. Retirar o desactivar por separado el despliegue automático legado de Cloudflare; no es necesario para el laboratorio.
2. Revisar las mediciones y los parámetros provisionales del transporte de recursos. [Informe E1-A](docs/ecologia-e1-a.md)
3. Revisar las causas de extinción y las tasas de E1-B1 antes de ampliar la red trófica. Conservar como pendientes la materialización vóxel y los umbrales monumentales inter-zona.

Todas las etapas se trabajan en ramas y PR independientes. `main` nunca se actualiza directamente.
