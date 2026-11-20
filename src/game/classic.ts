/**
 * The classic renderer: the hand-drawn top view in Phaser (and the raycaster for first
 * person). Loaded on demand with `?engine=classic`, so the default build skips Phaser.
 */
import Phaser from 'phaser';
import { DARK } from './art';
import { DungeonScene, type SceneHost } from './DungeonScene';

export { FirstPersonView } from './firstPerson';

export interface ClassicEngine {
  /** Rebuilds the scene for a new level or a new life. */
  restart(): void;
}

export function bootClassic(host: SceneHost, parent: HTMLElement): ClassicEngine {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth * dpr,
    height: parent.clientHeight * dpr,
    backgroundColor: DARK,
    scale: { mode: Phaser.Scale.NONE },
    input: { keyboard: false, mouse: false, touch: false },
    render: { antialias: true, roundPixels: false },
    scene: [],
  });
  game.scene.add('dungeon', DungeonScene, true, { host });
  window.addEventListener('resize', () => game.scale.resize(parent.clientWidth * dpr, parent.clientHeight * dpr));
  return {
    restart: () => game.scene.getScene('dungeon')!.scene.restart({ host }),
  };
}
