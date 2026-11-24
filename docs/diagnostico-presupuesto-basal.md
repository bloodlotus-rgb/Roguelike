# D0 · Productividad basal y acceso local al alimento

**El receptor fue un sumidero de presas en los seis escenarios poblados.** De 8.286 oportunidades individuales de alimentación, 7.661 terminaron en ingesta, 624 en muerte por falta de hongo local y una en muerte por falta de energía. En las 624 había tejido fúngico en alguna parte del edificio o recinto. El crecimiento depende de qué queda en el hábitat después del mantenimiento y la mineralización. La supervivencia de la presa depende de qué queda cuando le toca comer. [Encargo #72](https://github.com/bloodlotus-rgb/Roguelike/issues/72) · [Contrato biológico #71](https://github.com/bloodlotus-rgb/Roguelike/issues/71)

## Resultado de las 12 trayectorias

Cada fila cubre 8.760 horas. La columna de tejido indica **crecimiento + germinación / pérdidas de tejido establecido**. Las pérdidas comprenden mortalidad de mantenimiento, tejido comido para alimentación o nacimiento de presas y tejido convertido en propágulos. La germinación y la propagación reclasifican materia existente. En las últimas columnas, el saldo propio es nacimientos menos muertes propias. Las migraciones se cuentan aparte.

| Semilla | Espacio | Presas iniciales | Tejido origen, G+Ge/P | Tejido receptor, G+Ge/P | Saldo propio origen | Saldo propio receptor (N−M) | Ingresos/salidas de presas en receptor |
|---|---|---:|---|---|---:|---|---|
| mansion | recinto | 0 | 24+0/2 | 4+1/1 | +0 | +0 (0−0) | 0/0 |
| mansion | recinto | 6 | 110+0/114 | 70+16/86 | +1 | -7 (5−12) | 7/0 |
| mansion | edificio | 0 | 26+0/3 | 0+1/0 | +0 | +0 (0−0) | 0/0 |
| mansion | edificio | 6 | 330+0/334 | 88+42/130 | +25 | -30 (0−30) | 30/0 |
| estirpe | recinto | 0 | 5832+0/5682 | 2920+1/2915 | +0 | +0 (0−0) | 0/0 |
| estirpe | recinto | 6 | 4800+0/4661 | 624+460/1083 | +182 | -185 (6−191) | 186/0 |
| estirpe | edificio | 0 | 5832+0/5690 | 4+1/1 | +0 | +0 (0−0) | 0/0 |
| estirpe | edificio | 6 | 3350+0/3217 | 1980+305/2284 | +182 | -181 (171−352) | 184/0 |
| zz | recinto | 0 | 24+0/2 | 4+1/1 | +0 | +0 (0−0) | 0/0 |
| zz | recinto | 6 | 110+0/114 | 70+16/86 | +1 | -7 (5−12) | 7/0 |
| zz | edificio | 0 | 24+0/2 | 2+1/0 | +0 | +0 (0−0) | 0/0 |
| zz | edificio | 6 | 118+0/122 | 46+17/63 | +6 | -12 (2−14) | 12/0 |

## Dos mecanismos observados

1. **El detrito llega al receptor, pero suele agotarse antes del crecimiento.** En el edificio `estirpe` sin presas, el origen produjo 5.832 unidades por crecimiento y el receptor produjo 4. El receptor recibió por transporte 8.764 de detrito, 17.521 de agua y 26.430 de energía durante el año. En 2.916 de las 2.920 oportunidades de crecimiento, sólo faltó detrito en ese instante. A la hora 21 había micelio y energía y la mineralización consumió la única unidad local de detrito. Con seis presas, el receptor creció 1.980 unidades. En 1.635 oportunidades siguió faltando únicamente detrito y en 293 faltó únicamente micelio. En 937 de esas 1.635, todos los insumos de crecimiento estaban presentes inmediatamente antes de mineralizar. La limitación depende del lugar. En el origen de `mansion` sin presas, sólo el espacio bloqueó 2.907 oportunidades en el edificio. El transporte redistribuye el aporte y la contabilidad conserva las transferencias por corte. Estos datos no permiten atribuir el déficit a una pérdida global por «dilución».
2. **Tener una ruta hacia el hongo o recibir un propágulo después de la comida no cubre la ración local.** De las 624 comidas fallidas por falta de tejido, en 598 había hongo en otro hábitat alcanzable por una presa y en 26 sólo fuera de su red transitable. En 251 volvió a aparecer tejido local después de la comida en la misma hora, en 344 durante las 12 horas siguientes y en 29 nunca más durante el año. Son oportunidades individuales y varias pueden compartir la misma llegada. En el receptor del edificio `estirpe`, a la hora 36 comieron dos de tres presas. La tercera encontró 6 de agua, 6 de energía y cero hongo local, aunque había 16 unidades alcanzables y 19 en el edificio. Después de la muerte llegó un propágulo por un corte físico y germinó. En el cuarto trimestre ese receptor registró 46 nacimientos, 90 muertes y 45 inmigraciones. Su censo aumentó en uno pese a un saldo propio de −44.

En el edificio `estirpe` con seis presas, las 2.285 unidades que ingresaron en la cuenta de tejido del receptor se repartieron entre 222 de mortalidad, 1.721 consumidas por las presas, 341 destinadas a propágulos y una en pie al cierre. En el origen las cifras correspondientes fueron 117, 2.784 y 316, con 137 en pie incluidos los cuatro fundadores. Las causas locales de una comida fallida y de un crecimiento fallido se midieron por separado.

## Una hipótesis para una futura prueba

**Dar prioridad al crecimiento frente a la mineralización únicamente en una oportunidad programada donde ambas compiten por el último detrito y el micelio ya dispone de nutrientes, energía, agua y espacio.** La predicción es más tejido disponible *antes* de las comidas y un saldo propio de presas menos negativo en el receptor. Las 937 oportunidades observadas identifican competencia por el sustrato. La respuesta posterior de la red sigue abierta.

Una eventual prueba emparejada debería repetir estas mismas condiciones y medir hambre local, saldo propio en el cuarto trimestre y saldo conjunto de origen y receptor. Descartar la hipótesis si sólo sube el crecimiento bruto, si la mejora depende de inmigración adicional o si el déficit se traslada al origen. El riesgo contable es gastar el mismo detrito o energía dos veces, o anticipar nutrientes todavía sin producir. Correspondería exigir libro exacto por hora y corte, límites de capacidad, determinismo, reanudación y un control de escasez. La hipótesis quedó sin implementar.

## Evidencia y reproducción

Las regiones finas de origen → receptor fueron `10/194/3 → 10/221/3` en `mansion`, `1/252/3 → 1/140/3` en `estirpe` y `13/1201/3 → 13/668/3` en `zz`. Se usaron los puertos y las barreras originales de cada espacio, seis presas sólo en el origen del tratamiento poblado y cero cazadores. Por escenario, una cuenca aportó 6 lotes por hora hasta la hora 8.760, cuando agotó los 52.560 lotes. Entraron 210.240 de agua, 157.680 de detrito bruto y 105.120 de energía. Sedimentaron 52.560 de detrito en la entrada. Las cantidades son unidades abstractas del libro. El año observado con esa cuota finita no establece sostenibilidad multianual.

Las 105.120 horas principales se auditaron por cuenta y hábitat, con capacidad regional, censo y flujos físicos. Dos ejecuciones independientes por tratamiento reprodujeron la firma de geometría y contrato, los registros horarios, los estados y el cierre anual. También se reanudó a la hora 48 y se cotejó el libro hasta la hora 8.760 y el guardado final. Pasaron las 73 pruebas de `npm run check` y `npm run build` en el entorno local. No se verificó esta corrida en CI remota. El despliegue legado de Workers es independiente de estas mediciones.

Con Node 24.22.3 y Python 3.12, desde la rama del experimento:

```sh
npm ci
npm run check
npm run build
out=$(mktemp -d)
for seed in mansion estirpe zz; do
  node scripts/basal-budget/observe.mjs "$seed" "$out" || exit 1
done
diff -qr docs/benchmarks/e1-presupuesto-basal "$out"
for file in "$out"/*.json.gz; do
  python3 scripts/basal-budget/analyze.py "$file" "$out/tablas" || exit 1
done
```

Cada archivo contiene su entrada física, geometría, rutas de recursos desde el origen, rutas de presa, fundadores y libro horario ordenado. El analizador exporta ventanas de 12, 48, 72 y 2.190 horas con flujos, existencias finales y anclajes finos, además de los saldos antes y después del mantenimiento y de cada comida individual. Los recursos móviles se mezclan por hábitat en esta base. Las regiones finas identifican residencia, capacidad y tejido anclado. Para totalizar un período se elige una sola anchura y se cuenta una sola cara de cada conversión o cruce. [Trazas de las 12 trayectorias](benchmarks/e1-presupuesto-basal/) · [Scripts de observación y análisis](../scripts/basal-budget/)
