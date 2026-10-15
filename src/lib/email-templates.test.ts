import { describe, expect, it } from "vitest";
import {
  adminNewOrderEmail,
  orderCancelledEmail,
  orderConfirmationEmail,
  withUtm,
} from "./email-templates";
import { BORNE_DEFAULT } from "./studio/presets";
import { studioLineInputSchema, validateStudioLine } from "./studio/purchase";

describe("withUtm", () => {
  it("marque les liens du site pour le canal Email", () => {
    expect(
      withUtm("https://swiss3design.ch/fr/cart?restore=abc", "cart_reminder"),
    ).toBe(
      "https://swiss3design.ch/fr/cart?restore=abc&utm_source=swiss3design&utm_medium=email&utm_campaign=cart_reminder",
    );
  });

  it("laisse intacts les liens vers d'autres sites", () => {
    const post = "https://service.post.ch/ekp-web/ui/entry/search/99.00";
    expect(withUtm("https://swiss3design.ch.evil.test/x", "x")).toBe(
      "https://swiss3design.ch.evil.test/x",
    );
    expect(withUtm(post, "shipping")).toBe(post);
  });
});

// Objets du Studio dans les e-mails de commande : le libellé n'a aucun texte
// saisi ; les textes à imprimer s'affichent ÉCHAPPÉS (chaînes saisies librement).
describe("e-mails d'une commande avec un objet du Studio", () => {
  const checked = validateStudioLine(
    studioLineInputSchema.parse({
      kind: "studio",
      object: "borne",
      config: JSON.parse(JSON.stringify(BORNE_DEFAULT)),
      texts: { text: 'A<b>&"Léa"' },
      locale: "fr",
      quantity: 2,
    }),
  );
  const line = checked.ok ? checked.line : null;
  const item = {
    nameSnapshot: "Porte-nom Borne · 45 × 15 × 4 mm",
    priceCentsSnapshot: 2490,
    quantity: 2,
    studio: line ? JSON.parse(JSON.stringify(line.snapshot)) : null,
  };
  const order = {
    id: "o1",
    orderNumber: "S3D-TEST",
    email: "client@example.ch",
    subtotalCents: 4980,
    shippingCents: 0,
    totalCents: 4980,
    shippingAddress: JSON.stringify({
      name: "Léa Dubois",
      street: "Rue 1",
      npa: "1196",
      city: "Gland",
    }),
    locale: "fr",
  };

  it("la fixture est une ligne valide (sinon le test ne prouve rien)", () => {
    expect(checked.ok).toBe(true);
  });

  it("la confirmation affiche les textes à imprimer, échappés, et la relecture humaine", () => {
    const html = orderConfirmationEmail(order, [item]).html;
    expect(html).toContain("2 × Porte-nom Borne");
    expect(html).toContain("A&lt;b&gt;&amp;&quot;Léa&quot;");
    expect(html).not.toContain("<b>");
    expect(html).toContain("remboursé intégralement");
  });

  it("la confirmation d'une commande sans Studio est inchangée (aucune note)", () => {
    const html = orderConfirmationEmail(order, [
      { ...item, studio: null, nameSnapshot: "Vase" },
    ]).html;
    expect(html).not.toContain("remboursé intégralement");
  });

  it("la notification de l'atelier demande la relecture des textes", () => {
    const html = adminNewOrderEmail(
      order,
      [item],
      ["atelier@swiss3design.ch"],
    ).html;
    expect(html).toContain("Textes du Studio à relire");
    expect(html).toContain("A&lt;b&gt;&amp;&quot;Léa&quot;");
  });

  it("l'annulation « texte refusé » annonce le remboursement intégral, dans la langue", () => {
    const fr = orderCancelledEmail(order, "studio-text").html;
    expect(fr).toContain("remboursé intégralement");
    const de = orderCancelledEmail(
      { ...order, locale: "de" },
      "studio-text",
    ).html;
    expect(de).toContain("erstattet");
    expect(orderCancelledEmail(order).html).not.toContain("recommencer");
  });

  it("une ligne illisible en base n'empêche pas l'e-mail", () => {
    const html = orderConfirmationEmail(order, [
      { ...item, studio: { v: 99, garbage: true } },
    ]).html;
    expect(html).toContain("2 × Porte-nom Borne");
  });
});
