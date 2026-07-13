import SectionShell from "@/components/ui/SectionShell";
import { DRESS_CODE } from "@/lib/constants";

/**
 * Dress code note with two color swatches.
 *
 * The swatch hexes come from the DRESS_CODE content (esmeralda + dorado), not
 * from the invitation's own sage/teal theme — the dress code is allowed to
 * name a palette distinct from the page's.
 */
export default function DressCode() {
  return (
    <SectionShell
      id="vestimenta"
      eyebrow="Código de vestimenta"
      title={DRESS_CODE.title}
    >
      <p
        className="max-w-lg text-clamp-sub font-serif italic text-[var(--color-ink)]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {DRESS_CODE.note}
      </p>

      <div className="flex items-center justify-center gap-7">
        {DRESS_CODE.palette.map((swatch) => (
          <div key={swatch.name} className="flex flex-col items-center gap-3">
            <span
              className="h-16 w-16 rounded-full border border-[var(--color-gold)] shadow-[0_8px_20px_rgba(33,58,50,0.28)]"
              style={{ background: swatch.hex }}
            />
            <span
              className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--color-ink-dim)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {swatch.name}
            </span>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
