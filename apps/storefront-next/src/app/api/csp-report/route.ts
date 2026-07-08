// Point de collecte des rapports de violation CSP (report-uri / report-to).
// On accepte et on ignore silencieusement : l'objectif est uniquement de ne
// pas renvoyer de 404 aux navigateurs qui postent un rapport. Miroir de
// src/app/api/csp-report/route.ts (app racine).
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body) console.warn("[csp-report]", body.slice(0, 2000));
  } catch {
    // corps illisible — sans gravité
  }
  return new Response(null, { status: 204 });
}
