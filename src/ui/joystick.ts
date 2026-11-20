import type { MoveInput } from '../core/world';

/**
 * Floating virtual joystick: touching anywhere on the left half of the screen
 * places the stick under the thumb. Also reads WASD and the arrow keys.
 */
export class Controls {
  private touchVector: MoveInput = { x: 0, y: 0 };
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly maxDistance = 56;

  constructor(private readonly zone: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    zone.appendChild(this.base);

    zone.addEventListener('pointerdown', this.onDown);
    zone.addEventListener('pointermove', this.onMove);
    zone.addEventListener('pointerup', this.onUp);
    zone.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
  }

  get vector(): MoveInput {
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      const length = Math.hypot(kx, ky);
      return { x: kx / length, y: ky / length };
    }
    return this.touchVector;
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  reset(): void {
    this.keys.clear();
    this.release();
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.zone.setPointerCapture(e.pointerId);
    const rect = this.zone.getBoundingClientRect();
    this.origin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.base.style.left = `${this.origin.x}px`;
    this.base.style.top = `${this.origin.y}px`;
    this.base.classList.add('active');
    this.setKnob(0, 0);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const rect = this.zone.getBoundingClientRect();
    let dx = e.clientX - rect.left - this.origin.x;
    let dy = e.clientY - rect.top - this.origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance > this.maxDistance) {
      dx = (dx / distance) * this.maxDistance;
      dy = (dy / distance) * this.maxDistance;
    }
    this.setKnob(dx, dy);
    this.touchVector = { x: dx / this.maxDistance, y: dy / this.maxDistance };
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  };

  private release() {
    this.pointerId = null;
    this.touchVector = { x: 0, y: 0 };
    this.base.classList.remove('active');
  }

  private setKnob(dx: number, dy: number) {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}
