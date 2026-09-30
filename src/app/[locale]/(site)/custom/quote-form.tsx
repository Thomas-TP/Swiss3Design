"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  QuoteRequestForm,
  type QuoteAttachment,
  type QuotePrefill,
} from "@/components/quote/quote-request-form";
import { formatBytes, formatCount } from "@/components/quote/quote-logic";
import { motionBridge } from "@/lib/motion-bridge/store";
import {
  clearQuoteHandoff,
  readQuoteHandoff,
  type QuoteHandoff,
} from "@/lib/quote-handoff";

// Enveloppe de /custom autour du formulaire partagé (brief « Strates », §7.10).
// Seul travail propre à la page : retrouver le passage Studio → /custom
// (sessionStorage, lu après l'hydratation : le serveur n'en sait rien et rend
// le formulaire nu) et, s'il existe, en tirer la carte « Configuration Studio
// jointe », les champs préremplis et la pièce jointe déjà envoyée.
//
// Le passage est lu dès qu'il existe, avec ou sans `#studio` dans l'adresse :
// le Studio y envoie (`/custom#studio`), mais un visiteur qui y revient par la
// navigation garde sa configuration (24 h au plus, « Retirer » l'efface). Avec
// `#studio`, la page défile jusqu'à la fiche, où se trouve la carte.

const SHEET_ID = "demande";

function scrollToSheet() {
  const sheet = document.getElementById(SHEET_ID);
  if (!sheet) return;
  const scroll = motionBridge.get().scroll;
  // Lenis en marche : on passe par lui (l'en-tête fait 64 px, marge de 16).
  // Sinon un saut natif, que scroll-mt-24 de la fiche règle sous l'en-tête.
  if (scroll) scroll.to(sheet, { offset: -80 });
  else sheet.scrollIntoView({ behavior: "auto", block: "start" });
}

export function QuoteForm({ materials }: { materials: string[] }) {
  const t = useTranslations("quote.studioCard");
  const locale = useLocale();
  const [handoff, setHandoff] = useState<QuoteHandoff | null>(null);

  // Lecture unique après le montage : sessionStorage n'existe pas côté serveur.
  useEffect(() => {
    const found = readQuoteHandoff();
    if (!found) return;
    setHandoff(found);
    if (window.location.hash === "#studio")
      requestAnimationFrame(scrollToSheet);
  }, []);

  if (!handoff) {
    return (
      <QuoteRequestForm
        key="form"
        materials={materials}
        source="form"
        variant="page"
      />
    );
  }

  const { prefill: raw, attachment: sent } = handoff;
  const prefill: QuotePrefill = {
    description: raw.description,
    material: raw.material,
    colors: raw.colors,
    dimensions: raw.dimensions,
  };
  const lines = [
    raw.dimensions,
    raw.colors,
    sent
      ? `${t("fileSent", {
          name: sent.name,
          size: formatBytes(sent.bytes, locale),
        })} · ${t("triangles", { count: formatCount(sent.triangles, locale) })}`
      : t("noFile"),
  ].filter(Boolean);
  const attachment: QuoteAttachment = {
    key: sent?.key,
    name: sent?.name,
    summary: {
      title: t(`objects.${handoff.object}`),
      lines,
      note: t("prefilled"),
      thumbnail: handoff.thumbnail,
      editHref: handoff.link,
      onRemove: () => {
        clearQuoteHandoff();
        setHandoff(null);
      },
    },
  };

  return (
    <QuoteRequestForm
      // Une autre configuration = des champs neufs (préremplissage relu).
      key={`studio-${handoff.createdAt}`}
      // La matière vient du Studio (PLA) : pas de sélecteur.
      source="studio"
      object={handoff.object}
      prefill={prefill}
      attachment={attachment}
      variant="page"
      // Envoyé (ou « Retirer ») : le passage est consommé. On n'efface que le
      // stockage, pas l'état : le panneau de succès doit rester à l'écran.
      onSuccess={clearQuoteHandoff}
    />
  );
}
