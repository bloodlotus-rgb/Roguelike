# Estirpe Sim — Especificación funcional y técnica v0.1

**Estado:** propuesta técnica para revisión. No equivale a aprobación de implementación.

## Objetivo

Validar antes de migrar a Godot que una mazmorra construida con Jenga pueda sostener **una ecología persistente**, una invasión ascendente de horrores y una progresión familiar viable, **sin render, DOM ni motor gráfico**. Reutilizar `src/core/plan.ts`, `jenga.ts`, `rng.ts` y las pruebas Vitest. El sistema antiguo de dinastía queda archivado; su integración futura se diseñará por separado.

El Jenga Ed3a arma planos de zonas; la geometría voxel final todavía no está integrada. El simulador debe trabajar sobre un **grafo derivado de las conexiones del Jenga**, no esperar a que se dibujen todas las habitaciones.

## Hipótesis

1. Los horrores comunes nacen **únicamente en el Origen** y ascienden por caminos existentes y transitables. No hay teleportación ni respawn arbitrario.
2. La potencia de los horrores condiciona su preferencia territorial: los más fuertes tienden a permanecer en las profundidades, pero pueden aparecer excepciones.
3. Exterminar una población despeja una zona realmente, aunque posteriormente puedan regresar migrantes y siga avanzando la corrupción.
4. La fauna mantiene ciclos de reproducción, alimentación, descomposición, competencia y migración sin colapso sistemático.
5. Las acciones de la familia sobre accesos, obras, agua y purificación modifican el ecosistema de manera medible.
6. Debe existir una ruta alcanzable desde la mansión al fondo aunque la exploración total del edificio sea enorme.

## Alcance inicial y exclusiones

**Incluido:** geografía y grafo, hábitats, recursos ambientales abstractos, cinco grupos iniciales de fauna, los cuatro horrores actuales, producción en el Origen, migraciones en cohortes, corrupción y control territorial, intervenciones abstractas, reloj simulado y resultados reproducibles.

**Excluido:** Godot, Three.js, vistas 3D, mallas voxels definitivas, animación, combate por fotograma, IA de entidades lejanas, economía íntegra, 100 especies y multijugador.

## 1. Geografía y tránsito

**Nodo:** una habitación, conjunto pequeño de piezas o agregado ecológico con ID estable, zona, profundidad, biome, humedad, agua, materia orgánica, refugio, luz, corrupción, capacidad y poblaciones.

**Arista:** una conexión con extremos, longitud, ancho, desnivel, profundidad de agua, estado de puerta/obstáculo, resistencia, permeabilidad y etiquetas de tránsito: `walk`, `crawl`, `climb`, `fly`, `swim`, `squeeze`, `break`.

Extraer el grafo de `assembleZone` y sus aberturas. La representación debe incorporar conexiones **entre zonas** por galerías, fisuras, pozos, agua y conductos sin depender de abrir las cerraduras del jugador. Esas conexiones deben existir en los datos de generación y ser eventualmente representables como geometría. La simulación no puede inventarlas durante el movimiento.

Separar tres redes: movimiento de criaturas, transporte de recursos y propagación de corrupción. Una barrera puede detener un depredador grande sin bloquear pequeños animales ni contaminación por agua.

Validar conectividad ecológica desde el Origen hasta cada región invadible y conectividad jugable desde la mansión al objetivo final.

## 2. Modelo biológico

**Recurso ambiental:** nutrientes, biomasa, humedad y alimento abstractos por nodo, no química ni hidráulica de alta fidelidad.

**Fauna:** `speciesId`, cantidad, estructura de edad simplificada, reserva de energía, salud, hábitat, actividad y ciclo reproductivo. Grupos iniciales: hongos, descomponedores, ratas, murciélagos, depredadores cavernarios. Hongos e insectos pueden representarse por biomasa, no individuos.

**Horror:** `speciesId`, cantidad, `originCohortId`, poder, profundidad preferida, afinidad por corrupción, capacidades de movimiento, estado y ruta. Primeros cuatro: Rastrero, Hueco, Plañidera y Apagavelas.

**Ancestros caídos:** entidades únicas derivadas de la muerte de un miembro de la familia, excepción explícita al nacimiento desde el Origen; escoltas y botín tienen procedencia rastreable.

Los horrores y la fauna pueden coexistir: relaciones posibles de presa-depredador, competencia, indiferencia, comensalismo y parasitismo. No forzar enfrentamientos universales.

## 3. Reloj ecológico

En cada paso reproducible:

1. Resolver eventos ambientales y obras.
2. Procesar descomposición, nutrientes y biomasa según condiciones y capacidad.
3. Resolver alimentación, reproducción y mortalidad de fauna.
4. Procesar depredación y competencia agregadas sin consumir individuos inexistentes.
5. Seleccionar y mover cohortes por alimento, hacinamiento, territorio, amenaza, luminosidad, corrupción y rutas compatibles.
6. Crear nuevas cohortes malditas **solo en nodos del Origen**, sujetas a presupuesto temporal.
7. Propagar corrupción por su red ambiental.
8. Aplicar y registrar cambios persistentes.

Escalas de detalle:
- **Activo:** cerca del jugador, entidades individuales (en la POC reemplazadas por acciones abstractas).
- **Vecino:** cohortes/grupos por pieza y sector, eventos de minutos/horas.
- **Lejano:** poblaciones agregadas por nodo y eventos por horas/días.

Promover una zona entre escalas nunca debe duplicar criaturas, resucitar muertos ni inventar recorridos. Usar PRNG por sistema + zona + período + índice de evento y orden estable.

## 4. Migración y jerarquía

Las cohortes pueden pasar solo por aristas compatibles con locomoción y obstáculos. Deben perder o gastar recursos en viaje. La afinidad por profundidad es una preferencia suave, no un muro artificial. Eventos excepcionales (migración masiva, gran horror ascendente, ruptura de un paso) son posibles si sus causas son representables.

Las puertas, rejas y barricadas retrasan, filtran, obligan a desviarse o pueden romperse, pero no aíslan todo el edificio por defecto. La noche modifica comportamientos y flujos, **no genera enemigos arbitrariamente**.

El estado inicial se obtiene mediante historia previa resumida o una distribución determinista justificable desde el Origen, no por respawn instantáneo.

## 5. Corrupción, presión y control

Tres conceptos independientes:
- `corruption`: grado de contaminación del ambiente.
- `horrorPressure`: presión derivada de criaturas y cohortes realmente presentes o cercanas.
- `control`: influencia defensiva de las obras y acciones familiares.

Una sala vacía de horrores no queda purificada automáticamente; la corrupción no crea nuevos horrores fuera del Origen. Puede afectar fauna y hábitat. No introducir derrota irreversible automática por el mero paso del tiempo sin aprobación de diseño.

## 6. Intervenciones reproducibles

- `cull(species,node,count)`: eliminar criaturas que realmente existan.
- `seal(edge,duration,strength)`: bloquear o reforzar acceso.
- `open(edge)`: abrir acceso.
- `purify(node,amount)`: disminuir corrupción con costo.
- `buildCamp(node)`: instalar refugio vulnerable a incursiones reales.
- `redirectWater(edge,amount)`: modificar humedad y transporte.
- `advanceGeneration(days)`: avanzar el mundo entre generaciones.

Validar precondiciones y registrar efectos; las acciones pueden fallar.

## 7. Arquitectura sugerida

```text
src/sim/
  model.ts         # nodos, aristas, biomas, entidades, estado
  graph.ts         # extracción del Jenga y validación
  clock.ts         # eventos y reloj
  resources.ts     # nutrientes, biomasa
  fauna.ts         # nacimientos, mortalidad, depredación
  horrors.ts       # origen y cohortes
  migration.ts     # rutas y flujo
  corruption.ts    # contaminación, control y purificación
  actions.ts       # intervenciones
  snapshot.ts      # persistencia versionada
  metrics.ts       # diagnósticos
  runner.ts        # CLI
  *.test.ts
```

Ejemplo de interfaz deseada, **todavía no implementada**:

```bash
npm run sim -- --seed "ashen-crypt-417" --days 365 --scope small --output results.json
npm run sim -- --seed "ashen-crypt-417" --days 3650 --scope full --scenario clearance
npm run sim:batch -- --seeds 100 --days 730 --scenario no-player
```

Salidas: JSON, CSV, log de eventos e informe textual. En esta fase no se requiere visor.

## 8. Métricas

- Población por especie, zona y día; extinciones y explosiones.
- Nacimientos en el Origen, movimiento de cohortes, supervivencia y muerte.
- Tiempo hasta primer encuentro cerca de la superficie.
- Propagación de corrupción, recaptura y limpieza de territorios.
- Recuperación natural tras exterminios locales.
- Efectividad de bloqueos, rutas y desvíos.
- Posibilidad de alcanzar el fondo.
- CPU por año simulado, memoria máxima y escalabilidad.
- Conservación contable de nacimientos, entradas, migraciones, muertes y remanentes.

## 9. Pruebas de referencia

- **S0 Mundo quieto:** diez años sin intervención.
- **S1 Despeje:** exterminar Rastreros y medir retorno desde abajo.
- **S2 Bloqueo:** cerrar la vía principal y medir desvíos.
- **S3 Noche:** verificar origen y ruta de cada atacante.
- **S4 Dique:** alterar agua y comparar ecosistemas.
- **S5 Diez generaciones:** deterioro de obras y presión maldita.
- **S6 Jerarquía:** más poder cerca del Origen, con excepciones.
- **S7 Lote:** al menos 100 semillas y detección de bloqueos/poblaciones inestables.

## 10. Invariantes de aceptación

- Todos los horrores comunes son trazables al Origen.
- Ninguna criatura atraviesa aristas inexistentes/incompatibles.
- Igual semilla, configuración y eventos ⇒ idénticos resultados.
- Guardar/reanudar ⇒ mismo resultado que correr sin interrupción.
- Despejar sectores tiene efectos reales y mensurables.
- El ecosistema no colapsa sistemáticamente sin jugador.
- La presión aumenta hacia superficie sin impedir siempre ganar.
- Contabilidad de población consistente.
- Se mide rendimiento en hardware de referencia antes de aprobar escala completa.

## 11. Orden de implementación

1. **Grafo verificable:** extraer conexiones Jenga, movilidad, rutas y tests.
2. **Ambiente y fauna:** recursos, capacidad de carga, ciclo de poblaciones.
3. **Origen y migración:** cohorte maldita y tránsito real.
4. **Corrupción:** propagación separada de criaturas.
5. **Intervenciones:** limpieza, obras, modificaciones y generaciones.
6. **Balance:** baterías multi-semilla, métricas y rendimiento.

**No implementar más de un hito por PR sin aprobación explícita.**

## 12. Decisiones abiertas

- Catálogo final y metabolismo de especies.
- Días entre generaciones y velocidad de ascenso.
- Consecuencia de llegar a la mansión.
- Posibilidad de metamorfosis fuera del Origen (recomendado: no, salvo héroes caídos).
- Duración deseada hasta el fondo y perfil de hardware.
- Las nuevas ideas de recursos, genética, clases modulares, archivo y arcón familiar se revisan aparte; **no integrarlas aquí sin aprobarlas**.
