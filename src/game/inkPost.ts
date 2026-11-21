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
import { styleIndex } from './style';

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
uniform float uStyle;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
/** Smooths jagged edges (a light FXAA): blends along the edge, never across it. */
vec3 smoothEdges(vec2 uv, vec2 px) {
  const vec3 lumaW = vec3(0.299, 0.587, 0.114);
  vec3 m = texture2D(tColor, uv).rgb;
  float nw = dot(texture2D(tColor, uv + vec2(-1.0, -1.0) * px).rgb, lumaW);
  float ne = dot(texture2D(tColor, uv + vec2(1.0, -1.0) * px).rgb, lumaW);
  float sw = dot(texture2D(tColor, uv + vec2(-1.0, 1.0) * px).rgb, lumaW);
  float se = dot(texture2D(tColor, uv + vec2(1.0, 1.0) * px).rgb, lumaW);
  float lm = dot(m, lumaW);
  float lo = min(lm, min(min(nw, ne), min(sw, se)));
  float hi = max(lm, max(max(nw, ne), max(sw, se)));
  vec2 dir = vec2(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
  float reduce = max((nw + ne + sw + se) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * px;
  vec3 a = 0.5 * (texture2D(tColor, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tColor, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tColor, uv - dir * 0.5).rgb + texture2D(tColor, uv + dir * 0.5).rgb);
  float lb = dot(b, lumaW);
  return (lb < lo || lb > hi) ? a : b;
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
  vec4 color = vec4(smoothEdges(uv, px), 1.0);

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
  vec2 p = vUv * uResolution;
  if (uStyle > 1.5) {
    // Gothic: no pen, no paper. Only a faint dark edge, a fine film grain, a heavy vignette
    // and deep blacks.
    color.rgb *= 1.0 - edge * 0.35;
    color.rgb *= 0.94 + 0.12 * noise(p / 1.6 + uFrame * 13.0);
    vec2 c = vUv - 0.5;
    color.rgb *= 1.0 - smoothstep(0.25, 0.75, dot(c, c) * 2.2) * 0.65;
    color.rgb = pow(color.rgb, vec3(1.12));
    gl_FragColor = vec4(color.rgb, 1.0);
    #include <colorspace_fragment>
    return;
  }
  color.rgb *= 1.0 - edge * 0.92;

  // Paper: grain and long fibres, only where there is light to see them.
  float grain = noise(p / 2.2) * 0.6 + noise(p / 7.0) * 0.4;
  float fibre = smoothstep(0.62, 0.9, noise(vec2(p.x / 60.0, p.y / 3.0) + noise(p / 25.0) * 2.0));
  float paper = 0.93 + 0.11 * grain - 0.08 * fibre;
  color.rgb *= paper;

  if (uStyle > 0.5) {
    // Engraving: every colour gone (the flame, the blood, the figures), a cold grey paper.
    float g = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = vec3(g) * vec3(0.96, 0.98, 1.02);
  } else {
    // Warm, a touch faded, like old paper under a flame.
    color.rgb = pow(color.rgb, vec3(0.98, 1.0, 1.06));
  }

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
      // The boil reads whole pixels (no blur); the smoothing of edges reads in between.
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
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
        uStyle: { value: 0 },
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
    this.material.uniforms.uStyle.value = styleIndex();
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
