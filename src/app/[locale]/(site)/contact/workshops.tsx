import { getTranslations } from "next-intl/server";
import { cx } from "@/components/ui/cx";

// Bloc « Deux ateliers » de /contact : un fond d'isolignes statique (SVG du
// dépôt, une variante par thème, comme le cartouche du footer) et deux points
// rouges, Gland et Pully. Villes seulement, jamais d'adresse de rue : ni
// l'adresse d'un particulier ni un lieu ouvert au public ne sont annoncés.
//
// Les coordonnées sont celles des centres-villes (les mêmes que le pied de
// page) ; les points sont placés dans le rapport réel des deux villes (Pully
// à ≈ 31 km à l'est et ≈ 11 km au nord de Gland), pas sur le fond, qui est un
// décor. Les repères sur la carte sont donc `aria-hidden` : le texte qui compte
// est la liste dessous.
const WORKSHOPS = [
  { id: "gland", coordinates: "46°25′N 6°16′E", x: 22, y: 66 },
  { id: "pully", coordinates: "46°31′N 6°40′E", x: 78, y: 36 },
] as const;

export async function Workshops({ className }: { className?: string }) {
  const [t, tShell] = await Promise.all([
    getTranslations("atelier.contact"),
    getTranslations("shell"),
  ]);
  return (
    <section
      aria-labelledby="contact-workshops-title"
      className={cx(
        "overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    >
      <div className="relative aspect-[5/4] bg-paper bg-[url(/posters/field-leman-light.svg)] bg-cover bg-center dark:bg-[url(/posters/field-leman-dark.svg)]">
        <h2
          id="contact-workshops-title"
          className="s3d-label absolute left-4 top-4 text-ink"
        >
          {t("workshops")}
        </h2>
        <ul aria-hidden="true">
          {WORKSHOPS.map((workshop) => (
            <li
              key={workshop.id}
              style={{ left: `${workshop.x}%`, top: `${workshop.y}%` }}
              className={cx(
                "absolute flex -translate-y-1/2 items-center gap-2",
                workshop.x > 50
                  ? "-translate-x-full flex-row-reverse pl-2"
                  : "pr-2",
              )}
            >
              <span className="h-3 w-3 shrink-0 rounded-full bg-accent ring-4 ring-paper" />
              <span className="s3d-label normal-case rounded-hair bg-paper/85 px-1.5 py-0.5 text-ink">
                {t(`${workshop.id}.city`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {WORKSHOPS.map((workshop) => (
          <li key={workshop.id} className="px-5 py-4">
            <p className="flex items-center gap-2.5 font-semibold text-ink">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-accent"
              />
              {t(`${workshop.id}.city`)}
            </p>
            <p className="mt-1 text-sm text-soft">
              {t(`${workshop.id}.machine`)}
            </p>
            <p className="s3d-label mt-2 text-soft">{workshop.coordinates}</p>
          </li>
        ))}
      </ul>
      <p className="s3d-label normal-case border-t border-line px-5 py-3 text-soft">
        {tShell("footer.legend")}
      </p>
    </section>
  );
}
