"use client";

import type { ReactNode } from "react";
import { ChipRadio } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";

// Groupe de choix exclusifs du Studio (profil, motif, paroi, mode, mise en page,
// forme, anneau) : de VRAIS boutons radio natifs habillés en puces (ChipRadio),
// dans un `fieldset` légendé. Flèches, annonce « 2 sur 5 » et formulaire GET
// sans JavaScript viennent du navigateur ; `name` est la clé courte de l'URL
// (`p`, `m`, `w`…), la valeur l'identifiant de l'option. L'icône d'une option
// est décorative (le libellé dit la même chose).

export interface RadioOption<V extends string | number> {
  value: V;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export function RadioGroup<V extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
  form,
  className,
  optionClassName,
}: {
  legend: string;
  /** Clé courte de l'URL ; radios de l'interface seule : un nom libre et `form="studio-local"`. */
  name: string;
  value: V;
  options: readonly RadioOption<V>[];
  onChange: (value: V) => void;
  form?: string;
  className?: string;
  optionClassName?: string;
}) {
  return (
    <fieldset className={cx("m-0 min-w-0 border-0 p-0", className)}>
      <legend className="s3d-label mb-2 p-0 text-soft">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChipRadio
            key={String(option.value)}
            name={name}
            form={form}
            value={String(option.value)}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className={optionClassName}
          >
            {option.icon ? (
              <span aria-hidden="true" className="-ml-1 flex shrink-0">
                {option.icon}
              </span>
            ) : null}
            {option.label}
          </ChipRadio>
        ))}
      </div>
    </fieldset>
  );
}
