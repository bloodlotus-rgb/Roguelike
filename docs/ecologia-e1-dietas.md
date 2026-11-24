# Ecología natural · Amplitud de dieta y persistencia

Los ensayos de especialistas perdieron a todos sus depredadores en menos de un año. Para aislar el efecto de la disponibilidad de presas se varió únicamente el menú. El control usa las reglas originales. En tres variantes la presa, el depredador o ambos pueden consumir un detritívoro local cuando se agota su alimento preferido. La unidad consumida proviene del censo vivo de E1-B2, comparte capacidad física y debita su posición fina. Los horarios, los costos, el número inicial y la geometría son iguales dentro de cada comparación. La preferencia primaria del cazador por presas y la de la presa por hongos siguen siendo hipótesis de dos grupos funcionales.

El modo por defecto es `specialists`. Al fundar la red, el último argumento de `foundWeb` acepta `omnivorous-prey`, `generalist-predator` o `both-generalists` para ejecutar las variantes. La dieta se persiste y verifica con el libro de consumo. Cada ingesta y cada nacimiento deben explicar la pérdida de una unidad de alimento local, el destino de esa masa y el débito de energía. Después de una extinción local, la presencia de consumidores requiere una llegada desde una población viva. La fundación sólo ocurre en la hora cero.

## Comparaciones controladas

Se cruzaron cuatro dietas, el recinto de tres regiones o el edificio completo y tres semillas. En los edificios completos, con la misma cuota de 52.560 lotes anuales y depredador generalista, estos son los censos al cumplir 8.760 horas.

| Semilla | Hongos | Detritívoros | Presas | Depredadores |
|---|---:|---:|---:|---:|
| mansion | 29 | 12 | 1 | 1 |
| estirpe | 165 | 0 | 0 | 0 |
| zz | 27 | 15 | 0 | 1 |

El ensayo decenal mantiene la tasa horaria de seis lotes, con una reserva externa declarada diez veces mayor. Comprobamos el guardado y el siguiente paso por cada año. En mansion el último cazador consumió invertebrados durante el período largo. El remanente de una presa y un cazador carece de parejas. En zz el cazador siguió consumiendo invertebrados tras desaparecer las presas. En estirpe desaparecieron ambos consumidores. Mantener entradas por más tiempo permite medir funciones tróficas que dependen de un aporte físico continuo. La edad y la senescencia todavía no están representadas.

## Lote prospectivo

Las semillas tienen nombres consecutivos de `e1-validation-00` a `e1-validation-99`. Se usa el edificio completo con la primera cuenca profunda del control, una entrada lateral compatible, seis presas y dos cazadores generalistas. Si falta el acceso, el diagnóstico registra el fallo de fundación. La tasa de la cuenca, la selección de sitio y la dieta son las mismas para todo el lote. Se registran ingestas, nacimientos acumulados y censos vivos al año. La presencia final de cuatro grupos y el nacimiento de un depredador son observaciones distintas.

De los 100 edificios, 100 completaron el año con el acceso físico requerido. Al cierre, 19 conservaban los cuatro grupos, 43 conservaban depredadores y 43 conservaban presas. Hubo nacimientos de depredadores en 0 edificios y nacimientos de presas en 87. El número de edificios con nacimientos acumulados puede superar el de edificios con parejas al cierre. El objetivo exploratorio del contrato habla de funciones ecológicas. Para interpretar el porcentaje hace falta acordar qué funciones deben sostenerse al año y si se exige recambio de los cazadores.

## Reproducción

```sh
npm ci
npm run check
npm run build
npm run --silent ecology:web -- 240 reopen mansion --diet=generalist-predator
node scripts/food-web-diet.ts mansion estirpe zz
node scripts/food-web-diet.ts --decade mansion estirpe zz
for n in $(seq -w 0 99); do node scripts/food-web-batch.ts "e1-validation-$n"; done
```

Los tests incluyen checkpoints generados por los commits originales de E1-C y E1-D en la hora 47, con comparación del libro completo de la hora siguiente. Se verifica la continuación durante 300 horas a través de dos cambios de barrera y la conservación de posiciones finas al unir y volver a separar dos hábitats. El balance de dietas y la expectativa de recambio generacional en el edificio quedan para diseño. [Protocolos de estrés y sensibilidad](ecologia-e1-validacion.md) · [Ensayos de dieta](benchmarks/e1-dietas.jsonl) · [Cien edificios](benchmarks/e1-cien-edificios.jsonl)
