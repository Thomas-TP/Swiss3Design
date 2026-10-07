"use client";

import type { ReactNode } from "react";
import { ChipRadio } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import { textFieldsFor } from "./objects";
import {
  AltimetricBar,
  BandsSection,
  BorneShape,
  CartoucheShape,
  LavauxPatternSection,
  LavauxShape,
  PlateInkSection,
  PresetsRow,
  ReliefShape,
  SheetSection,
  TextSection,
  type Ctl,
} from "./studio-controls";
import type { Printability, StudioObjectId } from "@/lib/studio/types";

// Les sections du Studio (brief « Strates », §6.7 : 01 Forme, 02 Motif,
// 03 Couleurs, 04 Texte, 05 Fiche) : un `fieldset` légendé chacune. Sur bureau
// elles se suivent dans la colonne de droite ; sur mobile, des onglets natifs
// (boutons radio) n'en montrent qu'une à la fois. Sans JavaScript, toutes
// restent visibles, dans le formulaire GET.

export type SectionId = "shape" | "pattern" | "colors" | "text" | "sheet";

export function sectionsFor(object: StudioObjectId): SectionId[] {
  return object === "lavaux"
    ? ["shape", "pattern", "colors", "sheet"]
    : ["shape", "colors", "text", "sheet"];
}

export function SectionTabs({
  legend,
  sections,
  value,
  onChange,
  labelOf,
  className,
}: {
  legend: string;
  sections: readonly SectionId[];
  value: SectionId;
  onChange: (section: SectionId) => void;
  labelOf: (section: SectionId) => string;
  className?: string;
}) {
  return (
    // Onglets de mobile : natifs, et seulement quand JavaScript les fait fonctionner.
    // Collés en haut de la zone qui défile : on change de section sans remonter.
    <fieldset
      className={cx(
        "m-0 hidden min-w-0 border-0 p-0 group-data-[js]/studio:max-lg:block",
        "max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:bg-paper max-lg:py-1.5",
        className,
      )}
    >
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <ChipRadio
            key={section}
            name="studio-tab"
            form="studio-local"
            value={section}
            checked={section === value}
            onChange={() => onChange(section)}
          >
            {labelOf(section)}
          </ChipRadio>
        ))}
      </div>
    </fieldset>
  );
}

function Section({
  id,
  number,
  title,
  active,
  children,
}: {
  id: string;
  number: string;
  title: string;
  /** Mobile : la section affichée ; les autres sont masquées (avec JavaScript seulement). */
  active: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      id={`studio-${id}`}
      className={cx(
        "m-0 min-w-0 scroll-mt-24 border-0 p-0",
        !active && "group-data-[js]/studio:max-lg:hidden",
      )}
    >
      <legend className="s3d-label float-left mb-5 w-full text-soft [&+*]:clear-both">
        <span className="text-ink">{number}</span>
        <span aria-hidden="true" className="mx-2 text-iso-index">
          ·
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

type Issue = Extract<Printability, { issues: unknown }>["issues"][number];

export function StudioSections({
  ctl,
  sections,
  tab,
  titleOf,
  issueText,
  onFix,
  actions,
  noscriptNote,
}: {
  ctl: Ctl;
  sections: readonly SectionId[];
  tab: SectionId;
  titleOf: (section: SectionId) => string;
  issueText: (issue: Issue) => string;
  onFix: (issue: Issue) => void;
  /** Bouton « Envoyer à l'atelier » (bureau) et ce qui l'accompagne. */
  actions: ReactNode;
  /** Réglages en clair pour la demande (sans JavaScript : à coller dans /custom). */
  noscriptNote: ReactNode;
}) {
  const { config } = ctl;
  const fields = textFieldsFor(config);

  const body = (section: SectionId): ReactNode => {
    switch (section) {
      case "shape":
        return (
          <div className="flex flex-col gap-6">
            <PresetsRow ctl={ctl} config={config} />
            {config.object === "lavaux" ? (
              <LavauxShape ctl={ctl} config={config} />
            ) : config.object === "cartouche" ? (
              <CartoucheShape ctl={ctl} config={config} />
            ) : config.object === "relief" ? (
              <ReliefShape ctl={ctl} config={config} />
            ) : (
              <BorneShape ctl={ctl} config={config} />
            )}
          </div>
        );
      case "pattern":
        return config.object === "lavaux" ? (
          <LavauxPatternSection ctl={ctl} config={config} />
        ) : null;
      case "colors":
        return config.object === "lavaux" || config.object === "relief" ? (
          <div className="flex flex-col gap-6">
            {/* Mobile : la barre altimétrique est horizontale, dans cet onglet. */}
            <AltimetricBar
              ctl={ctl}
              config={config}
              orientation="horizontal"
              className="lg:hidden"
            />
            <BandsSection ctl={ctl} config={config} />
          </div>
        ) : config.object === "cartouche" ? (
          <PlateInkSection
            ctl={ctl}
            plate={config.plate}
            ink={config.ink}
            plateName="fp"
            inkName="ft"
            plateLegend={ctl.t("colors.plate")}
            inkLegend={ctl.t("colors.ink")}
            onPlate={(plate) =>
              ctl.change({ ...config, plate }, "palette", { commit: true })
            }
            onInk={(ink) =>
              ctl.change({ ...config, ink }, "palette", { commit: true })
            }
          />
        ) : (
          <PlateInkSection
            ctl={ctl}
            plate={config.base}
            ink={config.ink}
            plateName="fb"
            inkName="ft"
            plateLegend={ctl.t("colors.base")}
            inkLegend={ctl.t("colors.ink")}
            onPlate={(base) =>
              ctl.change({ ...config, base }, "palette", { commit: true })
            }
            onInk={(ink) =>
              ctl.change({ ...config, ink }, "palette", { commit: true })
            }
          />
        );
      case "text":
        return (
          <TextSection
            ctl={ctl}
            config={config}
            fields={fields}
            issueText={issueText}
          />
        );
      case "sheet":
        return (
          <SheetSection
            ctl={ctl}
            issueText={issueText}
            onFix={onFix}
            actions={
              <>
                {actions}
                {noscriptNote}
              </>
            }
          />
        );
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section, index) => (
        <Section
          key={section}
          id={section}
          number={String(index + 1).padStart(2, "0")}
          title={titleOf(section)}
          active={section === tab}
        >
          {body(section)}
        </Section>
      ))}
    </div>
  );
}
