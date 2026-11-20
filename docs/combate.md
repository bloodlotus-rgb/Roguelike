# Combate y enemigos — v3

> Estado: **aprobado**. Lo marcado como **[Supuesto]** son valores o detalles míos para validar al probar.

## Idea central

El combate es **tenso, no arcade**: pocos enemigos, que pegan fuerte y avisan antes de pegar. Pelear siempre cuesta algo (vida, sed, luz), así que muchas veces conviene esquivar, rodear o huir.

**La luz es el centro del combate.** Tu luz te deja ver, pero también te delata: cuanto más grande es la llama, desde más lejos te detectan los horrores. Bajar la luz para pasar desapercibido, o subirla para ver venir el peligro, es una decisión constante.

## Controles

**Celular**:
- Pulgar izquierdo: joystick (como ahora).
- Pulgar derecho, tres botones:
  - **Atacar** (grande): ataque básico. Si el toque llega justo antes de un golpe enemigo, es un **parry**.
  - **Especial**: la habilidad de la clase. Un aro en el botón muestra cuánto falta para cargarla.
  - **Esquivar**: tocar hace una rueda corta con un instante de invulnerabilidad. **Mantener** hace correr.
- Apuntado automático: el ataque va al enemigo más cercano dentro del cono hacia donde mirás. Si no hay ninguno, va hacia donde mirás.

**Compu**: WASD o flechas para moverse, `Espacio` o `J` para atacar, `L` o `Q` para el especial, `Shift` o `K` para esquivar (mantener para correr), `Enter` para usar la escalera.

## Costo de pelear (en lugar de estamina)

Como el hambre y la sed cumplen el papel de la estamina:
- Cada ataque y cada esquiva gasta un poco de **sed**.
- La habilidad del Cirial gasta **luz**.
- **Correr** gasta sed y hambre de forma continua y **hace ruido**: los horrores te detectan desde más lejos y te oyen aunque estén de espaldas.

Así, pelear mucho te obliga a volver a buscar agua.

## Parry

- Tocar Atacar abre una ventana corta (**[Supuesto]** unos 0,2 segundos). Si un golpe cuerpo a cuerpo te llega dentro de esa ventana, lo desviás.
- **Resultado**: no recibís daño, el enemigo queda aturdido y tu próximo golpe es crítico.
- **Si fallás el tiempo**: estás a mitad de un ataque y el golpe entra.
- **No se puede parar**: el golpe pesado del Hueco ni los escupitajos de la Plañidera. Hay que esquivarlos.
- **Por clase**: el Saqueador tiene la ventana más amplia; el Verdugo la más corta, pero aturde más tiempo. La Agilidad ensancha la ventana.

## Clases

Cada clase tiene un arma con su propio combo, un especial con su forma de cargarse y una pasiva. Los especiales tienen además un tiempo mínimo entre usos.

| | Verdugo | Saqueador | Cirial |
|---|---|---|---|
| Arma | Hacha de dos manos | Dos dagas | Maza y cirio |
| Ataque básico | Barrido ancho y lento que empuja. El **tercer golpe seguido** es un hachazo vertical que aturde. | Puñaladas rápidas; la **cuarta** del combo es un tajo doble. Golpe ×3 por la espalda o sin ser visto. | Cada golpe deja **cera ardiendo**: el horror queda marcado (se lo ve aunque salga de tu luz) y se va quemando. |
| Especial | **Ejecución**: mata en el acto a un horror aturdido o con poca vida; si no, golpe muy fuerte. | **Paso sombrío**: salto hacia donde apuntás que te vuelve invisible un momento. Mientras dura, la llama se apaga y ve en la oscuridad: todo negro, con los contornos y las tramas dibujados en blanco, como tiza. | **Llamarada**: quema luz para dañar y espantar a todos alrededor. Los marcados con cera reciben el doble. |
| Carga del especial | **Furia**: pegando y recibiendo golpes. | **Oportunidad**: con el tiempo; los golpes por la espalda y los parry la aceleran mucho. | **Devoción**: con el tiempo; además gasta luz al usarlo. |
| Pasiva | **Sed de sangre**: matar le devuelve la mitad de la vida que perdió en los últimos segundos (si no lo golpearon, no cura). | **Ojo de rata**: ve los objetos cercanos aunque estén a oscuras, y los horrores le sueltan botín más seguido. | **Llama devota**: su luz dura un 30 % más y los horrores dudan antes de entrar en ella. |
| Debilidad | Lento; el hambre y la sed bajan un 25 % más rápido. | Poca vida. | Sin luz, no hay especial. |

## Horrores (enemigos iniciales)

Cuatro tipos, cada uno con un comportamiento claro y una forma de enfrentarlo:

| Nombre (*inglés*) | Comportamiento | Cómo enfrentarlo |
|---|---|---|
| **Rastrero** (*Crawler*) | Débil y rápido, anda en grupos de 3 a 5. Rodea al héroe y ataca por los costados. | Golpes en arco; ponerse contra una pared. |
| **Hueco** (*Husk*) | Lento y resistente. Su golpe es muy fuerte pero tarda en cargarlo. | Esquivar el golpe y castigar después. |
| **Plañidera** (*Mourner*) | Mantiene la distancia y escupe proyectiles de tinta. Huye si te acercás. | Acortar distancia o cortar la línea de visión. |
| **Apagavelas** (*Snuffer*) | Sigiloso, solo se ve de cerca. Si te golpea, **te roba luz**. | Mantener la luz alta para verlo venir, o matarlo rápido. |

**Comportamiento general:**
- Los horrores están quietos o deambulan hasta que **te detectan**. La distancia de detección depende de tu luz.
- **Antes de atacar avisan:** la tinta se junta o el cuerpo se tensa. Siempre hay un instante para esquivar.
- Ubicación y cantidad salen de la semilla y **se vuelven a sortear en cada vida**, como el loot. La cantidad y la variedad crecen con la profundidad.
- Por ahora no reaparecen dentro de la misma vida. Eso llegará con la noche.
- Algunos **deambulan entre salas** en lugar de quedarse en la suya.
- Cuando uno te detecta, alerta a los que están cerca.
- Al morir pueden soltar comida, agua o aceite.

## Mazmorra más viva

- Más horrores por nivel.
- Salas con forma: **cavernas** irregulares y **salas con columnas**. Las columnas tapan la vista y sirven para esconderse.
- Decorado: huesos, escombros, manchas, cadenas y restos de otros aventureros.

## Respuesta visual (estilo tinta y papel)

- Sin números de daño: los golpes salpican tinta y el enemigo retrocede.
- El héroe herido parpadea y la pantalla tiembla apenas.
- Los enemigos heridos se ven más "borroneados". No tienen barra de vida.
- Al morir, el horror se deshace en un manchón de tinta que queda en el piso.

## Atributos

Los atributos entran en esta etapa con valores base por clase, sin rasgos todavía (los rasgos llegan con el linaje):

| Atributo | Efecto en esta etapa |
|---|---|
| Fuerza | Daño cuerpo a cuerpo |
| Agilidad | Velocidad de ataque y de esquiva; ventana de parry |
| Vigor | Vida máxima |
| Percepción | Distancia a la que ves a los sigilosos; probabilidad de crítico |
| Ingenio | Sin efecto todavía (trampas y cerraduras, más adelante) |
| Voluntad | Sin efecto todavía (miedo y noche, más adelante) |

## Elegir clase

Antes de bajar aparece una pantalla simple para elegir clase. Todavía no hay linaje: es un héroe suelto.

## Fuera de esta etapa

Rasgos, guardado, linaje, armaduras, tienda, oro, noche, campamentos y jefes.

## Técnica

- Toda la lógica de combate (vida, daño, estados de los enemigos, detección, recargas) va en `src/core/`, testeada con vitest.
- Las tiradas (críticos, botín) salen de un PRNG derivado de la semilla y de la vida.
- Phaser solo dibuja, anima y muestra los efectos.
