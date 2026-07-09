import type { Appearance } from "@stripe/stripe-js";

// Apparence du Payment Element accordée au thème du site (clair / sombre).
// Partagée entre le checkout boutique et le paiement de devis.
// Les sélecteurs utilisés sont tous documentés/supportés par l'Appearance API
// (.Input, .Label, .Error, .AccordionItem[+--selected/:hover], .Dropdown…) —
// un sélecteur non supporté ferait échouer le rendu du Payment Element.
export function stripeAppearance(dark: boolean): Appearance {
  const accent = "#e5231c";

  if (dark) {
    return {
      theme: "night",
      variables: {
        colorPrimary: accent,
        colorText: "#f4f1ed",
        colorTextSecondary: "#a39c92",
        colorTextPlaceholder: "#6f6962",
        colorBackground: "#1a1714",
        colorDanger: "#f87171",
        borderRadius: "12px",
        fontFamily: "Geist, system-ui, sans-serif",
        fontSizeBase: "15px",
        spacingUnit: "3px",
      },
      rules: {
        ".Input": {
          borderColor: "#2a2622",
          boxShadow: "none",
          padding: "12px 14px",
          transition: "border-color .15s ease",
        },
        ".Input:hover": { borderColor: "#3a352f" },
        ".Input:focus": { borderColor: "#f4f1ed", boxShadow: "none" },
        ".Input--invalid": { borderColor: "#f87171", boxShadow: "none" },
        ".Input::placeholder": { color: "#6f6962" },
        ".Label": { fontWeight: "500", color: "#d6d3d1", marginBottom: "6px" },
        ".Error": { color: "#f87171", fontSize: "13px", marginTop: "6px" },
        ".AccordionItem": {
          borderColor: "#2a2622",
          boxShadow: "none",
          borderRadius: "12px",
          backgroundColor: "#1a1714",
          padding: "14px 16px",
        },
        ".AccordionItem:hover": { borderColor: "#3a352f" },
        ".AccordionItem--selected": {
          borderColor: accent,
          backgroundColor: "rgba(229, 35, 28, 0.08)",
        },
        ".Dropdown": {
          borderColor: "#2a2622",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        },
        ".DropdownItem": { color: "#f4f1ed" },
        ".DropdownItem--highlight": {
          backgroundColor: "#2a2622",
          color: "#f4f1ed",
        },
      },
    };
  }
  return {
    theme: "stripe",
    variables: {
      colorPrimary: accent,
      colorText: "#1a1614",
      colorTextSecondary: "#6f6962",
      colorTextPlaceholder: "#a8a29e",
      colorBackground: "#ffffff",
      colorDanger: accent,
      borderRadius: "12px",
      fontFamily: "Geist, system-ui, sans-serif",
      fontSizeBase: "15px",
      spacingUnit: "3px",
    },
    rules: {
      ".Input": {
        borderColor: "#e8e5e1",
        boxShadow: "none",
        padding: "12px 14px",
        transition: "border-color .15s ease",
      },
      ".Input:hover": { borderColor: "#d6d1ca" },
      ".Input:focus": { borderColor: "#1a1614", boxShadow: "none" },
      ".Input--invalid": { borderColor: accent, boxShadow: "none" },
      ".Input::placeholder": { color: "#a8a29e" },
      ".Label": { fontWeight: "500", color: "#44403c", marginBottom: "6px" },
      ".Error": { color: accent, fontSize: "13px", marginTop: "6px" },
      ".AccordionItem": {
        borderColor: "#e8e5e1",
        boxShadow: "none",
        borderRadius: "12px",
        padding: "14px 16px",
      },
      ".AccordionItem:hover": { borderColor: "#d6d1ca" },
      ".AccordionItem--selected": {
        borderColor: accent,
        backgroundColor: "rgba(229, 35, 28, 0.04)",
      },
      ".Dropdown": {
        borderColor: "#e8e5e1",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(28, 25, 23, 0.08)",
      },
      ".DropdownItem": { color: "#1a1614" },
      ".DropdownItem--highlight": {
        backgroundColor: "#fafaf9",
        color: "#1a1614",
      },
    },
  };
}
