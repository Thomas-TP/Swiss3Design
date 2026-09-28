"use client";

import { useTranslations } from "next-intl";
import { useId, useSyncExternalStore } from "react";
import {
  readReducedMotion,
  setMotionPreference,
  subscribeMotionPreference,
} from "@/lib/motion-bridge/motion-pref";

// Interrupteur « Réduire les animations » du footer (brief « Strates », §3.6 ;
// WCAG 2.2.2). Écrit localStorage["s3d-motion"] = "reduce" | "full" (dans un
// try/catch : un stockage bloqué ne vaut que pour la page en cours), pose
// data-motion sur <html> et émet s3d-motion-change : le runtime détruit ou
// recrée Lenis, la SiteShell décharge ou recharge MotionRuntime, le CSS coupe
// révélations et transitions, le tout sans rechargement. Le script anti-FOUC
// du layout relit la clé avant le premier paint des pages suivantes.
//
// État lu dans data-motion (source de vérité) ; côté serveur et pendant
// l'hydratation, inconnu : l'interrupteur est rendu décoché et désactivé,
// puis prend sa vraie valeur (useSyncExternalStore, sans erreur
// d'hydratation). Une case à cocher native au rôle « switch » : Espace la
// bascule, le lecteur d'écran annonce « activé / désactivé ».
export function MotionToggle({ className }: { className?: string }) {
  const t = useTranslations("shell.motion");
  const hintId = useId();
  const reduced = useSyncExternalStore(
    subscribeMotionPreference,
    readReducedMotion,
    () => null,
  );

  return (
    <label
      className={`group grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 ${className ?? ""}`}
    >
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={reduced === true}
        aria-checked={reduced === true}
        disabled={reduced === null}
        aria-describedby={hintId}
        onChange={(event) =>
          setMotionPreference(event.target.checked ? "reduce" : "full")
        }
      />
      <span
        aria-hidden="true"
        className="relative row-span-2 mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-ink transition-colors duration-150 peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:opacity-50"
      >
        <span className="ml-0.5 h-3.5 w-3.5 rounded-full bg-ink transition-[translate,background-color] duration-150 ease-strate group-has-checked:translate-x-4 group-has-checked:bg-paper" />
      </span>
      <span className="text-sm font-medium text-ink">{t("toggle")}</span>
      <span id={hintId} className="col-start-2 text-sm text-soft">
        {t("hint")}
      </span>
    </label>
  );
}
