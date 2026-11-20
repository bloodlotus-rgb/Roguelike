import { footprint, itemAt, moveItem, turnItem, type Inventory, type Packed } from '../core/inventory';
import { drawItem } from '../game/art';
import { t, type StringKey } from '../i18n/i18n';

const CELL = 46;

export interface BackpackHandlers {
  /** Use an item: the game resumes and the hero eats, drinks or fills the lamp. */
  onUse: (uid: number) => void;
  /** Drop an item where the hero stands. */
  onDrop: (uid: number) => void;
}

const pictures = new Map<string, string>();

function picture(kind: Packed['kind']): string {
  let url = pictures.get(kind);
  if (!url) {
    url = drawItem(kind, 64).toDataURL();
    pictures.set(kind, url);
  }
  return url;
}

/**
 * The backpack as a grid of cells on the pause screen. Tap an item to choose it (use, turn,
 * drop); with an item chosen, tap a free cell to move it there.
 */
export class BackpackUi {
  private readonly el: HTMLElement;
  private inventory: Inventory | null = null;
  private selected: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: BackpackHandlers,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'backpack';
    parent.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  show(inventory: Inventory, gold: number): void {
    this.inventory = inventory;
    this.selected = null;
    this.gold = gold;
    this.render();
  }

  private gold = 0;

  private onClick(e: MouseEvent): void {
    const inv = this.inventory;
    if (!inv) return;
    const target = e.target as HTMLElement;
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act && this.selected !== null) {
      const uid = this.selected;
      if (act === 'use') this.handlers.onUse(uid);
      else if (act === 'drop') {
        this.handlers.onDrop(uid);
        this.selected = null;
      } else if (act === 'turn') turnItem(inv, uid);
      this.render();
      return;
    }
    const grid = this.el.querySelector<HTMLElement>('.pack-grid');
    if (!grid || !grid.contains(target)) return;
    const rect = grid.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);
    const item = itemAt(inv, x, y);
    if (item) this.selected = this.selected === item.uid ? null : item.uid;
    else if (this.selected !== null) {
      const moving = inv.items.find((it) => it.uid === this.selected);
      if (moving) moveItem(inv, moving.uid, x, y, moving.turned);
    }
    this.render();
  }

  private render(): void {
    const inv = this.inventory;
    if (!inv) return;
    const chosen = inv.items.find((it) => it.uid === this.selected) ?? null;
    const cells = Array.from({ length: inv.cols * inv.rows }, (_, i) => `<span class="pack-cell" data-cell="${i}"></span>`).join('');
    const items = inv.items
      .map((it) => {
        const { w, h } = footprint(it.kind, it.turned);
        const sips = it.kind === 'waterskin' ? `<span class="pack-sips">${it.charges ?? 0}</span>` : '';
        // The picture is drawn upright; a turned item is rotated a quarter turn.
        const img = it.turned
          ? `<img src="${picture(it.kind)}" alt="" style="width:${h * CELL - 8}px;height:${w * CELL - 8}px;transform:rotate(90deg)">`
          : `<img src="${picture(it.kind)}" alt="" style="width:${w * CELL - 8}px;height:${h * CELL - 8}px">`;
        return `<span class="pack-item${it.uid === this.selected ? ' chosen' : ''}" style="left:${it.x * CELL}px;top:${it.y * CELL}px;width:${w * CELL}px;height:${h * CELL}px">${img}${sips}</span>`;
      })
      .join('');
    const detail = chosen
      ? `<div class="pack-detail">
          <b>${t(`item_${chosen.kind}` as StringKey)}</b>
          <span>${t(`itemDesc_${chosen.kind}` as StringKey)}${chosen.kind === 'waterskin' ? ` (${t('sips', { n: chosen.charges ?? 0 })})` : ''}</span>
          <span class="pack-actions">
            <button type="button" class="paper-button small" data-act="use">${t('act_use')}</button>
            <button type="button" class="paper-button small" data-act="turn">${t('act_turn')}</button>
            <button type="button" class="paper-button small" data-act="drop">${t('act_drop')}</button>
          </span>
        </div>`
      : `<p class="pack-hint">${t('backpackHint')}</p>`;
    this.el.innerHTML = `
      <div class="pack-head"><span>${t('backpack')}</span><span>${t('gold')}: <b>${this.gold}</b></span></div>
      <div class="pack-grid" style="width:${inv.cols * CELL}px;height:${inv.rows * CELL}px;grid-template-columns:repeat(${inv.cols}, ${CELL}px)">${cells}${items}</div>
      ${detail}`;
  }
}
