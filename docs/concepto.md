# Concepto — borrador v0

> Estado: **borrador para revisar**. Lo marcado como **[Supuesto]** es una propuesta mía que hay que validar; lo que está en **Decisiones abiertas** todavía no tiene respuesta.

## Pitch

Un roguelike de supervivencia y exploración para celular y navegador. Bajás a **tu** mazmorra —generada a partir de una semilla y persistente— con un integrante de **tu linaje**. La meta es llegar lo más profundo posible. Si morís, no hay vuelta atrás: pasa una generación, la familia cambia, y el que murió te espera abajo convertido en jefe.

## Pilares

1. **Cada vida importa.** Muerte permanente, sin forma de volver atrás. El riesgo se siente en cada esquina.
2. **La muerte es contenido.** Los héroes caídos se vuelven jefes en el nivel donde murieron, con su equipo.
3. **El linaje es el progreso.** No se hereda poder directo: se heredan rasgos, el árbol genealógico y el mapa.
4. **Supervivencia y exploración.** Hambre, luz, recursos escasos, lo desconocido. Inspiración: el ritmo y la tensión de los juegos de supervivencia, con identidad visual propia.
5. **Ratos cortos, vidas largas.** Se juega de a pocos minutos, pero una vida dura tantas sesiones como sobrevivas.

## Ciclos de juego

- **Sesión**: entrás, jugás un rato, salís. Salir es pausar.
- **Vida**: elegís un integrante vivo del linaje → elegís clase → bajás desde la superficie → explorás, sobrevivís, descansás → morís.
- **Dinastía**: cada muerte avanza una generación. El árbol genealógico crece, envejece y se renueva.

## La mazmorra

- **Generación determinista**: cada nivel se genera a partir de `semilla + profundidad`. La profundidad no tiene techo.
- **Lo que persiste**: la estructura de los niveles y el mapa revelado.
- **Lo que se repone entre vidas**: monstruos y loot. Narrativamente, pasa el tiempo hasta que llega el próximo héroe.
- **Semilla compartible**: dos jugadores con la misma semilla tienen la misma mazmorra, cada uno con sus propios caídos.
- **Siempre se empieza desde la superficie.** El mapa heredado es lo que hace más rápido volver a bajar.

## El mapa heredado

- Todo lo explorado por cualquier integrante del linaje queda dibujado.
- Marcas automáticas: dónde murió cada héroe, escaleras, puntos de descanso. **[Supuesto]**
- Anotaciones a mano del jugador sobre el mapa. **[Supuesto]**

## Héroes caídos

- Al morir, el personaje queda como **jefe en el nivel donde murió**, con su clase, sus rasgos y el equipo que llevaba.
- Si lo derrotás, **descansa en paz**: desaparece para siempre y suelta su equipo.
- Si un héroe muere a manos de un héroe caído, también se convierte en jefe.
- El momento clave: enfrentar a alguien con quien te encariñaste, que encima es pariente del que estás jugando.

## Linaje

- **Árbol genealógico** de la dinastía.
- Cada personaje tiene una **cantidad aleatoria razonable de herederos**. **[Supuesto: 1 a 4, nacen en la generación siguiente]**
- **Cada muerte avanza una generación.** El tiempo del linaje se mide en muertes, no en horas jugadas.
- **Esperanza de vida**: cada integrante vive 2 o 3 generaciones (al azar) y envejece con cada una.
- Como el tiempo solo pasa cuando alguien muere, el héroe que estás jugando no envejece durante su vida. Un integrante elegido más tarde llega más viejo.
- **Al morir**: una crónica cuenta los cambios del árbol (nacimientos, muertes por vejez, rasgos nuevos) y elegís entre los integrantes vivos.
- **Línea única**: los herederos descienden de un solo progenitor, sin parejas. **[Supuesto]**

## Rasgos

Cada personaje tiene una colección de rasgos que funcionan como una lotería genérica: tablas ponderadas de las que se sortea.

- **Tipos**: modificadores de atributos o características, efectos especiales y defectos.
- **Herencia**: algunos rasgos vienen de los ancestros al azar y otros se sortean nuevos.
- **Envejecimiento**: con la edad aparecen rasgos específicos que favorecen los atributos mentales y perjudican los físicos.
- **Atributos**: un set propio, separado en físicos y mentales. **[Supuesto: Fuerza, Agilidad, Vigor / Ingenio, Voluntad, Percepción]**

Ejemplos ilustrativos:

| Rasgo | Tipo | Efecto |
|---|---|---|
| Brazos de herrero | Atributo | +Fuerza base |
| Ojos de gato | Especial | Ve más lejos con poca luz |
| Estómago chico | Defecto | El hambre sube más rápido |
| Canas | Edad | +Voluntad, −Agilidad |

## Clase

Se elige al empezar cada vida, después de elegir al integrante del linaje. Las clases están por definir.

## Supervivencia

- Recursos a gestionar: **hambre y luz** como base. **[Supuesto]**
- **Descanso y curación**: acampar recupera vida pero consume comida y tiempo, y tiene riesgo (emboscadas, que se consuma la luz). **[Supuesto]**

## Ritmo y controles

- Tiempo real, con pausa al salir. **[Supuesto]**
- Controles para pantalla táctil y para teclado/mouse.

## Guardado

- **Autoguardado continuo.** Salir es pausar.
- No se puede volver atrás: cerrar la app a la fuerza no salva de una muerte.

## Plataforma y stack — propuesta

**[Supuesto, a aprobar]**

- PWA instalable y offline, para celular y navegador.
- TypeScript + Vite.
- Render 2D con un motor liviano (Phaser o PixiJS, a decidir).
- Persistencia local en IndexedDB, sin backend.
- PRNG con semilla determinista para toda la generación; nada de `Math.random()` en la lógica del juego.
- Tests de la generación y de las reglas con vitest.

## Decisiones abiertas

1. **Vista**: ¿cenital, isométrica o de costado? ¿Estilo visual (dibujado a mano, pixel art, otro)?
2. **Tiempo real o por turnos.** ¿Se confirma tiempo real?
3. **Medidores de supervivencia**: ¿hambre y luz alcanzan? ¿Cordura, sed, frío?
4. **Descanso**: ¿se puede acampar en cualquier lado o solo en lugares seguros? ¿Qué se arriesga?
5. **Loot repuesto**: ¿se vuelve a sortear en cada vida o se repite según la semilla?
6. **Superficie**: ¿hay algo arriba (pueblo, campamento, comercio) o es solo la entrada?
7. **Fin de la dinastía**: si no quedan integrantes vivos, ¿termina la partida? ¿Qué se conserva?
8. **Herederos**: ¿cuándo nacen y de quién? ¿Los que nunca bajaron también tienen herederos?
9. **Héroes caídos**: ¿cómo se traducen las habilidades de un héroe a comportamiento de jefe? ¿Escalan con el tiempo? ¿Y si murió de hambre?
10. **Clases**: cuántas y cuáles.
11. **Progresión dentro de una vida**: ¿sube de nivel o mejora solo con equipo y hallazgos?
12. **Varias dinastías**: ¿un solo linaje por jugador o varias partidas en paralelo?
13. **Nombre del juego.**
