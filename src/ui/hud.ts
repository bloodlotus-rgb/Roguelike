import { ATTRIBUTE_IDS, type Attributes } from '../core/attributes';
import { CLASSES, CLASS_IDS, type ClassId } from '../core/classes';
import type { Survival } from '../core/survival';
import type { World } from '../core/world';
import type { Interaction } from '../core/world';
import { BackpackUi } from './backpack';
import { setVisualStyle, visualStyle, VISUAL_STYLES, type VisualStyle } from '../game/style';
import { drawMap, drawMark, MAP_ZOOM, type MapExtras, type MapMark, type MapView } from './map';
import { getLang, onLangChange, setLang, t, type StringKey } from '../i18n/i18n';

type Meter = 'health' | 'hunger' | 'thirst' | 'light';
const METERS: Meter[] = ['health', 'hunger', 'thirst', 'light'];

export interface HudHandlers {
  onChooseClass: (classId: ClassId) => void;
  /** Back from choosing a class to choosing who goes down. */
  onClassBack: () => void;
  onDescend: () => void;
  onResume: () => void;
  onPause: () => void;
  onAbandon: () => void;
  onUseItem: (uid: number, sign?: import('../core/dynasty').ChalkSign) => void;
  onDropItem: (uid: number) => void;
  onToggleSound: () => boolean;
  onOpenMap: () => void;
  onToggleView: () => void;
}

/** HTML overlay on top of the canvas: meters, depth, buttons and screens. */
export class Hud {
  readonly attackButton: HTMLButtonElement;
  readonly dodgeButton: HTMLButtonElement;
  readonly specialButton: HTMLButtonElement;
  private readonly meterFills = new Map<Meter, HTMLElement>();
  private readonly descendButton: HTMLButtonElement;
  private readonly pauseScreen: HTMLElement;
  private readonly classScreen: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly depthLabel: HTMLElement;
  private readonly specialRing: HTMLElement;
  private readonly root: HTMLElement;
  private readonly mapScreen: HTMLElement;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly mapTitle: HTMLElement;
  private mapWorld: World | null = null;
  private mapExtras: MapExtras = {};
  private readonly heroInfo: HTMLElement;
  private readonly goldValue: HTMLElement;
  readonly backpack: BackpackUi;
  private interaction: Interaction = null;
  private viewButton!: HTMLButtonElement;
  private firstPerson = false;
  private mapTimer = 0;
  private depth = 1;
  /** Shows whether sound is on. */
  setSoundOn: (on: boolean) => void = () => {};

  constructor(root: HTMLElement, seed: string, handlers: HudHandlers) {
    this.root = root;
    root.innerHTML = `
      <header class="hud-top">
        <div class="meters">
          ${METERS.map(
            (m) => `<div class="meter meter-${m}">
              <span class="meter-label" data-i18n="${m}"></span>
              <span class="meter-bar"><span class="meter-fill"></span></span>
            </div>`,
          ).join('')}
        </div>
        <div class="hud-side">
          <div class="depth"></div>
          <div class="clock"><span class="clock-label"></span><span class="clock-bar"><span></span></span></div>
          <button class="map-button" type="button" data-i18n="map"></button>
          <button class="map-button pause-button" type="button" data-i18n="pause"></button>
          <button class="view-button map-button" type="button"></button>
          <div class="hud-toggles">
            <button class="sound" type="button" aria-label="Sound"></button>
            <button class="lang" type="button" aria-label="Language"></button>
          </div>
        </div>
      </header>
      <div class="toasts" aria-live="polite"></div>
      <div class="purse"><span data-i18n="gold"></span> <b class="gold-value">0</b></div>
      <div class="seed"><span data-i18n="seed"></span>: <span class="seed-value"></span></div>
      <div class="actions">
        <button class="paper-button descend" type="button" hidden></button>
        <button class="action-button special" type="button">
          <span class="special-ring"></span>
          <span data-i18n="special"></span>
        </button>
        <button class="action-button dodge" type="button"><span data-i18n="dodge"></span></button>
        <button class="action-button attack" type="button"><span data-i18n="attack"></span></button>
      </div>
      <section class="map-screen" hidden>
        <div class="map-sheet">
          <header class="map-head">
            <h2 class="map-title"></h2>
            <button class="map-close" type="button" aria-label="×">×</button>
          </header>
          <div class="map-frame">
            <canvas class="map-canvas"></canvas>
            <div class="map-tools">
              <button type="button" data-zoom="1.4">+</button>
              <button type="button" data-zoom="0.7">−</button>
              <button type="button" class="map-center" data-i18n="mapCenter"></button>
            </div>
          </div>
          <ul class="map-legend"></ul>
          <p class="map-hint" data-i18n="mapHint"></p>
        </div>
      </section>
      <section class="screen pause-screen" hidden>
        <h2 data-i18n="paused"></h2>
        <div class="hero-info"></div>
        <div class="backpack-slot"></div>
        <div class="style-picker">
          <span data-i18n="styleLabel"></span>
          <div class="style-options">
            ${VISUAL_STYLES.map((s) => `<button type="button" class="style-option" data-style="${s}" data-i18n="style_${s}"></button>`).join('')}
          </div>
        </div>
        <button class="paper-button resume" type="button" data-i18n="resume"></button>
        <button class="link-button abandon" type="button" data-i18n="abandon"></button>
      </section>
      <section class="screen class-screen" hidden>
        <h1 class="game-title" data-i18n="title"></h1>
        <h2 class="class-title"></h2>
        <div class="class-cards">
          ${CLASS_IDS.map(
            (id) => `<button class="class-card" type="button" data-class="${id}">
              <span class="class-name" data-i18n="className_${id}"></span>
              <span class="class-desc" data-i18n="classDesc_${id}"></span>
              <span class="class-line"><b data-i18n="labelAttack"></b> <span data-i18n="classAttack_${id}"></span></span>
              <span class="class-line special-line"><b data-i18n="labelSpecial"></b> <span data-i18n="classSpecial_${id}"></span></span>
              <span class="class-line"><b data-i18n="labelPassive"></b> <span data-i18n="classPassive_${id}"></span></span>
              <span class="class-attrs">
                ${ATTRIBUTE_IDS.map(
                  (a) => `<span class="attr"><span data-i18n="attr_${a}"></span> <b>${CLASSES[id].attributes[a]}</b></span>`,
                ).join('')}
              </span>
            </button>`,
          ).join('')}
        </div>
        <button class="paper-button class-back" type="button" data-i18n="back"></button>
      </section>
    `;

    for (const m of METERS) {
      this.meterFills.set(m, root.querySelector<HTMLElement>(`.meter-${m} .meter-fill`)!);
    }
    this.depthLabel = root.querySelector('.depth')!;
    this.toasts = root.querySelector('.toasts')!;
    this.descendButton = root.querySelector('.descend')!;
    this.attackButton = root.querySelector('.attack')!;
    this.dodgeButton = root.querySelector('.dodge')!;
    this.specialButton = root.querySelector('.special')!;
    this.specialRing = root.querySelector('.special-ring')!;
    this.heroInfo = root.querySelector('.hero-info')!;
    this.goldValue = root.querySelector('.gold-value')!;
    this.backpack = new BackpackUi(root.querySelector('.backpack-slot')!, {
      onUse: handlers.onUseItem,
      onDrop: handlers.onDropItem,
    });
    this.pauseScreen = root.querySelector('.pause-screen')!;
    this.classScreen = root.querySelector('.class-screen')!;
    this.mapScreen = root.querySelector('.map-screen')!;
    this.mapCanvas = root.querySelector('.map-canvas')!;
    this.mapTitle = root.querySelector('.map-title')!;
    root.querySelector('.map-button:not(.view-button):not(.pause-button)')!.addEventListener('click', handlers.onOpenMap);
    root.querySelector('.pause-button')!.addEventListener('click', handlers.onPause);
    this.viewButton = root.querySelector('.view-button')!;
    this.viewButton.addEventListener('click', handlers.onToggleView);
    // Tapping outside the sheet, or its cross, closes the map.
    this.mapScreen.addEventListener('pointerdown', (e) => {
      if (e.target !== this.mapScreen) return;
      e.preventDefault();
      this.closeMap();
    });
    root.querySelector('.map-close')!.addEventListener('click', () => this.closeMap());
    root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
      b.addEventListener('click', () => this.zoomMap(Number(b.dataset.zoom))),
    );
    root.querySelector('.map-center')!.addEventListener('click', () => {
      this.mapFollow = true;
      this.renderMap();
    });
    this.bindMapGestures();
    root.querySelector('.seed-value')!.textContent = seed;

    this.descendButton.addEventListener('click', handlers.onDescend);
    root.querySelector('.resume')!.addEventListener('click', handlers.onResume);
    root.querySelector('.abandon')!.addEventListener('click', handlers.onAbandon);
    const styleButtons = root.querySelectorAll<HTMLButtonElement>('.style-option');
    const markStyle = () => styleButtons.forEach((b) => b.classList.toggle('chosen', b.dataset.style === visualStyle()));
    styleButtons.forEach((b) =>
      b.addEventListener('click', () => {
        setVisualStyle(b.dataset.style as VisualStyle);
        markStyle();
      }),
    );
    markStyle();
    root.querySelector('.class-back')!.addEventListener('click', handlers.onClassBack);
    root.querySelectorAll<HTMLButtonElement>('.class-card').forEach((card) => {
      card.addEventListener('click', () => handlers.onChooseClass(card.dataset.class as ClassId));
    });
    const soundButton = root.querySelector<HTMLButtonElement>('.sound')!;
    const renderSound = (on: boolean) => {
      soundButton.textContent = on ? '♪' : '♪̸';
      soundButton.classList.toggle('off', !on);
    };
    this.setSoundOn = renderSound;
    soundButton.addEventListener('click', () => renderSound(handlers.onToggleSound()));
    const langButton = root.querySelector<HTMLButtonElement>('.lang')!;
    langButton.addEventListener('click', () => setLang(getLang() === 'es' ? 'en' : 'es'));

    const translate = () => {
      root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n as StringKey);
      });
      langButton.textContent = getLang() === 'es' ? 'EN' : 'ES';
      this.viewButton.textContent = t(this.firstPerson ? 'viewFirst' : 'viewTop');
      document.title = t('title');
      this.renderDepth();
      this.renderClassTitle();
      this.renderInteraction();
      this.renderClock();
    };
    onLangChange(translate);
    translate();
  }

  setSeed(seed: string): void {
    this.root.querySelector('.seed-value')!.textContent = seed;
  }

  setSurvival(s: Survival, maxHealth: number): void {
    for (const m of METERS) {
      const value = m === 'health' ? (s.health / maxHealth) * 100 : s[m];
      const fill = this.meterFills.get(m)!;
      fill.style.transform = `scaleX(${value / 100})`;
      fill.parentElement!.parentElement!.classList.toggle('low', value < 25);
    }
  }

  /** `charge` from 0 to 1; `ready` when it can be used right now. */
  setSpecial(charge: number, ready: boolean): void {
    this.specialRing.style.setProperty('--fill', `${Math.round(charge * 360)}deg`);
    this.specialRing.classList.toggle('ready', ready);
    this.specialButton.classList.toggle('cooling', !ready);
  }

  setDodgeReady(ready: boolean): void {
    this.dodgeButton.classList.toggle('cooling', !ready);
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.renderDepth();
  }

  /** The action button changes with what is at hand: stairs, a fountain, something to search. */
  setInteraction(interaction: Interaction): void {
    if (interaction === this.interaction) return;
    this.interaction = interaction;
    this.descendButton.hidden = interaction === null;
    this.renderInteraction();
  }

  private renderInteraction(): void {
    const keys: Record<NonNullable<Interaction>, StringKey> = {
      ropeDown: 'action_ropeDown',
      ropeUp: 'action_ropeUp',
      camp: 'action_camp',
      torch: 'action_torch',
      openDoor: 'action_openDoor',
      closeDoor: 'action_closeDoor',
      fountain: 'action_fountain',
      drip: 'action_drip',
      search: 'action_search',
      clear: 'action_clear',
      pool: 'action_pool',
    };
    const key = this.interaction ? keys[this.interaction] : 'descend';
    this.descendButton.textContent = t(key);
  }

  private clockState = { day: 1, night: false, phase: 0 };

  /** The day below ground: which day, day or night, and how far through it. */
  setClock(day: number, night: boolean, phase: number): void {
    const c = this.clockState;
    const changed = c.day !== day || c.night !== night;
    this.clockState = { day, night, phase };
    const el = this.root.querySelector<HTMLElement>('.clock')!;
    el.classList.toggle('night', night);
    (el.querySelector('.clock-bar span') as HTMLElement).style.transform = `scaleX(${1 - phase})`;
    if (changed) this.renderClock();
  }

  private renderClock(): void {
    const { day, night } = this.clockState;
    this.root.querySelector('.clock-label')!.textContent = `${t('day', { n: day })} · ${t(night ? 'night' : 'daytime')}`;
  }

  setGold(gold: number): void {
    this.goldValue.textContent = String(gold);
  }

  setPlaying(playing: boolean): void {
    this.root.classList.toggle('playing', playing);
  }

  toast(key: StringKey): void {
    this.toastText(t(key));
  }

  toastText(text: string, long = false): void {
    const el = document.createElement('div');
    el.className = long ? 'toast long' : 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), long ? 3600 : 2200);
  }

  private classFor = '';

  /**
   * The class choice for one member: the attributes shown already include what their
   * traits add. Without `member`, it just hides.
   */
  showClassSelect(show: boolean, member?: { name: string; bonus: Partial<Attributes> }): void {
    this.classScreen.hidden = !show;
    this.root.classList.toggle('selecting', show);
    this.setPlaying(!show);
    if (!member) return;
    this.classFor = member.name;
    this.renderClassTitle();
    this.classScreen.querySelectorAll<HTMLElement>('.class-card').forEach((card) => {
      const id = card.dataset.class as ClassId;
      card.querySelectorAll<HTMLElement>('.attr').forEach((el, i) => {
        const attr = ATTRIBUTE_IDS[i];
        const bonus = member.bonus[attr] ?? 0;
        const b = el.querySelector('b')!;
        b.textContent = String(CLASSES[id].attributes[attr] + bonus);
        b.classList.toggle('up', bonus > 0);
        b.classList.toggle('down', bonus < 0);
      });
    });
  }

  private renderClassTitle(): void {
    this.classScreen.querySelector('.class-title')!.textContent = t('chooseHow', { name: this.classFor });
  }

  /** Who is down there, shown while paused: name, class and traits. */
  setHeroInfo(html: string): void {
    this.heroInfo.innerHTML = html;
  }

  hideAll(): void {
    this.descendButton.hidden = true;
    this.pauseScreen.hidden = true;
    this.closeMap();
  }

  setFirstPerson(on: boolean): void {
    this.firstPerson = on;
    this.viewButton.textContent = t(on ? 'viewFirst' : 'viewTop');
  }

  get mapOpen(): boolean {
    return !this.mapScreen.hidden;
  }

  /** Where the map looks; it follows the hero until dragged away. */
  private mapView: MapView = { cx: 0, cy: 0, zoom: MAP_ZOOM.start };
  private mapFollow = true;

  /** Dragging moves the map, pinching or the wheel zooms it. */
  private bindMapGestures(): void {
    const canvas = this.mapCanvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      const now = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, now);
      if (pointers.size === 1) {
        this.mapFollow = false;
        this.mapView.cx -= (now.x - last.x) / this.mapView.zoom;
        this.mapView.cy -= (now.y - last.y) / this.mapView.zoom;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoomMap(d / pinch, false);
        pinch = d;
      }
      this.renderMap();
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomMap(e.deltaY < 0 ? 1.15 : 1 / 1.15);
      },
      { passive: false },
    );
  }

  private zoomMap(factor: number, redraw = true): void {
    this.mapView.zoom = Math.max(MAP_ZOOM.min, Math.min(MAP_ZOOM.max, this.mapView.zoom * factor));
    if (redraw) this.renderMap();
  }

  /** The legend: every mark the map uses, drawn the same way, with its name. */
  private renderLegend(): void {
    const marks: MapMark[] = ['hero', 'down', 'up', 'camp', 'fountain', 'shallow', 'deep', 'pit', 'chasm', 'bridge', 'rubble'];
    const list = this.mapScreen.querySelector('.map-legend')!;
    list.innerHTML = '';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const mark of marks) {
      const item = document.createElement('li');
      const icon = document.createElement('canvas');
      icon.width = icon.height = 22 * dpr;
      const ctx = icon.getContext('2d')!;
      ctx.scale(dpr, dpr);
      drawMark(ctx, mark, 11, 11, 7);
      item.append(icon, document.createTextNode(t(`mapMark_${mark}` as StringKey)));
      list.append(item);
    }
  }

  /** Opens the map; it keeps redrawing while open, since the game does not stop. */
  openMap(world: World, extras: MapExtras = {}): void {
    this.mapWorld = world;
    this.mapExtras = extras;
    this.mapScreen.hidden = false;
    this.mapFollow = true;
    this.renderLegend();
    this.renderMap();
    window.clearInterval(this.mapTimer);
    this.mapTimer = window.setInterval(() => this.renderMap(), 400);
  }

  closeMap(): void {
    this.mapScreen.hidden = true;
    window.clearInterval(this.mapTimer);
    this.mapWorld = null;
  }

  private renderMap(): void {
    if (!this.mapWorld) return;
    this.mapTitle.textContent = t('mapTitle', { depth: this.mapWorld.depth });
    if (this.mapFollow) {
      this.mapView.cx = this.mapWorld.player.x;
      this.mapView.cy = this.mapWorld.player.y;
    }
    const w = this.mapWorld;
    // Never lose the level entirely off the page.
    this.mapView.cx = Math.max(0, Math.min(w.level.width, this.mapView.cx));
    this.mapView.cy = Math.max(0, Math.min(w.level.height, this.mapView.cy));
    drawMap(this.mapCanvas, w, this.mapExtras, this.mapView, { down: t('mapMark_down'), up: t('mapMark_up') });
  }

  setPaused(paused: boolean): void {
    this.pauseScreen.hidden = !paused;
  }

  private renderDepth(): void {
    this.depthLabel.textContent = `${t('depth')} ${this.depth}`;
  }
}
