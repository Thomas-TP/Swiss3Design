import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Rendu serveur du formulaire de devis partagé : sans DOM, on vérifie ce que
// les enregistrements de visite PostHog verraient. `maskAllInputs` ne couvre pas
// le type `hidden` (son attribut `value` entre dans l'enregistrement) et `ph-mask`
// ne masque que les textes : la description complète, avec les textes à imprimer
// d'un passage Studio, doit donc porter `ph-no-capture`, comme la vignette.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/lib/analytics", () => ({ track: () => {} }));
vi.mock("@/app/[locale]/(site)/custom/actions", () => ({
  submitQuoteRequest: async () => ({ status: "idle" }),
}));
vi.mock("@/components/select", () => ({ Select: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: (props: { children?: unknown }) =>
    createElement("button", null, props.children as never),
  ButtonLink: () => null,
  buttonClass: () => "",
}));

const { QuoteRequestForm } = await import("./quote-request-form");

const TEXTS = "Texte gravé : Pointe Zorgl";

function render(props: Parameters<typeof QuoteRequestForm>[0]) {
  return renderToStaticMarkup(createElement(QuoteRequestForm, props));
}

/** Les balises <input type="hidden"> du HTML rendu, par nom de champ. */
function hiddenInputs(html: string) {
  const found = new Map<string, string>();
  for (const tag of html.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    if (name) found.set(name, tag);
  }
  return found;
}

describe("QuoteRequestForm : enregistrements de visite", () => {
  const locked = render({
    source: "studio",
    object: "lavaux",
    variant: "drawer",
    prefill: {
      description: `Vase Lavaux. ${TEXTS}`,
      material: "PLA",
      colors: "Bleu Léman",
      dimensions: "120 × 80 mm",
    },
  });

  it("variante verrouillée : les quatre champs cachés sont hors enregistrement", () => {
    const hidden = hiddenInputs(locked);
    for (const name of ["description", "material", "colors", "dimensions"]) {
      expect(hidden.get(name), name).toContain("ph-no-capture");
    }
    // Le texte du visiteur voyage bien dans la demande (finalité déclarée).
    expect(hidden.get("description")).toContain(TEXTS);
  });

  it("variante verrouillée : aucun champ visible ne porte la description", () => {
    expect(locked).not.toContain("<textarea");
  });

  it("variante page : champs visibles et utilisables, sans bloc retiré", () => {
    const page = render({
      source: "studio",
      object: "lavaux",
      variant: "page",
      prefill: { description: `Vase Lavaux. ${TEXTS}`, material: "PLA" },
    });
    expect(page).toContain("<textarea");
    expect(page).toContain('type="email"');
    // Les champs de saisie sont masqués d'office (maskAllInputs) : pas besoin
    // de les retirer, et le visiteur garde un formulaire normal.
    expect(page).not.toContain('class="ph-no-capture"');
    expect(hiddenInputs(page).get("description")).toBeUndefined();
  });

  it("la vignette du Studio est hors enregistrement, ses lignes masquées", () => {
    const html = render({
      source: "studio",
      object: "lavaux",
      variant: "drawer",
      prefill: { description: `Vase Lavaux. ${TEXTS}` },
      attachment: {
        key: "quotes/x.stl",
        name: "x.stl",
        summary: {
          title: "Vase « Lavaux »",
          lines: [TEXTS],
          thumbnail: "data:image/png;base64,AAAA",
        },
      },
    });
    const img = /<img[^>]*>/.exec(html)?.[0] ?? "";
    expect(img).toContain("ph-no-capture");
    expect(img).toContain("data:image/png");
    const list = /<ul[^>]*>/.exec(html)?.[0] ?? "";
    expect(list).toContain("ph-mask");
  });
});
