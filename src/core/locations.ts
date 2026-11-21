/**
 * Locations: places of the dungeon drawn by hand, not generated. The generator sets some of
 * them into every level and joins them to the rest by their connectors. Each one is a plan
 * in text, one character per tile, seen from above:
 *
 *   #  rock or wall (a lone one inside is a column)
 *   .  floor
 *   +  connector: an opening on the edge, where a passage comes in (in pairs, two wide)
 *   ~  shallow water        W  deep water
 *   F  fountain (clean)     d  drip (a puddle)
 *   k  crate                r  remains (searched like any)
 *   O  outpost: a camp of old that can be lit again without a kit
 *   x  brazier (a light)    c  chains hanging (walkable)
 *   a  altar   s  sarcophagus   h  shelves   b  barrels   u  rubble   p  broken column
 *   (the pieces of pieces.ts; all but the chains are solid)
 *
 * Pure data and checks: the generator (dungeon.ts) does the placing.
 */

export interface LocationDef {
  id: string;
  name: { es: string; en: string };
  /** Depths where it can turn up, inclusive. */
  depths: [number, number];
  /** How likely it is picked, relative to the others. */
  weight: number;
  /** At most once in the whole dungeon. */
  unique?: boolean;
  plan: string[];
}

export const LOCATION_CHARS = '#.+~WFdkrOxcashbup';
/** Characters of a plan that cannot be walked: rock, deep water and solid pieces. */
const SOLID_CHARS = '#Wxashbup';

export const LOCATIONS: LocationDef[] = [
  {
    id: 'abandonedCamp',
    name: { es: 'Campamento abandonado', en: 'Abandoned camp' },
    depths: [1, 99],
    weight: 3,
    // A fire long cold, a bedroll, someone's remains: light it again and it is yours.
    plan: [
      '####++###',
      '#r.....b#',
      '#...O...#',
      '#.......#',
      '#..k...u#',
      '#b.....u#',
      '#########',
    ],
  },
  {
    id: 'kitchen',
    name: { es: 'Cocina', en: 'Kitchen' },
    depths: [1, 8],
    weight: 2,
    // The old hearth still draws; the well still gives. Stone counters, forgotten stores.
    plan: [
      '#####++#####',
      '#k.hh..bb.k#',
      '#..........#',
      '#.##....##.#',
      '#..........#',
      '#x..F..O...#',
      '+..........#',
      '+........bx#',
      '############',
    ],
  },
  {
    id: 'cistern',
    name: { es: 'Aljibe', en: 'Cistern' },
    depths: [1, 99],
    weight: 2,
    // A round tank of deep, still water, and a spout of clean water at its brim.
    plan: [
      '#####++####',
      '#x.......x#',
      '#..~~~~~..#',
      '#.~~WWW~~.#',
      '#.~WWWWW~.#',
      '#.~WWWWW~F#',
      '#.~~WWW~~.#',
      '#..~~~~~..#',
      '#....r....#',
      '#.........#',
      '###########',
    ],
  },
  {
    id: 'pillaredCistern',
    name: { es: 'Cisterna de columnas', en: 'Pillared cistern' },
    depths: [2, 99],
    weight: 1,
    // A flooded hall: a forest of columns standing in the water, a walkway all round.
    plan: [
      '#######++########',
      '#x.............x#',
      '#.~~~~~~~~~~~~~.#',
      '#.~#~~~#~~~#~~~.#',
      '#.~~~~~~~~~~~~~.#',
      '#.~WWWWWWWWWWW~.+',
      '#.~W#WWW#WWW#W~.+',
      '#.~WWWWWWWWWWW~.#',
      '#.~~~~~~~~~~~~~.#',
      '#.~#~~~#~~~#~~~.#',
      '#.~~~~~~~~~~~~~.#',
      '#x....d........x#',
      '#################',
    ],
  },
  {
    id: 'nicheGallery',
    name: { es: 'Galería de nichos', en: 'Gallery of niches' },
    depths: [1, 99],
    weight: 2,
    // A long passage lined with burial niches; some are not empty.
    plan: [
      '########################',
      '#s#r#.#s#r#.#.#s#r#.#.##',
      '+..c......x.......c....+',
      '+......................+',
      '#.#s#r#.#.#.#r#s#.#.#.##',
      '########################',
    ],
  },
];

/** An opening of a location: its cells on the edge, and the way out from them. */
export interface Connector {
  cells: Array<{ x: number; y: number }>;
  dir: { x: number; y: number };
}

/** The openings of a plan, grouping adjacent connector cells on the same edge. */
export function connectorsOf(plan: string[]): Connector[] {
  const h = plan.length;
  const w = plan[0].length;
  const seen = new Set<string>();
  const out: Connector[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (plan[y][x] !== '+' || seen.has(`${x},${y}`)) continue;
      const dir = y === 0 ? { x: 0, y: -1 } : y === h - 1 ? { x: 0, y: 1 } : x === 0 ? { x: -1, y: 0 } : { x: 1, y: 0 };
      const cells = [{ x, y }];
      seen.add(`${x},${y}`);
      // Along the edge: across the way out.
      const step = { x: dir.y !== 0 ? 1 : 0, y: dir.x !== 0 ? 1 : 0 };
      for (let k = 1; plan[y + step.y * k]?.[x + step.x * k] === '+'; k++) {
        cells.push({ x: x + step.x * k, y: y + step.y * k });
        seen.add(`${x + step.x * k},${y + step.y * k}`);
      }
      out.push({ cells, dir });
    }
  }
  return out;
}

/**
 * Checks a plan: rectangular, only known characters, walls or connectors all round the
 * edge, at least one connector, and every walkable cell reachable from a connector.
 * Returns what is wrong, or an empty list.
 */
export function checkLocation(def: LocationDef): string[] {
  const problems: string[] = [];
  const { plan } = def;
  const h = plan.length;
  const w = plan[0]?.length ?? 0;
  if (h < 3 || w < 3) return [`${def.id}: too small`];
  plan.forEach((row, y) => {
    if (row.length !== w) problems.push(`${def.id}: row ${y} is ${row.length} wide, not ${w}`);
    for (const c of row) if (!LOCATION_CHARS.includes(c)) problems.push(`${def.id}: unknown '${c}' in row ${y}`);
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (edge && plan[y][x] !== '#' && plan[y][x] !== '+') problems.push(`${def.id}: open edge at ${x},${y}`);
      if (!edge && plan[y][x] === '+') problems.push(`${def.id}: connector inside at ${x},${y}`);
    }
  }
  const connectors = connectorsOf(plan);
  if (connectors.length === 0) problems.push(`${def.id}: no connector`);
  // Walkable: everything but rock and deep water.
  const walk = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !SOLID_CHARS.includes(plan[y][x]);
  const seen = new Set<string>();
  const queue = connectors.flatMap((c) => c.cells);
  for (const p of queue) seen.add(`${p.x},${p.y}`);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!walk(q.x, q.y) || seen.has(`${q.x},${q.y}`)) continue;
      seen.add(`${q.x},${q.y}`);
      queue.push(q);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (walk(x, y) && !seen.has(`${x},${y}`)) problems.push(`${def.id}: ${x},${y} cannot be reached`);
  return problems;
}
