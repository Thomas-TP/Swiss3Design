import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ShowcasePrinter } from "./printer-showcase";

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
  /** Invite affichée sous le schéma (« survolez un repère… »). */
  legendHint: string;
  /** Le parc machine : une entrée par imprimante, dans l'ordre d'affichage. */
  printers: ShowcasePrinter[];

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
      "Les ateliers d'impression 3D Swiss3Design dans l'arc lémanique : nos deux machines multicolores, notre procédé, nos matières et les réponses à vos questions.",

    badge: "Deux ateliers dans l’arc lémanique",
    title: "Derrière chaque pièce, deux ateliers suisses.",
    intro: (
      <>
        Swiss3Design, ce sont deux ateliers d’impression 3D dans{" "}
        <strong>l’arc lémanique</strong>, entre Gland et Pully. Deux machines
        multicolores, des matières choisies avec soin, et à chaque fois
        quelqu’un qui contrôle la pièce à la main avant de vous l’envoyer. Pas
        d’usine, pas d’intermédiaire — de l’impression à la demande, pensée et
        fabriquée en Suisse.
      </>
    ),

    stats: [
      { value: "2", label: "ateliers dans l’arc lémanique" },
      { value: "Jusqu’à 4", label: "couleurs dans une seule pièce" },
      { value: "2 ans", label: "de garantie légale" },
      { value: "48 h", label: "pour répondre à votre projet" },
    ],

    equipmentKicker: "Notre matériel",
    equipmentTitle: "Deux machines multicolores, deux ateliers.",
    equipmentText: (
      <>
        Nos pièces sortent de deux imprimantes à enceinte fermée, chacune
        équipée de son propre système multi-filament : une{" "}
        <strong>Bambu Lab P1S</strong> à Gland et une{" "}
        <strong>Creality K2</strong> à Pully. Toutes deux combinent jusqu’à
        quatre couleurs dans un même objet et gardent les filaments à l’abri de
        l’humidité — c’est ce qui donne une qualité constante d’une impression à
        l’autre, quel que soit l’atelier qui la lance.
      </>
    ),
    specsTitle: "Fiche technique",
    legendHint: "Survolez un repère du schéma pour situer la pièce",
    printers: [
      {
        variant: "p1s",
        name: "Bambu Lab P1S",
        sub: "+ AMS 2 Pro",
        place: "Atelier de Gland (VD)",
        blurb:
          "Une CoreXY à enceinte fermée, rapide et régulière. C’est la machine historique de l’atelier : celle sur laquelle le catalogue a été mis au point.",
        callouts: [
          {
            label: "AMS 2 Pro",
            text: "Quatre bobines chargées en permanence. Le système change de filament seul en cours d’impression et les garde au sec.",
          },
          {
            label: "Écran + molette",
            text: "Le pilotage direct : lancer, mettre en pause, surveiller les températures sans passer par un ordinateur.",
          },
          {
            label: "Tête d’impression",
            text: "Buse 0,4 mm montée sur un portique CoreXY — précise même à vitesse élevée.",
          },
          {
            label: "Enceinte fermée",
            text: "Elle stabilise la température et coupe les courants d’air : c’est ce qui évite les décollements sur les grandes pièces.",
          },
          {
            label: "Plateau chauffant",
            text: "Il fait adhérer la première couche, puis libère la pièce en refroidissant. Surface texturée PEI.",
          },
        ],
        specs: [
          { label: "Volume d’impression", value: "256 × 256 × 256 mm" },
          { label: "Couleurs simultanées", value: "Jusqu’à 4 (AMS 2 Pro)" },
          { label: "Hauteur de couche", value: "0,08 – 0,28 mm" },
          { label: "Buse", value: "0,4 mm" },
          { label: "Enceinte fermée", value: "Oui — châssis CoreXY" },
          { label: "Séchage du filament", value: "Intégré à l’AMS 2 Pro" },
          { label: "Encombrement", value: "389 × 389 × 458 mm" },
        ],
      },
      {
        variant: "k2",
        name: "Creality K2",
        sub: "+ CFS",
        place: "Atelier de Pully (VD)",
        blurb:
          "Plus haute, plus rapide, avec un caisson à filament étanche. Elle double la capacité de production et prend le relais sur les séries.",
        callouts: [
          {
            label: "Creality CFS",
            text: "Quatre bobines dans un caisson étanche, température et humidité affichées. La puce RFID annonce la matière et la couleur à la machine.",
          },
          {
            label: "Écran tactile",
            text: "Grand écran couleur en façade : file d’impression, réglages et caméra de chambre, directement sur la machine.",
          },
          {
            label: "Tête d’impression",
            text: "Extrudeur direct, buse 0,4 mm jusqu’à 300 °C, et des pointes à 600 mm/s.",
          },
          {
            label: "Enceinte fermée",
            text: "Chambre close et filtrée : elle garde la chaleur et retient les particules pendant l’impression.",
          },
          {
            label: "Plateau chauffant",
            text: "260 × 260 mm, avec mise à niveau automatique avant chaque impression.",
          },
        ],
        specs: [
          { label: "Volume d’impression", value: "260 × 260 × 260 mm" },
          { label: "Couleurs simultanées", value: "Jusqu’à 4 (CFS)" },
          { label: "Hauteur de couche", value: "0,05 – 0,3 mm" },
          { label: "Buse", value: "0,4 mm — jusqu’à 300 °C" },
          { label: "Vitesse maximale", value: "600 mm/s" },
          { label: "Stockage filament", value: "CFS étanche, hygrométrie affichée" },
          { label: "Encombrement", value: "404 × 436 × 545 mm" },
        ],
      },
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
        text: "L’un des deux ateliers imprime votre pièce couche après couche ; le système multi-filament gère seul jusqu’à 4 couleurs.",
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
        title: "Fabriqué dans l’arc lémanique",
        text: "Chaque pièce est imprimée et contrôlée à la main dans l’un de nos deux ateliers vaudois.",
      },
      {
        title: "Garantie 2 ans",
        text: "La garantie légale suisse s’applique. Un souci ? On répare, on remplace ou on rembourse.",
      },
      {
        title: "Paiement sécurisé",
        text: "TWINT, cartes et Google Pay via Stripe. Vos données bancaires ne transitent jamais par nos serveurs.",
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
            Nos deux machines sont équipées d’un système multi-filament (AMS 2
            Pro sur la Bambu Lab, CFS sur la Creality). L’imprimante combine
            jusqu’à 4 filaments dans une même pièce : les couleurs sont
            intégrées à l’impression, sans peinture ni assemblage. Le résultat
            sort net, directement de la machine.
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
            Le paiement se fait via Stripe : TWINT, cartes et Google Pay. La
            transaction est chiffrée et vos données bancaires ne transitent
            jamais par nos serveurs.
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
      "Die 3D-Druck-Ateliers von Swiss3Design in der Genferseeregion: unsere zwei Mehrfarbdrucker, unser Verfahren, unsere Materialien und Antworten auf Ihre Fragen.",

    badge: "Zwei Ateliers in der Genferseeregion",
    title: "Hinter jedem Stück stehen zwei Schweizer Ateliers.",
    intro: (
      <>
        Swiss3Design, das sind zwei 3D-Druck-Ateliers in der{" "}
        <strong>Genferseeregion</strong>, zwischen Gland und Pully. Zwei
        Mehrfarbdrucker, sorgfältig ausgewählte Materialien und jedes Mal ein
        Mensch, der das Stück von Hand kontrolliert, bevor es zu Ihnen kommt.
        Keine Fabrik, keine Zwischenhändler — Druck auf Bestellung, in der
        Schweiz gedacht und gefertigt.
      </>
    ),

    stats: [
      { value: "2", label: "Ateliers in der Genferseeregion" },
      { value: "Bis zu 4", label: "Farben in einem einzigen Stück" },
      { value: "2 Jahre", label: "gesetzliche Gewährleistung" },
      { value: "48 Std.", label: "für eine Antwort auf Ihr Projekt" },
    ],

    equipmentKicker: "Unser Material",
    equipmentTitle: "Zwei Mehrfarbdrucker, zwei Ateliers.",
    equipmentText: (
      <>
        Unsere Stücke entstehen auf zwei geschlossenen Druckern, jeder mit
        seinem eigenen Mehrfilament-System: einer <strong>Bambu Lab P1S</strong>{" "}
        in Gland und einer <strong>Creality K2</strong> in Pully. Beide
        vereinen bis zu vier Farben in einem Objekt und halten die Filamente vor
        Feuchtigkeit geschützt — das sorgt für gleichbleibende Qualität, ganz
        gleich, welches Atelier den Druck startet.
      </>
    ),
    specsTitle: "Technische Daten",
    legendHint: "Fahren Sie über einen Punkt, um das Bauteil zu finden",
    printers: [
      {
        variant: "p1s",
        name: "Bambu Lab P1S",
        sub: "+ AMS 2 Pro",
        place: "Atelier Gland (VD)",
        blurb:
          "Ein geschlossener CoreXY-Drucker, schnell und gleichmässig. Die Maschine der ersten Stunde — auf ihr entstand der gesamte Katalog.",
        callouts: [
          {
            label: "AMS 2 Pro",
            text: "Vier dauerhaft geladene Spulen. Das System wechselt das Filament während des Drucks selbstständig und hält es trocken.",
          },
          {
            label: "Display + Drehregler",
            text: "Direkte Steuerung: starten, pausieren, Temperaturen überwachen — ganz ohne Computer.",
          },
          {
            label: "Druckkopf",
            text: "0,4-mm-Düse auf einem CoreXY-Portal — präzise auch bei hohem Tempo.",
          },
          {
            label: "Geschlossenes Gehäuse",
            text: "Es hält die Temperatur stabil und schirmt Zugluft ab — so lösen sich grosse Teile nicht vom Druckbett.",
          },
          {
            label: "Heizbett",
            text: "Es lässt die erste Schicht haften und gibt das Stück beim Abkühlen wieder frei. Strukturierte PEI-Oberfläche.",
          },
        ],
        specs: [
          { label: "Bauraum", value: "256 × 256 × 256 mm" },
          { label: "Gleichzeitige Farben", value: "Bis zu 4 (AMS 2 Pro)" },
          { label: "Schichthöhe", value: "0,08 – 0,28 mm" },
          { label: "Düse", value: "0,4 mm" },
          { label: "Geschlossenes Gehäuse", value: "Ja — CoreXY-Chassis" },
          { label: "Filamenttrocknung", value: "In der AMS 2 Pro integriert" },
          { label: "Aussenmasse", value: "389 × 389 × 458 mm" },
        ],
      },
      {
        variant: "k2",
        name: "Creality K2",
        sub: "+ CFS",
        place: "Atelier Pully (VD)",
        blurb:
          "Höher, schneller, mit luftdichtem Filamentfach. Sie verdoppelt die Kapazität und übernimmt die Serien.",
        callouts: [
          {
            label: "Creality CFS",
            text: "Vier Spulen in einem luftdichten Fach mit Temperatur- und Feuchtigkeitsanzeige. Der RFID-Chip meldet Material und Farbe an den Drucker.",
          },
          {
            label: "Touchscreen",
            text: "Grosses Farbdisplay an der Front: Druckwarteschlange, Einstellungen und Kamerabild direkt an der Maschine.",
          },
          {
            label: "Druckkopf",
            text: "Direktextruder, 0,4-mm-Düse bis 300 °C, Spitzen bis 600 mm/s.",
          },
          {
            label: "Geschlossenes Gehäuse",
            text: "Geschlossene, gefilterte Kammer: Sie hält die Wärme und bindet Partikel während des Drucks.",
          },
          {
            label: "Heizbett",
            text: "260 × 260 mm, mit automatischer Nivellierung vor jedem Druck.",
          },
        ],
        specs: [
          { label: "Bauraum", value: "260 × 260 × 260 mm" },
          { label: "Gleichzeitige Farben", value: "Bis zu 4 (CFS)" },
          { label: "Schichthöhe", value: "0,05 – 0,3 mm" },
          { label: "Düse", value: "0,4 mm — bis 300 °C" },
          { label: "Höchstgeschwindigkeit", value: "600 mm/s" },
          {
            label: "Filamentlagerung",
            value: "Luftdichtes CFS mit Feuchteanzeige",
          },
          { label: "Aussenmasse", value: "404 × 436 × 545 mm" },
        ],
      },
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
        text: "Eines der beiden Ateliers druckt Ihr Stück Schicht für Schicht; das Mehrfilament-System steuert bis zu 4 Farben automatisch.",
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
        title: "In der Genferseeregion gefertigt",
        text: "Jedes Stück wird in einem unserer beiden Waadtländer Ateliers von Hand gedruckt und kontrolliert.",
      },
      {
        title: "2 Jahre Gewährleistung",
        text: "Die gesetzliche Schweizer Gewährleistung gilt. Ein Problem? Wir reparieren, ersetzen oder erstatten.",
      },
      {
        title: "Sichere Zahlung",
        text: "TWINT, Karten und Google Pay über Stripe. Ihre Kartendaten laufen nie über unsere Server.",
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
            Beide Maschinen haben ein Mehrfilament-System (AMS 2 Pro bei Bambu
            Lab, CFS bei Creality). Der Drucker vereint bis zu 4 Filamente in
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
            Die Zahlung erfolgt über Stripe: TWINT, Karten und Google Pay. Die
            Transaktion ist verschlüsselt und Ihre Kartendaten laufen nie über
            unsere Server.
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
      "Gli atelier di stampa 3D Swiss3Design nell’arco lemanico: le nostre due stampanti multicolore, il procedimento, i materiali e le risposte alle vostre domande.",

    badge: "Due atelier nell’arco lemanico",
    title: "Dietro ogni pezzo, due atelier svizzeri.",
    intro: (
      <>
        Swiss3Design sono due atelier di stampa 3D nell’
        <strong>arco lemanico</strong>, tra Gland e Pully. Due stampanti
        multicolore, materiali scelti con cura e ogni volta una persona che
        controlla il pezzo a mano prima di spedirvelo. Nessuna fabbrica, nessun
        intermediario — stampa su richiesta, pensata e realizzata in Svizzera.
      </>
    ),

    stats: [
      { value: "2", label: "atelier nell’arco lemanico" },
      { value: "Fino a 4", label: "colori in un solo pezzo" },
      { value: "2 anni", label: "di garanzia legale" },
      { value: "48 h", label: "per rispondere al vostro progetto" },
    ],

    equipmentKicker: "Il nostro materiale",
    equipmentTitle: "Due stampanti multicolore, due atelier.",
    equipmentText: (
      <>
        I nostri pezzi escono da due stampanti a camera chiusa, ciascuna con il
        proprio sistema multi-filamento: una <strong>Bambu Lab P1S</strong> a
        Gland e una <strong>Creality K2</strong> a Pully. Entrambe combinano
        fino a quattro colori nello stesso oggetto e tengono i filamenti al
        riparo dall’umidità — è così che la qualità resta costante, qualunque
        sia l’atelier che avvia la stampa.
      </>
    ),
    specsTitle: "Scheda tecnica",
    legendHint: "Passate su un punto dello schema per individuare il componente",
    printers: [
      {
        variant: "p1s",
        name: "Bambu Lab P1S",
        sub: "+ AMS 2 Pro",
        place: "Atelier di Gland (VD)",
        blurb:
          "Una CoreXY a camera chiusa, rapida e regolare. È la macchina storica dell’atelier: quella su cui è nato il catalogo.",
        callouts: [
          {
            label: "AMS 2 Pro",
            text: "Quattro bobine sempre caricate. Il sistema cambia filamento da solo durante la stampa e li mantiene asciutti.",
          },
          {
            label: "Display e manopola",
            text: "Il comando diretto: avviare, mettere in pausa, sorvegliare le temperature senza passare da un computer.",
          },
          {
            label: "Testa di stampa",
            text: "Ugello da 0,4 mm su un portale CoreXY — preciso anche ad alta velocità.",
          },
          {
            label: "Camera chiusa",
            text: "Stabilizza la temperatura e blocca le correnti d’aria: è ciò che evita il distacco dei pezzi grandi.",
          },
          {
            label: "Piano riscaldato",
            text: "Fa aderire il primo strato, poi libera il pezzo raffreddandosi. Superficie PEI testurizzata.",
          },
        ],
        specs: [
          { label: "Volume di stampa", value: "256 × 256 × 256 mm" },
          { label: "Colori simultanei", value: "Fino a 4 (AMS 2 Pro)" },
          { label: "Altezza dello strato", value: "0,08 – 0,28 mm" },
          { label: "Ugello", value: "0,4 mm" },
          { label: "Camera chiusa", value: "Sì — telaio CoreXY" },
          {
            label: "Essiccazione del filamento",
            value: "Integrata nell’AMS 2 Pro",
          },
          { label: "Ingombro", value: "389 × 389 × 458 mm" },
        ],
      },
      {
        variant: "k2",
        name: "Creality K2",
        sub: "+ CFS",
        place: "Atelier di Pully (VD)",
        blurb:
          "Più alta, più rapida, con vano filamenti a tenuta stagna. Raddoppia la capacità produttiva e si occupa delle serie.",
        callouts: [
          {
            label: "Creality CFS",
            text: "Quattro bobine in un vano stagno, con temperatura e umidità visualizzate. Il chip RFID comunica materiale e colore alla macchina.",
          },
          {
            label: "Schermo tattile",
            text: "Ampio display a colori sul fronte: coda di stampa, impostazioni e telecamera della camera, direttamente sulla macchina.",
          },
          {
            label: "Testa di stampa",
            text: "Estrusore diretto, ugello da 0,4 mm fino a 300 °C, con punte a 600 mm/s.",
          },
          {
            label: "Camera chiusa",
            text: "Camera chiusa e filtrata: trattiene il calore e le particelle durante la stampa.",
          },
          {
            label: "Piano riscaldato",
            text: "260 × 260 mm, con livellamento automatico prima di ogni stampa.",
          },
        ],
        specs: [
          { label: "Volume di stampa", value: "260 × 260 × 260 mm" },
          { label: "Colori simultanei", value: "Fino a 4 (CFS)" },
          { label: "Altezza dello strato", value: "0,05 – 0,3 mm" },
          { label: "Ugello", value: "0,4 mm — fino a 300 °C" },
          { label: "Velocità massima", value: "600 mm/s" },
          {
            label: "Conservazione filamenti",
            value: "CFS stagno, umidità visualizzata",
          },
          { label: "Ingombro", value: "404 × 436 × 545 mm" },
        ],
      },
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
        text: "Uno dei due atelier stampa il vostro pezzo strato dopo strato; il sistema multi-filamento gestisce da solo fino a 4 colori.",
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
        title: "Fabbricato nell’arco lemanico",
        text: "Ogni pezzo è stampato e controllato a mano in uno dei nostri due atelier vodesi.",
      },
      {
        title: "Garanzia 2 anni",
        text: "Si applica la garanzia legale svizzera. Un problema? Ripariamo, sostituiamo o rimborsiamo.",
      },
      {
        title: "Pagamento sicuro",
        text: "TWINT, carte e Google Pay tramite Stripe. I vostri dati bancari non passano mai dai nostri server.",
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
            Entrambe le macchine hanno un sistema multi-filamento (AMS 2 Pro
            sulla Bambu Lab, CFS sulla Creality). La stampante combina fino a 4
            filamenti in uno stesso pezzo: i colori sono integrati nella stampa,
            senza vernice né assemblaggio. Il risultato esce nitido,
            direttamente dalla macchina.
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
            Il pagamento avviene tramite Stripe: TWINT, carte e Google Pay. La
            transazione è cifrata e i vostri dati bancari non passano mai dai
            nostri server.
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
      "The Swiss3Design 3D-printing workshops in the Lake Geneva region: our two multicolour printers, our process, our materials and answers to your questions.",

    badge: "Two workshops in the Lake Geneva region",
    title: "Behind every piece, two Swiss workshops.",
    intro: (
      <>
        Swiss3Design is two 3D-printing workshops in the{" "}
        <strong>Lake Geneva region</strong>, between Gland and Pully. Two
        multicolour printers, carefully chosen materials, and every time a
        person who checks the piece by hand before sending it to you. No
        factory, no middleman — print on demand, designed and made in
        Switzerland.
      </>
    ),

    stats: [
      { value: "2", label: "workshops in the Lake Geneva region" },
      { value: "Up to 4", label: "colours in a single piece" },
      { value: "2 years", label: "statutory warranty" },
      { value: "48 h", label: "to reply to your project" },
    ],

    equipmentKicker: "Our equipment",
    equipmentTitle: "Two multicolour printers, two workshops.",
    equipmentText: (
      <>
        Our pieces come off two enclosed printers, each with its own
        multi-filament system: a <strong>Bambu Lab P1S</strong> in Gland and a{" "}
        <strong>Creality K2</strong> in Pully. Both combine up to four colours
        in a single object and keep the filaments away from moisture — that’s
        what keeps quality consistent, whichever workshop starts the print.
      </>
    ),
    specsTitle: "Specifications",
    legendHint: "Hover a marker on the diagram to locate the part",
    printers: [
      {
        variant: "p1s",
        name: "Bambu Lab P1S",
        sub: "+ AMS 2 Pro",
        place: "Gland workshop (VD)",
        blurb:
          "An enclosed CoreXY printer, fast and consistent. The workshop’s original machine — the one the whole catalogue was developed on.",
        callouts: [
          {
            label: "AMS 2 Pro",
            text: "Four spools loaded at all times. The system swaps filament on its own mid-print and keeps them dry.",
          },
          {
            label: "Screen + dial",
            text: "Direct control: start, pause and watch temperatures without going through a computer.",
          },
          {
            label: "Print head",
            text: "A 0.4 mm nozzle on a CoreXY gantry — precise even at high speed.",
          },
          {
            label: "Enclosed chamber",
            text: "It steadies the temperature and blocks draughts — that’s what stops large pieces lifting off the bed.",
          },
          {
            label: "Heated bed",
            text: "It makes the first layer stick, then releases the piece as it cools. Textured PEI surface.",
          },
        ],
        specs: [
          { label: "Build volume", value: "256 × 256 × 256 mm" },
          { label: "Simultaneous colours", value: "Up to 4 (AMS 2 Pro)" },
          { label: "Layer height", value: "0.08 – 0.28 mm" },
          { label: "Nozzle", value: "0.4 mm" },
          { label: "Enclosed chamber", value: "Yes — CoreXY frame" },
          { label: "Filament drying", value: "Built into the AMS 2 Pro" },
          { label: "Footprint", value: "389 × 389 × 458 mm" },
        ],
      },
      {
        variant: "k2",
        name: "Creality K2",
        sub: "+ CFS",
        place: "Pully workshop (VD)",
        blurb:
          "Taller, faster, with an airtight filament bay. It doubles production capacity and takes on the batch runs.",
        callouts: [
          {
            label: "Creality CFS",
            text: "Four spools in an airtight bay, with temperature and humidity on display. The RFID chip tells the printer the material and colour.",
          },
          {
            label: "Touchscreen",
            text: "Large colour display on the front: print queue, settings and chamber camera, right on the machine.",
          },
          {
            label: "Print head",
            text: "Direct-drive extruder, 0.4 mm nozzle up to 300 °C, peaking at 600 mm/s.",
          },
          {
            label: "Enclosed chamber",
            text: "A closed, filtered chamber: it holds the heat and traps particles while printing.",
          },
          {
            label: "Heated bed",
            text: "260 × 260 mm, with automatic levelling before every print.",
          },
        ],
        specs: [
          { label: "Build volume", value: "260 × 260 × 260 mm" },
          { label: "Simultaneous colours", value: "Up to 4 (CFS)" },
          { label: "Layer height", value: "0.05 – 0.3 mm" },
          { label: "Nozzle", value: "0.4 mm — up to 300 °C" },
          { label: "Top speed", value: "600 mm/s" },
          {
            label: "Filament storage",
            value: "Airtight CFS, humidity on display",
          },
          { label: "Footprint", value: "404 × 436 × 545 mm" },
        ],
      },
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
        text: "One of the two workshops prints your piece layer by layer; the multi-filament system handles up to 4 colours on its own.",
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
        title: "Made in the Lake Geneva region",
        text: "Every piece is printed and checked by hand in one of our two Vaud workshops.",
      },
      {
        title: "2-year warranty",
        text: "The Swiss statutory warranty applies. A problem? We repair, replace or refund.",
      },
      {
        title: "Secure payment",
        text: "TWINT, cards and Google Pay via Stripe. Your card details never pass through our servers.",
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
            Both machines have a multi-filament system (AMS 2 Pro on the Bambu
            Lab, CFS on the Creality). The printer combines up to 4 filaments in
            a single piece: the colours are part of the print, with no painting
            or assembly. The result comes out clean, straight from the machine.
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
            Payment is made via Stripe: TWINT, cards and Google Pay. The
            transaction is encrypted and your card details never pass through
            our servers.
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
