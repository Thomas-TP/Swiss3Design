"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { motionBridge } from "@/lib/motion-bridge/store";
import { cx } from "./cx";

// Tiroir (brief « Strates », §3.4, §6.9 « Envoyer à l'atelier ») : <dialog>
// natif ouvert par showModal(), donc dans le top layer (au-dessus du header,
// de la BottomNav et du canvas sans aucun z-index), focus piégé et Échap
// gérés par le navigateur, reste de la page inerte. Entrée par
// @starting-style en 280 ms `s3d.strate` : depuis le bas en mobile (feuille à
// coins `sheet`), depuis la droite dès lg. Pas d'animation de sortie : un
// tiroir qui se ferme rend la main tout de suite.
//
// Lenis est arrêté tant que le tiroir est ouvert (bridge.scroll.lock) : la
// molette ferait sinon défiler la page sous le tiroir. Lenis ignore déjà
// `dialog[open]` pour le défilement interne (option prevent du runtime).
// Contrôlé : `open` pilote showModal()/close(), toute fermeture (bouton,
// Échap, clic sur le fond) passe par onClose.

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Barre d'actions collée en bas du tiroir (bouton principal). */
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useTranslations("shell.ui");
  // Dernier onClose sans relancer l'effet d'ouverture à chaque rendu parent.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      motionBridge.get().scroll?.lock(true);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onDialogClose = () => {
      motionBridge.get().scroll?.lock(false);
      onCloseRef.current();
    };
    dialog.addEventListener("close", onDialogClose);
    return () => {
      dialog.removeEventListener("close", onDialogClose);
      // Démonté ouvert (navigation) : ne jamais laisser Lenis arrêté.
      if (dialog.open) motionBridge.get().scroll?.lock(false);
    };
  }, []);

  return (
    // Le clic sur le fond (::backdrop) cible le <dialog> lui-même : le contenu
    // le recouvre entièrement, un clic dedans vise toujours un enfant. Échap
    // est déjà géré par le navigateur (événement cancel, puis close).
    // oxlint-disable click-events-have-key-events, no-noninteractive-element-interactions -- fermeture au clic sur le fond, Échap natif
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={cx(
        "fixed m-0 max-h-none max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-ink/40",
        "inset-x-0 bottom-0 top-auto w-full lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[28rem]",
        "open:transition-[translate] open:duration-280 open:ease-strate",
        "open:starting:translate-y-full lg:open:starting:translate-x-full lg:open:starting:translate-y-0",
      )}
    >
      <div
        className={cx(
          "flex max-h-[88svh] flex-col rounded-t-sheet border-t border-line bg-elevated lg:h-full lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-subtitle font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={t("close")}
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-field text-soft transition-colors hover:bg-line/60 hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div
          data-lenis-prevent=""
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
        >
          {children}
        </div>
        {footer ? (
          <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
    // oxlint-enable click-events-have-key-events, no-noninteractive-element-interactions
  );
}
