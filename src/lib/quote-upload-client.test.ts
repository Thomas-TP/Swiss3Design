import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_UPLOAD_ACCEPT,
  QUOTE_UPLOAD_MAX_BYTES,
  QuoteUploadError,
  checkQuoteFile,
  fileExtension,
  isQuoteUploadError,
  uploadQuoteFile,
  type UploadBytesProgress,
} from "./quote-upload-client";

// Faux XMLHttpRequest : le client n'utilise que open, send, abort, upload.* et
// les rappels onload/onerror/ontimeout/onabort ; chaque test pilote la
// réponse à la main (`respond`, `fail`, `progress`).
class FakeXhr {
  static last: FakeXhr | null = null;
  method = "";
  url = "";
  timeout = 0;
  responseType = "";
  status = 0;
  responseText = "";
  body: FormData | null = null;
  upload: {
    onprogress: ((e: ProgressEventInit) => void) | null;
    onload: (() => void) | null;
  } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable });
  }
  respond(status: number, json: unknown) {
    this.upload.onload?.();
    this.status = status;
    this.responseText = typeof json === "string" ? json : JSON.stringify(json);
    this.onload?.();
  }
  fail() {
    this.onerror?.();
  }
}

const stl = (name = "vase.stl", size = 1200) =>
  new File([new Uint8Array(size)], name);

function xhr(): FakeXhr {
  if (!FakeXhr.last) throw new Error("aucune requête envoyée");
  return FakeXhr.last;
}

beforeEach(() => {
  FakeXhr.last = null;
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});
afterEach(() => vi.unstubAllGlobals());

describe("checkQuoteFile", () => {
  it("accepte les cinq extensions, quelle que soit la casse", () => {
    for (const name of ["a.stl", "b.3MF", "c.Obj", "d.step", "e.STP"])
      expect(checkQuoteFile(name, 10)).toBeNull();
  });

  it("refuse un format inconnu ou sans extension (415)", () => {
    expect(checkQuoteFile("photo.jpg", 10)).toBe(415);
    expect(checkQuoteFile("archive.stl.zip", 10)).toBe(415);
    expect(checkQuoteFile("sans-extension", 10)).toBe(415);
    expect(checkQuoteFile("", 10)).toBe(415);
  });

  it("refuse au-delà de 30 Mo (413), accepte pile 30 Mo", () => {
    expect(checkQuoteFile("a.stl", QUOTE_UPLOAD_MAX_BYTES)).toBeNull();
    expect(checkQuoteFile("a.stl", QUOTE_UPLOAD_MAX_BYTES + 1)).toBe(413);
  });

  it("donne le format avant la taille quand les deux sont faux", () => {
    expect(checkQuoteFile("a.jpg", QUOTE_UPLOAD_MAX_BYTES + 1)).toBe(415);
  });
});

describe("fileExtension et accept", () => {
  it("lit la dernière extension, en minuscules", () => {
    expect(fileExtension("Mon.Vase.STL")).toBe("stl");
    expect(fileExtension("noext")).toBe("");
  });

  it("liste les extensions dans l'attribut accept du champ fichier", () => {
    expect(QUOTE_UPLOAD_ACCEPT).toBe(".stl,.3mf,.obj,.step,.stp");
  });
});

describe("uploadQuoteFile", () => {
  it("envoie le fichier en multipart (champ « file ») à la route et résout", async () => {
    const pending = uploadQuoteFile(stl());
    const req = xhr();
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/api/quote-upload");
    expect(req.body?.get("file")).toBeInstanceOf(File);
    expect((req.body?.get("file") as File).name).toBe("vase.stl");
    req.respond(200, { key: "quotes/abc-vase.stl", fileName: "vase.stl" });
    await expect(pending).resolves.toEqual({
      key: "quotes/abc-vase.stl",
      fileName: "vase.stl",
    });
  });

  it("nomme un Blob (Studio) avec fileName", async () => {
    const pending = uploadQuoteFile(
      new Blob([new Uint8Array(84)], { type: "model/stl" }),
      undefined,
      { fileName: "s3d-lavaux-ab12cd34.stl" },
    );
    const sent = xhr().body?.get("file") as File;
    expect(sent.name).toBe("s3d-lavaux-ab12cd34.stl");
    xhr().respond(200, {
      key: "quotes/x-s3d-lavaux-ab12cd34.stl",
      fileName: "s3d-lavaux-ab12cd34.stl",
    });
    await pending;
  });

  it("rapporte la progression, plafonnée au total, puis 100 % à la fin", async () => {
    const seen: UploadBytesProgress[] = [];
    const pending = uploadQuoteFile(stl("a.stl", 1000), (p) => seen.push(p));
    xhr().progress(250, 1300);
    xhr().progress(1100, 1300); // corps multipart : peut dépasser la taille du fichier
    xhr().progress(0, 0, false); // non calculable : ignoré
    xhr().respond(200, { key: "quotes/a-a.stl", fileName: "a.stl" });
    await pending;
    expect(seen).toEqual([
      { loaded: 250, total: 1000 },
      { loaded: 1000, total: 1000 },
      { loaded: 1000, total: 1000 },
    ]);
  });

  it.each([429, 413, 415, 400] as const)(
    "type l'échec HTTP %i",
    async (status) => {
      const pending = uploadQuoteFile(stl());
      xhr().respond(status, { error: "x" });
      const error = await pending.catch((e: unknown) => e);
      expect(isQuoteUploadError(error)).toBe(true);
      expect((error as QuoteUploadError).code).toBe(status);
      expect((error as QuoteUploadError).status).toBe(status);
    },
  );

  it("range tout autre statut (500, 404…) sous « network »", async () => {
    for (const status of [500, 502, 404]) {
      const pending = uploadQuoteFile(stl());
      xhr().respond(status, "boom");
      const error = (await pending.catch((e: unknown) => e)) as QuoteUploadError;
      expect(error.code).toBe("network");
      expect(error.status).toBe(status);
    }
  });

  it("type une coupure réseau et un délai dépassé « network », statut 0", async () => {
    const dropped = uploadQuoteFile(stl());
    xhr().fail();
    const error = (await dropped.catch((e: unknown) => e)) as QuoteUploadError;
    expect(error.code).toBe("network");
    expect(error.status).toBe(0);

    const slow = uploadQuoteFile(stl());
    xhr().ontimeout?.();
    await expect(slow).rejects.toMatchObject({ code: "network" });
  });

  it("refuse une réponse 200 sans clé quotes/ valide (« network »)", async () => {
    for (const body of [
      "pas du json",
      {},
      { key: "uploads/x.stl", fileName: "x.stl" },
      { key: "quotes/x.stl" },
    ]) {
      const pending = uploadQuoteFile(stl());
      xhr().respond(200, body);
      await expect(pending).rejects.toMatchObject({ code: "network" });
    }
  });

  it("refuse avant toute requête : mauvais format (415) et gros fichier (413)", async () => {
    await expect(uploadQuoteFile(stl("photo.jpg"))).rejects.toMatchObject({
      code: 415,
    });
    expect(FakeXhr.last).toBeNull();

    const big = new File([new Uint8Array(1)], "a.stl");
    Object.defineProperty(big, "size", { value: QUOTE_UPLOAD_MAX_BYTES + 1 });
    await expect(uploadQuoteFile(big)).rejects.toMatchObject({ code: 413 });
    expect(FakeXhr.last).toBeNull();
  });

  it("annule : AbortError, et pas de requête si le signal l'est déjà", async () => {
    const controller = new AbortController();
    const pending = uploadQuoteFile(stl(), undefined, {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });

    FakeXhr.last = null;
    await expect(
      uploadQuoteFile(stl(), undefined, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last).toBeNull();
  });
});
