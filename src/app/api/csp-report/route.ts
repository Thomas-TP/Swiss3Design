// Les rapports peuvent contenir des URL de compte et des jetons.
// Seules la directive et l'origine de la ressource bloquée sont conservées.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 8192)
    return new Response(null, { status: 413 });
  try {
    if (!request.body) return new Response(null, { status: 204 });
    const reader = request.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const body = JSON.parse(await new Blob(chunks as BlobPart[]).text()) as {
      "csp-report"?: Record<string, string>;
    };
    const report = body["csp-report"];
    if (report) {
      let origin = "inline";
      try {
        origin = new URL(report["blocked-uri"]).origin;
      } catch {
        /* inline/eval */
      }
      console.warn("[csp]", {
        directive: report["effective-directive"]?.slice(0, 80),
        origin,
      });
    }
  } catch {
    /* Un rapport mal formé ne doit pas charger le rendu applicatif. */
  }
  return new Response(null, { status: 204 });
}
