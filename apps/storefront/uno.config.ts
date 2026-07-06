import { defineConfig, presetWind3 } from "unocss";

// Jetons de marque Swiss3Design — miroir des classes Tailwind de l'app
// Next.js (bg-paper, text-ink, border-line, text-soft, bg-accent, …), voir
// src/app.css pour les variables CSS sous-jacentes. Mode sombre par classe
// .dark (comportement par défaut de presetWind3).
export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      paper: "var(--paper)",
      surface: "var(--surface)",
      elevated: "var(--elevated)",
      ink: "var(--ink)",
      soft: "var(--soft)",
      line: "var(--line)",
      accent: {
        DEFAULT: "var(--accent)",
        dark: "var(--accent-dark)",
      },
      "swatch-ring": "var(--swatch-ring)",
      night: {
        DEFAULT: "var(--night)",
        soft: "var(--night-soft)",
        line: "var(--night-line)",
      },
    },
    borderRadius: {
      card: "var(--radius-card)",
    },
  },
});
