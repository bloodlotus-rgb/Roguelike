# Refugio mínimo de micelio · Fase B

**Recomendación: descartar la variante como regla de E1.** El remanente siguió vivo en situaciones donde antes las presas podían consumirlo. La protección eliminó la reproducción sostenida de las presas en los dos controles que la demostraban y no sostuvo a ningún cazador.

## Comparación emparejada

Cada celda muestra **original → refugio**. Los agotamientos son transiciones locales de tejido fúngico positivo a cero por ramoneo, incluida la materia cobrada al nacer. Los nacimientos T4 pertenecen a las últimas 2.190 horas. Las parejas son pares disjuntos de presas vivas en una misma región fina al cierre. La hora de extinción es la primera con censo global de presas igual a cero. El guion indica que aún quedaban presas al año.

| Semilla | Espacio | Cazadores iniciales | Agotamientos por ramoneo | Presas muertas por alimento | Nacimientos de presas | Nacimientos T4 | Presas / parejas al cierre | Hora de extinción | Capturas |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mansion | recinto | 0 | 17 → 0 | 16 → 8 | 10 → 2 | 0 → 0 | 0/0 → 0/0 | 300 → 384 | 0 → 0 |
| mansion | edificio | 0 | 70 → 0 | 32 → 6 | 27 → 0 | 0 → 0 | 0/0 → 0/0 | 1320 → 360 | 0 → 0 |
| mansion | recinto | 2 | 3 → 0 | 4 → 4 | 2 → 1 | 0 → 0 | 0/0 → 0/0 | 144 → 144 | 4 → 3 |
| mansion | edificio | 2 | 245 → 0 | 2 → 5 | 1 → 0 | 0 → 0 | 1/0 → 0/0 | — → 72 | 3 → 1 |
| estirpe | recinto | 0 | 459 → 0 | 191 → 6 | 188 → 1 | 46 → 0 | 3/1 → 1/0 | — → — | 0 → 0 |
| estirpe | edificio | 0 | 304 → 0 | 352 → 7 | 353 → 2 | 92 → 0 | 7/3 → 1/0 | — → — | 0 → 0 |
| estirpe | recinto | 2 | 5 → 0 | 3 → 4 | 3 → 1 | 0 → 0 | 0/0 → 0/0 | 216 → 144 | 6 → 3 |
| estirpe | edificio | 2 | 9 → 0 | 5 → 4 | 6 → 1 | 0 → 0 | 0/0 → 0/0 | 288 → 144 | 7 → 3 |
| zz | recinto | 0 | 17 → 0 | 16 → 8 | 10 → 2 | 0 → 0 | 0/0 → 0/0 | 300 → 384 | 0 → 0 |
| zz | edificio | 0 | 18 → 0 | 17 → 7 | 11 → 1 | 0 → 0 | 0/0 → 0/0 | 456 → 360 | 0 → 0 |
| zz | recinto | 2 | 3 → 0 | 4 → 4 | 2 → 1 | 0 → 0 | 0/0 → 0/0 | 144 → 144 | 4 → 3 |
| zz | edificio | 2 | 5 → 0 | 3 → 4 | 1 → 1 | 0 → 0 | 0/0 → 0/0 | 144 → 144 | 4 → 3 |

## Efectos y límites

| Total de los 12 escenarios | Original | Refugio |
|---|---:|---:|
| Agotamientos por ramoneo | 1155 | 0 |
| Agotamientos por otros procesos | 428 | 5 |
| Rebrotes de 1 a más de 1 por crecimiento | 1191 | 64 |
| Rebrotes después de que una presa dejó una unidad | 142 | 37 |
| Nacimientos de presas | 614 | 13 |
| Nacimientos de presas en T4 | 138 | 0 |
| Horas-individuo de cazador con al menos una presa local al cierre de la hora | 1992 | 1200 |
| Horas-individuo totales de cazador al cierre de la hora | 2868 | 2004 |
| Capturas de presas | 28 | 16 |
| Cazadores muertos por falta de alimento | 12 | 12 |
| Nacimientos de cazadores | 0 | 0 |

El beneficio comprobado es específico: el ramoneo dejó de eliminar la última unidad establecida. Para la presa, un hábitat con sólo esa unidad quedó alimentariamente agotado. En estirpe sin cazadores esto dejó una presa sin pareja en ambos espacios. Los recuentos de rebrotes, muertes y capturas dependen también de cuántos consumidores siguieron vivos. Las horas de coincidencia miden oportunidad local según el contrato del hábitat y no garantizan una captura. Estos resultados se limitan al censo, suministro y tres semillas probados.

## Regla y verificación

La base es el PR #63 en `477185fe247669a07e83316a86932ab73e6b7518`. El cuarto argumento de `foundWeb` activa el experimento. La última unidad sigue dentro de `fungalBiomass`. El límite se evalúa antes de cada débito de tejido por mantenimiento o reproducción de presas dentro de un hábitat. El movimiento conserva la señal de alimento de #63. La variante usa la versión firmada `E1-D/1-mycelium-refuge-1`. El control sigue escribiendo `E1-D/1` y los lectores históricos reanudan con la regla original.

Cada pareja partió de los mismos seis fundadores de presas y cero o dos cazadores. Usó la cuenca, los conectores y el reloj de la fase A durante 8.760 horas. Las auditorías reconciliaron el libro de cada cuenta, las conversiones de materia, las entradas y salidas de agua y energía, la capacidad y los cruces físicos en las 210.240 horas de las 24 trayectorias principales. En todas se reconstruyó el estado desde JSON en las horas 48 y 4.380. Coincidieron todos los asientos posteriores y los checkpoints de comparación con la ejecución continua.

Los 12 controles también se ejecutaron sobre un archivo limpio del commit base. Por escenario coincidieron el SHA-256 de todos los libros horarios ordenados y la firma final del snapshot. Pasaron las 77 pruebas de la rama y el build con Node 24.

```sh
npm run check
npm run build
node scripts/mycelium-refuge.ts
```

Los resultados incluyen, por escenario, las causas de muerte, extinciones locales de presas entre cierres horarios, extinción global, nacimientos por trimestre, disponibilidad local para cazadores y firmas de regresión. [Datos JSONL](benchmarks/e1-refugio-micelio.jsonl)
