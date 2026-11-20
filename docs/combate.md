# Combate y enemigos — v2

> Estado: **aprobado**. Lo marcado como **[Supuesto]** son valores o detalles míos para validar al probar.

## Idea central

El combate es **tenso, no arcade**: pocos enemigos, que pegan fuerte y avisan antes de pegar. Pelear siempre cuesta algo (vida, sed, luz), así que muchas veces conviene esquivar, rodear o huir.

**La luz es el centro del combate.** Tu luz te deja ver, pero también te delata: cuanto más grande es la llama, desde más lejos te detectan los horrores. Bajar la luz para pasar desapercibido, o subirla para ver venir el peligro, es una decisión constante.

## Controles

**Celular**:
- Pulgar izquierdo: joystick (como ahora).
- Pulgar derecho, dos botones:
  - **Atacar** (grande):
    - **Toque**: ataque básico. Si el toque llega justo antes de un golpe enemigo, es un **parry**.
    - **Mantener**: habilidad de la clase. Un aro en el botón muestra la recarga.
  - **Esquivar**: rueda corta con un instante de invulnerabilidad.
- Apuntado automático: el ataque va al enemigo más cercano dentro del cono hacia donde mirás. Si no hay ninguno, va hacia donde mirás.

**Compu**: WASD o flechas para moverse, `Espacio` o `J` para atacar (mantener para la habilidad), `Shift` o `K` para esquivar, `Enter` para usar la escalera.

## Costo de pelear (en lugar de estamina)

Como el hambre y la sed cumplen el papel de la estamina:
- Cada ataque y cada esquiva gasta un poco de **sed**.
- La habilidad del Cirial gasta **luz**.

Así, pelear mucho te obliga a volver a buscar agua.

## Parry

- Tocar Atacar abre una ventana corta (**[Supuesto]** unos 0,2 segundos). Si un golpe cuerpo a cuerpo te llega dentro de esa ventana, lo desviás.
- **Resultado**: no recibís daño, el enemigo queda aturdido y tu próximo golpe es crítico.
- **Si fallás el tiempo**: estás a mitad de un ataque y el golpe entra.
- **No se puede parar**: el golpe pesado del Hueco ni los escupitajos de la Plañidera. Hay que esquivarlos.
- **Por clase**: el Saqueador tiene la ventana más amplia; el Verdugo la más corta, pero aturde más tiempo. La Agilidad ensancha la ventana.

## Clases

Cada clase tiene un arma, un ataque básico, una habilidad y un rasgo pasivo.

| | Verdugo | Saqueador | Cirial |
|---|---|---|---|
| Arma | Hacha de dos manos | Dos dagas | Maza y cirio |
| Ataque básico | Lento, arco amplio, mucho daño, empuja | Rápido, poco daño | Medio |
| Habilidad (mantener Atacar) | **Tajo cargado**: seguís manteniendo para cargar y al soltar golpeás en círculo | **Paso sombrío**: salto largo hacia donde apunta el joystick que te vuelve invisible un momento | **Llamarada**: quema luz para dañar y espantar a todos alrededor |
| Pasivo | Más vida; el hambre y la sed bajan un 25 % más rápido | Más velocidad; golpe por la espalda o sin ser detectado ×3 | Su luz delata menos; los horrores dudan antes de entrar en su luz |
| Debilidad | Lento para esquivar | Poca vida | Sin luz, pierde su habilidad |

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
- Al morir pueden soltar comida, agua o aceite.

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
