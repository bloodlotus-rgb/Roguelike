import { describe, expect, it } from 'vitest';
import { maxHealth } from './attributes';
import { CLASSES, type ClassId } from './classes';
import { isFloor } from './dungeon';
import { ENEMIES, type EnemyKind } from './enemies';
import { CONFIG } from './config';
import { addItem } from './inventory';
import { COMBAT, NO_INPUT, World, type ControlInput, type Enemy, type WorldEvent } from './world';

const input = (partial: Partial<ControlInput> = {}): ControlInput => ({ ...NO_INPUT, ...partial });
const move = (x: number, y: number) => input({ move: { x, y } });

/** A world with no horrors except the ones a test places next to the player. */
/** A free spot in the arrival room, away from the stairs: where a camp can go. */
function campSpot(world: World): { x: number; y: number } {
  const room = world.level.rooms[0];
  const { start } = world.level;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (!isFloor(world.level, x, y) || (Math.abs(x - start.x) <= 2 && Math.abs(y - start.y) <= 2)) continue;
      const p = { x: x + 0.5, y: y + 0.5 };
      if (world.level.up.steps.some((s) => s.x === x && s.y === y)) continue;
      return p;
    }
  }
  return world.player;
}

/** Steps a hero off the stairs from above into the arrival room. */
function intoRoom(world: World): World {
  const { up } = world.level;
  world.player = { x: up.bottom.x + 0.5 + up.dir.x * 2, y: up.bottom.y + 0.5 + up.dir.y * 2 };
  return world;
}

function arena(classId: ClassId = 'headsman'): World {
  const world = intoRoom(new World('estirpe', classId));
  world.enemies = [];
  // A clearing of open floor around the hero, so tests do not depend on the level's shape.
  const cx = Math.floor(world.player.x);
  const cy = Math.floor(world.player.y);
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) world.level.tiles[y * world.level.width + x] = 1;
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
    // Only health lost a moment ago comes back.
    world.survival = { ...world.survival, health: 50 };
    world.rally = 20;
    const enemy = place(world, 'crawler', 1, 0, 'idle');
    enemy.health = 1;
    const events = [...tap(world, 'attack'), ...run(world, 0.3)];
    expect(events.some((e) => e.type === 'heal')).toBe(true);
    expect(world.survival.health).toBeGreaterThan(50);
    expect(world.survival.health).toBeLessThanOrEqual(60);
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

describe('fixes from play', () => {
  it('a full set of traits does not keep earning the same ones over and over', () => {
    const world = new World('estirpe', 'headsman', 0, 10, { traits: ['scar', 'hardened', 'reflexes', 'burnt', 'oneEyed'] });
    world.enemies = [];
    const gained = run(world, 2).filter((e) => e.type === 'traitGained');
    expect(gained.map((e) => e.type === 'traitGained' && e.trait).sort()).toEqual(['cursebound', 'survivor']);
    expect(world.traits.length).toBe(5);
  });

  it('bloodthirst only wins back health lost a moment ago', () => {
    const fresh = arena('headsman');
    fresh.survival = { ...fresh.survival, health: fresh.maxHealth * 0.5 };
    const quiet = place(fresh, 'crawler', 1, 0);
    quiet.health = 1;
    fresh.facing = { x: 1, y: 0 };
    run(fresh, 0.8, input({ attack: true }));
    expect(quiet.state).toBe('dead');
    expect(fresh.survival.health).toBe(fresh.maxHealth * 0.5);

    const hurt = arena('headsman');
    const husk = windupAgainst(hurt, 'husk');
    run(hurt, 0.4);
    const after = hurt.survival.health;
    expect(after).toBeLessThan(hurt.maxHealth);
    husk.health = 1;
    hurt.facing = { x: husk.pos.x - hurt.player.x, y: husk.pos.y - hurt.player.y };
    run(hurt, 0.8, input({ attack: true }));
    expect(husk.state).toBe('dead');
    expect(hurt.survival.health).toBeGreaterThan(after);
    expect(hurt.survival.health).toBeLessThan(hurt.maxHealth);
  });
});

describe('body and backpack', () => {
  it('starts each life with a starter kit and no gold', () => {
    const world = arena();
    expect(world.inventory.items.map((i) => i.kind).sort()).toEqual(['campKit', 'firewood', 'marchRation', 'oil', 'ration', 'ration', 'waterskin']);
    expect(world.gold).toBe(0);
  });

  it('every class pays for its blows in its own way', () => {
    const swing = (classId: 'headsman' | 'plunderer') => {
      const world = arena(classId);
      const before = { ...world.survival };
      tap(world, 'attack');
      return { hunger: before.hunger - world.survival.hunger, thirst: before.thirst - world.survival.thirst };
    };
    const axe = swing('headsman');
    const daggers = swing('plunderer');
    expect(axe.hunger).toBeGreaterThan(daggers.hunger);
    expect(daggers.thirst).toBeGreaterThan(axe.thirst);
  });

  it('wounds close when calm, paid for with hunger and thirst', () => {
    const world = arena();
    world.survival = { ...world.survival, health: world.maxHealth - 20 };
    run(world, 4);
    expect(world.survival.health).toBe(world.maxHealth - 20);
    const before = { ...world.survival };
    run(world, 6);
    expect(world.survival.health).toBeGreaterThan(before.health);
    expect(world.survival.hunger).toBeLessThan(before.hunger - 1);
    expect(world.survival.thirst).toBeLessThan(before.thirst - 1);
  });

  it('nothing heals on an empty stomach', () => {
    const world = arena();
    world.survival = { ...world.survival, health: 50, hunger: 0 };
    run(world, 8);
    expect(world.survival.health).toBeLessThan(50);
  });

  it('picks loot into the backpack, gold into the purse, and refuses what does not fit', () => {
    const world = arena();
    const at = { x: Math.floor(world.player.x), y: Math.floor(world.player.y) };
    world.level.items.push({ id: 7001, kind: 'gold', amount: 12, ...at });
    world.update(0.02, NO_INPUT);
    expect(world.gold).toBe(12);
    // Fill the pack, then a ration has nowhere to go.
    while (world.inventory.items.length < 20 && addItem(world.inventory, 'oil')) {}
    world.level.items.push({ id: 7002, kind: 'ration', ...at });
    const events = run(world, 0.1);
    expect(events.filter((e) => e.type === 'noRoom').length).toBe(1);
    expect(world.taken.has(7002)).toBe(false);
  });

  it('filling the lamp takes a moment standing still, and moving interrupts it', () => {
    const world = arena();
    world.survival = { ...world.survival, light: 20 };
    const oil = world.inventory.items.find((i) => i.kind === 'oil')!;
    world.useItem(oil.uid);
    run(world, 0.5);
    expect(world.survival.light).toBeLessThan(21);
    run(world, 0.1, move(1, 0));
    expect(world.channel).toBeNull();
    world.useItem(oil.uid);
    const events = run(world, 2);
    expect(events.some((e) => e.type === 'used')).toBe(true);
    expect(world.survival.light).toBeGreaterThan(60);
  });

  it('food and water wait for the fire; a march ration is eaten on the move', () => {
    const world = arena();
    world.survival = { ...world.survival, hunger: 40, thirst: 40 };
    const ration = world.inventory.items.find((i) => i.kind === 'ration')!;
    world.useItem(ration.uid);
    expect(run(world, 0.05)).toContainEqual({ type: 'cantUse', reason: 'camp' });
    const march = world.inventory.items.find((i) => i.kind === 'marchRation')!;
    world.useItem(march.uid);
    world.update(0.02, move(1, 0));
    expect(world.survival.hunger).toBeGreaterThan(60);
  });

  it('fountains fill every waterskin; searching a container finds things once', () => {
    const world = arena();
    const skin = world.inventory.items.find((i) => i.kind === 'waterskin')!;
    skin.charges = 0;
    const fountain = world.level.features.find((f) => f.kind === 'fountain')!;
    world.player = { x: fountain.x + 0.5, y: fountain.y + 0.5 };
    expect(world.interaction).toBe('fountain');
    world.interact();
    expect(run(world, 0.05).some((e) => e.type === 'refilled')).toBe(true);
    expect(skin.charges).toBe(4);

    const remains = world.level.features.find((f) => f.kind === 'remains')!;
    world.player = { x: remains.x + 0.5, y: remains.y + 0.5 };
    expect(world.interaction).toBe('search');
    world.interact();
    const found = run(world, 0.05).find((e) => e.type === 'found');
    expect(found && found.type === 'found' && found.kinds.length).toBeGreaterThan(0);
    expect(world.interaction).not.toBe('search');
  });

  it('the backpack and purse survive a snapshot', () => {
    const world = arena();
    world.gold = 31;
    const copy = World.restore(JSON.parse(JSON.stringify(world.snapshot())));
    expect(copy.gold).toBe(31);
    expect(copy.inventory).toEqual(world.inventory);
  });
});

describe('camps and nights', () => {
  /** A world with a camp pitched in the first room, the hero at it. */
  function camped(): World {
    const world = arena();
    world.player = campSpot(world);
    const kit = world.inventory.items.find((i) => i.kind === 'campKit')!;
    world.useItem(kit.uid);
    const events = run(world, 0.05);
    expect(events.some((e) => e.type === 'campBuilt')).toBe(true);
    return world;
  }

  it('a camp is pitched in a room, one per room, and stays for the family', () => {
    const camps: import('./dynasty').CampSite[] = [];
    const world = new World('estirpe', 'headsman', 0, 1, { camps, builder: 3, generation: 2 });
    world.enemies = [];
    world.player = campSpot(world);
    const kit = world.inventory.items.find((i) => i.kind === 'campKit')!;
    world.useItem(kit.uid);
    run(world, 0.05);
    expect(camps).toHaveLength(1);
    expect(camps[0]).toMatchObject({ depth: 1, builder: 3, built: 2, condition: 100 });
    expect(world.interaction).toBe('camp');
    expect(world.inventory.items.some((i) => i.kind === 'campKit')).toBe(false);
    // The heir finds it there.
    const heir = new World('estirpe', 'plunderer', 1, 1, { camps });
    heir.player = { x: camps[0].x + 0.5, y: camps[0].y + 0.5 };
    expect(heir.interaction).toBe('camp');
  });

  it('by the fire you eat, drink, boil water and cook', () => {
    const world = camped();
    world.survival = { ...world.survival, hunger: 30, thirst: 30 };
    const ration = world.inventory.items.find((i) => i.kind === 'ration')!;
    world.campUse(ration.uid);
    expect(world.survival.hunger).toBeGreaterThan(60);
    const skin = world.inventory.items.find((i) => i.kind === 'waterskin')!;
    skin.turbid = true;
    addItem(world.inventory, 'mushroom', undefined, { poison: false });
    const mushroom = world.inventory.items.find((i) => i.kind === 'mushroom')!;
    expect(world.campBoil(skin.uid)).toEqual([{ type: 'needFire' }]);
    expect(world.campUse(mushroom.uid)).toEqual([{ type: 'needFire' }]);
    const wood = world.inventory.items.find((i) => i.kind === 'firewood')!;
    expect(world.campUse(wood.uid)).toEqual([{ type: 'fireLit' }]);
    expect(world.campBoil(skin.uid)).toEqual([{ type: 'boiled' }]);
    world.campUse(skin.uid);
    expect(world.survival.thirst).toBeGreaterThan(50);
    world.campUse(mushroom.uid);
    expect(world.inventory.items.some((i) => i.kind === 'mushroom')).toBe(false);
  });

  it('a night of sleep heals, costs the body, and brings the dawn', () => {
    const world = camped();
    world.survival = { ...world.survival, health: 30, hunger: 90, thirst: 90 };
    const day = world.day;
    const events = world.sleep();
    const slept = events.find((e) => e.type === 'slept');
    expect(slept).toBeTruthy();
    if (slept?.type === 'slept' && slept.outcome !== 'attack') {
      expect(world.day).toBe(day + 1);
      expect(world.isNight).toBe(false);
    }
    expect(world.survival.health).toBeGreaterThan(30);
    expect(world.survival.hunger).toBeLessThan(90);
  });

  it('an attack wakes you at night with horrors in the camp', () => {
    // Without fire and with low Will, some night among many brings an attack.
    let attacked = false;
    for (let life = 0; life < 30 && !attacked; life++) {
      const world = new World('estirpe-' + life, 'plunderer', life, 1);
      world.enemies = [];
      world.player = campSpot(world);
      const kit = world.inventory.items.find((i) => i.kind === 'campKit')!;
      world.useItem(kit.uid);
      run(world, 0.05);
      if (!world.campInReach) continue;
      const slept = world.sleep().find((e) => e.type === 'slept');
      if (slept?.type === 'slept' && slept.outcome === 'attack') {
        attacked = true;
        expect(world.isNight).toBe(true);
        expect(world.enemies.some((e) => e.alerted)).toBe(true);
        expect(world.camps[0].condition).toBeLessThan(100);
      }
    }
    expect(attacked).toBe(true);
  });

  it('night falls, hunters come out, and wounds stop closing on their own', () => {
    const world = arena();
    const before = world.enemies.length;
    world.clock = CONFIG.time.day - 0.01;
    const events = run(world, 0.05);
    expect(events).toContainEqual({ type: 'nightfall' });
    expect(world.isNight).toBe(true);
    expect(world.enemies.length).toBeGreaterThan(before);
    world.enemies = [];
    world.survival = { ...world.survival, health: 40 };
    run(world, 8);
    expect(world.survival.health).toBeLessThanOrEqual(40);
  });

  it('the clock, the fire and the camps survive a snapshot', () => {
    const world = camped();
    world.clock = 500;
    world.campfire = true;
    const copy = World.restore(JSON.parse(JSON.stringify(world.snapshot())));
    expect(copy.clock).toBe(500);
    expect(copy.campfire).toBe(true);
  });
});

describe('climbing and the mansion', () => {
  it('climbing back finds a level as it was left, and loot does not come back', () => {
    const world = arena();
    const item = world.level.items[0];
    world.taken.add(item.id);
    world.descend();
    expect(world.depth).toBe(2);
    expect(world.ascend()).toBe('climbed');
    expect(world.depth).toBe(1);
    expect(world.taken.has(item.id)).toBe(true);
    expect(world.atStairs).toBe(true);
    // And the way up from depth 1 is the mansion.
    world.returnFromSurface();
    expect(world.atUpStairs).toBe(true);
    expect(world.ascend()).toBe('mansion');
  });

  it('a night at the mansion restores the body and passes the night below', () => {
    const world = arena();
    world.survival = { ...world.survival, health: 10, hunger: 5, thirst: 5 };
    const day = world.day;
    const events = world.restAtMansion();
    expect(world.survival.health).toBe(world.maxHealth);
    expect(world.survival.hunger).toBe(100);
    expect(world.day).toBe(day + 1);
    expect(events).toContainEqual({ type: 'dawn' });
  });

  it('the shop sells for gold, if there is room', () => {
    const world = arena();
    expect(world.buy('ration')).toBe('gold');
    world.gold = 30;
    expect(world.buy('ration')).toBe('bought');
    expect(world.gold).toBe(30 - CONFIG.shop.ration);
  });

  it('walked levels survive a snapshot', () => {
    const world = arena();
    world.taken.add(world.level.items[0].id);
    world.descend();
    const copy = World.restore(JSON.parse(JSON.stringify(world.snapshot())));
    copy.ascend();
    expect(copy.taken.has(world['memory'].get(1)!.taken[0])).toBe(true);
  });
});

describe('works', () => {
  it('a torch set on the floor stays for the family; the lamp rests in its light', () => {
    const works: import('./dynasty').Work[] = [];
    const world = new World('estirpe', 'headsman', 0, 1, { works });
    world.enemies = [];
    addItem(world.inventory, 'torch');
    const torch = world.inventory.items.find((i) => i.kind === 'torch')!;
    world.useItem(torch.uid);
    run(world, 0.05);
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({ kind: 'torch', condition: 100 });
    const light = world.survival.light;
    run(world, 5);
    expect(world.survival.light).toBe(light);
    // It burns down at dawn, and oil fills it again.
    world.restAtMansion();
    expect(works[0].condition).toBeLessThan(100);
    world.returnFromSurface();
    world.player = { x: works[0].x + 0.5, y: works[0].y + 0.5 };
    expect(world.interaction).toBe('torch');
  });

  it('chalk leaves a sign facing where you look, and runs out', () => {
    const works: import('./dynasty').Work[] = [];
    const world = new World('estirpe', 'headsman', 0, 1, { works });
    world.enemies = [];
    addItem(world.inventory, 'chalk');
    const chalk = world.inventory.items.find((i) => i.kind === 'chalk')!;
    world.facing = { x: 0, y: 1 };
    world.useItem(chalk.uid, 'water');
    run(world, 0.05);
    expect(works[0]).toMatchObject({ kind: 'chalk', sign: 'water' });
    expect(works[0].angle).toBeCloseTo(Math.PI / 2);
    expect(chalk.charges).toBe(4);
  });
});

describe('chasms', () => {
  /** A crack `wide` tiles across the clearing, just ahead of the hero. */
  function crack(world: World, wide: number): number {
    const cx = Math.floor(world.player.x);
    const cy = Math.floor(world.player.y);
    for (let k = 1; k <= wide; k++) for (let y = cy - 5; y <= cy + 5; y++) world.level.tiles[y * world.level.width + cx + k] = 3;
    world.player = { x: cx + 0.6, y: cy + 0.5 };
    world.facing = { x: 1, y: 0 };
    return cx;
  }

  it('nobody walks into a chasm', () => {
    const world = arena('headsman');
    const cx = crack(world, 1);
    run(world, 1, move(1, 0));
    expect(world.player.x).toBeLessThan(cx + 1);
    tap(world, 'dodge');
    run(world, 0.6);
    expect(world.player.x).toBeLessThan(cx + 1);
  });

  it('the plunderer leaps a chasm one tile wide with a dodge, but not a wider one', () => {
    const world = arena('plunderer');
    const cx = crack(world, 1);
    const events = tap(world, 'dodge');
    run(world, 0.6);
    expect(events.some((e) => e.type === 'leap')).toBe(true);
    expect(world.player.x).toBeGreaterThan(cx + 2);

    const wide = arena('plunderer');
    const wx = crack(wide, 2);
    tap(wide, 'dodge');
    run(wide, 0.6);
    expect(wide.player.x).toBeLessThan(wx + 1);
  });

  it('planks laid at the edge make a bridge the family keeps', () => {
    const world = arena('headsman');
    const cx = crack(world, 2);
    world.inventory.items = world.inventory.items.filter((i) => i.kind !== 'campKit');
    addItem(world.inventory, 'planks');
    const planks = world.inventory.items.find((i) => i.kind === 'planks')!;
    world.useItem(planks.uid);
    world.update(0.02, NO_INPUT);
    const bridge = world.works.find((w) => w.kind === 'bridge');
    expect(bridge?.span).toHaveLength(2);
    expect(world.level.bridges.length).toBeGreaterThanOrEqual(2);
    run(world, 1.5, move(1, 0));
    expect(world.player.x).toBeGreaterThan(cx + 3);
  });
});

describe('water', () => {
  /** Shallow water across the clearing, just ahead of the hero. */
  function ford(world: World): number {
    const cx = Math.floor(world.player.x);
    const cy = Math.floor(world.player.y);
    world.level.water = world.level.water ?? new Uint8Array(world.level.tiles.length);
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx + 1; x <= cx + 3; x++) world.level.water[y * world.level.width + x] = 1;
    world.player = { x: cx + 0.5, y: cy + 0.5 };
    return cx;
  }

  it('shallow water slows the hero and every step splashes', () => {
    const dry = arena('headsman');
    const x0 = dry.player.x;
    run(dry, 0.5, move(-1, 0));
    const dryDistance = x0 - dry.player.x;

    const world = arena('headsman');
    const cx = ford(world);
    world.player = { x: cx + 1.5, y: world.player.y };
    const events = run(world, 0.5, move(1, 0));
    expect(world.player.x - (cx + 1.5)).toBeLessThan(dryDistance * 0.75);
    expect(events.some((e) => e.type === 'splash')).toBe(true);
  });

  it('a splash wakes horrors close by', () => {
    const world = arena('headsman');
    ford(world);
    const sleeper = place(world, 'husk', -3, 0, 'idle');
    sleeper.alerted = false;
    run(world, 0.6, move(1, 0));
    expect(sleeper.alerted).toBe(true);
  });

  it('crawlers will not step into water', () => {
    const world = arena('headsman');
    const cx = ford(world);
    world.player = { x: cx + 2.5, y: world.player.y };
    const crawler = place(world, 'crawler', -2.2, 0);
    run(world, 2);
    expect(crawler.pos.x).toBeLessThan(cx + 1);
  });

  it('under a waterfall the water runs clean', () => {
    const world = arena('headsman');
    world.level.fall = { x: Math.floor(world.player.x) + 1, y: Math.floor(world.player.y) };
    const heard = run(world, 1.5);
    expect(heard.some((e) => e.type === 'roar')).toBe(true);
    expect(world.interaction).toBe('falls');
    world.interact();
    const events = run(world, 0.05);
    const refill = events.find((e) => e.type === 'refilled');
    expect(refill && refill.type === 'refilled' && !refill.turbid).toBe(true);
  });

  it('standing water fills the waterskins, turbid', () => {
    const world = arena('headsman');
    const cx = ford(world);
    world.player = { x: cx + 1.5, y: world.player.y };
    world.update(0.02, NO_INPUT);
    expect(world.interaction).toBe('pool');
    world.interact();
    const events = run(world, 0.05);
    const refill = events.find((e) => e.type === 'refilled');
    expect(refill && refill.type === 'refilled' && refill.turbid).toBe(true);
  });
});

describe('collapses', () => {
  it('some corridors are blocked by stones that can be dug out, loudly, for the whole family', () => {
    let world: World | null = null;
    for (const seed of ['estirpe', 'tainted', 'abc', '12345', 'mansion', 'ashen']) {
      const w = new World(seed, 'headsman', 0, 1, { works: [] });
      for (let i = 0; i < 4 && w.rubble.length === 0; i++) w.descend();
      if (w.rubble.length > 0) {
        world = w;
        break;
      }
    }
    expect(world).not.toBeNull();
    const w = world!;
    const stones = w.rubble[0];
    const tile = stones.y * w.level.width + stones.x;
    expect(w.level.closed?.has(tile)).toBe(true);
    // Stand next to it, along the corridor.
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => isFloor(w.level, stones.x + dx, stones.y + dy))!;
    w.enemies = [place(w, 'crawler', 0, 0, 'idle')];
    w.player = { x: stones.x + side[0] + 0.5, y: stones.y + side[1] + 0.5 };
    const far = w.enemies[0];
    far.pos = { x: w.player.x + 6, y: w.player.y };
    far.state = 'idle';
    far.alerted = false;
    w.update(0.02, NO_INPUT);
    expect(w.interaction).toBe('clear');
    w.interact();
    const events = run(w, CONFIG.works.digTime + 0.5);
    expect(events.some((e) => e.type === 'dig')).toBe(true);
    // The noise carried.
    expect(far.alerted).toBe(true);
    // (It may have come and stopped the work; if so, clear it away and finish.)
    if (w.digging === null && w.rubble.some((p) => p.x === stones.x && p.y === stones.y)) {
      w.enemies = [];
      w.interact();
      run(w, CONFIG.works.digTime + 0.5);
    }
    expect(w.works.some((x) => x.kind === 'cleared')).toBe(true);
    expect(w.level.closed?.has(tile)).toBe(false);
  });
});

describe('doors and barricades', () => {
  /** A world standing next to a doorway, with nothing else around. */
  function atDoorway(): { world: World; d: { x: number; y: number } } {
    const world = arena();
    const d = world.level.doorways[0];
    // Stand on the room side of it.
    const room = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => world.level.rooms.some((r) => d.x + dx >= r.x && d.x + dx < r.x + r.w && d.y + dy >= r.y && d.y + dy < r.y + r.h))!;
    world.player = { x: d.x + room[0] + 0.5, y: d.y + room[1] + 0.5 };
    return { world, d };
  }

  it('levels have narrow doorways, and some have doors', () => {
    const world = arena();
    expect(world.level.doorways.length).toBeGreaterThan(0);
    expect(world.level.doors.length).toBeGreaterThan(0);
  });

  it('a barricade shuts a doorway for the family, opens and shuts again', () => {
    const works: import('./dynasty').Work[] = [];
    const { world, d } = (() => {
      const w = new World('estirpe', 'headsman', 0, 1, { works });
      w.enemies = [];
      const dw = w.level.doorways[0];
      const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => w.level.rooms.some((r) => dw.x + dx >= r.x && dw.x + dx < r.x + r.w && dw.y + dy >= r.y && dw.y + dy < r.y + r.h))!;
      w.player = { x: dw.x + side[0] + 0.5, y: dw.y + side[1] + 0.5 };
      return { world: w, d: dw };
    })();
    world.inventory.items = world.inventory.items.filter((i) => i.kind !== 'campKit');
    addItem(world.inventory, 'planks');
    const planks = world.inventory.items.find((i) => i.kind === 'planks')!;
    world.useItem(planks.uid);
    run(world, 0.05);
    expect(works).toHaveLength(1);
    expect(world.level.closed?.has(d.y * world.level.width + d.x)).toBe(true);
    expect(world.interaction).toBe('openDoor');
    world.interact();
    run(world, 0.05);
    expect(world.level.closed?.has(d.y * world.level.width + d.x)).toBe(false);
  });

  it('horrors batter a shut barricade until it gives', () => {
    const { world, d } = atDoorway();
    world.works.push({ id: 1, kind: 'barricade', depth: 1, x: d.x, y: d.y, built: 1, builder: 1, condition: 10, open: false });
    world['refreshShut']();
    const brute = place(world, 'husk', 0, 0);
    brute.pos = { x: d.x + 0.5 + (world.player.x - (d.x + 0.5)) * -1, y: d.y + 0.5 + (world.player.y - (d.y + 0.5)) * -1 };
    brute.alerted = true;
    const events = run(world, 3);
    expect(events.some((e) => e.type === 'shutBroken')).toBe(true);
    expect(world.works).toHaveLength(0);
  });
});

describe('pits and ropes', () => {
  it('a rope tied at the pit is a shortcut down and back up, for the family', () => {
    const works: import('./dynasty').Work[] = [];
    const world = new World('estirpe', 'headsman', 0, 1, { works });
    world.enemies = [];
    world.inventory.items = world.inventory.items.filter((i) => i.kind !== 'campKit');
    addItem(world.inventory, 'rope');
    const pit = world.level.pit;
    world.player = { x: pit.x + 1.5, y: pit.y + 0.5 };
    if (!isFloor(world.level, pit.x + 1, pit.y)) world.player = { x: pit.x - 0.5, y: pit.y + 0.5 };
    const rope = world.inventory.items.find((i) => i.kind === 'rope')!;
    world.useItem(rope.uid);
    run(world, 0.05);
    expect(works).toMatchObject([{ kind: 'rope', depth: 1 }]);
    expect(world.interaction).toBe('ropeDown');
    expect(world.climbRope()).toBe('down');
    expect(world.depth).toBe(2);
    expect(Math.floor(world.player.x)).toBe(world.level.landing.x);
    expect(world.interaction).toBe('ropeUp');
    expect(world.climbRope()).toBe('up');
    expect(world.depth).toBe(1);
  });

  it('nobody walks over the pit', () => {
    const world = arena();
    const { pit } = world.level;
    expect(world.level.closed?.has(pit.y * world.level.width + pit.x)).toBe(true);
  });
});

describe('stairs you walk', () => {
  it('walking down the steps takes you to the level below, in the same place; up brings you back', () => {
    const world = arena();
    const { down } = world.level;
    world.player = { x: down.top.x + 0.5, y: down.top.y + 0.5 };
    const dirMove = move(down.dir.x, down.dir.y);
    let events: WorldEvent[] = [];
    for (let i = 0; i < 200 && world.depth === 1; i++) events.push(...world.update(0.02, dirMove));
    expect(world.depth).toBe(2);
    expect(events.some((e) => e.type === 'levelChanged')).toBe(true);
    expect(world.heightAt(world.player)).toBeGreaterThan(0);
    // Back up the same steps.
    const back = move(-down.dir.x, -down.dir.y);
    for (let i = 0; i < 200 && world.depth === 2; i++) world.update(0.02, back);
    expect(world.depth).toBe(1);
    expect(world.heightAt(world.player)).toBeLessThan(0);
  });

  it('a hunting horror close behind follows you down the stairs', () => {
    const world = arena();
    const { down } = world.level;
    world.player = { x: down.top.x + 0.5, y: down.top.y + 0.5 };
    const hunter = place(world, 'crawler', -down.dir.x * 2 || 0.5, -down.dir.y * 2 || 0.5);
    hunter.alerted = true;
    world.descend();
    expect(world.depth).toBe(2);
    run(world, 3);
    expect(world.enemies.some((e) => e.kind === 'crawler' && e.alerted && e.id === hunter.id)).toBe(true);
  });

  it('from depth 1 the stairs up lead out to the mansion', () => {
    const world = new World('estirpe', 'headsman');
    world.enemies = [];
    const { up } = world.level;
    const events = run(world, 2, move(-up.dir.x, -up.dir.y));
    expect(events).toContainEqual({ type: 'toMansion' });
  });
});

