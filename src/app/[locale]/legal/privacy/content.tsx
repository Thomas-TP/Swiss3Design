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
          (Vaud), Suisse — contact@swiss3design.ch. La présente politique
          décrit le traitement des données personnelles conformément à la loi
          fédérale sur la protection des données (nLPD).
        </p>
      ),
    },
    {
      title: "Données traitées",
      body: (
        <p>
          <strong>Compte client</strong> : nom, adresse e-mail, mot de passe
          (haché, jamais en clair) ou identifiant de connexion Google.{" "}
          <strong>Commandes</strong> : adresse de livraison, articles,
          historique. <strong>Paiement</strong> : traité exclusivement par
          Stripe ; nous ne voyons ni ne stockons aucune donnée de carte.{" "}
          <strong>Devis sur mesure</strong> : description du projet et
          fichiers 3D transmis. <strong>Échanges</strong> : e-mails et
          correspondance.{" "}
          <strong>Données techniques</strong> : lors de la consultation du
          site, votre adresse IP, le type de navigateur et des journaux de
          connexion sont traités automatiquement à des fins de sécurité, de
          prévention des abus et de bon fonctionnement du site.
        </p>
      ),
    },
    {
      title: "Finalités",
      body: (
        <p>
          Exécution des commandes et des devis, gestion du compte client,
          envoi des e-mails transactionnels (confirmation, expédition, devis,
          sécurité du compte), respect des obligations légales (conservation
          comptable) et prévention des abus. Aucune donnée n’est vendue ni
          utilisée à des fins publicitaires. Nous n’envoyons aucun e-mail
          publicitaire ou de marketing ; seuls des e-mails transactionnels
          liés à vos commandes et à votre compte vous sont adressés.
        </p>
      ),
    },
    {
      title: "Profilage et décisions automatisées",
      body: (
        <p>
          Nous ne procédons à aucun profilage ni à aucune décision
          individuelle automatisée produisant des effets juridiques à votre
          égard ou vous affectant de manière significative.
        </p>
      ),
    },
    {
      title: "Sous-traitants et transferts",
      body: (
        <p>
          Nous recourons à des prestataires techniques : Cloudflare
          (hébergement et base de données), Stripe (paiement), Resend (envoi
          d’e-mails), Google (connexion Google, si utilisée). Certains de ces
          prestataires traitent des données à l’étranger, en particulier aux
          États-Unis ; ces transferts reposent sur des garanties reconnues
          (Swiss-U.S. Data Privacy Framework pour les prestataires certifiés,
          ou clauses contractuelles types).
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
          format usuel, en écrivant à contact@swiss3design.ch. Vous pouvez
          également saisir le Préposé fédéral à la protection des données et à
          la transparence (PFPDT). Nous répondons en principe dans les
          30 jours et pouvons demander une preuve d’identité avant de donner
          suite, afin de protéger vos données.
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
          La boutique s’adresse à des personnes majeures. Les mineurs ne
          peuvent commander qu’avec l’accord de leur représentant légal. Nous
          ne collectons pas sciemment de données concernant des enfants.
        </p>
      ),
    },
    {
      title: "Modifications",
      body: (
        <p>
          La présente politique peut être adaptée ; la version publiée sur
          cette page fait foi, avec sa date de mise à jour.
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
          (Waadt), Schweiz — contact@swiss3design.ch. Die vorliegende
          Erklärung beschreibt die Bearbeitung von Personendaten gemäss dem
          Bundesgesetz über den Datenschutz (revDSG).
        </p>
      ),
    },
    {
      title: "Bearbeitete Daten",
      body: (
        <p>
          <strong>Kundenkonto</strong>: Name, E-Mail-Adresse, Passwort
          (gehasht, nie im Klartext) oder Google-Anmeldekennung.{" "}
          <strong>Bestellungen</strong>: Lieferadresse, Artikel, Verlauf.{" "}
          <strong>Zahlung</strong>: wird ausschliesslich von Stripe
          verarbeitet; wir sehen und speichern keinerlei Kartendaten.{" "}
          <strong>Offerten für Massanfertigungen</strong>: Projektbeschreibung
          und übermittelte 3D-Dateien. <strong>Korrespondenz</strong>: E-Mails
          und Schriftverkehr.{" "}
          <strong>Technische Daten</strong>: Beim Besuch der Website werden
          Ihre IP-Adresse, der Browsertyp und Verbindungsprotokolle
          automatisch zu Zwecken der Sicherheit, der Missbrauchsprävention und
          des einwandfreien Betriebs bearbeitet.
        </p>
      ),
    },
    {
      title: "Zwecke",
      body: (
        <p>
          Abwicklung von Bestellungen und Offerten, Verwaltung des
          Kundenkontos, Versand von Transaktions-E-Mails (Bestätigung,
          Versand, Offerte, Kontosicherheit), Erfüllung gesetzlicher Pflichten
          (buchhalterische Aufbewahrung) und Missbrauchsprävention. Es werden
          keine Daten verkauft oder zu Werbezwecken verwendet. Wir versenden
          keine Werbe- oder Marketing-E-Mails; Sie erhalten ausschliesslich
          Transaktions-E-Mails im Zusammenhang mit Ihren Bestellungen und
          Ihrem Konto.
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
          Wir setzen technische Dienstleister ein: Cloudflare (Hosting und
          Datenbank), Stripe (Zahlung), Resend (E-Mail-Versand), Google
          (Google-Anmeldung, falls genutzt). Einige dieser Anbieter bearbeiten
          Daten im Ausland, insbesondere in den USA; diese Übermittlungen
          stützen sich auf anerkannte Garantien (Swiss-U.S. Data Privacy
          Framework für zertifizierte Anbieter oder Standardvertragsklauseln).
        </p>
      ),
    },
    {
      title: "Cookies und lokale Speicherung",
      body: (
        <p>
          Die Website verwendet ausschliesslich technisch notwendige Elemente:
          ein Session-Cookie, um im Konto angemeldet zu bleiben, und den
          lokalen Speicher des Browsers für den Warenkorb. Keine
          Werbe-Cookies, keine Tracker von Drittanbietern.
        </p>
      ),
    },
    {
      title: "Aufbewahrungsfristen",
      body: (
        <p>
          Konto: bis zur Löschung durch den Kunden. Bestellungen: 10 Jahre
          (buchhalterische Aufbewahrungspflicht, Art. 958f OR).
          Offertanfragen und 3D-Dateien: Löschung spätestens 2 Jahre nach
          Projektabschluss oder Ablehnung der Offerte.
        </p>
      ),
    },
    {
      title: "Ihre Rechte",
      body: (
        <p>
          Gemäss Art. 25 ff. revDSG können Sie Auskunft über Ihre Daten sowie
          deren Berichtigung, Löschung oder Herausgabe in einem gängigen
          Format verlangen, per E-Mail an contact@swiss3design.ch. Sie können
          sich zudem an den Eidgenössischen Datenschutz- und
          Öffentlichkeitsbeauftragten (EDÖB) wenden. Wir antworten
          grundsätzlich innert 30 Tagen und können vor der Bearbeitung einen
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
          (sottoposta a hash, mai in chiaro) o identificativo di accesso
          Google. <strong>Ordini</strong>: indirizzo di consegna, articoli,
          cronologia. <strong>Pagamento</strong>: trattato esclusivamente da
          Stripe; non vediamo né memorizziamo alcun dato della carta.{" "}
          <strong>Preventivi su misura</strong>: descrizione del progetto e
          file 3D trasmessi. <strong>Scambi</strong>: e-mail e corrispondenza.{" "}
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
          Esecuzione degli ordini e dei preventivi, gestione del conto
          cliente, invio delle e-mail transazionali (conferma, spedizione,
          preventivo, sicurezza del conto), rispetto degli obblighi legali
          (conservazione contabile) e prevenzione degli abusi. Nessun dato
          viene venduto né utilizzato a fini pubblicitari. Non inviamo alcuna
          e-mail pubblicitaria o di marketing; vi vengono inviate
          esclusivamente e-mail transazionali relative ai vostri ordini e al
          vostro conto.
        </p>
      ),
    },
    {
      title: "Profilazione e decisioni automatizzate",
      body: (
        <p>
          Non effettuiamo alcuna profilazione né alcuna decisione individuale
          automatizzata che produca effetti giuridici nei vostri confronti o
          che vi riguardi in modo significativo.
        </p>
      ),
    },
    {
      title: "Responsabili del trattamento e trasferimenti",
      body: (
        <p>
          Ricorriamo a fornitori tecnici: Cloudflare (hosting e banca dati),
          Stripe (pagamento), Resend (invio di e-mail), Google (accesso
          Google, se utilizzato). Alcuni di questi fornitori trattano dati
          all’estero, in particolare negli Stati Uniti; tali trasferimenti si
          basano su garanzie riconosciute (Swiss-U.S. Data Privacy Framework
          per i fornitori certificati o clausole contrattuali tipo).
        </p>
      ),
    },
    {
      title: "Cookie e memorizzazione locale",
      body: (
        <p>
          Il sito utilizza solo elementi tecnici indispensabili: un cookie di
          sessione per restare connessi al proprio conto e la memoria locale
          del browser per il carrello. Nessun cookie pubblicitario, nessun
          tracciante di terzi.
        </p>
      ),
    },
    {
      title: "Durata di conservazione",
      body: (
        <p>
          Conto: fino alla sua cancellazione da parte del cliente. Ordini:
          10 anni (obbligo di conservazione contabile, art. 958f CO).
          Richieste di preventivo e file 3D: cancellati al più tardi 2 anni
          dopo la fine del progetto o il rifiuto del preventivo.
        </p>
      ),
    },
    {
      title: "I vostri diritti",
      body: (
        <p>
          Conformemente agli art. 25 segg. nLPD, potete chiedere l’accesso ai
          vostri dati, la loro rettifica, la loro cancellazione o la loro
          consegna in un formato corrente, scrivendo a
          contact@swiss3design.ch. Potete inoltre rivolgervi all’Incaricato
          federale della protezione dei dati e della trasparenza (IFPDT).
          Rispondiamo in linea di principio entro 30 giorni e possiamo
          richiedere una prova d’identità prima di dar seguito, al fine di
          proteggere i vostri dati.
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
          Il negozio si rivolge a persone maggiorenni. I minori possono
          ordinare solo con il consenso del loro rappresentante legale. Non
          raccogliamo consapevolmente dati relativi a minori.
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
          (hashed, never in plain text) or Google sign-in identifier.{" "}
          <strong>Orders</strong>: delivery address, items, history.{" "}
          <strong>Payment</strong>: processed exclusively by Stripe; we
          neither see nor store any card data. <strong>Custom quotes</strong>:
          project description and 3D files submitted.{" "}
          <strong>Correspondence</strong>: e-mails and exchanges.{" "}
          <strong>Technical data</strong>: when you browse the site, your IP
          address, browser type and connection logs are processed
          automatically for security, abuse-prevention and proper operation of
          the site.
        </p>
      ),
    },
    {
      title: "Purposes",
      body: (
        <p>
          Fulfilling orders and quotes, managing the customer account, sending
          transactional e-mails (confirmation, shipping, quotes, account
          security), complying with legal obligations (accounting retention)
          and preventing abuse. No data is sold or used for advertising
          purposes. We do not send any advertising or marketing e-mails; you
          only receive transactional e-mails relating to your orders and your
          account.
        </p>
      ),
    },
    {
      title: "Profiling and automated decisions",
      body: (
        <p>
          We do not carry out any profiling or automated individual decisions
          producing legal effects concerning you or significantly affecting
          you.
        </p>
      ),
    },
    {
      title: "Processors and transfers",
      body: (
        <p>
          We use technical service providers: Cloudflare (hosting and
          database), Stripe (payment), Resend (e-mail delivery), Google
          (Google sign-in, if used). Some of these providers process data
          abroad, in particular in the United States; these transfers are
          based on recognised safeguards (Swiss-U.S. Data Privacy Framework for
          certified providers, or standard contractual clauses).
        </p>
      ),
    },
    {
      title: "Cookies and local storage",
      body: (
        <p>
          The site only uses strictly necessary technical elements: a session
          cookie to stay signed in to your account and the browser’s local
          storage for the cart. No advertising cookies, no third-party
          trackers.
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
          common format, by writing to contact@swiss3design.ch. You may also
          contact the Federal Data Protection and Information Commissioner
          (FDPIC). We generally respond within 30 days and may request proof of
          identity before acting, in order to protect your data.
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
