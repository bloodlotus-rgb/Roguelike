import type { Survival } from '../core/survival';
import { getLang, onLangChange, setLang, t, type StringKey } from '../i18n/i18n';

type Meter = 'health' | 'hunger' | 'thirst' | 'light';
const METERS: Meter[] = ['health', 'hunger', 'thirst', 'light'];

export interface HudHandlers {
  onDescend: () => void;
  onRestart: () => void;
  onResume: () => void;
}

/** HTML overlay on top of the canvas: meters, depth, contextual buttons and screens. */
export class Hud {
  private readonly meterFills = new Map<Meter, HTMLElement>();
  private readonly descendButton: HTMLButtonElement;
  private readonly deathScreen: HTMLElement;
  private readonly pauseScreen: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly depthLabel: HTMLElement;
  private depth = 1;
  private deathDepth = 1;

  constructor(root: HTMLElement, seed: string, handlers: HudHandlers) {
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
      <button class="descend paper-button" type="button" data-i18n="descend" hidden></button>
      <section class="screen pause-screen" hidden>
        <h2 data-i18n="paused"></h2>
        <button class="paper-button resume" type="button" data-i18n="resume"></button>
      </section>
      <section class="screen death-screen" hidden>
        <h2 data-i18n="died"></h2>
        <p class="death-depth"></p>
        <button class="paper-button restart" type="button" data-i18n="tryAgain"></button>
      </section>
    `;

    for (const m of METERS) {
      this.meterFills.set(m, root.querySelector<HTMLElement>(`.meter-${m} .meter-fill`)!);
    }
    this.depthLabel = root.querySelector('.depth')!;
    this.toasts = root.querySelector('.toasts')!;
    this.descendButton = root.querySelector('.descend')!;
    this.deathScreen = root.querySelector('.death-screen')!;
    this.pauseScreen = root.querySelector('.pause-screen')!;
    root.querySelector('.seed-value')!.textContent = seed;

    this.descendButton.addEventListener('click', handlers.onDescend);
    root.querySelector('.restart')!.addEventListener('click', handlers.onRestart);
    root.querySelector('.resume')!.addEventListener('click', handlers.onResume);
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

  setSurvival(s: Survival): void {
    for (const m of METERS) {
      const value = s[m];
      const fill = this.meterFills.get(m)!;
      fill.style.transform = `scaleX(${value / 100})`;
      fill.parentElement!.parentElement!.classList.toggle('low', value < 25);
    }
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.renderDepth();
  }

  setStairsAvailable(available: boolean): void {
    this.descendButton.hidden = !available;
  }

  toast(key: StringKey): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = t(key);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  showDeath(depth: number): void {
    this.deathDepth = depth;
    this.deathScreen.querySelector('.death-depth')!.textContent = t('diedDepth', { depth });
    this.deathScreen.hidden = false;
    this.descendButton.hidden = true;
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
