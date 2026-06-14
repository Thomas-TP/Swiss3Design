import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swiss3Design",
    short_name: "Swiss3Design",
    description: "Impression 3D multicolore en Suisse",
    start_url: "/",
    display: "standalone",
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
