"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import {
  QuoteRequestForm,
  type QuoteAttachment,
} from "@/components/quote/quote-request-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Drawer } from "@/components/ui/drawer";
import { SiteLink } from "@/components/ui/site-link";
import { Field, fieldClass, fieldIds } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { writeQuoteHandoff } from "@/lib/quote-handoff";
import {
  formatChfRange,
  formatDuration,
  formatGrams,
} from "@/lib/studio/format";
import { clearStudioTexts } from "@/lib/studio/texts-store";
import type { StudioObjectId } from "@/lib/studio/types";
import { hasTextFields, printedTexts } from "./objects";
import { prepareStudioFile } from "./quote-send";
import type { StudioLocale } from "./scene-props";
import {
  colorNames,
  objectName,
  plain,
  quoteColors,
  quoteDescription,
  quoteDimensions,
  textsLine,
  type SummaryInput,
} from "./summary";
import { makeThumbnail } from "./thumbnail";
import { readCachedUpload, uploadHash } from "./upload-cache";

// Tiroir « Envoyer à l'atelier » (brief « Strates », §6.9) : vignette, résumé
// (dimensions, bandes, grammes, durée, changements, estimation si validée,
// textes à imprimer) et le formulaire de devis PARTAGÉ (QuoteRequestForm, variante
// « drawer ») : e-mail, quantité (1 à 20), remarque facultative. À l'envoi,
// l'attente est narrée par le formulaire (« 1/3 Préparation du fichier », « 2/3
// Envoi à l'atelier », « 3/3 Enregistrement de la demande ») ; ce tiroir fournit
// l'envoi paresseux du fichier (`attachment.prepare`) et le repli vers le
// formulaire complet de /custom (`#studio`).
//
// Le texte du visiteur n'est ni dans l'URL ni dans un événement : il vit dans
// ce tiroir, dans la demande envoyée à l'atelier (finalité déclarée) et dans
// sessionStorage pour le repli. Le tiroir porte `ph-mask` : le texte saisi,
// l'adresse e-mail et la remarque n'entrent jamais dans un enregistrement de
// visite.

const QUANTITY_MAX = 20;

export interface SendDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Résumé de la configuration à envoyer : `texts` = textes SAISIS. */
  input: SummaryInput;
  object: StudioObjectId;
  locale: StudioLocale;
  /** Lien de configuration (chemin + fragment), SANS texte personnel. */
  link: () => string;
}

export function SendDrawer(props: SendDrawerProps) {
  // Le formulaire (sa session, ses champs) n'est monté qu'à la première ouverture.
  const [everOpened, setEverOpened] = useState(false);
  // oxlint-disable set-state-in-effect -- ouverture du tiroir : montage différé du formulaire
  useEffect(() => {
    if (props.open) setEverOpened(true);
  }, [props.open]);
  // oxlint-enable set-state-in-effect
  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      title={props.input.t("send.title")}
      className="ph-mask"
    >
      {everOpened ? <SendBody {...props} /> : null}
    </Drawer>
  );
}

/**
 * Fermé, le corps ne se redessine pas : un glissé de curseur change `input` à
 * chaque événement, et le formulaire de devis (long) n'a aucune raison de le
 * suivre. À l'ouverture, il reprend la configuration du moment.
 */
const SendBody = memo(
  SendBodyImpl,
  (previous, next) =>
    !previous.open &&
    !next.open &&
    previous.onClose === next.onClose &&
    previous.object === next.object &&
    previous.locale === next.locale,
);

function SendBodyImpl({
  open,
  onClose,
  input,
  object,
  locale,
  link,
}: SendDrawerProps) {
  const { t, core, stats } = input;
  const router = useRouter();
  const uid = useId();
  const [quantity, setQuantity] = useState(1);
  const [remark, setRemark] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  // La vignette suit la configuration ouverte, pas chaque frappe du tiroir.
  // oxlint-disable set-state-in-effect -- rendu asynchrone de la vignette (Stage ou dessin 2D)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Après le premier affichage du tiroir : le rendu hors écran (WebGL, lecture
    // des pixels) ne retarde jamais l'ouverture elle-même.
    const timer = window.setTimeout(() => {
      void makeThumbnail({
        config: input.config,
        texts: input.texts,
        locale,
        size: 512,
      }).then((url) => {
        if (!cancelled) setThumbnail(url);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, input.config, input.texts, locale]);
  // oxlint-enable set-state-in-effect

  const hash = useMemo(
    () => uploadHash(input.config, input.texts, locale),
    [input.config, input.texts, locale],
  );

  const names = colorNames(input);
  const typed = printedTexts(input.config, input.texts);
  const description = quoteDescription(input, {
    link: `${window.location.origin}${link()}`,
    quantity,
    remark,
  });
  const prefill = {
    description,
    material: "PLA" as const,
    colors: quoteColors(input),
    dimensions: quoteDimensions(input),
  };
  const price = stats.estimate
    ? `${formatChfRange(stats.estimate.lowCents, stats.estimate.highCents, locale)} · ${t("sheet.estimate")}`
    : core("measure.priceLater");
  const lines = [
    plain(quoteDimensions(input)),
    plain(`${t("send.colors")} ${names.join(", ")}`),
    plain(
      `≈ ${formatGrams(stats.grams, locale)} · ≈ ${formatDuration(stats.minutes, locale)} · ${core("units.changes", { count: stats.changes })}`,
    ),
    price,
    ...(typed.length > 0 ? [plain(textsLine(input))] : []),
  ];

  const attachment: QuoteAttachment = {
    prepare: async (onProgress) => {
      const file = await prepareStudioFile({
        config: input.config,
        texts: input.texts,
        locale,
        object,
        bands: input.bands.bands.length,
        estimate: stats.estimate,
        messages: {
          engine: t("send.errors.engine"),
          export: t("send.errors.export"),
        },
        onProgress,
      });
      return { key: file.key, name: file.name };
    },
    summary: {
      title: objectName(input),
      lines,
      note: hasTextFields(input.config) ? t("ctl.text.moderation") : undefined,
      thumbnail: thumbnail ?? undefined,
    },
  };

  /** Repli : le formulaire complet de /custom, prérempli (§6.9, point 7). */
  function openFullForm(event: React.MouseEvent) {
    event.preventDefault();
    const cached = readCachedUpload(hash);
    writeQuoteHandoff({
      v: 1,
      source: "studio",
      object,
      link: link(),
      prefill,
      ...(cached
        ? {
            attachment: {
              key: cached.key,
              name: cached.name,
              bytes: cached.bytes,
              triangles: cached.triangles,
            },
          }
        : {}),
      ...(thumbnail ? { thumbnail } : {}),
      createdAt: Date.now(),
    });
    onClose();
    router.push("/custom#studio");
  }

  const quantityId = `${uid}-quantity`;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-soft">{t("send.intro")}</p>
      <QuoteRequestForm
        // Une autre configuration = un formulaire neuf : son fichier préparé ne doit jamais survivre à un réglage.
        key={hash}
        source="studio"
        object={object}
        variant="drawer"
        prefill={prefill}
        attachment={attachment}
        extraFields={
          <>
            <Field
              label={t("send.quantity")}
              htmlFor={quantityId}
              hint={t("send.quantityHint", { max: QUANTITY_MAX })}
            >
              <input
                id={quantityId}
                type="number"
                inputMode="numeric"
                min={1}
                max={QUANTITY_MAX}
                step={1}
                value={quantity}
                aria-describedby={fieldIds(quantityId).hint}
                onChange={(event) => {
                  const value = Math.round(Number(event.currentTarget.value));
                  setQuantity(
                    Number.isFinite(value)
                      ? Math.min(QUANTITY_MAX, Math.max(1, value))
                      : 1,
                  );
                }}
                className={cx(fieldClass, "s3d-num w-28")}
              />
            </Field>
            <Field label={t("send.remark")} htmlFor={`${uid}-remark`}>
              <textarea
                id={`${uid}-remark`}
                rows={3}
                maxLength={500}
                value={remark}
                onChange={(event) => setRemark(event.currentTarget.value)}
                className={cx(fieldClass, "resize-y")}
              />
            </Field>
          </>
        }
        successActions={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("send.continue")}
            </Button>
            <ButtonLink href="/shop" variant="text">
              {t("send.shop")}
            </ButtonLink>
          </>
        }
        onSuccess={() => {
          // Le texte n'a plus de raison de rester dans la session : il est parti dans la demande.
          clearStudioTexts(object);
        }}
      />
      <p className="text-sm text-soft">
        <SiteLink
          href="/custom#studio"
          onClick={openFullForm}
          className="text-ink underline decoration-line decoration-1 underline-offset-4 hover:decoration-ink"
        >
          {t("send.fullForm")}
        </SiteLink>
      </p>
    </div>
  );
}
