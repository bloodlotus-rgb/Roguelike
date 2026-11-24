# E1 · Libro químico y aportes físicos

La etapa 1 agrega un libro aislado para registrar materia seca, agua y energía química. Cada débito orgánico identifica su masa y energía. El calor se acumula por hábitat como disipación irreversible. La implementación parte de `fc1c9fac` y se usa mediante fixtures directos. [Contrato #76](https://github.com/bloodlotus-rgb/Roguelike/issues/76) · [Diseño #77](https://github.com/bloodlotus-rgb/Roguelike/issues/77) · [Alcance #78](https://github.com/bloodlotus-rgb/Roguelike/issues/78)

## Esquema

- `chemical-ledger.ts` define existencias de detrito, minerales y agua. Cada hora recibe transacciones completas y ordenadas de entrada, exportación o conversión local con disipación. Se confirma un estado nuevo sólo si toda la hora concilia. El identificador de transacción es único durante la hora. Los stocks y medidores usan enteros seguros y las operaciones intermedias y totales de auditoría usan `bigint`.
- Cada fuente declara origen, extremos del corte Jenga, carga por lote, frecuencia, duración de la ventana y cuota. `chemicalDelivery` prepara una entrada explícita para la próxima hora. La hora 1 abre la primera ventana. El ritmo se recorta al remanente de cuota. Omitir la entrada deja los saldos intactos.
- El libro reutiliza `ports`, `regionToHabitat` y `channelLimit` para comprobar los extremos finos, el corte, su sentido y el paso material. El extremo `fromRegion` identifica el lado interno donde se contabiliza la fuente o la salida. La contraparte se declara fuera del perímetro contable. El extremo lejano del conector no recibe un crédito. El ritmo de la fuente externa se valida con su propia declaración. En esta etapa el corte acredita compatibilidad física y no calcula caudales entre hábitats.
- La auditoría verifica que la apertura y los aportes igualen el cierre y las exportaciones en masa y agua. En química suma además el incremento de calor de la hora. Conciliaciones por corte identifican la contraparte, el sentido y el lote. El auditor reproduce las transacciones y coteja el cierre declarado por hábitat y medidor. La serialización ordenada sirve para comprobar fixtures. [Módulo](../src/ecology/chemical-ledger.ts) · [Pruebas](../src/ecology/chemical-ledger.test.ts)

## Ejemplo auditado

Los siguientes valores son quanta de prueba. El hábitat empieza vacío y admite dos lotes en la primera hora. Registra por separado el sedimento y una segunda exportación. Una conversión local disipa una unidad química y conserva la masa.

| Asiento | Materia seca | Energía química | Agua | Calor |
|---|---:|---:|---:|---:|
| Entrada de dos lotes | +6 | +6 | +8 | 0 |
| Sedimentación hacia colector declarado | −1 | −1 | 0 | 0 |
| Exportación independiente | −2 | −2 | −2 | 0 |
| Disipación local | 0 | −1 | 0 | +1 |
| Cierre del hábitat | 3 | 2 | 6 | 1 |

La química cierra como **6 = 2 en existencias + 3 exportadas + 1 disipada**. La masa cierra como **6 = 3 + 3** y el agua como **8 = 6 + 2**. El fixture sin fuente conserva **6 de masa seca y 8 de agua**. Tras dos conversiones, sus **12 unidades químicas iniciales** quedan en **5 químicas y 7 de calor acumulado**.

## Verificación

- En Node 24.22.3, `npm run check` pasó 103 pruebas, 32 del libro químico. `npm run build` terminó correctamente. Ambas verificaciones fueron locales.
- Las pruebas comparan el libro ordenado y el cierre al repetir la semilla `mansion` con orden de inserción invertido. También verifican cuota parcial y agotada, ventana cerrada, puertos y barreras, sobregiros, doble débito, saldos sin portador, transacciones incompletas y desbordes. Un fallo deja intacta la apertura.
- La regresión directa de E1-B1 y E1-B2 usa las semillas `mansion`, `estirpe` y `zz`, con 240 horas por motor y semilla. Se comparan las huellas SHA-256 de las líneas serializadas del libro y el guardado de cada hora, incluida la fundación, contra un árbol extraído de `fc1c9fac`.

## Límites para revisión

El llamador debe mantener el mismo grafo y manifiesto de fuentes durante el replay de este libro. La etapa 2 deberá definir cómo se vinculan a una época estructural y cómo se proyectan juntos materia y energía al dividir o unir hábitats. También queda pendiente el reparto entero entre varios cortes y la representación de sedimentos con distinta composición. El módulo recibe salidas y reacciones explícitas y verifica su contabilidad. Las cantidades y rendimientos ecológicos quedan fuera de este fixture.
