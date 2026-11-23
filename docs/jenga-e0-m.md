# Jenga E0-M — macropiezas que organizan una zona completa

**Estado:** prototipo estructural en PR #52, apilado sobre E0 (PR #51). CI de GitHub con Node 24 aprobó 37 pruebas, compilación y diagnóstico `estirpe`. No es arte vóxel ni validación universal de semillas.

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

**Pendiente antes de fusionar:** ampliar a 100 semillas y resolver las fallas que surjan, si las hay. El PR permanece en borrador.
