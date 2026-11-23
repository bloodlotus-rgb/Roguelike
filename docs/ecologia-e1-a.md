# E1-A · Hábitats y presupuestos de recursos

El experimento parte de un edificio vacío de recursos y sigue el destino de un aporte finito en el descanso de la mansión. Cada tick representa una hora ecológica. Agua, materia y energía tienen cuentas independientes. Los stocks de detritos, nutrientes y biomasa usan la misma unidad abstracta de materia para poder verificar su conservación.

## Derivación espacial

`buildHabitatGraph(seed, estados)` construye el plan, las zonas y el grafo validado de E0-M. `deriveHabitats` también admite estos datos ya construidos. Ordena los IDs y considera como pasos mezclables las aberturas e interiores abiertos de igual planta, sección y zona. Identifica los puentes de ese subgrafo con una búsqueda iterativa de tiempos de entrada y mínimos alcanzables. Un puente queda como frontera aunque las dos regiones tengan el mismo tipo de piso.

Los extremos de escaleras, conductos, compuertas, pasos de losa y conexiones con estado especial quedan fijos. El agregado crece desde una región por conexiones mezclables hasta ocho celdas físicas. Una sala indivisible de E0 conserva su superficie aunque por sí sola supere ese límite. Esto segmenta las galerías y acota la mezcla instantánea dentro de un hábitat. La asignación canónica `regionToHabitat` da un único propietario a cada región fina.

La superficie se calcula a 36 m² por celda ocupada. Para una sala simple se cuenta la huella de su planta. En piezas subdivididas sólo cuentan las regiones que E0 extrajo de celdas con dueño. La prueba de integración reconcilia el área total con la ocupación de las 25 zonas, excluyendo tanto roca como vacío reservado. Se guardan profundidad del piso, morfologías y capacidad provisional de biomasa. La humedad descriptiva vale 0,85 junto a un cauce o paso inundado y 0,2 en el resto. El crecimiento exige además agua en stock.

Cada frontera retiene el ID del corte físico, sus extremos, tipo, llave y estado efectivo. La sección y las capacidades de locomoción corresponden al tipo de E0. Se conserva la asignación fina para auditoría, y se liberan las zonas y la adyacencia fina al terminar la construcción. El agrupamiento cuesta un ordenamiento de regiones y cortes seguido de recorridos de costo lineal. Las listas dispersas de stocks y los índices de incidencia limitan el trabajo del tick a los hábitats activos y sus alrededores.

## Transporte y cuentas

Los coeficientes y límites del escenario están en `src/ecology/parameters.ts`. Cada corte tiene cuatro caudales máximos enteros, en unidades del recurso por hora. Una compuerta abierta con umbral seco permite intercambio de energía. Una fisura admite agua y nutrientes disueltos y retiene detritos. El estado inundado usa los caudales de la sección mojada. El estado cerrado o bloqueado anula los cuatro canales. Un cauce conserva su sentido descendente.

En pasos verticales la materia y el agua pueden bajar hasta el mínimo entre el caudal máximo y el stock disponible. En horizontal, y para la energía en ambas cotas, se usa el signo y la parte entera de `(stockA × capacidadB − stockB × capacidadA) / (capacidadA + capacidadB)`. El transporte de nutrientes requiere agua en el donante. La biomasa queda adherida al hábitat. Los valores, incluida la humedad, son hipótesis del escenario.

El orden de cada hora es el siguiente.

1. Durante las primeras 240 horas entran por la superficie 24 unidades de agua de escorrentía, 12 de detritos de raíces y 10 de energía por hora. Los tres presupuestos totales son 5.760, 2.880 y 2.400. Se imputan a la fuente y al hábitat de entrada.
2. Se proponen flujos desde la misma foto de stocks. Cuando varios destinos compiten por el mismo recurso, se adjudica por ID de corte en orden estable hasta agotar el presupuesto del donante. Cada transferencia debita y acredita la misma cantidad y registra el conector. Una unidad recién llegada puede volver a viajar en el tick siguiente.
3. Por hábitat se mineralizan hasta dos unidades de detritos en igual cantidad de nutrientes. Con agua presente, cada lote de crecimiento consume dos unidades de detritos, una de nutrientes y una de energía, y produce tres de biomasa. Hay un máximo de dos lotes por hora, limitado también por la capacidad local.
4. En el escenario abierto se pierde una unidad de agua por evaporación cada seis horas en cada hábitat con agua. La respiración exporta una unidad de materia cada cuatro horas en cada hábitat con biomasa. El escenario cerrado suprime los aportes y esas salidas. La energía consumida al crecer siempre se registra como sumidero.

`step` devuelve un nuevo estado y el libro de la hora. `audit` reconstruye todas las cuentas locales a partir de los saldos previos, verifica signos e integridad entera y exige conversión neta nula de materia, agua y energía. El gasto energético se registra por separado. Las pruebas también comparan los saldos globales con entradas y salidas externas. El modelo rechaza stocks inválidos y limita el inventario del escenario para mantener aritmética entera exacta.

## Guardar, reanudar y cambiar una barrera

```ts
const saved = snapshot(graph, state);
const rebuilt = buildHabitatGraph(saved.seed, new Map(saved.barriers));
const resumed = restore(rebuilt, saved);
const next = step(rebuilt, resumed);
```

El snapshot es JSON y contiene la versión del modelo, la del generador Jenga, la semilla, los estados estructurales, una firma SHA-256 de la agregación, la hora, el modo cerrado/abierto y los stocks por ID estable. Los flujos dependen de fases y orden canónicos. La única variación aleatoria proviene de la estructura sembrada de E0-M.

Para cambiar una barrera se deriva un nuevo grafo con el estado actualizado y se llama `reaggregate(anterior, nuevo, estado)`. Una división reparte el stock antes mezclado en proporción al número de regiones finas compartidas. El redondeo se hace por diferencias acumuladas en orden de ID, conservando cada unidad incluso cuando el stock es menor que el número de destinos. Una unión suma los aportes una sola vez. La proyección presupone el mismo edificio y la misma versión geométrica. La posición exacta de un recurso dentro de un hábitat mezclado es información perdida.

## Reproducir y leer el diagnóstico

```sh
npm ci
npm run check
npm run build
npm run --silent ecology:report -- --ticks 240 estirpe mansion zz
npm run --silent ecology:report -- --format json --ticks 48 estirpe
```

La salida por defecto es JSONL, una línea por semilla. El formato JSON devuelve una lista. Un error de derivación o contabilidad deja el proceso con código distinto de cero. El CI de TypeScript ejecuta el CLI junto con las pruebas en Node 24. El informe distingue regiones, hábitats, fronteras, hábitats con stock, cuentas en cero por recurso, materia total, energía y flujos acumulados. El total transportado mide tráfico y puede contar la misma unidad en distintas horas. `structuralReach` cuenta destinos físicamente accesibles por canal desde la entrada suponiendo disponibilidad en los donantes. La ocupación efectiva depende además del tiempo, el agua y los stocks.

## Ejecución medida

En Node 24.22.3 se ejecutaron `npm ci`, `npm run check` y `npm run build`. Pasaron 47 pruebas de ocho archivos. Diez corresponden a E1-A. Incluyen tres edificios completos, un puente entre ciclos, aislamiento de un corte bloqueado, conservación con escasez, cambio de agregación y comparación de los asientos hora a hora después de reanudar un snapshot JSON. También se ejecutaron el diagnóstico de Jenga en `estirpe` y el formato JSON ecológico con dos semillas a cero ticks.

Se midieron 240 horas por semilla, con un proceso independiente por edificio en esta máquina Linux. El tiempo de simulación incluye la auditoría por tick. CPU incluye generación, simulación y diagnóstico. El pico de RSS incluye las geometrías transitorias y el runtime de Node.

| Semilla | Regiones → hábitats | Fronteras | Hábitats con stock final | Armado (ms) | 240 ticks (ms) | CPU (ms) | Pico RSS (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| estirpe | 123355 → 100992 | 102470 | 115 | 3794 | 46 | 5858 | 482 |
| mansion | 122767 → 100759 | 102234 | 164 | 3338 | 92 | 5182 | 482 |
| zz | 123112 → 100530 | 102056 | 91 | 3626 | 57 | 5772 | 470 |

| Semilla | Agua final | Detritos | Nutrientes | Biomasa | Energía final | Agua evaporada | Materia exportada | Energía gastada |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| estirpe | 4857 | 1618 | 1169 | 33 | 2369 | 903 | 60 | 31 |
| mansion | 3502 | 10 | 2525 | 285 | 2285 | 2258 | 60 | 115 |
| zz | 4555 | 1618 | 1169 | 33 | 2369 | 1205 | 60 | 31 |

En los tres edificios el balance final fue exacto para cada recurso. En `estirpe`, 2.880 unidades de materia aportada dieron 2.820 de stock y 60 de respiración. Con el estado inicial, desde la mansión existe una ruta potencial de agua hasta 20 zonas, de detritos hasta seis y de energía hasta las 25. En `mansion` el agua sólo alcanza potencialmente 11 zonas. Estos límites se informan tal como surgen de los cortes y de la regla de gravedad.

## Límites y decisiones pendientes

Conservar cada puente y umbral reduce el número de nodos aproximadamente un 18 %. Los stocks dispersos evitan asignar cinco cuentas activas a cada hábitat vacío. La mezcla local, la permeabilidad por tipo, el sesgo por ID al competir por stock, los sumideros discretos y los aportes limitados a la entrada requieren calibración. La geometría actual representa el agua y la barrera mediante un solo estado efectivo por conector. Un cambio simultáneo de nivel de agua y cerradura requerirá ampliar ese contrato. Las pocas regiones activas al cabo de 240 horas delimitan el alcance de este escenario superficial. Introducir fuentes profundas necesitará una procedencia física y su propio presupuesto.
