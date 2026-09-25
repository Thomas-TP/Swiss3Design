import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Swiss3Design",
    short_name: "Swiss3Design",
    description:
      "Objets design imprimés en 3D jusqu'à 4 couleurs, fabriqués dans l'arc lémanique et livrés dans toute la Suisse.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    categories: ["shopping", "design"],
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      {
        src: "/brand/app/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
