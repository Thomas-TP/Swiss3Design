// Matériau du champ de courbes de l'accueil (brief « Strates », annexe A, §2.4) :
// des courbes de niveau tracées en plein écran dans un seul fragment shader.
//
// Le relief n'est calculé qu'une fois : un FBM périodique de 256² en demi-
// flottants (R16F), cuit au premier montage et partagé par toutes les vues du
// champ (héros, chapitre 01). Par pixel, on lit cette texture en coordonnées
// « page » (position de la fenêtre + défilement) : deux vues se raccordent donc
// sans couture, quel que soit leur rectangle. `v = h × niveaux` donne les
// courbes (anti-crénelées par fwidth), une courbe maîtresse sur cinq en
// `iso-index`, un tramage de Bayer 4×4 à 1,5 % casse les aplats, et le pas se
// resserre de 15 % au plus avec la vitesse de défilement. `uReveal` ouvre le
// champ en cercle (fin du héros). Rendu seulement quand le défilement bouge ou
// que le champ s'ouvre : c'est le Stage qui décide des frames.
import {
  Color,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
} from "three";

const SIZE = 256;
/** Côté du motif répété, en px CSS : le relief est lisible sans répétition visible. */
export const FIELD_PERIOD_PX = 1600;
const LEVELS = 24;

// ── Relief : FBM périodique, calculé une fois ───────────────────────────────

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Bruit de valeurs périodique de période `period` cellules (entier). */
function valueNoise(x: number, y: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash(x0, y0);
  const b = hash(x1, y0);
  const c = hash(x0, y1);
  const d = hash(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Hauteur 0–1 au point (u, v) de la tuile : 5 octaves, périodique en u et en v. */
export function fieldHeight(u: number, v: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let period = 4;
  let total = 0;
  for (let octave = 0; octave < 5; octave++) {
    sum += amplitude * valueNoise(u * period, v * period, period);
    total += amplitude;
    amplitude *= 0.5;
    period *= 2;
  }
  const h = sum / total;
  // Contraste : le FBM de valeurs est mou autour de 0,5. Courbe logistique et
  // non écrêtage : un plateau exactement plat à une valeur entière de niveau
  // serait peint en entier comme une courbe (0 est un multiple de 5, donc une
  // « courbe maîtresse »), et les creux et les crêtes garderaient des aplats.
  return 1 / (1 + Math.exp(-(h - 0.5) * 7.5));
}

let heightTexture: DataTexture | null = null;
let heightRefs = 0;

/** Texture de relief partagée (comptée : libérée avec sa dernière vue). */
export function acquireHeightTexture(): DataTexture {
  heightRefs++;
  if (heightTexture) return heightTexture;
  const data = new Uint16Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      data[y * SIZE + x] = DataUtils.toHalfFloat(fieldHeight(x / SIZE, y / SIZE));
  const texture = new DataTexture(data, SIZE, SIZE, RedFormat, HalfFloatType);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  heightTexture = texture;
  return texture;
}

export function releaseHeightTexture() {
  if (--heightRefs > 0) return;
  heightRefs = 0;
  heightTexture?.dispose();
  heightTexture = null;
}

// ── Matériau ────────────────────────────────────────────────────────────────

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uHeight;
uniform float uCanvasH, uDpr, uScroll, uPeriod, uLevels, uSpeed;
uniform float uReveal, uMaxR, uTintAlpha, uDither;
uniform vec2 uCenter;
uniform vec3 uIso, uIndex, uTint0, uTint1, uTint2;

const float BAYER[16] = float[16](
  0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

// Distance (en pixels) à la ligne entière la plus proche d'une grandeur v.
float lineOf(float v, float width) {
  float fw = max(fwidth(v), 1e-4);
  float d = abs(fract(v + 0.5) - 0.5) / fw;
  return 1.0 - clamp(d - width + 0.5, 0.0, 1.0);
}

void main() {
  // Pixel dans la fenêtre (px CSS, y vers le bas) puis dans la page.
  vec2 px = vec2(gl_FragCoord.x, uCanvasH * uDpr - gl_FragCoord.y) / uDpr;
  vec2 page = vec2(px.x, px.y + uScroll);
  float h = texture2D(uHeight, page / uPeriod).r;
  float v = h * uLevels * (1.0 + 0.15 * uSpeed);

  float thin = lineOf(v, 0.5);
  float master = lineOf(v / 5.0, 1.0);

  // Ouverture en cercle depuis le centre de l'objet.
  float radius = uReveal * uMaxR;
  float mask = 1.0 - smoothstep(radius - 140.0, radius, distance(px, uCenter));

  // Teintes hypsométriques sous les courbes (aplats doux).
  vec3 tint = mix(mix(uTint0, uTint1, smoothstep(0.30, 0.38, h)), uTint2, smoothstep(0.62, 0.70, h));
  float tintA = uTintAlpha * mask;
  float lineA = max(thin * 0.85, master) * mask;
  vec3 lineColor = mix(uIso, uIndex, master);

  float a = tintA + lineA * (1.0 - tintA);
  vec3 rgb = a > 0.0 ? (tint * tintA + lineColor * lineA * (1.0 - tintA)) / a : vec3(0.0);

  // Tramage de Bayer 4x4 à 1,5 %.
  ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
  float dither = (BAYER[q.x + q.y * 4] + 0.5) / 16.0 - 0.5;
  a = clamp(a + dither * uDither * step(0.001, mask), 0.0, 1.0);

  gl_FragColor = vec4(rgb, a);
  #include <colorspace_fragment>
}`;

export interface FieldMaterial {
  material: ShaderMaterial;
  uniforms: ShaderMaterial["uniforms"];
  setTheme(theme: { iso: string; isoIndex: string; dark: boolean }): void;
  /** Teintes du bas vers le haut (hex) ; null : les courbes seules. */
  setTint(tint: readonly [string, string, string] | null): void;
  dispose(): void;
}

export function createFieldMaterial(height: DataTexture): FieldMaterial {
  const uniforms = {
    uHeight: { value: height },
    uCanvasH: { value: 1 },
    uDpr: { value: 1 },
    uScroll: { value: 0 },
    uPeriod: { value: FIELD_PERIOD_PX },
    uLevels: { value: LEVELS },
    uSpeed: { value: 0 },
    uReveal: { value: 1 },
    uMaxR: { value: 1 },
    uTintAlpha: { value: 0 },
    uDither: { value: 0.015 },
    uCenter: { value: [0, 0] },
    uIso: { value: new Color() },
    uIndex: { value: new Color() },
    uTint0: { value: new Color() },
    uTint1: { value: new Color() },
    uTint2: { value: new Color() },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  let dark = false;
  let tinted = false;
  const alpha = () => (tinted ? (dark ? 0.16 : 0.1) : 0);
  return {
    material,
    uniforms,
    setTheme(theme) {
      dark = theme.dark;
      uniforms.uIso.value.set(theme.iso);
      uniforms.uIndex.value.set(theme.isoIndex);
      uniforms.uTintAlpha.value = alpha();
    },
    setTint(tint) {
      tinted = tint !== null;
      if (tint) {
        uniforms.uTint0.value.set(tint[0]);
        uniforms.uTint1.value.set(tint[1]);
        uniforms.uTint2.value.set(tint[2]);
      }
      uniforms.uTintAlpha.value = alpha();
    },
    dispose() {
      material.dispose();
    },
  };
}
