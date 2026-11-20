# La Estirpe (Tainted Ancestry)

Roguelike de supervivencia y exploración en tiempo real, para celular y navegador. El concepto está en [`docs/concepto.md`](docs/concepto.md).

## Estado actual

Etapas 1 (prototipo), 2 (combate) y atmósfera, con arte provisorio:

- Nivel generado desde una semilla (`?seed=...` en la URL; si no hay, se sortea una).
- Elección de clase: **Verdugo**, **Saqueador** o **Cirial**, cada una con atributos, combo propio, especial con su forma de cargarse y una pasiva.
- Joystick virtual (tocando cualquier parte de la pantalla) y tres botones: **Atacar** (golpe o parry), **Especial** y **Esquivar** (mantener: correr, que gasta sed y hambre y hace ruido).
- Cuatro horrores (Rastrero, Hueco, Plañidera, Apagavelas) que avisan antes de atacar, se alertan entre sí y a veces deambulan entre salas. Tu luz te delata.
- Salas rectangulares, cavernas y salas con columnas, con decorado.
- Atmósfera oscura: fuera de tu llama no se ve nada; muros y columnas proyectan sombras suaves. Los horrores que te miran desde la oscuridad muestran los ojos.
- Mapa desplegable con lo explorado (botón Mapa o tecla `M`); no pausa el juego.
- Sonido generado por código: ambiente, pasos, la llama, latido con poca vida, avisos de cada ataque y horrores que se oyen antes de verse. Botón ♪ para silenciar.
- Viñeta que se cierra cuando te cazan y se tiñe de rojo con poca vida.
- Hambre, sed y luz bajan con el tiempo; atacar y esquivar gastan sed.
- Escalera para bajar al siguiente nivel (`semilla + profundidad`).
- Pausa al salir de la app o con Escape. Idioma español / inglés.
- `?debug=1` expone la sesión en `window.estirpe` para probar desde la consola.

En compu: WASD / flechas, `Espacio` o `J` para atacar, `Q` o `L` para el especial, `Shift` o `K` para esquivar (mantener: correr), `Enter` para bajar.

Todavía no hay guardado, linaje, rasgos, jefes, campamentos ni noche. Diseño del combate en [`docs/combate.md`](docs/combate.md).

## Desarrollo

```sh
npm install
npm run dev        # servidor local
npm test           # tests de la lógica (vitest)
npm run build      # typecheck + build de producción en dist/
```

## Deploy

Cloudflare Workers (assets estáticos) con Workers Builds conectado al repo. Config en `wrangler.jsonc` (Worker `roguelike`).

- `main` se publica en producción.
- Las demás ramas generan una versión de vista previa con su propia URL.

## Estructura

- `src/core/`: lógica del juego en TypeScript puro (semilla, generación, colisiones, visión, supervivencia, atributos, clases, horrores, combate). Sin Phaser ni DOM.
- `src/game/`: escena de Phaser y arte provisorio dibujado con Canvas.
- `src/ui/`: interfaz en HTML/CSS (HUD, controles, selección de clase, pantallas).
- `src/i18n/`: textos en español e inglés.
- `src/audio/`: sonido procedural con Web Audio.
