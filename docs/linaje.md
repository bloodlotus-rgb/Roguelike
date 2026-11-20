# Guardado y linaje — v2

> Estado: **aprobado** (todas las propuestas). El catálogo completo de rasgos, con su efecto como jefe, está en `docs/rasgos.md`.

## Alcance

Te propongo dividirlo en dos etapas, porque juntas son muy grandes:

- **Etapa A — Dinastía**: guardado, árbol genealógico, herederos, envejecimiento, rasgos, crónica, elegir integrante y mapa heredado.
- **Etapa B — Héroes caídos**: el que muere vuelve como jefe en su nivel, con su clase, su equipo y los análogos de sus rasgos; escolta maldita; derrotarlo lo deja descansar en paz y suelta lo que llevaba.

Esta propuesta detalla la **Etapa A**. La B la armo cuando terminemos la A.

## Guardado

- **Una sola dinastía por jugador**, guardada en el navegador (IndexedDB), con `navigator.storage.persist()` para que el sistema no la borre.
- **Autoguardado continuo**: cada pocos segundos, al bajar de nivel, al morir y al salir de la app. **No hay** guardar ni cargar a mano, ni copias anteriores: lo que pasó, pasó.
- **Al volver**, el juego retoma **exactamente donde estabas**: mismo nivel, misma posición, mismos horrores con su vida, mismos medidores. Cerrar la app no salva de nada.
- Lo que se guarda:
  - **La dinastía**: semilla de la mazmorra, generación actual, integrantes (vivos y muertos), crónica, mapa heredado.
  - **La vida en curso**: quién está bajando, con qué clase, profundidad, estado del nivel (posición, medidores, horrores, objetos tomados, cargas).
- Todo con **versión de esquema** y migraciones, para que las actualizaciones no rompan partidas.
- Una opción en ajustes para **abandonar la dinastía** y empezar otra con una semilla nueva (con confirmación doble). Es la única forma de "empezar de cero".

## La dinastía

### Integrantes

Cada integrante tiene:

- **Nombre** generado (estilo gótico, en ambos idiomas por igual). Sin género mecánico; los nombres se sortean de una lista mixta.
- **Progenitor** (línea única) y **generación de nacimiento**.
- **Esperanza de vida**: 2 o 3 generaciones (sorteado al nacer).
- **Rasgos** (ver abajo), con un tope de **5**.
- **Estado**: vivo, caído (murió bajando) o muerto de viejo.
- Si bajó: la **clase** con la que bajó, la **profundidad** y la **causa** de su muerte.

### Cómo empieza

**[Propuesta]** La primera vez aparecen **3 integrantes** de la primera generación (hermanos, hijos de un fundador que no se juega). Elegís uno.

### Qué pasa al morir

1. El héroe pasa a **caído**. Queda registrado dónde y de qué murió.
2. **Nacen sus herederos**: entre 1 y 4. Solo tienen herederos los que bajaron.
3. **Avanza una generación**: todos los vivos envejecen. Con la edad pueden ganar **rasgos de vejez** (más mente, menos cuerpo).
4. Los que llegaron a su esperanza de vida **mueren de viejos**.
5. La **crónica** cuenta todo lo anterior y elegís quién baja ahora, entre los vivos.

La dinastía nunca se queda sin nadie: siempre quedan, como mínimo, los herederos del que acaba de morir.

### Edad

- **Joven** (recién nacido en esta generación), **adulto**, **viejo**.
- Los jóvenes no tienen penalización; los viejos ganan rasgos de vejez. Elegir a alguien viejo es una apuesta: más Ingenio y Voluntad, menos Fuerza y Agilidad.

## Rasgos

Cien rasgos en `docs/rasgos.md`: cuerpo, mente, sentidos y luz, supervivencia, combate, defectos, vejez y adquiridos. Cada uno tiene su efecto en vida y su poder como jefe.

### Cómo se heredan

- Cada heredero recibe **algunos rasgos de su línea**: los del progenitor con más probabilidad, los de los abuelos con menos, y así hacia atrás.
- Más **1 o 2 rasgos nuevos** sorteados.
- Los rasgos **adquiridos** pasan con baja probabilidad (por ejemplo 15 %) y los de **vejez nunca** se heredan.
- Si se pasa del tope, se descartan los más viejos.

### Rasgos adquiridos en la vida

Se ganan por lo que hacés mientras bajás (sobrevivir al borde de la muerte, matar muchos, desviar muchos golpes, pasar mucho tiempo a oscuras). Se anuncian en el momento con un aviso y quedan en la crónica.

## La crónica

Después de cada muerte, una pantalla tipo libro cuenta la generación:

> *Brenna, Verdugo, cayó en la profundidad 7 a manos de un Hueco.*
> *Nacieron Aldo y Mirta. Mirta heredó los Ojos de gato de su abuela.*
> *Tomás murió de viejo a los tres inviernos.*
> *Ilse envejeció: le salieron Canas.*

Toda la crónica queda guardada y se puede releer.

## Elegir quién baja

**[Propuesta]** Una pantalla con los integrantes vivos como **retratos** (dibujados por código, en tinta) con nombre, edad, rasgos y atributos resultantes. Al tocar uno, elegís la clase y bajás.

El **árbol genealógico** completo (vivos, caídos y muertos de viejos) se puede ver desde esa pantalla.

## Mapa heredado

- Lo explorado por **cualquier** integrante queda en el mapa, nivel por nivel, para toda la dinastía.
- Marcas en el mapa: dónde cayó cada héroe (una cruz con su nombre) y las escaleras encontradas.

## Técnica

- Lógica en `src/core/`: dinastía, integrantes, rasgos, herencia, envejecimiento y crónica. Todo determinista desde la semilla de la dinastía y la generación, con tests.
- El mundo (`World`) aprende a guardarse y restaurarse.
- Guardado en `src/save/` con IndexedDB, versionado.
- Pantallas nuevas en HTML/CSS: crónica, elegir integrante, árbol.
