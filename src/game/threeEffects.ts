/**
 * Combat and ambience effects for the 3D engine: attack telegraphs on the floor, swings,
 * rings, ink splatter, death stains, the execution slash, embers and dust.
 * Pure presentation; its little randomness comes from a local counter, never the game's.
 */
import * as THREE from 'three';
import type { Point } from '../core/dungeon';
import type { Enemy, World, WorldEvent } from '../core/world';
import { drawSplat } from './art';

const INK = 0x211b17;
const BLOOD = 0x8b2a1f;
const FLAME = 0xd9822b;
const DUST = 0x6b5f52;

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  ttl: number;
  life: number;
  gravity: number;
}

interface Flash {
  mesh: THREE.Object3D;
  ttl: number;
  life: number;
  grow: number;
  material: THREE.Material & { opacity: number };
  baseOpacity: number;
}

function dotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function slashTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#8b2a1f';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.quadraticCurveTo(30, 34, 56, 56);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.quadraticCurveTo(36, 30, 58, 46);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A flat fan on the floor pointing along +x, `half` radians to each side. */
function fan(radius: number, half: number, inner = 0): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(Math.max(0.001, inner), radius, 24, 1, -half, half * 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Effects {
  private readonly particles: Particle[] = [];
  private readonly flashes: Flash[] = [];
  private readonly stains: THREE.Mesh[] = [];
  private readonly telegraphs = new Map<number, { group: THREE.Group; fill: THREE.Mesh; edge: THREE.Mesh | null; line: THREE.Line | null }>();
  private readonly dot = dotTexture();
  private readonly slash = slashTexture();
  private readonly splats: THREE.CanvasTexture[];
  private counter = 0;
  private emberTimer = 0;
  private dustTimer = 0;
  /** Camera shake strength, decaying over time. */
  shake = 0;
  heroFlashUntil = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.splats = [0, 1, 2, 3].map((i) => {
      const t = new THREE.CanvasTexture(drawSplat(64, `splat-${i}`));
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  }

  /** Cosmetic variation from a counter, so the game's random streams stay untouched. */
  private jitter(): number {
    this.counter = (this.counter * 1103515245 + 12345) >>> 0;
    return (this.counter % 10000) / 10000;
  }

  /** Clears everything tied to a level (stains, telegraphs, particles). */
  reset(): void {
    for (const m of this.stains) this.scene.remove(m);
    this.stains.length = 0;
    for (const p of this.particles) this.scene.remove(p.sprite);
    this.particles.length = 0;
    for (const f of this.flashes) this.scene.remove(f.mesh);
    this.flashes.length = 0;
    for (const t of this.telegraphs.values()) this.scene.remove(t.group);
    this.telegraphs.clear();
  }

  onEvents(world: World, events: WorldEvent[], now: number, mode: 'top' | 'first'): void {
    for (const e of events) {
      switch (e.type) {
        case 'attack': {
          const color = e.finisher ? BLOOD : INK;
          const g = fan(e.range, e.arc / 2, e.range * 0.55);
          const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
          mesh.position.set(e.pos.x, 0.03, e.pos.y);
          mesh.rotation.y = -Math.atan2(e.facing.y, e.facing.x);
          this.addFlash(mesh, e.finisher ? 0.28 : 0.18, 0.15, 0.75);
          break;
        }
        case 'enemyHit':
          if (e.burn) this.splatter(e.pos, 2, FLAME, 0.9);
          else this.splatter(e.pos, e.crit ? 12 : 6, e.crit ? BLOOD : INK, 0.8);
          if (e.crit) this.shake = Math.max(this.shake, 0.06);
          break;
        case 'enemyDied':
          this.stain(e.pos);
          this.splatter(e.pos, 16, INK, 0.6);
          break;
        case 'playerHit':
          this.heroFlashUntil = now + 140;
          this.shake = Math.max(this.shake, 0.1);
          // In first person the camera is inside the hero: the red vignette says it instead.
          if (mode === 'top') this.splatter(world.player, 7, BLOOD, 0.9);
          break;
        case 'parry':
          if (mode === 'top') this.spark(world.player);
          this.shake = Math.max(this.shake, 0.05);
          break;
        case 'heal':
          this.ring(world.player, 0.7, BLOOD, 0.4);
          break;
        case 'special':
          if (e.kind === 'flare') this.ring(e.pos, e.radius, FLAME, 0.45);
          else if (e.kind === 'shadowStep') this.splatter(e.pos, 14, INK, 0.5);
          else if (e.kind === 'execution' && e.target) this.slashAt(e.target);
          break;
        case 'executed':
          this.shake = Math.max(this.shake, 0.14);
          break;
        default:
          break;
      }
    }
  }

  update(world: World, dt: number, camera: THREE.Camera, flame: THREE.Vector3 | null, mode: 'top' | 'first'): void {
    this.shake = Math.max(0, this.shake - dt * 0.6);
    this.updateTelegraphs(world);

    // Embers rise from the flame (seen from above), dust behind a running hero.
    if (flame && mode === 'top') {
      this.emberTimer -= dt;
      if (this.emberTimer <= 0) {
        this.emberTimer = 0.12;
        this.particle(flame, new THREE.Vector3((this.jitter() - 0.5) * 0.3, 0.7 + this.jitter() * 0.4, (this.jitter() - 0.5) * 0.3), FLAME, 0.7, 0.04, -0.2);
      }
    }
    if (world.running) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.07;
        const p = new THREE.Vector3(world.player.x - world.facing.x * 0.3, 0.05, world.player.y - world.facing.y * 0.3);
        this.particle(p, new THREE.Vector3(-world.facing.x * 0.6, 0.3, -world.facing.y * 0.6), DUST, 0.4, 0.07, 0);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.ttl -= dt;
      if (p.ttl <= 0) {
        this.scene.remove(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.sprite.position.y < 0.02) p.sprite.position.y = 0.02;
      (p.sprite.material as THREE.SpriteMaterial).opacity = p.ttl / p.life;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.ttl -= dt;
      if (f.ttl <= 0) {
        this.scene.remove(f.mesh);
        this.flashes.splice(i, 1);
        continue;
      }
      const k = f.ttl / f.life;
      f.material.opacity = f.baseOpacity * k;
      const s = 1 + f.grow * (1 - k);
      f.mesh.scale.set(s, f.mesh.scale.y, s);
      if (f.mesh instanceof THREE.Sprite || (f.mesh as THREE.Mesh).userData.billboard) f.mesh.quaternion.copy(camera.quaternion);
    }
  }

  /** The area each horror is about to strike, filling up in red; a red line for spitters. */
  private updateTelegraphs(world: World): void {
    const active = new Set<number>();
    for (const enemy of world.enemies) {
      if (enemy.state !== 'windup' || !enemy.visible) continue;
      active.add(enemy.id);
      const t = this.telegraphs.get(enemy.id) ?? this.makeTelegraph(enemy);
      const progress = 1 - Math.max(0, enemy.timer) / enemy.def.windup;
      t.group.position.set(enemy.pos.x, 0.025, enemy.pos.y);
      t.group.rotation.y = -Math.atan2(enemy.strikeDir.y, enemy.strikeDir.x);
      if (t.line) {
        const geometry = t.line.geometry as THREE.BufferGeometry;
        const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
        pos.setXYZ(0, enemy.pos.x, 0.7, enemy.pos.y);
        pos.setXYZ(1, world.player.x, 0.7, world.player.y);
        pos.needsUpdate = true;
        (t.line.material as THREE.LineBasicMaterial).opacity = 0.3 + 0.6 * progress;
      } else {
        t.fill.scale.set(0.4 + 0.6 * progress, 1, 0.4 + 0.6 * progress);
        (t.fill.material as THREE.MeshBasicMaterial).opacity = (enemy.def.parryable ? 0.18 : 0.26) + 0.3 * progress;
      }
    }
    for (const [id, t] of this.telegraphs) {
      if (active.has(id)) continue;
      this.scene.remove(t.group);
      if (t.line) this.scene.remove(t.line);
      this.telegraphs.delete(id);
    }
  }

  private makeTelegraph(enemy: Enemy) {
    const group = new THREE.Group();
    const reach = enemy.def.range + 0.35;
    const half = enemy.kind === 'husk' ? Math.PI / 1.5 : Math.PI / 2.4;
    const material = new THREE.MeshBasicMaterial({ color: BLOOD, transparent: true, opacity: 0.2, depthWrite: false });
    const fill = new THREE.Mesh(fan(reach, half), material);
    let edge: THREE.Mesh | null = null;
    let line: THREE.Line | null = null;
    if (enemy.def.ranged) {
      fill.visible = false;
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: BLOOD, transparent: true, opacity: 0.5 }));
      this.scene.add(line);
    } else if (!enemy.def.parryable) {
      // Blows that cannot be parried get a hard edge.
      edge = new THREE.Mesh(fan(reach, half, reach - 0.06), new THREE.MeshBasicMaterial({ color: BLOOD, transparent: true, opacity: 0.85, depthWrite: false }));
      group.add(edge);
    }
    group.add(fill);
    this.scene.add(group);
    const entry = { group, fill, edge, line };
    this.telegraphs.set(enemy.id, entry);
    return entry;
  }

  private particle(at: THREE.Vector3, vel: THREE.Vector3, color: number, life: number, size: number, gravity: number): void {
    if (this.particles.length > 160) return;
    const material = new THREE.SpriteMaterial({ map: this.dot, color, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(at);
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    this.particles.push({ sprite, vel, ttl: life, life, gravity });
  }

  private splatter(pos: Point, count: number, color: number, height: number): void {
    for (let i = 0; i < count; i++) {
      const a = this.jitter() * Math.PI * 2;
      const speed = 1 + this.jitter() * 1.8;
      const vel = new THREE.Vector3(Math.cos(a) * speed, 0.8 + this.jitter() * 1.4, Math.sin(a) * speed);
      this.particle(new THREE.Vector3(pos.x, height, pos.y), vel, color, 0.45, 0.07 + this.jitter() * 0.05, 6);
    }
  }

  private stain(pos: Point): void {
    const texture = this.splats[this.stains.length % this.splats.length];
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.95),
      new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.9 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = this.jitter() * Math.PI;
    mesh.position.set(pos.x, 0.006 + this.stains.length * 0.0005, pos.y);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.stains.push(mesh);
  }

  private ring(pos: Point, radius: number, color: number, life: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.86, radius, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    mesh.position.set(pos.x, 0.04, pos.y);
    mesh.scale.set(0.6, 1, 0.6);
    this.addFlash(mesh, life, 0.6, 0.85);
  }

  private spark(pos: Point): void {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particle(new THREE.Vector3(pos.x, 1, pos.y), new THREE.Vector3(Math.cos(a) * 2.2, Math.sin(a) * 1.5 + 0.5, Math.sin(a) * 0.6), FLAME, 0.3, 0.06, 2);
    }
  }

  private slashAt(pos: Point): void {
    const material = new THREE.SpriteMaterial({ map: this.slash, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(pos.x, 1, pos.y);
    sprite.scale.set(1.4, 1.4, 1);
    this.addFlash(sprite, 0.4, 0.15, 1);
  }

  private addFlash(mesh: THREE.Object3D, life: number, grow: number, opacity: number): void {
    const material = (mesh as THREE.Mesh).material as THREE.Material & { opacity: number };
    this.scene.add(mesh);
    this.flashes.push({ mesh, ttl: life, life, grow, material, baseOpacity: opacity });
  }
}
