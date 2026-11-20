import { CONFIG } from '../core/config';
import type { ItemKind } from '../core/inventory';
import type { World, WorldEvent } from '../core/world';
import { drawItem } from '../game/art';
import { onLangChange, t, type StringKey } from '../i18n/i18n';
import { BackpackUi } from './backpack';

export interface MansionHandlers {
  /** A night of sleep at home: the world changes below, the session announces it. */
  onRest: (events: WorldEvent[]) => void;
  /** Back down the stairs into the dungeon. */
  onDescend: () => void;
  /** Anything bought or thrown away: worth saving. */
  onChange: () => void;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const pictures = new Map<string, string>();
function picture(kind: ItemKind): string {
  let url = pictures.get(kind);
  if (!url) pictures.set(kind, (url = drawItem(kind, 64).toDataURL()));
  return url;
}

/**
 * The family's house above the dungeon: where every life sets out from and where a hero
 * can climb back to sleep safely and buy supplies with the gold they found.
 */
export class MansionUi {
  private readonly el: HTMLElement;
  private readonly page: HTMLElement;
  private readonly backpack: BackpackUi;
  private world: World | null = null;
  private heroName = '';
  private note = '';

  constructor(
    root: HTMLElement,
    private readonly handlers: MansionHandlers,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'screen mansion-screen';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="register mansion-page"><div class="mansion-top"></div><div class="mansion-pack"></div><div class="mansion-bottom"></div></div>`;
    root.appendChild(this.el);
    this.page = this.el.querySelector('.mansion-page')!;
    this.backpack = new BackpackUi(this.el.querySelector('.mansion-pack')!, {
      // Nothing to use up here: the house feeds you when you rest.
      onUse: () => {},
      onDrop: (uid) => {
        this.world?.discardItem(uid);
        this.handlers.onChange();
        this.render();
      },
    });
    this.el.addEventListener('click', (e) => this.onClick(e));
    onLangChange(() => this.render());
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(world: World, heroName: string): void {
    this.world = world;
    this.heroName = heroName;
    this.note = '';
    this.el.hidden = false;
    this.render();
    this.el.scrollTop = 0;
  }

  hide(): void {
    this.el.hidden = true;
  }

  private onClick(e: MouseEvent): void {
    const world = this.world;
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!world || !button || !this.page.contains(button) || button.closest('.mansion-pack')) return;
    const act = button.dataset.act;
    if (act === 'descend') {
      this.hide();
      this.handlers.onDescend();
      return;
    }
    if (act === 'rest') {
      this.handlers.onRest(world.restAtMansion());
      this.note = t('mansion_rested');
    } else if (act === 'buy') {
      const kind = button.dataset.kind as ItemKind;
      const result = world.buy(kind);
      this.note = result === 'bought' ? t('mansion_bought', { item: t(`item_${kind}` as StringKey) }) : t(result === 'gold' ? 'mansion_noGold' : 'mansion_noRoom');
      this.handlers.onChange();
    }
    this.render();
  }

  private render(): void {
    const world = this.world;
    if (!world || this.el.hidden) return;
    const shop = (Object.entries(CONFIG.shop) as Array<[ItemKind, number]>)
      .map(
        ([kind, price]) => `<li class="camp-item">
          <img src="${picture(kind)}" alt="">
          <span class="camp-item-name">${escape(t(`item_${kind}` as StringKey))} <i>${price} ${escape(t('gold').toLowerCase())}</i></span>
          <span class="camp-item-acts"><button type="button" class="paper-button small" data-act="buy" data-kind="${kind}" ${world.gold < price ? 'disabled' : ''}>${escape(t('mansion_buy'))}</button></span>
        </li>`,
      )
      .join('');
    this.page.querySelector('.mansion-top')!.innerHTML = `
      <h2>${escape(t('mansion'))}</h2>
      <p class="camp-sub">${escape(this.heroName)} · ${escape(t('day', { n: world.day }))}</p>
      <p class="mansion-text">${escape(t('mansion_text'))}</p>
      <h3 class="mansion-h">${escape(t('mansion_shop'))} · ${escape(t('gold'))}: ${world.gold}</h3>
      <ul class="camp-items">${shop}</ul>`;
    this.page.querySelector('.mansion-bottom')!.innerHTML = `
      <p class="camp-note">${escape(this.note)}</p>
      <div class="confirm-buttons">
        <button type="button" class="paper-button" data-act="rest">${escape(t('mansion_rest'))}</button>
        <button type="button" class="paper-button danger" data-act="descend">${escape(t('mansion_descend'))}</button>
      </div>`;
    this.backpack.show(world.inventory, world.gold, world.knowsMushrooms);
  }
}
