import { ATTRIBUTE_IDS, type Attributes } from '../core/attributes';
import { CLASSES, CLASS_IDS, type ClassId } from '../core/classes';
import type { Survival } from '../core/survival';
import type { World } from '../core/world';
import { drawMap, type MapExtras } from './map';
import { getLang, onLangChange, setLang, t, type StringKey } from '../i18n/i18n';

type Meter = 'health' | 'hunger' | 'thirst' | 'light';
const METERS: Meter[] = ['health', 'hunger', 'thirst', 'light'];

export interface HudHandlers {
  onChooseClass: (classId: ClassId) => void;
  /** Back from choosing a class to choosing who goes down. */
  onClassBack: () => void;
  onDescend: () => void;
  onResume: () => void;
  onAbandon: () => void;
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
          <button class="map-button" type="button" data-i18n="map"></button>
          <button class="view-button map-button" type="button"></button>
          <div class="hud-toggles">
            <button class="sound" type="button" aria-label="Sound"></button>
            <button class="lang" type="button" aria-label="Language"></button>
          </div>
        </div>
      </header>
      <div class="toasts" aria-live="polite"></div>
      <div class="seed"><span data-i18n="seed"></span>: <span class="seed-value"></span></div>
      <div class="actions">
        <button class="paper-button descend" type="button" data-i18n="descend" hidden></button>
        <button class="action-button special" type="button">
          <span class="special-ring"></span>
          <span data-i18n="special"></span>
        </button>
        <button class="action-button dodge" type="button"><span data-i18n="dodge"></span></button>
        <button class="action-button attack" type="button"><span data-i18n="attack"></span></button>
      </div>
      <section class="map-screen" hidden>
        <div class="map-sheet">
          <h2 class="map-title"></h2>
          <canvas class="map-canvas"></canvas>
          <p class="map-hint" data-i18n="mapHint"></p>
        </div>
      </section>
      <section class="screen pause-screen" hidden>
        <h2 data-i18n="paused"></h2>
        <div class="hero-info"></div>
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
    this.pauseScreen = root.querySelector('.pause-screen')!;
    this.classScreen = root.querySelector('.class-screen')!;
    this.mapScreen = root.querySelector('.map-screen')!;
    this.mapCanvas = root.querySelector('.map-canvas')!;
    this.mapTitle = root.querySelector('.map-title')!;
    root.querySelector('.map-button:not(.view-button)')!.addEventListener('click', handlers.onOpenMap);
    this.viewButton = root.querySelector('.view-button')!;
    this.viewButton.addEventListener('click', handlers.onToggleView);
    this.mapScreen.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.closeMap();
    });
    root.querySelector('.seed-value')!.textContent = seed;

    this.descendButton.addEventListener('click', handlers.onDescend);
    root.querySelector('.resume')!.addEventListener('click', handlers.onResume);
    root.querySelector('.abandon')!.addEventListener('click', handlers.onAbandon);
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

  setStairsAvailable(available: boolean): void {
    this.descendButton.hidden = !available;
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

  /** Opens the map; it keeps redrawing while open, since the game does not stop. */
  openMap(world: World, extras: MapExtras = {}): void {
    this.mapWorld = world;
    this.mapExtras = extras;
    this.mapScreen.hidden = false;
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
    drawMap(this.mapCanvas, this.mapWorld, this.mapExtras);
  }

  setPaused(paused: boolean): void {
    this.pauseScreen.hidden = !paused;
  }

  private renderDepth(): void {
    this.depthLabel.textContent = `${t('depth')} ${this.depth}`;
  }
}
