export type Lang = 'es' | 'en';

const strings = {
  title: { es: 'La Estirpe', en: 'Tainted Ancestry' },
  health: { es: 'Vida', en: 'Health' },
  hunger: { es: 'Hambre', en: 'Hunger' },
  thirst: { es: 'Sed', en: 'Thirst' },
  light: { es: 'Luz', en: 'Light' },
  depth: { es: 'Profundidad', en: 'Depth' },
  seed: { es: 'Semilla', en: 'Seed' },
  descend: { es: 'Bajar', en: 'Descend' },
  paused: { es: 'En pausa', en: 'Paused' },
  resume: { es: 'Seguir', en: 'Resume' },
  died: { es: 'Has muerto', en: 'You died' },
  diedDepth: { es: 'Llegaste a la profundidad {depth}.', en: 'You reached depth {depth}.' },
  tryAgain: { es: 'Bajar de nuevo', en: 'Descend again' },
  pickupFood: { es: 'Pan duro', en: 'Stale bread' },
  pickupWater: { es: 'Odre de agua', en: 'Waterskin' },
  pickupOil: { es: 'Frasco de aceite', en: 'Oil flask' },
  controlsHint: {
    es: 'Mové con el pulgar. Atacar golpea o desvía; Especial cuando el aro se llena; mantené Esquivar para correr.',
    en: 'Move with your thumb. Attack strikes or parries; Special when the ring fills; hold Dodge to run.',
  },
  controlsHintKeys: {
    es: 'WASD / flechas · Espacio: atacar · Q: especial · Shift: esquivar (mantener: correr) · Enter: bajar',
    en: 'WASD / arrows · Space: attack · Q: special · Shift: dodge (hold: run) · Enter: descend',
  },
  attack: { es: 'Atacar', en: 'Attack' },
  map: { es: 'Mapa', en: 'Map' },
  viewTop: { es: 'Vista: cenital', en: 'View: top' },
  viewFirst: { es: 'Vista: 1ª persona', en: 'View: 1st person' },
  controlsHintFirst: {
    es: 'Joystick arriba/abajo para avanzar, a los costados para girar.',
    en: 'Joystick up/down to walk, sideways to turn.',
  },
  mapTitle: { es: 'Profundidad {depth}', en: 'Depth {depth}' },
  mapHint: { es: 'Tocá para cerrar', en: 'Tap to close' },
  dodge: { es: 'Esquivar', en: 'Dodge' },
  special: { es: 'Especial', en: 'Special' },
  chooseClass: { es: 'Elegí quién baja', en: 'Choose who descends' },
  chooseAgain: { es: 'Elegir otra clase', en: 'Choose another class' },
  parry: { es: '¡Desviado!', en: 'Parried!' },
  executed: { es: '¡Ejecutado!', en: 'Executed!' },
  lightStolen: { es: 'Te robaron luz', en: 'Your light was stolen' },
  labelAttack: { es: 'Ataque', en: 'Attack' },
  labelSpecial: { es: 'Especial', en: 'Special' },
  labelPassive: { es: 'Pasiva', en: 'Passive' },
  className_headsman: { es: 'Verdugo', en: 'Headsman' },
  className_plunderer: { es: 'Saqueador', en: 'Plunderer' },
  className_candlebearer: { es: 'Cirial', en: 'Candlebearer' },
  classDesc_headsman: {
    es: 'Hacha de dos manos. Lento y duro; pasa más hambre y sed.',
    en: 'Two-handed axe. Slow and tough; gets hungry and thirsty faster.',
  },
  classDesc_plunderer: {
    es: 'Dos dagas. Rápido y frágil.',
    en: 'Twin daggers. Quick and frail.',
  },
  classDesc_candlebearer: {
    es: 'Maza y cirio. Sin luz, no hay especial.',
    en: 'Mace and taper. No light, no special.',
  },
  classAttack_headsman: {
    es: 'Barridos que empujan; el tercer golpe seguido es un hachazo que aturde.',
    en: 'Pushing sweeps; every third blow in a row is a stunning overhead chop.',
  },
  classAttack_plunderer: {
    es: 'Puñaladas rápidas; la cuarta es un tajo doble. ×3 por la espalda o sin ser visto.',
    en: 'Quick stabs; the fourth is a double slash. ×3 from behind or unseen.',
  },
  classAttack_candlebearer: {
    es: 'Cada golpe deja cera ardiendo: el horror se quema y se lo ve aunque salga de tu luz.',
    en: 'Each blow leaves burning wax: the horror burns and stays visible outside your light.',
  },
  classSpecial_headsman: {
    es: 'Ejecución: mata a un horror aturdido o malherido. Se carga pegando y recibiendo golpes.',
    en: 'Execution: kills a stunned or badly hurt horror. Charges by hitting and being hit.',
  },
  classSpecial_plunderer: {
    es: 'Paso sombrío: salto que te vuelve invisible. Se carga con el tiempo, y rápido con golpes por la espalda y parry.',
    en: 'Shadow step: a leap that makes you invisible. Charges over time, fast with backstabs and parries.',
  },
  classSpecial_candlebearer: {
    es: 'Llamarada: quema luz, daña y espanta; doble daño a los encerados. Se carga con el tiempo.',
    en: 'Flare: burns light, harms and scares; double damage to waxed horrors. Charges over time.',
  },
  classPassive_headsman: {
    es: 'Sed de sangre: cada horror que matás te devuelve vida.',
    en: 'Bloodthirst: every horror you kill gives you health back.',
  },
  classPassive_plunderer: {
    es: 'Ojo de rata: ves los objetos cercanos en la oscuridad y los horrores sueltan más botín.',
    en: 'Rat eye: you see nearby items in the dark and horrors drop more loot.',
  },
  classPassive_candlebearer: {
    es: 'Llama devota: tu luz dura más y los horrores dudan antes de entrar en ella.',
    en: 'Devout flame: your light lasts longer and horrors hesitate to step into it.',
  },
  attr_str: { es: 'Fuerza', en: 'Strength' },
  attr_agi: { es: 'Agilidad', en: 'Agility' },
  attr_vig: { es: 'Vigor', en: 'Vigor' },
  attr_wit: { es: 'Ingenio', en: 'Wits' },
  attr_wil: { es: 'Voluntad', en: 'Will' },
  attr_per: { es: 'Percepción', en: 'Perception' },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

const STORAGE_KEY = 'estirpe.lang';
let current: Lang = detect();
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore: the choice just won't be remembered.
  }
  document.documentElement.lang = lang;
  listeners.forEach((listener) => listener());
}

export function onLangChange(listener: () => void): void {
  listeners.add(listener);
}

export function t(key: StringKey, params: Record<string, string | number> = {}): string {
  return strings[key][current].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
