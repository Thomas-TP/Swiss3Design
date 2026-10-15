"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BTN_GHOST, BTN_PRIMARY } from "../ui";

// Formulaire d'admin branché sur une Server Action qui rend un état
// (`{ error?, ok? }`, jamais de redirect(), règle d'or 1). La page se rafraîchit
// d'elle-même : les actions appellent revalidatePath.

export interface AdminFormState {
  error?: string;
  ok?: string;
}

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: AdminFormState, data: FormData) => Promise<AdminFormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-accent-text">
          {state.error}
        </p>
      ) : state.ok ? (
        <output className="mt-2 block text-xs font-medium text-emerald-700">
          {state.ok}
        </output>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  ghost,
  className,
}: {
  children: ReactNode;
  ghost?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${ghost ? BTN_GHOST : BTN_PRIMARY} ${className ?? ""}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
