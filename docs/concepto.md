# Concepto — borrador v1

> Estado: **borrador para revisar**. Lo marcado como **[Propuesta]** es una sugerencia mía que hay que validar; lo que está en **Decisiones abiertas** todavía no tiene respuesta.

## Pitch

Un roguelike de supervivencia y exploración en tiempo real, para celular y navegador. Bajás a **tu** mazmorra —generada a partir de una semilla y persistente— con un integrante de **tu linaje**. La meta es llegar lo más profundo posible. Si morís, no hay vuelta atrás: pasa una generación, la familia cambia, y el que murió te espera abajo convertido en jefe.

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

## La superficie

Base segura arriba de la mazmorra: lugar de descanso y algún tipo de tienda. Es donde empieza cada vida.

## El mapa heredado

- Todo lo explorado por cualquier integrante del linaje queda dibujado.
- Marcas automáticas: dónde murió cada héroe, escaleras, campamentos. **[Propuesta]**
- Anotaciones a mano del jugador sobre el mapa. **[Propuesta]**

## Héroes caídos

- Al morir, el personaje queda como **jefe en el nivel donde murió**, con su clase y el equipo que llevaba.
- **Cada rasgo tiene un análogo de jefe.** Los atributos especiales del jefe salen de los rasgos que tuvo en vida; otros atributos dependen de la profundidad.
- Si lo derrotás, **descansa en paz**: desaparece para siempre y suelta su equipo.
- Si un héroe muere a manos de un héroe caído, también se convierte en jefe.

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

## Clase

Se elige al empezar cada vida, después de elegir al integrante del linaje. Las clases están por definir.

## Supervivencia

- Medidores iniciales: **hambre, sed y luz**.
- **Campamentos**: son objetos que se instalan en una sala y no se pueden mover. Para tener otro punto de descanso hay que conseguir los materiales de un campamento nuevo. Ahí se descansa y se cura.

## Ritmo y controles

- **Tiempo real**, con pausa al salir.
- Controles para pantalla táctil y para teclado/mouse.

## Guardado

- **Autoguardado continuo.** Salir es pausar.
- No se puede volver atrás: cerrar la app a la fuerza no salva de una muerte.

## Plataforma y stack — propuesta

**[Propuesta, a aprobar]**

- PWA instalable y offline, para celular y navegador.
- TypeScript + Vite.
- Render 2D con un motor liviano (Phaser o PixiJS, a decidir).
- Persistencia local en IndexedDB, sin backend.
- PRNG con semilla determinista para toda la generación; nada de `Math.random()` en la lógica del juego.
- Tests de la generación y de las reglas con vitest.

## Decisiones abiertas

1. **Vista**: cenital o isométrica. **[Propuesta: cenital 3/4]**
2. **Estilo visual.** **[Propuesta: tinta y papel]** ¿Quién hace el arte?
3. **Progresión dentro de una vida.** **[Propuesta: rasgos adquiridos]**
4. **Campamentos entre vidas**: ¿los campamentos que instaló un ancestro siguen ahí para sus descendientes? ¿Los monstruos que se reponen pueden destruirlos?
5. **Superficie**: ¿qué se vende, con qué moneda, y se puede llevar algo de una vida a la otra (un depósito familiar)?
6. **Héroes caídos**: ¿y si murió de hambre o por una trampa? ¿Hay un tope de jefes por nivel?
7. **Clases**: cuántas y cuáles.
8. **Nombre del juego.**
