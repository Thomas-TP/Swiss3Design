import { getCloudflareContext } from "@opennextjs/cloudflare";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "./seo";

// IndexNow : prévient Bing (donc Copilot et ChatGPT search, qui s'appuient sur
// son index), Yandex, Seznam, Naver, Yep… qu'une URL a changé, au lieu
// d'attendre leur prochain passage. Une soumission est partagée entre tous les
// moteurs participants ; Google n'y participe pas (il lit le sitemap).
//
// La clé est publique par conception : le fichier public/<clé>.txt, servi à la
// racine du domaine, prouve que la soumission vient bien du propriétaire.
export const INDEXNOW_KEY = "867cd9af686842c88e46c3f656218246";

/**
 * Signale les chemins (sans préfixe de langue) dans leurs 4 langues.
 * Fire-and-forget via `waitUntil` : la réponse de l'admin n'attend jamais le
 * réseau, et un échec d'IndexNow ne fait jamais échouer l'enregistrement.
 * No-op hors production et sur l'environnement de preview (URL non publiques).
 */
export async function notifyIndexNow(paths: string[]): Promise<void> {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.APP_ENV === "preview" ||
    paths.length === 0
  ) {
    return;
  }
  const urlList = [
    ...new Set(
      paths.flatMap((p) => routing.locales.map((l) => `${SITE_URL}/${l}${p}`)),
    ),
  ];
  const task = fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  })
    .then((res) => {
      // 200 = reçu, 202 = reçu (clé en cours de validation).
      if (res.status !== 200 && res.status !== 202)
        console.error(`[indexnow] soumission refusée : HTTP ${res.status}`);
    })
    .catch((err) => console.error("[indexnow] soumission impossible", err));

  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(task);
  } catch {
    await task;
  }
}
