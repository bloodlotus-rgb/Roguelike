# E1-B2 · Dispersión física y recolonización

En `mansion`, un hábitat que había perdido a ambos grupos volvió a recibir un propágulo y un detritívoro en la hora 100. El experimento gemelo que mantuvo bloqueada la única entrada siguió vacío a las 87.600 horas. La comparación usa el mismo edificio, la misma colonia fuente y la misma cuota externa.

## Contrato horario

La materia total comprende detritos, nutrientes, tejido fúngico, propágulos y detritívoros. Un propágulo vale una unidad de tejido y un individuo vale una unidad de masa. El agua y la energía tienen balances propios. E1-B2 conserva el aporte de la cuenca, el transporte de recursos por cortes y el metabolismo de E1-B1. El número de unidades vivas, incluidos los propágulos latentes, debe caber en la capacidad local.

1. Se recibe la carga físicamente declarada, se asienta su pérdida por sedimentación y se transportan los cuatro recursos de E1-A. En cada hábitat activo se aplican mantenimiento, mortalidad, mineralización, crecimiento, nacimientos y evaporación en el orden de E1-B1.
2. Cada cuarta hora se visitan los hábitats con saldo en orden de ID y sus cortes en el orden físico canónico. El hongo puede convertir 1 de tejido en 1 propágulo si conserva al menos 1 de tejido residente y dispone de agua, detritos y 1 de energía para producirlo. Un propágulo ya disponible puede derivar hacia un vecino sin tejido ni propágulos. La producción se carga una sola vez y el arrastre posterior es pasivo.
3. Un grupo de al menos 2 detritívoros puede enviar 1 individuo pagando 1 de energía en origen. El receptor debe tener agua, detritos, espacio y una población al menos 2 unidades menor que la del donante. Se reserva al menos 1 residente. Cada donante puede enviar como máximo una unidad de cada grupo en esa fase. Cada corte admite como máximo una por grupo entre ambos sentidos. Las salidas reservan inmediatamente saldo y plaza, y los créditos se aplican al terminar la fase. Así una llegada puede recorrer su próximo corte recién en una hora de movilidad posterior.
4. Un propágulo recibido puede germinar en la fase de establecimiento de esa misma hora. Con agua, detritos, 1 energía y ausencia de tejido fúngico establecido se convierte exactamente 1 propágulo en 1 tejido. En un sitio inadecuado queda latente. Cada 12 horas, si no germina, se descompone una unidad local en detrito. Es un calendario agregado de pérdida de viabilidad. Una colonia de una sola unidad puede sobrevivir si paga el mantenimiento. Un detritívoro que llega se cuenta inmediatamente y su primera reproducción posible ocurre en una hora posterior.

Los umbrales pequeños permiten ensayar el origen y el destino de cada unidad entera. El perfil de cuatro horas limita la velocidad y el remanente de un residente evita vaciar el donante por una decisión de movilidad. Son parámetros provisionales. La prioridad por ID puede favorecer siempre el mismo corte cuando hay varios candidatos.

## Compatibilidad espacial

Se usan los extremos, el sentido, el estado efectivo, las secciones y las profundidades de Jenga. El propágulo requiere una abertura de 0,01 × 0,01 m. Para el detritívoro se ensaya un paso terrestre con 0,20 m de ancho útil y 0,15 m de altura libre. Son requisitos de paso del modelo. En todos los tipos un bloqueo o cierre impide ambos movimientos. Una compuerta destruida conserva su sección.

| Corte | Propágulo | Detritívoro |
|---|---|---|
| Abertura e interior | Horizontal o descendente | Horizontal, con paso de arrastre terrestre |
| Escalera | Horizontal o descendente | Ambos sentidos |
| Puerta o conducto seco | Horizontal o descendente | Horizontal o descendente si ofrece paso terrestre |
| Fisura o pozo | Horizontal o descendente | La fisura es demasiado estrecha. El pozo exige escalada o vuelo. |
| Cauce | En el sentido del cauce, con agua en origen y sin ascenso | Carece de locomoción acuática |
| Corte inundado | Con agua en origen, respetando sentido y desnivel | La inundación impide el paso |

El traslado cuesta una frontera física, incluso entre zonas. En una losa sólo existen los pasos materializados por E0. El transporte de agua y detritos sigue su contrato independiente.

## Trayectoria observada en un edificio real

La cuenca de `mansion` entra por el cauce `10/55/31/3/5`. La colonia está en la región `10/194/3` y el sitio de seguimiento es `10/221/3`. La abertura entre ambos es `10/55/31/3/2`. Para obtener un contrafactual con una sola ruta, el ensayo bloquea con estados Jenga todos los cortes periféricos de esas dos regiones y de la desembocadura. Conserva el cauce y la abertura. El ensayo `whole` mide por separado el edificio en su configuración original.

| Hora | Evidencia en el sitio receptor |
|---:|---|
| 4 | El origen debitó 1 tejido y 1 energía para producir un propágulo. Cruzaron 1 propágulo y 1 individuo por la abertura. La migración consumió 1 energía del donante y la germinación, 1 del receptor. Quedaron 1 tejido y 1 individuo. |
| 8 | El individuo se reprodujo con 1 detrito y 2 de energía locales. Quedaron 2 individuos. |
| 12 | Los detritívoros murieron por falta de alimento en el mantenimiento. |
| 33–36 | Se bloqueó la abertura antes de la hora 33. En la hora 36 murieron los 4 tejidos fúngicos restantes por falta de detritos y sus restos volvieron a esa cuenta. |
| 96 | En el destino había 48 de agua, 4 detritos, 10 nutrientes y 27 de energía. No quedaba tejido, propágulo ni individuo. |
| 97–100 | Se reabrió antes de la hora 97. Primero llegaron recursos. En la hora 100 el donante pasó de 26 a 25 tejidos y de 10 a 9 detritívoros. El receptor pasó de cero a 1 de cada grupo. Transcurrieron 64 horas desde la extinción fúngica y 88 desde la animal. |
| 104 | Hubo un nacimiento local y otra inmigración. El libro registra por separado ambos orígenes. |

En el gemelo sellado tampoco quedaban propágulos latentes. La cuenca aporta recursos y el único paso para organismos permanece cerrado, de modo que el sitio carece de una fuente de recolonización mientras dure el bloqueo. El JSONL de `mansion/reopen` incluye los asientos de esta trayectoria con ID de corte, extremos y stocks a ambos lados. [Ensayos y trazas](benchmarks/e1-b2.jsonl)

## Uno y diez años

La cuenca abundante usa los mismos 6 lotes por hora de E1-B1, con un máximo de 52.560 lotes. El control de media tasa entrega 3 por hora con la misma cuota total. El ensayo de escasez recibe sólo el depósito fundador. En `two-foci` el segundo depósito histórico llega por la abertura antes de aislar ambos sitios desde la primera hora. Se contabilizan sus recursos y sus organismos una sola vez. Los otros ensayos parten de un solo foco.

Cada celda muestra hábitats ocupados por hongos/detritívoros al año → a los diez años. Un sitio con ambos grupos suma uno en cada cuenta.

| Ensayo de recinto | `mansion` | `estirpe` | `zz` |
|---|---:|---:|---:|
| Abierto | 3/1 → 0/0 | 3/0 → 0/0 | 3/1 → 0/0 |
| Reabierto | 3/1 → 0/0 | 3/0 → 0/0 | 3/1 → 0/0 |
| Sellado | 2/1 → 0/0 | 2/0 → 0/0 | 2/1 → 0/0 |
| Dos focos separados | 2/1 → 0/0 | 2/0 → 0/0 | 2/1 → 0/0 |
| Sin aportes posteriores | 0/0 → 0/0 | 0/0 → 0/0 | 0/0 → 0/0 |
| Media tasa | 2/0 → 0/0 | 1/0 → 1/0 | 2/0 → 0/0 |

El corte reparado permitió recolonización en las tres semillas. Con escasez y sólo el depósito fundador, ambas poblaciones se extinguieron antes de la hora 8.760 en las tres. Los tres ensayos con abertura permanentemente sellada mantuvieron vacío el sitio de seguimiento después de la extinción. Con media tasa y la misma cuota, el agotamiento de la fuente se demora hasta el segundo año. En `estirpe` aún quedaba un hábitat con hongos al cabo de diez años en ese recinto. El momento del aporte, el alcance real de cada grupo y los recursos retenidos influyen en la duración.

En el edificio completo con la cuota abundante se obtuvieron estos resultados. Las tres semillas aún tenían recursos distribuidos al décimo año, cuando ambos grupos ya se habían extinguido.

| Semilla | Ocupados al año (hongos/detritívoros) | Con stock al año | Ocupados a 10 años | Con stock a 10 años | Sitios alcanzados en 10 años (hongos/detritívoros) |
|---|---:|---:|---:|---:|---:|
| `mansion` | 4/1 | 216 | 0/0 | 548 | 6/6 |
| `estirpe` | 4/1 | 38 | 0/0 | 157 | 4/5 |
| `zz` | 3/1 | 455 | 0/0 | 681 | 3/5 |

Cada ventana informa totales por cuenta, colonias con residentes, hábitats con cada grupo, superficie ocupada, profundidad máxima ocupada, hábitats con stock y número de hábitats alcanzados. La superficie es la de los hábitats agregados donde hay presencia. El área de dos especies puede superponerse. El historial distingue primera colonización, extinción y retorno, incluso cuando dos eventos ocurren en fases distintas de la misma hora. El diagnóstico conserva los primeros 32 eventos del sitio seguido, los contadores acumulados, las causas de mortalidad y los cruces por conector y sentido. Las distancias son topológicas y el inventario dentro de un hábitat se supone mezclado.

## Guardado y cambios de época

`E1-B2/1` guarda el escenario de E1-B1, la bandera de movilidad, los depósitos adicionales con origen, región y corte, la cuota consumida, el reloj, los stocks y la distribución fina del material vivo. Se firman el contrato trófico, las reglas de movimiento y las secciones. Un segundo SHA-256 verifica el contenido del checkpoint. Los lectores de `E1-B1/1` y sus firmas originales siguen disponibles. Una versión incompatible requiere una migración explícita.

Los anclajes descomponen espacialmente las cuentas vivas. Cada llegada se acredita primero en la región fina del puerto y comparte espacio sólo dentro del mismo hábitat conectado si éste mezcla varias regiones. El crecimiento comienza en una región con residentes. Al dividir o unir hábitats se proyectan agua, detritos, nutrientes y energía por superposición como en E1-B1. El tejido, los propágulos y los individuos siguen la región donde quedaron registrados. Una unión y una separación posterior conservan esas posiciones. La restauración comprueba los saldos espaciales contra el inventario sin sumar dos veces su masa.

```ts
const saved = saveMeta(world, state);
const rebuilt = buildDispersalWorld(saved.setup.seed, new Map(saved.barriers));
const resumed = restoreMeta(rebuilt, JSON.parse(JSON.stringify(saved)));
const changed = changeDispersalBarrier(rebuilt, connectorId, 'blocked');
const projected = projectMeta(rebuilt, changed, resumed);
```

## Carga de numerosas colonias activas

Se ejecutó un proceso independiente por carga en `mansion`, durante 48 horas. «Colonia» cuenta un hábitat con hongo establecido o individuos y cuenta una sola vez los sitios compartidos. Se agregó un depósito externo finito por foco de carga adicional, con región y último corte de acceso. Los sitios se eligen recorriendo pasos abiertos de marcha o arrastre accesibles desde la superficie. El primer foco conserva su procedencia por el cauce. Cada foco arranca con 4 tejidos y 2 individuos. Las reservas de agua, detritos y energía se dimensionan para 48 horas a partir de la capacidad de mantenimiento y de los caudales máximos de salida locales. El libro carga todo el manifiesto a la hora cero. El escenario de estrés mantiene actividad durante la medición y mide una carga distinta de la viabilidad espontánea.

Mediciones con Node 24.22.3. Los tiempos por hora son media / percentil 95. La generación y la transición de barrera se miden una vez por proceso.

| Colonias iniciales | Colonias media / final | Generación (s) | Tick (ms) | Auditoría (ms) | Transición completa (ms) | CPU simulación (s) | RSS pico (MiB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 4,5 / 4 | 3,94 | 0,088 / 0,198 | 0,052 / 0,110 | 117,3 | 0,15 | 463,6 |
| 10 | 28,7 / 30 | 3,86 | 0,336 / 0,582 | 0,165 / 0,309 | 121,2 | 0,20 | 492,2 |
| 100 | 126,3 / 128 | 3,83 | 0,634 / 1,392 | 0,362 / 0,610 | 118,5 | 0,30 | 471,8 |
| 1000 | 1025,2 / 1026 | 3,80 | 4,191 / 10,757 | 2,315 / 5,203 | 162,2 | 1,12 | 501,4 |

RSS es el máximo del proceso completo, incluida la generación. Los tiempos de tick excluyen la auditoría y la transición de barrera. En la hora 24 se destruyó una compuerta real. El tiempo total de esa transición incluye cambio de grafo, proyección, comparación de totales, serialización, restauración y comparación del tick reiniciado. Las capas dispersas conservan stocks, residentes y cortes incidentes. Hace falta memoria adicional por región y puerto para poder reabrir o dividir sin perder posiciones. El escenario mayor mide 48 horas de alta actividad. Antes de adoptar otra escala habría que comparar trazas por hora y corte bajo un número todavía mayor de colonias simultáneas.

## Reproducción

```sh
npm ci
npm run check
npm run build
npm run --silent ecology:dispersal -- --case matrix --ticks 87600 --trace mansion estirpe zz
npm run --silent ecology:dispersal -- --case whole --ticks 87600 mansion estirpe zz
npm run --silent ecology:dispersal -- --case stationary --ticks 8760 estirpe mansion zz
for n in 1 10 100 1000; do
  npm run --silent ecology:dispersal -- --case load --ticks 48 --colonies "$n" mansion
done
```

Pasaron las 64 pruebas anteriores y 7 pruebas nuevas. La suite verifica producción pagada, germinación, deterioro de propágulos, movilidad por sección, ausencia de doble cruce, reserva de la última plaza, rechazo de un traslado contablemente balanceado por un conector incorrecto, cierre y reapertura, guardado y proyección. En cada ensayo se auditó por tick la contabilidad de las siete cuentas. La comparación en modo estacionario reprodujo por hora el libro ordenado y los inventarios de E1-B1 durante 8.760 horas por semilla. Se reejecutaron además los 31 ensayos históricos de E1-B1 y coincidieron las ventanas, extinciones y presupuestos de las 280.320 horas guardadas en el PR #59. El CI headless ejecuta el diagnóstico corto y las pruebas. Las simulaciones largas y las cargas se pueden reproducir por separado.
