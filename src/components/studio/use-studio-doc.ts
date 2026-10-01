"use client";

import { useEffect, useReducer, useState } from "react";
import { defaultConfig } from "@/lib/studio/presets";
import { readStudioTexts, writeStudioTexts } from "@/lib/studio/texts-store";
import type {
  StudioConfig,
  StudioObjectId,
  StudioTexts,
} from "@/lib/studio/types";
import { configFragment, decodeFragment } from "@/lib/studio/url-state";
import {
  canRedo,
  canUndo,
  createHistory,
  historyReducer,
  type HistoryAction,
  type StudioDoc,
} from "./history";

// État du document du Studio (brief « Strates », §6.7, §6.8) : la
// configuration et les textes, avec leur historique (Annuler / Rétablir), et
// leurs deux lieux de stockage :
//   - la configuration vit dans le FRAGMENT de l'URL (#c=v1.…, ≤ 600 caractères,
//     remplacé 300 ms après le dernier geste), jamais envoyé au serveur ;
//   - les textes vivent en mémoire et dans sessionStorage, JAMAIS dans l'URL.
//
// Le serveur et l'hydratation partent de `initial` (valeurs par défaut ou
// paramètres GET du formulaire sans JavaScript) ; après le montage, le fragment
// (un lien partagé) et les textes de la session prennent le relais. Un
// fragment invalide laisse les réglages de départ et lève `invalidLink`.

const FRAGMENT_DELAY_MS = 300;
const TEXTS_DELAY_MS = 300;

export interface StudioDocApi {
  config: StudioConfig;
  texts: StudioTexts;
  dispatch: (action: HistoryAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Le lien ouvert contenait un fragment illisible : réglages par défaut, à signaler. */
  invalidLink: boolean;
  /** Le fragment et les textes de la session ont été relus (après l'hydratation). */
  ready: boolean;
}

export function useStudioDoc(
  object: StudioObjectId,
  initial: StudioConfig,
  initialInvalid: boolean,
): StudioDocApi {
  const [history, dispatch] = useReducer(
    historyReducer,
    initial,
    (config): ReturnType<typeof createHistory> =>
      createHistory({ config, texts: {} }),
  );
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(initialInvalid);

  // Après l'hydratation : fragment d'un lien partagé, textes de la session,
  // paramètres GET repliés dans le fragment (§6.8).
  // oxlint-disable set-state-in-effect -- lecture de l'URL et de sessionStorage, que le serveur ne voit pas
  useEffect(() => {
    let config = initial;
    const hash = window.location.hash;
    if (/[#&]c=/.test(hash)) {
      const decoded = decodeFragment(object, hash, defaultConfig(object));
      if (decoded.ok) config = decoded.config;
      else setInvalidLink(true);
    }
    const doc: StudioDoc = { config, texts: readStudioTexts(object) };
    dispatch({ type: "load", doc });
    // Les paramètres GET du formulaire sans JavaScript passent dans le fragment.
    if (window.location.search) {
      try {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${configFragment(config)}`,
        );
      } catch {
        // URL non modifiable (cadre, aperçu) : on garde celle de la page.
      }
    }
    setReady(true);
  }, [object, initial]);
  // oxlint-enable set-state-in-effect

  // Un lien ouvert dans l'onglet déjà ouvert (outil WebMCP, lien du fil d'une
  // conversation) change le fragment sans recharger la page : on le relit.
  useEffect(() => {
    function onHashChange() {
      if (!/[#&]c=/.test(window.location.hash)) return;
      const decoded = decodeFragment(
        object,
        window.location.hash,
        defaultConfig(object),
      );
      if (decoded.ok)
        dispatch({
          type: "set",
          patch: { config: decoded.config },
          commit: true,
        });
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [object]);

  // Fragment : 300 ms après le dernier changement de configuration.
  const config = history.present.config;
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        const url = `${window.location.pathname}${window.location.search}${configFragment(config)}`;
        window.history.replaceState(window.history.state, "", url);
      } catch {
        // URL non modifiable : le lien copié reste exact (il est recalculé à la demande).
      }
    }, FRAGMENT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [config, ready]);

  // Textes : en mémoire et dans la session de l'onglet seulement.
  const texts = history.present.texts;
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(
      () => writeStudioTexts(object, texts),
      TEXTS_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [object, texts, ready]);

  return {
    config,
    texts,
    dispatch,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    invalidLink,
    ready,
  };
}
