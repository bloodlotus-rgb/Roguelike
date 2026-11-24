# E1-B1 · Viabilidad de una colonia inmóvil

Con las tasas metabólicas de E1-B1 y una cuenca orgánica de suministro continuo, hongos y detritívoros coexistieron durante **8.760 horas consecutivas** en dos edificios, `mansion` y `zz`. En ambos, el depósito fundador en la cabecera del cauce creció de 4 unidades fúngicas y 2 detritívoros a 26 y 10. En `estirpe`, con el mismo tratamiento, los detritívoros se extinguieron en la hora 324 por falta de detritos locales. La viabilidad depende tanto del sitio como del aporte.

## Diagnóstico del aporte periódico original

La cuota histórica es de 4.096 lotes. Los fundadores están en el extremo receptor. El inventario justo antes del mantenimiento permite distinguir la causa de muerte del destino posterior de los restos.

| Semilla y grupo | Hora de extinción | Disponibilidad en la colonia antes de alimentarse | Recurso limitante y destino |
|---|---:|---|---|
| `estirpe` · detritívoros | 12 | 31 agua, 19 detritos, 0 energía | Faltaron 2 de energía. Al cierre había 18 fuera del sitio, incluidas 6 en la cabecera. |
| `estirpe` · hongos | 6.264 | 2.837 agua, 0 detritos, 1 energía | Faltó 1 detrito. La cuota se había agotado en la hora 6.136. Todavía quedaban 1.983 detritos fuera de la colonia. |
| `mansion` · ambos | 12 | 24 agua y 0 energía para ambos. Los hongos encontraron 16 detritos y los animales 22 tras la muerte fúngica. | Faltaron 2 de energía para cada grupo. Había 20 fuera, de los cuales 1 estaba en la cabecera. |
| `zz` · ambos | 12 | 6 agua y 0 energía. Los hongos encontraron 5 detritos y los animales 13. | Faltaron 2 de energía para los hongos y 1 para los detritívoros. Quedaban 20 fuera. |

El cauce admite como máximo **1 crédito de energía por hora** hacia el extremo receptor. Los gradientes y los otros cortes determinan la entrega efectiva. Hasta la hora 12, la colonia de `mansion` había importado 3 créditos y exportado 7 por sus cortes. Los 20 créditos fundadores y el intercambio neto de −4 dejaron 16 disponibles. La colonia disipó 9 en mineralización, 4 en mantenimiento y 3 en crecimiento y nacimientos. Agregar lotes en la cabecera aumenta el presupuesto del edificio, pero la entrega sigue limitada por los cortes. En el ensayo de mayor suministro en la salida, los detritívoros también murieron en la hora 12 en las tres semillas.

**El agua también puede ser limitante.** Al bajar el suministro continuo de la cabecera de 6 a 3 lotes/hora en `mansion`, ambos grupos murieron en la hora 6. Antes del mantenimiento fúngico había 23 detritos, 18 de energía y cero agua en el sitio. Al cierre de esa hora había 82 de agua fuera. Los organismos inmóviles sólo pueden gastar saldos locales. El ensayo con agua subterránea conserva el mismo volumen de agua del control, pero agota el alimento o la energía fundadores.

## Control de suficiencia y conservación

Se usó el mismo cauce Jenga en cada par de ensayos. El depósito histórico de sedimentos y sus organismos puede quedar retenido en la región de entrada o en la de salida. La cabecera ya era el sitio de entrega de la cuenca en E1-B1. La elección se hace una sola vez al fundar la colonia. Las cargas posteriores sólo traen agua, detritos y energía. En las variantes se mantienen idénticos los fundadores, los precios metabólicos de referencia y la permeabilidad de cada corte, salvo el período de mantenimiento en los dos ensayos que lo estudian expresamente.

La tasa de **6 lotes/hora** se fijó con un presupuesto local de prueba. En la cabecera de `mansion`, un cauce y dos aberturas admiten una salida máxima conjunta por hora de 16 de agua, 6 de detritos y 5 de energía. Para la cohorte inicial, una hora con mantenimiento de ambos grupos, mineralización, crecimiento y un nacimiento puede demandar hasta 5 detritos y 6 de energía, con agua presente. Seis lotes aportan 24 de agua, 12 detritos accesibles tras la sedimentación y 12 de energía. Ese caudal cubre el caso inicial incluso con la salida máxima. La simulación mide qué ocurre al crecer hasta la capacidad del sitio. La cuota externa se limita a **52.560 lotes**, un año de entregas continuas. Es una condición experimental de cuenca abundante, pendiente de medir o calibrar para el mundo del juego.

El balance anual de `mansion` incluye el depósito inicial.

| Cuenta | Entradas brutas | Salidas físicas | Stock final y destino |
|---|---:|---:|---|
| Agua | 210.264 | 42.209 evaporadas | 68.644 en la colonia y 99.411 fuera |
| Materia | 157.718 | 52.560 sedimentadas | 78.875 detritos, 26.247 nutrientes, 26 de tejido fúngico y 10 detritívoros |
| Energía | 105.140 | 26.283 disipadas | 35.057 en el sitio y 43.800 repartidas en otros 580 hábitats |

El gasto energético fue de 8.760 en mineralización, 10.205 en mantenimiento fúngico, 7.291 en mantenimiento animal, 11 en crecimiento y 16 en nacimientos. Cada hora se auditaron las cuentas del edificio y, por separado, la igualdad local entre fuentes, conversiones, entradas y salidas por cortes, sumideros y saldo final.

## Sensibilidad

Cada celda indica **biomasa fúngica / individuos vivos en la hora 8.760**. Una extinción es irreversible en estos escenarios sin inmigración. El diagnóstico también guarda mínimos y máximos desde la fundación para distinguir coexistencia continua de un saldo final aislado.

| Ensayo | `estirpe` | `mansion` | `zz` |
|---|---:|---:|---:|
| Histórico, sólo depósito fundador | 0 / 0 | 0 / 0 | 0 / 0 |
| Histórico, cuota de 6 lotes | 0 / 0 | 0 / 0 | 0 / 0 |
| Histórico, aporte periódico | 0 / 0 | 0 / 0 | 0 / 0 |
| Control, cabecera continua | 180 / 0 | 26 / 10 | 26 / 10 |
| Mismo suministro, depósito en la salida | 24 / 0 | 4 / 0 | 4 / 0 |
| Mitad de la tasa, 3 lotes/hora | 0 / 0 | 0 / 0 | 0 / 0 |
| Mismos lotes anuales, 18/h durante 4 de cada 12 h | 178 / 0 | 26 / 10 | 26 / 10 |
| Mantenimiento cada 3 h | 90 / 0 | 26 / 10 | 26 / 10 |
| Mantenimiento cada 12 h | 308 / 16 | 26 / 10 | 26 / 10 |
| Sólo agua subterránea, misma tasa que el control | 0 / 0 | 0 / 0 | 0 / 0 |

En `estirpe` la capacidad de la cabecera es 324, frente a 36 en `mansion`. Al crecer la colonia aumentan las raciones demandadas y los hongos tienen prioridad en el mantenimiento. Concentrar los mismos lotes en pulsos retrasó la extinción animal de la hora 324 a la 1.272. Duplicar la frecuencia de mantenimiento la adelantó a la hora 144. Reducirla a la mitad permitió coexistencia en esta semilla. En `mansion` y `zz` se alcanzó coexistencia con la frecuencia original de 6 horas. Cambiar de extremo también cambia la capacidad y los vecinos físicos del sitio. Los saldos antes de comer y los flujos por conector permiten interpretar ese efecto combinado.

Al extender el control de `mansion` a **17.520 horas**, la cuenca dejó de entregar al agotarse la cuota en la hora 8.760. Ambas poblaciones permanecieron vivas todo el segundo año. Al final quedaban 8 unidades fúngicas y 5 detritívoros, con 1 agua y 39 de energía en su hábitat. Durante ese año los organismos dependieron de las reservas y de los flujos internos del edificio. La caída desde 26 y 10 limita la interpretación del primer año como equilibrio.

## Reproducir y leer la evidencia

```sh
npm ci
npm run check
npm run build
npm run --silent ecology:trophic -- --scenario matrix --ticks 8760 estirpe mansion zz
npm run --silent ecology:trophic -- --scenario control --ticks 17520 mansion
npm run --silent ecology:report -- --ticks 240 estirpe mansion zz
```

El informe JSONL guarda una línea por semilla y ensayo. En cada extinción se reconstruye el inventario en el orden real del libro hasta la primera operación de mantenimiento del grupo. `rations` contiene disponibilidades, necesidades y déficits simultáneos de agua, detritos y energía. `closing` ubica el stock al terminar esa hora en el sitio, en la cabecera y fuera de la colonia. La cabecera ya está incluida en el total espacial correspondiente. `energySpent` separa la disipación acumulada por proceso. En cada ventana, `colony.cuts` desglosa las entradas y salidas acumuladas por conector. El tráfico puede contar varias veces una unidad que cruza varios cortes. [Mediciones completas de los ensayos](benchmarks/e1-b1-viabilidad.jsonl)

Las 64 pruebas de Vitest cubren, entre otros casos, coescasez, reciclado de cadáveres antes de alimentar al segundo grupo, agotamiento de la cuota y un año auditado en el canal pequeño de prueba. Los experimentos de la tabla usan edificios completos de Jenga. Se conservó la firma original para los guardados históricos y se firman el depósito en cabecera y las variantes metabólicas. Se reprodujeron las nueve combinaciones históricas de semilla y escenario sobre el commit inicial del PR.

Estas mediciones demuestran suficiencia en dos sitios bajo una cuenca declarada. La capacidad de almacenar excedentes, la energía transportada como cuenta separada, la ausencia de recolonización y la prioridad del mantenimiento limitan cualquier extrapolación a un ecosistema autosostenido. La frecuencia experimental de 3 o 12 horas sólo se aplica cuando el escenario la pide.
