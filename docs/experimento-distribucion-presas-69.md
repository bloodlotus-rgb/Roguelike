# ¿Alimenta mejor a los cazadores repartir las seis presas?

**Descartar el reparto 3+3 como patrón de inicialización para abastecer a los cazadores en estos escenarios.** En los seis pares con cazadores, 3+3 sostuvo las mismas capturas en los tres recintos y menos en los tres edificios. Los nacimientos de presas bajaron de 15 a 7 y las capturas de 28 a 22. El receptor tuvo producción neta anual negativa en las 24 trayectorias. Se compararon 12 pares deterministas durante 8.760 horas sobre el commit `477185fe247669a07e83316a86932ab73e6b7518`. [Issue #69](https://github.com/bloodlotus-rgb/Roguelike/issues/69)

## Suministro, acceso y reproducción

| Seis escenarios con dos cazadores por reparto | 6+0 | 3+3 |
|---|---:|---:|
| Nacimientos de presas / muertes propias / capturas | 15 / 22 / 28 | 7 / 20 / 22 |
| Producción neta anual sumada en origen / receptor | +11 / −18 | +7 / −20 |
| Oportunidades individuales de alimentación cada 72 h | 40 | 34 |
| Con presa en un hábitat alcanzable / en el propio | 31 / 28 | 25 / 22 |
| Con algún nacimiento local en las 72 h previas, incluida la hora de la comida | 13 | 6 |
| Horas con dos hábitats accesibles de producción neta simultáneamente positiva | 4 | 0 |
| Ventanas de 48 h / 72 h con dos hábitats accesibles de producción neta positiva | 0 / 0 | 0 / 0 |
| Nacimientos de cazadores / muertes por falta de presa local | 0 / 12 | 0 / 12 |

En ambos repartos hubo tres comidas fallidas aunque quedaba una presa alcanzable por la red física. En las otras nueve muertes por tratamiento ya no quedaban presas residentes disponibles en ningún hábitat durante la comida. Hubo 24 horas de pareja de cazadores en cada corrida con dos fundadores. A la hora 240 sólo el recinto de `estirpe` conservaba dos cazadores con ambos repartos, y el edificio de `estirpe` conservaba dos con 6+0. En los tres casos estaban separados. A la hora 480 ya se habían extinguido todos. A las horas 2.190, 6.570 y 8.760 el censo seguía en cero.

La diferencia más grande ocurrió en el edificio de `estirpe`. Con cazadores, 3+3 redujo los nacimientos de presas de 6 a 1 y las capturas de 7 a 3. La extinción de presas se adelantó de la hora 288 a la 144. Sin cazadores, el mismo receptor tuvo 171 nacimientos, 352 muertes propias y 184 inmigraciones con 6+0. Con 3+3 tuvo 170 nacimientos, 351 muertes propias y 181 inmigraciones. Su déficit fue de 181 presas en ambos casos. Las tres fundadoras en el receptor sustituyeron tres inmigraciones durante el año.

También hubo efectos favorables puntuales sin cazadores. En los recintos de `mansion` y `zz`, 3+3 prolongó 60 horas la presencia de presas, con diez nacimientos y extinción bajo ambos repartos. En el recinto de `estirpe` quedó una pareja adicional al cierre, con 46 nacimientos en el último trimestre en ambos casos. Sumando todos los controles sin cazadores, los nacimientos del último trimestre fueron 138 por reparto, todos en `estirpe`. En el edificio de `mansion`, 3+3 dejó tres presas vivas al cierre, en regiones sin pareja y sin un solo nacimiento en todo el año. Con cazadores, ambos repartos terminaron con una presa sola en el edificio de `mansion` y cero en los otros cinco escenarios.

Las recolonizaciones fueron breves excepciones. Con 6+0 se repobló el receptor de los edificios de `estirpe` (hora 150) y `zz` (78). Con 3+3 se repobló el receptor de los recintos de `mansion` y `zz` (78). Las cuatro recolonizaciones siguieron a seis horas de ausencia y ocurrieron con cazadores. La evidencia alcanza para descartar el beneficio sostenido en estos puentes y semillas. Los censos agregados carecen de edad y linaje, así que no identifican descendientes reproductores ni demuestran equilibrio estacionario.

## Los 24 escenarios

Se usó el recinto original con el puente abierto y el edificio completo original de la misma semilla. Cada fila de la tabla anual usa las dos regiones físicas de su semilla. En 6+0 las seis presas ingresan por el origen. En 3+3 ingresan tres por cada extremo. Cuando hay cazadores, ambos ingresan por el origen. La API original validó procedencia, puerto, sección compatible y capacidad.

| Semilla | Región de origen | Región receptora | Puente Jenga | Hábitats origen → receptor, recinto / edificio |
|---|---|---|---|---|
| mansion | 10/194/3 | 10/221/3 | 10/55/31/3/2 | 2390 → 2744 / 2390 → 2744 |
| estirpe | 1/252/3 | 1/140/3 | 1/20/2/3/2 | 798 → 685 / 796 → 685 |
| zz | 13/1201/3 | 13/668/3 | 13/32/14/3/1 | 9447 → 11365 / 9447 → 11365 |

En la tabla, N/M son nacimientos y muertes propias de presas. El neto O/R es la producción anual de origen y receptor. T4 son nacimientos en las horas 6.571–8.760. «Final» cuenta presas vivas y parejas en la misma región fina. El guion indica que quedó al menos una presa viva al finalizar el año.

| Semilla | Espacio | Cazadores | Reparto | N/M | Neto O/R | Capturas | Final, presas/parejas | T4 | Extinción global de presas (h) |
|---|---|---:|---|---|---|---:|---|---:|---:|
| mansion | recinto | 0 | 6+0 | 10/16 | +1/-7 | 0 | 0/0 | 0 | 300 |
| mansion | recinto | 0 | 3+3 | 10/16 | +2/-8 | 0 | 0/0 | 0 | 360 |
| mansion | recinto | 2 | 6+0 | 2/4 | +1/-3 | 4 | 0/0 | 0 | 144 |
| mansion | recinto | 2 | 3+3 | 1/3 | +1/-3 | 4 | 0/0 | 0 | 144 |
| mansion | edificio | 0 | 6+0 | 27/33 | +25/-30 | 0 | 0/0 | 0 | 1320 |
| mansion | edificio | 0 | 3+3 | 0/3 | +0/-3 | 0 | 3/0 | 0 | — |
| mansion | edificio | 2 | 6+0 | 1/3 | +1/-3 | 3 | 1/0 | 0 | — |
| mansion | edificio | 2 | 3+3 | 0/3 | +0/-3 | 2 | 1/0 | 0 | — |
| estirpe | recinto | 0 | 6+0 | 188/191 | +182/-185 | 0 | 3/1 | 46 | — |
| estirpe | recinto | 0 | 3+3 | 191/193 | +182/-184 | 0 | 4/2 | 46 | — |
| estirpe | recinto | 2 | 6+0 | 3/3 | +3/-3 | 6 | 0/0 | 0 | 216 |
| estirpe | recinto | 2 | 3+3 | 3/3 | +3/-3 | 6 | 0/0 | 0 | 216 |
| estirpe | edificio | 0 | 6+0 | 353/352 | +182/-181 | 0 | 7/3 | 92 | — |
| estirpe | edificio | 0 | 3+3 | 352/351 | +182/-181 | 0 | 7/3 | 92 | — |
| estirpe | edificio | 2 | 6+0 | 6/5 | +4/-3 | 7 | 0/0 | 0 | 288 |
| estirpe | edificio | 2 | 3+3 | 1/4 | +1/-4 | 3 | 0/0 | 0 | 144 |
| zz | recinto | 0 | 6+0 | 10/16 | +1/-7 | 0 | 0/0 | 0 | 300 |
| zz | recinto | 0 | 3+3 | 10/16 | +2/-8 | 0 | 0/0 | 0 | 360 |
| zz | recinto | 2 | 6+0 | 2/4 | +1/-3 | 4 | 0/0 | 0 | 144 |
| zz | recinto | 2 | 3+3 | 1/3 | +1/-3 | 4 | 0/0 | 0 | 144 |
| zz | edificio | 0 | 6+0 | 11/17 | +6/-12 | 0 | 0/0 | 0 | 456 |
| zz | edificio | 0 | 3+3 | 8/14 | +3/-9 | 0 | 0/0 | 0 | 372 |
| zz | edificio | 2 | 6+0 | 1/3 | +1/-3 | 4 | 0/0 | 0 | 144 |
| zz | edificio | 2 | 3+3 | 1/4 | +1/-4 | 3 | 0/0 | 0 | 144 |

## Cómo reproducir y leer la medición

Con Node 24.22.3, desde la raíz de la rama experimental, se pueden generar los seis archivos en otro directorio y cotejarlos byte por byte.

```sh
npm ci
npm run check
npm run build
output=$(mktemp -d)
for seed in mansion estirpe zz; do
  node scripts/prey-distribution.mjs "$seed" "$output" || exit 1
done
diff -qr docs/benchmarks/e1-distribucion-69 "$output"
```

- Los JSONL contienen una trayectoria por línea. Incluyen depósitos fundadores, firma geométrica, cuenca, cuota, lotes utilizados, fuentes, sumideros, conversiones, inventario final y transferencias por conector, sentido y recurso. También incluyen las comidas individuales, las extinciones y recolonizaciones locales y los cinco censos solicitados. Una pareja equivale a dos residentes de la misma especie en la misma región fina.
- Los CSV registran nacimientos, muertes propias, capturas, inmigración, emigración, censo final y existencias locales al cierre de ventanas consecutivas de 48 o de 72 horas. Ambas series incluyen la última ventana parcial. Una fila omitida indica inventario final vacío, censo inicial de presas cero y ausencia de eventos de presas en esa ventana. Para sumar un año se elige una sola anchura. El neto local es nacimientos menos muertes propias. El cambio de censo añade inmigraciones y resta emigraciones y capturas.
- La accesibilidad usa caminos dirigidos que el cazador puede atravesar físicamente desde donde está al comienzo del tick. En los controles sin cazadores se usa el origen como referencia fija. Para marcar un hábitat productivo en una ventana se exige neto positivo y al menos un nacimiento alcanzable en el momento en que ocurre. Las horas simultáneas exigen neto positivo en dos sitios en la misma hora. En cada comida se cuentan las presas presentes justo antes de consumir, descontando salidas y respetando el crédito diferido de llegadas. Una ruta transitable puede no haber sido recorrida a tiempo.
- En cada par coincidieron firma del grafo, puente, presupuesto fundador por cuenta, cuenca, cuota y aportes efectivos. Cada corrida comenzó con 24 de agua, 30 de detrito, 2 de nutrientes, 4 de biomasa fúngica, 20 de energía, 2 detritívoros y seis presas. Una sola cuenca aportó 52.560 lotes. Se auditó cada una de las 210.240 transiciones principales, incluyendo conservación de materia, agua y energía y validez de los cruces. Se comprobó el cierre de censo por hábitat y ventana y el cierre anual por recurso. En cada escenario se reanudó desde las horas 48 y 2.190 y se verificaron el registro de transacciones de las 72 horas siguientes y el snapshot final de cada tramo contra la trayectoria continua.
- Pasaron las 73 pruebas de la base y la compilación de TypeScript. En los 12 controles 6+0 coincidieron con los datos del issue #68 los nacimientos y muertes propias de presas, capturas, nacimientos y muertes de cazadores y horas de pareja de cazadores. La rama sólo aporta el medidor y la evidencia de este experimento. [Medidor](../scripts/prey-distribution.mjs) · [Archivos de resultados](benchmarks/e1-distribucion-69/) · [Diagnóstico anterior](https://github.com/bloodlotus-rgb/Roguelike/issues/68)
