"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, XCircle, ArrowRight, UserPlus, PackageSearch } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth-client";

type Status = "succeeded" | "processing" | "failed";

async function completeOrder(redirectStatus: string | null): Promise<{
  status: Status;
  displayId: number | null;
}> {
  if (redirectStatus === "failed") return { status: "failed", displayId: null };
  const cartId = localStorage.getItem("s3d-cart-id");
  if (!cartId) return { status: "failed", displayId: null };

  try {
    const data = (await medusa.store.cart.complete(cartId)) as {
      type: "order" | "cart";
      order?: { display_id: number };
    };
    if (data.type === "order" && data.order) {
      return { status: "succeeded", displayId: data.order.display_id };
    }
    // Moyens de paiement redirigés (TWINT...) : Stripe confirme la
    // redirection mais le paiement peut rester "processing" quelques
    // secondes - le webhook Medusa finalise ensuite (Phase 2, dual-path
    // déjà vérifié).
    if (redirectStatus === "processing") return { status: "processing", displayId: null };
    return { status: "failed", displayId: null };
  } catch {
    return { status: "failed", displayId: null };
  }
}

export default function CheckoutSuccessPage() {
  const t = useTranslations("orderSuccess");
  const { clear } = useCart();
  const { data: authSession } = useSession();
  const searchParams = useSearchParams();

  const [result, setResult] = useState<{ status: Status; displayId: number | null } | null>(null);

  useEffect(() => {
    completeOrder(searchParams.get("redirect_status")).then((r) => {
      if (r.status === "succeeded") clear();
      setResult(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return <div className="mx-auto max-w-xl px-4 py-20 sm:px-6" />;

  const { status, displayId } = result;
  const Icon = status === "succeeded" ? CheckCircle2 : status === "processing" ? Clock : XCircle;

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <div className="rounded-card border border-line bg-surface p-10 text-center">
        <span
          className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${
            status === "succeeded"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : status === "processing"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : "bg-accent/10 text-accent"
          }`}
        >
          <Icon size={30} strokeWidth={1.8} />
        </span>
        <h1 className="mt-6 text-2xl font-bold">
          {status === "succeeded" ? t("title") : status === "processing" ? t("processingTitle") : t("failedTitle")}
        </h1>
        <p className="mt-3 leading-relaxed text-soft">
          {status === "succeeded"
            ? t("text", { orderNumber: displayId ? `S3D-${displayId}` : "—" })
            : status === "processing"
              ? t("processing")
              : t("failed")}
        </p>
        <Link
          href={status === "failed" ? "/cart" : "/shop"}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
        >
          {status === "failed" ? t("backCart") : t("backShop")}
          <ArrowRight size={16} />
        </Link>
      </div>

      {status === "succeeded" && !authSession && (
        <div className="mt-6 rounded-card border border-line bg-surface p-7 text-center sm:p-8">
          <h2 className="text-lg font-bold tracking-tight">{t("createAccountTitle")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-soft">{t("createAccountText")}</p>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/account/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] sm:w-auto"
            >
              <UserPlus size={16} />
              {t("createAccountCta")}
            </Link>
            <Link
              href="/track"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-semibold transition-colors hover:border-ink sm:w-auto"
            >
              <PackageSearch size={16} />
              {t("trackGuestCta")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
