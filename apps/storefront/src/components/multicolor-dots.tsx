import { For } from "solid-js";

const COLORS = ["#e5231c", "#1d4ed8", "#f59e0b", "#1c1917"];
const COLORS_ON_DARK = ["#e5231c", "#1d4ed8", "#f59e0b", "#fafaf9"];

export function MulticolorDots(props: { size?: number; onDark?: boolean }) {
  const size = () => props.size ?? 8;
  const colors = () => (props.onDark ? COLORS_ON_DARK : COLORS);

  return (
    <span class="inline-flex items-center gap-1">
      <For each={colors()}>
        {(c) => (
          <span class="rounded-full" style={{ width: `${size()}px`, height: `${size()}px`, "background-color": c }} />
        )}
      </For>
    </span>
  );
}
