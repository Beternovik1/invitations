"use client";

/**
 * BlessingHosts — the "con la bendición de Dios" section.
 *
 * Sits immediately after `IntroMessage` (the user asked for it to be the next
 * section, before RSVP/locations). A single centered column on the page
 * atmosphere with a narrow squared golden border that frames the copy
 * left-to-right and top-to-bottom.
 *
 * Typographic split follows the user's direction:
 *   - Ceremonial lines and group labels use the same Edwardian Script ITC
 *     face and size.
 *   - Names use Google Sans.
 *
 * The copy is the user-supplied Spanish text (verbatim, with corrected
 * accents and "ñ"). Code and comments stay in English per project
 * convention.
 *
 * Client Component: needed for the orchestrated scroll reveal — the frame
 * fades in subtly, then the opening line, parents group (staggered), padrinos
 * group (staggered), and finally the closing line. Visual design, copy,
 * fonts, sizes, and the golden border are unchanged.
 */

import { motion, useReducedMotion, type Variants } from "framer-motion";

/* Shared easing matches the hero/SectionShell so the whole invitation moves
   as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const GOOGLE_SANS = { fontFamily: "var(--font-google-sans)" } as const;
const SCRIPT_TEXT_CLASS =
  "text-balance text-[clamp(2.25rem,9vw,3.25rem)] leading-[1.12] text-[var(--color-ink)]";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.16, delayChildren: 0.06 },
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

/** Inner sub-groups also stagger their children, so the parents and padrinos
    blocks read as two quiet waves instead of one bulk reveal. */
const groupVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0.04 },
  },
};

export default function BlessingHosts() {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;
  const group = reduceMotion ? reducedVariants : groupVariants;

  return (
    <section
      id="bendicion"
      className="relative isolate flex w-full flex-col items-center justify-center px-5 py-16 sm:py-20"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
      {/* The narrow golden frame — squared corners, thin line, balanced
          padding inside. Max width stays narrow on purpose so the border hugs
          the copy rather than stretching across the page. The frame itself
          fades in subtly as the container reveal, then each line staggers
          within it. */}
      <motion.div
        className="flex w-full max-w-sm flex-col items-center border border-[var(--color-gold)] px-6 py-10 text-center sm:px-8 sm:py-12"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        {/* Opening ceremonial line — script, slightly larger so it reads as
            the thesis of this section. Appears first. */}
        <motion.p className={SCRIPT_TEXT_CLASS} style={EDWARDIAN} variants={item}>
          Con la bendición de Dios y en compañía de mis padres y padrinos
        </motion.p>

        {/* Parents group — label then names stagger as one wave. */}
        <motion.div
          className="mt-8 flex flex-col items-center gap-3"
          variants={group}
        >
          <motion.p className={SCRIPT_TEXT_CLASS} style={EDWARDIAN} variants={item}>
            Mis Padres
          </motion.p>
          <motion.p
            className="text-balance text-[clamp(1rem,4vw,1.25rem)] leading-snug text-[var(--color-ink)]"
            style={GOOGLE_SANS}
            variants={item}
          >
            Juan Alfonso Alfaro García
          </motion.p>
          <motion.p
            className="text-balance text-[clamp(1rem,4vw,1.25rem)] leading-snug text-[var(--color-ink)]"
            style={GOOGLE_SANS}
            variants={item}
          >
            Cristina Hernández Castañeda
          </motion.p>
        </motion.div>

        {/* Padrinos group — second wave, same internal cadence as parents. */}
        <motion.div
          className="mt-8 flex flex-col items-center gap-3"
          variants={group}
        >
          <motion.p className={SCRIPT_TEXT_CLASS} style={EDWARDIAN} variants={item}>
            Mis Padrinos
          </motion.p>
          <motion.p
            className="text-balance text-[clamp(1rem,4vw,1.25rem)] leading-snug text-[var(--color-ink)]"
            style={GOOGLE_SANS}
            variants={item}
          >
            Ma. Soledad Hernández Castañeda
          </motion.p>
          <motion.p
            className="text-balance text-[clamp(1rem,4vw,1.25rem)] leading-snug text-[var(--color-ink)]"
            style={GOOGLE_SANS}
            variants={item}
          >
            Martín Ávila Rodríguez
          </motion.p>
        </motion.div>

        {/* Closing ceremonial line — script, mirrors the opening so the
            section opens and resolves in the same voice. Appears last via the
            container stagger. */}
        <motion.p
          className={`mt-8 ${SCRIPT_TEXT_CLASS}`}
          style={EDWARDIAN}
          variants={item}
        >
          Nos complace invitarte a ser parte de este gran día.
        </motion.p>
      </motion.div>
    </section>
  );
}
