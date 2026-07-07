// Swiss3Design logomark — vectorised isometric cube with 180° rotational symmetry:
// an ink/white "L" (bottom-left) and its mirrored red twin (top-right).
// The neutral ribbon uses `currentColor` so it themes with the surrounding text.

const RED = "#E5231C";

export function BrandMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 300 300"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <polygon
        points="53,84 91,64 93,159 195,240 159,266 52,201"
        fill="currentColor"
      />
      <polygon
        points="251,220 213,240 211,145 109,64 145,38 252,103"
        fill={RED}
      />
    </svg>
  );
}
