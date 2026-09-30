import type { Metadata } from "next";
import { ChevronDown, Lock, MapPin, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Chapter } from "@/components/ui/chapter";
import { cx } from "@/components/ui/cx";
import { PageCut } from "@/components/ui/page-cut";
import { faqJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { ABOUT_CONTENT } from "./about-content";
import { AboutNav } from "./about-nav";
import { ContactForm } from "./contact-form";
import { ContactLinks } from "./contact-links";
import { PrinterShowcase } from "./printer-showcase";

const TRUST_ICONS = [MapPin, ShieldCheck, Lock, Truck] as const;

// Les chapitres se posent à 128 px du haut (header 64 + rail 48 + 16 d'air),
// valeur que la ligne de détection de l'AboutNav suppose (about-nav.tsx).
// `scroll-mt-32!` : la primitive Chapter pose déjà `scroll-mt-24`, l'important
// garantit que notre valeur gagne quel que soit l'ordre des utilitaires. Le
// `focus:outline-none` : l'AboutNav donne le focus à la section visée (comme
// une ancre native), sans qu'un cadre d'encre entoure tout le chapitre.
const CHAPTER = "scroll-mt-32! focus:outline-none";
const CHAPTER_RULED = cx(CHAPTER, "border-t border-line");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = ABOUT_CONTENT[locale] ?? ABOUT_CONTENT.fr;
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/a-propos",
    title: c.metaTitle,
    description: c.metaDescription,
    imageAlt: tSeo("ogImageAlt"),
  });
}

/**
 * Pile de strates décorative : `count` couches empilées de bas en haut, la
 * dernière (celle qu'on « dépose » à cette étape) en rouge, la chaleur de la
 * buse. Même idée que le mark : le procédé se lit comme un empilement.
 */
function StrataStack({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-12 flex-col-reverse justify-start gap-[3px]"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx(
            "block h-1 w-full",
            i === count - 1 ? "bg-accent" : "bg-iso-index",
          )}
        />
      ))}
    </span>
  );
}

// Page « Atelier » (brief « Strates », §7.11). Contenu éditorial inchangé
// (ABOUT_CONTENT, JSX par langue) ; cette page n'en fait que la mise en forme :
// chapitres numérotés 01 à 06, le premier en ton « encre ». Tout est rendu côté
// serveur, FAQ comprise (<details>, lisible sans JS et dans faqJsonLd). Les
// révélations sont des classes CSS (.s3d-rise, .s3d-print : aucune n'agit sur
// le h1 ni sur ce qui est visible au premier paint) ; la seule animation JS,
// le tracé des schémas, est dans PrinterShowcase (gate « about »).
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const c = ABOUT_CONTENT[locale] ?? ABOUT_CONTENT.fr;
  const t = await getTranslations("atelier");

  return (
    <PageCut>
      {/* Conteneur racine de la page. L'AboutNav doit en être un enfant DIRECT :
          `position: sticky` ne « colle » que dans la hauteur de son bloc
          englobant — un wrapper qui ne contient que la barre elle-même n'a
          aucune marge de manœuvre pour rester à l'écran (elle se décolle dès
          qu'on dépasse sa propre hauteur). Bug constaté en usage réel. */}
      <div>
        {/* Page « À propos » rattachée à l'entreprise + FAQ visible plus bas :
            deux schémas très lus par les moteurs de réponse (IA). */}
        <JsonLd
          data={webPageJsonLd({
            type: "AboutPage",
            locale,
            path: "/a-propos",
            name: c.metaTitle,
            description: c.metaDescription,
          })}
        />
        <JsonLd data={faqJsonLd(c.faq)} />

        <div className="s3d-page pb-12 pt-10 md:pb-16 md:pt-16">
          <PageHeader eyebrow={c.badge} title={c.title} intro={c.intro} />
        </div>

        {/* Chiffres clés, en bande de mesure : valeur d'abord, étiquette mono. */}
        <section aria-label={t("stats.label")} className="s3d-page pb-14">
          <ul className="s3d-rise grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4">
            {c.stats.map((s) => (
              <li key={s.label} className="bg-paper px-1 py-6 sm:px-5">
                <p className="s3d-num font-display text-[clamp(2rem,1.3rem+2.6vw,3.5rem)] font-extrabold leading-none text-ink">
                  {s.value}
                </p>
                <p className="s3d-label mt-3 text-soft">{s.label}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Rail kilométrique : reste visible au défilement, met en avant la
            section lue (voir about-nav.tsx). Page volontairement longue et
            complète — ce rail en est le sommaire, pas un raccourci qui en
            retire le contenu. */}
        <AboutNav
          label={t("nav.label")}
          items={[
            { id: "equipment", number: "01", label: c.equipmentKicker },
            { id: "process", number: "02", label: c.processKicker },
            { id: "materials", number: "03", label: c.materialsKicker },
            { id: "trust", number: "04", label: c.trustKicker },
            { id: "faq", number: "05", label: c.faqKicker },
            { id: "contact", number: "06", label: c.contactKicker },
          ]}
        />

        {/* 01 · Notre matériel (ton encre) */}
        <Chapter
          id="equipment"
          number="01"
          eyebrow={c.equipmentKicker}
          title={c.equipmentTitle}
          intro={c.equipmentText}
          tone="ink"
          className={CHAPTER}
        >
          <div className="s3d-page mt-14">
            <PrinterShowcase
              printers={c.printers}
              specsTitle={c.specsTitle}
              legendHint={c.legendHint}
            />
          </div>
        </Chapter>

        {/* 02 · Le procédé */}
        <Chapter
          id="process"
          number="02"
          eyebrow={c.processKicker}
          title={c.processTitle}
          className={CHAPTER}
        >
          <ol className="s3d-page mt-14 grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {c.steps.map((step, i) => (
              <li
                key={step.title}
                className="s3d-print border-t border-ink pt-5"
              >
                <StrataStack count={i + 1} />
                <p className="s3d-label mt-5 text-ink">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-subtitle font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </Chapter>

        {/* 03 · Nos matières */}
        <Chapter
          id="materials"
          number="03"
          eyebrow={c.materialsKicker}
          title={c.materialsTitle}
          intro={c.materialsText}
          className={CHAPTER_RULED}
        >
          <div className="s3d-page mt-14">
            <div className="s3d-print grid gap-10 border-y border-line py-10 md:grid-cols-[0.8fr_1.2fr] md:items-center md:py-12">
              <div>
                <p className="font-display text-[clamp(4rem,2rem+8vw,9rem)] font-extrabold leading-[0.9] tracking-tight text-ink">
                  {c.plaName}
                </p>
                <p className="s3d-label mt-4 text-accent-text">
                  {c.plaTagline}
                </p>
              </div>
              <ul className="space-y-4">
                {c.plaPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-[0.7em] h-0.5 w-4 shrink-0 bg-iso-index"
                    />
                    <span className="text-base text-ink">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 max-w-[65ch] text-sm text-soft">
              {c.materialsNote}
            </p>
          </div>
        </Chapter>

        {/* 04 · Qualité & engagements */}
        <Chapter
          id="trust"
          number="04"
          eyebrow={c.trustKicker}
          title={c.trustTitle}
          className={CHAPTER_RULED}
        >
          <ul className="s3d-page mt-14 grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {c.trust.map((item, i) => {
              const Icon = TRUST_ICONS[i] ?? ShieldCheck;
              return (
                <li
                  key={item.title}
                  className="s3d-print border-t border-ink pt-5"
                >
                  <Icon
                    size={24}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="text-ink"
                  />
                  <h3 className="mt-5 text-subtitle font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-soft">{item.text}</p>
                </li>
              );
            })}
          </ul>
        </Chapter>

        {/* 05 · FAQ : visible dans le HTML serveur, sans JS, et reprise telle
            quelle dans faqJsonLd plus haut. */}
        <Chapter
          id="faq"
          number="05"
          eyebrow={c.faqKicker}
          title={c.faqTitle}
          className={CHAPTER_RULED}
        >
          <div className="s3d-page mt-14">
            <div className="max-w-3xl border-t border-line">
              {c.faq.map((item) => (
                <details key={item.q} className="faq-item border-b border-line">
                  <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-lg font-semibold text-ink">
                    {item.q}
                    <ChevronDown
                      size={20}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="faq-chevron shrink-0 text-soft transition-transform duration-280 ease-strate"
                    />
                  </summary>
                  <div className="max-w-[65ch] pb-6 text-base text-soft">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </Chapter>

        {/* 06 · Contact */}
        <Chapter
          id="contact"
          number="06"
          eyebrow={c.contactKicker}
          title={c.contactTitle}
          intro={c.contactText}
          className={CHAPTER_RULED}
        >
          <div className="s3d-page mt-14">
            <div className="max-w-2xl">
              <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
                <ContactForm />
              </div>
              <ContactLinks className="mt-6" />
            </div>
          </div>
        </Chapter>
      </div>
    </PageCut>
  );
}
