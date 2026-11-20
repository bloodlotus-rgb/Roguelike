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
  item_ration: { es: 'Ración seca', en: 'Dry ration' },
  item_marchRation: { es: 'Ración de marcha', en: 'March ration' },
  item_waterskin: { es: 'Odre', en: 'Waterskin' },
  item_oil: { es: 'Frasco de aceite', en: 'Oil flask' },
  item_gold: { es: 'Oro', en: 'Gold' },
  itemDesc_ration: { es: 'Sacia el hambre. Hay que comerla quieto, sin peligro cerca.', en: 'Eases hunger. Eat it standing still, out of danger.' },
  itemDesc_marchRation: { es: 'Sacia algo de hambre y sed. Se come caminando.', en: 'Eases some hunger and thirst. Eaten on the move.' },
  itemDesc_waterskin: { es: 'Cuatro tragos. Se rellena en las fuentes.', en: 'Four sips. Refill it at fountains.' },
  itemDesc_oil: { es: 'Carga la lámpara.', en: 'Fills the lamp.' },
  item_firewood: { es: 'Leña', en: 'Firewood' },
  item_bandage: { es: 'Vendas', en: 'Bandages' },
  item_mushroom: { es: 'Hongos', en: 'Mushrooms' },
  item_horrorMeat: { es: 'Carne de horror', en: 'Horror flesh' },
  item_campKit: { es: 'Kit de campamento', en: 'Camp kit' },
  itemDesc_firewood: { es: 'Enciende el fuego del campamento: hervir, cocinar y alejar a los horrores.', en: 'Lights the camp fire: boil, cook and keep horrors away.' },
  itemDesc_bandage: { es: 'Junto al fuego, curan sin gastar comida.', en: 'By the fire, they heal without using food.' },
  itemDesc_mushroom: { es: 'Cocinados alimentan. Algunos son venenosos.', en: 'Cooked, they feed you. Some are poisonous.' },
  itemDesc_horrorMeat: { es: 'Cocinada alimenta mucho, pero trae pesadillas.', en: 'Cooked, it feeds a lot, but brings bad dreams.' },
  itemDesc_campKit: { es: 'Usalo dentro de una sala despejada para levantar un campamento que queda para la familia.', en: 'Use it inside a clear room to pitch a camp that stays for the family.' },
  poisonous: { es: 'venenosos', en: 'poisonous' },
  turbid: { es: 'agua turbia', en: 'turbid water' },
  gold: { es: 'Oro', en: 'Gold' },
  day: { es: 'Día {n}', en: 'Day {n}' },
  night: { es: 'Noche', en: 'Night' },
  daytime: { es: 'Día', en: 'Day' },
  mansion: { es: 'La mansión', en: 'The mansion' },
  mansion_text: {
    es: 'La casa de la familia, arriba de la mazmorra. Acá se duerme seguro y se compra con el oro que trajiste de abajo.',
    en: "The family's house above the dungeon. Here you sleep safely and buy with the gold you brought up.",
  },
  mansion_shop: { es: 'Despensa', en: 'Pantry' },
  mansion_buy: { es: 'Comprar', en: 'Buy' },
  mansion_bought: { es: 'Compraste: {item}.', en: 'You bought: {item}.' },
  mansion_noGold: { es: 'No te alcanza el oro.', en: 'Not enough gold.' },
  mansion_noRoom: { es: 'No entra en la mochila.', en: 'No room in the backpack.' },
  mansion_rest: { es: 'Descansar (pasa la noche)', en: 'Rest (the night passes)' },
  mansion_rested: { es: 'Dormiste en tu cama. Abajo, pasó una noche.', en: 'You slept in your bed. Below, a night went by.' },
  mansion_descend: { es: 'Bajar a la mazmorra', en: 'Go down to the dungeon' },
  action_up: { es: 'Subir', en: 'Climb up' },
  action_camp: { es: 'Campamento', en: 'Camp' },
  action_drip: { es: 'Llenar odres (turbia)', en: 'Fill skins (turbid)' },
  camp: { es: 'Campamento', en: 'Camp' },
  fireOn: { es: 'El fuego arde.', en: 'The fire is burning.' },
  fireOff: { es: 'Sin fuego.', en: 'No fire.' },
  camp_eat: { es: 'Comer', en: 'Eat' },
  camp_drink: { es: 'Beber', en: 'Drink' },
  camp_boil: { es: 'Hervir', en: 'Boil' },
  camp_cook: { es: 'Cocinar y comer', en: 'Cook and eat' },
  camp_bandage: { es: 'Vendarse', en: 'Dress wounds' },
  camp_fire: { es: 'Encender el fuego', en: 'Light the fire' },
  camp_oil: { es: 'Cargar la lámpara', en: 'Fill the lamp' },
  camp_sleep: { es: 'Dormir hasta el alba', en: 'Sleep until dawn' },
  camp_leave: { es: 'Volver a la mazmorra', en: 'Back to the dungeon' },
  camp_nothing: { es: 'Nada en la mochila sirve junto al fuego.', en: 'Nothing in the backpack is of use by the fire.' },
  camp_condition: { es: 'Estado del campamento: {n} %', en: 'Camp condition: {n}%' },
  res_eaten: { es: 'Comiste.', en: 'You ate.' },
  res_drank: { es: 'Bebiste.', en: 'You drank.' },
  res_sick: { es: 'El agua turbia te revolvió el estómago.', en: 'The turbid water turned your stomach.' },
  res_poisoned: { es: 'Los hongos eran venenosos.', en: 'The mushrooms were poisonous.' },
  res_nightmares: { es: 'Esta noche vas a tener pesadillas.', en: 'You will have bad dreams tonight.' },
  res_bandaged: { es: 'Te vendaste las heridas.', en: 'You dressed your wounds.' },
  res_fire: { es: 'El fuego prende.', en: 'The fire catches.' },
  res_needFire: { es: 'Hace falta fuego.', en: 'You need a fire.' },
  res_boiled: { es: 'El agua hirvió: ya se puede beber.', en: 'The water boiled: it is safe now.' },
  res_oil: { es: 'Cargaste la lámpara.', en: 'You filled the lamp.' },
  slept_quiet: { es: 'La noche fue tranquila.', en: 'The night was quiet.' },
  slept_noises: { es: 'Ruidos en la oscuridad no te dejaron descansar del todo.', en: 'Noises in the dark spoiled your rest.' },
  slept_attack: { es: '¡Algo entra al campamento!', en: 'Something is in the camp!' },
  toast_nightfall: { es: 'Cae la noche', en: 'Night falls' },
  toast_dawn: { es: 'Amanece', en: 'Dawn breaks' },
  toast_campBuilt: { es: 'Levantaste un campamento', en: 'You pitched a camp' },
  toast_cantBuild_danger: { es: 'No con horrores cerca', en: 'Not with horrors near' },
  toast_cantBuild_corridor: { es: 'Solo dentro de una sala', en: 'Only inside a room' },
  toast_cantBuild_taken: { es: 'Acá no se puede', en: 'Not here' },
  toast_campLost: { es: 'Se perdió el campamento de la profundidad {depth}', en: 'The camp at depth {depth} is lost' },
  toast_onlyCamp: { es: 'Solo junto al fuego', en: 'Only by the fire' },
  toast_turbid: { es: 'Odres llenos de agua turbia', en: 'Skins full of turbid water' },
  backpack: { es: 'Mochila', en: 'Backpack' },
  backpackHint: { es: 'Tocá un objeto para usarlo, girarlo o tirarlo; tocá una celda libre para moverlo ahí.', en: 'Tap an item to use, turn or drop it; tap a free cell to move it there.' },
  act_use: { es: 'Usar', en: 'Use' },
  act_turn: { es: 'Girar', en: 'Turn' },
  act_drop: { es: 'Tirar', en: 'Drop' },
  sips: { es: '{n}/4 tragos', en: '{n}/4 sips' },
  action_fountain: { es: 'Llenar odres', en: 'Fill waterskins' },
  action_search: { es: 'Registrar', en: 'Search' },
  toast_pickup: { es: '{item}', en: '{item}' },
  toast_gold: { es: '+{n} de oro', en: '+{n} gold' },
  toast_noRoom: { es: 'No entra en la mochila: {item}', en: 'No room in the backpack: {item}' },
  toast_refilled: { es: 'Odres llenos', en: 'Waterskins full' },
  toast_noSkin: { es: 'No tenés odre', en: 'You have no waterskin' },
  toast_found: { es: 'Encontraste: {list}', en: 'You found: {list}' },
  toast_foundNothing: { es: 'No hay nada', en: 'Nothing here' },
  toast_droppedSome: { es: 'Lo que no entró quedó en el piso', en: 'What did not fit was left on the floor' },
  toast_eating: { es: 'Comiendo…', en: 'Eating…' },
  toast_drinking: { es: 'Bebiendo…', en: 'Drinking…' },
  toast_filling: { es: 'Cargando la lámpara…', en: 'Filling the lamp…' },
  toast_interrupted: { es: 'Interrumpido', en: 'Interrupted' },
  toast_danger: { es: 'No con horrores cerca', en: 'Not with horrors near' },
  toast_empty: { es: 'El odre está vacío', en: 'The waterskin is empty' },
  toast_used: { es: 'Listo', en: 'Done' },
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
    es: 'Sed de sangre: matar te devuelve la mitad de la vida que perdiste hace un momento.',
    en: 'Bloodthirst: a kill wins back half the health you just lost.',
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
  pause: { es: 'Pausa', en: 'Pause' },
  chooseHow: { es: '¿Cómo baja {name}?', en: 'How does {name} descend?' },
  generation: { es: 'Generación {n}', en: 'Generation {n}' },
  age_young: { es: 'Joven', en: 'Young' },
  age_adult: { es: 'En su madurez', en: 'In their prime' },
  age_old: { es: 'En su vejez', en: 'In old age' },
  noTraits: { es: 'Sin rasgos notables', en: 'No notable traits' },
  traits: { es: 'Rasgos', en: 'Traits' },
  chronicle: { es: 'Crónica', en: 'Chronicle' },
  chronicleTitle: { es: 'Crónica de la estirpe', en: 'Chronicle of the family' },
  tree: { es: 'Árbol', en: 'Tree' },
  treeTitle: { es: 'Árbol de la estirpe', en: 'Family tree' },
  founder: { es: 'El fundador, que nunca bajó', en: 'The founder, who never went down' },
  back: { es: 'Volver', en: 'Back' },
  continue: { es: 'Continuar', en: 'Continue' },
  abandon: { es: 'Abandonar la estirpe', en: 'Abandon the family' },
  abandonAsk: {
    es: '¿Abandonar la estirpe? Se pierden todos sus integrantes, la crónica y el mapa.',
    en: 'Abandon the family? All its members, the chronicle and the map will be lost.',
  },
  abandonAskAgain: { es: 'No hay vuelta atrás. ¿Abandonarla para siempre?', en: 'There is no going back. Abandon it forever?' },
  abandonYes: { es: 'Abandonar', en: 'Abandon' },
  abandonSure: { es: 'Sí, para siempre', en: 'Yes, forever' },
  loading: { es: 'Abriendo la cripta…', en: 'Opening the crypt…' },
  status_alive: { es: 'Vive', en: 'Alive' },
  status_fallen: { es: 'Cayó en la profundidad {depth}', en: 'Fell at depth {depth}' },
  status_aged: { es: 'Murió por la edad', en: 'Died of old age' },
  heroLine: { es: '{name} · {class}', en: '{name} · {class}' },
  traitGained: { es: 'Rasgo nuevo: {trait}', en: 'New trait: {trait}' },
  hardToKillSaved: { es: 'Duro de matar: seguís en pie', en: 'Hard to kill: still standing' },
  warningBehind: { es: '¡Detrás tuyo!', en: 'Behind you!' },
  enemy_crawler: { es: 'Rastrero', en: 'Crawler' },
  enemy_husk: { es: 'Hueco', en: 'Husk' },
  enemy_mourner: { es: 'Plañidera', en: 'Mourner' },
  enemy_snuffer: { es: 'Apagavelas', en: 'Snuffer' },
  cause_crawler: { es: 'a manos de un Rastrero', en: 'at the hands of a Crawler' },
  cause_husk: { es: 'a manos de un Hueco', en: 'at the hands of a Husk' },
  cause_mourner: { es: 'por la tinta de una Plañidera', en: "by a Mourner's ink" },
  cause_snuffer: { es: 'a manos de un Apagavelas', en: 'at the hands of a Snuffer' },
  cause_hunger: { es: 'de hambre', en: 'of hunger' },
  cause_thirst: { es: 'de sed', en: 'of thirst' },
  chr_founded: {
    es: 'La estirpe se asienta sobre la cripta. Tres hermanos esperan su turno para bajar.',
    en: 'The family settles above the crypt. Three siblings wait their turn to go down.',
  },
  chr_fell: {
    es: '{name} bajó como {class} y cayó en la profundidad {depth}, {cause}.',
    en: '{name} went down as {class} and fell at depth {depth}, {cause}.',
  },
  chr_born: { es: 'Nació {name}, de la sangre de {parent}.', en: "{name} was born, of {parent}'s blood." },
  chr_inherited: { es: '{name} heredó {trait} de {from}.', en: '{name} inherited {trait} from {from}.' },
  chr_aged: { es: '{name} envejeció: {trait}.', en: '{name} grew older: {trait}.' },
  chr_diedOld: { es: '{name} murió por la edad.', en: '{name} died of old age.' },
  chr_campBuilt: { es: '{name} levantó un campamento en la profundidad {depth}.', en: '{name} pitched a camp at depth {depth}.' },
  chr_campLostNight: { es: 'Algo destrozó el campamento de la profundidad {depth}.', en: 'Something tore apart the camp at depth {depth}.' },
  chr_campLostTime: { es: 'El campamento de la profundidad {depth} se vino abajo con los años.', en: 'The camp at depth {depth} fell apart with the years.' },
  chr_acquired: { es: '{name} ganó {trait} en la profundidad {depth}.', en: '{name} earned {trait} at depth {depth}.' },
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
