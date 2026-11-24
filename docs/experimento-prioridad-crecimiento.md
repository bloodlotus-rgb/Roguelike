# Prioridad de crecimiento fúngico frente a mineralización

**Recomiendo descartar la variante como regla de E1.** En los seis pares con presas, bajaron las muertes por falta de hongo local, de 624 en 8.286 comidas individuales (7,53 %) a 127 en 7.005 (1,81 %). El saldo anual de los receptores mejoró en 313 presas, pero el de los orígenes empeoró en 319. El saldo conjunto de todos los hábitats cayó de −26 a −33. Los nacimientos del último trimestre pasaron de 138 a cero y las parejas al cierre, de cuatro a cero. Se aplicaron los criterios fijados antes de la comparación. [Issue #74](https://github.com/bloodlotus-rgb/Roguelike/issues/74) · [Contrato #71](https://github.com/bloodlotus-rgb/Roguelike/issues/71)

## Las 24 trayectorias

Cada fila cubre 8.760 horas. «Act.» cuenta las veces que el crecimiento se adelantó. «Tejido» es la producción fúngica bruta por crecimiento en todo el espacio. O/R son los saldos **propios** de presas en origen y receptor (nacimientos menos muertes, sin migraciones). T4 cuenta nacimientos en las horas 6.571–8.760. «Cierre» muestra censo de presas y parejas en la misma región fina. La última columna indica la hora de extinción global cuando hubo fundadores y se perdió la última presa.

| Semilla | Espacio | Presas iniciales | Política | Act. | Tejido | Muertes por hambre | Neto O/R | Nac. T4 | Cierre, presas/parejas | Extinción (h) |
|---|---|---:|---|---:|---:|---:|---|---:|---|---:|
| mansion | recinto | 0 | original | 0 | 36 | 0 | +0/+0 | 0 | 0/0 | — |
| mansion | recinto | 0 | prioridad | 1460 | 5868 | 0 | +0/+0 | 0 | 0/0 | — |
| mansion | recinto | 6 | original | 0 | 188 | 16 | +1/-7 | 0 | 0/0 | 300 |
| mansion | recinto | 6 | prioridad | 32 | 222 | 13 | -3/-3 | 0 | 0/0 | 216 |
| mansion | edificio | 0 | original | 0 | 36 | 0 | +0/+0 | 0 | 0/0 | — |
| mansion | edificio | 0 | prioridad | 2917 | 10246 | 0 | +0/+0 | 0 | 0/0 | — |
| mansion | edificio | 6 | original | 0 | 530 | 32 | +25/-30 | 0 | 0/0 | 1320 |
| mansion | edificio | 6 | prioridad | 2914 | 10976 | 0 | +0/-3 | 0 | 1/0 | — |
| estirpe | recinto | 0 | original | 0 | 8756 | 0 | +0/+0 | 0 | 0/0 | — |
| estirpe | recinto | 0 | prioridad | 2855 | 11676 | 0 | +0/+0 | 0 | 0/0 | — |
| estirpe | recinto | 6 | original | 0 | 5428 | 191 | +182/-185 | 46 | 3/1 | — |
| estirpe | recinto | 6 | prioridad | 582 | 4686 | 101 | +82/-88 | 0 | 0/0 | 4332 |
| estirpe | edificio | 0 | original | 0 | 5840 | 0 | +0/+0 | 0 | 0/0 | — |
| estirpe | edificio | 0 | prioridad | 2851 | 11782 | 0 | +0/+0 | 0 | 0/0 | — |
| estirpe | edificio | 6 | original | 0 | 5676 | 352 | +182/-181 | 92 | 7/3 | — |
| estirpe | edificio | 6 | prioridad | 1046 | 11408 | 0 | +1/-6 | 0 | 1/0 | — |
| zz | recinto | 0 | original | 0 | 36 | 0 | +0/+0 | 0 | 0/0 | — |
| zz | recinto | 0 | prioridad | 1460 | 5868 | 0 | +0/+0 | 0 | 0/0 | — |
| zz | recinto | 6 | original | 0 | 188 | 16 | +1/-7 | 0 | 0/0 | 300 |
| zz | recinto | 6 | prioridad | 32 | 222 | 13 | -3/-3 | 0 | 0/0 | 216 |
| zz | edificio | 0 | original | 0 | 28 | 0 | +0/+0 | 0 | 0/0 | — |
| zz | edificio | 0 | prioridad | 1461 | 5830 | 0 | +0/+0 | 0 | 0/0 | — |
| zz | edificio | 6 | original | 0 | 166 | 17 | +6/-12 | 0 | 0/0 | 456 |
| zz | edificio | 6 | prioridad | 1091 | 5888 | 0 | +1/-6 | 0 | 1/0 | — |

## Qué cambió para las presas

- **Edificio de `estirpe`.** El receptor pasó de 171 nacimientos, 352 muertes y 184 inmigraciones a cero nacimientos, seis muertes y seis inmigraciones. No hubo emigraciones del receptor en ninguno de los dos casos. El origen pasó de +182 a +1. La variante produjo 5.642 unidades de tejido por crecimiento en el receptor frente a 1.980 en el control, pero allí el consumo de tejido por las presas cayó de 1.721 a dos unidades. A la hora 24 una presa murió con cinco unidades de hongo y seis de agua en el hábitat y cero energía disponible justo antes de comer. El receptor perdió su última presa a la hora 72. A fin de año quedó una sola en el origen.
- **Recintos y extinciones.** En el recinto de `estirpe` el control cerró con una pareja. La variante se extinguió a la hora 4.332. En los recintos de `mansion` y `zz` la extinción se adelantó de la hora 300 a la 216. En sus edificios completos la variante conservó una presa solitaria al cierre. En el edificio de `zz` hubo dos recolonizaciones del receptor, a las horas 42 y 66. En ningún caso la variante sostuvo reproducción en el último trimestre.
- **Alimento tardío.** Las muertes por falta de tejido que coincidieron con germinación posterior en la misma hora bajaron de 251 a 33. Las demás muertes por falta de tejido bajaron de 373 a 94. Las muertes por energía subieron de una a 17. Cada comida se clasificó según las existencias *antes* de atender al individuo. La única diferencia entre tratamientos fue la prioridad basal. El contraste mide su efecto total, incluidas las variaciones de población y demanda. Estos conteos no aíslan un beneficio por cambiar la hora de comer.
- **Controles sin presas.** La producción fúngica por crecimiento pasó de 14.732 a 51.270 unidades sumadas entre los seis espacios. Hubo 13.004 activaciones, frente a 5.697 en las trayectorias pobladas. Estos controles miden la respuesta basal. La cuota finita y la ausencia de cazadores limitan la inferencia a la base alimentaria y a las presas durante este año.

## Intervención y auditoría

El modo experimental se elige al fundar la red con `foundWeb(world, setup, founders, true)`. El modo predeterminado es el histórico. Tras el mantenimiento normal, en una hora de crecimiento se comprueba que haya micelio, agua, espacio, detrito, nutrientes ya existentes y energía. Sólo si la mineralización prevista dejaría menos detrito del requerido se paga primero el crecimiento. La mineralización se calcula sobre el remanente. Por ejemplo, en el receptor del edificio de `estirpe` con seis presas, a la hora 12 el saldo de detrito/nutrientes/energía fue 1/3/2 antes de crecer, 0/2/1 después y 0/2/1 tras evaluar la mineralización. La comida animal mantuvo su posición en el tick.

Se auditaron las **210.240 horas principales** por hábitat, conversión, transferencia y sumidero, incluidos los límites de capacidad en las regiones finas. Cada trayectoria recibió la misma cuota de 52.560 lotes y la agotó a la hora 8.760. Los 12 controles originales reprodujeron todos los asientos horarios en el mismo orden, los anclajes finos, las firmas de geometría, contrato y guardados, y el SHA-256 de la trayectoria completa con la serialización de D0. Por tratamiento, una ejecución paralela reanudada desde las horas 48 y 2.190 reprodujo el libro posterior y el snapshot final, incluso invirtiendo el orden de inserción de los inventarios y residentes. [Evidencia histórica D0](https://github.com/bloodlotus-rgb/Roguelike/tree/10c67ba4c58d4069f6e97acfe5a6278a333fe21c/docs/benchmarks/e1-presupuesto-basal)

`npm run check` pasó **87 pruebas**, incluidas las 73 existentes, y `npm run build` terminó correctamente. Se verificaron el pago de la última unidad, la identidad del libro cuando falla cada requisito y los casos con insumos suficientes para ambos procesos. Se contrastaron 240 horas y guardados históricos de E1-B1/B2 con las firmas obtenidas de la base. E1-C/1 y E1-D/1 restauran las reglas originales. La variante usa la versión firmada `E1-D/growth-priority/1`. Alterar la versión o la firma invalida el guardado. Los resultados corresponden al entorno local. No se verificó CI remota.

## Datos y reproducción

El CSV entrega saldos, censos, parejas y flujos anuales para cada origen, receptor y espacio completo. El ZIP incluye por trayectoria los cuatro tamaños de ventana (12, 48, 72 y 2.190 horas), las comidas individuales, cada activación con sus tres saldos y la cronología de extinciones y recolonizaciones. Los valores de una ventana cierran en su última hora y la última ventana puede ser parcial. Las entradas y salidas del mismo corte son las dos caras de un único movimiento. [Resumen CSV](benchmarks/e1-prioridad-crecimiento/resumen.csv) · [Mediciones CSV/JSON en ZIP](benchmarks/e1-prioridad-crecimiento/mediciones.zip) · [Firmas de auditoría](benchmarks/e1-prioridad-crecimiento/auditoria.txt) · [Libros horarios](benchmarks/e1-prioridad-crecimiento/)

Con Node 24.22.3 y Python 3.12, desde la rama del experimento. El archivo de Git extrae únicamente los datos de referencia del #72.

```sh
npm ci
npm run check
npm run build
out=$(mktemp -d)
git fetch origin experiment/e1-presupuesto-basal
git archive 10c67ba4c58d4069f6e97acfe5a6278a333fe21c docs/benchmarks/e1-presupuesto-basal | tar -x -C "$out"
for seed in mansion estirpe zz; do
  node scripts/growth-priority/run.mjs "$seed" "$out/libros" "$out/docs/benchmarks/e1-presupuesto-basal" || exit 1
done
for file in "$out"/libros/*.json.gz; do
  python3 scripts/growth-priority/measure.py "$file" "$out/tablas" || exit 1
done
python3 scripts/growth-priority/tabulate.py "$out/tablas" > "$out/resumen.csv"
python3 scripts/growth-priority/package.py "$out/tablas" "$out/mediciones.zip"
cmp "$out/resumen.csv" docs/benchmarks/e1-prioridad-crecimiento/resumen.csv
cmp "$out/mediciones.zip" docs/benchmarks/e1-prioridad-crecimiento/mediciones.zip
```
