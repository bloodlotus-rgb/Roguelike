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
    es: 'Mové con el pulgar izquierdo o con WASD / flechas.',
    en: 'Move with your left thumb or WASD / arrow keys.',
  },
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
