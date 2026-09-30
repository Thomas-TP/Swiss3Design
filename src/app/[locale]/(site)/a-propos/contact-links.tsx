import { ArrowRight, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

const CONTACT_EMAIL = "contact@swiss3design.ch";

// Les deux sorties de secours du formulaire, sur l'Atelier (chapitre 06) comme
// sur /contact : écrire directement (mailto) ou passer par le sur-mesure. Un
// lien texte, jamais un second bouton rouge : l'envoi du formulaire reste
// l'action principale de l'écran.
export async function ContactLinks({
  className,
  stacked = false,
}: {
  className?: string;
  /** Liens l'un sous l'autre à toute largeur (colonne latérale de l'Atelier). */
  stacked?: boolean;
}) {
  const t = await getTranslations("contact");
  return (
    <div
      className={cx(
        "flex flex-col gap-3 text-sm text-soft",
        stacked
          ? "items-start lg:pt-2"
          : "sm:flex-row sm:items-center sm:gap-8",
        className,
      )}
    >
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="inline-flex items-center gap-2 transition-colors duration-150 ease-strate hover:text-ink"
      >
        <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>
          {t("directEmail")}{" "}
          <span className="font-medium text-ink underline decoration-line underline-offset-4">
            {CONTACT_EMAIL}
          </span>
        </span>
      </a>
      <ButtonLink href="/custom" variant="text" size="sm">
        {t("quoteCta")}
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </ButtonLink>
    </div>
  );
}
