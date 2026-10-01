"use client";

import { useEffect, useState } from "react";
import { useMotionBridge } from "@/lib/motion-bridge/store";
import { detectCapability } from "@/lib/motion-bridge/tier";
import type { Capability } from "@/lib/motion-bridge/types";

// La 3D du Studio est-elle disponible sur cet appareil ? (brief « Strates »,
// §3.6 et §6.7 « États »)
//
//  - « pending » : avant la sonde WebGL (le serveur et l'hydratation voient
//    toujours C0 : poster et « Préparation du Studio… », jamais le message
//    d'indisponibilité, qui serait faux sur 95 % des appareils) ;
//  - « on » : WebGL2 matériel, sans perte de contexte : le Stage peut dessiner ;
//  - « off » : pas de WebGL, économie de données, machine modeste, contexte
//    perdu, ou déclassement en cours de route (les frames trop lentes font
//    passer C1 en C0 : le Stage est libéré, le dessin 2D exact prend le relais).
//
// La sonde est celle de la SiteShell (detectCapability, mémorisée) : lancer la
// même ici ne crée pas un second contexte inutile ni ne change la décision.
export type StageAvailability = "pending" | "on" | "off";

export function useStageAvailability(): StageAvailability {
  const capability = useMotionBridge((s) => s.capability);
  const contextLost = useMotionBridge((s) => s.contextLost);
  const [probe, setProbe] = useState<Capability | null>(null);
  const [seenOn, setSeenOn] = useState(false);

  // Lecture de l'environnement après l'hydratation : le serveur n'en sait rien.
  // oxlint-disable set-state-in-effect -- sonde WebGL, unique et après le montage
  useEffect(() => {
    setProbe(detectCapability());
  }, []);
  useEffect(() => {
    if (capability >= 1) setSeenOn(true);
  }, [capability]);
  // oxlint-enable set-state-in-effect

  if (probe === null) return "pending";
  if (probe === 0 || contextLost) return "off";
  // Capacité tombée à 0 après avoir été ≥ 1 : déclassement par le Stage.
  if (seenOn && capability === 0) return "off";
  return "on";
}
