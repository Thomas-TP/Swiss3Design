import { type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { MapPin, ShieldCheck } from "lucide-solid";
import { useI18n } from "../i18n/context";
import { BrandMark } from "./brand-mark";

const PAYMENT_METHODS = ["TWINT", "Visa", "Mastercard", "Google Pay"];

function FooterColumn(props: { title: string; children: JSX.Element }) {
  return (
    <nav aria-label={props.title}>
      <p class="text-xs font-semibold uppercase tracking-[0.14em] text-soft">{props.title}</p>
      <ul class="mt-4 space-y-2.5 text-sm font-medium">{props.children}</ul>
    </nav>
  );
}

function FooterLink(props: { href: string; children: JSX.Element }) {
  return (
    <li>
      <A href={props.href} class="text-soft transition-colors hover:text-ink">
        {props.children}
      </A>
    </li>
  );
}

export function Footer() {
  const { t, locale } = useI18n();
  const base = () => `/${locale()}`;

  return (
    <footer class="mt-20 border-t border-line bg-surface pb-24 md:pb-0">
      <div class="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div class="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-8">
          <div>
            <p class="flex items-center gap-2.5 text-ink">
              <BrandMark class="h-8 w-8 text-ink" />
              <span class="text-[17px] tracking-tight">
                <span class="font-medium">Swiss</span>
                <span class="font-bold">3Design</span>
              </span>
            </p>
            <p class="mt-3 text-sm leading-relaxed text-soft">{t("footer.tagline")}</p>
            <p class="mt-4 flex items-start gap-2 text-sm leading-snug text-soft">
              <MapPin size={15} class="mt-0.5 shrink-0 text-accent" />
              {t("footer.madeIn")}
            </p>
          </div>

          <FooterColumn title={t("footer.shop")}>
            <FooterLink href={`${base()}/shop`}>{t("nav.shop")}</FooterLink>
            <FooterLink href={`${base()}/custom`}>{t("nav.custom")}</FooterLink>
            <FooterLink href={`${base()}/favorites`}>{t("nav.favorites")}</FooterLink>
            <FooterLink href={`${base()}/track`}>{t("footer.track")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("footer.helpTitle")}>
            <FooterLink href={`${base()}/account`}>{t("nav.account")}</FooterLink>
            <FooterLink href={`${base()}/a-propos`}>{t("footer.about")}</FooterLink>
            <li>
              <a href="mailto:contact@swiss3design.ch" class="text-soft transition-colors hover:text-ink">
                {t("footer.contact")}
              </a>
            </li>
          </FooterColumn>

          <FooterColumn title={t("footer.legalTitle")}>
            <FooterLink href={`${base()}/legal/terms`}>{t("footer.terms")}</FooterLink>
            <FooterLink href={`${base()}/legal/privacy`}>{t("footer.privacy")}</FooterLink>
            <FooterLink href={`${base()}/a-propos`}>{t("footer.shippingReturns")}</FooterLink>
          </FooterColumn>
        </div>

        <div class="mt-12 flex flex-col gap-4 border-t border-line py-6 text-xs text-soft sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="mr-1 flex items-center gap-1.5 font-medium">
              <ShieldCheck size={14} class="text-accent" />
              {t("footer.securePayment")}
            </span>
            {PAYMENT_METHODS.map((m) => (
              <span class="rounded-md border border-line bg-paper px-2 py-1 font-medium">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
