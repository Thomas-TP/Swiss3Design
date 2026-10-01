"use client";

// Moteur du Studio (brief « Strates », §9.2, §4.11 : ≤ 40 Ko gzip) : le seul
// morceau du Studio qui s'installe même sans WebGL. Il branche l'export STL sur
// le pont (`bridge.studio.exportStl`) : le tiroir « Envoyer à l'atelier » le
// demande là, sans connaître le Worker, et l'accueil (chapitre 02) peut s'en
// servir de la même façon. Le calcul tourne dans le Worker de géométrie
// (worker-client.ts), jamais sur le fil principal.
//
// Monté par le gate src/gates/studio.tsx (next/dynamic, ssr: false) : ni le
// client du Worker ni ses générateurs n'entrent dans le Worker Cloudflare du
// site (règle d'or 11). La capacité (C0 : pas de WebGL) n'y change rien : un
// export est un calcul, pas un rendu.
import { useEffect } from "react";
import { motionBridge } from "@/lib/motion-bridge/store";
import type { BridgeStudio } from "@/lib/motion-bridge/types";
import type { StudioLocale } from "@/components/studio/scene-props";
import { getStudioWorker } from "./worker-client";

const STL_TYPE = "model/stl";

export function StudioEngine({
  locale,
  preloadGlyphs = false,
}: {
  locale: StudioLocale;
  /** Objet à texte : charge les glyphes pendant que le visiteur règle. */
  preloadGlyphs?: boolean;
}) {
  useEffect(() => {
    const worker = getStudioWorker();
    const engine: BridgeStudio = {
      async exportStl(config, texts, name) {
        const file = await worker.exportStl(config, texts, name, locale);
        // Un File garde le nom du fichier jusqu'à l'envoi ; Blob sinon.
        const blob =
          typeof File !== "undefined"
            ? new File([file.buffer], name, { type: STL_TYPE })
            : new Blob([file.buffer], { type: STL_TYPE });
        return { blob, triangles: file.triangles, bytes: file.bytes };
      },
    };
    motionBridge.set({ studio: engine });
    return () => {
      // Ne retire que son propre branchement (une autre page l'a peut-être remplacé).
      if (motionBridge.get().studio === engine)
        motionBridge.set({ studio: null });
    };
  }, [locale]);

  useEffect(() => {
    if (preloadGlyphs) getStudioWorker().preloadGlyphs();
  }, [preloadGlyphs]);

  return null;
}
