# E1-B0 · Escalabilidad exacta de la simulación ecológica

Una hora ecológica conserva las cuatro fases de E1-A. Primero se contabilizan las fuentes, después se resuelve el transporte por cortes físicos, luego se aplican las transformaciones y pérdidas locales y finalmente se puede auditar el libro mayor. El reloj, las tasas enteras, la dirección de cada canal, el significado de `energy` y las firmas de los guardados siguen siendo los de E1-A.

## Qué trabajo se ahorra

- **Inventario y transporte.** El tick conserva el estado anterior y copia las cuentas al inventario de salida una sola vez. Los gradientes leen el estado al inicio del transporte, incluidas las entradas de superficie y acuífero. Cada propuesta debita inmediatamente el saldo disponible del donante. El crédito numérico al receptor se difiere hasta haber recorrido todos los cortes. Así, dos cortes que compiten por un saldo escaso mantienen su prioridad y una llegada nunca financia un segundo cruce dentro de la misma hora.
- **Actividad.** Un hábitat con agua, detritus o energía puede iniciar transporte. Uno que sólo contiene nutrientes secos o biomasa puede recibir de un vecino y participa de los eventos locales. Por debajo de un octavo de ocupación se ordenan sólo los índices físicos incidentes a posibles donantes. A mayor ocupación se marca un bit por corte candidato y se leen los bits en orden ascendente. Para los eventos locales se ordenan las cuentas dispersas o se recorre el rango de identificadores cuando el inventario es denso. En ambos caminos se respeta el orden por corte, canal y hábitat.
- **Compuertas.** Una compuerta fija sus dos regiones finas en hábitats individuales en todos sus estados. Una transición comparte el mapa de regiones y la incidencia con la época anterior, reemplaza el corte y recalcula la humedad de los extremos si cambia la inundación. La humedad también considera otros cortes inundados y cauces incidentes. La firma reutiliza el prefijo SHA-256 de la partición y vuelve a firmar las fronteras y los hábitats en el orden histórico. La memoria retenida para el prefijo es constante por partición.
- **Reproyección.** Si ambas épocas comparten la misma partición derivada, se copian las cuentas pobladas en el orden canónico de E1-A. Si se edita una abertura ordinaria o un interior, su elegibilidad y sus puentes pueden cambiar. Para cualquier edición distinta de una compuerta se regenera el grafo completo y se conserva el reparto entero por superposición de regiones finas. Ese reparto supone mezcla dentro del hábitat original y sólo entrega a los nuevos grupos que contienen regiones de ese hábitat. Las paredes y los conectores siguen definiendo el espacio.

## Comparación de carga

Linux x86-64, AMD EPYC 9V74, cupo de 4 CPU, límite de memoria de 32 GiB, Node 24.22.3. Cada fila ejecutó 48 horas en un proceso nuevo, con el mismo grafo Jenga y la misma permutación inicial determinista. Cada hábitat inicial recibió 160 de agua, 100 de detritus, 60 de nutrientes, 12 de biomasa y 120 de energía en un escenario cerrado. En las filas con compuerta, el primer cambio ocurre tras 16 horas (`destroyed`) y el segundo tras 32 (`flooded`). La corrida usa `--expose-gc` y ejecuta un GC antes del primer tick.

Los pares muestran **E1-A → E1-B0**. La auditoría se ejecutó en todos los ticks. La tasa sostenida incluye `step` y auditoría. La columna con épocas también carga al escenario las dos transiciones completas. Ambas tasas excluyen la generación inicial. El tiempo de pared del proceso que incluye generación, planificación del escenario, GC y verificación está en la evidencia.

| Semilla e iniciales | Activos medios / finales | Tick media / p95 (ms) | Auditoría media / p95 (ms) | RSS pico (MiB) | Heap muestreado (MiB) | CPU (s) | Horas/s auditadas | Horas/s con épocas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| estirpe 1.000 | 15.844 / 22.981 | 42 / 62 → 28 / 36 | 10 / 15 → 7 / 8 | 486 → 506 | 284 → 193 | 8,9 → 7,2 | 19,07 → 28,19 | 19,07 → 28,19 |
| estirpe 5.000 | 55.498 / 72.555 | 171 / 263 → 107 / 152 | 50 / 69 → 36 / 54 | 795 → 708 | 573 → 526 | 17,3 → 12,3 | 4,52 → 6,99 | 4,52 → 6,99 |
| estirpe 10.000 | 78.264 / 93.021 | 220 / 283 → 156 / 192 | 74 / 95 → 58 / 77 | 789 → 739 | 568 → 542 | 21,4 → 15,8 | 3,40 → 4,66 | 3,40 → 4,66 |
| estirpe 5.000 · compuerta | 55.498 / 72.555 | 129 / 177 → 99 / 147 | 46 / 65 → 39 / 55 | 1.146 → 806 | 955 → 577 | 23,7 → 14,1 | 5,71 → 7,22 | 3,09 → 6,24 |
| mansion 5.000 · compuerta | 56.230 / 73.671 | 136 / 197 → 106 / 164 | 48 / 68 → 39 / 52 | 919 → 822 | 727 → 604 | 23,6 → 14,1 | 5,42 → 6,90 | 3,05 → 6,01 |

La reducción del tiempo medio por tick fue de 22,2 % a 37,5 %. El pico de RSS observado varió según la carga.

Los tres casos sin cambios de barrera superaron la referencia orientativa del 25 % en tiempo medio. Con 1.000 iniciales el pico RSS aumentó un 4,0 %. Con compuerta, el tiempo medio por tick mejoró un 23,3 % en `estirpe` y un 22,2 % en `mansion`. En este último caso tanto la mejora del tick como la del RSS quedaron por debajo del 25 %.

| Semilla | Cambio | Transición completa (ms) |
|---|---|---:|
| estirpe | destroyed | 3.367 → 476 |
| estirpe | flooded | 3.772 → 571 |
| mansion | destroyed | 3.502 → 548 |
| mansion | flooded | 3.392 → 487 |

La transición completa incluye la actualización del grafo, la reproyección, la comparación de totales, la serialización, la restauración y la comparación de un tick reiniciado con uno continuo. Para las dos transiciones de `estirpe` se midieron estos componentes.

| Fase | Media E1-A → E1-B0 (ms) | p95 E1-A → E1-B0 (ms) |
|---|---:|---:|
| Actualización del grafo | 3.042,0 → 119,5 | 3.250,3 → 125,0 |
| Reproyección | 95,3 → 30,1 | 103,1 → 31,5 |
| Comparación de saldos | 17,2 → 17,2 | 17,5 → 18,0 |
| Serialización | 18,2 → 24,7 | 20,3 → 34,0 |
| Restauración | 39,5 → 42,1 | 40,5 → 49,7 |
| Verificación de reinicio | 357,2 → 289,7 | 373,3 → 315,3 |

El RSS es el máximo del proceso, incluida la generación inicial. El heap muestreado se toma al terminar cada tick y puede omitir picos intermedios. La CPU incluye todos los hilos del proceso. El p95 usa el rango superior por techo; para una fase con dos transiciones equivale a la mayor. Los tiempos son observaciones de una corrida por caso en una máquina compartida. GC y planificación introducen variación.

## Memoria por fase

Una segunda corrida con `--allocations` midió las asignaciones del heap V8 para `estirpe`, 5.000 iniciales y dos cambios de compuerta. El inspector muestrea cada 64 KiB en promedio e incluye objetos recolectados. Las cifras estiman volumen asignado acumulado durante las 48 horas. El muestreo y las trazas diferenciales se ejecutaron por separado de la medición de tiempos.

| Fase | MiB asignados estimados E1-A → E1-B0 |
|---|---:|
| Inventario y entradas | 1.578 → 1.198 |
| Propuestas y transporte | 3.101 → 1.398 |
| Cambios locales | 408 → 320 |
| Auditoría | 1.528 → 499 |
| Construcción inicial | 1.987 → 2.021 |
| Actualización del grafo | 3.762 → 50 |
| Reproyección | 169 → 40 |
| Serialización | 28 → 27 |
| Comparación de saldos | 24 → 21 |
| Restauración | 66 → 70 |
| Verificación de reinicio | 510 → 359 |

El volumen estimado aumentó en restauración. La muestra incluye el costo de las operaciones auxiliares y la variación del muestreo de V8.

Los registros completos incluyen media y p95 por fase, delta neto de heap, tamaño serializado, propuestas, asientos, CPU y RSS. Los deltas de heap pueden ser negativos cuando interviene el GC. [Mediciones por proceso, en JSONL](benchmarks/e1-b0.jsonl)

## Equivalencia y pruebas ejecutadas

- `npm ci`, `npm run check` y `npm run build` con Node 24. El check abarca TypeScript estricto y 54 pruebas Vitest, incluidas Jenga y ecología.
- La prueba diferencial liviana compara 36 horas individuales de tres zonas pequeñas con cero, uno y muchos hábitats iniciales. Cada huella de E1-A incluye el snapshot completo, el inventario en orden de inserción, los totales, el libro ordenado con cada conector y la auditoría. Las huellas se verificaron también con `main` en `b223980`. Los escenarios ejercitan agotamiento, cauce unidireccional, fin del aporte superficial, recarga periódica, pérdida local, guardado y reanudación, compuerta seca/inundada y partición al bloquear/reabrir un corte mezclado. En cada cambio se compara el grafo entero con la derivación completa.
- La carga manual con trazas sobre el edificio completo de `estirpe` (5.000 iniciales y dos transiciones) produjo 48 huellas idénticas a E1-A, una por hora, con 4.668.530 asientos y 72.555 hábitats finales. El reinicio en cada transición reprodujo el siguiente tick íntegro.
- `npm run --silent ecology:report -- --ticks 240 estirpe mansion zz` reprodujo los tres informes de `main` en todos los campos ecológicos. Tras 240 horas quedaron 115, 164 y 91 hábitats con saldo, respectivamente. Se compararon también alcance por canal, agotamiento, totales, procesos y contabilidad.

## Reproducción

El commit `3be72df` agrega los contadores de fase al E1-A de `b223980` y es la línea base de tiempos tomada antes de optimizar. El commit `c309b2d` agrega al mismo motor los modos opcionales de trazas y asignaciones. Se puede obtener una copia de esa referencia con `git worktree add --detach ../e1a-perfil c309b2d`. Desde cada revisión, con Node 24, ejecutá los casos sucesivamente.

```bash
npm ci
for n in 1000 5000 10000; do
  npm run --silent ecology:load -- --seed estirpe --active "$n" --ticks 48
done
for seed in estirpe mansion; do
  npm run --silent ecology:load -- --seed "$seed" --active 5000 --ticks 48 --barriers
done
npm run --silent ecology:load -- --active 5000 --ticks 48 --barriers --allocations
npm run --silent ecology:load -- --active 5000 --ticks 48 --barriers --trace
```

Para verificar una carga con trazas, compará el arreglo `frames` entre revisiones. Cada elemento firma el snapshot JSON y el libro completo al terminar esa hora. Los perfiles grandes quedan como comandos manuales. El CI ejecuta la regresión diferencial pequeña con Vitest.

## Límites y paso hacia E1-B1

El libro detallado todavía requiere una entrada por flujo realizado y la auditoría lo recorre entero. Una ocupación alta sigue costando trabajo proporcional a las cuentas y los cortes candidatos. Cada compuerta evita regenerar Jenga, aunque firmar la época sigue costando un recorrido lineal del grafo ecológico. Para aberturas que alteran la partición queda el costo y el pico de memoria de la reconstrucción completa.

E1-B1 puede partir del mismo reloj y del mismo libro mayor para representar ciclos de descomponedores y hongos. Los aportes profundos requerirán una fuente declarada, tasa, calendario y conector físico verificable. Una segunda escala sólo sería exacta si permite saltar un intervalo hasta el próximo evento demostrando que ningún saldo, gradiente, entrada o pérdida puede cambiar entretanto. La equivalencia deberá verificarse por tick y por conector con estas mismas trazas antes de introducir ese mecanismo.
