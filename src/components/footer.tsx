import { useTranslations } from "next-intl";
import { ArrowUp, ArrowUpRight, ShieldCheck } from "lucide-react";
import { BrandWordmark } from "./brand-mark";
import { MotionToggle } from "./motion-toggle";
import { buttonClass } from "./ui/button";
import { withDot } from "./ui/dot-title";
import { SiteLink } from "./ui/site-link";

/*
 * Pied de page (25.10.2026, refonte du chrome ; inspirations : printlab3d.ch et
 * les pieds de page « fiche technique + marque géante » des sites primés). Composant
 * serveur : tout le texte et tous les liens sont dans le HTML ; deux îlots client
 * seulement, SiteLink et MotionToggle. Trois temps, de haut en bas :
 *
 * 1. Appel : la devise en grand (« Personnalisez-le. On l'imprime. ») et les deux
 *    portes d'entrée, Studio et fichier.
 * 2. Fiche technique de l'atelier, en lignes mono comme une fiche de machine :
 *    statut (point rouge qui respire), ateliers et coordonnées, machine, matière,
 *    livraison, contact, paiement (logos officiels). À droite : les liens en nuage,
 *    le légal en gris, la préférence de mouvement.
 * 3. « Kreya » sur toute la largeur, découpé en couches d'impression, qui s'imprime
 *    de bas en haut quand on arrive en bas de page (CSS seul, animation liée au
 *    défilement, `.s3d-footer-mark`) ; immobile et complet en mouvement réduit ou
 *    sans support. Puis la barre basse : copyright, crédit, retour en haut.
 *
 * `relative z-[1]` : au-dessus du canvas du Stage. `pb-24 lg:pb-0` : la BottomNav
 * existe jusqu'à lg. `id="site-footer"` + tabIndex -1 : cible du lien d'évitement.
 */

// Logos officiels des moyens de paiement actifs dans Stripe (configuration
// « Default »), dans public/payment (ressources statiques, hors du Worker :
// règle d'or 10). Jeu « payment_icons » de Shopify/Active Merchant : même
// carte 38 × 24 pour toutes les marques. Klarna et Link sont actifs mais
// absents ici : Klarna se montre sur le produit et le panier, Link rassure peu.
const PAYMENT_METHODS = [
  { name: "TWINT", file: "twint" },
  { name: "Visa", file: "visa" },
  { name: "Mastercard", file: "mastercard" },
  { name: "Apple Pay", file: "apple-pay" },
  { name: "Google Pay", file: "google-pay" },
  { name: "PayPal", file: "paypal" },
];

const CONTACT_EMAIL = "contact@kreya.ch";

/** Ligne de la fiche technique : intitulé mono à gauche, valeur à droite. */
function SpecRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-t border-line py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="s3d-label pt-0.5 text-soft">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

function FooterLink({
  href,
  children,
  muted = false,
}: {
  href: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li>
      <SiteLink
        href={href}
        className={`s3d-link-sweep ${muted ? "text-soft hover:text-ink" : "text-ink"}`}
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
      className="relative z-[1] mt-20 overflow-hidden border-t border-line bg-surface pb-24 focus:outline-none lg:pb-0"
    >
      <div className="s3d-page">
        {/* 1 · Appel */}
        <div className="flex flex-col gap-6 py-12 sm:py-16 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-3xl font-display text-[2rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-ink min-[420px]:text-display">
            {withDot(shell("footer.motto"))}
          </p>
          <div className="flex flex-wrap gap-3">
            <SiteLink
              href="/studio"
              className={buttonClass({ variant: "ink", size: "lg" })}
            >
              {shell("cta.studio")}
              <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </SiteLink>
            <SiteLink
              href="/custom"
              className={buttonClass({ variant: "secondary", size: "lg" })}
            >
              {shell("cta.file")}
            </SiteLink>
          </div>
        </div>

        {/* 2 · Fiche technique et liens */}
        <div className="grid gap-12 pb-12 lg:grid-cols-12 lg:gap-10">
          <dl className="lg:col-span-7">
            <SpecRow label={shell("footer.spec.status")}>
              <span className="flex items-center gap-2.5">
                <span className="s3d-live-dot" aria-hidden="true" />
                {shell("footer.spec.statusValue")}
              </span>
            </SpecRow>
            <SpecRow label={shell("footer.spec.workshops")}>
              {shell("footer.spec.workshopsValue")}
              <span className="mt-1 block font-mono text-xs text-soft">
                {shell("footer.gland")} · {shell("footer.pully")}
              </span>
            </SpecRow>
            <SpecRow label={shell("footer.spec.machine")}>
              {shell("footer.spec.machineValue")}
            </SpecRow>
            <SpecRow label={shell("footer.spec.material")}>
              {shell("footer.spec.materialValue")}
            </SpecRow>
            <SpecRow label={shell("footer.spec.delivery")}>
              {shell("footer.spec.deliveryValue")}
            </SpecRow>
            <SpecRow label={shell("footer.spec.write")}>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="s3d-link-sweep text-ink"
              >
                {CONTACT_EMAIL}
              </a>
            </SpecRow>
            <SpecRow label={shell("footer.spec.payment")}>
              <span className="sr-only">{t("securePayment")} : </span>
              <ul className="flex flex-wrap items-center gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <li key={m.file}>
                    <img
                      src={`/payment/${m.file}.svg`}
                      alt={m.name}
                      title={m.name}
                      width={38}
                      height={24}
                      loading="lazy"
                      className="block h-6 w-[38px]"
                    />
                  </li>
                ))}
                <li className="ml-1 flex items-center gap-1.5 text-xs text-soft">
                  <ShieldCheck
                    size={14}
                    strokeWidth={1.5}
                    className="text-accent-text"
                    aria-hidden="true"
                  />
                  {t("securePayment")}
                </li>
              </ul>
            </SpecRow>
          </dl>

          <div className="flex flex-col gap-10 lg:col-span-5 lg:pl-6">
            <nav aria-label={t("shop")}>
              <p className="s3d-label text-soft">{t("shop")}</p>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-lg font-medium">
                <FooterLink href="/shop">{shell("nav.shop")}</FooterLink>
                <FooterLink href="/studio">{shell("nav.studio")}</FooterLink>
                <FooterLink href="/custom">{shell("nav.custom")}</FooterLink>
                <FooterLink href="/a-propos">{shell("nav.atelier")}</FooterLink>
                <FooterLink href="/contact">{t("contact")}</FooterLink>
              </ul>
            </nav>
            <nav aria-label={t("helpTitle")}>
              <p className="s3d-label text-soft">{t("helpTitle")}</p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2.5 text-sm">
                <FooterLink href="/account">{tNav("account")}</FooterLink>
                <FooterLink href="/favorites">{tNav("favorites")}</FooterLink>
                <FooterLink href="/track">{t("track")}</FooterLink>
              </ul>
            </nav>
            <nav aria-label={t("legalTitle")}>
              <p className="s3d-label text-soft">{t("legalTitle")}</p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2.5 text-sm">
                <FooterLink href="/legal/terms" muted>
                  {t("terms")}
                </FooterLink>
                <FooterLink href="/legal/privacy" muted>
                  {t("privacy")}
                </FooterLink>
                <FooterLink href="/legal/shipping" muted>
                  {t("shippingReturns")}
                </FooterLink>
              </ul>
            </nav>
            <section aria-labelledby="footer-preferences">
              <p id="footer-preferences" className="s3d-label text-soft">
                {shell("footer.preferences")}
              </p>
              <MotionToggle className="mt-4 max-w-md" />
            </section>
          </div>
        </div>

        {/* 3 · La marque, qui s'imprime couche par couche */}
        <div className="border-t border-line pt-8 sm:pt-12" aria-hidden="true">
          <BrandWordmark className="s3d-footer-mark block h-auto w-full text-ink" />
        </div>

        {/* Barre basse */}
        <div className="flex flex-col gap-3 py-6 text-xs text-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            {/* oxlint-disable-next-line purity -- composant serveur, rendu une fois par requête */}
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
          <div className="flex items-center gap-4">
            <span className="s3d-label">{shell("footer.madeIn")}</span>
            <a
              href="#main-content"
              className="group inline-flex items-center gap-1.5 font-medium text-ink"
            >
              {shell("footer.top")}
              <ArrowUp
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="transition-transform duration-200 ease-strate group-hover:-translate-y-0.5"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
