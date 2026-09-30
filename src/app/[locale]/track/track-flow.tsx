"use client";

import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  Package,
  Search,
  Truck,
  UserPlus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatChf } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldClass } from "@/components/ui/field";

// Suivi de commande (brief « Strates » §7.16). Habillage seul : le formulaire
// (n° + e-mail → POST /api/track-order), le préremplissage `?order=`, le lien
// Poste suisse et les statuts sont ceux d'avant la refonte. Les statuts se
// lisent d'abord en clair, puis en « pile de couches » : Commande · Impression
// · Contrôle · Expédiée · Livrée, la couche courante portant le point rouge.
// Adresse et e-mail affichés sont masqués dans les enregistrements de visite
// (`ph-mask`) ; la page est hors index.

// Mêmes teintes que l'espace compte — limité aux statuts d'une commande.
const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  in_production: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  shipped: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const LAYERS = ["order", "print", "check", "shipped", "delivered"] as const;
type LayerState = "done" | "current" | "todo";

// Avancement par statut : l'état de chaque couche, et la couche qui porte le
// point rouge (là où en est la commande). « Payée » : la commande est
// terminée, l'impression est la prochaine couche (à venir, mais c'est là que
// la buse chauffe). Annulée ou statut inconnu : pas de pile, la phrase seule.
const PROGRESS: Record<string, { states: LayerState[]; dot: number }> = {
  pending: {
    states: ["current", "todo", "todo", "todo", "todo"],
    dot: 0,
  },
  paid: {
    states: ["done", "todo", "todo", "todo", "todo"],
    dot: 1,
  },
  in_production: {
    states: ["done", "current", "todo", "todo", "todo"],
    dot: 1,
  },
  shipped: {
    states: ["done", "done", "done", "current", "todo"],
    dot: 3,
  },
  delivered: {
    states: ["done", "done", "done", "done", "done"],
    dot: 4,
  },
};

function trackingUrl(n: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(n)}`;
}

// Encart d'erreur : texte + bordure `accent-text` (jamais la couleur seule).
const ERROR_BOX =
  "rounded-field border border-accent-text/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent-text";

interface TrackResult {
  orderNumber: string;
  status: string;
  createdAt: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  discountCode: string | null;
  totalCents: number;
  trackingNumber: string | null;
  address: {
    name: string;
    street: string;
    npa: string;
    city: string;
    canton: string;
  };
  items: {
    id: string;
    nameSnapshot: string;
    colorName: string | null;
    colorHex: string | null;
    priceCentsSnapshot: number;
    quantity: number;
  }[];
}

// Pile de couches : un bandeau par étape, empilées (bordures partagées), la
// première en haut. Le libellé en clair vient d'abord, l'état en mono ensuite.
function LayerStack({ status }: { status: string }) {
  const t = useTranslations("system.track");
  const progress = PROGRESS[status];
  if (!progress) return null;
  return (
    <ol aria-label={t("layersLabel")} className="mt-6">
      {LAYERS.map((layer, index) => {
        const state = progress.states[index];
        const hasDot = index === progress.dot;
        return (
          <li
            key={layer}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex items-center gap-4 border border-line px-4 py-3.5 sm:px-5 ${
              index === 0 ? "rounded-t-card" : "-mt-px"
            } ${index === LAYERS.length - 1 ? "rounded-b-card" : ""} ${
              state === "todo" ? "bg-paper" : "bg-surface"
            } ${hasDot ? "border-l-3 border-l-accent" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full ${
                hasDot
                  ? "bg-accent"
                  : state === "done"
                    ? "bg-ink"
                    : "border border-iso"
              }`}
            />
            <span
              className={`min-w-0 flex-1 font-semibold ${
                state === "todo" ? "text-soft" : "text-ink"
              }`}
            >
              {t(`layer.${layer}`)}
            </span>
            <span className="s3d-label shrink-0 text-soft">
              {t(`state.${state}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TrackFlow({
  initialOrderNumber,
}: {
  initialOrderNumber: string;
}) {
  const t = useTranslations("track");
  const ts = useTranslations("system.track");
  const tStatus = useTranslations("account.status");
  const locale = useLocale();
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  const ready =
    orderNumber.trim().length >= 3 && /^\S+@\S+\.\S+$/.test(email.trim());

  async function search() {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      if (res.status === 404) {
        setResult(null);
        setError(t("notFound"));
        return;
      }
      if (!res.ok) throw new Error("track_failed");
      setResult((await res.json()) as TrackResult);
    } catch {
      setResult(null);
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const nowKey = `now.${result.status}`;
    const hasNow = result.status in PROGRESS || result.status === "cancelled";
    return (
      <div className="mt-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="s3d-label text-soft">{t("orderNumber")}</p>
            <h2 className="mt-1 break-all font-mono text-2xl font-medium tracking-tight text-ink">
              {result.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-soft">
              {t("placedOn", {
                date: new Date(result.createdAt).toLocaleDateString(
                  `${locale}-CH`,
                ),
              })}
            </p>
          </div>
          <span
            className={`s3d-label rounded-hair px-2.5 py-1 ${statusStyle[result.status] ?? "bg-line text-soft"}`}
          >
            {tStatus(result.status)}
          </span>
        </div>

        {hasNow && <p className="mt-5 text-lead text-ink">{ts(nowKey)}</p>}
        <LayerStack status={result.status} />

        {result.trackingNumber && (
          <a
            href={trackingUrl(result.trackingNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-ink"
          >
            <span className="flex items-center gap-2.5 text-sm">
              <Truck
                size={17}
                strokeWidth={1.5}
                className="shrink-0 text-soft"
              />
              <span>
                <span className="font-semibold">{t("tracking")}</span>{" "}
                <span className="s3d-num text-soft">
                  {result.trackingNumber}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent-text">
              {t("trackOrder")} →
            </span>
          </a>
        )}

        <section className="mt-8">
          <h3 className="s3d-label flex items-center gap-2 text-soft">
            <Package size={16} strokeWidth={1.5} aria-hidden="true" />
            {t("items")}
          </h3>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
            {result.items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 py-4"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="s3d-num font-medium">{i.quantity}×</span>{" "}
                  {i.nameSnapshot}
                  {i.colorName && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-soft">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring"
                        style={{ backgroundColor: i.colorHex ?? undefined }}
                      />
                      {i.colorName}
                    </span>
                  )}
                </span>
                <span className="s3d-num shrink-0 text-sm font-semibold">
                  {formatChf(i.priceCentsSnapshot * i.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 rounded-card border border-line bg-surface px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-soft">{t("subtotal")}</dt>
              <dd className="s3d-num">
                {formatChf(result.subtotalCents, locale)}
              </dd>
            </div>
            {result.discountCents > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <dt>
                  {t("discount")}
                  {result.discountCode ? ` (${result.discountCode})` : ""}
                </dt>
                <dd className="s3d-num">
                  −{formatChf(result.discountCents, locale)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-soft">{t("shipping")}</dt>
              <dd className="s3d-num">
                {result.shippingCents === 0
                  ? t("shippingFree")
                  : formatChf(result.shippingCents, locale)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3 font-bold text-ink">
              <dt>{t("total")}</dt>
              <dd className="s3d-num text-lg">
                {formatChf(result.totalCents, locale)}
              </dd>
            </div>
          </dl>
        </section>

        {result.address.name && (
          <section className="mt-8">
            <h3 className="s3d-label flex items-center gap-2 text-soft">
              <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
              {t("shippingAddress")}
            </h3>
            {/* ph-mask : adresse masquée dans les enregistrements de visite. */}
            <p className="ph-mask mt-3 rounded-card border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-soft">
              {result.address.name}
              <br />
              {result.address.street}
              <br />
              {result.address.npa} {result.address.city}
              {result.address.canton ? `, ${result.address.canton}` : ""}
              <br />
              CH
            </p>
          </section>
        )}

        <div className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm text-soft">{t("createAccountPrompt")}</p>
          <ButtonLink
            href="/account/register"
            variant="secondary"
            className="mt-3"
          >
            <UserPlus size={16} strokeWidth={1.5} />
            {t("createAccountCta")}
          </ButtonLink>
        </div>

        <div className="mt-6 text-center">
          <Button
            variant="text"
            onClick={() => {
              setResult(null);
              setError(null);
            }}
          >
            {t("searchAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        search();
      }}
      className="mt-10 rounded-card border border-line bg-surface p-5 sm:p-8"
    >
      <div className="space-y-5">
        <Field label={t("orderNumber")} htmlFor="orderNumber">
          <input
            id="orderNumber"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
            autoComplete="off"
            aria-describedby="track-hint"
            placeholder={t("orderNumberPlaceholder")}
            className={`${fieldClass} font-mono uppercase placeholder:normal-case`}
          />
        </Field>
        <Field label={t("email")} htmlFor="email">
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            className={fieldClass}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className={`mt-5 ${ERROR_BOX}`}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        full
        disabled={!ready || pending}
        className="mt-6"
      >
        {pending ? (
          t("searching")
        ) : (
          <>
            <Search size={18} strokeWidth={1.5} />
            {t("submit")}
          </>
        )}
      </Button>

      <p id="track-hint" className="mt-4 text-sm text-soft">
        {t("hint")}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-5 text-sm text-soft">
        {t("haveAccountPrompt")}{" "}
        <Link
          href="/account/login"
          className="inline-flex items-center gap-1 font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          {t("loginLink")}
          <ArrowRight size={14} strokeWidth={1.5} />
        </Link>
      </div>
    </form>
  );
}
