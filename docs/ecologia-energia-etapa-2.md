# E1 · Transporte químico, geometría y guardados

La etapa 2 amplía el libro de `9eb2315`. El detrito puede cruzar un corte Jenga con su energía química, redistribuirse tras un cambio de partición y continuar desde un checkpoint firmado. Agua y minerales conservan sus canales físicos. [Issue #80](https://github.com/bloodlotus-rgb/Roguelike/issues/80) · [Contrato #76](https://github.com/bloodlotus-rgb/Roguelike/issues/76) · [Diseño #77](https://github.com/bloodlotus-rgb/Roguelike/issues/77)

## Transporte y balance representativo

`chemical-transport.ts` reutiliza los límites de los cortes existentes y calcula con enteros exactos el gradiente basado en capacidad para cortes horizontales y el arrastre descendente para los demás. Reserva los débitos recorriendo cortes en orden de identificador. El detrito de cada hábitat se trata como perfectamente mezclado. Primero se asigna la masa a los cruces y al remanente. Luego se reparte la energía por masa mediante pisos y restos mayores. Los cortes se desempatan por identificador y el remanente va al final.

Con 9 M de detrito y 10 E en origen, dos cortes reciben 4 M cada uno. El primero lleva 5 E, el segundo 4 E y queda 1 M/1 E en origen. El libro cierra **9 M y 10 E** con cero calor y cero entradas o salidas externas. El débito y el crédito de cada cruce son el mismo asiento. `chemical-ledger.ts` valida el lote de cruces contra el plan de apertura, aplica todos los débitos antes de acreditar y concilia por hábitat, corte y edificio. El transporte ocurre antes de los aportes y conversiones explícitos de la hora. Una llegada puede financiar una conversión local posterior. Sólo puede financiar otro cruce a partir de la hora siguiente.

## Proyección y reanudación

`chemical-snapshot.ts` verifica que ambos mundos compartan semilla, regiones, puertos y capacidades finas. Usa la intersección de regiones para repartir masa seca, agua y minerales. La energía se reparte según la masa orgánica ya asignada. En el fixture, un hábitat con 1 M/7 E se divide en tres. Sólo el primer destino conserva 1 M/7 E. Las otras dos partes reciben cero energía. El calor acumulado se atribuye por el mismo solapamiento de regiones y continúa registrado como disipación. La fusión restaura los totales, la cuota usada y la hora. La mezcla pierde información sobre el reparto original, por lo que una fusión seguida de una división conserva totales y puede cambiar la distribución local.

`E1-Chemical-Transport/1` firma las reglas, permeabilidades y declaraciones completas de fuentes. La integridad cubre semilla, generador, época, barreras, hora, saldos, calor y medidores. Restaurar requiere el mismo manifiesto y la misma época. Aplicar una barrera requiere proyectar explícitamente antes de guardar la nueva época. Los formatos B1/B2/C/D se rechazan en el lector químico y se preservan sus lectores históricos.

## Verificación y límites

- `npm run check` pasó **115 pruebas**, incluidas las 32 del libro de la etapa 1 y 12 nuevas. `npm run build` terminó correctamente. Pruebas locales con Node 24.22.3.
- Los fixtures breves cubren cortes competidores, saturación, caudal cero por bloqueo, detrito indivisible, split/merge, calor, cuotas, orden de inserción, checkpoints manipulados y replay byte a byte. Se probaron cierres y reanudación sobre grafos Jenga generados para `mansion` y `zz`, además de tres fixtures sintéticos.
- Se contrastaron las huellas SHA-256 de libros y guardados horarios E1-B1/B2 frente a `9eb2315` en tres semillas y 12 horas por motor y semilla. La consulta de checks remotos devolvió HTTP 403, así que el estado de **Workers Builds** quedó sin verificar.
- La proyección visita las regiones del edificio para calcular solapamientos. El cálculo de flujo visita cortes incidentes a hábitats con cuentas de apertura. No se midió rendimiento bajo carga. La mezcla perfecta y el desempate estable son convenciones del libro, con posibles sesgos locales de redondeo. Los fixtures verifican contabilidad y persistencia física.

[Módulo del libro](../src/ecology/chemical-ledger.ts) · [Plan de transporte](../src/ecology/chemical-transport.ts) · [Proyección y lector](../src/ecology/chemical-snapshot.ts) · [Pruebas](../src/ecology/chemical-transport.test.ts)
