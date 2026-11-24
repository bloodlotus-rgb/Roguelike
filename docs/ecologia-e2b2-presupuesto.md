# E2-B2 · Productividad fúngica y presupuesto reproductivo

Se ensayaron las ocho condiciones aprobadas del #91 sobre `306097f`, desde el cierre de h336 hasta el cierre de h816. La política opcional `prey.reproduction: 'maintenance-budget'` tiene firma propia. Busca un reparto factible de materia y costo de cría que deje a cada progenitor reserva suficiente para las horas entre el nacimiento y su próxima oportunidad de alimentación. La hora del nacimiento ya pagó mantenimiento. La hora de la próxima ingesta alimenta antes de cobrar mantenimiento. Se verifica la capacidad de reserva del cuerpo remanente. La decisión usa reservas presentes y fase del reloj. Rechazar un nacimiento deja intactas sus cuentas. [Issue #91](https://github.com/bloodlotus-rgb/Roguelike/issues/91) · [Contrato #71](https://github.com/bloodlotus-rgb/Roguelike/issues/71)

## Fundación y presupuesto

Se conserva el hábitat y la época del control de #88, con 64 M/320 E de micelio, 192 M de minerales, 1 unidad de agua, 0 M de detrito y 42.880 E ya disipadas. El registro histórico queda cerrado en 224 lotes usados. Una fuente experimental distinta financia 80 pulsos, desde h337 hasta h811. Cada fundador aporta 2 M/11 E de su propio saldo de fundación. La apertura total es 260 M/342 E químicas y 1 unidad de agua.

Las presas comen hasta 4 M cada 12 h, retienen 500 ‰ de la masa, pagan 1 E/h y pueden reservar 12 E/M corporal. Maduran tras 48 h. Cada 24 horas se forman pares por ID ascendente entre adultos vivos, una sola solicitud por individuo. La cría recibe 1 M/12 E químicas, incluidas 11 E de reserva. La cría se paga con masa de los progenitores y 13 E de sus reservas, incluida 1 E de calor.

## Resultados emparejados

La política condicionada aceptó todos los nacimientos que la regla actual permitió. Los registros horarios, el historial reproductivo, las causas de muerte y los balances coincidieron dentro de cada par. Las cifras de la tabla corresponden a cada corrida del par.

| Paquete | Aporte externo | Micelio incorporado | Energía asimilada por presas | Nacimientos / descendientes maduros / recambio | Micelio agotado / extinción animal |
|---|---:|---:|---:|---:|---|
| Basal | 320 M / 61.440 E | 14 M | 468 E | 2 / 1 / 0 | h432 / h526 |
| Igual energía | 640 M / 61.440 E | 80 M | 864 E | 5 / 3 / 0 | h468 / h588 |
| Intensivo 1000 ‰ | 1.600 M / 307.200 E | 340 M | 2.424 E | 14 / 10 / 4 | h540 / h714 |
| Intensivo 750 ‰ | 1.600 M / 307.200 E | 340 M | 1.818 E | 14 / 10 / 4 | h540 / h612 |

La métrica de recambio cuenta nacimientos con al menos un progenitor descendiente ya maduro cuya cría toma su primera comida programada y paga mantenimiento. En ambos intensivos, los descendientes 2 y 3 tuvieron la cría 6 en h456, que comió y pagó mantenimiento en h468. Los cuatro casos representan recambio transitorio. Ningún brazo cumplió persistencia sin deriva en las dos últimas ventanas de 120 h.

Con el mismo aporte energético, el paquete de mayor masa de detrito y retención elevó la producción de micelio y la asimilación animal de 468 a 864 E. El cociente bruto de asimilación animal sobre aporte externo pasó de 0,76 a 1,41 %. El intensivo aportó cinco veces más energía que el basal y dio cocientes brutos de 0,79 % a 1000 ‰ y 0,59 % a 750 ‰. Estos cocientes usan todo el aporte programado, incluidos los lotes que llegaron después de la extinción, y la asimilación puede incluir energía de apertura. Los intensivos terminaron con detrito sin consumir y registraron un flujo al puerto auxiliar de 1 M/153 E.

El pastoreo retiró el último tejido fúngico en los cuatro paquetes. El crecimiento corporal máximo pasó de 17 M por presa en el basal a 36 M en los intensivos. La masa animal total llegó a 203 M en los intensivos, dentro de los 1.024 M de capacidad fina. El mantenimiento siguió siendo de 1 E/h por individuo y la capacidad de reserva creció con la masa. Las reservas corporales amortiguaron varias comidas fallidas tras agotar el micelio. La condición presupuestaria de cría protege el intervalo entre comidas y deja abierta la disponibilidad efectiva del alimento.

El registro conserva el detrito antes y después de cada muerte y de cada conversión fúngica. En el basal, un cadáver de 3 M/1 E cambió una mezcla de 8 M/1.536 E a 11 M/1.537 E. El pastoreo ya había agotado el micelio. La dilución por cadáveres se observó después de agotar el alimento en esta corrida.

## Reproducción

Con Node 24 y el `results.json` de #88, cuya huella SHA-256 canónica es `9de2bdad7269e4c0ecd0e6bd9244837ccadae8599f341479651d04610bf60963`:

```bash
node scripts/e2b2-presupuesto.mjs /ruta/al/results-88.json --preflight
node scripts/e2b2-presupuesto.mjs /ruta/al/results-88.json /ruta/a/resultados
```

El script verifica conservación de masa, agua y energía por hora y compara diario, balance y snapshot al reanudar en nueve horas de cada corrida. Exporta reglas y cuotas, biomasa y reservas por fase, producción de tejido, conversión, calor, genealogía y causas de muerte. Las pruebas enfocadas cubren el umbral de reserva, el reparto asimétrico, la capacidad después de donar tejido, los nacimientos omitidos y la reanudación.
