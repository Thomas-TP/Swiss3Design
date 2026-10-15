"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { isAuthMessage, openAuthChannel } from "@/lib/auth-channel";
import { btnAccentLg } from "../(dashboard)/_ui";

// Après le clic sur le lien de confirmation (Better Auth a validé l'adresse et
// ouvert la session) : la page le dit, puis
//  • si l'onglet de l'inscription est encore ouvert dans ce navigateur, il répond
//    sur le canal (lib/auth-channel.ts), se connecte, et cet onglet se ferme ;
//    un navigateur qui refuse la fermeture laisse le message « vous pouvez fermer
//    cet onglet » et un bouton vers le compte ;
//  • sinon, cet onglet emmène vers le compte, connecté.
// Les délais laissent le temps de lire la confirmation.

type Phase = "checking" | "back" | "close" | "redirect";

const LISTEN_MS = 700;
const READ_MS = 1800;

export function VerifiedStatus() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    const channel = openAuthChannel();
    const timers: number[] = [];
    let acked = false;
    if (channel) {
      channel.onmessage = (event) => {
        if (isAuthMessage(event.data, "ack")) acked = true;
      };
      channel.postMessage({ type: "verified" });
    }
    timers.push(
      window.setTimeout(() => {
        if (acked) {
          setPhase("back");
          timers.push(
            window.setTimeout(() => {
              window.close();
              // Toujours là : le navigateur a refusé la fermeture.
              timers.push(window.setTimeout(() => setPhase("close"), 400));
            }, READ_MS),
          );
        } else {
          setPhase("redirect");
          timers.push(
            window.setTimeout(() => router.replace("/account"), READ_MS),
          );
        }
      }, LISTEN_MS),
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      channel?.close();
    };
  }, [router]);

  return (
    <div className="text-center">
      <CheckCircle2
        size={32}
        strokeWidth={1.5}
        aria-hidden="true"
        className="mx-auto text-emerald-600"
      />
      <p
        aria-live="polite"
        className="mt-4 flex items-center justify-center gap-2 text-sm text-soft"
      >
        {phase === "close" ? null : (
          <LoaderCircle
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="animate-spin"
          />
        )}
        {phase === "back"
          ? t("verifiedBack")
          : phase === "close"
            ? t("verifiedClose")
            : t("verifiedRedirect")}
      </p>
      {phase === "close" ? (
        <Link href="/account" className={`${btnAccentLg} mt-6`}>
          {t("verifiedContinue")}
        </Link>
      ) : null}
    </div>
  );
}
