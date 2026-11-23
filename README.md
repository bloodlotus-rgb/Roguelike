# La Estirpe — laboratorio técnico

Roguelike gótico de linaje, exploración y supervivencia. **Estado de transición:** este repositorio está siendo preparado para validar el Jenga estructural y la ecología persistente mediante **Estirpe Sim**, antes del futuro juego definitivo en Godot.

## Documentación vigente

- [GDD maestro](docs/GDD.md)
- [Decisiones y reemplazos](docs/decisiones.md)
- [Contrato espacial Jenga E0](docs/jenga-contrato.md)
- [Contrato ecológico Estirpe Sim](docs/ecologia-contrato.md)
- [Plan de limpieza del repositorio](docs/limpieza-repo.md)
- [Especificación técnica de simulación](docs/estirpe-sim.md) y [plan](docs/estirpe-sim-plan.md)

Los demás documentos en `docs/` describen etapas anteriores; ante contradicciones manda el GDD y la decisión más reciente del usuario.

## Estado del código

Mientras no se fusione el PR de limpieza, `main` conserva la aplicación histórica Three.js/Phaser. Ver el `README.md` de la rama `archive/prototipo-threejs-2026-11-23` para instrucciones del prototipo.

La futura rama activa será **headless**, reproducible y con tests de TypeScript. No incluirá render del juego ni requerirá Godot para ejecutar simulaciones.

**Aviso de despliegue:** actualmente `main` dispara un despliegue de Cloudflare. Antes de fusionar la limpieza que retira la aplicación, habrá que pausar o redirigir ese despliegue.

## Trabajo

Ramas y PR individuales. No fusionar cambios automáticamente, no codificar una etapa no aprobada. Usar `CLAUDE.md` y `AGENTS.md` como reglas para colaboradores.
