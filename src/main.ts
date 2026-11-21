import { Sound } from './audio/sound';
import type { ClassId } from './core/classes';
import { ancestorsOf, createDynasty, memberById, recordAcquired, recordDeath, type Dynasty } from './core/dynasty';
import { combineEffects } from './core/traits';
import { NO_INPUT, World, type ControlInput, type WorldEvent } from './core/world';
import { makeSave, type SaveData } from './save/save';
import { deleteSave, loadSave, requestPersistence, writeSave } from './save/store';
import type { SceneHost } from './game/DungeonScene';
import type { ClassicEngine } from './game/classic';
import type { FirstPersonView } from './game/firstPerson';
import { ThreeView } from './game/threeView';
import { getLang, t, type StringKey } from './i18n/i18n';
import { Controls } from './ui/controls';
import { Hud } from './ui/hud';
import { CampUi } from './ui/camp';
import { MansionUi } from './ui/mansion';
import { LineageUi, traitList } from './ui/lineage';
import type { MapExtras } from './ui/map';
import { traitName } from './ui/traitText';
import './ui/styles.css';
import { SettingsScreen } from './ui/settingsScreen';
import { LOCATIONS } from './core/locations';
import { planOf, zoneIndex, zoneName } from './core/plan';
import { actionFor, settings } from './settings/settings';

/** A readable random seed, e.g. "ashen-crypt-417". Seeds are chosen outside game logic. */
function randomSeed(): string {
  const a = ['ashen', 'hollow', 'sunken', 'pale', 'grim', 'silent', 'rotten', 'black'];
  const b = ['crypt', 'vault', 'well', 'abbey', 'cellar', 'barrow', 'chapel', 'ossuary'];
  const bytes = crypto.getRandomValues(new Uint32Array(3));
  return `${a[bytes[0] % a.length]}-${b[bytes[1] % b.length]}-${bytes[2] % 1000}`;
}

/** The seed asked for in the address, used only when a new dynasty is founded. */
function requestedSeed(): string | null {
  return new URL(window.location.href).searchParams.get('seed')?.trim() || null;
}

/** Shows the dynasty's seed in the address, so it can be shared. */
function showSeed(seed: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  history.replaceState(null, '', url);
}

/** Seconds between autosaves while playing. */
const AUTOSAVE_SECONDS = 4;

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
  dynasty!: Dynasty;
  /** Who is down there, while a life is being played. */
  private memberId: number | null = null;
  /** Where this life's part of the chronicle begins. */
  private chronicleFrom = 0;
  /** Chosen on the roster, before choosing the class. */
  private chosen: number | null = null;
  private playing = false;
  private readonly lineage: LineageUi;
  private readonly campUi: CampUi;
  private readonly mansion: MansionUi;
  /** Up at the mansion: the dungeon waits. */
  private atMansion = false;
  /** The depth the HUD last showed, to tell when a new zone is entered. */
  private shownDepth = 1;

  private readonly controls: Controls;
  private readonly hud: Hud;
  private hudTimer = 0;
  private readonly sound = new Sound();
  private readonly vignette = document.getElementById('vignette')!;
  private readonly hurt = document.querySelector<HTMLElement>('#vignette .hurt')!;
  private danger = 0;
  view: 'top' | 'first' = storedView();
  /**
   * The 3D engine draws both views from one world and runs the game loop itself.
   * `?engine=classic` brings back the hand-drawn Phaser view and the raycaster.
   */
  readonly engine: 'classic' | 'three' = new URL(window.location.href).searchParams.get('engine') === 'classic' ? 'classic' : 'three';
  private three: ThreeView | null = null;
  private classic: ClassicEngine | null = null;
  private fp: FirstPersonView | null = null;
  private fpAngle = 0;
  private settingsScreen: SettingsScreen;
  private lastInput = 0;
  private lastFrame = 0;

  constructor() {
    const hudRoot = document.getElementById('hud')!;
    this.hud = new Hud(hudRoot, '', {
      onChooseClass: (classId) => void this.start(classId),
      onClassBack: () => {
        this.hud.showClassSelect(false);
        this.hud.setPlaying(false);
        this.lineage.showRoster();
      },
      onDescend: () => this.act(),
      onUseItem: (uid, sign) => {
        this.world.useItem(uid, sign);
        this.setPaused(false);
      },
      onDropItem: (uid) => {
        this.world.dropItem(uid);
        this.persist();
      },
      onResume: () => this.setPaused(false),
      onPause: () => this.setPaused(true),
      onAbandon: () => {
        this.hud.setPaused(false);
        this.lineage.askAbandon(() => this.hud.setPaused(true));
      },
      onOpenMap: () => this.toggleMap(),
      onToggleView: () => this.toggleView(),
      onToggleSound: () => {
        this.sound.start();
        this.sound.setMuted(!this.sound.isMuted);
        return !this.sound.isMuted;
      },
      onOpenSettings: () => {
        // The game does not stop on its own while the page is open: pause it.
        if (this.playing && !this.paused) this.setPaused(true);
        this.settingsScreen.show();
      },
    });
    this.settingsScreen = new SettingsScreen(hudRoot, {
      view: () => this.view,
      setView: (view) => {
        if (view !== this.view) this.toggleView();
      },
      onClose: () => this.controls.reset(),
    });
    this.hud.setSoundOn(!this.sound.isMuted);
    this.controls = new Controls(
      document.getElementById('touch-zone')!,
      this.hud.attackButton,
      this.hud.dodgeButton,
      this.hud.specialButton,
    );
    this.campUi = new CampUi(hudRoot, {
      onEvents: (events) => this.announce(events),
      onLeave: () => {
        this.paused = false;
        this.controls.reset();
        this.persist();
      },
    });
    this.mansion = new MansionUi(hudRoot, {
      onRest: (events) => {
        this.announce(events);
        this.persist();
      },
      onDescend: () => this.leaveMansion(),
      onChange: () => this.persist(),
    });
    this.lineage = new LineageUi(hudRoot, {
      onPick: (id) => this.pick(id),
      onAbandon: () => void this.abandon(),
    });
    this.hud.setPlaying(false);
    void this.applyView();

    // Leaving the app pauses it and saves: the game never runs while nobody is looking.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.setPaused(true);
        this.sound.suspend();
        this.persist();
      }
    });
    window.addEventListener('pagehide', () => this.persist());
    window.setInterval(() => {
      if (this.playing && !this.paused) this.persist();
    }, AUTOSAVE_SECONDS * 1000);
    window.addEventListener('keydown', (e) => {
      if (this.settingsScreen.open) {
        if (e.code === 'Escape') this.settingsScreen.hide();
        return;
      }
      if (!this.playing || e.repeat) return;
      const action = actionFor(e.code);
      if (action === 'pause') this.setPaused(!this.paused);
      if (action === 'interact' && !this.paused) this.act();
      if (action === 'map') this.toggleMap();
      if (action === 'view') this.toggleView();
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
    this.fpAngle += raw.move.x * TURN_SPEED * settings().turn * dt;
    const forward = -raw.move.y;
    const dir = { x: Math.cos(this.fpAngle), y: Math.sin(this.fpAngle) };
    return { ...raw, move: { x: dir.x * forward, y: dir.y * forward }, aim: dir };
  }

  /** The classic top view draws only when it is the active view. */
  get drawTop(): boolean {
    return this.engine === 'classic' && this.view === 'top';
  }

  /** Switches between the top view and first person. */
  private toggleView(): void {
    this.view = this.view === 'first' ? 'top' : 'first';
    try {
      localStorage.setItem(VIEW_KEY, this.view);
    } catch {
      // Only a preference.
    }
    void this.applyView();
  }

  private async applyView(): Promise<void> {
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
    if (first && !this.fp) {
      const { FirstPersonView } = await import('./game/classic');
      this.fp = new FirstPersonView(document.getElementById('fp')!);
    }
  }

  /** Called by the classic scene every frame it simulates. */
  onEvents(events: WorldEvent[]): void {
    this.frame(events);
    if (this.view === 'first' && this.fp) this.fp.render(this.world, events, this.fpAngle, performance.now());
  }

  /** Everything that reacts to a simulated frame, whatever draws it. */
  private frame(events: WorldEvent[]): void {
    const world = this.world;
    this.sound.update(world, events, this.paused);
    this.updateDanger(world);
    this.announce(events);
    const died = events.find((e) => e.type === 'died');
    if (died && died.type === 'died') {
      this.die(died.cause);
      return;
    }

    // Meters and cooldowns are cheap to refresh, but there is no need to do it every frame.
    this.hudTimer++;
    if (this.hudTimer % 3 === 0 || events.length > 0) {
      this.hud.setSurvival(world.survival, world.maxHealth);
      this.hud.setInteraction(world.interaction);
      this.hud.setGold(world.gold);
      this.hud.setClock(world.day, world.isNight, world.phase);
      this.hud.setSpecial(world.specialCharge, world.specialReady);
      this.hud.setDodgeReady(world.dodgeCooldown <= 0);
    }
  }

  /** Toasts and the chronicle for what happened in the world, in play or by the fire. */
  private announce(events: WorldEvent[]): void {
    const world = this.world;
    for (const e of events) {
      if (e.type === 'pickup') {
        this.hud.toastText(e.kind === 'gold' ? t('toast_gold', { n: e.amount ?? 0 }) : t(`item_${e.kind}` as StringKey));
      } else if (e.type === 'noRoom') this.hud.toastText(t('toast_noRoom', { item: t(`item_${e.kind}` as StringKey) }));
      else if (e.type === 'refilled') this.hud.toast(e.skins === 0 ? 'toast_noSkin' : e.turbid ? 'toast_turbid' : 'toast_refilled');
      else if (e.type === 'found') {
        const names = e.kinds.filter((k) => k !== 'gold').map((k) => t(`item_${k}` as StringKey));
        if (e.gold > 0) names.push(t('toast_gold', { n: e.gold }));
        this.hud.toastText(names.length ? t('toast_found', { list: names.join(', ') }) : t('toast_foundNothing'), true);
        if (e.dropped > 0) this.hud.toast('toast_droppedSome');
      } else if (e.type === 'channel') {
        this.hud.toast(e.kind === 'waterskin' ? 'toast_drinking' : e.kind === 'oil' ? 'toast_filling' : 'toast_eating');
      } else if (e.type === 'interrupted') this.hud.toast('toast_interrupted');
      else if (e.type === 'digging') this.hud.toastText(t('toast_digging'), true);
      else if (e.type === 'forcing') this.hud.toastText(t('toast_forcing'), true);
      else if (e.type === 'picking') this.hud.toastText(t('toast_picking'), true);
      else if (e.type === 'unlocked') this.hud.toast('toast_unlocked');
      else if (e.type === 'campPacked') this.hud.toastText(t('toast_campPacked'), true);
      else if (e.type === 'placeEntered') {
        const def = LOCATIONS.find((d) => d.id === e.id);
        if (def) this.hud.toastText(def.name[getLang()], true);
      }
      else if (e.type === 'floodRose') this.hud.toastText(t('toast_floodRose', { depth: e.depth }), true);
      else if (e.type === 'cantUse') {
        if (e.reason === 'locked') this.hud.toastText(t('toast_locked'), true);
        else this.hud.toast(e.reason === 'danger' ? 'toast_danger' : e.reason === 'camp' ? 'toast_onlyCamp' : 'toast_empty');
      } else if (e.type === 'nightfall') this.hud.toastText(t('toast_nightfall'), true);
      else if (e.type === 'levelChanged') this.levelChanged();
      else if (e.type === 'toMansion') this.enterMansion();
      else if (e.type === 'dawn') this.hud.toast('toast_dawn');
      else if (e.type === 'cantBuild') this.hud.toast(`toast_cantBuild_${e.reason}` as StringKey);
      else if (e.type === 'campBuilt' && this.memberId !== null) {
        this.dynasty.chronicle.push({ type: 'campBuilt', generation: this.dynasty.generation, memberId: this.memberId, depth: e.camp.depth });
        this.hud.toast('toast_campBuilt');
        this.persist();
      } else if (e.type === 'campLost') {
        this.dynasty.chronicle.push({ type: 'campLost', generation: this.dynasty.generation, depth: e.camp.depth, reason: 'night' });
        this.hud.toastText(t('toast_campLost', { depth: e.camp.depth }), true);
      } else if (e.type === 'workBuilt') {
        const keys = { torch: 'toast_torchSet', barricade: 'toast_barricade', chalk: 'toast_chalk', rope: 'toast_rope', bridge: 'toast_bridge', cleared: 'toast_cleared', dam: 'toast_dam', unlocked: 'toast_unlocked' } as const;
        this.hud.toast(keys[e.work.kind]);
      } else if (e.type === 'bashing') this.hud.toast(e.barricade ? 'toast_bashingBarricade' : 'toast_bashingDoor');
      else if (e.type === 'shutBroken') {
        this.hud.toastText(e.barricade ? t('toast_barricadeBroken', { depth: e.depth }) : t('toast_doorBroken'), e.barricade);
      }
      else if (e.type === 'torchFilled') this.hud.toast('toast_torchFilled');
      else if (e.type === 'slept') this.hud.toastText(t(`slept_${e.outcome}` as StringKey), true);
      else if (e.type === 'parry') this.hud.toast('parry');
      else if (e.type === 'executed') this.hud.toast('executed');
      else if (e.type === 'playerHit' && e.lightStolen > 0) this.hud.toast('lightStolen');
      else if (e.type === 'hardToKill') this.hud.toast('hardToKillSaved');
      else if (e.type === 'warning') this.hud.toast('warningBehind');
      else if (e.type === 'traitGained' && this.memberId !== null) {
        recordAcquired(this.dynasty, this.memberId, e.trait, world.depth);
        this.hud.toastText(t('traitGained', { trait: traitName(e.trait) }), true);
        this.persist();
      }
    }
  }

  /** The 3D engine's game loop: simulate, react, draw. */
  private loop = (time: number): void => {
    requestAnimationFrame(this.loop);
    if (!this.world || !this.three) return;
    const dt = this.lastFrame ? Math.min(0.1, (time - this.lastFrame) / 1000) : 0;
    this.lastFrame = time;
    let events: WorldEvent[] = [];
    if (this.playing && !this.paused && !this.world.dead) {
      events = this.world.update(dt, this.input);
      this.frame(events);
    }
    this.three.render(this.world, events, this.fpAngle, time);
  };

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
    // Dread: the fearful feel the darkness close in sooner, the serene later.
    const dread = world.fx.dread ?? 0;
    let target = Math.min(1, hunters / Math.max(1, 3 - dread));
    if (dread > 0 && world.survival.light < 25) target = Math.max(target, 0.35 * dread);
    this.danger += (target - this.danger) * 0.05;
    // Night presses in from the edges too.
    this.vignette.style.opacity = String(Math.min(1, 0.45 + (world.isNight ? 0.18 : 0) + this.danger * 0.5));
    const health = world.survival.health / world.maxHealth;
    const threshold = Math.max(0.2, 0.5 + dread * 0.15);
    this.hurt.style.opacity = String(health < threshold ? ((threshold - health) / threshold) * 1 : 0);
  }

  /** Loads the dynasty, or founds one, and picks up exactly where things were left. */
  async boot(): Promise<void> {
    void requestPersistence();
    const save = await loadSave();
    if (save) {
      this.dynasty = save.dynasty;
    } else {
      this.dynasty = createDynasty(requestedSeed() ?? randomSeed());
    }
    showSeed(this.dynasty.seed);
    this.hud.setSeed(this.dynasty.seed);
    this.lineage.setDynasty(this.dynasty);
    document.body.classList.remove('booting');
    if (save?.life) {
      this.resume(save);
      return;
    }
    this.persist();
    this.lineage.showRoster();
  }

  private resume(save: SaveData): void {
    const life = save.life!;
    this.memberId = life.memberId;
    this.chronicleFrom = life.chronicleFrom ?? this.dynasty.chronicle.length;
    void this.begin(
      World.restore(life.world, {
        explored: this.dynasty.explored,
        camps: this.dynasty.camps,
        works: this.dynasty.works,
        floods: (this.dynasty.floods ??= {}),
        builder: life.memberId,
        generation: this.dynasty.generation,
      }),
    ).then(() => (life.atMansion ? this.enterMansion() : this.setPaused(true)));
  }

  /** A member was chosen on the roster: now their class. */
  private pick(memberId: number): void {
    const member = memberById(this.dynasty, memberId);
    this.chosen = memberId;
    this.lineage.hide();
    this.hud.showClassSelect(true, { name: member.name, bonus: combineEffects(member.traits).attrs });
  }

  private async start(classId: ClassId): Promise<void> {
    if (this.chosen === null) return;
    const member = memberById(this.dynasty, this.chosen);
    member.classId = classId;
    this.memberId = member.id;
    this.chosen = null;
    this.chronicleFrom = this.dynasty.chronicle.length;
    await this.begin(
      new World(this.dynasty.seed, classId, this.dynasty.lives, 1, {
        traits: [...member.traits],
        explored: this.dynasty.explored,
        camps: this.dynasty.camps,
        works: this.dynasty.works,
        floods: (this.dynasty.floods ??= {}),
        builder: member.id,
        generation: this.dynasty.generation,
      }),
    );
    // Every life sets out from the mansion.
    this.enterMansion();
  }

  /** Puts a world in play, new or restored. */
  private async begin(world: World): Promise<void> {
    this.sound.start();
    const fresh = !this.world;
    this.world = world;
    this.atMansion = false;
    this.mansion.hide();
    this.playing = true;
    this.paused = false;
    this.controls.reset();
    this.lineage.hide();
    this.hud.showClassSelect(false);
    this.hud.setDepth(world.depth, world.seed);
    this.shownDepth = world.depth;
    this.hud.setSurvival(world.survival, world.maxHealth);
    await this.applyView();
    if (this.engine === 'three') {
      if (fresh) requestAnimationFrame(this.loop);
    } else if (this.classic) {
      this.classic.restart();
    } else {
      const { bootClassic } = await import('./game/classic');
      this.classic = bootClassic(this, document.getElementById('game')!);
    }
  }

  /** The hero fell: a generation passes, and the chronicle tells what it brought. */
  private die(cause: import('./core/dynasty').DeathCause): void {
    const world = this.world;
    this.playing = false;
    this.hud.hideAll();
    this.hud.setSurvival(world.survival, world.maxHealth);
    document.getElementById('hint')!.classList.add('gone');
    if (this.memberId === null) return;
    world.storeExplored();
    recordDeath(this.dynasty, this.memberId, { depth: world.depth, cause, x: world.player.x, y: world.player.y });
    this.memberId = null;
    this.persist();
    const from = this.chronicleFrom;
    setTimeout(() => {
      this.hud.setPlaying(false);
      this.lineage.showChronicle(from, () => this.lineage.showRoster());
    }, 1200);
  }

  /** Saves everything now: the dynasty, and the life in play if there is one. */
  private persist(): void {
    if (!this.dynasty) return;
    let life: SaveData['life'] = null;
    if (this.world && this.playing && !this.world.dead && this.memberId !== null) {
      this.world.storeExplored();
      life = { memberId: this.memberId, chronicleFrom: this.chronicleFrom, atMansion: this.atMansion, world: this.world.snapshot() };
    }
    void writeSave(makeSave(this.dynasty, life, Date.now()));
  }

  /** The end of a dynasty, by choice: everything is erased and a new one is founded. */
  private async abandon(): Promise<void> {
    this.playing = false;
    this.paused = false;
    this.memberId = null;
    this.hud.hideAll();
    this.hud.setPlaying(false);
    await deleteSave();
    this.dynasty = createDynasty(randomSeed());
    showSeed(this.dynasty.seed);
    this.hud.setSeed(this.dynasty.seed);
    this.lineage.setDynasty(this.dynasty);
    this.persist();
    this.lineage.showRoster();
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
    else this.hud.openMap(this.world, this.mapExtras());
  }

  /** Crosses where the family fell on this level: the hero's own line, or everyone's with Old Memory. */
  private mapExtras(): MapExtras {
    const depth = this.world.depth;
    let fallen = this.dynasty.members.filter((m) => m.status === 'fallen');
    if (!this.world.fx.mapAllDeaths && this.memberId !== null) {
      const line = new Set(ancestorsOf(this.dynasty, memberById(this.dynasty, this.memberId)).map((m) => m.id));
      fallen = fallen.filter((m) => line.has(m.id));
    }
    return {
      deaths: fallen.filter((m) => m.death?.depth === depth).map((m) => ({ x: m.death!.x, y: m.death!.y, name: m.name })),
    };
  }

  /** The action button: the stairs, a fountain or something to search, whatever is at hand. */
  private act(): void {
    if (!this.playing || this.world.dead) return;
    const interaction = this.world.interaction;
    if (interaction === 'ropeDown' || interaction === 'ropeUp') {
      this.world.climbRope();
      this.levelChanged();
    } else if (interaction === 'outpost') {
      // A camp of old: lit again, it is the family's, and the fire screen opens.
      const events = this.world.relightOutpost();
      this.announce(events);
      if (this.world.campInReach) {
        this.paused = true;
        this.controls.reset();
        this.hud.closeMap();
        this.campUi.show(this.world);
      }
    } else if (interaction === 'camp') {
      // The camp is a pause by the fire.
      this.paused = true;
      this.controls.reset();
      this.hud.closeMap();
      this.campUi.show(this.world);
    } else this.world.interact();
  }

  /** After walking the stairs (or a rope) to another level. */
  private levelChanged(): void {
    // Into another zone: its name, as a place is announced.
    if (zoneIndex(this.world.depth) !== zoneIndex(this.shownDepth)) this.hud.toastText(t('zoneEntered', { zone: zoneName(planOf(this.world.seed), this.world.depth, getLang()) }), true);
    this.shownDepth = this.world.depth;
    this.hud.setDepth(this.world.depth, this.world.seed);
    this.hud.setInteraction(null);
    this.classic?.restart();
    this.persist();
  }

  private enterMansion(): void {
    this.atMansion = true;
    this.paused = true;
    this.controls.reset();
    this.hud.hideAll();
    this.hud.setPlaying(false);
    document.getElementById('hint')!.classList.add('gone');
    const name = this.memberId !== null ? memberById(this.dynasty, this.memberId).name : '';
    this.mansion.show(this.world, name);
    this.persist();
  }

  private leaveMansion(): void {
    this.atMansion = false;
    this.world.returnFromSurface();
    this.hud.setDepth(this.world.depth, this.world.seed);
    this.hud.setPlaying(true);
    this.paused = false;
    this.controls.reset();
    this.persist();
    this.showHint();
  }

  private setPaused(paused: boolean): void {
    if (!this.playing) return;
    if (!paused) this.sound.start();
    this.paused = paused;
    this.controls.reset();
    if (paused && this.memberId !== null) {
      const member = memberById(this.dynasty, this.memberId);
      this.hud.setHeroInfo(
        `<p class="hero-line">${t('heroLine', { name: member.name, class: t(`className_${this.world.classId}` as StringKey) })}</p>${traitList({ ...member, traits: this.world.traits })}`,
      );
      this.hud.backpack.show(this.world.inventory, this.world.gold, this.world.knowsMushrooms);
    }
    this.hud.setPaused(paused);
  }
}

document.body.classList.add('booting');
const session = new Session();
void session.boot();
// `?debug=1` exposes the session for manual testing from the browser console.
if (new URL(window.location.href).searchParams.has('debug')) {
  (window as unknown as { estirpe: Session }).estirpe = session;
}

// Installable and playable offline: the service worker keeps the game's files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
