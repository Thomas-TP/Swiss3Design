import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LegalPage, Section } from "../legal-layout";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");

  return (
    <LegalPage locale={locale} title={t("terms")} updated="11 juin 2026">
      <Section n={1} title="Champ d'application">
        <p>
          Les présentes conditions générales de vente (« CGV ») régissent les
          commandes passées sur la boutique en ligne <strong>swiss3design.ch</strong>,
          exploitée par <strong>Swiss3Design, Thomas Prud'homme, Chemin de
          l'Aubépine 9B, 1196 Gland (Vaud), Suisse</strong> (« l'exploitant »),
          joignable à l'adresse contact@swiss3design.ch. En passant commande,
          le client accepte les présentes CGV dans leur version en vigueur au
          moment de la commande.
        </p>
      </Section>

      <Section n={2} title="Produits">
        <p>
          Les articles proposés sont des objets fabriqués artisanalement par
          impression 3D, à l'unité ou en petite série. De légères variations de
          teinte, de texture ou d'aspect (notamment les lignes de couches
          propres au procédé) peuvent exister d'un exemplaire à l'autre et ne
          constituent pas un défaut. Les photographies sont aussi fidèles que
          possible mais non contractuelles.
        </p>
      </Section>

      <Section n={3} title="Prix">
        <p>
          Les prix s'entendent en francs suisses (CHF). L'exploitant n'est pas
          assujetti à la TVA (art. 10 LTVA) ; aucune TVA n'est facturée. Les
          frais de livraison sont indiqués avant la confirmation de paiement.
        </p>
      </Section>

      <Section n={4} title="Commande et conclusion du contrat">
        <p>
          La présentation des produits ne constitue pas une offre liante. La
          commande du client vaut offre d'achat ; le contrat est conclu au
          moment de la confirmation du paiement, attestée par l'e-mail de
          confirmation de commande. L'exploitant se réserve le droit de refuser
          une commande, notamment en cas d'indisponibilité ou d'erreur
          manifeste de prix ; les montants déjà perçus sont alors remboursés.
        </p>
      </Section>

      <Section n={5} title="Paiement">
        <p>
          Le paiement s'effectue en ligne via le prestataire Stripe (carte de
          crédit/débit, TWINT, Apple Pay, Google Pay). L'exploitant n'a jamais
          accès aux données de carte et ne les stocke pas.
        </p>
      </Section>

      <Section n={6} title="Livraison">
        <p>
          La livraison est effectuée <strong>en Suisse uniquement</strong>, par
          la Poste suisse. Les produits en stock sont remis à la Poste sous 1 à
          3 jours ouvrés ; les produits imprimés à la demande le sont après le
          délai de production indiqué sur la fiche produit. Les frais de port
          et le seuil de livraison offerte applicables sont affichés dans le
          panier. Les délais de livraison sont indicatifs ; un retard ne donne
          pas droit à des dommages-intérêts.
        </p>
      </Section>

      <Section n={7} title="Impressions sur mesure (devis)">
        <p>
          Les prestations personnalisées (fichiers fournis par le client ou
          projets spécifiques) font l'objet d'un devis. Le contrat est conclu à
          l'acceptation du devis et au paiement. Les articles personnalisés ne
          sont ni repris ni échangés (ch. 8). Le client garantit détenir les
          droits sur les fichiers transmis et que leur impression ne viole
          aucun droit de tiers ni aucune disposition légale ; l'exploitant peut
          refuser tout fichier sans justification.
        </p>
      </Section>

      <Section n={8} title="Retours">
        <p>
          Le droit suisse ne prévoit pas de droit de rétractation légal pour
          les achats en ligne. À titre commercial, l'exploitant accepte le
          retour des articles de catalogue (non personnalisés) dans les
          14 jours suivant la réception, à condition qu'ils soient non
          utilisés et dans leur état d'origine. Les frais de retour sont à la
          charge du client ; le prix des articles est remboursé, hors frais
          d'envoi initiaux. Les articles sur mesure sont exclus du retour.
        </p>
      </Section>

      <Section n={9} title="Garantie">
        <p>
          La garantie légale pour les défauts de la chose vendue
          (art. 197 ss CO) s'applique pendant deux ans dès la livraison. Le
          client signale tout défaut dans les meilleurs délais à
          contact@swiss3design.ch, photos à l'appui. L'exploitant procède, à
          son choix, à la réparation, au remplacement ou au remboursement.
        </p>
      </Section>

      <Section n={10} title="Responsabilité">
        <p>
          Sauf faute grave ou intentionnelle, la responsabilité de l'exploitant
          est limitée au dommage direct et prouvé, à concurrence du montant de
          la commande concernée. Sauf indication contraire expresse, les
          objets imprimés en 3D ne sont pas destinés à un usage de sécurité,
          au contact alimentaire prolongé, ni à un usage médical, et ne sont
          pas des jouets pour enfants de moins de 3 ans.
        </p>
      </Section>

      <Section n={11} title="Droit applicable et for">
        <p>
          Les présentes CGV sont soumises au droit suisse. Le for est à
          Nyon (VD), sous réserve des fors impératifs prévus par la loi.
        </p>
      </Section>
    </LegalPage>
  );
}
