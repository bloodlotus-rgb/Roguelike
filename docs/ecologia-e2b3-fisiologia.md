# E2-B3 · Fisiología mínima y señales observables

Experimento del #93 sobre `a181807`. Los tres mecanismos se activan por separado o juntos bajo `prey.physiology` y quedan incluidos en la firma. El contrato y los snapshots de las reglas anteriores conservan su identidad. [Issue #93](https://github.com/bloodlotus-rgb/Roguelike/issues/93)

En el turno de ingesta, el presupuesto incluye el mantenimiento de la hora y el de las horas hasta justo antes de la siguiente oportunidad. El candidato cero representa no comer. Se evalúa cada posible bocado usando el reparto entero del micelio disponible y el costo del cuerpo después de asimilar. Se toma la menor mordida que cubre el déficit o la que más lo reduce. El desempate favorece la menor masa. Se actualiza el saldo local antes de evaluar a la siguiente presa. Hambre y saciedad se derivan de la reserva y el presupuesto. No crean una cuenta energética.

El límite adulto restringe cuánto tejido se incorpora, independientemente de la edad. La materia remanente pasa a minerales y la energía no asimilada se registra como calor. El mantenimiento del fixture es 1 E/h más un quantum por cada 2 M adicionales, con el primer bloque de 1–2 M a 1 E/h. La cría condicionada comprueba el pago, la reserva y la capacidad del cuerpo que conserva cada padre tras donar tejido. La cría propuesta tiene 1 M/2 E de reserva, suficientes para las dos horas previas a la siguiente oportunidad de ingesta si nace en la misma fase.

## Seis escenas de 12 horas

Hábitat local de capacidad 64 M, agua inicial 1, detrito inicial cero y sin aporte externo. Cada presa puede ingerir hasta 2 M cada tres horas, con retención de 500 ‰ y asimilación de 1000 ‰. La capacidad de reserva es 4 E/M. Control y aislamientos fundan presas de 4 M/6 E y 2 M/2 E. La integrada y la de escasez fundan dos presas de 4 M/10 E, con solicitudes de cría para la pareja fundadora. El micelio de 30 M empieza con 600 E químicas y 450 E de reserva. La escena de escasez mantiene la masa y empieza con 150 E químicas, todas en reserva.

| Escena | Ingestas | Evaluaciones de hambre / candidatos | Asientos | Resultado al cierre |
|---|---:|---:|---:|---|
| Control | 8 | 0 / 0 | 44 | Presas de 8 y 6 M, con 31 y 23 E de reserva |
| Sólo saciedad | 3 | 8 / 11 | 39 | Presas de 4 y 2 M, con 9 y 4 E de reserva |
| Sólo masa adulta | 8 | 0 / 0 | 44 | Ambas presas de 4 M, con 15 E de reserva cada una |
| Sólo mantenimiento por masa | 8 | 0 / 0 | 44 | Presas de 8 y 6 M, con costo de 4 y 3 E/h |
| Integrada con cría | 7 | 11 / 18 | 55 | Nacimientos en h6, h9 y h12 |
| Integrada con escasez | 0 | 4 / 8 | 18 | Ambas presas mueren en h6 |

**Saciedad y crecimiento.** En h3 la presa 0 de la escena de saciedad omite la ingesta porque ya cubre su intervalo. La presa 1 toma 1 M/18 E y su asimilación se limita a 8 E por la capacidad de reserva. Con retención de 500 ‰, 1 M se redondea a cero masa incorporada. Las tres mordidas efectivas de este brazo fueron de 1 M. Ninguna aumentó el cuerpo. La reserva sí aumentó con algunos bocados, pero los animales terminaron con 13 E combinadas frente a 54 E del control, junto con una masa corporal menor.

**Saciedad y reproducción.** En h3 de la escena integrada ambas presas tienen 6 E antes del mantenimiento y omiten la comida. Después quedan con 4 E cada una. Con esos saldos el pago de cría no deja el mantenimiento cubierto para ambos, por lo que se omite. En h6 las reservas iniciales ya se agotaron y ambas presas ingieren 1 M/15 E. Pagan mantenimiento y financian la primera cría con esa ingesta. Las siguientes crías se pagan en h9 y h12. El progenitor 0 pierde masa en cada donación y termina en 1 M sin dejar de ser maduro. El experimento usa un stock fúngico finito y no mide reproducción sostenida.

**Escasez y turno perdido.** En la escena integrada escasa, a h3 todavía hay micelio energético. Los padres están saciados con sus reservas iniciales y omiten el turno. En h6 hay 30 M de micelio con 0 E justo antes del mantenimiento. Los bocados de 1 y 2 M empatan con no comer porque ninguno mejora el déficit. Mueren ambas presas. Una prueba unitaria adicional verifica un empate positivo entre dos bocados que reciben la misma energía entera y confirma que se elige el menor.

## Reproducción y traza

```bash
node scripts/e2b3-fisiologia.mjs --preflight
node scripts/e2b3-fisiologia.mjs /ruta/a/resultados
```

El banco escribe una traza cronológica por criatura y un JSON con configuraciones, señales, decisiones, reservas, calor y huella del libro. Las 72 horas registradas cerraron exactamente materia, agua y energía. En h3, h6, h9 y h12 se cotejaron diario, balance y snapshot tras reanudar. Un primer lanzamiento se interrumpió por un error del registrador al leer el primer nacimiento. Se corrigió el registro y se repitió la misma matriz para obtener la evidencia completa.
