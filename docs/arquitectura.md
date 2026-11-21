
## A1 implementada

- **Pasillos de 2 casillas**, tanto los rectos como los túneles. Las salas miden de 6 a 18 casillas.
- **Niveles de 170×130** (unas 3 veces el área anterior). El loot, las fuentes, las goteras, los restos, los cofres, los derrumbes y los horrores escalan con el tamaño.
- **Vanos de 1 o 2 casillas**:
  - Un vano de 2 tiene **puerta doble** o ninguna; las dos hojas abren, cierran y ceden juntas.
  - Las tablas lo barrican **entero**, como una sola barricada.
- **Derrumbes de pared a pared**: llenan el pasillo de 2, y cavar despeja todo el montón.
- **Alturas en primera persona**:
  - pasillos 3, salas 4, salones grandes 5,5;
  - el techo baja sobre la escalera de subida;
  - donde un techo bajo se encuentra con uno alto se dibuja el **dintel** de piedra.
  - Desde arriba las paredes siguen bajas.
- **Mampostería**:
  - ladrillos cerca del piso y **sillares grandes** más arriba;
  - bloques simples, con más vértices solo en calidad ultra;
  - ladrillos y baldosas se dibujan **solo cerca del héroe** (hasta donde llega la luz).
- **Guardado versión 7**: las dinastías anteriores se apartan, porque los niveles volvieron a cambiar de forma.
- **Pendiente**:
  - En las **salas muy grandes** la luz del farol no llega a las paredes. Hacen falta las **luces de la mazmorra** (braseros, antorchas de pared), que van con la biblioteca de piezas (A4).
  - Los **niveles siguen apilados a 2,4 de distancia** aunque los techos sean más altos. Por los huecos (pozo, galerías) el piso de abajo se ve más cerca de lo que debería. Se resuelve con la grilla 3D (A3).

## A2 implementada

- **La escalera de bajada está cerrada con llave**:
  - Su sala queda tras **puertas con cerrojo** (dobles, con bandas de hierro y cerradura).
  - La **llave del nivel** está en algún lugar lejos de la llegada (en la mitad más alejada del recorrido), nunca detrás de un cerrojo.
  - La llave no ocupa lugar en la mochila: se lleva colgada. Con ella la puerta se abre al instante.
  - Sin llave se puede **forzar**: unos 20 segundos, cansa como pelear y hace mucho ruido.
- **El pozo**:
  - Si se puede, su sala queda tras **puertas trabadas**, que se fuerzan en unos 8 segundos.
  - Si su sala no se puede cerrar, tiene una **reja trabada encima**, que también se fuerza. Con la reja no se puede atar la soga.
- **Lo que se abre queda abierto** para toda la estirpe. La llave, en cambio, es de cada vida: el próximo heredero la vuelve a encontrar donde estaba.
- Una sala solo se sella si sus puertas son de verdad la única entrada, y nunca la sala de llegada. Si no se puede, ese acceso queda abierto.
- **Mapa**: los cerrojos llevan una marca roja y las puertas trabadas una marca de tinta, también en la leyenda.
- **Levantar el campamento**: desde el fogón, el campamento vuelve a ser un kit en la mochila (si entra y no hay horrores cerca), para armarlo en otro lado.
- **Puertas a la altura del vano**: en primera persona las puertas llenan el vano hasta el techo.
- **Pendiente**:
  - Los **puestos de la mazmorra** (lugares para acampar sin kit) van con las locaciones (A3 en adelante).
  - **Los sectores**: el nivel queda partido por estas salas cerradas y por los derrumbes, pero todavía no hay sectores de verdad, con varias puertas entre zonas. Llegan con la grilla 3D y las locaciones.
