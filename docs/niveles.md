# Una mazmorra tridimensional y viva (propuesta v1)

> Estado: **aprobado**. Se implementa en cuatro etapas (N1 a N4), todas antes de los jefes.

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

## Decisiones

1. **De cero**: las partidas guardadas anteriores no se migran; se arranca una estirpe nueva.
2. **Orden**: N1, N2, N3 y N4, todas antes de los jefes.
3. **Agua profunda**: se rodea. **[Supuesto]** Más adelante, nadar puede ser la pasiva de alguna clase.
4. **Barrancos**: **[Supuesto]** saltar barrancos (abismos angostos) puede ser la pasiva de una clase; lo resolvemos en N2.
5. **Horrores entre niveles**: te siguen por las escaleras, y suben o bajan si te ven, te oyen o ven tu luz.
6. **Corrupción**: queda para los jefes.

## Cómo se arma la escalera (N1)

- Una escalera es un **tramo de tres escalones** con una casilla de entrada arriba y una de salida abajo, encerrado entre paredes: un pozo de escalera de 3 × 5 casillas.
- En el **nivel de arriba** se entra por la casilla alta y se baja por los escalones; la casilla de abajo es pared.
- En el **nivel de abajo** el mismo tramo sube desde la casilla baja, que da a la sala de llegada; la casilla alta es pared.
- Bajar o subir es caminar: al pasar el último escalón cambiás de nivel sin cortes.
- Desde la profundidad 1, la escalera de subida lleva a la mansión.

## N1 implementada

- **Pila**: cada nivel se genera debajo del anterior. La escalera de bajada de un nivel cae sobre la sala de llegada del de abajo, en el mismo lugar; el pozo cae sobre una sala de abajo (donde llega la soga).
- **Escaleras físicas**: un pozo de escalera de 3 × 5 casillas con tres escalones. Se baja y se sube caminando, sin cortes; el héroe y los horrores van a la altura del escalón. Desde la profundidad 1, la escalera de subida lleva a la mansión.
- **Te siguen**: los horrores que te cazan de cerca bajan o suben la escalera detrás tuyo un momento después.
- **Galerías**: la mitad de los niveles tienen una sala de doble altura: pasillo con baranda junto a las paredes y vacío en el medio sobre un salón del nivel de abajo. Por el vacío se ve, pasa la luz y pasan los escupitajos, pero nadie camina.
- **Ver abajo**: por la escalera, el pozo y las galerías se ve el nivel de abajo, iluminado por tu llama (que llega un piso más abajo, sin alcanzar más lejos en el plano).
- Las partidas anteriores se descartan: se empieza una estirpe nueva (guardado versión 5).
- **Pendiente para N4**: que los horrores de otro nivel te noten por los huecos (te ven, te oyen o ven tu luz) y vengan; tirar un frasco encendido por un pozo.

## N2 implementada

- **Cuevas y túneles**: un tercio de los pasillos son túneles naturales que serpentean en vez de ir en ángulo recto.
- **Terrazas**: algunas salas grandes tienen una franja elevada contra una pared. Se sube **solo por una rampa**; se **baja saltando** desde cualquier borde, sin daño (la altura es baja). Los horrores siguen la misma regla: desde arriba tenés que rodear para que te alcancen.
- **Abismos**: algunas salas tienen una grieta de una o dos casillas de ancho, de pared a pared, sin fondo a la vista. Por encima se ve y pasa la luz; nadie cae (es un borde, como una pared). Si la grieta partiría el nivel, hay un **puente viejo** de la mazmorra; si no, a veces hay uno y a veces hay que rodear.
- **Puentes de la familia**: con unas **tablas** al borde de un abismo de hasta dos casillas se tiende un puente (las mismas tablas sirven para barricar una entrada; al borde de un abismo hacen puente). El puente queda para la familia y se gasta con los años.
- **El saqueador salta**: esquivando hacia un abismo de una casilla, lo cruza de un salto. **[Supuesto]** Es parte de su pasiva (Ojo de rata) y solo vale para una casilla.
- **Derrumbes**: algunos pasillos rectos están tapados por piedras. Siempre hay otro camino, así que un derrumbe es un rodeo o un **atajo para cavar**: se despeja con el botón de acción, quieto unos seis segundos, gastando hambre y sed como al pelear. **Hace ruido**: cada golpe despierta a los horrores a unas nueve casillas, y si uno llega al lado se corta el trabajo. Lo despejado queda despejado para siempre en la estirpe.
- **[Supuesto]** Quedan para más adelante: techos que se caen abriendo pozos nuevos, puentes que se rompen solos y caer al abismo.

## N3 implementada

- **Agua poca y profunda**: cada casilla puede tener agua baja (se camina) o profunda (se rodea, como un borde).
  - El agua baja frena al héroe y a los horrores.
  - Cada paso en el agua baja salpica y despierta a lo que esté cerca, a unas 4 casillas.
  - Los **Rastreros no entran al agua**: esperan en la orilla. El agua sirve de refugio.
- **Pozas y charcos**: algunas salas tienen una poza, con orilla baja y centro profundo. Si el centro profundo cortaría el paso, queda bajo. Donde gotea se junta un charco.
- **Ríos**: algunos niveles los cruza un río de lado a lado, que corta roca y salas por igual.
  - Tiene un cauce profundo de una o dos casillas entre orillas bajas por las que se vadea.
  - Donde el río aislaría algo hay un **vado** (agua baja de lado a lado); a veces hay uno más.
  - La corriente se dibuja con espuma que corre aguas abajo.
- **Cascadas**: la mitad de los ríos no llegan al otro lado. Se meten por un **sumidero** y caen al nivel de abajo.
  - Abajo hay una sala con una **poza** donde cae el agua.
  - El agua de la cascada es **limpia**: junto con las fuentes, es la única. Las pozas, los ríos y los charcos dan agua turbia.
  - El estruendo se oye a unas 10 casillas, más fuerte cuanto más cerca.
  - En el mapa tiene marca propia.
- **Inundaciones**: la poza bajo una cascada **crece**.
  - Sube cada amanecer y más entre generaciones.
  - El agua baja avanza por el piso desde la poza, nunca sobre escaleras ni puentes.
  - Cuando subió mucho, la sala de la poza se vuelve profunda, sin cortar nunca el camino.
  - Lo que alcanza el agua se pierde: los **campamentos** se inundan, las **antorchas** se ahogan y la **tiza** se borra.
  - No se puede acampar ni plantar una antorcha en el agua.
- **Tapar el sumidero**: con **tablas** junto al sumidero se hace un dique.
  - El río deja de caer: abajo no hay cascada, ni agua limpia, ni estruendo.
  - La inundación de abajo **baja** cada amanecer y entre generaciones.
  - El dique se gasta con los años y hay que rehacerlo.
- **[Supuesto]** Para más adelante:
  - Nadar, como pasiva de alguna clase.
  - Que el agua apague lo que cae en ella.
  - Que lo que llevás se moje.
  - Que el río te arrastre.
  - Abrir desagües o romper presas.
