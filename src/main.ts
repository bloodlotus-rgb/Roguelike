import Phaser from 'phaser';
import { World, type WorldEvent } from './core/world';
import { DungeonScene, type SceneHost } from './game/DungeonScene';
import { PAPER } from './game/art';
import { setLang, getLang, t, type StringKey } from './i18n/i18n';
import { Hud } from './ui/hud';
import { Controls } from './ui/joystick';
import './ui/styles.css';

/** A readable random seed, e.g. "ashen-crypt-417". Seeds are chosen outside game logic. */
function randomSeed(): string {
  const a = ['ashen', 'hollow', 'sunken', 'pale', 'grim', 'silent', 'rotten', 'black'];
  const b = ['crypt', 'vault', 'well', 'abbey', 'cellar', 'barrow', 'chapel', 'ossuary'];
  const bytes = crypto.getRandomValues(new Uint32Array(3));
  return `${a[bytes[0] % a.length]}-${b[bytes[1] % b.length]}-${bytes[2] % 1000}`;
}

function readSeed(): string {
  const url = new URL(window.location.href);
  let seed = url.searchParams.get('seed')?.trim();
  if (!seed) {
    seed = randomSeed();
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  }
  return seed;
}

class Session implements SceneHost {
  world: World;
  paused = false;
  private readonly controls: Controls;
  private readonly hud: Hud;
  private readonly game: Phaser.Game;
  private hudTimer = 0;

  constructor(private readonly seed: string) {
    this.world = new World(seed);
    this.controls = new Controls(document.getElementById('touch-zone')!);
    this.hud = new Hud(document.getElementById('hud')!, seed, {
      onDescend: () => this.descend(),
      onRestart: () => this.restart(),
      onResume: () => this.setPaused(false),
    });
    this.hud.setDepth(this.world.depth);
    this.hud.setSurvival(this.world.survival);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = document.getElementById('game')!;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: parent.clientWidth * dpr,
      height: parent.clientHeight * dpr,
      backgroundColor: PAPER,
      scale: { mode: Phaser.Scale.NONE },
      input: { keyboard: false, mouse: false, touch: false },
      render: { antialias: true, roundPixels: false },
      scene: [],
    });
    this.game.scene.add('dungeon', DungeonScene, true, { host: this });
    window.addEventListener('resize', () => {
      this.game.scale.resize(parent.clientWidth * dpr, parent.clientHeight * dpr);
    });

    // Leaving the app pauses it: the game never runs while nobody is looking.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.setPaused(!this.paused);
      if ((e.code === 'Enter' || e.code === 'KeyE') && this.world.atStairs && !this.paused) this.descend();
      if (e.code === 'KeyL') setLang(getLang() === 'es' ? 'en' : 'es');
    });

    const hint = document.getElementById('hint')!;
    hint.textContent = t('controlsHint');
    setTimeout(() => hint.classList.add('gone'), 5000);
  }

  get moveVector() {
    return this.controls.vector;
  }

  onEvents(events: WorldEvent[]): void {
    if (events.some((e) => e.type === 'died')) {
      this.hud.setSurvival(this.world.survival);
      this.hud.showDeath(this.world.depth);
      return;
    }
    // The meters move slowly: refreshing them a few times per second is enough.
    this.hudTimer++;
    if (this.hudTimer % 6 === 0 || events.length > 0) {
      this.hud.setSurvival(this.world.survival);
      this.hud.setStairsAvailable(this.world.atStairs);
    }
  }

  onToast(key: StringKey): void {
    this.hud.toast(key);
  }

  private descend(): void {
    if (!this.world.atStairs || this.world.dead) return;
    this.world.descend();
    this.hud.setDepth(this.world.depth);
    this.hud.setStairsAvailable(false);
    this.restartScene();
  }

  private restart(): void {
    this.world = new World(this.seed);
    this.hud.hideDeath();
    this.hud.setDepth(this.world.depth);
    this.hud.setSurvival(this.world.survival);
    this.restartScene();
  }

  private restartScene(): void {
    this.controls.reset();
    this.game.scene.getScene('dungeon')!.scene.restart({ host: this });
  }

  private setPaused(paused: boolean): void {
    if (this.world.dead) return;
    this.paused = paused;
    this.controls.reset();
    this.hud.setPaused(paused);
  }
}

new Session(readSeed());
