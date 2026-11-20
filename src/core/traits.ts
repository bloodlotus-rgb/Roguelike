import type { AttributeId, Attributes } from './attributes';

/**
 * The trait catalog (see docs/rasgos.md). Each trait declares what it does in life as
 * data the world reads, and what it will do when its bearer returns as a boss (text for
 * now; bosses come in the next stage).
 */

export type TraitOrigin = 'birth' | 'defect' | 'aging' | 'acquired';
export type Rarity = 'common' | 'uncommon' | 'rare';

type Text = { es: string; en: string };

/** What a trait changes while its bearer lives. Multipliers are deltas: 0.2 means +20 %. */
export interface TraitEffects {
  attrs?: Partial<Attributes>;
  maxHealth?: number;
  damageTaken?: number;
  crawlerDamage?: number;
  projectileDamage?: number;
  hunger?: number;
  thirst?: number;
  light?: number;
  runCost?: number;
  runSpeed?: number;
  walkSpeed?: number;
  runNoise?: number;
  detection?: number;
  alertRadius?: number;
  /** Degrees added to the vision cone (half-angle). */
  visionCone?: number;
  lightRadius?: number;
  /** Tiles added to the radius when the light is low. */
  minLight?: number;
  parryWindow?: number;
  crit?: number;
  comboSpeed?: number;
  comboWindow?: number;
  knockback?: number;
  chargeOverTime?: number;
  chargePerHit?: number;
  foodValue?: number;
  oilValue?: number;
  foodHeal?: number;
  dropChance?: number;
  starvingDrain?: number;
  /** Health per second while the hunger meter is above half. */
  regenFed?: number;
  unseenDamage?: number;
  finisherDamage?: number;
  /** Damage multiplier of the hit after a parry (default 2). */
  riposte?: number;
  dodgeDistance?: number;
  dodgeInvulnerable?: number;
  killThirst?: number;
  hurtBonus?: number;
  bleed?: boolean;
  firstHitHalved?: boolean;
  hardToKill?: boolean;
  fastingStrength?: boolean;
  coward?: boolean;
  lastBreath?: boolean;
  steadyHand?: boolean;
  warCry?: boolean;
  crawlerBane?: boolean;
  flareCost?: number;
  eyesRange?: number;
  allEyes?: boolean;
  sixthSense?: boolean;
  snufferSight?: number;
  snufferAlwaysVisible?: boolean;
  extraItem?: boolean;
  mapStairs?: boolean;
  mapItems?: boolean;
  mapFood?: boolean;
  mapPath?: boolean;
  mapAllDeaths?: boolean;
  /** Sees outlines in the dark when the light runs out. */
  darkSight?: boolean;
  /** Presentation: danger vignette and heartbeat start earlier (+) or later (−). */
  dread?: number;
}

export interface TraitDef {
  id: string;
  /** Catalog number, 1 to 100. */
  n: number;
  origin: TraitOrigin;
  rarity: Rarity;
  name: Text;
  life: Text;
  boss: Text;
  effects: TraitEffects;
  /** Traits that cannot be held together with this one. */
  excludes?: string[];
  /** For acquired traits: how they are earned. */
  earn?: Text;
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, uncommon: 3, rare: 1 };
export const TRAIT_CAP = 5;

function trait(
  n: number,
  id: string,
  origin: TraitOrigin,
  rarity: Rarity,
  name: [string, string],
  life: [string, string],
  boss: [string, string],
  effects: TraitEffects,
  extra: { excludes?: string[]; earn?: [string, string] } = {},
): TraitDef {
  return {
    n,
    id,
    origin,
    rarity,
    name: { es: name[0], en: name[1] },
    life: { es: life[0], en: life[1] },
    boss: { es: boss[0], en: boss[1] },
    effects,
    excludes: extra.excludes,
    earn: extra.earn ? { es: extra.earn[0], en: extra.earn[1] } : undefined,
  };
}

const B = 'birth';
const D = 'defect';
const A = 'aging';
const Q = 'acquired';
const C = 'common';
const U = 'uncommon';
const R = 'rare';

export const TRAITS: TraitDef[] = [
  // 1. Body
  trait(1, 'smithArms', B, C, ['Brazos de herrero', "Smith's Arms"], ['+2 Fuerza', '+2 Strength'], ['Sus golpes derriban y frenan', 'Blows knock you down and slow you'], { attrs: { str: 2 } }),
  trait(2, 'lightFeet', B, C, ['Pies ligeros', 'Light Feet'], ['+2 Agilidad', '+2 Agility'], ['Esquiva el primer golpe de cada ráfaga', 'Dodges the first blow of each flurry'], { attrs: { agi: 2 } }, { excludes: ['clumsy'] }),
  trait(3, 'thickBlood', B, C, ['Sangre espesa', 'Thick Blood'], ['+2 Vigor', '+2 Vigor'], ['+40 % de vida', '+40% health'], { attrs: { vig: 2 } }, { excludes: ['frail'] }),
  trait(4, 'broadBack', B, C, ['Espalda ancha', 'Broad Back'], ['+1 Fuerza, +1 Vigor', '+1 Strength, +1 Vigor'], ['No retrocede al recibir golpes', 'Does not flinch when hit'], { attrs: { str: 1, vig: 1 } }),
  trait(5, 'giant', B, R, ['Gigante', 'Giant'], ['+3 Fuerza, −1 Agilidad', '+3 Strength, −1 Agility'], ['Más grande; golpes en área', 'Larger; blows sweep an area'], { attrs: { str: 3, agi: -1 } }, { excludes: ['slight'] }),
  trait(6, 'slight', B, U, ['Menudo', 'Slight'], ['+2 Agilidad, −1 Vigor', '+2 Agility, −1 Vigor'], ['Escurridizo; se oculta en las sombras', 'Slippery; hides in the shadows'], { attrs: { agi: 2, vig: -1 } }, { excludes: ['giant'] }),
  trait(7, 'strongHeart', B, U, ['Corazón fuerte', 'Strong Heart'], ['Correr gasta 30 % menos', 'Running costs 30% less'], ['No descansa entre ataques', 'Never rests between attacks'], { runCost: -0.3 }),
  trait(8, 'oakBones', B, U, ['Huesos de roble', 'Oak Bones'], ['−15 % de daño recibido', '−15% damage taken'], ['Armadura: −25 % de daño', 'Armor: −25% damage'], { damageTaken: -0.15 }),
  trait(9, 'tannedHide', B, C, ['Piel curtida', 'Tanned Hide'], ['Los Rastreros hacen la mitad de daño', 'Crawlers deal half damage'], ['Espinas: devuelve daño', 'Thorns: returns damage'], { crawlerDamage: -0.5 }),
  trait(10, 'bellowsLungs', B, U, ['Pulmones de fuelle', 'Bellows Lungs'], ['Corrés 10 % más rápido', 'Run 10% faster'], ['Embiste a toda velocidad', 'Charges at full speed'], { runSpeed: 0.1 }),
  trait(11, 'bigHands', B, U, ['Manos grandes', 'Big Hands'], ['El especial carga 10 % más por golpe', 'Special charges 10% more per hit'], ['Te agarra y te arroja', 'Grabs and throws you'], { chargePerHit: 0.1 }),
  trait(12, 'ambidextrous', B, R, ['Ambidiestro', 'Ambidextrous'], ['Combos 10 % más rápidos', 'Combos 10% faster'], ['Ataca dos veces seguidas', 'Strikes twice in a row'], { comboSpeed: -0.1 }, { excludes: ['crippledHand'] }),
  trait(13, 'bullNeck', B, C, ['Cuello de toro', 'Bull Neck'], ['+10 de vida máxima', '+10 max health'], ['Inmune al aturdimiento', 'Immune to stuns'], { maxHealth: 10 }),
  trait(14, 'hotBlood', B, U, ['Sangre caliente', 'Hot Blood'], ['Bien comido, recuperás vida', 'Recover health while well fed'], ['Se regenera', 'Regenerates'], { regenFed: 0.2 }, { excludes: ['coldBlood'] }),
  trait(15, 'stoneThroat', B, C, ['Garganta de piedra', 'Stone Throat'], ['La sed baja 20 % más lento', 'Thirst drops 20% slower'], ['Cada golpe te quita sed', 'Each blow drains your thirst'], { thirst: -0.2 }, { excludes: ['thirsty'] }),
  // 2. Mind
  trait(16, 'sharpMind', B, C, ['Mente afilada', 'Sharp Mind'], ['+2 Ingenio', '+2 Wits'], ['Anticipa tus movimientos', 'Anticipates your moves'], { attrs: { wit: 2 } }),
  trait(17, 'stubborn', B, C, ['Terco', 'Stubborn'], ['+2 Voluntad', '+2 Will'], ['No huye ni se espanta', 'Never flees or fears'], { attrs: { wil: 2 } }),
  trait(18, 'owlEyes', B, C, ['Ojos de lechuza', 'Owl Eyes'], ['+2 Percepción', '+2 Perception'], ['Te detecta desde el doble de lejos', 'Spots you from twice as far'], { attrs: { per: 2 } }, { excludes: ['shortSighted'] }),
  trait(19, 'retentive', B, U, ['Memorioso', 'Retentive'], ['El mapa marca los objetos vistos', 'The map marks items you saw'], ['Te corta el paso por atajos', 'Cuts you off by shortcuts'], { mapItems: true }),
  trait(20, 'calculating', B, U, ['Calculador', 'Calculating'], ['+5 % de crítico', '+5% critical chance'], ['Críticos triples', 'Triple criticals'], { crit: 0.05 }),
  trait(21, 'patient', B, U, ['Paciente', 'Patient'], ['El especial carga 15 % más rápido con el tiempo', 'Special charges 15% faster over time'], ['Usa su especial el doble', 'Uses its special twice as often'], { chargeOverTime: 0.15 }),
  trait(22, 'devout', B, C, ['Devoto', 'Devout'], ['La luz dura 10 % más', 'Light lasts 10% longer'], ['Ilumina a su alrededor', 'Lights up its surroundings'], { light: -0.1 }),
  trait(23, 'serene', B, U, ['Sereno', 'Serene'], ['El latido y la viñeta llegan más tarde', 'Heartbeat and vignette come later'], ['No hace ningún ruido', 'Makes no sound at all'], { dread: -1 }, { excludes: ['nyctophobia'] }),
  trait(24, 'strategist', B, R, ['Estratega', 'Strategist'], ['Los horrores se avisan a la mitad de distancia', 'Horrors alert each other at half range'], ['Comanda a los horrores cercanos', 'Commands nearby horrors'], { alertRadius: -0.5 }),
  trait(25, 'superstitious', B, C, ['Supersticioso', 'Superstitious'], ['+1 Voluntad; ves los ojos de más lejos', '+1 Will; see eyes from farther'], ['Al verte, te apaga la luz', 'Dims your light on sight'], { attrs: { wil: 1 }, eyesRange: 3 }),
  trait(26, 'runeReader', B, R, ['Lector de runas', 'Rune Reader'], ['La escalera queda marcada en el mapa', 'The stairs are marked on the map'], ['Se teletransporta entre runas', 'Teleports between runes'], { mapStairs: true }),
  trait(27, 'sleepless', B, U, ['Insomne', 'Sleepless'], ['+2 Percepción, más hambre', '+2 Perception, more hunger'], ['Sin espalda: nunca distraído', 'No back: never caught off guard'], { attrs: { per: 2 }, hunger: 0.1 }),
  // 3. Senses and light
  trait(28, 'catEyes', B, U, ['Ojos de gato', 'Cat Eyes'], ['Con poca luz ves más lejos', 'See farther in low light'], ['Achica tu luz cerca suyo', 'Shrinks your light near it'], { minLight: 1.2 }),
  trait(29, 'keenEars', B, C, ['Oído fino', 'Keen Ears'], ['Ves antes a los Apagavelas', 'Spot Snuffers sooner'], ['Te oye siempre que corrés', 'Hears you whenever you run'], { snufferSight: 1.5 }),
  trait(30, 'houndNose', B, U, ['Olfato de sabueso', 'Hound Nose'], ['La comida cercana aparece en el mapa', 'Nearby food shows on the map'], ['Te rastrea sin verte', 'Tracks you unseen'], { mapFood: true }),
  trait(31, 'wideGaze', B, U, ['Mirada amplia', 'Wide Gaze'], ['Cono de visión más ancho', 'Wider vision cone'], ['Ve en todas direcciones', 'Sees in every direction'], { visionCone: 15 }, { excludes: ['tunnelVision'] }),
  trait(32, 'emberPupils', B, R, ['Pupilas de brasa', 'Ember Pupils'], ['Ves todos los ojos en la oscuridad', 'See every pair of eyes in the dark'], ['Te deslumbra', 'Dazzles you'], { allEyes: true }),
  trait(33, 'longShadow', B, U, ['Sombra larga', 'Long Shadow'], ['Tu luz te delata 20 % menos', 'Your light gives you away 20% less'], ['Invisible fuera de tu luz', 'Invisible outside your light'], { detection: -0.2 }),
  trait(34, 'gentleFlame', B, C, ['Llama mansa', 'Gentle Flame'], ['Luz 20 % más larga, 10 % más corta de alcance', 'Light lasts 20% longer, reaches 10% less'], ['Va apagando tu llama', 'Slowly snuffs your flame'], { light: -0.2, lightRadius: -0.1 }, { excludes: ['wildFlame'] }),
  trait(35, 'wildFlame', B, C, ['Llama brava', 'Wild Flame'], ['Luz 15 % más amplia, 15 % más corta', 'Light reaches 15% more, lasts 15% less'], ['Deja fuego en el piso', 'Leaves fire on the floor'], { light: 0.15, lightRadius: 0.15 }, { excludes: ['gentleFlame'] }),
  trait(36, 'sixthSense', B, R, ['Sexto sentido', 'Sixth Sense'], ['Aviso cuando te atacan por la espalda', 'A warning when struck from behind'], ['Esquiva los golpes por la espalda', 'Dodges blows from behind'], { sixthSense: true }),
  trait(37, 'paceCounter', B, C, ['Cuentapasos', 'Pace Counter'], ['El mapa dibuja tu recorrido', 'The map draws your path'], ['Patrulla el nivel', 'Patrols the level'], { mapPath: true }),
  trait(38, 'veiled', B, U, ['Velado', 'Veiled'], ['Te reconocen 15 % más tarde', 'Recognized 15% later'], ['Aparece y desaparece', 'Blinks in and out'], { detection: -0.15 }),
  trait(39, 'cryptEyes', B, R, ['Ojos de cripta', 'Crypt Eyes'], ['Los Apagavelas se ven en toda tu luz', 'Snuffers show anywhere in your light'], ['Ve en la oscuridad total', 'Sees in total darkness'], { snufferAlwaysVisible: true }),
  // 4. Survival
  trait(40, 'ironStomach', B, C, ['Estómago de hierro', 'Iron Stomach'], ['El hambre baja 20 % más lento', 'Hunger drops 20% slower'], ['Come para curarse', 'Eats to heal'], { hunger: -0.2 }, { excludes: ['smallStomach'] }),
  trait(41, 'camel', B, U, ['Camello', 'Camel'], ['La sed baja 25 % más lento', 'Thirst drops 25% slower'], ['Seca el agua cercana', 'Dries up nearby water'], { thirst: -0.25 }, { excludes: ['thirsty'] }),
  trait(42, 'scavenger', B, C, ['Carroñero', 'Scavenger'], ['La comida rinde 25 % más', 'Food goes 25% further'], ['Devora horrores muertos', 'Devours dead horrors'], { foodValue: 0.25 }, { excludes: ['glutton'] }),
  trait(43, 'thrifty', B, C, ['Ahorrativo', 'Thrifty'], ['El aceite rinde 25 % más', 'Oil goes 25% further'], ['Cada golpe te roba luz', 'Each blow steals light'], { oilValue: 0.25 }),
  trait(44, 'tunnelRat', B, U, ['Rata de túnel', 'Tunnel Rat'], ['Un objeto extra por nivel', 'One extra item per level'], ['Deja objetos falsos', 'Leaves false items'], { extraItem: true }),
  trait(45, 'deepPockets', B, U, ['Bolsillos hondos', 'Deep Pockets'], ['Más botín de los horrores', 'More loot from horrors'], ['Suelta el doble al caer', 'Drops twice as much'], { dropChance: 0.1 }),
  trait(46, 'hardToKill', B, R, ['Duro de matar', 'Hard to Kill'], ['Una vez por vida, sobrevivís con 1 de vida', 'Once per life, survive with 1 health'], ['Revive una vez', 'Revives once'], { hardToKill: true }),
  trait(47, 'coldBlood', B, U, ['Sangre fría', 'Cold Blood'], ['Sin comida o agua, la vida baja más lento', 'Starving drains health slower'], ['Inmune a cera y fuego', 'Immune to wax and fire'], { starvingDrain: -0.3 }, { excludes: ['hotBlood'] }),
  trait(48, 'quickHealer', B, C, ['Cicatriza rápido', 'Quick Healer'], ['Cada comida cura 5 de vida', 'Each meal heals 5'], ['Se regenera fuera de combate', 'Regenerates out of combat'], { foodHeal: 5 }),
  trait(49, 'faster', B, U, ['Ayunador', 'Faster'], ['Con hambre baja, +2 Fuerza', 'When starving, +2 Strength'], ['Se enfurece herido', 'Enrages when hurt'], { fastingStrength: true }),
  trait(50, 'softStep', B, C, ['Pisada suave', 'Soft Step'], ['Correr hace la mitad de ruido', 'Running makes half the noise'], ['Se mueve sin sonido', 'Moves without a sound'], { runNoise: -0.5 }, { excludes: ['noisy'] }),
  trait(51, 'strider', B, C, ['Andariego', 'Strider'], ['Caminás 8 % más rápido', 'Walk 8% faster'], ['25 % más rápido', '25% faster'], { walkSpeed: 0.08 }),
  // 5. Combat
  trait(52, 'quickHands', B, U, ['Manos rápidas', 'Quick Hands'], ['Ventana de parry más amplia', 'Wider parry window'], ['Desvía tus golpes', 'Parries your blows'], { parryWindow: 0.05 }, { excludes: ['shaky'] }),
  trait(53, 'trueStrike', B, C, ['Golpe certero', 'True Strike'], ['+8 % de crítico', '+8% critical chance'], ['Críticos frecuentes', 'Frequent criticals'], { crit: 0.08 }),
  trait(54, 'finisher', B, U, ['Rematador', 'Finisher'], ['+20 % de daño a horrores malheridos', '+20% damage to badly hurt horrors'], ['Más daño si estás débil', 'Hits harder when you are weak'], { finisherDamage: 0.2 }),
  trait(55, 'brawler', B, C, ['Pendenciero', 'Brawler'], ['La carga por golpe sube 25 %', 'Charge per hit up 25%'], ['Se acelera con cada golpe', 'Speeds up with each hit'], { chargePerHit: 0.25 }),
  trait(56, 'riposte', B, R, ['Contragolpe', 'Riposte'], ['Tras un parry, golpe triple', 'Triple damage after a parry'], ['Contraataca al instante', 'Strikes back at once'], { riposte: 3 }),
  trait(57, 'dancer', B, U, ['Danzarín', 'Dancer'], ['Esquiva más larga y segura', 'Longer, safer dodge'], ['Salta atrás tras atacar', 'Leaps back after attacking'], { dodgeDistance: 0.25, dodgeInvulnerable: 0.08 }),
  trait(58, 'ironFist', B, C, ['Puño de hierro', 'Iron Fist'], ['Tus golpes empujan 30 % más', 'Your blows push 30% more'], ['Te estrella contra las paredes', 'Slams you into walls'], { knockback: 0.3 }),
  trait(59, 'bloody', B, U, ['Sangriento', 'Bloody'], ['Tus golpes hacen sangrar', 'Your blows cause bleeding'], ['Deja charcos que frenan', 'Leaves slowing pools'], { bleed: true }),
  trait(60, 'relentless', B, U, ['Implacable', 'Relentless'], ['El combo tolera pausas más largas', 'Combos tolerate longer pauses'], ['Cuatro golpes seguidos', 'Four blows in a row'], { comboWindow: 0.3 }),
  trait(61, 'hunter', B, C, ['Cazador', 'Hunter'], ['+15 % de daño a quien no te vio', '+15% damage to the unaware'], ['Ataca oculto', 'Strikes from hiding'], { unseenDamage: 0.15 }),
  trait(62, 'shieldOfFaith', B, U, ['Escudo de fe', 'Shield of Faith'], ['El primer golpe de cada pelea hace la mitad', 'First hit of each fight halved'], ['Absorbe los primeros golpes', 'Absorbs the first blows'], { firstHitHalved: true }),
  trait(63, 'warCry', B, U, ['Grito de guerra', 'War Cry'], ['A veces espantás Rastreros al atacar', 'Attacks may scare Crawlers away'], ['Grita y te frena', 'Shouts and slows you'], { warCry: true }),
  trait(64, 'steadyHand', B, R, ['Mano firme', 'Steady Hand'], ['Al empezar un golpe, los escupitajos no te alcanzan', 'Spit cannot reach you as a blow begins'], ['Escupe tinta', 'Spits ink'], { steadyHand: true }),
  trait(65, 'battleThirst', B, U, ['Sed de batalla', 'Battle Thirst'], ['Cada muerte te devuelve sed', 'Each kill restores thirst'], ['Se cura con cada muerte', 'Heals with each death'], { killThirst: 3 }),
  trait(66, 'eyeForEye', B, C, ['Ojo por ojo', 'Eye for an Eye'], ['Tras recibir daño, golpeás 25 % más', 'After being hurt, hit 25% harder'], ['Devuelve los críticos', 'Returns criticals'], { hurtBonus: 0.25 }),
  // 6. Defects
  trait(67, 'smallStomach', D, C, ['Estómago chico', 'Small Stomach'], ['El hambre baja 25 % más rápido', 'Hunger drops 25% faster'], ['Cada golpe te quita hambre', 'Each blow drains your hunger'], { hunger: 0.25 }, { excludes: ['ironStomach'] }),
  trait(68, 'thirsty', D, C, ['Sediento', 'Thirsty'], ['La sed baja 25 % más rápido', 'Thirst drops 25% faster'], ['Cada golpe te quita sed', 'Each blow drains your thirst'], { thirst: 0.25 }, { excludes: ['camel', 'stoneThroat'] }),
  trait(69, 'clumsy', D, C, ['Torpe', 'Clumsy'], ['−2 Agilidad', '−2 Agility'], ['Tropieza y queda expuesto', 'Stumbles and stays exposed'], { attrs: { agi: -2 } }, { excludes: ['lightFeet'] }),
  trait(70, 'frail', D, C, ['Enclenque', 'Frail'], ['−2 Vigor', '−2 Vigor'], ['Se parte en dos ecos', 'Splits into two echoes'], { attrs: { vig: -2 } }, { excludes: ['thickBlood'] }),
  trait(71, 'nyctophobia', D, U, ['Miedo a la oscuridad', 'Nyctophobia'], ['Con poca luz, el miedo llega antes; −1 Voluntad', 'Fear comes sooner in low light; −1 Will'], ['Lleva su propia luz', 'Carries its own light'], { attrs: { wil: -1 }, dread: 1 }, { excludes: ['serene'] }),
  trait(72, 'tunnelVision', D, C, ['Mirada de túnel', 'Tunnel Vision'], ['Cono de visión más angosto', 'Narrower vision cone'], ['Embiste recto', 'Charges straight'], { visionCone: -15 }, { excludes: ['wideGaze'] }),
  trait(73, 'noisy', D, C, ['Ruidoso', 'Noisy'], ['Correr y atacar hacen más ruido', 'Running and fighting are louder'], ['Aúlla y alerta al nivel', 'Howls to the whole level'], { runNoise: 0.4, detection: 0.1 }, { excludes: ['softStep'] }),
  trait(74, 'crippledHand', D, U, ['Mano lisiada', 'Crippled Hand'], ['Tus golpes se recuperan 15 % más lento', 'Your blows recover 15% slower'], ['Golpes imposibles de desviar', 'Blows that cannot be parried'], { comboSpeed: 0.15 }, { excludes: ['ambidextrous'] }),
  trait(75, 'shortSighted', D, C, ['Corto de vista', 'Short-Sighted'], ['−2 Percepción', '−2 Perception'], ['Ataca a ciegas en área', 'Swings blindly in an area'], { attrs: { per: -2 } }, { excludes: ['owlEyes'] }),
  trait(76, 'bleeder', D, U, ['Hemofílico', 'Bleeder'], ['Recibís 10 % más de daño', 'Take 10% more damage'], ['Se debilita con el tiempo', 'Weakens over time'], { damageTaken: 0.1 }),
  trait(77, 'glutton', D, C, ['Glotón', 'Glutton'], ['La comida rinde 20 % menos', 'Food goes 20% less far'], ['Se atraganta al comer', 'Chokes when eating'], { foodValue: -0.2 }, { excludes: ['scavenger'] }),
  trait(78, 'coward', D, U, ['Cobarde', 'Coward'], ['Herido, corrés más pero pegás menos', 'When hurt, run faster but hit softer'], ['Huye herido y vuelve curado', 'Flees hurt, returns healed'], { coward: true }),
  trait(79, 'cursed', D, R, ['Maldito', 'Cursed'], ['Te detectan 15 % antes', 'Spotted 15% sooner'], ['Tu llama se gasta más en su nivel', 'Your flame burns faster on its level'], { detection: 0.15 }),
  trait(80, 'shaky', D, U, ['Tembloroso', 'Shaky'], ['Ventana de parry más angosta', 'Narrower parry window'], ['Avisa menos sus ataques', 'Telegraphs less'], { parryWindow: -0.04 }, { excludes: ['quickHands'] }),
  // 7. Aging
  trait(81, 'greyHair', A, C, ['Canas', 'Grey Hair'], ['+1 Voluntad, −1 Agilidad', '+1 Will, −1 Agility'], ['Invoca ecos de sí mismo', 'Summons echoes of itself'], { attrs: { wil: 1, agi: -1 } }),
  trait(82, 'arthritis', A, C, ['Artritis', 'Arthritis'], ['−2 Agilidad, +1 Ingenio', '−2 Agility, +1 Wits'], ['Lento pero aturde', 'Slow but stunning'], { attrs: { agi: -2, wit: 1 } }),
  trait(83, 'wisdom', A, C, ['Sabiduría', 'Wisdom'], ['+2 Ingenio, −1 Fuerza', '+2 Wits, −1 Strength'], ['Finge sus ataques', 'Feints its attacks'], { attrs: { wit: 2, str: -1 } }),
  trait(84, 'tiredEyes', A, C, ['Vista cansada', 'Tired Eyes'], ['−1 Percepción, +1 Voluntad', '−1 Perception, +1 Will'], ['Ve poco, oye todo', 'Sees little, hears all'], { attrs: { per: -1, wil: 1 } }),
  trait(85, 'waxenHands', A, C, ['Manos de cera', 'Waxen Hands'], ['−1 Fuerza, la luz dura 10 % más', '−1 Strength, light lasts 10% longer'], ['Gotea cera que frena', 'Drips slowing wax'], { attrs: { str: -1 }, light: -0.1 }),
  trait(86, 'oldMemory', A, C, ['Memoria vieja', 'Old Memory'], ['El mapa muestra dónde cayeron todos', 'The map shows where all fell'], ['Conoce todos los atajos', 'Knows every shortcut'], { mapAllDeaths: true }),
  trait(87, 'hunchedBack', A, C, ['Espalda encorvada', 'Hunched Back'], ['−1 Vigor, −1 Agilidad, +2 Voluntad', '−1 Vigor, −1 Agility, +2 Will'], ['Espalda blindada', 'Armored back'], { attrs: { vig: -1, agi: -1, wil: 2 } }),
  trait(88, 'lastBreath', A, C, ['Último aliento', 'Last Breath'], ['Muy herido, +3 Voluntad y regenerás', 'Near death, +3 Will and regenerate'], ['Estalla en tinta al caer', 'Bursts into ink when it falls'], { lastBreath: true }),
  // 8. Acquired
  trait(89, 'scar', Q, C, ['Cicatriz', 'Scar'], ['+1 Vigor', '+1 Vigor'], ['+20 % de vida', '+20% health'], { attrs: { vig: 1 } }, { earn: ['Sobrevivir con menos del 10 % de vida', 'Survive with under 10% health'] }),
  trait(90, 'hardened', Q, C, ['Curtido', 'Hardened'], ['+1 Fuerza', '+1 Strength'], ['+20 % de daño', '+20% damage'], { attrs: { str: 1 } }, { earn: ['Matar 20 horrores en una vida', 'Kill 20 horrors in one life'] }),
  trait(91, 'reflexes', Q, C, ['Reflejos', 'Reflexes'], ['Ventana de parry más amplia', 'Wider parry window'], ['Desvía algunos golpes', 'Parries some blows'], { parryWindow: 0.03 }, { earn: ['Hacer 10 parry en una vida', 'Parry 10 times in one life'] }),
  trait(92, 'gloomAdjusted', Q, C, ['Hecho a la penumbra', 'Gloom-Adjusted'], ['Con poca luz ves más lejos', 'See farther in low light'], ['Achica tu luz cerca suyo', 'Shrinks your light near it'], { minLight: 0.8 }, { earn: ['Pasar 3 minutos con poca luz', 'Spend 3 minutes in low light'] }),
  trait(93, 'oneEyed', Q, C, ['Tuerto', 'One-Eyed'], ['Cono más angosto, +2 Voluntad', 'Narrower cone, +2 Will'], ['Tiene un lado ciego', 'Has a blind side'], { visionCone: -20, attrs: { wil: 2 } }, { earn: ['Recibir un golpe de Hueco muy herido', 'Take a Husk blow while badly hurt'] }),
  trait(94, 'badLeg', Q, C, ['Pierna mala', 'Bad Leg'], ['−10 % de velocidad', '−10% speed'], ['Rengo y lento', 'Limping and slow'], { walkSpeed: -0.1, runSpeed: -0.1 }, { earn: ['Caer dos veces al borde de la muerte', 'Fall to death’s door twice'] }),
  trait(95, 'crawlerBane', Q, C, ['Mataarañas', 'Crawler Bane'], ['+30 % de daño a Rastreros', '+30% damage to Crawlers'], ['Lo escoltan Rastreros', 'Escorted by Crawlers'], { crawlerBane: true }, { earn: ['Matar 15 Rastreros', 'Kill 15 Crawlers'] }),
  trait(96, 'darkDweller', Q, C, ['Morador de la oscuridad', 'Dark Dweller'], ['Sin luz, ves los contornos', 'Without light, see the outlines'], ['Invisible en la oscuridad', 'Invisible in the dark'], { darkSight: true }, { earn: ['Sobrevivir un minuto sin aceite', 'Survive a minute without oil'] }),
  trait(97, 'survivor', Q, C, ['Superviviente', 'Survivor'], ['Hambre y sed bajan 10 % más lento', 'Hunger and thirst drop 10% slower'], ['No se cansa', 'Never tires'], { hunger: -0.1, thirst: -0.1 }, { earn: ['Llegar a la profundidad 5', 'Reach depth 5'] }),
  trait(98, 'inkDrinker', Q, C, ['Bebedor de tinta', 'Ink Drinker'], ['−30 % de daño de proyectiles', '−30% projectile damage'], ['Escupe tinta', 'Spits ink'], { projectileDamage: -0.3 }, { earn: ['Recibir 10 escupitajos', 'Take 10 spits'] }),
  trait(99, 'burnt', Q, C, ['Quemado', 'Burnt'], ['La llamarada cuesta menos luz', 'The flare costs less light'], ['Aura de fuego', 'Aura of fire'], { flareCost: -5 }, { earn: ['Usar 10 llamaradas', 'Use 10 flares'] }),
  trait(100, 'cursebound', Q, C, ['Marcado por la maldición', 'Cursebound'], ['+2 Ingenio, Voluntad y Percepción; te detectan antes', '+2 Wits, Will and Perception; spotted sooner'], ['Jefe de élite', 'Elite boss'], { attrs: { wit: 2, wil: 2, per: 2 }, detection: 0.1 }, { earn: ['Llegar a la profundidad 10', 'Reach depth 10'] }),
];

export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export function traitDef(id: string): TraitDef {
  const def = TRAIT_BY_ID[id];
  if (!def) throw new Error(`Unknown trait: ${id}`);
  return def;
}

/** Weight of a trait in a birth draw. */
export function traitWeight(def: TraitDef): number {
  return RARITY_WEIGHT[def.rarity];
}

/** Whether `id` can join `held` (no duplicates, no opposites). */
export function compatible(id: string, held: readonly string[]): boolean {
  if (held.includes(id)) return false;
  const def = traitDef(id);
  return held.every((other) => !(def.excludes ?? []).includes(other) && !(traitDef(other).excludes ?? []).includes(id));
}

/** All effects of a set of traits, added together. */
export function combineEffects(ids: readonly string[]): Required<Pick<TraitEffects, 'attrs'>> & TraitEffects {
  const total: TraitEffects & { attrs: Partial<Attributes> } = { attrs: {} };
  for (const id of ids) {
    const effects = traitDef(id).effects;
    for (const [key, value] of Object.entries(effects) as Array<[keyof TraitEffects, unknown]>) {
      if (key === 'attrs') {
        for (const [attr, amount] of Object.entries(value as Partial<Attributes>) as Array<[AttributeId, number]>) {
          total.attrs[attr] = (total.attrs[attr] ?? 0) + amount;
        }
      } else if (typeof value === 'number') {
        const current = (total[key] as number | undefined) ?? 0;
        // Riposte is a multiplier override: keep the largest.
        (total as unknown as Record<string, unknown>)[key] = key === 'riposte' ? Math.max(current, value) : current + value;
      } else if (value === true) {
        (total as unknown as Record<string, unknown>)[key] = true;
      }
    }
  }
  return total;
}
