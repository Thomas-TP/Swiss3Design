// Export du projet de couleurs en 3MF, pour l'atelier : la pièce du visiteur
// (triangles d'origine, dans l'ordre, sommets soudés), à la taille et dans
// l'orientation choisies, posée au centre d'un plateau de 256 mm, et sa peinture
// par triangle dans les deux attributs des trancheurs (`paint_color` de Bambu
// Studio et OrcaSlicer, `slic3rpe:mmu_segmentation` de PrusaSlicer). Ouvert dans
// Bambu Studio, le fichier arrive peint : filament n = couleur n de la palette.
// Plusieurs pièces : un objet assemblé (une pièce par volume), comme le fichier
// d'origine. Le XML est produit par morceaux et compressé au fil de l'eau.
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
}

/** Nom de la métadonnée des teintes (lue par read.ts). */
export const COLORS_METADATA = "Swiss3Design:FilamentColours";

/** Morceaux du fichier `3D/3dmodel.model`, encodés en UTF-8 par paquets d'≈ 1 Mo. */
async function* modelChunks(
  doc: PaintDocument,
  options: Export3mfOptions,
): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  let buffer: string[] = [];
  let size = 0;
  const flush = () => {
    const chunk = encoder.encode(buffer.join(""));
    buffer = [];
    size = 0;
    return chunk;
  };
  const write = (s: string) => {
    buffer.push(s);
    size += s.length;
  };

  write(`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr-CH" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">
 <metadata name="Title">${xmlEscape(options.title)}</metadata>
 <metadata name="Application">Swiss3Design - Atelier 3D</metadata>${
   options.colors?.length
     ? `
 <metadata name="${COLORS_METADATA}">${xmlEscape(options.colors.join(";"))}</metadata>`
     : ""
 }
 <resources>
`);
  const { vertexOf, vertexCount } = doc.topology;
  const local = new Int32Array(vertexCount).fill(-1);
  const [cx, cy] = PLATE_CENTER;
  const parts = doc.parts;
  const total = doc.triangleCount;
  let done = 0;
  for (let p = 0; p < parts.length; p++) {
    const part = parts[p];
    const name =
      part.name ||
      (parts.length > 1 ? `${options.title} ${p + 1}` : options.title);
    write(
      `  <object id="${p + 1}" name="${xmlEscape(name)}" type="model">\n   <mesh>\n    <vertices>\n`,
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
      write(
        `     <vertex x="${num(x + cx)}" y="${num(y + cy)}" z="${num(z)}"/>\n`,
      );
      if (size > 1 << 20) yield flush();
    }
    write("    </vertices>\n    <triangles>\n");
    for (let t = part.first; t < part.first + part.count; t++) {
      const a = local[vertexOf[t * 3]];
      const b = local[vertexOf[t * 3 + 1]];
      const c = local[vertexOf[t * 3 + 2]];
      const paint = encodePaint(doc.node(t));
      write(
        paint
          ? `     <triangle v1="${a}" v2="${b}" v3="${c}" paint_color="${paint}" slic3rpe:mmu_segmentation="${paint}"/>\n`
          : `     <triangle v1="${a}" v2="${b}" v3="${c}"/>\n`,
      );
      done++;
      if (size > 1 << 20) {
        options.onProgress?.(done / total);
        yield flush();
      }
    }
    write("    </triangles>\n   </mesh>\n  </object>\n");
    for (const c of order) local[vertexOf[c]] = -1;
  }
  let root = 1;
  if (parts.length > 1) {
    root = parts.length + 1;
    write(
      `  <object id="${root}" name="${xmlEscape(options.title)}" type="model">\n   <components>\n`,
    );
    for (let p = 0; p < parts.length; p++)
      write(`    <component objectid="${p + 1}"/>\n`);
    write("   </components>\n  </object>\n");
  }
  write(` </resources>
 <build>
  <item objectid="${root}"/>
 </build>
</model>
`);
  options.onProgress?.(1);
  yield flush();
}

/** Archive 3MF du document (Blob « model/3mf »). */
export function write3mf(
  doc: PaintDocument,
  options: Export3mfOptions,
): Promise<Blob> {
  const encoder = new TextEncoder();
  return writeZip(
    [
      { name: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES) },
      { name: "_rels/.rels", data: encoder.encode(RELS) },
      { name: "3D/3dmodel.model", data: modelChunks(doc, options) },
    ],
    options.now,
  );
}
