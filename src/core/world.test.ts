import { describe, expect, it } from 'vitest';
import { maxHealth } from './attributes';
import { CLASSES, type ClassId } from './classes';
import { isFloor } from './dungeon';
import { ENEMIES, type EnemyKind } from './enemies';
import { COMBAT, NO_INPUT, World, type ControlInput, type Enemy, type WorldEvent } from './world';

const input = (partial: Partial<ControlInput> = {}): ControlInput => ({ ...NO_INPUT, ...partial });
const move = (x: number, y: number) => input({ move: { x, y } });

/** A world with no horrors except the ones a test places next to the player. */
function arena(classId: ClassId = 'headsman'): World {
  const world = new World('estirpe', classId);
  world.enemies = [];
  world.update(0.016, NO_INPUT);
  return world;
}

function place(world: World, kind: EnemyKind, dx: number, dy: number, state: Enemy['state'] = 'chase'): Enemy {
  const enemy: Enemy = {
    id: 1000 + world.enemies.length,
    kind,
    def: ENEMIES[kind],
    pos: { x: world.player.x + dx, y: world.player.y + dy },
    health: ENEMIES[kind].health,
    state,
    timer: state === 'idle' ? 10 : 0,
    alerted: state !== 'idle',
    forgetTimer: 0,
    facing: { x: -Math.sign(dx) || 1, y: 0 },
    strikeDir: { x: -Math.sign(dx) || 1, y: 0 },
    room: 0,
    roamer: false,
    wanderTarget: null,
    roamField: null,
    roamRoom: 0,
    flank: 0,
    visible: true,
    watching: false,
    wax: 0,
    waxTick: 0,
    bleed: 0,
    bleedTick: 0,
  };
  world.enemies.push(enemy);
  return enemy;
}

function run(world: World, seconds: number, controls: ControlInput = NO_INPUT): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += 0.02) events.push(...world.update(0.02, controls));
  return events;
}

/** Presses a button for one frame and releases it on the next. */
function tap(world: World, button: 'attack' | 'dodge' | 'special'): WorldEvent[] {
  return [...world.update(0.02, input({ [button]: true })), ...world.update(0.02, NO_INPUT)];
}

function windupAgainst(world: World, kind: EnemyKind, timer = 0.1): Enemy {
  const enemy = place(world, kind, 0.7, 0);
  enemy.state = 'windup';
  enemy.timer = timer;
  enemy.strikeDir = { x: -1, y: 0 };
  return enemy;
}

describe('World basics', () => {
  it('reveals the tiles around the start', () => {
    const world = new World('estirpe');
    world.update(0.016, NO_INPUT);
    const start = world.level.start;
    expect(world.explored[start.y * world.level.width + start.x]).toBe(1);
  });

  it('never walks through walls', () => {
    const world = new World('estirpe');
    world.enemies = [];
    for (let i = 0; i < 2000; i++) {
      world.update(0.05, move(Math.cos(i / 50), Math.sin(i / 37)));
      world.survival = { ...world.survival, hunger: 100, thirst: 100, light: 100 };
      expect(isFloor(world.level, Math.floor(world.player.x), Math.floor(world.player.y))).toBe(true);
    }
  });

  it('dies when hunger and thirst run out', () => {
    const world = arena();
    world.survival = { health: 5, hunger: 0, thirst: 0, light: 50 };
    const events = world.update(1, NO_INPUT);
    expect(events.some((e) => e.type === 'died')).toBe(true);
    expect(world.dead).toBe(true);
  });

  it('keeps the meters when going down', () => {
    const world = new World('estirpe');
    world.survival = { health: 70, hunger: 40, thirst: 30, light: 20 };
    world.descend();
    expect(world.depth).toBe(2);
    expect(world.survival).toEqual({ health: 70, hunger: 40, thirst: 30, light: 20 });
  });

  it('derives maximum health from vigor', () => {
    expect(new World('s', 'headsman').maxHealth).toBe(maxHealth(CLASSES.headsman.attributes));
    expect(new World('s', 'headsman').maxHealth).toBeGreaterThan(new World('s', 'plunderer').maxHealth);
  });
});

describe('horror spawns', () => {
  it('places horrors on floor, away from the starting room', () => {
    const world = new World('estirpe', 'headsman', 0, 3);
    expect(world.enemies.length).toBeGreaterThan(4);
    const start = world.level.rooms[0];
    for (const enemy of world.enemies) {
      expect(isFloor(world.level, Math.floor(enemy.pos.x), Math.floor(enemy.pos.y))).toBe(true);
      const inStart =
        enemy.pos.x >= start.x && enemy.pos.x < start.x + start.w && enemy.pos.y >= start.y && enemy.pos.y < start.y + start.h;
      expect(inStart).toBe(false);
    }
  });

  it('is the same for the same life and re-rolled for the next one', () => {
    const kinds = (w: World) => w.enemies.map((e) => `${e.kind}@${e.pos.x},${e.pos.y}`);
    expect(kinds(new World('estirpe', 'headsman', 0))).toEqual(kinds(new World('estirpe', 'headsman', 0)));
    expect(kinds(new World('estirpe', 'headsman', 0))).not.toEqual(kinds(new World('estirpe', 'headsman', 1)));
    expect(new World('estirpe', 'headsman', 0).level.tiles).toEqual(new World('estirpe', 'headsman', 1).level.tiles);
  });

  it('lets roamers walk to other rooms', () => {
    // Find a level with at least one roamer.
    let world = new World('estirpe', 'headsman', 0, 1);
    for (let depth = 2; depth < 12 && !world.enemies.some((e) => e.roamer); depth++) {
      world = new World('estirpe', 'headsman', 0, depth);
    }
    const roamer = world.enemies.find((e) => e.roamer);
    expect(roamer).toBeDefined();
    world.enemies = [roamer!];
    // Park the player far away and in the dark so it never notices.
    world.survival = { ...world.survival, light: 0 };
    const start = { ...roamer!.pos };
    let farthest = 0;
    for (let i = 0; i < 1500; i++) {
      world.update(0.05, NO_INPUT);
      world.survival = { ...world.survival, health: world.maxHealth, hunger: 100, thirst: 100, light: 0 };
      roamer!.alerted = false;
      if (roamer!.state !== 'idle') roamer!.state = 'idle';
      farthest = Math.max(farthest, Math.hypot(roamer!.pos.x - start.x, roamer!.pos.y - start.y));
    }
    expect(farthest).toBeGreaterThan(6);
  });
});

describe('player attacks', () => {
  it('hits a horror in front and spends thirst', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1, 0, 'idle');
    const thirst = world.survival.thirst;
    const events = [...tap(world, 'attack'), ...run(world, 0.4)];
    expect(events.some((e) => e.type === 'enemyHit' && e.id === enemy.id)).toBe(true);
    expect(enemy.health).toBeLessThan(ENEMIES.husk.health);
    expect(world.survival.thirst).toBeLessThan(thirst);
  });

  it('does not hit a horror behind when another one is in front', () => {
    const world = arena('plunderer');
    world.facing = { x: 1, y: 0 };
    const front = place(world, 'husk', 0.8, 0, 'idle');
    const back = place(world, 'husk', -0.8, 0, 'idle');
    run(world, 0.1);
    tap(world, 'attack');
    run(world, 0.3);
    expect(front.health).toBeLessThan(ENEMIES.husk.health);
    expect(back.health).toBe(ENEMIES.husk.health);
  });

  it('triples the plunderer damage against an unaware horror', () => {
    const world = arena('plunderer');
    world.survival = { ...world.survival, light: 0 };
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1.05, 0, 'idle');
    enemy.alerted = false;
    enemy.facing = { x: 1, y: 0 };
    const events = [...tap(world, 'attack'), ...run(world, 0.2)];
    const hit = events.find((e) => e.type === 'enemyHit');
    expect(hit && hit.type === 'enemyHit' && hit.damage).toBeGreaterThanOrEqual(CLASSES.plunderer.weapon.damage * 2);
  });

  it('ends the headsman combo with a stunning overhead blow', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1.2, 0, 'idle');
    enemy.health = 999;
    const finishers: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      for (const e of tap(world, 'attack')) if (e.type === 'attack') finishers.push(e.finisher);
      run(world, 0.75);
      enemy.pos = { x: world.player.x + 1.2, y: world.player.y };
    }
    expect(finishers).toEqual([false, false, true]);
    expect(enemy.state).toBe('stunned');
  });

  it('chains a blow pressed during the previous swing', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const attacks = () => events.filter((e) => e.type === 'attack').length;
    const events: WorldEvent[] = [];
    events.push(...tap(world, 'attack'));
    events.push(...run(world, 0.3));
    // Still recovering: this press is remembered instead of lost.
    events.push(...tap(world, 'attack'));
    events.push(...run(world, 0.6));
    expect(attacks()).toBe(2);
  });

  it('restarts the combo after a pause', () => {
    const world = arena('headsman');
    tap(world, 'attack');
    run(world, 0.8);
    run(world, CLASSES.headsman.weapon.comboWindow + 0.2);
    expect(world.comboIndex).toBe(0);
  });

  it('leaves burning wax on horrors hit by the candlebearer', () => {
    const world = arena('candlebearer');
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1, 0, 'idle');
    tap(world, 'attack');
    run(world, 0.3);
    expect(enemy.wax).toBeGreaterThan(0);
    const before = enemy.health;
    enemy.pos = { x: world.player.x + 30, y: world.player.y };
    run(world, 2);
    expect(enemy.health).toBeLessThan(before);
    expect(enemy.visible).toBe(true);
  });
});

describe('parry', () => {
  it('negates a melee hit, stuns the horror and grants a critical riposte', () => {
    const world = arena('headsman');
    const enemy = windupAgainst(world, 'crawler');
    enemy.health = 999;
    const health = world.survival.health;
    const events = [...tap(world, 'attack'), ...run(world, 0.1)];
    expect(events.some((e) => e.type === 'parry')).toBe(true);
    expect(world.survival.health).toBe(health);
    expect(enemy.state).toBe('stunned');
  });

  it('fails when the press is too early', () => {
    const world = arena('plunderer');
    const enemy = windupAgainst(world, 'crawler', 0.6);
    enemy.health = 999;
    const health = world.survival.health;
    tap(world, 'attack');
    run(world, 0.7);
    expect(world.survival.health).toBeLessThan(health);
  });

  it('cannot stop the husk', () => {
    const world = arena('plunderer');
    windupAgainst(world, 'husk');
    const health = world.survival.health;
    const events = [...tap(world, 'attack'), ...run(world, 0.1)];
    expect(events.some((e) => e.type === 'parry')).toBe(false);
    expect(world.survival.health).toBeLessThan(health);
  });
});

describe('first-person aim', () => {
  it('faces where the camera looks, even when walking backwards', () => {
    const world = arena('headsman');
    world.update(0.02, input({ move: { x: -1, y: 0 }, aim: { x: 1, y: 0 } }));
    expect(world.facing.x).toBeCloseTo(1);
  });
});

describe('dodge and running', () => {
  it('avoids a hit while invulnerable and has a cooldown', () => {
    const world = arena('headsman');
    const enemy = place(world, 'husk', 0.9, 0);
    enemy.state = 'windup';
    enemy.timer = 0.05;
    enemy.strikeDir = { x: -1, y: 0 };
    const health = world.survival.health;
    world.update(0.02, input({ move: { x: 0, y: 1 }, dodge: true }));
    run(world, 0.1, move(0, 1));
    expect(world.survival.health).toBe(health);
    expect(world.dodgeCooldown).toBeGreaterThan(0);
  });

  it('runs while dodge is held after the roll, spending thirst and hunger', () => {
    const walker = arena('headsman');
    const runner = arena('headsman');
    run(walker, 2, move(1, 0));
    run(runner, 2, input({ move: { x: 1, y: 0 }, dodge: true }));
    expect(runner.running).toBe(true);
    expect(runner.survival.thirst).toBeLessThan(walker.survival.thirst - 2);
    expect(runner.survival.hunger).toBeLessThan(walker.survival.hunger);
  });

  it('makes noise: running is heard from behind', () => {
    const world = arena('headsman');
    world.survival = { ...world.survival, light: 0 };
    const enemy = place(world, 'crawler', 2, 0, 'idle');
    enemy.alerted = false;
    enemy.facing = { x: 1, y: 0 };
    run(world, 0.1);
    expect(enemy.alerted).toBe(false);
    // Hold dodge while moving sideways: roll first, then run past it.
    run(world, 0.6, input({ move: { x: 0, y: 1 }, dodge: true }));
    expect(world.running).toBe(true);
    expect(Math.hypot(enemy.pos.x - world.player.x, enemy.pos.y - world.player.y)).toBeGreaterThan(COMBAT.hearing);
    expect(enemy.alerted).toBe(true);
  });
});

describe('specials', () => {
  it('does nothing until the special is charged', () => {
    const world = arena('plunderer');
    const events = tap(world, 'special');
    expect(events.some((e) => e.type === 'special')).toBe(false);
    expect(world.invisible).toBe(false);
  });

  it('fills the headsman fury by hitting and by being hit', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1.2, 0, 'idle');
    enemy.health = 999;
    tap(world, 'attack');
    run(world, 0.4);
    const afterHit = world.specialCharge;
    expect(afterHit).toBeCloseTo(CLASSES.headsman.charge.perHitDealt);
    run(world, 5);
    expect(world.specialCharge).toBeGreaterThan(afterHit);
  });

  it('executes a stunned horror outright', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1.2, 0);
    enemy.health = 500;
    enemy.state = 'stunned';
    enemy.timer = 5;
    world.specialCharge = 1;
    const events = [...tap(world, 'special'), ...run(world, 0.5)];
    expect(events.some((e) => e.type === 'enemyDied')).toBe(true);
    expect(world.specialCharge).toBe(0);
  });

  it('keeps the charge when there is nobody to execute', () => {
    const world = arena('headsman');
    world.specialCharge = 1;
    tap(world, 'special');
    expect(world.specialCharge).toBe(1);
  });

  it('turns the plunderer invisible and makes horrors forget him', () => {
    const world = arena('plunderer');
    const enemy = place(world, 'crawler', 3, 0);
    world.specialCharge = 1;
    tap(world, 'special');
    expect(world.invisible).toBe(true);
    expect(enemy.alerted).toBe(false);
  });

  it('charges the plunderer special fast with backstabs', () => {
    const world = arena('plunderer');
    world.survival = { ...world.survival, light: 0 };
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1.05, 0, 'idle');
    enemy.alerted = false;
    enemy.facing = { x: 1, y: 0 };
    tap(world, 'attack');
    run(world, 0.1);
    expect(world.specialCharge).toBeGreaterThan(CLASSES.plunderer.charge.perBackstab - 0.01);
  });

  it('burns light for the flare, scares horrors and hurts waxed ones twice as much', () => {
    const world = arena('candlebearer');
    const plain = place(world, 'husk', 1.5, 0);
    const waxed = place(world, 'husk', -1.5, 0);
    waxed.wax = 5;
    waxed.waxTick = 10;
    world.specialCharge = 1;
    const light = world.survival.light;
    tap(world, 'special');
    expect(world.survival.light).toBeLessThan(light - 10);
    expect(plain.state).toBe('flee');
    expect(ENEMIES.husk.health - waxed.health).toBeGreaterThan((ENEMIES.husk.health - plain.health) * 1.8);
  });
});

describe('passives', () => {
  it('heals the headsman when he kills', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    world.survival = { ...world.survival, health: 50 };
    const enemy = place(world, 'crawler', 1, 0, 'idle');
    enemy.health = 1;
    const events = [...tap(world, 'attack'), ...run(world, 0.3)];
    expect(events.some((e) => e.type === 'heal')).toBe(true);
    expect(world.survival.health).toBeGreaterThan(50);
  });

  it('gives the plunderer item sight', () => {
    expect(arena('plunderer').itemSight).toBeGreaterThan(0);
    expect(arena('headsman').itemSight).toBe(0);
  });

  it('makes the candlebearer light last longer', () => {
    const candle = arena('candlebearer');
    const axe = arena('headsman');
    run(candle, 20);
    run(axe, 20);
    expect(candle.survival.light).toBeGreaterThan(axe.survival.light);
  });
});

describe('perception', () => {
  it('notices a bright flame from behind, but not a dim one', () => {
    const bright = arena('headsman');
    const a = place(bright, 'crawler', 2.5, 0, 'idle');
    a.alerted = false;
    a.facing = { x: 1, y: 0 };
    run(bright, 0.1);
    expect(a.alerted).toBe(true);

    const dim = arena('headsman');
    dim.survival = { ...dim.survival, light: 0 };
    const b = place(dim, 'crawler', 2.5, 0, 'idle');
    b.alerted = false;
    b.facing = { x: 1, y: 0 };
    run(dim, 0.1);
    expect(b.alerted).toBe(false);
  });

  it('only sees ahead: a horror behind the hero is unseen, and shows its eyes', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const ahead = place(world, 'husk', 2.5, 0, 'idle');
    const behind = place(world, 'husk', -2.5, 0);
    run(world, 0.05);
    expect(ahead.visible).toBe(true);
    expect(behind.visible).toBe(false);
    expect(behind.watching).toBe(true);
  });

  it('shows the eyes of an unseen horror that looks at the player', () => {
    const world = arena('headsman');
    world.survival = { ...world.survival, light: 0 };
    const enemy = place(world, 'husk', 4, 0);
    run(world, 0.05);
    expect(enemy.visible).toBe(false);
    expect(enemy.watching).toBe(true);
  });

  it('spreads the alarm to nearby horrors', () => {
    const world = arena('headsman');
    const seer = place(world, 'crawler', 2, 0, 'idle');
    seer.alerted = false;
    seer.facing = { x: -1, y: 0 };
    const friend = place(world, 'crawler', 3, 0, 'idle');
    friend.alerted = false;
    friend.facing = { x: 1, y: 0 };
    world.survival = { ...world.survival, light: 0 };
    run(world, 0.1);
    expect(seer.alerted).toBe(true);
    expect(friend.alerted).toBe(true);
  });

  it('lets a snuffer steal light', () => {
    const world = arena('headsman');
    const enemy = windupAgainst(world, 'snuffer', 0.02);
    enemy.health = 999;
    const light = world.survival.light;
    run(world, 0.1);
    expect(world.survival.light).toBeLessThan(light - ENEMIES.snuffer.stealsLight + 1);
  });
});

describe('traits in a life', () => {
  it('attributes and health follow the traits', () => {
    const plain = new World('estirpe', 'headsman');
    const frail = new World('estirpe', 'headsman', 0, 1, { traits: ['frail'] });
    const big = new World('estirpe', 'headsman', 0, 1, { traits: ['giant'] });
    expect(frail.maxHealth).toBeLessThan(plain.maxHealth);
    expect(frail.survival.health).toBe(frail.maxHealth);
    expect(big.attrs.str).toBe(CLASSES.headsman.attributes.str + 3);
    expect(big.attrs.agi).toBe(CLASSES.headsman.attributes.agi - 1);
  });

  it('cat eyes see farther as the flame fades', () => {
    const plain = arena();
    const cat = new World('estirpe', 'headsman', 0, 1, { traits: ['catEyes'] });
    for (const w of [plain, cat]) w.survival = { ...w.survival, light: 10 };
    expect(cat.lightRadius).toBeGreaterThan(plain.lightRadius + 0.5);
  });

  it('hard to kill saves the hero once', () => {
    const world = new World('estirpe', 'headsman', 0, 1, { traits: ['hardToKill'] });
    world.enemies = [];
    world.survival = { ...world.survival, health: 0.01, hunger: 0, thirst: 0 };
    const events = run(world, 0.1);
    expect(events.some((e) => e.type === 'hardToKill')).toBe(true);
    expect(world.dead).toBe(false);
    world.survival = { ...world.survival, health: 0.01 };
    run(world, 0.5);
    expect(world.dead).toBe(true);
  });

  it('a death says what caused it', () => {
    const starved = arena();
    starved.survival = { ...starved.survival, health: 0.01, hunger: 0 };
    const events = run(starved, 0.2);
    const died = events.find((e) => e.type === 'died');
    expect(died && died.type === 'died' && died.cause).toEqual({ type: 'hunger' });

    const slain = arena();
    slain.survival = { ...slain.survival, health: 1 };
    const husk = windupAgainst(slain, 'husk');
    const blows = run(slain, 1);
    const death = blows.find((e) => e.type === 'died');
    expect(husk.kind).toBe('husk');
    expect(death && death.type === 'died' && death.cause).toEqual({ type: 'horror', kind: 'husk' });
  });

  it('earns acquired traits for what happens in the life', () => {
    const deep = new World('estirpe', 'headsman', 0, 5);
    deep.enemies = [];
    const events = run(deep, 0.1);
    expect(events).toContainEqual({ type: 'traitGained', trait: 'survivor' });
    expect(deep.traits).toContain('survivor');
    // Earned once only.
    expect(run(deep, 0.1).some((e) => e.type === 'traitGained')).toBe(false);

    const scarred = arena();
    scarred.survival = { ...scarred.survival, health: scarred.maxHealth * 0.05 };
    expect(run(scarred, 0.05).some((e) => e.type === 'traitGained')).toBe(false);
    scarred.survival = { ...scarred.survival, health: scarred.maxHealth * 0.5 };
    expect(run(scarred, 0.05)).toContainEqual({ type: 'traitGained', trait: 'scar' });
  });

  it('tunnel rats find one more item on every level', () => {
    const plain = new World('estirpe', 'headsman');
    const rat = new World('estirpe', 'headsman', 0, 1, { traits: ['tunnelRat'] });
    expect(rat.level.items.length).toBe(plain.level.items.length + 1);
  });

  it('the map an ancestor explored is already known', () => {
    const explored: Record<number, string> = {};
    const first = new World('estirpe', 'headsman', 0, 1, { explored });
    first.reveal();
    first.storeExplored();
    const known = first.explored.reduce((n, v) => n + v, 0);
    expect(known).toBeGreaterThan(0);
    expect(explored[1]).toBeTruthy();
    const heir = new World('estirpe', 'headsman', 1, 1, { explored });
    expect(heir.explored.reduce((n, v) => n + v, 0)).toBe(known);
  });
});

describe('snapshots', () => {
  it('a restored world carries on exactly like the original', () => {
    const world = new World('estirpe', 'plunderer', 2, 1, { traits: ['bloody', 'scavenger'] });
    run(world, 3, move(1, 0.3));
    run(world, 2, move(-0.2, 1));
    const json = JSON.parse(JSON.stringify(world.snapshot()));
    const copy = World.restore(json);
    expect(copy.player).toEqual(world.player);
    expect(copy.survival).toEqual(world.survival);
    expect(copy.enemies.map((e) => [e.id, e.health, e.state])).toEqual(world.enemies.map((e) => [e.id, e.health, e.state]));
    expect([...copy.taken]).toEqual([...world.taken]);
    expect(copy.level.items.length).toBe(world.level.items.length);
    expect(copy.traits).toEqual(world.traits);
    // And from there on, both lives unfold the same.
    run(world, 4, move(0.5, -1));
    run(copy, 4, move(0.5, -1));
    expect(copy.player).toEqual(world.player);
    expect(copy.survival).toEqual(world.survival);
    expect(copy.enemies.map((e) => [e.pos, e.health])).toEqual(world.enemies.map((e) => [e.pos, e.health]));
  });
});
