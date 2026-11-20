# Héroes caídos — Etapa B (propuesta v1)

> Estado: **aprobado** (todas las propuestas). Se implementa en dos PR: **B1** y **B2** (ver Decisiones).

## Idea

Cada integrante que muere queda abajo, reclamado por la maldición. La próxima vez que alguien de la familia baje, su ancestro lo espera en el nivel donde cayó: con su clase, su oro y un poder por cada rasgo que tuvo en vida. Derrotarlo lo deja **descansar en paz**.

## Qué ya está decidido (de `concepto.md`)

- Todo héroe que muere se vuelve jefe, sea cual sea la causa, en el nivel donde murió.
- Un jefe por nivel. Quien muere en un nivel con jefe se suma a su **escolta maldita**, con su oro.
- Un nivel con jefe es más peligroso mientras el jefe siga ahí.
- Los atributos especiales salen de los rasgos (catálogo en `rasgos.md`); otros dependen de la profundidad.
- Si lo derrotás, descansa en paz, desaparece para siempre y suelta lo que llevaba.
- El oro del que muere queda con su jefe; sin depósito familiar.

## El jefe

### Dónde está

- **Guarida**: la sala donde murió (si murió en un pasillo, la sala más cercana).
- Está **dormido** hasta que entrás a su guarida o lo despertás haciendo ruido cerca. Al despertar aparece su nombre arriba de la pantalla.
- Te persigue hasta unas **10 casillas** de su guarida; si te alejás más, vuelve a su sala. Podés huir por la escalera.
- Excepciones por rasgos: *Cuentapasos* patrulla el nivel, *Memoria vieja* y *Memorioso* te cortan el paso por atajos, *Lector de runas* se teletransporta.

### Cómo pelea

- **Su clase define sus movimientos**, como los tuyos:
  - **Verdugo**: barridos anchos que empujan; un hachazo pesado imposible de desviar; ejecuta si te ve con poca vida.
  - **Saqueador**: ráfagas de puñaladas rápidas; paso sombrío (desaparece y reaparece a tu espalda).
  - **Cirial**: golpes que te dejan cera (te marca y te quema); llamarada que te quema luz.
- Avisa antes de pegar, igual que los horrores, pero con amagues propios de su clase.
- **Fuerza por profundidad**: vida base 70 + 18 por nivel de profundidad, daño base 10 + 2 por nivel. Se ajusta jugando.
- **Un poder por rasgo** (ver abajo). Un jefe con cinco rasgos es temible; uno con defectos tiene puntos débiles.

### Sus heridas

- Las heridas **no cierran del todo**: entre vidas recupera la mitad de la vida que le quitaste. La familia lo va desgastando generación tras generación. Dentro de una misma vida, si te alejás, se regenera lento.

### Cómo se ve y se oye

- Su propio dibujo de héroe, **invertido en tinta**: cuerpo negro, líneas de papel, ojos pálidos como cera. Un poco más grande que en vida.
- Lleva su llama, pero **negra**: oscurece en vez de iluminar.
- **Nombre y epíteto** arriba, con una línea de tinta como vida (sin números). El epíteto sale de cómo murió, sin género gramatical:
  - hambre: *Hambre Eterna* · sed: *Garganta Seca*
  - Rastrero: *Pasto de Rastreros* · Hueco: *Golpe Hueco* · Plañidera: *Lágrima de Tinta* · Apagavelas: *Llama Robada*
  - a manos de otro jefe: *Eco de {nombre}*
- **Presencia**: cerca de su guarida tu llama tiembla, se oye un latido grave y un susurro que dice su nombre.

### Lo que se sabe de él

- Es tu ancestro: **conocés sus rasgos**. En el árbol, tocando a un caído ves sus rasgos y lo que hacen como jefe.
- En el mapa, la cruz de su muerte se vuelve una **calavera** con su nombre en la guarida.

## La escolta maldita

- Quien muere en un nivel que ya tiene jefe vuelve como **eco**: más débil (**[Propuesta]** la mitad de vida que un jefe de esa profundidad), con el ataque básico de su clase y **un solo poder**: el de su rasgo más raro.
- Los ecos acompañan al jefe y despiertan con él. Cada uno lleva su oro.
- Si matás a un eco, también descansa en paz.

## El nivel con jefe

**[Propuesta]** Mientras el jefe siga ahí:

- **+30 % de horrores**, más atentos (te detectan desde un poco más lejos).
- Tu luz dura un poco menos (la maldición pesa).
- Algunos rasgos del jefe cambian el nivel entero (*Maldito*, *Camello*, *Rata de túnel*, *Lector de runas*, *Ruidoso*).

## Descansar en paz

- Al derrotarlo se deshace en tinta y suelta **su oro**.
- La crónica lo cuenta: *"Mirta liberó a su abuela Brenna, que descansa en paz en la profundidad 7."*
- En el árbol su retrato **se restaura** (deja de estar tachado) y dice quién lo liberó.
- **Herencia del muerto**: quien lo libera puede tomar **uno de sus rasgos** (no de vejez), elegido en una pantalla, respetando el tope de 5. Es la otra forma de heredar: ganándosela.
- El nivel vuelve a la normalidad y **puede volver a tener un jefe** si alguien muere ahí después.

## Oro

Hoy el juego no tiene oro ni equipo. Lo sumo en esta etapa, solo el oro:

- Se encuentra en la mazmorra (montoncitos en salas, más hondo, más oro) y algunos horrores lo sueltan.
- Se ve en el HUD. Todavía no se gasta: la tienda llega con la mansión.
- Al morir, tu oro queda con tu jefe o tu eco. Para recuperarlo, hay que liberarlo.

El **equipo** (armas, armaduras, fuentes de luz) queda para la etapa de la tienda; ahí el jefe también conservará el suyo.

## Los 100 poderes

Cada rasgo ya tiene su poder en `rasgos.md`. Para implementarlos los agrupo en familias que el motor entiende, así casi todos son datos y no código suelto:

| Familia | Ejemplos | Cantidad aprox. |
|---|---|---|
| **Números** (vida, armadura, daño, velocidad, críticos, alcance de vista y oído) | *Sangre espesa*, *Huesos de roble*, *Andariego*, *Ojos de lechuza* | 30 |
| **Al golpearte** (empuja, frena, te quita sed, hambre o luz, te estrella contra la pared) | *Garganta de piedra*, *Ahorrativo*, *Puño de hierro* | 12 |
| **Defensa** (esquiva, desvía, contragolpe, espinas, escudo, revive, sin espalda) | *Pies ligeros*, *Reflejos*, *Duro de matar* | 14 |
| **Ataques extra** (dos o cuatro golpes, embestida, escupe tinta, área a ciegas, amagues) | *Ambidiestro*, *Implacable*, *Sabiduría* | 12 |
| **Luz y vista** (achica tu luz, te la apaga, invisible fuera de tu luz, lleva luz propia, deslumbra) | *Ojos de gato*, *Sombra larga*, *Supersticioso* | 12 |
| **Movimiento** (patrulla, atajos, teletransporte, salta atrás, huye y vuelve curado) | *Cuentapasos*, *Lector de runas*, *Cobarde* | 8 |
| **Invocaciones** (ecos de sí mismo, se parte en dos, Rastreros escoltas, comanda horrores, aúlla) | *Canas*, *Enclenque*, *Mataarañas*, *Estratega* | 6 |
| **Debilidades** (lado ciego, rengo, tropieza, se atraganta, se debilita con el tiempo) | *Tuerto*, *Pierna mala*, *Torpe*, *Hemofílico* | 8 |
| **El nivel** (tu llama se gasta más, objetos falsos, seca el agua, devora muertos) | *Maldito*, *Rata de túnel*, *Camello*, *Carroñero* | 6 |

## Guardado

- La dinastía guarda los jefes y ecos de cada profundidad: quién es, su guarida, su vida restante, su oro y si descansa en paz.
- **Migración** del guardado: los caídos de la Etapa A se vuelven jefes (o ecos, si murieron en un nivel que ya tenía uno). Nadie pierde a sus muertos.

## Técnica

- Lógica en `src/core/`: `boss.ts` (creación desde el integrante, poderes como datos, comportamiento por clase), integración en `World` (guarida, persecución, escolta, nivel maldito), oro. Todo determinista, con tests.
- La dinastía registra jefes, ecos, liberaciones y oro; la crónica suma las entradas nuevas.
- Dibujo: el héroe invertido, llama negra, cartel con nombre y vida, presencia (sonido y viñeta).

## Decisiones

1. **Dos PR**. **B1**: jefe, escolta, oro, nivel maldito y las familias simples (números, al golpearte, defensa, debilidades). **B2**: las complejas (invocaciones, teletransporte, atajos, objetos falsos, amagues, ataques extra que falten).
2. **Heridas entre vidas**: recupera la mitad de lo que le quitaron.
3. **Herencia del muerto**: sí, quien lo libera puede tomar uno de sus rasgos.
4. **Nivel liberado**: puede volver a tener jefe.
5. **Oro**: entra ahora, aunque todavía no se pueda gastar.
