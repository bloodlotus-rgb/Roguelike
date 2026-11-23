# La Estirpe — reglas para colaboradores

Roguelike gótico de supervivencia, exploración y linajes. El repositorio actual se reconvierte en **laboratorio determinista de Jenga y Estirpe Sim**; el juego definitivo se proyecta en Godot como proyecto separado. El prototipo visual anterior está preservado en `archive/prototipo-threejs-2026-11-23`.

## Fuente de verdad
1. Decisiones explícitas más recientes del usuario.
2. `docs/GDD.md`, `docs/decisiones.md`.
3. Contratos `docs/jenga-contrato.md` y `docs/ecologia-contrato.md`.
4. Los demás documentos, históricos o provisionales, solo donde no contradigan lo anterior.

## Forma de trabajo
- **No implementar nuevas etapas sin aprobación explícita**. Marcar supuestos y decisiones abiertas; pedir confirmación cuando sea indispensable.
- Trabajar siempre en rama y abrir PR; `main` es estable. **No hacer merge a `main` sin autorización del usuario.**
- Comunicación y documentación de diseño en español rioplatense. Identificadores de TypeScript en inglés.
- No incluir identificadores de modelos de IA en commits, PRs o código.

## Simulación
- TypeScript puro, desacoplado de Three.js, Phaser, DOM, navegador y Godot.
- PRNG derivado de semilla mediante `Rng.derive`; nunca `Math.random()` en lógica ecológica.
- Los grafos espaciales se derivan del plan Jenga, no se crean por separado; los conectores deben ser físicamente realizables.
- Horrores comunes solo nacen en el Origen; viajes por aristas válidas; no spawn arbitrario; corrupción independiente.
- Datos persistidos con versión. Guardar/reanudar debe conservar determinismo y contabilidad de individuos.
- Tests con Vitest, TypeScript estricto. Reportar comandos realmente ejecutados y limitaciones.
- No mezclar limpieza del prototipo, implementación de Jenga E0 y simulación ecológica en un único PR.

## Contenido
Contenido original, textos del juego localizables en español e inglés. No incorporar material audiovisual de terceros sin permiso y licencias apropiadas.
