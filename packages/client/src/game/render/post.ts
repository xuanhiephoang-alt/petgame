import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import type { Quality } from "./quality.ts";

/**
 * Final look of the frame, applied after tone mapping: a little extra
 * saturation and contrast, warm highlights and cool shadows, and a soft
 * vignette that frames the player.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    saturation: { value: 1.05 },
    contrast: { value: 1.07 },
    warmth: { value: 1.0 },
    vignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float warmth;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      float luma = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(luma), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      // Split toning: cool shadows, warm highlights.
      vec3 shadowTint = vec3(0.94, 0.98, 1.06);
      vec3 lightTint = vec3(1.05, 1.0, 0.92);
      c *= mix(vec3(1.0), mix(shadowTint, lightTint, smoothstep(0.2, 0.8, luma)), warmth);
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
    }`,
};

/**
 * Post-processing chain by quality:
 * - high: ambient occlusion, bloom, grading, 4x MSAA
 * - medium: bloom at low resolution, grading
 * - low: none (plain render)
 */
export class PostFX {
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private ao?: GTAOPass;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, quality: Quality) {
    if (quality === "low") return;
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: quality === "high" ? 4 : 0,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    if (quality === "high") {
      this.ao = new GTAOPass(scene, camera, size.x, size.y);
      this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    // Only bright things glow: flames, lava, crystals, fireflies.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.5, 0.88);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(GradeShader));
    this.setSize(size.x, size.y);
  }

  setSize(width: number, height: number) {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    // Bloom is soft anyway: run it at half (or quarter) resolution.
    const scale = this.ao ? 0.5 : 0.35;
    this.bloom?.setSize(Math.max(1, width * scale), Math.max(1, height * scale));
  }

  /** Stronger glow at night, when lanterns and lava stand out. */
  setNight(night: number) {
    if (this.bloom) this.bloom.strength = 0.4 + night * 0.35;
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.composer) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
