// Signature visuelle "4 couleurs AMS" — utilisée sur badges et sections
const COLORS = ["#da291c", "#1d4ed8", "#f59e0b", "#1c1917"];

export function MulticolorDots({ size = 8 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {COLORS.map((c) => (
        <span
          key={c}
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: c }}
        />
      ))}
    </span>
  );
}
