import { useTranslations } from "next-intl";
import { MapPin, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "./brand-mark";

/*
 * Pied de page en 4 zones : marque + réassurance, deux colonnes de liens,
 * informations légales, puis barre basse copyright + moyens de paiement.
 * Composant serveur — aucune interactivité, que de la navigation.
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft">
        {title}
      </p>
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
      <Link href={href} className="text-soft transition-colors hover:text-ink">
        {children}
      </Link>
    </li>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="mt-20 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-8">
          {/* Marque + réassurance */}
          <div>
            <p className="flex items-center gap-2.5 text-ink">
              <BrandMark className="h-8 w-8 text-ink" />
              <span className="text-[17px] tracking-tight">
                <span className="font-medium">Swiss</span>
                <span className="font-bold">3Design</span>
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-soft">
              {t("tagline")}
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm leading-snug text-soft">
              <MapPin size={15} className="mt-0.5 shrink-0 text-accent" />
              {t("madeIn")}
            </p>
          </div>

          <FooterColumn title={t("shop")}>
            <FooterLink href="/shop">{tNav("shop")}</FooterLink>
            <FooterLink href="/custom">{tNav("custom")}</FooterLink>
            <FooterLink href="/favorites">{tNav("favorites")}</FooterLink>
            <FooterLink href="/track">{t("track")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("helpTitle")}>
            <FooterLink href="/account">{tNav("account")}</FooterLink>
            <FooterLink href="/a-propos">{t("about")}</FooterLink>
            <FooterLink href="/contact">{t("contact")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("legalTitle")}>
            <FooterLink href="/legal/terms">{t("terms")}</FooterLink>
            <FooterLink href="/legal/privacy">{t("privacy")}</FooterLink>
            <FooterLink href="/legal/shipping">
              {t("shippingReturns")}
            </FooterLink>
          </FooterColumn>
        </div>

        {/* Barre basse : copyright + crédit agence + paiement sécurisé */}
        <div className="mt-12 flex flex-col gap-4 border-t border-line py-6 text-xs text-soft sm:flex-row sm:items-center sm:justify-between">
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
              <ShieldCheck size={14} className="text-accent" />
              {t("securePayment")}
            </span>
            {PAYMENT_METHODS.map((m) => (
              <span
                key={m}
                className="rounded-md border border-line bg-paper px-2 py-1 font-medium"
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
