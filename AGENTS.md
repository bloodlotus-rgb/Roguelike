# AGENTS.md — Estirpe Sim

Leé `CLAUDE.md`, `docs/GDD.md`, `docs/decisiones.md`, `docs/jenga-contrato.md`, `docs/ecologia-contrato.md` y el alcance del PR antes de editar.

## Objetivo inmediato
Reconversión del repositorio a simulador headless. Esta rama de limpieza **no es autorización para implementar E0 o E1**. El prototipo visual original permanece en `archive/prototipo-threejs-2026-11-23`.

## Instrucciones
1. No implementar un hito nuevo sin autorización explícita; una tarea aprobada tiene alcance estricto.
2. Trabajá en rama, PR para revisión. No hacer commit o merge directo a `main`.
3. Código e identificadores en inglés; informes y documentación en español rioplatense.
4. Determinismo mediante `Rng.derive`. Nunca `Math.random()` en lógica de simulación.
5. Módulos sin Three.js, Phaser, DOM de navegador ni dependencia de Godot.
6. Tests de Vitest, TypeScript estricto, persistencia versionada cuando exista.
7. Distinguir datos verdaderamente implementados de contratos propuestos y cifras a calibrar.
8. No declarar tests como ejecutados sin haberlos corrido.
9. No introducir obras, clases, horrores individuales, fauna ni simulador hasta el PR/hito correspondiente.
10. No incluir identificadores de modelos de IA en commits ni PRs.

## Rama de limpieza: criterios de finalización
- Conservar `rng.ts`, `plan.ts`, `jenga.ts` y sus pruebas.
- Eliminar del árbol activo el generador de plantas legado y el frontend Three.js/Phaser, sin alterar la referencia archivada.
- Regenerar `package-lock.json` con `npm install`, verificar `npm run check`, corregir lo necesario.
- **Decisión actual:** `main` abandona la PWA y es el laboratorio headless. Los fallos del despliegue de Cloudflare legado deben registrarse y desactivarse por separado; no intentar restaurar una aplicación web para satisfacer ese check.
