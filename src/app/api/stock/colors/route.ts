import { getDb } from "@/db";
import { getPublicStock } from "@/lib/filament/public-stock";

// Capacité par couleur pour le Studio (pastilles « épuisée ») et pour le
// formulaire de devis (couleurs en stock). Publique, mise en cache 60 s côté
// serveur (KV) : jamais le niveau exact, seulement une capacité arrondie.
export async function GET() {
  try {
    const stock = await getPublicStock(await getDb());
    return Response.json(stock, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (error) {
    // Le stock n'est jamais bloquant : sans lui, aucune couleur n'est grisée
    // (le paiement et le devis revérifient côté serveur).
    console.error("[stock] lecture publique impossible", error);
    return Response.json(
      { v: 1, studio: {}, refs: {}, custom: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
