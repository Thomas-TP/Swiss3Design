import type { Appearance } from "@stripe/stripe-js";

// Apparence du Payment Element accordée au thème du site (clair / sombre).
// Partagée entre le checkout boutique et le paiement de devis.
export function stripeAppearance(dark: boolean): Appearance {
  if (dark) {
    return {
      theme: "night",
      variables: {
        colorPrimary: "#e5231c",
        colorText: "#fafaf9",
        colorTextSecondary: "#a8a29e",
        colorTextPlaceholder: "#78716c",
        colorBackground: "#1c1917",
        colorDanger: "#f87171",
        borderRadius: "12px",
        fontFamily: "Geist, system-ui, sans-serif",
        fontSizeBase: "15px",
      },
      rules: {
        ".Input": { borderColor: "#292524", boxShadow: "none", padding: "12px 16px" },
        ".Input:focus": { borderColor: "#fafaf9", boxShadow: "none" },
        ".Label": { fontWeight: "500", color: "#d6d3d1" },
        ".AccordionItem": {
          borderColor: "#292524",
          boxShadow: "none",
          borderRadius: "12px",
          backgroundColor: "#1c1917",
        },
        ".Dropdown": {
          borderColor: "#292524",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        },
        ".DropdownItem": { color: "#fafaf9" },
        ".DropdownItem--highlight": { backgroundColor: "#292524", color: "#fafaf9" },
      },
    };
  }
  return {
    theme: "stripe",
    variables: {
      colorPrimary: "#e5231c",
      colorText: "#1c1917",
      colorTextSecondary: "#78716c",
      colorTextPlaceholder: "#a8a29e",
      colorBackground: "#ffffff",
      colorDanger: "#e5231c",
      borderRadius: "12px",
      fontFamily: "Geist, system-ui, sans-serif",
      fontSizeBase: "15px",
    },
    rules: {
      ".Input": { borderColor: "#e7e5e4", boxShadow: "none", padding: "12px 16px" },
      ".Input:focus": { borderColor: "#1c1917", boxShadow: "none" },
      ".Label": { fontWeight: "500", color: "#44403c" },
      ".AccordionItem": { borderColor: "#e7e5e4", boxShadow: "none", borderRadius: "12px" },
      ".Dropdown": {
        borderColor: "#e7e5e4",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(28, 25, 23, 0.08)",
      },
      ".DropdownItem": { color: "#1c1917" },
      ".DropdownItem--highlight": { backgroundColor: "#fafaf9", color: "#1c1917" },
    },
  };
}
