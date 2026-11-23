# Jenga E0-M — macropiezas que organizan una zona completa

**Estado:** E0-M integrado en `main` mediante PR #52 (después de E0, PR #51). Node 24 aprobó 37 pruebas y 100 semillas completas. No es geometría vóxel definitiva.

## Razón arquitectónica

Las macropiezas no se pueden tratar como una sala común colocada después de los corredores. Una nave, cisterna monumental o atrio debe reservar todo su volumen, incluidos los huecos y el espacio de conexión, **antes** del crecimiento del resto del Jenga.

Se rescata la intención de `docs/edificio.md`: piezas grandes, atrios de varias plantas y umbrales excepcionales. El PR #48 de Claude resolvía circulación secundaria, pero no había implementado los grandes volúmenes vacíos.

## Primera biblioteca de macropiezas

1. **Galería procesional longitudinal** (`processionalGallery`): ancho de zona menos dos celdas en su eje largo, una celda transversal, altura igual a todas las plantas de la zona. Cada planta tiene camino axial y dos escaleras en extremos. La huella se reserva completa, pero sus pisos se modelan como regiones distintas; no hay «teletransporte» de una punta a la otra.
2. **Atrio monumental** (`monumentalAtrium`): 6×6 celdas y todas las plantas. Tiene balcones de perímetro, dos enlaces verticales y un patio central 4×4 de volumen abierto por planta, registrado como `-2` en ocupación. Esas celdas **no** generan nodos de suelo ni pueden ser ocupadas por otras piezas.
3. **Resto de piezas**: se generan después de las reservas, conservando el crecimiento por circulación y los anillos recuperados del PR #48.

Las dimensiones se expresan en celdas de 6 m. En una zona máxima de 112 celdas de lado, una galería mide 110 celdas de largo (660 m) y atraviesa las cuatro plantas (24 m). El atrio mide 36×36×24 m. Estas son pruebas estructurales deliberadamente extremas; la distribución artística por época queda pendiente.

Se reserva una galería en zonas de tamaño suficiente. En la primera zona de cada área se reserva además un atrio. Su ubicación y orientación son reproducibles con la semilla. Si la reserva falla, el generador falla explícitamente; **no** inventa un grafo conectado por afuera.

## Garantías y límites

- La ocupación distingue `-1` roca disponible, `-2` volumen vacío reservado y `>=0` pieza transitable.
- Los conectores interiores de las macropiezas se declaran celda a celda. Un hueco vertical transitable declarado se traduce en una arista `stairs`; una puerta interior horizontal se traduce en `interior`.
- La topología respeta las cuatro rotaciones. El grafo se deriva del plano, no se genera por separado.
- Se mantiene el límite de **una zona estructural**. Ninguna pieza cruza una losa sellada. Las obras monumentales **entre** zonas requieren un nuevo contrato del plan global con reserva compartida, una decisión distinta de E0-M.
- El vacío central del atrio no genera todavía regiones para vuelo tridimensional: sí bloquea su uso como piso. El vuelo a través de aire libre y las pasarelas suspendidas requerirán geometría navegable y subnodos por altura.
- Los macrobloques ocupan toda su envolvente, pero no equivalen aún a mallas vóxel, columnas estructurales, iluminación, hidrodinámica ni soporte físico de puentes.
- Los costos de rutas siguen siendo cruces del grafo, no tiempo ni desgaste; la ecología requiere una capa de costos y de hábitats.
- El algoritmo cambia el resultado de una misma semilla: persistencia futura debe guardar versión de generación, además de la semilla.

## Validación prevista

- Pruebas Vitest de cuatro orientaciones del atrio, dos de la galería, huecos no transitables, escaleras internas y redundancia ante bloqueos.
- Pruebas de integración de semillas locales y construcción del edificio completo.
- Comprobar repetibilidad, conectividad, memoria, tiempo y ninguna región de suelo concedida sobre un vacío.
- Ampliar a lotes de 100 semillas y registrar fallos y distribución real de macropiezas antes de fusionar.

Comandos previstos:

```bash
npm ci
npm run check
npm run build
npm run --silent jenga:report -- estirpe mansion zz
```

## Ejecución real — CI de GitHub

En el commit `6afd750`, el workflow **Estirpe Sim - TypeScript y Jenga** ejecutó `npm ci`, `npm run check`, `npm run build` y `npm run --silent jenga:report -- estirpe` con resultado correcto.

- **37 tests aprobados**, seis archivos.
- Semilla `estirpe`: 25 zonas, 30 macropiezas (25 galerías y 5 atrios), 320 celdas vacías reservadas, 123.058 regiones, 127.864 conexiones.
- Una componente física, cero errores, y el jugador alcanza el Origen.
- Armado + extracción: 1.615 ms; diagnóstico total: 2.215 ms; pico RSS: 457 MiB en ese proceso.

Los números se refieren exclusivamente a la semilla y entorno de este CI. La comparación con E0 histórico no es un benchmark controlado.

## Lote reproducible de 100 semillas

El workflow [Jenga E0-M — 100 semillas](https://github.com/bloodlotus-rgb/Roguelike/actions/runs/45252905870) terminó correctamente en el commit `256e676`. Cada semilla `e0m-0` … `e0m-99` se ejecutó en un proceso Node independiente, distribuidas en cinco grupos de veinte; así la memoria no se acumula entre generaciones.

| Medida | Resultado en 100 edificios |
| --- | ---: |
| Semillas completadas sin error | 100 / 100 |
| Regiones por edificio | 122.462–123.943 |
| Conectores por edificio | 127.210–128.793 |
| Piezas por edificio | 89.069–90.669 |
| Macropiezas preservadas | 30 / edificio (25 galerías + 5 atrios) |
| Celdas de aire vacío reservado | 320 / edificio |
| Tiempo medio del informe por edificio | 3.366 ms |
| Tiempo máximo del informe | 3.993 ms |
| Pico máximo RSS individual | 489 MiB |

Todas las ejecuciones tuvieron una componente física, ruta jugador-Origen y ruta de la criatura pequeña hasta la mansión. **Esto comprueba los criterios del lote, no demuestra que el vóxel futuro sea automáticamente realizable ni valida el balance ecológico.** No son medidas de un benchmark de hardware aislado.

El lote inicial reveló dos errores resueltos antes del resultado anterior: pérdidas silenciosas de galerías aisladas, y generación ocasional de zonas sin salida. Las macropiezas ahora se conectan al pozo de llegada antes de colocar el relleno secundario; el pozo permite abrir pasos físicos; una macropieza perdida hace fallar la generación; si no cabe una salida convencional, se usa un pozo de reserva conectado físicamente junto a la galería longitudinal.

**Pendientes de diseño para trabajos futuros:** distribución artística de macropiezas, realización vóxel de puentes y pisos, conectividad aérea tridimensional, contratos inter-zona y política de versiones para persistencia. La integración estructural ya está completada.
