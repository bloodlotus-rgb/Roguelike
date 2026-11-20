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
    es: 'Mové con el pulgar. Tocá Atacar para golpear o desviar; mantenelo para la habilidad.',
    en: 'Move with your thumb. Tap Attack to strike or parry; hold it for your ability.',
  },
  controlsHintKeys: {
    es: 'WASD / flechas para moverte · Espacio para atacar (mantener: habilidad) · Shift para esquivar',
    en: 'WASD / arrows to move · Space to attack (hold: ability) · Shift to dodge',
  },
  attack: { es: 'Atacar', en: 'Attack' },
  dodge: { es: 'Esquivar', en: 'Dodge' },
  chooseClass: { es: 'Elegí quién baja', en: 'Choose who descends' },
  chooseAgain: { es: 'Elegir otra clase', en: 'Choose another class' },
  parry: { es: '¡Desviado!', en: 'Parried!' },
  lightStolen: { es: 'Te robaron luz', en: 'Your light was stolen' },
  className_headsman: { es: 'Verdugo', en: 'Headsman' },
  className_plunderer: { es: 'Saqueador', en: 'Plunderer' },
  className_candlebearer: { es: 'Cirial', en: 'Candlebearer' },
  classDesc_headsman: {
    es: 'Hacha de dos manos. Golpes lentos y anchos que empujan. Aguanta mucho, pero pasa más hambre y sed.',
    en: 'Two-handed axe. Slow, wide, pushing blows. Tough, but gets hungry and thirsty faster.',
  },
  classDesc_plunderer: {
    es: 'Dos dagas. Rápido y frágil. Golpea triple por la espalda o sin ser visto.',
    en: 'Twin daggers. Quick and frail. Triple damage from behind or unseen.',
  },
  classDesc_candlebearer: {
    es: 'Maza y cirio. Su luz lo delata menos y hace dudar a los horrores.',
    en: 'Mace and taper. His light gives him away less and makes horrors hesitate.',
  },
  abilityDesc_headsman: {
    es: 'Mantener Atacar: tajo cargado en círculo.',
    en: 'Hold Attack: charged cleave all around.',
  },
  abilityDesc_plunderer: {
    es: 'Mantener Atacar: paso sombrío, un salto que te vuelve invisible.',
    en: 'Hold Attack: shadow step, a leap that makes you invisible.',
  },
  abilityDesc_candlebearer: {
    es: 'Mantener Atacar: llamarada que quema luz, daña y espanta.',
    en: 'Hold Attack: a flare that burns light, harms and scares.',
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
