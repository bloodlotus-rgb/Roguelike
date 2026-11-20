import { ATTRIBUTE_IDS } from '../core/attributes';
import { CLASSES, CLASS_IDS, type ClassId } from '../core/classes';
import type { Survival } from '../core/survival';
import { getLang, onLangChange, setLang, t, type StringKey } from '../i18n/i18n';

type Meter = 'health' | 'hunger' | 'thirst' | 'light';
const METERS: Meter[] = ['health', 'hunger', 'thirst', 'light'];

export interface HudHandlers {
  onChooseClass: (classId: ClassId) => void;
  onDescend: () => void;
  onChooseAgain: () => void;
  onResume: () => void;
}

/** HTML overlay on top of the canvas: meters, depth, buttons and screens. */
export class Hud {
  readonly attackButton: HTMLButtonElement;
  readonly dodgeButton: HTMLButtonElement;
  private readonly meterFills = new Map<Meter, HTMLElement>();
  private readonly descendButton: HTMLButtonElement;
  private readonly deathScreen: HTMLElement;
  private readonly pauseScreen: HTMLElement;
  private readonly classScreen: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly depthLabel: HTMLElement;
  private readonly abilityRing: HTMLElement;
  private readonly root: HTMLElement;
  private depth = 1;
  private deathDepth = 1;

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
          <button class="lang" type="button" aria-label="Language"></button>
        </div>
      </header>
      <div class="toasts" aria-live="polite"></div>
      <div class="seed"><span data-i18n="seed"></span>: <span class="seed-value"></span></div>
      <div class="actions">
        <button class="paper-button descend" type="button" data-i18n="descend" hidden></button>
        <button class="action-button dodge" type="button"><span data-i18n="dodge"></span></button>
        <button class="action-button attack" type="button">
          <span class="ability-ring"></span>
          <span data-i18n="attack"></span>
        </button>
      </div>
      <section class="screen pause-screen" hidden>
        <h2 data-i18n="paused"></h2>
        <button class="paper-button resume" type="button" data-i18n="resume"></button>
      </section>
      <section class="screen death-screen" hidden>
        <h2 data-i18n="died"></h2>
        <p class="death-depth"></p>
        <button class="paper-button choose-again" type="button" data-i18n="chooseAgain"></button>
      </section>
      <section class="screen class-screen" hidden>
        <h1 class="game-title" data-i18n="title"></h1>
        <h2 data-i18n="chooseClass"></h2>
        <div class="class-cards">
          ${CLASS_IDS.map(
            (id) => `<button class="class-card" type="button" data-class="${id}">
              <span class="class-name" data-i18n="className_${id}"></span>
              <span class="class-desc" data-i18n="classDesc_${id}"></span>
              <span class="class-ability" data-i18n="abilityDesc_${id}"></span>
              <span class="class-attrs">
                ${ATTRIBUTE_IDS.map(
                  (a) => `<span class="attr"><span data-i18n="attr_${a}"></span> <b>${CLASSES[id].attributes[a]}</b></span>`,
                ).join('')}
              </span>
            </button>`,
          ).join('')}
        </div>
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
    this.abilityRing = root.querySelector('.ability-ring')!;
    this.deathScreen = root.querySelector('.death-screen')!;
    this.pauseScreen = root.querySelector('.pause-screen')!;
    this.classScreen = root.querySelector('.class-screen')!;
    root.querySelector('.seed-value')!.textContent = seed;

    this.descendButton.addEventListener('click', handlers.onDescend);
    root.querySelector('.choose-again')!.addEventListener('click', handlers.onChooseAgain);
    root.querySelector('.resume')!.addEventListener('click', handlers.onResume);
    root.querySelectorAll<HTMLButtonElement>('.class-card').forEach((card) => {
      card.addEventListener('click', () => handlers.onChooseClass(card.dataset.class as ClassId));
    });
    const langButton = root.querySelector<HTMLButtonElement>('.lang')!;
    langButton.addEventListener('click', () => setLang(getLang() === 'es' ? 'en' : 'es'));

    const translate = () => {
      root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n as StringKey);
      });
      langButton.textContent = getLang() === 'es' ? 'EN' : 'ES';
      document.title = t('title');
      this.renderDepth();
      root.querySelector('.death-depth')!.textContent = t('diedDepth', { depth: this.deathDepth });
    };
    onLangChange(translate);
    translate();
  }

  setSurvival(s: Survival, maxHealth: number): void {
    for (const m of METERS) {
      const value = m === 'health' ? (s.health / maxHealth) * 100 : s[m];
      const fill = this.meterFills.get(m)!;
      fill.style.transform = `scaleX(${value / 100})`;
      fill.parentElement!.parentElement!.classList.toggle('low', value < 25);
    }
  }

  /** `ready` from 0 (just used) to 1 (available); `charge` from 0 to 1 while charging, else -1. */
  setAbility(ready: number, charge: number): void {
    const value = charge >= 0 ? charge : ready;
    this.abilityRing.style.setProperty('--fill', `${Math.round(value * 360)}deg`);
    this.abilityRing.classList.toggle('ready', ready >= 1 && charge < 0);
    this.abilityRing.classList.toggle('charging', charge >= 0);
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
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = t(key);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  showClassSelect(show: boolean): void {
    this.classScreen.hidden = !show;
    this.root.classList.toggle('selecting', show);
    this.setPlaying(!show);
  }

  showDeath(depth: number): void {
    this.deathDepth = depth;
    this.deathScreen.querySelector('.death-depth')!.textContent = t('diedDepth', { depth });
    this.deathScreen.hidden = false;
    this.descendButton.hidden = true;
    this.setPlaying(false);
  }

  hideDeath(): void {
    this.deathScreen.hidden = true;
  }

  setPaused(paused: boolean): void {
    this.pauseScreen.hidden = !paused;
  }

  private renderDepth(): void {
    this.depthLabel.textContent = `${t('depth')} ${this.depth}`;
  }
}
