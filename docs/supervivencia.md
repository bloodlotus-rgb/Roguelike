# Cuerpo, mochila y campamento (propuesta v1)

> Estado: **propuesta para conversar** (ping pong). Reemplaza el manejo de recursos actual y le da forma a los campamentos y a la noche de `concepto.md`. Lo marcado **[Propuesta]** es mío; las **Preguntas** del final definen el resto.

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

Un **sistema de celdas**: cada objeto ocupa una forma y la mochila tiene un tamaño fijo. Lo que llevás es una decisión.

- **Mochila inicial**: 5 × 4 celdas. **[Propuesta]** Las mochilas más grandes se compran en la tienda de la mansión. *Bolsillos hondos* suma una fila.
- **Objetos** **[Propuesta]**:

| Objeto | Forma | Para qué |
|---|---|---|
| Ración seca | 1 × 1 | Comida que no se pudre |
| Pan, queso | 1 × 2 | Rinde más que la ración, se pudre en 3 días |
| Odre | 1 × 2 | 4 tragos; se rellena en fuentes y goteras |
| Frasco de aceite | 1 × 1 | Carga la lámpara |
| Leña | 2 × 1 | El fuego del campamento: hervir, cocinar, alejar a los horrores |
| Vendas | 1 × 1 | En el campamento, curan sin gastar comida |
| Hongos | 1 × 1 | Cocinados alimentan; algunos son venenosos (ver Ingenio) |
| Carne de horror | 1 × 2 | Alimenta mucho, pero está maldita (ver abajo) |
| Kit de campamento | 2 × 2 | Se consume al armar un campamento nuevo |
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

## 5. Botín con sentido

Menos objetos sueltos y más **lugares** donde buscar:

- **Fuentes y goteras**: agua renovable. Las fuentes dan agua limpia; las goteras y charcos dan agua turbia (hay que hervirla). Se rellenan cada alba. El agua deja de ser botín y pasa a ser **geografía**: el mapa marca dónde hay.
- **Restos de otros exploradores** (ya están dibujados en el piso): se registran y dan un pequeño kit al azar.
- **Cajones, sacos y despensas**: comida, leña, vendas.
- **Altares**: aceite y velas.
- **Carne de horror**: algunos horrores la sueltan. Salva una expedición, pero comerla tiene una chance de dejarte una **marca de la maldición** temporal (pesadillas: dormís peor) o, si abusás, el rasgo *Maldito*.
- **Oro**: se usa en la tienda de la mansión para equiparse antes de bajar.

## 6. Atributos que ahora importan

- **Ingenio**: identifica hongos venenosos, saca más de la comida al cocinar y arma el campamento más rápido.
- **Voluntad**: dormís mejor, te despertás antes si atacan y aguantás más a oscuras.

## 7. La familia

- **Al morir, tu mochila queda con tu jefe** (o con tu eco): recuperarla es otra razón para liberarlo.
- **Cada vida empieza en la mansión** con lo que se compre con el oro familiar. Ahí es donde la tienda y el oro de la Etapa B toman sentido.
- Los **campamentos heredados** son la infraestructura de la familia: cuanto más hondo llegó la estirpe, más lejos se puede avanzar.

## 8. Qué se va del juego actual

- El consumo instantáneo al levantar objetos.
- El gasto de hambre y sed solo por tiempo (pasa a ser por actividad).
- La curación de la Sed de sangre se mantiene, pero compite con la curación lenta: sigue siendo el modo del Verdugo de curarse **sin** pagar comida.

## Preguntas

1. **Comer en el campo**: ¿solo en el campamento (estricto, como dijiste), o una excepción chica, por ejemplo una "ración de marcha" rara que se come caminando?
2. **Bajada desde la mansión**: hoy siempre se empieza en la superficie. Con campamentos heredados, ¿un heredero puede **bajar directo a un campamento de la familia** que siga en pie? Si no, cada vida tiene que recorrer todos los niveles de nuevo.
3. **Volver a la superficie**: ¿se puede subir a la mansión a mitad de una vida, a comprar y dormir seguro, y volver a bajar?
4. **Formas de la mochila**: ¿celdas tipo Tetris (formas distintas, rotar) o solo tamaños simples (1 o 2 celdas)?
5. **Orden**: ¿esto va **antes** de la Etapa B (jefes) o después? Mi recomendación: **antes**, porque el oro, la mochila en el cadáver y la tienda dependen de esto, y cambia cómo se juega cada vida.
