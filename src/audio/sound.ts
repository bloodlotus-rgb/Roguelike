import type { EnemyState, World, WorldEvent } from '../core/world';

/**
 * Procedural sound with the Web Audio API: no audio files. Ambience, footsteps, the
 * flame, a heartbeat when hurt, and cues that let you hear horrors before you see them.
 *
 * This is presentation, not game logic: its randomness uses a local generator and never
 * affects the world.
 */

const STORAGE_KEY = 'estirpe.muted';

/** Tiny local generator for sound variation (not game randomness). */
let noiseSeed = 0x9e3779b9;
function rand(): number {
  noiseSeed ^= noiseSeed << 13;
  noiseSeed ^= noiseSeed >>> 17;
  noiseSeed ^= noiseSeed << 5;
  return ((noiseSeed >>> 0) % 1_000_000) / 1_000_000;
}
const between = (a: number, b: number) => a + (b - a) * rand();

interface NoiseOptions {
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  duration: number;
  gain: number;
  attack?: number;
  pan?: number;
}

interface ToneOptions {
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  duration: number;
  gain: number;
  attack?: number;
  pan?: number;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: boolean;
  private last = 0;
  private timers = { step: 0, crackle: 0, heart: 0, ambient: 4, whisper: 0 };
  private enemyTimers = new Map<number, number>();
  private enemyStates = new Map<number, EnemyState>();

  constructor() {
    let muted = false;
    try {
      muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Storage may be unavailable; default to sound on.
    }
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Not remembered, that's all.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  start(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(compressor);
      this.noise = this.makeNoise();
      this.startDrone();
    }
    void this.ctx.resume();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  /** Called every frame with the world and the events of that frame. */
  update(world: World, events: WorldEvent[], paused: boolean): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now() / 1000;
    const dt = this.last ? Math.min(0.1, now - this.last) : 0;
    this.last = now;
    if (paused || world.dead) {
      for (const e of events) if (e.type === 'died') this.death();
      return;
    }
    for (const event of events) this.onEvent(world, event);
    this.loops(world, dt);
    this.horrors(world, dt);
  }

  // Events --------------------------------------------------------------------

  private onEvent(world: World, event: WorldEvent): void {
    const pan = (p: { x: number; y: number }) => Math.max(-1, Math.min(1, (p.x - world.player.x) / 6));
    switch (event.type) {
      case 'attack':
        this.playNoise({ filter: 'bandpass', freq: event.finisher ? 500 : 900, freqEnd: 2400, q: 1.2, duration: 0.16, gain: 0.25 });
        break;
      case 'enemyHit':
        if (event.burn) {
          this.playNoise({ filter: 'highpass', freq: 3000, duration: 0.05, gain: 0.05, pan: pan(event.pos) });
          break;
        }
        this.playTone({ freq: 140, freqEnd: 60, type: 'sine', duration: 0.18, gain: event.crit ? 0.55 : 0.35, pan: pan(event.pos) });
        this.playNoise({ filter: 'lowpass', freq: 1500, duration: 0.09, gain: event.crit ? 0.35 : 0.2, pan: pan(event.pos) });
        break;
      case 'enemyDied':
        this.playNoise({ filter: 'lowpass', freq: 700, freqEnd: 200, duration: 0.5, gain: 0.25, pan: pan(event.pos) });
        break;
      case 'playerHit':
        this.playTone({ freq: 90, freqEnd: 40, type: 'sine', duration: 0.3, gain: 0.7 });
        this.playNoise({ filter: 'bandpass', freq: 600, q: 0.8, duration: 0.2, gain: 0.25 });
        break;
      case 'parry':
        for (const f of [620, 937, 1330, 1810]) this.playTone({ freq: f, type: 'triangle', duration: 0.7, gain: 0.12 });
        break;
      case 'executed':
        this.playTone({ freq: 70, freqEnd: 30, type: 'sine', duration: 0.6, gain: 0.8 });
        this.playNoise({ filter: 'lowpass', freq: 2000, freqEnd: 300, duration: 0.3, gain: 0.4 });
        break;
      case 'dodge':
        this.playNoise({ filter: 'bandpass', freq: 400, freqEnd: 1200, q: 0.7, duration: 0.22, gain: 0.18 });
        break;
      case 'leap':
        // A rush of air over the drop, then far below, nothing.
        this.playNoise({ filter: 'lowpass', freq: 900, freqEnd: 140, duration: 0.5, gain: 0.22 });
        this.playTone({ freq: 55, freqEnd: 40, type: 'sine', duration: 0.5, gain: 0.25 });
        break;
      case 'special':
        if (event.kind === 'flare') {
          this.playNoise({ filter: 'lowpass', freq: 300, freqEnd: 4000, duration: 0.5, gain: 0.45 });
        } else if (event.kind === 'shadowStep') {
          this.playNoise({ filter: 'bandpass', freq: 2500, freqEnd: 300, q: 1, duration: 0.4, gain: 0.25 });
        }
        break;
      case 'pickup':
        this.playTone({ freq: 520, freqEnd: 780, type: 'triangle', duration: 0.18, gain: 0.12 });
        break;
      case 'heal':
        this.playTone({ freq: 220, freqEnd: 330, type: 'sine', duration: 0.4, gain: 0.15 });
        break;
      case 'died':
        this.death();
        break;
      default:
        break;
    }
  }

  private death(): void {
    this.playTone({ freq: 110, freqEnd: 27, type: 'sawtooth', duration: 2.5, gain: 0.25 });
    this.playNoise({ filter: 'lowpass', freq: 400, freqEnd: 60, duration: 2.5, gain: 0.3, attack: 0.2 });
  }

  // Continuous sounds ---------------------------------------------------------

  private loops(world: World, dt: number): void {
    const t = this.timers;
    // Footsteps.
    const moving = world.action.type === 'none' || world.action.type === 'attack' ? this.isMoving(world) : false;
    t.step -= dt;
    if (moving && t.step <= 0) {
      t.step = world.running ? 0.27 : 0.46;
      this.playNoise({ filter: 'lowpass', freq: world.running ? 500 : 350, duration: 0.07, gain: world.running ? 0.22 : 0.12 });
    }
    // The flame crackles; it gutters when it is running out.
    const light = world.survival.light;
    t.crackle -= dt;
    if (t.crackle <= 0) {
      t.crackle = light < 20 ? between(0.05, 0.25) : between(0.2, 0.9);
      const gain = light <= 0 ? 0 : light < 20 ? 0.09 : 0.04;
      this.playNoise({ filter: 'highpass', freq: between(2500, 6000), duration: 0.02, gain, pan: 0.15 });
    }
    // Heartbeat below a third of health, faster the closer to death.
    const health = world.survival.health / world.maxHealth;
    t.heart -= dt;
    if (health < 0.35 && t.heart <= 0) {
      t.heart = 0.5 + health * 1.4;
      this.playTone({ freq: 58, freqEnd: 40, type: 'sine', duration: 0.16, gain: 0.6 });
      setTimeout(() => this.playTone({ freq: 52, freqEnd: 38, type: 'sine', duration: 0.14, gain: 0.45 }), 180);
    }
    // Distant sounds of the dungeon.
    t.ambient -= dt;
    if (t.ambient <= 0) {
      t.ambient = between(5, 14);
      this.ambientEvent();
    }
  }

  private lastPos = { x: 0, y: 0 };
  private isMoving(world: World): boolean {
    const moved = Math.hypot(world.player.x - this.lastPos.x, world.player.y - this.lastPos.y) > 0.005;
    this.lastPos = { ...world.player };
    return moved;
  }

  /** Horrors sound before they can be seen: skitter, heavy steps, whispers, wails. */
  private horrors(world: World, dt: number): void {
    for (const enemy of world.enemies) {
      const prev = this.enemyStates.get(enemy.id);
      this.enemyStates.set(enemy.id, enemy.state);
      if (enemy.state === 'dead') continue;
      const dx = enemy.pos.x - world.player.x;
      const dy = enemy.pos.y - world.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 10) continue;
      const pan = Math.max(-1, Math.min(1, dx / 6));
      const near = 1 - distance / 10;

      // Every wind-up has its warning: this is also the cue for a parry.
      if (enemy.state === 'windup' && prev !== 'windup') {
        if (enemy.kind === 'husk') this.playTone({ freq: 70, freqEnd: 45, type: 'sawtooth', duration: 0.9, gain: 0.25 * near + 0.05, pan });
        else if (enemy.kind === 'mourner') this.playTone({ freq: 700, freqEnd: 1100, type: 'sine', duration: 0.55, gain: 0.12 * near + 0.03, pan });
        else this.playNoise({ filter: 'bandpass', freq: 1800, freqEnd: 3500, q: 3, duration: enemy.def.windup, gain: 0.12 * near + 0.03, pan });
      }

      let timer = (this.enemyTimers.get(enemy.id) ?? between(0, 1)) - dt;
      if (timer <= 0) {
        timer = this.horrorSound(enemy.kind, enemy.state, enemy.visible, distance, near, pan);
      }
      this.enemyTimers.set(enemy.id, timer);
    }
  }

  /** Plays the idle or chase sound of a horror and returns seconds until the next one. */
  private horrorSound(kind: string, state: EnemyState, visible: boolean, distance: number, near: number, pan: number): number {
    const chasing = state === 'chase';
    switch (kind) {
      case 'crawler':
        if (!chasing && distance > 6) return between(1, 3);
        for (let i = 0; i < 3; i++) {
          setTimeout(() => this.playNoise({ filter: 'highpass', freq: 3500, duration: 0.015, gain: 0.06 * near, pan }), i * 35);
        }
        return chasing ? between(0.15, 0.35) : between(1.5, 4);
      case 'husk':
        if (!chasing) return between(2, 5);
        this.playTone({ freq: 50, freqEnd: 35, type: 'sine', duration: 0.25, gain: 0.35 * near, pan });
        return 0.9;
      case 'mourner':
        this.playTone({ freq: between(300, 380), freqEnd: between(220, 260), type: 'sine', duration: 1.6, gain: 0.05 * near, pan, attack: 0.5 });
        return between(4, 9);
      case 'snuffer':
        // A whisper when it is close and you cannot see it.
        if (visible || distance > 6) return between(1, 2);
        this.playNoise({ filter: 'bandpass', freq: between(1500, 2600), q: 4, duration: 0.9, gain: 0.07 * near + 0.02, pan, attack: 0.3 });
        return between(1.5, 3.5);
      default:
        return 3;
    }
  }

  private ambientEvent(): void {
    const pan = between(-1, 1);
    const roll = rand();
    if (roll < 0.35) {
      // Water dripping somewhere.
      const f = between(900, 1500);
      this.playTone({ freq: f, freqEnd: f * 0.6, type: 'sine', duration: 0.12, gain: 0.08, pan });
      setTimeout(() => this.playTone({ freq: f * 0.9, freqEnd: f * 0.5, type: 'sine', duration: 0.1, gain: 0.03, pan }), 260);
    } else if (roll < 0.6) {
      // A groan, far away.
      this.playNoise({ filter: 'bandpass', freq: between(180, 320), q: 6, duration: 2.2, gain: 0.12, pan, attack: 0.8 });
    } else if (roll < 0.8) {
      // Chains.
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.playNoise({ filter: 'bandpass', freq: between(3000, 5000), q: 8, duration: 0.04, gain: 0.05, pan }), i * between(60, 140));
      }
    } else {
      // Stone settling.
      this.playNoise({ filter: 'lowpass', freq: 250, duration: 0.8, gain: 0.18, pan, attack: 0.05 });
    }
  }

  // Building blocks -----------------------------------------------------------

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
    return buffer;
  }

  /** Low drone under everything: two detuned tones and filtered noise, slowly breathing. */
  private startDrone(): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.connect(gain);
    gain.connect(this.master!);
    for (const f of [41, 41.6, 61.7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start();
    }
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.5;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
  }

  private output(pan = 0): AudioNode {
    const ctx = this.ctx!;
    if (!ctx.createStereoPanner) return this.master!;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.master!);
    return panner;
  }

  private envelope(duration: number, gain: number, attack = 0.005): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + duration);
    return g;
  }

  private playNoise(o: NoiseOptions): void {
    if (!this.ctx || !this.noise || o.gain <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) filter.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.duration);
    filter.Q.value = o.q ?? 1;
    const env = this.envelope(o.duration, o.gain, o.attack);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.output(o.pan));
    src.start(t, rand() * 1.5);
    src.stop(t + (o.attack ?? 0.005) + o.duration + 0.05);
  }

  private playTone(o: ToneOptions): void {
    if (!this.ctx || o.gain <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.duration);
    const env = this.envelope(o.duration, o.gain, o.attack);
    osc.connect(env);
    env.connect(this.output(o.pan));
    osc.start(t);
    osc.stop(t + (o.attack ?? 0.005) + o.duration + 0.05);
  }
}
