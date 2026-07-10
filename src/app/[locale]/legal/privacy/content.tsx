import type { Locale } from "@/i18n/routing";
import type { LegalSection } from "../legal-layout";

// Politique de confidentialité dans les 4 langues. Seule la version
// française fait foi ; chaque langue utilise les désignations officielles
// suisses (nLPD/revDSG/FADP, PFPDT/EDÖB/IFPDT/FDPIC).

export const PRIVACY_CONTENT: Record<Locale, LegalSection[]> = {
  fr: [
    {
      title: "Responsable du traitement",
      body: (
        <p>
          Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
          (Vaud), Suisse — contact@swiss3design.ch. La présente politique décrit
          le traitement des données personnelles conformément à la loi fédérale
          sur la protection des données (nLPD).
        </p>
      ),
    },
    {
      title: "Données traitées",
      body: (
        <p>
          <strong>Compte client</strong> : nom, adresse e-mail, mot de passe
          (haché, jamais en clair), identifiant de connexion Google ou clé
          d’accès (passkey) — dans ce dernier cas, seules la clé publique et des
          métadonnées techniques de l’appareil sont stockées sur nos serveurs ;
          votre empreinte digitale ou la reconnaissance faciale ne quittent
          jamais votre appareil. <strong>Commandes</strong> : adresse de
          livraison, articles, historique. <strong>Paiement</strong> : traité
          exclusivement par Stripe ; nous ne voyons ni ne stockons aucune donnée
          de carte. <strong>Devis sur mesure</strong> : description du projet et
          fichiers 3D transmis. <strong>Avis</strong> : si vous laissez un
          avis sur un produit acheté, votre nom d’affichage, la note et le
          commentaire sont publiés sur la fiche produit après modération.{" "}
          <strong>Échanges</strong> : e-mails et
          correspondance. <strong>Données techniques</strong> : lors de la
          consultation du site, votre adresse IP, le type de navigateur et des
          journaux de connexion sont traités automatiquement à des fins de
          sécurité, de prévention des abus et de bon fonctionnement du site.
        </p>
      ),
    },
    {
      title: "Finalités",
      body: (
        <p>
          Exécution des commandes et des devis, gestion du compte client, envoi
          des e-mails transactionnels (confirmation, expédition, devis, sécurité
          du compte), respect des obligations légales (conservation comptable)
          et prévention des abus. Aucune donnée n’est vendue ni utilisée à des
          fins publicitaires. À la seule exception d’un rappel de panier que
          vous auriez <strong>expressément demandé</strong> (voir ci-dessous),
          nous n’envoyons aucun e-mail publicitaire : les autres e-mails sont
          strictement transactionnels (commandes, compte).
        </p>
      ),
    },
    {
      title: "Rappel de panier (sur consentement)",
      body: (
        <p>
          Si — et seulement si — vous le demandez explicitement en cochant la
          case prévue dans le panier, nous conservons votre adresse e-mail et le
          contenu de votre panier pour vous envoyer <strong>un seul</strong>{" "}
          rappel lorsque vous n’avez pas finalisé votre commande. La base légale
          est votre <strong>consentement</strong>, que vous pouvez retirer à
          tout moment via le lien de désinscription présent dans cet e-mail. Ces
          données sont supprimées dès la commande passée, dès la désinscription,
          et au plus tard <strong>30 jours</strong> après leur enregistrement.
        </p>
      ),
    },
    {
      title: "Préférences de communication",
      body: (
        <p>
          Si vous activez la newsletter ou les alertes de nouveaux produits
          depuis votre espace client (
          <strong>Mon compte → Notifications</strong>), nous utilisons votre
          adresse e-mail pour vous envoyer ces communications. La base légale
          est votre <strong>consentement</strong>, donné en activant la case
          correspondante ; vous pouvez le retirer à tout moment depuis votre
          compte ou via le lien de désabonnement en un clic présent dans chaque
          e-mail. Resend (sous-traitant déjà cité ci-dessous) est utilisé pour
          l’envoi de ces e-mails.
        </p>
      ),
    },
    {
      title: "Profilage et décisions automatisées",
      body: (
        <p>
          Nous ne procédons à aucun profilage ni à aucune décision individuelle
          automatisée produisant des effets juridiques à votre égard ou vous
          affectant de manière significative.
        </p>
      ),
    },
    {
      title: "Sous-traitants et transferts",
      body: (
        <p>
          Nous recourons à des prestataires techniques : Cloudflare
          (hébergement, réseau de diffusion et stockage des fichiers), Neon
          (base de données PostgreSQL, hébergée dans l’Union européenne),
          Stripe (paiement — y compris, le cas échéant, la fonctionnalité{" "}
          <strong>Stripe Link</strong> qui permet de réutiliser une carte déjà
          enregistrée auprès d’un autre marchand utilisant Stripe ; nous ne
          conservons nous-mêmes aucune donnée de carte), Resend (envoi
          d’e-mails), Google (connexion Google, si utilisée). Certains de ces
          prestataires traitent des données à l’étranger, en particulier dans
          l’Union européenne et aux États-Unis ; ces transferts reposent sur
          des garanties reconnues (l’Union européenne assure un niveau de
          protection adéquat reconnu par la Suisse ; Swiss-U.S. Data Privacy
          Framework pour les prestataires américains certifiés, ou clauses
          contractuelles types).
        </p>
      ),
    },
    {
      title: "Cookies et stockage local",
      body: (
        <p>
          Le site n’utilise que des éléments techniques indispensables : un
          cookie de session pour rester connecté à son compte et le stockage
          local du navigateur pour le panier. Aucun cookie publicitaire, aucun
          traceur tiers.
        </p>
      ),
    },
    {
      title: "Durées de conservation",
      body: (
        <p>
          Compte : jusqu’à sa suppression par le client. Commandes : 10 ans
          (obligation de conservation comptable, art. 958f CO). Demandes de
          devis et fichiers 3D : supprimés au plus tard 2 ans après la fin du
          projet ou le refus du devis.
        </p>
      ),
    },
    {
      title: "Vos droits",
      body: (
        <p>
          Conformément aux art. 25 ss nLPD, vous pouvez demander l’accès à vos
          données, leur rectification, leur effacement ou leur remise dans un
          format usuel. Un export instantané de vos données (profil, commandes,
          devis, adresses) est disponible depuis{" "}
          <strong>Mon compte → Confidentialité</strong> ; pour toute autre
          demande, écrivez à contact@swiss3design.ch. Vous pouvez également
          saisir le Préposé fédéral à la protection des données et à la
          transparence (PFPDT). Nous répondons en principe dans les 30 jours et
          pouvons demander une preuve d’identité avant de donner suite, afin de
          protéger vos données.
        </p>
      ),
    },
    {
      title: "Sécurité",
      body: (
        <p>
          Les échanges sont chiffrés (TLS), les mots de passe sont hachés et
          l’accès aux données est restreint à l’exploitant. Les fichiers des
          devis sont stockés dans un espace privé non accessible publiquement.
        </p>
      ),
    },
    {
      title: "Mineurs",
      body: (
        <p>
          La boutique s’adresse à des personnes majeures. Les mineurs ne peuvent
          commander qu’avec l’accord de leur représentant légal. Nous ne
          collectons pas sciemment de données concernant des enfants.
        </p>
      ),
    },
    {
      title: "Modifications",
      body: (
        <p>
          La présente politique peut être adaptée ; la version publiée sur cette
          page fait foi, avec sa date de mise à jour.
        </p>
      ),
    },
  ],

  de: [
    {
      title: "Verantwortlicher",
      body: (
        <p>
          Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
          (Waadt), Schweiz — contact@swiss3design.ch. Die vorliegende Erklärung
          beschreibt die Bearbeitung von Personendaten gemäss dem Bundesgesetz
          über den Datenschutz (revDSG).
        </p>
      ),
    },
    {
      title: "Bearbeitete Daten",
      body: (
        <p>
          <strong>Kundenkonto</strong>: Name, E-Mail-Adresse, Passwort (gehasht,
          nie im Klartext), Google-Anmeldekennung oder Passkey — in letzterem
          Fall werden nur der öffentliche Schlüssel und technische
          Gerätemetadaten auf unseren Servern gespeichert; Ihr Fingerabdruck
          oder Ihre Gesichtserkennung verlassen Ihr Gerät nie.{" "}
          <strong>Bestellungen</strong>: Lieferadresse, Artikel, Verlauf.{" "}
          <strong>Zahlung</strong>: wird ausschliesslich von Stripe verarbeitet;
          wir sehen und speichern keinerlei Kartendaten.{" "}
          <strong>Offerten für Massanfertigungen</strong>: Projektbeschreibung
          und übermittelte 3D-Dateien.{" "}
          <strong>Bewertungen</strong>: Wenn Sie eine Bewertung zu einem
          gekauften Produkt hinterlassen, werden Ihr Anzeigename, die Bewertung
          und der Kommentar nach Prüfung auf der Produktseite veröffentlicht.{" "}
          <strong>Korrespondenz</strong>: E-Mails
          und Schriftverkehr. <strong>Technische Daten</strong>: Beim Besuch der
          Website werden Ihre IP-Adresse, der Browsertyp und
          Verbindungsprotokolle automatisch zu Zwecken der Sicherheit, der
          Missbrauchsprävention und des einwandfreien Betriebs bearbeitet.
        </p>
      ),
    },
    {
      title: "Zwecke",
      body: (
        <p>
          Abwicklung von Bestellungen und Offerten, Verwaltung des Kundenkontos,
          Versand von Transaktions-E-Mails (Bestätigung, Versand, Offerte,
          Kontosicherheit), Erfüllung gesetzlicher Pflichten (buchhalterische
          Aufbewahrung) und Missbrauchsprävention. Es werden keine Daten
          verkauft oder zu Werbezwecken verwendet. Mit alleiniger Ausnahme einer
          Warenkorb-Erinnerung, die Sie{" "}
          <strong>ausdrücklich angefordert</strong> haben (siehe unten),
          versenden wir keine Werbe-E-Mails; alle übrigen E-Mails sind rein
          transaktionsbezogen (Bestellungen, Konto).
        </p>
      ),
    },
    {
      title: "Warenkorb-Erinnerung (mit Einwilligung)",
      body: (
        <p>
          Nur wenn Sie dies im Warenkorb ausdrücklich durch Ankreuzen des
          entsprechenden Felds verlangen, speichern wir Ihre E-Mail-Adresse und
          den Inhalt Ihres Warenkorbs, um Ihnen <strong>eine einzige</strong>{" "}
          Erinnerung zu senden, falls Sie Ihre Bestellung nicht abgeschlossen
          haben. Rechtsgrundlage ist Ihre <strong>Einwilligung</strong>, die Sie
          jederzeit über den Abmeldelink in dieser E-Mail widerrufen können.
          Diese Daten werden bei Bestellung, bei Abmeldung und spätestens nach{" "}
          <strong>30 Tagen</strong> gelöscht.
        </p>
      ),
    },
    {
      title: "Kommunikationspräferenzen",
      body: (
        <p>
          Wenn Sie den Newsletter oder Benachrichtigungen zu neuen Produkten in
          Ihrem Kundenkonto aktivieren (
          <strong>Mein Konto → Benachrichtigungen</strong>), verwenden wir Ihre
          E-Mail-Adresse, um Ihnen diese Mitteilungen zu senden. Rechtsgrundlage
          ist Ihre <strong>Einwilligung</strong>, die Sie jederzeit über Ihr
          Konto oder über den Abmeldelink mit einem Klick in jeder E-Mail
          widerrufen können. Resend (weiter unten als Auftragsbearbeiter
          genannt) wird für den Versand dieser E-Mails eingesetzt.
        </p>
      ),
    },
    {
      title: "Profiling und automatisierte Entscheidungen",
      body: (
        <p>
          Wir nehmen kein Profiling und keine automatisierten
          Einzelentscheidungen vor, die Ihnen gegenüber rechtliche Wirkungen
          entfalten oder Sie erheblich beeinträchtigen.
        </p>
      ),
    },
    {
      title: "Auftragsbearbeiter und Datenübermittlungen",
      body: (
        <p>
          Wir setzen technische Dienstleister ein: Cloudflare (Hosting,
          Content-Delivery-Netzwerk und Dateispeicherung), Neon
          (PostgreSQL-Datenbank, gehostet in der Europäischen Union), Stripe
          (Zahlung — einschliesslich, falls zutreffend, der Funktion{" "}
          <strong>Stripe Link</strong>, die es ermöglicht, eine bereits bei
          einem anderen Stripe-Händler gespeicherte Karte wiederzuverwenden;
          wir selbst speichern keinerlei Kartendaten), Resend (E-Mail-Versand),
          Google (Google-Anmeldung, falls genutzt). Einige dieser Anbieter
          bearbeiten Daten im Ausland, insbesondere in der Europäischen Union
          und in den USA; diese Übermittlungen stützen sich auf anerkannte
          Garantien (die Europäische Union gewährleistet ein von der Schweiz
          anerkanntes angemessenes Schutzniveau; Swiss-U.S. Data Privacy
          Framework für zertifizierte US-Anbieter oder
          Standardvertragsklauseln).
        </p>
      ),
    },
    {
      title: "Cookies und lokale Speicherung",
      body: (
        <p>
          Die Website verwendet ausschliesslich technisch notwendige Elemente:
          ein Session-Cookie, um im Konto angemeldet zu bleiben, und den lokalen
          Speicher des Browsers für den Warenkorb. Keine Werbe-Cookies, keine
          Tracker von Drittanbietern.
        </p>
      ),
    },
    {
      title: "Aufbewahrungsfristen",
      body: (
        <p>
          Konto: bis zur Löschung durch den Kunden. Bestellungen: 10 Jahre
          (buchhalterische Aufbewahrungspflicht, Art. 958f OR). Offertanfragen
          und 3D-Dateien: Löschung spätestens 2 Jahre nach Projektabschluss oder
          Ablehnung der Offerte.
        </p>
      ),
    },
    {
      title: "Ihre Rechte",
      body: (
        <p>
          Gemäss Art. 25 ff. revDSG können Sie Auskunft über Ihre Daten sowie
          deren Berichtigung, Löschung oder Herausgabe in einem gängigen Format
          verlangen. Ein sofortiger Export Ihrer Daten (Profil, Bestellungen,
          Offerten, Adressen) steht unter{" "}
          <strong>Mein Konto → Datenschutz</strong> zur Verfügung; für alle
          weiteren Anliegen schreiben Sie an contact@swiss3design.ch. Sie können
          sich zudem an den Eidgenössischen Datenschutz- und
          Öffentlichkeitsbeauftragten (EDÖB) wenden. Wir antworten grundsätzlich
          innert 30 Tagen und können vor der Bearbeitung einen
          Identitätsnachweis verlangen, um Ihre Daten zu schützen.
        </p>
      ),
    },
    {
      title: "Sicherheit",
      body: (
        <p>
          Die Verbindungen sind verschlüsselt (TLS), Passwörter werden gehasht
          und der Zugriff auf die Daten ist auf den Betreiber beschränkt. Die
          Dateien der Offerten werden in einem privaten, öffentlich nicht
          zugänglichen Bereich gespeichert.
        </p>
      ),
    },
    {
      title: "Minderjährige",
      body: (
        <p>
          Der Shop richtet sich an volljährige Personen. Minderjährige dürfen
          nur mit Zustimmung ihrer gesetzlichen Vertretung bestellen. Wir
          erheben wissentlich keine Daten von Kindern.
        </p>
      ),
    },
    {
      title: "Änderungen",
      body: (
        <p>
          Diese Erklärung kann angepasst werden; massgebend ist die auf dieser
          Seite veröffentlichte Fassung mit ihrem Aktualisierungsdatum.
        </p>
      ),
    },
  ],

  it: [
    {
      title: "Titolare del trattamento",
      body: (
        <p>
          Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
          (Vaud), Svizzera — contact@swiss3design.ch. La presente informativa
          descrive il trattamento dei dati personali conformemente alla legge
          federale sulla protezione dei dati (nLPD).
        </p>
      ),
    },
    {
      title: "Dati trattati",
      body: (
        <p>
          <strong>Conto cliente</strong>: nome, indirizzo e-mail, password
          (sottoposta a hash, mai in chiaro), identificativo di accesso Google o
          chiave di accesso (passkey) — in quest’ultimo caso, sui nostri server
          sono memorizzati solo la chiave pubblica e alcuni metadati tecnici del
          dispositivo; la vostra impronta digitale o il riconoscimento facciale
          non lasciano mai il vostro dispositivo. <strong>Ordini</strong>:
          indirizzo di consegna, articoli, cronologia.{" "}
          <strong>Pagamento</strong>: trattato esclusivamente da Stripe; non
          vediamo né memorizziamo alcun dato della carta.{" "}
          <strong>Preventivi su misura</strong>: descrizione del progetto e file
          3D trasmessi.{" "}
          <strong>Recensioni</strong>: se lasciate una recensione su un
          prodotto acquistato, il vostro nome visualizzato, il voto e il
          commento vengono pubblicati sulla scheda prodotto dopo moderazione.{" "}
          <strong>Scambi</strong>: e-mail e corrispondenza.{" "}
          <strong>Dati tecnici</strong>: durante la consultazione del sito, il
          vostro indirizzo IP, il tipo di browser e i registri di connessione
          sono trattati automaticamente a fini di sicurezza, prevenzione degli
          abusi e corretto funzionamento del sito.
        </p>
      ),
    },
    {
      title: "Finalità",
      body: (
        <p>
          Esecuzione degli ordini e dei preventivi, gestione del conto cliente,
          invio delle e-mail transazionali (conferma, spedizione, preventivo,
          sicurezza del conto), rispetto degli obblighi legali (conservazione
          contabile) e prevenzione degli abusi. Nessun dato viene venduto né
          utilizzato a fini pubblicitari. Con la sola eccezione di un promemoria
          del carrello che abbiate <strong>espressamente richiesto</strong>{" "}
          (vedi sotto), non inviamo alcuna e-mail pubblicitaria; le altre e-mail
          sono strettamente transazionali (ordini, conto).
        </p>
      ),
    },
    {
      title: "Promemoria del carrello (con consenso)",
      body: (
        <p>
          Solo se lo richiedete esplicitamente spuntando l’apposita casella nel
          carrello, conserviamo il vostro indirizzo e-mail e il contenuto del
          carrello per inviarvi <strong>un solo</strong> promemoria se non avete
          completato l’ordine. La base giuridica è il vostro{" "}
          <strong>consenso</strong>, che potete revocare in qualsiasi momento
          tramite il link di disiscrizione presente nell’e-mail. Questi dati
          vengono eliminati al momento dell’ordine, alla disiscrizione e al più
          tardi dopo <strong>30 giorni</strong>.
        </p>
      ),
    },
    {
      title: "Preferenze di comunicazione",
      body: (
        <p>
          Se attivate la newsletter o gli avvisi sui nuovi prodotti dal vostro
          spazio cliente (<strong>Il mio conto → Notifiche</strong>),
          utilizziamo il vostro indirizzo e-mail per inviarvi queste
          comunicazioni. La base giuridica è il vostro <strong>consenso</strong>
          , che potete revocare in qualsiasi momento dal vostro conto oppure
          tramite il link di disiscrizione con un clic presente in ogni e-mail.
          Resend (responsabile del trattamento già citato di seguito) è
          utilizzato per l’invio di queste e-mail.
        </p>
      ),
    },
    {
      title: "Profilazione e decisioni automatizzate",
      body: (
        <p>
          Non effettuiamo alcuna profilazione né alcuna decisione individuale
          automatizzata che produca effetti giuridici nei vostri confronti o che
          vi riguardi in modo significativo.
        </p>
      ),
    },
    {
      title: "Responsabili del trattamento e trasferimenti",
      body: (
        <p>
          Ricorriamo a fornitori tecnici: Cloudflare (hosting, rete di
          distribuzione dei contenuti e archiviazione dei file), Neon (banca
          dati PostgreSQL, ospitata nell’Unione europea), Stripe (pagamento —
          inclusa, se applicabile, la funzione{" "}
          <strong>Stripe Link</strong> che consente di riutilizzare una carta
          già registrata presso un altro esercente che utilizza Stripe; noi
          stessi non conserviamo alcun dato della carta), Resend (invio di
          e-mail), Google (accesso Google, se utilizzato). Alcuni di questi
          fornitori trattano dati all’estero, in particolare nell’Unione
          europea e negli Stati Uniti; tali trasferimenti si basano su
          garanzie riconosciute (l’Unione europea garantisce un livello di
          protezione adeguato riconosciuto dalla Svizzera; Swiss-U.S. Data
          Privacy Framework per i fornitori statunitensi certificati o
          clausole contrattuali tipo).
        </p>
      ),
    },
    {
      title: "Cookie e memorizzazione locale",
      body: (
        <p>
          Il sito utilizza solo elementi tecnici indispensabili: un cookie di
          sessione per restare connessi al proprio conto e la memoria locale del
          browser per il carrello. Nessun cookie pubblicitario, nessun
          tracciante di terzi.
        </p>
      ),
    },
    {
      title: "Durata di conservazione",
      body: (
        <p>
          Conto: fino alla sua cancellazione da parte del cliente. Ordini: 10
          anni (obbligo di conservazione contabile, art. 958f CO). Richieste di
          preventivo e file 3D: cancellati al più tardi 2 anni dopo la fine del
          progetto o il rifiuto del preventivo.
        </p>
      ),
    },
    {
      title: "I vostri diritti",
      body: (
        <p>
          Conformemente agli art. 25 segg. nLPD, potete chiedere l’accesso ai
          vostri dati, la loro rettifica, la loro cancellazione o la loro
          consegna in un formato corrente. Un’esportazione immediata dei vostri
          dati (profilo, ordini, preventivi, indirizzi) è disponibile da{" "}
          <strong>Il mio conto → Riservatezza</strong>; per qualsiasi altra
          richiesta, scrivete a contact@swiss3design.ch. Potete inoltre
          rivolgervi all’Incaricato federale della protezione dei dati e della
          trasparenza (IFPDT). Rispondiamo in linea di principio entro 30 giorni
          e possiamo richiedere una prova d’identità prima di dar seguito, al
          fine di proteggere i vostri dati.
        </p>
      ),
    },
    {
      title: "Sicurezza",
      body: (
        <p>
          Gli scambi sono cifrati (TLS), le password sono sottoposte a hash e
          l’accesso ai dati è limitato al gestore. I file dei preventivi sono
          conservati in uno spazio privato non accessibile pubblicamente.
        </p>
      ),
    },
    {
      title: "Minori",
      body: (
        <p>
          Il negozio si rivolge a persone maggiorenni. I minori possono ordinare
          solo con il consenso del loro rappresentante legale. Non raccogliamo
          consapevolmente dati relativi a minori.
        </p>
      ),
    },
    {
      title: "Modifiche",
      body: (
        <p>
          La presente informativa può essere adattata; fa fede la versione
          pubblicata su questa pagina, con la relativa data di aggiornamento.
        </p>
      ),
    },
  ],

  en: [
    {
      title: "Data controller",
      body: (
        <p>
          Swiss3Design, Thomas Prud’homme, Chemin de l’Aubépine 9B, 1196 Gland
          (Vaud), Switzerland — contact@swiss3design.ch. This policy describes
          how personal data is processed in accordance with the Swiss Federal
          Act on Data Protection (FADP).
        </p>
      ),
    },
    {
      title: "Data processed",
      body: (
        <p>
          <strong>Customer account</strong>: name, e-mail address, password
          (hashed, never in plain text), Google sign-in identifier, or passkey —
          in the latter case, only the public key and technical device metadata
          are stored on our servers; your fingerprint or facial recognition data
          never leaves your device. <strong>Orders</strong>: delivery address,
          items, history. <strong>Payment</strong>: processed exclusively by
          Stripe; we neither see nor store any card data.{" "}
          <strong>Custom quotes</strong>: project description and 3D files
          submitted.{" "}
          <strong>Reviews</strong>: if you leave a review on a purchased
          product, your display name, rating and comment are published on the
          product page after moderation.{" "}
          <strong>Correspondence</strong>: e-mails and exchanges.{" "}
          <strong>Technical data</strong>: when you browse the site, your IP
          address, browser type and connection logs are processed automatically
          for security, abuse-prevention and proper operation of the site.
        </p>
      ),
    },
    {
      title: "Purposes",
      body: (
        <p>
          Fulfilling orders and quotes, managing the customer account, sending
          transactional e-mails (confirmation, shipping, quotes, account
          security), complying with legal obligations (accounting retention) and
          preventing abuse. No data is sold or used for advertising purposes.
          With the sole exception of a cart reminder you have{" "}
          <strong>explicitly requested</strong> (see below), we do not send any
          advertising e-mails; all other e-mails are strictly transactional
          (orders, account).
        </p>
      ),
    },
    {
      title: "Cart reminders (with consent)",
      body: (
        <p>
          Only if you explicitly request it by ticking the dedicated box in the
          cart do we keep your e-mail address and cart contents to send you{" "}
          <strong>a single</strong> reminder if you have not completed your
          order. The legal basis is your <strong>consent</strong>, which you can
          withdraw at any time via the unsubscribe link in that e-mail. This
          data is deleted once the order is placed, upon unsubscribing, and at
          the latest after <strong>30 days</strong>.
        </p>
      ),
    },
    {
      title: "Communication preferences",
      body: (
        <p>
          If you enable the newsletter or new-product alerts from your account
          area (<strong>My account → Notifications</strong>), we use your e-mail
          address to send you these communications. The legal basis is your{" "}
          <strong>consent</strong>, given by turning on the relevant toggle —
          you can withdraw it at any time from your account, or via the
          one-click unsubscribe link included in every e-mail. Resend (listed as
          a processor below) is used to send these e-mails.
        </p>
      ),
    },
    {
      title: "Profiling and automated decisions",
      body: (
        <p>
          We do not carry out any profiling or automated individual decisions
          producing legal effects concerning you or significantly affecting you.
        </p>
      ),
    },
    {
      title: "Processors and transfers",
      body: (
        <p>
          We use technical service providers: Cloudflare (hosting, content
          delivery network and file storage), Neon (PostgreSQL database,
          hosted in the European Union), Stripe (payment — including, where
          applicable, <strong>Stripe Link</strong>, which lets you reuse a
          card already saved with another merchant using Stripe; we ourselves
          never store any card data), Resend (e-mail delivery), Google (Google
          sign-in, if used). Some of these providers process data abroad, in
          particular in the European Union and the United States; these
          transfers are based on recognised safeguards (the European Union
          provides an adequate level of protection recognised by Switzerland;
          the Swiss-U.S. Data Privacy Framework for certified US providers, or
          standard contractual clauses).
        </p>
      ),
    },
    {
      title: "Cookies and local storage",
      body: (
        <p>
          The site only uses strictly necessary technical elements: a session
          cookie to stay signed in to your account and the browser’s local
          storage for the cart. No advertising cookies, no third-party trackers.
        </p>
      ),
    },
    {
      title: "Retention periods",
      body: (
        <p>
          Account: until deleted by the customer. Orders: 10 years (accounting
          retention obligation, Art. 958f of the Swiss Code of Obligations).
          Quote requests and 3D files: deleted no later than 2 years after the
          end of the project or rejection of the quote.
        </p>
      ),
    },
    {
      title: "Your rights",
      body: (
        <p>
          In accordance with Art. 25 et seq. FADP, you may request access to
          your data, as well as its rectification, erasure or delivery in a
          common format. An instant export of your data (profile, orders,
          quotes, addresses) is available from{" "}
          <strong>My account → Privacy</strong>; for any other request, write to
          contact@swiss3design.ch. You may also contact the Federal Data
          Protection and Information Commissioner (FDPIC). We generally respond
          within 30 days and may request proof of identity before acting, in
          order to protect your data.
        </p>
      ),
    },
    {
      title: "Security",
      body: (
        <p>
          Connections are encrypted (TLS), passwords are hashed and access to
          the data is restricted to the Operator. Quote files are stored in a
          private area that is not publicly accessible.
        </p>
      ),
    },
    {
      title: "Minors",
      body: (
        <p>
          The shop is intended for adults. Minors may only order with the
          consent of their legal representative. We do not knowingly collect
          data concerning children.
        </p>
      ),
    },
    {
      title: "Changes",
      body: (
        <p>
          This policy may be amended; the version published on this page,
          together with its update date, prevails.
        </p>
      ),
    },
  ],
};
