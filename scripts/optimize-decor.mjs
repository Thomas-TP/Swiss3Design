// Décor de la vue 3D : « Dining room | Kichen baked » de ChristyHsu (CC BY 4.0),
// adapté pour le web → public/scenes/dining-room/ (crédit : CREDITS.txt et la
// légende de la vue, components/catalog/viewer-props.ts).
//
// Outil ponctuel, hors des dépendances du dépôt : dans un dossier à part,
//   bun add @gltf-transform/core@4 @gltf-transform/functions@4 \
//     @gltf-transform/extensions@4 meshoptimizer sharp
//   bun optimize-decor.mjs <source.glb> <dossier de sortie>
// Source (GLB 4k de Sketchfab, 44 Mo) et licence : hors du dépôt
// (sources-3d/dining-room-christyhsu/ chez le propriétaire).
//
// Pas de compression Draco ni meshopt : leur décodeur est du WebAssembly, que la
// CSP des pages ne permet pas sur le fil principal ('wasm-unsafe-eval'). La
// géométrie est donc seulement quantifiée (KHR_mesh_quantization, lue sans WASM)
// et les textures sont des fichiers WebP à part, chargés comme des images de
// même origine (pas de blob: dans connect-src).
import { mkdirSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  quantize,
  simplifyPrimitive,
  textureCompress,
  unpartition,
  weld,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [src, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();

// 1. Le vase et le bouquet d'origine laissent la place au produit.
const DROP = new Set(["vase_grey.001_0", "flower_leaf1_0", "flower_leaf2_0"]);
let dropped = 0;
for (const node of root.listNodes())
  if (DROP.has(node.getName())) {
    node.dispose();
    dropped++;
  }
if (dropped !== DROP.size) throw new Error(`nœuds retirés : ${dropped}`);

// 2. L'ombre précalculée du vase retiré reste dans la texture du plateau (un
// disque noir à son pied) : on la recouvre du bois voisin, pris au-dessus et
// au-dessous dans le sens du fil (vertical dans l'atlas), avec un bord fondu.
const table = root
  .listMaterials()
  .find((material) => material.getName() === "Material5.001");
const tableImage = table?.getBaseColorTexture()?.getImage();
if (!table || !tableImage) throw new Error("texture du plateau introuvable");
{
  const { data, info } = await sharp(tableImage)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // Pied du vase retiré, mesuré dans l'atlas 1024 px (centre du disque sombre).
  const cx = (133.2 / 1024) * width;
  const cy = (351 / 1024) * height;
  const inner = (26 / 1024) * width;
  const outer = (40 / 1024) * width;
  const shift = Math.round((80 / 1024) * height);
  const out = Buffer.from(data);
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++)
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      const r = Math.hypot(x - cx, y - cy);
      if (r > outer) continue;
      const k = Math.min(1, Math.max(0, (outer - r) / (outer - inner)));
      const w = k * k * (3 - 2 * k);
      for (let c = 0; c < channels; c++) {
        const at = (yy) => data[(yy * width + x) * channels + c];
        const donor = (at(y - shift) + at(y + shift)) / 2;
        const i = (y * width + x) * channels + c;
        out[i] = Math.round(data[i] * (1 - w) + donor * w);
      }
    }
  table
    .getBaseColorTexture()
    .setImage(
      await sharp(out, { raw: { width, height, channels } }).png().toBuffer(),
    );
}

// 3. Éclairage précalculé dans l'albédo : matériaux « unlit », rien d'autre.
// Sur Sketchfab, l'albédo sert aussi d'émission (facteur 0,5 à 1 selon le
// matériau) : la luminosité voulue par l'auteur passe en `extras.brightness`
// (lu par la scène, multiplicateur de couleur), 1,5 pour une émission pleine.
const unlit = doc.createExtension(KHRMaterialsUnlit);
for (const material of root.listMaterials()) {
  const emission = material.getEmissiveTexture()
    ? material.getEmissiveFactor()[0]
    : 1;
  material.setExtras({ brightness: 0.75 * (1 + emission) });
  material.setExtension("KHR_materials_unlit", unlit.createUnlit());
  material.setEmissiveTexture(null);
  material.setEmissiveFactor([0, 0, 0]);
  material.setMetallicRoughnessTexture(null);
  material.setNormalTexture(null);
  material.setOcclusionTexture(null);
}
for (const mesh of root.listMeshes())
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute("NORMAL", null);
    prim.setAttribute("TANGENT", null);
  }

await doc.transform(dedup(), prune(), weld());

// 4. Décorations lointaines (plan de travail, ~3 m) très denses : simplifiées.
const SIMPLIFY = {
  "candle_Material.007_0": 0.06,
  "candle_Material.008_0": 0.12,
  "jar4_Material.017_0": 0.12,
  jar1_Material3_0: 0.2,
  jar2_Material4_0: 0.2,
  "jar3_Material.002_0": 0.2,
  "chopping board1_Material1_0": 0.35,
  "chopping board2_Material2_0": 0.5,
};
await MeshoptSimplifier.ready;
for (const node of root.listNodes()) {
  const ratio = SIMPLIFY[node.getName()];
  const mesh = node.getMesh();
  if (!ratio || !mesh) continue;
  for (const prim of mesh.listPrimitives())
    simplifyPrimitive(prim, {
      simplifier: MeshoptSimplifier,
      ratio,
      error: 0.01,
    });
}

// 5. Textures en WebP, 2048 px au plus ; géométrie quantifiée (sans WASM au décodage).
await doc.transform(
  prune(),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    quality: 82,
    resize: [2048, 2048],
  }),
  quantize({ quantizePosition: 16, quantizeTexcoord: 16 }),
  unpartition(),
);

root.listTextures().forEach((texture, i) => texture.setURI(`t${i}.webp`));
root.listBuffers()[0].setURI("dining-room.bin");
await io.write(`${outDir}/dining-room.gltf`, doc);

let tris = 0;
for (const mesh of root.listMeshes())
  for (const prim of mesh.listPrimitives())
    tris += (prim.getIndices()?.getCount() ?? 0) / 3;
console.log("triangles", tris, "textures", root.listTextures().length);
