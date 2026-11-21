# El edificio (propuesta v2)

> Estado: **rumbo aprobado**; las medidas, el catálogo de piezas y las etapas son **[Propuesta]** para revisar. Reemplaza a la V5 de `docs/voxeles.md`.

## Decisiones

- **Finito y enorme, con fondo**: unos 600 m de hondo, con la raíz de la maldición como meta. Inexplorable en la práctica. Cambia el "la profundidad no tiene techo" del concepto.
- **Plan de un tirón, detalle derivado**: el plan entero se decide al empezar; los vóxeles de cada sector salen de él cuando hacen falta, siempre iguales.
- **Por historia (estratos)**: lo más hondo es lo más viejo; cada época cava a través de las anteriores.
- **Sin niveles**:
  - el espacio es uno solo, armado con **piezas de jenga** (prismas en distintas orientaciones), algunas de ellas **conectores verticales**;
  - las **zonas** separan el edificio en capas con una losa que ninguna pieza atraviesa, salvo los pasos de zona (con llave);
  - las zonas se agrupan en **áreas**, donde cambia la geografía.
- **Los huecos son de verdad**: se cae por el pozo o la galería, con daño. La soga sigue siendo la forma segura de bajar.
- **Orden**: V3 y V4 (hechas), después las etapas Ed.

## El tamaño, y cómo entra en el celular

Un edificio así no entra en memoria ni se genera entero en un tiempo razonable. Por eso:
- al empezar se genera el **plan completo** (áreas, zonas, piezas, conexiones, catástrofes), que es poco dato;
- los **vóxeles de cada sector** se deducen del plan cuando el héroe se acerca, y se descartan cuando se aleja;
- el resultado es siempre el mismo, así que da igual que si se hubiera generado todo junto;
- se guardan **solo los cambios** de la familia.

## Escalas (de chico a grande)

| Escala | Qué es | Medida **[Propuesta]** |
|---|---|---|
| **Vóxel** | la columna de tramos de la V1 (1 casilla = 1 m) | 1 × 1 m, alturas libres |
| **Celda** | la grilla del jenga: las piezas encajan en ella | 6 × 6 m × 6 m de alto (un piso) |
| **Pieza** | un prisma de celdas, girable, con aberturas en sus caras | de 1 × 1 × 1 a unas 4 × 4 × 6 celdas |
| **Sector** | la unidad que se genera, se dibuja y se descarta | 8 × 8 celdas × 4 pisos = 48 × 48 × 24 m |
| **Zona** | una capa del edificio, entre dos losas selladas | 4 pisos (24 m) + 1 m de losa |
| **Área** | 5 zonas de la misma época, con su geografía | unos 125 m de alto |
| **Edificio** | 5 áreas, de la mansión al fondo | ~625 m |

- **Por qué estas medidas**:
  - Con celdas de 6 m entra todo lo de hoy: pasillos de 2, salas de 6 a 18 (1 a 3 celdas), locaciones (de 2 × 2 a 4 × 1 celdas).
  - Un piso de 6 m deja techos de hasta 5,5 con su losa, y los salones altos ocupan 2 o 3 pisos.
- **La silueta se ensancha hacia abajo**, como raíces:

  | Área | Ancho por zona | Una zona equivale a… |
  |---|---|---|
  | 1 | 144 × 144 m (3 × 3 sectores) | unos 4 niveles de hoy |
  | 2 | 240 × 240 m | unos 10 |
  | 3 | 336 × 336 m | unos 20 |
  | 4 | 480 × 480 m | unos 40 |
  | 5 | 672 × 672 m | unos 80 |

  En total son 25 zonas y unos 770 niveles de hoy. Inexplorable, pero la primera área se recorre en pocas vidas.

## Zonas: capas selladas con pasos

- Una **losa de roca de 1 m** separa cada zona de la siguiente; ninguna pieza la atraviesa.
- Se cruza solo por los **pasos de zona** (de 2 a 4 por zona), que son conectores verticales:
  - **uno está siempre en el recorrido principal**, cerrado con llave. La llave está en la zona de arriba, lejos del paso, como hoy;
  - los otros son atajos: un pozo para caer, una catarata, un paso escondido, uno trabado que se fuerza.
- **Llaves**: hierro en las áreas 1 y 2, bronce en la 3, hueso en la 4 y la 5 (como hoy, según la profundidad).
- **Por zona**: cada zona tiene sus horrores, su loot y su caído (un jefe por zona). La dificultad sube con la profundidad en metros.

## Áreas: la geografía

Cada área es una época, con su paleta de vóxeles, su biblioteca de piezas, su luz, su agua y sus horrores. Cada edificio sortea 5 entre estas épocas, en orden de antigüedad:

1. **Bodegas** de la mansión: ladrillo y madera, barriles.
2. **Cripta de la familia**: nichos, osarios, capillas.
3. **Cisternas**: bóvedas sobre columnas, agua quieta, canales.
4. **Fundición**: hierro, chimeneas de varios pisos, cadenas.
5. **Biblioteca hundida**: galerías con balcones, escaleras de caracol.
6. **Minas** de los que cavaron antes: puntales, rieles, malacates.
7. **Ciudad enterrada**: calles y casas bajo un techo de roca.
8. **Catedral invertida**: una nave que cuelga hacia abajo, con puentes.
9. **Cuevas vivas**: roca natural, ríos, abismos.
10. **La raíz de la maldición**: siempre la última.

- **El paso entre áreas** es un **umbral**: una pieza enorme y única, por ejemplo un pozo con una espiral de 3 zonas o una catarata gigante, que se ve de lejos y sirve para orientarse.
- **Una época vieja asoma en una nueva**: piezas de un área se cuelan en las zonas de la de arriba (ruinas, galerías de saqueadores).

## Las piezas

Cada pieza es un prisma de celdas. Gira en 4 orientaciones, y algunas se pueden acostar. En sus caras tiene **aberturas**:
- **puertas**: de 2 de ancho, al nivel del piso de una celda;
- **escotillas**: en el techo o el piso;
- **ciegas**: donde no hay abertura.

Dos piezas vecinas encajan si sus aberturas coinciden.

**Conectores verticales** (lo nuevo):
- **Escalera de caracol** (1 × 1 celda, de 1 a 4 pisos): gira alrededor de una columna. Tiene puertas en los pisos que quiera.
- **Escalera larga** (acostada, 2 × 1 celdas por piso que baja): un tramo recto, con descanso.
- **Pozo con espiral** (2 × 2 o 3 × 3 celdas, de 2 a 8 pisos):
  - una rampa baja pegada a la pared, con el centro abierto;
  - en cada piso hay un balcón con puerta;
  - caerse es posible.
- **Catarata** (1 × 2 celdas, de 2 a 4 pisos):
  - un río cae por un tiro hasta una poza honda;
  - **saltar es un atajo**: el agua amortigua la caída;
  - subir no se puede, salvo por una escalerilla lateral rota que la familia puede reparar.
- **Tobogán o desagüe** (acostado, de 2 a 4 celdas): un caño en pendiente fuerte que **solo se baja**. Arma atajos de ida y obliga a buscar la vuelta.
- **Pozo de malacate** (1 × 1, muchos pisos): una jaula con cadena y manivela. Viene rota; repararla es una obra.
- **Escalerillas** en tiros angostos: introducen un modo de trepar (lento, sin pelear).
- **Atrio** (2 × 2 × 2 a 4 × 4 × 4): un salón de varios pisos con galerías alrededor y escaleras entre ellas.

**Piezas de un solo piso**: pasillos (recto, codo, T, cruce, con 2 de ancho), salas, salones de 2 pisos de alto, puentes sobre un abismo y **locaciones** hechas a mano (las de hoy, con su caja redondeada a celdas).

**Piezas procedurales** (decidido): además del catálogo (conectores y unas 100 piezas diseñadas a mano), el plan genera piezas por reglas con la semilla:
- salas de formas raras, cuevas, galerías y pasillos con recovecos;
- con aberturas como las demás, así que encajan en el jenga;
- enriquecen la variedad sin diseñar todo a mano.

**Relleno procedural** (decidido): los espacios muertos que deja el jenga se llenan por procedimiento:
- cuevas, cámaras chicas y grietas en la roca que sobra entre piezas;
- túneles que unen aberturas sueltas;
- las catástrofes cortan a través de todo, menos de las losas de zona.

## El gran procedimiento (en orden)

1. **Silueta y áreas**: el tamaño de cada zona y la época de cada área.
2. **Recorrido principal**: de la mansión al fondo, con el paso con llave de cada zona y los umbrales entre áreas.
3. **Jenga por zona**:
   - primero los conectores verticales y las locaciones únicas, anclados al recorrido;
   - después piezas que encajan por sus aberturas, creciendo desde ellos, hasta llenar la zona con su densidad;
   - al final, túneles por la roca para unir lo que haya quedado suelto.
4. **Catástrofes**: derrumbes de piezas sin apoyo (pozos de varios pisos dentro de la zona), el nivel freático (lo de abajo, inundado), raíces e incendios.
5. **Reparto**: luces, loot, puestos, horrores y llaves.

## Qué cambia en el juego

- **No hay "bajar de nivel"**: se camina, se cae y se trepa por un solo espacio. "Profundidad" pasa a ser metros, y la zona es la unidad de juego (horrores, loot, caído, llave).
- **Los huecos son de verdad**:
  - caer por el pozo hace daño;
  - en una catarata el agua amortigua;
  - un abismo sigue sin fondo, o llega a la losa de la zona según la pieza.
- **Mapa**: por pisos, con los de arriba y abajo tenues, y una vista de la zona de costado.
- **Obras**: escaleras de la familia que atraviesan pisos, reparar malacates y escalerillas.
- **Guardado**: versión nueva; las dinastías anteriores se apartan.

## Etapas propuestas

- **Ed1 · El espacio y los sectores** (motor):
  - coordenadas del edificio, celdas y sectores;
  - sectores que se generan cuando hacen falta y se descartan;
  - dibujo por sector alrededor del héroe;
  - cuerpos, caminos y vista que cruzan sectores;
  - caer de verdad por un hueco.
  - Mientras tanto, para que el juego siga andando: los niveles de hoy se apoyan como pisos a 6 m de distancia, unidos por **la primera pieza vertical (la escalera de caracol)** en el lugar de la escalera de hoy.
- **Ed2 · El plan**:
  - silueta, áreas y zonas con sus losas;
  - recorrido principal, pasos de zona con llave y umbrales;
  - la zona pasa a ser la unidad de juego.
- **Ed3 · El jenga**:
  - formato de piezas (prismas de celdas con aberturas, una planta por altura);
  - el armado por zona;
  - la primera tanda de piezas por área y los conectores verticales;
  - las locaciones de hoy como piezas.
- **Ed4 · Catástrofes y agua**: derrumbes por apoyo, nivel freático, cataratas que amortiguan, raíces e incendios, umbrales.
- **Ed5 · Jugar en el edificio**: mapa por pisos, caídos por zona, campamentos y puestos, trepar escalerillas, guardado.

## Ed1 implementada: el espacio y los sectores

- **El edificio** (`src/core/building.ts`): un solo espacio de vóxeles en vez de niveles separados.
  - Mientras llega el plan (Ed2), su contenido son **los niveles de hoy, apilados como pisos a 6 m**: el piso del nivel d está a −(d − 1) × 6.
  - Cada piso ocupa su **franja**: desde 1 m debajo de su piso (la losa) hasta 5 m arriba.
  - Para que entren, los salones bajan de 5,5 a 5 de techo y el fondo de las pozas profundas pasa de −1,2 a −0,9.
- **Sectores** de 48 × 48 casillas (por ahora de un piso de alto):
  - se generan cuando se los pide y se descartan los que no se usan (quedan unos 96);
  - cada nivel se genera una sola vez y el mundo usa una copia.
- **Escalera de caracol**: donde estaba la escalera, un pozo de 3 × 3 une cada piso con el siguiente.
  - Tiene una columna central de piedra y escalones que dan vuelta y media alrededor, bajando 6 m en 13 casillas (menos de medio metro por casilla).
  - Se camina sola: ya no hay una regla aparte para la escalera.
  - Al bajar o subir más de 3,5 m, el piso que se juega pasa a ser el de abajo o el de arriba. El cuerpo conserva su caída si venía cayendo.
  - La escalera de subida del primer piso lleva a la mansión.
- **Huecos de verdad**:
  - **el pozo** abre la losa y cae al descanso del piso de abajo: unos 6 m, que hacen daño (unos 42 de vida). La soga sigue siendo la forma segura de bajar. Si tiene la reja trabada, la reja cierra el paso;
  - **la galería** abre al piso de abajo;
  - **los abismos son grietas**: bajan por la roca de los pisos de abajo hasta dar con un lugar abierto (y se cae en esa sala, desde muy alto) o hasta atravesar 3 pisos de roca, y ahí terminan. Caer en uno es casi siempre la muerte.
- **Saltar de un borde**: caminando nadie cae; **empujando medio segundo contra el borde** de una caída de hasta un piso, el héroe salta. Un abismo nunca deja saltar así. Los golpes que empujan pueden tirar a los horrores por los huecos; los que caen al piso de abajo se van de este.
- **Dibujo por sectores**:
  - cada sector tiene sus mallas;
  - cerca de los huecos, del pozo y de la escalera se dibuja también el piso de abajo;
  - sobre la escalera que sube, el de arriba;
  - solo las grietas de los abismos se funden a tinta.
  - Los escalones de caracol, la columna central y las paredes del pozo salen de los vóxeles, con ladrillos.
  - Se fueron la escalera recta, el "nivel de abajo" que se dibujaba aparte y las tapas falsas de los huecos.
- **Guardado**: no cambia de versión. La planta 2D de los niveles es la misma, así que las dinastías y las vidas en curso siguen valiendo.
- **Costo**:
  - bajar o subir un piso tarda unos 400 ms en la compu (antes, unos 250), porque genera el piso de abajo y arma la vista;
  - el tiempo por cuadro no cambia.
- **Pendiente**:
  - generar los pisos de abajo de antemano, en segundo plano, para que cambiar de piso no se trabe en el celular;
  - los sectores pasan a tener 4 pisos de alto con el plan (Ed2);
  - el desagüe (sumidero) y la catarata siguen dibujándose como antes.

## Ed2 implementada: el plan

- **El plan** (`src/core/plan.ts`) se decide de una vez con la semilla:
  - **5 áreas de 5 zonas, de 4 pisos cada una**: 100 pisos en total;
  - **las épocas por estratos**: las bodegas siempre arriba (son de la mansión) y la raíz siempre al fondo; las tres del medio se sortean entre las otras ocho y se ordenan por antigüedad. Cada semilla, su combinación;
  - el ancho de cada área (de 144 a 672 casillas) queda en el plan.
- **Las zonas**:
  - **Losa entre zonas**: 1 m más de roca bajo el último piso de cada zona. La atraviesan solo la escalera de caracol de la zona (que ahí baja 7 m) y el pozo de ese piso (una caída de 7 m, un atajo).
  - **Las grietas no la cruzan**, y el relleno provisorio no pone abismos en el último piso de una zona.
  - **El paso de zona siempre está cerrado con llave**: el cuarto de la escalera tras puertas con cerrojo, o, si el cuarto no se puede cerrar, una **reja con cerrojo sobre la boca del pozo**, que cierra la escalera entera. Se abre con la llave, con ganzúas (el Saqueador) o a golpes, y queda abierta para la familia. La llave está en el mismo piso, lejos de la llegada.
  - **Dentro de una zona los pisos están abiertos**: sus escaleras no tienen cerrojo.
  - **Llaves por área**: hierro en las áreas 1 y 2, bronce en la 3, hueso en la 4 y la 5.
- **Nombres**: cada zona se llama por su época y su número ("Bodegas I", "Cripta III").
  - El HUD y el mapa muestran la zona y el piso ("Bodegas II · piso 3").
  - Al entrar en una zona nueva aparece su nombre.
- **El fondo**: bajo el piso 100 no hay nada; su escalera de bajada está tapiada. Lo que espera ahí (la raíz de la maldición) queda para más adelante.
- **Supuestos para validar**:
  - El relleno sigue siendo el de los niveles de hoy, de 170 × 130 en todas las áreas. El ancho de cada área se aplica con el jenga (Ed3), que arma las zonas con su tamaño real: hacerlo ahora obligaba a reescribir el generador viejo.
  - Los horrores, el loot y la dificultad siguen yendo por piso (crecen con la profundidad). Los caídos por zona llegan con la etapa de los jefes.
  - Los umbrales entre áreas (las piezas enormes) llegan con el jenga y las catástrofes (Ed3 y Ed4).
- **Guardado**: misma versión. Ojo: en una dinastía en curso, los cerrojos se mueven a los pasos de zona; las puertas que ya se abrieron siguen abiertas.
