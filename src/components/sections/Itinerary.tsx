import SectionShell from "@/components/ui/SectionShell";
import { ITINERARY } from "@/lib/constants";

/**
 * Evening program rendered as a vertical timeline.
 *
 * A timeline (rather than a grid) is used because order carries information
 * here — each entry is a real moment in the night, in sequence. The gold
 * bead marker echoes the bead divider so the timeline belongs to the same
 * visual family as the rest of the invitation.
 */
export default function Itinerary() {
  const last = ITINERARY.length - 1;

  return (
    <SectionShell
      id="programa"
      eyebrow="Programa"
      title="La noche, paso a paso"
    >
      <ol className="flex w-full max-w-xl flex-col gap-5 text-left">
        {ITINERARY.map((item, i) => (
          <li key={item.time} className="flex items-stretch gap-4">
            <div className="flex flex-col items-center pt-1.5">
              <span className="h-3 w-3 rounded-full bg-[var(--color-gold)] shadow-[0_1px_4px_rgba(24,47,32,0.28)]" />
              {i < last && (
                <span className="mt-1 w-px flex-1 gold-hairline" />
              )}
            </div>

            <div className="flex flex-col gap-1 pb-1">
              <span
                className="font-sans text-sm tabular-nums uppercase tracking-[0.2em] text-[var(--color-gold-soft)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {item.time}
              </span>
              <h3
                className="font-serif text-xl text-[var(--color-ink)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {item.title}
              </h3>
              <p className="font-sans text-sm text-[var(--color-ink-dim)]">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
