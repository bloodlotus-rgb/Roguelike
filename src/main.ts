import Phaser from 'phaser';
import { Sound } from './audio/sound';
import type { ClassId } from './core/classes';
import { NO_INPUT, World, type ControlInput, type WorldEvent } from './core/world';
import { DARK } from './game/art';
import { DungeonScene, type SceneHost } from './game/DungeonScene';
import { FirstPersonView } from './game/firstPerson';
import { ThreeView } from './game/threeView';
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
const VIEW_KEY = 'estirpe.view';
/** Turning speed in first person, radians per second at full stick. */
const TURN_SPEED = 2.6;

function storedView(): 'top' | 'first' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'first' ? 'first' : 'top';
  } catch {
    return 'top';
  }
}

class Session implements SceneHost {
  world!: World;
  paused = false;
  private life = 0;
  private playing = false;
  private readonly controls: Controls;
  private readonly hud: Hud;
  private game: Phaser.Game | null = null;
  private hudTimer = 0;
  private readonly sound = new Sound();
  private readonly vignette = document.getElementById('vignette')!;
  private readonly hurt = document.querySelector<HTMLElement>('#vignette .hurt')!;
  private danger = 0;
  view: 'top' | 'first' = storedView();
  private fp: FirstPersonView | null = null;
  /** `?engine=three` tries the experimental 3D renderer, which draws both views. */
  readonly engine: 'classic' | 'three' = new URL(window.location.href).searchParams.get('engine') === 'three' ? 'three' : 'classic';
  private three: ThreeView | null = null;
  private fpAngle = 0;
  private lastInput = 0;

  constructor(private readonly seed: string) {
    this.hud = new Hud(document.getElementById('hud')!, seed, {
      onChooseClass: (classId) => this.start(classId),
      onDescend: () => this.descend(),
      onChooseAgain: () => this.chooseAgain(),
      onResume: () => this.setPaused(false),
      onOpenMap: () => this.toggleMap(),
      onToggleView: () => this.toggleView(),
      onToggleSound: () => {
        this.sound.start();
        this.sound.setMuted(!this.sound.isMuted);
        return !this.sound.isMuted;
      },
    });
    this.hud.setSoundOn(!this.sound.isMuted);
    this.controls = new Controls(
      document.getElementById('touch-zone')!,
      this.hud.attackButton,
      this.hud.dodgeButton,
      this.hud.specialButton,
    );
    this.hud.showClassSelect(true);
    this.applyView();

    // Leaving the app pauses it: the game never runs while nobody is looking.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.setPaused(true);
        this.sound.suspend();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (!this.playing) return;
      if (e.code === 'Escape') this.setPaused(!this.paused);
      if (e.code === 'Enter' && this.world.atStairs && !this.paused) this.descend();
      if (e.code === 'KeyM') this.toggleMap();
      if (e.code === 'KeyV') this.toggleView();
    });
  }

  get input(): ControlInput {
    if (!this.playing || this.paused) return NO_INPUT;
    const raw = this.controls.input;
    if (this.view !== 'first') return raw;
    // Tank controls: the stick's sideways axis turns, its vertical axis walks.
    const now = performance.now();
    const dt = this.lastInput ? Math.min(0.1, (now - this.lastInput) / 1000) : 0;
    this.lastInput = now;
    this.fpAngle += raw.move.x * TURN_SPEED * dt;
    const forward = -raw.move.y;
    const dir = { x: Math.cos(this.fpAngle), y: Math.sin(this.fpAngle) };
    return { ...raw, move: { x: dir.x * forward, y: dir.y * forward }, aim: dir };
  }

  /** Switches between the top view and the first-person prototype. */
  private toggleView(): void {
    this.view = this.view === 'first' ? 'top' : 'first';
    try {
      localStorage.setItem(VIEW_KEY, this.view);
    } catch {
      // Only a preference.
    }
    this.applyView();
  }

  get drawTop(): boolean {
    return this.engine === 'classic' && this.view === 'top';
  }

  private applyView(): void {
    const first = this.view === 'first';
    this.hud.setFirstPerson(first);
    if (first && this.world) this.fpAngle = Math.atan2(this.world.facing.y, this.world.facing.x);
    this.lastInput = 0;
    if (this.engine === 'three') {
      document.body.classList.add('three-engine');
      if (!this.three) this.three = new ThreeView(document.getElementById('three')!);
      this.three.setMode(first ? 'first' : 'top');
      return;
    }
    document.body.classList.toggle('first-person', first);
    if (first && !this.fp) this.fp = new FirstPersonView(document.getElementById('fp')!);
  }

  onEvents(events: WorldEvent[]): void {
    const world = this.world;
    this.sound.update(world, events, this.paused);
    if (this.engine === 'three') this.three?.render(world, events, this.fpAngle, performance.now());
    else if (this.view === 'first' && this.fp) this.fp.render(world, events, this.fpAngle, performance.now());
    this.updateDanger(world);
    if (events.some((e) => e.type === 'died')) {
      this.playing = false;
      this.hud.closeMap();
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

  /**
   * The screen closes in when horrors hunt you and turns red when you are hurt.
   * Smoothed so it breathes instead of flickering.
   */
  private updateDanger(world: World): void {
    let hunters = 0;
    for (const e of world.enemies) {
      if (e.state === 'dead' || !e.alerted) continue;
      if (Math.hypot(e.pos.x - world.player.x, e.pos.y - world.player.y) < 7) hunters++;
    }
    const target = Math.min(1, hunters / 3);
    this.danger += (target - this.danger) * 0.05;
    this.vignette.style.opacity = String(0.45 + this.danger * 0.5);
    const health = world.survival.health / world.maxHealth;
    this.hurt.style.opacity = String(health < 0.5 ? (0.5 - health) * 2 : 0);
  }

  private start(classId: ClassId): void {
    this.sound.start();
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
    this.applyView();
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
      backgroundColor: DARK,
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
    hint.textContent = t(this.view === 'first' ? 'controlsHintFirst' : isTouch ? 'controlsHint' : 'controlsHintKeys');
    hint.classList.remove('gone');
    setTimeout(() => hint.classList.add('gone'), 6000);
  }

  /** The map does not stop the game: looking at it in the dark is a risk. */
  private toggleMap(): void {
    if (!this.playing) return;
    if (this.hud.mapOpen) this.hud.closeMap();
    else this.hud.openMap(this.world);
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
    if (!paused) this.sound.start();
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
