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
