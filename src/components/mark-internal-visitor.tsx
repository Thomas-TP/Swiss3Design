"use client";

import { useEffect } from "react";
import { markInternalVisitor } from "@/lib/analytics";

// Monté dans l'admin : ce navigateur est celui de l'équipe, ses visites de la
// boutique sortent des statistiques (voir lib/analytics.ts).
export function MarkInternalVisitor() {
  useEffect(() => {
    markInternalVisitor();
  }, []);
  return null;
}
