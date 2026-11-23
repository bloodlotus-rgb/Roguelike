# Jenga E0 — Contrato espacial previo a simulación

La implementación y las comprobaciones de este contrato se describen en el [informe de E0](jenga-e0.md).

## Fuente única de verdad
`src/core/plan.ts` define estructura global; `src/core/jenga.ts` define la disposición de piezas y aberturas. El grafo ecológico **se deriva** de esos datos; el futuro generador vóxel respeta las mismas aberturas y rutas. No crear un grafo aleatorio paralelo.

## Escalas
- Plan: áreas, zonas, plantas, origen, conexiones entre zonas y umbrales.
- Pieza: prisma orientado y ocupado en celdas Jenga (6 m de lado).
- Puerto/conector: anclaje geométrico en una cara, con dimensiones, elevación, accesibilidad, dirección, estado y tipo.
- Grafo: nodos habitables y aristas por conectores físicamente realizables.
- Vóxel/sector: refinamiento posterior de la arquitectura estructural, conservando conectores y accesibilidad prometida.

## Propuesta de conector
- Identidad estable: semilla, zona, pieza, número de conector.
- Coordenadas y orientación globales; límites dimensionales y altura libre.
- Tipo: puerta, abertura, escalera, pozo, fisura, conducto, puente, cauce, brecha.
- Estado: libre, cerrada, trabada, reforzada, rota, anegada, bloqueada.
- Modos compatibles según volumen y condiciones: `walk`, `crawl`, `climb`, `fly`, `swim`, `squeeze`, `break`.
- Capacidad/costo de tránsito: longitud, pendiente, tamaño efectivo, resistencia, riesgo, dirección; aristas dirigidas cuando corresponda.

## Reglas
1. Toda arista debe corresponder a un puerto físico o conexión local verificable; no saltos entre habitaciones.
2. Dos puertos unidos deben coincidir espacialmente en posición, lado, altura y volumen libre.
3. Las conexiones entre zonas existen en el plan y están reservadas antes de generar los detalles; la losa solo se atraviesa mediante pasos definidos.
4. Las cerraduras jugables no son excusa para suponer vías ecológicas imaginarias: rutas alternativas deben materializarse como fisuras, agua u otros pasos.
5. Los nodos representan espacio accesible para los modos declarados. Si una sala queda partida por abismo o muro, usar subnodos y conexiones internas.
6. No todos los horrores acceden a toda la mazmorra; validar rutas por grupos de movilidad.
7. La ruta del jugador entre mansión y Origen debe existir de manera potencialmente desbloqueable.
8. Los cambios de la dinastía actualizan el estado de aristas y sus efectos sin alterar arbitrariamente la semilla estructural.
9. Se conservan IDs y resultados al guardar/cargar y al activar/desactivar sectores.
10. Igual semilla + reglas + eventos => mismo grafo y misma transición de estado.

## Pruebas E0
- Integridad de coordenadas y acoplamiento recíproco.
- Sin aristas fantasma, diagonales no autorizadas ni pasos que atraviesen roca sellada.
- Rutas jugables desde superficie a fondo, sin bloqueo irreversible por generación.
- Rutas ecológicas reales entre zonas, con locomoción diferenciada.
- Pruebas de puertas, bloqueos, cambios dirigidos, agua y fisuras.
- Equivalencia semilla, serialización y ejecución repetida.
- Lote de semillas y estadísticas de número de piezas, componentes, caminos y cuellos de botella.
- Prueba de realización simplificada de conectores (sin render final).

## Fuera de E0
Poblaciones, evolución, combate, generación final de mallas vóxel, render, logística con unidades, corrientes fluidodinámicas y gestión de refugios.
