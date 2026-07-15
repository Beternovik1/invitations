"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";

import { ASSETS, EVENT } from "@/lib/constants";
import BeadDivider from "@/components/ui/BeadDivider";
import Countdown from "@/components/ui/Countdown";
import Fireflies from "@/components/ui/Fireflies";

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.18, delayChildren: 0.25 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE },
  },
};

const reducedVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

export default function Hero({
  /** When true, hide the "Pronto podrás confirmar tu asistencia" teaser. Set on
   *  the personalized route, where a real RSVP section replaces the teaser so
   *  the two never contradict. The public landing route leaves it false. */
  hideRsvpSoon = false,
}: {
  hideRsvpSoon?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;

  return (
    <section
      className="relative isolate flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
      // Hero no longer paints its own backdrop or its own border: it
      // participates in the continuous `.page-atmosphere` layer mounted on the
      // page so the opening tone journey is shared with the rest of the
      // sections instead of cutting in a separate color block, and the page-
      // level `<OrnamentalFrame>` in `page.tsx` now frames the whole scroll
      // (hero through last element) so the hero keeps just its fireflies,
      // title, portrait and countdown.
    >
      <Fireflies />

      <motion.div
        className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-7 sm:gap-9"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.span
          variants={item}
          className="text-clamp-eyebrow font-sans uppercase text-[var(--color-ink)] drop-shadow-[0_1px_0_rgba(249,252,228,0.75)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {EVENT.eventType}
        </motion.span>

        <motion.h1
          variants={item}
          className="text-clamp-name font-display title-gold gold-shimmer"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {EVENT.celebrantName}
        </motion.h1>

        <motion.div
          variants={item}
          className="flex w-full flex-col items-center gap-3"
        >
          <Image
            src={ASSETS.heroPortrait}
            alt="Sarahí"
            width={420}
            height={560}
            priority
            className="w-56 max-w-[68vw] drop-shadow-[0_18px_34px_rgba(33,58,50,0.35)] sm:w-72"
          />
        </motion.div>

        <motion.p
          variants={item}
          className="leaf-panel max-w-xl rounded-[2rem] px-5 py-4 text-clamp-sub font-serif italic text-[var(--color-ink)] sm:px-7"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Acompáñame a celebrar una noche de cuento entre luces del bayou y
          música de Nueva Orleans.
        </motion.p>

        <motion.div variants={item} className="w-full">
          <BeadDivider className="mb-7" />
          <Countdown />
        </motion.div>

        <motion.div
          variants={item}
          className="flex flex-col items-center gap-1 text-xs uppercase tracking-[0.25em] text-[var(--color-ink-dim)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <span className="font-medium text-[var(--color-ink)]">{EVENT.dateLabel}</span>
          <span>
            {EVENT.timeLabel} · {EVENT.cityLabel}
          </span>
          {!hideRsvpSoon && (
            <span className="mt-1 text-[0.62rem] tracking-[0.2em] text-[var(--color-ink)]">
              {EVENT.rsvpSoonLabel}
            </span>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
