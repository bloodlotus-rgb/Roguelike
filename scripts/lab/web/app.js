const $ = selector => document.querySelector(selector);
const node = (tag, content, className) => {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
};
const labeled = (title, value) => {
  const pill = node('span', undefined, 'pill');
  pill.append(title + ' ', node('strong', value));
  return pill;
};
function list(rows) {
  const element = node('dl');
  for (const [label, value] of rows) element.append(node('dt', label), node('dd', value));
  return element;
}
const stateNames = { open: 'Abierto', closed: 'Cerrado', blocked: 'Bloqueado', flooded: 'Anegado', destroyed: 'Destruido' };
const reasons = {
  sated: 'Saciada en el turno de ingesta',
  'no-food': 'Buscó alimento, sin micelio disponible',
  'no-improvement': 'Ningún bocado redujo el déficit',
  'budget-covered': 'Comió lo suficiente para cubrir el déficit',
  'partial-budget': 'Comió y redujo el déficit',
};
let state, selectedRoom, selectedAnimal, busy = false;
const known = id => id === state.passage ? 'Paso de detrito' : id === state.gate ? 'Compuerta de hierro' : id;
const roomName = habitat => state.rooms.find(room => room.habitat === habitat)?.name ?? 'Hábitat ' + habitat + ' (fuera de mapa)';

function setStatus(text, error = false) {
  $('#status').textContent = text;
  $('#status').classList.toggle('error', error);
}

function updateButtons() {
  for (const button of document.querySelectorAll('button')) button.disabled = busy || !state;
  $('#mode').textContent = busy ? 'Procesando' : 'En pausa';
}

function renderMap() {
  const map = $('#map'), switches = $('#switches');
  map.replaceChildren();
  switches.replaceChildren();
  state.rooms.forEach((room, i) => {
    if (i) {
      const previous = state.rooms[i - 1];
      const cut = state.connections.find(edge => edge.regions.includes(room.region) && edge.regions.includes(previous.region));
      const edge = node('span', cut ? cut.state === 'closed' ? '─×─' : '───' : '', 'edge ' + (cut?.state ?? ''));
      if (cut) edge.title = known(cut.id) + ' · ' + stateNames[cut.state];
      edge.setAttribute('aria-hidden', 'true');
      map.append(edge);
    }
    const card = node('button', undefined, 'room');
    card.type = 'button';
    card.id = 'room-' + i;
    card.setAttribute('aria-pressed', String(room.region === selectedRoom));
    card.append(node('strong', room.name), node('small', room.depth + ' m de profundidad'));
    if (i === 1) card.append(node('span', 'Fuente orgánica', 'room-role'));
    if (i === 2) {
      card.append(node('span', room.fungus ? 'Micelio visible' : 'Sin micelio', 'room-role'),
        node('small', room.animals.length + (room.animals.length === 1 ? ' presa' : ' presas')));
    }
    card.onclick = () => {
      selectedRoom = room.region;
      selectedAnimal = undefined;
      render();
      $('#' + card.id).focus();
    };
    map.append(card);
  });

  for (const id of [state.passage, state.gate]) {
    const cut = state.connections.find(edge => edge.id === id);
    if (!cut) continue;
    const row = node('div', undefined, 'switch');
    const copy = node('div');
    const label = id === state.gate ? cut.state === 'open' ? 'Abierta' : 'Cerrada' : stateNames[cut.state];
    const details = id === state.passage ? ' · ' + Math.max(...cut.detritusLimits) + ' M/h de capacidad' : ' · paso físico, 0 M/h de detrito';
    copy.append(node('h3', known(id)), node('p', label + details, cut.state));
    const opened = cut.state === 'open';
    const button = node('button', (opened ? 'Cerrar ' : 'Abrir ') + (id === state.passage ? 'paso' : 'compuerta'));
    button.id = id === state.passage ? 'passage-button' : 'gate-button';
    button.type = 'button';
    button.onclick = () => command(
      { kind: 'barrier', connector: id, state: opened ? 'closed' : 'open' },
      known(id) + (opened ? ' · cierre registrado.' : ' · apertura registrada.'), button.id,
    );
    row.append(copy, button);
    switches.append(row);
  }
}

function renderInspector() {
  const container = $('#inspector');
  const room = state.rooms.find(room => room.region === selectedRoom);
  const { stock, fungus } = room;
  const connectionsExpanded = container.querySelector('details')?.open ?? false;
  container.replaceChildren(node('h3', room.name), node('p', 'Región ' + room.region + ' · ' + room.area + ' m² de hábitat', 'fine'));
  const stocks = node('div', undefined, 'summary');
  stocks.append(labeled('Detrito', stock.detritus.matter + ' M / ' + stock.detritus.chemicalEnergy + ' E'),
    labeled('Agua', stock.water + ' A'), labeled('Minerales', stock.mineralMatter + ' M'));
  container.append(stocks, list([
    ['Micelio', fungus ? fungus.matter + ' M / ' + fungus.chemicalEnergy + ' E' : 'Ausente'],
    ['Reserva del micelio', fungus ? fungus.storedEnergy + ' E' : '—'],
    ...(room.region === state.rooms[1].region ? [['Cuota de la fuente', state.source.used + ' / ' + state.source.quota + ' lotes']] : []),
  ]), node('hr'), node('h3', 'Criaturas'));
  if (!room.animals.length) container.append(node('p', 'Sin criaturas vivas en esta habitación.', 'minor'));
  else {
    const choices = node('div', undefined, 'summary');
    const animal = room.animals.find(item => item.id === selectedAnimal) ?? room.animals[0];
    for (const candidate of room.animals) {
      const choice = node('button', 'Presa #' + candidate.id, 'prey');
      choice.type = 'button';
      choice.id = 'prey-' + candidate.id;
      choice.setAttribute('aria-pressed', String(candidate.id === animal.id));
      choice.onclick = () => {
        selectedAnimal = candidate.id;
        renderInspector();
        $('#' + choice.id).focus();
      };
      choices.append(choice);
    }
    const feeding = animal.feeding;
    container.append(choices, list([
      ['Edad', animal.age + ' h · ' + (animal.mature ? 'madura' : 'juvenil')],
      ['Masa / masa adulta', animal.body.matter + ' / ' + animal.adultMatter + ' M'],
      ['Energía química', animal.body.chemicalEnergy + ' E'],
      ['Reserva', animal.body.storedEnergy + ' E'],
      ['Mantenimiento', animal.maintenance + ' E/h'],
    ]), node('p', feeding ? 'h' + feeding.hour + ' · ' + reasons[feeding.decision.reason] +
      ' · Déficit ' + feeding.decision.deficit + ' → ' + feeding.decision.remainingDeficit + ' E.' : 'Todavía sin evaluación de ingesta.', 'fine'));
  }
  const details = node('details');
  details.open = connectionsExpanded;
  const connections = node('ul', undefined, 'connection-list');
  for (const cut of state.connections.filter(edge => edge.from === room.habitat || edge.to === room.habitat)) {
    const fromHere = cut.from === room.habitat;
    connections.append(node('li', known(cut.id) + ' · ' + stateNames[cut.state] + ' · ' +
      roomName(fromHere ? cut.to : cut.from) + ' · ' + cut.detritusLimits[fromHere ? 0 : 1] + ' M/h saliente'));
  }
  details.append(node('summary', 'Conexiones físicas del hábitat'), connections);
  container.append(node('hr'), details);
}

function renderJournal() {
  const journal = $('#journal');
  journal.replaceChildren();
  $('#journal-range').textContent = state.journal.length ? 'Más reciente arriba' : 'Hora inicial';
  if (!state.journal.length) {
    journal.append(node('p', 'Avanzá el reloj para ver los cambios del sector.', 'minor'));
    return;
  }
  const sector = new Set(state.rooms.map(room => room.habitat));
  for (const event of [...state.journal].reverse()) {
    const row = node('article', undefined, 'event');
    const copy = node('div'), lines = node('ul');
    row.append(node('time', 'h' + event.hour), copy);
    if (event.kind === 'barrier') {
      copy.append(node('strong', known(event.connector.connector) + ' · ' + (event.connector.state === 'open' ? 'se abrió' : 'se cerró')));
    } else {
      for (const flow of event.flows.passive) {
        if (!sector.has(flow.fromHabitat) && !sector.has(flow.toHabitat)) continue;
        const cargo = flow.cargo;
        const amounts = cargo.detritus.matter ? cargo.detritus.matter + ' M de detrito y ' + cargo.detritus.chemicalEnergy + ' E' :
          cargo.water ? cargo.water + ' A de agua' : cargo.mineralMatter + ' M de minerales';
        lines.append(node('li', amounts + ' · ' + roomName(flow.fromHabitat) + ' → ' + roomName(flow.toHabitat)));
      }
      for (const flow of event.flows.chemical) {
        if (flow.kind === 'source') lines.append(node('li', 'La fuente entregó ' + flow.lots + ' lotes de detrito a la Cámara de aporte.'));
      }
      for (const entry of event.entries) {
        if (entry.phase === 'grow') {
          const before = entry.debits.find(account => account.kind === 'fungus')?.stock;
          const after = entry.credits.find(account => account.kind === 'fungus')?.stock;
          lines.append(node('li', 'Asimilación de detrito · tejido ' +
            (before?.matter ?? 0) + ' → ' + (after?.matter ?? 0) + ' M.'));
        }
      }
      for (const decision of event.feeding) {
        lines.append(node('li', 'Presa #' + decision.animal + ' · ' + reasons[decision.reason].toLowerCase() +
          (decision.bite ? ' (' + decision.bite + ' M).' : '.')));
      }
      for (const entry of event.entries) {
        if (entry.phase === 'regress') {
          const before = entry.debits.find(account => account.kind === 'fungus')?.stock;
          const after = entry.credits.find(account => account.kind === 'fungus')?.stock;
          lines.append(node('li', 'Regresión del micelio · tejido ' + (before?.matter ?? 0) + ' → ' + (after?.matter ?? 0) + ' M.'));
        } else if (entry.phase === 'die') {
          const dead = entry.debits.find(account => account.kind === 'animal');
          lines.append(node('li', dead ? 'Murió la presa #' + dead.id + ' al no sostener su mantenimiento.' : 'El micelio murió por insuficiencia metabólica.'));
        }
      }
      if (lines.children.length) copy.append(lines);
      else copy.append(node('p', 'Sin cruces ni ingestas visibles en el sector.', 'minor'));
      const audit = node('details');
      const { opening, closing, imported, exported, dissipated } = event.audit;
      audit.append(node('summary', 'Balance exacto · calor ' + dissipated + ' E'),
        list([
          ['Materia inicial + entrada', opening.matter + ' + ' + imported.matter + ' M'],
          ['Materia final + salida', closing.matter + ' + ' + exported.matter + ' M'],
          ['Agua inicial + entrada', opening.water + ' + ' + imported.water + ' A'],
          ['Agua final + salida', closing.water + ' + ' + exported.water + ' A'],
          ['Energía inicial + entrada', opening.chemicalEnergy + ' + ' + imported.chemicalEnergy + ' E'],
          ['Energía final + salida + calor', closing.chemicalEnergy + ' + ' + exported.chemicalEnergy + ' + ' + dissipated + ' E'],
        ]), node('p', 'Diario ' + event.digest.slice(0, 16), 'minor'));
      copy.append(audit);
    }
    journal.append(row);
  }
  journal.scrollTop = 0;
}

function render() {
  selectedRoom ??= state.rooms[2].region;
  $('#hour').textContent = 'h' + state.hour;
  $('#seed').textContent = 'Semilla ' + state.seed;
  renderMap();
  renderInspector();
  renderJournal();
  updateButtons();
}

async function read(response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error);
  return payload;
}

async function command(action, success, focusId) {
  if (busy) return;
  busy = true;
  updateButtons();
  setStatus('Aplicando el comando…');
  try {
    state = await read(await fetch('/api/command', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: state.revision, action }),
    }));
    if (action.kind === 'reset' || action.kind === 'load') selectedAnimal = undefined;
    render();
    setStatus(success);
  } catch (error) {
    setStatus(error.message, true);
    try {
      state = await read(await fetch('/api/state'));
      render();
    } catch {
      setStatus(error.message + ' No se pudo actualizar la vista.', true);
    }
  } finally {
    busy = false;
    updateButtons();
    if (focusId) $('#' + focusId)?.focus();
  }
}

for (const button of document.querySelectorAll('[data-step]')) {
  button.onclick = () => command({ kind: 'advance', hours: Number(button.dataset.step) }, 'Horas confirmadas en el diario.', button.id);
}
$('#reset').onclick = () => command({ kind: 'reset' }, 'Escenario reiniciado con la misma semilla.');
$('#load').onclick = () => $('#file').click();
$('#file').onchange = async event => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    if (file.size > 1_048_576) throw new Error('El archivo supera 1 MiB.');
    await command({ kind: 'load', save: JSON.parse(await file.text()) }, 'Sesión reanudada.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    event.target.value = '';
  }
};
$('#save').onclick = async () => {
  try {
    const data = await read(await fetch('/api/save'));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = node('a');
    link.href = url;
    link.download = 'estirpe-laboratorio-h' + data.snapshot.chemical.accounts[0] + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Guardado descargado.');
  } catch (error) {
    setStatus(error.message, true);
  }
};
updateButtons();
try {
  state = await read(await fetch('/api/state'));
  render();
  setStatus('Elegí una habitación o avanzá el reloj.');
} catch (error) {
  setStatus(error.message, true);
}
