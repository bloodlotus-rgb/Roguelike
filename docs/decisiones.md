# Registro de decisiones y precedencia

**Actualizado:** 2026-11-23. Fuente: decisiones del proyecto La Estirpe. No reemplaza el historial de Git.

## Orden de autoridad
1. Instrucción explícita más reciente del usuario.
2. `docs/GDD.md` (síntesis vigente) y contratos recientes de Jenga y ecología.
3. Documentos especializados aprobados que no contradigan los anteriores.
4. Documentación antigua del prototipo, como fuente histórica.

## Reemplazos confirmados
| Antes | Vigente |
| --- | --- |
| Mazmorra infinita y niveles independientes | Edificio Jenga finito y persistente; 5 áreas, 25 zonas, 100 plantas |
| Aparición de horrores por profundidad | Nacimiento exclusivo en el Origen y migración física; ancestros caídos como excepción |
| Hambre y sed como barras separadas | Sustento como barra; comida y agua persisten como bienes físicos |
| Tres clases fijas | Cuatro disciplinas y constructor modular, con presets históricos |
| Maná o hambre/sed gastada por cada acción | Munición física a distancia; Sustento para técnicas sobrenaturales; sin estamina de acciones |
| Ciclo 7 min día / 2,5 min noche | Objetivo provisional ~17 min día / ~5 min noche |
| Regeneración de salas al cambiar de vida | Persistencia de poblaciones, obras, recursos y migraciones |
| Sin arcón ni Archivo | Arcón limitado y Archivo de técnicas que exige regreso vivo a mansión |
| Prototipo Three.js como juego definitivo | Repositorio actual como banco técnico; Godot futuro separado |

## E0 completado; reservas y límites actuales
- E0 (#51): conectores verificables con dimensiones y movilidad, losas entre zonas, rutas al Origen y prueba de rutas para criaturas pequeñas.
- E0-M (#52): reservas de galerías longitudinales y atrios de varias plantas, con vacíos no transitables y conectores internos. CI: 37 pruebas y lote de 100 semillas.
- **No confundir la reserva estructural con un edificio vóxel renderizable:** están pendientes los soportes, puentes, secciones monumentales, redes aéreas 3D, costos físicos y umbrales excepcionales que atraviesen varias zonas.
- La biblioteca actual de 25 galerías y 5 atrios por edificio es una prueba técnica de escala; no es decisión final de composición artística.
- Próximo hito autorizado para Codex: [E1-A](https://github.com/bloodlotus-rgb/Roguelike/issues/53), recursos conservativos y hábitats derivados de Jenga, sin fauna.

## Provisional y NO bloquear E1-A por ello
Balance de reproducción y depredación; cantidades y velocidades de horrores; parámetros del Origen; cronología entre generaciones; todos los prefabs vóxel; habilidades y equipamiento definitivo.

## Política de migración
Antes de eliminar código obsoleto, fijar una rama de archivo. Las pruebas compatibles con el nuevo núcleo permanecen; las dependientes del prototipo se preservan en el archivo, no se simulan como tests del nuevo simulador.
