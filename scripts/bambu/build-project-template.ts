// Fabrique le modèle de projet Bambu Studio de l'atelier 3D
// (src/lib/paint3d/bambu-template.json), à partir du Bambu Studio installé.
//
//   bun scripts/bambu/build-project-template.ts [chemin/vers/bambu-studio.exe]
//
// Pourquoi : un 3MF « d'un autre logiciel » n'apporte à Bambu Studio que la
// géométrie et la peinture ; les filaments restent ceux du projet ouvert, et la
// peinture d'un filament absent est perdue au chargement (Plater.cpp, 2.08).
// Un projet Bambu (`Application` = « BambuStudio-… » et
// `Metadata/project_settings.config`) charge au contraire ses propres
// filaments, avec leurs couleurs et leurs réglages.
//
// Composition, comme l'interface quand elle enregistre un projet :
// 1. la liste complète des clés et leurs valeurs par défaut : un projet exporté
//    par la ligne de commande (elle n'applique pas les profils : plateau de
//    200 mm, densité 0… mais toutes les clés y sont, au format du projet) ;
// 2. par-dessus, la machine puis les réglages d'impression, résolus ici depuis
//    leurs fichiers JSON (`inherits` jusqu'aux profils communs) ;
// 3. pour chaque profil de filament du stock, ses valeurs résolues de la même
//    façon. L'atelier assemble N filaments en les concaténant clé par clé
//    (src/lib/paint3d/bambu-project.ts).
// Les réglages « à variantes » (une valeur par type de buse) ne gardent que
// celle de la machine, « Direct Drive Standard » sur P1S : c'est ce que contient
// un projet enregistré par l'interface. Les listes de clés viennent du code de
// Bambu Studio (Preset.cpp, PrintConfig.cpp).
//
// Imprimante : Bambu Lab P1S, buse 0.4, « 0.20mm Standard @BBL X1C ». Pour une
// autre machine, changer MACHINE / PROCESS (et les profils de filament) puis
// relancer.
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const EXE = process.argv[2] ?? "C:/Program Files/Bambu Studio/bambu-studio.exe";
const PROFILES = path.join(path.dirname(EXE), "resources/profiles/BBL");
const MACHINE = "Bambu Lab P1S 0.4 nozzle";
const PROCESS = "0.20mm Standard @BBL X1C";
/** Plateau de l'atelier (la ligne de commande met « Cool Plate »). */
const BED = "Textured PEI Plate";
const VARIANT = "Direct Drive Standard";

/** Profils de filament proposés à l'atelier (voir bambuPresetFor côté client). */
const PRESETS = [
  "Bambu PLA Basic @BBL X1C",
  "Bambu PLA Matte @BBL X1C",
  "Bambu PLA Metal @BBL X1C",
  "Bambu PLA Silk @BBL X1C",
  "Bambu PLA Wood @BBL X1C",
  "PolyTerra PLA @BBL X1C",
  "Generic PLA Silk",
  "Generic PLA",
];

/** Clés d'un profil qui le décrivent sans être des réglages. */
const META = new Set([
  "name",
  "inherits",
  "from",
  "setting_id",
  "filament_id",
  "instantiation",
  "description",
  "type",
  "compatible_printers",
  "compatible_printers_condition",
  "compatible_prints",
  "compatible_prints_condition",
  "renamed_from",
  "include",
  "version",
]);

const SOURCE = "https://raw.githubusercontent.com/bambulab/BambuStudio/master";

/** Une liste de chaînes C++ (`… nom = { "a", "b" };`) du code de Bambu Studio. */
async function sourceList(file: string, pattern: RegExp): Promise<Set<string>> {
  const src = await (await fetch(`${SOURCE}/${file}`)).text();
  const body = pattern.exec(src)?.[1];
  if (!body) throw new Error(`Liste introuvable dans ${file}`);
  // Les entrées commentées (« //"x", ») ne comptent pas.
  const live = body.replace(/\/\/[^\n]*/g, "");
  return new Set([...live.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
}

/** Une entrée d'un ZIP (lecture minimale : répertoire central, deflate). */
function zipEntry(zip: Buffer, name: string): Buffer {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = zip.readUInt32LE(eocd + 16);
  const count = zip.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extra = zip.readUInt16LE(p + 30);
    const comment = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entry = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (entry === name) {
      const start =
        local +
        30 +
        zip.readUInt16LE(local + 26) +
        zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    }
    p += 46 + nameLen + extra + comment;
  }
  throw new Error(`${name} absent de l'archive`);
}

/** Cube de 10 mm en STL ASCII : la pièce n'a aucune importance ici. */
const CUBE_STL = (() => {
  const v = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 10, 0],
    [0, 10, 0],
    [0, 0, 10],
    [10, 0, 10],
    [10, 10, 10],
    [0, 10, 10],
  ];
  const f = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ];
  const facets = f
    .map(
      (t) =>
        `facet normal 0 0 0\nouter loop\n${t.map((i) => `vertex ${v[i].join(" ")}`).join("\n")}\nendloop\nendfacet`,
    )
    .join("\n");
  return `solid cube\n${facets}\nendsolid cube\n`;
})();

/** Projet exporté par la ligne de commande : la liste des clés et leurs défauts. */
async function cliDefaults(dir: string) {
  await writeFile(path.join(dir, "cube.stl"), CUBE_STL);
  const out = path.join(dir, "defaults.3mf");
  const r = spawnSync(
    EXE,
    [
      "--load-settings",
      `${PROFILES}/machine/${MACHINE}.json;${PROFILES}/process/${PROCESS}.json`,
      "--load-filaments",
      `${PROFILES}/filament/${PRESETS[0]}.json`,
      "--export-3mf",
      out,
      path.join(dir, "cube.stl"),
    ],
    { cwd: dir, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`Bambu Studio a rendu ${r.status}`);
  const zip = await readFile(out);
  const model = zipEntry(zip, "3D/3dmodel.model").toString("utf8");
  const application = /name="Application">([^<]+)</.exec(model)?.[1];
  if (!application?.startsWith("BambuStudio-"))
    throw new Error(`Application inattendue : ${application}`);
  const config = JSON.parse(
    zipEntry(zip, "Metadata/project_settings.config").toString("utf8"),
  ) as Profile;
  return { application, config };
}

type Profile = Record<string, unknown>;

/** Profil complet : le fichier, puis ses parents (`inherits`). */
async function resolveProfile(kind: string, name: string): Promise<Profile> {
  const own = JSON.parse(
    await readFile(path.join(PROFILES, kind, `${name}.json`), "utf8"),
  ) as Profile;
  const parent =
    typeof own.inherits === "string" && own.inherits
      ? await resolveProfile(kind, own.inherits)
      : {};
  return { ...parent, ...own };
}

/**
 * Valeur d'un profil au format du projet : la variante de la machine pour une
 * clé à variantes, un tableau si le projet en attend un (et inversement).
 */
function projectValue(
  raw: unknown,
  like: unknown,
  variantIndex: number | null,
): unknown {
  let value = raw;
  if (variantIndex !== null && Array.isArray(value) && value.length > 1)
    value = [value[variantIndex] ?? value[0]];
  if (Array.isArray(like) && !Array.isArray(value)) value = [value];
  if (!Array.isArray(like) && Array.isArray(value)) value = value[0];
  return value;
}

function variantIndex(profile: Profile, key: string): number | null {
  const variants = profile[key];
  if (!Array.isArray(variants) || variants.length < 2) return null;
  return Math.max(0, variants.indexOf(VARIANT));
}

const filamentOptions = await sourceList(
  "src/libslic3r/Preset.cpp",
  /s_Preset_filament_options \{([\s\S]*?)\};/,
);
for (const k of [
  "filament_colour",
  "filament_settings_id",
  "filament_ids",
  "filament_self_index",
  "filament_map",
  "filament_multi_colour",
  "filament_colour_type",
])
  filamentOptions.add(k);
const printVariants = await sourceList(
  "src/libslic3r/PrintConfig.cpp",
  /print_options_with_variant = \{([\s\S]*?)\};/,
);
const printerVariants = await sourceList(
  "src/libslic3r/PrintConfig.cpp",
  /printer_options_with_variant_1 = \{([\s\S]*?)\};/,
);
const filamentVariants = await sourceList(
  "src/libslic3r/PrintConfig.cpp",
  /filament_options_with_variant = \{([\s\S]*?)\};/,
);
const filamentDev = await sourceList(
  "src/libslic3r/PrintConfig.cpp",
  /filament_dev_options = \{([\s\S]*?)\};/,
);

const dir = await mkdtemp(path.join(tmpdir(), "s3d-bambu-"));
try {
  const { application, config: defaults } = await cliDefaults(dir);
  const machine = await resolveProfile("machine", MACHINE);
  const process_ = await resolveProfile("process", PROCESS);
  const perFilament = Object.keys(defaults)
    .filter((k) => filamentOptions.has(k) && Array.isArray(defaults[k]))
    .sort();

  // Partie commune : défauts, puis machine, puis réglages d'impression.
  const shared: Profile = {};
  const printerIdx = variantIndex(machine, "printer_extruder_variant");
  const printIdx = variantIndex(process_, "print_extruder_variant");
  for (const [key, like] of Object.entries(defaults)) {
    if (perFilament.includes(key)) continue;
    let value = like;
    if (key in machine && !META.has(key))
      value = projectValue(
        machine[key],
        like,
        printerVariants.has(key) ? printerIdx : null,
      );
    if (key in process_ && !META.has(key))
      value = projectValue(
        process_[key],
        like,
        printVariants.has(key) ? printIdx : null,
      );
    shared[key] = value;
  }
  shared.curr_bed_type = BED;
  shared.printer_settings_id = MACHINE;
  shared.print_settings_id = PROCESS;
  for (const key of [
    "printer_extruder_variant",
    "print_extruder_variant",
    "extruder_variant_list",
  ])
    if (key in shared) shared[key] = [VARIANT];

  // Filaments : une entrée par filament (variante de la machine), sauf les
  // réglages de séchage, gardés entiers comme dans les projets de l'interface.
  const presets: Record<string, Record<string, unknown[]>> = {};
  for (const name of PRESETS) {
    const profile = await resolveProfile("filament", name);
    const idx = variantIndex(profile, "filament_extruder_variant");
    const values: Record<string, unknown[]> = {};
    for (const key of perFilament) {
      const raw = profile[key];
      if (raw === undefined || META.has(key)) {
        values[key] = defaults[key] as unknown[];
        continue;
      }
      const list = Array.isArray(raw) ? raw : [raw];
      values[key] = filamentDev.has(key)
        ? list
        : filamentVariants.has(key) && idx !== null
          ? [list[idx] ?? list[0]]
          : [list[0]];
    }
    values.filament_settings_id = [name];
    values.filament_ids = [String(profile.filament_id ?? "")];
    values.filament_extruder_variant = [VARIANT];
    presets[name] = values;
  }

  const template = {
    note: "Généré par scripts/bambu/build-project-template.ts : ne pas modifier à la main.",
    application,
    machine: MACHINE,
    process: PROCESS,
    shared,
    perFilament,
    presets,
  };
  const target = path.resolve("src/lib/paint3d/bambu-template.json");
  await writeFile(target, JSON.stringify(template) + "\n");
  console.log(
    `✓ ${path.relative(process.cwd(), target)} · ${application} · ${perFilament.length} clés par filament · ${PRESETS.length} profils`,
  );
  console.log(
    `  plateau ${JSON.stringify(shared.printable_area)} · hauteur ${String(shared.printable_height)} · couche ${String(shared.layer_height)} · remplissage ${String(shared.sparse_infill_density)}`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
  await rm("result.json", { force: true });
}
