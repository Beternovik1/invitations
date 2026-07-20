import Image from "next/image";

import { LOCATIONS } from "@/lib/constants";

/* Self-hosted font variables — both are already mounted in `layout.tsx`
   (edwardianscriptitc.ttf -> --font-edwardian-script; the Baskervville
   VariableFont_wght -> --font-baskervville). These match the type split used
   by CountdownSection / IntroMessage so the page reads as one piece. */
const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

/* Content colors for the "Dónde y Cuándo" section. The mist-blue background
   (the page's own --color-mist-blue token) and dusty-blue content panel are
   intentionally quiet so the script titles and the gold hairline frame do
   the talking. IVORY stays as the button text color on the dark navy banner. */
const IVORY = "#F5F3EE";
const PANEL = "#E6ECF2";
const GOLD = "#C7A96A";
const INK = "#1A1A1A";
const NIGHT = "#2E3E50";

/**
 * "Dónde y Cuándo" section.
 *
 * Two side-by-side cards (stacked on mobile) — each card is a fixed 4:3
 * photograph on top of a centered dusty-blue content panel, wrapped in a
 * hairline gold frame. The ceremony card sits on the left, reception on the
 * right. Titles are Edwardian Script; venue / time / address copy and the
 * "VER MAPA" button are Baskervville.
 *
 * This replaces the earlier leaf-panel + pin layout with the user-specified
 * card-and-photo treatment. It is a plain Server Component — no motion,
 * because the photographs and the quiet typography are the experience here.
 */
export default function Locations() {
  return (
    <section
      id="lugar"
      className="w-full px-6 py-24 sm:py-28"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
      {/* Section title: Edwardian Script, large, centered, dark. Sits alone
          above the cards with breathing room below. */}
      <h2
        className="mx-auto mb-14 text-center text-[clamp(3.25rem,6vw,3.75rem)] leading-none"
        style={{ ...EDWARDIAN, color: INK }}
      >
        Dónde y Cuándo
      </h2>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8">
        {LOCATIONS.map((loc) => (
          <article
            key={loc.id}
            /* Thin 1px gold frame wraps the entire card; the image sits inside
               the frame (overflow-hidden keeps the photo flush with the
               edge). Square corners — no border-radius — per the brief. */
            className="flex flex-col overflow-hidden border"
            style={{ borderColor: GOLD }}
          >
            {/* Top full-width image, fixed 4:3, cover, square corners. */}
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={loc.image}
                alt={`${loc.venue}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            {/* Content panel: dusty-blue, generous vertical padding, centered
               text. */}
            <div
              className="flex flex-col items-center px-6 py-10 text-center"
              style={{ backgroundColor: PANEL }}
            >
              {/* Card title — Edwardian Script, ~36-40px, dark. */}
              <h3
                className="text-[2.25rem] leading-none"
                style={{ ...EDWARDIAN, color: INK }}
              >
                {loc.label}
              </h3>

              {/* Venue / time / address — Baskervville, ~18-20px. */}
              <p
                className="mt-6 text-[1.15rem]"
                style={{ ...BASKERVVILLE, color: NIGHT }}
              >
                {loc.venue}
              </p>
              <p
                className="mt-1 text-[1.15rem]"
                style={{ ...BASKERVVILLE, color: NIGHT }}
              >
                {loc.time}
              </p>
              <p
                className="mt-2 max-w-xs text-[1rem] leading-relaxed"
                style={{ ...BASKERVVILLE, color: NIGHT }}
              >
                {loc.address}
              </p>

              {/* VER MAPA button — night-blue rectangle, no radius, Baskervville
                  uppercase with letter-spacing. Opens the maps link in a new
                  tab so the invitation stays light (no iframe). */}
              <a
                href={loc.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver mapa de ${loc.venue}`}
                className="mt-6 inline-block px-10 py-3.5 text-[0.85rem] uppercase tracking-[0.25em] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  ...BASKERVVILLE,
                  backgroundColor: NIGHT,
                  color: IVORY,
                }}
              >
                VER MAPA
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
