# El edificio (propuesta v1)

> Estado: **rumbo aprobado**; el detalle sigue siendo **[Propuesta]**. Reemplaza a la V5 de `docs/voxeles.md`.

## Decisiones

- **Finito y enorme, con fondo**: ~1000 × 1000 casillas y ~600 m de hondo, con la raíz de la maldición como meta. Inexplorable en la práctica. Cambia el "la profundidad no tiene techo" del concepto.
- **Plan de un tirón, detalle derivado**: el plan entero se decide al empezar; los vóxeles de cada sector salen de él cuando hacen falta, siempre iguales.
- **Zonas por historia (estratos)**: épocas que se cavan unas a otras.
- **Orden**: V3 y V4, después Ed1 a Ed5.

## Tu idea, en pocas palabras

- El mapa entero se genera **al empezar, de un tirón**, en vóxeles. Es tan grande que **no se termina de explorar**.
- **Sectores tridimensionales** en lugar de niveles.
- Los sectores se agrupan en **zonas únicas**, cada una con sus vóxeles y su arquitectura.
- Se arma **como un jenga**: **bloques prearmados** (hechos a mano) y **bloques procedurales** que los conectan, todo en un gran procedimiento inicial.

Me encanta. Le da a la mazmorra lo que hoy le falta: es un solo lugar, con geografía propia y memoria, y no una pila de niveles sueltos. Abajo, cómo lo haría y qué cambia.

## El problema del tamaño, y cómo resolverlo sin perder la idea

Un nivel de hoy (170 × 130) tiene unas 22 mil columnas. Un edificio "inexplorable" tiene cientos de veces eso, con muchos pisos encima de cada casilla. **No entra en la memoria de un celular**, ni se genera en un tiempo razonable.

La salida: **el plan se decide entero de un tirón, el detalle se deduce de él.**
- Al empezar se genera el **plan completo**: zonas, sectores, bloques, conexiones y catástrofes. Es poco dato y tarda un segundo.
- Los **vóxeles de cada sector** salen después, de una fórmula fija: el plan y la semilla. Se generan cuando el héroe se acerca y se descartan cuando se aleja.
- Como el resultado es siempre el mismo, **da igual que si se hubiera generado todo junto**. El mapa queda "codificado" en el plan.
- Se guardan **solo los cambios** de la familia: puertas forzadas, obras, derrumbes despejados.

La clave para que los sectores se puedan generar por separado: el plan fija sus **bordes**. Fija por dónde entra cada pasillo, cada escalera y cada río, y a qué altura. Cada sector cumple su contrato con los vecinos sin necesitar verlos.

## Escalas

| Escala | Qué es | Tamaño **[Supuesto]** |
|---|---|---|
| **Edificio** | todo, debajo de la mansión | ~1000 × 1000 casillas, ~600 m de hondo |
| **Zona** | una época del edificio, con su arquitectura | varias decenas de sectores |
| **Sector** | un cubo del mapa, la unidad de generación y de dibujo | 48 × 48 casillas × ~12 m (3 o 4 pisos) |
| **Bloque** | una pieza del jenga: una sala, una locación, una escalera, un pozo | de 1 a varios sectores |
| **Vóxel** | la columna de tramos de la V1 | 1 casilla |

## El gran procedimiento (en orden)

1. **La silueta**: la forma del edificio entero. Por ejemplo, angosto arriba, debajo de la mansión, y cada vez más ancho y desordenado hacia abajo, como raíces.

2. **La historia (estratos)**. El edificio no se construyó de una vez: es la **suma de épocas**, cada una encima o adentro de la anterior. Lo más hondo es lo más viejo y lo más raro.
   - Cada época es una **zona**, con su paleta de vóxeles (piedra labrada, ladrillo, madera, hierro, roca viva, hueso), sus bloques, su luz y sus horrores.
   - Una época **cava a través** de las anteriores y las reusa. Así, una cripta corta una cisterna más vieja, o una mina atraviesa una biblioteca hundida.
   - Eso hace que **cada edificio sea único**: no cambian solo las piezas, cambia cómo se cruzan las épocas.

3. **La columna vertebral**: el recorrido principal desde la mansión hasta lo más hondo, pasando por todas las zonas.
   - Es un grafo de **lugares clave**: las puertas entre zonas, los **hitos** (lugares enormes que se ven de lejos) y los puestos.
   - Garantiza que todo sea alcanzable; lo demás cuelga de ella.
   - Acá van los **cerrojos y las llaves** (A2), entre zonas.

4. **El jenga**: se colocan los bloques.
   - Primero los **prearmados** (locaciones 3D hechas a mano, con varios pisos), anclados a la columna vertebral.
   - Después los **procedurales**, que unen los anteriores:
     - pasillos y túneles;
     - escaleras, rampas, pozos con escalerilla, puentes;
     - salones de relleno.
   - Los conectores se **enrutan en 3D**: buscan camino por la roca con pendiente máxima, y donde hay que subir ponen escaleras.

5. **Las catástrofes** desarman el jenga:
   - **Derrumbes**: un bloque que queda **sin apoyo** se cae. Deja un pozo vertical que atraviesa pisos y una montaña de escombros abajo. Son atajos peligrosos.
   - **El nivel freático**: debajo de cierta altura, todo lo abierto se **inunda**. Hay sectores enteros bajo el agua y ríos que bajan por las escaleras.
   - **Raíces y cuevas** que se comen la arquitectura, **incendios** que dejan todo negro, **galerías de saqueadores** que cruzan las épocas.

6. **El reparto**: luces de la mazmorra, loot, puestos, horrores y su densidad, según la profundidad y la zona.

## Ideas de zonas (de arriba hacia abajo)

Diez épocas posibles; cada edificio usaría algunas, en un orden distinto y con cruces distintos:

- **Bodegas** de la mansión: ladrillo y madera, barriles, poco peligro.
- **Cripta de la familia**: nichos, osarios, sarcófagos, capillas.
- **Cisternas**: bóvedas sobre columnas, agua quieta, canales.
- **Fundición**: hierro, chimeneas que suben muchos pisos, cadenas, calor.
- **Biblioteca hundida**: galerías de varios pisos con balcones, estantes, escaleras de caracol.
- **Minas** de los que cavaron antes: puntales de madera, rieles, pozos con malacate.
- **Ciudad enterrada**: calles, casas, plazas bajo un techo de roca.
- **Catedral invertida**: una nave gigante que cuelga hacia abajo, con puentes.
- **Cuevas vivas**: roca natural, ríos, abismos.
- **La raíz de la maldición**: lo más hondo, con una arquitectura que no es humana.

## Qué cambia en el juego

- **Nivel → sector y zona**:
  - la profundidad pasa a medirse en metros, y la dificultad sube con ella;
  - el nombre de la zona aparece al entrar.
- **Bajar**: no hay "la escalera del nivel". Se baja por escaleras, rampas, pozos, derrumbes, ríos y caídas (V3).
- **Cerrojos y llaves**: entre zonas y en los atajos.
- **Campamentos y puestos**: lugares del mapa 3D, sin cambios de reglas.
- **Caídos (jefes)**: en el sector donde murieron.
- **Agua**: un nivel freático y corrientes en vez de inundaciones por nivel.
- **Mapa**:
  - cortes por altura (el piso donde estás, con los de arriba y abajo en tenue);
  - una vista de la zona entera de lado.
- **Obras**: cobran más sentido. Una escalera de la familia que baja kilómetros es domar el edificio.
- **Guardado**: versión nueva; las dinastías anteriores se apartan otra vez.

## Riesgos

- **Orientarse en 3D**: perderse es parte de la gracia, pero no frustrar. Se cubre con hitos, el mapa por cortes y las marcas de tiza.
- **Rendimiento**: generar y dibujar por sectores alrededor del héroe, en el celular. Se mide en cada etapa.
- **Alcance**: es reescribir el generador. Lo de hoy (salas, pasillos, terrazas, ríos, locaciones, piezas) se reusa adentro de los sectores.

## Etapas propuestas

La V3 (cuerpos en 3D) y la V4 (caminos y vista en 3D) hacen falta igual. Después, en lugar de la V5:

- **Ed1 · Sectores**:
  - el mundo pasa a ser un solo espacio de vóxeles partido en sectores, generados cuando hacen falta, siempre iguales;
  - dibujo y simulación por sectores alrededor del héroe;
  - el generador de hoy llena cada franja, para que el juego siga andando.
- **Ed2 · El plan**: silueta, épocas y zonas, columna vertebral, pasos entre zonas.
- **Ed3 · Bloques**:
  - el formato 3D de las locaciones (una planta por altura, con conectores marcados);
  - la primera tanda de prearmados por zona;
  - los conectores procedurales en 3D.
- **Ed4 · Catástrofes**: derrumbes por apoyo, nivel freático, raíces e incendios, hitos.
- **Ed5 · El juego en el edificio**: mapa por cortes, llaves, campamentos, caídos, guardado.
