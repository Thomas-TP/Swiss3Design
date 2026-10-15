"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import type { StudioOrderLine } from "@/lib/studio/order-line";
import { exportOrderStl, orderNeedsGlyphs } from "@/lib/studio/order-stl";
import {
  GLYPH_URL,
  getGlyphFont,
  loadGlyphFont,
} from "@/lib/studio/text/glyphs";

// « Télécharger le STL » de l'admin : le fichier est généré DANS LE NAVIGATEUR
// de l'admin à partir de la configuration gardée dans la commande (même chemin
// que l'export du Studio, voir lib/studio/order-stl.ts). Rien de lourd dans le
// Worker : ce composant n'est chargé que par `studio-stl-gate.tsx`
// (`next/dynamic`, `ssr: false`), donc la géométrie n'entre pas dans le bundle
// serveur (règle d'or 10). Génération sur le fil principal : quelques centaines
// de millisecondes, un usage d'administration rare.

export default function StudioStlButton({
  line,
  label,
  className,
}: {
  line: StudioOrderLine;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "busy" }
    | { status: "done"; text: string }
    | { status: "error"; text: string }
  >({ status: "idle" });

  async function download() {
    setState({ status: "busy" });
    try {
      if (orderNeedsGlyphs(line) && !getGlyphFont())
        await loadGlyphFont(GLYPH_URL);
      // Un tour de boucle : l'état « en cours » se peint avant le calcul.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const stl = exportOrderStl(line);
      const url = URL.createObjectURL(
        new Blob([stl.buffer], { type: "model/stl" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = stl.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState({
        status: "done",
        text: `${stl.fileName} · ${stl.triangles} triangles · ${(stl.bytes / 1000).toFixed(0)} Ko · empreinte ${stl.hash}`,
      });
    } catch (error) {
      console.error("[admin] export STL impossible", error);
      setState({
        status: "error",
        text: "Le STL n'a pas pu être généré. Rechargez la page et réessayez.",
      });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={download}
        disabled={state.status === "busy"}
        className={className}
      >
        <Download size={15} strokeWidth={1.5} aria-hidden="true" />
        {state.status === "busy" ? "Génération…" : label}
      </button>
      <output className="block text-xs text-soft">
        {state.status === "done" || state.status === "error" ? state.text : ""}
      </output>
    </div>
  );
}
