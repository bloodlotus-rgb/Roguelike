# Expedición: cuerpo, mochila, campamento y obras (propuesta v2)

> Estado: **aprobado**. Se implementa en tres etapas: E1, E2 y E3. Reemplaza el manejo de recursos actual y le da forma a los campamentos y a la noche de `concepto.md`. Va **antes de los jefes** (Etapa B). Lo marcado **[Propuesta]** es mío para validar.

## Por qué

Hoy el único recurso que importa es la vida: la comida, el agua y el aceite se consumen al levantarlos y casi nunca faltan. La idea es que **cada expedición sea un viaje que se planifica**: cuánto llevo, hasta dónde llego, dónde paso la noche, cuándo vuelvo. Explorar deja de ser solo avanzar matando y pasa a ser **administrar el cuerpo**.

## 1. El cuerpo

### Los medidores

| Medidor | Qué representa | Qué lo gasta | Cómo se recupera |
|---|---|---|---|
| **Vida** | Heridas | Golpes, hambre o sed en cero | Sola, fuera de combate, **pagando con hambre y sed**; durmiendo |
| **Hambre** | La fuerza del cuerpo | Atacar, cargar peso, el especial del Verdugo; un poco al caminar | **Solo comiendo en el campamento** |
| **Sed** | El aliento | Correr, esquivar, el especial del Saqueador; un poco al caminar | **Solo bebiendo en el campamento** |
| **Luz** | El aceite de la lámpara | Con el tiempo; la llamarada del Cirial | Cargando la lámpara con un frasco (en cualquier lado, tarda unos segundos) |

- **Ración de marcha**: la única comida que se come **sin fogón**, caminando. Se encuentra (poco) y se compra en la mansión. Es cara y ocupa lugar.
- **Ya no hay gasto solo por el paso del tiempo**: el cuerpo se gasta **haciendo cosas**. Quedarse quieto casi no gasta; caminar gasta poco; pelear y correr gastan mucho. **[Propuesta]**
- **Medidores bajos ya pesan antes de llegar a cero** **[Propuesta]**:
  - Hambre bajo el 25 %: pegás más flojo.
  - Sed bajo el 25 %: esquivás y corrés más lento.
  - Cualquiera de los dos en cero: no te curás, y la vida empieza a bajar.

### La vida se cura sola, pero cobra

- **Fuera de combate** (ningún horror alerta cerca durante 5 s) la vida sube despacio, unos **2 puntos por segundo**.
- **Cada punto curado cuesta hambre y sed** (**[Propuesta]** medio punto de cada uno). Curarte del todo después de una pelea dura te deja con hambre y sed. La vida pasa a ser un recurso que se **compra** con los otros.

### Cada clase gasta distinto

**[Propuesta]** Costos de arranque, en puntos del medidor (se ajustan jugando):

| | Verdugo | Saqueador | Cirial |
|---|---|---|---|
| Golpe | 1,2 hambre · 0,3 sed | 0,4 hambre · 0,5 sed | 0,6 hambre · 0,4 sed |
| Esquiva | 0,5 hambre · 1,2 sed | 0,2 hambre · 0,6 sed | 0,4 hambre · 1 sed |
| Correr (por segundo) | 0,4 hambre · 1,2 sed | 0,2 hambre · 0,8 sed | 0,3 hambre · 1 sed |
| Especial | 6 hambre | 5 sed | luz (como ahora) + 2 sed |
| Curarse (por punto de vida) | 0,4 hambre · 0,4 sed | 0,5 · 0,5 | 0,5 · 0,5 |

Así el **Verdugo pasa hambre**, el **Saqueador pasa sed** y el **Cirial vive de la luz**. La debilidad de cada clase aparece en lo que tiene que cargar en la mochila.

## 2. La mochila

Un **sistema de celdas tipo Tetris**: cada objeto tiene una forma (se puede rotar) y la mochila un tamaño fijo. **Lo más valioso ocupa más.** Lo que llevás es una decisión.

- **Mochila inicial**: 5 × 4 celdas. **[Propuesta]** Las mochilas más grandes se compran en la tienda de la mansión. *Bolsillos hondos* suma una fila.
- **Objetos** **[Propuesta]**:

| Objeto | Forma | Para qué |
|---|---|---|
| Ración seca | 1 × 1 | Comida que no se pudre (se come en el fogón) |
| Ración de marcha | 1 × 2 | Se come caminando, sin fogón. Rara y cara |
| Pan, queso | 1 × 2 | Rinde más que la ración, se pudre en 3 días |
| Odre | 1 × 2 | 4 tragos; se rellena en fuentes y goteras |
| Frasco de aceite | 1 × 1 | Carga la lámpara |
| Leña | 2 × 1 | El fuego del campamento: hervir, cocinar, alejar a los horrores |
| Vendas | 1 × 1 | En el campamento, curan sin gastar comida |
| Hongos | 1 × 1 | Cocinados alimentan; algunos son venenosos (ver Ingenio) |
| Carne de horror | 1 × 2 | Alimenta mucho, pero está maldita (ver abajo) |
| Kit de campamento | 2 × 3 | Se consume al armar un campamento nuevo |
| Tablas | 1 × 3 | Barricadas y reparaciones |
| Antorcha de pared | 1 × 2 | Una luz fija en el nivel |
| Tiza | 1 × 1 | Marcas e indicaciones (varios usos) |
| Soga | 2 × 2 | Atajos entre niveles |
| Oro | no ocupa lugar | Monedero aparte |

- Lo que levantás **va a la mochila**, no se consume. Si no entra, elegís qué tirar (lo tirado queda en el piso del nivel).
- En la pausa ves la mochila y podés reordenarla, tirar cosas o cargar la lámpara.

## 3. El día como etapa de expedición

El ciclo de **día y noche** (6–8 minutos de día, 2–3 de noche, ya aprobado) se vuelve el **ritmo del viaje**:

- **El día es para avanzar**: explorar, juntar, pelear. En el HUD hay una vela que se consume con el día.
- **Al caer la noche hay que estar en un campamento.** De noche los horrores son más fuertes, la luz dura menos y la vida no se cura sola.
- La pregunta de cada día: *¿llego al campamento o armo uno nuevo acá?*

## 4. El campamento

### Armarlo

- En una **sala despejada**, sin horrores despiertos cerca. Se usa el **kit de campamento**, que se consume.
- Queda **fijo en esa sala para siempre** y **persiste para la familia** (ya decidido), con su desgaste generacional. Un heredero puede llegar al campamento de su abuela y dormir ahí.
- En el mapa, los campamentos se marcan con una fogata.

### La noche en el campamento

Al tocar el campamento se abre una **pantalla de fogón** (HTML, como un cuaderno), con la mochila al lado. Las acciones gastan lo que llevás:

- **Comer** y **beber**: suben hambre y sed.
- **Encender o alimentar el fuego** (leña): sin fuego se duerme peor y es más fácil que ataquen.
- **Hervir agua turbia**: el agua de goteras y charcos solo es segura hervida. Hace falta fuego.
- **Cocinar**: hongos y carne rinden más cocinados; los hongos sin identificar son una apuesta.
- **Vendarse**: cura sin gastar comida.
- **Cargar la lámpara.**
- **Dormir hasta el alba**: pasa la noche.

### Dormir

- **Durmiendo, la vida se cura entera** si te acostás con hambre y sed por encima de la mitad. Si no, se cura en proporción. **[Propuesta]**
- **La noche se tira**: tranquila, ruidos (no pasa nada pero se pierde descanso), o **ataque**. Si atacan, te despertás y se juega: defendés el fogón hasta el alba o huís (ya decidido en el concepto).
- Lo que sube la chance de ataque: dormir sin fuego, haber hecho ruido, un jefe en el nivel. Lo que la baja: el fuego, la *Voluntad* (dormís alerta), salas con una sola entrada. **[Propuesta]**
- **Al alba** la noche pasó: se rellenan las fuentes del nivel y algunos horrores se mueven de sala.

## 5. Obras: la familia va domando la mazmorra

Además del campamento, el héroe puede **dejar cosas puestas en los niveles**. Quedan para toda la familia, aparecen en el mapa heredado y **se deterioran**: hay que volver a mantenerlas, repararlas o reemplazarlas. Es la forma de facilitar el acceso a lo profundo, y también un costo constante de mantenimiento.

| Obra | Qué hace | Con qué se hace | Cómo se deteriora |
|---|---|---|---|
| **Campamento** | Dormir, comer, cocinar | Kit de campamento | Ataques nocturnos; desgaste generacional |
| **Antorcha de pared** | Luz fija en una sala o pasillo; los horrores la evitan | Antorcha; se recarga con aceite | Se consume con los días; un Apagavelas la apaga |
| **Barricada** | Cierra una entrada de sala: los horrores tienen que romperla, y hacen ruido. Vos la abrís y cerrás | Tablas | Los horrores la golpean de noche; se repara con tablas |
| **Marca de tiza** | Una flecha o un signo (peligro, agua, campamento, escalera) en el piso o la pared, y en el mapa | Tiza | Se borra con las generaciones |
| **Soga** | Un atajo para bajar o subir entre dos niveles por un pozo, sin buscar la escalera | Soga | Se pudre con el tiempo; se puede cortar |
| **Depósito** (más adelante) | Un cofre para dejar provisiones | Cofre | Los horrores lo saquean si no está protegido (barricada, antorcha) |

- **[Propuesta]** Más adelante: **cepos** para horrores, **puentes de tablas** sobre grietas, **relicarios** donde el Cirial recupera luz.
- Hace falta sumar a la generación de niveles **entradas de sala** (donde van las barricadas) y **pozos** (donde van las sogas).
- **Deterioro**: cada obra tiene un estado. Baja con los días, con los ataques nocturnos y con cada generación. Cuando llega a cero, se pierde.

## 6. Volver a la mansión

- **Se puede volver a la superficie**, pero **caminando**: subiendo nivel por nivel por las escaleras o las sogas. No hay atajos mágicos.
- En la mansión se duerme seguro, se recupera todo y se compra en la tienda con el oro.
- **[Propuesta]** Dormir en la mansión también hace pasar la noche abajo: las obras se deterioran y los campamentos vacíos tiran su chance de ataque. Volver tiene un costo.
- Así, la vida de un héroe puede tener **varias expediciones**: bajar, avanzar, volver a reabastecerse, bajar de nuevo más lejos usando las obras de la familia.

## 7. Botín con sentido

Menos objetos sueltos y más **lugares** donde buscar:

- **Fuentes y goteras**: agua renovable. Las fuentes dan agua limpia; las goteras y charcos dan agua turbia (hay que hervirla). Se rellenan cada alba. El agua deja de ser botín y pasa a ser **geografía**: el mapa marca dónde hay.
- **Restos de otros exploradores** (ya están dibujados en el piso): se registran y dan un pequeño kit al azar.
- **Cajones, sacos y despensas**: comida, leña, vendas.
- **Altares**: aceite y velas.
- **Carne de horror**: algunos horrores la sueltan. Salva una expedición, pero comerla tiene una chance de dejarte una **marca de la maldición** temporal (pesadillas: dormís peor) o, si abusás, el rasgo *Maldito*.
- **Oro**: se usa en la tienda de la mansión para equiparse antes de bajar.

## 8. Atributos que ahora importan

- **Ingenio**: identifica hongos venenosos, saca más de la comida al cocinar y arma el campamento más rápido.
- **Voluntad**: dormís mejor, te despertás antes si atacan y aguantás más a oscuras.

## 9. La familia

- **Al morir, tu mochila queda con tu jefe** (o con tu eco): recuperarla es otra razón para liberarlo.
- **Cada vida empieza en la mansión** con lo que se compre con el oro familiar. Ahí es donde la tienda y el oro de la Etapa B toman sentido.
- Los **campamentos heredados** son la infraestructura de la familia: cuanto más hondo llegó la estirpe, más lejos se puede avanzar.

## 10. Qué se va del juego actual

- El consumo instantáneo al levantar objetos.
- El gasto de hambre y sed solo por tiempo (pasa a ser por actividad).
- La curación de la Sed de sangre se mantiene, pero compite con la curación lenta: sigue siendo el modo del Verdugo de curarse **sin** pagar comida.

## Decisiones

1. **Comida sin fogón**: solo la ración de marcha (se encuentra y se compra).
2. **Volver a la mansión**: sí, caminando.
3. **Obras en el mapa**: antorchas, marcas, campamentos, barricadas, sogas y más, todas con deterioro.
4. **Mochila tipo Tetris**: lo valioso ocupa más. Más adelante, armas, armaduras, mochilas distintas y depósitos persistentes.
5. **Orden**: todo esto va antes de los jefes.

## Etapas

**[Propuesta]** Es mucho para un solo PR. Lo partiría en tres:

- **E1 · Cuerpo y mochila**: gasto por actividad y por clase, curación lenta pagada, umbrales, mochila tipo Tetris, ración de marcha, botín nuevo (fuentes y goteras, restos, cajones), oro.
- **E2 · Campamento y noche**: ciclo de día y noche, armar campamento, pantalla del fogón (comer, beber, hervir, cocinar, vendarse, dormir), eventos nocturnos y defensa, Ingenio y Voluntad.
- **E3 · Obras y mansión**: antorchas, marcas de tiza, barricadas, sogas, deterioro, volver a la superficie, la mansión con la tienda.

## Supuestos al implementar

- **[Supuesto]** La **tienda** entra en E3, con la mansión. Hasta entonces el oro se junta pero no se gasta.
- **[Supuesto]** **Puertas de verdad** (se abren, se cierran, hacen ruido) entran en E3, junto con las barricadas.
- **[Supuesto]** **Mientras no exista el fogón (E1)**: la comida y el agua de la mochila se pueden consumir en cualquier lado, fuera de combate, quedándose quieto un par de segundos. En E2 eso pasa a ser solo en el campamento (salvo la ración de marcha).
- **[Supuesto]** En E1 el agua sale solo de **fuentes** limpias; las goteras y el agua turbia llegan con el fogón (E2), porque hace falta hervirla.
