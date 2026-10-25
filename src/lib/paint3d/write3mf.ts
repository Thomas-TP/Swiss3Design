// Export du projet de couleurs en 3MF, pour l'atelier : la pièce du visiteur
// (triangles d'origine, dans l'ordre, sommets soudés), à la taille et dans
// l'orientation choisies, posée au centre d'un plateau de 256 mm, et sa peinture
// par triangle dans les deux attributs des trancheurs (`paint_color` de Bambu
// Studio et OrcaSlicer, `slic3rpe:mmu_segmentation` de PrusaSlicer).
//
// Deux formes :
// - projet Bambu Studio (option `bambu`, celle du devis) : Bambu Studio crée à
//   l'ouverture les filaments du projet (nombre, couleurs, profils), filament
//   n = couleur n de la palette (voir bambu-project.ts) ;
// - 3MF simple : géométrie et peinture seulement (un trancheur garde alors ses
//   propres filaments).
// Plusieurs pièces : un objet assemblé (une pièce par volume), comme le fichier
// d'origine. Le XML est produit par morceaux et compressé au fil de l'eau.
import {
  projectSettings,
  type BambuFilament,
  type BambuTemplate,
} from "./bambu-project";
import type { PaintDocument } from "./document";
import { encodePaint } from "./selector";
import { writeZip } from "./zip";

/** Centre du plateau (mm) : P1S et K2, 256 et 260 mm de côté. */
export const PLATE_CENTER: readonly [number, number] = [128, 128];

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

export const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Millimètres au dixième de micron, sans zéros inutiles. */
function num(value: number): string {
  const fixed = value.toFixed(4);
  let end = fixed.length;
  while (fixed[end - 1] === "0") end--;
  if (fixed[end - 1] === ".") end--;
  const out = fixed.slice(0, end);
  return out === "-0" ? "0" : out;
}

export interface Export3mfOptions {
  /** Nom de l'objet (et du fichier dans le trancheur). */
  title: string;
  /** Avancement (0 à 1) de l'écriture des triangles. */
  onProgress?: (fraction: number) => void;
  /** Date des entrées de l'archive (tests). */
  now?: Date;
  /**
   * Teinte de chaque filament (« #RRGGBB », filament 1 en tête), écrite en
   * métadonnée propre (ignorée des trancheurs) : un fichier renvoyé à l'atelier
   * retrouve ses couleurs.
   */
  colors?: readonly string[];
  /**
   * Projet Bambu Studio : modèle de réglages (bambu-template.json, chargé à la
   * demande par l'appelant) et filaments, dans l'ordre (filament 1 = base).
   */
  bambu?: { template: BambuTemplate; filaments: readonly BambuFilament[] };
}

/** Nom de la métadonnée des teintes (lue par read.ts). */
export const COLORS_METADATA = "Kreya:FilamentColours";

/** Encodeur de texte par paquets d'≈ 1 Mo (le XML est produit au fil de l'eau). */
function chunker() {
  const encoder = new TextEncoder();
  let buffer: string[] = [];
  let size = 0;
  return {
    write(s: string) {
      buffer.push(s);
      size += s.length;
    },
    get full() {
      return size > 1 << 20;
    },
    flush() {
      const chunk = encoder.encode(buffer.join(""));
      buffer = [];
      size = 0;
      return chunk;
    },
  };
}

/** UUID stables (le fichier ne dépend que du document). */
const uuid = (id: number) =>
  `${id.toString(16).padStart(8, "0")}-5333-4d00-8000-000000000000`;

/**
 * Les maillages des pièces (`<object>` 1 à N), sommets décalés de `shift` :
 * le centre du plateau (3MF simple), ou le centre de la pièce (projet Bambu, la
 * position étant dans la transformation de l'objet).
 */
async function* meshChunks(
  doc: PaintDocument,
  options: Export3mfOptions,
  out: ReturnType<typeof chunker>,
  shift: readonly [number, number, number],
  withUuid: boolean,
): AsyncGenerator<Uint8Array> {
  const { vertexOf, vertexCount } = doc.topology;
  const local = new Int32Array(vertexCount).fill(-1);
  const parts = doc.parts;
  const total = doc.triangleCount;
  let done = 0;
  for (let p = 0; p < parts.length; p++) {
    const part = parts[p];
    const name =
      part.name ||
      (parts.length > 1 ? `${options.title} ${p + 1}` : options.title);
    const id = withUuid ? ` p:UUID="${uuid(p + 1)}"` : "";
    out.write(
      `  <object id="${p + 1}"${id} name="${xmlEscape(name)}" type="model">\n   <mesh>\n    <vertices>\n`,
    );
    // Sommets de la pièce, numérotés localement dans l'ordre de première apparition.
    const order: number[] = [];
    for (let t = part.first; t < part.first + part.count; t++)
      for (let i = 0; i < 3; i++) {
        const c = t * 3 + i;
        const v = vertexOf[c];
        if (local[v] >= 0) continue;
        local[v] = order.length;
        order.push(c);
      }
    for (const c of order) {
      const [x, y, z] = doc.toWorld(
        doc.positions[c * 3],
        doc.positions[c * 3 + 1],
        doc.positions[c * 3 + 2],
      );
      out.write(
        `     <vertex x="${num(x + shift[0])}" y="${num(y + shift[1])}" z="${num(z + shift[2])}"/>\n`,
      );
      if (out.full) yield out.flush();
    }
    out.write("    </vertices>\n    <triangles>\n");
    for (let t = part.first; t < part.first + part.count; t++) {
      const a = local[vertexOf[t * 3]];
      const b = local[vertexOf[t * 3 + 1]];
      const c = local[vertexOf[t * 3 + 2]];
      const paint = encodePaint(doc.node(t));
      out.write(
        paint
          ? `     <triangle v1="${a}" v2="${b}" v3="${c}" paint_color="${paint}" slic3rpe:mmu_segmentation="${paint}"/>\n`
          : `     <triangle v1="${a}" v2="${b}" v3="${c}"/>\n`,
      );
      done++;
      if (out.full) {
        options.onProgress?.(done / total);
        yield out.flush();
      }
    }
    out.write("    </triangles>\n   </mesh>\n  </object>\n");
    for (const c of order) local[vertexOf[c]] = -1;
  }
}

function colorsMetadata(options: Export3mfOptions): string {
  return options.colors?.length
    ? `
 <metadata name="${COLORS_METADATA}">${xmlEscape(options.colors.join(";"))}</metadata>`
    : "";
}

/** 3MF simple : un seul `3D/3dmodel.model`, pièce posée au centre du plateau. */
async function* plainModelChunks(
  doc: PaintDocument,
  options: Export3mfOptions,
): AsyncGenerator<Uint8Array> {
  const out = chunker();
  out.write(`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr-CH" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">
 <metadata name="Title">${xmlEscape(options.title)}</metadata>
 <metadata name="Application">Kreya - Atelier 3D</metadata>${colorsMetadata(options)}
 <resources>
`);
  const [cx, cy] = PLATE_CENTER;
  yield* meshChunks(doc, options, out, [cx, cy, 0], false);
  const parts = doc.parts;
  let root = 1;
  if (parts.length > 1) {
    root = parts.length + 1;
    out.write(
      `  <object id="${root}" name="${xmlEscape(options.title)}" type="model">\n   <components>\n`,
    );
    for (let p = 0; p < parts.length; p++)
      out.write(`    <component objectid="${p + 1}"/>\n`);
    out.write("   </components>\n  </object>\n");
  }
  out.write(` </resources>
 <build>
  <item objectid="${root}"/>
 </build>
</model>
`);
  options.onProgress?.(1);
  yield out.flush();
}

// ── Projet Bambu Studio ────────────────────────────────────────────────────
// Même découpage que les projets enregistrés par Bambu Studio 2.x : les
// maillages dans `3D/Objects/object_1.model`, un objet assemblé dans
// `3D/3dmodel.model` (extension Production, `p:path`), les pièces et le plateau
// dans `Metadata/model_settings.config`, les réglages et les filaments dans
// `Metadata/project_settings.config`. L'objet est centré sur lui-même et posé
// par sa transformation, comme dans Bambu Studio (les rotations du trancheur
// tournent alors autour de la pièce).

const OBJECT_PATH = "/3D/Objects/object_1.model";
const BAMBU_NAMESPACES =
  'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06" requiredextensions="p"';

/** Position de l'objet : centre du plateau, mi-hauteur de la pièce. */
function bambuPlacement(doc: PaintDocument): [number, number, number] {
  return [PLATE_CENTER[0], PLATE_CENTER[1], doc.worldBounds().size[2] / 2];
}

async function* bambuObjectChunks(
  doc: PaintDocument,
  options: Export3mfOptions,
): AsyncGenerator<Uint8Array> {
  const out = chunker();
  out.write(`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr-CH" ${BAMBU_NAMESPACES}>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
`);
  const [, , halfHeight] = bambuPlacement(doc);
  yield* meshChunks(doc, options, out, [0, 0, -halfHeight], true);
  out.write(` </resources>
 <build/>
</model>
`);
  options.onProgress?.(1);
  yield out.flush();
}

function bambuMainModel(
  doc: PaintDocument,
  options: Export3mfOptions,
  application: string,
): string {
  const parts = doc.parts;
  const root = parts.length + 1;
  const date = (options.now ?? new Date()).toISOString().slice(0, 10);
  const [x, y, z] = bambuPlacement(doc);
  const components = parts
    .map(
      (_, p) =>
        `    <component p:path="${OBJECT_PATH}" objectid="${p + 1}" p:UUID="${uuid(0x10000 + p + 1)}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr-CH" ${BAMBU_NAMESPACES}>
 <metadata name="Application">${xmlEscape(application)}</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="CreationDate">${date}</metadata>
 <metadata name="ModificationDate">${date}</metadata>${colorsMetadata(options)}
 <metadata name="Title">${xmlEscape(options.title)}</metadata>
 <resources>
  <object id="${root}" p:UUID="${uuid(root)}" type="model">
   <components>
${components}
   </components>
  </object>
 </resources>
 <build p:UUID="${uuid(0x20000)}">
  <item objectid="${root}" p:UUID="${uuid(0x30000)}" transform="1 0 0 0 1 0 0 0 1 ${num(x)} ${num(y)} ${num(z)}" printable="1"/>
 </build>
</model>
`;
}

/** Pièces (filament 1 par défaut, la peinture fait le reste) et plateau 1. */
function bambuModelSettings(
  doc: PaintDocument,
  options: Export3mfOptions,
): string {
  const parts = doc.parts;
  const root = parts.length + 1;
  const partsXml = parts
    .map((part, p) => {
      const name =
        part.name ||
        (parts.length > 1 ? `${options.title} ${p + 1}` : options.title);
      return `    <part id="${p + 1}" subtype="normal_part">
      <metadata key="name" value="${xmlEscape(name)}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="1"/>
      <mesh_stat face_count="${part.count}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${root}">
    <metadata key="name" value="${xmlEscape(options.title)}"/>
    <metadata key="extruder" value="1"/>
    <metadata face_count="${doc.triangleCount}"/>
${partsXml}
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_map_mode" value="Auto For Flush"/>
    <model_instance>
      <metadata key="object_id" value="${root}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="${root + 100}"/>
    </model_instance>
  </plate>
  <assemble>
  </assemble>
</config>
`;
}

const BAMBU_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="gcode" ContentType="text/x.gcode"/>
</Types>
`;

const BAMBU_MODEL_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="${OBJECT_PATH}" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

/**
 * Archive 3MF du document (Blob « model/3mf ») : projet Bambu Studio avec
 * `bambu`, 3MF simple sinon.
 */
export function write3mf(
  doc: PaintDocument,
  options: Export3mfOptions,
): Promise<Blob> {
  const encoder = new TextEncoder();
  if (!options.bambu)
    return writeZip(
      [
        { name: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES) },
        { name: "_rels/.rels", data: encoder.encode(RELS) },
        { name: "3D/3dmodel.model", data: plainModelChunks(doc, options) },
      ],
      options.now,
    );
  const { template, filaments } = options.bambu;
  const settings = projectSettings(template, filaments);
  const text = (s: string) => encoder.encode(s);
  return writeZip(
    [
      { name: "[Content_Types].xml", data: text(BAMBU_CONTENT_TYPES) },
      { name: "_rels/.rels", data: text(RELS) },
      {
        name: "3D/3dmodel.model",
        data: text(bambuMainModel(doc, options, template.application)),
      },
      { name: "3D/_rels/3dmodel.model.rels", data: text(BAMBU_MODEL_RELS) },
      {
        name: "3D/Objects/object_1.model",
        data: bambuObjectChunks(doc, options),
      },
      {
        name: "Metadata/model_settings.config",
        data: text(bambuModelSettings(doc, options)),
      },
      {
        name: "Metadata/project_settings.config",
        data: text(JSON.stringify(settings, null, 4) + "\n"),
      },
    ],
    options.now,
  );
}
