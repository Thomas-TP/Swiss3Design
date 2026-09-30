import type { Appearance } from "@stripe/stripe-js";

// Apparence du Payment Element accordée au thème du site (clair / sombre),
// direction « Strates » (brief §7.14) : les valeurs suivent les jetons de
// globals.css (Stripe n'accepte que des couleurs littérales, pas de var()).
// Partagée entre le checkout boutique et le paiement de devis.
// Les sélecteurs utilisés sont tous documentés/supportés par l'Appearance API
// (.Input, .Label, .Error, .AccordionItem[+--selected/:hover], .Dropdown…) —
// un sélecteur non supporté ferait échouer le rendu du Payment Element.
//
// Correspondance avec les jetons (clair / sombre) :
//   colorText            ink           #1a1614 / #f2ede4
//   colorTextSecondary   soft          #6a635a / #a39b8f
//   colorBackground      elevated      #ffffff / #211e1a
//   bordures             line, iso     #d8d1c4, #c9c1b2 / #2e2a25, #3a352f
//   erreurs              accent-text   #b3170f / #ff5b4e (texte rouge < 24 px)
//   colorPrimary         accent        #e5231c (graphique : anneau, sélection)
// Police : Geist, inchangée (chargée dans l'iframe par checkout-flow.tsx).
export function stripeAppearance(dark: boolean): Appearance {
  const accent = "#e5231c";

  if (dark) {
    const danger = "#ff5b4e";
    return {
      theme: "night",
      variables: {
        colorPrimary: accent,
        colorText: "#f2ede4",
        colorTextSecondary: "#a39b8f",
        colorTextPlaceholder: "#6a635a",
        colorBackground: "#211e1a",
        colorDanger: danger,
        borderRadius: "4px",
        fontFamily: "Geist, system-ui, sans-serif",
        fontSizeBase: "15px",
        spacingUnit: "3px",
      },
      rules: {
        ".Input": {
          borderColor: "#2e2a25",
          boxShadow: "none",
          padding: "12px 14px",
          transition: "border-color .15s ease",
        },
        ".Input:hover": { borderColor: "#3a352f" },
        ".Input:focus": { borderColor: "#f2ede4", boxShadow: "none" },
        ".Input--invalid": { borderColor: danger, boxShadow: "none" },
        ".Input::placeholder": { color: "#6a635a" },
        ".Label": { fontWeight: "500", color: "#d6d0c6", marginBottom: "6px" },
        ".Error": { color: danger, fontSize: "13px", marginTop: "6px" },
        ".AccordionItem": {
          borderColor: "#2e2a25",
          boxShadow: "none",
          borderRadius: "6px",
          backgroundColor: "#211e1a",
          padding: "14px 16px",
        },
        ".AccordionItem:hover": { borderColor: "#3a352f" },
        ".AccordionItem--selected": {
          borderColor: accent,
          backgroundColor: "rgba(229, 35, 28, 0.08)",
        },
        ".Dropdown": {
          borderColor: "#2e2a25",
          borderRadius: "4px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        },
        ".DropdownItem": { color: "#f2ede4" },
        ".DropdownItem--highlight": {
          backgroundColor: "#2e2a25",
          color: "#f2ede4",
        },
      },
    };
  }
  const danger = "#b3170f";
  return {
    theme: "stripe",
    variables: {
      colorPrimary: accent,
      colorText: "#1a1614",
      colorTextSecondary: "#6a635a",
      colorTextPlaceholder: "#9a9288",
      colorBackground: "#ffffff",
      colorDanger: danger,
      borderRadius: "4px",
      fontFamily: "Geist, system-ui, sans-serif",
      fontSizeBase: "15px",
      spacingUnit: "3px",
    },
    rules: {
      ".Input": {
        borderColor: "#d8d1c4",
        boxShadow: "none",
        padding: "12px 14px",
        transition: "border-color .15s ease",
      },
      ".Input:hover": { borderColor: "#c9c1b2" },
      ".Input:focus": { borderColor: "#1a1614", boxShadow: "none" },
      ".Input--invalid": { borderColor: danger, boxShadow: "none" },
      ".Input::placeholder": { color: "#9a9288" },
      ".Label": { fontWeight: "500", color: "#3d3731", marginBottom: "6px" },
      ".Error": { color: danger, fontSize: "13px", marginTop: "6px" },
      ".AccordionItem": {
        borderColor: "#d8d1c4",
        boxShadow: "none",
        borderRadius: "6px",
        padding: "14px 16px",
      },
      ".AccordionItem:hover": { borderColor: "#c9c1b2" },
      ".AccordionItem--selected": {
        borderColor: accent,
        backgroundColor: "rgba(229, 35, 28, 0.04)",
      },
      ".Dropdown": {
        borderColor: "#d8d1c4",
        borderRadius: "4px",
        boxShadow: "0 8px 24px rgba(26, 22, 20, 0.08)",
      },
      ".DropdownItem": { color: "#1a1614" },
      ".DropdownItem--highlight": {
        backgroundColor: "#f4f0e8",
        color: "#1a1614",
      },
    },
  };
}
