# E1-B1 · Hongos y detritívoros en un cauce subterráneo

El laboratorio parte de un depósito fundador finito y sigue sus organismos y recursos hora por hora. Cada asiento identifica el hábitat, el proceso, el recurso y la cantidad. Los ingresos externos y los traslados entre hábitats también identifican el corte físico. E1-B1 reemplaza el crecimiento automático en su propio escenario. Los escenarios E1-A y E1-B0 se pueden volver a ejecutar con sus reglas y guardados originales.

El ensayo histórico descrito aquí funda la colonia aguas abajo. La revisión del PR #59 compara ambos extremos y sigue los saldos hasta cada extinción. [Viabilidad y sensibilidad](ecologia-e1-b1-viabilidad.md)

## Cuenca, condiciones iniciales y aportes

Para montar un escenario se declara la semilla del edificio, la cuenca exterior, la región fina aguas arriba y el ID de un cauce Jenga dirigido. El generador del ensayo elige el primer cauce en orden canónico cuya cabecera queda en una zona profunda. La existencia y la dirección del corte se verifican en el edificio. La conexión de esa cabecera con una cuenca externa y el material que trae son condiciones declaradas del experimento. Jenga no genera la cuenca exterior.

El depósito histórico representa sedimentos húmedos con micelio e invertebrados arrastrados antes de la hora cero hasta el extremo aguas abajo. El ensayo registra **24 de agua, 30 de detritos, 2 de nutrientes, 20 de energía utilizable, 4 de tejido fúngico y 2 detritívoros** en el libro inicial. La capacidad del sitio debe admitirlos y el corte debe estar abierto al depósito. Con un depósito estéril no hay colonización posterior. Los organismos permanecen en su sitio durante toda la simulación.

| Carga por lote | Agua | Detritos brutos | Energía aprovechable | Pérdida en la boca |
|---|---:|---:|---:|---|
| Agua subterránea | 4 | 0 | 0 | 0 |
| Sedimento orgánico húmedo | 4 | 3 | 2 | 1 detrito queda enterrado fuera del inventario accesible |

La cuenca entrega el lote en la cabecera del corte. Los créditos de energía del sedimento corresponden a su materia orgánica entrante. Con el modelo E1-A, una vez ingresados, los cuatro canales de agua, detritos, nutrientes y energía tienen sus propios caudales. Seguir la energía unida a cada partícula requeriría otro contrato de transporte. La sedimentación figura como sumidero en el mismo hábitat y con el mismo conector. El agua subterránea sola admite un ensayo sin entrada energética.

El calendario cuenta desde la hora cero. Durante las primeras `activeHours` de cada `period` se pueden importar hasta `rate` lotes por hora, con una cuota total `quota`. Un bloqueo o cierre suspende el aporte y el transporte por el cauce. La cuota sólo se consume al recibir el lote y el calendario sigue avanzando. El ensayo cerrado tiene sólo el depósito inicial. El finito admite 6 lotes y el periódico admite 4.096. Ambos admiten hasta 2 lotes por hora en las primeras 4 de cada 12 horas. Raíces profundas requerirían una conexión radicular identificada. Una reacción geoquímica requeriría donante, aceptor, productos y rendimiento energético cuantificado.

## Cuentas y reglas provisionales

La materia total es la suma de detritos, nutrientes, tejido fúngico y detritívoros. Cada detritívoro cuenta como una unidad indivisible de tejido vivo. No se guarda una segunda cuenta para su peso. La biomasa fúngica mide tejido, sin convertirlo en un conteo de hongos individuales. Ambas poblaciones comparten la capacidad física local de E1-A.

Cada hora primero ingresa la carga y luego se ejecuta el transporte exacto de E1-B0. Las cuentas locales se procesan en orden de hábitat.

1. Cada 6 horas se mantiene primero el tejido fúngico y luego la población de detritívoros. Con agua local, una ración consume 1 detrito y 1 energía, devuelve 1 nutriente y sostiene hasta 4 unidades fúngicas o 2 detritívoros. El tejido que queda sin cubrir muere y retorna íntegro como detrito local. La pérdida de materia en la muerte se fija en cero. El libro identifica el primer limitante entre agua, energía y alimento para explicar empates.
2. Con tejido fúngico y agua, la mineralización consume hasta 1 detrito y 1 energía por hora y devuelve 1 nutriente. Cada 3 horas el crecimiento puede convertir 1 detrito y 1 nutriente en 2 de tejido por 1 energía adicional, si hay espacio.
3. Cada 4 horas, con al menos un detritívoro vivo, agua y una plaza libre, puede nacer un individuo a partir de 1 detrito y 2 de energía. La población de cada período debe igualar fundadores más nacimientos menos muertes.
4. Cada 6 horas se evapora 1 agua por hábitat con agua. La energía gastada sale como disipación. Los hábitats vacíos quedan fuera del inventario. Una llegada puede activar un hábitat por sus recursos, mientras que el crecimiento necesita organismos locales previos.

Las tasas son enteras y están centralizadas con el catálogo de cargas. El orden da prioridad a los hongos ante escasez. Un saldo global de energía positivo puede coexistir con extinción si la energía queda en otros hábitats o llega después de la mortalidad.

## Persistencia y barreras

`foundColony` devuelve el estado y los asientos iniciales. `stepTrophic` avanza una hora. `auditTrophic` reproduce los asientos sobre el inventario anterior y concilia agua, energía y materia. El diagnóstico reconcilia además las entradas, salidas y conversiones acumuladas para cada cuenta en cada ventana.

```ts
const saved = saveColony(graph, state);
const rebuilt = buildHabitatGraph(saved.setup.seed, new Map(saved.barriers));
const resumed = restoreColony(rebuilt, JSON.parse(JSON.stringify(saved)));
const next = stepTrophic(rebuilt, resumed);
```

El formato `E1-B1/1` conserva el contrato de reglas, permeabilidades, tasas, depósito, cuenca y calendario, además de la firma espacial, las barreras, el reloj, los lotes usados y las seis cuentas por hábitat. La restauración comprueba el presupuesto físico y temporal, y que los organismos pertenezcan al sitio fundador. Para aplicar una barrera se genera la nueva época con `updateBarrier` y se usa `projectColony` antes del siguiente tick. La reproyección conserva las unidades enteras según la superposición de regiones físicas. El extremo de un cauce es un hábitat fijo en Jenga. Un guardado histórico E1-A carece del origen, las cohortes y la cuota que permitirían convertirlo fielmente a E1-B1.

## Resultados

Las ventanas de 48, 240 y 8.760 horas se auditaron en edificios completos. Con los depósitos cerrados y los seis lotes finitos, ambas semillas perdieron las dos poblaciones antes de terminar la ventana de 48 horas. Con aportes periódicos, `estirpe` conservaba 4 unidades fúngicas a las 48 y a las 240 horas. En `mansion` ya había perdido ambas poblaciones a las 48 horas. Allí el libro atribuye la mortalidad al déficit energético local. En cada ensayo anual hubo 2 detritívoros fundadores, 1 nacimiento y 3 muertes.

Con los 4.096 lotes entregados quedan exactamente **8.230 unidades de materia** en cada escenario periódico anual. Las 38 iniciales más 12.288 de detritos importados, menos 4.096 sedimentados, cierran el balance. En `estirpe` quedaron 1.987 como detritos y 6.243 como nutrientes. En `mansion` quedaron 8.216 y 14, respectivamente. Ambos terminaron sin biomasa viva.

| Semilla | Ensayo | Horas | Activos media / pico | Tick medio / p95 (µs) | Auditoría media (µs) | CPU del bucle (ms) | RSS pico (MiB) |
|---|---|---:|---:|---:|---:|---:|---:|
| estirpe | Cerrado | 8760 | 10,0 / 10 | 7,9 / 14,2 | 5,8 | 343 | 486 |
| estirpe | Finito | 8760 | 13,0 / 13 | 12,5 / 16,0 | 4,4 | 417 | 501 |
| estirpe | Periódico | 8760 | 52,1 / 54 | 29,9 / 54,0 | 14,7 | 630 | 507 |
| mansion | Cerrado | 8760 | 8,0 / 8 | 10,4 / 12,8 | 3,0 | 325 | 487 |
| mansion | Finito | 8760 | 19,0 / 19 | 13,8 / 17,4 | 4,5 | 267 | 492 |
| mansion | Periódico | 8760 | 277,8 / 401 | 198,8 / 330,9 | 73,5 | 2593 | 470 |
| estirpe | Periódico | 87600 | 52,9 / 54 | 24,1 / 31,9 | 9,7 | 3267 | 482 |

Node 24.22.3 en Linux x86-64. Cada fila se midió en un proceso nuevo con 4 CPU de cuota. La CPU incluye simulación, auditoría y diagnóstico del bucle. El RSS pico incluye la generación del edificio. Los tiempos por tick separan simulación y auditoría. «Activos» cuenta hábitats con cualquier saldo e incluye sitios sin organismos. Las cifras proceden de una corrida por caso. [Resultados por ventana, balance, mortalidad y métricas en JSONL](benchmarks/e1-b1.jsonl)

## Reproducción y alcance de la evidencia

```bash
npm ci
npm run check
npm run build
for seed in estirpe mansion; do
  for scenario in closed finite periodic; do
    npm run --silent ecology:trophic -- --ticks 8760 --scenario "$scenario" "$seed"
  done
done
npm run --silent ecology:trophic -- --ticks 87600 --scenario periodic estirpe
```

Pasaron 61 pruebas Vitest, TypeScript estricto y el build. La suite incluye bloqueo y reapertura durante una entrega, guardado y reanudación, cupo parcial y agotado, agua sin energía, falta de alimento, capacidad saturada, sitio estéril, corrupción de guardados y contabilidad de la muerte. La prueba de integración reutiliza tres edificios Jenga y verifica el conector y el número de hábitats con stock a las 48 horas según la semilla. Aparte se ejecutó `ecology:report` durante 240 horas en tres semillas y `ecology:load -- --active 5000 --ticks 48 --barriers --trace` en `estirpe`. Las 48 huellas de esta corrida coincidieron con la referencia E1-B0, incluidos 4.668.530 asientos.

El ensayo a diez años de `estirpe` termina con los mismos stocks que al año. La cuota es finita y una colonia extinta no tiene vía de recolonización en este modelo inmóvil. Eso permite verificar el agotamiento y la contabilidad durante 87.600 horas. Para evaluar viabilidad de largo plazo falta calibrar el aporte real por cuenca, la retención y la disipación de energía, las tasas por especie y la sensibilidad a la prioridad de mantenimiento. Las dos semillas y el bajo número de colonias fundadoras limitan la extrapolación del rendimiento a miles de colonias vivas simultáneas.
