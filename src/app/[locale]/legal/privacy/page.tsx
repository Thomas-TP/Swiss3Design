import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LegalPage, Section } from "../legal-layout";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("footer");

  return (
    <LegalPage locale={locale} title={t("privacy")} updated="11 juin 2026">
      <Section n={1} title="Responsable du traitement">
        <p>
          Swiss3Design, Thomas Prud'homme, Chemin de l'Aubépine 9B, 1196 Gland
          (Vaud), Suisse — contact@swiss3design.ch. La présente politique
          décrit le traitement des données personnelles conformément à la loi
          fédérale sur la protection des données (nLPD).
        </p>
      </Section>

      <Section n={2} title="Données traitées">
        <p>
          <strong>Compte client</strong> : nom, adresse e-mail, mot de passe
          (haché, jamais en clair) ou identifiant de connexion Google.{" "}
          <strong>Commandes</strong> : adresse de livraison, articles,
          historique. <strong>Paiement</strong> : traité exclusivement par
          Stripe ; nous ne voyons ni ne stockons aucune donnée de carte.{" "}
          <strong>Devis sur mesure</strong> : description du projet et
          fichiers 3D transmis. <strong>Échanges</strong> : e-mails et
          correspondance.
        </p>
      </Section>

      <Section n={3} title="Finalités">
        <p>
          Exécution des commandes et des devis, gestion du compte client,
          envoi des e-mails transactionnels (confirmation, expédition, devis,
          sécurité du compte), respect des obligations légales (conservation
          comptable) et prévention des abus. Aucune donnée n'est vendue ni
          utilisée à des fins publicitaires.
        </p>
      </Section>

      <Section n={4} title="Sous-traitants et transferts">
        <p>
          Nous recourons à des prestataires techniques : Cloudflare
          (hébergement et base de données), Stripe (paiement), Resend (envoi
          d'e-mails), Google (connexion Google, si utilisée). Certains de ces
          prestataires traitent des données aux États-Unis ou dans l'UE ; les
          transferts reposent sur des garanties reconnues (Swiss-U.S. Data
          Privacy Framework ou clauses contractuelles types).
        </p>
      </Section>

      <Section n={5} title="Cookies et stockage local">
        <p>
          Le site n'utilise que des éléments techniques indispensables : un
          cookie de session pour rester connecté à son compte et le stockage
          local du navigateur pour le panier. Aucun cookie publicitaire, aucun
          traceur tiers.
        </p>
      </Section>

      <Section n={6} title="Durées de conservation">
        <p>
          Compte : jusqu'à sa suppression par le client. Commandes : 10 ans
          (obligation de conservation comptable, art. 958f CO). Demandes de
          devis et fichiers 3D : supprimés au plus tard 2 ans après la fin du
          projet ou le refus du devis.
        </p>
      </Section>

      <Section n={7} title="Vos droits">
        <p>
          Conformément aux art. 25 ss nLPD, vous pouvez demander l'accès à vos
          données, leur rectification, leur effacement ou leur remise dans un
          format usuel, en écrivant à contact@swiss3design.ch. Vous pouvez
          également saisir le Préposé fédéral à la protection des données et à
          la transparence (PFPDT).
        </p>
      </Section>

      <Section n={8} title="Sécurité">
        <p>
          Les échanges sont chiffrés (TLS), les mots de passe sont hachés et
          l'accès aux données est restreint à l'exploitant. Les fichiers des
          devis sont stockés dans un espace privé non accessible publiquement.
        </p>
      </Section>

      <Section n={9} title="Modifications">
        <p>
          La présente politique peut être adaptée ; la version publiée sur
          cette page fait foi, avec sa date de mise à jour.
        </p>
      </Section>
    </LegalPage>
  );
}
