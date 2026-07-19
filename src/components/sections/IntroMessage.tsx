"use client";

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
 * Client Component: needed for the orchestrated scroll reveal (whileInView +
 * staggered children) and the reduced-motion hook. The visual design, copy,
 * fonts, sizes, and color block are unchanged.
 */

import { motion, useReducedMotion, type Variants } from "framer-motion";

/* Shared easing matches the hero/SectionShell so the whole invitation moves
   as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

const INTRO_TEXT =
  "Te invito a celebrar el inicio de una nueva etapa en mi vida, llena de sueños, metas y grandes logros.";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.18, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

const reducedVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

export default function IntroMessage() {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;

  return (
    <section
      id="intro-mensaje"
      // Steady backdrop, no atmosphere layer here: the user asked for a focused
      // block of color between the hero image and the rest of the invitation.
      className="relative isolate flex min-h-[32dvh] w-full flex-col items-center justify-center bg-[#3B5B77] px-8 py-14 text-center"
    >
      <motion.div
        className="flex w-full max-w-xl flex-col items-center gap-5"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.5 }}
      >
        {/* The invitation line fades up first; the heart follows on the
            stagger, so it lands a beat after the text settles. */}
        <motion.p
          variants={item}
          className="text-balance text-[clamp(1.28rem,5.1vw,2rem)] leading-relaxed text-white/95"
          style={{ fontFamily: "var(--font-baskervville)" }}
        >
          {INTRO_TEXT}
        </motion.p>

        {/* A single quiet heart beneath the line — the one ornament this
            section earns. Filled white keeps it legible on the steady blue. */}
        <motion.svg
          variants={item}
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 text-white"
          fill="currentColor"
        >
          <path d="M12 21s-7.5-4.9-10-9.2C.6 9 1.5 5.5 4.8 4.8c2-.4 3.9.6 4.7 2.3l.5 1 .5-1c.8-1.7 2.7-2.7 4.7-2.3 3.3.7 4.2 4.2 2.8 6.9-2.5 4.3-10 9.2-10 9.2z" />
        </motion.svg>
      </motion.div>
    </section>
  );
}