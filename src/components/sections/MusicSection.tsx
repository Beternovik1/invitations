import SectionShell from "@/components/ui/SectionShell";

import { MUSIC } from "@/lib/constants";

/**
 * Music section — a static, explanatory chapter about the song of the night.
 *
 * The actual playback control is the persistent `FloatingMusicButton` mounted
 * at page level (corner, inside the frame), which owns the only `<audio>`
 * element. This section stays purely informational so there is never a second
 * active audio source on the page. While `MUSIC.enabled` is false it reads as a
 * graceful "soon" card; once the track is dropped in, the copy points guests
 * to the corner control.
 */
export default function MusicSection() {
  const hint = MUSIC.enabled
    ? "Toca el botón musical en la esquina para escucharla cuando quieras."
    : "Pronto podrás escucharla desde el botón musical en la esquina de la invitación.";

  return (
    <SectionShell id="musica" eyebrow="Música" title="La música de la noche">
      <div className="leaf-panel flex max-w-md flex-col items-center gap-5 rounded-2xl p-7 text-center">
        <NoteMark />

        <p
          className="font-serif text-xl italic text-[var(--color-ink)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {MUSIC.title} · {MUSIC.artist}
        </p>

        <p
          className="font-sans text-sm text-[var(--color-ink-dim)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {MUSIC.note}
        </p>

        <p
          className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {hint}
        </p>
      </div>
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Decorative glyph                                                          */
/* -------------------------------------------------------------------------- */

/** Small decorative musical note in gold, mirroring the floating control. */
function NoteMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" fill="none">
      <path
        d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 17.5Z"
        fill="var(--color-gold)"
      />
      <path
        d="M8.5 15V5.2a1 1 0 0 1 .74-.97l7-1.8A1 1 0 0 1 17.5 3.4v9.1"
        stroke="var(--color-gold)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17.5 14.5a2.5 2.5 0 1 1-2.5-2.5 2.5 2.5 0 0 1 2.5 2.5Z"
        fill="var(--color-gold)"
      />
      <path
        d="M8.5 6.5l9-2.3"
        stroke="var(--color-gold-bright)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}