# Ecología natural · Forrajeo local y reunión de parejas

Con dos cazadores fundadores, la política de dispersión puede enviar uno a una región vecina. Una vez separados, cada uno necesita un segundo residente para poder emigrar. Esto deja dos adultos vivos y sin posibilidad de reunirse aunque el paso siga abierto. En cien ensayos de un año se registraron cero nacimientos de depredadores con esa regla.

## Experimento

`local-foraging` mantiene la dieta, el reloj, las cuotas, los fundadores, la geometría, las capacidades y los costos. Cambia la decisión de salir en una hora de movimiento.

- Un individuo sin alimento compatible en su hábitat puede ir a un vecino conectado con alimento y agua.
- Dos residentes solitarios en regiones vecinas pueden reunirse. El primer movimiento reserva la llegada. El receptor que espera esa llegada permanece durante la fase. Una pareja alimentada permanece junta. Con más de dos residentes, puede dispersarse un excedente hacia un destino menos poblado.
- Cada traslado sigue costando una unidad de energía. Los créditos se aplican después de las interacciones locales y cada corte admite un solo cruce por grupo y fase. Los animales perciben sólo los destinos inmediatamente adyacentes.
- El modo `dispersal` continúa como referencia y como interpretación de guardados anteriores. E1-E/1 firma la política de movimiento. Las pruebas reanudan archivos emitidos por E1-C/1, E1-D/1 y E1-D/2 y comparan el siguiente libro horario.

## Cien edificios emparejados

Se repitieron exactamente las semillas, el censo de seis presas y dos cazadores, la dieta de cazador generalista y el suministro anual del ensayo anterior. Cada par comparte región y conector de fundación. Los cuatro grupos son tejido fúngico, detritívoros, presas y depredadores.

| Edificios de 100 | Dispersión | Forrajeo local |
|---|---:|---:|
| Con presas al año | 43 | 15 |
| Con depredadores al año | 43 | 1 |
| Con los cuatro grupos al año | 19 | 1 |
| Con nacimientos de presas | 87 | 100 |
| Con nacimientos de depredadores | 0 | 67 |
| Con nacimientos de depredadores y depredadores al cierre | 0 | 0 |

Las diferencias de supervivencia y reproducción miden consecuencias distintas de la movilidad. Una pareja que permanece junta puede criar y también concentrar el consumo hasta agotar el alimento. Una población remanente con un único adulto carece de pareja aunque siga cazando. El modelo cuenta masa y censos agregados. No representa edad, encuentros fallidos, reservas corporales ni desplazamientos exploratorios a través de destinos momentáneamente sin alimento.

## Diez años y costo

| Semilla | Hongos | Detritívoros | Presas | Depredadores | Nacimientos de depredadores en la década / último año |
|---|---:|---:|---:|---:|---:|
| mansion | 48 | 0 | 1 | 0 | 0 / 0 |
| estirpe | 157 | 0 | 0 | 0 | 2 / 0 |
| zz | 41 | 0 | 1 | 0 | 0 / 0 |

La reserva del ensayo decenal es de 525.600 lotes por edificio, seis por hora. El control anual dispone de 52.560 lotes. Ambas cifras son presupuestos declarados. El costo se midió por separado en procesos de Node 24 durante 96 horas, con reservas iniciales finitas, para 1, 10, 100 y 554 regiones fundadoras accesibles a ambos grupos. El JSONL incluye media, p95 y pico de memoria con ambas políticas.

| Política con 554 focos iniciales | Regiones ocupadas de media | Tick medio / p95 (ms) | Auditoría media / p95 (ms) | RSS pico (MiB) |
|---|---:|---:|---:|---:|
| dispersal | 623.4 | 2.74 / 6.43 | 2.44 / 5.11 | 515.4 |
| local-foraging | 580.4 | 3.14 / 8.30 | 2.98 / 8.80 | 492.2 |

## Resultado y decisión pendiente

La reunión local permitió nacimientos de depredadores en 67 de los cien edificios. Todos esos edificios perdieron a sus cazadores antes del cierre anual. El único edificio con cazador al cierre no registró nacimientos de ese grupo. La dispersión original retuvo cazadores en 43 casos y ninguno registró nacimientos. En los tres ensayos decenales de forrajeo local tampoco hubo nacimientos de depredadores en el último año. El forrajeo queda disponible como experimento optativo.

Para usar esta simulación como ecología inicial del juego queda por definir el criterio de viabilidad del gremio depredador: qué proporción de edificios o cuencas debería conservar poblaciones con recambio, y durante cuántas generaciones. La presencia de adultos remanentes, la conservación contable y los nacimientos tempranos ya se miden por separado. La sincronización del metabolismo, el acceso al alimento dentro de un hábitat mezclado y el número de cuencas reproductoras son límites relevantes al interpretar el resultado.

## Comprobaciones

Node 24 instaló las dependencias fijadas con `npm ci`. La suite final pasó las 80 pruebas y el build. Una corrida intermedia superpuesta con los procesos anuales saturó los workers de Vitest y terminó con un timeout de comunicación. La suite se repitió sin carga paralela hasta obtener una salida correcta. También se ejecutó el diagnóstico de reapertura del workflow con ambas variantes experimentales.

## Reproducción

```sh
npm ci
npm run check
npm run build
npm run --silent ecology:web -- 240 reopen mansion --diet=generalist-predator --movement=local-foraging
for n in $(seq -w 0 99); do node scripts/food-web-batch.ts "e1-validation-$n" local-foraging; done
for seed in mansion estirpe zz; do node scripts/food-web-batch.ts "$seed" local-foraging 87600; done
for policy in dispersal local-foraging; do
  for size in 1 10 100 554; do npm run --silent ecology:web-load -- mansion "$size" 96 "$policy" generalist-predator; done
done
```

[Control anual](benchmarks/e1-cien-edificios.jsonl) · [Forrajeo anual y decenal](benchmarks/e1-forrajeo.jsonl) · [Costo](benchmarks/e1-forrajeo-carga.jsonl) · [Reglas de alimentación y dietas](ecologia-e1-dietas.md)
