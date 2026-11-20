# La Estirpe (Tainted Ancestry) — concepto, borrador v8

> Estado: **borrador para revisar**. Lo marcado como **[Propuesta]** es una sugerencia mía que hay que validar; lo que está en **Decisiones abiertas** todavía no tiene respuesta.

## Pitch

Un roguelike de supervivencia y exploración en tiempo real, para celular y navegador. Bajás a **tu** mazmorra —generada a partir de una semilla y persistente— con un integrante de **tu linaje**. La meta es llegar lo más profundo posible. Si morís, no hay vuelta atrás: pasa una generación, la familia cambia, y el que murió te espera abajo convertido en jefe.

## Lore

Una familia antigua vive en su mansión, construida sobre una mazmorra maldita. Desde hace generaciones, la familia custodia la mazmorra y contiene a las hordas de horrores que surgen de ella. Pero la maldición cobra su precio: cada integrante que muere ahí abajo pasa a engrosar las filas de los malditos.

Esto le da sentido a las mecánicas:
- **La mansión es la superficie**: el lugar seguro donde empieza cada vida.
- **Los caídos se vuelven jefes** porque la maldición los reclama.
- **La noche** es cuando los horrores suben con más fuerza.

**[Propuesta]** Ideas para la mansión:
- **Galería de retratos** como árbol genealógico. Los retratos de los caídos se ennegrecen y se restauran cuando su jefe descansa en paz.
- La crónica familiar y el mapa heredado son libros de la biblioteca de la mansión.
- La tienda la atiende un personaje de la casa (un mayordomo, un proveedor del pueblo).

## Pilares

1. **Cada vida importa.** Muerte permanente, sin forma de volver atrás. El riesgo se siente en cada esquina.
2. **La muerte es contenido.** Los héroes caídos se vuelven jefes en el nivel donde murieron, con su equipo.
3. **El linaje es el progreso.** No se hereda poder directo: se heredan rasgos, el árbol genealógico y el mapa.
4. **Supervivencia y exploración.** Hambre, sed, luz, recursos escasos, lo desconocido.
5. **Ratos cortos, vidas largas.** Se juega de a pocos minutos, pero una vida dura tantas sesiones como sobrevivas.

## Ciclos de juego

- **Sesión**: entrás, jugás un rato, salís. Salir es pausar.
- **Vida**: elegís un integrante vivo del linaje → elegís clase → salís de la superficie → explorás, sobrevivís, acampás → morís.
- **Dinastía**: una sola por jugador. Cada muerte avanza una generación. El árbol genealógico crece, envejece y se renueva.

## La mazmorra

- **Generación determinista**: cada nivel se genera a partir de `semilla + profundidad`. La profundidad no tiene techo.
- **Lo que persiste**: la estructura de los niveles y el mapa revelado.
- **Lo que se repone entre vidas**: monstruos y loot, que **se vuelven a sortear** en cada vida. Narrativamente, pasa el tiempo hasta que llega el próximo héroe.
- **Semilla compartible**: dos jugadores con la misma semilla tienen la misma mazmorra, cada uno con sus propios caídos.
- **Siempre se empieza desde la superficie.**

## La mansión (superficie)

La casa de la familia, arriba de la mazmorra: lugar de descanso y tienda. Es donde empieza cada vida.

- **Tienda**: armas, armaduras, fuentes de luz, comida y agua, mochilas.
- **Moneda**: oro que se lootea en la mazmorra.
- **Sin depósito familiar**, para evitar la acumulación de poder entre vidas.
- **La herencia está en el cadáver**: el oro y el equipo de un héroe muerto quedan con su jefe. Para recuperarlos, el descendiente tiene que derrotar a su ancestro.

## El mapa heredado

- Todo lo explorado por cualquier integrante del linaje queda dibujado.
- Marcas automáticas: dónde murió cada héroe, escaleras, campamentos. **[Propuesta]**
- Anotaciones a mano del jugador sobre el mapa. **[Propuesta]**

## Héroes caídos

- Al morir, el personaje queda como **jefe en el nivel donde murió**, con su clase y el equipo que llevaba. Pasa con cualquier causa de muerte: combate, hambre, sed o trampa.
- **Cada rasgo tiene un análogo de jefe.** Los atributos especiales del jefe salen de los rasgos que tuvo en vida; otros atributos dependen de la profundidad.
- Si lo derrotás, **descansa en paz**: desaparece para siempre y suelta su equipo.
- **Un jefe por nivel**: si en ese nivel ya hay un jefe, el que muere ahí no se vuelve jefe.
- En ese caso se suma a la **escolta maldita** del jefe, con su equipo y su oro.
- **Un nivel con jefe se vuelve más peligroso** mientras el jefe siga ahí. **[Propuesta]** Cuando el jefe descansa en paz, el nivel vuelve a la normalidad y puede volver a tener un jefe.

## Linaje

- **Árbol genealógico** de la dinastía, con línea única: cada heredero desciende de un solo progenitor.
- **Los herederos se generan al morir**: entre 1 y 4. Los que nunca bajaron no tienen herederos.
- La dinastía nunca se extingue: como mínimo quedan los herederos del último que murió.
- **Cada muerte avanza una generación.** El tiempo del linaje se mide en muertes, no en horas jugadas.
- **Esperanza de vida**: cada integrante vive 2 o 3 generaciones (al azar) y envejece con cada una.
- Como el tiempo solo pasa cuando alguien muere, el héroe que estás jugando no envejece durante su vida. Un integrante elegido más tarde llega más viejo.
- **Al morir**: una crónica cuenta los cambios del árbol (nacimientos, muertes por vejez, rasgos nuevos) y elegís entre los integrantes vivos.

## Rasgos

Cada personaje tiene una colección de rasgos que funcionan como una lotería genérica: tablas ponderadas de las que se sortea.

- **Tipos**: modificadores de atributos o características, efectos especiales y defectos.
- **Origen**: de nacimiento (heredados o sorteados), de la edad o **adquiridos** durante la vida.
- **Herencia**: algunos rasgos vienen de los ancestros al azar y otros se sortean nuevos.
- **Envejecimiento**: con la edad aparecen rasgos específicos que favorecen los atributos mentales y perjudican los físicos.
- **Atributos**: físicos (Fuerza, Agilidad, Vigor) y mentales (Ingenio, Voluntad, Percepción).
- **Análogo de jefe**: cada rasgo define también su efecto cuando el personaje vuelve como héroe caído.

Ejemplos ilustrativos:

| Rasgo | Tipo | En vida | Como jefe |
|---|---|---|---|
| Brazos de herrero | Atributo | +Fuerza base | Golpes que derriban |
| Ojos de gato | Especial | Ve más lejos con poca luz | Apaga las antorchas cercanas |
| Estómago chico | Defecto | El hambre sube más rápido | Devora la comida del jugador |
| Canas | Edad | +Voluntad, −Agilidad | Lento pero invoca ecos |

## Progresión dentro de una vida

- **Sin niveles de experiencia.** El héroe progresa con **rasgos adquiridos** y con el equipo que encuentra o compra.
- Los rasgos adquiridos salen de lo que vive: sobrevivir a un envenenamiento da *Resistencia al veneno*, pasar mucho tiempo a oscuras da *Ojos de gato*. Las heridas graves dejan rasgos negativos (*Tuerto*, *Pierna mala*).
- **Tope de rasgos por personaje**: si gana uno con el tope lleno, se pierde otro. Los rasgos se reemplazan, no se apilan.
- Algunos rasgos adquiridos pueden pasar a los herederos con baja probabilidad. **[Propuesta]**
- Los rasgos adquiridos también tienen su análogo de jefe.

## Clase

Se elige al empezar cada vida, después de elegir al integrante del linaje. La clase del ancestro no influye en la del heredero. Tres clases iniciales, pocas y bien distintas, con nombres góticos.

Nombres confirmados; las identidades son **[Propuesta]**:

| Base | Nombre | Identidad |
|---|---|---|
| Guerrero | **Verdugo** (*Headsman*) | Cuerpo a cuerpo con armas pesadas. Aguanta mucho, pero tiene más hambre y sed. |
| Pícaro | **Saqueador** (*Plunderer*) | Ágil. Desarma trampas, abre cerraduras y encuentra más oro. Frágil. |
| Sacerdote | **Cirial** (*Candlebearer*) | Usa la luz como arma y como fe: quema luz para curar o para repeler. Fuerte de noche, pero vive con la luz justa. |

Cada clase toca la supervivencia de una forma distinta. **[Propuesta]**

## Supervivencia

- Medidores iniciales: **hambre, sed y luz**.
- **Sin estamina**: el hambre y la sed cumplen ese papel.

### Campamentos

- Son objetos que se instalan en una sala y no se pueden mover. Para tener otro punto de descanso hay que conseguir los materiales de un campamento nuevo. Ahí se descansa y se cura.
- **Persisten entre vidas**: los campamentos de los ancestros quedan para los descendientes.
- **Ataques nocturnos**: cada noche, cada campamento tiene una chance de ser atacado y destruido. El riesgo depende de la sala.
- Al campamento donde está el héroe no se le tira el riesgo: el ataque se juega y hay que defenderlo. Los campamentos vacíos se resuelven solos con su chance.
- **Desgaste generacional**: en cada cambio de generación, algunos campamentos pueden desaparecer. Esto evita llenar todas las salas de campamentos.
- **[Propuesta] Riesgo de la sala**: sube con la profundidad, la cercanía a zonas donde aparecen monstruos y la cantidad de entradas de la sala. Baja en salas sin salida o fortificadas.
- **[Propuesta] Desgaste**: la chance de desaparecer crece con las generaciones que lleva el campamento.

### Día y noche

- Hay un ciclo de día y noche aunque se esté bajo tierra.
- **Duración**: de 6 a 8 minutos de día y de 2 a 3 de noche, para que entre en una sesión de celular.
- **De noche** los enemigos cambian de comportamiento, baja la visibilidad y todo se vuelve más peligroso.
- El juego pasa a un **modo de supervivencia más intenso**: o defendés tu campamento hasta que amanece, o huís hasta un campamento.
- De noche la luz se gasta más rápido.
- El atardecer se ve como papel que se oscurece y tinta que se desvanece en los bordes, sin reloj en pantalla.

## Ritmo y controles

- **Tiempo real**, con pausa al salir.
- **Celular**: joystick virtual con el pulgar izquierdo, botones de acción con el derecho, apuntado automático al enemigo más cercano hacia donde se mira.
- **Compu**: teclado y mouse.

## Guardado

- **Autoguardado continuo.** Salir es pausar.
- No se puede volver atrás: cerrar la app a la fuerza no salva de una muerte.

## Plataforma y stack

- PWA instalable y offline, para celular y navegador.
- Interfaz y textos en **inglés y español**, con selector.
- TypeScript + Vite.
- **Phaser 4** para la mazmorra: render, cámara, colisiones, entrada y escenas.
- **HTML y CSS** para las pantallas de interfaz (HUD, menús, mansión, galería, crónica, tienda, inventario), encima del canvas.
- **Lógica del juego en TypeScript puro**, separada de Phaser: generación, rasgos, linaje, jefes, supervivencia. Phaser solo dibuja, mueve, choca y recibe controles.
- Persistencia local en IndexedDB, sin backend.
- PRNG con semilla determinista para toda la generación; nada de `Math.random()` en la lógica del juego.
- Tests de la lógica con vitest.

## Etapas

1. **Prototipo** (arte provisorio): un nivel generado desde una semilla, movimiento con joystick, la luz que revela el mapa como tinta sobre papel, hambre y sed que bajan.
2. A definir después de probar el prototipo.

## Decisiones abiertas

1. **Final o leaderboard** (más adelante): la mazmorra es infinita; se puede sumar un final o una tabla de récords. Una tabla compartida necesita un servidor, cosa que hoy el stack no tiene.
2. **Nivel liberado**: ¿cuando el jefe descansa en paz, el nivel puede volver a tener un jefe?
3. **Ideas de la mansión** (galería de retratos, biblioteca, quién atiende la tienda).

## Decisiones tomadas

- Nombre: **La Estirpe** en español, ***Tainted Ancestry*** en inglés.
- Idiomas: inglés y español, con selector.
- Un jefe por nivel como máximo; un nivel con jefe es más peligroso. Quien muere en un nivel con jefe se suma a su escolta.
- Mazmorra infinita; un final queda para más adelante.
- Vista **cenital 3/4**.
- Estilo **tinta y papel, oscuro**: fuera de la llama no se ve nada (ni siquiera lo ya explorado); el papel aparece solo donde llega la luz. Muros y columnas proyectan sombras suaves. Arte por código, mejorándolo de a poco; el arte final se decide más adelante.
- **Mapa desplegable** con lo explorado, dibujado como boceto. **[Supuesto]** No pausa el juego: mirarlo en la oscuridad es un riesgo.
- **Visión**: un cono hacia adelante (unos 116°) que sale del cuerpo del héroe, con bordes nítidos y recortado por las paredes: se ve el frente de los muros y las columnas, nunca lo que hay detrás ni hacia atrás. La luz tiene un tinte cálido de llama. El héroe se dibuja siempre sobre la oscuridad.
- **Ojos en la oscuridad**: los horrores que te miran desde fuera de la vista muestran los ojos, del mismo color que en su dibujo. Cada tipo tiene ojos distintos: el Rastrero tres puntos bajos en arco, el Hueco un solo ojo alto, la Plañidera dos ranuras tristes, el Apagavelas dos alfileres juntos (y solo de cerca).
- **Motor 3D** (three.js) con dos vistas del mismo mundo: **cenital** inclinada (paredes que se cortan a la rodilla del lado de la cámara) y **primera persona** (vertical en el celular, aprovecha el ancho en PC). Luz real de la llama con sombras, sombreado de tramas de tinta, sonido generado por código, viñeta que aprieta con el peligro.
- Progresión por **rasgos adquiridos**, sin niveles de experiencia.
- Tiempo real; medidores de hambre, sed y luz.
- Una sola dinastía por jugador.
- El oro y el equipo del que muere quedan con su jefe; sin depósito familiar.
- La noche es un modo de supervivencia intenso: defender el campamento o huir a otro. Día de 6 a 8 minutos, noche de 2 a 3.
- Combate con joystick virtual y botones; sin estamina.
- Tres clases iniciales: Verdugo, Saqueador y Cirial. La clase del ancestro no influye.
- Todo héroe que muere se vuelve jefe, sea cual sea la causa.
