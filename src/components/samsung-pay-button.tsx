"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useStripe } from "@stripe/react-stripe-js";
import { useRouter } from "@/i18n/navigation";

/*
 * Samsung Pay — intégration « Web Checkout » officielle
 * (https://developer.samsung.com/pay/web/overview.html), service partenaire
 * configuré avec Stripe comme passerelle sur pay.samsung.com/developer.
 *
 * Deux modes d'affichage, même flux de paiement :
 *  • tuile « SAMSUNG Pay » DANS le Payment Element (custom payment method
 *    Stripe, cpmt_…) quand SAMSUNG_PAY_CPMT_ID est configuré — interface
 *    unifiée ; la sélection est détectée via elements.submit() et le bouton
 *    « Payer » du checkout appelle launch() du hook ci-dessous ;
 *  • bouton autonome (SamsungPayButton) en repli quand seul le service est
 *    configuré (ex. preview tant que le cpmt de mode test n'existe pas).
 *
 * Entièrement DORMANT tant que serviceId est vide : aucun script chargé,
 * aucun rendu. Flux : loadPaymentSheet() (app Wallet sur mobile, QR code sur
 * desktop) → credential Samsung → POST /api/samsung-pay/charge qui confirme
 * le PaymentIntent Stripe existant côté serveur → notify() → page de succès
 * (même finalisation idempotente que le Payment Element).
 */

const SDK_URL = "https://img.mpay.samsung.com/gsmpi/sdk/samsungpay_web_sdk.js";

// Le SDK expose un constructeur global ; typé au minimum nécessaire.
interface SamsungPayClientLike {
  isReadyToPay(paymentMethods: unknown): Promise<{ result: boolean } | boolean>;
  loadPaymentSheet(
    paymentMethods: unknown,
    transactionDetail: unknown,
  ): Promise<Record<string, unknown>>;
  notify(paymentResult: { status: string; provider: string }): void;
}

declare global {
  interface Window {
    SamsungPayClient?: new (config: {
      environment: string;
    }) => SamsungPayClientLike;
  }
}

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("samsung_sdk_load_failed"));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

// Charge le SDK, vérifie l'éligibilité de l'appareil et expose launch() :
// la feuille Samsung Pay + l'encaissement serveur + la redirection succès.
export function useSamsungPay({
  orderNumber,
  totalCents,
  serviceId,
  environment,
}: {
  orderNumber: string;
  totalCents: number;
  serviceId: string;
  environment: string;
}) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const stripe = useStripe();
  const [client, setClient] = useState<SamsungPayClientLike | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentMethods = {
    version: "2",
    serviceId,
    protocol: "PROTOCOL_3DS",
    allowedBrands: ["visa", "mastercard"],
  };

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    loadSdk()
      .then(() => {
        const Ctor = window.SamsungPayClient;
        if (!Ctor || cancelled) return;
        const c = new Ctor({
          environment: environment === "PRODUCTION" ? "PRODUCTION" : "STAGE",
        });
        return Promise.resolve(c.isReadyToPay(paymentMethods)).then((ready) => {
          const ok = typeof ready === "boolean" ? ready : ready?.result;
          if (ok && !cancelled) setClient(c);
        });
      })
      // SDK indisponible ou appareil non éligible : pas de bouton, pas d'erreur
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // paymentMethods est constant à serviceId donné
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, environment]);

  async function launch() {
    if (!client) return;
    setPaying(true);
    setError(null);
    try {
      const credential = await client.loadPaymentSheet(paymentMethods, {
        orderNumber,
        merchant: {
          name: "Swiss3Design",
          url: "swiss3design.ch",
          countryCode: "CH",
        },
        amount: {
          option: "FORMAT_TOTAL_PRICE_ONLY",
          currency: "CHF",
          // L'API Samsung attend un montant décimal, pas des centimes
          total: (totalCents / 100).toFixed(2),
        },
      });

      const res = await fetch("/api/samsung-pay/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, credential }),
      });
      const data = (await res.json()) as {
        status?: string;
        paymentIntentId?: string;
        clientSecret?: string;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "charge_failed");

      // 3DS additionnelle exigée par la banque : Stripe gère l'étape
      if (data.status === "requires_action" && data.clientSecret && stripe) {
        const { error: actionError } = await stripe.handleNextAction({
          clientSecret: data.clientSecret,
        });
        if (actionError) throw new Error(actionError.message);
      }

      client.notify({ status: "CHARGED", provider: "STRIPE" });
      router.push(
        `/checkout/success?payment_intent=${encodeURIComponent(data.paymentIntentId ?? "")}`,
      );
    } catch (e) {
      // Fermeture de la feuille par l'utilisateur = annulation silencieuse
      const msg = e instanceof Error ? e.message : "";
      if (!/cancel/i.test(msg)) {
        try {
          client.notify({ status: "ERRED", provider: "STRIPE" });
        } catch {}
        setError(t("errorGeneric"));
      }
      setPaying(false);
    }
  }

  return { available: !!client, paying, error, launch };
}

// Bouton autonome (repli quand la tuile cpmt du Payment Element n'est pas
// configurée). serviceId / environment viennent du serveur (wrangler.jsonc).
export function SamsungPayButton({
  orderNumber,
  totalCents,
  serviceId,
  environment,
}: {
  orderNumber: string;
  totalCents: number;
  serviceId: string;
  environment: string;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { available, paying, error, launch } = useSamsungPay({
    orderNumber,
    totalCents,
    serviceId,
    environment,
  });

  if (!available) return null;

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={launch}
        disabled={paying}
        // Charte bouton Samsung Pay : fond noir constant, texte blanc
        className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
      >
        {paying ? (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        ) : (
          <span className="font-bold">Samsung Pay</span>
        )}
        {!paying && (
          <span className="sr-only">
            {t("samsungPay", { amount: (totalCents / 100).toFixed(2) })}
          </span>
        )}
      </button>
      {error && (
        <p className="mt-3 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <div className="mt-5 flex items-center gap-3 text-xs text-soft" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        {locale === "de" ? "oder" : locale === "it" ? "oppure" : locale === "en" ? "or" : "ou"}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
