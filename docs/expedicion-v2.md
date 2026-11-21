# La expedición, segunda vuelta: el día, el cuerpo y los objetos (propuesta v1)

> Estado: **en discusión**, con las primeras decisiones tomadas (ver "Decisiones" al final). Nada está implementado todavía. Lo marcado **[Propuesta]** es mío para validar.

## Dónde estamos

- **El día dura 7 minutos y la noche 2,5.** Con los niveles nuevos (2,5 veces más grandes, se camina a 3 casillas por segundo y hay hordas), un día alcanza para explorar más o menos **un nivel**, y a veces ni eso.
- **Se come y se bebe solo en el fogón.** La única excepción es la ración de marcha. Si a mitad del día te quedás sin hambre o sin sed, la vida empieza a bajar y la única salida es armar un campamento (que gasta el kit) o volver.
- **Los objetos se usan con un botón** desde la mochila. Funciona, pero no tiene ceremonia ni riesgo.

El problema de fondo: entre el alba y la noche **no hay ninguna pausa con sentido**. Es un tramo largo de avanzar y pelear, y el cuerpo solo se atiende al principio y al final.

## 1. La rutina de un día

Propongo que el día tenga **forma**, con momentos que el jugador reconoce y planifica:

| Momento | Qué pasa | Dónde |
|---|---|---|
| **Alba** | Desayuno caliente, reparar, reordenar la mochila, cargar la lámpara, mirar el mapa y decidir hacia dónde | Campamento |
| **Mañana** | Avanzar, explorar, juntar, pelear. El tramo más largo | El nivel |
| **Alto del mediodía** | Una pausa corta en un rincón seguro: comida fría, agua, vendas, reacomodar. Cuesta tiempo y tiene riesgo | Cualquier rincón tranquilo |
| **Tarde** | Seguir bajando, o emprender la vuelta hacia un campamento | El nivel |
| **Crepúsculo** | Aviso: la vela del día se consume, los horrores se agitan. Hay que llegar a un fuego o armar uno | Camino al campamento |
| **Noche** | Cena, hervir agua, curar, dormir. Lo que pasa en la noche se tira | Campamento |

- **[Propuesta] Duración**: el día pasa a **12 minutos** y la noche a **4**, porque los niveles ahora son mucho más grandes. Un día bien jugado debería alcanzar para **un nivel y medio**: explorar uno y bajar al siguiente, o explorar uno y volver al campamento.
- **[Propuesta] La hora importa**: el reloj del HUD muestra los momentos (alba, mañana, mediodía, tarde, crepúsculo). Hay cosas que solo pasan a ciertas horas: las fuentes se llenan al alba, los Rastreros cazan en el crepúsculo, algunos lugares solo se abren de noche.

## 2. Gestionar el cuerpo durante el día

La idea es que **atender el cuerpo sea una decisión con costo y riesgo**, no un botón. Hay cinco herramientas, de la más segura a la más desesperada.

### 2.1 El alto

- **Hacer un alto**: en cualquier lugar **sin horrores alerta cerca**, sentarse. Se abre una pantalla chica, como el fogón pero sin fuego, con la mochila al lado.
- En el alto se puede:
  - **comer frío**: raciones y pan (rinden un 20 % menos que calientes);
  - **beber** del odre;
  - **vendarse**;
  - **cargar la lámpara**;
  - **reordenar la mochila**.
  - No se puede hervir agua ni cocinar.
- **Cuesta tiempo**: el alto consume una porción del día. Cuanto más hacés, más pasa el reloj.
- **Tiene riesgo**: mientras estás sentado, la lámpara alumbra poco y hacés ruido al comer. Hay una chance de que algo te encuentre: el alto se corta y arrancás la pelea sentado, con medio segundo de demora para pararte.
  - La chance baja con la espalda contra la pared, en un **callejón sin salida**, con una **barricada** o junto a una **antorcha** de la familia.
- **[Propuesta]** **Un alto por día "gratis"**, el del mediodía: más largo y con menos riesgo, si lo hacés entre la mañana y la tarde. Los otros altos son más cortos y más peligrosos.

### 2.2 El cinturón

- Además de la mochila, el héroe tiene un **cinturón con 3 lugares**. Lo que va en el cinturón se usa **caminando, sin abrir la mochila**, con un gesto: mantener apretado un ícono del HUD.
- Solo entran cosas chicas: un odre, una ración de marcha, un frasco de aceite, vendas, una bengala, el silbato.
- **Beber del cinturón** es un trago, no el odre entero: sube un poco la sed, toma un segundo, no podés atacar mientras tomás, y si te pegan se te cae parte del agua.
- La decisión pasa a ser **qué llevo a mano**. El odre en el cinturón le ocupa el lugar a la bengala.

### 2.3 Racionar

- Cada comida se puede tomar **entera o media**: media ración rinde un poco más de la mitad, pero deja una "porción abierta" que se echa a perder en un día.
- **Hambre y sed tienen estados**, no solo un número:
  - **Satisfecho** (más del 60 %): curás más rápido.
  - **Con hambre / con sed** (25 a 60 %): sin efecto.
  - **Débil** (menos del 25 %): el Verdugo pega más flojo, el Saqueador esquiva más corto, el Cirial ve menos.
  - **Desfalleciendo** (0): no curás y la vida baja.
- Saber cuándo comer pasa a importar. Comer satisfecho desperdicia; esperar a estar débil es arriesgado.

### 2.4 Lo que da la mazmorra

Cuando se acaba lo que llevás, el nivel ofrece salidas, todas con un precio:

| Fuente | Qué da | El precio |
|---|---|---|
| **Fuente o cascada** | Agua limpia | Ninguno, pero hay que encontrarla, y suele estar vigilada |
| **Río, poza o charco** | Agua turbia, al momento (arrodillarse a beber) | Una chance de **mal de tripas**: la sed sube más lento todo el día |
| **Gotera** | Unos tragos lamiendo la piedra | Muy lento, y estás quieto y expuesto |
| **Hongos crudos** | Un poco de hambre | Pueden ser venenosos (el Ingenio los distingue) |
| **Ratas** (con la fauna de la N4) | Carne, si la atrapás | Hay que cocinarla, o arriesgarse a comerla cruda |
| **Carne de horror cruda** | Mucha hambre | **Maldición**: un rasgo negativo temporal y pesadillas |
| **Restos de exploradores** | A veces, una ración vieja | Puede estar podrida |

### 2.5 La vuelta

- Siempre está la opción de **volver**: al campamento más cercano de la familia o a la mansión.
- La familia deja **depósitos** en sus campamentos: un **cofre del campamento**, una obra nueva, guarda comida y agua para el próximo que pase. Así la familia va armando una **línea de abastecimiento** hacia lo hondo.

## 3. Biblioteca de objetos

Cada objeto existe para **cambiar una decisión**. Propongo agruparlos por familia, con su efecto en la dinámica. Los que ya existen están marcados con ✓.

### Luz

| Objeto | Forma | Efecto en el juego |
|---|---|---|
| Frasco de aceite ✓ | 1×1 | Carga la lámpara |
| Antorcha ✓ | 1×2 | Se planta: luz fija, hace dudar a los horrores |
| **Vela** | 1×1 | Luz chica que dura mucho; se deja encendida en el alto para bajar el riesgo |
| **Bengala** | 1×1 | Se tira: ilumina una sala entera unos segundos y espanta a los Rastreros. Delata dónde estás |
| **Frasco de hongos luminosos** | 1×1 | Luz fría, sin calor ni humo: no atrae a los que siguen la llama |
| **Farol con pantalla** | equipo | Cerrás la pantalla: no alumbrás y no te ven. Abrís de golpe: encandila |

### Comida y agua

| Objeto | Forma | Efecto |
|---|---|---|
| Ración seca ✓ | 1×1 | No se pudre; mejor caliente |
| Ración de marcha ✓ | 1×2 | Se come caminando |
| **Pan y queso** | 1×2 | Rinde mucho, se pudre en 2 días |
| **Cecina** | 1×1 | Da sed al comerla |
| **Miel** | 1×1 | Poca hambre, pero **cura** un poco y no se pudre nunca |
| **Sal** | 1×1 | Cura la carne: la de horror deja de estar maldita si se sala y se cocina |
| Odre ✓ | 1×2 | 4 tragos |
| **Cantimplora grande** | 2×2 | 8 tragos; no entra en el cinturón |
| **Paño de filtrar** | 1×1 | El agua turbia filtrada en el alto queda limpia, sin fuego |

### Herramientas: abren camino

| Objeto | Forma | Efecto |
|---|---|---|
| Tablas ✓ | 1×3 | Barricadas, puentes y diques |
| Soga ✓ | 2×2 | Atajos por los pozos |
| Tiza ✓ | 1×1 | Marcas |
| **Pico** | 1×3 | Despeja derrumbes en la mitad del tiempo; rompe paredes finas marcadas |
| **Palanca** | 1×2 | Abre puertas trabadas y cofres sin ruido |
| **Garfio** | 2×2 | Sube a terrazas sin rampa y cruza abismos de dos casillas |
| **Ganzúas** | 1×1 | Abre rejas y cofres cerrados (el Saqueador más rápido) |
| **Pala** | 1×3 | Desvía agua: abre zanjas, tapa grietas con escombro |
| **Yesca y pedernal** | 1×1 | Prende fuego sin leña por poco tiempo: alto con calor |

### Tácticos: cambian una pelea

| Objeto | Forma | Efecto |
|---|---|---|
| **Frasco de aceite encendido** | 1×1 | Se tira: charco de fuego que corta un pasillo (gasta un aceite) |
| **Abrojos** | 1×1 | Frenan a los que te persiguen en un pasillo |
| **Silbato de hueso** | 1×1 | Atrae a los horrores a donde sonó (para separar una manada) |
| **Campanilla** | 1×1 | Colgada en una puerta, te avisa en el alto si algo entra |
| **Humo** | 1×1 | Corta la vista en una sala: para huir |
| **Cebo** | 1×1 | Los Rastreros se quedan comiendo |

### Cuidados

| Objeto | Forma | Efecto |
|---|---|---|
| Vendas ✓ | 1×1 | Curan en el campamento |
| **Ungüento** | 1×1 | Cura caminando, despacio |
| **Tablilla** | 1×2 | Arregla una pierna rota (si agregamos heridas) |
| **Antídoto** | 1×1 | Cura veneno y mal de tripas |
| **Sales** | 1×1 | Te despiertan de golpe si te atacan durmiendo |

### Carga

| Objeto | Efecto |
|---|---|
| **Mochila de cuero** (tienda) | 7×5 |
| **Bastidor** (tienda, caro) | 8×6, pero correr cansa más |
| **Bolsas de cinturón** | +1 lugar de cinturón |
| **Cofre de la familia** (obra) | Guarda cosas en un campamento, para todos |

### Armas y armaduras

Ya acordamos agregarlas "en algún momento". **[Propuesta]** Lo dejo para una etapa propia, después de esta. Cada clase tendría 2 o 3 variantes de arma que cambian el combo, y armaduras livianas o pesadas que cambian el gasto de sed al moverse.

## 4. Preguntas abiertas

1. **Duración del día**: ¿12 de día y 4 de noche, o preferís otra?
2. **El alto**: ¿te gusta como pausa con riesgo? ¿Uno "gratis" al mediodía?
3. **El cinturón**: ¿sí? ¿3 lugares?
4. **Objetos**: ¿cuáles querés primero? Mi orden sería: cinturón y alto, luz táctica (bengala, vela, farol), herramientas (pico, palanca, garfio), y después cuidados y carga.

## Decisiones

1. **Un nivel es un proyecto de varios días**, no una etapa de un día.
   - Se explora con **idas y vueltas al campamento**: el jugador va interviniendo el nivel (planta y prende antorchas, despeja derrumbes, fuerza o rompe puertas cerradas) mientras **busca los accesos al nivel siguiente**.
   - El día no tiene que alcanzar para un nivel: cada día es una salida desde el campamento y una vuelta.
   - **[Supuesto]** La duración del día queda como está (7 de día y 2,5 de noche) hasta probar este ritmo.
   - Los niveles probablemente tengan que crecer más.
2. **Herramientas para el cuerpo durante el día**: el **alto con riesgo**, **racionar con estados de hambre y sed**, y **lo que da la mazmorra**, con su precio. **El cinturón queda afuera.**
3. **Orden**: primero proporciones y arquitectura (`arquitectura.md`). El día, el cuerpo y los objetos van después.
