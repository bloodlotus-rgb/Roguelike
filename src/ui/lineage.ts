import { ageStage, livingMembers, memberById, type ChronicleEntry, type Dynasty, type Member } from '../core/dynasty';
import { traitDef } from '../core/traits';
import { onLangChange, t, type StringKey } from '../i18n/i18n';
import { drawPortrait } from './portrait';
import { traitLife, traitName } from './traitText';

export interface LineageHandlers {
  /** A living member was chosen to go down. */
  onPick: (memberId: number) => void;
  /** Both confirmations passed: the dynasty is to be abandoned. */
  onAbandon: () => void;
}

type Screen = 'roster' | 'chronicle' | 'tree' | 'confirm' | null;

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One line of the chronicle, as a sentence. */
export function chronicleLine(dynasty: Dynasty, entry: ChronicleEntry): string[] {
  const name = (id: number) => memberById(dynasty, id).name;
  switch (entry.type) {
    case 'founded':
      return [t('chr_founded')];
    case 'fell': {
      const member = memberById(dynasty, entry.memberId);
      const cause = entry.cause.type === 'horror' ? (`cause_${entry.cause.kind}` as StringKey) : (`cause_${entry.cause.type}` as StringKey);
      const cls = member.classId ? t(`className_${member.classId}` as StringKey) : '—';
      return [t('chr_fell', { name: member.name, class: cls, depth: entry.depth, cause: t(cause) })];
    }
    case 'born': {
      const lines = [t('chr_born', { name: name(entry.memberId), parent: name(entry.parentId) })];
      for (const i of entry.inherited) {
        lines.push(t('chr_inherited', { name: name(entry.memberId), trait: traitName(i.trait), from: name(i.from) }));
      }
      return lines;
    }
    case 'aged':
      return [t('chr_aged', { name: name(entry.memberId), trait: traitName(entry.trait) })];
    case 'diedOld':
      return [t('chr_diedOld', { name: name(entry.memberId) })];
    case 'acquired':
      return [t('chr_acquired', { name: name(entry.memberId), trait: traitName(entry.trait), depth: entry.depth })];
    case 'campBuilt':
      return [t('chr_campBuilt', { name: name(entry.memberId), depth: entry.depth })];
    case 'campLost':
      return [t(entry.reason === 'night' ? 'chr_campLostNight' : 'chr_campLostTime', { depth: entry.depth })];
  }
}

/**
 * The family's screens, drawn as pages of a register: who goes down next (with portraits),
 * the chronicle, the family tree, and abandoning the dynasty with a double confirmation.
 */
export class LineageUi {
  private readonly el: HTMLElement;
  private dynasty: Dynasty | null = null;
  private screen: Screen = null;
  /** The chronicle shown: everything, or only what one generation brought. */
  private chronicleFrom = 0;
  private chronicleDone: (() => void) | null = null;
  private confirmStep = 0;
  /** Where Back returns to from the chronicle, tree or confirmation. */
  private returnTo: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    private readonly handlers: LineageHandlers,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'screen lineage-screen';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    onLangChange(() => this.render());
  }

  get open(): boolean {
    return this.screen !== null;
  }

  setDynasty(dynasty: Dynasty): void {
    this.dynasty = dynasty;
  }

  showRoster(): void {
    this.show('roster');
  }

  /** Shows the chronicle from `from` on (all of it with 0); `done` runs on Continue. */
  showChronicle(from = 0, done: (() => void) | null = null): void {
    this.chronicleFrom = from;
    this.chronicleDone = done;
    if (!done) this.returnTo = this.currentReturn();
    this.show('chronicle');
  }

  showTree(): void {
    this.returnTo = this.currentReturn();
    this.show('tree');
  }

  /** Starts the double confirmation; `back` runs if the player changes their mind. */
  askAbandon(back: () => void): void {
    this.returnTo = back;
    this.confirmStep = 0;
    this.show('confirm');
  }

  hide(): void {
    this.screen = null;
    this.el.hidden = true;
  }

  private currentReturn(): () => void {
    const screen = this.screen;
    if (screen === 'roster' || screen === null) return () => this.showRoster();
    const back = this.returnTo;
    return back ?? (() => this.showRoster());
  }

  private show(screen: Screen): void {
    this.screen = screen;
    this.el.hidden = false;
    this.render();
    this.el.scrollTop = 0;
  }

  private onClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const act = target.dataset.act;
    if (act === 'pick') this.handlers.onPick(Number(target.dataset.id));
    else if (act === 'chronicle') this.showChronicle();
    else if (act === 'tree') this.showTree();
    else if (act === 'abandon') this.askAbandon(() => this.showRoster());
    else if (act === 'back') (this.returnTo ?? (() => this.showRoster()))();
    else if (act === 'continue') {
      const done = this.chronicleDone;
      this.chronicleDone = null;
      if (done) done();
      else this.showRoster();
    } else if (act === 'confirm') {
      if (this.confirmStep === 0) {
        this.confirmStep = 1;
        this.render();
      } else {
        this.hide();
        this.handlers.onAbandon();
      }
    }
  }

  private render(): void {
    const d = this.dynasty;
    if (!d || !this.screen) return;
    this.el.dataset.screen = this.screen;
    if (this.screen === 'roster') this.renderRoster(d);
    else if (this.screen === 'chronicle') this.renderChronicle(d);
    else if (this.screen === 'tree') this.renderTree(d);
    else this.renderConfirm();
  }

  private renderRoster(d: Dynasty): void {
    this.el.innerHTML = `
      <div class="register">
        <h1 class="game-title">${escape(t('title'))}</h1>
        <p class="register-sub">${escape(t('generation', { n: d.generation }))}</p>
        <div class="register-tabs">
          <button class="paper-button small" type="button" data-act="chronicle">${escape(t('chronicle'))}</button>
          <button class="paper-button small" type="button" data-act="tree">${escape(t('tree'))}</button>
        </div>
        <h2>${escape(t('chooseClass'))}</h2>
        <div class="members"></div>
        <button class="link-button" type="button" data-act="abandon">${escape(t('abandon'))}</button>
      </div>`;
    const list = this.el.querySelector('.members')!;
    for (const m of livingMembers(d)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'member-card';
      card.dataset.act = 'pick';
      card.dataset.id = String(m.id);
      card.appendChild(drawPortrait(d, m, 84));
      const info = document.createElement('div');
      info.className = 'member-info';
      info.innerHTML = `
        <span class="member-name">${escape(m.name)}</span>
        <span class="member-age">${escape(t(`age_${ageStage(d, m)}` as StringKey))}</span>
        ${traitList(m)}`;
      card.appendChild(info);
      list.appendChild(card);
    }
  }

  private renderChronicle(d: Dynasty): void {
    const entries = d.chronicle.slice(this.chronicleFrom);
    let html = '';
    let generation = -1;
    for (const entry of entries) {
      if (entry.generation !== generation && (this.chronicleFrom === 0 || generation === -1)) {
        generation = entry.generation;
        if (this.chronicleFrom === 0) html += `<h3>${escape(t('generation', { n: generation }))}</h3>`;
      }
      for (const line of chronicleLine(d, entry)) html += `<p>${escape(line)}</p>`;
    }
    const partial = this.chronicleFrom > 0;
    this.el.innerHTML = `
      <div class="register chronicle">
        <h2>${escape(partial ? t('generation', { n: d.generation }) : t('chronicleTitle'))}</h2>
        <div class="chronicle-text">${html}</div>
        <button class="paper-button" type="button" data-act="${partial || this.chronicleDone ? 'continue' : 'back'}">
          ${escape(t(partial || this.chronicleDone ? 'continue' : 'back'))}
        </button>
      </div>`;
  }

  private renderTree(d: Dynasty): void {
    const children = (parentId: number | null) => d.members.filter((m) => m.parentId === parentId);
    const node = (m: Member): string => {
      const status =
        m.status === 'fallen'
          ? t('status_fallen', { depth: m.death?.depth ?? 0 })
          : m.status === 'aged'
            ? t('status_aged')
            : `${t('status_alive')} · ${t(`age_${ageStage(d, m)}` as StringKey)}`;
      const kids = children(m.id);
      return `<li>
        <div class="tree-node ${m.status}" data-portrait="${m.id}">
          <span class="tree-name">${escape(m.name)}</span>
          <span class="tree-status">${escape(status)}</span>
        </div>
        ${kids.length ? `<ul>${kids.map(node).join('')}</ul>` : ''}
      </li>`;
    };
    this.el.innerHTML = `
      <div class="register">
        <h2>${escape(t('treeTitle'))}</h2>
        <ul class="tree">
          <li><div class="tree-node founder"><span class="tree-name">${escape(t('founder'))}</span></div>
            <ul>${children(null).map(node).join('')}</ul>
          </li>
        </ul>
        <button class="paper-button" type="button" data-act="back">${escape(t('back'))}</button>
      </div>`;
    this.el.querySelectorAll<HTMLElement>('[data-portrait]').forEach((el) => {
      el.prepend(drawPortrait(d, memberById(d, Number(el.dataset.portrait)), 40));
    });
  }

  private renderConfirm(): void {
    const first = this.confirmStep === 0;
    this.el.innerHTML = `
      <div class="register confirm">
        <p class="confirm-text">${escape(t(first ? 'abandonAsk' : 'abandonAskAgain'))}</p>
        <div class="confirm-buttons">
          <button class="paper-button" type="button" data-act="back">${escape(t('back'))}</button>
          <button class="paper-button danger" type="button" data-act="confirm">${escape(t(first ? 'abandonYes' : 'abandonSure'))}</button>
        </div>
      </div>`;
  }
}

/** A member's traits with what each does in life. */
export function traitList(member: Member): string {
  if (member.traits.length === 0) return `<span class="trait-none">${escape(t('noTraits'))}</span>`;
  return `<ul class="trait-list">${member.traits
    .map((id) => `<li class="trait-${traitDef(id).origin}"><b>${escape(traitName(id))}</b> ${escape(traitLife(id))}</li>`)
    .join('')}</ul>`;
}
