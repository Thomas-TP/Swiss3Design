// GLSL du matériau d'impression (brief « Strates », annexe A), injecté dans le
// MeshPhysicalMaterial de three r186 par onBeforeCompile (print-material.ts).
// WebGL2 : indexation dynamique des tableaux d'uniforms permise. Les
// variables locales déclarées après <color_fragment> restent visibles dans les
// blocs suivants (même main). Hauteurs en mm, lues en espace modèle
// (position.z : Z vers le haut du générateur).

/** Vertex : attribut `side` (0 = paroi extérieure, 1 = intérieure) et hauteur. */
export const PRINT_VERTEX_HEAD = /* glsl */ `
attribute float side;
varying float vZ;
varying float vSide;`;

export const PRINT_VERTEX_BEGIN = /* glsl */ `
vZ = position.z;
vSide = side;`;

export const PRINT_HEAD = /* glsl */ `
varying float vZ; varying float vSide;
uniform float uCutZ, uHeight, uLayerH, uLayerRelief;
uniform float uBandTop[3]; uniform int uBandCount;
uniform vec3 uBandColor[4]; uniform vec3 uBandColorFrom[4];
uniform float uRippleZ, uRippleActive, uReprintZ, uReprintSide, uReprintActive;
uniform float uHot, uFlash, uGhost, uGhostStep, uIsoMode;
uniform vec3 uHotColor, uGhostColor, uIsoIndexColor, uUpView;`;

export const PRINT_COLOR = /* glsl */ `
float isGhost = 0.0;
if (vZ > uCutZ + 1e-4) {
  if (uGhost < 0.5 || vSide > 0.5) discard;                 // fantômes : paroi extérieure seulement
  float d = abs(fract(vZ / uGhostStep + 0.5) - 0.5) * uGhostStep;
  if (d > max(0.05, fwidth(vZ) * 0.8)) discard;             // anneau d'environ 1 px
  isGhost = 1.0;
} else {
  if (uReprintSide > 0.5 && vZ < uReprintZ) discard;        // ancien maillage : garde le dessus
  if (uReprintSide < -0.5 && vZ > uReprintZ) discard;       // nouveau maillage : garde le dessous
  int band = 0;
  for (int i = 0; i < 3; i++) { if (i < uBandCount - 1 && vZ > uBandTop[i]) band = i + 1; }
  diffuseColor.rgb = (vZ <= uRippleZ) ? uBandColor[band] : uBandColorFrom[band];
  if (uIsoMode > 0.0) {                                     // vue « carte » : courbe maîtresse toutes les 10 couches
    float step10 = uLayerH * 10.0;
    float di = abs(fract(vZ / step10 + 0.5) - 0.5) * step10;
    diffuseColor.rgb = mix(diffuseColor.rgb, uIsoIndexColor, uIsoMode * (1.0 - smoothstep(0.0, max(0.04, fwidth(vZ)), di)));
  }
}`;

// Lignes de couche en normales, effacées quand elles passent sous le pixel :
// pas de moiré.
export const PRINT_NORMAL = /* glsl */ `
{
  float f = fwidth(vZ) / uLayerH;
  float amp = uLayerRelief * (1.0 - smoothstep(0.25, 0.6, f)) * (1.0 - isGhost);
  normal = normalize(normal + amp * sin(6.2831853 * vZ / uLayerH) * uUpView);
}`;

export const PRINT_EMISSIVE = /* glsl */ `
{
  float w = max(0.3, fwidth(vZ) * 1.5);
  float hot = (1.0 - smoothstep(0.0, w, abs(vZ - uCutZ))) * uHot * step(uCutZ, uHeight - 1e-3);
  float rip = (1.0 - smoothstep(0.0, w, abs(vZ - uRippleZ))) * uRippleActive;
  float rep = (1.0 - smoothstep(0.0, w, abs(vZ - uReprintZ))) * uReprintActive;
  totalEmissiveRadiance += uHotColor * (hot * (1.0 + 2.0 * uFlash) + rip + rep);
  if (isGhost > 0.5) { diffuseColor.rgb = vec3(0.0); totalEmissiveRadiance = uGhostColor; }
}`;
