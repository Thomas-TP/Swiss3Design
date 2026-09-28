import { useTranslations } from "next-intl";
import { MapPin, ShieldCheck } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { MotionToggle } from "./motion-toggle";
import { withDot } from "./ui/dot-title";
import { MapFrame } from "./ui/map-frame";
import { SiteLink } from "./ui/site-link";

/*
 * Pied de page « Strates » (brief §7.3). Composant serveur : tout le texte et
 * tous les liens sont dans le HTML ; deux îlots client seulement, SiteLink
 * (« Coupe » et buse d'attente) et MotionToggle (préférence de mouvement).
 *
 * - Cartouche (le bloc titre d'une carte) : mark + wordmark Geist (la marque,
 *   pas de nouveau wordmark), accroche, légende mono « Équidistance 0,2 mm ·
 *   Échelle 1:1 », coordonnées de Gland et de Pully, isolignes SVG statiques
 *   en fond (public/posters/field-footer-{light,dark}.svg, une par thème),
 *   graduations de carte en marge dès lg (MapFrame). Légende en mono sans
 *   majuscules : « 0,2 MM » fausserait l'unité.
 * - Trois colonnes : Boutique (boutique, Studio, sur mesure, favoris, suivi),
 *   Compte et aide (compte, Atelier, contact), Informations (légal).
 * - Préférences : « Réduire les animations ».
 * - Barre basse inchangée : copyright, crédit Calyroc, paiement sécurisé.
 *
 * `relative z-[1]` : au-dessus du canvas du Stage. `pb-24 lg:pb-0` : la
 * BottomNav existe jusqu'à lg (et non md : il restait un trou entre les deux).
 * `id="site-footer"` + tabIndex -1 : cible du lien d'évitement du header.
 */

const PAYMENT_METHODS = ["TWINT", "Visa", "Mastercard", "Google Pay"];

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={title}>
      <p className="s3d-label text-soft">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm font-medium">{children}</ul>
    </nav>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <SiteLink
        href={href}
        className="text-soft underline decoration-transparent decoration-1 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink"
      >
        {children}
      </SiteLink>
    </li>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const shell = useTranslations("shell");

  return (
    <footer
      id="site-footer"
      tabIndex={-1}
      className="relative z-[1] mt-20 border-t border-line bg-surface pb-24 focus:outline-none lg:pb-0"
    >
      <div className="s3d-page">
        <div className="grid gap-10 py-12 lg:grid-cols-12 lg:gap-8 lg:py-16">
          {/* Cartouche */}
          <div className="relative overflow-hidden rounded-hair border border-line bg-paper bg-[url(/posters/field-footer-light.svg)] bg-cover bg-center p-6 lg:col-span-5 lg:p-8 dark:bg-[url(/posters/field-footer-dark.svg)]">
            <MapFrame sides={["left", "bottom"]} />
            <p className="flex items-center gap-2.5 text-ink">
              <BrandMark className="h-8 w-8" />
              <span className="text-[17px] tracking-tight">
                <span className="font-medium">Swiss</span>
                <span className="font-bold">3Design</span>
              </span>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-soft">
              {t("tagline")}
            </p>
            <p className="mt-6 font-display text-title text-ink">
              {withDot(shell("footer.motto"))}
            </p>
            <p className="mt-5 flex items-start gap-2 text-sm leading-snug text-soft">
              <MapPin
                size={15}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 text-accent-text"
              />
              {t("madeIn")}
            </p>
            <div className="mt-6 grid gap-1.5 border-t border-line pt-4 text-soft">
              <p className="s3d-label normal-case text-ink">
                {shell("footer.legend")}
              </p>
              <p className="s3d-label normal-case">{shell("footer.gland")}</p>
              <p className="s3d-label normal-case">{shell("footer.pully")}</p>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-7 lg:gap-8 lg:pl-8">
            <FooterColumn title={t("shop")}>
              <FooterLink href="/shop">{shell("nav.shop")}</FooterLink>
              <FooterLink href="/studio">{shell("nav.studio")}</FooterLink>
              <FooterLink href="/custom">{shell("nav.custom")}</FooterLink>
              <FooterLink href="/favorites">{tNav("favorites")}</FooterLink>
              <FooterLink href="/track">{t("track")}</FooterLink>
            </FooterColumn>

            <FooterColumn title={t("helpTitle")}>
              <FooterLink href="/account">{tNav("account")}</FooterLink>
              <FooterLink href="/a-propos">{shell("nav.atelier")}</FooterLink>
              <FooterLink href="/contact">{t("contact")}</FooterLink>
            </FooterColumn>

            <FooterColumn title={t("legalTitle")}>
              <FooterLink href="/legal/terms">{t("terms")}</FooterLink>
              <FooterLink href="/legal/privacy">{t("privacy")}</FooterLink>
              <FooterLink href="/legal/shipping">
                {t("shippingReturns")}
              </FooterLink>
            </FooterColumn>

            {/* Préférences : îlot client, sous les colonnes. */}
            <section
              aria-labelledby="footer-preferences"
              className="border-t border-line pt-6 sm:col-span-3"
            >
              <p id="footer-preferences" className="s3d-label text-soft">
                {shell("footer.preferences")}
              </p>
              <MotionToggle className="mt-4 max-w-md" />
            </section>
          </div>
        </div>

        {/* Barre basse : copyright + crédit agence + paiement sécurisé */}
        <div className="flex flex-col gap-4 border-t border-line py-6 text-xs text-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <p>{t("copyright", { year: new Date().getFullYear() })}</p>
            <a
              href="https://calyroc.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-ink"
            >
              {t("createdBy")}
              <img
                src="/credits/calyroc-logo.png"
                alt="Calyroc"
                loading="lazy"
                className="h-4 w-auto"
              />
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 font-medium">
              <ShieldCheck
                size={14}
                strokeWidth={1.5}
                className="text-accent-text"
              />
              {t("securePayment")}
            </span>
            {PAYMENT_METHODS.map((m) => (
              <span
                key={m}
                className="rounded-hair border border-line bg-paper px-2 py-1 font-medium"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
