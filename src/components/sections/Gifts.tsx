import Image from "next/image";

/* Self-hosted font variables — both are mounted in `app/layout.tsx`
   (edwardianscriptitc.ttf -> --font-edwardian-script; Baskervville
   VariableFont_wght -> --font-baskervville). Matches the type split used by
   the "Dónde y Cuándo" / RSVP cards so the page reads as one piece. */
const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

/* Card palette — copied verbatim from `Locations.tsx` ("Dónde y Cuándo") and
   `Rsvp.tsx` so the gift card reads as a sibling of those cards: thin gold
   frame, dusty-blue content panel, navy button with ivory text. Square corners
   — no border-radius — per the brief. */
const IVORY = "#F5F3EE";
const PANEL = "#E6ECF2";
const GOLD = "#C7A96A";
const INK = "#1A1A1A";
const NIGHT = "#2E3E50";

/* Liverpool mesa de regalos — the only external destination for this section.
   The event number is shown to the guest as the printed-on-card value
   (`5200 6075`, with a space) so they can also reference it by phone/in
   store; the button deep-links directly to the list URL. */
const GIFT_REGISTRY_URL =
  "https://mesaderegalos.liverpool.com.mx/milistaderegalos/52006075";
const GIFT_EVENT_NAME = "XV Años Lupita";
const GIFT_EVENT_NUMBER = "5200 6075";

/**
 * "Regalos" section.
 *
 * One centered card on the same mist-blue background as "Dónde y Cuándo" /
 * RSVP, framed by a hairline gold border. The Liverpool logo sits at the top
 * as the visual anchor, followed by the event name and event number in
 * Baskervville, and a single navy "VER LISTA DE REGALOS" button that opens
 * the Liverpool mesa de regalos page in a new tab. The title `Regalos` is set
 * in Edwardian Script — the same face used by the other chapter headings.
 *
 * Plain Server Component — no motion, no client state. The logo image and the
 * quiet typography are the experience here.
 */
export default function Gifts() {
  return (
    <section
      id="regalos"
      className="w-full px-6 py-16 sm:py-20"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
      {/* Section title — Edwardian Script, the exact face used by the
          `Dónde y Cuándo` / `Código de vestimenta` titles. Same clamp scale
          so chapter headings match. */}
      <h2
        className="mx-auto mb-10 text-center text-[clamp(3.25rem,6vw,3.75rem)] leading-none"
        style={{ ...EDWARDIAN, color: INK }}
      >
        Regalos
      </h2>

      {/* Card: thin 1px gold frame, square corners, dusty-blue content panel —
          a sibling of the location / RSVP cards. */}
      <div
        className="mx-auto w-full max-w-xl border"
        style={{ borderColor: GOLD }}
      >
        <div
          className="flex flex-col items-center px-6 py-10 text-center sm:px-10"
          style={{ backgroundColor: PANEL }}
        >
          {/* Liverpool logo — the visual anchor of the card. Decorative; the
              event name below is the accessible label for the brand context. */}
          <Image
            src="/photo/liverpool-logo.png"
            alt="Liverpool"
            width={220}
            height={120}
            className="h-auto w-[160px] sm:w-[200px]"
            sizes="200px"
          />

          {/* Event name — Baskervville, the exact face used in the location
              card body. The single most legible line on the card. */}
          <p
            className="mt-6 text-[1.6rem] leading-snug"
            style={{ ...BASKERVVILLE, color: NIGHT }}
          >
            {GIFT_EVENT_NAME}
          </p>

          {/* Event number — small uppercase label + the printed-on-card value
              so the guest can also reference it by phone / in store. */}
          <p
            className="mt-2 text-[0.8rem] uppercase tracking-[0.2em]"
            style={{ ...BASKERVVILLE, color: NIGHT }}
          >
            No. de evento
          </p>
          <p
            className="mt-1 text-[1.4rem] leading-none"
            style={{ ...BASKERVVILLE, color: NIGHT }}
          >
            {GIFT_EVENT_NUMBER}
          </p>

          {/* VER LISTA DE REGALOS button — night-blue rectangle, no radius,
              Baskervville uppercase with letter-spacing. Opens the Liverpool
              mesa de regalos list in a new tab so the invitation stays light. */}
          <a
            href={GIFT_REGISTRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver lista de regalos de ${GIFT_EVENT_NAME} en Liverpool (se abre en una nueva pestaña)`}
            className="mt-8 inline-block px-10 py-3.5 text-[0.85rem] uppercase tracking-[0.25em] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E6ECF2]"
            style={{ ...BASKERVVILLE, backgroundColor: NIGHT, color: IVORY }}
          >
            Ver lista de regalos
          </a>
        </div>
      </div>
    </section>
  );
}