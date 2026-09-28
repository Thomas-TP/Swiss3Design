// Rendu en image (brief « Strates », §4.4) : service `bake` des vignettes
// (« Mes créations », pièce jointe du devis) et « bake au repos » des vues C1.
//
// Chaîne : la scène rend dans une cible hors écran (multiéchantillonnée,
// demi-flottante quand le GPU le permet), une passe de sortie applique ce que
// three ne fait que vers l'écran (tone mapping Neutral + transfert sRGB : sans
// elle, l'image serait linéaire et plus sombre que le canvas), puis lecture
// des pixels, canvas 2D et toBlob("image/webp", 0.86). Blob et URL `blob:`
// sont couverts par la CSP actuelle (img-src … data: blob:).
//
// Les captures passent une par une : elles partagent leurs cibles, et la
// lecture asynchrone des pixels doit finir avant la suivante.
import {
  Color,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  UnsignedByteType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

const WEBP_QUALITY = 0.86;

// Même passe que OutputShader de three (tone mapping puis sRGB), avec en plus
// le retour à l'alpha non prémultiplié : la résolution du MSAA laisse des
// bords prémultipliés, qu'ImageData lirait trop sombres.
const OUTPUT_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const OUTPUT_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
varying vec2 vUv;
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>
void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  if (color.a > 0.0) color.rgb /= color.a;
  color.rgb = NeutralToneMapping(color.rgb);
  gl_FragColor = sRGBTransferOETF(color);
}`;

export interface CaptureOptions {
  /** Pixels de l'image produite. */
  width: number;
  height: number;
  /** Fond opaque (couleur three, déjà convertie) ou null pour un fond transparent. */
  background: Color | null;
}

export class Baker {
  private scene: WebGLRenderTarget | null = null;
  private output: WebGLRenderTarget | null = null;
  private readonly quad: Mesh<PlaneGeometry, RawShaderMaterial>;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(private readonly renderer: WebGLRenderer) {
    const material = new RawShaderMaterial({
      name: "S3DBakeOutput",
      uniforms: {
        tDiffuse: { value: null },
        toneMappingExposure: { value: renderer.toneMappingExposure },
      },
      vertexShader: OUTPUT_VERTEX,
      fragmentShader: OUTPUT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), material);
    this.quad.frustumCulled = false;
  }

  /** Taille maximale d'une capture, bornée par le GPU. */
  maxSize(): number {
    const caps = this.renderer.capabilities;
    return Math.min(caps.maxTextureSize, 4096);
  }

  /**
   * Rend une image : `draw` appelle scene.render() pendant que la cible hors
   * écran est active (viewport = toute l'image). Résout un Blob WebP (PNG si
   * le navigateur n'encode pas le WebP, Safari).
   */
  capture(draw: () => void, options: CaptureOptions): Promise<Blob> {
    const run = this.queue.then(() => this.run(draw, options));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private targets(width: number, height: number) {
    if (!this.scene) {
      const renderer = this.renderer;
      // Demi-flottant : pas de bandes dans les dégradés avant le tone mapping.
      const halfFloat = renderer.extensions.has("EXT_color_buffer_float");
      this.scene = new WebGLRenderTarget(width, height, {
        type: halfFloat ? HalfFloatType : UnsignedByteType,
        samples: 4,
        depthBuffer: true,
      });
      this.output = new WebGLRenderTarget(width, height, {
        type: UnsignedByteType,
        depthBuffer: false,
      });
    } else {
      this.scene.setSize(width, height);
      this.output!.setSize(width, height);
    }
    return { scene: this.scene, output: this.output! };
  }

  private async run(draw: () => void, options: CaptureOptions): Promise<Blob> {
    if (this.disposed) throw new Error("Stage libéré");
    const max = this.maxSize();
    const width = Math.max(1, Math.min(max, Math.round(options.width)));
    const height = Math.max(1, Math.min(max, Math.round(options.height)));
    const renderer = this.renderer;
    const { scene, output } = this.targets(width, height);

    const previousTarget = renderer.getRenderTarget();
    const previousColor = renderer.getClearColor(new Color());
    const previousAlpha = renderer.getClearAlpha();
    const pixels = new Uint8Array(width * height * 4);
    try {
      renderer.setRenderTarget(scene);
      if (options.background) renderer.setClearColor(options.background, 1);
      else renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      draw();

      this.quad.material.uniforms.tDiffuse.value = scene.texture;
      this.quad.material.uniforms.toneMappingExposure.value =
        renderer.toneMappingExposure;
      renderer.setRenderTarget(output);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(this.quad, this.camera);

      if (typeof renderer.readRenderTargetPixelsAsync === "function")
        await renderer.readRenderTargetPixelsAsync(
          output,
          0,
          0,
          width,
          height,
          pixels,
        );
      else renderer.readRenderTargetPixels(output, 0, 0, width, height, pixels);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(previousColor, previousAlpha);
    }
    return encode(pixels, width, height);
  }

  dispose() {
    this.disposed = true;
    this.scene?.dispose();
    this.output?.dispose();
    this.scene = null;
    this.output = null;
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}

/** Pixels GL (lignes de bas en haut) → Blob WebP via un canvas 2D. */
async function encode(
  pixels: Uint8Array,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D indisponible");
  const image = context.createImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y++)
    image.data.set(
      pixels.subarray((height - 1 - y) * row, (height - y) * row),
      y * row,
    );
  context.putImageData(image, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage refusé"))),
      "image/webp",
      WEBP_QUALITY,
    ),
  );
}
