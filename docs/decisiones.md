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

## Decisiones estructurales pendientes para E0
- Esquema de conectores físicos con dimensiones, niveles, estado y compatibilidad locomotora.
- Conexiones realizables entre zonas, sin perforar arbitrariamente losas selladas.
- Garantizar ruta jugable al Origen y rutas ecológicas distinguibles según especie.
- Definir el nivel de refinamiento: un nodo grande puede necesitar subnodos si un obstáculo separa superficies.

## Provisional y NO bloquear E0 por ello
Balance de reproducción y depredación; cantidades y velocidades de horrores; parámetros del Origen; cronología entre generaciones; todos los prefabs vóxel; habilidades y equipamiento definitivo.

## Política de migración
Antes de eliminar código obsoleto, fijar una rama de archivo. Las pruebas compatibles con el nuevo núcleo permanecen; las dependientes del prototipo se preservan en el archivo, no se simulan como tests del nuevo simulador.
