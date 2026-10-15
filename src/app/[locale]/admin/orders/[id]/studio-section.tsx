import { Printer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StudioStlGate } from "@/components/admin/studio-stl-gate";
import { lineSummary } from "@/components/studio/line-summary";
import type { SummaryInput, Translate } from "@/components/studio/summary";
import { formatChf } from "@/lib/format";
import { bandStatsFor } from "@/lib/studio/band-stats";
import { filamentInfo } from "@/lib/studio/filaments";
import { formatDuration, formatGrams } from "@/lib/studio/format";
import { readStudioOrderLine } from "@/lib/studio/order-line";
import { PRINT } from "@/lib/studio/print-params";
import { computeStats } from "@/lib/studio/stats";
import { markStudioReviewed, refuseStudioTexts } from "../actions";
import { BTN_GHOST, BTN_PRIMARY } from "../../ui";

// Objets du Studio d'une commande, pour l'atelier (français, comme tout l'admin) :
// de quoi imprimer sans rien demander au client (objet, dimensions, bandes avec la
// bobine exacte à charger, textes) et le fichier STL, regénéré dans le navigateur
// à partir de la configuration gardée. Les textes saisis sont des données
// personnelles : l'admin n'est jamais mesuré (analytics), et ils ne quittent pas
// cette page.

type Item = {
  id: string;
  quantity: number;
  priceCentsSnapshot: number;
  studio: unknown;
};

export async function StudioSection({
  orderId,
  status,
  items,
  locale,
}: {
  orderId: string;
  status: string;
  items: Item[];
  locale: string;
}) {
  const lines = items.flatMap((item) => {
    const studio = readStudioOrderLine(item.studio);
    return studio ? [{ item, studio }] : [];
  });
  if (lines.length === 0) return null;

  const [t, core] = (await Promise.all([
    getTranslations({ locale: "fr", namespace: "studio" }),
    getTranslations({ locale: "fr", namespace: "studioCore" }),
  ])) as unknown as [Translate, Translate];

  const reviewed = lines.every((l) => l.studio.reviewedAt);
  const open = status === "paid" || status === "in_production";

  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Printer size={16} className="text-soft" />
        Objets du Studio
        <span className="text-xs font-normal text-soft">
          (fabriqués sur commande)
        </span>
      </h3>

      {!reviewed && open ? (
        <p className="mb-4 rounded-field border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <strong>Textes à relire avant l&apos;impression</strong> (engagement :
          sous 2 jours ouvrés). Tant qu&apos;ils ne sont pas marqués relus, la
          commande ne peut pas passer en production.
        </p>
      ) : null}

      <ul className="space-y-5">
        {lines.map(({ item, studio }) => {
          const stats = computeStats(
            studio.config,
            studio.texts,
            PRINT,
            studio.locale,
          );
          const bands = bandStatsFor(
            studio.config,
            studio.texts,
            PRINT,
            studio.locale,
          );
          const input: SummaryInput = {
            config: studio.config,
            texts: studio.texts,
            stats,
            bands,
            locale: "fr",
            t,
            core,
          };
          const summary = lineSummary(input);
          return (
            <li key={item.id} className="text-sm">
              <p className="font-medium">
                {item.quantity} × {summary.objectName}{" "}
                <span className="font-normal text-soft">
                  · {summary.dimensions} ·{" "}
                  {formatChf(item.priceCentsSnapshot, locale)} la pièce
                </span>
              </p>
              <p className="mt-1 text-xs text-soft">
                Une pièce : ≈ {formatGrams(stats.grams, "fr")} · ≈{" "}
                {formatDuration(stats.minutes, "fr")} · {stats.changes}{" "}
                changement{stats.changes > 1 ? "s" : ""} de couleur · statut{" "}
                {studio.stats.printable === "warn"
                  ? "À vérifier"
                  : "Imprimable"}{" "}
                · empreinte {studio.hash} · barème v{studio.price.v}
              </p>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-soft">
                Bandes et bobines à charger
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {bands.bands.map((band) => {
                  const info = filamentInfo(band.filament);
                  return (
                    <li key={band.index} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0 rounded-full border border-swatch-ring"
                        style={{ backgroundColor: info.hex }}
                      />
                      <span>
                        <strong>{info.brand}</strong> {info.range} —{" "}
                        {info.officialName}{" "}
                        <span className="font-mono text-xs text-soft">
                          {info.hex}
                        </span>
                        <br />
                        <span className="text-xs text-soft">
                          {core(`filaments.${band.filament}`)} · de{" "}
                          {band.fromMm} à {band.toMm} mm · couches{" "}
                          {band.fromLayer}–{band.toLayer}
                          {band.startsWithChange
                            ? " · changement de filament à cette couche"
                            : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-soft">
                Textes à imprimer
              </p>
              {summary.texts.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {summary.texts.map((text) => (
                    <li key={text.label} className="select-all break-words">
                      <span className="text-soft">{text.label} :</span> «{" "}
                      {text.value} »
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-soft">Aucun texte.</p>
              )}

              <div className="mt-3">
                <StudioStlGate
                  line={studio}
                  label="Télécharger le STL"
                  className={`${BTN_GHOST} inline-flex items-center gap-1.5`}
                />
              </div>
              {studio.reviewedAt ? (
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                  Textes relus le{" "}
                  {new Date(studio.reviewedAt).toLocaleString("fr-CH")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {open && !reviewed ? (
        <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-line pt-4">
          <form action={markStudioReviewed}>
            <input type="hidden" name="id" value={orderId} />
            <button type="submit" className={BTN_PRIMARY}>
              Textes relus, imprimer
            </button>
          </form>
          <form action={refuseStudioTexts} className="max-w-md">
            <input type="hidden" name="id" value={orderId} />
            <button type="submit" className={BTN_GHOST}>
              Refuser le texte et annuler
            </button>
            <p className="mt-1.5 text-xs text-soft">
              Marque de tiers, injure ou contenu illicite : la commande est
              annulée et le client reçoit un e-mail.{" "}
              <strong>Remboursez la commande en totalité dans Stripe</strong>{" "}
              (le remboursement n&apos;est pas automatique).
            </p>
          </form>
        </div>
      ) : null}
    </section>
  );
}
