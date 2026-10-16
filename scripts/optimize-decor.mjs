// Décor de la vue 3D : « Dining room | Kichen baked » de ChristyHsu (CC BY 4.0),
// adapté pour le web → public/scenes/dining-room/ (crédit : CREDITS.txt et la
// légende de la vue, components/catalog/viewer-props.ts).
//
// Outil ponctuel, hors des dépendances du dépôt : dans un dossier à part,
//   bun add @gltf-transform/core@4 @gltf-transform/functions@4 \
//     @gltf-transform/extensions@4 meshoptimizer sharp
//   bun optimize-decor.mjs <source.glb> <sortie> <dossier du chêne> <dossier du velours>
// (Poly Haven, CC0 : chêne « oak_veneer_01 » 2k : diff, nor_gl, arm ; velours
// « velour_velvet » 1k : Diffuse, nor_gl, arm)
// Source (GLB 4k de Sketchfab, 44 Mo) et licence : hors du dépôt
// (sources-3d/dining-room-christyhsu/ chez le propriétaire).
//
// Pas de compression Draco ni meshopt : leur décodeur est du WebAssembly, que la
// CSP des pages ne permet pas sur le fil principal ('wasm-unsafe-eval'). La
// géométrie est donc seulement quantifiée (KHR_mesh_quantization, lue sans WASM)
// et les textures sont des fichiers WebP à part, chargés comme des images de
// même origine (pas de blob: dans connect-src).
import { mkdirSync, readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  KHRMaterialsSheen,
  KHRMaterialsUnlit,
} from "@gltf-transform/extensions";
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

// 2. Éclairage précalculé dans l'albédo : matériaux « unlit », rien d'autre.
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
const UPHOLSTERY = "seat_Leather_0";
const keepNormals = root
  .listNodes()
  .find((n) => n.getName() === UPHOLSTERY)
  ?.getMesh();
for (const mesh of root.listMeshes())
  for (const prim of mesh.listPrimitives()) {
    if (mesh !== keepNormals) prim.setAttribute("NORMAL", null);
    prim.setAttribute("TANGENT", null);
  }

// 3. Une table à l'échelle d'un séjour : le plateau d'origine (1,61 × 2,60 m,
// texture de 1024 px pour tout le meuble, floue de près) devient une table de
// 6 places de 1,00 × 1,80 m en chêne (« Oak Veneer 01 », Poly Haven, CC0, 2k :
// fil, relief et vernis), éclairée comme la pièce vendue (matériau PBR) ; les six
// chaises se rapprochent d'autant (même écart au bord qu'avant).
const OAK = process.argv[4]; // dossier des textures oak_veneer_01_*_2k.jpg
if (!OAK)
  throw new Error("dossier des textures de chêne manquant (3e argument)");
const TABLE = "table_Material5.001_0";
const CENTER = [0.831, 0.247]; // centre du plateau au sol (x, z), mètres
const HALF_BEFORE = [0.807, 1.298];
const HALF_AFTER = [0.5, 0.9];
const SCALE = [HALF_AFTER[0] / HALF_BEFORE[0], HALF_AFTER[1] / HALF_BEFORE[1]];
const SHIFT = [HALF_BEFORE[0] - HALF_AFTER[0], HALF_BEFORE[1] - HALF_AFTER[1]];
// Chaises (mesurées dans la scène : centre au sol) et leur déplacement.
const CHAIRS = [
  { at: [0.82, -1.4], move: [0, SHIFT[1]] },
  { at: [-0.45, -0.26], move: [SHIFT[0], 0] },
  { at: [-0.45, 0.75], move: [SHIFT[0], 0] },
  { at: [2.13, -0.22], move: [-SHIFT[0], 0] },
  { at: [2.13, 0.78], move: [-SHIFT[0], 0] },
  { at: [0.78, 1.94], move: [0, -SHIFT[1]] },
];
/** Taille d'une répétition de la texture de chêne (son échantillon fait 1,83 m). */
const OAK_TILE = 1.83;

/** Matrice 4 × 4 (colonnes) appliquée à un point (w = 1) ou une direction (w = 0). */
const apply = (m, v, w = 1) =>
  [0, 1, 2].map(
    (r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * w,
  );
/** Inverse d'une matrice affine (rotation, échelle, translation) en colonnes. */
function invert(m) {
  const a = [
    [m[0], m[4], m[8]],
    [m[1], m[5], m[9]],
    [m[2], m[6], m[10]],
  ];
  const det =
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const inv = [
    [
      (a[1][1] * a[2][2] - a[1][2] * a[2][1]) / det,
      (a[0][2] * a[2][1] - a[0][1] * a[2][2]) / det,
      (a[0][1] * a[1][2] - a[0][2] * a[1][1]) / det,
    ],
    [
      (a[1][2] * a[2][0] - a[1][0] * a[2][2]) / det,
      (a[0][0] * a[2][2] - a[0][2] * a[2][0]) / det,
      (a[0][2] * a[1][0] - a[0][0] * a[1][2]) / det,
    ],
    [
      (a[1][0] * a[2][1] - a[1][1] * a[2][0]) / det,
      (a[0][1] * a[2][0] - a[0][0] * a[2][1]) / det,
      (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / det,
    ],
  ];
  const t = [m[12], m[13], m[14]];
  const it = inv.map((row) => -(row[0] * t[0] + row[1] * t[1] + row[2] * t[2]));
  return [
    inv[0][0],
    inv[1][0],
    inv[2][0],
    0,
    inv[0][1],
    inv[1][1],
    inv[2][1],
    0,
    inv[0][2],
    inv[1][2],
    inv[2][2],
    0,
    it[0],
    it[1],
    it[2],
    1,
  ];
}
const normalize = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};
const nodeNamed = (name) => {
  const node = root.listNodes().find((n) => n.getName() === name);
  if (!node?.getMesh()) throw new Error(`nœud introuvable : ${name}`);
  return node;
};

// Plateau : réduit autour de son centre, normales d'origine corrigées dans le
// même rapport (les flancs de l'ovale), UV « en boîte » en mètres réels.
{
  const node = nodeNamed(TABLE);
  const original = (await io.read(src))
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === TABLE)
    .getMesh()
    .listPrimitives();
  const world = node.getWorldMatrix();
  const local = invert(world);
  const texture = (file) =>
    doc
      .createTexture(file)
      .setImage(readFileSync(`${OAK}/${file}`))
      .setMimeType("image/jpeg");
  // ARM de Poly Haven = occlusion (R), rugosité (G), métal (B) : le canal ORM de glTF.
  const arm = texture("oak_veneer_01_arm_2k.jpg");
  const oak = doc
    .createMaterial("oak_veneer_01")
    .setBaseColorTexture(texture("oak_veneer_01_diff_2k.jpg"))
    .setNormalTexture(texture("oak_veneer_01_nor_gl_2k.jpg"))
    .setMetallicRoughnessTexture(arm)
    .setOcclusionTexture(arm)
    .setMetallicFactor(1)
    .setRoughnessFactor(1);
  const buffer = root.listBuffers()[0];
  node
    .getMesh()
    .listPrimitives()
    .forEach((prim, p) => {
      const positions = prim.getAttribute("POSITION");
      const sourceNormals = original[p].getAttribute("NORMAL");
      const count = positions.getCount();
      const normals = new Float32Array(count * 3);
      const uvs = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
        const w = apply(world, positions.getElement(i, []));
        w[0] = CENTER[0] + (w[0] - CENTER[0]) * SCALE[0];
        w[2] = CENTER[1] + (w[2] - CENTER[1]) * SCALE[1];
        positions.setElement(i, apply(local, w));
        let n = normalize(apply(world, sourceNormals.getElement(i, []), 0));
        n = normalize([n[0] / SCALE[0], n[1], n[2] / SCALE[1]]);
        const [ax, ay, az] = n.map(Math.abs);
        const uv =
          ay >= ax && ay >= az
            ? [w[0], w[2]]
            : ax >= az
              ? [w[2], w[1]]
              : [w[0], w[1]];
        uvs.set([uv[0] / OAK_TILE, uv[1] / OAK_TILE], i * 2);
        normals.set(normalize(apply(local, n, 0)), i * 3);
      }
      prim.setAttribute(
        "NORMAL",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(normals)
          .setBuffer(buffer),
      );
      prim.setAttribute(
        "TEXCOORD_0",
        doc.createAccessor().setType("VEC2").setArray(uvs).setBuffer(buffer),
      );
      prim.setMaterial(oak);
    });
}

// Chaises : chaque sommet suit la chaise la plus proche (centre au sol).
for (const name of ["seat_Leather_0", "seat_Material5_0"]) {
  const node = nodeNamed(name);
  const world = node.getWorldMatrix();
  const local = invert(world);
  for (const prim of node.getMesh().listPrimitives()) {
    const positions = prim.getAttribute("POSITION");
    for (let i = 0; i < positions.getCount(); i++) {
      const w = apply(world, positions.getElement(i, []));
      let best = CHAIRS[0];
      for (const chair of CHAIRS)
        if (
          Math.hypot(w[0] - chair.at[0], w[2] - chair.at[1]) <
          Math.hypot(w[0] - best.at[0], w[2] - best.at[1])
        )
          best = chair;
      positions.setElement(
        i,
        apply(local, [w[0] + best.move[0], w[1], w[2] + best.move[1]]),
      );
    }
  }
}

// 3 bis. Tissu des chaises (dossier et assise ; les pieds gardent leur texture
// précalculée) : l'atlas d'origine, flou et bruité de près, devient un velours
// (« Velour Velvet », Poly Haven, CC0, 1k) passé en gris et teinté du rose
// poudré d'origine, avec le reflet satiné du velours (KHR_materials_sheen) ;
// éclairé par la pièce, comme la table. UV « en boîte » en mètres réels.
const VELVET = process.argv[5]; // dossier des textures velour_velvet_*_1k.jpg
if (!VELVET)
  throw new Error("dossier des textures de velours manquant (4e argument)");
/** Taille d'une répétition du velours (son échantillon fait 28 cm). */
const VELVET_TILE = 0.28;
{
  const node = nodeNamed(UPHOLSTERY);
  const world = node.getWorldMatrix();
  // 512 px suffisent pour un grain répété tous les 28 cm (18 px/cm).
  const read = (file) =>
    sharp(readFileSync(`${VELVET}/${file}`))
      .resize(512, 512)
      .jpeg({ quality: 90 })
      .toBuffer();
  // Couleur du velours rouge ramenée au gris (le grain reste), la teinte vient
  // du facteur : le rose poudré des chaises d'origine (sRGB 214, 178, 172).
  // Deux passes : sharp applique ses opérations dans son ordre à lui (linear
  // avant normalise), un seul appel annulait l'éclaircissement.
  const stretched = await sharp(await read("velour_velvet_Diffuse_1k.jpg"))
    .grayscale()
    .normalise({ lower: 2, upper: 98 })
    .toBuffer();
  const grey = await sharp(stretched)
    .linear(0.25, 180)
    .jpeg({ quality: 90 })
    .toBuffer();
  const texture = (name, image) =>
    doc.createTexture(name).setImage(image).setMimeType("image/jpeg");
  const arm = texture("velvet_arm", await read("velour_velvet_arm_1k.jpg"));
  const srgb = (c) => ((c / 255 + 0.055) / 1.055) ** 2.4;
  const sheen = doc.createExtension(KHRMaterialsSheen);
  const velvet = doc
    .createMaterial("velour_velvet")
    .setBaseColorTexture(texture("velvet_diffuse", grey))
    .setBaseColorFactor([srgb(214), srgb(178), srgb(172), 1])
    .setNormalTexture(
      texture("velvet_normal", await read("velour_velvet_nor_gl_1k.jpg")),
    )
    // Sans l'occlusion de l'échantillon : à 28 cm de répétition, elle ne fait
    // qu'assombrir le tissu (les dossiers face à nous ne reçoivent que la
    // lumière ambiante, la fenêtre est derrière eux).
    .setMetallicRoughnessTexture(arm)
    .setMetallicFactor(1)
    .setRoughnessFactor(1)
    // Comme le matériau d'origine : le tissu est vu des deux côtés (dossier
    // fin, faces orientées vers l'intérieur par endroits).
    .setDoubleSided(true)
    .setExtension(
      "KHR_materials_sheen",
      sheen
        .createSheen()
        .setSheenColorFactor([srgb(235), srgb(205), srgb(200)])
        .setSheenRoughnessFactor(0.45),
    );
  const buffer = root.listBuffers()[0];
  for (const prim of node.getMesh().listPrimitives()) {
    const positions = prim.getAttribute("POSITION");
    const normals = prim.getAttribute("NORMAL");
    const count = positions.getCount();
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const w = apply(world, positions.getElement(i, []));
      const n = normalize(apply(world, normals.getElement(i, []), 0));
      const [ax, ay, az] = n.map(Math.abs);
      const uv =
        ay >= ax && ay >= az
          ? [w[0], w[2]]
          : ax >= az
            ? [w[2], w[1]]
            : [w[0], w[1]];
      uvs.set([uv[0] / VELVET_TILE, uv[1] / VELVET_TILE], i * 2);
    }
    prim.setAttribute(
      "TEXCOORD_0",
      doc.createAccessor().setType("VEC2").setArray(uvs).setBuffer(buffer),
    );
    prim.setMaterial(velvet);
  }
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
