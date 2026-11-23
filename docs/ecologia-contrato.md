# Estirpe Sim — Contrato ecológico v0.20, síntesis

**Estado:** principios funcionales confirmados; parámetros numéricos pendientes de experimentación.

## Reloj
Una línea temporal de horas ecológicas, reloj reproducible. Correlación inicial a validar: jornada de 17 horas ecológicas de luz y noche de 7 horas, representadas por ~17 y ~5 minutos jugables. Dormir y cambiar de generación avanzan el mismo mundo; 30 días entre vidas es solo hipótesis.

## Redes distintas
Movimiento de criaturas, transporte de recursos, difusión ambiental/corrupción. Una conexión puede dejar pasar agua sin dejar pasar un horror, o viceversa.

## Fauna y recursos
- Entradas limitadas de materia y energía: raíces y aportes de superficie, guano, arrastres orgánicos y fuentes subterráneas justificadas.
- Hongos descomponedores transforman materia orgánica; no generan energía de la nada.
- Invertebrados, roedores y depredadores naturales consumen recursos reales.
- Nacimientos sujetos a nutrición y capacidad; mortalidad, consumo y depredación no pueden exceder recursos disponibles.
- Recolonización solo mediante supervivientes y migrantes por aristas reales. Extinción local permitida.
- Los hábitats poseen humedad, alimento, volumen/capacidad y condiciones relevantes.

## Horrores
- Nuevas cohortes **solo en nodos del Origen** con presupuesto finito de producción. Los caídos familiares son excepción rastreable.
- Cohortes migran por modalidades físicas, pierden recursos y pueden ocupar territorios o morir. Preferencia por profundidad es suave, no prohibición rígida.
- Relación con fauna según especie: depredación, competencia, comensalismo, indiferencia.
- Corrupción independiente de las cohortes; no spawnea monstruos fuera del Origen.

## Cálculo por escalas
Activo: individuos; vecino: cohortes y recursos por nodo; lejano: agregados por hábitat y pasos amplios. Cambiar de escala jamás duplica entidades.
Orden estable por fases ambientales, recursos, reproducción, depredación, migración, producción Origen, corrupción y registro.
PRNG derivado por semilla/sistema/zona/período y orden fijo. Persistencia versionada.

## Validación
- Igual semilla y acciones => resultados idénticos, incluso guardando/reanudando.
- Conteos de recursos, nacimientos, muertes, entradas/salidas y pérdidas conservados.
- Simulación inicial de historia previa, seguida de ventanas de observación para detectar colapsos tardíos.
- Viabilidad significa sostener **funciones ecológicas**, no exigir que sobrevivan todas las especies.
- Pruebas de exterminio local, bloqueo, dique, nocturnidad, migración de custodios, 10 generaciones y lotes de semillas.
- Primer objetivo exploratorio: 100 semillas con >=95% mundos funcionales; fallos inspeccionados y criterios críticos sin excepciones.
- Calibrar sensibilidad primero; algoritmo evolutivo offline solamente si es necesario. Nunca evolución genética de cada horror por defecto.

## Secuencia
E0 grafo Jenga; E1 recursos/fauna; E2 Origen/migración; E3 corrupción/reloj; E4 intervención; E5 calibración.
