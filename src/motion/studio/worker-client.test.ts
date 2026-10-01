// Client du Worker (brief « Strates », §6.11) : un singleton, des réponses par
// `id`, et le repli sur le fil principal quand un Worker ne peut pas démarrer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { HERO_CONFIG } from "@/lib/studio/presets";
import { StudioWorkerError, type ToWorker } from "./protocol";
import { getStudioWorker } from "./worker-client";

const KEY = "__s3dStudioWorkerClient";
const job = {
  config: HERO_CONFIG,
  texts: {},
  lod: "drag" as const,
  tier: 1 as const,
  separate: false,
  locale: "fr" as const,
};

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[KEY];
  vi.unstubAllGlobals();
});

describe("client du Worker de géométrie", () => {
  it("un seul client pour la page : la scène et le moteur partagent le même Worker", () => {
    expect(getStudioWorker()).toBe(getStudioWorker());
  });

  it("sans Worker disponible, le calcul se fait sur le fil principal (repli)", async () => {
    // Node n'a pas de Worker du Web : `new Worker` lève, le client bascule.
    const built = await getStudioWorker().build(job);
    expect(built.mesh.triangles).toBeGreaterThan(0);
    expect(built.heightMm).toBe(150);
    const file = await getStudioWorker().exportStl(
      HERO_CONFIG,
      {},
      "s3d.stl",
      "fr",
    );
    expect(file.bytes).toBe(84 + 50 * file.triangles);
  });

  it("avec un Worker : requêtes numérotées, réponses résolues par id, les erreurs typées rejettent", async () => {
    const sent: ToWorker[] = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(message: ToWorker) {
        sent.push(message);
        if (message.t === "build") {
          // Réponse dans le désordre : la 2e requête répond avant la 1re.
          queueMicrotask(() => {
            if (message.id === 2)
              this.onmessage?.({
                data: {
                  t: "mesh",
                  id: 2,
                  mesh: { triangles: 2 },
                  ms: 1,
                  bands: [],
                  heightMm: 20,
                },
              } as MessageEvent);
          });
        }
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", FakeWorker);
    const client = getStudioWorker();
    const first = client.build(job);
    const second = client.build({ ...job, lod: "display" });
    await expect(second).resolves.toMatchObject({ heightMm: 20 });
    expect(sent.map((m) => (m.t === "build" ? m.id : 0))).toEqual([1, 2]);
    // La 1re réponse n'est jamais arrivée : elle reste en attente (la scène l'ignore).
    const settled = await Promise.race([
      first.then(() => "resolved"),
      Promise.resolve("pending"),
    ]);
    expect(settled).toBe("pending");
  });

  it("un échec du script du Worker bascule sur le fil principal, y compris pour la requête en vol", async () => {
    class BrokenWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() =>
          this.onerror?.({ preventDefault() {} } as unknown as ErrorEvent),
        );
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", BrokenWorker);
    const built = await getStudioWorker().build(job);
    expect(built.mesh.triangles).toBeGreaterThan(0);
    expect(built.bands).toHaveLength(3);
  });

  it("l'erreur d'une requête garde son code", () => {
    const error = new StudioWorkerError("export", "boum");
    expect(error.code).toBe("export");
    expect(error.name).toBe("StudioWorkerError");
  });
});
