import { Show, createResource } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { CheckCircle2, Clock, XCircle, ArrowRight, UserPlus, PackageSearch } from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { medusa } from "../../../lib/medusa";
import { useCart } from "../../../lib/cart";
import { useSession } from "../../../lib/auth-client";

type Status = "succeeded" | "processing" | "failed";

async function completeOrder(redirectStatus: string | undefined): Promise<{
  status: Status;
  displayId: number | null;
  email: string | null;
}> {
  if (redirectStatus === "failed") {
    return { status: "failed", displayId: null, email: null };
  }
  const cartId = localStorage.getItem("s3d-cart-id");
  if (!cartId) return { status: "failed", displayId: null, email: null };

  try {
    const data = (await medusa.store.cart.complete(cartId)) as {
      type: "order" | "cart";
      order?: { display_id: number; email: string | null };
    };
    if (data.type === "order" && data.order) {
      return { status: "succeeded", displayId: data.order.display_id, email: data.order.email };
    }
    // Moyens de paiement redirigés (TWINT...) : Stripe confirme la
    // redirection mais le paiement peut rester "processing" côté serveur
    // quelques secondes - le webhook Medusa (Phase 2, chemin dual vérifié)
    // finalise la commande ensuite, indépendamment de cette page.
    if (redirectStatus === "processing") {
      return { status: "processing", displayId: null, email: null };
    }
    return { status: "failed", displayId: null, email: null };
  } catch {
    return { status: "failed", displayId: null, email: null };
  }
}

export default function CheckoutSuccessPage() {
  const { t, locale } = useI18n();
  const { clear } = useCart();
  const session = useSession();
  const [searchParams] = useSearchParams();

  const [result] = createResource(
    () => (typeof searchParams.redirect_status === "string" ? searchParams.redirect_status : undefined),
    async (redirectStatus) => {
      const r = await completeOrder(redirectStatus);
      if (r.status === "succeeded") clear();
      return r;
    },
  );

  return (
    <div class="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <Show when={result()}>
        {(r) => {
          const status = () => r().status;
          const Icon = () => (status() === "succeeded" ? CheckCircle2 : status() === "processing" ? Clock : XCircle);
          return (
            <>
              <div class="rounded-card border border-line bg-surface p-10 text-center">
                <span
                  class={`mx-auto grid h-16 w-16 place-items-center rounded-full ${
                    status() === "succeeded"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : status() === "processing"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                        : "bg-accent/10 text-accent"
                  }`}
                >
                  {(() => {
                    const I = Icon();
                    return <I size={30} stroke-width={1.8} />;
                  })()}
                </span>
                <h1 class="mt-6 text-2xl font-bold">
                  {status() === "succeeded"
                    ? t("orderSuccess.title")
                    : status() === "processing"
                      ? t("orderSuccess.processingTitle")
                      : t("orderSuccess.failedTitle")}
                </h1>
                <p class="mt-3 leading-relaxed text-soft">
                  {status() === "succeeded"
                    ? t("orderSuccess.text", { orderNumber: r().displayId ? `S3D-${r().displayId}` : "—" })
                    : status() === "processing"
                      ? t("orderSuccess.processing")
                      : t("orderSuccess.failed")}
                </p>
                <A
                  href={`/${locale()}/${status() === "failed" ? "cart" : "shop"}`}
                  class="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
                >
                  {status() === "failed" ? t("orderSuccess.backCart") : t("orderSuccess.backShop")}
                  <ArrowRight size={16} />
                </A>
              </div>

              <Show when={status() === "succeeded" && !session().data}>
                <div class="mt-6 rounded-card border border-line bg-surface p-7 text-center sm:p-8">
                  <h2 class="text-lg font-bold tracking-tight">{t("orderSuccess.createAccountTitle")}</h2>
                  <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-soft">
                    {t("orderSuccess.createAccountText")}
                  </p>
                  <div class="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <A
                      href={`/${locale()}/account/register`}
                      class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] sm:w-auto"
                    >
                      <UserPlus size={16} />
                      {t("orderSuccess.createAccountCta")}
                    </A>
                    <A
                      href={`/${locale()}/track`}
                      class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-semibold transition-colors hover:border-ink sm:w-auto"
                    >
                      <PackageSearch size={16} />
                      {t("orderSuccess.trackGuestCta")}
                    </A>
                  </div>
                </div>
              </Show>
            </>
          );
        }}
      </Show>
    </div>
  );
}
