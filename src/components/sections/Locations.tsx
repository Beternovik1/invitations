import SectionShell from "@/components/ui/SectionShell";
import { LOCATIONS } from "@/lib/constants";

/* Gold for the ceremony pin, dusty-teal for the reception pin — the two
   locations stay distinguishable at a glance without literal icons. */
const PIN_COLOR: Record<(typeof LOCATIONS)[number]["kind"], string> = {
  ceremony: "var(--color-gold)",
  reception: "var(--color-dusty-teal)",
};

/**
 * Ceremony and reception cards with "Cómo llegar" map links.
 *
 * Map links open in a new tab (no embedded iframe) so the page stays light
 * and avoids third-party layout shift.
 */
export default function Locations() {
  return (
    <SectionShell id="lugar" eyebrow="El lugar" title="Dónde nos acompañarás">
      <div className="grid w-full gap-5 sm:grid-cols-2 sm:gap-6">
        {LOCATIONS.map((loc) => (
          <article
            key={loc.id}
            className="leaf-panel flex flex-col gap-4 rounded-2xl p-6 text-left"
          >
            <div className="flex items-center gap-3">
              <PinMark color={PIN_COLOR[loc.kind]} />
              <span
                className="font-serif text-xl text-[var(--color-gold-soft)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {loc.label}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h3
                className="font-serif text-2xl text-[var(--color-ink)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {loc.venue}
              </h3>
              <p className="font-sans text-sm text-[var(--color-ink-dim)]">
                {loc.address}
              </p>
            </div>

            <span
              className="font-sans text-sm uppercase tracking-[0.2em] text-[var(--color-ink)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {loc.time}
            </span>

            <a
              href={loc.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center justify-center gap-2 rounded-full border border-[var(--color-gold)] px-5 py-2 font-sans text-xs uppercase tracking-[0.2em] text-[var(--color-gold-soft)] transition-colors hover:bg-[var(--color-gold)] hover:text-[var(--color-cream-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream-white)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Cómo llegar
            </a>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

/** Small decorative location pin. Color encodes the location kind. */
function PinMark({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M12 2C7.6 2 4 5.6 4 10c0 5.2 6.4 11.2 7.3 12a1 1 0 0 0 1.4 0C13.6 21.2 20 15.2 20 10c0-4.4-3.6-8-8-8Z"
        fill={color}
        opacity="0.9"
      />
      <circle cx="12" cy="10" r="2.8" fill="var(--color-cream-white)" />
    </svg>
  );
}
