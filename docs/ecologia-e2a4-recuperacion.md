# E2-A4 · Recuperación y potencial energético del micelio

El experimento usa el commit `5b653bf` y la configuración `X-reserva` de #86. El mundo, inóculo, agua, coeficientes y cuota original de 448 lotes se toman del registro publicado. A+B tiene firma experimental propia. La regla original y las variantes A y B conservan sus firmas y el formato de snapshot. [Protocolo #88](https://github.com/bloodlotus-rgb/Roguelike/issues/88)

## Calendario y contabilidad

Verificados antes de las corridas. El aporte llega en horas 1 módulo 6 y la ingesta ocurre en múltiplos de 6. Los retiros ocurren tras el mantenimiento de la hora, con la cuota original. Omitir h337 afecta la ingesta de h342. El aporte se reanuda en h343 sin compensación. Se entregaron 444 lotes en cada brazo con interrupción y 448 en los otros cuatro.

El asiento de retiro exporta materia, energía química y reserva, que es un subconjunto de la energía química. Cada magnitud se reparte con los mismos pesos de masa y desempate determinista. El saldo sale del hábitat y queda registrado como exportación. La recuperación compara masa, energía y reserva con A+B continuo al cierre de ingesta y exige dos cierres consecutivos iguales al control.

## Resultados

| Corrida | Exportación acumulada | Primera recuperación / confirmación | Cierre h672 |
|---|---:|---|---:|
| A+B control | 0 M / 0 E | Trayectoria idéntica a A histórica | 64 M / 320 E |
| A+B retiro de 8 M | 8 M / 40 E | h384 / h390 | 64 M / 320 E |
| A+B retiro de 16 M | 16 M / 80 E | h432 / h438 | 64 M / 320 E |
| A+B cuatro retiros de 8 M | 32 M / 160 E | h384/390, h456/462, h528/534 y h600/606 | 64 M / 320 E |
| A pulso omitido | 0 M / 0 E | Extinción h342 | 0 M / 0 E |
| A+B pulso omitido | 0 M / 0 E | Extinción h342 | 0 M / 0 E |

La masa y energía del tejido exportado reaparecieron como incremento neto del inventario vivo de **8 M/40 E** o **16 M/80 E** tras cada retiro. El micelio agregado conserva una cuenta común, de modo que la medición cuantifica el incremento del saldo y la energía extraíble a esa fase. Al cierre de los ciclos de recuperación había **5 E/M**, íntegramente en reserva. La reserva del control se agota antes de la ingesta siguiente. El potencial energético disponible depende de la fase del ciclo y de la asimilación que se haya de estudiar en otro experimento.

Los retiros repetidos se recuperaron y confirmaron antes de cada nuevo retiro. El mantenimiento se pagó en las cuatro corridas con aporte continuo y ninguna perdió tejido por regresión. En total, el control mineralizó 416 M y disipó 85.888 E. El brazo repetido mineralizó 384 M y disipó 85.728 E. En la interrupción, ambos brazos llegaron a h342 con reserva cero, perdieron 64 M y acumularon detrito tras la reanudación. No quedó una unidad de micelio financiable para que B la conservara.

## Reproducción

Las seis corridas de 672 horas cerraron exactamente masa, agua y energía. Cada corrida verificó replay de diario, balance y snapshot en ocho horas preseleccionadas, incluidos retiros, omisión y reanudación. En pruebas aisladas se verificaron exportación proporcional, rechazo atómico del sobregiro, separación de firmas y activación de ambos mecanismos. Una comprobación con el checkout de `5b653bf` confirmó firmas, snapshots y diario inicial de la regla original, A y B.

Con Node 24 y el `results.json` de #86, cuya huella SHA-256 canónica es `a6a4e9c3b64f312aeb0856e08e458fbdb8bfa72ae919e415794e80b2e886c21a`:

```bash
node scripts/e2a4-recuperacion.mjs /ruta/al/results-86.json --calendar
node scripts/e2a4-recuperacion.mjs /ruta/al/results-86.json /ruta/a/resultados
```
