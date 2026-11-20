# Una mazmorra tridimensional y viva (propuesta v1)

> Estado: **propuesta para conversar**. Lo marcado **[Propuesta]** es mío; las **Preguntas** del final definen el alcance.

## La idea

Hoy cada nivel es una planta suelta: bajás por una escalera y aparecés en otro mapa sin relación con el anterior. La propuesta es que la mazmorra sea **un solo edificio hundido en la tierra**. Los niveles están **apilados en el mismo espacio**, lo de arriba está literalmente arriba, y las cosas atraviesan los pisos: escaleras que bajan de verdad, pozos por los que se ve el piso de abajo, agua que cae y va inundando lo que hay debajo.

Una mazmorra que **cambia con el tiempo** (días y generaciones) y que se siente habitada por algo más que los horrores.

## 1. Niveles alineados en vertical

- Cada nivel ocupa el mismo espacio que el de arriba. **La escalera de bajada de un nivel cae justo encima de la llegada del siguiente.** El pozo de un nivel cae justo sobre un punto del de abajo.
- La generación de cada nivel tiene en cuenta al de arriba: lo que atraviesa (escaleras, pozos, ríos, salas de doble altura) **coincide**.
- **Salas de doble altura**: algunas salas grandes ocupan dos niveles. Desde arriba se ven como un balcón o una galería que da al vacío; desde abajo, como una nave alta con la galería arriba. Se puede caer (o bajar con soga).

## 2. Escaleras físicas

- Las escaleras dejan de ser una casilla con un botón. Son **un tramo de escalones que baja de verdad**, de varias casillas, en un pasillo o una sala.
- Se baja **caminando, sin cortes**: mientras bajás ves cómo se abre el nivel de abajo y se cierra el de arriba. El cambio de nivel en la lógica pasa al pie de la escalera.
- Las escaleras son lugares de peligro: estrechas, a media luz, y lo que te persigue te sigue por ellas. **[Propuesta]** Los horrores pueden cambiar de nivel por las escaleras.
- **Escaleras de caracol** en torres que atraviesan varios niveles: un atajo vertical como el de la soga, pero fijo.

## 3. Ver el piso de abajo

- **Pozos, grietas, balcones y escaleras abiertas** dejan ver el nivel de abajo.
- Abajo está oscuro: solo se ve **lo que tiene luz**. La antorcha que dejó tu abuela, el fogón de un campamento, los ojos de un horror, el brillo del agua. Asomarse a un pozo y ver una luz lejana tiene que dar escalofríos.
- Tirar algo por un pozo (un frasco encendido, una piedra) para ver qué hay. **[Propuesta]** Un frasco de aceite tirado se rompe y arde un rato abajo.

## 4. Accidentes del terreno

- **Alturas dentro de un nivel**: terrazas, plataformas y desniveles. Se sube por rampas y escalones. Se puede **saltar hacia abajo** desde poca altura; de más alto, con daño.
- La altura importa en combate: desde arriba se ve más lejos y los horrores tienen que rodear para alcanzarte.
- **Abismos** que cortan una sala o un pasillo: se cruzan por un **puente** (que se puede romper o construir con tablas) o se rodean.
- **Derrumbes**: escombros que tapan pasillos (se despejan con tiempo) y **techos que se caen** abriendo un pozo nuevo al nivel de abajo.
- **Columnas, raíces, estalactitas** y **cuevas naturales** que rompen las salas rectangulares.

## 5. Agua

- **Agua poco profunda**: frena, hace ruido al pisar y apaga lo que cae en ella. Los Rastreros la evitan.
- **Agua profunda**: se cruza **nadando**, despacio, gastando mucha sed y hambre. **La lámpara se apaga si te hundís**. Lo que llevás puede mojarse: la leña mojada no prende, las raciones se arruinan.
- **Ríos subterráneos** que atraviesan un nivel con corriente: te arrastran si caés.
- **Cascadas**: donde un río encuentra un pozo, **el agua cae al nivel de abajo**. Se ve y se oye desde los dos lados.
- **Inundaciones que avanzan**: el agua que cae **va llenando las salas de abajo** con los días. Una sala seca hoy puede estar con agua a la rodilla en tres días y tapada en una generación. Los campamentos y las obras pueden perderse bajo el agua.
- Se puede **cambiar el curso**: tapar una grieta con escombros o tablas, abrir un desagüe, romper una presa. La familia va domando o desatando el agua.
- El agua es también **recurso**: las cascadas dan agua limpia; los charcos estancados, turbia.

## 6. Una mazmorra viva

- **Corrientes de aire** que hacen titilar la llama hacia una salida, una grieta o un pozo. Es una pista para orientarse.
- **Sonidos de abajo**: pasos, agua, gruñidos que llegan por los pozos y las escaleras.
- **Fauna menor**: ratas que huyen de la luz y comen lo que dejás, murciélagos que se espantan con ruido, insectos en el agua. No pelean; delatan cosas.
- **Hongos que brillan** apenas en las cavernas, raíces que bajan desde arriba, goteras que aparecen después de una inundación.
- **La maldición avanza**: con las generaciones, algunas zonas se **corrompen**. La tinta trepa las paredes, el aire pesa, los horrores son más fuertes. Liberar a los jefes la hace retroceder (encaja con la Etapa B).

## 7. Lugares únicos

Para romper la monotonía de la generación (lo charlamos hace tiempo): **piezas armadas a mano** que se colocan al azar.

- Una **capilla** con un altar (aceite y velas), un **osario** de paredes de huesos, una **cisterna** inundada, un **puente colgante** sobre un abismo de varios niveles, una **biblioteca** derrumbada, un **pozo de los deseos** que conecta cinco niveles, la **cripta** de alguien más antiguo que tu familia.
- Cada una aparece cada tanto en ciertas profundidades y es un hito en el mapa heredado.

## Técnica

- La lógica sigue siendo una **grilla** por nivel, pero cada casilla suma **altura** (0 a 3) y **agua** (nada, poca, profunda, corriente). Movimiento, vista, luz y caminos de los horrores tienen en cuenta las dos.
- La **generación** pasa a ser por pila: cada nivel recibe del de arriba qué cosas lo atraviesan y las respeta. Sigue siendo toda determinista por semilla.
- El **estado que cambia** (agua acumulada, derrumbes, puentes rotos, corrupción) se guarda en la dinastía por profundidad, con versión y migraciones.
- El **dibujo** apila niveles: se muestra el actual entero y del de abajo solo lo que se ve por los huecos, con su luz. Las escaleras físicas muestran los dos niveles mientras se bajan.
- **Rendimiento**: dibujar dos niveles a la vez cuesta; se dibuja del de abajo solo un recorte alrededor de los huecos visibles.

## Etapas

**[Propuesta]** Es la etapa más grande hasta ahora. La partiría así:

- **N1 · Pila y escaleras**: niveles alineados, escaleras físicas que se bajan caminando, pozos y balcones que dejan ver el piso de abajo, salas de doble altura.
- **N2 · Terreno**: alturas dentro del nivel, rampas, saltos, abismos con puentes, derrumbes, cuevas.
- **N3 · Agua**: agua poca y profunda, nadar, ríos, cascadas entre niveles, inundaciones que avanzan y se pueden desviar.
- **N4 · Vida y lugares**: corrientes de aire, sonidos de abajo, fauna menor, hongos, corrupción que avanza, lugares únicos armados a mano.

## Preguntas

1. **Partidas guardadas**: cambiar la generación cambia la forma de todos los niveles. Lo explorado, los campamentos y las obras de tu partida actual quedarían en lugares que ya no existen. ¿Arrancamos de cero (abandonar la estirpe), o lo cuento en el juego como **"un temblor reacomodó la mazmorra"** (se conservan la familia y la crónica, pero se pierden el mapa, los campamentos y las obras)?
2. **Orden**: ¿esto va antes o después de los jefes (Etapa B)? Mi recomendación: **antes**, al menos N1 y N2, porque los jefes viven en esos niveles y conviene que la forma de la mazmorra esté resuelta.
3. **Agua profunda**: ¿nadar es posible (con su costo y la lámpara apagada) o el agua profunda es un obstáculo que solo se rodea o se cruza con puente?
4. **Caídas**: ¿caer por un pozo o saltar a un nivel inferior sin soga es posible (con daño, quizás mortal en caídas largas)?
5. **Horrores entre niveles**: ¿te siguen por las escaleras y pueden subir desde abajo?
6. **Corrupción que avanza**: ¿te interesa ya, o queda para cuando lleguen los jefes?
