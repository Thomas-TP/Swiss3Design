// Signature visuelle "4 couleurs AMS" — utilisée sur badges et sections
const COLORS = ["#e5231c", "#1d4ed8", "#f59e0b", "#1c1917"];
// Sur fond sombre, le noir devient blanc cassé (cohérent avec les barres)
const COLORS_ON_DARK = ["#e5231c", "#1d4ed8", "#f59e0b", "#fafaf9"];

export function MulticolorDots({
  size = 8,
  onDark = false,
}: {
  size?: number;
  onDark?: boolean;
}) {
  const colors = onDark ? COLORS_ON_DARK : COLORS;
  return (
    <span className="inline-flex items-center gap-1">
      {colors.map((c) => (
        <span
          key={c}
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: c }}
        />
      ))}
    </span>
  );
}
