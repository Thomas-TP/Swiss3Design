import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Contenu éditorial de la page « À propos » dans les 4 langues. Même logique
// que les pages légales : le texte riche (JSX) vit ici, la page se contente de
// la mise en forme. Les libellés du formulaire de contact sont, eux, dans les
// fichiers messages/*.json (namespace « contact »), car le formulaire est un
// composant client qui utilise next-intl.

export interface AboutContent {
  metaTitle: string;
  metaDescription: string;

  badge: string;
  title: string;
  intro: ReactNode;

  stats: { value: string; label: string }[];

  equipmentKicker: string;
  equipmentTitle: string;
  equipmentText: ReactNode;
  specsTitle: string;
  specs: { label: string; value: string }[];

  processKicker: string;
  processTitle: string;
  steps: { title: string; text: string }[];

  materialsKicker: string;
  materialsTitle: string;
  materialsText: ReactNode;
  plaName: string;
  plaTagline: string;
  plaPoints: string[];
  materialsNote: ReactNode;

  trustKicker: string;
  trustTitle: string;
  trust: { title: string; text: string }[];

  faqKicker: string;
  faqTitle: string;
  faq: { q: string; a: ReactNode }[];

  contactKicker: string;
  contactTitle: string;
  contactText: ReactNode;
}

const link =
  "font-medium text-accent underline-offset-2 transition-colors hover:underline";

export const ABOUT_CONTENT: Record<Locale, AboutContent> = {
  fr: {
    metaTitle: "À propos — Swiss3Design",
    metaDescription:
      "L'atelier d'impression 3D Swiss3Design à Gland (VD) : notre matériel Bambu Lab P1S + AMS 2 Pro, notre procédé, nos matières et les réponses à vos questions.",

    badge: "Atelier à Gland (VD), Suisse",
    title: "Derrière chaque pièce, un atelier suisse.",
    intro: (
      <>
        Swiss3Design, c’est un atelier d’impression 3D basé à{" "}
        <strong>Gland</strong>, dans le canton de Vaud. Derrière chaque objet :
        une imprimante de précision, des matières choisies avec soin, et une
        personne qui contrôle chaque pièce à la main avant de vous l’envoyer.
        Pas d’usine, pas d’intermédiaire — de l’impression à la demande, pensée
        et fabriquée en Suisse.
      </>
    ),

    stats: [
      { value: "100 %", label: "fabriqué et contrôlé à Gland" },
      { value: "Jusqu’à 4", label: "couleurs dans une seule pièce" },
      { value: "2 ans", label: "de garantie légale" },
      { value: "48 h", label: "pour répondre à votre projet" },
    ],

    equipmentKicker: "Notre matériel",
    equipmentTitle: "Une Bambu Lab P1S, équipée de l’AMS 2 Pro.",
    equipmentText: (
      <>
        Toutes nos pièces sortent d’une <strong>Bambu Lab P1S</strong> équipée
        du système multi-filament <strong>AMS 2 Pro</strong>. C’est une
        imprimante CoreXY à enceinte fermée, rapide et précise, capable de
        combiner jusqu’à quatre couleurs dans un même objet. L’AMS 2 Pro garde
        aussi les filaments au sec, pour une qualité constante d’une impression
        à l’autre.
      </>
    ),
    specsTitle: "Fiche technique",
    specs: [
      { label: "Volume d’impression", value: "256 × 256 × 256 mm" },
      { label: "Couleurs simultanées", value: "Jusqu’à 4 (AMS 2 Pro)" },
      { label: "Hauteur de couche", value: "0,08 – 0,28 mm" },
      { label: "Buse", value: "0,4 mm" },
      { label: "Enceinte fermée", value: "Oui — châssis CoreXY rigide" },
      { label: "Séchage du filament", value: "Intégré à l’AMS 2 Pro" },
    ],

    processKicker: "Le procédé",
    processTitle: "De votre commande à votre boîte aux lettres.",
    steps: [
      {
        title: "Votre choix",
        text: "Vous commandez une pièce du catalogue ou vous nous confiez un projet sur mesure.",
      },
      {
        title: "Préparation",
        text: "On prépare le fichier, on choisit la matière et les couleurs, puis on règle l’impression au trancheur.",
      },
      {
        title: "Impression",
        text: "La P1S imprime votre pièce couche après couche ; l’AMS 2 Pro gère automatiquement jusqu’à 4 couleurs.",
      },
      {
        title: "Finition & contrôle",
        text: "Retrait des supports, nettoyage et contrôle qualité de chaque pièce, à la main.",
      },
      {
        title: "Emballage & envoi",
        text: "Emballage soigné et remise à la Poste suisse, avec numéro de suivi.",
      },
    ],

    materialsKicker: "Nos matières",
    materialsTitle: "La bonne matière pour le bon usage.",
    materialsText: (
      <>
        Le choix de la matière, c’est une grande partie du résultat. Nous
        travaillons une matière de prédilection, sélectionnée pour son rendu et
        sa fiabilité.
      </>
    ),
    plaName: "PLA",
    plaTagline: "Notre matière de prédilection",
    plaPoints: [
      "Rendu net et palette de couleurs très étendue — parfait pour le multicolore",
      "Idéal pour la décoration, les objets du quotidien et les détails fins",
      "Issu de ressources végétales, sans odeur à l’usage",
      "Stable et précis dans le temps, pour un usage intérieur",
    ],
    materialsNote: (
      <>
        Besoin de plus de résistance, d’un usage extérieur ou au contact de la
        chaleur ? D’autres matières comme le PETG sont disponibles sur devis —{" "}
        <Link href="/custom" className={link}>
          parlons de votre projet
        </Link>
        .
      </>
    ),

    trustKicker: "Qualité & engagements",
    trustTitle: "Ce sur quoi vous pouvez compter.",
    trust: [
      {
        title: "Fabriqué à Gland",
        text: "Chaque pièce est imprimée et contrôlée à la main dans notre atelier vaudois.",
      },
      {
        title: "Garantie 2 ans",
        text: "La garantie légale suisse s’applique. Un souci ? On répare, on remplace ou on rembourse.",
      },
      {
        title: "Paiement sécurisé",
        text: "TWINT, cartes, Apple Pay et Google Pay via Stripe. Vos données bancaires ne transitent jamais par nos serveurs.",
      },
      {
        title: "Livraison suivie",
        text: "Envoi par la Poste suisse, emballage soigné et numéro de suivi à chaque expédition.",
      },
    ],

    faqKicker: "Questions fréquentes",
    faqTitle: "Tout ce que vous vous demandez, sans détour.",
    faq: [
      {
        q: "Combien de temps pour recevoir ma commande ?",
        a: (
          <>
            Les pièces en stock sont remises à la Poste suisse sous 1 à 3 jours
            ouvrés. Les pièces imprimées à la demande partent après le délai de
            production indiqué sur la fiche produit. Vous recevez un numéro de
            suivi dès l’expédition.
          </>
        ),
      },
      {
        q: "C’est quoi l’impression 3D multicolore ?",
        a: (
          <>
            Grâce au système AMS 2 Pro, l’imprimante combine jusqu’à 4 filaments
            dans une même pièce : les couleurs sont intégrées à l’impression,
            sans peinture ni assemblage. Le résultat sort net, directement de la
            machine.
          </>
        ),
      },
      {
        q: "Quelle matière utilisez-vous ?",
        a: (
          <>
            Nous imprimons principalement en PLA, idéal pour la déco et les
            objets du quotidien, avec une très large palette de couleurs. Pour
            un besoin spécifique, d’autres matières comme le PETG sont possibles
            via une{" "}
            <Link href="/custom" className={link}>
              demande sur mesure
            </Link>
            .
          </>
        ),
      },
      {
        q: "Les objets sont-ils solides ?",
        a: (
          <>
            Oui, pour un usage normal d’intérieur et de décoration. Le PLA est
            rigide et précis ; il n’est simplement pas conçu pour de fortes
            contraintes mécaniques ou une chaleur élevée. Pour ces cas, on vous
            oriente vers une matière adaptée.
          </>
        ),
      },
      {
        q: "Pourquoi voit-on de fines lignes sur la pièce ?",
        a: (
          <>
            L’impression 3D dépose la matière couche après couche : de légères
            lignes ou de subtiles variations de teinte font partie du charme de
            la fabrication artisanale et ne constituent pas un défaut.
          </>
        ),
      },
      {
        q: "Le PLA craint-il la chaleur ?",
        a: (
          <>
            Le PLA se ramollit autour de 50–60 °C. Évitez de laisser une pièce
            dans une voiture en plein soleil ou contre une source de chaleur.
            Pour un objet exposé à la chaleur, demandez-nous le PETG.
          </>
        ),
      },
      {
        q: "Puis-je faire imprimer mon propre modèle ?",
        a: (
          <>
            Bien sûr. Envoyez-nous votre fichier (STL, 3MF, OBJ ou STEP) ou
            décrivez votre idée depuis la page{" "}
            <Link href="/custom" className={link}>
              Sur mesure
            </Link>{" "}
            : vous recevez un devis personnalisé sous 48 h.
          </>
        ),
      },
      {
        q: "Comment payer ? Est-ce sécurisé ?",
        a: (
          <>
            Le paiement se fait via Stripe : TWINT, cartes, Apple Pay et Google
            Pay. La transaction est chiffrée et vos données bancaires ne
            transitent jamais par nos serveurs.
          </>
        ),
      },
      {
        q: "Livrez-vous hors de Suisse ?",
        a: (
          <>
            Pour l’instant, nous livrons uniquement en Suisse, par la Poste
            suisse. Vous avez un projet particulier ? Écrivez-nous, on regarde
            ce qu’on peut faire.
          </>
        ),
      },
      {
        q: "Un article ne me convient pas ou arrive abîmé ?",
        a: (
          <>
            Écrivez-nous tout de suite, photos à l’appui. Vous bénéficiez de la
            garantie légale de 2 ans, et les articles de catalogue non
            personnalisés peuvent être retournés sous 14 jours. On trouve
            toujours une solution.
          </>
        ),
      },
    ],

    contactKicker: "Contact",
    contactTitle: "Une question ? Parlons-en.",
    contactText: (
      <>
        Un doute avant de commander, une idée de projet ou une remarque sur une
        pièce reçue ? Écrivez-nous : nous répondons généralement sous 24 à 48 h.
      </>
    ),
  },

  de: {
    metaTitle: "Über uns — Swiss3Design",
    metaDescription:
      "Das 3D-Druck-Atelier Swiss3Design in Gland (VD): unsere Bambu Lab P1S + AMS 2 Pro, unser Verfahren, unsere Materialien und Antworten auf Ihre Fragen.",

    badge: "Atelier in Gland (VD), Schweiz",
    title: "Hinter jedem Stück steht ein Schweizer Atelier.",
    intro: (
      <>
        Swiss3Design ist ein 3D-Druck-Atelier in <strong>Gland</strong>, im
        Kanton Waadt. Hinter jedem Objekt: ein Präzisionsdrucker, sorgfältig
        ausgewählte Materialien und ein Mensch, der jedes Stück von Hand
        kontrolliert, bevor es zu Ihnen kommt. Keine Fabrik, keine
        Zwischenhändler — Druck auf Bestellung, in der Schweiz gedacht und
        gefertigt.
      </>
    ),

    stats: [
      { value: "100 %", label: "in Gland gefertigt und kontrolliert" },
      { value: "Bis zu 4", label: "Farben in einem einzigen Stück" },
      { value: "2 Jahre", label: "gesetzliche Gewährleistung" },
      { value: "48 Std.", label: "für eine Antwort auf Ihr Projekt" },
    ],

    equipmentKicker: "Unser Material",
    equipmentTitle: "Eine Bambu Lab P1S mit AMS 2 Pro.",
    equipmentText: (
      <>
        Alle unsere Stücke entstehen auf einer <strong>Bambu Lab P1S</strong>{" "}
        mit dem Mehrfilament-System <strong>AMS 2 Pro</strong>. Ein
        geschlossener CoreXY-Drucker, schnell und präzise, der bis zu vier
        Farben in einem Objekt vereinen kann. Die AMS 2 Pro hält die Filamente
        ausserdem trocken — für gleichbleibende Qualität, Druck für Druck.
      </>
    ),
    specsTitle: "Technische Daten",
    specs: [
      { label: "Bauraum", value: "256 × 256 × 256 mm" },
      { label: "Gleichzeitige Farben", value: "Bis zu 4 (AMS 2 Pro)" },
      { label: "Schichthöhe", value: "0,08 – 0,28 mm" },
      { label: "Düse", value: "0,4 mm" },
      { label: "Geschlossenes Gehäuse", value: "Ja — steifes CoreXY-Chassis" },
      { label: "Filamenttrocknung", value: "In der AMS 2 Pro integriert" },
    ],

    processKicker: "Das Verfahren",
    processTitle: "Von Ihrer Bestellung bis zu Ihrem Briefkasten.",
    steps: [
      {
        title: "Ihre Wahl",
        text: "Sie bestellen ein Stück aus dem Katalog oder vertrauen uns ein individuelles Projekt an.",
      },
      {
        title: "Vorbereitung",
        text: "Wir bereiten die Datei vor, wählen Material und Farben und richten den Druck im Slicer ein.",
      },
      {
        title: "Druck",
        text: "Die P1S druckt Ihr Stück Schicht für Schicht; die AMS 2 Pro steuert automatisch bis zu 4 Farben.",
      },
      {
        title: "Finish & Kontrolle",
        text: "Entfernen der Stützen, Reinigung und Qualitätskontrolle jedes Stücks — von Hand.",
      },
      {
        title: "Verpackung & Versand",
        text: "Sorgfältige Verpackung und Übergabe an die Schweizer Post, mit Sendungsnummer.",
      },
    ],

    materialsKicker: "Unsere Materialien",
    materialsTitle: "Das richtige Material für den richtigen Zweck.",
    materialsText: (
      <>
        Die Materialwahl macht einen grossen Teil des Ergebnisses aus. Wir
        arbeiten mit einem bevorzugten Material, ausgewählt für sein
        Erscheinungsbild und seine Zuverlässigkeit.
      </>
    ),
    plaName: "PLA",
    plaTagline: "Unser bevorzugtes Material",
    plaPoints: [
      "Sauberes Ergebnis und sehr grosse Farbpalette — ideal für mehrfarbige Drucke",
      "Ideal für Dekoration, Alltagsobjekte und feine Details",
      "Aus pflanzlichen Rohstoffen, im Gebrauch geruchsneutral",
      "Stabil und massgenau über die Zeit, für den Innengebrauch",
    ],
    materialsNote: (
      <>
        Mehr Festigkeit nötig, Einsatz im Freien oder bei Wärme? Andere
        Materialien wie PETG sind auf Offerte verfügbar —{" "}
        <Link href="/custom" className={link}>
          sprechen wir über Ihr Projekt
        </Link>
        .
      </>
    ),

    trustKicker: "Qualität & Zusagen",
    trustTitle: "Worauf Sie sich verlassen können.",
    trust: [
      {
        title: "In Gland gefertigt",
        text: "Jedes Stück wird in unserem Waadtländer Atelier von Hand gedruckt und kontrolliert.",
      },
      {
        title: "2 Jahre Gewährleistung",
        text: "Die gesetzliche Schweizer Gewährleistung gilt. Ein Problem? Wir reparieren, ersetzen oder erstatten.",
      },
      {
        title: "Sichere Zahlung",
        text: "TWINT, Karten, Apple Pay und Google Pay über Stripe. Ihre Kartendaten laufen nie über unsere Server.",
      },
      {
        title: "Verfolgbare Lieferung",
        text: "Versand mit der Schweizer Post, sorgfältige Verpackung und Sendungsnummer bei jedem Versand.",
      },
    ],

    faqKicker: "Häufige Fragen",
    faqTitle: "Alles, was Sie wissen möchten — direkt beantwortet.",
    faq: [
      {
        q: "Wie lange dauert es bis zur Lieferung?",
        a: (
          <>
            Lagerartikel werden innert 1 bis 3 Werktagen der Schweizer Post
            übergeben. Auf Bestellung gedruckte Stücke gehen nach der auf der
            Produktseite angegebenen Produktionszeit raus. Sie erhalten eine
            Sendungsnummer ab Versand.
          </>
        ),
      },
      {
        q: "Was ist mehrfarbiger 3D-Druck?",
        a: (
          <>
            Dank des AMS-2-Pro-Systems vereint der Drucker bis zu 4 Filamente in
            einem Stück: Die Farben sind Teil des Drucks, ohne Lackieren oder
            Zusammenbauen. Das Ergebnis kommt sauber direkt aus der Maschine.
          </>
        ),
      },
      {
        q: "Welches Material verwenden Sie?",
        a: (
          <>
            Wir drucken hauptsächlich mit PLA, ideal für Deko und
            Alltagsobjekte, mit einer sehr grossen Farbpalette. Für besondere
            Bedürfnisse sind andere Materialien wie PETG über eine{" "}
            <Link href="/custom" className={link}>
              Massanfertigung
            </Link>{" "}
            möglich.
          </>
        ),
      },
      {
        q: "Sind die Objekte stabil?",
        a: (
          <>
            Ja, für den normalen Innen- und Dekogebrauch. PLA ist steif und
            präzise; es ist einfach nicht für hohe mechanische Belastungen oder
            grosse Hitze gemacht. Dafür empfehlen wir Ihnen ein passendes
            Material.
          </>
        ),
      },
      {
        q: "Warum sieht man feine Linien auf dem Stück?",
        a: (
          <>
            Der 3D-Druck trägt das Material Schicht für Schicht auf: leichte
            Linien oder feine Farbabweichungen gehören zum Charme der
            handwerklichen Fertigung und sind kein Mangel.
          </>
        ),
      },
      {
        q: "Verträgt PLA Hitze?",
        a: (
          <>
            PLA wird um die 50–60 °C weich. Lassen Sie ein Stück nicht in einem
            Auto in der prallen Sonne oder an einer Wärmequelle. Für ein der
            Hitze ausgesetztes Objekt fragen Sie uns nach PETG.
          </>
        ),
      },
      {
        q: "Kann ich mein eigenes Modell drucken lassen?",
        a: (
          <>
            Selbstverständlich. Senden Sie uns Ihre Datei (STL, 3MF, OBJ oder
            STEP) oder beschreiben Sie Ihre Idee auf der Seite{" "}
            <Link href="/custom" className={link}>
              Massanfertigung
            </Link>
            : Sie erhalten innert 48 Std. eine persönliche Offerte.
          </>
        ),
      },
      {
        q: "Wie bezahle ich? Ist das sicher?",
        a: (
          <>
            Die Zahlung erfolgt über Stripe: TWINT, Karten, Apple Pay und Google
            Pay. Die Transaktion ist verschlüsselt und Ihre Kartendaten laufen
            nie über unsere Server.
          </>
        ),
      },
      {
        q: "Liefern Sie ausserhalb der Schweiz?",
        a: (
          <>
            Derzeit liefern wir nur innerhalb der Schweiz, mit der Schweizer
            Post. Sie haben ein besonderes Vorhaben? Schreiben Sie uns, wir
            schauen, was möglich ist.
          </>
        ),
      },
      {
        q: "Ein Artikel passt nicht oder kommt beschädigt an?",
        a: (
          <>
            Schreiben Sie uns sofort, mit Fotos. Sie haben die gesetzliche
            Gewährleistung von 2 Jahren, und nicht personalisierte
            Katalogartikel können innert 14 Tagen zurückgesendet werden. Wir
            finden immer eine Lösung.
          </>
        ),
      },
    ],

    contactKicker: "Kontakt",
    contactTitle: "Eine Frage? Sprechen wir darüber.",
    contactText: (
      <>
        Ein Zweifel vor der Bestellung, eine Projektidee oder eine Anmerkung zu
        einem erhaltenen Stück? Schreiben Sie uns: Wir antworten in der Regel
        innert 24 bis 48 Std.
      </>
    ),
  },

  it: {
    metaTitle: "Chi siamo — Swiss3Design",
    metaDescription:
      "L’atelier di stampa 3D Swiss3Design a Gland (VD): la nostra Bambu Lab P1S + AMS 2 Pro, il nostro procedimento, i materiali e le risposte alle vostre domande.",

    badge: "Atelier a Gland (VD), Svizzera",
    title: "Dietro ogni pezzo, un atelier svizzero.",
    intro: (
      <>
        Swiss3Design è un atelier di stampa 3D con sede a <strong>Gland</strong>
        , nel Cantone di Vaud. Dietro ogni oggetto: una stampante di precisione,
        materiali scelti con cura e una persona che controlla ogni pezzo a mano
        prima di spedirvelo. Nessuna fabbrica, nessun intermediario — stampa su
        richiesta, pensata e realizzata in Svizzera.
      </>
    ),

    stats: [
      { value: "100 %", label: "fabbricato e controllato a Gland" },
      { value: "Fino a 4", label: "colori in un solo pezzo" },
      { value: "2 anni", label: "di garanzia legale" },
      { value: "48 h", label: "per rispondere al vostro progetto" },
    ],

    equipmentKicker: "Il nostro materiale",
    equipmentTitle: "Una Bambu Lab P1S, con AMS 2 Pro.",
    equipmentText: (
      <>
        Tutti i nostri pezzi escono da una <strong>Bambu Lab P1S</strong> dotata
        del sistema multi-filamento <strong>AMS 2 Pro</strong>. È una stampante
        CoreXY a camera chiusa, rapida e precisa, capace di combinare fino a
        quattro colori in uno stesso oggetto. L’AMS 2 Pro mantiene inoltre i
        filamenti asciutti, per una qualità costante a ogni stampa.
      </>
    ),
    specsTitle: "Scheda tecnica",
    specs: [
      { label: "Volume di stampa", value: "256 × 256 × 256 mm" },
      { label: "Colori simultanei", value: "Fino a 4 (AMS 2 Pro)" },
      { label: "Altezza dello strato", value: "0,08 – 0,28 mm" },
      { label: "Ugello", value: "0,4 mm" },
      { label: "Camera chiusa", value: "Sì — telaio CoreXY rigido" },
      { label: "Essiccazione del filamento", value: "Integrata nell’AMS 2 Pro" },
    ],

    processKicker: "Il procedimento",
    processTitle: "Dal vostro ordine alla vostra cassetta delle lettere.",
    steps: [
      {
        title: "La vostra scelta",
        text: "Ordinate un pezzo dal catalogo o ci affidate un progetto su misura.",
      },
      {
        title: "Preparazione",
        text: "Prepariamo il file, scegliamo il materiale e i colori, poi impostiamo la stampa nello slicer.",
      },
      {
        title: "Stampa",
        text: "La P1S stampa il vostro pezzo strato dopo strato; l’AMS 2 Pro gestisce automaticamente fino a 4 colori.",
      },
      {
        title: "Finitura & controllo",
        text: "Rimozione dei supporti, pulizia e controllo qualità di ogni pezzo, a mano.",
      },
      {
        title: "Imballaggio & spedizione",
        text: "Imballaggio curato e consegna alla Posta svizzera, con numero di tracciamento.",
      },
    ],

    materialsKicker: "I nostri materiali",
    materialsTitle: "Il materiale giusto per l’uso giusto.",
    materialsText: (
      <>
        La scelta del materiale è gran parte del risultato. Lavoriamo un
        materiale di riferimento, selezionato per la sua resa e la sua
        affidabilità.
      </>
    ),
    plaName: "PLA",
    plaTagline: "Il nostro materiale di riferimento",
    plaPoints: [
      "Resa nitida e palette di colori molto ampia — perfetto per il multicolore",
      "Ideale per la decorazione, gli oggetti di tutti i giorni e i dettagli fini",
      "Ricavato da risorse vegetali, inodore all’uso",
      "Stabile e preciso nel tempo, per uso interno",
    ],
    materialsNote: (
      <>
        Serve più resistenza, un uso esterno o a contatto con il calore? Altri
        materiali come il PETG sono disponibili su preventivo —{" "}
        <Link href="/custom" className={link}>
          parliamo del vostro progetto
        </Link>
        .
      </>
    ),

    trustKicker: "Qualità & impegni",
    trustTitle: "Su cosa potete contare.",
    trust: [
      {
        title: "Fabbricato a Gland",
        text: "Ogni pezzo è stampato e controllato a mano nel nostro atelier vodese.",
      },
      {
        title: "Garanzia 2 anni",
        text: "Si applica la garanzia legale svizzera. Un problema? Ripariamo, sostituiamo o rimborsiamo.",
      },
      {
        title: "Pagamento sicuro",
        text: "TWINT, carte, Apple Pay e Google Pay tramite Stripe. I vostri dati bancari non passano mai dai nostri server.",
      },
      {
        title: "Consegna tracciata",
        text: "Spedizione con la Posta svizzera, imballaggio curato e numero di tracciamento a ogni invio.",
      },
    ],

    faqKicker: "Domande frequenti",
    faqTitle: "Tutto quello che vi chiedete, senza giri di parole.",
    faq: [
      {
        q: "Quanto tempo per ricevere il mio ordine?",
        a: (
          <>
            I pezzi a magazzino vengono affidati alla Posta svizzera entro 1–3
            giorni lavorativi. I pezzi stampati su richiesta partono dopo il
            tempo di produzione indicato nella scheda prodotto. Ricevete un
            numero di tracciamento alla spedizione.
          </>
        ),
      },
      {
        q: "Cos’è la stampa 3D multicolore?",
        a: (
          <>
            Grazie al sistema AMS 2 Pro, la stampante combina fino a 4 filamenti
            in uno stesso pezzo: i colori sono integrati nella stampa, senza
            vernice né assemblaggio. Il risultato esce nitido, direttamente
            dalla macchina.
          </>
        ),
      },
      {
        q: "Quale materiale utilizzate?",
        a: (
          <>
            Stampiamo principalmente in PLA, ideale per la decorazione e gli
            oggetti di tutti i giorni, con una palette di colori molto ampia.
            Per esigenze specifiche, altri materiali come il PETG sono possibili
            tramite una{" "}
            <Link href="/custom" className={link}>
              richiesta su misura
            </Link>
            .
          </>
        ),
      },
      {
        q: "Gli oggetti sono solidi?",
        a: (
          <>
            Sì, per un normale uso interno e decorativo. Il PLA è rigido e
            preciso; semplicemente non è concepito per forti sollecitazioni
            meccaniche o calore elevato. In quei casi vi orientiamo verso un
            materiale adatto.
          </>
        ),
      },
      {
        q: "Perché si vedono delle linee sottili sul pezzo?",
        a: (
          <>
            La stampa 3D deposita il materiale strato dopo strato: leggere linee
            o sottili variazioni di tonalità fanno parte del fascino della
            fabbricazione artigianale e non costituiscono un difetto.
          </>
        ),
      },
      {
        q: "Il PLA teme il calore?",
        a: (
          <>
            Il PLA si ammorbidisce intorno ai 50–60 °C. Evitate di lasciare un
            pezzo in un’auto al sole o vicino a una fonte di calore. Per un
            oggetto esposto al calore, chiedeteci il PETG.
          </>
        ),
      },
      {
        q: "Posso far stampare il mio modello?",
        a: (
          <>
            Certo. Inviateci il vostro file (STL, 3MF, OBJ o STEP) o descrivete
            la vostra idea dalla pagina{" "}
            <Link href="/custom" className={link}>
              Su misura
            </Link>
            : ricevete un preventivo personalizzato entro 48 h.
          </>
        ),
      },
      {
        q: "Come si paga? È sicuro?",
        a: (
          <>
            Il pagamento avviene tramite Stripe: TWINT, carte, Apple Pay e
            Google Pay. La transazione è cifrata e i vostri dati bancari non
            passano mai dai nostri server.
          </>
        ),
      },
      {
        q: "Spedite fuori dalla Svizzera?",
        a: (
          <>
            Per ora consegniamo solo in Svizzera, tramite la Posta svizzera.
            Avete un progetto particolare? Scriveteci, vediamo cosa possiamo
            fare.
          </>
        ),
      },
      {
        q: "Un articolo non mi soddisfa o arriva danneggiato?",
        a: (
          <>
            Scriveteci subito, con delle foto. Beneficiate della garanzia legale
            di 2 anni, e gli articoli di catalogo non personalizzati possono
            essere restituiti entro 14 giorni. Troviamo sempre una soluzione.
          </>
        ),
      },
    ],

    contactKicker: "Contatto",
    contactTitle: "Una domanda? Parliamone.",
    contactText: (
      <>
        Un dubbio prima di ordinare, un’idea di progetto o un’osservazione su un
        pezzo ricevuto? Scriveteci: rispondiamo di solito entro 24–48 h.
      </>
    ),
  },

  en: {
    metaTitle: "About — Swiss3Design",
    metaDescription:
      "The Swiss3Design 3D-printing workshop in Gland (VD): our Bambu Lab P1S + AMS 2 Pro, our process, our materials and answers to your questions.",

    badge: "Workshop in Gland (VD), Switzerland",
    title: "Behind every piece, a Swiss workshop.",
    intro: (
      <>
        Swiss3Design is a 3D-printing workshop based in <strong>Gland</strong>,
        in the canton of Vaud. Behind every object: a precision printer,
        carefully chosen materials, and a person who checks every piece by hand
        before sending it to you. No factory, no middleman — print on demand,
        designed and made in Switzerland.
      </>
    ),

    stats: [
      { value: "100%", label: "made and checked in Gland" },
      { value: "Up to 4", label: "colours in a single piece" },
      { value: "2 years", label: "statutory warranty" },
      { value: "48 h", label: "to reply to your project" },
    ],

    equipmentKicker: "Our equipment",
    equipmentTitle: "A Bambu Lab P1S, fitted with the AMS 2 Pro.",
    equipmentText: (
      <>
        All our pieces come off a <strong>Bambu Lab P1S</strong> fitted with the{" "}
        <strong>AMS 2 Pro</strong> multi-filament system. It’s an enclosed
        CoreXY printer, fast and precise, able to combine up to four colours in
        a single object. The AMS 2 Pro also keeps the filaments dry, for
        consistent quality from one print to the next.
      </>
    ),
    specsTitle: "Specifications",
    specs: [
      { label: "Build volume", value: "256 × 256 × 256 mm" },
      { label: "Simultaneous colours", value: "Up to 4 (AMS 2 Pro)" },
      { label: "Layer height", value: "0.08 – 0.28 mm" },
      { label: "Nozzle", value: "0.4 mm" },
      { label: "Enclosed chamber", value: "Yes — rigid CoreXY frame" },
      { label: "Filament drying", value: "Built into the AMS 2 Pro" },
    ],

    processKicker: "The process",
    processTitle: "From your order to your letterbox.",
    steps: [
      {
        title: "Your choice",
        text: "You order a piece from the catalogue or hand us a custom project.",
      },
      {
        title: "Preparation",
        text: "We prepare the file, choose the material and colours, then set up the print in the slicer.",
      },
      {
        title: "Printing",
        text: "The P1S prints your piece layer by layer; the AMS 2 Pro automatically handles up to 4 colours.",
      },
      {
        title: "Finishing & checks",
        text: "Removing supports, cleaning and a quality check on every piece — by hand.",
      },
      {
        title: "Packing & shipping",
        text: "Careful packaging and hand-off to Swiss Post, with a tracking number.",
      },
    ],

    materialsKicker: "Our materials",
    materialsTitle: "The right material for the right use.",
    materialsText: (
      <>
        The choice of material is a large part of the result. We work with one
        material of choice, selected for its finish and reliability.
      </>
    ),
    plaName: "PLA",
    plaTagline: "Our material of choice",
    plaPoints: [
      "Clean finish and a very wide colour palette — perfect for multicolour",
      "Ideal for décor, everyday objects and fine details",
      "Made from plant-based resources, odourless in use",
      "Stable and accurate over time, for indoor use",
    ],
    materialsNote: (
      <>
        Need more strength, outdoor use or heat resistance? Other materials such
        as PETG are available on quote —{" "}
        <Link href="/custom" className={link}>
          let’s talk about your project
        </Link>
        .
      </>
    ),

    trustKicker: "Quality & commitments",
    trustTitle: "What you can rely on.",
    trust: [
      {
        title: "Made in Gland",
        text: "Every piece is printed and checked by hand in our Vaud workshop.",
      },
      {
        title: "2-year warranty",
        text: "The Swiss statutory warranty applies. A problem? We repair, replace or refund.",
      },
      {
        title: "Secure payment",
        text: "TWINT, cards, Apple Pay and Google Pay via Stripe. Your card details never pass through our servers.",
      },
      {
        title: "Tracked delivery",
        text: "Shipping with Swiss Post, careful packaging and a tracking number on every order.",
      },
    ],

    faqKicker: "Frequently asked questions",
    faqTitle: "Everything you’re wondering — straight to the point.",
    faq: [
      {
        q: "How long until I receive my order?",
        a: (
          <>
            In-stock pieces are handed to Swiss Post within 1 to 3 business
            days. Made-to-order pieces ship after the production time shown on
            the product page. You get a tracking number as soon as it ships.
          </>
        ),
      },
      {
        q: "What is multicolour 3D printing?",
        a: (
          <>
            Thanks to the AMS 2 Pro system, the printer combines up to 4
            filaments in a single piece: the colours are part of the print, with
            no painting or assembly. The result comes out clean, straight from
            the machine.
          </>
        ),
      },
      {
        q: "Which material do you use?",
        a: (
          <>
            We print mainly in PLA, ideal for décor and everyday objects, with a
            very wide colour palette. For specific needs, other materials such
            as PETG are possible through a{" "}
            <Link href="/custom" className={link}>
              custom request
            </Link>
            .
          </>
        ),
      },
      {
        q: "Are the objects sturdy?",
        a: (
          <>
            Yes, for normal indoor and decorative use. PLA is rigid and precise;
            it’s simply not designed for heavy mechanical stress or high heat.
            For those cases, we’ll point you to a suitable material.
          </>
        ),
      },
      {
        q: "Why are there fine lines on the piece?",
        a: (
          <>
            3D printing lays down material layer by layer: slight lines or
            subtle shade variations are part of the charm of handcrafted making
            and are not a defect.
          </>
        ),
      },
      {
        q: "Is PLA sensitive to heat?",
        a: (
          <>
            PLA softens at around 50–60 °C. Avoid leaving a piece in a car in
            full sun or against a heat source. For an object exposed to heat,
            ask us about PETG.
          </>
        ),
      },
      {
        q: "Can I have my own model printed?",
        a: (
          <>
            Of course. Send us your file (STL, 3MF, OBJ or STEP) or describe
            your idea from the{" "}
            <Link href="/custom" className={link}>
              Custom
            </Link>{" "}
            page: you’ll get a personalised quote within 48 hours.
          </>
        ),
      },
      {
        q: "How do I pay? Is it secure?",
        a: (
          <>
            Payment is made via Stripe: TWINT, cards, Apple Pay and Google Pay.
            The transaction is encrypted and your card details never pass
            through our servers.
          </>
        ),
      },
      {
        q: "Do you ship outside Switzerland?",
        a: (
          <>
            For now, we deliver within Switzerland only, by Swiss Post. Got a
            special project? Write to us and we’ll see what we can do.
          </>
        ),
      },
      {
        q: "An item isn’t right or arrives damaged?",
        a: (
          <>
            Write to us right away, with photos. You have the 2-year statutory
            warranty, and non-customised catalogue items can be returned within
            14 days. We always find a solution.
          </>
        ),
      },
    ],

    contactKicker: "Contact",
    contactTitle: "A question? Let’s talk.",
    contactText: (
      <>
        A doubt before ordering, a project idea or feedback on a piece you
        received? Write to us: we usually reply within 24 to 48 hours.
      </>
    ),
  },
};
