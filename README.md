# La Estirpe (Tainted Ancestry)

Roguelike de supervivencia y exploración en tiempo real, para celular y navegador. El concepto está en [`docs/concepto.md`](docs/concepto.md).

## Estado actual

Etapas 1 (prototipo) y 2 (combate), con arte provisorio:

- Nivel generado desde una semilla (`?seed=...` en la URL; si no hay, se sortea una).
- Elección de clase: **Verdugo**, **Saqueador** o **Cirial**, cada una con atributos, arma, habilidad y pasivo propios.
- Joystick virtual (tocando cualquier parte de la pantalla) y dos botones: **Atacar** (tocar: golpe o parry; mantener: habilidad) y **Esquivar**.
- Cuatro horrores (Rastrero, Hueco, Plañidera, Apagavelas) que avisan antes de atacar. Tu luz te delata.
- La luz revela el mapa como tinta sobre papel; lo ya visto queda tenue fuera de la luz.
- Hambre, sed y luz bajan con el tiempo; atacar y esquivar gastan sed.
- Escalera para bajar al siguiente nivel (`semilla + profundidad`).
- Pausa al salir de la app o con Escape. Idioma español / inglés (botón o tecla L).
- `?debug=1` expone la sesión en `window.estirpe` para probar desde la consola.

En compu: WASD / flechas, `Espacio` o `J` para atacar (mantener: habilidad), `Shift` o `K` para esquivar, `Enter` para bajar.

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
