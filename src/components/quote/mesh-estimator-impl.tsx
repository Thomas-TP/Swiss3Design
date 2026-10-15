"use client";

import { useEffect } from "react";
import { estimateFile, type EstimateResult } from "@/lib/mesh-weight/client";

// Corps de l'estimation (voir mesh-estimator.tsx) : ne dessine rien, lit le fichier
// dans un Web Worker du navigateur et rend le résultat. Un changement de fichier
// (ou le démontage) annule l'attente ; le Worker, lui, est toujours terminé.
export default function MeshEstimatorImpl({
  file,
  onResult,
}: {
  file: File;
  onResult: (result: EstimateResult) => void;
}) {
  useEffect(() => {
    let alive = true;
    void estimateFile(file).then((result) => {
      if (alive) onResult(result);
    });
    return () => {
      alive = false;
    };
  }, [file, onResult]);
  return null;
}
