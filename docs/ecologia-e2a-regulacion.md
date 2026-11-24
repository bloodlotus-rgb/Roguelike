# E2-A · Regulación experimental del micelio

El issue #86 prueba dos variantes excluyentes, firmadas en el contrato del snapshot. La variante A, `growth-budget`, limita cuánto tejido retiene el micelio según la reserva local después de la ingesta actual y el mantenimiento de todo el intervalo, incluida la hora actual. El cálculo acota la reserva a la capacidad del tejido propuesto. La variante B, `partial-regression`, conserva la máxima masa cuyo mantenimiento horario puede pagarse dentro de la capacidad de reserva del tejido superviviente. La energía estructural se reparte por masa. El tejido retirado y su energía van al detrito, incluida la reserva que el tejido superviviente no pueda alojar. Un asiento registra el pago como calor y la pérdida como regresión. Si ninguna unidad es mantenible, se aplica la muerte completa. Omitir la variante conserva el contrato y las reglas originales. [Issue #86](https://github.com/bloodlotus-rgb/Roguelike/issues/86)

## Resultados

Se usaron las trayectorias recurrentes de #85 como referencias. Las seis comparaciones nuevas duraron 672 horas cada una. Se mantuvieron mundo, inóculo, agua, fuente y coeficientes de cada candidata. El criterio del ensayo exigió conversión positiva de detrito, mantenimiento pagado, presencia continua del micelio, biomasa igual entre extremos y reserva sin caída en las dos ventanas finales de 168 horas, medidas en la misma fase del ciclo. Se seleccionó la primera candidata que cumplía este criterio para un control de agotamiento por variante.

| Configuración | Regla original #85 | A · Extinción o estado en h672 | B · Extinción | A · Mineralización / calor | B · Mineralización / calor |
|---|---:|---|---:|---:|---:|
| X-renovacion | h263 | h263 | h266 | 130 M / 33.216 E | 132 M / 33.356 E |
| X-asimilacion | h317 | h317 | h319 | 157 M / 30.144 E | 159 M / 30.194 E |
| X-reserva | h203 | 64 M y 320 E de reserva | h207 | 416 M / 85.888 E | 102 M / 25.843 E |

A con X-reserva se mantuvo en 64 M y 320 E al cierre de cada ventana final. Convirtió y mineralizó 112 M por ventana, con 10.752 E asimiladas y pagadas en mantenimiento. El recambio medido fue cero en esas ventanas. Se observó persistencia funcional con biomasa acotada durante el ensayo. B permitió pérdidas parciales y retrasó el colapso entre dos y cuatro horas. El registro separa el tejido incorporado, el devuelto a detrito y la energía química remanente devuelta.

El único control elegible cortó el aporte de A con X-reserva después de h504, reduciendo la cuota de 448 a 336 lotes. Coincidió con la trayectoria recurrente hasta h504 y perdió sus 64 M en h510. Las siete corridas, incluidas las 672 horas del control, cerraron exactamente masa, agua y energía. Las reservas y la biomasa respetaron sus capacidades. Cada corrida se guardó y reanudó en h336.

## Reproducción y verificación

Con Node 24 y el archivo `results.json` del issue #85:

```bash
node scripts/e2a-regulacion.mjs /ruta/al/results.json /ruta/a/resultados
```

El script registra las reglas y los aportes exactos, el inventario horario y las ventanas, incluido el recambio, la mineralización y la disipación. La referencia del #85 usada tiene huella SHA-256 canónica `b49a7022ec5d6fe121ee35610f9b8ebc782e25e5127dc8c24720731af95d8d82`. [Issue #85](https://github.com/bloodlotus-rgb/Roguelike/issues/85)
