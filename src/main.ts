import Phaser from 'phaser';
import type { ClassId } from './core/classes';
import { NO_INPUT, World, type ControlInput, type WorldEvent } from './core/world';
import { PAPER } from './game/art';
import { DungeonScene, type SceneHost } from './game/DungeonScene';
import { t, type StringKey } from './i18n/i18n';
import { Controls } from './ui/controls';
import { Hud } from './ui/hud';
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

const isTouch = window.matchMedia('(pointer: coarse)').matches;

class Session implements SceneHost {
  world!: World;
  paused = false;
  private life = 0;
  private playing = false;
  private readonly controls: Controls;
  private readonly hud: Hud;
  private game: Phaser.Game | null = null;
  private hudTimer = 0;

  constructor(private readonly seed: string) {
    this.hud = new Hud(document.getElementById('hud')!, seed, {
      onChooseClass: (classId) => this.start(classId),
      onDescend: () => this.descend(),
      onChooseAgain: () => this.chooseAgain(),
      onResume: () => this.setPaused(false),
    });
    this.controls = new Controls(
      document.getElementById('touch-zone')!,
      this.hud.attackButton,
      this.hud.dodgeButton,
      this.hud.specialButton,
    );
    this.hud.showClassSelect(true);

    // Leaving the app pauses it: the game never runs while nobody is looking.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.playing) return;
      if (e.code === 'Escape') this.setPaused(!this.paused);
      if (e.code === 'Enter' && this.world.atStairs && !this.paused) this.descend();
    });
  }

  get input(): ControlInput {
    return this.playing && !this.paused ? this.controls.input : NO_INPUT;
  }

  onEvents(events: WorldEvent[]): void {
    const world = this.world;
    if (events.some((e) => e.type === 'died')) {
      this.playing = false;
      this.hud.setSurvival(world.survival, world.maxHealth);
      setTimeout(() => this.hud.showDeath(world.depth), 600);
      return;
    }
    // Meters and cooldowns are cheap to refresh, but there is no need to do it every frame.
    this.hudTimer++;
    if (this.hudTimer % 3 === 0 || events.length > 0) {
      this.hud.setSurvival(world.survival, world.maxHealth);
      this.hud.setStairsAvailable(world.atStairs);
      this.hud.setSpecial(world.specialCharge, world.specialReady);
      this.hud.setDodgeReady(world.dodgeCooldown <= 0);
    }
  }

  onToast(key: StringKey): void {
    this.hud.toast(key);
  }

  private start(classId: ClassId): void {
    this.world = new World(this.seed, classId, this.life);
    this.playing = true;
    this.paused = false;
    this.controls.reset();
    this.hud.showClassSelect(false);
    this.hud.hideDeath();
    this.hud.setDepth(this.world.depth);
    this.hud.setSurvival(this.world.survival, this.world.maxHealth);
    if (this.game) this.restartScene();
    else this.boot();
    this.showHint();
  }

  private boot(): void {
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
      this.game?.scale.resize(parent.clientWidth * dpr, parent.clientHeight * dpr);
    });
  }

  private showHint(): void {
    const hint = document.getElementById('hint')!;
    hint.textContent = t(isTouch ? 'controlsHint' : 'controlsHintKeys');
    hint.classList.remove('gone');
    setTimeout(() => hint.classList.add('gone'), 6000);
  }

  private descend(): void {
    if (!this.world.atStairs || this.world.dead) return;
    this.world.descend();
    this.hud.setDepth(this.world.depth);
    this.hud.setStairsAvailable(false);
    this.restartScene();
  }

  /** After a death: a new life, with the horrors and loot re-rolled. */
  private chooseAgain(): void {
    this.life++;
    this.hud.hideDeath();
    this.hud.showClassSelect(true);
  }

  private restartScene(): void {
    this.controls.reset();
    this.game!.scene.getScene('dungeon')!.scene.restart({ host: this });
  }

  private setPaused(paused: boolean): void {
    if (!this.playing) return;
    this.paused = paused;
    this.controls.reset();
    this.hud.setPaused(paused);
  }
}

const session = new Session(readSeed());
// `?debug=1` exposes the session for manual testing from the browser console.
if (new URL(window.location.href).searchParams.has('debug')) {
  (window as unknown as { estirpe: Session }).estirpe = session;
}
