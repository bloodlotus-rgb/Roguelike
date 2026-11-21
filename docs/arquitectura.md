# Arquitectura de la mazmorra: piezas, grilla 3D, locaciones y proporciones (propuesta v1)

> Estado: **aprobado para empezar**, en el orden de la sección 5. Lo marcado **[Propuesta]** es mío para validar.

Cuatro cosas que se apoyan una en otra:

1. una **biblioteca de piezas** de construcción;
2. una **grilla 3D** para describir los niveles (y un formato para dibujarlos a mano);
3. **100 locaciones** diseñadas a mano que el generador inserta en el edificio;
4. **proporciones nuevas**: paredes más altas, pasillos y salas más amplios.

## 1. Biblioteca de piezas

Hoy un nivel es piso, pared de ladrillos y alguna columna. Propongo una **biblioteca de piezas paramétricas**, todas hechas por código como los ladrillos, con erosión y tinta.

- Cada pieza declara:
  - su **huella** en la grilla (qué celdas ocupa y cuáles bloquean el paso o la vista);
  - **dónde puede ir**: contra una pared, en un vano, en el centro de una sala, en una esquina, colgando del techo;
  - sus **variantes**: tamaño, estado (nueva, gastada, rota) y material (piedra, ladrillo, madera, hierro, hueso).

| Familia | Piezas |
|---|---|
| **Soportes** | Columna redonda, pilar cuadrado, haz de columnillas, columna rota (tirada en el piso), pilastra adosada a la pared, contrafuerte |
| **Arcos y bóvedas** | Arco de medio punto en un vano, arco apuntado, arcada (fila de arcos sobre columnas), bóveda de cañón sobre un pasillo, bóveda de crucería sobre una sala, arco ciego en la pared |
| **Vanos** | Puerta de madera simple, puerta doble, reja levadiza, puerta de hierro con cerrojo, poterna (puerta baja), umbral sin puerta, ventana ciega, saetera |
| **Colgantes** | Cadenas, cadenas con grillete, jaula colgante, candelabro de hierro, lámpara de aceite con cadena, raíces que bajan del techo, telarañas |
| **Muebles de piedra** | Altar, pila de agua, sarcófago, banco, mesa de piedra, pedestal con estatua, nicho funerario, osario (pared de huesos) |
| **Muebles de madera** | Estante de libros, barril, tonel, mesa, cama de paja, cofre, perchero de armas, andamio |
| **Agua** | Gárgola que escupe agua, canaleta en el piso, rejilla de desagüe, pozo con brocal, cisterna con escalones, noria rota |
| **Fuego** | Brasero, hogar, nicho de vela, antorcha de pared fija (de la mazmorra, no de la familia) |
| **Estructura** | Viga de madera, entrepiso de tablas, baranda de piedra, baranda de madera, escalera de caracol, escalera de mano, rampa de tierra, puente de piedra en arco |
| **Ruina** | Pared derrumbada a medias, montón de escombros, viga caída, techo hundido (luz desde arriba), suelo partido |

**[Propuesta]** La primera tanda: arcos en los vanos, arcadas, bóvedas, columnas en sus variantes, puertas (simple, doble, reja), cadenas, braseros, altar, sarcófago, estantes, barriles y escombros. Con eso, una sala ya cambia mucho.

## 2. Una grilla tridimensional

Hoy el nivel es una grilla 2D (piso o pared) con alturas sueltas (terrazas, escaleras, galerías). Para paredes altas, entrepisos, balcones, puentes sobre salas y locaciones de varios pisos, propongo **una grilla 3D por nivel**.

- **Celdas**: 1 casilla de ancho por 1 de largo por **media unidad de alto**. Un nivel tiene unas 10 capas: unos 5 metros de alto para jugar.
- **Contenido de cada celda**:
  - **qué es**: roca, aire, piso (la cara de arriba es pisable), agua o vacío al nivel de abajo;
  - **qué pieza** la ocupa (de la biblioteca), con su orientación;
  - **marcas** del generador: sala, pasillo, locación, conector.
- **Qué se deriva de la grilla**:
  - por dónde se camina (cada celda de piso con aire arriba suficiente para pararse);
  - las alturas (la de piso de cada casilla y la de techo);
  - lo que bloquea la vista y la luz;
  - el dibujo (paredes, pisos y techos donde hay roca junto al aire, más las piezas).
- **El juego sigue en 2D** para la lógica: el héroe y los horrores se mueven en el plano con una altura, como ahora. La grilla 3D se proyecta a lo que hoy usamos (casillas, alturas, escaleras), así no hay que reescribir el combate ni la IA.
- **Formato para dibujar a mano**: cada locación es un archivo con **capas de texto**, una por altura, y una leyenda de símbolos (`#` roca, `.` piso, `A` arco, `C` columna…), más metadatos: nombre, profundidades donde puede aparecer, conectores y contenido. Así las locaciones se diseñan y se revisan como texto, con tests que validan que se puedan recorrer.

```
capa 0          capa 1          capa 2-5 (igual)
#####.#####     #####A#####     #####.#####
#.........#     #.........#     #.........#
#..C...C..#     #..C...C..#     #..C...C..#
.....=.....     A....=....A     ...........
#..C...C..#     #..C...C..#     #..C...C..#
#.........#     #.........#     #.........#
#####.#####     #####A#####     #####.#####
```
*Una sala con cuatro columnas, un altar (`=`) y arcos (`A`) en sus cuatro entradas.*

## 3. Cien locaciones diseñadas a mano

El generador sigue armando el nivel: salas, pasillos, cuevas, ríos. Pero en cada nivel **inserta varias locaciones de autor** en los huecos que les dejan, y las conecta por sus **conectores** (los vanos marcados en sus bordes).

- **Cada locación tiene**: plano en la grilla 3D, profundidades donde aparece, rareza, conectores, qué contiene (horrores, loot, agua, luz) y, si tiene, su **mecánica propia**.
- Las marcadas **⇅ atraviesan niveles**: el generador las reserva en el nivel de arriba y en el de abajo, como ya hace con la escalera y el pozo.
- **[Propuesta]** Cada nivel lleva entre **3 y 6 locaciones**. Algunas son **únicas en la mazmorra** (aparecen una sola vez y quedan en el mapa heredado como hitos).

### Lo sagrado

1. **Capilla de la vela perpetua**: un altar con una vela que nunca se apaga; cargar la lámpara ahí no gasta aceite (una vez por día).
2. **Nave derrumbada**: iglesia partida al medio; la mitad del piso cayó al nivel de abajo ⇅.
3. **Baptisterio inundado**: pila central profunda; el agua es limpia y bendita (cura un poco).
4. **Claustro**: patio con arcadas alrededor; los horrores no entran al patio de día.
5. **Sacristía saqueada**: estantes rotos, cofres forzados; a veces queda algo detrás de un panel.
6. **Coro elevado**: balcón de madera sobre una nave; se ve todo desde arriba, pero cruje ⇅.
7. **Cripta de los abades**: nichos en las paredes y sarcófagos con tapa corrida.
8. **Campanario hundido**: torre que atraviesa tres niveles; la campana suena si la tocás y atrae a todo el nivel ⇅.
9. **Oratorio de la penitencia**: pasillo con bancos de piedra y cadenas en la pared.
10. **Altar profanado**: corrupción; cerca de él la lámpara gasta el doble.

### Lo funerario

11. **Osario**: paredes enteras de huesos ordenados; hay que cruzarlo en silencio.
12. **Galería de nichos**: pasillo largo de tumbas en la pared, algunas abiertas desde adentro.
13. **Mausoleo de familia**: un pequeño edificio dentro de una sala grande, con su puerta de hierro.
14. **Fosa común**: pozo ancho en el piso lleno de restos; de ahí salen Rastreros.
15. **Sala de embalsamar**: mesas de piedra, frascos, olor; buenos vendajes y ungüentos.
16. **Columbario**: torre hueca con miles de nichos chicos ⇅.
17. **Tumba del caballero**: sarcófago con una figura tallada; adentro, un arma para la etapa de armas.
18. **Cementerio subterráneo**: lápidas en tierra suelta bajo un techo bajo; se puede cavar.
19. **Cámara de los lamentos**: un eco que repite tus pasos con demora.
20. **Cripta sellada**: puerta que se abre solo desde el otro lado; se llega por otro camino.

### La vida de antes (doméstico)

21. **Refectorio**: mesas largas, platos de piedra; restos de comida (a veces comestible).
22. **Cocina**: hogar grande, ollas, un pozo de agua; se puede cocinar sin kit.
23. **Despensa**: estantes con barriles; mucha comida, pero las ratas llegaron antes.
24. **Bodega**: toneles enormes; uno tiene agua todavía buena.
25. **Dormitorio de los novicios**: hileras de camas de piedra; buen lugar para acampar.
26. **Celda del ermitaño**: cuarto chico con un diario escrito en la pared (pistas del nivel).
27. **Biblioteca derrumbada**: estantes caídos que forman un laberinto; papel para leer pistas.
28. **Scriptorium**: atriles, tinteros; tinta para marcas que no se borran.
29. **Lavadero**: piletas con agua corriente que baja de una canaleta.
30. **Enfermería**: camas, vendas, frascos; a veces un antídoto.

### Trabajo y oficio

31. **Fragua**: yunque y fuelle; reparar armas y armaduras.
32. **Carpintería**: tablas y herramientas; fuente de tablas.
33. **Cantera interior**: paredes a medio tallar, bloques sueltos, andamios ⇅.
34. **Pozo minero**: pique vertical con un montacargas roto ⇅.
35. **Galería de vagonetas**: rieles en pendiente; una vagoneta se puede empujar para romper una barricada.
36. **Molino de agua**: noria movida por un río; si se traba, el agua se desvía.
37. **Depósito de herramientas**: picos, palas y palancas para la etapa de objetos.
38. **Taller del relojero**: engranajes en la pared y un mecanismo que abre una puerta a cierta hora.
39. **Horno de cal**: cámara caliente; acampar ahí no necesita leña.
40. **Cordelería**: rollos de soga.

### Defensa y castigo

41. **Cuerpo de guardia**: bancos, perchas de armas; buena sala para barricar.
42. **Calabozos**: celdas con rejas; en una hay un horror encerrado (o una persona).
43. **Sala de tormento**: cadenas, potros, jaulas colgantes; corrupción alta.
44. **Puente levadizo**: sobre un abismo, con su torno para bajarlo ⇅.
45. **Rastrillo doble**: dos rejas; se cierran detrás tuyo si pisás la losa equivocada.
46. **Armería**: perchas vacías y una puerta de hierro cerrada con llave.
47. **Muralla interior**: pasillo alto con almenas que dan a una sala grande ⇅.
48. **Barbacana**: entrada fortificada con saeteras; los Plañideros te esperan arriba.
49. **Foso seco**: zanja con estacas; caer cuesta vida.
50. **Torre de vigía**: escalera de caracol a un balcón desde donde se ve medio nivel ⇅.

### Agua

51. **Cisterna de columnas**: sala inmensa inundada, con un bosque de columnas y pasarelas ⇅.
52. **Acueducto**: canal elevado sobre arcos que cruza una sala; se camina por arriba.
53. **Aljibe**: pozo con brocal y balde; agua limpia sin límite.
54. **Fuente de los tres caños**: cada caño da agua distinta (limpia, turbia, envenenada).
55. **Gruta del manantial**: agua que brota de la roca; limpia, y crea un arroyo.
56. **Presa**: muro que contiene un lago; romperla inunda el nivel de abajo ⇅.
57. **Esclusa**: dos compuertas; subir el agua para cruzar flotando una balsa.
58. **Baños antiguos**: piletas a distintas temperaturas; dormir ahí cura más.
59. **Desagüe colector**: túnel redondo con agua hasta la rodilla que baja de nivel ⇅.
60. **Pozo de los deseos**: un pozo que atraviesa cinco niveles; tirar oro trae cosas ⇅.

### Natural

61. **Caverna de cristales**: reflejan la luz; la lámpara alumbra el doble.
62. **Bosque de hongos**: hongos altos como personas, brillantes; comida y veneno.
63. **Raíces del mundo**: raíces gigantes que bajan del techo y atraviesan el nivel ⇅.
64. **Grieta del viento**: una corriente fuerte que apaga antorchas y empuja.
65. **Lago subterráneo**: agua oscura y quieta; algo vive adentro.
66. **Sima**: un agujero sin fondo con una cornisa que baja en espiral ⇅.
67. **Cueva del eco**: los ruidos se oyen el doble de lejos.
68. **Galería de estalactitas**: techo bajo, puntas que caen si hay ruido.
69. **Nido**: una cueva llena de huesos roídos; el cubil de un horror grande.
70. **Ojo de luz**: un hueco que da al exterior lejano; un rayo de luz de día que no se apaga ⇅.

### Lo que dejaron otros exploradores

71. **Campamento abandonado**: fogón frío, un saco de dormir; se puede usar como campamento propio.
72. **Puesto de avanzada**: barricadas viejas y un cofre; alguien se defendió acá.
73. **Escalera de sogas**: una pared escalada con sogas viejas; podridas o no ⇅.
74. **Mapa en la pared**: alguien dibujó el nivel; lo revela en tu mapa.
75. **Tumba del explorador**: una cruz con un nombre y su mochila al lado.
76. **Trinchera**: zanja con estacas mirando hacia un pasillo.
77. **Refugio cerrado por dentro**: alguien se encerró; adentro, lo que quedó de él.
78. **Altar de ofrendas**: los exploradores dejaban cosas para la suerte; dejar algo da un buen augurio.
79. **Pozo con escalera de mano** ⇅: un atajo que dejó otra familia.
80. **Campamento de la otra estirpe**: rastros de una familia rival.

### Lo extraño

81. **Sala de los espejos**: tu reflejo se mueve con demora.
82. **Pasillo que no termina**: se cierra en un círculo hasta que lo marcás con tiza.
83. **Habitación invertida**: los muebles están en el techo.
84. **Cámara del reloj de arena**: el tiempo del día pasa más lento adentro.
85. **Galería de retratos**: pinturas de tu propia familia que nadie colgó.
86. **Sala del eco de la muerte**: aparece el fantasma del último familiar que murió en el nivel.
87. **Puerta en el medio de la sala**: sin pared alrededor; cruzarla te deja en otro lugar del nivel.
88. **Jardín de piedra**: estatuas de exploradores con caras de espanto.
89. **Cuarto del susurro**: voces que dicen dónde hay algo (a veces mienten).
90. **Escalera que baja hacia arriba**: llega al nivel de arriba por un camino imposible ⇅.

### Lo profundo y lo corrupto

91. **Pozo de tinta**: un charco negro que crece; la corrupción en persona.
92. **Corazón de la mazmorra**: una sala que late; las paredes se mueven.
93. **Puerta sellada con siete cerrojos**: cada cerrojo se abre en otro nivel ⇅.
94. **Cátedra de los jefes**: la antesala de un jefe (para la Etapa B).
95. **Trono vacío**: una silla gigante en una sala inmensa; algo se sentaba ahí.
96. **Tumba de la primera estirpe**: la familia que vino antes que la tuya.
97. **Escalera rota al abismo**: baja tres niveles de un saque, si te animás ⇅.
98. **Biblioteca prohibida**: libros que enseñan un rasgo a cambio de una maldición.
99. **Jardín de horrores dormidos**: decenas de horrores quietos; hay que cruzar sin despertarlos.
100. **El fondo**: la última sala, debajo de todo.

**[Propuesta] Cómo producirlas**:
- No las diseño todas de una. Primero la **grilla 3D**, el **formato** y la primera tanda de **piezas**.
- Después, **tandas de 10 a 15 locaciones**, empezando por las que más cambian el juego: cocina, aljibe, campamento abandonado, mapa en la pared, cisterna, puente levadizo, torre de vigía, osario, pozo de los deseos y nave derrumbada.
- Vos revisás cada tanda y descartamos, cambiamos o agregamos ideas.

## 4. Proporciones: más alto y más ancho

Hoy las paredes miden 2,2 en primera persona, los pasillos tienen una casilla de ancho y las salas van de 4 a 12 casillas. Se siente apretado, como un sótano.

**[Propuesta]**
- **Altura**:
  - pasillos de **3 unidades**;
  - salas comunes de **4**;
  - salones y naves de **5 a 6**, con bóveda.
  - Desde arriba, el corte de las paredes sigue igual: se cortan a la altura de la rodilla del lado de la cámara, así que no tapan más.
- **Ancho**:
  - pasillos de **2 casillas** (algunos de 3, con columnas a los lados);
  - pasadizos de 1 solo para los secretos y las grietas.
- **Salas**: de **6 a 18 casillas**, y algunos salones de hasta 24 con columnas que sostienen el techo.
- **Lo que hay que ajustar**:
  - **Puertas y barricadas**: hoy van en vanos de una casilla. Con pasillos de 2, las puertas pasan a ser **dobles**, y las barricadas también (dos tablas).
  - **Luz**: en salas altas y anchas la llama alcanza menos. El rebote de luz ayuda, y hacen falta los **braseros** de la mazmorra y las antorchas de pared para que una sala grande se pueda leer.
  - **Cámara en primera persona**: con techos altos, el campo de visión de 62° muestra poco techo. Va bien con el ajuste que ya existe.
  - **Rendimiento**: más pared quiere decir más ladrillos. Los ladrillos se agrandan con la altura (hiladas más gruesas arriba) y se agrupan por trozos, como ahora.
  - **Tamaño del nivel**: con pasillos y salas más grandes, el nivel de 100×76 se llena con menos salas. Hay que revisarlo con la biblioteca de locaciones.

## 5. Orden propuesto

1. **Proporciones** (paredes, pasillos, salas, puertas dobles): cambia todo lo demás, conviene primero.
2. **Grilla 3D y formato de locaciones**, con 5 locaciones de prueba.
3. **Biblioteca de piezas**, primera tanda.
4. **Locaciones** en tandas de 10 a 15.

El día, el alto, el cinturón y los objetos (en `expedicion-v2.md`) pueden ir en paralelo, porque tocan otras partes del código.

## Decisiones

1. **Se arranca por acá**: proporciones, después la grilla 3D, las piezas y las locaciones.
2. **Las locaciones las diseño yo en tandas de 10 a 15**, y vos revisás cada tanda: descartás, cambiás o agregás.
3. **El nivel es un proyecto de varios días** (ver `expedicion-v2.md`). Eso pide **accesos al nivel siguiente que haya que buscar y abrir**, y probablemente **niveles más grandes**.
