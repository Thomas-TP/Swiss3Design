import { Show, type JSX } from "solid-js";

// En-tête de page unifié — toutes les pages l'utilisent pour garantir le même
// rythme vertical et la même hiérarchie. Miroir exact de
// src/components/page-header.tsx côté app Next.js — LE point de cohérence du
// site, à ne jamais dévier visuellement.
export function PageHeader(props: {
  eyebrow?: string;
  title: JSX.Element;
  intro?: JSX.Element;
  actions?: JSX.Element;
  class?: string;
}) {
  return (
    <div class={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${props.class ?? ""}`}>
      <div>
        <span class="flex h-1 w-10 rounded-full bg-accent" />
        <Show when={props.eyebrow}>
          <p class="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-soft">{props.eyebrow}</p>
        </Show>
        <h1 class={`text-3xl font-bold tracking-tight md:text-4xl ${props.eyebrow ? "mt-1.5" : "mt-3"}`}>
          {props.title}
        </h1>
        <Show when={props.intro}>
          <p class="mt-3 max-w-2xl leading-relaxed text-soft">{props.intro}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex shrink-0 items-center gap-3">{props.actions}</div>
      </Show>
    </div>
  );
}
