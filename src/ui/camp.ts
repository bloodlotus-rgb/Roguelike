import type { Packed } from '../core/inventory';
import type { World, WorldEvent } from '../core/world';
import { drawItem } from '../game/art';
import { onLangChange, t, type StringKey } from '../i18n/i18n';

export interface CampHandlers {
  /** Things happened by the fire (eating, sleeping...): the session records and announces them. */
  onEvents: (events: WorldEvent[]) => void;
  /** Leave the camp screen; `slept` when the night is over (or broken). */
  onLeave: (slept: boolean) => void;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const pictures = new Map<string, string>();
function picture(kind: Packed['kind']): string {
  let url = pictures.get(kind);
  if (!url) pictures.set(kind, (url = drawItem(kind, 64).toDataURL()));
  return url;
}

/** What can be done by the fire with an item, if anything. */
function actionsFor(item: Packed, world: World): Array<{ act: string; label: StringKey }> {
  switch (item.kind) {
    case 'ration':
    case 'marchRation':
      return [{ act: 'use', label: 'camp_eat' }];
    case 'waterskin':
      if (!item.charges) return [];
      return item.turbid
        ? [
            { act: 'boil', label: 'camp_boil' },
            { act: 'use', label: 'camp_drink' },
          ]
        : [{ act: 'use', label: 'camp_drink' }];
    case 'bandage':
      return [{ act: 'use', label: 'camp_bandage' }];
    case 'mushroom':
    case 'horrorMeat':
      return [{ act: 'use', label: 'camp_cook' }];
    case 'firewood':
      return world.campfire ? [] : [{ act: 'use', label: 'camp_fire' }];
    case 'oil':
      return [{ act: 'use', label: 'camp_oil' }];
    default:
      return [];
  }
}

/** A line about what just happened, from the world's events. */
function describe(events: WorldEvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === 'campUsed') {
      if (e.kind === 'waterskin') lines.push(t('res_drank'));
      else if (e.kind === 'bandage') lines.push(t('res_bandaged'));
      else if (e.kind === 'oil') lines.push(t('res_oil'));
      else lines.push(t('res_eaten'));
      if (e.sick) lines.push(t('res_sick'));
      if (e.poisoned) lines.push(t('res_poisoned'));
      if (e.nightmares) lines.push(t('res_nightmares'));
    } else if (e.type === 'fireLit') lines.push(t('res_fire'));
    else if (e.type === 'needFire') lines.push(t('res_needFire'));
    else if (e.type === 'boiled') lines.push(t('res_boiled'));
    else if (e.type === 'cantUse' && e.reason === 'empty') lines.push(t('toast_empty'));
    else if (e.type === 'noRoom') lines.push(t('toast_noRoom', { item: t(`item_${e.kind}` as StringKey) }));
    else if (e.type === 'cantBuild' && e.reason === 'danger') lines.push(t('toast_cantBuild_danger'));
  }
  return lines.join(' ');
}

/**
 * The camp, as a page by the fire: the state of the hero and the camp, what in the
 * backpack can be eaten, drunk, cooked or burned, and sleeping until dawn.
 */
export class CampUi {
  private readonly el: HTMLElement;
  private world: World | null = null;
  private note = '';

  constructor(
    root: HTMLElement,
    private readonly handlers: CampHandlers,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'screen camp-screen';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    onLangChange(() => this.render());
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(world: World): void {
    this.world = world;
    this.note = '';
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
    this.world = null;
  }

  private onClick(e: MouseEvent): void {
    const world = this.world;
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!world || !button) return;
    const act = button.dataset.act;
    if (act === 'leave') {
      this.hide();
      this.handlers.onLeave(false);
      return;
    }
    if (act === 'pack') {
      const events = world.packCamp();
      this.handlers.onEvents(events);
      if (events.some((e) => e.type === 'campPacked')) {
        this.hide();
        this.handlers.onLeave(false);
        return;
      }
      this.note = describe(events);
      this.render();
      return;
    }
    if (act === 'sleep') {
      const events = world.sleep();
      this.hide();
      this.handlers.onEvents(events);
      this.handlers.onLeave(true);
      return;
    }
    const uid = Number(button.dataset.uid);
    const events = act === 'boil' ? world.campBoil(uid) : world.campUse(uid);
    this.note = describe(events);
    this.handlers.onEvents(events);
    this.render();
  }

  private render(): void {
    const world = this.world;
    if (!world) return;
    const camp = world.campInReach;
    const s = world.survival;
    const rows = world.inventory.items
      .map((item) => {
        const acts = actionsFor(item, world);
        if (acts.length === 0) return '';
        const extra: string[] = [];
        if ((item.count ?? 1) > 1) extra.push(`×${item.count}`);
        if (item.kind === 'waterskin') extra.push(t('sips', { n: item.charges ?? 0 }) + (item.turbid ? ` · ${t('turbid')}` : ''));
        if (item.kind === 'mushroom' && item.poison && world.knowsMushrooms) extra.push(t('poisonous'));
        return `<li class="camp-item">
          <img src="${picture(item.kind)}" alt="">
          <span class="camp-item-name">${escape(t(`item_${item.kind}` as StringKey))}${extra.length ? ` <i>${escape(extra.join(' · '))}</i>` : ''}</span>
          <span class="camp-item-acts">${acts
            .map((a) => `<button type="button" class="paper-button small" data-act="${a.act}" data-uid="${item.uid}">${escape(t(a.label))}</button>`)
            .join('')}</span>
        </li>`;
      })
      .join('');
    const meter = (key: StringKey, value: number, max = 100) =>
      `<span class="camp-meter"><span>${escape(t(key))}</span><span class="camp-bar"><span style="transform:scaleX(${Math.max(0, Math.min(1, value / max))})"></span></span></span>`;
    this.el.innerHTML = `
      <div class="register camp-page">
        <h2>${escape(t('camp'))}</h2>
        <p class="camp-sub">${escape(t('day', { n: world.day }))} · ${escape(t(world.isNight ? 'night' : 'daytime'))} · ${escape(t(world.campfire ? 'fireOn' : 'fireOff'))}</p>
        <div class="camp-meters">
          ${meter('health', s.health, world.maxHealth)}${meter('hunger', s.hunger)}${meter('thirst', s.thirst)}${meter('light', s.light)}
        </div>
        ${camp ? `<p class="camp-sub">${escape(t('camp_condition', { n: Math.max(0, Math.round(camp.condition)) }))}</p>` : ''}
        <ul class="camp-items">${rows || `<li class="camp-empty">${escape(t('camp_nothing'))}</li>`}</ul>
        <p class="camp-note">${escape(this.note)}</p>
        <div class="confirm-buttons">
          <button type="button" class="paper-button" data-act="leave">${escape(t('camp_leave'))}</button>
          <button type="button" class="paper-button" data-act="pack">${escape(t('camp_pack'))}</button>
          <button type="button" class="paper-button danger" data-act="sleep">${escape(t('camp_sleep'))}</button>
        </div>
      </div>`;
  }
}
