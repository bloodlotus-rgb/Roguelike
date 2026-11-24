# Laboratorio ecológico local

En un checkout de la rama del laboratorio, con Node 24, ejecutá:

```sh
npm ci
npm run lab
```

Abrí [http://127.0.0.1:4173](http://127.0.0.1:4173). Si el puerto está ocupado, podés iniciar con `LAB_PORT=4174 npm run lab` y usar la URL que imprima la terminal. El reloj espera comandos. Seleccioná una habitación en el mapa y una presa por ID en el inspector. **Guardar** descarga un JSON y **Cargar** lo reanuda. Las pestañas del mismo servidor observan una sola sesión.

## Recorrido de cinco minutos

1. Con el paso de detrito abierto, avanzá dos veces **6 h**. En h12 seleccioná **Pozo del micelio** y anotá la masa y la energía del tejido. El diario permite desplegar el balance exacto de cada hora.
2. **Reiniciá**, avanzá **6 h**, accioná **Cerrar paso** y avanzá otras **6 h**. Compará el mismo hábitat a h12. Podés guardar en este punto, reiniciar y cargar el archivo para recuperar la barrera, la hora y el diario.
3. Usá **Abrir paso** y avanzá **1 h**. En h13 aparece el primer cruce tras reabrir. Probá por separado **Abrir compuerta**. Es la compuerta de hierro del rellano inferior y tiene capacidad de transporte de detrito cero en ambos estados.

| Observación | Control abierto | Intervención cerrada de h6 a h12 |
| --- | --- | --- |
| Detrito que cruza el paso en h7–h12 | 4 M / 768 E | 0 M / 0 E |
| Cuota usada hasta h12 | 32 / 96 lotes | 32 / 96 lotes |
| Micelio en h12 | 15 M / 335 E | 13 M / 217 E |
| Ingesta de las presas en h12 | 1 M cada una | 1 M cada una |
| Presas vivas en h12 | 2 | 2 |

El primer pulso llega a la Cámara de aporte en h1 y el primer cruce al Pozo del micelio ocurre en h2. Tras reabrir en h12, cruzan 1 M / 192 E en h13. En el recorrido de intervención, el micelio llega a 13 M / 289 E en h18 junto con otras dos mordidas. Es una recuperación de energía respecto de h12, con la misma masa de tejido a igual fase del ciclo. El escenario permite observar acceso y contabilidad en pocas horas.

[Control en h12](laboratorio/control-h12.png) · [Paso cerrado en h12](laboratorio/intervencion-h12.png) · [Reapertura en h13](laboratorio/reapertura-h13.png)

## Escenario y preflight

El mapa muestra cuatro regiones finas reales de la semilla `mansion`. El motor sigue usando los 100.759 hábitats del edificio. Los nombres de las habitaciones y el trazado en línea son etiquetas esquemáticas del visor. El inspector muestra también conexiones hacia fuera de la vista, y el diario registra sus cruces efectivos con origen y destino.

| Conector | Extremos físicos | Función |
| --- | --- | --- |
| `0/2/6/3/1` | `0/128/3/2/6` ↔ `0/319/3` | Puerto de la galería lateral. La declaración acredita lotes a la Cámara de aporte usando el extremo físico donante. |
| `0/2/8/3/0` | `0/319/3` ↔ `0/460/3` | Abertura de Jenga con hasta 1 M/h de detrito por dirección a igual profundidad. El inventario y el gradiente deciden el flujo efectivo. |
| `0/3/8/3/5` | `0/460/3` ↔ `1/0/0` | Compuerta de hierro del rellano. Empieza cerrada y se puede accionar de forma independiente. |

Se valida que los cuatro hábitats sean distintos, que los cortes y extremos coincidan, y que la red dirigida del edificio deje nula la accesibilidad de detrito de la cámara al pozo al cerrar la abertura, incluso con la compuerta de hierro abierta. La fuente orgánica entrega hasta 16 lotes de 1 M / 192 E por pulso (h1, h7, h13, h19, h25 y h31), con una cuota total de 96. La fundación declara 2 A de agua, un inóculo de 16 M / 256 E (192 E en reserva) y los cuerpos de dos presas de 4 M / 10 E y 2 M / 6 E. La configuración acotada activa A+B y la fisiología del PR #94 sólo en el laboratorio. Las cifras son del escenario interactivo.

El mapa muestra tejido y presencia animal. El inspector expone diagnóstico exacto, incluido el último turno en el que el motor evaluó la ingesta. El diario describe eventos reales con etiquetas de presentación. La sesión omite solicitudes de movimiento y apareamiento.

## Sesión, pruebas y límites

- El servidor escucha sólo en loopback. Valida host, origen, tipo y tamaño de entrada, revisión y comandos disponibles. Avanzar 6 h es una transacción de sesión. Se publica el resultado, el diario y la revisión sólo si se confirman las seis horas. Una barrera se aplica entre horas y se confirma junto al estado proyectado si conserva materia, agua, energía, calor acumulado y cuota.
- El envoltorio `estirpe-lab/1` conserva semilla, escenario, comandos ordenados y el snapshot firmado existente con su registro exacto de barreras. Al cargar, se valida la estructura, versión e integridad de los dos niveles del snapshot. Se comprueba el presupuesto y la hora del historial antes de reproducirlo con el motor. Luego se restaura el snapshot en la época reproducida y se comparan las integridades antes de confirmar. El historial de comandos completo queda en el guardado. El visor expone los últimos 48 registros de horas y maniobras. Guardar y cargar admiten hasta 24 acciones, 36 h simuladas y 8 maniobras de barrera. Podés seguir usando la sesión activa al superar esos límites. Incluso dentro del presupuesto, cargar bloquea temporalmente la interfaz mientras el servidor reconstruye el recorrido desde h0.
- Las pruebas de Vitest cubren transporte diferido, cierre, reapertura, conservación global por hora y por maniobra, cuotas, reanudación con una barrera cerrada, igualdad de diarios y digests, reinicio y rechazo de comandos y guardados inválidos. La suite general incluye regresiones de los motores históricos.
- En Chromium se probó el recorrido emparejado, la selección de sala y presa, la descarga y carga del JSON, la reapertura y la vista móvil. Se contrastaron también respuestas de la API a revisiones obsoletas, conectores inválidos, host incorrecto y origen externo.
