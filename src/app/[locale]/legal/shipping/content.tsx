import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Version « amicale » et scannable des clauses Livraison/Retours des CGV
// (src/app/[locale]/legal/terms/content.tsx) — même politique, reformulée
// pour une lecture rapide plutôt que le format numéroté des CGV. En cas
// d'écart, les CGV font foi (rappelé dans le dernier encart).
// Frais de port : garder en phase avec src/lib/shipping.ts
// (SHIPPING_CENTS=890, FREE_SHIPPING_OVER_CENTS=6000) si ces valeurs changent.

export interface ShippingSection {
  title: string;
  body: ReactNode;
}

const link =
  "font-medium text-accent underline-offset-2 transition-colors hover:underline";

export const SHIPPING_CONTENT: Record<Locale, ShippingSection[]> = {
  fr: [
    {
      title: "Zone de livraison",
      body: (
        <p>
          Nous livrons exclusivement en <strong>Suisse</strong>, via la Poste
          suisse.
        </p>
      ),
    },
    {
      title: "Délais",
      body: (
        <p>
          Les articles en stock sont remis à la Poste sous 1 à 3 jours
          ouvrés. Les pièces imprimées à la demande le sont après le délai de
          production indiqué sur la fiche produit (ou dans le devis pour une
          création sur mesure). Ces délais sont indicatifs.
        </p>
      ),
    },
    {
      title: "Frais de port",
      body: (
        <p>
          Tarif unique de <strong>8.90 CHF</strong>, offert dès{" "}
          <strong>60.00 CHF</strong> d'achat. Le montant exact est toujours
          affiché dans le panier avant paiement.
        </p>
      ),
    },
    {
      title: "Suivi de commande",
      body: (
        <p>
          Un numéro de suivi vous est envoyé par e-mail dès l'expédition. Vous
          pouvez aussi suivre une commande à tout moment, avec ou sans
          compte, depuis{" "}
          <Link href="/track" className={link}>
            la page de suivi
          </Link>
          .
        </p>
      ),
    },
    {
      title: "Retours",
      body: (
        <p>
          Le droit suisse ne prévoit pas de droit de rétractation légal pour
          les achats en ligne. Nous acceptons néanmoins, à titre commercial,
          le retour des articles de catalogue dans les{" "}
          <strong>14 jours</strong> suivant la réception, s'ils sont non
          utilisés et dans leur état d'origine. Les frais de retour sont à
          votre charge ; le prix de l'article est remboursé, hors frais
          d'envoi initiaux.
        </p>
      ),
    },
    {
      title: "Articles sur mesure",
      body: (
        <p>
          Les pièces imprimées à partir d'un devis personnalisé sont exclues
          du retour, sauf défaut de fabrication (voir « Garantie »).
        </p>
      ),
    },
    {
      title: "Garantie",
      body: (
        <p>
          La garantie légale suisse (2 ans dès la livraison) couvre tout
          défaut de fabrication — détails dans{" "}
          <Link href="/legal/terms" className={link}>
            les conditions générales
          </Link>
          .
        </p>
      ),
    },
    {
      title: "Une question ?",
      body: (
        <p>
          Notre{" "}
          <Link href="/contact" className={link}>
            équipe répond sous 48 h
          </Link>{" "}
          à toute question sur une livraison ou un retour en cours.
        </p>
      ),
    },
  ],
  de: [
    {
      title: "Liefergebiet",
      body: (
        <p>
          Wir liefern ausschliesslich in die <strong>Schweiz</strong>, per
          Schweizerischer Post.
        </p>
      ),
    },
    {
      title: "Lieferfristen",
      body: (
        <p>
          Lagerartikel werden innerhalb von 1 bis 3 Werktagen der Post
          übergeben. Auf Bestellung gedruckte Stücke werden nach der auf der
          Produktseite (oder in der Offerte für Massanfertigungen)
          angegebenen Produktionszeit versandt. Diese Fristen sind
          unverbindlich.
        </p>
      ),
    },
    {
      title: "Versandkosten",
      body: (
        <p>
          Einheitstarif von <strong>8.90 CHF</strong>, gratis ab{" "}
          <strong>60.00 CHF</strong> Einkaufswert. Der genaue Betrag wird vor
          der Zahlung im Warenkorb angezeigt.
        </p>
      ),
    },
    {
      title: "Sendungsverfolgung",
      body: (
        <p>
          Sie erhalten eine Sendungsnummer per E-Mail, sobald Ihre Bestellung
          versandt wurde. Sie können eine Bestellung jederzeit — mit oder
          ohne Konto — auf der{" "}
          <Link href="/track" className={link}>
            Sendungsverfolgungsseite
          </Link>{" "}
          nachverfolgen.
        </p>
      ),
    },
    {
      title: "Rücksendungen",
      body: (
        <p>
          Das Schweizer Recht sieht kein gesetzliches Widerrufsrecht für
          Online-Käufe vor. Wir akzeptieren jedoch kulanzhalber die Rückgabe
          von Katalogartikeln innerhalb von <strong>14 Tagen</strong> nach
          Erhalt, sofern diese unbenutzt und im Originalzustand sind. Die
          Rücksendekosten trägt der Kunde; der Artikelpreis wird ohne die
          ursprünglichen Versandkosten zurückerstattet.
        </p>
      ),
    },
    {
      title: "Massanfertigungen",
      body: (
        <p>
          Nach individueller Offerte gedruckte Stücke sind von der Rückgabe
          ausgeschlossen, ausser bei Herstellungsfehlern (siehe
          „Gewährleistung“).
        </p>
      ),
    },
    {
      title: "Gewährleistung",
      body: (
        <p>
          Die gesetzliche Gewährleistung (2 Jahre ab Lieferung) deckt
          Herstellungsfehler ab — Details in den{" "}
          <Link href="/legal/terms" className={link}>
            Allgemeinen Geschäftsbedingungen
          </Link>
          .
        </p>
      ),
    },
    {
      title: "Eine Frage?",
      body: (
        <p>
          Unser{" "}
          <Link href="/contact" className={link}>
            Team antwortet innerhalb von 48 Std.
          </Link>{" "}
          auf jede Frage zu einer laufenden Lieferung oder Rücksendung.
        </p>
      ),
    },
  ],
  it: [
    {
      title: "Zona di consegna",
      body: (
        <p>
          Consegniamo esclusivamente in <strong>Svizzera</strong>, tramite la
          Posta svizzera.
        </p>
      ),
    },
    {
      title: "Tempi di consegna",
      body: (
        <p>
          Gli articoli disponibili vengono consegnati alla Posta entro 1-3
          giorni lavorativi. I pezzi stampati su richiesta vengono spediti
          dopo il tempo di produzione indicato sulla scheda prodotto (o nel
          preventivo per le creazioni su misura). Questi tempi sono
          indicativi.
        </p>
      ),
    },
    {
      title: "Spese di spedizione",
      body: (
        <p>
          Tariffa unica di <strong>8.90 CHF</strong>, gratuita a partire da{" "}
          <strong>60.00 CHF</strong> di acquisto. L'importo esatto è sempre
          indicato nel carrello prima del pagamento.
        </p>
      ),
    },
    {
      title: "Tracciamento dell'ordine",
      body: (
        <p>
          Un numero di tracciamento vi viene inviato via e-mail al momento
          della spedizione. Potete anche tracciare un ordine in qualsiasi
          momento, con o senza account, dalla{" "}
          <Link href="/track" className={link}>
            pagina di tracciamento
          </Link>
          .
        </p>
      ),
    },
    {
      title: "Resi",
      body: (
        <p>
          Il diritto svizzero non prevede un diritto di recesso legale per
          gli acquisti online. Accettiamo comunque, a titolo commerciale, il
          reso degli articoli di catalogo entro <strong>14 giorni</strong>{" "}
          dal ricevimento, se non utilizzati e nel loro stato originale. Le
          spese di reso sono a carico del cliente; il prezzo dell'articolo
          viene rimborsato, escluse le spese di spedizione iniziali.
        </p>
      ),
    },
    {
      title: "Articoli su misura",
      body: (
        <p>
          I pezzi stampati da un preventivo personalizzato sono esclusi dal
          reso, salvo difetto di fabbricazione (vedi "Garanzia").
        </p>
      ),
    },
    {
      title: "Garanzia",
      body: (
        <p>
          La garanzia legale svizzera (2 anni dalla consegna) copre ogni
          difetto di fabbricazione — dettagli nelle{" "}
          <Link href="/legal/terms" className={link}>
            condizioni generali
          </Link>
          .
        </p>
      ),
    },
    {
      title: "Una domanda?",
      body: (
        <p>
          Il nostro{" "}
          <Link href="/contact" className={link}>
            team risponde entro 48 h
          </Link>{" "}
          a qualsiasi domanda su una consegna o un reso in corso.
        </p>
      ),
    },
  ],
  en: [
    {
      title: "Delivery area",
      body: (
        <p>
          We ship exclusively within <strong>Switzerland</strong>, via Swiss
          Post.
        </p>
      ),
    },
    {
      title: "Timelines",
      body: (
        <p>
          In-stock items are handed to Swiss Post within 1 to 3 business
          days. Made-to-order pieces ship after the production time shown on
          the product page (or in the quote for custom work). These
          timelines are indicative.
        </p>
      ),
    },
    {
      title: "Shipping cost",
      body: (
        <p>
          Flat rate of <strong>CHF 8.90</strong>, free from{" "}
          <strong>CHF 60.00</strong> of purchase. The exact amount is always
          shown in the cart before payment.
        </p>
      ),
    },
    {
      title: "Order tracking",
      body: (
        <p>
          You'll receive a tracking number by e-mail as soon as your order
          ships. You can also track an order at any time, with or without an
          account, from the{" "}
          <Link href="/track" className={link}>
            tracking page
          </Link>
          .
        </p>
      ),
    },
    {
      title: "Returns",
      body: (
        <p>
          Swiss law does not provide for a statutory right of withdrawal for
          online purchases. As a commercial courtesy, we accept returns of
          catalog items within <strong>14 days</strong> of receipt, provided
          they are unused and in original condition. Return shipping is at
          your expense; the item price is refunded, excluding the original
          shipping cost.
        </p>
      ),
    },
    {
      title: "Custom pieces",
      body: (
        <p>
          Pieces printed from a personalized quote are excluded from
          returns, except for manufacturing defects (see "Warranty").
        </p>
      ),
    },
    {
      title: "Warranty",
      body: (
        <p>
          The Swiss statutory warranty (2 years from delivery) covers
          manufacturing defects — details in the{" "}
          <Link href="/legal/terms" className={link}>
            terms and conditions
          </Link>
          .
        </p>
      ),
    },
    {
      title: "A question?",
      body: (
        <p>
          Our{" "}
          <Link href="/contact" className={link}>
            team replies within 48 h
          </Link>{" "}
          to any question about an ongoing delivery or return.
        </p>
      ),
    },
  ],
};
