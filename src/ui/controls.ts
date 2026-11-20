import type { ControlInput } from '../core/world';

type Vector = { x: number; y: number };

const ATTACK_KEYS = ['Space', 'KeyJ'];
const DODGE_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyK'];

/**
 * Floating virtual joystick (touching anywhere outside the buttons places the stick
 * under the thumb) plus the attack and dodge buttons. Also reads the keyboard.
 */
export class Controls {
  private touchVector: Vector = { x: 0, y: 0 };
  private attackTouch = false;
  private dodgeTouch = false;
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly maxDistance = 56;

  constructor(
    private readonly zone: HTMLElement,
    attackButton: HTMLElement,
    dodgeButton: HTMLElement,
  ) {
    this.bindButton(attackButton, (down) => (this.attackTouch = down));
    this.bindButton(dodgeButton, (down) => (this.dodgeTouch = down));
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
    window.addEventListener('keydown', (e) => {
      if (ATTACK_KEYS.includes(e.code) || DODGE_KEYS.includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
  }

  get input(): ControlInput {
    const k = this.keys;
    return {
      move: this.vector,
      attack: this.attackTouch || ATTACK_KEYS.some((code) => k.has(code)),
      dodge: this.dodgeTouch || DODGE_KEYS.some((code) => k.has(code)),
    };
  }

  private get vector(): Vector {
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      const length = Math.hypot(kx, ky);
      return { x: kx / length, y: ky / length };
    }
    return this.touchVector;
  }

  reset(): void {
    this.keys.clear();
    this.attackTouch = false;
    this.dodgeTouch = false;
    this.release();
  }

  private bindButton(button: HTMLElement, set: (down: boolean) => void): void {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        button.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail for synthetic events; the button still works without it.
      }
      button.classList.add('pressed');
      set(true);
    });
    const up = () => {
      button.classList.remove('pressed');
      set(false);
    };
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    try {
      this.zone.setPointerCapture(e.pointerId);
    } catch {
      // See bindButton.
    }
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
