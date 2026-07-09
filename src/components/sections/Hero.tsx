"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";

import { ASSETS, EVENT } from "@/lib/constants";
import BeadDivider from "@/components/ui/BeadDivider";
import Countdown from "@/components/ui/Countdown";
import Fireflies from "@/components/ui/Fireflies";
import OrnamentalFrame from "@/components/ui/OrnamentalFrame";

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

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;

  return (
    <section
      className="relative isolate flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
      // Twilight bayou gradient backdrop. Inline-styled so it composites layers
      // (radial glow + linear depth) without expanding the Tailwind surface API.
      style={{
        background: `
          radial-gradient(90% 70% at 50% 12%, rgba(249, 252, 228, 0.95) 0%, rgba(238, 248, 200, 0.4) 48%, transparent 72%),
          radial-gradient(70% 55% at 50% 88%, rgba(119, 162, 145, 0.32) 0%, rgba(184, 219, 160, 0) 68%),
          linear-gradient(180deg, var(--color-cream-white) 0%, var(--color-pale-yellow-green) 34%, var(--color-sage) 70%, var(--color-dusty-teal) 100%)
        `,
      }}
    >
      {/* Responsive gold decorative border framing the hero. Pure SVG via
          OrnamentalFrame: a double gold rule, floral corner curls, a pink gem
          crowning the top edge and a dusty-teal gem anchoring the bottom.
          Decorative only — aria-hidden + pointer-events-none keep it out of
          the a11y tree and never block interaction. Sits at z-0, behind the
          fireflies and the content stack (z-10). Responsive inset padding
          keeps it from crowding the content on small screens. */}
      <OrnamentalFrame className="inset-3 sm:inset-4 lg:inset-5" />

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
          <span className="mt-1 text-[0.62rem] tracking-[0.2em] text-[var(--color-ink)]">
            {EVENT.rsvpSoonLabel}
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
