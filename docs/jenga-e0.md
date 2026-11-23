# Jenga E0 · Grafo físico del edificio

## Circulación y piezas compuestas

Se revisó el commit `179713c` de `building3b`. Se recuperaron los pases de crecimiento del núcleo y las pruebas de asociación de salas y ciclos. La base de E0 es `main` en `32a48be`. [PR histórico #48](https://github.com/bloodlotus-rgb/Roguelike/pull/48)

| Decisión del #48 | Adaptación en E0 y motivo |
| --- | --- |
| Plantar escaleras, tender corredores, abrir anillos y después colgar salas | Se conserva el orden. Los túneles de cierre ocupan celdas de roca libres de una misma planta y abren ambas caras. La reparación de grupos separados y la salida se resuelven durante el armado. |
| Separar puertas de circulación y puertas interiores | Las puertas exteriores sólo encajan por caras opuestas y por tipos de pieza compatibles. Las interiores pertenecen al plano de una pieza compuesta. Así, dos salas vecinas ajenas a la pieza no pueden adquirir una puerta interior por coincidencia. |
| Ala de seis celdas | Tres tramos de corredor, con una puerta a cada una de tres habitaciones. Al bloquear esa puerta, la habitación queda aislada. |
| Claustro de nueve celdas | Ocho tramos forman un anillo. El patio central tiene una sola entrada. Esta elección conserva la vuelta alrededor del patio y evita que el grafo conceda un atajo a través de las paredes. Las celdas monásticas adicionales quedan sujetas a diseño. |
| Contar ciclos de circulación | Se conserva el conteo por zona y se comprueba el tránsito efectivo. Se bloquea una conexión y se busca otro camino usando sólo corredores y túneles. En el claustro aislado, bloquear un tramo del anillo deja un desvío de siete cruces. |

Las aberturas exteriores e interiores comparten la transformación de rotación de la huella. En las cuatro orientaciones se prueban tanto el desvío como el aislamiento de los recintos con una sola puerta. La nueva secuencia de crecimiento cambia la distribución de una semilla respecto del generador anterior. Para datos persistidos futuros habrá que asociar la versión de generación con la semilla.

## Del plan a una ruta

1. `buildStructure(makePlan(seed))` arma las 25 zonas de cuatro plantas a sus anchos reales. Las centra en los mismos ejes y usa la salida efectiva de cada zona como llegada de la siguiente. La estructura conserva las zonas y las reservas de corte de cada losa. La ubicación de cada paso queda fijada antes del detalle vóxel.
2. En cada losa, la escotilla inferior y la superior deben quedar enfrentadas a un metro. La compuerta principal lleva la llave del área. La reserva de pasos secundarios usa `Rng.derive(seed, 'slab', zone)` para elegir columnas distintas con mampostería excavable a ambos lados. Reserva una fisura y, si hay otro sitio apto, un conducto, pozo o cauce. Sin superposición apta se conserva la roca.
3. `extractGraph(structure)` devuelve regiones, adyacencias, conectores indexados y errores geométricos. Una sala simple forma una región por planta. Una espiral o la galería de un salón alto reserva una escalera entre descansos adyacentes en la celda de la esquina. Las particiones del ala y del claustro requieren una región por celda. Un corte inválido produce un error y queda fuera de la adyacencia.
4. Cada `Edge` identifica las dos regiones, los dos puertos, su orientación, tipo y estado inicial. El ID localiza la cara de la celda dentro de la zona y se interpreta junto con la semilla. `anchor` transforma cada puerto en metros este/sur/profundidad. Para una puerta lateral devuelve el umbral al nivel del piso. Para una escotilla devuelve el centro del hueco en su cara. `sections` fija el ancho y el gálibo útil de cada tipo. Las escaleras y compuertas reservan un recorrido entre descansos dentro del pozo de 6 × 6 m. Los huecos secundarios necesitan una bajada materializable dentro de la columna reservada, con agarres en el conducto y agua en el cauce dirigido.
5. `reachable` y `route` recorren sólo los conectores extraídos. Un perfil combina modos, ancho y altura requeridos y, opcionalmente, llaves o capacidad de romper una compuerta. Un mapa de estados por ID permite consultar bloqueos, aperturas, destrucciones o inundaciones sin regenerar las piezas. La búsqueda minimiza cruces, con costo unitario por conector. La dirección se conserva aun cuando cambie su estado.

El punto de partida es el descanso del pozo con escotilla a la superficie. Para E0, el Origen se ubica en la primera pieza excavable viva de la última planta en orden de colocación. Son convenciones verificables para los dos extremos del recorrido. El emplazamiento narrativo, el reparto de llaves, los costos en tiempo, el dimensionado definitivo de las secciones y la geometría de los umbrales monumentales quedan pendientes. La ruta potencial del jugador se mide con las tres llaves. La inundación representa un estado efectivo del paso. Una simulación posterior deberá distinguir barrera y nivel de agua si ambos pueden cambiar independientemente.

## Diagnóstico reproducible

Con Node.js 24 y las dependencias instaladas, estos comandos ejecutan la comprobación de tipos, las pruebas y el diagnóstico:

```sh
npm ci
npm run check
npm run build
npm run --silent jenga:report -- estirpe mansion zz
```

El proceso emite JSONL y termina con código distinto de cero si hay errores. Admite múltiples semillas. Para lotes largos también se puede ejecutar un proceso por semilla y concatenar las salidas. El RSS es el máximo del **proceso** en Linux y, al pasar varias semillas, incluye las anteriores.

`components` cuenta componentes físicas ignorando estado y sentido. Para cada perfil, `reachableByZone` e `inaccessibleRegions` miden acceso dirigido desde el Origen con el estado inicial. `singleUpwardPassages` identifica las losas con un único cruce ascendente accesible para ese perfil. Los cuellos de botella interiores se pueden investigar bloqueando un ID y consultando la ruta. La BFS usa tiempo y memoria proporcionales a regiones y conexiones alcanzadas.

## Verificación

Se ejecutaron `npm ci`, `npm run check` y `npm run build` con Node.js 24.22.3. Pasaron las 28 pruebas de cinco archivos, incluidas las 11 pruebas originales de rng, plan y jenga. Se añadieron casos de reciprocidad rota, losa inválida, cierre, inundación, rotación de compuestos, rutas dirigidas y bloqueo de un anillo. La dimensión máxima incluida es 112 × 112 × 4 celdas. El CLI también pasa la comprobación de tipos mediante la dependencia de desarrollo `@types/node`.

| Semilla | Piezas vivas | Regiones | Conectores | Cruces al Origen | Armado y extracción (ms) | BFS al Origen (ms) | Total (ms) | RSS máx. acumulado (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| estirpe | 90967 | 118143 | 122865 | 4569 | 2657 | 126 | 3518 | 431 |
| mansion | 91054 | 118134 | 122846 | 4360 | 2819 | 170 | 3963 | 507 |
| zz | 90312 | 117867 | 122621 | 4212 | 2503 | 135 | 3566 | 542 |
| e0-1 | 91315 | 118152 | 122815 | 4301 | 2416 | 132 | 3448 | 588 |
| e0-2 | 90592 | 118017 | 122721 | 4241 | 2252 | 174 | 3320 | 769 |
| e0-3 | 90647 | 117941 | 122598 | 4678 | 2240 | 126 | 3090 | 829 |
| e0-4 | 90332 | 117741 | 122406 | 4395 | 1899 | 143 | 2781 | 829 |
| e0-5 | 90557 | 118042 | 122741 | 4342 | 2009 | 129 | 2928 | 829 |

En las ocho semillas se obtuvo una componente física y cero errores de validación. En todas, el jugador con llaves alcanzó el Origen, y el perfil pequeño que repta y se cuela volvió a la mansión con las compuertas cerradas. En `estirpe`, ese perfil alcanza las 118.143 regiones desde el Origen. Un caminante sin llaves alcanza 12.242 y un nadador estricto sólo la región inicial. La existencia de anillos ofrece desvíos locales. Algunas puertas siguen siendo accesos únicos. El lote representa ocho edificios completos y no garantiza conectividad para toda semilla futura.
