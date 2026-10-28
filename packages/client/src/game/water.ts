import { BufferImageSource, CanvasSource, Mesh, MeshGeometry, Shader, Texture } from "pixi.js";
import { WORLD_HEIGHT, WORLD_WIDTH, mulberry32, terrainAt, type WorldLayout } from "@petgame/shared";

/** Water field texel size (world px). */
const CELL = 8;
/** How far past the world edge the sea is drawn (world px). */
const MARGIN = 768;
/** Signed distance range stored in the red channel (world px each way). */
const RANGE = 64;
/** Depth range stored in the green channel (world px). */
const DEPTH = 256;

/**
 * Exact squared Euclidean distance transform of one line (Felzenszwalb and
 * Huttenlocher): f holds 0 at sites and a big number elsewhere.
 */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distance (in texels) from every texel to the nearest texel where `site` is true. */
function distanceTo(site: Uint8Array, cols: number, rows: number): Float64Array {
  const BIG = 1e12;
  const grid = new Float64Array(cols * rows);
  for (let i = 0; i < grid.length; i++) grid[i] = site[i] ? 0 : BIG;
  const n = Math.max(cols, rows);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) f[y] = grid[y * cols + x];
    edt1d(f, rows, d, v, z);
    for (let y = 0; y < rows; y++) grid[y * cols + x] = d[y];
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) f[x] = grid[y * cols + x];
    edt1d(f, cols, d, v, z);
    for (let x = 0; x < cols; x++) grid[y * cols + x] = Math.sqrt(d[x]);
  }
  return grid;
}

/**
 * Where the water is, as a texture: red = signed distance to the shore
 * (positive in water), green = depth (distance from the shore), blue = sea
 * (1) or fresh water (0). Smooth contours come from interpolating distances.
 */
function buildField(layout: WorldLayout) {
  const cols = (WORLD_WIDTH + MARGIN * 2) / CELL, rows = (WORLD_HEIGHT + MARGIN * 2) / CELL;
  const water = new Uint8Array(cols * rows);
  const sea = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -MARGIN + (c + 0.5) * CELL, y = -MARGIN + (r + 0.5) * CELL;
      const isSea = terrainAt(layout.terrain, x, y) === "sea";
      sea[r * cols + c] = isSea ? 1 : 0;
      water[r * cols + c] = isSea ? 1 : 0;
    }
  }
  const land = water.map((w) => 1 - w);
  const toLand = distanceTo(land, cols, rows);
  const toWater = distanceTo(water, cols, rows);
  // Signed distance to the coast, smoothed so the 16 px terrain cells read as curves.
  let sdf = new Float32Array(cols * rows);
  for (let i = 0; i < sdf.length; i++) sdf[i] = (water[i] ? toLand[i] - 0.5 : -(toWater[i] - 0.5)) * CELL;
  for (let pass = 0; pass < 3; pass++) {
    const out = new Float32Array(sdf.length);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const rr = Math.min(rows - 1, Math.max(0, r + dr));
          for (let dc = -1; dc <= 1; dc++) {
            const cc = Math.min(cols - 1, Math.max(0, c + dc));
            sum += sdf[rr * cols + cc];
            n++;
          }
        }
        out[r * cols + c] = sum / n;
      }
    }
    sdf = out;
  }
  // Lakes and ponds: exact circles.
  for (const w of layout.lake) {
    const reach = w.r + RANGE;
    const c0 = Math.max(0, Math.floor((w.x - reach + MARGIN) / CELL)), c1 = Math.min(cols - 1, Math.ceil((w.x + reach + MARGIN) / CELL));
    const r0 = Math.max(0, Math.floor((w.y - reach + MARGIN) / CELL)), r1 = Math.min(rows - 1, Math.ceil((w.y + reach + MARGIN) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = -MARGIN + (c + 0.5) * CELL, y = -MARGIN + (r + 0.5) * CELL;
        const d = w.r - Math.hypot(x - w.x, y - w.y);
        const i = r * cols + c;
        if (d > sdf[i]) {
          sdf[i] = d;
          sea[i] = 0;
        }
      }
    }
  }
  const data = new Uint8Array(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) {
    const s = sdf[i];
    data[i * 4] = Math.round(Math.min(1, Math.max(0, 0.5 + s / (2 * RANGE))) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, s / DEPTH)) * 255);
    data[i * 4 + 2] = sea[i] ? 255 : 0;
    data[i * 4 + 3] = 255;
  }
  const source = new BufferImageSource({ resource: data, width: cols, height: rows, format: "rgba8unorm", scaleMode: "linear" });
  return { texture: new Texture({ source }), rect: [-MARGIN, -MARGIN, cols * CELL, rows * CELL] as const };
}

/** Tileable value noise for ripples and glints. */
function noiseTexture(): Texture {
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(n, n);
  const rand = mulberry32(2024);
  let a = new Float32Array(n * n).map(() => rand());
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += a[((y + dy + n) % n) * n + ((x + dx + n) % n)];
        b[y * n + x] = sum / 9;
      }
    }
    a = b;
  }
  let min = 1, max = 0;
  for (const v of a) { min = Math.min(min, v); max = Math.max(max, v); }
  for (let i = 0; i < n * n; i++) {
    const v = ((a[i] - min) / (max - min)) * 255;
    image.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  return new Texture({ source: new CanvasSource({ resource: canvas, addressMode: "repeat", scaleMode: "linear" }) });
}

const vertex = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
out vec2 vWorld;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vWorld = aPosition;
}`;

const fragment = /* glsl */ `
precision highp float;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uField;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uPixel;
uniform vec4 uFieldRect;

float band(float x, float edge, float soft) { return smoothstep(edge - soft, edge + soft, x); }

void main() {
  vec4 f = texture(uField, (vWorld - uFieldRect.xy) / uFieldRect.zw);
  float sdf = (f.r - 0.5) * ${(2 * RANGE).toFixed(1)};
  float depth = f.g * ${DEPTH.toFixed(1)};
  float sea = f.b;
  float edge = band(sdf, 0.0, uPixel);
  if (edge <= 0.0) discard;
  float n1 = texture(uNoise, vWorld / 520.0 + vec2(uTime * 0.008, uTime * 0.005)).r;
  float n2 = texture(uNoise, vWorld / 300.0 - vec2(uTime * 0.006, -uTime * 0.009)).r;
  float d = max(sdf, depth) + (n1 - 0.5) * 5.0;

  // Toon bands from the shallows to the deep.
  vec3 shallow = mix(vec3(0.42, 0.84, 0.80), vec3(0.40, 0.85, 0.86), sea);
  vec3 mid = mix(vec3(0.24, 0.68, 0.74), vec3(0.20, 0.62, 0.80), sea);
  vec3 deep = mix(vec3(0.16, 0.52, 0.66), vec3(0.12, 0.44, 0.70), sea);
  vec3 col = mix(shallow, mid, band(d, 22.0, 3.0));
  col = mix(col, deep, band(d, 56.0 + sea * 50.0, 10.0));
  // Slow light and dark patches over open water.
  col *= 0.95 + 0.1 * texture(uNoise, vWorld / 900.0 + uTime * 0.004).r;

  // Ripples: thin light lines drifting over the surface.
  float rip = abs(n1 - n2);
  col += vec3(0.05, 0.07, 0.07) * (1.0 - smoothstep(0.0, 0.025, rip)) * band(d, 10.0, 4.0);

  // Foam on the shore, and a wave line that rolls in and fades.
  float lap = sin(uTime * 1.6 + n2 * 6.0) * 1.5;
  float foam = 1.0 - band(sdf, 4.0 + lap, 1.2 * uPixel + 0.6);
  float roll = fract(uTime * 0.18 + n1 * 0.6);
  float waveAt = 26.0 - roll * 20.0;
  float wave = (1.0 - smoothstep(0.0, 1.8 + uPixel, abs(sdf - waveAt))) * (1.0 - roll) * 0.75 * band(n2, 0.35, 0.1);
  col = mix(col, vec3(0.96, 0.99, 1.0), clamp(foam + wave, 0.0, 1.0));

  // Glints that twinkle on open water.
  float g = texture(uNoise, vWorld / 41.0 + vec2(uTime * 0.02, 0.0)).r * texture(uNoise, vWorld / 53.0 - vec2(0.0, uTime * 0.015)).r;
  col += vec3(0.8) * smoothstep(0.6, 0.66, g) * band(d, 30.0, 6.0);

  float alpha = edge * mix(0.6, 1.0, band(d, 14.0, 8.0));
  finalColor = vec4(col * alpha, alpha);
}`;

/** Sea and lakes in one animated shader over the whole world. */
export class Water {
  readonly mesh: Mesh<MeshGeometry, Shader>;
  private uniforms: { uTime: number; uPixel: number };

  constructor(layout: WorldLayout) {
    const field = buildField(layout);
    const [x, y, w, h] = field.rect;
    const geometry = new MeshGeometry({
      positions: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    const shader = Shader.from({
      gl: { vertex, fragment, name: "water" },
      resources: {
        waterUniforms: {
          uTime: { value: 0, type: "f32" },
          uPixel: { value: 1, type: "f32" },
          uFieldRect: { value: new Float32Array(field.rect), type: "vec4<f32>" },
        },
        uField: field.texture.source,
        uNoise: noiseTexture().source,
      },
    });
    this.mesh = new Mesh({ geometry, shader });
    this.uniforms = shader.resources.waterUniforms.uniforms;
  }

  update(timeSec: number, zoom: number) {
    this.uniforms.uTime = timeSec;
    // One screen pixel in world pixels, for anti-aliased edges.
    this.uniforms.uPixel = 1 / zoom;
  }
}
