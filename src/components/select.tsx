"use client";
export interface SelectOption {
  value: string;
  label: string;
}
export function Select({
  value,
  onChange,
  options,
  placeholder,
  name,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel ?? placeholder}
      className="w-full min-w-0 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
