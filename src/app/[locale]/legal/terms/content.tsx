import type { Locale } from "@/i18n/routing";
import type { LegalSection } from "../legal-layout";

// CGV dans les 4 langues. Seule la version française fait foi (mention
// affichée par LegalPage) ; les traductions suivent la terminologie
// juridique suisse usuelle (AGB/OR, CGV/CO, GTC).

export const TERMS_CONTENT: Record<Locale, LegalSection[]> = {
  fr: [
    {
      title: "Champ d’application",
      body: (
        <p>
          Les présentes conditions générales de vente (« CGV ») régissent les
          commandes passées sur la boutique en ligne <strong>swiss3design.ch</strong>,
          exploitée par <strong>Swiss3Design, Thomas Prud’homme, Chemin de
          l’Aubépine 9B, 1196 Gland (Vaud), Suisse</strong> (« l’exploitant »),
          joignable à l’adresse contact@swiss3design.ch. En passant commande,
          le client accepte les présentes CGV dans leur version en vigueur au
          moment de la commande.
        </p>
      ),
    },
    {
      title: "Produits",
      body: (
        <p>
          Les articles proposés sont des objets fabriqués artisanalement par
          impression 3D, à l’unité ou en petite série. De légères variations de
          teinte, de texture ou d’aspect (notamment les lignes de couches
          propres au procédé) peuvent exister d’un exemplaire à l’autre et ne
          constituent pas un défaut. Les photographies sont aussi fidèles que
          possible mais non contractuelles.
        </p>
      ),
    },
    {
      title: "Prix",
      body: (
        <p>
          Les prix s’entendent en francs suisses (CHF). L’exploitant n’est pas
          assujetti à la TVA (art. 10 LTVA) ; aucune TVA n’est facturée. Les
          frais de livraison sont indiqués avant la confirmation de paiement.
        </p>
      ),
    },
    {
      title: "Commande et conclusion du contrat",
      body: (
        <p>
          La présentation des produits ne constitue pas une offre liante. La
          commande du client vaut offre d’achat ; le contrat est conclu au
          moment de la confirmation du paiement, attestée par l’e-mail de
          confirmation de commande. L’exploitant se réserve le droit de refuser
          une commande, notamment en cas d’indisponibilité ou d’erreur
          manifeste de prix ; les montants déjà perçus sont alors remboursés.
        </p>
      ),
    },
    {
      title: "Paiement",
      body: (
        <p>
          Le paiement s’effectue en ligne via le prestataire Stripe (carte de
          crédit/débit, TWINT, Apple Pay, Google Pay). L’exploitant n’a jamais
          accès aux données de carte et ne les stocke pas.
        </p>
      ),
    },
    {
      title: "Livraison",
      body: (
        <p>
          La livraison est effectuée <strong>en Suisse uniquement</strong>, par
          la Poste suisse. Les produits en stock sont remis à la Poste sous 1 à
          3 jours ouvrés ; les produits imprimés à la demande le sont après le
          délai de production indiqué sur la fiche produit. Les frais de port
          et le seuil de livraison offerte applicables sont affichés dans le
          panier. Les délais de livraison sont indicatifs ; un retard ne donne
          pas droit à des dommages-intérêts.
        </p>
      ),
    },
    {
      title: "Impressions sur mesure (devis)",
      body: (
        <p>
          Les prestations personnalisées (fichiers fournis par le client ou
          projets spécifiques) font l’objet d’un devis. Le contrat est conclu à
          l’acceptation du devis et au paiement. Les articles personnalisés ne
          sont ni repris ni échangés (ch. 8). Le client garantit détenir les
          droits sur les fichiers transmis et que leur impression ne viole
          aucun droit de tiers ni aucune disposition légale ; l’exploitant peut
          refuser tout fichier sans justification.
        </p>
      ),
    },
    {
      title: "Retours",
      body: (
        <p>
          Le droit suisse ne prévoit pas de droit de rétractation légal pour
          les achats en ligne. À titre commercial, l’exploitant accepte le
          retour des articles de catalogue (non personnalisés) dans les
          14 jours suivant la réception, à condition qu’ils soient non
          utilisés et dans leur état d’origine. Les frais de retour sont à la
          charge du client ; le prix des articles est remboursé, hors frais
          d’envoi initiaux. Les articles sur mesure sont exclus du retour.
        </p>
      ),
    },
    {
      title: "Garantie",
      body: (
        <p>
          La garantie légale pour les défauts de la chose vendue
          (art. 197 ss CO) s’applique pendant deux ans dès la livraison. Le
          client signale tout défaut dans les meilleurs délais à
          contact@swiss3design.ch, photos à l’appui. L’exploitant procède, à
          son choix, à la réparation, au remplacement ou au remboursement.
        </p>
      ),
    },
    {
      title: "Responsabilité",
      body: (
        <p>
          Sauf faute grave ou intentionnelle, la responsabilité de l’exploitant
          est limitée au dommage direct et prouvé, à concurrence du montant de
          la commande concernée. Sauf indication contraire expresse, les
          objets imprimés en 3D ne sont pas destinés à un usage de sécurité,
          au contact alimentaire prolongé, ni à un usage médical, et ne sont
          pas des jouets pour enfants de moins de 3 ans.
        </p>
      ),
    },
    {
      title: "Droit applicable et for",
      body: (
        <p>
          Les présentes CGV sont soumises au droit suisse. Le for est à
          Nyon (VD), sous réserve des fors impératifs prévus par la loi.
        </p>
      ),
    },
  ],

  de: [
    {
      title: "Geltungsbereich",
      body: (
        <p>
          Die vorliegenden Allgemeinen Geschäftsbedingungen («AGB») gelten für
          Bestellungen im Online-Shop <strong>swiss3design.ch</strong>,
          betrieben von <strong>Swiss3Design, Thomas Prud’homme, Chemin de
          l’Aubépine 9B, 1196 Gland (Waadt), Schweiz</strong> («der
          Betreiber»), erreichbar unter contact@swiss3design.ch. Mit der
          Bestellung akzeptiert der Kunde diese AGB in der zum Zeitpunkt der
          Bestellung gültigen Fassung.
        </p>
      ),
    },
    {
      title: "Produkte",
      body: (
        <p>
          Bei den angebotenen Artikeln handelt es sich um handwerklich im
          3D-Druck gefertigte Objekte, als Einzelstücke oder in Kleinserie.
          Leichte Abweichungen in Farbton, Textur oder Erscheinungsbild
          (insbesondere die verfahrensbedingten Schichtlinien) können von
          Exemplar zu Exemplar auftreten und stellen keinen Mangel dar. Die
          Fotos sind so originalgetreu wie möglich, jedoch unverbindlich.
        </p>
      ),
    },
    {
      title: "Preise",
      body: (
        <p>
          Alle Preise verstehen sich in Schweizer Franken (CHF). Der Betreiber
          ist nicht mehrwertsteuerpflichtig (Art. 10 MWSTG); es wird keine
          Mehrwertsteuer erhoben. Die Versandkosten werden vor der
          Zahlungsbestätigung ausgewiesen.
        </p>
      ),
    },
    {
      title: "Bestellung und Vertragsabschluss",
      body: (
        <p>
          Die Präsentation der Produkte stellt kein verbindliches Angebot dar.
          Die Bestellung des Kunden gilt als Kaufangebot; der Vertrag kommt
          mit der Zahlungsbestätigung zustande, die durch die
          Bestellbestätigung per E-Mail belegt wird. Der Betreiber behält sich
          vor, eine Bestellung abzulehnen, insbesondere bei Nichtverfügbarkeit
          oder offensichtlichem Preisfehler; bereits bezahlte Beträge werden
          in diesem Fall zurückerstattet.
        </p>
      ),
    },
    {
      title: "Zahlung",
      body: (
        <p>
          Die Zahlung erfolgt online über den Zahlungsdienstleister Stripe
          (Kredit-/Debitkarte, TWINT, Apple Pay, Google Pay). Der Betreiber
          hat zu keinem Zeitpunkt Zugriff auf Kartendaten und speichert diese
          nicht.
        </p>
      ),
    },
    {
      title: "Lieferung",
      body: (
        <p>
          Die Lieferung erfolgt <strong>ausschliesslich innerhalb der
          Schweiz</strong> durch die Schweizerische Post. Lagerartikel werden
          innert 1 bis 3 Werktagen der Post übergeben; auf Bestellung
          gedruckte Artikel nach Ablauf der auf der Produktseite angegebenen
          Produktionszeit. Die anwendbaren Versandkosten und die Schwelle für
          den Gratisversand werden im Warenkorb angezeigt. Lieferfristen sind
          unverbindlich; eine Verzögerung begründet keinen Anspruch auf
          Schadenersatz.
        </p>
      ),
    },
    {
      title: "Massanfertigungen (Offerten)",
      body: (
        <p>
          Individuelle Leistungen (vom Kunden gelieferte Dateien oder
          spezifische Projekte) erfolgen auf der Grundlage einer Offerte. Der
          Vertrag kommt mit der Annahme der Offerte und der Zahlung zustande.
          Personalisierte Artikel werden weder zurückgenommen noch umgetauscht
          (Ziff. 8). Der Kunde gewährleistet, dass er über die Rechte an den
          übermittelten Dateien verfügt und deren Druck weder Rechte Dritter
          noch gesetzliche Bestimmungen verletzt; der Betreiber kann jede
          Datei ohne Begründung ablehnen.
        </p>
      ),
    },
    {
      title: "Rücksendungen",
      body: (
        <p>
          Das schweizerische Recht sieht für Online-Käufe kein gesetzliches
          Widerrufsrecht vor. Aus Kulanz akzeptiert der Betreiber die
          Rücksendung von Katalogartikeln (nicht personalisiert) innert
          14 Tagen nach Erhalt, sofern diese unbenutzt und im Originalzustand
          sind. Die Rücksendekosten trägt der Kunde; der Preis der Artikel
          wird zurückerstattet, ohne die ursprünglichen Versandkosten.
          Massanfertigungen sind von der Rückgabe ausgeschlossen.
        </p>
      ),
    },
    {
      title: "Gewährleistung",
      body: (
        <p>
          Es gilt die gesetzliche Gewährleistung für Mängel der Kaufsache
          (Art. 197 ff. OR) während zwei Jahren ab Lieferung. Der Kunde meldet
          jeden Mangel so rasch wie möglich an contact@swiss3design.ch, mit
          Fotos als Beleg. Der Betreiber leistet nach seiner Wahl
          Nachbesserung, Ersatz oder Rückerstattung.
        </p>
      ),
    },
    {
      title: "Haftung",
      body: (
        <p>
          Vorbehältlich grober Fahrlässigkeit oder Vorsatzes ist die Haftung
          des Betreibers auf den direkten und nachgewiesenen Schaden
          beschränkt, höchstens jedoch auf den Betrag der betreffenden
          Bestellung. Sofern nicht ausdrücklich anders angegeben, sind
          3D-gedruckte Objekte weder für sicherheitsrelevante Anwendungen noch
          für längeren Lebensmittelkontakt oder medizinische Zwecke bestimmt
          und sind kein Spielzeug für Kinder unter 3 Jahren.
        </p>
      ),
    },
    {
      title: "Anwendbares Recht und Gerichtsstand",
      body: (
        <p>
          Diese AGB unterstehen schweizerischem Recht. Gerichtsstand ist
          Nyon (VD), unter Vorbehalt zwingender gesetzlicher Gerichtsstände.
        </p>
      ),
    },
  ],

  it: [
    {
      title: "Campo di applicazione",
      body: (
        <p>
          Le presenti condizioni generali di vendita («CGV») disciplinano gli
          ordini effettuati sul negozio online <strong>swiss3design.ch</strong>,
          gestito da <strong>Swiss3Design, Thomas Prud’homme, Chemin de
          l’Aubépine 9B, 1196 Gland (Vaud), Svizzera</strong> («il gestore»),
          raggiungibile all’indirizzo contact@swiss3design.ch. Effettuando un
          ordine, il cliente accetta le presenti CGV nella versione in vigore
          al momento dell’ordine.
        </p>
      ),
    },
    {
      title: "Prodotti",
      body: (
        <p>
          Gli articoli proposti sono oggetti realizzati artigianalmente
          mediante stampa 3D, in pezzi unici o in piccola serie. Da un
          esemplare all’altro possono esistere lievi variazioni di tonalità,
          texture o aspetto (in particolare le linee degli strati proprie del
          procedimento), che non costituiscono un difetto. Le fotografie sono
          il più fedeli possibile ma non contrattuali.
        </p>
      ),
    },
    {
      title: "Prezzi",
      body: (
        <p>
          I prezzi si intendono in franchi svizzeri (CHF). Il gestore non è
          assoggettato all’IVA (art. 10 LIVA); non viene fatturata alcuna IVA.
          Le spese di consegna sono indicate prima della conferma del
          pagamento.
        </p>
      ),
    },
    {
      title: "Ordine e conclusione del contratto",
      body: (
        <p>
          La presentazione dei prodotti non costituisce un’offerta vincolante.
          L’ordine del cliente vale come offerta d’acquisto; il contratto è
          concluso al momento della conferma del pagamento, attestata
          dall’e-mail di conferma dell’ordine. Il gestore si riserva il
          diritto di rifiutare un ordine, in particolare in caso di
          indisponibilità o di errore manifesto di prezzo; gli importi già
          percepiti vengono in tal caso rimborsati.
        </p>
      ),
    },
    {
      title: "Pagamento",
      body: (
        <p>
          Il pagamento avviene online tramite il prestatore Stripe (carta di
          credito/debito, TWINT, Apple Pay, Google Pay). Il gestore non ha mai
          accesso ai dati della carta e non li memorizza.
        </p>
      ),
    },
    {
      title: "Consegna",
      body: (
        <p>
          La consegna avviene <strong>esclusivamente in Svizzera</strong>,
          tramite la Posta svizzera. I prodotti a magazzino vengono affidati
          alla Posta entro 1–3 giorni lavorativi; i prodotti stampati su
          richiesta dopo il tempo di produzione indicato nella scheda
          prodotto. Le spese di spedizione e la soglia per la consegna
          gratuita applicabili sono visualizzate nel carrello. I termini di
          consegna sono indicativi; un ritardo non dà diritto a risarcimento
          danni.
        </p>
      ),
    },
    {
      title: "Stampe su misura (preventivi)",
      body: (
        <p>
          Le prestazioni personalizzate (file forniti dal cliente o progetti
          specifici) sono oggetto di un preventivo. Il contratto è concluso
          all’accettazione del preventivo e al pagamento. Gli articoli
          personalizzati non vengono né ripresi né cambiati (punto 8). Il
          cliente garantisce di detenere i diritti sui file trasmessi e che la
          loro stampa non viola alcun diritto di terzi né alcuna disposizione
          legale; il gestore può rifiutare qualsiasi file senza
          giustificazione.
        </p>
      ),
    },
    {
      title: "Resi",
      body: (
        <p>
          Il diritto svizzero non prevede un diritto di recesso legale per gli
          acquisti online. A titolo commerciale, il gestore accetta il reso
          degli articoli di catalogo (non personalizzati) entro 14 giorni dal
          ricevimento, a condizione che siano inutilizzati e nel loro stato
          originale. Le spese di reso sono a carico del cliente; il prezzo
          degli articoli viene rimborsato, escluse le spese di spedizione
          iniziali. Gli articoli su misura sono esclusi dal reso.
        </p>
      ),
    },
    {
      title: "Garanzia",
      body: (
        <p>
          La garanzia legale per i difetti della cosa venduta
          (art. 197 segg. CO) si applica per due anni dalla consegna. Il
          cliente segnala qualsiasi difetto il prima possibile a
          contact@swiss3design.ch, allegando fotografie. Il gestore procede, a
          sua scelta, alla riparazione, alla sostituzione o al rimborso.
        </p>
      ),
    },
    {
      title: "Responsabilità",
      body: (
        <p>
          Salvo colpa grave o dolo, la responsabilità del gestore è limitata
          al danno diretto e provato, fino a concorrenza dell’importo
          dell’ordine interessato. Salvo indicazione contraria espressa, gli
          oggetti stampati in 3D non sono destinati a un uso di sicurezza, al
          contatto alimentare prolungato né a un uso medico, e non sono
          giocattoli per bambini di età inferiore a 3 anni.
        </p>
      ),
    },
    {
      title: "Diritto applicabile e foro",
      body: (
        <p>
          Le presenti CGV sono soggette al diritto svizzero. Il foro è
          Nyon (VD), fatti salvi i fori imperativi previsti dalla legge.
        </p>
      ),
    },
  ],

  en: [
    {
      title: "Scope",
      body: (
        <p>
          These general terms and conditions of sale (“GTC”) govern orders
          placed on the online shop <strong>swiss3design.ch</strong>, operated
          by <strong>Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B,
          1196 Gland (Vaud), Switzerland</strong> (the “Operator”), reachable
          at contact@swiss3design.ch. By placing an order, the customer
          accepts these GTC in the version in force at the time of the order.
        </p>
      ),
    },
    {
      title: "Products",
      body: (
        <p>
          The items offered are objects crafted by 3D printing, individually
          or in small series. Slight variations in colour, texture or
          appearance (in particular the layer lines inherent to the process)
          may exist from one piece to another and do not constitute a defect.
          Photographs are as faithful as possible but not contractually
          binding.
        </p>
      ),
    },
    {
      title: "Prices",
      body: (
        <p>
          All prices are in Swiss francs (CHF). The Operator is not subject to
          VAT (Art. 10 of the Swiss VAT Act); no VAT is charged. Shipping
          costs are shown before payment confirmation.
        </p>
      ),
    },
    {
      title: "Ordering and conclusion of the contract",
      body: (
        <p>
          The presentation of products does not constitute a binding offer.
          The customer’s order constitutes an offer to purchase; the contract
          is concluded upon confirmation of payment, evidenced by the order
          confirmation e-mail. The Operator reserves the right to refuse an
          order, in particular in the event of unavailability or an obvious
          pricing error; any amounts already received will then be refunded.
        </p>
      ),
    },
    {
      title: "Payment",
      body: (
        <p>
          Payment is made online via the payment provider Stripe
          (credit/debit card, TWINT, Apple Pay, Google Pay). The Operator
          never has access to card data and does not store it.
        </p>
      ),
    },
    {
      title: "Delivery",
      body: (
        <p>
          Delivery is made <strong>within Switzerland only</strong>, by Swiss
          Post. In-stock products are handed over to the post within 1 to 3
          business days; made-to-order products after the production time
          indicated on the product page. The applicable shipping costs and
          free-shipping threshold are shown in the cart. Delivery times are
          indicative; a delay does not give rise to any claim for damages.
        </p>
      ),
    },
    {
      title: "Custom prints (quotes)",
      body: (
        <p>
          Customised services (files supplied by the customer or specific
          projects) are subject to a quote. The contract is concluded upon
          acceptance of the quote and payment. Customised items can be neither
          returned nor exchanged (sec. 8). The customer warrants that they
          hold the rights to the files submitted and that printing them does
          not infringe any third-party rights or legal provisions; the
          Operator may refuse any file without justification.
        </p>
      ),
    },
    {
      title: "Returns",
      body: (
        <p>
          Swiss law does not provide for a statutory right of withdrawal for
          online purchases. As a commercial gesture, the Operator accepts
          returns of catalogue items (non-customised) within 14 days of
          receipt, provided they are unused and in their original condition.
          Return costs are borne by the customer; the price of the items is
          refunded, excluding the initial shipping costs. Custom-made items
          are excluded from returns.
        </p>
      ),
    },
    {
      title: "Warranty",
      body: (
        <p>
          The statutory warranty for defects in the goods sold (Art. 197 et
          seq. of the Swiss Code of Obligations) applies for two years from
          delivery. The customer shall report any defect as soon as possible
          to contact@swiss3design.ch, with supporting photos. The Operator
          will, at its discretion, repair, replace or refund.
        </p>
      ),
    },
    {
      title: "Liability",
      body: (
        <p>
          Except in cases of gross negligence or wilful misconduct, the
          Operator’s liability is limited to direct and proven damage, up to
          the amount of the order concerned. Unless expressly stated
          otherwise, 3D-printed objects are not intended for safety-related
          use, prolonged food contact or medical use, and are not toys for
          children under 3 years of age.
        </p>
      ),
    },
    {
      title: "Governing law and jurisdiction",
      body: (
        <p>
          These GTC are governed by Swiss law. The place of jurisdiction is
          Nyon (VD), subject to mandatory statutory jurisdictions.
        </p>
      ),
    },
  ],
};
