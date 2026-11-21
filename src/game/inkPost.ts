/**
 * One post-processing pass over the finished frame, in the spirit of a drawing on paper:
 *
 * - Pen outlines wherever depth jumps (the silhouettes of walls, steps, edges of holes),
 *   drawn only where there is light: in the dark, ink on ink.
 * - Lines that boil: the whole drawing shifts by a fraction of a pixel a few times a
 *   second, like hand-drawn animation redrawn frame by frame.
 * - Paper: a faint grain and fibres in the lit parts.
 * - A warm, slightly faded tone, as of old paper under a flame.
 *
 * Everything is one full-screen pass reading the frame and its depth, so it stays cheap.
 * `?post=0` turns it off.
 */
import * as THREE from 'three';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragment = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uFrame;
uniform float uLine;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float linearDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec2 px = 1.0 / uResolution;
  // Boil: the drawing is redrawn a few times a second, each time a hair off. The shift
  // wanders smoothly across the page and snaps to whole pixels, so lines stay crisp.
  vec2 drift = vec2(noise(vUv * 5.0 + uFrame * 1.7), noise(vUv * 5.0 + uFrame * 1.7 + 9.0)) - 0.5;
  vec2 uv = (floor(vUv * uResolution + drift * 2.2) + 0.5) / uResolution;
  vec4 color = texture2D(tColor, uv);

  // Outlines where depth jumps, relative to the distance, so far and near read alike.
  float d = linearDepth(uv);
  float jump = 0.0;
  vec2 o = px * uLine;
  for (int i = 0; i < 4; i++) {
    vec2 dir = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    float n = linearDepth(uv + dir * o);
    jump = max(jump, (n - d) / max(min(n, d), 0.05));
  }
  // The line wavers a little in weight, like a pen.
  float pressure = 0.75 + 0.5 * noise(vUv * uResolution / 40.0 + uFrame * 3.1);
  float edge = smoothstep(0.03 * pressure, 0.08 * pressure, jump);
  color.rgb *= 1.0 - edge * 0.92;

  // Paper: grain and long fibres, only where there is light to see them.
  vec2 p = vUv * uResolution;
  float grain = noise(p / 2.2) * 0.6 + noise(p / 7.0) * 0.4;
  float fibre = smoothstep(0.62, 0.9, noise(vec2(p.x / 60.0, p.y / 3.0) + noise(p / 25.0) * 2.0));
  float paper = 0.93 + 0.11 * grain - 0.08 * fibre;
  color.rgb *= paper;

  // Warm, a touch faded, like old paper under a flame.
  color.rgb = pow(color.rgb, vec3(0.98, 1.0, 1.06));

  gl_FragColor = vec4(color.rgb, 1.0);
  #include <colorspace_fragment>
}`;

export class InkPost {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      depthTexture: new THREE.DepthTexture(1, 1),
      depthBuffer: true,
      // Read pixel for pixel: no blur from the boil's shifts.
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.05 },
        uFar: { value: 80 },
        uFrame: { value: 0 },
        uLine: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  /** Draws the scene through the pass. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, now: number): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.target.width !== size.x || this.target.height !== size.y) {
      this.target.setSize(size.x, size.y);
      this.material.uniforms.uResolution.value.copy(size);
      // Lines about one and a half CSS pixels wide, whatever the screen.
      this.material.uniforms.uLine.value = Math.max(1, renderer.getPixelRatio() * 1.5);
    }
    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;
    // Redrawn eight times a second.
    this.material.uniforms.uFrame.value = Math.floor(now / 125) % 97;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
