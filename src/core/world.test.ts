import { describe, expect, it } from 'vitest';
import { maxHealth } from './attributes';
import { CLASSES } from './classes';
import { isFloor } from './dungeon';
import { ENEMIES, type EnemyKind } from './enemies';
import { COMBAT, NO_INPUT, World, type ControlInput, type Enemy, type WorldEvent } from './world';

const move = (x: number, y: number): ControlInput => ({ move: { x, y }, attack: false, dodge: false });
const press = (attack: boolean, dodge = false): ControlInput => ({ move: { x: 0, y: 0 }, attack, dodge });

/** A world with no horrors except the ones a test places next to the player. */
function arena(classId: 'headsman' | 'plunderer' | 'candlebearer' = 'headsman'): World {
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
    timer: 0,
    alerted: state !== 'idle',
    forgetTimer: 0,
    facing: { x: -Math.sign(dx) || 1, y: 0 },
    strikeDir: { x: -Math.sign(dx) || 1, y: 0 },
    room: 0,
    wanderTarget: null,
    flank: 0,
    visible: true,
  };
  world.enemies.push(enemy);
  return enemy;
}

function run(world: World, seconds: number, input: ControlInput = NO_INPUT): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let t = 0; t < seconds; t += 0.02) events.push(...world.update(0.02, input));
  return events;
}

/** Taps attack: press for one frame, release on the next. */
function tap(world: World): WorldEvent[] {
  return [...world.update(0.02, press(true)), ...world.update(0.02, press(false))];
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
    expect(world.enemies.length).toBeGreaterThan(0);
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
});

describe('player attacks', () => {
  it('hits a horror in front and spends thirst', () => {
    const world = arena('headsman');
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1, 0, 'idle');
    const thirst = world.survival.thirst;
    const events = [...tap(world), ...run(world, 0.4)];
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
    tap(world);
    run(world, 0.3);
    expect(front.health).toBeLessThan(ENEMIES.husk.health);
    expect(back.health).toBe(ENEMIES.husk.health);
  });

  it('triples the plunderer damage against an unaware horror', () => {
    const world = arena('plunderer');
    world.facing = { x: 1, y: 0 };
    // Sneaking up from behind with the flame low: the horror faces away and is beyond hearing range.
    world.survival = { ...world.survival, light: 0 };
    const enemy = place(world, 'husk', 1.05, 0, 'idle');
    enemy.alerted = false;
    enemy.facing = { x: 1, y: 0 };
    enemy.timer = 10;
    const events = [...tap(world), ...run(world, 0.2)];
    const hit = events.find((e) => e.type === 'enemyHit');
    expect(hit && hit.type === 'enemyHit' && hit.damage).toBeGreaterThanOrEqual(CLASSES.plunderer.weapon.damage * 2);
  });
});

describe('parry', () => {
  function windupAgainst(world: World, kind: EnemyKind): Enemy {
    const enemy = place(world, kind, 0.7, 0);
    enemy.state = 'windup';
    enemy.timer = 0.1;
    enemy.strikeDir = { x: -1, y: 0 };
    return enemy;
  }

  it('negates a melee hit, stuns the horror and grants a critical riposte', () => {
    const world = arena('headsman');
    const enemy = windupAgainst(world, 'crawler');
    const health = world.survival.health;
    const events = [...world.update(0.02, press(true)), ...run(world, 0.1, press(true))];
    expect(events.some((e) => e.type === 'parry')).toBe(true);
    expect(world.survival.health).toBe(health);
    expect(enemy.state).toBe('stunned');
    expect(world.riposteTimer).toBeGreaterThan(0);
  });

  it('fails when the press is too early', () => {
    const world = arena('headsman');
    // Keep holding without an ability available, so no attack fires either.
    world.abilityCooldown = 99;
    windupAgainst(world, 'crawler').timer = 0.6;
    const health = world.survival.health;
    run(world, 0.7, press(true));
    expect(world.survival.health).toBeLessThan(health);
  });

  it('cannot stop the husk', () => {
    const world = arena('plunderer');
    windupAgainst(world, 'husk');
    const health = world.survival.health;
    const events = [...world.update(0.02, press(true)), ...run(world, 0.1, press(true))];
    expect(events.some((e) => e.type === 'parry')).toBe(false);
    expect(world.survival.health).toBeLessThan(health);
  });
});

describe('dodge', () => {
  it('avoids a hit while invulnerable and has a cooldown', () => {
    const world = arena('headsman');
    const enemy = place(world, 'husk', 0.9, 0);
    enemy.state = 'windup';
    enemy.timer = 0.05;
    enemy.strikeDir = { x: -1, y: 0 };
    const health = world.survival.health;
    world.update(0.02, { move: { x: 0, y: 1 }, attack: false, dodge: true });
    run(world, 0.1, move(0, 1));
    expect(world.survival.health).toBe(health);
    expect(world.dodgeCooldown).toBeGreaterThan(0);
  });
});

describe('abilities', () => {
  it('charges and releases the headsman cleave around him', () => {
    const world = arena('headsman');
    const a = place(world, 'husk', 1.2, 0, 'idle');
    const b = place(world, 'husk', -1.2, 0, 'idle');
    run(world, COMBAT.holdThreshold + 0.6, press(true));
    expect(world.charge).toBeGreaterThan(0);
    const events = world.update(0.02, press(false));
    expect(events.some((e) => e.type === 'ability')).toBe(true);
    expect(a.health).toBeLessThan(ENEMIES.husk.health);
    expect(b.health).toBeLessThan(ENEMIES.husk.health);
    expect(world.abilityCooldown).toBeGreaterThan(0);
  });

  it('turns the plunderer invisible and makes horrors forget him', () => {
    const world = arena('plunderer');
    const enemy = place(world, 'crawler', 3, 0);
    run(world, COMBAT.holdThreshold + 0.05, press(true));
    expect(world.invisible).toBe(true);
    expect(enemy.alerted).toBe(false);
  });

  it('burns light for the candlebearer flare and scares horrors', () => {
    const world = arena('candlebearer');
    const enemy = place(world, 'husk', 1.5, 0);
    const light = world.survival.light;
    run(world, COMBAT.holdThreshold + 0.05, press(true));
    expect(world.survival.light).toBeLessThan(light - 10);
    expect(enemy.state).toBe('flee');
  });

  it('falls back to a normal attack when the ability is on cooldown', () => {
    const world = arena('candlebearer');
    world.abilityCooldown = 5;
    world.facing = { x: 1, y: 0 };
    const enemy = place(world, 'husk', 1, 0, 'idle');
    run(world, COMBAT.holdThreshold + 0.1, press(true));
    run(world, 0.4, press(false));
    expect(enemy.health).toBeLessThan(ENEMIES.husk.health);
  });
});

describe('perception', () => {
  it('notices a bright flame from behind, but not a dim one', () => {
    const bright = arena('headsman');
    const a = place(bright, 'crawler', 2.5, 0, 'idle');
    a.alerted = false;
    a.facing = { x: 1, y: 0 };
    a.timer = 10;
    run(bright, 0.1);
    expect(a.alerted).toBe(true);

    const dim = arena('headsman');
    dim.survival = { ...dim.survival, light: 0 };
    const b = place(dim, 'crawler', 2.5, 0, 'idle');
    b.alerted = false;
    b.facing = { x: 1, y: 0 };
    b.timer = 10;
    run(dim, 0.1);
    expect(b.alerted).toBe(false);
  });

  it('notices the player from farther away with more light', () => {
    const world = arena('headsman');
    world.survival = { ...world.survival, light: 100 };
    const bright = world.detectionRange(ENEMIES.crawler);
    world.survival = { ...world.survival, light: 10 };
    expect(world.detectionRange(ENEMIES.crawler)).toBeLessThan(bright);
    expect(new World('s', 'candlebearer').detectionRange(ENEMIES.crawler)).toBeLessThan(
      new World('s', 'headsman').detectionRange(ENEMIES.crawler),
    );
  });

  it('lets a snuffer steal light', () => {
    const world = arena('headsman');
    const enemy = place(world, 'snuffer', 0.7, 0);
    enemy.state = 'windup';
    enemy.timer = 0.02;
    const light = world.survival.light;
    run(world, 0.1);
    expect(world.survival.light).toBeLessThan(light - ENEMIES.snuffer.stealsLight + 1);
  });
});
