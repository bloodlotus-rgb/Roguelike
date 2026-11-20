# La Estirpe (Tainted Ancestry)

Roguelike de supervivencia y exploración en tiempo real, para celular y navegador. El concepto está en [`docs/concepto.md`](docs/concepto.md).

## Prototipo

Primera etapa, con arte provisorio:

- Un nivel generado desde una semilla (`?seed=...` en la URL; si no hay, se sortea una).
- Movimiento con joystick virtual (tocando cualquier parte de la pantalla) o con WASD / flechas.
- La luz revela el mapa como tinta sobre papel; lo ya visto queda tenue fuera de la luz.
- Hambre, sed y luz bajan con el tiempo. Pan, agua y aceite los recargan. Sin comida o sin agua se pierde vida.
- Escalera para bajar al siguiente nivel (`semilla + profundidad`).
- Pausa al salir de la app o con Escape. Idioma español / inglés (botón o tecla L).

Todavía no hay guardado, linaje, jefes, campamentos ni noche.

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

- `src/core/`: lógica del juego en TypeScript puro (semilla, generación, colisiones, visión, supervivencia). Sin Phaser ni DOM.
- `src/game/`: escena de Phaser y arte provisorio dibujado con Canvas.
- `src/ui/`: interfaz en HTML/CSS (HUD, joystick, pantallas).
- `src/i18n/`: textos en español e inglés.
