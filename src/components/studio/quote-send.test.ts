import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteUploadError } from "@/lib/quote-upload-client";
import { CARTOUCHE_DEFAULT, LAVAUX_DEFAULT } from "@/lib/studio/presets";
import type { BridgeStudio } from "@/lib/motion-bridge/types";
import {
  StudioSendError,
  prepareStudioFile,
  uploadName,
  type PrepareDeps,
  type PrepareProgress,
} from "./quote-send";
import { installFakeSession } from "./testing";
import { readCachedUpload, uploadHash } from "./upload-cache";

const messages = { engine: "moteur absent", export: "export raté" };

function setup() {
  const exportStl = vi.fn<BridgeStudio["exportStl"]>(async () => ({
    blob: new Blob([new Uint8Array(84 + 50 * 10)], { type: "model/stl" }),
    triangles: 10,
    bytes: 584,
  }));
  const upload = vi.fn<PrepareDeps["upload"]>(async (_file, onProgress) => {
    onProgress?.({ loaded: 292, total: 584 });
    onProgress?.({ loaded: 584, total: 584 });
    return { key: "quotes/uuid-s3d.stl", fileName: "s3d.stl" };
  });
  const track = vi.fn<PrepareDeps["track"]>();
  const deps: Partial<PrepareDeps> = {
    engine: async () => ({ exportStl }),
    upload,
    track,
    engineTimeoutMs: 10,
  };
  return { exportStl, upload, track, deps };
}

describe("préparation du fichier de la demande (§6.9)", () => {
  let session: ReturnType<typeof installFakeSession>;
  beforeEach(() => {
    session = installFakeSession();
  });
  afterEach(() => session.uninstall());

  it("exporte puis envoie, annonce les phases, mémorise, et mesure sans texte", async () => {
    const { exportStl, upload, track, deps } = setup();
    const progress: PrepareProgress[] = [];
    const file = await prepareStudioFile(
      {
        config: CARTOUCHE_DEFAULT,
        texts: { name: "Zoé Sentinelle" },
        locale: "fr",
        object: "cartouche",
        bands: 2,
        estimate: { lowCents: 900, highCents: 1050 },
        messages,
        onProgress: (p) => progress.push(p),
      },
      deps,
    );
    expect(file).toEqual({
      key: "quotes/uuid-s3d.stl",
      name: uploadName(CARTOUCHE_DEFAULT, { name: "Zoé Sentinelle" }, "fr"),
      bytes: 584,
      triangles: 10,
    });
    expect(file.name).toMatch(/^s3d-cartouche-[0-9a-f]{8}\.stl$/);
    expect(exportStl).toHaveBeenCalledOnce();
    expect(exportStl.mock.calls[0][1]).toEqual({ name: "Zoé Sentinelle" });
    expect(upload.mock.calls[0][2]).toEqual({ fileName: file.name });
    expect(progress.map((p) => p.phase)).toEqual([
      "prepare",
      "prepare",
      "upload",
      "upload",
    ]);
    expect(progress[1].triangles).toBe(10);
    // Événement Studio Sent : aucun texte saisi, estimation en CHF décimaux.
    expect(track).toHaveBeenCalledWith("Studio Sent", {
      object: "cartouche",
      bands: 2,
      triangles: 10,
      bytes: 584,
      estimate_low: 9,
      estimate_high: 10.5,
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain("Sentinelle");
    // Mémorisé : une configuration inchangée n'est jamais renvoyée.
    const hash = uploadHash(
      CARTOUCHE_DEFAULT,
      { name: "Zoé Sentinelle" },
      "fr",
    );
    expect(readCachedUpload(hash)?.key).toBe("quotes/uuid-s3d.stl");
  });

  it("une configuration inchangée ne refait ni l'export ni l'envoi (« Réessayer » après une erreur de la Server Action)", async () => {
    const { exportStl, upload, deps } = setup();
    const input = {
      config: LAVAUX_DEFAULT,
      texts: {},
      locale: "fr",
      object: "lavaux" as const,
      bands: 3,
      messages,
      onProgress: () => undefined,
    };
    const first = await prepareStudioFile(input, deps);
    const second = await prepareStudioFile(input, deps);
    expect(second).toEqual(first);
    expect(exportStl).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    // Une autre configuration repart.
    await prepareStudioFile(
      { ...input, config: { ...LAVAUX_DEFAULT, h: 160 } },
      deps,
    );
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("un 429 (quota de 10 envois par heure) remonte tel quel, et rien n'est mémorisé", async () => {
    const { deps } = setup();
    const refused = new QuoteUploadError(429, 429);
    deps.upload = async () => {
      throw refused;
    };
    const input = {
      config: LAVAUX_DEFAULT,
      texts: {},
      locale: "fr",
      object: "lavaux" as const,
      bands: 3,
      messages,
      onProgress: () => undefined,
    };
    await expect(prepareStudioFile(input, deps)).rejects.toBe(refused);
    expect(readCachedUpload(uploadHash(LAVAUX_DEFAULT, {}, "fr"))).toBeNull();
  });

  it("moteur absent ou export raté : un message prêt pour le visiteur (userMessage)", async () => {
    const base = {
      config: LAVAUX_DEFAULT,
      texts: {},
      locale: "fr",
      object: "lavaux" as const,
      bands: 3,
      messages,
      onProgress: () => undefined,
    };
    await expect(
      prepareStudioFile(base, { ...setup().deps, engine: async () => null }),
    ).rejects.toMatchObject({ userMessage: "moteur absent" });

    const failing = setup();
    failing.deps.engine = async () => ({
      exportStl: async () => {
        throw new Error("boum");
      },
    });
    const error = await prepareStudioFile(base, failing.deps).catch((e) => e);
    expect(error).toBeInstanceOf(StudioSendError);
    expect(error.userMessage).toBe("export raté");
  });
});
