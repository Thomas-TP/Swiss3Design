// Profondeur de champ du décor de la vue produit : la pièce vendue est nette,
// la salle derrière elle floue, comme sur une photo de produit (objectif ouvert,
// mise au point sur la pièce). Le flou cache aussi la définition modeste des
// textures du décor (1024 à 2048 px pour toute une salle).
//
// Chaîne, par frame (vue du Stage, cible courante quelconque : canvas ou bake) :
//   1. le décor seul dans une cible hors écran à la définition de la vue, avec
//      sa profondeur ;
//   2. une copie au quart de la définition, floutée (gaussienne séparable,
//      deux allers-retours) ;
//   3. composition dans la cible courante : net là où la profondeur est proche
//      du plan de mise au point (le plateau au pied de la pièce), flou au-delà.
// La pièce est dessinée ENSUITE par la scène, par-dessus (rien du décor ne la
// cache : la caméra reste au-dessus du plateau).
import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";

/** Réduction de la cible floue (quart de la définition de la vue). */
const BLUR_DOWNSCALE = 4;
/** Distance (m) au plan de mise au point au-delà de laquelle le flou est complet. */
const FOCUS_RANGE = 0.3;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Gaussienne 9 échantillons en 5 lectures (filtrage linéaire entre texels).
const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec4 sum = texture2D(tInput, vUv) * 0.2270270270;
  sum += texture2D(tInput, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture2D(tInput, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture2D(tInput, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture2D(tInput, vUv - uStep * 3.2307692308) * 0.0702702703;
  gl_FragColor = sum;
}`;

const COMPOSITE_FRAGMENT = /* glsl */ `
#include <packing>
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float uFocus;
uniform float uRange;
varying vec2 vUv;
void main() {
  float depth = texture2D(tDepth, vUv).x;
  float distance = -perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  float blur = smoothstep(0.0, uRange, abs(distance - uFocus));
  vec3 color = mix(texture2D(tSharp, vUv).rgb, texture2D(tBlur, vUv).rgb, blur);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export class DecorBlur {
  private readonly sharp: WebGLRenderTarget;
  private readonly smallA: WebGLRenderTarget;
  private readonly smallB: WebGLRenderTarget;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly blurMaterial: ShaderMaterial;
  private readonly compositeMaterial: ShaderMaterial;

  constructor(renderer: WebGLRenderer) {
    // Demi-flottant si possible : la salle est en linéaire, pas de bandes.
    const type = renderer.extensions.has("EXT_color_buffer_float")
      ? HalfFloatType
      : UnsignedByteType;
    this.sharp = new WebGLRenderTarget(1, 1, { type, depthBuffer: true });
    this.sharp.depthTexture = new DepthTexture(1, 1);
    this.sharp.depthTexture.minFilter = NearestFilter;
    this.sharp.depthTexture.magFilter = NearestFilter;
    const small = { type, depthBuffer: false, minFilter: LinearFilter };
    this.smallA = new WebGLRenderTarget(1, 1, small);
    this.smallB = new WebGLRenderTarget(1, 1, small);
    this.blurMaterial = new ShaderMaterial({
      name: "S3DDecorBlur",
      uniforms: { tInput: { value: null }, uStep: { value: new Vector2() } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeMaterial = new ShaderMaterial({
      name: "S3DDecorComposite",
      uniforms: {
        tSharp: { value: this.sharp.texture },
        tBlur: { value: this.smallB.texture },
        tDepth: { value: this.sharp.depthTexture },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 10 },
        uFocus: { value: 1 },
        uRange: { value: FOCUS_RANGE },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.blurMaterial);
    this.quad.frustumCulled = false;
  }

  /**
   * Dessine le décor, net au plan `focus` (m depuis la caméra), flou ailleurs,
   * dans la cible et la zone courantes (celles que le Stage a posées).
   */
  draw(
    renderer: WebGLRenderer,
    decor: Scene,
    camera: PerspectiveCamera,
    size: { width: number; height: number },
    focus: number,
  ) {
    const width = Math.max(1, Math.round(size.width));
    const height = Math.max(1, Math.round(size.height));
    if (this.sharp.width !== width || this.sharp.height !== height) {
      this.sharp.setSize(width, height);
      const sw = Math.max(1, Math.round(width / BLUR_DOWNSCALE));
      const sh = Math.max(1, Math.round(height / BLUR_DOWNSCALE));
      this.smallA.setSize(sw, sh);
      this.smallB.setSize(sw, sh);
    }
    const previous = renderer.getRenderTarget();

    renderer.setRenderTarget(this.sharp);
    renderer.clear(true, true, false);
    renderer.render(decor, camera);

    // Deux allers-retours horizontal / vertical au quart de la définition.
    const step = (dx: number, dy: number) =>
      new Vector2(dx / this.smallA.width, dy / this.smallA.height);
    this.pass(renderer, this.sharp.texture, this.smallA, step(1, 0));
    this.pass(renderer, this.smallA.texture, this.smallB, step(0, 1));
    this.pass(renderer, this.smallB.texture, this.smallA, step(1.6, 0));
    this.pass(renderer, this.smallA.texture, this.smallB, step(0, 1.6));

    renderer.setRenderTarget(previous);
    const uniforms = this.compositeMaterial.uniforms;
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    uniforms.uFocus.value = focus;
    this.quad.material = this.compositeMaterial;
    renderer.render(this.quad, this.camera);
  }

  private pass(
    renderer: WebGLRenderer,
    input: Texture,
    output: WebGLRenderTarget,
    step: Vector2,
  ) {
    this.blurMaterial.uniforms.tInput.value = input;
    (this.blurMaterial.uniforms.uStep.value as Vector2).copy(step);
    this.quad.material = this.blurMaterial;
    renderer.setRenderTarget(output);
    renderer.render(this.quad, this.camera);
  }

  dispose() {
    this.sharp.depthTexture?.dispose();
    this.sharp.dispose();
    this.smallA.dispose();
    this.smallB.dispose();
    this.quad.geometry.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}
