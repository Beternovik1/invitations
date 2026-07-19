/**
 * IntroMessage — the invitation line.
 *
 * Sits immediately below the Hero portrait and above the RSVP slot. Mobile-first:
 * a single centered column on a steady `#3B5B77` block at ~25dvh, sized as a
 * compact transition between the full-viewport hero and the denser
 * RSVP/locations sections.
 *
 * The copy is the user-supplied Spanish invitation line (verbatim). Code and
 * comments remain in English per the project convention.
 *
 * Server Component: no interactivity, no hooks — stays static and cheap.
 */

const INTRO_TEXT =
  "Te invito a celebrar el inicio de una nueva etapa en mi vida, llena de sueños, metas y grandes logros.";

export default function IntroMessage() {
  return (
    <section
      id="intro-mensaje"
      // Steady backdrop, no atmosphere layer here: the user asked for a focused
      // block of color between the hero image and the rest of the invitation.
      className="relative isolate flex min-h-[32dvh] w-full flex-col items-center justify-center bg-[#3B5B77] px-8 py-14 text-center"
    >
      <div className="flex w-full max-w-xl flex-col items-center gap-5">
        <p
          className="text-balance text-[clamp(1.28rem,5.1vw,2rem)] leading-relaxed text-white/95"
          style={{ fontFamily: "var(--font-baskervville)" }}
        >
          {INTRO_TEXT}
        </p>

        {/* A single quiet heart beneath the line — the one ornament this
            section earns. Filled white keeps it legible on the steady blue. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 text-white"
          fill="currentColor"
        >
          <path d="M12 21s-7.5-4.9-10-9.2C.6 9 1.5 5.5 4.8 4.8c2-.4 3.9.6 4.7 2.3l.5 1 .5-1c.8-1.7 2.7-2.7 4.7-2.3 3.3.7 4.2 4.2 2.8 6.9-2.5 4.3-10 9.2-10 9.2z" />
        </svg>
      </div>
    </section>
  );
}
