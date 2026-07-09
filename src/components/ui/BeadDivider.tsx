/**
 * Mardi Gras–inspired bead divider.
 *
 * A horizontal string of alternating gold / moss / blush beads separated by a
 * hairline gold rule. Purely decorative; marks a section transition without
 * the templated "01 / 02 / 03" markers that don't carry information here.
 */

interface BeadDividerProps {
  className?: string;
  /** Number of bead triplets on each side of the center. */
  pairs?: number;
}

/* Gold / dusty-teal / cream — tuned to the softer sage/teal palette so the
   divider reads as part of the new frame instead of a remnant of the old
   amber/forest one. */
const BEAD_COLORS = ["#c79a3c", "#77a291", "#f9fce4"] as const;

export default function BeadDivider({
  className,
  pairs = 5,
}: BeadDividerProps) {
  const beads = Array.from({ length: pairs * 2 + 1 }, (_, i) => i);

  return (
    <div
      className={`flex items-center justify-center gap-2 ${className ?? ""}`}
      aria-hidden="true"
    >
      {beads.map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full shadow-[0_1px_4px_rgba(24,47,32,0.28)]"
          style={{ background: BEAD_COLORS[i % BEAD_COLORS.length] }}
        />
      ))}
      <span className="mx-1 h-px w-16 max-w-[18vw] gold-hairline" />
      {beads
        .slice()
        .reverse()
        .map((i) => (
          <span
            key={`r-${i}`}
            className="inline-block h-2 w-2 rounded-full shadow-[0_1px_4px_rgba(24,47,32,0.28)]"
            style={{ background: BEAD_COLORS[i % BEAD_COLORS.length] }}
          />
        ))}
    </div>
  );
}
