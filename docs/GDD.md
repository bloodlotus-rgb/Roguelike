# La Estirpe — GDD maestro, síntesis vigente v0.21

**Estado:** consolidación de decisiones conversadas al 23/11/2026. Este archivo prevalece sobre descripciones históricas del prototipo; los números de balance siguen siendo hipótesis.

## Visión

Roguelike gótico de exploración, supervivencia y dinastía. Una mansión se alza sobre un edificio maldito, físico, finito, persistente y generado por semilla. Cada héroe explora y modifica el mundo; quien muere regresa como jefe con su equipo. La familia acumula conocimiento e infraestructura, no niveles de experiencia permanentes. Una vida excepcional puede alcanzar el final, aunque el juego está diseñado para muchas generaciones.

## Edificio

- Cinco áreas, cinco zonas por área y cuatro plantas por zona: **25 zonas y 100 plantas**, aproximadamente 625 m de profundidad, con anchura creciente hacia abajo.
- Piezas tipo Jenga con volumen, orientación, pasos y grandes salas verticales. Una sola geometría física; representación procedural vóxel por sectores cuando corresponde.
- La disposición global es determinista por semilla. El plan, los pasos obligatorios, la llegada, el Origen y las conexiones ecológicas son parte del dato persistente/derivable.
- La exploración del edificio es manual; logística y migración solo recorren conexiones físicas válidas.

## Ecología y maldición

- Fauna común: recursos orgánicos, comunidades microbianas/hongos, invertebrados, roedores y depredadores; reproducción, mortalidad y recolonización con capacidad finita.
- **Todos los horrores comunes nacen solamente en el Origen de la maldición** y migran por vías realmente existentes. El catálogo inicial de diseño consta de seis familias y 24 especies propuestas; cuatro ya aparecen en el prototipo anterior.
- La corrupción ambiental se propaga por su propia red: no crea por sí sola horrores fuera del Origen.
- Eliminar una población la elimina de verdad. Solo vuelven individuos supervivientes o inmigrantes por caminos existentes. Las amenazas nocturnas proceden de entidades reales.
- Los ancestros caídos son excepciones explícitas al origen de horrores comunes y se convierten en jefes.
- Estabilidad: estado dinámico y viable, nunca población fija ni resurrecciones artificiales. Calibración multi-semilla primero; optimización evolutiva fuera de línea si resulta necesaria.

## Tiempo y supervivencia

- **Vida, Fatiga, Sustento y Luz**. La comida y el agua siguen existiendo como recursos físicos y logísticos diferenciados, aunque se resume su efecto en Sustento.
- Ritmo inicial a probar: 17 minutos jugables de día y alrededor de 5 de noche; el sueño avanza la noche rápidamente sin detener la ecología. Jornada completa del mundo: 24 horas ecológicas (17 de día + 7 de noche), correspondencia provisional.
- La fatiga se acumula por tiempo despierto y esfuerzos; se recupera sustancialmente al dormir, no con una barra de estamina por golpe.
- Descanso escalonado: vivac portátil, campamento de expedición, refugio familiar y mansión. La salud y heridas requieren tratamiento; hambre y sed no matan arbitrariamente en segundos.

## Refugios y logística

- Campamentos locales permiten descanso y aplicar maestrías; no equivalen al Archivo.
- Refugios familiares persistentes y vulnerables pueden alojar módulos de abastecimiento, cultivo, agua, defensa, almacenes y taller; producción exige recursos físicos.
- Traslado de suministros y herederos por rutas reales, con tiempo y riesgos; sin teletransportación ni muerte arbitraria fuera de cámara.
- La mansión aloja Archivo y Arcón familiar de capacidad limitada. Un descubrimiento entra al Archivo **solo cuando el héroe regresa personalmente con vida**.

## Héroes, clases y combate

- Atributos: Fuerza, Agilidad, Vigor, Ingenio, Voluntad y Percepción.
- Herencia genética: rasgos positivos elegibles dentro de límites; defectos heredados o espontáneos **no comprables ni elegidos**; compensaciones positivas aleatorias vinculadas a defectos. Límites y probabilidades pendientes de balance.
- Clases modulares de cuatro disciplinas: Marcial, Especialista, Sacerdotal y Arcana; cuerpo a cuerpo y distancia en todas, con dos conjuntos de armamento preparados.
- Constructor previsto: ataque según equipo, una especial, una definitiva, un movimiento, dos pasivas y entrenamientos del Archivo. Verdugo, Saqueador y Cirial son presets; se agrega preset arcano.
- Sin maná ni estamina universal: munición para ataques físicos a distancia; **Sustento para conjuración y devoción**, con costos de Luz/componentes cuando corresponde. Cada acción posee señales de sonido, destello o resonancia percibidas por criaturas existentes.
- Maestría personal por hitos, no experiencia farmeable; se aplica en campamento. La familia amplía opciones, infraestructura y conocimientos.

## Estados y límites de alcance

- **Vigente como dirección:** estructura del edificio, origen único, migración real, ecología persistente, sistemas de supervivencia, progresión y arquitectura sin motor gráfico para Estirpe Sim.
- **Provisional:** fórmulas y valores de balance, 24 especies finales, 32 habilidades propuestas, horas exactas entre generaciones, equipamiento, costos, capacidades y comportamiento táctico detallado.
- **Pendiente de cierre futuro:** desenlace en el Origen, expansión de la infraestructura, catálogo final de maestrías y balance del combate.
- Código del prototipo anterior en `src/world` y render Three.js/Phaser no constituye especificación vigente.

## Implementación aprobable por hitos

El repositorio actual se reconvierte en laboratorio de simulación, y el juego definitivo se construirá luego en Godot en un proyecto separado. Conservar un archivo íntegro del prototipo. **No fusionar preparación/limpieza con la implementación de la ecología**. Primer hito futuro: conectividad Jenga E0, luego recursos y poblaciones agregadas. Cada hito requiere PR y pruebas, y no se mergea a `main` sin revisión del usuario.
