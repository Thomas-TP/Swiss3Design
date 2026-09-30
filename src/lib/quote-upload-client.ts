// Client de l'envoi d'un modèle 3D joint à une demande de devis (brief
// « Strates », §7.10 et §6.9) : POST /api/quote-upload, le seul point d'entrée
// des fichiers clients (préfixe privé quotes/ du R2, cookie propriétaire
// s3d-upload-owner). Partagé par le formulaire de /custom (dépôt d'un fichier)
// et par le tiroir du Studio (STL écrit dans un Web Worker, envoyé en Blob).
//
// XMLHttpRequest et non fetch : fetch ne sait pas rapporter la progression de
// l'envoi (upload.onprogress), or un STL de 3 Mo sur une connexion mobile doit
// montrer « 42 % » (attente narrée, §6.9). Léger et sans dépendance : aucun
// import de three, gsap ou lenis (règle d'or 11).
//
// Les limites ci-dessous reprennent celles de la route (src/app/api/
// quote-upload/route.ts) pour refuser tout de suite, sans requête, ce que le
// serveur refuserait de toute façon. Elles ne remplacent pas le serveur, qui
// reste seul juge : signature du fichier, quota, propriétaire. Une route
// inchangée a un corollaire : au-delà de 30 Mo + 64 Ko, le serveur répond
// « 400 missing_file » (corps refusé avant lecture) et non 413 ; la garde
// côté client est donc la seule à donner un message juste pour un gros fichier.

/** 30 Mo : plafond de la route. */
export const QUOTE_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;

/** Extensions acceptées par la route (et attribut `accept` du champ fichier). */
export const QUOTE_UPLOAD_EXTENSIONS = [
  "stl",
  "3mf",
  "obj",
  "step",
  "stp",
] as const;
export const QUOTE_UPLOAD_ACCEPT = QUOTE_UPLOAD_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");

/** Point d'entrée de la route. */
export const QUOTE_UPLOAD_ENDPOINT = "/api/quote-upload";

// 10 minutes : 30 Mo à 1 Mbit/s prennent 4 minutes ; au-delà, l'envoi est mort.
const TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Cause d'un échec. Les quatre statuts HTTP que la route produit, plus
 * « network » pour tout le reste : coupure, délai dépassé, réponse illisible,
 * erreur serveur (5xx). Le message affiché est le même dans ces cas : « vérifiez
 * votre connexion et réessayez ».
 *  - 429 : quota dépassé (10 envois par heure et par IP) ;
 *  - 413 : fichier trop gros ;
 *  - 415 : extension ou signature non reconnue ;
 *  - 400 : fichier absent, illisible, ou corps refusé avant lecture.
 */
export type QuoteUploadErrorCode = 429 | 413 | 415 | 400 | "network";

export class QuoteUploadError extends Error {
  readonly code: QuoteUploadErrorCode;
  /** Statut HTTP reçu, 0 s'il n'y a pas eu de réponse (ou refus côté client). */
  readonly status: number;

  constructor(code: QuoteUploadErrorCode, status = 0) {
    super(`quote-upload: ${code}`);
    this.name = "QuoteUploadError";
    this.code = code;
    this.status = status;
  }
}

export function isQuoteUploadError(value: unknown): value is QuoteUploadError {
  return value instanceof QuoteUploadError;
}

export interface UploadBytesProgress {
  /** Octets envoyés (corps multipart compris : jamais au-dessus de `total`). */
  loaded: number;
  total: number;
}

export interface QuoteUploadResult {
  /** Clé R2 privée (`quotes/<uuid>-<nom>`), à passer telle quelle à la Server Action. */
  key: string;
  /** Nom d'origine du fichier. */
  fileName: string;
}

export interface QuoteUploadOptions {
  /** Nom du fichier (obligatoire pour un Blob, qui n'en a pas ; sinon celui du File). */
  fileName?: string;
  /** Annule l'envoi : la promesse rejette avec une DOMException « AbortError ». */
  signal?: AbortSignal;
  /** Surcharge la route (tests). */
  endpoint?: string;
}

/** Extension en minuscules d'un nom de fichier, sans le point ("" s'il n'en a pas). */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Refus décidé côté client, avant toute requête : null si le fichier peut
 * partir. Renvoie le code qu'aurait donné le serveur (415 pour un format,
 * 413 pour la taille).
 */
export function checkQuoteFile(
  name: string,
  bytes: number,
): QuoteUploadErrorCode | null {
  if (
    !(QUOTE_UPLOAD_EXTENSIONS as readonly string[]).includes(
      fileExtension(name),
    )
  )
    return 415;
  if (bytes > QUOTE_UPLOAD_MAX_BYTES) return 413;
  return null;
}

function abortError(): DOMException {
  return new DOMException("Envoi annulé", "AbortError");
}

function errorCodeFor(status: number): QuoteUploadErrorCode {
  return status === 429 || status === 413 || status === 415 || status === 400
    ? status
    : "network";
}

/** Clé et nom d'une réponse 200, ou null si elle n'a pas la forme attendue. */
function parseResult(text: string): QuoteUploadResult | null {
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object") return null;
    const { key, fileName } = body as Record<string, unknown>;
    if (
      typeof key !== "string" ||
      !key.startsWith("quotes/") ||
      typeof fileName !== "string"
    )
      return null;
    return { key, fileName };
  } catch {
    return null;
  }
}

/**
 * Envoie un fichier 3D à l'atelier. Résout avec la clé R2 et le nom ; rejette
 * avec une QuoteUploadError typée (jamais une chaîne), ou une DOMException
 * « AbortError » si `signal` est déclenché.
 *
 * `onProgress` est appelé à chaque évènement de progression du navigateur, puis
 * une dernière fois à 100 % quand le corps est parti.
 */
export function uploadQuoteFile(
  file: Blob,
  onProgress?: (progress: UploadBytesProgress) => void,
  options: QuoteUploadOptions = {},
): Promise<QuoteUploadResult> {
  const fileName =
    options.fileName ??
    (typeof File !== "undefined" && file instanceof File ? file.name : "");

  return new Promise<QuoteUploadResult>((resolve, reject) => {
    const refused = checkQuoteFile(fileName, file.size);
    if (refused) {
      reject(new QuoteUploadError(refused));
      return;
    }
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }

    const body = new FormData();
    body.append("file", file, fileName);

    const xhr = new XMLHttpRequest();
    const total = file.size;
    const report = (loaded: number) =>
      onProgress?.({ loaded: Math.min(loaded, total), total });

    const onAbort = () => xhr.abort();
    const done = () => options.signal?.removeEventListener("abort", onAbort);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    xhr.open("POST", options.endpoint ?? QUOTE_UPLOAD_ENDPOINT);
    xhr.timeout = TIMEOUT_MS;
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) report(event.loaded);
    };
    xhr.upload.onload = () => report(total);

    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = parseResult(xhr.responseText);
        if (result) resolve(result);
        else reject(new QuoteUploadError("network", xhr.status));
        return;
      }
      reject(new QuoteUploadError(errorCodeFor(xhr.status), xhr.status));
    };
    xhr.onerror = () => {
      done();
      reject(new QuoteUploadError("network"));
    };
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => {
      done();
      reject(abortError());
    };

    xhr.send(body);
  });
}
