/**
 * The settings page: one sheet with everything the player can tune on this device, in
 * sections (game, image, sound, controls, keys, accessibility). Changes apply at once.
 */
import { setVisualStyle, visualStyle, VISUAL_STYLES, type VisualStyle } from '../game/style';
import { getLang, onLangChange, setLang, t, type Lang, type StringKey } from '../i18n/i18n';
import {
  ACTIONS,
  DEFAULT_KEYS,
  onSettings,
  QUALITIES,
  settings,
  supportsUltra,
  updateSettings,
  type Action,
  type ButtonSize,
  type Hand,
  type Quality,
  type Settings,
} from '../settings/settings';

export interface SettingsHooks {
  /** The current view, and switching it. */
  view: () => 'top' | 'first';
  setView: (view: 'top' | 'first') => void;
  /** Called when the page closes. */
  onClose: () => void;
}

/** A key's name as people know it: `KeyW` is W, `ArrowUp` is ↑. */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: '␣', ShiftLeft: 'Shift', ShiftRight: 'Shift ⇧',
    Enter: '⏎', Escape: 'Esc', ControlLeft: 'Ctrl', ControlRight: 'Ctrl ⇧', AltLeft: 'Alt', Tab: 'Tab',
  };
  return names[code] ?? code;
}

export class SettingsScreen {
  private readonly el: HTMLElement;
  private listening: Action | null = null;
  /** While a slider is dragged the page is not redrawn (that would drop the drag). */
  private quiet = false;
  private readonly ultra = supportsUltra();

  constructor(root: HTMLElement, private readonly hooks: SettingsHooks) {
    this.el = document.createElement('section');
    this.el.className = 'screen settings-screen';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    onLangChange(() => this.render());
    onSettings(() => {
      if (!this.quiet) this.render();
    });
    applyPresentation(settings());
    onSettings(applyPresentation);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
    this.listening = null;
    this.hooks.onClose();
  }

  private render(): void {
    if (this.el.hidden) return;
    const s = settings();
    const choice = <T extends string>(name: string, value: T, options: readonly T[], label: (o: T) => string, disabled: (o: T) => boolean = () => false) =>
      `<div class="seg" role="group">${options
        .map((o) => `<button type="button" data-set="${name}" data-value="${o}" class="${o === value ? 'chosen' : ''}" ${disabled(o) ? 'disabled' : ''}>${label(o)}</button>`)
        .join('')}</div>`;
    const slider = (name: string, value: number, min: number, max: number, step: number, shown: string) =>
      `<span class="slider"><input type="range" data-set="${name}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${shown}</output></span>`;
    const toggle = (name: string, on: boolean) => `<button type="button" class="toggle ${on ? 'chosen' : ''}" data-set="${name}" data-value="${on ? '0' : '1'}">${t(on ? 'set_on' : 'set_off')}</button>`;
    const row = (label: StringKey, control: string, note = '') => `<div class="set-row"><span class="set-label">${t(label)}${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const keys = ACTIONS.map(
      (a) => `<div class="key-row"><span>${t(`key_${a}` as StringKey)}</span><button type="button" class="key-bind ${this.listening === a ? 'listening' : ''}" data-bind="${a}">${
        this.listening === a ? t('set_pressKey') : s.keys[a].map(keyName).join(' · ')
      }</button></div>`,
    ).join('');
    this.el.innerHTML = `
      <div class="settings-sheet">
        <header class="settings-head">
          <h2>${t('settings')}</h2>
          <button type="button" class="settings-close" data-close aria-label="×">×</button>
        </header>
        <div class="settings-body">
          <h3>${t('set_game')}</h3>
          ${row('set_view', choice('view', this.hooks.view(), ['top', 'first'] as const, (v) => t(v === 'top' ? 'set_viewTop' : 'set_viewFirst')))}
          ${row('set_lang', choice('lang', getLang(), ['es', 'en'] as const, (l) => (l === 'es' ? 'Español' : 'English')))}
          ${row('styleLabel', choice('style', visualStyle(), VISUAL_STYLES, (v) => t(`style_${v}` as StringKey)))}
          <h3>${t('set_image')}</h3>
          ${row(
            'set_quality',
            choice('quality', s.quality, QUALITIES, (q) => t(`quality_${q}` as StringKey), (q) => q === 'ultra' && !this.ultra),
            t(this.ultra ? 'set_qualityNote' : 'set_qualityNoUltra'),
          )}
          ${row('set_fov', slider('fov', s.fov, 50, 100, 1, `${s.fov}°`))}
          <h3>${t('set_sound')}</h3>
          ${row('set_master', slider('master', s.volume.master, 0, 1, 0.05, pct(s.volume.master)))}
          ${row('set_effects', slider('effects', s.volume.effects, 0, 1, 0.05, pct(s.volume.effects)))}
          ${row('set_ambient', slider('ambient', s.volume.ambient, 0, 1, 0.05, pct(s.volume.ambient)))}
          <h3>${t('set_controls')}</h3>
          ${row('set_hand', choice('hand', s.hand, ['right', 'left'] as const, (h) => t(h === 'right' ? 'set_handRight' : 'set_handLeft')))}
          ${row('set_buttons', choice('buttons', s.buttons, ['small', 'normal', 'large'] as const, (b) => t(`set_size_${b}` as StringKey)))}
          ${row('set_turn', slider('turn', s.turn, 0.4, 2.5, 0.1, `×${s.turn.toFixed(1)}`))}
          <h3>${t('set_keys')}</h3>
          <p class="set-note">${t('set_keysNote')}</p>
          <div class="keys">${keys}</div>
          <button type="button" class="link-button" data-reset-keys>${t('set_resetKeys')}</button>
          <h3>${t('set_access')}</h3>
          ${row('set_text', slider('text', s.text, 0.85, 1.5, 0.05, pct(s.text)))}
          ${row('set_contrast', toggle('contrast', s.contrast))}
          ${row('set_shake', toggle('shake', s.shake))}
          ${row('set_flashes', toggle('flashes', s.flashes))}
        </div>
      </div>`;
  }

  private onClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target === this.el || target.closest('[data-close]')) return this.hide();
    if (target.closest('[data-reset-keys]')) {
      updateSettings((s) => (s.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS))));
      return;
    }
    const bind = target.closest<HTMLElement>('[data-bind]');
    if (bind) {
      this.listening = bind.dataset.bind as Action;
      this.render();
      return;
    }
    const button = target.closest<HTMLButtonElement>('button[data-set]');
    if (!button || button.disabled) return;
    const { set, value } = button.dataset;
    if (set === 'view') this.hooks.setView(value as 'top' | 'first');
    else if (set === 'lang') setLang(value as Lang);
    else if (set === 'style') setVisualStyle(value as VisualStyle);
    else
      updateSettings((s) => {
        if (set === 'quality') s.quality = value as Quality;
        if (set === 'hand') s.hand = value as Hand;
        if (set === 'buttons') s.buttons = value as ButtonSize;
        if (set === 'contrast' || set === 'shake' || set === 'flashes') s[set] = value === '1';
      });
    this.render();
  }

  private onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const set = input.dataset.set;
    if (!set) return;
    const v = Number(input.value);
    this.quiet = true;
    updateSettings((s: Settings) => {
      if (set === 'fov') s.fov = v;
      if (set === 'master' || set === 'effects' || set === 'ambient') s.volume[set] = v;
      if (set === 'turn') s.turn = v;
      if (set === 'text') s.text = v;
    });
    this.quiet = false;
    const out = input.nextElementSibling;
    if (out) out.textContent = set === 'fov' ? `${v}°` : set === 'turn' ? `×${v.toFixed(1)}` : `${Math.round(v * 100)}%`;
  }

  /** While waiting for a key, the next one pressed is bound (Escape cancels). */
  private onKey(e: KeyboardEvent): void {
    if (!this.listening || this.el.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    const action = this.listening;
    this.listening = null;
    if (e.code !== 'Escape') {
      updateSettings((s) => {
        // A key does one thing: it leaves any other action it was bound to.
        for (const a of ACTIONS) if (a !== action) s.keys[a] = s.keys[a].filter((k) => k !== e.code);
        for (const a of ACTIONS) if (s.keys[a].length === 0) s.keys[a] = [...DEFAULT_KEYS[a]].filter((k) => k !== e.code).slice(0, 1);
        s.keys[action] = [e.code];
      });
    }
    this.render();
  }
}

/** Settings that are only presentation: text size, contrast, which hand, button size. */
function applyPresentation(s: Settings): void {
  const body = document.body;
  document.documentElement.style.setProperty('--text-scale', String(s.text));
  body.classList.toggle('high-contrast', s.contrast);
  body.classList.toggle('left-handed', s.hand === 'left');
  body.dataset.buttons = s.buttons;
}
