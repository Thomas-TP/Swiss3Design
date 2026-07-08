"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { QuotePayFlow } from "./quote-pay-flow";

interface QuoteDetail {
  id: string;
  status: string;
  quoted_price: number | null;
  admin_message: string | null;
  valid_until: string | null;
}

const PAID_STATUSES = new Set(["paid", "in_production", "done"]);

export default function QuotePayPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [quote, setQuote] = useState<QuoteDetail | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    medusa.client
      .fetch<{ quote: QuoteDetail }>(`/store/quotes/${params.id}`)
      .then(({ quote: q }) => setQuote(q))
      .catch(() => setQuote(null));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Filet pour les moyens de paiement redirigés (TWINT...) : au retour de
  // Stripe, on retrouve le payment_collection_id posé avant confirmPayment
  // et on confirme (idempotent - le webhook reste la source de vérité).
  useEffect(() => {
    if (quote === undefined || quote === null) return;
    if (PAID_STATUSES.has(quote.status)) return;
    if (!searchParams.get("redirect_status")) return;
    const key = `s3d-quote-pay-${params.id}`;
    const paymentCollectionId = sessionStorage.getItem(key);
    if (!paymentCollectionId) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setConfirming(true);
      try {
        await medusa.client.fetch(`/store/quotes/${params.id}/pay/confirm`, {
          method: "POST",
          body: { payment_collection_id: paymentCollectionId },
        });
        sessionStorage.removeItem(key);
        load();
      } catch {
        // le webhook reste la source de vérité
      } finally {
        if (!cancelled) setConfirming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, params.id]);

  if (quote === undefined || confirming) return null;
  if (quote === null) {
    return (
      <div className="max-w-xl">
        <Link href="/account/quotes" className="inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink">
          <ArrowLeft size={15} />
          {t("orderDetail.back")}
        </Link>
      </div>
    );
  }

  const paid = PAID_STATUSES.has(quote.status);
  // eslint-disable-next-line react-hooks/purity -- l'horloge est stable sur la durée du rendu
  const expired = !!quote.valid_until && new Date(quote.valid_until).getTime() < Date.now();
  const payable = !paid && !expired && (quote.status === "quoted" || quote.status === "accepted") && !!quote.quoted_price && quote.quoted_price > 0;

  return (
    <div className="max-w-xl">
      <Link href="/account/quotes" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink">
        <ArrowLeft size={15} />
        {t("orderDetail.back")}
      </Link>

      {paid ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center">
          <CheckCircle2 size={30} strokeWidth={1.8} className="mx-auto text-emerald-600" />
          <h1 className="mt-5 text-2xl font-bold">{t("quotePay.paidTitle")}</h1>
          <p className="mt-3 leading-relaxed text-soft">{t("quotePay.paidText")}</p>
        </div>
      ) : payable ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("quotePay.title")}</h1>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatChfAmount(quote.quoted_price!, locale)}</p>
          {quote.admin_message && (
            <p className="mt-3 rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-soft ring-1 ring-line">{quote.admin_message}</p>
          )}
          <QuotePayFlow quoteId={quote.id} totalAmount={quote.quoted_price!} onPaid={load} />
        </div>
      ) : (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-soft">{expired ? t("quotePay.expired") : t("quotePay.notPayable")}</p>
      )}
    </div>
  );
}
