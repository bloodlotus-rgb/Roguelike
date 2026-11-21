# La mazmorra en vóxeles (propuesta v1)

> Estado: **aprobado** ("vóxeles completos, ahora"). Se hace en etapas V1 a V5, antes de las obras. Lo marcado **[Supuesto]** es mío para validar.

## Por qué

Hoy cada nivel es un **mapa de alturas**: cada casilla tiene un solo piso (con terrazas), un solo techo y nada en el medio. Eso no deja tener:
- balcones y galerías;
- puentes sobre un pasillo y entrepisos;
- locaciones de varios pisos y escaleras de caracol;
- niveles apilados a la distancia correcta.

Con vóxeles, el espacio pasa a ser de verdad tridimensional.

## Cómo se guarda: columnas de tramos

En vez de un cubo denso de celdas (170 × 130 × cientos de capas), **cada casilla guarda su columna**: la lista de **tramos sólidos** de abajo hacia arriba. Cada tramo tiene su base, su tope y su material (roca, piedra labrada, madera, agua). Es una grilla de vóxeles comprimida por columnas, con resolución vertical libre:

```
casilla de pasillo:    roca [-∞, 0] · aire [0, 3] · roca [3, ∞]
casilla con terraza:   roca [-∞, 0.7] · aire [0.7, 4] · roca [4, ∞]
casilla bajo un balcón: roca [-∞, 0] · aire [0, 2.6] · losa [2.6, 2.9] · aire [2.9, 5.5] · roca [5.5, ∞]
```

- Entran sin redondear las alturas que ya existen: terrazas de 0,7, escalones de 0,4, agua a −0,16, techos de 3, 4 y 5,5.
- Una casilla puede tener **varias superficies pisables** (el tope de cada tramo con aire suficiente encima).
- Las rampas son tramos con el tope inclinado. **[Supuesto]**
- Todo el nivel pesa poco: unas 22 mil columnas con 2 a 5 tramos cada una.

## Etapas

- **V1 · Datos**:
  - el modelo de columnas y tramos (`src/core/voxels.ts`);
  - las consultas: superficies pisables de una casilla, ¿es sólido este punto?, techo sobre un punto;
  - derivar las columnas del nivel actual (paredes, pisos, terrazas, rampas, escaleras, agua, abismos, techos por espacio).
  - Con tests. El juego todavía no cambia.
- **V2 · Dibujo desde los vóxeles**:
  - paredes, pisos, techos, dinteles, terrazas, pozos y abismos salen de las columnas, con un solo mallador: caras verticales donde una columna tiene aire y la vecina sólido a esa altura, y horizontales en topes y bases de los tramos;
  - ladrillos y baldosas se colocan sobre esas caras;
  - se ve igual que hoy, pero el dibujo queda listo para cualquier forma.
- **V3 · Cuerpos en 3D**:
  - héroe y horrores tienen altura y están parados sobre una superficie;
  - se camina subiendo escalones bajos;
  - se cae al pisar el vacío, con daño si es alto;
  - las colisiones se resuelven contra los tramos;
  - escaleras, rampas y terrazas pasan a ser geometría de vóxeles en vez de reglas aparte.
- **V4 · Caminos y vista en 3D**:
  - los horrores buscan camino sobre las superficies (incluidas las de arriba);
  - la vista y la luz atraviesan el espacio en 3D: desde un balcón se ve la sala de abajo y se la puede alumbrar.
- **V5 · Construir en 3D**:
  - el generador y las locaciones usan capas: balcones, puentes sobre pasillos, entrepisos y locaciones de varios pisos;
  - escaleras de caracol;
  - los niveles se apilan a su distancia real, con escaleras más largas;
  - el formato de locaciones suma capas (una planta de texto por altura).

## Riesgos

- **Rendimiento en el celular**: el mallador y la búsqueda de caminos en 3D cuestan más. Se mide en cada etapa.
- **Guardado**: la V5 cambia la forma de los niveles otra vez, así que habrá una versión nueva de guardado.

## V1 implementada

- **Modelo** (`src/core/voxels.ts`):
  - cada casilla tiene su **columna de tramos sólidos** (roca, piedra labrada, madera) y de **agua** (que no es sólida);
  - todo lo que está fuera de la grilla es roca.
- **Consultas**:
  - `solidAt` (si un punto está dentro de algo sólido);
  - `surfaces` (dónde se puede estar parado: el tope de cada tramo con al menos 1,6 de aire encima, así que una casilla puede tener varias);
  - `floorBelow` (sobre qué superficie queda un cuerpo a cierta altura);
  - `ceilingAbove` y `waterAt`.
- **Columnas derivadas del nivel actual**:
  - paredes de roca;
  - piso con terrazas y rampas;
  - escalones que bajan o suben un piso;
  - agua baja y profunda;
  - abismos sin fondo;
  - pozo, escalera de bajada y galería abiertos al nivel de abajo;
  - puentes de madera;
  - el techo de cada espacio (pasillo 3, sala 4, salón 5,5, bajo sobre la escalera).
  - Las alturas de techo pasan del dibujo al núcleo.
- **Tests**: las consultas, una losa tipo balcón con dos superficies en la misma casilla, y que las columnas de un nivel coinciden con lo que el juego usa hoy.
- **El juego todavía no cambia**: la V2 dibuja desde los vóxeles y la V3 mueve los cuerpos sobre ellos.

## V2 implementada

- **Un solo mallador** (`src/game/voxelMesh.ts`) dibuja el nivel desde sus columnas:
  - una **cara vertical** donde una casilla tiene aire y la vecina algo sólido a esa altura;
  - el **piso** en el tope de cada tramo con aire encima, y el **techo** en la base de cada tramo con aire debajo.
- Cada cara se dibuja según lo que es:
  - **piso**: pisos, frentes de terraza y costados de rampa;
  - **pared**: la roca sobre el piso, metida detrás de los ladrillos;
  - **tapa**: el tope de las paredes donde la vista cenital las corta;
  - **techo**: techos y dinteles (donde un techo bajo se encuentra con uno alto);
  - **roca**: todo lo que está bajo el piso (abismos, pozos, bordes de las pozas profundas), cada vez más oscuro.
- **Reemplaza a cinco constructores**: el de pisos y terrazas, el de paredes, el de techos y dinteles, las paredes de los abismos y los bordes de las pozas. También el borde del pozo y el de la galería, que ahora son caras de la losa.
- **Las rampas son tramos con el tope inclinado**: guardan la altura de cada esquina.
- **Se dibujan aparte** (como antes): los escalones y el pozo de la escalera, las columnas redondas, el sumidero, el nivel de abajo visto por los huecos, los puentes, el agua, los ladrillos y las baldosas.
- Con las vistas: desde arriba las paredes se cortan bajas, con tapa; en primera persona llegan al techo de cada espacio, y sobre la escalera de subida el hueco sube hasta perderse.
- **Se ve igual que hoy**: comparado en capturas con la versión anterior (abismos, terrazas, escaleras, galerías, pozas, ríos y los tres estilos).
- Arreglos:
  - los costados de las rampas tenían agujeros que dejaban ver el negro: ahora son de piedra;
  - el techo bajo de la escalera de subida abría una casilla de pared en el extremo de la escalera (V1).
- **Pendiente para la V3**: héroe y horrores siguen moviéndose sobre la grilla de siempre; la V3 los pasa a los vóxeles.
