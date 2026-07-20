/**
 * Event content for Sarahí's quinceañera invitation.
 *
 * Keep event-specific copy out of components; components consume these
 * constants so the invitation can be retuned without touching JSX.
 */

export const EVENT = {
  /** Name of the celebrant, used in display copy. Uppercase per the princess
      movie-title treatment request. */
  celebrantName: "SARAHI",
  /** Spanish label for the celebration type. */
  eventType: "Mis XV Años",
  /**
   * Target instant of the celebration as an absolute UTC ISO timestamp.
   *
   * The event takes place on 2026-10-17 at 19:00 in Mexico City. Mexico City
   * observes UTC-6 year-round since the 2022 time-zone reform removed DST for
   * most of the country, so 19:00 local = 01:00 UTC the following calendar day.
   *
   * Storing the instant as UTC keeps countdown math independent of the
   * visitor's own time zone: `Date.parse(startISO)` always returns the same
   * absolute epoch millis regardless of where the page is viewed.
   */
  startISO: "2026-10-18T01:00:00.000Z",
  /** Human-readable, locale-formatted event facts (es-MX). */
  dateLabel: "17 de octubre de 2026",
  timeLabel: "19:00 hrs",
  cityLabel: "Ciudad de México",
  /** Pre-RSVP banner copy; backend not wired yet. */
  rsvpSoonLabel: "Pronto podrás confirmar tu asistencia",
} as const;

/**
 * Generic placeholder asset paths.
 *
 * None of these reference any existing franchise, character, or film art.
 * They are intentionally generic labels so a designer can drop real assets in
 * later without refactoring components.
 */
export const ASSETS = {
  bayouBackground: "/bayou-background-placeholder.jpg",
  goldFrame: "/gold-frame-placeholder.png",
  ogImage: "/photo/sarahi-portrait.png",
  heroPortrait: "/photo/sarahi-portrait.png",
} as const;

/**
 * Site-level metadata used for SEO and link previews.
 *
 * `SITE.url` is a placeholder domain used as `metadataBase`; replace with the
 * final deployment URL before going live.
 */
export const SITE = {
  url: "https://invitaciones-sarahi.example",
  title: "Sarahí — Mis XV Años",
  description:
    "Acompáñame a celebrar mis XV años. Una noche de cuento entre luces del bayou y música de Nueva Orleans.",
  locale: "es_MX",
} as const;

/**
 * Single favorite song for the celebration.
 *
 * Placeholder copy for the one non-vals song Sarahí loves — the vals is a
 * surprise for guests and must not appear here. Browsers block audio
 * autoplay without a user gesture, so the player is user-controlled only:
 * playback starts on a tap/click. `enabled: false` plus an empty
 * `audioPath` keep the player in a clear "soon" state so no `<audio>`
 * element is rendered against a missing file. `loop` defaults to false;
 * flip it on per-song if the chosen track is meant to loop under the
 * evening. Drop the real track in and set `enabled: true` and
 * `audioPath` to the public asset path to activate.
 */
export const MUSIC = {
  enabled: true,
  title: "Ma Belle Evangeline",
  artist: "Princess and the Frog",
  note: "La canción especial de Sarahí. Toca «Abrir invitación» y la música comienza.",
  audioPath: "/music/ma-belle-evangeline.mp4",
  loop: true,
} as const;

/**
 * Ceremony and reception locations.
 *
 * Placeholders only — venue names, addresses and map URLs are generic so a
 * designer can replace them without refactoring the component. `mapsUrl`
 * opens in a new tab from the location cards.
 */
export const LOCATIONS = [
  {
    id: "ceremony",
    kind: "ceremony",
    /** Card title rendered in Edwardian Script inside the "Dónde y Cuándo"
        section. */
    label: "Ceremonia Religiosa",
    /** Local photograph served from /public/photo — referenced from the
        ceremony card image slot (next/image with object-cover). */
    image: "/photo/sagrada-familia.png",
    time: "18:00 hrs",
    venue: "Iglesia Espíritu Santo",
    address: "Palacio de Justicia No. 500, Anáhuac, 66457",
    mapsUrl: "https://maps.app.goo.gl/gbbHB8NQ5vKi3e7g9",
  },
  {
    id: "reception",
    kind: "reception",
    label: "Recepción",
    image: "/photo/alvori.png",
    time: "16:00 hrs",
    venue: "Jardín Alvori - Salón De Eventos",
    address: "Arq. Enrique del moral Domínguez, 36826 Irapuato, Gto.",
    /** Preserved existing shared maps link for the reception venue. */
    mapsUrl: "https://maps.app.goo.gl/vD2fhiqZdFtPDKvf7",
  },
] as const;

/**
 * Order of the evening, adapted to a quinceañera: ceremony, reception,
 * dinner, the waltz, and the dance. Order carries information here, which is
 * why the itinerary renders as a timeline rather than an unordered grid.
 */
export const ITINERARY = [
  { time: "14:00", title: "Misa", description: "Ceremonia religiosa" },
  { time: "16:00", title: "Recepción", description: "Recepción de invitados" },
  { time: "16:30", title: "Comida", description: "Comida" },
  { time: "17:30", title: "Vals", description: "El vals de Sarahí" },
  { time: "18:30", title: "Baile", description: "Baile y fiesta" },
] as const;

/**
 * Dress code for guests. "Esmeralda y dorado" is a classic XV palette; the
 * swatch hexes are content, not theme tokens, so the dress code can diverge
 * from the invitation's own sage/teal palette.
 */
export const DRESS_CODE = {
  title: "Esmeralda y dorado",
  note: "Te invitamos a acompañarnos en tonos esmeralda y dorado para brillar juntos esta noche.",
  palette: [
    { name: "Esmeralda", hex: "#19aa66" },
    { name: "Dorado", hex: "#ffae00" },
  ],
} as const;

/**
 * Gallery placeholders.
 *
 * No real images are referenced — `tone` drives a CSS gradient placeholder
 * so the grid never shows missing-image artifacts. Captions use generic
 * moment names; real asset paths can be added later without touching the
 * component.
 */
export const GALLERY = [
  { id: "welcome", caption: "Lupita foto", tone: "sage" },
  { id: "ceremony", caption: "Lupita foto", tone: "teal" },
  { id: "waltz", caption: "Lupita foto", tone: "gold" },
  { id: "party", caption: "Lupita foto", tone: "cream" },
] as const;
