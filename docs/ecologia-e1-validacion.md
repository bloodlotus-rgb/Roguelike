# Ecología natural · Viabilidad y rendimiento

El grupo de presas consume hongos y el depredador especialista consume presas. El laboratorio cobra cada comida, nacimiento y cruce físico. Un año tiene 8.760 pasos. Las simulaciones corren sin jugador y comprueban los balances por cuenta, hábitat y hora. Se verifica la continuación después de serializar y reconstruir el censo. En la carga distribuida cada depósito basal y cada fundador se declara en el presupuesto del mismo edificio.

## Experimentos

Se corrieron nueve escenarios por diez años en mansion, estirpe y zz. Ocho emplean el recinto Jenga de E1-B2 y uno el edificio completo. El escenario abierto parte de seis presas, dos cazadores y la cuota anual de E1-B1. Se comparan escasez, bloqueo desde la hora 33, reapertura antes de la hora 97, aislamiento desde la fundación, un solo cazador, diez presas y una perturbación local. La perturbación retorna al detrito el censo de consumidores del sitio seguido antes de la hora 30. Las cuencas de los controles con aporte agotan su presupuesto al año.

En las tres reaperturas las presas recuperaron el sitio en la hora 102, después de extinguirse allí en la hora 36. Con el cierre permanente quedó vacío. La auditoría valida el extremo y perfil de cada cruce. En los recintos abiertos ambos consumidores se extinguieron el primer año. Los tres edificios completos perdieron a sus cazadores durante ese mismo año. El período posterior al agotamiento de la cuenca mide cuánto dura la reserva local.

El factorial anual cruza censo inicial de hongos (4 o 16), presas (2, 4 o 6), depredadores (1 o 2), abertura abierta o sellada y tres semillas. Catorce de las 72 corridas conservaron presas al año. Cuatro registraron nacimientos de depredadores. Los 72 perdieron el último depredador antes del año. La mayor persistencia del cazador fue de 1.584 horas. La vulnerabilidad de los especialistas depende además de la supervivencia local de sus parejas y la dieta disponible. La tasa ensayada y el censo inicial no son parámetros definitivos.

## Carga

Procesos independientes, Node 24, 96 horas en mansion, dos presas y dos cazadores por región inicial, reserva basal finita por sitio. La búsqueda desde la entrada recorre únicamente conectores compatibles con ambos perfiles. Al solicitar mil focos alcanzó 554 hábitats adicionales admisibles. Se midió toda esa componente.

| Focos iniciales | Regiones con consumidores, media | Tick p95 (ms) | Auditoría p95 (ms) | Pico RSS (MiB) |
|---:|---:|---:|---:|---:|
| 1 | 1.4 | 0.36 | 0.17 | 477.9 |
| 10 | 16.6 | 0.68 | 0.43 | 496.3 |
| 100 | 144.7 | 1.81 | 0.95 | 512.2 |
| 554 | 623.4 | 7.39 | 6.74 | 516.2 |

El p95 del archivo de escenarios incluye horas posteriores a extinciones. Para estimar costo con población activa se usa la carga distribuida. La memoria de proceso incluye el edificio. La inicialización deja más costo fijo que el paso disperso. No se modificó la geometría en los ensayos.

## Reproducción

```sh
npm ci
npm run check
npm run build
npm run --silent ecology:web -- 87600 matrix mansion estirpe zz
node scripts/food-web-sensitivity.ts mansion estirpe zz
for n in 1 10 100 554; do npm run --silent ecology:web-load -- mansion "$n" 96; done
```

[Escenarios y tiempos de extinción](benchmarks/e1-escenarios.jsonl) · [Factorial anual](benchmarks/e1-sensibilidad.jsonl) · [Carga distribuida](benchmarks/e1-carga.jsonl)
