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
          commandes passées sur la boutique en ligne{" "}
          <strong>swiss3design.ch</strong>, exploitée par{" "}
          <strong>
            Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
            (Vaud), Suisse
          </strong>{" "}
          (« l’exploitant »), joignable à l’adresse contact@swiss3design.ch. En
          passant commande, le client accepte les présentes CGV dans leur
          version en vigueur au moment de la commande. Le client confirme être
          majeur ou agir avec l’accord de son représentant légal.
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
          possible mais non contractuelles. En cas d’indisponibilité
          temporaire d’une couleur ou d’une matière indiquée sur la fiche
          produit, l’exploitant peut proposer une alternative équivalente ; à
          défaut d’accord du client, la commande concernée est annulée et
          intégralement remboursée.
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
          une commande, notamment en cas d’indisponibilité ou d’erreur manifeste
          de prix ; les montants déjà perçus sont alors remboursés.
        </p>
      ),
    },
    {
      title: "Paiement",
      body: (
        <p>
          Le paiement s’effectue en ligne via le prestataire Stripe (carte de
          crédit/débit, TWINT, Google Pay), y compris via Stripe Link pour
          réutiliser une carte déjà enregistrée. L’exploitant n’a jamais accès
          aux données de carte et ne les stocke pas.
        </p>
      ),
    },
    {
      title: "Litiges de paiement",
      body: (
        <p>
          En cas de désaccord sur une commande, le client est invité à
          contacter l’exploitant à contact@swiss3design.ch avant toute
          contestation directe auprès de sa banque ou de Stripe. Une
          contestation de paiement (« chargeback ») manifestement infondée —
          notamment pour une commande livrée et conforme, preuve de suivi à
          l’appui — peut entraîner la suspension du compte concerné et la
          facturation des frais qu’elle engendre (frais de contestation du
          prestataire de paiement, frais de recouvrement), sans préjudice
          d’une action en justice.
        </p>
      ),
    },
    {
      title: "Comptes clients",
      body: (
        <p>
          L’exploitant peut suspendre ou clôturer un compte client en cas de
          fraude avérée ou suspectée, de non-respect des présentes CGV, de
          comportement abusif envers l’exploitant ou son personnel, ou de
          contestations de paiement infondées répétées. Le client en est
          informé par e-mail, avec le motif, sauf si cela compromettrait une
          procédure en cours. Les commandes déjà payées et non litigieuses
          restent honorées.
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
          délai de production indiqué sur la fiche produit. Les frais de port et
          le seuil de livraison offerte applicables sont affichés dans le
          panier. Les délais de livraison sont indicatifs ; un retard ne donne
          pas droit à des dommages-intérêts. Le risque de perte ou de dommage
          pendant le transport est supporté par l’exploitant jusqu’à la remise
          du produit au client.
        </p>
      ),
    },
    {
      title: "Impressions sur mesure (devis)",
      body: (
        <p>
          Les prestations personnalisées (fichiers fournis par le client ou
          projets spécifiques) font l’objet d’un devis. Le contrat est conclu à
          l’acceptation du devis et au paiement. La production démarre dès ce
          paiement ; passé ce stade, la commande ne peut plus être annulée ni
          modifiée. Les articles personnalisés ne sont ni repris ni échangés
          (voir « Retours »). Le client garantit
          détenir les droits sur les fichiers transmis et que leur impression ne
          viole aucun droit de tiers ni aucune disposition légale ; l’exploitant
          peut refuser tout fichier sans justification. Le client indemnise
          l’exploitant contre toute prétention de tiers découlant de ses
          fichiers. Sont notamment exclus les fichiers d’armes ou de pièces
          d’armes, de contrefaçons et de tout objet illicite.
        </p>
      ),
    },
    {
      title: "Retours",
      body: (
        <p>
          Le droit suisse ne prévoit pas de droit de rétractation légal pour les
          achats en ligne. À titre commercial, l’exploitant accepte le retour
          des articles de catalogue (non personnalisés) dans les 14 jours
          suivant la réception, à condition qu’ils soient non utilisés et dans
          leur état d’origine. Les frais de retour sont à la charge du client ;
          le prix des articles est remboursé, hors frais d’envoi initiaux. Les
          articles sur mesure sont exclus du retour.
        </p>
      ),
    },
    {
      title: "Garantie",
      body: (
        <p>
          La garantie légale pour les défauts de la chose vendue (art. 197 ss
          CO) s’applique pendant deux ans dès la livraison. Le client signale
          tout défaut dans les meilleurs délais à contact@swiss3design.ch,
          photos à l’appui. L’exploitant propose en priorité la réparation ou le
          remplacement ; si cela s’avère impossible ou disproportionné, le
          client conserve ses droits légaux (réduction du prix ou
          remboursement).
        </p>
      ),
    },
    {
      title: "Avis clients",
      body: (
        <p>
          Un avis ne peut porter que sur un achat effectivement réalisé et
          livré. L’exploitant modère les avis avant publication et peut
          refuser ou retirer, sans justification préalable, tout avis
          mensonger, diffamatoire, injurieux ou manifestement rédigé de
          mauvaise foi. Un avis négatif fondé, respectueux et en lien avec le
          produit ou le service n’est jamais retiré au seul motif qu’il est
          défavorable.
        </p>
      ),
    },
    {
      title: "Responsabilité",
      body: (
        <p>
          Sauf faute grave ou intentionnelle, la responsabilité de l’exploitant
          est limitée au dommage direct et prouvé, à concurrence du montant de
          la commande concernée. Tout dommage indirect, perte de profit, perte
          de données ou dommage consécutif est exclu dans la même mesure. Sauf
          indication contraire expresse, les objets
          imprimés en 3D ne sont pas destinés à un usage de sécurité, au contact
          alimentaire prolongé, ni à un usage médical, et ne sont pas des jouets
          pour enfants de moins de 3 ans. Les limitations qui précèdent ne
          s’appliquent pas dans les cas où la loi exclut toute limitation,
          notamment en cas de dommages corporels ou au titre de la loi fédérale
          sur la responsabilité du fait des produits (LRFP).
        </p>
      ),
    },
    {
      title: "Propriété intellectuelle",
      body: (
        <p>
          Les contenus du site (textes, photographies, mise en page, identité
          visuelle et logo Swiss3Design) sont protégés et ne peuvent être
          reproduits sans autorisation. La vente porte sur un objet physique :
          elle ne confère au client aucun droit sur les modèles 3D numériques
          sous-jacents, ni aucune licence de reproduction, de réédition ou de
          revente en série. Les droits de propriété intellectuelle relatifs aux
          modèles imprimés demeurent réservés à leurs titulaires respectifs.
        </p>
      ),
    },
    {
      title: "Force majeure",
      body: (
        <p>
          L’exploitant n’est pas responsable des retards ou empêchements
          résultant de circonstances échappant à son contrôle raisonnable (force
          majeure, défaillance d’un fournisseur ou du transporteur, interruption
          technique, etc.). Les délais concernés sont suspendus pour la durée de
          l’événement.
        </p>
      ),
    },
    {
      title: "Divisibilité",
      body: (
        <p>
          Si une disposition des présentes CGV est nulle ou inapplicable, les
          autres dispositions demeurent valables ; la disposition concernée est
          remplacée par une règle valable dont l’effet se rapproche le plus de
          l’intention initiale.
        </p>
      ),
    },
    {
      title: "Droit applicable et for",
      body: (
        <p>
          Les présentes CGV sont soumises au droit suisse. Le for est à Nyon
          (VD), sous réserve des fors impératifs prévus par la loi.
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
          betrieben von{" "}
          <strong>
            Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
            (Waadt), Schweiz
          </strong>{" "}
          («der Betreiber»), erreichbar unter contact@swiss3design.ch. Mit der
          Bestellung akzeptiert der Kunde diese AGB in der zum Zeitpunkt der
          Bestellung gültigen Fassung. Der Kunde bestätigt, volljährig zu sein
          oder mit Zustimmung seiner gesetzlichen Vertretung zu handeln.
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
          Fotos sind so originalgetreu wie möglich, jedoch unverbindlich. Bei
          vorübergehender Nichtverfügbarkeit einer auf der Produktseite
          angegebenen Farbe oder eines Materials kann der Betreiber eine
          gleichwertige Alternative vorschlagen; kommt keine Einigung mit dem
          Kunden zustande, wird die betreffende Bestellung storniert und
          vollständig zurückerstattet.
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
          Die Bestellung des Kunden gilt als Kaufangebot; der Vertrag kommt mit
          der Zahlungsbestätigung zustande, die durch die Bestellbestätigung per
          E-Mail belegt wird. Der Betreiber behält sich vor, eine Bestellung
          abzulehnen, insbesondere bei Nichtverfügbarkeit oder offensichtlichem
          Preisfehler; bereits bezahlte Beträge werden in diesem Fall
          zurückerstattet.
        </p>
      ),
    },
    {
      title: "Zahlung",
      body: (
        <p>
          Die Zahlung erfolgt online über den Zahlungsdienstleister Stripe
          (Kredit-/Debitkarte, TWINT, Google Pay), einschliesslich Stripe Link
          zur Wiederverwendung einer bereits gespeicherten Karte. Der Betreiber
          hat zu keinem Zeitpunkt Zugriff auf Kartendaten und speichert diese
          nicht.
        </p>
      ),
    },
    {
      title: "Zahlungsstreitigkeiten",
      body: (
        <p>
          Bei Unstimmigkeiten zu einer Bestellung wird der Kunde gebeten, den
          Betreiber unter contact@swiss3design.ch zu kontaktieren, bevor er
          sich direkt an seine Bank oder Stripe wendet. Eine offensichtlich
          unbegründete Zahlungsanfechtung («Chargeback») — insbesondere bei
          einer nachweislich gelieferten und vertragsgemässen Bestellung, belegt
          durch die Sendungsverfolgung — kann zur Sperrung des betroffenen
          Kontos sowie zur Verrechnung der dadurch entstehenden Kosten führen
          (Anfechtungsgebühren des Zahlungsdienstleisters, Inkassokosten),
          unbeschadet einer gerichtlichen Geltendmachung.
        </p>
      ),
    },
    {
      title: "Kundenkonten",
      body: (
        <p>
          Der Betreiber kann ein Kundenkonto bei erwiesenem oder vermutetem
          Betrug, Nichteinhaltung dieser AGB, missbräuchlichem Verhalten
          gegenüber dem Betreiber oder seinem Personal oder wiederholten
          unbegründeten Zahlungsanfechtungen sperren oder schliessen. Der Kunde
          wird per E-Mail über den Grund informiert, sofern dies kein laufendes
          Verfahren gefährdet. Bereits bezahlte und unbestrittene Bestellungen
          bleiben davon unberührt.
        </p>
      ),
    },
    {
      title: "Lieferung",
      body: (
        <p>
          Die Lieferung erfolgt{" "}
          <strong>ausschliesslich innerhalb der Schweiz</strong> durch die
          Schweizerische Post. Lagerartikel werden innert 1 bis 3 Werktagen der
          Post übergeben; auf Bestellung gedruckte Artikel nach Ablauf der auf
          der Produktseite angegebenen Produktionszeit. Die anwendbaren
          Versandkosten und die Schwelle für den Gratisversand werden im
          Warenkorb angezeigt. Lieferfristen sind unverbindlich; eine
          Verzögerung begründet keinen Anspruch auf Schadenersatz. Das Risiko
          von Verlust oder Beschädigung während des Transports trägt der
          Betreiber bis zur Übergabe des Produkts an den Kunden.
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
          Die Produktion beginnt mit dieser Zahlung; danach kann die
          Bestellung weder storniert noch geändert werden. Personalisierte
          Artikel werden weder zurückgenommen noch umgetauscht (siehe
          «Rücksendungen»). Der Kunde gewährleistet, dass er über die
          Rechte an den übermittelten Dateien verfügt und deren Druck weder
          Rechte Dritter noch gesetzliche Bestimmungen verletzt; der Betreiber
          kann jede Datei ohne Begründung ablehnen. Der Kunde stellt den
          Betreiber von sämtlichen Ansprüchen Dritter frei, die sich aus seinen
          Dateien ergeben. Ausgeschlossen sind insbesondere Dateien von Waffen
          oder Waffenteilen, von Fälschungen sowie von jeglichen
          widerrechtlichen Gegenständen.
        </p>
      ),
    },
    {
      title: "Rücksendungen",
      body: (
        <p>
          Das schweizerische Recht sieht für Online-Käufe kein gesetzliches
          Widerrufsrecht vor. Aus Kulanz akzeptiert der Betreiber die
          Rücksendung von Katalogartikeln (nicht personalisiert) innert 14 Tagen
          nach Erhalt, sofern diese unbenutzt und im Originalzustand sind. Die
          Rücksendekosten trägt der Kunde; der Preis der Artikel wird
          zurückerstattet, ohne die ursprünglichen Versandkosten.
          Massanfertigungen sind von der Rückgabe ausgeschlossen.
        </p>
      ),
    },
    {
      title: "Gewährleistung",
      body: (
        <p>
          Es gilt die gesetzliche Gewährleistung für Mängel der Kaufsache (Art.
          197 ff. OR) während zwei Jahren ab Lieferung. Der Kunde meldet jeden
          Mangel so rasch wie möglich an contact@swiss3design.ch, mit Fotos als
          Beleg. Der Betreiber bietet vorrangig Nachbesserung oder Ersatz an;
          erweist sich dies als unmöglich oder unverhältnismässig, behält der
          Kunde seine gesetzlichen Rechte (Minderung oder Rückerstattung).
        </p>
      ),
    },
    {
      title: "Kundenbewertungen",
      body: (
        <p>
          Eine Bewertung darf sich nur auf einen tatsächlich getätigten und
          gelieferten Kauf beziehen. Der Betreiber prüft Bewertungen vor der
          Veröffentlichung und kann jede unwahre, verleumderische,
          beleidigende oder offensichtlich in böser Absicht verfasste
          Bewertung ohne vorherige Begründung ablehnen oder entfernen. Eine
          begründete, respektvolle und sachbezogene negative Bewertung wird
          niemals allein deshalb entfernt, weil sie ungünstig ausfällt.
        </p>
      ),
    },
    {
      title: "Haftung",
      body: (
        <p>
          Vorbehältlich grober Fahrlässigkeit oder Vorsatzes ist die Haftung des
          Betreibers auf den direkten und nachgewiesenen Schaden beschränkt,
          höchstens jedoch auf den Betrag der betreffenden Bestellung. Jeder
          indirekte Schaden, Gewinnausfall, Datenverlust oder Folgeschaden ist
          im gleichen Umfang ausgeschlossen. Sofern
          nicht ausdrücklich anders angegeben, sind 3D-gedruckte Objekte weder
          für sicherheitsrelevante Anwendungen noch für längeren
          Lebensmittelkontakt oder medizinische Zwecke bestimmt und sind kein
          Spielzeug für Kinder unter 3 Jahren. Die vorstehenden Beschränkungen
          gelten nicht, soweit das Gesetz jegliche Beschränkung ausschliesst,
          insbesondere bei Personenschäden oder nach dem
          Produktehaftpflichtgesetz (PrHG).
        </p>
      ),
    },
    {
      title: "Geistiges Eigentum",
      body: (
        <p>
          Die Inhalte der Website (Texte, Fotografien, Layout, visuelle
          Identität und Logo Swiss3Design) sind geschützt und dürfen ohne
          Genehmigung nicht reproduziert werden. Der Verkauf betrifft einen
          physischen Gegenstand: Er verleiht dem Kunden keinerlei Rechte an den
          zugrunde liegenden digitalen 3D-Modellen und keine Lizenz zur
          Vervielfältigung, Neuauflage oder zum Weiterverkauf in Serie. Die
          Rechte des geistigen Eigentums an den gedruckten Modellen bleiben
          ihren jeweiligen Inhabern vorbehalten.
        </p>
      ),
    },
    {
      title: "Höhere Gewalt",
      body: (
        <p>
          Der Betreiber haftet nicht für Verzögerungen oder Verhinderungen
          infolge von Umständen ausserhalb seiner zumutbaren Kontrolle (höhere
          Gewalt, Ausfall eines Lieferanten oder des Transporteurs, technischer
          Unterbruch usw.). Die betroffenen Fristen werden für die Dauer des
          Ereignisses ausgesetzt.
        </p>
      ),
    },
    {
      title: "Salvatorische Klausel",
      body: (
        <p>
          Ist eine Bestimmung dieser AGB nichtig oder undurchführbar, bleiben
          die übrigen Bestimmungen gültig; die betreffende Bestimmung wird durch
          eine gültige Regelung ersetzt, die der ursprünglichen Absicht
          möglichst nahekommt.
        </p>
      ),
    },
    {
      title: "Anwendbares Recht und Gerichtsstand",
      body: (
        <p>
          Diese AGB unterstehen schweizerischem Recht. Gerichtsstand ist Nyon
          (VD), unter Vorbehalt zwingender gesetzlicher Gerichtsstände.
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
          gestito da{" "}
          <strong>
            Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
            (Vaud), Svizzera
          </strong>{" "}
          («il gestore»), raggiungibile all’indirizzo contact@swiss3design.ch.
          Effettuando un ordine, il cliente accetta le presenti CGV nella
          versione in vigore al momento dell’ordine. Il cliente conferma di
          essere maggiorenne o di agire con il consenso del proprio
          rappresentante legale.
        </p>
      ),
    },
    {
      title: "Prodotti",
      body: (
        <p>
          Gli articoli proposti sono oggetti realizzati artigianalmente mediante
          stampa 3D, in pezzi unici o in piccola serie. Da un esemplare
          all’altro possono esistere lievi variazioni di tonalità, texture o
          aspetto (in particolare le linee degli strati proprie del
          procedimento), che non costituiscono un difetto. Le fotografie sono il
          più fedeli possibile ma non contrattuali. In caso di indisponibilità
          temporanea di un colore o di un materiale indicato sulla scheda
          prodotto, il gestore può proporre un’alternativa equivalente; in
          assenza di accordo con il cliente, l’ordine interessato viene
          annullato e integralmente rimborsato.
        </p>
      ),
    },
    {
      title: "Prezzi",
      body: (
        <p>
          I prezzi si intendono in franchi svizzeri (CHF). Il gestore non è
          assoggettato all’IVA (art. 10 LIVA); non viene fatturata alcuna IVA.
          Le spese di consegna sono indicate prima della conferma del pagamento.
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
          dall’e-mail di conferma dell’ordine. Il gestore si riserva il diritto
          di rifiutare un ordine, in particolare in caso di indisponibilità o di
          errore manifesto di prezzo; gli importi già percepiti vengono in tal
          caso rimborsati.
        </p>
      ),
    },
    {
      title: "Pagamento",
      body: (
        <p>
          Il pagamento avviene online tramite il prestatore Stripe (carta di
          credito/debito, TWINT, Google Pay), inclusa Stripe Link per
          riutilizzare una carta già registrata. Il gestore non ha mai accesso
          ai dati della carta e non li memorizza.
        </p>
      ),
    },
    {
      title: "Controversie di pagamento",
      body: (
        <p>
          In caso di disaccordo su un ordine, il cliente è invitato a
          contattare il gestore all’indirizzo contact@swiss3design.ch prima di
          qualsiasi contestazione diretta presso la propria banca o Stripe.
          Una contestazione di pagamento («chargeback») manifestamente
          infondata — in particolare per un ordine consegnato e conforme,
          comprovato dal tracciamento — può comportare la sospensione
          dell’account interessato e l’addebito delle spese da essa generate
          (spese di contestazione del prestatore di pagamento, spese di
          recupero crediti), fatta salva un’azione legale.
        </p>
      ),
    },
    {
      title: "Account cliente",
      body: (
        <p>
          Il gestore può sospendere o chiudere un account cliente in caso di
          frode accertata o sospetta, di mancato rispetto delle presenti CGV,
          di comportamento abusivo nei confronti del gestore o del suo
          personale, o di contestazioni di pagamento infondate ripetute. Il
          cliente ne viene informato via e-mail, con la motivazione, salvo che
          ciò comprometta un procedimento in corso. Gli ordini già pagati e
          non contestati restano validi.
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
          richiesta dopo il tempo di produzione indicato nella scheda prodotto.
          Le spese di spedizione e la soglia per la consegna gratuita
          applicabili sono visualizzate nel carrello. I termini di consegna sono
          indicativi; un ritardo non dà diritto a risarcimento danni. Il rischio
          di perdita o danneggiamento durante il trasporto è a carico del
          gestore fino alla consegna del prodotto al cliente.
        </p>
      ),
    },
    {
      title: "Stampe su misura (preventivi)",
      body: (
        <p>
          Le prestazioni personalizzate (file forniti dal cliente o progetti
          specifici) sono oggetto di un preventivo. Il contratto è concluso
          all’accettazione del preventivo e al pagamento. La produzione inizia
          con tale pagamento; superata questa fase, l’ordine non può più
          essere annullato né modificato. Gli articoli personalizzati non
          vengono né ripresi né cambiati (vedere «Resi»). Il
          cliente garantisce di detenere i diritti sui file trasmessi e che la
          loro stampa non viola alcun diritto di terzi né alcuna disposizione
          legale; il gestore può rifiutare qualsiasi file senza giustificazione.
          Il cliente tiene indenne il gestore da qualsiasi pretesa di terzi
          derivante dai suoi file. Sono in particolare esclusi i file di armi o
          di parti di armi, di contraffazioni e di qualsiasi oggetto illecito.
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
          originale. Le spese di reso sono a carico del cliente; il prezzo degli
          articoli viene rimborsato, escluse le spese di spedizione iniziali.
          Gli articoli su misura sono esclusi dal reso.
        </p>
      ),
    },
    {
      title: "Garanzia",
      body: (
        <p>
          La garanzia legale per i difetti della cosa venduta (art. 197 segg.
          CO) si applica per due anni dalla consegna. Il cliente segnala
          qualsiasi difetto il prima possibile a contact@swiss3design.ch,
          allegando fotografie. Il gestore propone in via prioritaria la
          riparazione o la sostituzione; qualora ciò risulti impossibile o
          sproporzionato, il cliente conserva i propri diritti legali (riduzione
          del prezzo o rimborso).
        </p>
      ),
    },
    {
      title: "Recensioni dei clienti",
      body: (
        <p>
          Una recensione può riguardare solo un acquisto effettivamente
          concluso e consegnato. Il gestore modera le recensioni prima della
          pubblicazione e può rifiutare o rimuovere, senza obbligo di
          motivazione preventiva, qualsiasi recensione falsa, diffamatoria,
          ingiuriosa o manifestamente scritta in mala fede. Una recensione
          negativa fondata, rispettosa e pertinente al prodotto o al servizio
          non viene mai rimossa per il solo fatto di essere sfavorevole.
        </p>
      ),
    },
    {
      title: "Responsabilità",
      body: (
        <p>
          Salvo colpa grave o dolo, la responsabilità del gestore è limitata al
          danno diretto e provato, fino a concorrenza dell’importo dell’ordine
          interessato. Qualsiasi danno indiretto, perdita di profitto, perdita
          di dati o danno consequenziale è escluso nella stessa misura. Salvo
          indicazione contraria espressa, gli oggetti
          stampati in 3D non sono destinati a un uso di sicurezza, al contatto
          alimentare prolungato né a un uso medico, e non sono giocattoli per
          bambini di età inferiore a 3 anni. Le limitazioni che precedono non si
          applicano nei casi in cui la legge esclude qualsiasi limitazione, in
          particolare in caso di danni alle persone o ai sensi della legge sulla
          responsabilità per danno da prodotti (LRDP).
        </p>
      ),
    },
    {
      title: "Proprietà intellettuale",
      body: (
        <p>
          I contenuti del sito (testi, fotografie, impaginazione, identità
          visiva e logo Swiss3Design) sono protetti e non possono essere
          riprodotti senza autorizzazione. La vendita riguarda un oggetto
          fisico: non conferisce al cliente alcun diritto sui modelli 3D
          digitali sottostanti, né alcuna licenza di riproduzione, riedizione o
          rivendita in serie. I diritti di proprietà intellettuale relativi ai
          modelli stampati restano riservati ai rispettivi titolari.
        </p>
      ),
    },
    {
      title: "Forza maggiore",
      body: (
        <p>
          Il gestore non è responsabile dei ritardi o degli impedimenti dovuti a
          circostanze che sfuggono al suo ragionevole controllo (forza maggiore,
          inadempienza di un fornitore o del trasportatore, interruzione
          tecnica, ecc.). I termini interessati sono sospesi per la durata
          dell’evento.
        </p>
      ),
    },
    {
      title: "Clausola di salvaguardia",
      body: (
        <p>
          Qualora una disposizione delle presenti CGV sia nulla o inapplicabile,
          le altre disposizioni restano valide; la disposizione interessata è
          sostituita da una regola valida il cui effetto si avvicina il più
          possibile all’intenzione iniziale.
        </p>
      ),
    },
    {
      title: "Diritto applicabile e foro",
      body: (
        <p>
          Le presenti CGV sono soggette al diritto svizzero. Il foro è Nyon
          (VD), fatti salvi i fori imperativi previsti dalla legge.
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
          by{" "}
          <strong>
            Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
            (Vaud), Switzerland
          </strong>{" "}
          (the “Operator”), reachable at contact@swiss3design.ch. By placing an
          order, the customer accepts these GTC in the version in force at the
          time of the order. The customer confirms that they are of legal age or
          are acting with the consent of their legal representative.
        </p>
      ),
    },
    {
      title: "Products",
      body: (
        <p>
          The items offered are objects crafted by 3D printing, individually or
          in small series. Slight variations in colour, texture or appearance
          (in particular the layer lines inherent to the process) may exist from
          one piece to another and do not constitute a defect. Photographs are
          as faithful as possible but not contractually binding. If a colour or
          material shown on a product page is temporarily unavailable, the
          Operator may offer an equivalent alternative; absent the customer's
          agreement, the order concerned is cancelled and fully refunded.
        </p>
      ),
    },
    {
      title: "Prices",
      body: (
        <p>
          All prices are in Swiss francs (CHF). The Operator is not subject to
          VAT (Art. 10 of the Swiss VAT Act); no VAT is charged. Shipping costs
          are shown before payment confirmation.
        </p>
      ),
    },
    {
      title: "Ordering and conclusion of the contract",
      body: (
        <p>
          The presentation of products does not constitute a binding offer. The
          customer’s order constitutes an offer to purchase; the contract is
          concluded upon confirmation of payment, evidenced by the order
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
          Payment is made online via the payment provider Stripe (credit/debit
          card, TWINT, Google Pay), including Stripe Link to reuse a card
          already saved. The Operator never has access to card data and does not
          store it.
        </p>
      ),
    },
    {
      title: "Payment disputes",
      body: (
        <p>
          In the event of a disagreement over an order, the customer is
          invited to contact the Operator at contact@swiss3design.ch before
          raising any dispute directly with their bank or Stripe. A manifestly
          unfounded payment dispute ("chargeback") — in particular for an
          order delivered as agreed, supported by tracking evidence — may
          result in suspension of the account concerned and the billing of any
          costs it generates (payment-provider dispute fees, collection
          costs), without prejudice to legal action.
        </p>
      ),
    },
    {
      title: "Customer accounts",
      body: (
        <p>
          The Operator may suspend or close a customer account in the event of
          proven or suspected fraud, non-compliance with these GTC, abusive
          behaviour towards the Operator or its staff, or repeated unfounded
          payment disputes. The customer is informed by e-mail of the reason,
          unless doing so would compromise an ongoing procedure. Orders
          already paid for and not in dispute remain honoured.
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
          indicative; a delay does not give rise to any claim for damages. The
          risk of loss or damage during transport is borne by the Operator until
          the product is handed over to the customer.
        </p>
      ),
    },
    {
      title: "Custom prints (quotes)",
      body: (
        <p>
          Customised services (files supplied by the customer or specific
          projects) are subject to a quote. The contract is concluded upon
          acceptance of the quote and payment. Production begins upon that
          payment; past that point, the order can no longer be cancelled or
          changed. Customised items can be neither returned nor exchanged (see
          “Returns”). The customer warrants that
          they hold the rights to the files submitted and that printing them
          does not infringe any third-party rights or legal provisions; the
          Operator may refuse any file without justification. The customer shall
          indemnify the Operator against any third-party claim arising from
          their files. Files of weapons or weapon parts, counterfeits and any
          unlawful object are in particular excluded.
        </p>
      ),
    },
    {
      title: "Returns",
      body: (
        <p>
          Swiss law does not provide for a statutory right of withdrawal for
          online purchases. As a commercial gesture, the Operator accepts
          returns of catalogue items (non-customised) within 14 days of receipt,
          provided they are unused and in their original condition. Return costs
          are borne by the customer; the price of the items is refunded,
          excluding the initial shipping costs. Custom-made items are excluded
          from returns.
        </p>
      ),
    },
    {
      title: "Warranty",
      body: (
        <p>
          The statutory warranty for defects in the goods sold (Art. 197 et seq.
          of the Swiss Code of Obligations) applies for two years from delivery.
          The customer shall report any defect as soon as possible to
          contact@swiss3design.ch, with supporting photos. The Operator will
          primarily offer repair or replacement; if this proves impossible or
          disproportionate, the customer retains their statutory rights (price
          reduction or refund).
        </p>
      ),
    },
    {
      title: "Customer reviews",
      body: (
        <p>
          A review may only relate to a purchase actually made and delivered.
          The Operator moderates reviews before publication and may refuse or
          remove, without prior justification, any review that is false,
          defamatory, abusive, or manifestly written in bad faith. A negative
          review that is well-founded, respectful and relevant to the product
          or service is never removed on the sole ground that it is
          unfavourable.
        </p>
      ),
    },
    {
      title: "Liability",
      body: (
        <p>
          Except in cases of gross negligence or wilful misconduct, the
          Operator’s liability is limited to direct and proven damage, up to the
          amount of the order concerned. Any indirect damage, loss of profit,
          loss of data or consequential damage is excluded to the same extent.
          Unless expressly stated otherwise,
          3D-printed objects are not intended for safety-related use, prolonged
          food contact or medical use, and are not toys for children under 3
          years of age. The foregoing limitations do not apply where the law
          excludes any limitation, in particular in the event of personal injury
          or under the Swiss Product Liability Act.
        </p>
      ),
    },
    {
      title: "Intellectual property",
      body: (
        <p>
          The contents of the site (texts, photographs, layout, visual identity
          and the Swiss3Design logo) are protected and may not be reproduced
          without authorisation. The sale concerns a physical object: it grants
          the customer no rights in the underlying digital 3D models, nor any
          licence to reproduce, re-edit or resell in series. The
          intellectual-property rights in the printed models remain reserved to
          their respective holders.
        </p>
      ),
    },
    {
      title: "Force majeure",
      body: (
        <p>
          The Operator is not liable for delays or impediments resulting from
          circumstances beyond its reasonable control (force majeure, failure of
          a supplier or carrier, technical interruption, etc.). The affected
          time limits are suspended for the duration of the event.
        </p>
      ),
    },
    {
      title: "Severability",
      body: (
        <p>
          If any provision of these GTC is void or unenforceable, the remaining
          provisions remain valid; the provision concerned is replaced by a
          valid rule whose effect comes as close as possible to the original
          intent.
        </p>
      ),
    },
    {
      title: "Governing law and jurisdiction",
      body: (
        <p>
          These GTC are governed by Swiss law. The place of jurisdiction is Nyon
          (VD), subject to mandatory statutory jurisdictions.
        </p>
      ),
    },
  ],
};
